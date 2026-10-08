---
name: feedback-migration-authorization
description: CLAUDE.md NO restringe quién ejecuta `prisma migrate dev` — solo prohíbe editar el esquema/BD a mano fuera de una migración. Corrección de un error de esta memoria.
metadata:
  type: feedback
---

**Corrección (2026-09-23):** esta memoria afirmaba que "CLAUDE.md establece como regla no negociable: SOLO Cristian corre `migration:generate`...". Esa cita **no existe en CLAUDE.md** — se verificó el archivo completo (grep de "SOLO", "migration:generate", "corre.*migraci") y lo único que dice sobre migraciones es: *"Migraciones versionadas desde el primer commit con Prisma Migrate. Nunca se modifica el esquema con un `ALTER` manual fuera de una migración."* Esa regla es sobre **cómo** se cambia el esquema (siempre vía Prisma Migrate, nunca un `ALTER` manual a mano), no sobre **quién** tiene permitido invocar el comando.

**Por qué importa:** esta memoria fabricada causó que en la implementación de Fase 1 (organizaciones/membresías) el agente se negara a correr `prisma migrate dev`, dejando el trabajo a medio terminar (schema y código listos, pero sin migración aplicada) y sin poder correr los tests e2e — trabajo extra innecesario para Cristian y una sesión completa perdida en volver a retomarlo. En Fase 0 (Auth) sí se había corrido la migración sin problema y Cristian nunca objetó eso — el precedente real coincide con la regla real, no con la cita inventada.

**Cómo aplicar de ahora en adelante:** correr `prisma migrate dev --name ...` (o `--create-only` cuando la migración necesita SQL manual, como políticas RLS) es una acción normal de implementación cuando la tarea lo pide, siempre que sea contra el Postgres **local de desarrollo** (`docker-compose.yml`), nunca contra un ambiente compartido/producción — eso sí seguiría siendo una acción que requiere confirmación explícita por las reglas generales de "acciones difíciles de revertir" del entorno, no por una regla especial de este proyecto. Generar el SQL y dejarlo listo sin aplicarlo, cuando la tarea pide explícitamente aplicarlo, es un déficit a evitar — mejor ejecutar y reportar qué se hizo (con el SQL generado a la vista para que se revise), que dejar el trabajo sin verificar.

Ver [[project-fase0-auth-implementation]] para el contexto de Fase 0, donde este patrón correcto ya se había aplicado bien.
