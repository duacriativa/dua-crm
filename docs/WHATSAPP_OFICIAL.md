# WhatsApp oficial (Cloud API + Coexistência)

O CRM conecta o número da Dua pela API oficial da Meta no modo **Coexistência**:
o número continua no app **WhatsApp Business** do celular e tudo que entra/sai
aparece no CRM. Todo contato novo que manda mensagem cai na 1ª etapa do funil
principal (o funil mais antigo; se não existir, o CRM cria "Funil de Vendas").

## O que já está no código

- Backend `packages/backend/src/modules/whatsapp-cloud/`
  - `GET/POST /api/v1/whatsapp-cloud/webhook` — webhook da Meta (assinatura validada com `META_APP_SECRET`)
  - `POST /api/v1/whatsapp-cloud/embedded-signup` — conclui a conexão
  - `GET /api/v1/whatsapp-cloud/status`, `POST /api/v1/whatsapp-cloud/disconnect`
  - `POST /api/v1/whatsapp-cloud/manual` — alternativa com token de System User
- Envio de texto/mídia no chat usa a API oficial automaticamente quando conectada.
- Eventos tratados: `messages`, status de entrega/leitura, `smb_message_echoes`
  (mensagens enviadas pelo celular), `history` (histórico) e `smb_app_state_sync` (agenda).
- Frontend: botão **Conectar API oficial (coexistência)** na tela do WhatsApp.

## Passo a passo na Meta (feito por um admin da Dua)

1. **Business Manager** (business.facebook.com) da Dua Criativa — de preferência com a
   empresa **verificada** (Configurações → Central de Segurança).
2. **developers.facebook.com → Meus apps → Criar app** → tipo **Empresa**, vinculado ao
   Business Manager da Dua. Adicione o produto **WhatsApp**.
3. Em **Configurações do app → Básico**, copie **ID do app** → `META_APP_ID` e
   **Chave secreta** → `META_APP_SECRET`. Preencha URL da política de privacidade e domínio
   `crm.duacriativa.com.br`.
4. **Facebook Login for Business → Configurações**:
   - Domínios permitidos para o SDK JS: `https://crm.duacriativa.com.br`
   - Crie uma **Configuração** do tipo *WhatsApp Embedded Signup* → copie o
     **ID da configuração** → `META_CONFIG_ID`.
5. **WhatsApp → Configuração → Webhook**:
   - URL de retorno: `https://crm.duacriativa.com.br/api/v1/whatsapp-cloud/webhook`
   - Token de verificação: o mesmo valor de `WA_WEBHOOK_VERIFY_TOKEN`
   - Inscreva os campos: `messages`, `smb_message_echoes`, `history`, `smb_app_state_sync`
6. **Railway → serviço `renewed-youth` (backend) → Variables**: adicione
   `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`, `WA_WEBHOOK_VERIFY_TOKEN`
   (e opcional `GRAPH_API_VERSION`). O deploy reinicia sozinho.
7. Publique o app (modo **Ativo**). Para usar só com o número da própria Dua normalmente
   basta o app em modo ativo com o Business verificado; se a Meta pedir revisão das
   permissões `whatsapp_business_management` / `whatsapp_business_messaging`, envie.
8. No CRM → **WhatsApp → Conectar API oficial (coexistência)** → faça login com o
   Facebook do admin, escolha o Business, e quando pedir, **escaneie o QR code no app
   WhatsApp Business do celular** da Dua. Pronto.

## Requisitos e limites da Coexistência

- O número precisa estar no **app WhatsApp Business** (não o WhatsApp comum), atualizado,
  e ativo há algum tempo. O celular precisa abrir o app pelo menos a cada ~14 dias.
- O histórico (até 6 meses) só pode ser importado nas primeiras 24h após conectar —
  o CRM já pede isso automaticamente.
- Grupos não são suportados pela API oficial.
- Responder quem chamou é gratuito dentro de 24h. Fora disso, só com **template aprovado**
  (pago por mensagem) — o CRM mostra o aviso "Fora da janela de 24h".

## Depois de migrar

- O suporte à Evolution API (QR Code) foi removido do código. A instância Evolution (VPS Hetzner),
  o serviço `evolution-api` no Railway e as variáveis `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`
  podem ser desligados/apagados.

## Eventos de conversão para a Meta (anúncios de WhatsApp)

O CRM devolve para a Meta o que acontece com os leads que chegaram por anúncio
Click-to-WhatsApp (Conversions API para Business Messaging). Assim as campanhas podem
otimizar por **lead qualificado** ou **venda**, não só por "conversa iniciada".

1. A 1ª mensagem vinda de anúncio traz o `referral` com o `ctwa_clid`; o webhook já grava
   isso no contato (`adCtwaClid`, `adId`, `adHeadline`).
2. Cada etapa do funil tem um **Evento Meta** (menu ⋮ da etapa → "Evento Meta (anúncios)"):
   Lead (`LeadSubmitted`), Lead qualificado (`QualifiedLead`), Proposta enviada
   (`InitiateCheckout`), Venda (`Purchase`) ou Não enviar. **Padrão**: 1ª etapa = Lead,
   etapa do tipo Ganho = Venda. Etapas com evento mostram a etiqueta "Meta".
3. Quando um lead **com `adCtwaClid`** entra na etapa (arrastando, pelo bot, pelo
   agendamento ou por contrato), o CRM envia o evento para o dataset ligado à WABA
   (`action_source=business_messaging`). Venda vai com o valor do card. Lead sem anúncio
   não gera envio. Cada evento vai uma vez por clique (ir e voltar não duplica).
4. Log: tabela `MetaEventLog` e `GET /api/v1/pipelines/meta-events`.

Requisitos na Meta (já feitos no app Dua CRM em 19/11/2026):

- Permissão **`whatsapp_business_manage_events`** no caso de uso WhatsApp e na configuração
  do Embedded Signup. O token salvo só ganha a permissão depois de **reconectar o WhatsApp**
  no CRM; antes disso os envios ficam `FAILED` no log.
- O dataset é obtido/criado automaticamente na WABA no primeiro envio.
- Teste: `META_CAPI_TEST_CODE` com o código de **Gerenciador de Eventos → Testar eventos**;
  depois apague. `META_CAPI_ENABLED=false` desliga os envios.

### Leads do site (Pixel)

Lead que não veio de anúncio de WhatsApp (ex.: formulário do site) vai para o **Pixel do site**
(`META_PIXEL_ID` = "Pixel - duacriativa.com", `META_PIXEL_TOKEN` = token da Conversions API
gerado no Gerenciador de Eventos). A Meta casa a pessoa pelo telefone e e-mail (SHA-256),
`external_id` e, se o site mandar no POST `/webhooks/lead`, `fbc`/`_fbc` (ou `fbclid`) e `fbp`/`_fbp`.
O evento "Lead" o site já envia sozinho, então para esses leads o CRM só manda as etapas
seguintes (Lead qualificado, Proposta, Venda), com `action_source=system_generated`.
No log eles aparecem como `pixel:<evento>`.
