-- Aniversário do contato ("MM-DD", sem ano). Aplicado em produção via Supabase em 30/10/2026.
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "birthday" TEXT;
