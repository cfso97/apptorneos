# Memoria — backend-dev (AppTorneos)

- [Autorización de migraciones](feedback_migration-authorization.md) — qué hacer si una tarea delegada pide correr `migrate dev`, en tensión con la regla de que solo Cristian lo hace.
- [Fase 0 (Auth) implementada](project_fase0-auth-implementation.md) — modelos agregados, refresh/reset tokens opaques (no JWT), gap de doc detectado.
- [Entorno local de Cristian](project_local-dev-environment.md) — pnpm vía corepack, cómo arrancar Docker Desktop, bug de eslint/tsconfig con `test/` ya corregido.
- [Fase 1 (Organizaciones) implementada](project_fase1-organizaciones-implementation.md) — RLS real (app_runtime + TenantPrismaService), GuardianAccessGuard, migraciones pendientes de que Cristian las corra.
- [Perfiles reclamables implementados](project_perfiles-reclamables-implementation.md) — documento único, email/password opcionales, reclamo de perfil sombra en register/invite.
- [class-validator: ValidateIf tapa validadores custom](feedback_class-validator-validateif-gotcha.md) — no pongas el chequeo XOR en una propiedad que ya tiene su propio @ValidateIf.
