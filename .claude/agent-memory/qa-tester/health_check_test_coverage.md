---
name: health-check-test-coverage
description: Qué se considera cobertura suficiente para un endpoint de health check en Fase 0, sin inventar cobertura de negocio inexistente
metadata:
  type: feedback
---

Para el smoke test de `GET /health` (Fase 0, antes de que existan módulos de negocio), la cobertura razonable es:

1. Envelope `{ data, meta }` respetado (regla obligatoria de CLAUDE.md para toda la API).
2. `data.status === 'ok'`.
3. `data.timestamp` es un string ISO 8601 válido y cercano al momento de la llamada (no solo `expect.any(String)` — un timestamp roto o hardcodeado también pasaría ese check).
4. Al menos un test de integración HTTP real (Supertest + bootstrap del módulo completo) además del test unitario del controller — el unitario llama al método directo y no prueba que el routing/decorators de Nest realmente estén conectados.

**Por qué:** CLAUDE.md pide cobertura alta en brackets/elegibilidad/finanzas, pero para un endpoint trivial como health check alcanza con validar contrato de respuesta + que el pipeline arranca. No hay que inventar casos de negocio (auth, tenancy, roles) para código que todavía no existe — eso se agrega recién cuando esos módulos se implementen (ver fases del plan en CLAUDE.md).

**Cómo aplicar:** usar este mismo criterio (contrato + smoke de integración) como piso mínimo cada vez que se agregue un endpoint nuevo trivial en fases tempranas, y escalar a más casos límite solo cuando haya lógica de negocio real detrás. Ver [[backend-test-conventions]] para el patrón técnico de cómo escribir el test de integración.
