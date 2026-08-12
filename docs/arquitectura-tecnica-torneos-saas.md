# Arquitectura Técnica — SaaS de Torneos Multi-Organización

> Documento hermano de `modelo-datos-torneos-saas.md`. Ese archivo describe el modelo de datos (tablas, relaciones, algoritmos de brackets); este describe cómo se construye, despliega y escala el sistema.

## Índice
1. Filosofía de arquitectura: monolito modular primero
2. Backend
3. Frontend
4. Base de datos y estrategia multi-tenant
5. Infraestructura y escalabilidad
6. Observabilidad
7. Control de versiones y CI/CD
8. QA automatizado
9. Cuándo pasar a microservicios (señales concretas)
10. Notificaciones (pendiente de definir proveedor)

---

## 1. Filosofía de arquitectura: monolito modular primero

No se arranca con microservicios. Con equipo pequeño, la complejidad operativa (orquestación, comunicación entre servicios, tracing distribuido, transacciones distribuidas) frena más de lo que ayuda antes de tener tráfico real que la justifique.

**Fase 1 (MVP – primeros clientes):** monolito modular, organizado por dominios internos con límites claros: Torneos, Usuarios/Organizaciones, Equipos, Finanzas, Notificaciones. Los módulos no se hacen `JOIN`s directos entre sí saltándose su capa de servicio — se comunican por interfaces internas bien definidas, para que extraerlos después no implique reescribir lógica de negocio.

**Fase 2 (escala real):** se extraen como servicios independientes los módulos que más carga concurrente reciben — los candidatos naturales son **Live Scoring / actualización de brackets en tiempo real** y **Notificaciones** (fan-out masivo). Ver sección 9 para las señales concretas de cuándo dar este paso.

---

## 2. Backend

| Componente | Recomendación | Por qué |
|---|---|---|
| Lenguaje/Framework | **Node.js (NestJS)** | Estructura modular nativa (por dominios), buen ecosistema, TypeScript de punta a punta con el frontend |
| Alternativa a evaluar | **Go** | Si el motor de brackets/live scoring necesita más rendimiento puro que Node — se puede extraer solo ese módulo a Go en fase 2 sin reescribir el resto |
| API | **REST** (base) | CRUD estándar para la mayoría de endpoints |
| API alternativa | **GraphQL** (opcional) | Si el frontend necesita consultas anidadas complejas (torneo → categorías → equipos → jugadores → estadísticas) en una sola llamada |
| Tiempo real | **WebSockets (Socket.io o nativo de NestJS) + Redis Pub/Sub** | Marcadores en vivo, actualización de brackets, notificaciones push in-app |
| Colas/Jobs | **BullMQ (sobre Redis)** | Generación de brackets, recálculo de `standings`/`player_tournament_stats`/`user_profile_summary` (los resúmenes materializados que usamos en todo el modelo de datos), envío de notificaciones, exportación de reportes |
| Autenticación | **JWT + refresh tokens** (custom o Auth0/Clerk) | El JWT lleva solo `user_id` (identidad global) — cada request valida acceso y rol contra `memberships` según el `organization_id` indicado, tal como se definió en el modelo de datos |

---

## 3. Frontend

| Plataforma | Recomendación | Uso principal |
|---|---|---|
| Web — panel admin/organizador | **React + Next.js** | Dashboards de organización, configuración de torneos, gestión financiera |
| App móvil — jugadores/coaches/padres | **React Native** o **Flutter** | Una sola base de código para iOS/Android. Aquí vive el consumo pesado en día de torneo: bracket en vivo, resultados, próximos partidos, carnet digital |
| Estado y datos en tiempo real | **TanStack Query (React Query) + suscripciones WebSocket** | Sincroniza cache local con actualizaciones en vivo del backend |

---

## 4. Base de datos y estrategia multi-tenant

| Componente | Recomendación |
|---|---|
| Motor principal | **PostgreSQL** |
| Estrategia multi-tenant | **Shared database, shared schema**, con `organization_id` en cada tabla relevante y **Row-Level Security (RLS)** nativo de Postgres para aislar datos a nivel de motor, no solo en código de aplicación |
| Cache | **Redis** — brackets activos, leaderboards en vivo, sesiones, rate limiting |
| Búsqueda | **Elasticsearch / OpenSearch** (cuando el volumen lo justifique) — búsqueda de jugadores/equipos/torneos con filtros complejos |
| Histórico/series de tiempo | **TimescaleDB** (extensión de Postgres, evaluar en fase 2) — si el volumen de `match_events` y estadísticas históricas crece mucho |

**Por qué no "una base de datos por cliente":** con potencialmente cientos de escuelas/clubes pequeños, operar una BD por tenant es mucho más caro de mantener. El modelo compartido con RLS da aislamiento real sin ese costo operativo. Si algún cliente enterprise exige aislamiento total por compliance, se migra puntualmente sin cambiar el modelo de datos.

---

## 5. Infraestructura y escalabilidad

| Componente | Recomendación |
|---|---|
| Cloud | **AWS** o **GCP** |
| Contenedores (inicio) | **AWS ECS Fargate** (o equivalente GCP) — mucho más simple de operar que Kubernetes cuando el equipo es pequeño |
| Contenedores (escala) | **Kubernetes (EKS/GKE)** — cuando el tráfico y el número de servicios lo justifiquen |
| CDN | **CloudFront** o **Cloudflare** — assets estáticos y absorción de picos en día de torneo (todos revisando el bracket a la vez) |
| Autoescalado | Horizontal en los servicios de lectura (consulta de brackets/resultados), que es donde se concentran los picos más fuertes |
| Multi-región | No es necesaria al inicio — pero el modelo de datos ya usa UUIDs en vez de IDs autoincrementales globales, para no bloquear esa opción en el futuro |

---

## 6. Observabilidad

Crítico en un SaaS multi-tenant: se necesita poder filtrar métricas y logs **por organización**, para diagnosticar si un problema es del sistema completo o de un solo cliente con un torneo grande en curso.

| Componente | Recomendación |
|---|---|
| Logs | **Datadog** o stack **ELK/OpenSearch** |
| Métricas/APM | **Datadog** o **Grafana + Prometheus** |
| Errores | **Sentry** |

---

## 7. Control de versiones y CI/CD

- **GitHub** para versionamiento — confirmado como buena elección para este tamaño de proyecto.
- **Estructura:** monorepo (backend + web, al menos) mientras el equipo es pequeño — evita fricción de sincronizar versiones de API entre repos separados. Se separa cuando se extraigan microservicios reales.
- **Branching:** `main` + `develop` + feature branches (ej. `feature/torneos-brackets`). No se necesita GitFlow completo con equipo reducido.
- **Protección de rama en `main`:** PR obligatorio + al menos 1 review antes de mergear.
- **GitHub Actions:** corre lint → tests → build en cada PR; bloquea el merge si algo falla.
- **Migraciones de base de datos versionadas** (Prisma Migrate, TypeORM migrations, o Flyway) desde el día 1 — cada feature branch que cambia el modelo de datos trae su migración correspondiente, nunca se corre el riesgo de romper producción con un `ALTER` manual.

---

## 8. QA automatizado

| Tipo de prueba | Herramienta | Qué cubre |
|---|---|---|
| Unit tests | **Jest** | Lógica de negocio aislada — motor de validación de requisitos, algoritmos de brackets (sección 17 del modelo de datos) |
| Integration tests | **Jest + Supertest** | Endpoints completos contra una DB de test (Postgres en Docker) |
| E2E web | **Playwright** | Flujos completos — ej. "coach crea equipo → inscribe a torneo → valida requisitos" |
| E2E móvil | **Detox** (si se usa React Native) | Mismo concepto en la app móvil |
| Load/stress testing | **k6** o **Artillery** | Simula picos de tráfico en "día de torneo" — cuántas conexiones WebSocket simultáneas aguanta el live scoring |
| Linting/estático | **ESLint + TypeScript strict mode** | Atrapa errores antes de llegar a pruebas |

**Prioridad para el MVP:** Jest (unit + integration) + GitHub Actions primero — da el 80% del valor con el 20% del esfuerzo. Playwright y k6 se agregan cuando ya haya flujos estables que proteger de regresiones, y k6 específicamente antes del primer torneo grande en producción.

**Coverage mínimo recomendado:** 70-80% en los módulos críticos — motor de brackets, validación de requisitos, cálculo financiero — porque son los que más dolor generan si fallan silenciosamente.

---

## 9. Cuándo pasar a microservicios (señales concretas, no una fecha)

**Señales técnicas:**
- Contención de base de datos: el módulo de live scoring en un torneo grande empieza a ralentizar consultas de otros módulos (ej. alguien viendo su perfil se demora porque la DB está saturada por el bracket en vivo).
- Necesidad de escalar partes distintas a ritmos distintos: en día de torneo se necesita 10x más capacidad solo para "ver resultados en vivo", mientras el resto de la app sigue con tráfico normal.
- Tiempo de build/deploy del monolito se vuelve doloroso con deploys frecuentes.

**Señales organizacionales:**
- Tamaño de equipo: con 2-5 devs, el monolito modular es más productivo. Microservicios brillan cuando hay múltiples equipos que necesitan desplegar independientemente sin pisarse.
- Un módulo se beneficia de una tecnología distinta al resto (ej. Go para el motor de brackets por rendimiento).

**Recomendación concreta:** cuando haya ~20-50 organizaciones activas con torneos simultáneos grandes, medir la contención específicamente en Live Scoring y Notificaciones — son los candidatos naturales a extraerse primero, y probablemente el único cambio estructural real que se necesite por un buen tiempo.

---

## 10. Notificaciones (pendiente de definir proveedor)

Canal elegido: **WhatsApp**. Queda pendiente comparar proveedores (API oficial de WhatsApp Business/Meta directa vs. intermediarios como Twilio, 360dialog, Gupshup) por costo por mensaje y facilidad de integración en Latam — se investiga en una sesión aparte cuando se aborde este punto.
