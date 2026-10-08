---
name: feedback-class-validator-validateif-gotcha
description: No apilar un validador custom cross-field junto a @ValidateIf en la misma propiedad — @ValidateIf salta TODOS los decoradores de esa propiedad, incluido el custom
metadata:
  type: feedback
---

**Patrón a evitar:** en un DTO con modos de entrada mutuamente excluyentes (XOR), no pongas el decorador de validación cruzada (ej. "exactamente uno de estos campos") sobre una propiedad que también lleva `@ValidateIf(...)`. `@ValidateIf` en `class-validator` desactiva **todos** los decoradores apilados en esa misma propiedad cuando su condición da `false` — incluido cualquier validador custom que dependa de otras propiedades del objeto. El resultado es un chequeo XOR que parece correcto leyendo el código pero que en la práctica nunca se ejecuta quando aparece el campo que dispara el `ValidateIf` a `false`.

**Por qué importa:** encontrado en `InviteMembershipDto` ([[project-perfiles-reclamables-implementation]]) — el propio plan aprobado por Cristian traía este bug (el decorador `ExactlyOneInviteMode()` estaba en `email`, junto a `@ValidateIf((o) => !o.tipoDocumento && !o.numeroDocumento)`). Un body que mezclaba `email` + `tipoDocumento` pasaba la validación sin error. Lo detectó el test unitario del DTO (`validate()` directo con `class-validator`), no la lectura del código ni el e2e feliz.

**Cómo aplicar:** el validador cross-field de "exactamente uno de N modos" debe vivir en una propiedad que SIEMPRE se valide (sin `@ValidateIf`, idealmente un campo requerido en todos los modos, como `rol` en este caso) — nunca en una de las propiedades que ya está condicionada por `@ValidateIf`. Al escribir DTOs con modos alternativos, siempre agregar un test unitario explícito del caso "mezcla ambos modos" (no solo "ninguno" o "solo uno válido") — es el caso que este bug no cubre y el que más fácil pasa desapercibido en code review.
