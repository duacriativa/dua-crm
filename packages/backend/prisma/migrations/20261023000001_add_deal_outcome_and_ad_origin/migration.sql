-- Etapa de ganho/perda no funil, valor fechado com data, e origem do lead (anúncio de clique para WhatsApp).
-- A marcação inicial das etapas pelo nome roda só quando a coluna "kind" é criada,
-- para não sobrescrever o que o usuário mudar depois (o mesmo bloco roda no ensureSchema).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'PipelineStage' AND column_name = 'kind'
  ) THEN
    ALTER TABLE "PipelineStage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'OPEN';
    UPDATE "PipelineStage" SET "kind" = 'WON' WHERE "name" ILIKE 'fechad%' OR "name" ILIKE 'ganh%';
    UPDATE "PipelineStage" SET "kind" = 'LOST' WHERE "name" ILIKE 'perd%';
  END IF;
END $$;

ALTER TABLE "PipelineLead" ADD COLUMN IF NOT EXISTS "wonAt" TIMESTAMP(3);
ALTER TABLE "PipelineLead" ADD COLUMN IF NOT EXISTS "lostAt" TIMESTAMP(3);
ALTER TABLE "PipelineLead" ADD COLUMN IF NOT EXISTS "lostReason" TEXT;

-- Quem já está numa etapa de ganho/perda conta a partir da última alteração do card
UPDATE "PipelineLead" l SET "wonAt" = l."updatedAt"
  FROM "PipelineStage" s WHERE s."id" = l."stageId" AND s."kind" = 'WON' AND l."wonAt" IS NULL;
UPDATE "PipelineLead" l SET "lostAt" = l."updatedAt"
  FROM "PipelineStage" s WHERE s."id" = l."stageId" AND s."kind" = 'LOST' AND l."lostAt" IS NULL;

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadOrigin" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adHeadline" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adSourceUrl" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adCtwaClid" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "adReferredAt" TIMESTAMP(3);
