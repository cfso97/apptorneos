import { NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { AuditService } from '../audit/audit.service';
import * as generarCodigoJugadorUtil from '../memberships/utils/generar-codigo-jugador.util';
import { OrganizationsService } from './organizations.service';

jest.mock('../memberships/utils/generar-codigo-jugador.util');

const generarCodigoJugadorMock = generarCodigoJugadorUtil.generarCodigoJugador as jest.Mock;

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let tenantPrisma: { run: jest.Mock };
  let auditService: { registrar: jest.Mock };
  let tx: {
    organization: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    membership: { create: jest.Mock };
  };

  const ctx: TenantContext = { userId: 'user-1', organizationId: null };

  beforeEach(() => {
    tx = {
      organization: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      membership: { create: jest.fn() },
    };
    tenantPrisma = { run: jest.fn((_ctx, fn) => fn(tx)) };
    auditService = { registrar: jest.fn() };
    generarCodigoJugadorMock.mockResolvedValue('ORG-0001');

    service = new OrganizationsService(
      tenantPrisma as unknown as TenantPrismaService,
      auditService as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('crea la organización y una membresía admin_org activa para el creador', async () => {
      tx.organization.create.mockResolvedValue({ id: 'org-1', nombre: 'Club X' });

      const resultado = await service.create(ctx, { nombre: 'Club X', tipo: 'club', prefijoCodigoJugador: 'CX' });

      expect(tx.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nombre: 'Club X', tipo: 'club', prefijoCodigoJugador: 'CX' }),
        }),
      );
      expect(tx.membership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          rol: 'admin_org',
          estado: 'activo',
          codigoJugador: 'ORG-0001',
        }),
      });
      expect(resultado).toEqual({ id: 'org-1', nombre: 'Club X' });

      // El organizationId fijado en la transacción debe ser el id generado
      // para la organización nueva (tercer argumento de tenantPrisma.run).
      const [, , organizationIdOverride] = tenantPrisma.run.mock.calls[0];
      expect(organizationIdOverride).toEqual(expect.any(String));
    });
  });

  describe('findOne', () => {
    it('devuelve la organización cuando existe', async () => {
      tx.organization.findUnique.mockResolvedValue({ id: 'org-1', nombre: 'Club X' });

      const resultado = await service.findOne(ctx, 'org-1');

      expect(resultado).toEqual({ id: 'org-1', nombre: 'Club X' });
    });

    it('lanza 404 organizacion_no_encontrada cuando no existe (o RLS la esconde)', async () => {
      tx.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ctx, 'org-inexistente')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.findOne(ctx, 'org-inexistente')).rejects.toMatchObject({
        response: { code: 'organizacion_no_encontrada' },
      });
    });
  });

  describe('update', () => {
    it('actualiza y registra auditoría con valores anteriores/nuevos', async () => {
      tx.organization.findUnique.mockResolvedValue({ id: 'org-1', nombre: 'Viejo', tipo: 'club', prefijoCodigoJugador: 'V' });
      tx.organization.update.mockResolvedValue({ id: 'org-1', nombre: 'Nuevo', tipo: 'club', prefijoCodigoJugador: 'V' });

      const resultado = await service.update(ctx, 'org-1', { nombre: 'Nuevo' });

      expect(resultado.nombre).toBe('Nuevo');
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          entidadTipo: 'organization',
          accion: 'editar',
          valoresAnteriores: expect.objectContaining({ nombre: 'Viejo' }),
          valoresNuevos: expect.objectContaining({ nombre: 'Nuevo' }),
        }),
        tx,
      );
    });

    it('lanza 404 si la organización no existe', async () => {
      tx.organization.findUnique.mockResolvedValue(null);

      await expect(service.update(ctx, 'org-x', { nombre: 'Nuevo' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
