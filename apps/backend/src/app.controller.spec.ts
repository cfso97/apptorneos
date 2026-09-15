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
    it('devuelve el envelope {data, meta} con status "ok"', () => {
      const result = controller.getHealth();

      expect(result.meta).toEqual({});
      expect(result.data.status).toBe('ok');
      expect(result.data.timestamp).toEqual(expect.any(String));
    });

    it('devuelve un timestamp ISO 8601 válido y cercano al momento actual', () => {
      const before = Date.now();
      const result = controller.getHealth();
      const after = Date.now();

      const timestampMs = new Date(result.data.timestamp).getTime();

      expect(result.data.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(Number.isNaN(timestampMs)).toBe(false);
      expect(timestampMs).toBeGreaterThanOrEqual(before);
      expect(timestampMs).toBeLessThanOrEqual(after);
    });
  });
});
