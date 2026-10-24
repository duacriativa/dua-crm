-- Fase 2 do agendamento: gatilho "Reunião agendada" e sessão do bot ligada à reunião
-- (tabela e enum são do postgres: aplicar pelo Supabase, o dua_app não consegue)
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'MEETING_SCHEDULED';
ALTER TABLE "AutomationRun" ADD COLUMN IF NOT EXISTS "meetingId" TEXT;
CREATE INDEX IF NOT EXISTS "AutomationRun_meetingId_idx" ON "AutomationRun"("meetingId");
