---
name: project-fase0-auth-implementation
description: Decisiones tomadas al implementar Fase 0 (Auth) del backend — modelos, formato de refresh/reset tokens, y qué quedó fuera
metadata:
  type: project
---

Implementación de Fase 0 ("Fundacional — setup, auth, catálogos semilla") completada el 2026-09-22, siguiendo el plan `wiggly-hopping-journal.md` (ya aprobado por Cristian). Ver también [[feedback-migration-authorization]] sobre cómo se generó la migración.

**Modelos agregados a `schema.prisma`:** `User`, `Permission`, `RolePermission`, `Plan`, `Sport`, `RefreshToken`, `PasswordResetToken`. Migración: `20260922234607_auth_fase0_catalogos`. Ninguno lleva `organization_id` — son identidad global previa a `Membership` (Fase 1), sin RLS todavía.

**Decisión técnica — refresh tokens y tokens de reset son opacos, no JWT:** se generan con `crypto.randomBytes(48)` y se guardan hasheados con SHA-256 (no bcrypt) en `refresh_tokens`/`password_reset_tokens`. Razón: al ya ser aleatorios de alta entropía, no necesitan un hash lento tipo bcrypt (pensado para contraseñas de baja entropía elegidas por humanos); el estado de revocación en la tabla es la fuente de verdad de todas formas, así que firmar un JWT adicional para el refresh token no aportaba seguridad extra y sí complejidad. Por esto se **eliminó** la variable de entorno `JWT_REFRESH_SECRET` que ya existía en `.env`/`.env.example` (había quedado del scaffold inicial sin usarse). Solo `JWT_SECRET` sigue en pie, para firmar el access token (JWT corto, ~15 min).

**Detección de reuso de refresh token:** al hacer rotate en `/auth/refresh`, si el token presentado ya estaba `revokedAt != null`, se interpreta como señal de robo y se revocan TODOS los refresh tokens activos del usuario (no solo se rechaza la solicitud).

**Gap de documentación detectado (no resuelto, para que Cristian decida):** el catálogo de permisos en `docs/modelo-datos-torneos-saas.md` sección 16.1 incluye `ver_estado_cuenta_menor` (módulo Acudiente), pero la matriz rol×permiso de esa misma sección no lo asigna a ningún rol. Se sembró en el catálogo (`permissions`) pero sin fila en `role_permissions` — no se inventó una asignación no documentada.

**Quedó fuera a propósito (Fase 1):** `RequierePermisoGuard` con lógica real, `Membership`, `Organization`, RLS multi-tenant.

**Nota de entorno:** `docs/plan-construccion-mvp.md` y `docs/api-openapi-torneos.yaml`, que CLAUDE.md cita como fuente de verdad, no existen en el repo (verificado en esta tarea) — la Fase 0 se basó en `docs/modelo-datos-torneos-saas.md`, `docs/erd-torneos-saas.mermaid` y `docs/api-referencia-rapida.md`, que sí existen.
