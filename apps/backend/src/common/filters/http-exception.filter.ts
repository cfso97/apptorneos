import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

/** Payload que puede lanzar cualquier servicio para controlar `code` y `message`
 * exactos que ve el cliente, ej: `throw new ConflictException({ code: 'email_ya_registrado', message: '...' })`. */
interface CustomExceptionPayload {
  code?: string;
  message?: string | string[];
}

const DEFAULT_CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'solicitud_invalida',
  [HttpStatus.UNAUTHORIZED]: 'no_autenticado',
  [HttpStatus.FORBIDDEN]: 'no_autorizado',
  [HttpStatus.NOT_FOUND]: 'no_encontrado',
  [HttpStatus.CONFLICT]: 'conflicto',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'entidad_no_procesable',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'error_interno',
};

/**
 * Convierte cualquier excepción en el formato de error obligatorio de
 * CLAUDE.md: `{ error: { code, message } }`. Nunca deja pasar el formato
 * default de Nest (`{ statusCode, message, error }`).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const envelope = this.buildEnvelope(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json(envelope);
  }

  private buildEnvelope(exception: unknown, status: number): ErrorEnvelope {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      return {
        error: {
          code: this.resolveCode(exceptionResponse, status),
          message: this.resolveMessage(exceptionResponse, exception.message),
        },
      };
    }

    return {
      error: {
        code: DEFAULT_CODE_BY_STATUS[HttpStatus.INTERNAL_SERVER_ERROR],
        message: 'Ocurrió un error inesperado.',
      },
    };
  }

  private resolveCode(exceptionResponse: unknown, status: number): string {
    if (this.isCustomPayload(exceptionResponse) && exceptionResponse.code) {
      return exceptionResponse.code;
    }

    return DEFAULT_CODE_BY_STATUS[status] ?? 'error';
  }

  private resolveMessage(exceptionResponse: unknown, fallback: string): string {
    if (this.isCustomPayload(exceptionResponse) && exceptionResponse.message) {
      return Array.isArray(exceptionResponse.message) ? exceptionResponse.message.join(' ') : exceptionResponse.message;
    }

    return fallback;
  }

  private isCustomPayload(value: unknown): value is CustomExceptionPayload {
    return typeof value === 'object' && value !== null;
  }
}
