-- Assinaturas das mensagens salvas no usuário (antes ficavam só no navegador).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signature" TEXT;
