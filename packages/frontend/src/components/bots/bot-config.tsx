"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import {
  X, Timer, MessageSquare, MessageCircle, FileText, ArrowRightLeft, Trash2, ChevronUp, ChevronDown, Plus, Send, FlaskConical, Loader2,
  MousePointerClick, Tag, Bell, CornerDownRight, StopCircle,
} from "lucide-react";
import { fetchTemplates, type WaTemplate } from "@/components/whatsapp/templates";
import { Bot, BotRun, BotStep, botsApi, newStepId, templateStep } from "./bot-api";

interface Stage { id: string; name: string; position: number }
type StepType = BotStep["type"];

const STEP_META: Record<StepType, { label: string; icon: JSX.Element; color: string }> = {
  wait: { label: "Aguardar tempo", icon: <Timer className="w-3.5 h-3.5" />, color: "bg-gray-100 text-gray-600" },
  wait_reply: { label: "Aguardar resposta", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "bg-orange-50 text-orange-600" },
  send_template: { label: "Enviar template (WhatsApp)", icon: <FileText className="w-3.5 h-3.5" />, color: "bg-blue-50 text-blue-600" },
  send_text: { label: "Enviar mensagem", icon: <MessageCircle className="w-3.5 h-3.5" />, color: "bg-blue-50 text-blue-600" },
  send_buttons: { label: "Mensagem com botões", icon: <MousePointerClick className="w-3.5 h-3.5" />, color: "bg-indigo-50 text-indigo-600" },
  move_stage: { label: "Mover no funil", icon: <ArrowRightLeft className="w-3.5 h-3.5" />, color: "bg-green-50 text-green-600" },
  add_tag: { label: "Adicionar etiqueta", icon: <Tag className="w-3.5 h-3.5" />, color: "bg-green-50 text-green-600" },
  notify: { label: "Avisar o time", icon: <Bell className="w-3.5 h-3.5" />, color: "bg-amber-50 text-amber-700" },
  goto: { label: "Ir para", icon: <CornerDownRight className="w-3.5 h-3.5" />, color: "bg-purple-50 text-purple-600" },
  end: { label: "Encerrar o bot", icon: <StopCircle className="w-3.5 h-3.5" />, color: "bg-red-50 text-red-600" },
};

const NEW_STEP: Record<StepType, () => BotStep> = {
  wait: () => ({ type: "wait", seconds: 60 }),
  wait_reply: () => ({ type: "wait_reply" }),
  send_template: () => ({ type: "send_template", templateName: "", language: "pt_BR", params: [] }),
  send_text: () => ({ type: "send_text", text: "" }),
  send_buttons: () => ({ type: "send_buttons", text: "", buttons: [{ title: "" }, { title: "" }], timeoutSeconds: 4 * 3600 }),
  move_stage: () => ({ type: "move_stage" }),
  add_tag: () => ({ type: "add_tag", tag: "" }),
  notify: () => ({ type: "notify", to: "Daniel", text: "{{primeiro_nome}} respondeu o bot:\n{{respostas}}" }),
  goto: () => ({ type: "goto" }),
  end: () => ({ type: "end" }),
};

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  RUNNING: { label: "Em andamento", cls: "bg-blue-50 text-blue-700" },
  WAITING_REPLY: { label: "Aguardando resposta", cls: "bg-orange-50 text-orange-700" },
  COMPLETED: { label: "Concluído", cls: "bg-green-50 text-green-700" },
  EXPIRED: { label: "Sem resposta", cls: "bg-gray-100 text-gray-600" },
  HANDED_OFF: { label: "Assumido pelo time", cls: "bg-purple-50 text-purple-700" },
  CANCELLED: { label: "Cancelado", cls: "bg-gray-100 text-gray-600" },
  FAILED: { label: "Falhou", cls: "bg-red-50 text-red-700" },
};

const VARS_HINT = "Use {{primeiro_nome}}, {{nome}}, {{canal_venda}} (ex.: \"pelo Instagram e WhatsApp\"), {{faturamento}} ou {{respostas}}. Linha com variável vazia some da mensagem.";

const UNITS = [{ s: 1, label: "seg" }, { s: 60, label: "min" }, { s: 3600, label: "horas" }, { s: 86400, label: "dias" }];
const bestUnit = (s: number) => [...UNITS].reverse().find((u) => s >= u.s && s % u.s === 0) ?? UNITS[0];

function DurationInput({ seconds, onChange }: { seconds: number; onChange: (s: number) => void }) {
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
function AlignInput({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked ? "10:00" : undefined)} />
      <span>e depois esperar o próximo dia útil às</span>
      <input type="time" value={value ?? "10:00"} disabled={!value} onChange={(e) => onChange(e.target.value || undefined)}
        className="px-2 py-1 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg disabled:opacity-40" />
    </label>
  );
}

/** Escolhe o destino de um desvio: próximo passo, outro passo ou encerrar. */
function TargetSelect({ value, onChange, steps, self, empty = "Próximo passo", noEnd }: {
  value?: string; onChange: (v: string | undefined) => void; steps: BotStep[]; self: number; empty?: string; noEnd?: boolean;
}) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}
      className="flex-1 min-w-0 px-2 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg bg-white">
      <option value="">{empty}</option>
      {!noEnd && <option value="end">Encerrar o bot</option>}
      {steps.map((s, j) => j !== self && s.id && (
        <option key={s.id} value={s.id}>{`${j + 1}. ${s.name || STEP_META[s.type].label}`}</option>
      ))}
    </select>
  );
}

function Branch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <CornerDownRight className="w-3.5 h-3.5 shrink-0 text-gray-300" />
      <span className="shrink-0">{label}</span>
      {children}
    </div>
  );
}

/** Desvios que apontam para `id` voltam a "próximo passo" (o passo foi removido). */
function dropRefs(steps: BotStep[], id?: string): BotStep[] {
  if (!id) return steps;
  const fix = (t?: string) => (t === id ? undefined : t);
  return steps.map((s) => {
    switch (s.type) {
      case "wait_reply": return { ...s, onReply: fix(s.onReply), onTimeout: fix(s.onTimeout) };
      case "send_buttons": return { ...s, onOther: fix(s.onOther), onTimeout: fix(s.onTimeout), buttons: s.buttons.map((b) => ({ ...b, goto: fix(b.goto) })) };
      case "goto": return { ...s, target: fix(s.target) };
      default: return s;
    }
  });
}

export function BotConfigModal({ bot, onClose, onSaved }: { bot: Bot; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(bot.name);
  const [description, setDescription] = useState(bot.description ?? "");
  // Todo passo precisa de id para os desvios funcionarem antes de salvar
  const [steps, setSteps] = useState<BotStep[]>(() => bot.actions.map((s) => (s.id ? s : { ...s, id: newStepId() })));
  const [onlyPhones, setOnlyPhones] = useState((bot.conditions?.onlyPhones ?? []).join("\n"));
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [tplError, setTplError] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [runs, setRuns] = useState<BotRun[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    fetchTemplates().then((all) => setTemplates(all.filter((t) => t.status === "APPROVED"))).catch((e) => setTplError(e.message));
    authFetch("/api/v1/pipelines", { headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((pipes: any[]) => setStages((pipes[0]?.stages ?? []).map((s: any) => ({ id: s.id, name: s.name, position: s.position }))))
      .catch(() => {});
    botsApi.runs(bot.id).then(setRuns).catch(() => {});
  }, [bot.id]);

  const set = (i: number, patch: Partial<BotStep>) => setSteps((prev) => prev.map((s, j) => (j === i ? ({ ...s, ...patch } as BotStep) : s)));
  const move = (i: number, d: number) => setSteps((prev) => {
    const next = [...prev];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  });
  const remove = (i: number) => setSteps((prev) => dropRefs(prev.filter((_, j) => j !== i), prev[i].id));

  const stageLabel = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s.name])), [stages]);

  const save = async () => {
    setSaving(true); setError("");
    try {
      await botsApi.update(bot.id, {
        name, description, actions: steps,
        conditions: { onlyPhones: onlyPhones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean) },
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTestMsg("");
    try {
      await botsApi.test(bot.id, testPhone);
      setTestMsg("Teste iniciado: acompanhe a conversa no WhatsApp do CRM.");
      setTimeout(() => botsApi.runs(bot.id).then(setRuns).catch(() => {}), 1500);
    } catch (e: any) {
      setTestMsg(e.message);
    }
  };

  const inp = "w-full px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white text-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Configurar bot</h2>
            <p className="text-xs text-gray-400">Gatilho: {bot.triggerLabel}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5">
          <div className="grid grid-cols-1 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do bot" className={inp} />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" className={inp} />
          </div>

          {/* Passos */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Passos</p>
            <p className="text-[11px] text-gray-400 mb-2">Rodam em ordem; “Ir para” e os desvios pulam para outro passo. Se alguém do time escrever na conversa, o bot para.</p>
            <ol className="space-y-2">
              {steps.map((step, i) => {
                const meta = STEP_META[step.type];
                return (
                  <li key={step.id ?? i} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] text-gray-400 w-4">{i + 1}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg shrink-0 ${meta.color}`}>{meta.icon}{meta.label}</span>
                      <input
                        value={step.name ?? ""} onChange={(e) => set(i, { name: e.target.value })} placeholder="nome do passo (opcional)"
                        className="min-w-0 flex-1 px-2 py-1 text-xs text-gray-700 bg-transparent placeholder:text-gray-300 border border-transparent hover:border-gray-200 focus:border-gray-200 rounded-lg focus:outline-none"
                      />
                      <div className="ml-auto flex items-center gap-0.5 shrink-0">
                        <button disabled={i === 0} onClick={() => move(i, -1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(i)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    {step.type === "wait" && (
                      <div className="space-y-2">
                        <DurationInput seconds={step.seconds} onChange={(seconds) => set(i, { seconds })} />
                        <AlignInput value={step.alignTo} onChange={(alignTo) => set(i, { alignTo })} />
                      </div>
                    )}

                    {step.type === "wait_reply" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                          <span>Esperar até</span>
                          <DurationInput seconds={step.timeoutSeconds ?? 7 * 86400} onChange={(timeoutSeconds) => set(i, { timeoutSeconds })} />
                        </div>
                        <AlignInput value={step.alignTo} onChange={(alignTo) => set(i, { alignTo })} />
                        <Branch label="Se responder:"><TargetSelect value={step.onReply} onChange={(onReply) => set(i, { onReply })} steps={steps} self={i} /></Branch>
                        <Branch label="Se não responder:"><TargetSelect value={step.onTimeout} onChange={(onTimeout) => set(i, { onTimeout })} steps={steps} self={i} empty="Encerrar o bot" noEnd /></Branch>
                      </div>
                    )}

                    {step.type === "send_text" && (
                      <>
                        <textarea rows={4} value={step.text} onChange={(e) => set(i, { text: e.target.value })} className={inp} />
                        <p className="text-[11px] text-gray-400 mt-1">{VARS_HINT} Texto livre só chega se o contato falou com a gente nas últimas 24h.</p>
                      </>
                    )}

                    {step.type === "send_buttons" && (
                      <div className="space-y-2">
                        <textarea rows={3} value={step.text} onChange={(e) => set(i, { text: e.target.value })} className={inp} />
                        {step.buttons.map((b, k) => (
                          <div key={k} className="flex items-center gap-2">
                            <input
                              value={b.title} maxLength={20} placeholder={`Botão ${k + 1} (até 20 letras)`}
                              onChange={(e) => set(i, { buttons: step.buttons.map((x, m) => (m === k ? { ...x, title: e.target.value } : x)) })}
                              className="w-44 shrink-0 px-3 py-1.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 border border-gray-200 rounded-lg"
                            />
                            <span className="text-xs text-gray-400 shrink-0">vai para</span>
                            <TargetSelect value={b.goto} onChange={(goto) => set(i, { buttons: step.buttons.map((x, m) => (m === k ? { ...x, goto } : x)) })} steps={steps} self={i} />
                            <button onClick={() => set(i, { buttons: step.buttons.filter((_, m) => m !== k) })} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                        {step.buttons.length < 3 && (
                          <button onClick={() => set(i, { buttons: [...step.buttons, { title: "" }] })} className="text-xs text-brand-600 font-medium">+ botão</button>
                        )}
                        <Branch label="Se escrever em vez de tocar:"><TargetSelect value={step.onOther} onChange={(onOther) => set(i, { onOther })} steps={steps} self={i} /></Branch>
                        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                          <span>Esperar a escolha até</span>
                          <DurationInput seconds={step.timeoutSeconds ?? 7 * 86400} onChange={(timeoutSeconds) => set(i, { timeoutSeconds })} />
                        </div>
                        <Branch label="Se não responder:"><TargetSelect value={step.onTimeout} onChange={(onTimeout) => set(i, { onTimeout })} steps={steps} self={i} empty="Encerrar o bot" noEnd /></Branch>
                        <p className="text-[11px] text-gray-400">{VARS_HINT} Só chega dentro das 24h depois da última mensagem do contato.</p>
                      </div>
                    )}

                    {step.type === "send_template" && (
                      <div className="space-y-2">
                        <select
                          value={step.templateName}
                          onChange={(e) => { const t = templates.find((x) => x.name === e.target.value); if (t) set(i, templateStep(t)); }}
                          className={`${inp} bg-white`}
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
                              onChange={(e) => set(i, { params: (step.params ?? []).map((q, m) => (m === k ? { ...q, value: e.target.value } : q)) })}
                              placeholder="{{primeiro_nome}}"
                              className={inp}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {step.type === "move_stage" && (
                      <select
                        value={step.stageId ?? stages.find((s) => s.name.toLowerCase() === step.stageName?.toLowerCase())?.id ?? ""}
                        onChange={(e) => set(i, { stageId: e.target.value, stageName: stageLabel[e.target.value] })}
                        className={`${inp} bg-white`}
                      >
                        <option value="">{step.stageName ? `${step.stageName} (não encontrada)` : "Escolha a etapa…"}</option>
                        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}

                    {step.type === "add_tag" && (
                      <input value={step.tag} onChange={(e) => set(i, { tag: e.target.value })} placeholder="ex.: marca nova" className={inp} />
                    )}

                    {step.type === "notify" && (
                      <div className="space-y-2">
                        <input value={step.to ?? ""} onChange={(e) => set(i, { to: e.target.value })} placeholder="Para (ex.: Daniel)" className={inp} />
                        <textarea rows={3} value={step.text} onChange={(e) => set(i, { text: e.target.value })} className={inp} />
                        <p className="text-[11px] text-gray-400">Vira uma nota interna na conversa e uma notificação nos aparelhos com o CRM instalado. {"{{respostas}}"} lista o que o contato escreveu.</p>
                      </div>
                    )}

                    {step.type === "goto" && (
                      <Branch label="Continuar no passo:">
                        <TargetSelect value={step.target} onChange={(target) => set(i, { target })} steps={steps} self={i} empty="Escolha o passo…" />
                      </Branch>
                    )}

                    {step.type === "end" && <p className="text-xs text-gray-500">O bot termina aqui (os passos abaixo só rodam se algum desvio apontar para eles).</p>}
                  </li>
                );
              })}
            </ol>
            <div className="relative mt-2">
              <button onClick={() => setAddOpen((v) => !v)} className="flex items-center gap-1.5 text-sm text-brand-600 font-medium px-2 py-1 rounded-lg hover:bg-brand-50">
                <Plus className="w-4 h-4" /> Adicionar passo
              </button>
              {addOpen && (
                <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[220px]">
                  {(Object.keys(STEP_META) as StepType[]).map((t) => (
                    <button key={t} onClick={() => { setSteps((p) => [...p, { ...NEW_STEP[t](), id: newStepId() } as BotStep]); setAddOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      {STEP_META[t].icon}{STEP_META[t].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modo teste */}
          <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-3 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"><FlaskConical className="w-3.5 h-3.5" /> Teste</p>
            <p className="text-[11px] text-gray-500">Só disparar para estes números (um por linha). Vazio = todos os leads do gatilho.</p>
            <textarea rows={2} value={onlyPhones} onChange={(e) => setOnlyPhones(e.target.value)} placeholder="+55 85 99999-0000" className={inp} />
            <div className="flex items-center gap-2">
              <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Rodar agora para o número…" className={inp} />
              <button onClick={runTest} disabled={!testPhone.trim()} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-40 shrink-0">
                <Send className="w-3.5 h-3.5" /> Testar
              </button>
            </div>
            <p className="text-[11px] text-gray-500">O teste roda os passos salvos, mesmo com o bot pausado.</p>
            {testMsg && <p className="text-xs text-gray-700">{testMsg}</p>}
          </div>

          {/* Últimas sessões */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Últimas sessões</p>
            {runs.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhuma ainda.</p>
            ) : (
              <ul className="divide-y divide-gray-50 text-xs">
                {runs.map((r) => {
                  const st = RUN_STATUS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-600" };
                  const at = steps[r.stepIndex];
                  return (
                    <li key={r.id} className="py-2 flex items-center gap-2">
                      <span className="font-medium text-gray-800 truncate">{r.contact?.name ?? "Contato removido"}</span>
                      <span className="text-gray-400">{r.contact?.phone}</span>
                      {r.isTest && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">teste</span>}
                      <span className="ml-auto text-gray-400">{new Date(r.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      <span className={`px-2 py-0.5 rounded-full ${st.cls}`} title={r.lastError ?? (at ? `Passo ${r.stepIndex + 1}: ${at.name || STEP_META[at.type].label}` : "")}>{st.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          {error && <p className="text-xs text-red-600 flex-1">{error}</p>}
          <button onClick={onClose} className="ml-auto px-4 py-2 text-sm text-gray-600 rounded-xl hover:bg-gray-100">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
