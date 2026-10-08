import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Prueba de seguridad más importante del proyecto hasta ahora: verifica que
 * Row-Level Security realmente aísla los datos entre organizaciones, no solo
 * que el flujo feliz funcione. Corre contra Postgres real — requiere que la
 * migración de RLS (fase1_rls_setup) ya esté aplicada y `RUNTIME_DATABASE_URL`
 * configurada (ver .env.example).
 */
describe('Organizations (e2e, contra Postgres real — aislamiento multi-tenant)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // Cliente aparte, conectado como superusuario (DATABASE_URL): necesario
  // porque `organizations`/`memberships`/`audit_log` tienen RLS y el
  // PrismaService de la app (app_runtime) no ve filas sin el contexto de
  // organización fijado — para limpieza/inspección de test se usa este.
  const adminDb = new PrismaClient();

  const runId = Date.now();
  const emailA = `org-e2e-${runId}-a@example.com`;
  const emailB = `org-e2e-${runId}-b@example.com`;
  const password = 'contraseñaSegura123';
  const emailsCreados = [emailA, emailB];

  let tokenA: string;
  let tokenB: string;
  let orgAId: string;
  let orgBId: string;

  // Contador síncrono para generar documentos únicos (ver mismo patrón en
  // memberships.e2e.spec.ts) — /auth/register ahora exige tipoDocumento +
  // numeroDocumento (perfiles reclamables, ver auth.e2e.spec.ts).
  let contadorDocumento = 0;

  async function registrarYLoguear(email: string, nombre: string): Promise<string> {
    contadorDocumento += 1;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        nombre,
        fechaNacimiento: '1990-01-01',
        tipoDocumento: 'CC',
        numeroDocumento: `${runId}${String(contadorDocumento).padStart(3, '0')}`,
      });
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    return login.body.data.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    tokenA = await registrarYLoguear(emailA, 'Admin Org A');
    tokenB = await registrarYLoguear(emailB, 'Admin Org B');

    const orgA = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: 'Organización A', tipo: 'club', prefijoCodigoJugador: 'ORGA' });
    orgAId = orgA.body.data.id;

    const orgB = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ nombre: 'Organización B', tipo: 'club', prefijoCodigoJugador: 'ORGB' });
    orgBId = orgB.body.data.id;
  });

  afterAll(async () => {
    // Filtra ids que nunca llegaron a crearse (ej. si beforeAll falló antes de
    // tiempo) para que un fallo real no quede tapado por un error de limpieza.
    const idsACrear = [orgAId, orgBId].filter((id): id is string => Boolean(id));
    if (idsACrear.length > 0) {
      // Cascade (onDelete: Cascade) se encarga de memberships/audit_log de estas organizaciones.
      await adminDb.organization.deleteMany({ where: { id: { in: idsACrear } } });
    }
    await prisma.user.deleteMany({ where: { email: { in: emailsCreados } } });
    await adminDb.$disconnect();
    await app.close();
  });

  describe('POST /organizations', () => {
    it('deja al creador como admin_org activo de la organización nueva', async () => {
      const membresia = await adminDb.membership.findFirst({ where: { organizationId: orgAId } });

      expect(membresia).toMatchObject({ rol: 'admin_org', estado: 'activo' });
      expect(membresia?.codigoJugador).toMatch(/^ORGA-\d{4}$/);
      expect(membresia?.fechaIngreso).not.toBeNull();
    });
  });

  describe('GET /organizations/:id — flujo feliz', () => {
    it('el creador puede ver el detalle de su propia organización', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${orgAId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.data).toMatchObject({ id: orgAId, nombre: 'Organización A' });
    });
  });

  describe('PATCH /organizations/:id — flujo feliz + auditoría', () => {
    it('el creador puede editar su organización y queda un registro de auditoría', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/organizations/${orgAId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ nombre: 'Organización A Editada' });

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.data.nombre).toBe('Organización A Editada');

      const auditoria = await adminDb.auditLog.findFirst({
        where: { organizationId: orgAId, entidadTipo: 'organization', accion: 'editar' },
        orderBy: { fecha: 'desc' },
      });
      expect(auditoria).toBeTruthy();
      expect(auditoria?.valoresNuevos).toMatchObject({ nombre: 'Organización A Editada' });
    });
  });

  describe('Aislamiento multi-tenant — usuario de la organización A contra la organización B', () => {
    it('GET /organizations/{orgB} responde 403 no_es_miembro_de_la_organizacion', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${orgBId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.error.code).toBe('no_es_miembro_de_la_organizacion');
    });

    it('PATCH /organizations/{orgB} responde 403 y no modifica nada', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/organizations/${orgBId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ nombre: 'Intento de secuestro' });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);

      const orgB = await adminDb.organization.findUnique({ where: { id: orgBId } });
      expect(orgB?.nombre).toBe('Organización B');
    });

    it('GET /organizations/{orgB}/memberships responde 403 (no puede listar miembros ajenos)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${orgBId}/memberships`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.error.code).toBe('no_es_miembro_de_la_organizacion');
    });
  });

  describe('Validación del identificador de organización', () => {
    it('responde 400 cuando el id de la ruta no es un UUID válido', async () => {
      const response = await request(app.getHttpServer())
        .get('/organizations/no-es-un-uuid')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe('organization_id_invalido');
    });
  });
});
