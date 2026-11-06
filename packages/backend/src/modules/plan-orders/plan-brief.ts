/**
 * Respostas do questionário e como elas viram texto no prompt do plano.
 * Sem dependências do Nest, para testar direto (npm run test:plan).
 */

/** @ informado no questionário, conferido no Instagram (Business Discovery). */
export interface PlanBrandRef {
  handle: string;
  /** true só se o perfil foi encontrado e a cliente disse "é essa marca". */
  confirmed: boolean;
  name?: string | null;
  followers?: number | null;
  /** Por que ficou sem confirmação, para a Dua revisar. */
  reason?: 'not_found' | 'lookup_failed' | 'not_confirmed';
}

export type PlanLaunchStatus = 'data' | 'sem_data' | 'nao';

/** Pedidos antigos só têm os campos até `observacoes`: todo o resto é opcional. */
export interface PlanAnswers {
  nicho: string;
  ticket: string;
  publico: string;
  quemPosta: string;
  verba: string;
  objetivo: string;
  ondeVende: string; // canais separados por vírgula
  referencias?: string; // texto livre dos pedidos antigos; os novos usam inspiradoras/concorrentes
  observacoes?: string;
  cidadeRegiao?: string;
  faixaPreco?: string;
  gradeTamanhos?: string;
  pecasProntas?: string;
  lancamentoStatus?: PlanLaunchStatus;
  lancamentoData?: string; // AAAA-MM-DD
  localFotos?: string;
  identidade?: string;
  quemAparece?: string; // separados por vírgula
  inspiradoras?: PlanBrandRef[];
  concorrentes?: PlanBrandRef[];
}

const DAY = 86400_000;
const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const isoToUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = isoToUtc(v);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
}

function fmtIso(iso: string) {
  const d = new Date(isoToUtc(iso));
  const [y, m, day] = iso.split('-');
  return `${WEEKDAYS[d.getUTCDay()]}, ${day}/${m}/${y}`;
}

/**
 * Segunda-feira em que começa a semana 1: a primeira depois do prazo de um dia de entrega.
 * Assim "Semana N" e os dias da semana do calendário batem com a data real do lançamento.
 */
export function planStartDate(base: Date): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(base);
  const t = isoToUtc(today) + DAY;
  const weekday = new Date(t).getUTCDay();
  const add = (8 - weekday) % 7; // dias até a próxima segunda (0 se já for segunda)
  return new Date(t + add * DAY).toISOString().slice(0, 10);
}

/**
 * Instrução única sobre o lançamento. Entra em todas as partes do plano: os 3 blocos do
 * calendário são gerados em paralelo e um não vê o outro, então a semana já vai calculada.
 * Sem resposta (pedido antigo), devolve null.
 */
export function launchBrief(a: PlanAnswers, planStart: string): string | null {
  if (a.lancamentoStatus === 'nao') {
    return 'LANÇAMENTO: a marca não tem lançamento nos próximos 3 meses. Não crie lançamento, coleção nova nem data de lançamento em nenhuma parte do plano.';
  }
  if (a.lancamentoStatus === 'sem_data') {
    return 'LANÇAMENTO: a marca quer lançar, mas ainda não tem data. Não marque o lançamento em nenhuma semana e não escreva datas. ' +
      'Prepare a marca com conteúdo de bastidores e expectativa, e explique que a sequência de lançamento começa quando a data for definida.';
  }
  if (a.lancamentoStatus !== 'data' || !isIsoDate(a.lancamentoData)) return null;

  const label = fmtIso(a.lancamentoData);
  const diff = Math.floor((isoToUtc(a.lancamentoData) - isoToUtc(planStart)) / DAY);
  if (diff < 0) {
    return `LANÇAMENTO: a data real é ${label}, antes de a semana 1 começar. Trate como coleção recém-lançada e não programe nenhum outro lançamento.`;
  }
  if (diff >= 84) {
    return `LANÇAMENTO: a data real é ${label}, depois da semana 12. Nenhuma semana deste plano é de lançamento: as últimas semanas só preparam a marca para essa data, sem programar outro lançamento.`;
  }
  const week = Math.floor(diff / 7) + 1;
  const warmup = week > 1 ? `Semanas ${Math.max(1, week - 3)} a ${week - 1}: aquecimento. ` : '';
  const after = week < 12 ? ` Da semana ${week + 1} em diante: pós-lançamento e venda da coleção.` : '';
  return `LANÇAMENTO ÚNICO: a data real é ${label}, que cai na semana ${week} do calendário. ${warmup}` +
    `Semana ${week}: o lançamento, com o post de abertura em ${label.split(',')[0]}.${after} ` +
    `Não programe nenhum outro lançamento nem outra data de lançamento em nenhuma parte do plano.`;
}

function fmtRef(r: PlanBrandRef) {
  const parts = [r.name, typeof r.followers === 'number' ? `${r.followers.toLocaleString('pt-BR')} seguidores` : null].filter(Boolean);
  return `@${r.handle}${parts.length ? ` (${parts.join(', ')})` : ''}`;
}

/** Só o @ confirmado vira referência. O não confirmado pode ser outra marca: fica fora do plano. */
function brandLines(label: string, refs?: PlanBrandRef[]) {
  if (!refs) return [];
  const ok = refs.filter((r) => r.confirmed);
  const pending = refs.filter((r) => !r.confirmed);
  const lines: string[] = [];
  lines.push(ok.length
    ? `- ${label} (confirmados pela cliente no Instagram): ${ok.map(fmtRef).join('; ')}`
    : `- ${label}: nenhum confirmado. Não invente nomes de marcas.`);
  if (pending.length) {
    lines.push(`- ${label}, @ NÃO confirmados (podem estar errados e ser de outra marca): ${pending.map((r) => `@${r.handle}`).join(', ')}. Não cite esses @ nem descreva essas marcas.`);
  }
  return lines;
}

/** Respostas do questionário em linhas para o prompt. Campo ausente (pedido antigo) não gera linha. */
export function answerLines(a: PlanAnswers, planStart: string): string[] {
  const opt = (v: string | undefined, text: (s: string) => string) => (v ? [text(v)] : []);
  const launch = launchBrief(a, planStart);
  return [
    `- Produto / nicho: ${a.nicho}`,
    `- Ticket médio: ${a.ticket}`,
    ...opt(a.faixaPreco, (v) => `- Faixa de preço das peças: ${v} (use estes valores; não invente preços)`),
    ...opt(a.gradeTamanhos, (v) => `- Grade de tamanhos: ${v} (cite só estes tamanhos)`),
    `- Público: ${a.publico}`,
    ...opt(a.cidadeRegiao, (v) => `- Cidade ou região de atendimento: ${v} (use nos CTAs e hashtags quando fizer sentido)`),
    `- Quem posta hoje: ${a.quemPosta}`,
    `- Verba mensal para conteúdo e anúncio: ${a.verba}`,
    ...opt(a.objetivo, (v) => `- Objetivo principal nos próximos 3 meses: ${v} (oriente o plano para isso)`),
    ...opt(a.ondeVende, (v) => `- Onde vende hoje: ${v} (os CTAs devem levar para esses canais)`),
    ...opt(a.pecasProntas, (v) => `- Situação das peças: ${v} (só programe foto e vídeo de produto quando as peças estiverem prontas; antes disso, use bastidores)`),
    ...opt(a.localFotos, (v) => `- Local das fotos: ${v} (use nas ideias de foto e nos roteiros; se ainda não souber, indique um local viável para a verba, sem deixar em aberto)`),
    ...opt(a.identidade, (v) => `- Logo e identidade visual: ${v} (se faltar algo, inclua em "o que contratar")`),
    ...opt(a.quemAparece, (v) => `- Quem aparece no conteúdo: ${v} (ideias e roteiros só com essas pessoas)`),
    ...brandLines('Marcas que inspiram', a.inspiradoras),
    ...brandLines('Concorrentes', a.concorrentes),
    ...opt(a.referencias, (v) => `- Marcas que admira ou concorrentes: ${v}`),
    ...opt(a.observacoes, (v) => `- Observações da marca: ${v}`),
    ...(a.lancamentoStatus ? [`- Semana 1 do calendário começa na ${fmtIso(planStart)}.`] : []),
    ...(launch ? [`- ${launch}`] : []),
  ];
}

/** @ que a equipe precisa conferir, para o aviso no contato. */
export function unconfirmedHandles(a: PlanAnswers): string[] {
  return [...(a.inspiradoras ?? []), ...(a.concorrentes ?? [])].filter((r) => !r.confirmed).map((r) => r.handle);
}
