import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Segurança: headers HTTP ──────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // ── Validação global de DTOs ──────────────────────────────────────────────
  // whitelist: remove campos não declarados no DTO (evita mass assignment)
  // forbidNonWhitelisted: retorna erro se campo extra for enviado
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Prefixo global da API ─────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  await app.listen(process.env.APP_PORT ?? 3001);
  console.log(`ModaCRM Backend rodando na porta ${process.env.APP_PORT ?? 3001}`);
}

bootstrap();
