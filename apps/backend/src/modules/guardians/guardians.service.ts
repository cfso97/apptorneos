import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LinkGuardianDto } from './dto/link-guardian.dto';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * `user_guardians` es una relación global usuario-usuario, sin
 * `organization_id` — no lleva RLS, se consulta con el `PrismaService` base.
 * El aislamiento aquí no es multi-tenant, es de autorización a nivel de
 * usuario (ver `GuardianAccessGuard`).
 */
@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(minorUserId: string) {
    return this.prisma.userGuardian.findMany({ where: { minorUserId } });
  }

  async link(minorUserId: string, dto: LinkGuardianDto) {
    const guardianUser = await this.prisma.user.findUnique({ where: { email: dto.guardianEmail } });

    if (!guardianUser) {
      throw new NotFoundException({
        code: 'usuario_no_encontrado',
        message: 'No existe un usuario registrado con ese email.',
      });
    }

    if (guardianUser.id === minorUserId) {
      throw new BadRequestException({
        code: 'acudiente_invalido',
        message: 'Un usuario no puede ser su propio acudiente.',
      });
    }

    try {
      return await this.prisma.userGuardian.create({
        data: {
          minorUserId,
          guardianUserId: guardianUser.id,
          relacion: dto.relacion,
          esResponsablePagos: dto.esResponsablePagos ?? false,
          esContactoEmergencia: dto.esContactoEmergencia ?? false,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new ConflictException({
          code: 'acudiente_ya_vinculado',
          message: 'Este acudiente ya está vinculado a este usuario.',
        });
      }
      throw error;
    }
  }

  async unlink(minorUserId: string, guardianId: string): Promise<void> {
    const resultado = await this.prisma.userGuardian.deleteMany({
      where: { id: guardianId, minorUserId },
    });

    if (resultado.count === 0) {
      throw new NotFoundException({
        code: 'acudiente_no_encontrado',
        message: 'No existe ese vínculo de acudiente para este usuario.',
      });
    }
  }
}
