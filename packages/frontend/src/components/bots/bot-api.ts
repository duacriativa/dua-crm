import { authFetch } from "@/lib/auth-fetch";
import type { WaTemplate } from "@/components/whatsapp/templates";

/* Bots (backend: /automations). Os passos ficam em `actions` e rodam em ordem;
   desvios ("ir para") apontam para o `id` do passo. Destino vazio = próximo passo, "end" = encerra. */

export type BotStep = { id?: string; name?: string } & (
  | { type: "wait"; seconds: number; alignTo?: string }
  | { type: "wait_reply"; timeoutSeconds?: number; alignTo?: string; onReply?: string; onTimeout?: string }
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
      onTimeout?: string;
    }
  | { type: "move_stage"; stageId?: string; stageName?: string }
  | { type: "add_tag"; tag: string }
  | { type: "notify"; text: string; to?: string }
  | { type: "goto"; target?: string }
  | { type: "end" }
);

export const newStepId = () => `s${Math.random().toString(36).slice(2, 8)}`;

export interface BotStats { sessions: number; active: number; completed: number; failed: number; sent: number; replied: number; lastRunAt: string | null }

export interface Bot {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  triggerLabel: string;
  conditions: { onlyPhones?: string[] };
  actions: BotStep[];
  active: boolean;
  createdAt: string;
  stats: BotStats;
}

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

/**
 * Qualificação de quem preencheu o formulário, seguindo o roteiro da call do Dua Lab:
 * 1ª mensagem → follow-up se não responder → marca já vende ou está começando →
 * 2 perguntas de diagnóstico de cada caminho → convite para a call com o Daniel (Calendly).
 * O bot para sozinho quando alguém do time escreve na conversa.
 */
export function formQualifyPreset(first: WaTemplate | undefined, followup: WaTemplate | undefined): Partial<Bot> {
  const tpl = (t: WaTemplate | undefined): BotStep => (t ? templateStep(t) : { type: "send_template", templateName: "", language: "pt_BR", params: [] });
  const steps: BotStep[] = [
    { id: "inicio", type: "wait", seconds: 10 },
    { id: "msg1", name: "1ª mensagem", ...tpl(first) } as BotStep,
    { id: "espera1", type: "wait_reply", timeoutSeconds: 8 * H, alignTo: "10:00", onReply: "respondeu", onTimeout: "followup" },
    { id: "followup", name: "Follow-up", ...tpl(followup) } as BotStep,
    { id: "espera_fu", type: "wait_reply", timeoutSeconds: 3 * 24 * H, onReply: "respondeu", onTimeout: "sem_resposta" },
    { id: "sem_resposta", name: "Não respondeu", type: "add_tag", tag: "sem resposta do bot" },
    { id: "fim_sem_resposta", type: "end" },

    { id: "respondeu", name: "Respondeu", type: "move_stage", stageName: "Qualificação" },
    { id: "aviso1", type: "notify", to: "Daniel", text: "{{primeiro_nome}} respondeu o bot do site:\n{{respostas}}" },
    { id: "pausa1", type: "wait", seconds: 40 },
    {
      id: "momento", name: "Momento da marca", type: "send_buttons",
      text: "Entendi, {{primeiro_nome}}, obrigada por me contar! 😊\n\nPra eu te direcionar certinho: a sua marca já está vendendo ou está começando agora?",
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
    {
      id: "convite", type: "send_text",
      text: "Perfeito, {{primeiro_nome}}! Com o que você me contou já dá pra preparar uma conversa bem direcionada pro momento da sua marca 💜\n\nQuem vai conversar com você é o *Daniel*, que cuida da estratégia aqui na Dua. São 45 min por vídeo: ele entende seu cenário com calma, te mostra como a gente trabalha e, se fizer sentido pros dois lados, vocês veem os próximos passos.\n\nEscolhe o melhor horário aqui: https://calendly.com/duacriativa/45min",
    },
    { id: "aviso_fim", type: "notify", to: "Daniel", text: "{{primeiro_nome}} concluiu a qualificação e recebeu o link do Calendly.\n\nRespostas:\n{{respostas}}" },
    { id: "fim", type: "end" },

    { id: "parou", name: "Parou no meio", type: "notify", to: "Daniel", text: "{{primeiro_nome}} parou no meio da qualificação. O que respondeu até agora:\n{{respostas}}" },
    { id: "fim_parou", type: "end" },
  ];
  return {
    name: "Qualificação do cadastro no site",
    description: "1ª mensagem + follow-up, entende se a marca já vende ou está começando e convida para a call com o Daniel",
    trigger: "LEAD_FORM_SUBMITTED",
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
