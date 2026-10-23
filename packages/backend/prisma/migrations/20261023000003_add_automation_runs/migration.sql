-- Bots: gatilho do formulário do site, descrição e sessões (execuções) persistidas.
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'LEAD_FORM_SUBMITTED';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'LEAD_STAGE_ENTERED';
ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE TABLE IF NOT EXISTS "AutomationRun" (
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
);
CREATE INDEX IF NOT EXISTS "AutomationRun_status_nextRunAt_idx" ON "AutomationRun"("status", "nextRunAt");
CREATE INDEX IF NOT EXISTS "AutomationRun_automationId_idx" ON "AutomationRun"("automationId");
CREATE INDEX IF NOT EXISTS "AutomationRun_contactId_status_idx" ON "AutomationRun"("contactId", "status");
