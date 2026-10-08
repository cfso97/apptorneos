import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GuardianAccessGuard } from './guardian-access.guard';

function buildContext(userId: string, targetUserId: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId }, params: { userId: targetUserId } }),
    }),
  } as unknown as ExecutionContext;
}

describe('GuardianAccessGuard', () => {
  let prisma: { $queryRaw: jest.Mock };
  let guard: GuardianAccessGuard;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    guard = new GuardianAccessGuard(prisma as unknown as PrismaService);
  });

  it('permite el acceso cuando el usuario gestiona sus propios acudientes', async () => {
    await expect(guard.canActivate(buildContext('u1', 'u1'))).resolves.toBe(true);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('permite el acceso cuando user_shares_admin_org responde true', async () => {
    prisma.$queryRaw.mockResolvedValue([{ compartido: true }]);

    await expect(guard.canActivate(buildContext('admin-1', 'menor-1'))).resolves.toBe(true);
  });

  it('rechaza con 403 no_autorizado cuando user_shares_admin_org responde false', async () => {
    prisma.$queryRaw.mockResolvedValue([{ compartido: false }]);

    await expect(guard.canActivate(buildContext('tercero-1', 'menor-1'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
