---
name: project-perfiles-reclamables-implementation
description: Decisiones y estado de "Documento de identidad y perfiles reclamables" (post Fase 1) — User.email/passwordHash opcionales, documento único, reclamo de perfil sombra
metadata:
  type: project
---

Implementado el 2026-09-29 siguiendo el plan `wiggly-hopping-journal.md` (versión "Documento de identidad y perfiles reclamables", ya aprobado por Cristian), sobre Fase 0 (Auth) y Fase 1 (Organizaciones/Membresías) que en ese momento estaban implementadas pero sin commit en `develop`.

**Cambio de modelo:** `User.email`/`User.passwordHash` pasan a opcionales; se agregan `tipoDocumento`+`numeroDocumento` con `@@unique([tipoDocumento, numeroDocumento])`. Migración `20260929213942_agrega_documento_identidad_perfiles_reclamables` generada y aplicada (ver [[project-local-dev-environment]] para el workaround de `migrate diff` + `migrate deploy` que hizo falta porque `migrate dev` no corre en el shell de las tools).

**Mecanismo de perfil sombra:** `MembershipsService.invite` ahora acepta modo B (documento) además del modo A (email) ya existente — crea un `User` con `email`/`passwordHash` en `null` si el documento no existe, o reutiliza la fila si ya existe (reclamada o no). `AuthService.register` resuelve primero por documento: si ya tiene `email` seteado, rechaza siempre con 409 `documento_ya_registrado` (aunque el email del formulario sea distinto — regla de seguridad central, no negociable); si existe sin email, completa esa misma fila (reclamo) sin tocar `nombre`/`fechaNacimiento` (la organización que pre-registró es la fuente de verdad); si no existe, crea usuario nuevo. El chequeo de email duplicado se mantiene después del chequeo de documento, en ese orden.

**Bug real encontrado y corregido en el DTO de invite (no en el plan original, que traía el bug):** el decorador custom `ExactlyOneInviteMode()` estaba puesto sobre `email`, que también lleva su propio `@ValidateIf(...)`. Como `@ValidateIf` en class-validator salta **todos** los decoradores de esa misma propiedad cuando la condición da falso, apenas llegaba `tipoDocumento` en el body se saltaba también el chequeo XOR — dejando pasar sin error un body que mezclaba ambos modos. Se movió el decorador a `rol` (campo siempre requerido, sin `ValidateIf`), así el chequeo corre siempre. Detectado por el propio test nuevo (`invite-membership.dto.spec.ts`) antes de llegar a e2e — confirma que vale la pena escribir el caso "mezcla ambos modos" explícitamente en vez de confiar en que la validación cruzada "obviamente" funciona.

**Deviación de alcance no listada explícitamente en el plan:** `test/organizations.e2e.spec.ts` y `test/guardians.e2e.spec.ts` (no mencionados en el plan) también llaman `/auth/register` y se rompían al volverse obligatorio el documento — se actualizaron sus helpers `registrar()`/`registrarYLoguear()` con el mismo patrón de contador síncrono que ya usaba `memberships.e2e.spec.ts`, para no dejar tests existentes rotos (regla explícita de la tarea).

**Estado final:** 121/121 tests (unitarios + e2e contra Postgres real) pasando, lint y build limpios. `pnpm dev` de Cristian se detuvo temporalmente (bloqueaba el motor de Prisma) y se reinició al terminar.

**Pendiente a propósito, documentado en `docs/`:** recuperación de cuenta / cambio de email vía documento (depende de definir proveedor de WhatsApp). No se tocó nada de `teams`/equipos (Fase 2).
