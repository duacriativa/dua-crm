-- "Diagnóstico gratuito" do Instagram (página pública /diagnostico/[token])
CREATE TABLE IF NOT EXISTS "InstagramDiagnosis" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "instagramHandle" TEXT NOT NULL,
  "score" INTEGER,
  "content" JSONB NOT NULL,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "firstViewedAt" TIMESTAMP(3),
  "lastViewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstagramDiagnosis_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstagramDiagnosis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InstagramDiagnosis_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramDiagnosis_token_key" ON "InstagramDiagnosis"("token");
CREATE INDEX IF NOT EXISTS "InstagramDiagnosis_contactId_createdAt_idx" ON "InstagramDiagnosis"("contactId", "createdAt");
CREATE INDEX IF NOT EXISTS "InstagramDiagnosis_tenantId_idx" ON "InstagramDiagnosis"("tenantId");

-- O app acessa pelo dua_app; a API pública do Supabase (anon/authenticated) não precisa desta tabela
GRANT SELECT, INSERT, UPDATE, DELETE ON "InstagramDiagnosis" TO dua_app;
REVOKE ALL ON "InstagramDiagnosis" FROM anon, authenticated;
