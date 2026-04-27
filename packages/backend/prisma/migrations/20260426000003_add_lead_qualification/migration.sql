-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LeadQualification" AS ENUM ('ULTRA', 'QUALIFIED', 'COLD', 'UNQUALIFIED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddColumns to Contact
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "qualification" "LeadQualification" NOT NULL DEFAULT 'UNQUALIFIED';
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "monthlyRevenue" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "saleModel" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;

-- Index for qualification
CREATE INDEX IF NOT EXISTS "Contact_tenantId_qualification_idx" ON "Contact"("tenantId", "qualification");
