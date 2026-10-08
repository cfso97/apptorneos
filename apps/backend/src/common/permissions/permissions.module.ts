import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

/**
 * Global: `RequierePermisoGuard` (registrado como `APP_GUARD`) necesita
 * `PermissionsService` en cualquier módulo de la app sin importarlo a mano.
 */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
