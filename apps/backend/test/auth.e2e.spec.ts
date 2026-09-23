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
  const emailsCreados = [emailPrincipal, emailRotacion];

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
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('crea un usuario nuevo y no expone password_hash', async () => {
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailPrincipal,
        password: passwordOriginal,
        nombre: 'Jugador E2E',
        fechaNacimiento: '2000-05-20',
      });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body.data).toMatchObject({ email: emailPrincipal, nombre: 'Jugador E2E' });
      expect(response.body.data).not.toHaveProperty('passwordHash');
      expect(response.body.data).not.toHaveProperty('password_hash');
      expect(response.body.meta).toEqual({});
    });

    it('rechaza un email duplicado con 409 y code email_ya_registrado', async () => {
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: emailPrincipal,
        password: passwordOriginal,
        nombre: 'Jugador E2E',
        fechaNacimiento: '2000-05-20',
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
