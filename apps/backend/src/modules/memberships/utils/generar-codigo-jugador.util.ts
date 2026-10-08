import { TenantTransactionClient } from '../../../common/prisma/tenant-prisma.service';

interface SecuenciaRow {
  prefijo_codigo_jugador: string;
  siguiente_secuencia: number;
}

/**
 * Genera el próximo código de jugador de una organización (ej. `ORG-0001`).
 * Usado tanto por `MembershipsService` (invitar a alguien) como por
 * `OrganizationsService` (la membresía `admin_org` del creador).
 *
 * Seguro ante altas concurrentes: el `UPDATE ... RETURNING` toma un lock de
 * fila sobre `organizations.id`, así que dos invitaciones simultáneas a la
 * misma organización se serializan (la segunda espera a que la primera
 * confirme su transacción) y nunca terminan con el mismo número de
 * secuencia — sin necesidad de un `SELECT ... FOR UPDATE` aparte.
 */
export async function generarCodigoJugador(tx: TenantTransactionClient, organizationId: string): Promise<string> {
  const filas = await tx.$queryRaw<SecuenciaRow[]>`
    UPDATE organizations
    SET siguiente_secuencia = siguiente_secuencia + 1
    WHERE id = ${organizationId}::uuid
    RETURNING prefijo_codigo_jugador, siguiente_secuencia
  `;

  const fila = filas[0];
  const secuencia = String(fila.siguiente_secuencia).padStart(4, '0');
  return `${fila.prefijo_codigo_jugador}-${secuencia}`;
}
