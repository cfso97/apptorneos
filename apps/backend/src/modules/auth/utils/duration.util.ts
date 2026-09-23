const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Convierte duraciones simples tipo "15m", "30d", "1h" a milisegundos. Se usa
 * para calcular `expiresAt` de refresh tokens y tokens de reseteo de
 * contraseña, que no son JWT y por lo tanto no tienen `expiresIn` nativo.
 */
export function parseDurationToMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());

  if (!match) {
    throw new Error(`Formato de duración inválido: "${value}". Usa por ejemplo "15m", "1h" o "30d".`);
  }

  const [, amount, unit] = match;
  return Number(amount) * UNIT_TO_MS[unit];
}
