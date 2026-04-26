-- CreateEnum (safe - ignora se já existir)
DO $$ BEGIN
  CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'FINISHED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContractServiceType" AS ENUM ('SOCIAL_MEDIA', 'PAID_TRAFFIC', 'CRM_SETUP', 'CONSULTING', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable (safe)
CREATE TABLE IF NOT EXISTS "Contract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "asaasCustomerId" TEXT,
    "serviceType" "ContractServiceType" NOT NULL,
    "description" TEXT,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "monthlyValue" DOUBLE PRECISION NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "installmentsPaid" INTEGER NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "signedAt" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "clicksignDocId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinancialEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT,
    "asaasPaymentId" TEXT,
    "clientName" TEXT NOT NULL,
    "description" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "isCommission" BOOLEAN NOT NULL DEFAULT false,
    "installmentNum" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- Indexes (safe)
CREATE INDEX IF NOT EXISTS "Contract_tenantId_idx" ON "Contract"("tenantId");
CREATE INDEX IF NOT EXISTS "Contract_tenantId_status_idx" ON "Contract"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "FinancialEntry_tenantId_idx" ON "FinancialEntry"("tenantId");
CREATE INDEX IF NOT EXISTS "FinancialEntry_tenantId_status_idx" ON "FinancialEntry"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "FinancialEntry_tenantId_dueDate_idx" ON "FinancialEntry"("tenantId", "dueDate");
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialEntry_asaasPaymentId_key" ON "FinancialEntry"("asaasPaymentId");

-- ForeignKeys (safe)
DO $$ BEGIN
  ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
