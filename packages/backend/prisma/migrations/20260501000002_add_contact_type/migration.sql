-- Criar enum ContactType
CREATE TYPE "ContactType" AS ENUM ('LEAD', 'CLIENT');

-- Adicionar campos no Contact
ALTER TABLE "Contact" ADD COLUMN "type" "ContactType" NOT NULL DEFAULT 'LEAD';
ALTER TABLE "Contact" ADD COLUMN "clientSince" TIMESTAMP(3);

-- Marcar como CLIENT quem já tem contrato ativo
UPDATE "Contact" c
SET "type" = 'CLIENT',
    "clientSince" = (
      SELECT MIN(ct."signedAt")
      FROM "Contract" ct
      WHERE ct."contactId" = c.id
        AND ct."status" = 'ACTIVE'
    )
WHERE EXISTS (
  SELECT 1 FROM "Contract" ct
  WHERE ct."contactId" = c.id
    AND ct."status" = 'ACTIVE'
);

-- Index
CREATE INDEX "Contact_tenantId_type_idx" ON "Contact"("tenantId", "type");
