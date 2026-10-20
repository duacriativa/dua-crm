"use client";
import { authFetch } from "@/lib/auth-fetch";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, RefreshCw, X, Send, FileText, AlertCircle } from "lucide-react";

/* Templates da API oficial do WhatsApp (Meta). Ficam na WABA, então os
   aprovados no Kommo aparecem aqui também. */

export interface WaTemplateButton { type: string; text: string; url?: string; phone_number?: string; example?: string[] }
export interface WaTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: WaTemplateButton[];
  example?: { header_handle?: string[]; header_text?: string[]; body_text?: string[][] };
}
export interface WaTemplate {
  id: string; name: string; status: string; category: string; language: string;
  components: WaTemplateComponent[]; parameter_format?: "POSITIONAL" | "NAMED"; rejected_reason?: string;
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("access_token") : ""}` };
}

async function errorText(res: Response) {
  const data = await res.json().catch(() => null);
  return [].concat(data?.message ?? `Erro ${res.status}`).join(" ");
}

export async function fetchTemplates(): Promise<WaTemplate[]> {
  const res = await authFetch("/api/v1/whatsapp-cloud/templates", { headers: authHeaders() });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g;

/** Variáveis na ordem em que aparecem, sem repetir ({{1}}, {{nome}}…). */
export function templateVars(text?: string) {
  const out: string[] = [];
  for (const m of (text || "").matchAll(VAR_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

function fill(text: string | undefined, values: Record<string, string>) {
  return (text || "").replace(VAR_RE, (all, key) => values[key]?.trim() || all);
}

export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
  PENDING: { label: "Em análise", cls: "bg-amber-100 text-amber-700" },
  REJECTED: { label: "Rejeitado", cls: "bg-red-100 text-red-700" },
  PAUSED: { label: "Pausado", cls: "bg-gray-200 text-gray-700" },
  DISABLED: { label: "Desativado", cls: "bg-gray-200 text-gray-700" },
};
export const CATEGORY_LABEL: Record<string, string> = { MARKETING: "Marketing", UTILITY: "Utilidade", AUTHENTICATION: "Autenticação" };

const comp = (t: WaTemplate, type: WaTemplateComponent["type"]) => t.components?.find((c) => c.type === type);

/* ── Lista e criação (Configurações → Templates) ─────────────────────────── */

export function TemplatesManager() {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTemplates(await fetchTemplates()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (t: WaTemplate) => {
    if (!confirm(`Excluir o template "${t.name}" (${t.language}) na Meta? Ele some também do Kommo.`)) return;
    const res = await authFetch(`/api/v1/whatsapp-cloud/templates?name=${encodeURIComponent(t.name)}&id=${t.id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) { alert(await errorText(res)); return; }
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
  };

  const shown = templates.filter((t) => !filter || t.name.includes(filter.toLowerCase()) || comp(t, "BODY")?.text?.toLowerCase().includes(filter.toLowerCase()));

  if (creating) return <TemplateForm onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-base font-bold text-foreground">Templates do WhatsApp</h2>
          <p className="text-xs text-muted-foreground">Mensagens pré-aprovadas pela Meta. São as únicas que podem ser enviadas fora da janela de 24h.</p>
        </div>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar…"
          className="px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground" />
        <button onClick={load} disabled={loading} title="Atualizar" className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-xl hover:opacity-90">
          <Plus className="w-4 h-4" />Novo template
        </button>
      </div>

      {error && <p className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{error}</p>}
      {!loading && !error && shown.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum template encontrado.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((t) => {
          const st = STATUS_LABEL[t.status] ?? { label: t.status, cls: "bg-gray-200 text-gray-700" };
          const header = comp(t, "HEADER");
          const buttons = comp(t, "BUTTONS")?.buttons ?? [];
          return (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{CATEGORY_LABEL[t.category] ?? t.category} · {t.language}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                <button onClick={() => remove(t)} title="Excluir" className="p-1 text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-sm text-foreground whitespace-pre-wrap break-words">
                {header?.format === "TEXT" && header.text && <p className="font-semibold mb-1">{header.text}</p>}
                {header && header.format !== "TEXT" && <p className="text-[11px] text-muted-foreground mb-1">[cabeçalho: {header.format?.toLowerCase()}]</p>}
                {comp(t, "BODY")?.text}
                {comp(t, "FOOTER")?.text && <p className="text-[11px] text-muted-foreground mt-1">{comp(t, "FOOTER")?.text}</p>}
              </div>
              {buttons.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {buttons.map((b, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">{b.text}</span>)}
                </div>
              )}
              {t.status === "REJECTED" && t.rejected_reason && t.rejected_reason !== "NONE" && (
                <p className="text-[11px] text-red-600">Motivo: {t.rejected_reason}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type FormButton = { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; value: string };

function TemplateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("pt_BR");
  const [header, setHeader] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [examples, setExamples] = useState<Record<string, string>>({});
  const [buttons, setButtons] = useState<FormButton[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inp = "w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground";
  const bodyVars = templateVars(body);
  const headerVars = templateVars(header);
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");

  const addVar = () => setBody((b) => `${b}{{${bodyVars.length + 1}}}`);

  const submit = async () => {
    setError("");
    if (!slug) return setError("Dê um nome ao template.");
    if (!body.trim()) return setError("Escreva o texto da mensagem.");
    const missing = [...headerVars.map((v) => `h${v}`), ...bodyVars.map((v) => `b${v}`)].filter((k) => !examples[k]?.trim());
    if (missing.length) return setError("Preencha um exemplo para cada variável (a Meta exige para aprovar).");

    const components: any[] = [];
    if (header.trim()) components.push({ type: "HEADER", format: "TEXT", text: header.trim(), ...(headerVars.length ? { example: { header_text: headerVars.map((v) => examples[`h${v}`]) } } : {}) });
    components.push({ type: "BODY", text: body.trim(), ...(bodyVars.length ? { example: { body_text: [bodyVars.map((v) => examples[`b${v}`])] } } : {}) });
    if (footer.trim()) components.push({ type: "FOOTER", text: footer.trim() });
    const btns = buttons.filter((b) => b.text.trim()).map((b) =>
      b.type === "URL" ? { type: "URL", text: b.text.trim(), url: b.value.trim() }
      : b.type === "PHONE_NUMBER" ? { type: "PHONE_NUMBER", text: b.text.trim(), phone_number: b.value.trim() }
      : { type: "QUICK_REPLY", text: b.text.trim() });
    if (btns.length) components.push({ type: "BUTTONS", buttons: btns });

    setSaving(true);
    try {
      const res = await authFetch("/api/v1/whatsapp-cloud/templates", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ name: slug, category, language, components }),
      });
      if (!res.ok) { setError(await errorText(res)); return; }
      onCreated();
    } finally { setSaving(false); }
  };

  const exampleField = (key: string, label: string) => (
    <div key={key} className="flex items-center gap-2">
      <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{label}</span>
      <input value={examples[key] ?? ""} onChange={(e) => setExamples((x) => ({ ...x, [key]: e.target.value }))} placeholder="Exemplo (ex.: Maria)" className={inp} />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Novo template</h2>
        <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
      </div>
      <p className="text-xs text-muted-foreground">Depois de criado, a Meta analisa o template (geralmente minutos, às vezes até 24h). Só aprovados podem ser enviados.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className="text-sm font-medium text-foreground block mb-1">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: retomar_contato" className={inp} />
          {name && slug !== name && <p className="text-[11px] text-muted-foreground mt-1">Será salvo como <span className="font-mono">{slug}</span> (só minúsculas, números e _).</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Categoria</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
            <option value="UTILITY">Utilidade</option>
            <option value="MARKETING">Marketing</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Idioma</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inp}>
            <option value="pt_BR">Português (BR)</option>
            <option value="en_US">Inglês (EUA)</option>
            <option value="es">Espanhol</option>
          </select>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">Utilidade: avisos sobre algo em andamento (pedido, agendamento, cobrança). Marketing: ofertas e reengajamento. Se a Meta discordar, ela reclassifica.</p>

      <div>
        <label className="text-sm font-medium text-foreground block mb-1">Cabeçalho <span className="text-muted-foreground font-normal">(opcional)</span></label>
        <input value={header} onChange={(e) => setHeader(e.target.value)} maxLength={60} className={inp} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-foreground">Mensagem</label>
          <button onClick={addVar} className="text-xs font-semibold text-primary hover:underline">+ Variável</button>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1024}
          placeholder={"Olá {{1}}, tudo bem? Passando para…"} className={`${inp} resize-y`} />
        <p className="text-[11px] text-muted-foreground mt-1">Use {"{{1}}"}, {"{{2}}"}… para partes que mudam (ex.: nome). *texto* fica em negrito.</p>
      </div>
      {(headerVars.length > 0 || bodyVars.length > 0) && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-xs font-semibold text-foreground">Exemplos das variáveis</p>
          {headerVars.map((v) => exampleField(`h${v}`, `cab. {{${v}}}`))}
          {bodyVars.map((v) => exampleField(`b${v}`, `{{${v}}}`))}
        </div>
      )}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1">Rodapé <span className="text-muted-foreground font-normal">(opcional)</span></label>
        <input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60} className={inp} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Botões <span className="text-muted-foreground font-normal">(opcional)</span></label>
          {buttons.length < 3 && (
            <button onClick={() => setButtons((b) => [...b, { type: "QUICK_REPLY", text: "", value: "" }])} className="text-xs font-semibold text-primary hover:underline">+ Botão</button>
          )}
        </div>
        {buttons.map((b, i) => {
          const set = (patch: Partial<FormButton>) => setButtons((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={i} className="flex flex-wrap gap-2 items-center">
              <select value={b.type} onChange={(e) => set({ type: e.target.value as FormButton["type"] })} className={`${inp} w-40`}>
                <option value="QUICK_REPLY">Resposta rápida</option>
                <option value="URL">Link</option>
                <option value="PHONE_NUMBER">Ligar</option>
              </select>
              <input value={b.text} onChange={(e) => set({ text: e.target.value })} maxLength={25} placeholder="Texto do botão" className={`${inp} flex-1 min-w-[140px]`} />
              {b.type !== "QUICK_REPLY" && (
                <input value={b.value} onChange={(e) => set({ value: e.target.value })} placeholder={b.type === "URL" ? "https://…" : "+5585999999999"} className={`${inp} flex-1 min-w-[160px]`} />
              )}
              <button onClick={() => setButtons((all) => all.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          );
        })}
      </div>

      {error && <p className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-xl hover:opacity-90 disabled:opacity-50">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Enviar para aprovação
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:text-foreground">Cancelar</button>
      </div>
    </div>
  );
}

/* ── Envio na conversa ───────────────────────────────────────────────────── */

export function SendTemplateModal({ conversationId, contactName, onClose, onSent }: {
  conversationId: string;
  contactName?: string;
  onClose: () => void;
  onSent: (message: any) => void;
}) {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<WaTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchTemplates()
      .then((all) => setTemplates(all.filter((t) => t.status === "APPROVED")))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const header = selected ? comp(selected, "HEADER") : undefined;
  const bodyC = selected ? comp(selected, "BODY") : undefined;
  const buttons = selected ? comp(selected, "BUTTONS")?.buttons ?? [] : [];
  const mediaHeader = header && ["IMAGE", "VIDEO", "DOCUMENT"].includes(header.format || "") ? header.format! : null;
  const headerVars = header?.format === "TEXT" ? templateVars(header.text) : [];
  const bodyVars = templateVars(bodyC?.text);
  // Botões com parte variável: link dinâmico ({{1}} na URL) e copiar código
  const dynButtons = buttons
    .map((b, index) => ({ b, index }))
    .filter(({ b }) => (b.type === "URL" && /\{\{/.test(b.url || "")) || b.type === "COPY_CODE");

  const choose = (t: WaTemplate) => {
    setSelected(t);
    setError("");
    const first = (contactName || "").trim().split(/\s+/)[0];
    const bv = templateVars(comp(t, "BODY")?.text);
    const h = comp(t, "HEADER");
    // Sugere o primeiro nome do contato na 1ª variável e o exemplo da Meta na mídia do cabeçalho
    setValues({
      ...(bv[0] && first && !/^\+?\d+$/.test(first) ? { [`b${bv[0]}`]: first } : {}),
      ...(h && h.format !== "TEXT" && h.example?.header_handle?.[0] ? { media: h.example.header_handle[0] } : {}),
    });
  };

  const bodyValues = useMemo(() => Object.fromEntries(bodyVars.map((v) => [v, values[`b${v}`] || ""])), [bodyVars, values]);
  const headerValues = useMemo(() => Object.fromEntries(headerVars.map((v) => [v, values[`h${v}`] || ""])), [headerVars, values]);
  const preview = selected
    ? [header?.format === "TEXT" ? fill(header.text, headerValues) && `*${fill(header.text, headerValues)}*` : "", fill(bodyC?.text, bodyValues), comp(selected, "FOOTER")?.text || ""]
        .filter(Boolean).join("\n\n")
    : "";

  const send = async () => {
    if (!selected) return;
    const missing = [...headerVars.map((v) => `h${v}`), ...bodyVars.map((v) => `b${v}`), ...dynButtons.map(({ index }) => `btn${index}`), ...(mediaHeader ? ["media"] : [])]
      .filter((k) => !values[k]?.trim());
    if (missing.length) { setError("Preencha todos os campos."); return; }

    const named = selected.parameter_format === "NAMED";
    const param = (key: string, text: string) => ({ type: "text", text, ...(named ? { parameter_name: key } : {}) });
    const components: any[] = [];
    if (mediaHeader) {
      const kind = mediaHeader.toLowerCase();
      components.push({ type: "header", parameters: [{ type: kind, [kind]: { link: values.media.trim() } }] });
    } else if (headerVars.length) {
      components.push({ type: "header", parameters: headerVars.map((v) => param(v, values[`h${v}`].trim())) });
    }
    if (bodyVars.length) components.push({ type: "body", parameters: bodyVars.map((v) => param(v, values[`b${v}`].trim())) });
    for (const { b, index } of dynButtons) {
      const value = values[`btn${index}`].trim();
      components.push(b.type === "COPY_CODE"
        ? { type: "button", sub_type: "copy_code", index: String(index), parameters: [{ type: "coupon_code", coupon_code: value }] }
        : { type: "button", sub_type: "url", index: String(index), parameters: [{ type: "text", text: value }] });
    }

    setSending(true); setError("");
    try {
      const res = await authFetch(`/api/v1/conversations/${conversationId}/template`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ name: selected.name, language: selected.language, components, preview }),
      });
      if (!res.ok) { setError(await errorText(res)); return; }
      onSent(await res.json());
      onClose();
    } catch {
      setError("Sem conexão com o servidor.");
    } finally { setSending(false); }
  };

  const inp = "w-full px-3 py-2 text-sm bg-gray-50 text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="flex items-center gap-2 font-semibold text-gray-900">
            <FileText className="w-4 h-4 text-brand-600" />{selected ? selected.name : "Enviar template"}
          </p>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><RefreshCw className="w-4 h-4 animate-spin" />Carregando templates…</div>}
          {!loading && !selected && templates.length === 0 && !error && (
            <p className="text-sm text-gray-500">Nenhum template aprovado. Crie um em Configurações → Templates.</p>
          )}
          {!selected && templates.map((t) => (
            <button key={t.id} onClick={() => choose(t)} className="w-full text-left rounded-xl border border-gray-200 p-3 hover:border-brand-300 hover:bg-brand-50/40">
              <p className="text-sm font-semibold text-gray-900">{t.name} <span className="text-[11px] font-normal text-gray-400">· {CATEGORY_LABEL[t.category] ?? t.category} · {t.language}</span></p>
              <p className="text-xs text-gray-600 line-clamp-2 whitespace-pre-wrap">{comp(t, "BODY")?.text}</p>
            </button>
          ))}

          {selected && (
            <>
              {mediaHeader && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Link da {mediaHeader === "IMAGE" ? "imagem" : mediaHeader === "VIDEO" ? "vídeo" : "arquivo PDF"} do cabeçalho</label>
                  <input value={values.media ?? ""} onChange={(e) => setValues((x) => ({ ...x, media: e.target.value }))} placeholder="https://…" className={inp} />
                </div>
              )}
              {headerVars.map((v) => (
                <div key={`h${v}`}>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Cabeçalho {`{{${v}}}`}</label>
                  <input value={values[`h${v}`] ?? ""} onChange={(e) => setValues((x) => ({ ...x, [`h${v}`]: e.target.value }))} className={inp} />
                </div>
              ))}
              {bodyVars.map((v) => (
                <div key={`b${v}`}>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">{`{{${v}}}`}</label>
                  <input value={values[`b${v}`] ?? ""} onChange={(e) => setValues((x) => ({ ...x, [`b${v}`]: e.target.value }))} className={inp} />
                </div>
              ))}
              {dynButtons.map(({ b, index }) => (
                <div key={`btn${index}`}>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    {b.type === "COPY_CODE" ? `Código do botão "${b.text}"` : `Final do link do botão "${b.text}" (${b.url})`}
                  </label>
                  <input value={values[`btn${index}`] ?? ""} onChange={(e) => setValues((x) => ({ ...x, [`btn${index}`]: e.target.value }))} className={inp} />
                </div>
              ))}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Prévia</p>
                <div className="rounded-xl bg-[#dcf8c6] p-3 text-sm text-gray-900 whitespace-pre-wrap break-words">{preview}</div>
                {buttons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {buttons.map((b, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">{b.text}</span>)}
                  </div>
                )}
              </div>
            </>
          )}
          {error && <p className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}
        </div>

        {selected && (
          <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
            <button onClick={() => { setSelected(null); setError(""); }} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Voltar</button>
            <button onClick={send} disabled={sending} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50">
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Enviar template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
