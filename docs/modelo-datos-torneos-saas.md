# Modelo de Datos — SaaS de Torneos Multi-Organización

> Documento hermano de `arquitectura-tecnica-torneos-saas.md`. Este archivo describe el modelo de datos (tablas, relaciones, algoritmos de brackets); el otro describe stack, infraestructura y despliegue.

## Índice
1. Patrones de diseño aplicados (léelo primero)
2. Identidad y organizaciones
3. Menores de edad y acudientes
4. Deportes y equipos
5. Estructura de torneos (fases, transiciones, siembra)
6. Campos/canchas del torneo
7. Requisitos de elegibilidad
8. Inscripciones y convocatorias
9. Partidos, resultados, disputas y sanciones
10. Árbitros
11. Hoja de vida del jugador
12. Finanzas de torneo
13. Estatus de pago/sanción, descalificación y reemplazo
14. Estadísticas (equipo, torneo, goleadores, asistencias, tarjetas)
15. Carnet de jugador con QR
16. Auditoría de actividad
    16.1 Matriz de roles y permisos
17. Planes y módulos (SaaS)
18. Módulos reservados para fase 2 (namespacing)
19. Qué entra en el MVP vs qué queda preparado
20. Motor de generación de brackets (algoritmos y decisiones de diseño)

---

## 1. Patrones de diseño aplicados

Estos cinco patrones se repiten a lo largo de todo el modelo — entenderlos aquí evita releer el razonamiento en cada tabla:

- **Identidad global, membresía local:** `users` y `teams` no pertenecen a una sola organización. Su relación con una organización vive en tablas puente (`memberships`, `team_organization_links`). Esto es lo que permite que un jugador o un equipo participe en torneos de múltiples organizaciones con un solo perfil.
- **Configuración en vez de código:** reglas de elegibilidad, fases de torneo, formatos y siembra de brackets viven como filas de datos (`requirement_types`, `tournament_phases`, `seeding_rules`), no como lógica hardcodeada. Un admin activa/desactiva opciones desde la UI; el motor del backend es genérico y las interpreta.
- **Resúmenes materializados:** para todo lo que se consulta con frecuencia pero se calcula a partir de muchas filas (`standings`, `user_profile_summary`, `tournament_finance_summary`), se usa una tabla resumen que se recalcula async (cola de trabajos) tras cada evento relevante, en vez de hacer `JOIN`s pesados en cada lectura.
- **Polimorfismo participante:** varias tablas (`tournament_registrations`, `matches`, `tournament_transactions`) usan el par `participante_tipo` + `participante_id` para representar indistintamente a un `user` (deporte individual) o a un `team` (deporte de equipo), sin duplicar estructura.
- **Namespacing por módulo:** tablas de módulos futuros (Admin Escuelas, Admin Canchas) no tocan las tablas core — solo las referencian por FK. Activar un módulo nuevo es un `CREATE TABLE` aditivo, nunca un `ALTER` destructivo sobre lo que ya existe en producción.

---

## 2. Identidad y organizaciones

| Tabla | Propósito |
|---|---|
| `users` | Identidad global de cualquier persona en el sistema (jugador, coach, admin). Sin `tenant_id`. |
| `organizations` | El tenant — escuela, club, liga, organizador de torneos. |
| `memberships` | Relación N:N entre usuario y organización, con rol y estado. Aquí sí vive el aislamiento multi-tenant (RLS de Postgres filtra por `organization_id` a través de esta tabla y de lo que cuelga de ella). |
| `permissions` / `role_permissions` | Catálogo de acciones del sistema y qué rol las tiene por defecto. Evita `if (rol === 'admin')` regado por el código. |
| `refresh_tokens` | Soporte de autenticación (Fase 0, agregada durante la implementación — no estaba en el diseño original). Un registro por sesión activa: permite invalidar sesiones puntuales en `/auth/logout`, rotar el token en cada `/auth/refresh` y detectar el reuso de un token ya revocado (señal de robo), revocando en ese caso todas las sesiones del usuario. Guarda `token_hash` (nunca el token en texto plano). |
| `password_reset_tokens` | Soporte de autenticación (Fase 0, agregada durante la implementación). Sostiene el flujo de "¿Olvidó su contraseña?": un token opaco de un solo uso (`used_at`), con expiración, que al consumirse en `/auth/reset-password` revoca además todos los `refresh_tokens` activos del usuario (cierre de sesión en todos los dispositivos). |

**Auth:** JWT lleva solo `user_id`. Cada request que toca datos de una organización especifica `organization_id` (URL/header) y el backend valida contra `memberships` el acceso y el rol vigente. El JWT de acceso es de corta duración (`JWT_ACCESS_EXPIRES_IN`, ~15 min) — la sesión se mantiene renovando vía `/auth/refresh` con el refresh token opaco (`JWT_REFRESH_EXPIRES_IN`, ~30 días), que vive hasheado en `refresh_tokens`.

---

## 3. Menores de edad y acudientes

Hueco detectado en revisión de diseño: el rol "padre/tutor" ya existía como membresía, pero faltaba la relación estructural entre un jugador menor y quien lo representa.

```
user_guardians
├── id
├── minor_user_id FK        -- el jugador menor (sigue siendo un `user` normal)
├── guardian_user_id FK     -- el padre/tutor, con su propia cuenta
├── relacion (padre, madre, tutor_legal)
├── es_responsable_pagos (bool)
└── es_contacto_emergencia (bool)
```

**Por qué importa más allá del dato:** define a quién llegan las notificaciones de pago/partidos de un menor, quién autoriza su participación (consentimiento, cesión de derechos de imagen para carnet/fotos), y quién es el contacto de emergencia. Un menor conserva su propio `user_id` (para que su hoja de vida siga siendo suya cuando cumpla la mayoría de edad), pero ciertas acciones (confirmar inscripción, ver estado de cuenta) pueden requerir que el backend valide también contra su acudiente si `es_responsable_pagos = true`.

**Nota de cumplimiento:** el manejo de datos de menores suele tener requisitos legales más estrictos (consentimiento parental, retención de datos, derecho al olvido) en la mayoría de países de Latam — vale la pena revisar la normativa local aplicable antes de lanzar el módulo de escuelas de formación, ya que ahí es donde más concentración de menores va a haber.

---

## 4. Deportes y equipos

| Tabla | Propósito |
|---|---|
| `sports` | Catálogo de deportes soportados, con metadata que define comportamiento (`maneja_sets`, `tipo_participacion`, `unidad_resultado`). Agregar un deporte nuevo es una fila, no una migración. |
| `teams` | Equipo como entidad **global**, igual que `users`. No pertenece de forma fija a una organización. |
| `team_coaches` | Quién administra el equipo (puede haber coach principal + asistentes). |
| `team_members` | Plantilla **maestra** del equipo — el universo completo de jugadores reclutados, sin relación con un torneo específico. |
| `team_organization_links` | En qué organizaciones participa este equipo (nace de una escuela, o se inscribe suelto a torneos de terceros — mismo mecanismo para ambos casos). |
| `team_creation_invitations` | Registro del flujo de creación de equipos: **un usuario solo puede crear su primer equipo al aceptar una invitación de una organización.** Invitaciones posteriores le preguntan si reutiliza un equipo existente o crea uno nuevo. No existe endpoint público de "crear equipo" sin invitación de por medio. |

---

## 5. Estructura de torneos

| Tabla | Propósito |
|---|---|
| `tournaments` | El torneo en sí — nombre, fechas, deporte, organización dueña. |
| `tournament_categories` | Subdivisión por edad/género/nivel/modalidad (individual o equipo). |
| `tournament_phases` | Un torneo se compone de una o más fases encadenadas (`fase_padre_id`), cada una con su propio formato (`round_robin`, `eliminacion_simple`, `eliminacion_doble`, `suizo`, `liga`). Esto modela de forma nativa el caso de "doble torneo" (Copa Oro/Copa Plata) sin tratarlo como caso especial. |
| `phase_transition_rules` | Define qué participantes pasan de una fase a otra y bajo qué criterio (`top_n_por_grupo`, `resto_no_clasificados`, etc.). |
| `seeding_rules` | Cómo se emparejan los clasificados en la fase siguiente: sorteo aleatorio, siembra por tabla (1° vs último), o manual. |
| `bracket_seed_assignments` | El resultado concreto de aplicar la regla de siembra — siempre editable manualmente después, sin importar el método que lo generó. |

**Round robin con fechas limitadas:** cuando hay más equipos de los que permite un calendario completo (ej. 40 equipos, 8 fechas), `tournament_phases.config` almacena `modo: limitado`, `numero_fechas` y `metodo_calendario` (sistema/manual). El algoritmo de generación reparte enfrentamientos buscando partidos jugados equilibrados entre todos, en vez de truncar un round robin completo a medias.

---

## 6. Campos/canchas del torneo

Petición del organizador: poder definir, en la configuración general de un torneo, cuántos campos/canchas tiene disponibles y cómo se llaman, para poder programar partidos en paralelo sin depender del módulo completo de Alquiler de Canchas.

```
tournament_fields
├── id
├── tournament_id FK
├── nombre           (ej: "Cancha 1", "Campo Norte")
├── orden
├── court_id FK (nullable)  -- solo si el módulo Admin Canchas está activo y se quiere enlazar a una cancha real registrada, para heredar costo/reservas
└── activo (bool)
```

`matches.tournament_field_id` referencia esta tabla (no directamente `courts`) — así cualquier organización, tenga o no activo el módulo de canchas, puede simplemente nombrar sus campos y asignar partidos a ellos desde el día 1. Cuando activen Admin Canchas más adelante, pueden enlazar cada `tournament_field` a una `court` real sin romper nada de lo ya programado.

---

## 7. Requisitos de elegibilidad

| Tabla | Propósito |
|---|---|
| `requirement_types` | Catálogo maestro de tipos de requisito (edad, membresía activa, certificado médico, cupo máximo, pago de inscripción, aprobación manual, etc.), mantenido por la plataforma. |
| `tournament_category_requirements` | La configuración real que hace el admin de organización al crear/editar una categoría: qué requisitos activa, con qué valores, y si son obligatorios. |

El motor de validación es un loop genérico sobre los requisitos habilitados — agregar un tipo de requisito nuevo al catálogo es una función validadora más, no un cambio al flujo de inscripción.

---

## 8. Inscripciones y convocatorias

| Tabla | Propósito |
|---|---|
| `tournament_registrations` | Inscripción de un participante (usuario o equipo, vía polimorfismo) a una categoría de torneo. Guarda un snapshot de qué requisitos cumplió al momento de inscribirse (no retroactivo si luego cambian las reglas). |
| `tournament_registration_roster` | **Convocatoria específica a ese torneo** — subconjunto de `team_members` seleccionado para jugar. Resuelve el problema de que un mismo equipo tenga jugadores distintos convocados en cada torneo, sin alterar la plantilla maestra. |

---

## 9. Partidos, resultados, disputas y sanciones

| Tabla | Propósito |
|---|---|
| `matches` | Partido individual dentro de una fase — participantes polimórficos, ronda, grupo, resultado, campo del torneo (`tournament_field_id`). |
| `standings` | Tabla de posiciones materializada por fase, recalculada tras cada resultado. Usa `puntos_promedio` (no solo puntos totales) para ordenar correctamente cuando hay fechas limitadas y no todos jugaron el mismo número de partidos. |
| `player_sanctions` | Tarjetas/suspensiones ligadas a un jugador y opcionalmente a un partido. Separada del dinero — la multa asociada (si la hay) vive en `tournament_transactions` y se puede referenciar cruzado. |
| `match_disputes` | Reporte de un participante disputando un resultado, con motivo, estado y quién lo resolvió. |

**Estados de partido ampliados (hueco detectado):** además de `programado/en_curso/finalizado`, `matches.estado` debe contemplar:
- `walkover` — un equipo no se presenta; el ganador se asigna automáticamente y opcionalmente dispara una sanción (conectando con `player_sanctions`/`tournament_disqualifications`).
- `suspendido` / `reprogramado` — por clima u otra causa de fuerza mayor, sin perder el registro de la fecha original.

**Definición por penales:** en fase eliminatoria, un empate puede requerir desempate:
```
matches
+ penales_a, penales_b (nullable — solo si hubo definición por penales/muerte súbita)
```

**Confirmación de resultado (hueco detectado):** para reducir disputas sobre marcadores, se agrega:
```
matches
+ resultado_confirmado_por_a (nullable FK — coach/capitán del equipo A confirma)
+ resultado_confirmado_por_b (nullable FK — coach/capitán del equipo B confirma)
```
Si ambos confirman el mismo resultado, se cierra sin fricción. Si hay discrepancia, se abre un registro en `match_disputes` para que el admin de organización lo resuelva — con trazabilidad de quién reportó y cómo se resolvió, en vez de que un cambio de marcador quede sin rastro.

**Criterios de desempate en standings (hueco detectado):** cuando dos participantes empatan en puntos, el criterio de desempate (diferencia de gol, enfrentamiento directo, fair play) varía por organización/torneo — se deja configurable en la fase:
```json
tournament_phases.config += { "criterios_desempate": ["diferencia_gol", "enfrentamiento_directo", "tarjetas"] }
```

---

## 10. Árbitros

| Tabla | Propósito |
|---|---|
| `referees` | Modelo dual: puede ser un simple registro (nombre + teléfono) sin cuenta, o estar ligado a un `user_id` si la organización quiere que tenga acceso a la app para ver sus partidos asignados. |
| `match_referees` | Asignación de árbitro(s) a un partido específico. |

---

## 11. Hoja de vida del jugador

| Tabla | Propósito |
|---|---|
| `achievements` | Logro puntual (campeón, MVP, etc.), ligado a organización y torneo de origen. |
| `player_timeline` | Feed cronológico de todo lo relevante en la carrera del jugador (inscripciones, resultados, logros, cambios de equipo), agregado async desde cualquier organización. Es la base de la "hoja de vida". |
| `user_profile_summary` | Resumen materializado (totales) para que el perfil cargue rápido sin sumar filas en tiempo real. |

**Nota sobre invitaciones a jugadores ya existentes:** cuando una organización invita a alguien que ya jugó torneos previos bajo otro registro, al aceptar y crear su cuenta, el historial pasado se cruza y pasa a pertenecer también a ese usuario — el modelo ya lo soporta porque el historial siempre cuelga de `user_id`, nunca de una organización como dueña exclusiva.

---

## 12. Finanzas de torneo

Separado deliberadamente de la facturación SaaS (organización → plataforma) — esto es dinero que fluye dentro del torneo (jugador/equipo → organización).

| Tabla | Propósito |
|---|---|
| `tournament_transactions` | Registro unificado de inscripciones, multas y pagos de arbitraje (`tipo` distingue el concepto — incluye `reembolso`, referenciando la transacción original vía `transaccion_relacionada_id`). Incluye `moneda` para no asumir una sola divisa si en el futuro se opera en más de un país. Registro manual en el MVP (`metodo_registro`), preparado para pasarela de pago después. |
| `tournament_finance_summary` | Resumen materializado para el dashboard de recaudos del admin de organización. |

---

## 13. Estatus de pago/sanción, descalificación y reemplazo

| Tabla / campo | Propósito |
|---|---|
| `tournament_registrations.estado_pago` | Campo agregado — `al_dia`, `pendiente`, `moroso`. Se recalcula async tras cada movimiento en `tournament_transactions` del participante. |
| `tournament_registrations.estado_disciplinario` | Campo agregado — `activo`, `suspendido`, `eliminado`. Se recalcula tras cada sanción nueva o suspensión cumplida. |
| `player_sanctions.partidos_suspension` / `partidos_cumplidos` / `estado` | Campos agregados para seguimiento de cumplimiento de suspensión (ej. "3 partidos, 1 cumplido"). Es lo que consulta el carnet del jugador para saber si puede jugar. |
| `tournament_disqualifications` | Registro de descalificación de un equipo o jugador por sanción o falta de pago, con motivo, fase y fecha. No se borra al participante — queda el historial. |
| `bracket_substitutions` | Registro del reemplazo real en el bracket cuando aplica — participante saliente, entrante, y el partido/fase afectada. |

**Reemplazo en instancias finales:** se configura por fase en `tournament_phases.config`:
```json
{ "permite_reemplazo": true, "criterio_reemplazo": "siguiente_mejor_clasificado" }
```
- `siguiente_mejor_clasificado`: el sistema busca en `standings` de la fase anterior quién quedó inmediatamente después del último clasificado, y lo propone como reemplazo.
- `manual`: el admin de organización elige a mano.

Al confirmarse, se actualiza el `matches.participante_x` correspondiente y queda auditado en `bracket_substitutions`.

---

## 14. Estadísticas (equipo, torneo, goleadores, asistencias, tarjetas)

| Tabla | Propósito |
|---|---|
| `match_events` | Fuente de verdad jugada a jugada — gol, autogol, asistencia, tarjeta, cambio — ligado a `match_id`, `user_id` y `team_id` (importante para que un autogol cuente a favor del equipo correcto). |
| `player_tournament_stats` | Resumen materializado por jugador y torneo (goles, asistencias, tarjetas, partidos jugados). La "tabla de goleadores" es simplemente esta tabla ordenada por `goles`. |
| `team_tournament_stats` | Resumen materializado por equipo y torneo (partidos, resultados, goles a favor/en contra) — acumulado de **todas** las fases del torneo, a diferencia de `standings` que es por fase individual (para saber quién clasifica). Ambas tablas son complementarias. |

---

## 15. Carnet de jugador con QR

| Tabla | Propósito |
|---|---|
| `player_credentials` | Carnet ligado a `tournament_registration_id` (no al usuario en general) — un jugador que participa en 3 torneos de 3 organizaciones distintas tiene 3 carnets distintos, cada uno válido solo en su contexto. `codigo_qr` es un token opaco (no expone el ID interno). |

**Endpoint público de escaneo** (lo que ve el árbitro):
```
GET /public/carnet/{codigo_qr}
→ nombre, foto, equipo, torneo, estado_disciplinario, sanciones activas, validez
```

**Consideración de privacidad:** la vista pública debe limitarse a lo necesario para control arbitral (nombre, foto, equipo, torneo, estado de sanción). Datos sensibles (documento completo, fecha de nacimiento exacta) no deberían exponerse sin autenticación — pueden mostrarse a un árbitro logueado con permiso, pero no en el escaneo público abierto.

---

## 16. Auditoría de actividad

Hueco detectado: no existía un registro genérico de quién hizo qué en acciones administrativas sensibles (editar resultado, aprobar/rechazar inscripción, marcar pago, cambiar sanción). Se resuelve con una sola tabla genérica, aplicable a cualquier entidad del sistema:

```
audit_log
├── id
├── organization_id FK
├── user_id FK                -- quién ejecutó la acción
├── entidad_tipo, entidad_id  -- qué se modificó (ej: 'match', 'tournament_registration')
├── accion (crear, editar, eliminar)
├── valores_anteriores (json)
├── valores_nuevos (json)
└── fecha
```

Se recomienda instrumentar esto desde el MVP en las acciones más sensibles (edición de resultados, cambios de estado de pago, sanciones) — es barato de agregar ahora y muy costoso de reconstruir retroactivamente una vez haya datos reales en producción sin este rastro.

---

## 16.1 Matriz de roles y permisos

Catálogo de `permissions` agrupado por módulo, y su asignación por defecto en `role_permissions`. Esta tabla es la que consulta el guard/decorator centralizado del backend (`@RequierePermiso(...)`) antes de ejecutar cualquier endpoint sensible — con cache en Redis, porque se valida en cada request.

**Catálogo — Torneos (core):** `crear_torneo`, `editar_torneo`, `editar_organizacion`, `configurar_requisitos`, `configurar_fases`, `aprobar_inscripcion`, `rechazar_inscripcion`, `editar_resultado`, `confirmar_resultado`, `resolver_disputa`, `registrar_evento_partido`, `descalificar_participante`, `reemplazar_participante`, `aplicar_sancion`, `ver_recaudos`, `registrar_pago`, `registrar_reembolso`, `asignar_arbitro`, `ver_estadisticas`, `generar_carnet`.

**Catálogo — Equipos:** `editar_plantilla`, `invitar_jugador_equipo`, `inscribir_equipo_torneo`, `convocar_jugadores_torneo`.

**Catálogo — Jugador:** `inscribirse_torneo`, `ver_perfil_propio`, `ver_historial_propio`, `agregar_logro_autoreportado` (queda `pendiente_verificacion` hasta que una organización lo confirme).

**Catálogo — Acudiente:** `ver_estado_cuenta_menor`, `confirmar_inscripcion_menor`.

**Catálogo — Escuela** (reservado, fase 2): `administrar_jugadores_escuela`, `registrar_pago_mensualidad`, `crear_equipo_escuela`.

**Catálogo — Canchas** (reservado, fase 2): `registrar_cancha`, `editar_reserva`, `administrar_costos_cancha`.

**Catálogo — Plataforma** (reservado, futuro super-admin): `gestionar_organizaciones`, `gestionar_planes`, `ver_metricas_globales` — acceso cross-tenant, única excepción intencional a RLS.

**Matriz rol × permiso (módulos Torneos + Equipos, alcance MVP):**

| Permiso | admin_org | coach | jugador | acudiente | árbitro |
|---|:---:|:---:|:---:|:---:|:---:|
| crear_torneo / editar_torneo | ✅ | ❌ | ❌ | ❌ | ❌ |
| editar_organizacion | ✅ | ❌ | ❌ | ❌ | ❌ |
| configurar_requisitos / configurar_fases | ✅ | ❌ | ❌ | ❌ | ❌ |
| aprobar_inscripcion / rechazar_inscripcion | ✅ | ❌ | ❌ | ❌ | ❌ |
| editar_resultado | ✅ | ❌ | ❌ | ❌ | ✅ (solo si tiene `user_id`) |
| confirmar_resultado | ❌ | ✅ | ❌ | ❌ | ❌ |
| resolver_disputa | ✅ | ❌ | ❌ | ❌ | ❌ |
| registrar_evento_partido | ✅ | ❌ | ❌ | ❌ | ✅ |
| descalificar_participante / reemplazar_participante | ✅ | ❌ | ❌ | ❌ | ❌ |
| aplicar_sancion | ✅ | ❌ | ❌ | ❌ | ✅ |
| ver_recaudos / registrar_pago / registrar_reembolso | ✅ | ❌ | ❌ | ❌ | ❌ |
| asignar_arbitro | ✅ | ❌ | ❌ | ❌ | ❌ |
| ver_estadisticas | ✅ | ✅ | ✅ (propias) | ✅ (del menor) | ❌ |
| generar_carnet | ✅ | ❌ | ❌ | ❌ | ❌ |
| editar_plantilla / invitar_jugador_equipo | ❌ | ✅ | ❌ | ❌ | ❌ |
| inscribir_equipo_torneo / convocar_jugadores_torneo | ❌ | ✅ | ❌ | ❌ | ❌ |
| inscribirse_torneo (individual) | ❌ | ❌ | ✅ | ✅ (a nombre del menor) | ❌ |
| ver_perfil_propio / ver_historial_propio | ❌ | ✅ | ✅ | ✅ (del menor) | ❌ |
| agregar_logro_autoreportado | ❌ | ✅ | ✅ | ❌ | ❌ |
| confirmar_inscripcion_menor | ❌ | ❌ | ❌ | ✅ | ❌ |

**Notas de diseño:**
- `editar_resultado` para árbitro es condicional a que tenga `user_id` — un árbitro sin cuenta (registro simple de `referees`) nunca puede autenticarse, así que solo el `admin_org` carga el resultado en ese caso.
- El rol no vive en el usuario sino en la relación (`team_coaches` vs `team_members`): un coach que también es jugador en otro equipo simplemente tiene ambas filas de permisos activas simultáneamente, sin conflicto ni caso especial en el código.
- Solo `admin_org` tiene visibilidad financiera completa — ni siquiera el coach del equipo moroso ve el detalle contable de la organización, solo su propio `estado_pago` agregado.

---

## 17. Planes y módulos (SaaS)

Solo control interno en el MVP — sin Stripe activo, pero modelo listo para conectarlo después.

| Tabla | Propósito |
|---|---|
| `plans` | Plan base contratado por la organización. |
| `modules` | Catálogo de módulos activables (Torneos, Torneos Pro, Admin Escuelas, Admin Canchas, Analytics), cada uno con precio adicional. |
| `plan_default_modules` | Qué módulos vienen incluidos de fábrica en cada plan. |
| `organization_modules` | Override real por organización — permite combos custom sin crear un plan nuevo por cada excepción. |
| `organization_limits` | Límites de jugadores y equipos por organización (confirmado: sin límite de inscripciones/torneos por jugador — el límite es de membresía, no de participación). |

---

## 18. Módulos reservados para fase 2 (namespacing)

Estas tablas **no se construyen en el MVP**, pero se documentan aquí para que el nombre y la relación con el core queden reservados desde ya — así cuando se activen, es una migración aditiva sin riesgo sobre producción:

| Tabla | Módulo futuro |
|---|---|
| `school_accounts` | Admin Escuelas — mensualidades y matrícula, distinto de `tournament_transactions`. |
| `courts` | Alquiler de Canchas — registro de canchas y costo por hora. |
| `court_bookings` | Alquiler de Canchas — reservas, con posible cruce a `matches` para asignación automática. |
| `platform_billing` *(no incluida en el ERD aún)* | Panel super-admin — facturación organización → plataforma, cuando activen cobro real vía Stripe. |

---

## 19. Qué entra en el MVP vs qué queda preparado

**Construir ahora (MVP — fútbol, módulo Torneos):**
Identidad, organizaciones, membresías, menores/acudientes, equipos (con flujo de invitación), estructura de torneos con fases múltiples (incluyendo doble torneo/repechaje), campos/canchas por torneo, requisitos configurables, inscripciones con roster por torneo, partidos con confirmación y disputas, standings con criterios de desempate, sanciones, árbitros (modo simple y con usuario), hoja de vida del jugador, finanzas de torneo con registro manual y reembolsos, auditoría de acciones sensibles, planes/módulos en modo de control interno.

**Modelo listo, sin construir todavía (fase 2):**
`school_accounts`, `courts`, `court_bookings`, integración de pasarela de pago real, facturación SaaS con Stripe, notificaciones por WhatsApp, formatos de torneo avanzados (eliminación doble, sistema suizo, liga completa ida/vuelta), deportes individuales más allá de fútbol (el campo `participante_tipo` ya soporta el cambio sin migración dolorosa), ranking cruzado entre torneos, galería de medios.

---

## 20. Motor de generación de brackets (algoritmos y decisiones de diseño)

Esta sección documenta el pseudocódigo de referencia para el equipo de desarrollo. No es código ejecutable — es la lógica que luego se traduce a TypeScript/NestJS (o el lenguaje que se use), sin atarse todavía a detalles de implementación como manejo de errores, tipos exactos o si se usa una librería externa de brackets.

Requiere dos campos adicionales en `matches` para que el bracket sea un árbol navegable y no solo una lista de partidos sueltos:

```
matches
├── ... (ya existente)
├── match_siguiente_ganador_id FK   -- a qué partido avanza el ganador
├── slot_en_siguiente_ganador       -- 'A' o 'B', en qué posición del siguiente partido
├── match_siguiente_perdedor_id FK  -- solo se usa en eliminación doble
└── slot_en_siguiente_perdedor      -- 'A' o 'B'
```

Confirmar un resultado dispara un job async que **propaga automáticamente** el ganador (y en eliminación doble, también el perdedor) al partido correspondiente — el bracket se autocompleta, sin intervención manual del admin.

### 17.1 Eliminación simple — colocación de semillas y "byes"

Problema a resolver: el número de participantes rara vez es una potencia exacta de 2 (8, 16, 32...). Con 11 equipos se necesita un bracket de tamaño 16, y 5 equipos deben "descansar" la primera ronda (bye).

**Algoritmo de colocación de semillas** (el mismo patrón que usan los torneos profesionales, para que el sembrado 1 no pueda cruzarse con el sembrado 2 hasta la final):

```
función generar_posiciones_bracket(tamaño):
    posiciones = [1]
    mientras longitud(posiciones) < tamaño:
        n = longitud(posiciones)
        posiciones_espejo = [2n + 1 - p  para cada p en posiciones]
        posiciones = intercalar(posiciones, posiciones_espejo)
    retornar posiciones
```

Para tamaño 16, esto genera el orden `[1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]` — la disposición clásica de bracket donde el sembrado 1 solo enfrentaría al 2 en la final, si ambos ganan todo.

**Cálculo de byes:**

```
función calcular_byes(n_participantes):
    tamaño_bracket = siguiente_potencia_de_2(n_participantes)
    numero_byes = tamaño_bracket - n_participantes
    retornar numero_byes
```

Los byes se asignan a las semillas más altas primero (1, 2, 3...) según el orden de `generar_posiciones_bracket`. Un participante con bye no juega partido en la ronda 1: su partido se marca con `estado = 'bye_avance'` y el motor de propagación lo mueve directo a la ronda 2 sin esperar resultado.

**Decisión de diseño:** el algoritmo de colocación solo necesita leer `bracket_seed_assignments` (ya poblada por sorteo, siembra por tabla o edición manual del admin, como vimos antes) — no decide *quién* va en cada semilla, solo *dónde* se ubica cada semilla dentro del árbol. Esto mantiene separada la responsabilidad: una tabla decide el ranking de entrada, el algoritmo decide la geometría del bracket.

### 17.2 Eliminación doble — cuadro de ganadores (W) + cuadro de perdedores (L)

Más compleja porque son **dos árboles entrelazados**, no uno solo:

- El **cuadro W** se genera exactamente igual que la eliminación simple (17.1).
- El **cuadro L** recibe a los eliminados de W en un patrón específico por ronda: los perdedores de la ronda 1 de W entran a la ronda 1 de L; los de la ronda 2 de W entran más adelante, de forma que dos participantes no se enfrenten dos veces seguidas si se puede evitar.
- La **gran final** cruza al campeón de W contra el campeón de L.

**Decisión de diseño — bracket reset:** si el campeón de L gana la gran final, técnicamente el campeón de W solo tiene una derrota y "sigue vivo" bajo la regla de doble eliminación. Hay que decidir si se juega un segundo partido de desempate (bracket reset) o si el torneo termina en un único partido. Se deja como configuración de la fase:

```json
{ "permite_reset_final": true }
```

**Decisión de diseño — plantillas en vez de algoritmo genérico:** el algoritmo generalizado de doble eliminación para *cualquier* número de participantes es notoriamente propenso a errores de borde. Se recomienda usar **plantillas precalculadas** para los tamaños más comunes (4, 8, 16, 32) — patrones ya conocidos y verificados — y completar con byes hasta la plantilla más cercana cuando el número real no calza exacto, igual que en 17.1.

### 17.3 Round robin (todos contra todos) — método del círculo

```
función generar_calendario_round_robin(equipos, numero_fechas_limite = null):
    si longitud(equipos) es impar:
        agregar "bye_fantasma" a equipos
    mezclar_aleatoriamente(equipos)   -- evita patrón de cruces predecible entre torneos
    n = longitud(equipos)
    fijo = equipos[0]
    rotables = equipos[1:]
    calendario = []
    total_rondas = n - 1
    rondas_a_generar = numero_fechas_limite si no es null, si no total_rondas

    para ronda en 1..rondas_a_generar:
        ronda_actual = [fijo] + rotables
        para i en 0..(n/2 - 1):
            emparejar(ronda_actual[i], ronda_actual[n-1-i])
        calendario.agregar(partidos_de_la_ronda)
        rotar rotables una posición
    retornar calendario
```

**Decisión de diseño clave (resuelve el caso "40 equipos, 8 fechas"):** el método del círculo ya reparte los partidos de forma pareja ronda por ronda — cada equipo juega exactamente un partido por fecha, contra un rival distinto cada vez. Limitar a 8 fechas es simplemente **tomar las primeras 8 iteraciones del ciclo y detenerse ahí** (`rondas_a_generar` en el pseudocódigo). No hace falta un algoritmo especial de "round robin parcial balanceado": el círculo ya es naturalmente justo en número de partidos jugados por equipo. Lo único que sí se agrega es mezclar aleatoriamente el orden inicial antes de aplicar el ciclo.

### 17.4 Sistema suizo (fase 2 — no se implementa en el MVP)

El emparejamiento por récord similar, evitando revanchas, no tiene una fórmula cerrada simple como round robin — se resuelve típicamente con un algoritmo de *matching* óptimo en grafos (tipo Blossom) o con las reglas del "sistema holandés" usado en ajedrez, para el cual ya existen implementaciones de referencia probadas. Se deja anotado para no subestimar el esfuerzo cuando se aborde: es sustancialmente más complejo que los tres formatos anteriores.

### 17.5 Propagación de resultados y su límite ante descalificaciones

```
al_confirmar_resultado(match):
    ganador = determinar_ganador(match)
    perdedor = determinar_perdedor(match)

    si match.match_siguiente_ganador_id no es null:
        actualizar_slot(match.match_siguiente_ganador_id, match.slot_en_siguiente_ganador, ganador)

    si match.match_siguiente_perdedor_id no es null:   -- solo eliminación doble
        actualizar_slot(match.match_siguiente_perdedor_id, match.slot_en_siguiente_perdedor, perdedor)

    recalcular_standings(match.tournament_phase_id)
    recalcular_stats(match)   -- desde match_events, ver sección 12
```

**Decisión de diseño — reemplazo por descalificación:** conectando con `bracket_substitutions` (sección 11), la propagación automática solo debe aplicar a **partidos futuros, no jugados todavía**. Si el equipo descalificado ya había avanzado ganando un partido real, revertir esa cadena de resultados automáticamente es riesgoso (afecta estadísticas y sanciones ya registradas). El sistema resuelve el reemplazo automáticamente cuando el partido afectado aún no se jugó; si ya se jugó y el descalificado ya avanzó, el sistema debe **alertar al admin y requerir confirmación manual** de cómo proceder, en vez de automatizarlo por completo — es un caso de baja frecuencia donde el criterio humano pesa más que la velocidad.
