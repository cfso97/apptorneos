import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    // En producción solo se permite FRONTEND_URL. En desarrollo se acepta
    // cualquier puerto de localhost, porque Next.js cambia de puerto
    // automáticamente cuando el 3000/3001 ya están ocupados en la máquina.
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : [process.env.FRONTEND_URL ?? 'http://localhost:3000', /^http:\/\/localhost:\d+$/],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Torneos SaaS API')
    .setDescription('API del panel organizador y app móvil de Torneos SaaS')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

bootstrap();
