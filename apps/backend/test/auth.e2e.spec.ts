import { HttpStatus, INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Auth (e2e, contra Postgres real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = Date.now();
  const emailPrincipal = `auth-e2e-${runId}-a@example.com`;
  const emailRotacion = `auth-e2e-${runId}-b@example.com`;
  const passwordOriginal = 'contraseñaSegura123';
  const documentoPrincipal = `${runId}01`;
  const documentoRotacion = `${runId}02`;
  const documentoEmailDuplicado = `${runId}03`;
  const emailsCreados = [emailPrincipal, emailRotacion];
  // Documentos de perfiles sombra creados directamente (sin pasar por
  // /auth/register) que pueden quedar sin reclamar al terminar los tests.
  const documentosCreados: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Limpieza: no dejar usuarios de prueba en la base de datos de desarrollo.
    // onDelete: Cascade en refresh_tokens/password_reset_tokens se encarga del resto.
    await prisma.user.deleteMany({ where: { email: { in: emailsCreados } } });
    // Los perfiles sombra que nunca se reclamaron (email null) no aparecen en
    // emailsCreados — se limpian aparte por número de documento.
    await prisma.user.deleteMany({ where: { numeroDocumento: { in: documentosCreados } } });
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('crea un usuario nuevo y no expone password_hash', async () => {
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailPrincipal,
        password: passwordOriginal,
        nombre: 'Jugador E2E',
        fechaNacimiento: '2000-05-20',
        tipoDocumento: 'CC',
        numeroDocumento: documentoPrincipal,
      });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body.data).toMatchObject({ email: emailPrincipal, nombre: 'Jugador E2E' });
      expect(response.body.data).not.toHaveProperty('passwordHash');
      expect(response.body.data).not.toHaveProperty('password_hash');
      expect(response.body.meta).toEqual({});
    });

    it('rechaza un email duplicado con 409 y code email_ya_registrado', async () => {
      // Documento distinto al ya reclamado, para aislar el rechazo al chequeo
      // de email (si reusáramos documentoPrincipal, ya reclamado, el rechazo
      // sería documento_ya_registrado en vez de email_ya_registrado).
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailPrincipal,
        password: passwordOriginal,
        nombre: 'Jugador E2E',
        fechaNacimiento: '2000-05-20',
        tipoDocumento: 'CC',
        numeroDocumento: documentoEmailDuplicado,
      });

      expect(response.status).toBe(HttpStatus.CONFLICT);
      expect(response.body.error.code).toBe('email_ya_registrado');
    });

    it('rechaza un body inválido con 400', async () => {
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: 'no-es-un-email',
        password: '123',
        nombre: '',
      });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /auth/register — perfiles reclamables (documento)', () => {
    const documentoDuplicado = `${runId}10`;
    const emailDocA = `auth-e2e-${runId}-doc-a@example.com`;
    const emailDocB = `auth-e2e-${runId}-doc-b@example.com`;
    const documentoSombraReclamada = `${runId}11`;
    const emailReclamo = `auth-e2e-${runId}-reclamo@example.com`;
    const emailYaUsado = `auth-e2e-${runId}-ya-usado@example.com`;
    const documentoDelDuenioReal = `${runId}12`;
    const documentoSombraSinReclamar = `${runId}13`;

    beforeAll(() => {
      emailsCreados.push(emailDocA, emailDocB, emailReclamo, emailYaUsado);
      documentosCreados.push(documentoSombraSinReclamar);
    });

    it('rechaza un documento duplicado con otro email (409 documento_ya_registrado)', async () => {
      const primero = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailDocA,
        password: passwordOriginal,
        nombre: 'Doc A',
        fechaNacimiento: '1995-01-01',
        tipoDocumento: 'CC',
        numeroDocumento: documentoDuplicado,
      });
      expect(primero.status).toBe(HttpStatus.CREATED);

      const segundo = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailDocB,
        password: passwordOriginal,
        nombre: 'Doc B (intento con otro email)',
        fechaNacimiento: '1995-01-01',
        tipoDocumento: 'CC',
        numeroDocumento: documentoDuplicado,
      });

      expect(segundo.status).toBe(HttpStatus.CONFLICT);
      expect(segundo.body.error.code).toBe('documento_ya_registrado');
    });

    it('flujo completo: reclama un perfil sombra pre-registrado y puede iniciar sesión', async () => {
      // Simula lo que MembershipsService.invite en modo documento crearía:
      // un perfil sin email/contraseña, con nombre/fechaNacimiento fijados
      // por la organización.
      await prisma.user.create({
        data: {
          tipoDocumento: 'CC',
          numeroDocumento: documentoSombraReclamada,
          nombre: 'Menor Pre-Registrado Por La Organización',
          fechaNacimiento: new Date('2012-03-14'),
        },
      });

      const registro = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailReclamo,
        password: passwordOriginal,
        nombre: 'Nombre Que Intenta Poner Quien Reclama',
        fechaNacimiento: '2000-01-01',
        tipoDocumento: 'CC',
        numeroDocumento: documentoSombraReclamada,
      });

      expect(registro.status).toBe(HttpStatus.CREATED);
      expect(registro.body.data.email).toBe(emailReclamo);
      // nombre/fechaNacimiento son los del perfil sombra original, no los del
      // intento de registro — la organización que pre-registró es la fuente
      // de verdad de esos datos.
      expect(registro.body.data.nombre).toBe('Menor Pre-Registrado Por La Organización');

      const login = await request(app.getHttpServer()).post('/auth/login').send({
        email: emailReclamo,
        password: passwordOriginal,
      });
      expect(login.status).toBe(HttpStatus.OK);
      expect(login.body.data.user.email).toBe(emailReclamo);
    });

    it('rechaza reclamar con un email ya usado por otra cuenta (409) y el perfil sombra sigue sin email', async () => {
      // emailYaUsado ya pertenece a otra cuenta real, con su propio documento.
      const registroDuenioReal = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailYaUsado,
        password: passwordOriginal,
        nombre: 'Dueño Real De Ese Email',
        fechaNacimiento: '1990-01-01',
        tipoDocumento: 'CC',
        numeroDocumento: documentoDelDuenioReal,
      });
      expect(registroDuenioReal.status).toBe(HttpStatus.CREATED);
      documentosCreados.push(documentoDelDuenioReal);

      await prisma.user.create({
        data: {
          tipoDocumento: 'CC',
          numeroDocumento: documentoSombraSinReclamar,
          nombre: 'Otro Menor Pre-Registrado',
          fechaNacimiento: new Date('2013-05-01'),
        },
      });

      const intento = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailYaUsado,
        password: passwordOriginal,
        nombre: 'Quien Intenta Reclamar Con Email Ajeno',
        fechaNacimiento: '2013-05-01',
        tipoDocumento: 'CC',
        numeroDocumento: documentoSombraSinReclamar,
      });

      expect(intento.status).toBe(HttpStatus.CONFLICT);
      expect(intento.body.error.code).toBe('email_ya_registrado');

      const sombraEnDb = await prisma.user.findUnique({
        where: { tipoDocumento_numeroDocumento: { tipoDocumento: 'CC', numeroDocumento: documentoSombraSinReclamar } },
      });
      expect(sombraEnDb?.email).toBeNull();
    });
  });

  describe('POST /auth/login', () => {
    it('rechaza credenciales inválidas con 401', async () => {
      const response = await request(app.getHttpServer()).post('/auth/login').send({
        email: emailPrincipal,
        password: 'contraseñaIncorrecta',
      });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(response.body.error.code).toBe('credenciales_invalidas');
    });

    it('devuelve accessToken + refreshToken + usuario con credenciales correctas', async () => {
      const response = await request(app.getHttpServer()).post('/auth/login').send({
        email: emailPrincipal,
        password: passwordOriginal,
      });

      expect(response.status).toBe(HttpStatus.OK);
      expect(typeof response.body.data.accessToken).toBe('string');
      expect(typeof response.body.data.refreshToken).toBe('string');
      expect(response.body.data.user.email).toBe(emailPrincipal);
    });
  });

  describe('POST /auth/logout + reuso de refresh token', () => {
    it('revoca el refresh token y el intento de reuso dispara refresh_token_reutilizado', async () => {
      const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
        email: emailPrincipal,
        password: passwordOriginal,
      });
      const { accessToken, refreshToken } = loginResponse.body.data;

      const logoutResponse = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(logoutResponse.status).toBe(HttpStatus.OK);

      const refreshDespuesDeLogout = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(refreshDespuesDeLogout.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(refreshDespuesDeLogout.body.error.code).toBe('refresh_token_reutilizado');
    });

    it('rechaza logout sin access token (ruta protegida, no @Public())', async () => {
      const response = await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken: 'x' });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /auth/refresh — rotación', () => {
    it('rota el refresh token y el anterior queda inservible', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: emailRotacion,
        password: passwordOriginal,
        nombre: 'Jugador Rotación',
        fechaNacimiento: '2001-08-15',
        tipoDocumento: 'CC',
        numeroDocumento: documentoRotacion,
      });

      const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
        email: emailRotacion,
        password: passwordOriginal,
      });
      const refreshOriginal = loginResponse.body.data.refreshToken;

      const primerRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshOriginal });

      expect(primerRefresh.status).toBe(HttpStatus.OK);
      expect(primerRefresh.body.data.refreshToken).not.toBe(refreshOriginal);

      const segundoIntentoConElViejo = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshOriginal });

      expect(segundoIntentoConElViejo.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(segundoIntentoConElViejo.body.error.code).toBe('refresh_token_reutilizado');
    });
  });

  describe('POST /auth/forgot-password + POST /auth/reset-password', () => {
    it('responde el mismo mensaje genérico exista o no el email', async () => {
      const conEmailExistente = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: emailPrincipal });
      const conEmailInexistente = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nadie-existe@example.com' });

      expect(conEmailExistente.status).toBe(HttpStatus.OK);
      expect(conEmailInexistente.status).toBe(HttpStatus.OK);
      expect(conEmailExistente.body.data.message).toBe(conEmailInexistente.body.data.message);
    });

    it('permite fijar una contraseña nueva con el token y cierra sesión en todos los dispositivos', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      // Se guarda un refresh token activo antes del reset, para comprobar que
      // reset-password lo revoca (cierre de sesión en todos los dispositivos).
      const loginPrevio = await request(app.getHttpServer()).post('/auth/login').send({
        email: emailPrincipal,
        password: passwordOriginal,
      });
      const refreshTokenPrevio = loginPrevio.body.data.refreshToken;

      await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: emailPrincipal });

      const mensajeLogueado = logSpy.mock.calls.map((call) => String(call[0])).find((msg) => msg.includes('token='));
      logSpy.mockRestore();

      expect(mensajeLogueado).toBeDefined();
      const token = new URL(mensajeLogueado!.split(': ').pop()!).searchParams.get('token');
      expect(token).toBeTruthy();

      const nuevaPassword = 'otraContraseñaSegura456';
      const resetResponse = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: nuevaPassword });

      expect(resetResponse.status).toBe(HttpStatus.OK);

      const loginConPasswordVieja = await request(app.getHttpServer()).post('/auth/login').send({
        email: emailPrincipal,
        password: passwordOriginal,
      });
      expect(loginConPasswordVieja.status).toBe(HttpStatus.UNAUTHORIZED);

      const loginConPasswordNueva = await request(app.getHttpServer()).post('/auth/login').send({
        email: emailPrincipal,
        password: nuevaPassword,
      });
      expect(loginConPasswordNueva.status).toBe(HttpStatus.OK);

      const refreshTrasReset = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshTokenPrevio });
      expect(refreshTrasReset.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza un token de reseteo inválido con 400 y code token_invalido', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'token-que-no-existe', newPassword: 'cualquierContraseña123' });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe('token_invalido');
    });
  });
});
