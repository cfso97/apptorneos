import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PLAN_PLACEHOLDER_ID } from '../../common/constants/seed-ids.constant';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { AuditService } from '../audit/audit.service';
import { generarCodigoJugador } from '../memberships/utils/generar-codigo-jugador.util';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * El creador queda como `admin_org` de la organización nueva. `ctx.organizationId`
   * todavía es `null` en este punto (no existe la organización) — se genera el
   * `id` acá y se pasa como `organizationIdOverride` para que la política de RLS
   * de INSERT (que compara contra ese mismo `id`) lo acepte.
   */
  async create(ctx: TenantContext, dto: CreateOrganizationDto) {
    const organizationId = randomUUID();

    return this.tenantPrisma.run(
      ctx,
      async (tx) => {
        const organization = await tx.organization.create({
          data: {
            id: organizationId,
            nombre: dto.nombre,
            tipo: dto.tipo,
            planId: PLAN_PLACEHOLDER_ID,
            prefijoCodigoJugador: dto.prefijoCodigoJugador,
          },
        });

        const codigoJugador = await generarCodigoJugador(tx, organizationId);

        await tx.membership.create({
          data: {
            userId: ctx.userId,
            organizationId,
            rol: 'admin_org',
            estado: 'activo',
            fechaIngreso: new Date(),
            codigoJugador,
          },
        });

        return organization;
      },
      organizationId,
    );
  }

  async findOne(ctx: TenantContext, id: string) {
    const organization = await this.tenantPrisma.run(ctx, (tx) => tx.organization.findUnique({ where: { id } }), id);

    if (!organization) {
      throw new NotFoundException({
        code: 'organizacion_no_encontrada',
        message: 'La organización no existe.',
      });
    }

    return organization;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateOrganizationDto) {
    return this.tenantPrisma.run(
      ctx,
      async (tx) => {
        const actual = await tx.organization.findUnique({ where: { id } });

        if (!actual) {
          throw new NotFoundException({
            code: 'organizacion_no_encontrada',
            message: 'La organización no existe.',
          });
        }

        const actualizada = await tx.organization.update({
          where: { id },
          data: {
            nombre: dto.nombre ?? undefined,
            tipo: dto.tipo ?? undefined,
            prefijoCodigoJugador: dto.prefijoCodigoJugador ?? undefined,
          },
        });

        await this.auditService.registrar(
          {
            organizationId: id,
            userId: ctx.userId,
            entidadTipo: 'organization',
            entidadId: id,
            accion: 'editar',
            valoresAnteriores: {
              nombre: actual.nombre,
              tipo: actual.tipo,
              prefijoCodigoJugador: actual.prefijoCodigoJugador,
            },
            valoresNuevos: {
              nombre: actualizada.nombre,
              tipo: actualizada.tipo,
              prefijoCodigoJugador: actualizada.prefijoCodigoJugador,
            },
          },
          tx,
        );

        return actualizada;
      },
      id,
    );
  }
}
