# Instagram no Dua CRM (DMs, comentários e stories)

Integração com o Instagram **@duacriativa** pela API do Instagram com **Login do Facebook**
(Messenger Platform), no mesmo app da Meta do WhatsApp: **Dua CRM** (ID `1514932276634545`),
empresa Dua Marketing de Moda, usuário de sistema **CRM Dua**.

## O que faz

- **Caixa de entrada**: toda DM do Instagram vira uma conversa do canal INSTAGRAM em
  Conversas, ao lado do WhatsApp. O contato é criado pelo id do Instagram (com nome, @ e foto),
  com origem "Instagram", e entra na 1ª etapa do funil (igual ao WhatsApp, pelo `FunnelService`).
  Respostas a story aparecem com "Respondeu ao seu story" e a imagem; menções ao @ em stories
  aparecem como "[mencionou você no story]". Mensagens enviadas pelo app do Instagram também
  entram no CRM (eco).
- **Envio pelo CRM** respeitando as regras da Meta:
  - até 24h depois da última mensagem do contato: envio normal;
  - de 24h a 7 dias: vai com a tag `HUMAN_AGENT` (atendimento humano) e a tela avisa;
  - depois de 7 dias: bloqueado, até o contato escrever de novo.
  - Instagram não tem template (o botão some) e o envio de arquivos ainda não existe no CRM.
- **Regras de palavra-chave** (Bots & Automações → "Instagram — palavras-chave"):
  - **Comentário em post/reel** → resposta privada na DM (Private Replies API: 1 por
    comentário, em até 7 dias) e, se quiser, resposta pública no comentário (sorteia uma das
    frases). Dá para limitar a posts/reels escolhidos.
  - **Resposta a story** com a palavra → DM automática.
  - **Menção no story** → DM automática (não tem texto, então não usa palavra-chave).
  - **Palavra-chave na DM** → resposta automática (vale também para o toque num botão de resposta).
  - **Boas-vindas (1ª DM)** → quem nunca falou com a Dua e manda a primeira DM recebe a
    apresentação, se nenhuma palavra-chave respondeu antes. É o substituto possível do
    "seguiu → DM" (ver abaixo).
  - **Botões** (até 3 por mensagem): com link abre o site (ex.: "Ver site", "Pedir orçamento");
    sem link, o toque volta como mensagem com o título do botão, e uma regra "Palavra-chave na
    DM" com esse texto continua a conversa. Se o Instagram recusar o modelo com botões, a
    mensagem vai como texto com os links.
  - **Funil por regra**: cada regra escolhe a etapa onde o contato entra. Há dois funis:
    **Vendas** (o principal: LP, WhatsApp, DMs diretas) e **Instagram** (leads frios dos
    brindes e conteúdos), criado pelo botão "Criar funil Instagram" no editor da regra, com as
    etapas Recebeu o brinde → Respondeu → Qualificado → Enviado para Vendas. Quem está no
    funil Instagram não entra em Vendas sozinho quando responde: o time move o card quando
    o lead esquentar. Regra sem funil escolhido = 1ª etapa de Vendas. O funil de creators
    fica para depois (o processo ainda está sendo montado no lab de creators).
  - Textos aceitam `{{primeiro_nome}}`, `{{nome}}` e `{{usuario}}` (o @). A regra pode
    colocar uma etiqueta no contato. A mesma regra não responde o mesmo contato duas vezes
    em 1h; um comentário nunca é respondido duas vezes (tabela `InstagramCommentReply`).

### Por que não tem "seguiu → DM"

O ManyChat (e o Kommo) têm o "Follow to DM", mas é um acesso que a Meta libera só para
alguns parceiros: a API pública que o app Dua CRM usa **não tem webhook de novo seguidor**
e não deixa mandar DM para quem não escreveu antes. Mesmo nesses parceiros o gatilho está
instável em 2026 (o ManyChat registrou em março um bug do lado da Meta). Por isso ficou de
fora. Alternativas: a regra de boas-vindas na 1ª DM, comentários e stories com palavra-chave,
ou manter o ManyChat só para o "seguiu → DM" (sem regras de DM no ManyChat, para as duas
ferramentas não responderem a mesma mensagem).

## Código

- Backend: `packages/backend/src/modules/instagram/`
  - `GET/POST /api/v1/instagram/webhook` — webhook da Meta (assinatura com `META_APP_SECRET`)
  - `GET /api/v1/instagram/status`, `POST /api/v1/instagram/connect`, `DELETE /api/v1/instagram`
  - `GET /api/v1/instagram/media` — posts/reels para escolher na regra de comentário
  - `GET|POST /api/v1/instagram/automations`, `PATCH|DELETE /api/v1/instagram/automations/:id`,
    `GET /api/v1/instagram/automations/comments` (últimos comentários tratados)
  - O envio pela caixa de entrada passa por `ConversationsService.sendMessage`, que chama
    `InstagramService.sendFromInbox` quando a conversa é do Instagram.
- Tabelas novas (criadas pelo `ensureSchema` no startup, sem acesso para `anon`/`authenticated`):
  `InstagramAccount` (Página, conta do Instagram e token da Página criptografado),
  `InstagramAutomation` (regras) e `InstagramCommentReply`.
- As regras do Instagram ficam numa tabela própria, não no editor de bots: os bots atuais são
  do WhatsApp (telefone, templates, botões) e um gatilho novo no enum `AutomationTrigger`
  precisaria de mudança no banco pelo dono da tabela. Ligar fluxos de vários passos à palavra-chave
  na DM fica para uma próxima etapa.
- Frontend: card em Configurações → Integrações (`components/integrations/instagram-card.tsx`),
  regras em Bots (`components/instagram/instagram-rules.tsx`) e ajustes em Conversas.

## Variáveis de ambiente (backend no Railway)

| Variável | Uso |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | token do usuário de sistema **CRM Dua** (já usado na análise de perfis). O botão "Conectar Instagram" usa ele para achar a Página e guardar o token da Página. |
| `IG_WEBHOOK_VERIFY_TOKEN` | opcional; sem ele, vale o `WA_WEBHOOK_VERIFY_TOKEN` |
| `META_APP_ID`, `META_APP_SECRET` | já existem (assinatura do webhook e conferência das permissões) |

## Configuração na Meta (passo a passo)

Situação em 24/10/2026, no caso de uso "Gerenciar mensagens e conteúdo no Instagram" do app:
já tem `instagram_basic`, `pages_show_list`, `pages_read_engagement` e `public_profile`.

1. **Adicionar permissões** em Casos de uso → Instagram → Permissões e recursos:
   - `instagram_manage_messages` (DMs)
   - `instagram_manage_comments` (ler comentários e responder)
   - `pages_manage_metadata` (inscrever o app na Página para receber os webhooks; não aparece
     na lista do caso de uso do Instagram: entra por "Adicionar mais ao caso de uso" ou pelo
     caso de uso de Páginas)
   - `business_management` (pedido pela Meta no pacote de mensagens)
   - recursos **Human Agent** (tag de 7 dias) e **Business Asset User Profile Access**
     (nome e foto de quem manda DM)

   Como o app é da própria empresa e só acessa ativos dela, o acesso padrão basta: não
   precisa de Análise do App para usar com o @duacriativa.
2. **Gerar um token novo** do usuário de sistema **CRM Dua** (Configurações do negócio →
   Usuários do sistema → Gerar token → app Dua CRM) marcando as permissões acima, sem
   expiração. O usuário de sistema precisa ter a Página "DUA - Criativa" e o @duacriativa
   como ativos com controle total (hoje só tem Insights: trocar para "Gerenciar"/controle total,
   inclusive "Mensagens"). Atualizar `INSTAGRAM_ACCESS_TOKEN` no Railway com esse token.
3. **Webhook do Instagram**: no painel do app → Webhooks → objeto **Instagram** →
   URL de callback `https://crm.duacriativa.com.br/api/v1/instagram/webhook`, token de
   verificação = `WA_WEBHOOK_VERIFY_TOKEN` (ou `IG_WEBHOOK_VERIFY_TOKEN`). Assinar os campos
   `messages`, `messaging_postbacks`, `comments`, `messaging_seen` e `message_reactions`.
4. **Conectar no CRM**: Configurações → Integrações → Instagram → Conectar. O CRM guarda o
   token da Página e inscreve o app na Página (`subscribed_apps`). O card mostra se falta
   alguma permissão e quais outros apps recebem os eventos da Página.
5. **No app do Instagram** (celular, conta @duacriativa): Configurações → Mensagens e
   respostas aos stories → Ferramentas conectadas → ligar **Permitir acesso às mensagens**.
   Sem isso a Meta não entrega as DMs para a API.

### Kommo

O Kommo aparece como integração comercial ativa no Facebook do usuário. Se ele ainda estiver
ligado às DMs do Instagram, as duas ferramentas recebem as mensagens e o bot do Kommo pode
responder junto. O card do Instagram no CRM lista os apps inscritos na Página: se aparecer o
Kommo, desconectar o canal do Instagram dentro do Kommo (ou remover a integração dele em
Configurações do Facebook → Integrações comerciais) antes de ligar as regras.

## Como testar

1. De outra conta do Instagram, mandar DM para o @duacriativa → aparece em Conversas com o
   ícone do Instagram e o lead no funil.
2. Responder pelo CRM → chega no Direct.
3. Criar a regra "Comentário" com a palavra `teste` → comentar `teste` num post → a DM chega
   e, se configurada, a resposta pública aparece no comentário. Em Bots, o contador sobe.
4. Responder um story com a palavra da regra "Resposta a story" → DM automática.
