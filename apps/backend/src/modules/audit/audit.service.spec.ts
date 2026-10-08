import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantTransactionClient } from '../../common/prisma/tenant-prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditLog: { create: jest.Mock } };

  beforeEach(() => {
    prisma = { auditLog: { create: jest.fn() } };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('inserta en audit_log usando el tx recibido, cuando se pasa uno', async () => {
    const tx = { auditLog: { create: jest.fn() } } as unknown as TenantTransactionClient;

    await service.registrar(
      {
        organizationId: 'org-1',
        userId: 'user-1',
        entidadTipo: 'organization',
        entidadId: 'org-1',
        accion: 'editar',
        valoresAnteriores: { nombre: 'Viejo' },
        valoresNuevos: { nombre: 'Nuevo' },
      },
      tx,
    );

    expect((tx as unknown as { auditLog: { create: jest.Mock } }).auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-1',
        entidadTipo: 'organization',
        entidadId: 'org-1',
        accion: 'editar',
        valoresAnteriores: { nombre: 'Viejo' },
        valoresNuevos: { nombre: 'Nuevo' },
      },
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('cae al PrismaService base cuando no se pasa tx', async () => {
    await service.registrar({
      organizationId: 'org-1',
      userId: 'user-1',
      entidadTipo: 'membership',
      entidadId: 'm-1',
      accion: 'editar',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
