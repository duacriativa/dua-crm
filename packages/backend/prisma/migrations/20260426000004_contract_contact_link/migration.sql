ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Contract" ADD CONSTRAINT "Contract_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Contract_contactId_idx" ON "Contract"("contactId");
