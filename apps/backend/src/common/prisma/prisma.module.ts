import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Módulo global: cualquier módulo de negocio puede inyectar `PrismaService`
 * sin necesidad de importar este módulo explícitamente en cada uno.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
