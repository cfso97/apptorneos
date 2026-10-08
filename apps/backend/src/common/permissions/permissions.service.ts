import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CacheEntry {
  permisos: Set<string>;
  expiraEn: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cachea en memoria (por proceso, TTL 5 min) el catálogo `role_permissions`
 * agrupado por rol — es la fuente que consulta `RequierePermisoGuard` en
 * cada request, así que evita ir a la base de datos en cada petición.
 * `role_permissions`/`permissions` son catálogos globales de la plataforma
 * (sin `organization_id`), así que se consultan con `PrismaService` base,
 * sin pasar por RLS.
 *
 * Nota: sección 16.1 de modelo-datos-torneos-saas.md menciona cache en Redis
 * — se implementa en memoria por ahora (más simple, un solo proceso en el
 * MVP); migrar a Redis es un cambio interno de esta clase si el backend pasa
 * a correr en más de una instancia.
 */
@Injectable()
export class PermissionsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async getPermissionsForRole(rol: string): Promise<Set<string>> {
    const cacheado = this.cache.get(rol);

    if (cacheado && cacheado.expiraEn > Date.now()) {
      return cacheado.permisos;
    }

    const filas = await this.prisma.rolePermission.findMany({
      where: { rol },
      select: { permissionCodigo: true },
    });

    const permisos = new Set(filas.map((fila) => fila.permissionCodigo));
    this.cache.set(rol, { permisos, expiraEn: Date.now() + CACHE_TTL_MS });

    return permisos;
  }
}
