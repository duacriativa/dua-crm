-- Instagram: conta conectada, regras de palavra-chave e comentários já respondidos.
-- Tabelas novas (o dua_app é o dono): o ensureSchema também cria no startup.
CREATE TABLE IF NOT EXISTS "InstagramAccount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "pageName" TEXT,
  "igUserId" TEXT NOT NULL,
  "username" TEXT,
  "pageToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramAccount_tenantId_key" ON "InstagramAccount"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramAccount_igUserId_key" ON "InstagramAccount"("igUserId");
CREATE TABLE IF NOT EXISTS "InstagramAutomation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "mediaIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "dmText" TEXT NOT NULL,
  "publicReplies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "buttons" JSONB NOT NULL DEFAULT '[]',
  "stageId" TEXT,
  "tag" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "runCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstagramAutomation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InstagramAutomation_tenantId_trigger_active_idx" ON "InstagramAutomation"("tenantId", "trigger", "active");
CREATE TABLE IF NOT EXISTS "InstagramCommentReply" (
  "commentId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "automationId" TEXT,
  "mediaId" TEXT,
  "username" TEXT,
  "text" TEXT,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstagramCommentReply_pkey" PRIMARY KEY ("commentId")
);
CREATE INDEX IF NOT EXISTS "InstagramCommentReply_tenantId_createdAt_idx" ON "InstagramCommentReply"("tenantId", "createdAt");
REVOKE ALL ON TABLE "InstagramAccount", "InstagramAutomation", "InstagramCommentReply" FROM anon, authenticated;
