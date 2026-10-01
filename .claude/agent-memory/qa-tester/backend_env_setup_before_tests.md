---
name: backend-env-setup-before-tests
description: Pasos de entorno a verificar antes de correr `pnpm test` en apps/backend, para no confundir un entorno desactualizado con un bug de código
metadata:
  type: project
---

Cuando se corre `pnpm test` en `apps/backend/` después de cambiar de rama (o en una sesión nueva donde no se corrió `pnpm install` recientemente), pueden aparecer errores que parecen bugs de código pero son solo estado de entorno desactualizado:

1. **`Cannot find module '@nestjs/jwt'` / `'@nestjs/passport'` / `'bcryptjs'` / `'passport-jwt'`** (TS2307) en archivos que sí importan esos paquetes correctamente — significa que `node_modules` no tiene esos paquetes instalados todavía, aunque estén en `package.json` y en `pnpm-lock.yaml`. Se resuelve con `pnpm install` desde la raíz del repo (no hace falta Docker para esto).

2. **`Property 'user' does not exist on type 'PrismaService'`** (TS2339) — el Prisma Client no fue generado desde el `schema.prisma` actual. Se resuelve con `pnpm prisma:generate` dentro de `apps/backend/` (lee el schema local, **no** requiere conexión real a Postgres).

**Por qué importa:** ambos errores son de compilación TS y tiran toda la test suite como "failed to run" (ni siquiera llegan a ejecutar un test), lo que puede leerse como "está todo roto" cuando en realidad es un `pnpm install` + `prisma generate` pendiente. Diferenciar esto de un fallo real de e2e por falta de Postgres (ver [[backend-docker-e2e-bloqueo]]) es clave para no reportar falsos bugs de código.

**Cómo aplicar:** antes de diagnosticar fallos de test como bugs de código, correr en este orden:
```
pnpm install            # desde la raíz del repo
pnpm prisma:generate    # desde apps/backend/
pnpm test               # desde apps/backend/
```
Si después de esto siguen fallando los mismos suites, ahí sí es código. Relacionado: [[backend-test-conventions]].
