# Primeros Pasos — Construcción con Claude Code en VS Code

> Esta guía asume que no vas a escribir código directamente. Tu trabajo es dar instrucciones claras a Claude Code, revisar lo que propone antes de aceptarlo, y avanzar fase por fase usando `plan-construccion-mvp.md` como mapa.

## 0. Cuentas que necesitas crear antes de empezar

| Cuenta | Para qué | Costo inicial |
|---|---|---|
| **GitHub** | Guardar el código (versionamiento) | Gratis |
| **Suscripción a Claude** (Pro, Max, Team o similar) | Que Claude Code funcione dentro de VS Code | De pago — necesaria para usar la extensión |
| **Railway** o **Supabase** | Base de datos Postgres + Redis del MVP | Gratis para empezar |
| **Vercel** | Alojar el frontend web | Gratis para empezar |

No necesitas crear la cuenta de Railway/Vercel ahora mismo — se hace cuando lleguemos al paso de despliegue (más adelante en esta guía).

---

## 1. Instalar las herramientas base

1. Instala **Visual Studio Code** (si no lo tienes): [code.visualstudio.com](https://code.visualstudio.com)
2. Instala **Node.js** (versión 18 o superior): [nodejs.org](https://nodejs.org) — descarga la versión "LTS" (más estable)
3. Instala **Git**: [git-scm.com](https://git-scm.com)

## 2. Instalar la extensión de Claude Code

1. Abre VS Code
2. Presiona `Ctrl+Shift+X` (Windows/Linux) o `Cmd+Shift+X` (Mac) para abrir el panel de extensiones
3. Busca **"Claude Code"** — la extensión oficial es de **Anthropic**
4. Haz clic en **Install**
5. Al primer uso, te pedirá iniciar sesión — se abre tu navegador para autenticarte con tu cuenta de Claude (la misma suscripción que ya tienes)

## 3. Crear el repositorio en GitHub

1. Entra a [github.com](https://github.com) y crea un repositorio nuevo (ej. `torneos-saas`)
2. Márcalo como **privado** (mientras no quieran que el código sea público)
3. GitHub te da la opción de agregar un `.gitignore` — elige la plantilla de **Node**
4. Clona el repositorio a tu computador: en VS Code, abre la paleta de comandos (`Ctrl+Shift+P` / `Cmd+Shift+P`), escribe **"Git: Clone"**, pega la URL de tu repositorio de GitHub, y elige dónde guardarlo en tu computador

## 4. Preparar el proyecto para que Claude Code tenga todo el contexto

Este es el paso más importante — es donde le "entregas" toda la planificación que hicimos.

1. Dentro de la carpeta del repositorio, crea una carpeta llamada `docs/`
2. Copia ahí los 5 documentos que ya generamos:
   - `modelo-datos-torneos-saas.md`
   - `arquitectura-tecnica-torneos-saas.md`
   - `plan-construccion-mvp.md`
   - `api-referencia-rapida.md`
   - `api-openapi-torneos.yaml`
3. Crea un archivo en la raíz del proyecto llamado **`CLAUDE.md`** — este es un archivo especial que Claude Code lee automáticamente al abrir el proyecto, como instrucciones permanentes. Ahí le explicas (en texto normal, no código):
   - Qué es el proyecto (un SaaS de torneos multi-organización)
   - Que la documentación completa está en la carpeta `docs/` y debe consultarla antes de construir cualquier módulo
   - El stack elegido (NestJS + PostgreSQL + Next.js + React Native, como está en `arquitectura-tecnica-torneos-saas.md`)
   - Que debe seguir el orden de fases de `plan-construccion-mvp.md`
   - Que use TypeScript estricto, siga la convención de respuesta `{ data, error, meta }` de la API, y que declare el permiso requerido en cada endpoint según `api-referencia-rapida.md`

**Por qué esto funciona tan bien:** Claude Code no empieza "a ciegas" — lee estos documentos cada vez que abres una conversación nueva en el proyecto, así que no tienes que reexplicar el modelo de datos ni la arquitectura cada vez que le pidas algo.

## 5. Abrir el proyecto y la primera conversación

1. En VS Code, abre la carpeta del proyecto (`File > Open Folder`)
2. Abre cualquier archivo (por ejemplo, el `CLAUDE.md` que acabas de crear) — verás aparecer el ícono de Claude Code (una chispa naranja ✱) en la esquina superior del editor
3. Haz clic en el ícono para abrir el panel de Claude Code
4. Escribe tu primera instrucción, algo como:

> "Lee la documentación en /docs. Vamos a construir este proyecto siguiendo plan-construccion-mvp.md fase por fase. Empecemos por la Fase 0: configura el proyecto backend con NestJS, estructura de carpetas por dominio, y deja preparado el setup para conectar Postgres y Redis según arquitectura-tecnica-torneos-saas.md. No implementes lógica de negocio todavía, solo el esqueleto del proyecto."

5. Claude Code te va a mostrar un **plan** de lo que va a hacer antes de tocar archivos (esto se llama "Plan Mode") — revísalo, y si estás de acuerdo, apruébalo
6. Vas a ver los cambios propuestos como un **diff** (texto en verde/rojo mostrando qué se agrega o cambia) — revísalo y acepta

## 6. Cómo avanzar fase por fase

La clave es **una fase a la vez**, verificando que funcione antes de pasar a la siguiente — así nunca acumulas errores de una fase mal hecha sobre la que construyes la siguiente.

**Patrón de instrucción por fase** (ejemplo para la Fase 1):

> "Ya terminamos la Fase 0. Ahora implementa la Fase 1 según plan-construccion-mvp.md: migraciones de organizations, memberships, user_guardians y audit_log (usa el modelo exacto de modelo-datos-torneos-saas.md sección 2 y 3), el servicio de generación segura del código de jugador secuencial, y los endpoints de esa fase según api-openapi-torneos.yaml. Muéstrame el plan antes de ejecutar."

**Después de cada fase, pídele que te ayude a probarlo**, aunque no sepas programar:

> "Ahora ayúdame a probar que esto funciona. Dime exactamente qué comandos debo escribir en la terminal, paso a paso, para levantar el proyecto localmente y probar el endpoint de crear organización con una herramienta como Postman o el navegador."

Claude Code te va a dar los comandos exactos y te puede ir guiando en tiempo real si algo falla.

## 7. Conectar la base de datos (cuando termines Fase 0/1)

1. Crea cuenta en [Railway](https://railway.app) (recomendado para empezar, según `arquitectura-tecnica-torneos-saas.md`)
2. Crea un nuevo proyecto → agrega un servicio de **PostgreSQL** y uno de **Redis**
3. Railway te da las credenciales de conexión (host, usuario, contraseña) — pídele a Claude Code:

> "Necesito conectar el backend a la base de datos de Railway. Dime exactamente qué variables de entorno debo configurar y dónde pegar las credenciales que me dio Railway, sin que yo tenga que tocar código."

## 8. Desplegar el frontend (cuando tengan pantallas listas)

1. Crea cuenta en [Vercel](https://vercel.com) y conéctala a tu cuenta de GitHub
2. Importa el repositorio — Vercel detecta automáticamente que es un proyecto Next.js
3. Cada vez que hagan `git push` a la rama principal, Vercel despliega solo

## 9. Flujo de trabajo diario recomendado

1. Abre VS Code → abre el panel de Claude Code
2. Dale contexto de qué fase están construyendo (puede ser tan simple como "seguimos con X" si es la misma conversación, o repetir el patrón del paso 6 si es una conversación nueva)
3. Revisa el plan antes de aprobar
4. Revisa el diff antes de aceptar cambios
5. Pide que te explique cómo probar lo que se construyó
6. Cuando funcione, pide que te ayude a hacer commit y push a GitHub:

> "Ayúdame a guardar este avance en GitHub. Dime los comandos exactos para hacer commit de estos cambios con un mensaje descriptivo y subirlos."

## 10. Cuando algo falla o no entiendes un error

No te quedes atascado — dale el error completo a Claude Code (cópialo y pégalo tal cual) y pídele:

> "Este comando me dio este error: [pega el error completo]. Explícame en palabras simples qué significa y qué debo hacer, paso a paso."

Claude Code puede leer los mensajes de error de la terminal directamente si tienes la terminal integrada de VS Code abierta — muchas veces ni necesitas copiar/pegar, solo pedirle "revisa por qué falló el último comando".

---

## Resumen del orden completo

1. Instalar VS Code + Node + Git + extensión Claude Code
2. Crear repo en GitHub y clonarlo
3. Copiar los 5 documentos a `docs/` + crear `CLAUDE.md`
4. Primera conversación: Fase 0 (setup base)
5. Fase 1 → 7, una por una, revisando plan → diff → prueba → commit en cada una
6. Conectar Railway (DB) apenas termine Fase 0/1
7. Conectar Vercel (frontend) apenas haya pantallas que mostrar

Con esto tienes la ruta completa desde "carpeta vacía" hasta MVP funcionando, siempre supervisando y aprobando lo que Claude Code propone, sin necesidad de escribir código tú mismo.
