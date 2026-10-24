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
      // 20261023000001_add_deal_outcome_and_ad_origin
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name = 'PipelineStage' AND column_name = 'kind'
        ) THEN
          ALTER TABLE "PipelineStage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'OPEN';
          UPDATE "PipelineStage" SET "kind" = 'WON' WHERE "name" ILIKE 'fechad%' OR "name" ILIKE 'ganh%';
          UPDATE "PipelineStage" SET "kind" = 'LOST' WHERE "name" ILIKE 'perd%';
        END IF;
      END $$`,
      `ALTER TABLE "PipelineLead" ADD COLUMN IF NOT EXISTS "wonAt" TIMESTAMP(3)`,
      `ALTER TABLE "PipelineLead" ADD COLUMN IF NOT EXISTS "lostAt" TIMESTAMP(3)`,
      `ALTER TABLE "PipelineLead" ADD COLUMN IF NOT EXISTS "lostReason" TEXT`,
      `UPDATE "PipelineLead" l SET "wonAt" = l."updatedAt"
        FROM "PipelineStage" s WHERE s."id" = l."stageId" AND s."kind" = 'WON' AND l."wonAt" IS NULL`,
      `UPDATE "PipelineLead" l SET "lostAt" = l."updatedAt"
        FROM "PipelineStage" s WHERE s."id" = l."stageId" AND s."kind" = 'LOST' AND l."lostAt" IS NULL`,
      `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadOrigin" TEXT`,
      `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adId" TEXT`,
      `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adHeadline" TEXT`,
      `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adSourceUrl" TEXT`,
      `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adCtwaClid" TEXT`,
      `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adReferredAt" TIMESTAMP(3)`,
      // 20261023000002_add_user_signatures
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signature" TEXT`,
      // 20261023000003_add_automation_runs
      `ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'LEAD_FORM_SUBMITTED'`,
      `ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'LEAD_STAGE_ENTERED'`,
      `ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'WHATSAPP_FIRST_MESSAGE'`,
      `ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "description" TEXT`,
      `CREATE TABLE IF NOT EXISTS "AutomationRun" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "automationId" TEXT NOT NULL,
        "contactId" TEXT NOT NULL,
        "conversationId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'RUNNING',
        "stepIndex" INTEGER NOT NULL DEFAULT 0,
        "nextRunAt" TIMESTAMP(3),
        "sentCount" INTEGER NOT NULL DEFAULT 0,
        "isTest" BOOLEAN NOT NULL DEFAULT false,
        "repliedAt" TIMESTAMP(3),
        "lastError" TEXT,
        "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "finishedAt" TIMESTAMP(3),
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "AutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS "AutomationRun_status_nextRunAt_idx" ON "AutomationRun"("status", "nextRunAt")`,
      `CREATE INDEX IF NOT EXISTS "AutomationRun_automationId_idx" ON "AutomationRun"("automationId")`,
      `CREATE INDEX IF NOT EXISTS "AutomationRun_contactId_status_idx" ON "AutomationRun"("contactId", "status")`,
      // 20261024000006_add_instagram_diagnosis
      `CREATE TABLE IF NOT EXISTS "InstagramDiagnosis" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "contactId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "instagramHandle" TEXT NOT NULL,
        "score" INTEGER,
        "content" JSONB NOT NULL,
        "viewCount" INTEGER NOT NULL DEFAULT 0,
        "firstViewedAt" TIMESTAMP(3),
        "lastViewedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InstagramDiagnosis_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InstagramDiagnosis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "InstagramDiagnosis_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "InstagramDiagnosis_token_key" ON "InstagramDiagnosis"("token")`,
      `CREATE INDEX IF NOT EXISTS "InstagramDiagnosis_contactId_createdAt_idx" ON "InstagramDiagnosis"("contactId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "InstagramDiagnosis_tenantId_idx" ON "InstagramDiagnosis"("tenantId")`,
      // 20261024000003_add_meeting_automations (tabela/enum do postgres: aplicado pelo Supabase; aqui só não quebra)
      `ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'MEETING_SCHEDULED'`,
      `ALTER TABLE "AutomationRun" ADD COLUMN IF NOT EXISTS "meetingId" TEXT`,
      `CREATE INDEX IF NOT EXISTS "AutomationRun_meetingId_idx" ON "AutomationRun"("meetingId")`,
      // 20261024000002_add_scheduling (o ALTER TYPE precisa do dono do enum: aplicado pelo Supabase)
      `ALTER TYPE "IntegrationType" ADD VALUE IF NOT EXISTS 'GOOGLE'`,
      `CREATE TABLE IF NOT EXISTS "BookingPage" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "durationMin" INTEGER NOT NULL DEFAULT 45,
        "bufferAfterMin" INTEGER NOT NULL DEFAULT 15,
        "slotStepMin" INTEGER NOT NULL DEFAULT 60,
        "minNoticeMin" INTEGER NOT NULL DEFAULT 240,
        "maxDaysAhead" INTEGER NOT NULL DEFAULT 30,
        "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
        "weeklyHours" JSONB NOT NULL,
        "dateOverrides" JSONB NOT NULL DEFAULT '{}',
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "BookingPage_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "BookingPage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "BookingPage_slug_key" ON "BookingPage"("slug")`,
      `CREATE INDEX IF NOT EXISTS "BookingPage_tenantId_idx" ON "BookingPage"("tenantId")`,
      `CREATE TABLE IF NOT EXISTS "Meeting" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "bookingPageId" TEXT,
        "contactId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "startAt" TIMESTAMP(3) NOT NULL,
        "endAt" TIMESTAMP(3) NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT,
        "notes" TEXT,
        "meetLink" TEXT,
        "googleEventId" TEXT,
        "manageToken" TEXT NOT NULL,
        "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
        "cancelledAt" TIMESTAMP(3),
        "cancelledBy" TEXT,
        "cancelReason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Meeting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Meeting_bookingPageId_fkey" FOREIGN KEY ("bookingPageId") REFERENCES "BookingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Meeting_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "Meeting_manageToken_key" ON "Meeting"("manageToken")`,
      `CREATE INDEX IF NOT EXISTS "Meeting_tenantId_startAt_idx" ON "Meeting"("tenantId", "startAt")`,
      `CREATE INDEX IF NOT EXISTS "Meeting_contactId_idx" ON "Meeting"("contactId")`,
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
