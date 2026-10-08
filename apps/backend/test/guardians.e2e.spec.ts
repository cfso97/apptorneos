import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Guardians (e2e, contra Postgres real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const adminDb = new PrismaClient();

  const runId = Date.now();
  const password = 'contraseñaSegura123';
  const emailMenor = `guard-e2e-${runId}-menor@example.com`;
  const emailAcudiente = `guard-e2e-${runId}-acudiente@example.com`;
  const emailAdminCompartido = `guard-e2e-${runId}-admin-compartido@example.com`;
  const emailAdminOtraOrg = `guard-e2e-${runId}-admin-otra-org@example.com`;
  const emailTercero = `guard-e2e-${runId}-tercero@example.com`;
  const emailsCreados = [emailMenor, emailAcudiente, emailAdminCompartido, emailAdminOtraOrg, emailTercero];

  let tokenMenor: string;
  let userIdMenor: string;
  let tokenAdminCompartido: string;
  let tokenAdminOtraOrg: string;
  let tokenTercero: string;
  let orgCompartidaId: string;
  let orgAjenaId: string;

  // Contador síncrono para generar documentos únicos (ver mismo patrón en
  // memberships.e2e.spec.ts) — /auth/register ahora exige tipoDocumento +
  // numeroDocumento (perfiles reclamables, ver auth.e2e.spec.ts).
  let contadorDocumento = 0;

  async function registrar(email: string, nombre: string): Promise<{ accessToken: string; userId: string }> {
    contadorDocumento += 1;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        nombre,
        fechaNacimiento: '2010-01-01',
        tipoDocumento: 'CC',
        numeroDocumento: `${runId}${String(contadorDocumento).padStart(3, '0')}`,
      });
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    return { accessToken: login.body.data.accessToken as string, userId: login.body.data.user.id as string };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const menor = await registrar(emailMenor, 'Jugador Menor');
    tokenMenor = menor.accessToken;
    userIdMenor = menor.userId;

    await registrar(emailAcudiente, 'Acudiente');

    const adminCompartido = await registrar(emailAdminCompartido, 'Admin Compartido');
    tokenAdminCompartido = adminCompartido.accessToken;

    const adminOtraOrg = await registrar(emailAdminOtraOrg, 'Admin Otra Organización');
    tokenAdminOtraOrg = adminOtraOrg.accessToken;

    const tercero = await registrar(emailTercero, 'Usuario Sin Relación');
    tokenTercero = tercero.accessToken;

    const orgCompartida = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${tokenAdminCompartido}`)
      .send({ nombre: 'Organización Compartida', tipo: 'club', prefijoCodigoJugador: 'COMP' });
    orgCompartidaId = orgCompartida.body.data.id;

    const orgAjena = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${tokenAdminOtraOrg}`)
      .send({ nombre: 'Organización Ajena', tipo: 'club', prefijoCodigoJugador: 'AJEN' });
    orgAjenaId = orgAjena.body.data.id;

    // El menor se une (invitado -> aceptado) a la organización del admin compartido.
    const invite = await request(app.getHttpServer())
      .post(`/organizations/${orgCompartidaId}/memberships/invite`)
      .set('Authorization', `Bearer ${tokenAdminCompartido}`)
      .send({ email: emailMenor, rol: 'jugador' });
    await request(app.getHttpServer())
      .post(`/organizations/${orgCompartidaId}/memberships/${invite.body.data.id}/accept`)
      .set('Authorization', `Bearer ${tokenMenor}`);
  });

  afterAll(async () => {
    const idsACrear = [orgCompartidaId, orgAjenaId].filter((id): id is string => Boolean(id));
    if (idsACrear.length > 0) {
      await adminDb.organization.deleteMany({ where: { id: { in: idsACrear } } });
    }
    if (userIdMenor) {
      await prisma.userGuardian.deleteMany({ where: { minorUserId: userIdMenor } });
    }
    await prisma.user.deleteMany({ where: { email: { in: emailsCreados } } });
    await adminDb.$disconnect();
    await app.close();
  });

  describe('Acceso propio', () => {
    it('el propio usuario puede vincular, ver y desvincular sus acudientes', async () => {
      const link = await request(app.getHttpServer())
        .post(`/users/${userIdMenor}/guardians`)
        .set('Authorization', `Bearer ${tokenMenor}`)
        .send({ guardianEmail: emailAcudiente, relacion: 'madre', esResponsablePagos: true });

      expect(link.status).toBe(HttpStatus.CREATED);

      const list = await request(app.getHttpServer())
        .get(`/users/${userIdMenor}/guardians`)
        .set('Authorization', `Bearer ${tokenMenor}`);

      expect(list.status).toBe(HttpStatus.OK);
      expect(list.body.data).toHaveLength(1);

      const unlink = await request(app.getHttpServer())
        .delete(`/users/${userIdMenor}/guardians/${link.body.data.id}`)
        .set('Authorization', `Bearer ${tokenMenor}`);

      expect(unlink.status).toBe(HttpStatus.OK);
    });
  });

  describe('Terceros sin relación', () => {
    it('un usuario sin relación con el menor recibe 403 no_autorizado', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${userIdMenor}/guardians`)
        .set('Authorization', `Bearer ${tokenTercero}`);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.error.code).toBe('no_autorizado');
    });

    it('un admin_org de una organización distinta a la del menor recibe 403 no_autorizado', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${userIdMenor}/guardians`)
        .set('Authorization', `Bearer ${tokenAdminOtraOrg}`);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.error.code).toBe('no_autorizado');
    });
  });

  describe('admin_org que comparte organización con el menor', () => {
    it('puede vincular y ver los acudientes del menor', async () => {
      const link = await request(app.getHttpServer())
        .post(`/users/${userIdMenor}/guardians`)
        .set('Authorization', `Bearer ${tokenAdminCompartido}`)
        .send({ guardianEmail: emailAcudiente, relacion: 'madre' });

      expect(link.status).toBe(HttpStatus.CREATED);

      const list = await request(app.getHttpServer())
        .get(`/users/${userIdMenor}/guardians`)
        .set('Authorization', `Bearer ${tokenAdminCompartido}`);

      expect(list.status).toBe(HttpStatus.OK);
      expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
