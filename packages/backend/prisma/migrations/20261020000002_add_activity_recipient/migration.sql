-- Mensagem interna com destinatário ("para: Daniel"). Guarda o nome da assinatura,
-- porque a equipe divide o mesmo login.
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
