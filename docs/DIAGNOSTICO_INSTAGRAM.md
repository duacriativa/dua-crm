# Diagnóstico gratuito de Instagram

Consultoria rápida e gratuita para nutrir leads que ainda não estão prontos para contratar
(ex.: tag "Menos de R$ 50k/mês"). Parte da "Análise de Perfil Instagram" do contato.

## Como funciona

1. **Contato → Análise de Perfil Instagram → Gerar análise** (Claude + Business Discovery).
   A análise é interna: tem `alertas` e `estrategia_recomendada` que não vão para o cliente.
2. Com a análise na tela (e com nota, ou seja, com dados reais do perfil), aparece o bloco
   **"Diagnóstico gratuito para o cliente" → Gerar diagnóstico para o cliente**.
   - `POST /contacts/:id/diagnosis` pede ao Claude para reescrever a análise no tom do cliente:
     resumo, pontos fortes, oportunidades (os alertas viram oportunidades ditas com cuidado) e
     exatamente 3 próximos passos. A nota é a mesma da análise.
   - Grava em `InstagramDiagnosis` com um token aleatório de 192 bits (32 caracteres).
   - Devolve o link `https://crm.duacriativa.com.br/diagnostico/<token>` e uma mensagem de WhatsApp pronta.
3. A equipe **copia a mensagem** ou clica em **Enviar pelo chat**: abre a conversa do contato com o
   texto já no campo (ou o modal "Nova conversa" com a primeira mensagem preenchida). Nada é enviado
   sozinho: a pessoa revisa e envia.
4. O cliente abre `/diagnostico/<token>` sem login: página com a marca da Dua, nota, resumo, pontos fortes,
   oportunidades, 3 próximos passos e o CTA **Agendar conversa** → `/agendar/especialista`
   (troque com `DIAGNOSIS_BOOKING_SLUG` no backend). A página tem `noindex`.
5. O CRM mostra se o cliente abriu ("Cliente abriu 2× · última em …"). O ícone de abrir no CRM usa
   `?preview=1`, que não conta como abertura.

Gerar de novo cria um link novo; os antigos continuam funcionando.

## Banco

Tabela nova `InstagramDiagnosis` (migração `20261024000006_add_instagram_diagnosis`). O `ensureSchema`
cria a tabela no start do backend (o `dua_app` tem permissão de REFERENCES em `Contact`/`Tenant`, conferido
em 24/10/2026). Sem ALTER em tabelas existentes. Para alinhar com as outras tabelas novas, rode também via
Supabase o `GRANT`/`REVOKE ... FROM anon, authenticated` do fim da migração.

## Janela de 24h do WhatsApp oficial

- Se o lead falou com a Dua nas últimas 24h, a mensagem com o link vai como texto livre (o fluxo acima).
- Fora da janela (ex.: lead que veio do formulário do site e nunca escreveu no WhatsApp, ou conversa parada),
  a Cloud API só aceita **template aprovado**. O chat já mostra "Fora da janela de 24h → Enviar template".

### Template proposto (precisa ser criado e aprovado na Meta)

- Nome: `diagnostico_instagram`, idioma `pt_BR`, categoria **MARKETING** (oferta de conteúdo gratuito para
  nutrir lead; a Meta reclassifica como Marketing se for enviado como Utility).
- Corpo (variáveis posicionais, que o passo `send_template` das automações já preenche):

  > Oi, {{1}}! Aqui é da Dua Criativa 😊
  > Preparamos um diagnóstico gratuito do Instagram da @{{2}}, com o que já está funcionando e 3 próximos passos para vender mais.
  > Veja aqui: {{3}}
  > Se quiser conversar sobre ele, é só responder esta mensagem.

  Exemplos para a revisão: `{{1}}` = Maria, `{{2}}` = lojamaria, `{{3}}` = https://crm.duacriativa.com.br/diagnostico/exemplo
- Rodapé: `Responda SAIR para não receber mais mensagens.`
- Botão de resposta rápida opcional: `Quero conversar`.

Alternativa melhor para conversão: o link num **botão de URL dinâmico**
(`https://crm.duacriativa.com.br/diagnostico/{{1}}`) em vez do corpo. Hoje o motor de automações só envia
parâmetros do corpo; seria preciso adicionar o componente `button` (`sub_type: url`) ao `send_template`.

## Automação opcional (avaliação, NÃO implementada)

Ideia: lead novo com Instagram e tag de baixo faturamento → gera o diagnóstico → entra numa sequência.

Viável com o motor atual (`automations`), adicionando um passo novo `generate_diagnosis`:

1. Gatilho `LEAD_FORM_SUBMITTED` (ou `WHATSAPP_FIRST_MESSAGE`) com condição "tag contém Menos de R$ 50k/mês"
   e contato com `instagramHandle`.
2. `generate_diagnosis`: roda a análise (Claude + Business Discovery) e o diagnóstico; grava o link em uma
   variável (`{{diagnostico_link}}`). Se o perfil for pessoal/privado (sem nota), desvia para "notificar a equipe"
   e encerra.
3. `notify` à equipe com o link, para conferir o texto antes.
4. Envio: dentro da janela de 24h → `send_text`; fora → `send_template diagnostico_instagram`.
5. `wait_reply` 3 dias → se não respondeu e não abriu, um lembrete (outro template de Marketing) ou só
   tarefa para a equipe; se respondeu, `move_stage`/`notify`.

Cuidados antes de ligar:
- Custo: cada lead gasta 2 chamadas ao Claude e conversas de Marketing pagas na Meta (há 158 contatos com essa
  tag hoje; a automação seria só para leads novos).
- Qualidade: a IA escreve sozinha para o cliente. Recomendo começar com o passo 3 exigindo revisão humana
  (a equipe clica para enviar) e só automatizar o envio depois de ver uns 10 diagnósticos reais.
- **Nada é enviado automaticamente sem o OK do usuário**: o template precisa ser aprovado e a automação ativada
  manualmente.
