import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor<unknown>();
  const context = {} as ExecutionContext;

  it('envuelve el valor devuelto por el handler en { data, meta: {} }', (done) => {
    const handler: CallHandler = { handle: () => of({ id: '1', nombre: 'algo' }) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({ data: { id: '1', nombre: 'algo' }, meta: {} });
      done();
    });
  });

  it('envuelve arrays igual que objetos', (done) => {
    const handler: CallHandler = { handle: () => of([1, 2, 3]) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({ data: [1, 2, 3], meta: {} });
      done();
    });
  });

  it('devuelve data: null cuando el handler no retorna nada', (done) => {
    const handler: CallHandler = { handle: () => of(undefined) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({ data: null, meta: {} });
      done();
    });
  });
});
