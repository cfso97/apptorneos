import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional } from 'class-validator';

const RELACIONES_ACUDIENTE = ['padre', 'madre', 'tutor_legal'] as const;

export class LinkGuardianDto {
  @ApiProperty({ example: 'acudiente@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  guardianEmail!: string;

  @ApiProperty({ enum: RELACIONES_ACUDIENTE, example: 'madre' })
  @IsIn(RELACIONES_ACUDIENTE)
  relacion!: (typeof RELACIONES_ACUDIENTE)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  esResponsablePagos?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  esContactoEmergencia?: boolean;
}
