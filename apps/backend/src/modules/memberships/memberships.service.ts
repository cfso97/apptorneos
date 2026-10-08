import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { AuditService } from '../audit/audit.service';
import { InviteMembershipDto } from './dto/invite-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { generarCodigoJugador } from './utils/generar-codigo-jugador.util';

const ESTADOS_QUE_PUEDEN_REACTIVARSE = ['inactivo', 'removido'];
const ESTADOS_QUE_BLOQUEAN_NUEVA_INVITACION = ['activo', 'invitado'];

@Injectable()
export class MembershipsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    // `users` es un catálogo de identidad global (sin RLS) — se consulta con
    // el PrismaService base, no con TenantPrismaService.
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async invite(ctx: TenantContext, organizationId: string, dto: InviteMembershipDto) {
    const usuario = dto.email
      ? await this.buscarPorEmail(dto.email)
      : await this.buscarOCrearPerfilSombraPorDocumento(dto);

    return this.tenantPrisma.run(
      ctx,
      async (tx) => {
        const existente = await tx.membership.findUnique({
          where: { userId_organizationId: { userId: usuario.id, organizationId } },
        });

        if (existente) {
          if (ESTADOS_QUE_BLOQUEAN_NUEVA_INVITACION.includes(existente.estado)) {
            throw new ConflictException({
              code: 'membresia_ya_existe',
              message: 'El usuario ya tiene una membresía activa o una invitación pendiente en esta organización.',
            });
          }

          if (ESTADOS_QUE_PUEDEN_REACTIVARSE.includes(existente.estado)) {
            // Reactiva la MISMA fila (conserva el código de jugador ya asignado).
            return tx.membership.update({
              where: { id: existente.id },
              data: { estado: 'invitado', rol: dto.rol },
            });
          }
        }

        const codigoJugador = await generarCodigoJugador(tx, organizationId);

        return tx.membership.create({
          data: {
            userId: usuario.id,
            organizationId,
            rol: dto.rol,
            estado: 'invitado',
            codigoJugador,
          },
        });
      },
      organizationId,
    );
  }

  async findAll(ctx: TenantContext, organizationId: string) {
    return this.tenantPrisma.run(
      ctx,
      (tx) => tx.membership.findMany({ where: { organizationId }, orderBy: { codigoJugador: 'asc' } }),
      organizationId,
    );
  }

  async update(ctx: TenantContext, organizationId: string, membershipId: string, dto: UpdateMembershipDto) {
    return this.tenantPrisma.run(
      ctx,
      async (tx) => {
        const actual = await tx.membership.findFirst({ where: { id: membershipId, organizationId } });

        if (!actual) {
          throw new NotFoundException({
            code: 'membresia_no_encontrada',
            message: 'La membresía no existe en esta organización.',
          });
        }

        if (dto.estado === 'activo' && actual.estado === 'invitado') {
          throw new ConflictException({
            code: 'transicion_invalida',
            message: 'Una invitación pendiente solo puede activarse aceptándola (POST .../accept).',
          });
        }

        const actualizada = await tx.membership.update({
          where: { id: membershipId },
          data: {
            rol: dto.rol ?? undefined,
            estado: dto.estado ?? undefined,
          },
        });

        await this.auditService.registrar(
          {
            organizationId,
            userId: ctx.userId,
            entidadTipo: 'membership',
            entidadId: membershipId,
            accion: 'editar',
            valoresAnteriores: { rol: actual.rol, estado: actual.estado },
            valoresNuevos: { rol: actualizada.rol, estado: actualizada.estado },
          },
          tx,
        );

        return actualizada;
      },
      organizationId,
    );
  }

  async accept(ctx: TenantContext, organizationId: string, membershipId: string) {
    return this.tenantPrisma.run(
      ctx,
      async (tx) => {
        const membership = await tx.membership.findFirst({ where: { id: membershipId, organizationId } });

        if (!membership) {
          throw new NotFoundException({
            code: 'membresia_no_encontrada',
            message: 'La membresía no existe en esta organización.',
          });
        }

        if (membership.userId !== ctx.userId) {
          throw new ForbiddenException({
            code: 'no_autorizado',
            message: 'Esta invitación no te pertenece.',
          });
        }

        if (membership.estado !== 'invitado') {
          throw new ConflictException({
            code: 'invitacion_no_pendiente',
            message: 'Esta invitación ya fue aceptada o ya no está pendiente.',
          });
        }

        return tx.membership.update({
          where: { id: membershipId },
          data: { estado: 'activo', fechaIngreso: new Date() },
        });
      },
      organizationId,
    );
  }

  private async buscarPorEmail(email: string) {
    const usuario = await this.prisma.user.findUnique({ where: { email } });

    if (!usuario) {
      throw new NotFoundException({
        code: 'usuario_no_encontrado',
        message: 'No existe un usuario registrado con ese email.',
      });
    }

    return usuario;
  }

  private async buscarOCrearPerfilSombraPorDocumento(dto: InviteMembershipDto) {
    const tipoDocumento = dto.tipoDocumento!;
    const numeroDocumento = dto.numeroDocumento!;

    const existente = await this.prisma.user.findUnique({
      where: { tipoDocumento_numeroDocumento: { tipoDocumento, numeroDocumento } },
    });

    if (existente) return existente; // sombra sin reclamar o ya reclamada: se reutiliza tal cual

    try {
      return await this.prisma.user.create({
        data: {
          tipoDocumento,
          numeroDocumento,
          nombre: dto.nombre!,
          fechaNacimiento: new Date(dto.fechaNacimiento!),
          // email y passwordHash quedan null a propósito (perfil sombra).
        },
      });
    } catch (error) {
      // Carrera: dos invitaciones concurrentes con el mismo documento (mismo
      // criterio que generarCodigoJugador). La que pierde reutiliza la fila ganadora.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const ganadora = await this.prisma.user.findUnique({
          where: { tipoDocumento_numeroDocumento: { tipoDocumento, numeroDocumento } },
        });
        if (ganadora) return ganadora;
      }
      throw error;
    }
  }
}
