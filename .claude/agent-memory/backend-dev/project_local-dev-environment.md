---
name: project-local-dev-environment
description: Particularidades del entorno local de Cristian (Windows) para correr el backend — pnpm, Docker Desktop, eslint/tsconfig de test
metadata:
  type: project
---

Notas del entorno de desarrollo de Cristian (Windows 11, Git Bash como shell de las tools):

- `pnpm` no está en el PATH de Git Bash directamente, pero sí vía `corepack pnpm <comando>` (corepack 0.35.0 ya instalado). Usar `corepack pnpm install`, `corepack pnpm exec <bin>`, etc.
- Docker Desktop no arranca solo; el daemon (`docker info`) tarda en responder incluso después de lanzar el proceso. Se inicia con `Start-Process 'C:\Users\cfso9\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe'` vía PowerShell (la ruta en `C:\Program Files\Docker\...` no existe en esta máquina). Hay que esperar unos segundos/reintentar `docker info` hasta que responda antes de correr `docker compose up -d`.
- El proyecto ya trae `docker-compose.yml` en la raíz con Postgres (`localhost:5432`, user/password/torneos_saas) y Redis (`localhost:6379`) — normalmente ya están corriendo (contenedores persistentes), conviene chequear con `docker compose up -d` (es idempotente) antes de asumir que hay que crearlos.
- **Bug preexistente corregido en Fase 0:** `apps/backend/.eslintrc.json` apuntaba `parserOptions.project` a `tsconfig.json`, el cual excluye la carpeta `test/` — esto rompía `pnpm lint` en cualquier PR que tocara `test/**/*.ts` (ya rompía desde el commit inicial del monorepo, con `test/app.e2e.spec.ts`). Se arregló agregando `apps/backend/tsconfig.eslint.json` (incluye `src` y `test`, sin excluir `test`) y apuntando `.eslintrc.json` ahí. Si en el futuro el lint vuelve a fallar con "file was not found in any of the provided project(s)" sobre un archivo de `test/`, es la misma causa.
