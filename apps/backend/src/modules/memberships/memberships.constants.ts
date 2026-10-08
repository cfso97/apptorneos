/** Roles asignables vía invitación/edición de membresía (MVP — fútbol). */
export const ROLES_MEMBRESIA = ['admin_org', 'coach', 'jugador', 'acudiente', 'arbitro'] as const;
export type RolMembresia = (typeof ROLES_MEMBRESIA)[number];

/** Estados posibles de una membresía (sección 2 de modelo-datos-torneos-saas.md). */
export const ESTADOS_MEMBRESIA = ['invitado', 'activo', 'inactivo', 'removido'] as const;
export type EstadoMembresia = (typeof ESTADOS_MEMBRESIA)[number];
