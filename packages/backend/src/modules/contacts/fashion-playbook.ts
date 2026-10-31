/**
 * Playbook de marketing para marcas de moda, usado pela análise do Instagram.
 *
 * A ideia: a análise não pode ser genérica. Antes de chamar a IA, o código descobre o nicho da
 * marca, calcula sinais concretos do perfil (formatos, constância, CTA nas legendas, bio) e monta o
 * calendário comercial dos próximos dias. A IA recebe tudo isso e só escreve o que dá para provar.
 *
 * Método por trás (o que um conteúdo de moda precisa fazer, nesta ordem):
 *   1. Desejo: a cliente se imagina usando a peça (contexto, caimento, situação de uso).
 *   2. Valor: entende por que vale o preço (tecido, modelagem, detalhe, prova social).
 *   3. Direção de compra: sabe exatamente como comprar agora (tamanho, preço, link, WhatsApp).
 * Sem nada puro e sem dependências: dá para testar com `npm run test:playbook`.
 */

export interface PlaybookPost {
  data?: string | null; // AAAA-MM-DD
  formato?: string | null; // REELS | CAROUSEL_ALBUM | IMAGE | VIDEO
  curtidas?: number | null;
  comentarios?: number | null;
  legenda?: string | null;
}

export interface PlaybookProfile {
  nome?: string | null;
  bio?: string | null;
  site?: string | null;
  seguidores?: number | null;
  ultimos_posts?: PlaybookPost[];
}

export interface Niche {
  id: string;
  nome: string;
  palavras: RegExp;
  /** O que faz a cliente desse nicho querer comprar. */
  desejo: string[];
  /** O que trava a compra (vira conteúdo de valor e de atendimento). */
  objecoes: string[];
  /** Formatos que costumam vender nesse nicho. */
  ideias: string[];
  /** Perguntas de caixinha nos stories que puxam conversa de compra. */
  caixinhas: string[];
}

export const NICHES: Niche[] = [
  {
    id: 'fitness',
    nome: 'Moda fitness',
    palavras: /\b(fitness|fit\b|legging|top(s)? fitness|academia|treino|cropped fit|bermuda (de )?ciclista|shorts? fitness|conjunto fitness|moda fit|activewear|crossfit|corrida|yoga)/i,
    desejo: ['sentir-se confiante treinando', 'peça que valoriza o corpo sem marcar o que incomoda', 'look que vai da academia para a rua'],
    objecoes: ['fica transparente no agachamento?', 'o cós enrola ou desce?', 'qual tamanho escolher', 'aguenta treino pesado / suor'],
    ideias: [
      'Reels sem aparecer o rosto: teste do agachamento, close no tecido, antes/depois do look',
      'Carrossel "qual legging para cada treino" (musculação, corrida, funcional)',
      'Monte 3 looks com o mesmo top: treino, rua e fim de semana',
      'Prova de qualidade: tecido contra a luz, lavagem, elasticidade',
    ],
    caixinhas: [
      'Qual parte do look de treino você mais tem dificuldade de acertar?',
      'Legging: cós alto ou cós médio?',
      'O que te faz desistir de comprar roupa fitness online?',
      'Você treina em que horário? (te mostro o look ideal)',
      'Qual cor você nunca teve coragem de usar na academia?',
      'Manda sua dúvida de tamanho que eu respondo aqui',
    ],
  },
  {
    id: 'praia',
    nome: 'Moda praia',
    palavras: /\b(biqu[ií]ni|mai[ôo]|moda praia|beachwear|sa[ií]da de praia|kaftan|asa delta|cortininha|hot pant|praia|ver[ãa]o|piscina)/i,
    desejo: ['se sentir bonita e segura de biquíni', 'foto bonita na viagem / no verão', 'modelagem que valoriza o próprio corpo'],
    objecoes: ['vai ficar bom no meu corpo?', 'calcinha marca / é cavada demais?', 'top segura busto grande?', 'cor desbota no cloro/sal?'],
    ideias: [
      'Carrossel "qual biquíni para o seu tipo de corpo" com peças reais da loja',
      'Contagem regressiva para o verão / férias com um modelo por dia',
      'Mesma peça em 3 tamanhos ou corpos diferentes',
      'Combinações de saída de praia + biquíni (vende 2 peças juntas)',
    ],
    caixinhas: [
      'Qual a sua maior insegurança na hora de escolher biquíni?',
      'Calcinha: asa delta, fio ou tradicional?',
      'Pra onde você vai nessas férias? (te indico o modelo)',
      'Top: cortininha ou com bojo?',
      'Quanto você costuma investir num biquíni?',
      'Me manda sua dúvida de tamanho',
    ],
  },
  {
    id: 'infantil',
    nome: 'Moda infantil',
    palavras: /\b(infantil|kids|beb[eê]s?|menin[oa]s?|crian[çc]as?|enxoval|mam[ãa]e|filh[oa]s?|tal m[ãa]e tal filh[oa]|primeiros passos|body\b|macac[ãa]o)/i,
    desejo: ['filho(a) lindo(a) na foto / na festa', 'conforto para a criança brincar', 'tirar a dúvida do presente certo'],
    objecoes: ['vai perder rápido (criança cresce)', 'tecido pinica ou esquenta?', 'qual tamanho para a idade', 'aguenta lavar muito?'],
    ideias: [
      'Um único look em 5 ocasiões: escola, aniversário, passeio, foto em família, presente',
      'Guia de tamanho por idade e altura (salvável)',
      'Tal mãe, tal filha / combinando com os irmãos',
      'Lista "presente certo" por idade para quem vai dar de presente',
    ],
    caixinhas: [
      'Quantos anos tem o seu pequeno(a)? Te indico o tamanho',
      'O que mais pesa na hora de comprar roupa infantil: preço, tecido ou durabilidade?',
      'Tem aniversário chegando? Me conta que eu monto o look',
      'Seu filho(a) prefere conforto ou ama se arrumar?',
      'Você compra roupa infantil para presentear?',
      'Qual a sua dúvida sobre tecido?',
    ],
  },
  {
    id: 'lingerie',
    nome: 'Lingerie e moda íntima',
    palavras: /\b(lingerie|suti[ãa]|calcinha|moda [íi]ntima|body rendado|camisola|pijama|sleepwear|baby ?doll|renda|conjunto [íi]ntimo|cueca)/i,
    desejo: ['se sentir bonita para si mesma', 'conforto que não aparece na roupa', 'presente especial (data a dois)'],
    objecoes: ['vergonha de perguntar o tamanho', 'não sei meu número de sutiã', 'vai marcar na roupa?', 'aro machuca?'],
    ideias: [
      'Caixinha de perguntas anônimas sobre tamanho e modelagem',
      'Carrossel "sutiã certo para cada decote/roupa"',
      'Conteúdo de autoestima e autocuidado (sem expor a cliente)',
      'Guia de presente para quem quer dar lingerie e não sabe o tamanho',
    ],
    caixinhas: [
      'Você sabe qual o seu tamanho de sutiã de verdade?',
      'O que mais te incomoda numa lingerie: aro, alça ou marcar na roupa?',
      'Renda ou microfibra?',
      'Você compra lingerie para você ou para presentear?',
      'Pergunta anônima: qual dúvida você tem vergonha de fazer na loja?',
      'Qual roupa sua pede um sutiã especial?',
    ],
  },
  {
    id: 'plus_size',
    nome: 'Moda plus size',
    palavras: /\b(plus ?size|curvy|tamanhos? grandes?|do 46|ao 60|g[1-5]\b|gg|xg|corpo real|curvas)/i,
    desejo: ['achar roupa que serve e é bonita', 'se ver representada', 'sair da roupa "para esconder"'],
    objecoes: ['vai servir de verdade?', 'a tabela é igual às outras lojas?', 'vai marcar a barriga/braço?', 'troca é fácil?'],
    ideias: [
      'Provador real: mesma peça em corpos e tamanhos diferentes',
      'Tabela de medidas explicada em carrossel salvável',
      'Looks para ocasiões (trabalho, festa, praia) com caimento mostrado em movimento',
      'Depoimentos de clientes com fotos (com autorização)',
    ],
    caixinhas: [
      'Qual peça você mais tem dificuldade de achar no seu tamanho?',
      'O que mais te incomoda numa calça: cós, coxa ou comprimento?',
      'Que ocasião você tem chegando?',
      'Já desistiu de uma compra por medo do tamanho não servir?',
      'Vestido ou conjunto?',
      'Me manda suas medidas que eu te indico o tamanho',
    ],
  },
  {
    id: 'festa',
    nome: 'Moda festa',
    palavras: /\b(festa|vestidos? de festa|madrinha|formatura|casamento|gala|noiva|convidada|debutante|longo|paet[êe]|aluguel de vestido)/i,
    desejo: ['ser a mais elegante da festa', 'foto perfeita', 'não repetir look'],
    objecoes: ['vou usar uma vez só', 'o ajuste/barra fica pronto a tempo?', 'combina com a cor da madrinha?', 'prazo de entrega'],
    ideias: [
      'Carrossel "o vestido certo para cada tipo de festa" (dia, noite, praia, igreja)',
      'Bastidores do ajuste / da prova',
      'Mesma peça com 3 produções (acessório, cabelo, sapato)',
      'Calendário de formaturas e casamentos: "faltam X semanas, já escolheu?"',
    ],
    caixinhas: [
      'Qual festa você tem pela frente?',
      'Longo ou midi?',
      'Você é madrinha este ano? Me conta a cor',
      'O que pesa mais: comprar ou alugar?',
      'Qual a sua dúvida sobre traje (esporte fino, black tie...)?',
      'Me manda a data da festa que eu te digo o prazo',
    ],
  },
  {
    id: 'modesta',
    nome: 'Moda modesta / evangélica',
    palavras: /\b(moda (evang[ée]lica|modesta|crist[ãa])|modest fashion|saia midi|saia longa|culto|igreja|evang[ée]lica)/i,
    desejo: ['elegância sem abrir mão dos valores', 'look para culto e para o dia a dia', 'peças que não marcam e não ficam curtas'],
    objecoes: ['fica curto em mim?', 'transparece?', 'combina com o restante do meu guarda-roupa?'],
    ideias: [
      'Do culto ao trabalho com a mesma saia',
      'Carrossel de comprimentos (midi/longa) por altura',
      'Looks para eventos (congresso, casamento, batizado)',
    ],
    caixinhas: [
      'Você prefere saia midi ou longa?',
      'Que evento da igreja você tem este mês?',
      'Qual a sua altura? Te indico o comprimento',
      'O que é mais difícil de achar: vestido, saia ou conjunto?',
    ],
  },
  {
    id: 'masculina',
    nome: 'Moda masculina',
    palavras: /\b(masculin[oa]|moda men|menswear|camisas? polo|bermudas? masculina|homem|homens|barbearia|streetwear)/i,
    desejo: ['estar bem vestido sem esforço', 'roupa que veste bem no corpo', 'praticidade'],
    objecoes: ['qual tamanho / caimento', 'não sei combinar', 'vale o preço?'],
    ideias: [
      'Cápsula: 5 peças que formam 10 looks',
      'Guia de caimento (slim, regular, oversized)',
      'Presentes para Dia dos Pais / Namorados com a voz de quem presenteia',
    ],
    caixinhas: [
      'Você prefere slim ou regular?',
      'Qual ocasião você mais tem dificuldade de se vestir?',
      'Vai presentear alguém? Me conta para quem',
      'Camisa ou polo?',
    ],
  },
  {
    id: 'calcados_acessorios',
    nome: 'Calçados, bolsas e acessórios',
    palavras: /\b(cal[çc]ados?|sand[áa]lias?|sapatos?|t[êe]nis|rasteirinhas?|tamancos?|bolsas?|acess[óo]rios|bijuterias?|semijoias?|joias?|brincos?|colares?|[óo]culos)/i,
    desejo: ['finalizar o look', 'peça versátil que combina com tudo', 'presente fácil de acertar'],
    objecoes: ['forma pequena ou grande?', 'machuca o pé?', 'escurece/descasca?', 'tem garantia?'],
    ideias: [
      'Uma peça, cinco looks (do básico ao festa)',
      'Teste de conforto / durabilidade',
      'Guia de presente por faixa de preço',
    ],
    caixinhas: [
      'Qual o seu número? Te digo se a forma é pequena ou grande',
      'Salto ou rasteira no dia a dia?',
      'Prata ou dourado?',
      'Vai presentear? Me conta para quem',
    ],
  },
  {
    id: 'feminina',
    nome: 'Moda feminina (multimarcas / casual)',
    palavras: /\b(moda feminina|multimarcas|look do dia|lookdodia|vestidos?|blusas?|cal[çc]as?|saias?|jeans|alfaiataria|conjuntos?|cropped|cole[çc][ãa]o|novidades|provador|boutique|loja)/i,
    desejo: ['estar bem vestida com praticidade', 'peça versátil para várias ocasiões', 'se sentir bonita e atual'],
    objecoes: ['qual tamanho / caimento', 'com o que eu combino?', 'vale o preço?', 'troca é fácil?'],
    ideias: [
      'Uma peça, 5 ocasiões (trabalho, jantar, fim de semana, viagem, evento)',
      'Provador: mesma peça em corpos diferentes e em movimento',
      'Carrossel de combinações com o que a cliente já tem no armário',
      'Bastidores da curadoria / chegada de novidades',
    ],
    caixinhas: [
      'Qual ocasião você tem chegando e não sabe o que vestir?',
      'Qual peça do seu armário você nunca sabe combinar?',
      'Vestido ou conjunto?',
      'O que te faz desistir de comprar roupa online?',
      'Qual cor você quer ver mais por aqui?',
      'Me manda sua dúvida de tamanho',
    ],
  },
];

const FALLBACK = NICHES.find((n) => n.id === 'feminina')!;

/**
 * Nicho da marca pela bio, nome e legendas. A bio e o nome pesam mais que as legendas, porque
 * uma loja feminina pode postar biquíni no verão e nem por isso ser de moda praia.
 */
export function detectNiche(p: PlaybookProfile): { principal: Niche; secundarios: Niche[]; certeza: 'alta' | 'media' | 'baixa' } {
  const head = `${p.nome ?? ''} ${p.bio ?? ''} ${p.site ?? ''}`;
  const legendas = (p.ultimos_posts ?? []).map((m) => m.legenda ?? '');
  const scores = NICHES.map((n) => {
    const g = new RegExp(n.palavras.source, 'gi');
    const inHead = (head.match(g) ?? []).length;
    const inPosts = legendas.filter((l) => new RegExp(n.palavras.source, 'i').test(l)).length;
    // "feminina" é o genérico: só vence quando nenhum nicho específico aparece
    const peso = n.id === 'feminina' ? 0.5 : 1;
    return { n, s: (inHead * 3 + inPosts) * peso };
  }).sort((a, b) => b.s - a.s);

  const [top, second] = scores;
  if (!top || top.s === 0) return { principal: FALLBACK, secundarios: [], certeza: 'baixa' };
  const secundarios = scores.slice(1).filter((x) => x.s >= Math.max(2, top.s / 2)).slice(0, 2).map((x) => x.n);
  const certeza = top.s >= 4 && (!second || top.s >= second.s * 1.5) ? 'alta' : top.s >= 2 ? 'media' : 'baixa';
  return { principal: top.n, secundarios, certeza };
}

// ── Sinais calculados do perfil ─────────────────────────────────────────

const CTA = /(link na bio|link da bio|chama (no|na|a gente)|whats|zap|direct|dm\b|compre|garanta|pe[çc]a (j[áa]|o seu|a sua)|clique|no site|frete|pix|parcel|dispon[íi]ve(l|is)|[úu]ltimas (pe[çc]as|unidades)|encomend|reserv|pedido|comprar|vem (garantir|buscar)|loja f[íi]sica)/i;
const PRECO = /(r\$\s?\d|\d{2,4},\d{2}|por apenas|desconto|% ?off|promo[çc][ãa]o|cupom)/i;
const TAMANHO = /\b(tamanhos?|pp|gg|xg|veste (do|at[ée])|\d{2} ao \d{2}|p ao g|numera[çc][ãa]o|medidas)\b/i;
const PERGUNTA = /\?/;

export interface ProfileSignals {
  posts_analisados: number;
  formatos: Record<string, number>; // quantidade por formato
  interacoes_medias_por_formato: Record<string, number>;
  formato_que_mais_engaja: string | null;
  posts_por_semana: number | null;
  dias_desde_ultimo_post: number | null;
  legendas_com_chamada_de_compra: string; // "3 de 12"
  legendas_com_preco_ou_oferta: string;
  legendas_com_tamanho: string;
  legendas_com_pergunta: string;
  tamanho_medio_legenda: number;
  bio: {
    tem_link: boolean;
    menciona_whatsapp: boolean;
    menciona_entrega_ou_envio: boolean;
    menciona_loja_fisica_ou_cidade: boolean;
    menciona_tamanhos: boolean;
    tem_chamada_para_acao: boolean;
  };
}

const FORMATO_NOME: Record<string, string> = { REELS: 'Reels', CAROUSEL_ALBUM: 'Carrossel', IMAGE: 'Foto', VIDEO: 'Vídeo' };

export function profileSignals(p: PlaybookProfile, now = new Date()): ProfileSignals {
  const posts = p.ultimos_posts ?? [];
  const n = posts.length;
  const frac = (re: RegExp) => `${posts.filter((m) => re.test(m.legenda ?? '')).length} de ${n}`;

  const formatos: Record<string, number> = {};
  const somaInter: Record<string, number> = {};
  for (const m of posts) {
    const f = FORMATO_NOME[m.formato ?? ''] ?? 'Foto';
    formatos[f] = (formatos[f] ?? 0) + 1;
    somaInter[f] = (somaInter[f] ?? 0) + (m.curtidas ?? 0) + (m.comentarios ?? 0);
  }
  const medias: Record<string, number> = {};
  for (const f of Object.keys(formatos)) medias[f] = Math.round(somaInter[f] / formatos[f]);
  // Só aponta um formato "vencedor" se houver mais de um formato para comparar
  const ranking = Object.entries(medias).sort((a, b) => b[1] - a[1]);
  const formatoTop = ranking.length > 1 ? ranking[0][0] : null;

  const datas = posts
    .map((m) => (m.data ? Date.parse(`${m.data}T12:00:00Z`) : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a);
  const DIA = 86_400_000;
  let porSemana: number | null = null;
  if (datas.length >= 2) {
    const span = Math.max(1, (datas[0] - datas[datas.length - 1]) / DIA);
    porSemana = Math.round(((datas.length - 1) / span) * 7 * 10) / 10;
  }
  const diasDesde = datas.length ? Math.max(0, Math.floor((now.getTime() - datas[0]) / DIA)) : null;

  const bio = `${p.bio ?? ''}`;
  return {
    posts_analisados: n,
    formatos,
    interacoes_medias_por_formato: medias,
    formato_que_mais_engaja: formatoTop,
    posts_por_semana: porSemana,
    dias_desde_ultimo_post: diasDesde,
    legendas_com_chamada_de_compra: frac(CTA),
    legendas_com_preco_ou_oferta: frac(PRECO),
    legendas_com_tamanho: frac(TAMANHO),
    legendas_com_pergunta: frac(PERGUNTA),
    tamanho_medio_legenda: n ? Math.round(posts.reduce((s, m) => s + (m.legenda ?? '').length, 0) / n) : 0,
    bio: {
      tem_link: !!p.site || /https?:\/\/|\.com|linktr|wa\.me/i.test(bio),
      menciona_whatsapp: /(whats|zap|wa\.me|\(\d{2}\)\s?9?\d{4})/i.test(bio),
      menciona_entrega_ou_envio: /(envio|enviamos|entregamos|entrega|todo o brasil|frete|delivery)/i.test(bio),
      menciona_loja_fisica_ou_cidade: /(loja f[íi]sica|rua |av\.|avenida|shopping|📍|centro|bairro|\b[A-Z][a-zà-ú]+\s?[-/]\s?[A-Z]{2}\b)/.test(bio),
      menciona_tamanhos: TAMANHO.test(bio) || /plus ?size/i.test(bio),
      tem_chamada_para_acao: /(compre|clique|chama|pe[çc]a|garanta|link|👇|⬇)/i.test(bio),
    },
  };
}

// ── Calendário comercial da moda ────────────────────────────────────────

export interface SeasonalDate { data: string; ocasiao: string; gancho: string }

interface CalEvent {
  ocasiao: string;
  quando: (ano: number) => Date;
  /** Nichos em que a data vende de verdade. Sem lista: vale para todos. */
  nichos?: string[];
  gancho: string;
  porNicho?: Record<string, string>;
}

const d = (ano: number, mes: number, dia: number) => new Date(Date.UTC(ano, mes - 1, dia));
/** N-ésimo dia da semana (0 = domingo) do mês. */
const nthWeekday = (ano: number, mes: number, weekday: number, n: number) => {
  const first = d(ano, mes, 1).getUTCDay();
  return d(ano, mes, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
};
/** Domingo de Páscoa (algoritmo de Meeus/Butcher). */
export function easter(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return d(ano, mes, dia);
}
const addDays = (t: Date, n: number) => new Date(t.getTime() + n * 86_400_000);

const EVENTS: CalEvent[] = [
  { ocasiao: 'Volta às aulas', quando: (a) => d(a, 1, 20), nichos: ['infantil'], gancho: 'kit escola/uniforme e looks confortáveis para o primeiro dia' },
  { ocasiao: 'Liquidação de verão', quando: (a) => d(a, 1, 10), gancho: 'queima de coleção com urgência real (últimas peças por tamanho)' },
  { ocasiao: 'Carnaval', quando: (a) => addDays(easter(a), -47), gancho: 'looks para bloco, viagem e fantasia confortável',
    porNicho: { praia: 'biquíni e body para bloco e viagem', fitness: 'conjunto que aguenta o bloquinho' } },
  { ocasiao: 'Dia da Mulher', quando: (a) => d(a, 3, 8), gancho: 'autoestima e presente para si mesma (sem clichê de flor)' },
  { ocasiao: 'Dia do Consumidor', quando: (a) => d(a, 3, 15), gancho: 'condição especial de um dia, anunciada nos stories com contagem regressiva' },
  { ocasiao: 'Páscoa', quando: (a) => easter(a), nichos: ['infantil', 'feminina', 'modesta'], gancho: 'look de almoço em família / tal mãe tal filha' },
  { ocasiao: 'Dia das Mães', quando: (a) => nthWeekday(a, 5, 0, 2), gancho: 'guia de presente por faixa de preço e "monte o look da sua mãe"',
    porNicho: { infantil: 'tal mãe tal filha e presente que os filhos escolhem', lingerie: 'pijamas e conjuntos para presentear' } },
  { ocasiao: 'Dia dos Namorados', quando: (a) => d(a, 6, 12), gancho: 'look do jantar e presente para o par',
    porNicho: { lingerie: 'o principal momento do ano: guia de presente com tabela de tamanho', masculina: 'presente para ele, com a voz de quem presenteia' } },
  { ocasiao: 'Festa junina / Liquidação de inverno', quando: (a) => d(a, 6, 24), gancho: 'look de São João e saída da coleção de inverno',
    porNicho: { infantil: 'roupa de quadrilha e look caipira' } },
  { ocasiao: 'Dia dos Pais', quando: (a) => nthWeekday(a, 8, 0, 2), nichos: ['masculina', 'calcados_acessorios', 'infantil', 'feminina'], gancho: 'guia de presente para pai, com tamanhos e embalagem pronta',
    porNicho: { infantil: 'pai e filho combinando' } },
  { ocasiao: 'Dia do Cliente', quando: (a) => d(a, 9, 15), gancho: 'agradecimento com mimo ou cupom só para quem já comprou (lista de clientes no WhatsApp)' },
  { ocasiao: 'Início da primavera / pré-verão', quando: (a) => d(a, 9, 22), nichos: ['praia', 'fitness', 'feminina', 'plus_size', 'lingerie'], gancho: 'lançamento de coleção primavera-verão',
    porNicho: { praia: 'começa a temporada: abrir lista VIP da coleção nova', fitness: '"projeto verão": looks que motivam a voltar a treinar' } },
  { ocasiao: 'Dia das Crianças', quando: (a) => d(a, 10, 12), nichos: ['infantil', 'calcados_acessorios'], gancho: 'guia de presente por idade e entrega garantida até a data' },
  { ocasiao: 'Black Friday', quando: (a) => addDays(nthWeekday(a, 11, 4, 4), 1), gancho: 'lista VIP antecipada no WhatsApp e oferta com regra clara (sem desconto em tudo)' },
  { ocasiao: 'Formaturas e festas de fim de ano', quando: (a) => d(a, 12, 5), nichos: ['festa', 'feminina', 'plus_size', 'calcados_acessorios', 'masculina', 'modesta'], gancho: 'look de formatura, confraternização e ceia' },
  { ocasiao: 'Natal', quando: (a) => d(a, 12, 25), gancho: 'guia de presentes com prazo de entrega/retirada e embalagem',
    porNicho: { infantil: 'look de Natal em família', lingerie: 'pijama de Natal e presentes', fitness: 'presente para quem treina' } },
  { ocasiao: 'Réveillon', quando: (a) => d(a, 12, 31), nichos: ['feminina', 'festa', 'praia', 'lingerie', 'plus_size', 'masculina', 'calcados_acessorios'], gancho: 'look de virada (branco e cores do ano)',
    porNicho: { praia: 'look de virada na praia', lingerie: 'calcinha da cor do desejo para o ano novo' } },
];

const iso = (t: Date) => t.toISOString().slice(0, 10);

/** Datas comerciais dos próximos `dias` que fazem sentido para os nichos da marca. */
export function seasonalCalendar(nichos: string[], now = new Date(), dias = 75): SeasonalDate[] {
  // Data de hoje no fuso de Brasília (UTC-3)
  const br = addDays(now, -0.125);
  const hoje = d(br.getUTCFullYear(), br.getUTCMonth() + 1, br.getUTCDate());
  const fim = addDays(hoje, dias);
  const out: (SeasonalDate & { t: number })[] = [];
  for (const ano of [hoje.getUTCFullYear(), hoje.getUTCFullYear() + 1]) {
    for (const ev of EVENTS) {
      if (ev.nichos && !ev.nichos.some((n) => nichos.includes(n))) continue;
      const t = ev.quando(ano);
      if (t < hoje || t > fim) continue;
      const gancho = nichos.map((n) => ev.porNicho?.[n]).find(Boolean) ?? ev.gancho;
      out.push({ data: iso(t), ocasiao: ev.ocasiao, gancho, t: t.getTime() });
    }
  }
  return out.sort((a, b) => a.t - b.t).map(({ t, ...r }) => r);
}

/** Bloco de contexto pronto para o prompt da análise. */
export function playbookContext(p: PlaybookProfile | null, now = new Date()) {
  const nicho = p ? detectNiche(p) : { principal: FALLBACK, secundarios: [], certeza: 'baixa' as const };
  const ids = [nicho.principal.id, ...nicho.secundarios.map((n) => n.id)];
  return {
    nicho_detectado: {
      principal: nicho.principal.nome,
      outros: nicho.secundarios.map((n) => n.nome),
      certeza: nicho.certeza,
    },
    referencias_do_nicho: {
      gatilhos_de_desejo: nicho.principal.desejo,
      objecoes_comuns: nicho.principal.objecoes,
      formatos_que_vendem: nicho.principal.ideias,
      caixinhas_de_perguntas: nicho.principal.caixinhas,
    },
    sinais_do_perfil: p ? profileSignals(p, now) : null,
    datas_comerciais_proximas: seasonalCalendar(ids, now),
    hoje: iso(addDays(now, -0.125)),
  };
}
