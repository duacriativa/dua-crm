-- Tabelas do CRM estavam abertas (sem RLS) para os papéis públicos do Supabase: quem tivesse a
-- chave pública lia/escrevia contatos, mensagens, usuários e tokens pelo PostgREST. O CRM usa o
-- dua_app, com permissões próprias. Aplicado pelo Supabase em 24/10/2026 (tabelas são do postgres).
-- Não ligar RLS: o dua_app não é dono das tabelas e seria bloqueado.
-- clientes, config, kyrefh_leads e campaign_tags ficam de fora: são de outro app e têm políticas próprias.
REVOKE ALL ON TABLE "Activity", "AuditLog", "Automation", "AutomationRun", "Campaign", "Contact", "Contract",
  "Conversation", "FinancialEntry", "Integration", "KommoLead", "Message", "MetaCredential", "Order", "Pipeline",
  "PipelineLead", "PipelineStage", "RefreshToken", "Service", "Tenant", "User", "_prisma_migrations"
  FROM anon, authenticated;
