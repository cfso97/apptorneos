import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InviteMembershipDto } from './invite-membership.dto';

async function validarDto(payload: Record<string, unknown>) {
  const instancia = plainToInstance(InviteMembershipDto, payload);
  return validate(instancia);
}

describe('InviteMembershipDto', () => {
  it('no tiene errores con solo el modo A (email) válido', async () => {
    const errores = await validarDto({ email: 'jugador@example.com', rol: 'jugador' });

    expect(errores).toHaveLength(0);
  });

  it('no tiene errores con solo el modo B (documento) completo', async () => {
    const errores = await validarDto({
      tipoDocumento: 'CC',
      numeroDocumento: '1234567890',
      nombre: 'Juan Pérez',
      fechaNacimiento: '2012-03-14',
      rol: 'jugador',
    });

    expect(errores).toHaveLength(0);
  });

  it('falla si no se envía ninguno de los dos modos', async () => {
    const errores = await validarDto({ rol: 'jugador' });

    expect(errores.length).toBeGreaterThan(0);
  });

  it('falla si se mezclan ambos modos (email + documento)', async () => {
    const errores = await validarDto({
      email: 'jugador@example.com',
      tipoDocumento: 'CC',
      numeroDocumento: '1234567890',
      nombre: 'Juan Pérez',
      fechaNacimiento: '2012-03-14',
      rol: 'jugador',
    });

    expect(errores.length).toBeGreaterThan(0);
  });

  it('falla si el modo documento está incompleto (falta nombre)', async () => {
    const errores = await validarDto({
      tipoDocumento: 'CC',
      numeroDocumento: '1234567890',
      fechaNacimiento: '2012-03-14',
      rol: 'jugador',
    });

    expect(errores.length).toBeGreaterThan(0);
  });
});
