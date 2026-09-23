import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    // El envelope {data, meta} lo agrega el ResponseInterceptor global (ver
    // test/app.e2e.spec.ts) — este test unitario verifica el payload crudo
    // que devuelve el controlador, antes de pasar por el interceptor.
    it('devuelve status "ok"', () => {
      const result = controller.getHealth();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toEqual(expect.any(String));
    });

    it('devuelve un timestamp ISO 8601 válido y cercano al momento actual', () => {
      const before = Date.now();
      const result = controller.getHealth();
      const after = Date.now();

      const timestampMs = new Date(result.timestamp).getTime();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Number.isNaN(timestampMs)).toBe(false);
      expect(timestampMs).toBeGreaterThanOrEqual(before);
      expect(timestampMs).toBeLessThanOrEqual(after);
    });
  });
});
