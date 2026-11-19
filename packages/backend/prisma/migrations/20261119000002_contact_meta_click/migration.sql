-- Clique em anúncio que levou ao site (fbc/fbp) para casar os eventos do CRM no Pixel
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "metaFbc" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "metaFbp" TEXT;
