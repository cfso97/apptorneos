import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Memberships (e2e, contra Postgres real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const adminDb = new PrismaClient();

  const runId = Date.now();
  const password = 'contraseñaSegura123';
  const emailAdmin = `mem-e2e-${runId}-admin@example.com`;
  const emailCoach = `mem-e2e-${runId}-coach@example.com`;
  const emailInvitado = `mem-e2e-${runId}-invitado@example.com`;
  const emailsConcurrencia = Array.from({ length: 10 }, (_, i) => `mem-e2e-${runId}-conc-${i}@example.com`);
  const emailsCreados = [emailAdmin, emailCoach, emailInvitado, ...emailsConcurrencia];
  // Perfiles sombra creados vía invite en modo documento — no siempre tienen
  // email (si nunca se reclaman), así que se limpian aparte por documento.
  const documentosCreados: string[] = [];

  let tokenAdmin: string;
  let tokenCoach: string;
  let orgId: string;

  // Contador simple para generar números de documento únicos por usuario
  // registrado en este archivo — se incrementa de forma síncrona antes de
  // cualquier `await`, así que es seguro incluso cuando `registrar()` se
  // llama en paralelo (Promise.all) para las cuentas de concurrencia.
  let contadorDocumento = 0;

  async function registrar(email: string, nombre: string): Promise<void> {
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
  }

  async function loguear(email: string): Promise<string> {
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    return login.body.data.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await registrar(emailAdmin, 'Admin Org');
    await registrar(emailCoach, 'Coach Sin Permiso');
    await registrar(emailInvitado, 'Jugador Invitado');
    await Promise.all(emailsConcurrencia.map((email, i) => registrar(email, `Concurrencia ${i}`)));

    tokenAdmin = await loguear(emailAdmin);
    tokenCoach = await loguear(emailCoach);

    const org = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Organización Membresías', tipo: 'club', prefijoCodigoJugador: 'MEM' });
    orgId = org.body.data.id;

    // El coach necesita ser miembro ACTIVO de la organización (aunque sin el
    // permiso gestionar_membresias) para probar el 403 por permiso
    // insuficiente, en vez del 403 por no ser miembro.
    const inviteCoach = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/memberships/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: emailCoach, rol: 'coach' });
    await request(app.getHttpServer())
      .post(`/organizations/${orgId}/memberships/${inviteCoach.body.data.id}/accept`)
      .set('Authorization', `Bearer ${tokenCoach}`);
  }, 30000);

  afterAll(async () => {
    if (orgId) {
      await adminDb.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.user.deleteMany({ where: { email: { in: emailsCreados } } });
    await prisma.user.deleteMany({ where: { numeroDocumento: { in: documentosCreados } } });
    await adminDb.$disconnect();
    await app.close();
  });

  describe('Permisos', () => {
    it('un rol sin gestionar_membresias (coach) recibe 403 permiso_insuficiente al invitar', async () => {
      const response = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenCoach}`)
        .send({ email: emailInvitado, rol: 'jugador' });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.error.code).toBe('permiso_insuficiente');
    });
  });

  describe('Flujo completo invite -> accept -> listar', () => {
    it('invita, acepta y aparece activo en el listado', async () => {
      const invite = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ email: emailInvitado, rol: 'jugador' });

      expect(invite.status).toBe(HttpStatus.CREATED);
      expect(invite.body.data.estado).toBe('invitado');

      const tokenInvitado = await loguear(emailInvitado);

      const accept = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/${invite.body.data.id}/accept`)
        .set('Authorization', `Bearer ${tokenInvitado}`);

      expect(accept.status).toBe(HttpStatus.OK);
      expect(accept.body.data.estado).toBe('activo');

      const listado = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/memberships`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(listado.status).toBe(HttpStatus.OK);
      const fila = listado.body.data.find((m: { id: string }) => m.id === invite.body.data.id);
      expect(fila).toMatchObject({ estado: 'activo' });
    });

    it('aceptar una invitación que no pertenece al usuario responde 403', async () => {
      const invite = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ email: emailsConcurrencia[0], rol: 'jugador' });

      const otroToken = await loguear(emailsConcurrencia[1]);
      // emailsConcurrencia[1] todavía no es miembro de esta organización —
      // primero lo invitamos también, para aislar el 403 al chequeo de
      // "esta invitación no te pertenece" y no al de membresía inexistente.
      await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ email: emailsConcurrencia[1], rol: 'jugador' });

      const response = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/${invite.body.data.id}/accept`)
        .set('Authorization', `Bearer ${otroToken}`);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.error.code).toBe('no_autorizado');
    });
  });

  describe('Invitación en modo documento (perfil sombra)', () => {
    const documentoSombra = `${runId}9001`;
    const documentoDobleInvite = `${runId}9002`;
    const documentoCicloCompleto = `${runId}9003`;
    const emailCicloCompleto = `mem-e2e-${runId}-ciclo-documento@example.com`;

    beforeAll(() => {
      documentosCreados.push(documentoSombra, documentoDobleInvite, documentoCicloCompleto);
      emailsCreados.push(emailCicloCompleto);
    });

    it('crea un perfil sombra (email null) al invitar por documento', async () => {
      const invite = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          tipoDocumento: 'CC',
          numeroDocumento: documentoSombra,
          nombre: 'Jugador Pre-Registrado',
          fechaNacimiento: '2012-03-14',
          rol: 'jugador',
        });

      expect(invite.status).toBe(HttpStatus.CREATED);
      expect(invite.body.data.estado).toBe('invitado');

      const usuarioSombra = await adminDb.user.findUnique({
        where: { tipoDocumento_numeroDocumento: { tipoDocumento: 'CC', numeroDocumento: documentoSombra } },
      });
      expect(usuarioSombra).not.toBeNull();
      expect(usuarioSombra?.email).toBeNull();
    });

    it('un segundo invite con el mismo documento responde 409 membresia_ya_existe', async () => {
      const primero = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          tipoDocumento: 'CC',
          numeroDocumento: documentoDobleInvite,
          nombre: 'Jugador Doble Invite',
          fechaNacimiento: '2011-06-01',
          rol: 'jugador',
        });
      expect(primero.status).toBe(HttpStatus.CREATED);

      const segundo = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          tipoDocumento: 'CC',
          numeroDocumento: documentoDobleInvite,
          nombre: 'Jugador Doble Invite',
          fechaNacimiento: '2011-06-01',
          rol: 'jugador',
        });

      expect(segundo.status).toBe(HttpStatus.CONFLICT);
      expect(segundo.body.error.code).toBe('membresia_ya_existe');
    });

    it('ciclo completo: invita por documento -> la persona se registra reclamando el perfil -> login -> acepta', async () => {
      const invite = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          tipoDocumento: 'CC',
          numeroDocumento: documentoCicloCompleto,
          nombre: 'Jugador Ciclo Completo',
          fechaNacimiento: '2010-09-09',
          rol: 'jugador',
        });
      expect(invite.status).toBe(HttpStatus.CREATED);

      const registro = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailCicloCompleto,
        password,
        nombre: 'Nombre Que Intenta Poner Quien Reclama',
        fechaNacimiento: '2000-01-01',
        tipoDocumento: 'CC',
        numeroDocumento: documentoCicloCompleto,
      });
      expect(registro.status).toBe(HttpStatus.CREATED);
      expect(registro.body.data.nombre).toBe('Jugador Ciclo Completo');

      const tokenReclamado = await loguear(emailCicloCompleto);
      expect(typeof tokenReclamado).toBe('string');

      const accept = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/${invite.body.data.id}/accept`)
        .set('Authorization', `Bearer ${tokenReclamado}`);

      expect(accept.status).toBe(HttpStatus.OK);
      expect(accept.body.data.estado).toBe('activo');
    });

    it('rechaza con 400 un invite con ambos modos a la vez o ninguno', async () => {
      const conAmbosModos = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          email: emailInvitado,
          tipoDocumento: 'CC',
          numeroDocumento: '000',
          nombre: 'X',
          fechaNacimiento: '2000-01-01',
          rol: 'jugador',
        });
      expect(conAmbosModos.status).toBe(HttpStatus.BAD_REQUEST);

      const sinNingunModo = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/memberships/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ rol: 'jugador' });
      expect(sinNingunModo.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Concurrencia — códigos de jugador únicos', () => {
    it('10 invitaciones en paralelo a la misma organización generan códigos únicos y consecutivos', async () => {
      const orgConcurrencia = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'Organización Concurrencia', tipo: 'club', prefijoCodigoJugador: 'CONC' });
      const orgConcurrenciaId = orgConcurrencia.body.data.id;

      const respuestas = await Promise.all(
        emailsConcurrencia.map((email) =>
          request(app.getHttpServer())
            .post(`/organizations/${orgConcurrenciaId}/memberships/invite`)
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ email, rol: 'jugador' }),
        ),
      );

      respuestas.forEach((response) => expect(response.status).toBe(HttpStatus.CREATED));

      const codigos = respuestas.map((response) => response.body.data.codigoJugador as string);
      const codigosUnicos = new Set(codigos);
      expect(codigosUnicos.size).toBe(codigos.length);

      const numeros = codigos
        .map((codigo) => Number(codigo.split('-')[1]))
        .sort((a, b) => a - b);
      // El admin_org creador ya consumió la secuencia 0001 al crear la
      // organización, así que las 10 invitaciones deben ocupar 0002..0011
      // de forma consecutiva y sin huecos.
      expect(numeros).toEqual(Array.from({ length: 10 }, (_, i) => i + 2));

      await adminDb.organization.deleteMany({ where: { id: orgConcurrenciaId } });
    });
  });
});
