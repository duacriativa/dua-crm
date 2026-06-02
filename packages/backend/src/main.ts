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

  // ── CORS (deve vir ANTES do helmet) ──────────────────────────────────────
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // permitir requests sem origin (mobile, curl, Postman)
      if (!origin) return callback(null, true);
      // whitelist configurável via env + fallback para desenvolvimento
      const whitelist = allowedOrigins.length
        ? allowedOrigins
        : ['http://localhost:3000', 'http://localhost:3001'];
      if (whitelist.includes(origin)) return callback(null, true);
      callback(new Error(`CORS bloqueado para origem: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Segurança: headers HTTP ──────────────────────────────────────────────
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

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
