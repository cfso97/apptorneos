import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { AuditService } from '../audit/audit.service';
import * as generarCodigoJugadorUtil from './utils/generar-codigo-jugador.util';
import { MembershipsService } from './memberships.service';

jest.mock('./utils/generar-codigo-jugador.util');

const generarCodigoJugadorMock = generarCodigoJugadorUtil.generarCodigoJugador as jest.Mock;

const ORG_ID = 'org-1';

describe('MembershipsService', () => {
  let service: MembershipsService;
  let tenantPrisma: { run: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let auditService: { registrar: jest.Mock };
  let tx: {
    membership: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const ctx: TenantContext = { userId: 'admin-1', organizationId: ORG_ID };

  beforeEach(() => {
    tx = {
      membership: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    tenantPrisma = { run: jest.fn((_ctx, fn) => fn(tx)) };
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    auditService = { registrar: jest.fn() };
    generarCodigoJugadorMock.mockResolvedValue('ORG-0002');

    service = new MembershipsService(
      tenantPrisma as unknown as TenantPrismaService,
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  describe('invite', () => {
    it('lanza 404 usuario_no_encontrado si el email no corresponde a ningún usuario', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.invite(ctx, ORG_ID, { email: 'nadie@example.com', rol: 'jugador' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('crea la membresía nueva con código de jugador generado cuando no existía fila previa', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'jugador@example.com' });
      tx.membership.findUnique.mockResolvedValue(null);
      tx.membership.create.mockResolvedValue({ id: 'm-1', estado: 'invitado', rol: 'jugador' });

      const resultado = await service.invite(ctx, ORG_ID, { email: 'jugador@example.com', rol: 'jugador' });

      expect(tx.membership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-2', organizationId: ORG_ID, rol: 'jugador', estado: 'invitado', codigoJugador: 'ORG-0002' }),
      });
      expect(resultado).toEqual({ id: 'm-1', estado: 'invitado', rol: 'jugador' });
    });

    it('rechaza con 409 membresia_ya_existe si ya está activo o invitado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      tx.membership.findUnique.mockResolvedValue({ id: 'm-1', estado: 'activo' });

      await expect(service.invite(ctx, ORG_ID, { email: 'x@example.com', rol: 'jugador' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.membership.create).not.toHaveBeenCalled();
    });

    it('reactiva la misma fila (conserva código de jugador) si estaba inactivo/removido', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      tx.membership.findUnique.mockResolvedValue({ id: 'm-1', estado: 'removido', codigoJugador: 'ORG-0002' });
      tx.membership.update.mockResolvedValue({ id: 'm-1', estado: 'invitado', rol: 'coach' });

      const resultado = await service.invite(ctx, ORG_ID, { email: 'x@example.com', rol: 'coach' });

      expect(tx.membership.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { estado: 'invitado', rol: 'coach' },
      });
      expect(tx.membership.create).not.toHaveBeenCalled();
      expect(resultado.estado).toBe('invitado');
    });

    describe('modo documento (perfil sombra)', () => {
      const docDto = {
        tipoDocumento: 'CC',
        numeroDocumento: '9999999999',
        nombre: 'Menor Pre-Registrado',
        fechaNacimiento: '2012-03-14',
        rol: 'jugador' as const,
      };

      it('crea el perfil sombra (email/passwordHash null) cuando el documento es nuevo', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue({ id: 'user-sombra', ...docDto });
        tx.membership.findUnique.mockResolvedValue(null);
        tx.membership.create.mockResolvedValue({ id: 'm-2', estado: 'invitado', rol: 'jugador' });

        const resultado = await service.invite(ctx, ORG_ID, docDto);

        expect(prisma.user.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tipoDocumento: docDto.tipoDocumento,
            numeroDocumento: docDto.numeroDocumento,
            nombre: docDto.nombre,
          }),
        });
        expect(prisma.user.create.mock.calls[0][0].data).not.toHaveProperty('email');
        expect(prisma.user.create.mock.calls[0][0].data).not.toHaveProperty('passwordHash');
        expect(tx.membership.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ userId: 'user-sombra', organizationId: ORG_ID }),
        });
        expect(resultado.estado).toBe('invitado');
      });

      it('reutiliza el usuario existente (sombra o ya reclamado) si el documento ya existe', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'user-existente', email: 'ya-tiene-cuenta@example.com' });
        tx.membership.findUnique.mockResolvedValue(null);
        tx.membership.create.mockResolvedValue({ id: 'm-3', estado: 'invitado', rol: 'jugador' });

        await service.invite(ctx, ORG_ID, docDto);

        expect(prisma.user.create).not.toHaveBeenCalled();
        expect(tx.membership.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ userId: 'user-existente' }),
        });
      });

      it('reactiva la membresía existente del usuario resuelto por documento', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'user-existente' });
        tx.membership.findUnique.mockResolvedValue({ id: 'm-4', estado: 'inactivo', codigoJugador: 'ORG-0003' });
        tx.membership.update.mockResolvedValue({ id: 'm-4', estado: 'invitado', rol: 'jugador' });

        const resultado = await service.invite(ctx, ORG_ID, docDto);

        expect(tx.membership.update).toHaveBeenCalledWith({
          where: { id: 'm-4' },
          data: { estado: 'invitado', rol: 'jugador' },
        });
        expect(resultado.estado).toBe('invitado');
      });

      it('ante una carrera (P2002 al crear), reutiliza la fila ganadora en vez de fallar', async () => {
        prisma.user.findUnique
          .mockResolvedValueOnce(null) // primera búsqueda: todavía no existe
          .mockResolvedValueOnce({ id: 'user-ganador' }); // segunda búsqueda tras el P2002: ya existe
        const errorCarrera = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.22.0',
        });
        prisma.user.create.mockRejectedValue(errorCarrera);
        tx.membership.findUnique.mockResolvedValue(null);
        tx.membership.create.mockResolvedValue({ id: 'm-5', estado: 'invitado', rol: 'jugador' });

        const resultado = await service.invite(ctx, ORG_ID, docDto);

        expect(tx.membership.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ userId: 'user-ganador' }),
        });
        expect(resultado.estado).toBe('invitado');
      });
    });
  });

  describe('update', () => {
    it('lanza 404 si la membresía no existe en esa organización', async () => {
      tx.membership.findFirst.mockResolvedValue(null);

      await expect(service.update(ctx, ORG_ID, 'm-x', { rol: 'coach' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza la transición directa invitado -> activo (código transicion_invalida)', async () => {
      tx.membership.findFirst.mockResolvedValue({ id: 'm-1', estado: 'invitado', rol: 'jugador' });

      await expect(service.update(ctx, ORG_ID, 'm-1', { estado: 'activo' })).rejects.toMatchObject({
        response: { code: 'transicion_invalida' },
      });
    });

    it('actualiza rol/estado y registra auditoría', async () => {
      tx.membership.findFirst.mockResolvedValue({ id: 'm-1', estado: 'activo', rol: 'jugador' });
      tx.membership.update.mockResolvedValue({ id: 'm-1', estado: 'inactivo', rol: 'jugador' });

      const resultado = await service.update(ctx, ORG_ID, 'm-1', { estado: 'inactivo' });

      expect(resultado.estado).toBe('inactivo');
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ entidadTipo: 'membership', entidadId: 'm-1', accion: 'editar' }),
        tx,
      );
    });
  });

  describe('accept', () => {
    it('lanza 404 si la membresía no existe', async () => {
      tx.membership.findFirst.mockResolvedValue(null);

      await expect(service.accept(ctx, ORG_ID, 'm-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza con 403 si la invitación no pertenece al usuario autenticado', async () => {
      tx.membership.findFirst.mockResolvedValue({ id: 'm-1', userId: 'otro-usuario', estado: 'invitado' });

      await expect(service.accept(ctx, ORG_ID, 'm-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza con 409 invitacion_no_pendiente si ya no está en estado invitado', async () => {
      tx.membership.findFirst.mockResolvedValue({ id: 'm-1', userId: ctx.userId, estado: 'activo' });

      await expect(service.accept(ctx, ORG_ID, 'm-1')).rejects.toMatchObject({
        response: { code: 'invitacion_no_pendiente' },
      });
    });

    it('activa la membresía y fija fechaIngreso cuando todo es válido', async () => {
      tx.membership.findFirst.mockResolvedValue({ id: 'm-1', userId: ctx.userId, estado: 'invitado' });
      tx.membership.update.mockResolvedValue({ id: 'm-1', estado: 'activo' });

      const resultado = await service.accept(ctx, ORG_ID, 'm-1');

      expect(tx.membership.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { estado: 'activo', fechaIngreso: expect.any(Date) },
      });
      expect(resultado).toEqual({ id: 'm-1', estado: 'activo' });
    });
  });
});
