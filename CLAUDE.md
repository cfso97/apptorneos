# CLAUDE.md

Este archivo da contexto permanente a Claude Code sobre este proyecto. Léelo completo antes de proponer cualquier cambio.

## Qué es este proyecto

Un SaaS de torneos deportivos multi-organización. Escuelas, clubes y ligas ("organizaciones") gestionan torneos, equipos y jugadores. Un mismo jugador o equipo puede participar en torneos de múltiples organizaciones distintas con un solo perfil — la identidad del usuario es global, la pertenencia a una organización es una relación (`membership`), no una propiedad fija del usuario.

## Documentación de referencia (léela antes de construir cualquier módulo)

Toda la documentación vive en `/docs`. Consúltala siempre antes de tomar decisiones de diseño — no improvises estructura de datos ni convenciones que ya están definidas ahí:

- `docs/modelo-datos-torneos-saas.md` — modelo de datos completo: tablas, relaciones, patrones de diseño, algoritmos de generación de brackets. **Fuente de verdad del esquema de base de datos.**
- `docs/arquitectura-tecnica-torneos-saas.md` — stack tecnológico, infraestructura, estrategia de despliegue, cuándo migrar a microservicios.
- `docs/plan-construccion-mvp.md` — orden de construcción por fases (0 a 7), con las tareas divididas por carril (Datos/Infra, Backend, Frontend Web, Frontend Móvil, QA). **Sigue este orden de fases, no saltes pasos.**
- `docs/api-referencia-rapida.md` — tabla de todos los endpoints con el permiso requerido de cada uno.
- `docs/api-openapi-torneos.yaml` — especificación OpenAPI de diseño inicial. Válida hasta que existan controladores reales; a partir de ahí, la fuente de verdad de la API es el Swagger generado automáticamente por `@nestjs/swagger` desde el código, no este archivo.

## Stack tecnológico

**Backend:** Node.js con NestJS, TypeScript estricto. Estructura modular por dominio (no por capa técnica) — cada módulo de negocio (Torneos, Equipos, Organizaciones, etc.) es una carpeta autocontenida. API REST como base (GraphQL solo si se necesita en el futuro para consultas anidadas complejas).

**Base de datos:**
- PostgreSQL con Row-Level Security (RLS) para aislamiento multi-tenant por `organization_id` — shared database, shared schema, nunca una BD por cliente.
- Redis para cache (brackets activos, sesiones, rate limiting) y como backend de colas.
- BullMQ (sobre Redis) para jobs async: recálculo de resúmenes materializados (`standings`, `user_profile_summary`, `tournament_finance_summary`), generación de brackets, notificaciones, propagación de resultados.
- Migraciones versionadas desde el primer commit con **Prisma Migrate**. Nunca se modifica el esquema con un `ALTER` manual fuera de una migración.

**Autenticación:** JWT + refresh tokens. El JWT lleva solo `user_id` (identidad global) — cada request valida acceso y rol contra `memberships` según el `organization_id` indicado.

**Tiempo real:** WebSockets (Socket.io o el nativo de NestJS) + Redis Pub/Sub, para marcadores en vivo y actualización de brackets.

**Frontend web (panel organizador):** Next.js + Tailwind, desplegado en **Vercel** (deploy automático desde GitHub en cada push a `main`).

**Frontend móvil (jugador/coach/padre):** React Native, una sola base de código para iOS/Android.

**Infraestructura de arranque (MVP):**
- Base de datos y Redis: **Railway** (o Supabase como alternativa) — Postgres administrado, sin gestión manual de servidores.
- Backend: **Railway** o **Render** al inicio → migración a **AWS ECS Fargate** cuando el tráfico lo justifique.
- Región preferida: la más cercana a Colombia disponible en el proveedor (ej. `sa-east-1` de AWS en São Paulo), por latencia.
- Cloud de destino a escala: AWS o GCP (evaluar cuando se migre desde Railway/Render).

**Repositorio y control de versiones:**
- **Monorepo en GitHub**, gestionado con **pnpm workspaces + Turborepo** (cachea builds, corre solo las tareas de lo que cambió) — backend, frontend web y (cuando corresponda) app móvil en un solo repositorio, mientras el equipo sea pequeño.
- Estructura de carpetas: ver sección "Estructura del proyecto" más abajo.
- Branching: `main` + `develop` + feature branches. Protección en `main`: PR obligatorio + al menos 1 review.
  - Nadie commitea directo en `main` ni en `develop`. Cada tarea vive en su propia rama creada desde `develop` (ej. `feature/auth-recuperar-password`, `feature/vista-login`) y se integra vía PR hacia `develop`.
  - `main` solo se actualiza desde `develop` cuando el equipo acuerda que está estable — nunca al revés.
  - Equipo actual: Alejandro lleva diseño (Figma) y frontend web (`apps/web`); Cristian lleva backend (`apps/backend`). El contrato de la API (`docs/api-referencia-rapida.md` y, cuando exista, `docs/api-openapi-torneos.yaml`) es lo que permite que ambos avancen en paralelo sin bloquearse.
- **GitHub Actions** para CI/CD: lint → tests → build en cada PR, bloquea merge si falla. Turborepo permite que el pipeline solo reconstruya/pruebe los paquetes afectados por el cambio, no todo el monorepo.

**Observabilidad (agregar cuando haya usuarios reales, no bloquea el MVP):** Sentry para errores, Datadog o Grafana+Prometheus para métricas/APM — con capacidad de filtrar por `organization_id` para diagnosticar si un problema es de un solo cliente o del sistema completo.

**Filosofía de arquitectura:** monolito modular, no microservicios, mientras el equipo sea pequeño (2-5 devs) y no haya señales concretas de contención (ver `docs/arquitectura-tecnica-torneos-saas.md` sección 9 para las señales exactas de cuándo migrar). Los candidatos naturales a extraerse primero en el futuro son Live Scoring y Notificaciones.

## Estructura del proyecto (carpetas)

Esta es la estructura de referencia. **No la reorganices sin actualizar esta sección en el mismo cambio** — es lo que evita que el proyecto se vuelva inconsistente a medida que se agregan módulos.

```
torneos-saas/                          ← raíz del repositorio
├── CLAUDE.md                          ← este archivo
├── docs/                              ← toda la documentación de diseño
│   ├── modelo-datos-torneos-saas.md
│   ├── arquitectura-tecnica-torneos-saas.md
│   ├── plan-construccion-mvp.md
│   ├── api-referencia-rapida.md
│   └── api-openapi-torneos.yaml
│
├── apps/
│   ├── backend/                       ← API NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma          ← ÚNICO archivo de esquema, fuente de verdad de la BD
│   │   │   ├── migrations/            ← generadas por Prisma, nunca se editan a mano
│   │   │   └── seed.ts                ← carga sports, permissions, plans (catálogos iniciales)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/                ← código transversal, no de negocio
│   │   │   │   ├── prisma/            ← PrismaService/PrismaModule (@Global()), única conexión a la BD
│   │   │   │   ├── guards/            ← RequierePermisoGuard, JwtAuthGuard
│   │   │   │   ├── interceptors/      ← envelope de respuesta {data,meta}, audit log
│   │   │   │   ├── decorators/        ← @RequierePermiso(), @Public(), @CurrentUser()
│   │   │   │   └── filters/           ← manejo centralizado de errores
│   │   │   └── modules/               ← un módulo NestJS por dominio de negocio
│   │   │       ├── auth/
│   │   │       ├── organizations/
│   │   │       ├── memberships/
│   │   │       ├── guardians/
│   │   │       ├── teams/
│   │   │       ├── tournaments/
│   │   │       │   ├── categories/
│   │   │       │   ├── phases/
│   │   │       │   ├── fields/
│   │   │       │   └── requirements/
│   │   │       ├── registrations/
│   │   │       ├── matches/
│   │   │       │   ├── brackets/      ← los algoritmos de generación (sección 20 del modelo de datos)
│   │   │       │   ├── disputes/
│   │   │       │   └── standings/
│   │   │       ├── stats/
│   │   │       ├── sanctions/
│   │   │       ├── credentials/       ← carnet QR
│   │   │       ├── finance/
│   │   │       └── audit/
│   │   ├── test/                      ← integration tests (Jest + Supertest)
│   │   ├── .env                       ← NO se commitea (ver .gitignore)
│   │   ├── .env.example               ← SÍ se commitea, con las variables sin valores reales
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   └── tsconfig.json
│   │
│   ├── web/                           ← panel del organizador (Next.js)
│   │   ├── app/                       ← rutas (App Router)
│   │   │   ├── (auth)/
│   │   │   ├── dashboard/
│   │   │   ├── tournaments/
│   │   │   └── teams/
│   │   ├── components/
│   │   ├── lib/                       ← cliente de API, hooks de TanStack Query
│   │   ├── public/
│   │   ├── .env.local                 ← NO se commitea
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   └── mobile/                        ← app jugador/coach/padre (React Native) — se crea al llegar a esa fase, no antes
│       ├── src/
│       │   ├── screens/
│       │   ├── navigation/
│       │   └── components/
│       ├── package.json
│       └── app.json
│
├── packages/
│   └── shared/                        ← tipos y constantes compartidos entre backend y frontend
│       ├── src/
│       │   ├── types/                 ← interfaces TS que reflejan los modelos de Prisma (User, Tournament, Match...)
│       │   ├── constants/             ← códigos de permisos, códigos de requirement_types
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── .github/
│   └── workflows/
│       └── ci.yml                     ← lint + test + build en cada PR
│
├── .gitignore
├── .nvmrc                             ← fija la versión de Node del proyecto, evita "en mi máquina sí funciona"
├── package.json                       ← raíz, define los workspaces
├── pnpm-workspace.yaml
└── turbo.json
```

**Reglas para que esto no se rompa:**

1. **Un solo `schema.prisma`** — todo el modelo de datos vive en ese único archivo (`apps/backend/prisma/schema.prisma`), reflejando exactamente lo documentado en `modelo-datos-torneos-saas.md`. Nunca se crean esquemas Prisma paralelos.
2. **`.env` nunca se commitea** — cada app (`backend`, `web`) tiene su `.env` real ignorado por Git, y un `.env.example` sí commiteado con las variables necesarias pero sin valores sensibles.
3. **`node_modules/`, `dist/`, `.next/`, `.turbo/`** van en `.gitignore` — nunca se commitea nada generado por un build.
4. **El lockfile (`pnpm-lock.yaml`) sí se commitea** — garantiza que todos (incluido Claude Code en cada sesión) instalen exactamente las mismas versiones de dependencias.
5. **`packages/shared` no depende de `apps/backend` ni de `apps/web`** — la dependencia va en un solo sentido (las apps importan de `shared`, nunca al revés), para evitar dependencias circulares.
6. **`apps/mobile` se crea recién al llegar a la fase del plan que la necesita** — no se scaffoldea vacía desde el día 1, para no acumular una carpeta sin mantenimiento.

## Convenciones de código

- **Formato de respuesta de API:** siempre `{ data, meta }` en éxito, `{ error: { code, message } }` en fallo. No uses otro formato en ningún endpoint nuevo.
- **Permisos:** cada endpoint que no sea público debe declarar qué permiso de `docs/api-referencia-rapida.md` requiere, usando el guard centralizado (`@RequierePermiso('codigo_permiso')`). Nunca uses `if (rol === 'admin')` disperso en controladores o servicios.
- **Multi-tenant:** cualquier query que toque datos de una organización debe pasar por RLS con `organization_id` — no se filtra manualmente en cada servicio como parche.
- **Resúmenes materializados:** para datos que se consultan mucho pero se calculan de muchas filas (`standings`, `user_profile_summary`, `tournament_finance_summary`, etc.), usa el patrón ya establecido: se recalculan async vía job de cola tras el evento que los afecta, nunca con `JOIN` pesado en cada lectura.
- **Polimorfismo participante:** cuando algo puede ser un `user` o un `team` (inscripciones, partidos, transacciones), usa el par `participante_tipo` + `participante_id`, tal como está definido en el modelo de datos — no dupliques estructura con tablas separadas para cada caso.

## Orden de construcción

Sigue estrictamente las fases de `docs/plan-construccion-mvp.md`:

0. Fundacional (setup, auth, catálogos semilla)
1. Identidad y organizaciones
2. Equipos
3. Estructura de torneo (sin partidos aún)
4. Inscripciones
5. Partidos y brackets (la fase más compleja algorítmicamente)
6. Estadísticas, sanciones, carnet
7. Finanzas y hoja de vida

No implementes lógica de una fase posterior antes de que la anterior esté completa y probada, salvo que se te pida explícitamente.

## Regla de mantenimiento de documentación

**Si al implementar algo te desvías de lo documentado en `/docs`** (agregas un campo no previsto, cambias un endpoint, tomas una decisión distinta a la anotada), **actualiza el documento correspondiente en el mismo cambio** — no lo dejes pendiente. La documentación en `/docs` debe reflejar siempre el estado real del sistema, no solo el diseño original.

## Control de versiones — commits

Los mensajes de commit y de Pull Request **no deben incluir líneas de atribución a Claude** (ni "Co-Authored-By: Claude", ni "Generated with Claude Code", ni similares). Los commits se firman solo con el autor real (el usuario de git configurado).

## Cómo trabajar conmigo (el usuario del proyecto)

No tengo experiencia profunda escribiendo código. Antes de hacer cambios:
1. Explica el plan en lenguaje simple antes de ejecutarlo (usa Plan Mode).
2. Después de cada cambio, dime exactamente qué comandos correr para probarlo y qué debería ver si funciona bien.
3. Si algo falla, explícame el error en palabras simples antes de proponer la solución.
4. Avanza fase por fase — no me propongas adelantarte a fases futuras del plan sin que yo lo pida.

## QA

- Tests unitarios e integración con Jest desde la Fase 0.
- Cobertura mínima recomendada 70-80% en: motor de brackets, validación de requisitos de elegibilidad, cálculo financiero — son los módulos más sensibles a errores silenciosos.
- GitHub Actions corre lint + tests en cada Pull Request antes de permitir merge a `main`.
