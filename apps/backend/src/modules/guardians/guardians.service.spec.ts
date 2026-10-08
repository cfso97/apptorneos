import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GuardiansService } from './guardians.service';

function buildUniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

describe('GuardiansService', () => {
  let service: GuardiansService;
  let prisma: {
    userGuardian: { findMany: jest.Mock; create: jest.Mock; deleteMany: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      userGuardian: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    service = new GuardiansService(prisma as unknown as PrismaService);
  });

  describe('link', () => {
    it('lanza 404 usuario_no_encontrado si el email del acudiente no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.link('menor-1', { guardianEmail: 'nadie@example.com', relacion: 'madre' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza que un usuario sea su propio acudiente', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'menor-1' });

      await expect(
        service.link('menor-1', { guardianEmail: 'yo@example.com', relacion: 'padre' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('crea el vínculo cuando todo es válido', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'guardian-1' });
      prisma.userGuardian.create.mockResolvedValue({ id: 'ug-1' });

      const resultado = await service.link('menor-1', { guardianEmail: 'g@example.com', relacion: 'padre' });

      expect(prisma.userGuardian.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          minorUserId: 'menor-1',
          guardianUserId: 'guardian-1',
          relacion: 'padre',
          esResponsablePagos: false,
          esContactoEmergencia: false,
        }),
      });
      expect(resultado).toEqual({ id: 'ug-1' });
    });

    it('traduce la violación de unicidad en 409 acudiente_ya_vinculado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'guardian-1' });
      prisma.userGuardian.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(service.link('menor-1', { guardianEmail: 'g@example.com', relacion: 'padre' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('unlink', () => {
    it('lanza 404 si no existe ese vínculo para ese usuario', async () => {
      prisma.userGuardian.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unlink('menor-1', 'guardian-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('elimina el vínculo cuando existe', async () => {
      prisma.userGuardian.deleteMany.mockResolvedValue({ count: 1 });

      await expect(service.unlink('menor-1', 'ug-1')).resolves.toBeUndefined();
    });
  });
});
