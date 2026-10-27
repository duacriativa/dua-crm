-- Bot que desistiu por falta de resposta: guarda em qual espera, para retomar se a pessoa responder depois
ALTER TABLE "AutomationRun" ADD COLUMN IF NOT EXISTS "timedOutStep" TEXT;
