import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: { rolePermission: { findMany: jest.Mock } };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    prisma = { rolePermission: { findMany: jest.fn() } };
    service = new PermissionsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('consulta la base de datos la primera vez y arma un Set con los códigos', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([
      { permissionCodigo: 'gestionar_membresias' },
      { permissionCodigo: 'editar_organizacion' },
    ]);

    const permisos = await service.getPermissionsForRole('admin_org');

    expect(prisma.rolePermission.findMany).toHaveBeenCalledWith({
      where: { rol: 'admin_org' },
      select: { permissionCodigo: true },
    });
    expect(permisos).toEqual(new Set(['gestionar_membresias', 'editar_organizacion']));
  });

  it('reutiliza el resultado cacheado dentro del TTL sin volver a consultar', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([{ permissionCodigo: 'ver_estadisticas' }]);

    await service.getPermissionsForRole('coach');
    await service.getPermissionsForRole('coach');

    expect(prisma.rolePermission.findMany).toHaveBeenCalledTimes(1);
  });

  it('vuelve a consultar la base de datos una vez vencido el TTL de 5 minutos', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([{ permissionCodigo: 'ver_estadisticas' }]);

    await service.getPermissionsForRole('coach');
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    await service.getPermissionsForRole('coach');

    expect(prisma.rolePermission.findMany).toHaveBeenCalledTimes(2);
  });

  it('cachea cada rol de forma independiente', async () => {
    prisma.rolePermission.findMany
      .mockResolvedValueOnce([{ permissionCodigo: 'editar_organizacion' }])
      .mockResolvedValueOnce([{ permissionCodigo: 'ver_perfil_propio' }]);

    const adminOrg = await service.getPermissionsForRole('admin_org');
    const jugador = await service.getPermissionsForRole('jugador');

    expect(adminOrg).toEqual(new Set(['editar_organizacion']));
    expect(jugador).toEqual(new Set(['ver_perfil_propio']));
  });
});
