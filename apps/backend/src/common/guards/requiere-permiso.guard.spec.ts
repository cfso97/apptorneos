import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIERE_PERMISO_KEY } from '../decorators/requiere-permiso.decorator';
import { SKIP_MEMBERSHIP_CHECK_KEY } from '../decorators/skip-membership-check.decorator';
import { PermissionsService } from '../permissions/permissions.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { RequierePermisoGuard } from './requiere-permiso.guard';

const ORG_ID = '11111111-1111-1111-1111-111111111111';

function buildReflector(metadata: Partial<Record<string, unknown>>): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => metadata[key]),
  } as unknown as Reflector;
}

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RequierePermisoGuard', () => {
  let permissionsService: { getPermissionsForRole: jest.Mock };
  let tenantPrisma: { run: jest.Mock };

  beforeEach(() => {
    permissionsService = { getPermissionsForRole: jest.fn() };
    tenantPrisma = { run: jest.fn() };
  });

  function buildGuard(metadata: Partial<Record<string, unknown>> = {}) {
    return new RequierePermisoGuard(
      buildReflector(metadata),
      permissionsService as unknown as PermissionsService,
      tenantPrisma as unknown as TenantPrismaService,
    );
  }

  it('deja pasar sin validar nada cuando la ruta es @Public()', async () => {
    const guard = buildGuard({ [IS_PUBLIC_KEY]: true });
    const request = { user: { userId: 'u1' }, params: {} };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(tenantPrisma.run).not.toHaveBeenCalled();
  });

  it('deja pasar sin exigir membresía cuando la ruta no tiene organizationId (ej. POST /organizations)', async () => {
    const guard = buildGuard();
    const request = { user: { userId: 'u1' }, params: {} };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect((request as { tenantContext?: unknown }).tenantContext).toEqual({ userId: 'u1', organizationId: null });
    expect(tenantPrisma.run).not.toHaveBeenCalled();
  });

  it('rechaza con 400 si el organizationId de la ruta no es un UUID válido', async () => {
    const guard = buildGuard();
    const request = { user: { userId: 'u1' }, params: { orgId: 'no-es-un-uuid' } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('con @SkipMembershipCheck() fija el tenantContext y deja pasar sin buscar membresía', async () => {
    const guard = buildGuard({ [SKIP_MEMBERSHIP_CHECK_KEY]: true });
    const request = { user: { userId: 'u1' }, params: { orgId: ORG_ID } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect((request as { tenantContext?: unknown }).tenantContext).toEqual({ userId: 'u1', organizationId: ORG_ID });
    expect(tenantPrisma.run).not.toHaveBeenCalled();
  });

  it('rechaza con 403 no_es_miembro_de_la_organizacion cuando no hay membresía activa', async () => {
    tenantPrisma.run.mockResolvedValue(null);
    const guard = buildGuard();
    const request = { user: { userId: 'u1' }, params: { orgId: ORG_ID } };

    await expect(guard.canActivate(buildContext(request))).rejects.toMatchObject({
      response: { code: 'no_es_miembro_de_la_organizacion' },
    });
  });

  it('deja pasar sin @RequierePermiso si hay membresía activa (sin chequear permiso puntual)', async () => {
    tenantPrisma.run.mockResolvedValue({ id: 'm1', rol: 'coach', estado: 'activo' });
    const guard = buildGuard();
    const request = { user: { userId: 'u1' }, params: { orgId: ORG_ID } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(permissionsService.getPermissionsForRole).not.toHaveBeenCalled();
    expect((request as { membership?: unknown }).membership).toEqual({ id: 'm1', rol: 'coach', estado: 'activo' });
  });

  it('rechaza con 403 permiso_insuficiente cuando el rol no tiene el permiso requerido', async () => {
    tenantPrisma.run.mockResolvedValue({ id: 'm1', rol: 'coach', estado: 'activo' });
    permissionsService.getPermissionsForRole.mockResolvedValue(new Set(['ver_estadisticas']));
    const guard = buildGuard({ [REQUIERE_PERMISO_KEY]: 'gestionar_membresias' });
    const request = { user: { userId: 'u1' }, params: { orgId: ORG_ID } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deja pasar cuando el rol sí tiene el permiso requerido', async () => {
    tenantPrisma.run.mockResolvedValue({ id: 'm1', rol: 'admin_org', estado: 'activo' });
    permissionsService.getPermissionsForRole.mockResolvedValue(new Set(['gestionar_membresias']));
    const guard = buildGuard({ [REQUIERE_PERMISO_KEY]: 'gestionar_membresias' });
    const request = { user: { userId: 'u1' }, params: { orgId: ORG_ID } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
  });
});
