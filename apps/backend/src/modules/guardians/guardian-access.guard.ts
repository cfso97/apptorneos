import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
  params: { userId: string };
}

/**
 * Guard local de `/users/:userId/guardians/*` — esta ruta no tiene
 * `organizationId`, así que `RequierePermisoGuard` (global) la deja pasar
 * sin exigir membresía; la autorización real vive acá:
 *   - El propio usuario siempre puede gestionar sus acudientes.
 *   - Un `admin_org` que comparte organización con el usuario objetivo
 *     también puede — se resuelve con la función de Postgres
 *     `user_shares_admin_org` (SECURITY DEFINER, ver migración de RLS),
 *     que responde sí/no sin exponer filas de otras organizaciones. Se
 *     consulta con el `PrismaService` base (no el tenant-scoped): la propia
 *     función resuelve su acceso de forma acotada.
 */
@Injectable()
export class GuardianAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const targetUserId = request.params.userId;
    const currentUserId = request.user.userId;

    if (currentUserId === targetUserId) {
      return true;
    }

    const filas = await this.prisma.$queryRaw<{ compartido: boolean }[]>`
      SELECT user_shares_admin_org(${currentUserId}::uuid, ${targetUserId}::uuid) AS compartido
    `;

    if (!filas[0]?.compartido) {
      throw new ForbiddenException({
        code: 'no_autorizado',
        message: 'No tenés permiso para gestionar los acudientes de este usuario.',
      });
    }

    return true;
  }
}
