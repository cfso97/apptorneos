import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../tenant/tenant-context';
import { PrismaService } from './prisma.service';

/** Cliente Prisma dentro de la transacción corta abierta por `TenantPrismaService.run`. */
export type TenantTransactionClient = Prisma.TransactionClient;

/**
 * Punto de entrada obligatorio para cualquier servicio de negocio que toque
 * una tabla con Row-Level Security (`organizations`, `memberships`,
 * `audit_log`, y las que se agreguen en fases futuras).
 *
 * No usa una transacción abierta por todo el request (vía middleware /
 * AsyncLocalStorage) — eso se evaluó y se descartó por frágil (fácil de
 * romper si un handler no pasa por el middleware, o de dejar una conexión
 * colgada). En su lugar, cada operación de negocio abre su propia
 * transacción corta: fija el `user_id`/`organization_id` de sesión de
 * Postgres con `set_config(..., true)` (alcance `LOCAL`, se limpia solo al
 * cerrar la transacción) como primeras sentencias, y ejecuta el callback
 * dentro de esa misma transacción — así las políticas de RLS de Postgres ven
 * siempre el contexto correcto para esa operación puntual.
 */
@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param ctx Contexto de la petición (`request.tenantContext`, puesto por `RequierePermisoGuard`).
   * @param fn Lógica de negocio a ejecutar dentro de la transacción con el contexto ya fijado.
   * @param organizationIdOverride Úsalo cuando el `organizationId` a fijar no es el de `ctx`
   *   (ej. al crear una organización nueva: `ctx.organizationId` todavía es `null`, pero hace
   *   falta fijar el `id` que va a tener la fila para que la política de INSERT la deje pasar).
   */
  async run<T>(
    ctx: TenantContext,
    fn: (tx: TenantTransactionClient) => Promise<T>,
    organizationIdOverride?: string,
  ): Promise<T> {
    const organizationId = organizationIdOverride ?? ctx.organizationId ?? undefined;

    return this.prisma.$transaction(async (tx) => {
      // $executeRaw con template tag parametriza automáticamente (nunca
      // concatena strings) — evita inyección SQL en los valores de sesión.
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`;

      if (organizationId) {
        await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
      }
      // Si no hay organizationId, se deja sin fijar a propósito: al ser
      // `SET LOCAL` (tercer argumento `true`), una transacción nueva nunca
      // hereda el valor de una transacción anterior en la misma conexión —
      // `current_setting(..., true)` devuelve NULL y las políticas de RLS
      // bloquean por defecto (cero filas), nunca "todas las filas".

      return fn(tx);
    });
  }
}
