import { authFetch } from "@/lib/auth-fetch";
import type { WaTemplate } from "@/components/whatsapp/templates";

/* Bots (backend: /automations). Os passos ficam em `actions` e rodam em ordem;
   desvios ("ir para") apontam para o `id` do passo. Destino vazio = próximo passo, "end" = encerra. */

export type BotStep = { id?: string; name?: string; pos?: { x: number; y: number } } & (
  | { type: "wait"; seconds: number; alignTo?: string; alignWeekends?: boolean }
  | { type: "wait_reply"; captureInstagram?: boolean; timeoutSeconds?: number; alignTo?: string; alignWeekends?: boolean; buttons?: { title: string; goto?: string }[]; onReply?: string; onTimeout?: string }
  | { type: "send_text"; text: string }
  | {
      type: "send_template";
      templateName: string;
      language: string;
      parameterFormat?: "POSITIONAL" | "NAMED";
      bodyText?: string;
      params?: { key: string; value: string }[];
    }
  | {
      type: "send_buttons";
      text: string;
      buttons: { title: string; goto?: string }[];
      onOther?: string;
      timeoutSeconds?: number;
      alignTo?: string;
      alignWeekends?: boolean;
      onTimeout?: string;
    }
  | { type: "move_stage"; stageId?: string; stageName?: string }
  | { type: "add_tag"; tag: string }
  | { type: "notify"; text: string; to?: string }
  | { type: "check_origin"; onKnown?: string; onUnknown?: string }
  | { type: "set_origin"; origin: LeadOrigin; source?: string }
  | { type: "check_instagram"; onKnown?: string; onUnknown?: string }
  | { type: "goto"; target?: string }
  | { type: "end" }
  | { type: "wait_meeting"; seconds: number; when: "before" | "after"; onTime?: string; onLate?: string }
  | { type: "meeting_status"; timeoutSeconds?: number; onDone?: string; onNoShow?: string; onTimeout?: string }
  | { type: "wait_booking"; timeoutSeconds?: number; reminders?: BotReminder[]; giveUpSeconds?: number; onBooked?: string; onReply?: string; onTimeout?: string }
  | { type: "wait_payment"; timeoutSeconds?: number; reminders?: BotReminder[]; giveUpSeconds?: number; onPaid?: string; onReply?: string; onTimeout?: string }
);

/** Passos que só existem nos bots com o gatilho "Reunião agendada". */
export const MEETING_STEP_TYPES: BotStep["type"][] = ["wait_meeting", "meeting_status"];

/** Contact.leadOrigin */
export type LeadOrigin = "ADS" | "ORGANIC" | "REFERRAL" | "OTHER";
export const ORIGIN_LABEL: Record<LeadOrigin, string> = { ADS: "Anúncio", ORGANIC: "Orgânico (Instagram, site…)", REFERRAL: "Indicação", OTHER: "Outra" };

export const newStepId = () => `s${Math.random().toString(36).slice(2, 8)}`;

/** Lembrete para quem não respondeu (vale para toda espera por resposta do bot). Texto só com a janela de 24h aberta. */
export type BotReminder = { afterSeconds: number } & (
  | (Extract<BotStep, { type: "send_text" }> & { buttonsText?: string }) // buttonsText: versão para pergunta com botões
  | Extract<BotStep, { type: "send_template" }>
);

export interface BotConditions { onlyPhones?: string[]; reminders?: BotReminder[]; giveUpSeconds?: number; stageId?: string }

export interface BotStats { sessions: number; active: number; completed: number; failed: number; sent: number; replied: number; lastRunAt: string | null }

export interface Bot {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  triggerLabel: string;
  conditions: BotConditions;
  actions: BotStep[];
  active: boolean;
  createdAt: string;
  stats: BotStats;
}

/** Sessões (sem as de teste) por passo do array salvo: onde estão agora ou onde terminaram. */
export interface BotStepStat { stepIndex: number; status: string; count: number }
/** `visited`: sessões que passaram por cada passo (id); `tracked`: sessões com esse histórico. */
export interface BotStepStats { runs: BotStepStat[]; visited: Record<string, number>; tracked: number }

export interface BotRun {
  id: string;
  status: string;
  stepIndex: number;
  sentCount: number;
  isTest: boolean;
  repliedAt: string | null;
  lastError: string | null;
  startedAt: string;
  finishedAt: string | null;
  conversationId: string | null;
  contact: { id: string; name: string; phone: string | null } | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`/api/v1/automations${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error([].concat(data?.message ?? `Erro ${res.status}`).join(" "));
  return data as T;
}

export const botsApi = {
  list: () => req<Bot[]>(""),
  runs: (id: string) => req<BotRun[]>(`/${id}/runs`),
  stepStats: (id: string) => req<BotStepStats>(`/${id}/step-stats`),
  create: (body: Partial<Bot>) => req<Bot>("", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Bot>) => req<Bot>(`/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => req<{ ok: true }>(`/${id}`, { method: "DELETE" }),
  test: (id: string, phone: string, name?: string) => req<{ ok: true; runId: string }>(`/${id}/test`, { method: "POST", body: JSON.stringify({ phone, name }) }),
};

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g;
const bodyOf = (t: WaTemplate) => t.components?.find((c) => c.type === "BODY")?.text || "";

/** Passo de template a partir do template da Meta: a 1ª variável recebe o primeiro nome do contato. */
export function templateStep(t: WaTemplate): BotStep {
  const keys: string[] = [];
  for (const m of bodyOf(t).matchAll(VAR_RE)) if (!keys.includes(m[1])) keys.push(m[1]);
  return {
    type: "send_template",
    templateName: t.name,
    language: t.language,
    parameterFormat: t.parameter_format === "NAMED" ? "NAMED" : "POSITIONAL",
    bodyText: bodyOf(t),
    params: keys.map((key, i) => ({ key, value: i === 0 ? "{{primeiro_nome}}" : "" })),
  };
}

/** Template usado no Kommo para o formulário ("Aqui é *Duda da Dua*"), se estiver aprovado na WABA. */
export function findFormTemplate(templates: WaTemplate[]) {
  const ok = templates.filter((t) => t.status === "APPROVED");
  return ok.find((t) => /duda da dua/i.test(bodyOf(t)) && /formul[aá]rio/i.test(bodyOf(t))) ?? ok.find((t) => /duda da dua/i.test(bodyOf(t)));
}

export const FORM_BOT_TEXT =
  "Perfeito! Já consegui entender um pouco melhor o que você está buscando. 😊\n\nVou deixar essas informações registradas por aqui e, a partir de agora, nosso time vai continuar seu atendimento para entender melhor o momento da sua marca.";

/** Réplica do Salesbot "FINALIZOU O CADASTRO NO SITE DUA" do Kommo. */
export function formBotPreset(template: WaTemplate | undefined): Partial<Bot> {
  return {
    name: "Finalizou o cadastro no site",
    description: "Manda a 1ª mensagem no WhatsApp para quem preencheu o formulário e passa o lead para o time quando ele responde",
    trigger: "LEAD_FORM_SUBMITTED",
    active: false,
    actions: [
      { type: "wait", seconds: 10 },
      template ? templateStep(template) : { type: "send_template", templateName: "", language: "pt_BR", params: [] },
      { type: "wait_reply" },
      { type: "wait", seconds: 60 },
      { type: "send_text", text: FORM_BOT_TEXT },
      { type: "move_stage", stageName: "Qualificação" },
    ],
  };
}

/** Template de follow-up para quem não respondeu a 1ª mensagem do formulário. */
export function findFollowupTemplate(templates: WaTemplate[]) {
  const ok = templates.filter((t) => t.status === "APPROVED");
  return ok.find((t) => /followup_cadastro_site/i.test(t.name)) ?? ok.find((t) => /conseguiu ver minha mensagem/i.test(bodyOf(t)));
}

const H = 3600;
const QUALIFY_BUTTONS = (existing: string, fresh: string) => [
  { title: "Já estou vendendo", goto: existing },
  { title: "Estou começando", goto: fresh },
];

const INSTAGRAM_QUESTION = "Só mais uma coisinha, {{primeiro_nome}}: qual é o @ da sua marca no Instagram? Assim o Daniel já chega na conversa conhecendo o perfil de vocês 😊\n\nSe ainda não tiver, é só me avisar.";

/**
 * Roteiro de qualificação (do passo "momento" em diante), igual para o formulário e para o WhatsApp:
 * já vende ou está começando → 2 perguntas de cada caminho → convite para a call (link de agendamento).
 * Quem para no meio cai em "parou" (aviso para o Daniel).
 */
function qualifySteps(momentoText: string): BotStep[] {
  return [
    {
      id: "momento", name: "Momento da marca", type: "send_buttons",
      text: momentoText,
      buttons: QUALIFY_BUTTONS("existente", "nova"), onOther: "momento_de_novo", timeoutSeconds: 4 * H, onTimeout: "parou",
    },
    {
      id: "momento_de_novo", type: "send_buttons",
      text: "É só tocar numa das opções aqui embaixo 👇",
      buttons: QUALIFY_BUTTONS("existente", "nova"), onOther: "parou", timeoutSeconds: 4 * H, onTimeout: "parou",
    },

    { id: "existente", name: "Marca existente", type: "add_tag", tag: "marca existente" },
    {
      id: "aquisicao", type: "send_text",
      text: "Vi aqui que vocês vendem {{canal_venda}}.\nHoje a maior parte dos clientes chega como: indicação, Instagram orgânico ou anúncio? E vocês já investem em tráfego pago?",
    },
    { id: "espera_aquisicao", type: "wait_reply", timeoutSeconds: 4 * H, onTimeout: "parou" },
    { id: "pausa_ex", type: "wait", seconds: 30 },
    {
      id: "followup_pergunta", type: "send_text",
      text: "Faz sentido!\n\nÚltima pergunta: quando alguém chama no WhatsApp, pergunta preço ou produto e não compra, vocês costumam fazer algum acompanhamento depois?",
    },
    { id: "espera_followup", type: "wait_reply", timeoutSeconds: 4 * H, onReply: "pausa_convite", onTimeout: "parou" },

    { id: "nova", name: "Marca nova", type: "add_tag", tag: "marca nova" },
    { id: "produto", type: "send_text", text: "Que legal, adoro acompanhar marca nascendo! ✨\n\nMe conta: o produto já está pronto ou vocês ainda estão desenvolvendo?" },
    { id: "espera_produto", type: "wait_reply", timeoutSeconds: 4 * H, onTimeout: "parou" },
    { id: "pausa_nova", type: "wait", seconds: 30 },
    {
      id: "orcamento", name: "Orçamento", type: "send_buttons",
      text: "Ótimo! E vocês já separaram um orçamento pra colocar a marca no mercado e investir em marketing?",
      buttons: [{ title: "Sim, já separei", goto: "pausa_convite" }, { title: "Ainda vou definir", goto: "sem_orcamento" }],
      onOther: "pausa_convite", timeoutSeconds: 4 * H, onTimeout: "parou",
    },
    { id: "sem_orcamento", type: "add_tag", tag: "sem orçamento definido" },

    { id: "pausa_convite", name: "Convite", type: "wait", seconds: 30 },
    { id: "tem_instagram", name: "Já temos o @?", type: "check_instagram", onKnown: "convite" },
    { id: "pede_instagram", name: "Pergunta o @", type: "send_text", text: INSTAGRAM_QUESTION },
    { id: "espera_instagram", type: "wait_reply", captureInstagram: true, timeoutSeconds: 4 * H, onTimeout: "parou" },
    { id: "pausa_instagram", type: "wait", seconds: 20 },
    {
      id: "convite", type: "send_text",
      text: "Perfeito, {{primeiro_nome}}! Com o que você me contou já dá pra preparar uma conversa bem direcionada pro momento da sua marca 💜\n\nQuem vai conversar com você é o *Daniel*, que cuida da estratégia aqui na Dua. São 45 min por vídeo: ele entende seu cenário com calma, te mostra como a gente trabalha e, se fizer sentido pros dois lados, vocês veem os próximos passos.\n\nEscolhe o melhor horário aqui: https://crm.duacriativa.com.br/agendar/especialista",
    },
    { id: "aviso_fim", type: "notify", to: "Daniel", text: "{{primeiro_nome}} concluiu a qualificação e recebeu o link de agendamento.\n\nRespostas:\n{{respostas}}" },
    { id: "fim", type: "end" },

    { id: "parou", name: "Parou no meio", type: "notify", to: "Daniel", text: "{{primeiro_nome}} parou no meio da qualificação. O que respondeu até agora:\n{{respostas}}" },
    { id: "fim_parou", type: "end" },
  ];
}

/**
 * Quem pediu o link no meio das perguntas ("me manda o link", "quero agendar"): o bot pula para cá.
 * Fica no fim do bot (só se chega por esse pulo). O id "pediu_link" é o que o executor procura.
 */
const LINK_AGENDAMENTO = "https://crm.duacriativa.com.br/agendar/especialista";
export const ASKED_LINK_STEPS: BotStep[] = [
  { id: "pediu_link", name: "Pediu o link", type: "add_tag", tag: "pulou as perguntas" },
  {
    id: "convite_direto", type: "send_text",
    text: `Claro, {{primeiro_nome}}! 💜\n\nQuem vai conversar com você é o *Daniel*, que cuida da estratégia aqui na Dua. São 45 min por vídeo: ele entende o momento da sua marca, te mostra como a gente trabalha e, se fizer sentido pros dois lados, vocês veem os próximos passos.\n\nEscolhe o melhor horário aqui: ${LINK_AGENDAMENTO}`,
  },
  { id: "aviso_pediu_link", type: "notify", to: "Daniel", text: "{{primeiro_nome}} pediu pra pular as perguntas e já recebeu o link de agendamento. Vale olhar a conversa antes da call.\n\nO que respondeu até agora:\n{{respostas}}" },
  { id: "fim_pediu_link", type: "end" },
];

/**
 * Quem recusou um lembrete em template ("Agora não"): o bot agradece, marca e encerra, sem novos lembretes.
 * Fica no fim do bot (só se chega por esse pulo). O id "recusou" é o que o executor procura.
 */
export const DECLINED_STEPS: BotStep[] = [
  { id: "recusou", name: "Recusou o lembrete", type: "send_text", text: "Tranquilo, {{primeiro_nome}}! Obrigada por responder 💜 Se mudar de ideia, é só me chamar aqui." },
  { id: "recusou_tag", type: "add_tag", tag: "recusou no lembrete" },
  { id: "recusou_etapa", type: "move_stage", stageName: "Esfriou 🧊" },
  { id: "recusou_aviso", type: "notify", to: "Daniel", text: "{{primeiro_nome}} recusou o lembrete da qualificação e o bot encerrou.\n\nO que respondeu:\n{{respostas}}" },
  { id: "recusou_fim", type: "end" },
];

/**
 * Qualificação de quem preencheu o formulário, seguindo o roteiro da call do Dua Lab:
 * 1ª mensagem → follow-up se não responder → marca já vende ou está começando →
 * 2 perguntas de diagnóstico de cada caminho → convite para a call com o Daniel (link de agendamento).
 * O bot para sozinho quando alguém do time escreve na conversa.
 */
export function formQualifyPreset(first: WaTemplate | undefined, followup: WaTemplate | undefined): Partial<Bot> {
  const tpl = (t: WaTemplate | undefined): BotStep => (t ? templateStep(t) : { type: "send_template", templateName: "", language: "pt_BR", params: [] });
  const steps: BotStep[] = [
    { id: "inicio", type: "wait", seconds: 10 },
    { id: "msg1", name: "1ª mensagem", ...tpl(first) } as BotStep,
    { id: "espera1", type: "wait_reply", timeoutSeconds: 8 * H, alignTo: "10:00", alignWeekends: true, onReply: "respondeu", onTimeout: "followup" },
    { id: "followup", name: "Follow-up", ...tpl(followup) } as BotStep,
    { id: "espera_fu", type: "wait_reply", timeoutSeconds: 3 * 24 * H, onReply: "respondeu", onTimeout: "sem_resposta" },
    { id: "sem_resposta", name: "Não respondeu", type: "add_tag", tag: "sem resposta do bot" },
    { id: "fim_sem_resposta", type: "end" },

    { id: "respondeu", name: "Respondeu", type: "move_stage", stageName: "Qualificação" },
    { id: "aviso1", type: "notify", to: "Daniel", text: "{{primeiro_nome}} respondeu o bot do site:\n{{respostas}}" },
    { id: "pausa1", type: "wait", seconds: 40 },
    ...qualifySteps("Entendi, {{primeiro_nome}}, obrigada por me contar! 😊\n\nPra eu te direcionar certinho: a sua marca já está vendendo ou está começando agora?"),
  ];
  return {
    name: "Qualificação do cadastro no site",
    description: "1ª mensagem + follow-up, entende se a marca já vende ou está começando e convida para a call com o Daniel",
    trigger: "LEAD_FORM_SUBMITTED",
    active: false,
    actions: [...steps, ...ASKED_LINK_STEPS],
  };
}

/**
 * Pré-qualificação de quem chama direto no WhatsApp (bio do Instagram, botão do site, anúncio, indicação).
 * A pessoa acabou de escrever, então a janela de 24h está aberta e a 1ª mensagem é texto livre.
 * Origem: anúncio de clique para WhatsApp ou texto pronto do link; sem isso, pergunta com botões.
 */
export function whatsappQualifyPreset(): Partial<Bot> {
  const steps: BotStep[] = [
    { id: "inicio", type: "wait", seconds: 5 },
    { id: "origem", name: "Sabemos a origem?", type: "check_origin", onUnknown: "pergunta_origem" },
    { id: "saudacao", name: "Saudação", type: "send_text", text: "Oi, {{primeiro_nome}}! Aqui é a Duda, da Dua 💜 Que bom que você chamou por aqui!" },
    { id: "registro", type: "move_stage", stageName: "Qualificação" },
    { id: "aviso_inicio", type: "notify", to: "Daniel", text: "{{primeiro_nome}} chamou direto no WhatsApp e entrou no bot de pré-qualificação. Origem: {{origem}}." },
    { id: "pausa1", type: "wait", seconds: 4 },
    ...qualifySteps("Pra eu te direcionar certinho: a sua marca já está vendendo ou está começando agora?"),

    {
      id: "pergunta_origem", name: "Como conheceu a Dua", type: "send_buttons",
      text: "Oi, {{primeiro_nome}}! Aqui é a Duda, da Dua 💜 Que bom que você chamou por aqui!\n\nAntes de tudo, me conta: como você conheceu a Dua?",
      buttons: [
        { title: "Instagram", goto: "origem_instagram" },
        { title: "Indicação", goto: "origem_indicacao" },
        { title: "Anúncio / Google", goto: "origem_anuncio" },
      ],
      onOther: "registro", timeoutSeconds: 4 * H, onTimeout: "parou",
    },
    { id: "origem_instagram", type: "set_origin", origin: "ORGANIC", source: "instagram" },
    { id: "ir_registro_1", type: "goto", target: "registro" },
    { id: "origem_indicacao", type: "set_origin", origin: "REFERRAL", source: "indicacao" },
    { id: "ir_registro_2", type: "goto", target: "registro" },
    { id: "origem_anuncio", type: "set_origin", origin: "ADS", source: "anuncio_google" },
    { id: "ir_registro_3", type: "goto", target: "registro" },
  ];
  return {
    name: "Pré-qualificação do WhatsApp",
    description: "Quem chama direto no WhatsApp: descobre a origem (ou pergunta), entende se a marca já vende ou está começando e convida para a call",
    trigger: "WHATSAPP_FIRST_MESSAGE",
    active: false,
    actions: [...steps, ...ASKED_LINK_STEPS, ...DECLINED_STEPS],
  };
}

/**
 * Templates (MARKETING, pt_BR) do Plano 90 Dias. {{1}} = primeiro nome.
 * A oferta leva os botões de resposta rápida de PLANO_BUTTONS, com o mesmo texto.
 */
export const PLANO_BUTTONS = ["Quero o plano", "Tenho uma dúvida", "Agora não"];
export const PLANO_TEMPLATES = {
  oferta: {
    name: "plano_90_dias_oferta",
    body: "Oi, {{1}}! Aqui é o Daniel, da Dua 💜\n\nCriamos um Plano de Conteúdo de 90 dias pra quem quer organizar o Instagram da marca e colocar a mão na massa.\n\nSão 3 meses feitos só pra sua marca, com o que postar, roteiros, stories e o que contratar. Vai tudo bem detalhado pra você executar por aí.\n\nÉ R$ 297 no Pix, pagamento único, e chega em até 24h.",
  },
  lembrete: {
    name: "plano_90_dias_lembrete",
    body: "Oi, {{1}}! Não sei se você chegou a ver minha mensagem sobre o plano de 90 dias. Se não for o momento, tudo bem! Se quiser saber mais, é só me responder aqui.",
  },
};

/** Template aprovado com esse nome, ou passo vazio para escolher depois. */
const namedTemplate = (templates: WaTemplate[], name: string): BotStep => {
  const t = templates.find((x) => x.status === "APPROVED" && x.name === name);
  return t ? templateStep(t) : { type: "send_template", templateName: "", language: "pt_BR", params: [] };
};

/** Passos do Plano 90 Dias, com o nome dos templates já aprovados e a etapa de quem desistiu. */
export function planoSteps(oferta: BotStep, lembrete: BotStep, coldStage = "Esfriou 🧊"): BotStep[] {
  const buttons = [
    { title: PLANO_BUTTONS[0], goto: "quero" },
    { title: PLANO_BUTTONS[1], goto: "duvida" },
    { title: PLANO_BUTTONS[2], goto: "agora_nao" },
  ];
  return [
    { id: "oferta", name: "Oferta", ...oferta } as BotStep,
    { id: "espera1", type: "wait_reply", timeoutSeconds: 2 * 24 * H, alignTo: "10:00", alignWeekends: true, buttons, onReply: "escreveu", onTimeout: "lembrete" },
    { id: "lembrete", name: "Lembrete", ...lembrete } as BotStep,
    { id: "espera2", type: "wait_reply", timeoutSeconds: 3 * 24 * H, buttons, onReply: "escreveu", onTimeout: "sem_resposta" },
    { id: "sem_resposta", name: "Não respondeu", type: "add_tag", tag: "plano sem resposta" },
    { id: "fim_sem_resposta", type: "end" },

    { id: "escreveu", name: "Escreveu outra coisa", type: "notify", to: "Daniel", text: "{{primeiro_nome}} respondeu a oferta do Plano 90 dias:\n{{respostas}}" },
    { id: "fim_escreveu", type: "end" },

    { id: "quero", name: "Quero o plano", type: "send_text", text: "Boa, {{primeiro_nome}}! Fico feliz 💜" },
    { id: "pausa_quero", type: "wait", seconds: 8 },
    { id: "link", name: "Link", type: "send_text", text: "Pra montar o seu, preciso entender um pouco da sua marca. São umas perguntinhas rápidas, e no final já sai o Pix:\nhttps://crm.duacriativa.com.br/plano-90-dias" },
    { id: "aviso_quero", type: "notify", to: "Daniel", text: "{{primeiro_nome}} quer o Plano 90 dias. O link já foi enviado." },
    {
      id: "espera_pagamento", name: "Esperar pagamento", type: "wait_payment", timeoutSeconds: 72 * H, giveUpSeconds: 48 * H,
      // 23h30: qualquer hora, antes de a janela de 24h do WhatsApp fechar
      reminders: [{ afterSeconds: 23.5 * H, type: "send_text", text: "Oi, {{primeiro_nome}}! Conseguiu dar uma olhada? Se travou em alguma parte ou ficou alguma dúvida, me fala aqui." }],
      onPaid: "pagou", onReply: "escreveu_pagamento", onTimeout: "nao_pagou",
    },
    { id: "pagou", name: "Pagou", type: "send_text", text: "Caiu aqui, {{primeiro_nome}}! 🙌 Já vou começar o seu plano e em até 24h te mando por aqui mesmo." },
    { id: "fim_pagou", type: "end" },
    { id: "escreveu_pagamento", type: "notify", to: "Daniel", text: "{{primeiro_nome}} escreveu enquanto o bot esperava o pagamento do plano:\n{{respostas}}" },
    { id: "volta_pagamento", type: "goto", target: "espera_pagamento" },
    { id: "nao_pagou", name: "Não pagou", type: "add_tag", tag: "plano sem pagamento" },
    { id: "esfriou_pagamento", type: "move_stage", stageName: coldStage },
    { id: "fim_nao_pagou", type: "end" },

    { id: "duvida", name: "Tenho uma dúvida", type: "send_text", text: "Claro! Me conta, o que você quer saber?" },
    { id: "espera_duvida", type: "wait_reply", timeoutSeconds: 7 * 24 * H, onReply: "aviso_duvida" },
    { id: "aviso_duvida", type: "notify", to: "Daniel", text: "{{primeiro_nome}} tem uma dúvida sobre o Plano 90 dias:\n{{respostas}}" },
    { id: "fim_duvida", type: "end" },

    { id: "agora_nao", name: "Agora não", type: "send_text", text: "Tranquilo, {{primeiro_nome}}! Obrigado por responder 💜 Se mudar de ideia, é só me chamar aqui." },
    { id: "tag_recusou", type: "add_tag", tag: "plano recusado" },
    { id: "esfriou_recusou", type: "move_stage", stageName: coldStage },
    { id: "fim_recusou", type: "end" },
  ];
}

/**
 * Plano 90 Dias para quem não tem perfil para a gestão completa: o time arrasta o card para a etapa
 * e o bot apresenta o plano com botões, manda o link, confere o pagamento e avisa o Daniel.
 */
export function planoPreset(templates: WaTemplate[], stageId?: string): Partial<Bot> {
  return {
    name: "Plano de 90 dias",
    description: "Card arrastado para a etapa: apresenta o plano com botões, manda o link, confere o pagamento e avisa o Daniel",
    trigger: "LEAD_STAGE_ENTERED",
    conditions: stageId ? { stageId } : {},
    active: false,
    actions: planoSteps(namedTemplate(templates, PLANO_TEMPLATES.oferta.name), namedTemplate(templates, PLANO_TEMPLATES.lembrete.name)),
  };
}

/**
 * Templates (UTILITY, pt_BR) dos lembretes de reunião. Fora da janela de 24h do WhatsApp só template
 * aprovado chega, então todas as mensagens do modelo são templates. `vars`: valor de cada {{n}}, na ordem.
 * Ainda NÃO enviados para aprovação: criar em Configurações → Templates com estes nomes e textos.
 */
export const MEETING_TEMPLATES = {
  confirmacao: {
    name: "reuniao_confirmada",
    body: "Oi, {{1}}! Sua reunião com a Dua está confirmada para {{2}}, às {{3}} (horário de Brasília). 💜\n\nO link do Google Meet foi enviado para o seu e-mail, e eu também te mando por aqui antes da conversa.\n\nSe precisar remarcar ou cancelar, é só acessar: {{4}}\n\nAté lá!",
    vars: ["{{primeiro_nome}}", "{{reuniao_data}}", "{{reuniao_hora}}", "{{link_remarcar}}"],
  },
  lembrete24h: {
    name: "reuniao_lembrete_24h",
    body: "Oi, {{1}}! Passando para lembrar da sua reunião com a Dua: {{2}}, às {{3}} (horário de Brasília).\n\nSe o horário não der mais certo, você pode remarcar por aqui: {{4}}\n\nNos vemos lá!",
    vars: ["{{primeiro_nome}}", "{{reuniao_data}}", "{{reuniao_hora}}", "{{link_remarcar}}"],
  },
  lembrete1h: {
    name: "reuniao_lembrete_1h",
    body: "Oi, {{1}}! Sua reunião com a Dua começa às {{2}} (horário de Brasília).\n\nPara entrar, é só acessar o Google Meet: {{3}}\n\nTe esperamos!",
    vars: ["{{primeiro_nome}}", "{{reuniao_hora}}", "{{meet}}"],
  },
  jaNaSala: {
    name: "reuniao_ja_na_sala",
    body: "Hey, {{1}}! Já tô na sala te esperando 💜\n\nÉ só entrar por aqui: {{2}}\n\nAté já!",
    vars: ["{{primeiro_nome}}", "{{meet}}"],
  },
  naoCompareceu: {
    name: "reuniao_nao_compareceu",
    body: "Oi, {{1}}! Não conseguimos nos encontrar na reunião de {{2}}. Imagino que tenha surgido algum imprevisto.\n\nSe ainda fizer sentido conversar, escolha um novo horário aqui: {{3}}\n\nQualquer dúvida, é só responder esta mensagem.",
    vars: ["{{primeiro_nome}}", "{{reuniao_data}}", "{{link_agendamento}}"],
  },
};

type MeetingTpl = (typeof MEETING_TEMPLATES)[keyof typeof MEETING_TEMPLATES];

/** Passo do template: o aprovado na WABA, se já existir; senão já preenchido com o texto proposto (falha até ser aprovado). */
function meetingTemplateStep(templates: WaTemplate[], t: MeetingTpl): BotStep {
  const approved = templates.find((x) => x.name === t.name && x.status === "APPROVED");
  const base = approved ? templateStep(approved) : null;
  const keys = base?.type === "send_template" && base.params?.length ? base.params.map((p) => p.key) : t.vars.map((_, i) => String(i + 1));
  return {
    type: "send_template",
    templateName: t.name,
    language: base?.type === "send_template" ? base.language : "pt_BR",
    parameterFormat: base?.type === "send_template" ? base.parameterFormat : "POSITIONAL",
    bodyText: base?.type === "send_template" ? base.bodyText : t.body,
    params: keys.map((key, i) => ({ key, value: t.vars[i] ?? "" })),
  };
}

/**
 * Lembretes da reunião: confirmação logo após agendar, lembrete 24h antes, lembrete 1h antes com o Meet
 * e, depois da reunião, follow-up para quem não compareceu. Remarcou → as esperas seguem o novo horário;
 * cancelou → a sessão é cancelada; marcou em cima da hora → pula o lembrete que já passou.
 */
export function meetingRemindersPreset(templates: WaTemplate[]): Partial<Bot> {
  const T = MEETING_TEMPLATES;
  const steps: BotStep[] = [
    { id: "confirmacao", name: "Confirmação", ...meetingTemplateStep(templates, T.confirmacao) } as BotStep,
    { id: "espera_24h", name: "24h antes", type: "wait_meeting", seconds: 24 * H, when: "before", onLate: "espera_1h" },
    { id: "lembrete_24h", name: "Lembrete 24h", ...meetingTemplateStep(templates, T.lembrete24h) } as BotStep,
    { id: "espera_1h", name: "1h antes", type: "wait_meeting", seconds: H, when: "before", onLate: "espera_sala" },
    { id: "lembrete_1h", name: "Lembrete 1h (Meet)", ...meetingTemplateStep(templates, T.lembrete1h) } as BotStep,
    // Passou de 15 min do início sem enviar (servidor fora do ar): pula o "já tô na sala"
    { id: "espera_sala", name: "1 min depois do início", type: "wait_meeting", seconds: 60, when: "after", onLate: "depois" },
    { id: "ja_na_sala", name: "Já na sala (Meet)", ...meetingTemplateStep(templates, T.jaNaSala) } as BotStep,
    { id: "depois", name: "15 min depois do início", type: "wait_meeting", seconds: 15 * 60, when: "after", onLate: "status" },
    { id: "status", name: "Reunião aconteceu?", type: "meeting_status", timeoutSeconds: 24 * H, onDone: "end", onNoShow: "faltou" },
    { id: "faltou", name: "Não compareceu", type: "add_tag", tag: "não compareceu" },
    { id: "followup_falta", name: "Follow-up de falta", ...meetingTemplateStep(templates, T.naoCompareceu) } as BotStep,
    { id: "aviso_falta", type: "notify", to: "Daniel", text: "{{primeiro_nome}} não compareceu à reunião de {{reuniao_data}}, às {{reuniao_hora}}, e recebeu o link para remarcar." },
    { id: "fim_falta", type: "end" },
  ];
  return {
    name: "Lembretes da reunião",
    description: "Confirma o agendamento, lembra 24h e 1h antes (com o Meet), avisa 1 min depois do início que já está na sala e manda follow-up para quem não compareceu",
    trigger: "MEETING_SCHEDULED",
    active: false,
    actions: steps,
  };
}

export function fmtDuration(s: number) {
  if (s % 86400 === 0 && s >= 86400) return `${s / 86400} dia${s === 86400 ? "" : "s"}`;
  if (s % 3600 === 0 && s >= 3600) return `${s / 3600} h`;
  if (s % 60 === 0 && s >= 60) return `${s / 60} min`;
  return `${s} s`;
}
