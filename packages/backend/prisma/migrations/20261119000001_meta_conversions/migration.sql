-- Conversions API (Business Messaging): evento por etapa do funil, dataset da WABA e log de envios
ALTER TABLE "MetaCredential" ADD COLUMN IF NOT EXISTS "datasetId" TEXT;
ALTER TABLE "PipelineStage" ADD COLUMN IF NOT EXISTS "metaEvent" TEXT;

CREATE TABLE IF NOT EXISTS "MetaEventLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "stageId" TEXT,
  "value" DOUBLE PRECISION,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaEventLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MetaEventLog_tenantId_createdAt_idx" ON "MetaEventLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "MetaEventLog_tenantId_eventId_idx" ON "MetaEventLog"("tenantId", "eventId");
REVOKE ALL ON TABLE "MetaEventLog" FROM anon, authenticated;
