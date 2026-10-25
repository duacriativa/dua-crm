"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Instagram, Plus, Loader2, Trash2, Pause, Play, Pencil, X, MessageCircle, CircleDot, AtSign, Send, Hand, Link2, Reply } from "lucide-react";
import api from "@/lib/api";

type Trigger = "COMMENT" | "STORY_REPLY" | "STORY_MENTION" | "DM_KEYWORD" | "FIRST_DM";
// Com url abre o link; sem url, o toque volta como mensagem com o título (pode disparar outra regra)
type RuleButton = { title: string; url?: string };
interface Funnel { id: string; name: string; stages: { id: string; name: string; kind: string }[] }

export interface IgRule {
  id: string; name: string; trigger: Trigger; keywords: string[]; mediaIds: string[];
  dmText: string; publicReplies: string[]; buttons: RuleButton[]; stageId: string | null; tag: string | null; active: boolean; runCount: number;
}
interface IgMedia { id: string; caption?: string; media_product_type?: string; media_type?: string; thumbnail_url?: string; media_url?: string; permalink?: string; timestamp?: string }
interface IgStatus { connected: boolean; username?: string }

const TRIGGERS: Record<Trigger, { label: string; hint: string; icon: ReactNode }> = {
  COMMENT: { label: "Comentário em post/reel", hint: "Responde na DM de quem comentou a palavra (1 resposta por comentário, até 7 dias)", icon: <MessageCircle className="w-4 h-4" /> },
  STORY_REPLY: { label: "Resposta a story", hint: "Quem responder um story com a palavra recebe a DM", icon: <CircleDot className="w-4 h-4" /> },
  STORY_MENTION: { label: "Menção no story", hint: "Quem marcar o @ no story recebe a DM (sem palavra-chave)", icon: <AtSign className="w-4 h-4" /> },
  DM_KEYWORD: { label: "Palavra-chave na DM", hint: "Quem mandar a palavra no Direct recebe a resposta (também vale para o toque num botão sem link)", icon: <Send className="w-4 h-4" /> },
  FIRST_DM: { label: "Boas-vindas (1ª DM)", hint: "Quem nunca falou com a Dua e manda a primeira DM recebe a apresentação (se nenhuma palavra-chave respondeu antes)", icon: <Hand className="w-4 h-4" /> },
};

const errMsg = (e: any) => {
  const m = e?.response?.data?.message;
  return (Array.isArray(m) ? m[0] : m) || e?.message || "Algo deu errado.";
};

const empty = (): Omit<IgRule, "id" | "runCount"> => ({
  name: "", trigger: "COMMENT", keywords: [], mediaIds: [], dmText: "", publicReplies: [], buttons: [], stageId: null, tag: null, active: true,
});

/* ── Regras de palavra-chave do Instagram (comentário/story/DM → DM automática) ── */
export function InstagramRules() {
  const [status, setStatus] = useState<IgStatus | null>(null);
  const [rules, setRules] = useState<IgRule[]>([]);
  const [editing, setEditing] = useState<(Omit<IgRule, "id" | "runCount"> & { id?: string }) | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const st = (await api.get("/instagram/status")).data;
      setStatus(st);
      if (st.connected) setRules((await api.get("/instagram/automations")).data);
    } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (r: IgRule) => {
    try { await api.patch(`/instagram/automations/${r.id}`, { active: !r.active }); load(); } catch (e) { alert(errMsg(e)); }
  };
  const remove = async (r: IgRule) => {
    if (!confirm(`Excluir a regra "${r.name}"?`)) return;
    try { await api.delete(`/instagram/automations/${r.id}`); load(); } catch (e) { alert(errMsg(e)); }
  };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Instagram className="w-4 h-4 text-pink-500" /> Instagram — palavras-chave
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Comentário, story ou DM com a palavra → mensagem automática no Direct
            {status?.username && <> de <b>@{status.username}</b></>}
          </p>
        </div>
        {status?.connected && (
          <button onClick={() => setEditing(empty())}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700">
            <Plus className="w-4 h-4" /> Nova regra
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {status === null && !error && <div className="flex justify-center py-6 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>}
      {status && !status.connected && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-500">
          Conecte o Instagram em <a href="/dashboard/configuracoes" className="text-brand-600 font-semibold underline">Configurações → Integrações</a> para criar as regras.
        </div>
      )}
      {status?.connected && rules.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
          Nenhuma regra ainda. Ex.: quem comentar <b>EBOOK</b> no reel recebe o link na DM.
        </div>
      )}

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
            <div className={`p-2 rounded-xl ${r.active ? "bg-pink-50 text-pink-600" : "bg-gray-100 text-gray-400"}`}>{TRIGGERS[r.trigger]?.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-gray-900">{r.name}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.active ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{r.active ? "Ativa" : "Pausada"}</span>
                <span className="text-[11px] text-gray-400">{TRIGGERS[r.trigger]?.label}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {r.trigger === "STORY_MENTION" ? "Qualquer menção" : r.trigger === "FIRST_DM" ? "Primeira mensagem" : r.keywords.length ? <>Palavras: {r.keywords.map((k) => <b key={k} className="mr-1">{k}</b>)}</> : "Qualquer texto"}
                {r.trigger === "COMMENT" && <> · {r.mediaIds.length ? `${r.mediaIds.length} post(s)` : "todos os posts"}</>}
                {r.publicReplies.length > 0 && <> · responde no comentário</>}
                {r.buttons?.length > 0 && <> · {r.buttons.length} botão(ões)</>}
              </p>
              <p className="text-xs text-gray-400 mt-1 truncate">DM: {r.dmText}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-gray-900 leading-none">{r.runCount}</p>
              <p className="text-[10px] text-gray-400">respostas</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => toggle(r)} title={r.active ? "Pausar" : "Ativar"} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                {r.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={() => setEditing({ ...r })} title="Editar" className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(r)} title="Excluir" className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && <RuleEditor rule={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function RuleEditor({ rule, onClose, onSaved }: {
  rule: Omit<IgRule, "id" | "runCount"> & { id?: string }; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(rule);
  const [keywords, setKeywords] = useState(rule.keywords.join(", "));
  const [publicReplies, setPublicReplies] = useState(rule.publicReplies.join("\n"));
  const [media, setMedia] = useState<IgMedia[] | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [funnels, setFunnels] = useState<Funnel[] | null>(null);
  const [creatingFunnel, setCreatingFunnel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/instagram/funnels").then((r) => setFunnels(r.data)).catch(() => setFunnels([])); }, []);
  const createFunnel = async () => {
    setCreatingFunnel(true);
    try {
      const list: Funnel[] = (await api.post("/instagram/funnels")).data;
      setFunnels(list);
      const ig = list.find((f) => f.name.toLowerCase() === "instagram");
      if (ig?.stages[0]) set({ stageId: ig.stages[0].id });
    } catch (e) { setError(errMsg(e)); } finally { setCreatingFunnel(false); }
  };
  const hasIgFunnel = !!funnels?.some((f) => f.name.toLowerCase() === "instagram");
  const setButton = (i: number, patch: Partial<RuleButton>) =>
    set({ buttons: form.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (form.trigger !== "COMMENT" || media !== null) return;
    api.get("/instagram/media").then((r) => setMedia(r.data)).catch((e) => { setMedia([]); setMediaError(errMsg(e)); });
  }, [form.trigger, media]);

  const toggleMedia = (id: string) =>
    set({ mediaIds: form.mediaIds.includes(id) ? form.mediaIds.filter((m) => m !== id) : [...form.mediaIds, id] });

  const save = async () => {
    if (form.buttons.some((b) => b.title.trim() && b.url !== undefined && !b.url.trim())) { setError("Preencha o link do botão (ou use um botão de resposta)."); return; }
    setSaving(true); setError("");
    const body = {
      ...form,
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      publicReplies: form.trigger === "COMMENT" ? publicReplies.split("\n").map((k) => k.trim()).filter(Boolean) : [],
      mediaIds: form.trigger === "COMMENT" ? form.mediaIds : [],
      buttons: form.buttons.filter((b) => b.title.trim()),
    };
    try {
      if (form.id) await api.patch(`/instagram/automations/${form.id}`, body);
      else await api.post("/instagram/automations", body);
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  const input = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{form.id ? "Editar regra" : "Nova regra do Instagram"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Nome</span>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: E-book no reel de outubro" className={`${input} mt-1`} />
          </label>

          <div>
            <span className="text-xs font-semibold text-gray-600">Quando</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(Object.keys(TRIGGERS) as Trigger[]).map((t) => (
                <button key={t} type="button" onClick={() => set({ trigger: t })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-semibold ${form.trigger === t ? "border-pink-400 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {TRIGGERS[t].icon}{TRIGGERS[t].label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">{TRIGGERS[form.trigger].hint}</p>
          </div>

          {form.trigger !== "STORY_MENTION" && form.trigger !== "FIRST_DM" && (
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Palavras-chave (separadas por vírgula)</span>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ebook, quero, link" className={`${input} mt-1`} />
              <span className="text-[11px] text-gray-400">Ignora maiúsculas e acentos. Vazio = responde qualquer texto.</span>
            </label>
          )}

          {form.trigger === "COMMENT" && (
            <div>
              <span className="text-xs font-semibold text-gray-600">Em quais posts</span>
              <p className="text-[11px] text-gray-400 mb-1.5">{form.mediaIds.length ? `${form.mediaIds.length} selecionado(s)` : "Nenhum selecionado = vale para todos os posts e reels"}</p>
              {mediaError && <p className="text-xs text-red-600 mb-1">{mediaError}</p>}
              {media === null ? (
                <p className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando posts…</p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                  {media.map((m) => {
                    const on = form.mediaIds.includes(m.id);
                    const img = m.thumbnail_url || (m.media_type !== "VIDEO" ? m.media_url : undefined);
                    return (
                      <button key={m.id} type="button" onClick={() => toggleMedia(m.id)} title={m.caption?.slice(0, 120) || m.id}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 bg-gray-100 ${on ? "border-pink-500" : "border-transparent opacity-80 hover:opacity-100"}`}>
                        {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-gray-500 p-1 block">{m.caption?.slice(0, 40) || m.media_product_type}</span>}
                        {m.media_product_type === "REELS" && <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold text-white bg-black/60 rounded px-1">Reel</span>}
                        {on && <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Mensagem na DM</span>
            <textarea value={form.dmText} onChange={(e) => set({ dmText: e.target.value })} rows={4} maxLength={1000}
              placeholder="Oi {{primeiro_nome}}! Aqui está o link do e-book: https://…" className={`${input} mt-1 resize-none`} />
            <span className="text-[11px] text-gray-400">Use {"{{primeiro_nome}}"}, {"{{nome}}"} ou {"{{usuario}}"} (o @).</span>
          </label>

          <div>
            <span className="text-xs font-semibold text-gray-600">Botões (até 3)</span>
            <p className="text-[11px] text-gray-400 mb-1.5">Com link abre o site. Sem link, o toque responde o texto do botão: crie uma regra "Palavra-chave na DM" com ele para continuar a conversa.</p>
            <div className="space-y-1.5">
              {form.buttons.map((b, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  {b.url !== undefined ? <Link2 className="w-4 h-4 text-gray-400 shrink-0" /> : <Reply className="w-4 h-4 text-gray-400 shrink-0" />}
                  <input value={b.title} maxLength={20} onChange={(e) => setButton(i, { title: e.target.value })} placeholder="Texto (até 20)" className={`${input} w-36`} />
                  {b.url !== undefined && (
                    <input value={b.url} onChange={(e) => setButton(i, { url: e.target.value })} placeholder="https://duacriativa.com.br" className={`${input} flex-1`} />
                  )}
                  {b.url === undefined && <span className="flex-1 text-[11px] text-gray-400">responde "{b.title || "…"}"</span>}
                  <button type="button" onClick={() => set({ buttons: form.buttons.filter((_, j) => j !== i) })} className="p-1.5 text-gray-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            {form.buttons.length < 3 && (
              <div className="flex gap-2 mt-1.5">
                <button type="button" onClick={() => set({ buttons: [...form.buttons, { title: "", url: "" }] })} className="text-xs font-semibold text-brand-600 hover:underline">+ Botão com link</button>
                <button type="button" onClick={() => set({ buttons: [...form.buttons, { title: "" }] })} className="text-xs font-semibold text-brand-600 hover:underline">+ Botão de resposta</button>
              </div>
            )}
          </div>

          {form.trigger === "COMMENT" && (
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Resposta pública no comentário (opcional, uma por linha: sorteia uma)</span>
              <textarea value={publicReplies} onChange={(e) => setPublicReplies(e.target.value)} rows={3}
                placeholder={"Te mandei na DM! 💌\nConfere o Direct, {{usuario}} 😉"} className={`${input} mt-1 resize-none`} />
            </label>
          )}

          <div>
            <span className="text-xs font-semibold text-gray-600">Funil</span>
            <select value={form.stageId ?? ""} onChange={(e) => set({ stageId: e.target.value || null })} className={`${input} mt-1`}>
              <option value="">Padrão: 1ª etapa do funil de vendas</option>
              {(funnels ?? []).map((f) => (
                <optgroup key={f.id} label={f.name}>
                  {f.stages.filter((st) => st.kind === "OPEN").map((st) => <option key={st.id} value={st.id}>{f.name} → {st.name}</option>)}
                </optgroup>
              ))}
            </select>
            {funnels && !hasIgFunnel && (
              <button type="button" onClick={createFunnel} disabled={creatingFunnel} className="text-xs font-semibold text-brand-600 hover:underline mt-1 disabled:opacity-50">
                {creatingFunnel ? "Criando…" : "+ Criar funil Instagram (para leads dos brindes)"}
              </button>
            )}
            <p className="text-[11px] text-gray-400 mt-1">Quem já tem card nesse funil fica onde está. Leads do funil Instagram não entram em Vendas sozinhos: mova o card quando esquentar.</p>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Etiqueta no contato (opcional)</span>
            <input value={form.tag ?? ""} onChange={(e) => set({ tag: e.target.value || null })} placeholder="ebook-outubro" className={`${input} mt-1`} />
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} /> Regra ativa
          </label>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-100">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
