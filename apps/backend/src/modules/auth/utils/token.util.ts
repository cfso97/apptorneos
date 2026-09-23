import { createHash, randomBytes } from 'crypto';

/** Token opaco de alta entropía para refresh tokens y tokens de reseteo de contraseña. */
export function generateOpaqueToken(): string {
  return randomBytes(48).toString('hex');
}

/**
 * Hash de un token opaco para guardarlo en base de datos, nunca en texto
 * plano. No es una contraseña de baja entropía elegida por una persona (ya
 * es aleatorio de 48 bytes) — sha256 alcanza para el objetivo de no exponer
 * el valor en un dump de la base de datos, sin pagar el costo de cómputo de
 * un hash lento como bcrypt en cada `refresh`/`reset-password`.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
