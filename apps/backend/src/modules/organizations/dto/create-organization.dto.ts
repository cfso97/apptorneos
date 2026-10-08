import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Club Atlético Ejemplo' })
  @IsString()
  @MinLength(2)
  nombre!: string;

  @ApiProperty({ example: 'club', description: 'Tipo de organización (club, escuela, liga, organizador de torneos).' })
  @IsString()
  @MinLength(2)
  tipo!: string;

  @ApiProperty({
    example: 'CAE',
    description: 'Prefijo para los códigos de jugador de esta organización (ej. CAE-0001).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  prefijoCodigoJugador!: string;
}
