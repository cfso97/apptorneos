import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import { hashToken } from './utils/token.util';

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  refreshToken: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  passwordResetToken: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

function buildPrismaMock(): MockPrisma {
  return {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordResetToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
}

const CONFIG_DEFAULTS: Record<string, string> = {
  JWT_SECRET: 'test-secret',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '30d',
  PASSWORD_RESET_EXPIRES_IN: '1h',
  FRONTEND_URL: 'http://localhost:3000',
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  let jwtService: { signAsync: jest.Mock };
  let configService: { get: jest.Mock };

  const baseUser = {
    id: 'user-1',
    email: 'jugador@example.com',
    nombre: 'Jugador Uno',
    fechaNacimiento: new Date('2000-01-01'),
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = buildPrismaMock();
    jwtService = { signAsync: jest.fn().mockResolvedValue('access-token-firmado') };
    configService = {
      get: jest.fn((key: string, fallback?: string) => CONFIG_DEFAULTS[key] ?? fallback),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('crea el usuario cuando el email no está registrado', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...baseUser, passwordHash: 'hash' });

      const resultado = await service.register({
        email: baseUser.email,
        password: 'unaContraseñaSegura123',
        nombre: baseUser.nombre,
        fechaNacimiento: '2000-01-01',
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(resultado).toEqual({
        id: baseUser.id,
        email: baseUser.email,
        nombre: baseUser.nombre,
        fechaNacimiento: baseUser.fechaNacimiento,
        createdAt: baseUser.createdAt,
      });
      expect(resultado).not.toHaveProperty('passwordHash');
    });

    it('rechaza el registro con un email ya usado (código email_ya_registrado)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: 'hash' });

      await expect(
        service.register({
          email: baseUser.email,
          password: 'unaContraseñaSegura123',
          nombre: baseUser.nombre,
          fechaNacimiento: '2000-01-01',
        }),
      ).rejects.toMatchObject({
        response: { code: 'email_ya_registrado' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('propaga ConflictException como tipo de excepción', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: 'hash' });

      await expect(
        service.register({
          email: baseUser.email,
          password: 'unaContraseñaSegura123',
          nombre: baseUser.nombre,
          fechaNacimiento: '2000-01-01',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('rechaza con credenciales_invalidas cuando el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'nadie@example.com', password: 'lo-que-sea' })).rejects.toMatchObject({
        response: { code: 'credenciales_invalidas' },
      });
    });

    it('rechaza con credenciales_invalidas cuando la contraseña es incorrecta', async () => {
      const passwordHash = await bcrypt.hash('contraseñaCorrecta1', 10);
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });

      await expect(
        service.login({ email: baseUser.email, password: 'contraseñaIncorrecta' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('devuelve tokens y el usuario saneado con credenciales correctas', async () => {
      const passwordHash = await bcrypt.hash('contraseñaCorrecta1', 10);
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
      prisma.refreshToken.create.mockResolvedValue({});

      const resultado = await service.login({ email: baseUser.email, password: 'contraseñaCorrecta1' });

      expect(resultado.accessToken).toBe('access-token-firmado');
      expect(typeof resultado.refreshToken).toBe('string');
      expect(resultado.refreshToken.length).toBeGreaterThan(20);
      expect(resultado.user.email).toBe(baseUser.email);
      expect(resultado.user).not.toHaveProperty('passwordHash');
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    it('rechaza un refresh token que no existe en la base de datos', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('token-inexistente')).rejects.toMatchObject({
        response: { code: 'refresh_token_invalido' },
      });
    });

    it('detecta reuso de un refresh token ya revocado y revoca todas las sesiones', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hashToken('token-robado'),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        revokedAt: new Date(),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.refresh('token-robado')).rejects.toMatchObject({
        response: { code: 'refresh_token_reutilizado' },
      });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rechaza un refresh token expirado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hashToken('token-viejo'),
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });

      await expect(service.refresh('token-viejo')).rejects.toMatchObject({
        response: { code: 'refresh_token_expirado' },
      });
    });

    it('rota el refresh token: revoca el viejo y emite uno nuevo', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hashToken('token-vigente'),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        revokedAt: null,
      });
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const resultado = await service.refresh('token-vigente');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(resultado.accessToken).toBe('access-token-firmado');
    });
  });

  describe('logout', () => {
    it('revoca el refresh token cuando pertenece al usuario y sigue activo', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hashToken('mi-token'),
        revokedAt: null,
      });
      prisma.refreshToken.update.mockResolvedValue({});

      await service.logout('user-1', 'mi-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('no revoca nada (ni falla) si el token pertenece a otro usuario', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'otro-usuario',
        tokenHash: hashToken('mi-token'),
        revokedAt: null,
      });

      await expect(service.logout('user-1', 'mi-token')).resolves.toBeUndefined();
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it('no falla si el token no existe', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.logout('user-1', 'token-inexistente')).resolves.toBeUndefined();
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('crea un token de reseteo cuando el usuario existe', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.passwordResetToken.create.mockResolvedValue({});

      await service.forgotPassword(baseUser.email);

      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
    });

    it('no falla ni crea nada cuando el usuario no existe (no revela cuentas)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.forgotPassword('nadie@example.com')).resolves.toBeUndefined();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('rechaza un token inexistente, ya usado o expirado (código token_invalido)', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('token-x', 'nuevaContraseña123')).rejects.toMatchObject({
        response: { code: 'token_invalido' },
      });
      await expect(service.resetPassword('token-x', 'nuevaContraseña123')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('actualiza la contraseña, marca el token usado y revoca todas las sesiones', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        tokenHash: hashToken('token-valido'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      prisma.$transaction.mockResolvedValue([{}, {}, {}]);

      await service.resetPassword('token-valido', 'nuevaContraseña123');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const operaciones = prisma.$transaction.mock.calls[0][0];
      expect(operaciones).toHaveLength(3);
    });
  });
});
