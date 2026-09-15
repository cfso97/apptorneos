---
name: backend-test-conventions
description: Detalles no obvios del setup de Jest/Supertest en apps/backend que causan fallos silenciosos si no se respetan
metadata:
  type: project
---

## Naming de archivos de test
`apps/backend/jest.config.js` tiene `testRegex: '.*\\.spec\\.ts$'` con `rootDir: '.'` (escanea `src/` y `test/`). Esto requiere que el nombre termine literalmente en `.spec.ts` (con punto antes de "spec").

- `app.e2e-spec.ts` (guion antes de "spec") **NO matchea** el regex y Jest lo ignora en silencio — no aparece ni como fallo, simplemente no corre. Es fácil no darse cuenta.
- Nombre correcto para integración: `app.e2e.spec.ts` (punto, no guion).

**Por qué importa:** el test se escribe, se cree que está cubierto, pero nunca corre. Siempre verificar en la salida de `pnpm test` que el archivo nuevo aparece listado en "Test Suites".

## Import de supertest
Con `esModuleInterop: true` en `tsconfig.json`, `import * as request from 'supertest'` compila pero falla en runtime con `TS2349: This expression is not callable` (namespace import no es invocable). Usar import default:

```ts
import request from 'supertest';
```

**Cómo aplicar:** cualquier test de integración HTTP en `apps/backend/test/` que use supertest debe usar este import default, no el namespace-style.

## Patrón de integración HTTP establecido (Fase 0)
Para tests de integración en `apps/backend/test/`, bootstrapear el módulo real (ej. `AppModule`, luego cada módulo de negocio) con `Test.createTestingModule({ imports: [...] }).compile()` → `createNestApplication()` → `app.init()`, y pegarle con `supertest(app.getHttpServer())`. Esto valida routing + wiring de módulos de punta a punta, algo que un test unitario de controller (llamando al método directo) no cubre. Ver `apps/backend/test/app.e2e.spec.ts` como referencia del patrón.

Relacionado: [[health-check-test-coverage]]
