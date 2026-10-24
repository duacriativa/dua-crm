"use client";

import { useState } from "react";
import {
  X, Timer, MessageSquare, MessageCircle, FileText, ArrowRightLeft, MousePointerClick, Tag, Bell, CornerDownRight, StopCircle, Compass, MapPin,
} from "lucide-react";
import type { WaTemplate } from "@/components/whatsapp/templates";
import { BotStep, LeadOrigin, ORIGIN_LABEL, fmtDuration, templateStep } from "./bot-api";

export interface Stage { id: string; name: string; position: number }
export type StepType = BotStep["type"];

export const STEP_META: Record<StepType, { label: string; icon: (cls?: string) => JSX.Element; color: string; head: string }> = {
  wait: { label: "Aguardar tempo", icon: (c = "w-3.5 h-3.5") => <Timer className={c} />, color: "bg-gray-100 text-gray-600", head: "bg-gray-500" },
  wait_reply: { label: "Aguardar resposta", icon: (c = "w-3.5 h-3.5") => <MessageSquare className={c} />, color: "bg-orange-50 text-orange-600", head: "bg-orange-500" },
  send_template: { label: "Enviar template (WhatsApp)", icon: (c = "w-3.5 h-3.5") => <FileText className={c} />, color: "bg-blue-50 text-blue-600", head: "bg-blue-500" },
  send_text: { label: "Enviar mensagem", icon: (c = "w-3.5 h-3.5") => <MessageCircle className={c} />, color: "bg-blue-50 text-blue-600", head: "bg-blue-500" },
  send_buttons: { label: "Mensagem com botões", icon: (c = "w-3.5 h-3.5") => <MousePointerClick className={c} />, color: "bg-indigo-50 text-indigo-600", head: "bg-indigo-500" },
  move_stage: { label: "Mover no funil", icon: (c = "w-3.5 h-3.5") => <ArrowRightLeft className={c} />, color: "bg-green-50 text-green-600", head: "bg-green-600" },
  add_tag: { label: "Adicionar etiqueta", icon: (c = "w-3.5 h-3.5") => <Tag className={c} />, color: "bg-green-50 text-green-600", head: "bg-green-600" },
  notify: { label: "Avisar o time", icon: (c = "w-3.5 h-3.5") => <Bell className={c} />, color: "bg-amber-50 text-amber-700", head: "bg-amber-500" },
  check_origin: { label: "Sabemos a origem?", icon: (c = "w-3.5 h-3.5") => <Compass className={c} />, color: "bg-teal-50 text-teal-700", head: "bg-teal-600" },
  set_origin: { label: "Gravar origem", icon: (c = "w-3.5 h-3.5") => <MapPin className={c} />, color: "bg-teal-50 text-teal-700", head: "bg-teal-600" },
  goto: { label: "Ir para", icon: (c = "w-3.5 h-3.5") => <CornerDownRight className={c} />, color: "bg-purple-50 text-purple-600", head: "bg-purple-500" },
  end: { label: "Encerrar o bot", icon: (c = "w-3.5 h-3.5") => <StopCircle className={c} />, color: "bg-red-50 text-red-600", head: "bg-red-500" },
};

export const NEW_STEP: Record<StepType, () => BotStep> = {
  wait: () => ({ type: "wait", seconds: 60 }),
  wait_reply: () => ({ type: "wait_reply", timeoutSeconds: 4 * 3600 }),
  send_template: () => ({ type: "send_template", templateName: "", language: "pt_BR", params: [] }),
  send_text: () => ({ type: "send_text", text: "" }),
  send_buttons: () => ({ type: "send_buttons", text: "", buttons: [{ title: "" }, { title: "" }], timeoutSeconds: 4 * 3600 }),
  move_stage: () => ({ type: "move_stage" }),
  add_tag: () => ({ type: "add_tag", tag: "" }),
  notify: () => ({ type: "notify", to: "Daniel", text: "{{primeiro_nome}} respondeu o bot:\n{{respostas}}" }),
  check_origin: () => ({ type: "check_origin" }),
  set_origin: () => ({ type: "set_origin", origin: "ORGANIC" }),
  goto: () => ({ type: "goto" }),
  end: () => ({ type: "end" }),
};

export const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  RUNNING: { label: "Em andamento", cls: "bg-blue-50 text-blue-700" },
  WAITING_REPLY: { label: "Aguardando resposta", cls: "bg-orange-50 text-orange-700" },
  COMPLETED: { label: "Concluído", cls: "bg-green-50 text-green-700" },
  EXPIRED: { label: "Sem resposta", cls: "bg-gray-100 text-gray-600" },
  HANDED_OFF: { label: "Assumido pelo time", cls: "bg-purple-50 text-purple-700" },
  CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-600" },
  FAILED: { label: "Falhou", cls: "bg-red-50 text-red-700" },
};

export const VARS_HINT = "Use {{primeiro_nome}}, {{nome}}, {{canal_venda}} (ex.: \"pelo Instagram e WhatsApp\"), {{faturamento}}, {{origem}} ou {{respostas}}. Linha com variável vazia some da mensagem.";

export const inp = "w-full px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200";

/** Nome curto do passo para listas e títulos. */
export function stepTitle(s: BotStep) {
  return s.name || STEP_META[s.type].label;
}

/** Texto que o cartão mostra (mensagem, template, tempo…). */
export function stepSummary(s: BotStep): string {
  const al = (a?: string) => (a ? ` e depois o próximo dia útil às ${a}` : "");
  switch (s.type) {
    case "wait": return `Esperar ${fmtDuration(s.seconds)}${al(s.alignTo)}`;
    case "wait_reply": return `Esperar a resposta por até ${fmtDuration(s.timeoutSeconds || 7 * 86400)}${al(s.alignTo)}`;
    case "send_text": return s.text;
    case "send_buttons": return s.text;
    case "send_template": {
      if (!s.templateName) return "Template não escolhido";
      const vals = Object.fromEntries((s.params ?? []).map((p) => [p.key, p.value]));
      return s.bodyText ? s.bodyText.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, k) => vals[k] || all) : s.templateName;
    }
    case "move_stage": return s.stageName ? `Etapa: ${s.stageName}` : "Etapa não escolhida";
    case "add_tag": return s.tag ? `Etiqueta: ${s.tag}` : "Etiqueta vazia";
    case "notify": return `${s.to ? `Para ${s.to}: ` : ""}${s.text}`;
    case "check_origin": return "Anúncio, texto pronto do link ou origem já gravada no contato";
    case "set_origin": return `Origem: ${ORIGIN_LABEL[s.origin]}${s.source ? ` (${s.source})` : ""}`;
    case "end": return "O bot termina aqui";
    default: return "";
  }
}

const UNITS = [{ s: 1, label: "seg" }, { s: 60, label: "min" }, { s: 3600, label: "horas" }, { s: 86400, label: "dias" }];
const bestUnit = (s: number) => [...UNITS].reverse().find((u) => s >= u.s && s % u.s === 0) ?? UNITS[0];

export function DurationInput({ seconds, onChange }: { seconds: number; onChange: (s: number) => void }) {
  const [unit, setUnit] = useState(bestUnit(seconds || 60).s);
  return (
    <div className="flex items-center gap-2">
      <input
        type="number" min={0} value={Math.round((seconds || 0) / unit)}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0) * unit)}
        className="w-24 px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg"
      />
      <select value={unit} onChange={(e) => { const u = Number(e.target.value); setUnit(u); onChange(Math.round((seconds || 0) / unit) * u); }}
        className="px-2 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg bg-white">
        {UNITS.map((u) => <option key={u.s} value={u.s}>{u.label}</option>)}
      </select>
    </div>
  );
}

/** "e depois esperar o próximo dia útil às 10:00" (vazio = sem ajuste de horário). */
export function AlignInput({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked ? "10:00" : undefined)} />
      <span>e depois esperar o próximo dia útil às</span>
      <input type="time" value={value ?? "10:00"} disabled={!value} onChange={(e) => onChange(e.target.value || undefined)}
        className="px-2 py-1 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg disabled:opacity-40" />
    </label>
  );
}

/**
 * Campos de um passo (texto, template, tempos, etapa, etiqueta, aviso).
 * Os destinos dos desvios ficam nas setas do canvas, não aqui.
 */
export function StepFields({ step, set, templates, tplError, stages, onAddButton, onRemoveButton }: {
  step: BotStep;
  set: (patch: Partial<BotStep>) => void;
  templates: WaTemplate[];
  tplError: string;
  stages: Stage[];
  onAddButton: () => void;
  onRemoveButton: (k: number) => void;
}) {
  return (
    <div className="space-y-2">
      {step.type === "wait" && (
        <>
          <DurationInput seconds={step.seconds} onChange={(seconds) => set({ seconds })} />
          <AlignInput value={step.alignTo} onChange={(alignTo) => set({ alignTo })} />
        </>
      )}

      {step.type === "wait_reply" && (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            <span>Esperar até</span>
            <DurationInput seconds={step.timeoutSeconds ?? 7 * 86400} onChange={(timeoutSeconds) => set({ timeoutSeconds })} />
          </div>
          <AlignInput value={step.alignTo} onChange={(alignTo) => set({ alignTo })} />
        </>
      )}

      {step.type === "send_text" && (
        <>
          <textarea rows={8} value={step.text} onChange={(e) => set({ text: e.target.value })} className={inp} />
          <p className="text-[11px] text-gray-400">{VARS_HINT} Texto livre só chega se o contato falou com a gente nas últimas 24h.</p>
        </>
      )}

      {step.type === "send_buttons" && (
        <>
          <textarea rows={5} value={step.text} onChange={(e) => set({ text: e.target.value })} className={inp} />
          {step.buttons.map((b, k) => (
            <div key={k} className="flex items-center gap-2">
              <input
                value={b.title} maxLength={20} placeholder={`Botão ${k + 1} (até 20 letras)`}
                onChange={(e) => set({ buttons: step.buttons.map((x, m) => (m === k ? { ...x, title: e.target.value } : x)) })}
                className={inp}
              />
              <span className="text-[11px] text-gray-400 w-8 shrink-0 text-right">{b.title.length}/20</span>
              <button onClick={() => onRemoveButton(k)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {step.buttons.length < 3 && <button onClick={onAddButton} className="text-xs text-brand-600 font-medium">+ botão</button>}
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            <span>Esperar a escolha até</span>
            <DurationInput seconds={step.timeoutSeconds ?? 7 * 86400} onChange={(timeoutSeconds) => set({ timeoutSeconds })} />
          </div>
          <AlignInput value={step.alignTo} onChange={(alignTo) => set({ alignTo })} />
          <p className="text-[11px] text-gray-400">{VARS_HINT} Só chega dentro das 24h depois da última mensagem do contato.</p>
        </>
      )}

      {step.type === "send_template" && (
        <>
          <select
            value={step.templateName}
            onChange={(e) => { const t = templates.find((x) => x.name === e.target.value); if (t) set(templateStep(t)); }}
            className={inp}
          >
            <option value="">{tplError ? `Erro ao carregar templates: ${tplError}` : "Escolha um template aprovado…"}</option>
            {step.templateName && !templates.some((t) => t.name === step.templateName) && <option value={step.templateName}>{step.templateName}</option>}
            {templates.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.language})</option>)}
          </select>
          {step.bodyText && <p className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-2">{step.bodyText}</p>}
          {(step.params ?? []).map((p, k) => (
            <div key={p.key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16 shrink-0">{`{{${p.key}}}`}</span>
              <input
                value={p.value}
                onChange={(e) => set({ params: (step.params ?? []).map((q, m) => (m === k ? { ...q, value: e.target.value } : q)) })}
                placeholder="{{primeiro_nome}}"
                className={inp}
              />
            </div>
          ))}
        </>
      )}

      {step.type === "move_stage" && (
        <select
          value={step.stageId ?? stages.find((s) => s.name.toLowerCase() === step.stageName?.toLowerCase())?.id ?? ""}
          onChange={(e) => set({ stageId: e.target.value, stageName: stages.find((s) => s.id === e.target.value)?.name })}
          className={inp}
        >
          <option value="">{step.stageName ? `${step.stageName} (não encontrada)` : "Escolha a etapa…"}</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {step.type === "add_tag" && (
        <input value={step.tag} onChange={(e) => set({ tag: e.target.value })} placeholder="ex.: marca nova" className={inp} />
      )}

      {step.type === "notify" && (
        <>
          <input value={step.to ?? ""} onChange={(e) => set({ to: e.target.value })} placeholder="Para (ex.: Daniel)" className={inp} />
          <textarea rows={5} value={step.text} onChange={(e) => set({ text: e.target.value })} className={inp} />
          <p className="text-[11px] text-gray-400">Vira uma nota interna na conversa e uma notificação nos aparelhos com o CRM instalado. {"{{respostas}}"} lista o que o contato escreveu.</p>
        </>
      )}

      {step.type === "check_origin" && (
        <p className="text-xs text-gray-500">
          Segue por "Sabemos a origem" quando o contato veio de anúncio de clique para WhatsApp, mandou o texto pronto de um link
          ("Vim pelo Instagram", "Vim pelo site", "Vi o anúncio", "Fui indicado") ou já tem origem gravada.
        </p>
      )}

      {step.type === "set_origin" && (
        <>
          <select value={step.origin} onChange={(e) => set({ origin: e.target.value as LeadOrigin })} className={inp}>
            {(Object.keys(ORIGIN_LABEL) as LeadOrigin[]).map((o) => <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}
          </select>
          <input value={step.source ?? ""} onChange={(e) => set({ source: e.target.value })} placeholder="Fonte (opcional, ex.: instagram, google)" className={inp} />
          <p className="text-[11px] text-gray-400">Grava a origem no contato (relatórios). A fonte só entra se o contato ainda não tiver UTM.</p>
        </>
      )}

      {step.type === "end" && <p className="text-xs text-gray-500">O bot termina aqui.</p>}
    </div>
  );
}
