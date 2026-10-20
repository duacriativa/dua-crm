# Contexto: tela de Conversas (WhatsApp) — handoff

Leia isto antes de mexer em `packages/frontend/src/app/dashboard/conversas/page.tsx`
ou no módulo `packages/backend/src/modules/whatsapp-cloud`.

## Como o projeto roda
- Monorepo: `packages/frontend` (Next.js) e `packages/backend` (NestJS + Prisma).
- Deploy: Railway, serviço `dua-crm`, a cada push na `main` (crm.duacriativa.com.br).
  Durante o deploy o envio de mensagens pode falhar por alguns minutos → combine o push com o usuário.
- Banco: Supabase, projeto `ugvmbtufwtpfqmvfmsde` (tabela `Message`, `Conversation`, `MetaCredential`).
- WhatsApp: **API oficial da Meta (Cloud API)**. Credenciais em `MetaCredential` (phoneNumberId, wabaId, accessToken).
- Antes de push: `cd packages/backend && npx tsc --noEmit -p tsconfig.build.json` e
  `cd packages/frontend && npx tsc --noEmit -p .` (o build do backend já quebrou uma vez por não checar).

## Já feito (out/2026)
- Menu WhatsApp abre `/dashboard/conversas` (a tela branca).
- Assinatura: seletor ao lado do campo (Financeiro, Daniel, Ariela…), salvo no localStorage
  (`crm_signatures`). Mensagem sai como `*Nome:*\ntexto`; `formatWhatsApp()` mostra *negrito*.
- Ctrl+Enter quebra linha; campo cresce com o texto (max-h-60).
- Texto do campo agora é escuro (estava branco no fundo branco).
- Mensagem não entregue: mostra "Não entregue" e o motivo no tooltip (`errorCode`/`errorMessage`).
  131047 = fora da janela de 24h → só template aprovado.
- Download de documentos e carregamento automático de imagens/figurinhas via
  `POST /conversations/:id/messages/:msgId/remedia` (o webhook só traz `mediaId`).
- Colar print com Ctrl+V (pede confirmação e envia como imagem).
- Rolagem até o fim ao enviar e após imagem carregar (`scrollToBottom` via `messagesEndRef`).
- Respostas citadas: backend grava `quotedContent/quotedType`; front mostra "Você"/nome no estilo WhatsApp.
- Sugestão de resposta com IA: `POST /conversations/:id/suggest-reply` (Claude via API Anthropic).
  Precisa de `ANTHROPIC_API_KEY` nas Variables do Railway. Opcionais: `ANTHROPIC_MODEL`, `AI_REPLY_CONTEXT`.

## Limitação conhecida
Mensagens enviadas pelo **Kommo** (outro app na mesma WABA) não chegam ao CRM — a Meta só
repassa mensagens recebidas, as enviadas pelo próprio CRM e as do app Business no celular
(`smb_message_echoes`, já tratado).

## Próximos passos combinados
1. **Área de Templates** (Configurações → Templates): listar `GET /{wabaId}/message_templates`
   (os templates aprovados no Kommo já aparecem, estão na mesma WABA), criar template para aprovação,
   e na conversa fora das 24h oferecer "Enviar template" no lugar do texto livre.
2. **Boas-vindas automática** para lead novo (substituir a automação do Kommo):
   sequência de mensagens configurável, liga/desliga. O usuário vai mandar prints do Kommo.
3. **Automações gerais** usando a tela `dashboard/bots` (já existe UI). Tabela `Automation` existe,
   mas `backend/src/modules/automations` está vazio e os gatilhos atuais são de e-commerce.

Outras ideias sugeridas e ainda não feitas: responsável pela conversa, mover no funil pela conversa,
etiqueta de tipo de contato, lembrete de retorno, respostas rápidas, salvar arquivo no cliente,
botão "tentar de novo" em mensagem que falhou.
