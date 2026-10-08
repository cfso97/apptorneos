import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Extrae el `TenantContext` que `RequierePermisoGuard` deja en
 * `request.tenantContext`. Uso: `@TenantCtx() ctx: TenantContext`.
 */
export const TenantCtx = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext => {
  const request = ctx.switchToHttp().getRequest<{ tenantContext: TenantContext }>();
  return request.tenantContext;
});
