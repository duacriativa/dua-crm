-- Agendamento próprio (fase 1): conexão Google, página de agendamento e reuniões
ALTER TYPE "IntegrationType" ADD VALUE IF NOT EXISTS 'GOOGLE';

CREATE TABLE IF NOT EXISTS "BookingPage" (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookingPage_slug_key" ON "BookingPage"("slug");
CREATE INDEX IF NOT EXISTS "BookingPage_tenantId_idx" ON "BookingPage"("tenantId");

CREATE TABLE IF NOT EXISTS "Meeting" (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS "Meeting_manageToken_key" ON "Meeting"("manageToken");
CREATE INDEX IF NOT EXISTS "Meeting_tenantId_startAt_idx" ON "Meeting"("tenantId", "startAt");
CREATE INDEX IF NOT EXISTS "Meeting_contactId_idx" ON "Meeting"("contactId");
