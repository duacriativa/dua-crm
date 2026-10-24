-- Plano de conteúdo de 3 meses (produto pago de entrada, Pix via Asaas)
CREATE TABLE IF NOT EXISTS "PlanOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "productName" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "cpfCnpj" TEXT NOT NULL,
  "instagramHandle" TEXT NOT NULL,
  "answers" JSONB NOT NULL,
  "diagnosisToken" TEXT,
  "asaasCustomerId" TEXT,
  "asaasPaymentId" TEXT,
  "pixPayload" TEXT,
  "pixQrImage" TEXT,
  "pixExpiresAt" TIMESTAMP(3),
  "paymentCheckedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "plan" JSONB,
  "generationState" TEXT,
  "generationError" TEXT,
  "generationStartedAt" TIMESTAMP(3),
  "generatedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlanOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanOrder_token_key" ON "PlanOrder"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "PlanOrder_asaasPaymentId_key" ON "PlanOrder"("asaasPaymentId");
CREATE INDEX IF NOT EXISTS "PlanOrder_tenantId_status_idx" ON "PlanOrder"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PlanOrder_contactId_idx" ON "PlanOrder"("contactId");

-- O app acessa pelo dua_app; a API pública do Supabase (anon/authenticated) não precisa desta tabela
GRANT SELECT, INSERT, UPDATE, DELETE ON "PlanOrder" TO dua_app;
REVOKE ALL ON "PlanOrder" FROM anon, authenticated;
