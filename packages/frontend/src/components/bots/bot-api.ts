import { authFetch } from "@/lib/auth-fetch";
import type { WaTemplate } from "@/components/whatsapp/templates";

/* Bots (backend: /automations). Os passos ficam em `actions` e rodam em ordem. */

export type BotStep =
  | { type: "wait"; seconds: number }
  | { type: "wait_reply"; timeoutSeconds?: number }
  | { type: "send_text"; text: string }
  | {
      type: "send_template";
      templateName: string;
      language: string;
      parameterFormat?: "POSITIONAL" | "NAMED";
      bodyText?: string;
      params?: { key: string; value: string }[];
    }
  | { type: "move_stage"; stageId?: string; stageName?: string };

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

export function fmtDuration(s: number) {
  if (s % 86400 === 0 && s >= 86400) return `${s / 86400} dia${s === 86400 ? "" : "s"}`;
  if (s % 3600 === 0 && s >= 3600) return `${s / 3600} h`;
  if (s % 60 === 0 && s >= 60) return `${s / 60} min`;
  return `${s} s`;
}
