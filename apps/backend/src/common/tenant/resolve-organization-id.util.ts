interface RequestWithParams {
  params?: Record<string, string | undefined>;
}

/**
 * Resuelve el `organizationId` de la ruta actual, siguiendo la convención de
 * rutas de `docs/api-referencia-rapida.md`: recursos anidados bajo
 * `/organizations/:orgId/...` (ej. memberships) o el propio recurso
 * `/organizations/:id` (ej. detalle/edición de la organización).
 *
 * Devuelve `null` cuando la ruta no tiene organización asociada (ej.
 * `POST /organizations`, `/users/:userId/guardians`) — en ese caso
 * `RequierePermisoGuard` deja pasar sin exigir membresía, porque no hay
 * contexto de tenant que validar en esa ruta.
 */
export function resolveOrganizationId(request: RequestWithParams): string | null {
  const params = request.params ?? {};
  return params.orgId ?? params.id ?? null;
}
