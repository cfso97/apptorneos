---
name: backend-docker-e2e-bloqueo
description: Qué suites de test del backend requieren Postgres real vía Docker y cómo se ven cuando Docker no está corriendo
metadata:
  type: project
---

`apps/backend/test/app.e2e.spec.ts` y `apps/backend/test/auth.e2e.spec.ts` bootstrapean el `AppModule` real completo, incluyendo `PrismaService.onModuleInit()` que hace `$connect()` contra Postgres de verdad (ver `docker-compose.yml` en la raíz, servicio `postgres`). `auth.e2e.spec.ts` lo dice explícito en su describe: "Auth (e2e, contra Postgres real)" — no está pensado para mockear la base, es intencional.

**Síntoma cuando Docker Desktop no está corriendo:** `PrismaClientInitializationError: Can't reach database server at localhost:5432`. Además, como `beforeAll` falla, el `afterAll` de `auth.e2e.spec.ts` también explota con `Cannot read properties of undefined (reading 'user')` porque `prisma` nunca se asignó — es un fallo en cascada del mismo bloqueo, no un segundo bug independiente.

**Por qué importa:** esto no es un bug de código, es un bloqueador de infraestructura local. Los tests unitarios de `src/**/*.spec.ts` (incluyendo `auth.service.spec.ts`, que mockea Prisma con jest) no se ven afectados y deben pasar igual.

**Cómo aplicar:** si Docker Desktop no está corriendo, reportar estos 2 suites e2e como bloqueados por infra (no como fallo de código), y confirmar que el resto de la suite (unitarios) pasa igual. No vale la pena hackear SQLite o mocks alternativos para estos dos archivos — el propio nombre/describe indica que están diseñados para correr contra Postgres real. Levantar Docker Desktop y correr `docker compose up -d` desde la raíz es el único camino real para habilitarlos. Relacionado: [[backend-env-setup-before-tests]].
