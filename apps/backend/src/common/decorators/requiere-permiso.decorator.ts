import { SetMetadata } from '@nestjs/common';

export const REQUIERE_PERMISO_KEY = 'requierePermiso';

/**
 * Declara qué permiso de `docs/api-referencia-rapida.md` exige un endpoint.
 * `RequierePermisoGuard` (global) lo resuelve contra el rol de la membresía
 * activa del usuario en la organización de la ruta — nunca uses
 * `if (rol === 'admin_org')` disperso en el controlador/servicio.
 */
export const RequierePermiso = (codigo: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIERE_PERMISO_KEY, codigo);
