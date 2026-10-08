import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';

/**
 * Módulo global: cualquier módulo de negocio puede inyectar `PrismaService`
 * (catálogos globales, sin RLS: `users`, `permissions`, `plans`...) o
 * `TenantPrismaService` (cualquier tabla con RLS: `organizations`,
 * `memberships`, `audit_log`) sin necesidad de importar este módulo
 * explícitamente en cada uno.
 */
@Global()
@Module({
  providers: [PrismaService, TenantPrismaService],
  exports: [PrismaService, TenantPrismaService],
})
export class PrismaModule {}
