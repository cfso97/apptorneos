import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  ValidateIf,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { ROLES_MEMBRESIA, RolMembresia } from '../memberships.constants';

/**
 * Valida que el body use EXACTAMENTE uno de los dos modos de invitación:
 * modo A ({ email, rol }) o modo B ({ tipoDocumento, numeroDocumento, nombre,
 * fechaNacimiento, rol }). Nunca ambos, nunca ninguno.
 */
function ExactlyOneInviteMode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'exactlyOneInviteMode',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const dto = args.object as InviteMembershipDto;
          const tieneEmail = Boolean(dto.email);
          const tieneDocumento = Boolean(dto.tipoDocumento || dto.numeroDocumento || dto.nombre || dto.fechaNacimiento);
          return tieneEmail !== tieneDocumento; // XOR estricto
        },
        defaultMessage() {
          return 'Debes enviar exactamente uno de los dos modos: { email, rol } o { tipoDocumento, numeroDocumento, nombre, fechaNacimiento, rol }.';
        },
      },
    });
  };
}

export class InviteMembershipDto {
  @ApiPropertyOptional({ example: 'jugador@example.com', description: 'Modo A: usuario ya existente por email' })
  @ValidateIf((o) => !o.tipoDocumento && !o.numeroDocumento)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'CC', description: 'Modo B: crea/reutiliza perfil sombra por documento' })
  @ValidateIf((o) => !o.email)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  tipoDocumento?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @ValidateIf((o) => !o.email)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  numeroDocumento?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @ValidateIf((o) => !o.email)
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @ApiPropertyOptional({ example: '2012-03-14', description: 'Fecha de nacimiento (ISO 8601)' })
  @ValidateIf((o) => !o.email)
  @IsDateString()
  fechaNacimiento?: string;

  // El decorador de XOR vive acá (no en `email`) a propósito: `rol` es un
  // campo siempre requerido, sin `@ValidateIf`, así que este chequeo corre
  // siempre. Si viviera en `email` junto a su propio `@ValidateIf`, se
  // saltaría por completo (con todos sus decoradores) apenas llegara
  // `tipoDocumento` — dejando pasar sin error un body que mezcla ambos modos.
  @ApiProperty({ enum: ROLES_MEMBRESIA, example: 'jugador' })
  @IsIn(ROLES_MEMBRESIA)
  @ExactlyOneInviteMode()
  rol!: RolMembresia;
}
