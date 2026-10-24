import { BadRequestException } from '@nestjs/common';
import { askClaude, parseJsonObject } from '../contacts/claude';
import { PlanAnswers } from './plan.config';

export interface PlanContent {
  estrategia: {
    resumo: string;
    diagnostico: string;
    posicionamento: string;
    publico: string;
    diferenciais: string[];
    tom_de_voz: string;
    frequencia: string;
  };
  pilares: { nome: string; objetivo: string; percentual: number; exemplos: string[] }[];
  calendario: { semana: number; tema: string; objetivo: string; feed: { dia: string; formato: string; pilar: string; ideia: string }[]; stories: string[] }[];
  reels: { titulo: string; objetivo: string; gancho: string; roteiro: string[]; texto_na_tela: string; cta: string; audio: string }[];
  legendas: { tema: string; legenda: string; hashtags: string }[];
  stories: { categoria: string; ideias: string[] }[];
  contratar: { item: string; categoria: string; quando: string; investimento: string; por_que: string }[];
  metas: { mes: number; foco: string; metas: string[] }[];
  primeiros_passos: string[];
}

/** Partes que podem ser geradas de novo separadamente na revisão. */
export const PLAN_PARTS = ['estrategia', 'calendario', 'reels', 'legendas', 'investimento'] as const;
export type PlanPart = (typeof PLAN_PARTS)[number];

export interface PlanInput {
  productName: string;
  brandName: string;
  instagramHandle: string;
  answers: PlanAnswers;
  profile: any | null; // dados reais do Instagram (Business Discovery) ou null
  profileReason?: string;
}

const SYSTEM =
  'Você é estrategista sênior de conteúdo para marcas de moda brasileiras, trabalhando para a agência Dua Criativa (Fortaleza). ' +
  'Escreve planos práticos, específicos para a marca e executáveis por uma equipe pequena. Português do Brasil, tom direto e acolhedor, ' +
  'falando com a dona ou o dono da marca ("você", "sua marca"). Nunca invente números ou fatos sobre a marca que não estejam no contexto. ' +
  'Não use emojis nos campos de texto (exceto dentro das legendas prontas, com moderação). Não use markdown. ' +
  'Retorne sempre APENAS um JSON válido, sem texto antes ou depois.';

function context(i: PlanInput) {
  const a = i.answers;
  const perfil = i.profile
    ? `Dados reais do Instagram @${i.instagramHandle}, obtidos agora pela API oficial:\n${JSON.stringify(i.profile, null, 2)}`
    : `Não foi possível ler o Instagram @${i.instagramHandle} (${i.profileReason ?? 'sem dados'}). Baseie-se só nas respostas do formulário e não cite números do perfil.`;
  return [
    `Produto: "${i.productName}", um plano de conteúdo e estratégia de 3 meses (12 semanas) para a marca.`,
    `Marca / responsável: ${i.brandName}. Instagram: @${i.instagramHandle}.`,
    `Respostas do formulário:`,
    `- Produto / nicho: ${a.nicho}`,
    `- Ticket médio: ${a.ticket}`,
    `- Público: ${a.publico}`,
    `- Quem posta hoje: ${a.quemPosta}`,
    `- Verba mensal para conteúdo e anúncio: ${a.verba}`,
    a.objetivo ? `- Objetivo principal nos próximos 3 meses: ${a.objetivo} (oriente o plano para isso)` : null,
    a.ondeVende ? `- Onde vende hoje: ${a.ondeVende} (os CTAs devem levar para esses canais)` : null,
    a.referencias ? `- Marcas que admira ou concorrentes: ${a.referencias}` : null,
    a.observacoes ? `- Observações da marca: ${a.observacoes}` : null,
    '',
    perfil,
  ].filter((l) => l !== null).join('\n');
}

function strategySummary(p: Partial<PlanContent>) {
  return JSON.stringify({ estrategia: p.estrategia, pilares: p.pilares?.map((x) => ({ nome: x.nome, objetivo: x.objetivo, percentual: x.percentual })) }, null, 2);
}

async function ask(prompt: string, maxTokens: number) {
  const text = await askClaude({ system: SYSTEM, prompt, maxTokens, timeoutMs: 240_000 });
  const out = parseJsonObject(text);
  if (!out) throw new BadRequestException('A IA não devolveu um JSON válido. Tente gerar de novo.');
  return out;
}

const str = (v: any) => (typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v));
const strList = (v: any, max = 50) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, max) : []);
const objList = (v: any, max = 50) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').slice(0, max) : []);

async function genStrategy(i: PlanInput): Promise<Pick<PlanContent, 'estrategia' | 'pilares'>> {
  const out = await ask(
    `${context(i)}\n\nEscreva a ESTRATÉGIA e os PILARES DE CONTEÚDO do plano.\n` +
      `Retorne JSON com:\n` +
      `estrategia: { resumo (3-4 frases: onde a marca está e aonde o plano leva em 90 dias), diagnostico (1 parágrafo sobre o Instagram hoje, ` +
      `citando números reais se houver), posicionamento (1 parágrafo: como a marca deve ser percebida e a promessa central), ` +
      `publico (1 parágrafo: persona principal, dores, desejos, onde está), diferenciais (array, 3-5 frases curtas), ` +
      `tom_de_voz (1 parágrafo com exemplos de palavras/expressões a usar e evitar), frequencia (1-2 frases: quantos posts de feed por semana, ` +
      `quantos Reels, stories por dia, realista para quem posta hoje) },\n` +
      `pilares: array de 4 a 5 { nome (2-4 palavras), objetivo (1 frase), percentual (número inteiro; a soma dá 100), exemplos (array de 3 ideias curtas) }.`,
    4000,
  );
  const e = out.estrategia ?? {};
  const pilares = objList(out.pilares, 6).map((p: any) => ({
    nome: str(p.nome), objetivo: str(p.objetivo), percentual: Number(p.percentual) || 0, exemplos: strList(p.exemplos, 5),
  }));
  if (!str(e.resumo) || pilares.length < 3) throw new BadRequestException('A IA não devolveu a estratégia completa. Tente de novo.');
  return {
    estrategia: {
      resumo: str(e.resumo), diagnostico: str(e.diagnostico), posicionamento: str(e.posicionamento), publico: str(e.publico),
      diferenciais: strList(e.diferenciais, 6), tom_de_voz: str(e.tom_de_voz), frequencia: str(e.frequencia),
    },
    pilares,
  };
}

async function genWeeks(i: PlanInput, base: Partial<PlanContent>, from: number, to: number): Promise<PlanContent['calendario']> {
  const out = await ask(
    `${context(i)}\n\nEstratégia já definida:\n${strategySummary(base)}\n\n` +
      `Monte o CALENDÁRIO das semanas ${from} a ${to} (de 12). Semanas 1-4 constroem base e confiança, 5-8 aceleram alcance com Reels ` +
      `e prova social, 9-12 focam em conversão e venda. Respeite a frequência da estratégia e use os pilares na proporção definida. ` +
      `Considere datas sazonais do varejo de moda no Brasil quando fizer sentido, sem citar datas exatas.\n` +
      `Retorne JSON com calendario: array com uma entrada por semana { semana (número), tema (até 6 palavras), objetivo (1 frase), ` +
      `feed: array de posts { dia (ex.: "Segunda"), formato ("Reels", "Carrossel", "Foto" ou "Vídeo"), pilar (nome de um pilar), ideia (1-2 frases concretas) }, ` +
      `stories: array de 3 a 5 ideias de stories da semana (1 frase cada) }.`,
    9000,
  );
  const weeks = objList(out.calendario, 12).map((w: any, k: number) => ({
    semana: Number(w.semana) || from + k,
    tema: str(w.tema),
    objetivo: str(w.objetivo),
    feed: objList(w.feed, 7).map((p: any) => ({ dia: str(p.dia), formato: str(p.formato), pilar: str(p.pilar), ideia: str(p.ideia) })),
    stories: strList(w.stories, 7),
  }));
  if (weeks.length < to - from + 1) throw new BadRequestException(`A IA não devolveu todas as semanas ${from}-${to}. Tente de novo.`);
  return weeks;
}

async function genReels(i: PlanInput, base: Partial<PlanContent>): Promise<PlanContent['reels']> {
  const out = await ask(
    `${context(i)}\n\nEstratégia já definida:\n${strategySummary(base)}\n\n` +
      `Escreva 8 ROTEIROS DE REELS prontos para gravar com celular, cobrindo os pilares. Cada um com gancho forte nos 2 primeiros segundos.\n` +
      `Retorne JSON com reels: array de { titulo, objetivo (1 frase), gancho (fala ou texto dos primeiros 2s), roteiro (array de 4 a 7 cenas/falas, ` +
      `cada uma 1 frase com o que aparece e o que se fala), texto_na_tela, cta, audio (tipo de áudio ou trend, sem citar música específica protegida) }.`,
    7000,
  );
  const reels = objList(out.reels, 12).map((r: any) => ({
    titulo: str(r.titulo), objetivo: str(r.objetivo), gancho: str(r.gancho), roteiro: strList(r.roteiro, 10),
    texto_na_tela: str(r.texto_na_tela), cta: str(r.cta), audio: str(r.audio),
  }));
  if (reels.length < 4) throw new BadRequestException('A IA não devolveu os roteiros de Reels. Tente de novo.');
  return reels;
}

async function genCaptions(i: PlanInput, base: Partial<PlanContent>): Promise<Pick<PlanContent, 'legendas' | 'stories'>> {
  const out = await ask(
    `${context(i)}\n\nEstratégia já definida:\n${strategySummary(base)}\n\n` +
      `Escreva 12 LEGENDAS PRONTAS para posts de feed (uma por semana, cobrindo os pilares), no tom de voz da marca, com quebra de linha, ` +
      `CTA no final e no máximo 2 emojis cada. E um BANCO DE IDEIAS DE STORIES organizado por objetivo.\n` +
      `Retorne JSON com legendas: array de { tema (até 6 palavras), legenda (texto completo, pode usar \\n), hashtags (5 a 8 hashtags numa string) } ` +
      `e stories: array de 5 categorias { categoria (ex.: "Bastidores", "Prova social", "Venda", "Relacionamento", "Enquetes e caixinhas"), ideias (array de 4 ideias de 1 frase) }.`,
    7000,
  );
  const legendas = objList(out.legendas, 16).map((l: any) => ({ tema: str(l.tema), legenda: str(l.legenda), hashtags: str(l.hashtags) }));
  const stories = objList(out.stories, 8).map((s: any) => ({ categoria: str(s.categoria), ideias: strList(s.ideias, 8) }));
  if (legendas.length < 6) throw new BadRequestException('A IA não devolveu as legendas. Tente de novo.');
  return { legendas, stories };
}

async function genInvestment(i: PlanInput, base: Partial<PlanContent>): Promise<Pick<PlanContent, 'contratar' | 'metas' | 'primeiros_passos'>> {
  const out = await ask(
    `${context(i)}\n\nEstratégia já definida:\n${strategySummary(base)}\n\n` +
      `Escreva O QUE CONTRATAR para executar o plano dentro da verba informada (foto de produto/lookbook, modelo, edição de vídeo, ` +
      `tráfego pago, ferramentas como app de edição, agendador, banco de imagens), em ordem de prioridade, com faixa de investimento ` +
      `realista em reais no mercado de Fortaleza/Brasil. Se a verba for pequena, diga o que dá para fazer sozinha(o). ` +
      `Depois, as METAS DE 90 DIAS, mês a mês, mensuráveis (seguidores, alcance, engajamento, cliques no link, mensagens no WhatsApp, vendas), ` +
      `realistas a partir dos números atuais se houver. E um checklist dos primeiros 7 dias.\n` +
      `Retorne JSON com contratar: array de 4 a 8 { item, categoria ("Foto", "Modelo", "Vídeo", "Tráfego", "Ferramenta" ou "Outro"), ` +
      `quando (ex.: "Semana 1", "Mês 2"), investimento (faixa em R$ ou "Grátis"), por_que (1 frase) }, ` +
      `metas: array de 3 { mes (1, 2, 3), foco (até 6 palavras), metas (array de 3 a 5 metas com número) }, ` +
      `primeiros_passos: array de 5 a 7 tarefas curtas para a primeira semana.`,
    5000,
  );
  const contratar = objList(out.contratar, 10).map((c: any) => ({
    item: str(c.item), categoria: str(c.categoria), quando: str(c.quando), investimento: str(c.investimento), por_que: str(c.por_que),
  }));
  const metas = objList(out.metas, 3).map((m: any, k: number) => ({ mes: Number(m.mes) || k + 1, foco: str(m.foco), metas: strList(m.metas, 6) }));
  if (!contratar.length || metas.length < 3) throw new BadRequestException('A IA não devolveu investimentos e metas. Tente de novo.');
  return { contratar, metas, primeiros_passos: strList(out.primeiros_passos, 8) };
}

/**
 * Gera o plano em várias chamadas (para não estourar tokens): estratégia primeiro,
 * depois calendário (2 metades), Reels, legendas/stories e investimento/metas em paralelo.
 * `only` gera de novo só uma parte, mantendo o resto de `current`.
 */
export async function generatePlan(i: PlanInput, current?: Partial<PlanContent> | null, only?: PlanPart): Promise<PlanContent> {
  let plan: Partial<PlanContent> = { ...(current ?? {}) };
  const want = (p: PlanPart) => !only || only === p;

  if (want('estrategia') || !plan.estrategia) plan = { ...plan, ...(await genStrategy(i)) };
  if (only === 'estrategia') return plan as PlanContent;

  const jobs: Promise<void>[] = [];
  if (want('calendario')) {
    jobs.push(
      Promise.all([genWeeks(i, plan, 1, 6), genWeeks(i, plan, 7, 12)]).then(([a, b]) => {
        plan.calendario = [...a, ...b].sort((x, y) => x.semana - y.semana);
      }),
    );
  }
  if (want('reels')) jobs.push(genReels(i, plan).then((r) => { plan.reels = r; }));
  if (want('legendas')) jobs.push(genCaptions(i, plan).then((r) => { plan.legendas = r.legendas; plan.stories = r.stories; }));
  if (want('investimento')) jobs.push(genInvestment(i, plan).then((r) => { Object.assign(plan, r); }));
  await Promise.all(jobs);
  return plan as PlanContent;
}
