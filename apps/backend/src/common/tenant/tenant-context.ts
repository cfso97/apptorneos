/**
 * Contexto de tenant resuelto por `RequierePermisoGuard` para la petición
 * actual. `organizationId` es `null` en rutas que no tienen organización en
 * la URL (ej. `POST /organizations`, `/users/:id/guardians`) — ahí no hay
 * contexto de tenant que fijar en Postgres, el propio endpoint resuelve su
 * autorización.
 */
export interface TenantContext {
  userId: string;
  organizationId: string | null;
}
