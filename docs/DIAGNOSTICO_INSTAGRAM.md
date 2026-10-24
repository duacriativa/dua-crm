# Análise de Perfil para o cliente (diagnóstico gratuito)

Consultoria rápida e gratuita para nutrir leads que ainda não estão prontos para contratar
(ex.: tag "Menos de R$ 50k/mês"). O envio é **manual, pelo app WhatsApp Business no celular**:
não passa pela API oficial, então não precisa de template nem de janela de 24h.

## Fluxo

1. **Contato → Análise de Perfil Instagram → Gerar análise** (Claude + Business Discovery).
   A análise é interna: `alertas` e `estrategia_recomendada` não vão para o cliente.
2. **Copiar mensagem curta** (a `mensagem_whatsapp` da análise) e mandar pelo WhatsApp Business.
   Ela oferece uma análise rápida.
3. Se o cliente topar, use uma das opções:
   - **Baixar PDF da análise** (na barra, ao lado de "Copiar mensagem curta") e envie o arquivo
     `analise-perfil-<@>.pdf`.
   - **Copiar diagnóstico para WhatsApp** (bloco "Análise para o cliente"): texto completo com a formatação do
     WhatsApp (*negrito*, listas), com nota, pontos fortes, pontos de melhoria, próximos passos, o link da página
     e o link de agendamento.
   - **Abrir no WhatsApp**: link `wa.me/<número>?text=...`, que abre o WhatsApp (Business, no celular) já com esse texto.
4. O cliente pode abrir a página `/diagnostico/<token>` (mesmo conteúdo do PDF, com o botão **Agendar conversa** →
   `/agendar/especialista` e um link para baixar o PDF). O CRM mostra quantas vezes a página ou o PDF público foi aberto.
   O que a equipe abre pelo CRM usa `?preview=1` e não conta.

Sem dados reais do perfil (análise sem nota: perfil pessoal, privado ou erro na API), o CRM não oferece PDF nem
texto para o cliente, porque eles ficariam genéricos.

## Oferta do plano pago

O PDF, a página e o texto do WhatsApp terminam com o produto pago em destaque (plano de 3 meses, página
`/plano-90-dias`, PR #5). O link leva `?d=<token do diagnóstico>` para a página de venda preencher os dados do contato.
O convite para agendar conversa continua, como segunda opção ("Prefere conversar antes?").
Nome, preço e prazo vêm das mesmas variáveis do backend que o módulo de planos usa: `PLAN_PRODUCT_NAME`
(padrão "Plano de Conteúdo 90 Dias"), `PLAN_PRICE` (297) e `PLAN_DELIVERY_HOURS` (24).

## Como é gerado

- `POST /contacts/:id/diagnosis` (body `{ analysis?, force? }`): o Claude reescreve a análise no tom do cliente
  (resumo, explicação da nota, pontos fortes, pontos de melhoria e exatamente 3 próximos passos, sem emojis e sem
  vender a agência). Também busca de novo os números reais do perfil (seguidores, engajamento médio, posts e o post
  com mais interações). A nota é a mesma da análise.
- Se a análise não mudou, reaproveita o último diagnóstico, sem chamar a IA de novo. **Reescrever texto** força uma versão nova.
- Grava em `InstagramDiagnosis` com um token aleatório de 192 bits (link não adivinhável). Links antigos continuam valendo.
- PDF: `GET /public/diagnostico/:token/pdf`, gerado no backend com `pdfkit` (A4, identidade da Dua, link de
  agendamento clicável, WhatsApp e Instagram da Dua no rodapé do CTA).
- Variáveis opcionais do backend: `DIAGNOSIS_BOOKING_SLUG` (padrão `especialista`) e `DIAGNOSIS_CONTACT_WHATSAPP`
  (padrão `(85) 8901-1558`).

## Banco

Tabela nova `InstagramDiagnosis` (migração `20261024000006_add_instagram_diagnosis`), criada pelo `ensureSchema` no start
(o `dua_app` tem REFERENCES em `Contact`/`Tenant`, conferido em 24/10/2026). Sem ALTER em tabelas existentes. Para alinhar
com as outras tabelas novas, rode via Supabase o `GRANT`/`REVOKE ... FROM anon, authenticated` do fim da migração.

## Fora do escopo

Template da API oficial e automação de envio: o usuário decidiu enviar à mão pelo WhatsApp Business (24/10/2026).
