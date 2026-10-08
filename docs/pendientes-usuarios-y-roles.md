# Pendientes — usuarios, roles y casos de uso

> Lista viva. Cada punto se marca como `[ ]` pendiente, `[~]` en curso o `[x]` resuelto (con la fecha y el commit). Se revisa al empezar cada fase.
> Origen: auditoría de casos de uso y roles del 2026-10-04 (cruce de `docs/` contra el código de Fase 0 y Fase 1).

## Prioridad 1 — seguridad o bloquea flujos (se atienden primero)

- [ ] **1.1 Robo de invitación por documento.** Quien conozca tipo + número de documento de una persona puede registrarse antes que ella y aceptar la invitación pendiente, porque `accept` solo compara el usuario logueado. Hay que proteger el perfil sombra hasta que su dueño real lo reclame.
  - Dónde: `auth.service.ts` (`register`), `memberships.service.ts` (`accept`).
- [ ] **1.2 Último `admin_org` puede darse de baja.** La organización queda sin nadie que la administre. Tampoco hay freno a que un admin cambie su propio rol.
  - Dónde: `memberships.service.ts` (`update`).
- [ ] **1.3 Permiso `admin_org` inexistente en la documentación.** Varias rutas de `docs/api-referencia-rapida.md` piden un permiso `admin_org` que no existe en el catálogo; con el código actual nadie las pasaría.
  - Dónde: `docs/api-referencia-rapida.md` (registrations, seed-assignments, generate-bracket, achievements/verify, audit-log).
- [ ] **1.4 Árbitro sin cuenta puede editar resultados.** El modelo (sección 16.1) lo permite solo si tiene `user_id`; el catálogo actual lo deja incondicional.
  - Dónde: `prisma/seed.ts` (permiso `editar_resultado` para `arbitro`). Se resuelve al construir Fase 5 (partidos).
- [ ] **1.5 Vincular acudiente sin consentimiento ni auditoría.** Hoy se puede vincular por email sin que el acudiente acepte, y no queda registro.
  - Dónde: `guardians.service.ts`.

## Prioridad 2 — riesgo o huecos de implementación

- [ ] **2.1 Solo `update` de membresías audita.** Invitar, aceptar y crear membresías no quedan en `audit_log`, aunque el modelo (sección 16) lo pide para acciones sensibles.
- [ ] **2.2 Guard con default "permitir".** Una ruta de organización sin `@RequierePermiso` deja pasar a cualquier miembro activo. Cambiar a default "denegar" para que cada endpoint nuevo declare su permiso.
  - Dónde: `common/guards/requiere-permiso.guard.ts`.
- [ ] **2.3 Permisos "del menor" del acudiente sin alcance por recurso.** `ver_estadisticas`, `ver_perfil_propio`, `ver_historial_propio`, `inscribirse_torneo` deberían limitarse al menor vinculado, pero el guard no distingue de quién es el recurso.
- [ ] **2.4 Endpoint de consulta de auditoría no implementado.** `GET /organizations/{orgId}/audit-log` está documentado pero el módulo `audit` no tiene controlador.
- [ ] **2.5 Acudiente no puede aceptar ni rechazar el vínculo.** Falta el flujo de confirmación del lado del acudiente.
- [ ] **2.6 Invitar por email revela si el correo existe.** Responde 404 `usuario_no_encontrado`, lo que permite enumerar correos desde una cuenta admin. Riesgo bajo.
- [ ] **2.7 Acción de reportar disputa sin permiso propio.** Hoy solo pide "autenticado" (api-ref).

## Prioridad 3 — casos de uso sin endpoint o decisiones de diseño pendientes

- [ ] **3.1 Confirmar inscripción de menor y ver estado de cuenta:** tienen permiso pero no endpoint (Fase 4/6).
- [ ] **3.2 Asignar árbitro y árbitro sin cuenta (`referees`):** no hay módulo ni tabla (Fase 5/6).
- [ ] **3.3 Salir de una organización:** no hay endpoint ni decisión sobre qué pasa con el historial.
- [ ] **3.4 Darse de baja de la plataforma:** no hay estado ni borrado lógico en `users`.
- [ ] **3.5 Baja vs. eliminar una membresía:** hoy `inactivo`/`removido` se pueden reactivar, pero el modelo no guarda fecha ni motivo de baja.
- [ ] **3.6 Menor que cumple 18 años:** no está decidido qué cambia (solo se dice que conserva su `user_id`).
- [ ] **3.7 Acudiente que deja de serlo:** quién puede quitar el vínculo y con qué registro.
- [ ] **3.8 Invitación caducada o rechazada:** la membresía `invitado` no expira ni tiene rechazo (sí existe para invitaciones de equipo).
- [ ] **3.9 Organización sin ningún admin:** no hay `platform_admin` todavía (ver panel superadmin).
- [ ] **3.10 Dos roles en la misma organización:** el sistema lo impide (`@@unique`), pero el modelo dice que el rol vive en la relación. Decidir si una persona puede ser coach y árbitro en la misma organización.
- [ ] **3.11 Coach de equipo vs. coach de organización (Fase 2):** el guard toma el rol de la membresía, pero el modelo dice que el coach vive en `team_coaches`. Hay que evitar que un coach de un equipo tenga permisos sobre toda la organización.

## Prioridad 4 — nombres y documentación

- [ ] **4.1 "Director de equipo" vs. "coach":** decidir el nombre oficial y aplicarlo en código y docs. Decisión tomada: el rol de quien administra un equipo se llama **director de equipo**.
- [ ] **4.2 "Coordinador":** aparece solo en `.claude/agents/frontend-dev.md:18`. Reemplazarlo por el nombre oficial.
- [ ] **4.3 `admin_escuela` y `platform_admin`:** documentados en la API pero sin rol ni permiso en código (fases futuras). Dejar anotado como "reservado".
- [ ] **4.4 Tutores/acudientes con login:** el modelo dice que el acudiente tiene cuenta; `.claude/agents/backend-dev.md:24` dice lo contrario y no lista `acudiente` entre los roles.
- [ ] **4.5 Documentos citados que no existen:** `docs/plan-construccion-mvp.md` y `docs/api-openapi-torneos.yaml` (citados en `CLAUDE.md`).
- [ ] **4.6 Rol como texto libre:** no hay tabla de roles ni llave foránea en la base de datos; la validación vive solo en el DTO. Decidir si se convierte en catálogo.

## Ya resuelto

- [x] Identidad global + membresía por organización (Fase 0/1).
- [x] Documento de identidad y perfil reclamable por documento (ver `docs/modelo-datos-torneos-saas.md` sección 2).
