import { playbookContext, PlaybookProfile } from './fashion-playbook';

export const ANALYSIS_SYSTEM =
  'Você é estrategista de marketing para marcas de moda brasileiras que já vendem e querem escalar no digital. ' +
  'Seu trabalho é transformar comunicação em desejo, valor e direção de compra. ' +
  'Você é específica: cita peças, legendas e números reais do perfil e nunca dá conselho que serviria para qualquer marca. ' +
  'Retorne sempre JSON válido, sem markdown.';

/**
 * Prompt da análise interna do Instagram. Recebe os dados reais do perfil (ou o motivo de não ter)
 * e o contexto do playbook de moda (nicho, sinais calculados, datas comerciais).
 */
export function buildAnalysisPrompt(instagram: string, profile: { data: PlaybookProfile | null; reason?: string }, now = new Date()) {
  const ctx = playbookContext(profile.data, now);

  const dados = profile.data
    ? `DADOS REAIS DO PERFIL (API oficial do Instagram, agora):\n${JSON.stringify(profile.data, null, 2)}\n\n` +
      `SINAIS JÁ CALCULADOS A PARTIR DESSES DADOS (confie neles, não recalcule):\n${JSON.stringify(ctx.sinais_do_perfil, null, 2)}\n`
    : `Não foi possível obter dados reais do perfil (${profile.reason}). Não invente números, peças nem fatos sobre a marca: ` +
      `deixe isso claro no resumo, use score null, pilares com nota null, e foque em pontos a verificar. ` +
      `As ideias de conteúdo podem usar só o nicho provável.\n`;

  const contexto =
    `NICHO (detectado pelo sistema pela bio e legendas; corrija se os dados mostrarem outro):\n${JSON.stringify(ctx.nicho_detectado)}\n\n` +
    `REFERÊNCIAS DO NICHO (use como inspiração, adapte às peças reais da marca, não copie literalmente):\n${JSON.stringify(ctx.referencias_do_nicho, null, 2)}\n\n` +
    `DATAS COMERCIAIS DOS PRÓXIMOS DIAS (hoje é ${ctx.hoje}; use só estas datas no calendário):\n${JSON.stringify(ctx.datas_comerciais_proximas, null, 2)}\n`;

  const metodo =
    `MÉTODO DE AVALIAÇÃO. Todo conteúdo de moda precisa cumprir 3 papéis, nesta ordem:\n` +
    `1. DESEJO: a cliente se imagina usando a peça (situação de uso, caimento em movimento, corpo real, estética consistente, gancho forte na primeira tela/primeiros 3s).\n` +
    `2. VALOR: ela entende por que vale o preço (tecido, modelagem, detalhes, comparação, prova social, bastidores, respostas às objeções do nicho).\n` +
    `3. DIREÇÃO DE COMPRA: ela sabe exatamente o que fazer agora (tamanhos disponíveis, preço ou faixa, como comprar, link/WhatsApp, prazo, urgência real).\n` +
    `Avalie também: bio (para quem é + o que entrega + como comprar), constância, mix de formatos, uso de Stories para venda ` +
    `(caixinhas, enquetes, sequências por produto) e se o atendimento no direct/WhatsApp é convidado nas legendas. ` +
    `Muitas marcas acham que o problema é preço quando é falta de confiança e direção no atendimento.\n`;

  const formato =
    `Retorne APENAS um JSON válido (sem markdown, sem texto fora do JSON) com:\n` +
    `- score (0-100 ou null sem dados)\n` +
    `- nicho (string curta, ex.: "Moda fitness feminina")\n` +
    `- resumo (2-3 frases, específicas desta marca)\n` +
    `- pilares: { desejo, valor, direcao_compra }, cada um { nota (0-100 ou null), leitura (1-2 frases citando posts/legendas/sinais reais) }\n` +
    `- pontos_fortes (array, até 5 itens de 1 frase)\n` +
    `- oportunidades (array, até 5 itens de 1-2 frases)\n` +
    `- alertas (array, até 4 itens de 1 frase, uso interno da agência, pode ser direto)\n` +
    `- bio: { leitura (1 frase sobre o que a bio atual comunica ou deixa de comunicar), sugestao (bio reescrita pronta para colar, máx 150 caracteres, até 4 linhas separadas por \\n) }\n` +
    `- produto_vitrine: { produto (uma peça REAL que aparece nas legendas; sem dados, uma peça típica do nicho e diga "sugestão"), ` +
    `ideias (array com exatamente 5 conteúdos diferentes para vender essa mesma peça, cada um 1 frase com formato + ângulo, ex.: "Reels: ...", "Carrossel: ...", "Stories: ...") }\n` +
    `- ideias_carrossel (array de 3 objetos { titulo (gancho de capa no estilo "Como vender mais X até Y", "5 jeitos de usar...", com a peça ou o nicho da marca), ` +
    `slides (array de 4 a 6 frases curtas, uma por tela, a última sempre com chamada de compra) })\n` +
    `- stories: { sequencia (array de 5 a 7 telas para vender uma peça num dia, cada uma 1 frase dizendo o que mostrar e o sticker), ` +
    `caixinhas (array de 5 perguntas de caixinha prontas para esta marca) }\n` +
    `- calendario (array de 2 a 4 objetos { data (AAAA-MM-DD, só das datas comerciais fornecidas), ocasiao, ideia (1 frase com a ação concreta para esta marca e quando começar a postar) })\n` +
    `- atendimento (array de 3 dicas de 1 frase para converter quem chama no direct/WhatsApp, específicas do nicho)\n` +
    `- estrategia_recomendada (1 parágrafo: as 3 prioridades dos próximos 30 dias, em ordem)\n` +
    `- mensagem_whatsapp (mensagem casual e personalizada para o primeiro contato, máx 4 linhas, citando algo específico do perfil, ` +
    `sem parecer robô, assine como Equipe Dua Criativa)`;

  return `Analise o perfil @${instagram} no Instagram para a agência Dua Criativa (Fortaleza).\n\n${dados}\n${contexto}\n${metodo}\n${formato}`;
}
