/**
 * IDs fijos sembrados por `prisma/seed.ts` (catálogos idempotentes de
 * `plans`/`sports`, sección 16.1/17/19 de modelo-datos-torneos-saas.md).
 * Se exportan acá para que el código de negocio (ej. `OrganizationsService`,
 * que hoy asigna un plan placeholder a toda organización nueva mientras no
 * exista un flujo real de selección de plan) no duplique el UUID a mano.
 */
export const PLAN_PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000001';
export const SPORT_FUTBOL_ID = '00000000-0000-0000-0000-000000000002';
