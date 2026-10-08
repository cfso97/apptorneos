import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIERE_PERMISO_KEY } from '../decorators/requiere-permiso.decorator';
import { SKIP_MEMBERSHIP_CHECK_KEY } from '../decorators/skip-membership-check.decorator';
import { PermissionsService } from '../permissions/permissions.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { resolveOrganizationId } from '../tenant/resolve-organization-id.util';
import { TenantContext } from '../tenant/tenant-context';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MembershipRecord {
  id: string;
  rol: string;
  estado: string;
}

interface RequestWithTenant extends Request {
  user: AuthenticatedUser;
  tenantContext?: TenantContext;
  membership?: MembershipRecord;
}

/**
 * Guard global (segundo `APP_GUARD`, después de `JwtAuthGuard`). Por cada
 * petición sobre una organización:
 *   1. Resuelve `organizationId` de la ruta (`resolveOrganizationId`). Si no
 *      hay ninguno, la ruta no tiene contexto de tenant que validar aquí
 *      (ej. `POST /organizations`, `/users/:id/guardians`) — deja pasar.
 *   2. Si lo hay pero no es un UUID válido, 400.
 *   3. Si el handler tiene `@SkipMembershipCheck()`, solo fija
 *      `request.tenantContext` y deja pasar — el propio endpoint valida su
 *      autorización (ver ese decorator).
 *   4. Si no, busca una membresía activa del usuario en esa organización —
 *      si no existe, 403 `no_es_miembro_de_la_organizacion`.
 *   5. Si el handler tiene `@RequierePermiso(codigo)`, verifica que el rol
 *      de esa membresía tenga ese permiso — si no, 403 `permiso_insuficiente`.
 *
 * Nunca hace `if (rol === 'admin_org')` disperso: todo pasa por el catálogo
 * `role_permissions` vía `PermissionsService`.
 */
@Injectable()
export class RequierePermisoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const organizationId = resolveOrganizationId(request);

    if (!organizationId) {
      request.tenantContext = { userId: request.user.userId, organizationId: null };
      return true;
    }

    if (!UUID_REGEX.test(organizationId)) {
      throw new BadRequestException({
        code: 'organization_id_invalido',
        message: 'El identificador de organización en la ruta no es válido.',
      });
    }

    const ctx: TenantContext = { userId: request.user.userId, organizationId };

    const skipMembershipCheck = this.reflector.getAllAndOverride<boolean>(SKIP_MEMBERSHIP_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipMembershipCheck) {
      request.tenantContext = ctx;
      return true;
    }

    const membership = await this.tenantPrisma.run<MembershipRecord | null>(
      ctx,
      (tx) =>
        tx.membership.findFirst({
          where: { userId: ctx.userId, organizationId, estado: 'activo' },
          select: { id: true, rol: true, estado: true },
        }),
      organizationId,
    );

    if (!membership) {
      throw new ForbiddenException({
        code: 'no_es_miembro_de_la_organizacion',
        message: 'No sos miembro activo de esta organización.',
      });
    }

    const permisoRequerido = this.reflector.getAllAndOverride<string>(REQUIERE_PERMISO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (permisoRequerido) {
      const permisos = await this.permissionsService.getPermissionsForRole(membership.rol);

      if (!permisos.has(permisoRequerido)) {
        throw new ForbiddenException({
          code: 'permiso_insuficiente',
          message: 'Tu rol no tiene permiso para realizar esta acción.',
        });
      }
    }

    request.tenantContext = ctx;
    request.membership = membership;
    return true;
  }
}
