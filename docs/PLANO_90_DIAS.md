# Plano de Conteúdo 90 Dias (produto pago de entrada)

Plano de conteúdo e estratégia de 3 meses, personalizado com IA, por **R$ 297 no Pix**, entregue em até **24h** depois do pagamento.
Funil: diagnóstico gratuito (`/diagnostico/[token]`) → chamada no PDF → página de venda → Pix → plano revisado pela equipe.

## Links

- Página de venda (sem login): `https://crm.duacriativa.com.br/plano-90-dias`
- Vindo do diagnóstico, com nome, WhatsApp, e-mail e @ já preenchidos: `https://crm.duacriativa.com.br/plano-90-dias?d=<token do diagnóstico>`
- Acompanhamento do cliente (Pix, prazo e PDF): `/plano-90-dias/pedido/<token do pedido>`
- Equipe: menu **Planos 90 dias** (`/dashboard/planos`)

## Fluxo

1. O cliente preenche o formulário (nome, WhatsApp, e-mail, CPF/CNPJ, @, produto/nicho, ticket médio, público, quem posta, verba).
   O CPF/CNPJ é exigido pelo Asaas para emitir a cobrança. O contato é criado ou atualizado no CRM com a tag `plano-90d-pedido`.
2. O backend cria o cliente e a cobrança Pix no Asaas e mostra o QR Code e o copia-e-cola. Reenviar o formulário com o Pix
   ainda aberto (mesmo CPF, menos de 20h) reaproveita a cobrança.
3. Pagamento: o webhook do Asaas (`PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`) chega em `POST /api/v1/webhooks/asaas`. O CRM **não confia
   no corpo**: confere o status da cobrança na API do Asaas. A página do cliente também consulta o Asaas a cada 15s (se o webhook atrasar).
   Pago → status **Pago**, prazo = pagamento + 24h, tag `plano-90d-pago`, card no funil, nota no contato e push para a equipe.
4. A geração começa sozinha (**Em produção**): Claude + dados reais do Instagram (Business Discovery) + respostas do formulário, em 6 chamadas
   (estratégia e pilares primeiro; depois calendário em 2 metades, Reels, legendas/stories e contratações/metas em paralelo). Leva de 1 a 3 min.
5. **Em revisão** (obrigatória): a equipe lê, edita qualquer campo, pode **Gerar de novo** uma parte ou o plano inteiro, vê a **Prévia do PDF**
   e clica **Aprovar e liberar entrega**. Nada vai para o cliente antes disso; editar depois de aprovar tira a aprovação.
6. Entrega manual: **Copiar texto** / **Abrir no WhatsApp** (WhatsApp Business no celular, sem template) com o link do PDF, depois
   **Marcar como entregue**. O botão de baixar o PDF também aparece na página de acompanhamento do cliente.

A lista destaca os pedidos **atrasados** (passou do prazo e não foi entregue). Status: aguardando pagamento → pago → em produção → em revisão → entregue (ou cancelado).
Se a geração falhar ou for interrompida (ex.: deploy no meio), o pedido mostra o erro e o botão de gerar de novo.

## Configurar no Railway (backend)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `ASAAS_API_KEY` | sim (já existe) | Chave da conta Asaas. Precisa de permissão para criar clientes e cobranças. |
| `ASAAS_BASE_URL` | não | Padrão produção `https://api.asaas.com/v3`. Para teste: `https://api-sandbox.asaas.com/v3` com a chave do sandbox (afeta também a tela Financeiro). |
| `ASAAS_WEBHOOK_TOKEN` | recomendado | Mesmo valor do "Token de autenticação" do webhook no Asaas. Se definido, webhooks sem o token são ignorados para os pedidos do plano. |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | sim (já existem) | Geração do plano. |
| `INSTAGRAM_ACCESS_TOKEN` | recomendado (já existe) | Dados reais do perfil. Sem ele o plano sai só com as respostas do formulário (aviso na revisão). |
| `PLAN_PRODUCT_NAME` | não | Nome do produto (padrão `Plano de Conteúdo 90 Dias`). Aparece na página, Pix, PDF e WhatsApp. |
| `PLAN_PRICE` | não | Preço (padrão `297`). |
| `PLAN_DELIVERY_HOURS` | não | Prazo (padrão `24`). |
| `PLAN_TENANT_SLUG` | não | Tenant que vende (padrão `dua-criativa`). |
| `PLAN_FUNNEL_STAGE` | não | Nome de uma etapa do funil para onde vai quem paga. Sem ela, o contato entra na 1ª etapa (se ainda não estiver no funil). |

A rota da página (`/plano-90-dias`) é fixa; trocar o nome do produto não muda o link.

## Configurar no Asaas

1. **Integrações → Webhooks → Adicionar**: URL `https://<backend>/api/v1/webhooks/asaas` (a mesma usada hoje pelo Financeiro, se já existir),
   eventos de **Cobranças** (pelo menos `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`), fila ativa, e um **token de autenticação** igual ao `ASAAS_WEBHOOK_TOKEN`.
2. A conta precisa de uma **chave Pix** cadastrada para emitir QR Code.
3. Teste no sandbox (`sandbox.asaas.com`): crie a conta, gere a chave de API, ponha `ASAAS_BASE_URL` do sandbox. Com o Asaas em sandbox, o pedido no CRM mostra
   **Simular pagamento (sandbox)**, que chama `POST /sandbox/payment/{id}/confirm` e dispara o webhook.

## Banco

Tabela nova `PlanOrder` (migração `20261024000007_add_plan_orders`), criada pelo `ensureSchema` no start. Sem ALTER em tabelas existentes.
Para alinhar com as outras tabelas novas, rode via Supabase o `GRANT`/`REVOKE ... FROM anon, authenticated` do fim da migração.

## Código

- Backend: `packages/backend/src/modules/plan-orders/` (serviço, geração com Claude em `plan-generator.ts`, PDF em `plan-pdf.ts`, nome/preço em `plan.config.ts`).
  `AsaasService` ganhou `ASAAS_BASE_URL`, criação de cliente/cobrança Pix, QR Code e confirmação no sandbox.
- Frontend: `src/app/plano-90-dias/` (venda e acompanhamento), `src/app/dashboard/planos/` (lista e revisão), `src/components/plans/`.
- Depende do PR #4 (diagnóstico): reaproveita `claude.ts`, `InstagramProfileService`, o visual do `diagnosis-pdf.ts` e o token do diagnóstico para preencher o formulário.
