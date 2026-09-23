import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Lo que `JwtStrategy.validate()` deja en `request.user` tras verificar el JWT. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
}

/**
 * Extrae el usuario autenticado (`request.user`) puesto por `JwtAuthGuard`.
 * Uso: `@CurrentUser() user: AuthenticatedUser`.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
  return request.user;
});
