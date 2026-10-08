import { PrismaService } from './prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';

describe('TenantPrismaService', () => {
  let prisma: { $transaction: jest.Mock };
  let service: TenantPrismaService;
  let tx: { $executeRaw: jest.Mock };

  beforeEach(() => {
    tx = { $executeRaw: jest.fn() };
    prisma = { $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)) };
    service = new TenantPrismaService(prisma as unknown as PrismaService);
  });

  it('fija user_id y organization_id de sesión y ejecuta el callback dentro de la transacción', async () => {
    const fn = jest.fn().mockResolvedValue('resultado');

    const resultado = await service.run({ userId: 'user-1', organizationId: 'org-1' }, fn);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith(tx);
    expect(resultado).toBe('resultado');
  });

  it('usa organizationIdOverride en vez del organizationId del contexto cuando se pasa', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);

    await service.run({ userId: 'user-1', organizationId: null }, fn, 'org-override');

    // Dos llamadas a $executeRaw: user_id y organization_id (con el override).
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('no fija organization_id cuando no hay organizationId ni override (deja que RLS bloquee por defecto)', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);

    await service.run({ userId: 'user-1', organizationId: null }, fn);

    // Solo una llamada a $executeRaw: user_id. Sin organization_id fijado.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
