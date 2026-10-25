-- Sino do CRM: histórico de notificações
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "url" TEXT,
  "groupKey" TEXT,
  "count" INTEGER NOT NULL DEFAULT 1,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_tenantId_groupKey_idx" ON "Notification"("tenantId", "groupKey");

REVOKE ALL ON TABLE "Notification" FROM anon, authenticated;
