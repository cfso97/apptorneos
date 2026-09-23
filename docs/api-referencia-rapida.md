# API — Referencia Rápida de Endpoints

> Documento hermano de `api-openapi-torneos.yaml` (especificación completa con request/response) y de `plan-construccion-mvp.md` (mismo orden de fases). Este archivo es para consulta rápida del equipo mientras desarrollan.

**Convención de respuesta:** todo endpoint devuelve `{ data, meta }` en éxito o `{ error: { code, message } }` en fallo — ver detalle completo en el YAML.

**Convención de rutas:** recursos anidados solo cuando la relación es de pertenencia estricta (ej. `/organizations/{orgId}/memberships`); recursos con identidad propia van planos (ej. `/matches/{id}`, no `/tournaments/{id}/phases/{id}/matches/{id}`).

---

## Auth (Fase 0)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/auth/register` | público | Crear cuenta de usuario |
| POST | `/auth/login` | público | Login, devuelve JWT + refresh token |
| POST | `/auth/refresh` | público (requiere refresh token válido) | Renovar JWT (rota el refresh token; detecta y responde a reuso de un token ya revocado revocando todas las sesiones del usuario) |
| POST | `/auth/logout` | autenticado | Invalidar el refresh token indicado en el body |
| POST | `/auth/forgot-password` | público | Solicitar recuperación de contraseña — responde siempre el mismo mensaje genérico, exista o no el email. En desarrollo (sin envío de email real todavía), el link queda en el log del servidor |
| POST | `/auth/reset-password` | público (requiere token de recuperación válido) | Fijar nueva contraseña con el token recibido; cierra sesión en todos los dispositivos (revoca todos los refresh tokens activos) |

**Pendiente (sin fecha):** login/registro con Google ("Continuar con Google"), como método adicional dentro de este mismo módulo — vía Passport (`passport-google-oauth20`) contra la misma tabla `users`, reutilizando el mismo `accessToken`/`refreshToken` ya emitido por `/auth/login`. No depende de Supabase Auth ni de ningún proveedor de identidad externo, para no partir la identidad del usuario entre dos sistemas. Se aborda junto con la construcción de las pantallas reales de login/register en el panel web.

---

## Organizaciones y membresías (Fase 1)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/organizations` | autenticado | Crear organización (el creador queda como `admin_org`) |
| GET | `/organizations/{id}` | miembro de la organización | Ver detalle de organización |
| PATCH | `/organizations/{id}` | `editar_torneo`* → *ver nota* | Editar datos generales (nombre, tipo, prefijo de código de jugador) |
| GET | `/organizations/{id}/limits` | miembro de la organización | Ver límites del plan (jugadores, equipos, torneos) |
| PATCH | `/organizations/{id}/modules/{moduleId}` | solo `platform_admin` (interno, manual en MVP) | Activar/desactivar módulo para la organización |
| POST | `/organizations/{orgId}/memberships/invite` | `admin_org` | Invitar usuario a la organización con un rol |
| GET | `/organizations/{orgId}/memberships` | `admin_org` | Listar miembros |
| PATCH | `/organizations/{orgId}/memberships/{membershipId}` | `admin_org` | Cambiar rol/estado de un miembro |
| GET | `/users/{userId}/guardians` | propio usuario o `admin_org` | Ver acudientes vinculados |
| POST | `/users/{userId}/guardians` | propio usuario (mayor) o `admin_org` | Vincular acudiente a un menor |
| DELETE | `/users/{userId}/guardians/{guardianId}` | propio usuario o `admin_org` | Desvincular acudiente |

*Nota: se crea un permiso propio `editar_organizacion` en el catálogo, distinto de `editar_torneo` — se omitió en la matriz original de la sección 16.1, agregarlo ahí también.*

---

## Equipos (Fase 2)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/organizations/{orgId}/team-invitations` | `admin_org` o `admin_escuela` | Invitar a un usuario a crear/gestionar un equipo |
| GET | `/team-invitations/{id}` | usuario invitado | Ver detalle de la invitación |
| POST | `/team-invitations/{id}/accept` | usuario invitado | Aceptar — crea equipo nuevo o vincula uno existente (`body: { modo: 'nuevo' | 'existente', team_id? }`) |
| POST | `/team-invitations/{id}/reject` | usuario invitado | Rechazar invitación |
| GET | `/teams/{id}` | miembro/coach del equipo | Ver detalle del equipo |
| PATCH | `/teams/{id}` | `editar_plantilla` (coach) | Editar datos del equipo |
| GET | `/teams/{id}/members` | coach o miembro del equipo | Ver plantilla maestra |
| POST | `/teams/{id}/members/invite` | `invitar_jugador_equipo` | Invitar jugador a la plantilla |
| POST | `/team-member-invitations/{id}/accept` | jugador invitado | Aceptar ingreso al equipo |
| DELETE | `/teams/{id}/members/{userId}` | `editar_plantilla` | Quitar jugador de la plantilla |
| POST | `/teams/{id}/coaches` | coach principal | Agregar coach asistente |
| POST | `/teams/{id}/organization-links` | `inscribir_equipo_torneo` | Vincular equipo a una organización/torneo |

---

## Torneos — estructura (Fase 3)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/organizations/{orgId}/tournaments` | `crear_torneo` | Crear torneo |
| GET | `/organizations/{orgId}/tournaments` | miembro de la organización | Listar torneos de la organización |
| GET | `/tournaments/{id}` | público (lectura básica) / miembro (detalle completo) | Ver detalle de torneo |
| PATCH | `/tournaments/{id}` | `editar_torneo` | Editar torneo |
| POST | `/tournaments/{id}/categories` | `editar_torneo` | Crear categoría |
| GET | `/tournaments/{id}/categories` | público | Listar categorías |
| PATCH | `/tournament-categories/{id}` | `editar_torneo` | Editar categoría |
| POST | `/tournaments/{id}/fields` | `editar_torneo` | Crear campo/cancha del torneo |
| GET | `/tournaments/{id}/fields` | público | Listar campos |
| POST | `/tournaments/{id}/phases` | `configurar_fases` | Crear fase |
| GET | `/tournaments/{id}/phases` | público | Listar fases |
| PATCH | `/tournament-phases/{id}` | `configurar_fases` | Editar fase (incluye `config` JSON) |
| POST | `/tournament-phases/{id}/transition-rules` | `configurar_fases` | Definir regla de transición a otra fase |
| POST | `/tournament-phases/{id}/seeding-rules` | `configurar_fases` | Definir método de siembra |

---

## Requisitos de elegibilidad (Fase 3)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/requirement-types` | público | Catálogo maestro de tipos de requisito |
| POST | `/tournament-categories/{id}/requirements` | `configurar_requisitos` | Activar un requisito para la categoría |
| GET | `/tournament-categories/{id}/requirements` | público | Ver requisitos activos de la categoría |
| PATCH | `/tournament-category-requirements/{id}` | `configurar_requisitos` | Editar valores/obligatoriedad de un requisito |
| DELETE | `/tournament-category-requirements/{id}` | `configurar_requisitos` | Desactivar requisito |

---

## Inscripciones (Fase 4)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/tournament-categories/{id}/registrations` | `inscribirse_torneo` o `inscribir_equipo_torneo` | Inscribir jugador/equipo (corre motor de validación de requisitos) |
| GET | `/tournament-categories/{id}/registrations` | `admin_org` | Listar inscripciones de la categoría |
| PATCH | `/tournament-registrations/{id}` | `aprobar_inscripcion` / `rechazar_inscripcion` | Resolver inscripción en revisión manual |
| POST | `/tournament-registrations/{id}/roster` | `convocar_jugadores_torneo` | Definir convocados de ese torneo |
| GET | `/tournament-registrations/{id}/roster` | coach o `admin_org` | Ver roster convocado |
| POST | `/tournament-phases/{id}/seed-assignments` | `admin_org` | Generar asignación de semillas (sorteo/tabla) |
| PATCH | `/bracket-seed-assignments/{id}` | `admin_org` | Editar semilla manualmente |

---

## Partidos y brackets (Fase 5)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/tournament-phases/{id}/generate-bracket` | `admin_org` | Dispara el algoritmo de generación según el formato de la fase |
| GET | `/tournament-phases/{id}/matches` | público | Listar partidos de la fase (vista de bracket) |
| GET | `/matches/{id}` | público | Detalle de un partido |
| PATCH | `/matches/{id}/result` | `editar_resultado` | Cargar/corregir resultado (dispara propagación async) |
| POST | `/matches/{id}/confirm` | `confirmar_resultado` | Confirmar resultado como representante de un equipo |
| POST | `/matches/{id}/disputes` | autenticado (jugador/coach del partido) | Reportar disputa sobre el resultado |
| PATCH | `/match-disputes/{id}/resolve` | `resolver_disputa` | Resolver disputa |
| GET | `/tournament-phases/{id}/standings` | público | Ver tabla de posiciones |

---

## Estadísticas y eventos de partido (Fase 6)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/matches/{id}/events` | `registrar_evento_partido` | Registrar gol, autogol, asistencia, tarjeta o cambio |
| GET | `/matches/{id}/events` | público | Ver eventos de un partido (línea de tiempo) |
| GET | `/tournaments/{id}/stats/players` | público | Tabla de goleadores/asistencias/tarjetas (ordena `player_tournament_stats`) |
| GET | `/tournaments/{id}/stats/teams` | público | Estadísticas acumuladas por equipo del torneo |
| GET | `/users/{userId}/tournaments/{tournamentId}/stats` | propio usuario / `admin_org` | Estadísticas individuales de un jugador en ese torneo |

## Sanciones, descalificación y reemplazo (Fase 6)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/matches/{id}/sanctions` | `aplicar_sancion` | Registrar tarjeta/suspensión a un jugador |
| GET | `/users/{userId}/sanctions` | propio usuario / `admin_org` | Sanciones del jugador (filtro por `tournament_id`) |
| PATCH | `/player-sanctions/{id}` | `aplicar_sancion` | Actualizar cumplimiento (`partidos_cumplidos`, `estado`) |
| POST | `/tournament-registrations/{id}/disqualify` | `descalificar_participante` | Descalificar equipo/jugador (motivo, fase) |
| POST | `/tournament-disqualifications/{id}/replace` | `reemplazar_participante` | Ejecutar reemplazo (automático si es fase futura, requiere confirmación si ya se jugó) |
| GET | `/tournament-phases/{id}/substitutions` | público | Historial de sustituciones en bracket |

## Carnet de jugador (Fase 6)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/tournament-registrations/{id}/credential` | `generar_carnet` | Emitir carnet con QR para esa inscripción |
| GET | `/public/credentials/{codigoQr}` | público (sin auth) | Escaneo del árbitro — datos limitados (nombre, foto, equipo, torneo, estado disciplinario) |
| PATCH | `/player-credentials/{id}/revoke` | `generar_carnet` | Revocar carnet (ej. jugador dado de baja) |

## Finanzas de torneo (Fase 7)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/tournaments/{id}/transactions` | `registrar_pago` / `registrar_reembolso` | Registrar inscripción, multa, pago de arbitraje o reembolso |
| GET | `/tournaments/{id}/transactions` | `ver_recaudos` | Listar movimientos (filtrable por `user_id`, `team_id`, `tipo`) |
| GET | `/tournaments/{id}/finance-summary` | `ver_recaudos` | Resumen materializado de recaudos/pendientes/multas |

## Hoja de vida del jugador (Fase 7)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/users/{userId}/achievements` | `agregar_logro_autoreportado` (jugador) o `admin_org` (verificado) | Agregar logro |
| PATCH | `/achievements/{id}/verify` | `admin_org` | Confirmar un logro autoreportado |
| GET | `/users/{userId}/timeline` | propio usuario / `admin_org` de alguna organización compartida | Historial cronológico agregado (`player_timeline`) |
| GET | `/users/{userId}/profile-summary` | público (perfil básico) | Totales agregados para carga rápida del perfil |

## Auditoría (transversal, Fase 1 en adelante)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/organizations/{orgId}/audit-log` | `admin_org` | Consultar historial de acciones sensibles (filtrable por `entidad_tipo`, `user_id`, rango de fecha) |

---

## Alcance cubierto (actualización)

Con esta ronda quedan cubiertas **todas las fases del plan de construcción (0 a 7)**: Auth, Organizaciones/Membresías, Acudientes, Equipos, Torneos (estructura, requisitos, inscripciones, partidos/brackets), Estadísticas/Eventos, Sanciones/Descalificación/Carnet, y Finanzas/Hoja de vida.
