-- Lembretes do bot para quem não respondeu: base e contagem por espera
ALTER TABLE "AutomationRun" ADD COLUMN IF NOT EXISTS "waitingSince" TIMESTAMP(3);
ALTER TABLE "AutomationRun" ADD COLUMN IF NOT EXISTS "remindersSent" INTEGER NOT NULL DEFAULT 0;
