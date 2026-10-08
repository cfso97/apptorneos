import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantTransactionClient } from '../../common/prisma/tenant-prisma.service';

export interface RegistrarAuditoriaParams {
  organizationId: string;
  userId: string;
  entidadTipo: string;
  entidadId: string;
  accion: string;
  valoresAnteriores?: Prisma.InputJsonValue;
  valoresNuevos?: Prisma.InputJsonValue;
}

/**
 * Registro genérico de auditoría (sección 16 de modelo-datos-torneos-saas.md).
 * Se llama explícitamente desde los dos puntos de esta fase que editan datos
 * sensibles (`OrganizationsService.update`, `MembershipsService.update`) —
 * no vía interceptor genérico, por simplicidad dado que hoy son solo 2
 * puntos de auditoría (revisar si conviene generalizar cuando haya más).
 *
 * `audit_log` tiene RLS por `organization_id`: para que el INSERT pase la
 * política, se necesita pasar el `tx` de la transacción de
 * `TenantPrismaService.run` que ya tiene el contexto fijado (si se omite,
 * cae a `PrismaService` base, que se conecta como `app_runtime` sin contexto
 * de organización fijado — el INSERT sería bloqueado por RLS).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(params: RegistrarAuditoriaParams, tx?: TenantTransactionClient): Promise<void> {
    const client = tx ?? this.prisma;

    await client.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        entidadTipo: params.entidadTipo,
        entidadId: params.entidadId,
        accion: params.accion,
        valoresAnteriores: params.valoresAnteriores,
        valoresNuevos: params.valoresNuevos,
      },
    });
  }
}
