import { ArgumentsHost, BadRequestException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function buildHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({}) }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('usa el code/message personalizados cuando la excepción los provee', () => {
    const { host, status, json } = buildHost();
    const exception = new ConflictException({ code: 'email_ya_registrado', message: 'Ya existe una cuenta con ese email.' });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'email_ya_registrado', message: 'Ya existe una cuenta con ese email.' },
    });
  });

  it('arma un code por defecto a partir del status cuando la excepción no trae uno propio', () => {
    const { host, status, json } = buildHost();
    const exception = new BadRequestException('dato inválido');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'solicitud_invalida', message: 'dato inválido' },
    });
  });

  it('une los mensajes de class-validator (array) en un solo string', () => {
    const { host, json } = buildHost();
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['el email debe ser válido', 'la contraseña es muy corta'],
    });

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'solicitud_invalida',
        message: 'el email debe ser válido la contraseña es muy corta',
      },
    });
  });

  it('devuelve error_interno para excepciones no controladas', () => {
    const { host, status, json } = buildHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'error_interno', message: 'Ocurrió un error inesperado.' },
    });
  });

  it('mantiene el status code original de cualquier HttpException genérica', () => {
    const { host, status } = buildHost();
    const exception = new HttpException('no encontrado', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });
});
