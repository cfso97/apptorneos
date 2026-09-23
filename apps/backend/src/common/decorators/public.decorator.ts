import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como accesible sin JWT. El `JwtAuthGuard` está registrado
 * globalmente (`APP_GUARD`) — cualquier ruta nueva es privada por defecto
 * salvo que se marque explícitamente con `@Public()`. Esto evita que en
 * fases futuras alguien olvide proteger un endpoint nuevo.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
