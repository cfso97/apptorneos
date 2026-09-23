import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  data: T;
  meta: Record<string, unknown>;
}

/**
 * Envuelve toda respuesta exitosa en `{ data, meta }` (formato obligatorio de
 * CLAUDE.md). Los controladores devuelven el payload "crudo" — este
 * interceptor global se encarga del sobre, para no repetirlo a mano en cada
 * endpoint.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((data) => ({
        data: data ?? (null as unknown as T),
        meta: {},
      })),
    );
  }
}
