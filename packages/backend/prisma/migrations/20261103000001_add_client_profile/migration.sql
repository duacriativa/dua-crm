-- Ficha de cadastro do cliente (tabela nova: o dua_app é o dono)
CREATE TABLE IF NOT EXISTS "ClientProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contactId" TEXT,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "clientStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  "source" TEXT NOT NULL DEFAULT 'LINK',
  "name" TEXT NOT NULL,
  "brand" TEXT,
  "legalName" TEXT,
  "cnpj" TEXT,
  "cpf" TEXT,
  "email" TEXT,
  "emailAlt" TEXT,
  "phone" TEXT,
  "instagram" TEXT,
  "zipCode" TEXT,
  "street" TEXT,
  "number" TEXT,
  "complement" TEXT,
  "neighborhood" TEXT,
  "city" TEXT,
  "state" TEXT,
  "birthday" TEXT,
  "story" TEXT,
  "feedback" TEXT,
  "notes" TEXT,
  "linkSentAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClientProfile_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClientProfile_token_key" ON "ClientProfile"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "ClientProfile_contactId_key" ON "ClientProfile"("contactId");
CREATE INDEX IF NOT EXISTS "ClientProfile_tenantId_status_idx" ON "ClientProfile"("tenantId", "status");
REVOKE ALL ON TABLE "ClientProfile" FROM anon, authenticated;
