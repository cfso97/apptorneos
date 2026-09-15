import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppModule (integración HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('arranca la aplicación Nest (AppModule) sin errores', () => {
    expect(app).toBeDefined();
  });

  it('GET /health responde 200 con el envelope {data, meta}', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        status: 'ok',
        timestamp: expect.any(String),
      },
      meta: {},
    });
  });
});
