import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Body size limit (webhook Evolution API envia QR codes em base64) ───────
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // ── Segurança: headers HTTP ──────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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

  // ── Health check (sem prefixo) ────────────────────────────────────────────
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => res.send({ status: 'ok' }));

  // ── Prefixo global da API ─────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? process.env.APP_PORT ?? 3001;
  await app.listen(port);
  console.log(`ModaCRM Backend rodando na porta ${process.env.APP_PORT ?? 3001}`);
}

bootstrap();
