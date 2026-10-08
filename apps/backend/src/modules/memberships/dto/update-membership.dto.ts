import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ESTADOS_MEMBRESIA, EstadoMembresia, ROLES_MEMBRESIA, RolMembresia } from '../memberships.constants';

export class UpdateMembershipDto {
  @ApiPropertyOptional({ enum: ROLES_MEMBRESIA })
  @IsOptional()
  @IsIn(ROLES_MEMBRESIA)
  rol?: RolMembresia;

  @ApiPropertyOptional({
    enum: ESTADOS_MEMBRESIA,
    description:
      'No se puede pasar directamente a "activo" desde "invitado" — esa transición solo ocurre vía POST .../accept.',
  })
  @IsOptional()
  @IsIn(ESTADOS_MEMBRESIA)
  estado?: EstadoMembresia;
}
