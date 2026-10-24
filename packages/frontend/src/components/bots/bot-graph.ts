import type { BotStep } from "./bot-api";
import { newStepId } from "./bot-api";

/*
  Bot como grafo para o editor visual.
  Cartões = passos de `actions`, menos os "Ir para" (viram só a seta).
  Cada saída de um cartão aponta para outro cartão ou para null (o bot encerra).
  Ao salvar, os passos voltam para um array em que o executor (que roda em ordem,
  "destino vazio = próximo passo") faz exatamente o que as setas mostram.
*/

export interface FlowLink { target: string | null; implicit: boolean } // implicit: veio de "destino vazio"
export interface BotGraph {
  start: string | null; // primeiro cartão
  nodes: BotStep[]; // sempre com id; sem passos "goto"
  links: Record<string, FlowLink>; // chave `${id}|${saída}`
  gotoAfter: Record<string, string>; // id do "Ir para" que vinha depois do cartão (reaproveitado ao salvar)
}

export type OutKind = "next" | "reply" | "timeout" | "other" | "button";
export interface Output { handle: string; kind: OutKind; label: string }

const LINEAR = new Set<BotStep["type"]>(["wait", "send_text", "send_template", "move_stage", "add_tag", "notify", "set_origin"]);
export const isLinear = (s: BotStep) => LINEAR.has(s.type);

export const linkKey = (id: string, handle: string) => `${id}|${handle}`;
const NONE: FlowLink = { target: null, implicit: false };
export const linkOf = (g: BotGraph, id: string, handle: string) => g.links[linkKey(id, handle)] ?? NONE;

/** Saídas de um cartão, na ordem em que aparecem. */
export function outputsOf(s: BotStep): Output[] {
  if (isLinear(s)) return [{ handle: "next", kind: "next", label: "Depois" }];
  if (s.type === "wait_reply") return [
    { handle: "reply", kind: "reply", label: "Respondeu" },
    { handle: "timeout", kind: "timeout", label: "Não respondeu" },
  ];
  if (s.type === "check_origin") return [
    { handle: "known", kind: "reply", label: "Sabemos a origem" },
    { handle: "unknown", kind: "other", label: "Não sabemos" },
  ];
  if (s.type === "wait_meeting") return [
    { handle: "time", kind: "next", label: "Na hora" },
    { handle: "late", kind: "other", label: "Horário já passou" },
  ];
  if (s.type === "meeting_status") return [
    { handle: "done", kind: "reply", label: "Realizada" },
    { handle: "noshow", kind: "other", label: "Não compareceu" },
    { handle: "timeout", kind: "timeout", label: "Ninguém marcou" },
  ];
  if (s.type === "send_buttons") return [
    ...s.buttons.map((b, k) => ({ handle: `b${k}`, kind: "button" as const, label: b.title || `Botão ${k + 1}` })),
    { handle: "other", kind: "other", label: "Escreveu outra coisa" },
    { handle: "timeout", kind: "timeout", label: "Sem resposta" },
  ];
  return [];
}

/** Índice do array → cartão em que o bot cai, atravessando os "Ir para" (null = encerra). */
export function landAt(steps: BotStep[], i: number): string | null {
  for (let n = 0; n <= steps.length; n++) {
    if (i < 0 || i >= steps.length) return null;
    const s = steps[i];
    if (s.type !== "goto") return s.id ?? null;
    i = !s.target ? i + 1 : s.target === "end" ? -1 : steps.findIndex((x) => x.id === s.target);
  }
  return null; // "Ir para" em círculo
}

/** Lê os passos salvos. Mesmo raciocínio de `indexOf` do AutomationRunner. */
export function toGraph(actions: BotStep[]): BotGraph {
  const steps = actions.map((s) => (s.id ? s : ({ ...s, id: newStepId() } as BotStep)));
  const idx = (id: string) => steps.findIndex((s) => s.id === id);
  const land = (i: number) => landAt(steps, i);
  const resolve = (t: string | undefined, i: number) => (!t ? land(i + 1) : t === "end" ? null : land(idx(t)));

  const links: Record<string, FlowLink> = {};
  const gotoAfter: Record<string, string> = {};
  const set = (id: string, handle: string, target: string | null, implicit: boolean) => { links[linkKey(id, handle)] = { target, implicit }; };

  steps.forEach((s, i) => {
    const id = s.id!;
    if (isLinear(s)) {
      set(id, "next", land(i + 1), true);
      if (steps[i + 1]?.type === "goto") gotoAfter[id] = steps[i + 1].id!;
    } else if (s.type === "wait_reply") {
      set(id, "reply", resolve(s.onReply, i), !s.onReply);
      set(id, "timeout", s.onTimeout ? resolve(s.onTimeout, i) : null, !s.onTimeout);
    } else if (s.type === "check_origin") {
      set(id, "known", resolve(s.onKnown, i), !s.onKnown);
      set(id, "unknown", resolve(s.onUnknown, i), !s.onUnknown);
    } else if (s.type === "wait_meeting") {
      set(id, "time", resolve(s.onTime, i), !s.onTime);
      set(id, "late", resolve(s.onLate, i), !s.onLate);
    } else if (s.type === "meeting_status") {
      set(id, "done", resolve(s.onDone, i), !s.onDone);
      set(id, "noshow", resolve(s.onNoShow, i), !s.onNoShow);
      set(id, "timeout", s.onTimeout ? resolve(s.onTimeout, i) : null, !s.onTimeout);
    } else if (s.type === "send_buttons") {
      s.buttons.forEach((b, k) => set(id, `b${k}`, resolve(b.goto, i), !b.goto));
      set(id, "other", resolve(s.onOther, i), !s.onOther);
      set(id, "timeout", s.onTimeout ? resolve(s.onTimeout, i) : null, !s.onTimeout);
    }
  });
  return { start: land(0), nodes: steps.filter((s) => s.type !== "goto"), links, gotoAfter };
}

/** Passo sem os campos de desvio (eles são regravados a partir das setas). */
function bare(s: BotStep): BotStep {
  const c: any = { ...s };
  delete c.onReply; delete c.onTimeout; delete c.onOther; delete c.onKnown; delete c.onUnknown; delete c.target; delete c.pos;
  delete c.onTime; delete c.onLate; delete c.onDone; delete c.onNoShow;
  if (s.type === "send_buttons") c.buttons = s.buttons.map((b) => ({ title: b.title }));
  return c as BotStep;
}

/**
 * Monta o array de passos a partir do grafo. Um cartão com "Depois" precisa do destino
 * logo em seguida no array; quando não dá (destino já usado), entra um "Ir para".
 */
export function toSteps(g: BotGraph, posOf: (id: string) => { x: number; y: number } | undefined = () => undefined): BotStep[] {
  if (!g.nodes.length) throw new Error("O bot precisa de pelo menos um passo.");
  if (!g.start || !g.nodes.some((n) => n.id === g.start)) throw new Error("Ligue o início do bot ao primeiro passo.");
  const byId = new Map(g.nodes.map((n) => [n.id!, n]));
  const link = (s: BotStep, h: string) => linkOf(g, s.id!, h);

  // Destinos de "Depois": esses precisam ficar colados no cartão de origem
  const mandatoryOf = new Map<string, string>();
  for (const s of g.nodes) {
    const t = isLinear(s) ? link(s, "next").target : null;
    if (t && byId.has(t) && !mandatoryOf.has(t)) mandatoryOf.set(t, s.id!);
  }
  // Quem deve vir depois do cartão: o "Depois" ou um desvio que era "próximo passo"
  const follower = (s: BotStep): string | null => {
    if (isLinear(s)) return link(s, "next").target;
    const t = outputsOf(s).map((o) => link(s, o.handle)).find((l) => l.implicit && l.target && l.target !== s.id)?.target ?? null;
    return t && (!mandatoryOf.has(t) || mandatoryOf.get(t) === s.id) ? t : null;
  };

  const order: BotStep[] = [];
  const placed = new Set<string>();
  for (const first of [byId.get(g.start)!, ...g.nodes]) {
    let cur: BotStep | undefined = first;
    while (cur && !placed.has(cur.id!)) {
      order.push(cur);
      placed.add(cur.id!);
      const f = follower(cur);
      const nxt: BotStep | undefined = f ? byId.get(f) : undefined;
      // Não puxa um cartão que é o "Depois" obrigatório de outro
      cur = nxt && (!mandatoryOf.has(nxt.id!) || mandatoryOf.get(nxt.id!) === cur.id) ? nxt : undefined;
    }
  }

  const out: BotStep[] = [];
  order.forEach((s, k) => {
    const nextId = order[k + 1]?.id;
    const pos = posOf(s.id!);
    const step: any = { ...bare(s), ...(pos ? { pos: { x: Math.round(pos.x), y: Math.round(pos.y) } } : {}) };
    // Desvio cujo vazio = próximo passo
    const branch = (h: string) => {
      const l = link(s, h);
      if (!l.target) return "end";
      return l.implicit && l.target === nextId ? undefined : l.target;
    };
    // Prazo de espera: vazio = encerra
    const timeout = (h: string) => link(s, h).target ?? undefined;
    const put = (key: string, v: string | undefined) => { if (v) step[key] = v; };

    if (s.type === "wait_reply") {
      put("onReply", branch("reply"));
      put("onTimeout", timeout("timeout"));
    } else if (s.type === "check_origin") {
      put("onKnown", branch("known"));
      put("onUnknown", branch("unknown"));
    } else if (s.type === "wait_meeting") {
      put("onTime", branch("time"));
      put("onLate", branch("late"));
    } else if (s.type === "meeting_status") {
      put("onDone", branch("done"));
      put("onNoShow", branch("noshow"));
      put("onTimeout", timeout("timeout"));
    } else if (s.type === "send_buttons") {
      step.buttons = s.buttons.map((b, i) => { const t = branch(`b${i}`); return t ? { title: b.title, goto: t } : { title: b.title }; });
      put("onOther", branch("other"));
      put("onTimeout", timeout("timeout"));
    }
    out.push(step as BotStep);

    if (isLinear(s)) {
      const t = link(s, "next").target;
      const last = k === order.length - 1;
      if (t ? t !== nextId : !last) {
        out.push({ id: g.gotoAfter[s.id!] ?? newStepId(), type: "goto", target: t ?? "end" });
      }
    }
  });
  return out;
}

/** Remove um cartão: as setas que chegavam nele passam a encerrar o bot. */
export function removeNode(g: BotGraph, id: string): BotGraph {
  const links: Record<string, FlowLink> = {};
  for (const [k, l] of Object.entries(g.links)) {
    if (k.startsWith(`${id}|`)) continue;
    links[k] = l.target === id ? { target: null, implicit: false } : l;
  }
  return { ...g, start: g.start === id ? null : g.start, nodes: g.nodes.filter((n) => n.id !== id), links };
}

/** Tira o botão `k` e renumera as saídas dos botões seguintes. */
export function removeButton(g: BotGraph, id: string, k: number): BotGraph {
  const links = { ...g.links };
  const nodes = g.nodes.map((n) => {
    if (n.id !== id || n.type !== "send_buttons") return n;
    for (let i = k; i < n.buttons.length; i++) {
      const nxt = links[linkKey(id, `b${i + 1}`)];
      if (nxt) links[linkKey(id, `b${i}`)] = nxt; else delete links[linkKey(id, `b${i}`)];
    }
    delete links[linkKey(id, `b${n.buttons.length - 1}`)];
    return { ...n, buttons: n.buttons.filter((_, i) => i !== k) };
  });
  return { ...g, nodes, links };
}
