import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Conexión única a Postgres vía Prisma Client. Se inyecta en cualquier
 * servicio que necesite acceso a datos — ver `PrismaModule` (`@Global()`).
 *
 * Fase 1 — decisión de seguridad: el backend en ejecución se conecta con
 * `RUNTIME_DATABASE_URL`, el rol de Postgres `app_runtime` (sin privilegios
 * de superusuario). `DATABASE_URL` (definida en el `datasource` de
 * `schema.prisma`) queda reservada para `prisma migrate` y `prisma/seed.ts`,
 * que sí necesitan permisos de superusuario para crear tablas/roles. Un
 * superusuario de Postgres siempre se salta Row-Level Security, así que si
 * el runtime usara ese mismo usuario, las políticas de RLS de
 * `organizations`/`memberships`/`audit_log` quedarían sin efecto real.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const runtimeDatabaseUrl = configService.get<string>('RUNTIME_DATABASE_URL');

    if (!runtimeDatabaseUrl) {
      // Falla segura, mismo criterio que otros guards del proyecto: mejor no
      // arrancar que arrancar conectado por accidente con un usuario
      // superusuario que se salta RLS.
      throw new Error(
        'RUNTIME_DATABASE_URL no está definida. El backend en ejecución debe conectarse con el rol ' +
          '`app_runtime` (sin privilegios de superusuario), nunca con el usuario de DATABASE_URL. ' +
          'Ver la migración de RLS (fase1_rls_setup) y .env.example.',
      );
    }

    super({ datasources: { db: { url: runtimeDatabaseUrl } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexión a la base de datos establecida (rol app_runtime).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
