import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

// Captura rejeições não tratadas em vez de crashar o processo.
// Em Node 18+ uma unhandledRejection sem handler mata o processo — isso previne
// o ERR_CONNECTION_CLOSED que o cliente vê quando o backend morre mid-request.
process.on('unhandledRejection', (reason: any) => {
  console.error('[UnhandledRejection] processo não vai crashar — reason:', reason?.message ?? reason);
});
process.on('uncaughtException', (err: Error) => {
  console.error('[UncaughtException] processo não vai crashar — error:', err?.message, err?.stack);
});

async function bootstrap() {
  console.log('[Bootstrap] Iniciando NestJS...');

  // Log env var presence (not values) for diagnosis
  const requiredVars = [
    'DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET',
    'JWT_ACCESS_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN', 'ENCRYPTION_KEY',
  ];
  for (const v of requiredVars) {
    const val = process.env[v];
    console.log(`[Bootstrap] ${v}: ${val ? `SET(len=${val.length})` : 'MISSING'}`);
  }

  const app = await NestFactory.create(AppModule);
  console.log('[Bootstrap] AppModule inicializado com sucesso');

  // ── Body size limit (webhook Evolution API envia QR codes em base64) ───────
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // ── CORS manual via Express puro (antes de qualquer middleware NestJS) ──
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use((req: any, res: any, next: any) => {
    const origin: string | undefined = req.headers['origin'];
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    next();
  });

  // ── Segurança: headers HTTP ──────────────────────────────────────────────
  app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));

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

  // ── Health check com teste de banco ─────────────────────────────────────────
  const httpAdapter = app.getHttpAdapter();
  const prismaService = app.get('PrismaService') as any;
  httpAdapter.get('/health', async (_req: any, res: any) => {
    const dbOk = await prismaService.ping().catch(() => false);
    const status = dbOk ? 200 : 503;
    res.status(status).send({ status: dbOk ? 'ok' : 'degraded', db: dbOk ? 'ok' : 'error' });
  });

  // ── Prefixo global da API ─────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? process.env.APP_PORT ?? 3001;
  await app.listen(port);
  console.log(`ModaCRM Backend rodando na porta ${process.env.APP_PORT ?? 3001}`);
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] ERRO FATAL ao iniciar o servidor:', err);
  process.exit(1);
});
