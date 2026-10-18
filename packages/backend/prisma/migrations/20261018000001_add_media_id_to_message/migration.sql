-- AlterTable: add mediaId to Message (ID da mídia na WhatsApp Cloud API, baixada sob demanda)
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mediaId" TEXT;
