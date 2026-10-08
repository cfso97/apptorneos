import { SetMetadata } from '@nestjs/common';

export const SKIP_MEMBERSHIP_CHECK_KEY = 'skipMembershipCheck';

/**
 * Para endpoints con `organizationId` en la ruta donde el propio handler
 * valida su autorización, porque `RequierePermisoGuard` no puede exigir
 * membresía "activa" todavía — el caso de uso es `POST
 * /organizations/:orgId/memberships/:id/accept`: quien acepta la invitación
 * está en estado `invitado`, no `activo`, hasta que este mismo endpoint lo
 * cambia. El guard sigue fijando `request.tenantContext` (y por lo tanto el
 * contexto de RLS), solo se salta la búsqueda de membresía activa + permiso.
 */
export const SkipMembershipCheck = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_MEMBERSHIP_CHECK_KEY, true);
