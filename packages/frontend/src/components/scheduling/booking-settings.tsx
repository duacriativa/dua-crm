"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import api from "@/lib/api";

type Ranges = [string, string][];
export interface BookingPageCfg {
  id: string; slug: string; title: string; description: string | null; active: boolean;
  durationMin: number; bufferAfterMin: number; slotStepMin: number; minNoticeMin: number; maxDaysAhead: number;
  timezone: string; weeklyHours: Record<string, Ranges>; dateOverrides: Record<string, Ranges>;
}
interface GoogleStatus { configured: boolean; connected: boolean; email: string | null; connectedAt: string | null }

const errMsg = (e: any) => {
  const m = e?.response?.data?.message;
  return (Array.isArray(m) ? m[0] : m) || e?.message || "Algo deu errado.";
};
const DAYS = [["1", "Segunda"], ["2", "Terça"], ["3", "Quarta"], ["4", "Quinta"], ["5", "Sexta"], ["6", "Sábado"], ["0", "Domingo"]] as const;
const inp = "px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground";

export function bookingUrl(slug: string) {
  return `${typeof window !== "undefined" ? window.location.origin : "https://crm.duacriativa.com.br"}/agendar/${slug}`;
}

/* ── Card do Google em Integrações ── */
export function GoogleCalendarCard() {
  const [st, setSt] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => api.get("/google/status").then((r) => setSt(r.data)).catch(() => setSt(null)), []);
  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setBusy(true); setError("");
    try {
      const redirectUri = `${window.location.origin}/integracoes/google/callback`;
      const { data } = await api.get("/google/auth-url", { params: { redirectUri } });
      window.location.href = data.url;
    } catch (e) { setError(errMsg(e)); setBusy(false); }
  };
  const disconnect = async () => {
    if (!confirm("Desconectar o Google Agenda? A página de agendamento continua no ar, mas sem checar a agenda e sem criar o Meet.")) return;
    setBusy(true);
    try { await api.delete("/google"); await load(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="surface-card p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-xl">📅</div>
          <div>
            <p className="font-semibold text-foreground text-sm">Google Agenda</p>
            <p className="text-xs text-muted-foreground mt-0.5">{st?.connected ? st.email ?? "Conta conectada" : "Agendamentos com Google Meet"}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          st?.connected ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
          {st === null ? "Verificando..." : st.connected ? "Conectado" : "Desconectado"}
        </span>
      </div>
      {st && !st.configured && <p className="text-xs text-amber-400 mb-3">Faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no servidor.</p>}
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      {st?.connected ? (
        <button onClick={disconnect} disabled={busy} className="w-full py-2 mt-auto text-sm font-medium rounded-xl border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50">
          Desconectar
        </button>
      ) : (
        <button onClick={connect} disabled={busy || (st !== null && !st.configured)}
          className="w-full py-2 mt-auto text-sm font-medium rounded-xl text-white bg-gradient-primary hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Conectar Google
        </button>
      )}
    </div>
  );
}

/** Faixa nova: começa onde a última termina e dura 1h (sem passar de 23:59). */
function nextRange(ranges: Ranges): [string, string] {
  if (!ranges.length) return ["09:00", "17:00"];
  const start = ranges[ranges.length - 1][1];
  const min = Math.min(Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + 60, 23 * 60 + 59);
  return [start, `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`];
}

function RangesEditor({ ranges, onChange }: { ranges: Ranges; onChange: (r: Ranges) => void }) {
  return (
    <div className="space-y-2">
      {ranges.map(([a, b], i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="time" value={a} onChange={(e) => onChange(ranges.map((r, j) => (j === i ? [e.target.value, r[1]] : r)) as Ranges)} className={`${inp} w-28`} />
          <span className="text-muted-foreground text-sm">–</span>
          <input type="time" value={b} onChange={(e) => onChange(ranges.map((r, j) => (j === i ? [r[0], e.target.value] : r)) as Ranges)} className={`${inp} w-28`} />
          <button type="button" onClick={() => onChange(ranges.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-muted/50" title="Remover faixa">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...ranges, nextRange(ranges)])}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus className="w-3.5 h-3.5" /> Adicionar faixa
      </button>
    </div>
  );
}

/* ── Aba "Agendamento" ── */
export function BookingSettings() {
  const [page, setPage] = useState<BookingPageCfg | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newDate, setNewDate] = useState("");

  useEffect(() => {
    api.get("/scheduling/pages").then((r) => setPage(r.data[0] ?? null)).catch((e) => setError(errMsg(e)));
  }, []);

  if (!page) return <div className="max-w-3xl">{error ? <p className="text-sm text-red-400">{error}</p> : <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}</div>;

  const set = (patch: Partial<BookingPageCfg>) => { setPage({ ...page, ...patch }); setSaved(false); };
  const save = async () => {
    setSaving(true); setError("");
    try {
      const { id, slug, title, description, active, durationMin, bufferAfterMin, slotStepMin, minNoticeMin, maxDaysAhead, weeklyHours, dateOverrides } = page;
      const { data } = await api.patch(`/scheduling/pages/${id}`, { slug, title, description, active, durationMin, bufferAfterMin, slotStepMin, minNoticeMin, maxDaysAhead, weeklyHours, dateOverrides });
      setPage(data); setSaved(true);
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  const url = bookingUrl(page.slug);
  const num = (k: keyof BookingPageCfg, label: string, hint: string, factor = 1) => (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input type="number" min={0} value={Math.round((page[k] as number) / factor)} onChange={(e) => set({ [k]: Math.round(Number(e.target.value) * factor) } as any)} className={`${inp} w-full mt-1`} />
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </label>
  );
  const overrides = Object.entries(page.dateOverrides ?? {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Link de agendamento</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Substitui o Calendly: mande este link no WhatsApp, no site e nos bots.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <span className="text-xs text-muted-foreground">{page.active ? "No ar" : "Pausado"}</span>
            <button type="button" onClick={() => set({ active: !page.active })} className={`w-9 h-5 rounded-full transition-colors relative ${page.active ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${page.active ? "left-4" : "left-0.5"}`} />
            </button>
          </label>
        </div>
        <div className="flex gap-2">
          <code className="flex-1 text-xs bg-muted/50 border border-border rounded-lg px-3 py-2 text-muted-foreground truncate font-mono">{url}</code>
          <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted/50 flex items-center gap-1.5 shrink-0">
            {copied ? <><Check className="w-3 h-3 text-emerald-400" />Copiado!</> : <><Copy className="w-3 h-3" />Copiar</>}
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted/50 flex items-center gap-1.5 shrink-0">
            <ExternalLink className="w-3 h-3" />Abrir
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Nome da reunião</span>
            <input value={page.title} onChange={(e) => set({ title: e.target.value })} className={`${inp} w-full mt-1`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Final do link</span>
            <input value={page.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className={`${inp} w-full mt-1 font-mono`} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Descrição (aparece na página)</span>
          <textarea rows={3} value={page.description ?? ""} onChange={(e) => set({ description: e.target.value })} className={`${inp} w-full mt-1 resize-none`} />
        </label>
      </div>

      <div className="surface-card p-5">
        <h2 className="text-base font-bold text-foreground mb-4">Regras</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {num("durationMin", "Duração (min)", "Tempo da reunião")}
          {num("bufferAfterMin", "Intervalo depois (min)", "Livre após cada reunião")}
          {num("slotStepMin", "Horários a cada (min)", "Ex.: 60 → 9:00, 10:00…")}
          {num("minNoticeMin", "Antecedência mínima (h)", "Não agenda em cima da hora", 60)}
          {num("maxDaysAhead", "Até quantos dias à frente", "Janela de agendamento")}
          <div>
            <span className="text-sm font-medium text-foreground">Fuso horário</span>
            <p className={`${inp} mt-1 text-muted-foreground`}>Brasília (GMT-3)</p>
          </div>
        </div>
      </div>

      <div className="surface-card p-5">
        <h2 className="text-base font-bold text-foreground">Disponibilidade semanal</h2>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">Os horários ocupados no Google Agenda saem da lista automaticamente.</p>
        <div className="divide-y divide-border">
          {DAYS.map(([d, label]) => {
            const ranges = page.weeklyHours[d] ?? [];
            return (
              <div key={d} className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6">
                <label className="flex items-center gap-2 w-32 shrink-0 pt-2">
                  <input type="checkbox" checked={ranges.length > 0} className="accent-[hsl(var(--primary))]"
                    onChange={(e) => set({ weeklyHours: { ...page.weeklyHours, [d]: e.target.checked ? [["09:00", "17:00"]] : [] } })} />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </label>
                {ranges.length ? (
                  <RangesEditor ranges={ranges} onChange={(r) => set({ weeklyHours: { ...page.weeklyHours, [d]: r } })} />
                ) : <p className="text-sm text-muted-foreground pt-2">Indisponível</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="surface-card p-5">
        <h2 className="text-base font-bold text-foreground">Exceções por data</h2>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">Feriados, folgas ou um dia com horário diferente. Sem faixas = dia fechado.</p>
        <div className="space-y-3">
          {overrides.map(([date, ranges]) => (
            <div key={date} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 border border-border rounded-xl p-3">
              <div className="flex items-center gap-2 w-40 shrink-0 pt-2">
                <button type="button" onClick={() => { const o = { ...page.dateOverrides }; delete o[date]; set({ dateOverrides: o }); }}
                  className="p-1 rounded-lg text-muted-foreground hover:text-red-400" title="Remover exceção"><X className="w-4 h-4" /></button>
                <span className="text-sm font-medium text-foreground">{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
              </div>
              <div className="flex-1">
                {!ranges.length && <p className="text-sm text-muted-foreground mb-2">Dia fechado</p>}
                <RangesEditor ranges={ranges} onChange={(r) => set({ dateOverrides: { ...page.dateOverrides, [date]: r } })} />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inp} />
            <button type="button" disabled={!newDate} onClick={() => { set({ dateOverrides: { ...page.dateOverrides, [newDate]: [] } }); setNewDate(""); }}
              className="px-3 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted/50 disabled:opacity-50 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Fechar/ajustar este dia
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-0 py-3 bg-background/80 backdrop-blur">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </button>
        {saved && <span className="text-sm text-emerald-400 flex items-center gap-1"><Check className="w-4 h-4" /> Salvo</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
