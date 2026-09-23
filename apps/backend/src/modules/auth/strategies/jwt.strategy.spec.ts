import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;

  it('devuelve { userId, email } cuando el usuario del payload existe', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'jugador@example.com' }) },
    } as unknown as PrismaService;

    const strategy = new JwtStrategy(configService, prisma);

    const resultado = await strategy.validate({ sub: 'user-1', email: 'jugador@example.com' });

    expect(resultado).toEqual({ userId: 'user-1', email: 'jugador@example.com' });
  });

  it('lanza UnauthorizedException (código no_autenticado) si el usuario ya no existe', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const strategy = new JwtStrategy(configService, prisma);

    await expect(strategy.validate({ sub: 'user-fantasma', email: 'x@example.com' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(strategy.validate({ sub: 'user-fantasma', email: 'x@example.com' })).rejects.toMatchObject({
      response: { code: 'no_autenticado' },
    });
  });
});
