-- ============================================================
-- 1) Rol de runtime sin privilegios de superusuario
-- ============================================================
-- ADVERTENCIA: contraseña de desarrollo en texto plano, mismo criterio que
-- POSTGRES_PASSWORD en docker-compose.yml (solo para tu máquina local).
-- ANTES DE PRODUCCIÓN: generar una contraseña real distinta para
-- `app_runtime` en el Postgres administrado (Railway/Supabase) y nunca
-- reusar esta.
-- CREATE ROLE es una operación de todo el clúster de Postgres, no de una
-- sola base de datos — hay que hacerla idempotente: `prisma migrate dev`
-- valida cada migración contra una "shadow database" temporal antes de
-- aplicarla a la real, y como el rol es del clúster (no de esa base de
-- datos temporal), un `CREATE ROLE` simple fallaría con "ya existe" al
-- aplicarse a la base de datos real justo después.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- Se asegura la contraseña en cada corrida (por si el rol ya existía de una
-- validación previa de shadow database sin contraseña seteada).
ALTER ROLE app_runtime WITH PASSWORD 'app_runtime_dev_password_CHANGE_ME';

GRANT CONNECT ON DATABASE torneos_saas TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_runtime;

-- Acceso a todas las tablas existentes hoy (incluye las de Fase 0: users,
-- permissions, role_permissions, plans, sports, refresh_tokens,
-- password_reset_tokens — ninguna de esas lleva RLS, pero el backend en
-- ejecución igual necesita poder leerlas/escribirlas como app_runtime).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;

-- Para que las tablas de FASES FUTURAS también queden accesibles a
-- app_runtime sin tener que acordarse de este GRANT en cada migración nueva.
ALTER DEFAULT PRIVILEGES FOR ROLE "user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

-- ============================================================
-- 2) Row-Level Security en organizations / memberships / audit_log
-- ============================================================
-- `organizations` no tiene columna `organization_id` propia — la política
-- compara contra su propio `id`.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

CREATE POLICY organizations_tenant_isolation ON organizations
  USING (id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (id = current_setting('app.current_organization_id', true)::uuid);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY memberships_tenant_isolation ON memberships
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_log_tenant_isolation ON audit_log
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- NOTA: `user_guardians` NO lleva RLS a propósito — es una relación global
-- usuario-usuario sin `organization_id` (ver comentario en schema.prisma).

-- ============================================================
-- 3) Excepción controlada: admin_org que comparte organización con un menor
-- ============================================================
-- SECURITY DEFINER: se ejecuta con los privilegios de quien la crea (el
-- superusuario que corre esta migración), así que puede leer `memberships`
-- sin que la política de RLS se lo impida — pero solo devuelve un booleano,
-- nunca expone filas de otras organizaciones. `app_runtime` solo tiene
-- permiso para EJECUTARLA, no para leer `memberships` de organizaciones
-- ajenas por otro camino.
CREATE OR REPLACE FUNCTION user_shares_admin_org(p_admin_user_id uuid, p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m_admin
    JOIN memberships m_target
      ON m_target.organization_id = m_admin.organization_id
    WHERE m_admin.user_id = p_admin_user_id
      AND m_admin.rol = 'admin_org'
      AND m_admin.estado = 'activo'
      AND m_target.user_id = p_target_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION user_shares_admin_org(uuid, uuid) TO app_runtime;
