import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? '';
  if (!raw) return raw;
  // pgBouncer (Supabase pooler) requer connection_limit=1 para Prisma não esgotar o pool
  if (raw.includes('pgbouncer') && !raw.includes('connection_limit')) {
    return raw + (raw.includes('?') ? '&' : '?') + 'connection_limit=1';
  }
  return raw;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = buildDatabaseUrl();
    super({ datasources: { db: { url } } });

    const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0] ?? 'DATABASE_URL_MISSING';
    this.logger.log(`DATABASE_URL host=${host}`);
  }

  async onModuleInit() {
    this.logger.log('Conectando ao banco...');
    try {
      await this.$connect();
      await this.$queryRaw`SELECT 1 AS ok`;
      this.logger.log('Banco OK ✓');
      await this.ensureSchema();
    } catch (e: any) {
      // NÃO relança — deixa o app subir mesmo com DB inacessível.
      // O health endpoint retorna 503/degraded e os endpoints que usam DB
      // retornam 500 com mensagem clara. Isso é melhor do que o processo morrer
      // e Railway mostrar "Application failed to respond" para TODOS os requests.
      this.logger.error(`BANCO INACESSÍVEL na inicialização: ${e.message}`);
    }
  }

  /**
   * O deploy (Dockerfile) não roda `prisma migrate deploy`. Alterações novas de
   * schema entram aqui, idempotentes (IF NOT EXISTS), espelhando prisma/migrations.
   */
  private async ensureSchema() {
    const statements = [
      // 20261018000001_add_media_id_to_message
      `ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mediaId" TEXT`,
      // 20261018000002_add_push_subscriptions
      `CREATE TABLE IF NOT EXISTS "PushSubscription" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "endpoint" TEXT NOT NULL,
        "p256dh" TEXT NOT NULL,
        "auth" TEXT NOT NULL,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint")`,
      `CREATE INDEX IF NOT EXISTS "PushSubscription_tenantId_idx" ON "PushSubscription"("tenantId")`,
      `CREATE TABLE IF NOT EXISTS "AppSetting" (
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
      )`,
    ];
    for (const sql of statements) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch (e: any) {
        this.logger.error(`[ensureSchema] Falhou: ${sql.split('\n')[0]} — ${e.message}`);
      }
    }
    this.logger.log('[ensureSchema] Schema verificado ✓');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
