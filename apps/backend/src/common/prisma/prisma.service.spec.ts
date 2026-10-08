import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('falla al construirse si RUNTIME_DATABASE_URL no está definida (falla segura)', () => {
    const configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    expect(() => new PrismaService(configService)).toThrow(/RUNTIME_DATABASE_URL/);
  });

  it('se construye sin error cuando RUNTIME_DATABASE_URL está definida', () => {
    const configService = {
      get: jest.fn().mockReturnValue('postgresql://app_runtime:pass@localhost:5432/torneos_saas'),
    } as unknown as ConfigService;

    expect(() => new PrismaService(configService)).not.toThrow();
  });
});
