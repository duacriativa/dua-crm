"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, CalendarClock, CalendarX, Check, Copy, Loader2, RotateCcw, Settings2, Trash2, UserX, Video, X } from "lucide-react";
import api from "@/lib/api";
import { SlotPicker } from "./slot-picker";
import { bookingUrl } from "./booking-settings";

export interface MeetingRow {
  id: string; title: string; startAt: string; endAt: string; status: string; name: string; email: string; phone: string | null;
  notes: string | null; meetLink: string | null; cancelReason: string | null; cancelledBy: string | null; rescheduleCount: number;
  contact: { id: string; name: string; phone: string | null } | null;
  bookingPage: { slug: string; timezone: string } | null;
}

export interface BlockRow { id: string; title: string | null; startAt: string; endAt: string }

const TZ = "America/Sao_Paulo";
const errMsg = (e: any) => {
  const m = e?.response?.data?.message;
  return (Array.isArray(m) ? m[0] : m) || e?.message || "Algo deu errado.";
};
const time = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const dayLabel = (iso: string) => {
  const k = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86400_000).toISOString());
  const base = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
  return k === today ? `Hoje · ${base}` : k === tomorrow ? `Amanhã · ${base}` : base;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Agendada", cls: "bg-primary/15 text-primary border-primary/30" },
  CANCELLED: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
  NO_SHOW: { label: "Não compareceu", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  COMPLETED: { label: "Realizada", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

/** Lista "Reuniões" da Agenda: próximas e passadas, com Meet, remarcar, cancelar e não compareceu. */
export function MeetingsPanel({ onChanged }: { onChanged?: () => void }) {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = useState<MeetingRow[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [moving, setMoving] = useState<MeetingRow | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [blocking, setBlocking] = useState<{ date: string; start: string; end: string; title: string } | null>(null);
  const [savingBlock, setSavingBlock] = useState(false);

  const load = useCallback(() => {
    setError("");
    api.get("/scheduling/meetings", { params: { scope } })
      .then((r) => setRows(r.data))
      .catch((e) => { setRows([]); setError(errMsg(e)); });
  }, [scope]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const loadBlocks = useCallback(() => { api.get("/scheduling/blocks").then((r) => setBlocks(r.data)).catch(() => {}); }, []);
  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const saveBlock = async () => {
    if (!blocking) return;
    setSavingBlock(true);
    try { await api.post("/scheduling/blocks", blocking); setBlocking(null); loadBlocks(); }
    catch (e) { alert(errMsg(e)); }
    finally { setSavingBlock(false); }
  };
  const removeBlock = async (b: BlockRow) => {
    if (!confirm(`Liberar ${dayLabel(b.startAt)}, ${time(b.startAt)}–${time(b.endAt)} na página de agendamento?`)) return;
    try { await api.delete(`/scheduling/blocks/${b.id}`); loadBlocks(); } catch (e) { setError(errMsg(e)); }
  };
  useEffect(() => { api.get("/scheduling/pages").then((r) => setSlug(r.data[0]?.slug ?? null)).catch(() => {}); }, []);

  const act = async (m: MeetingRow, fn: () => Promise<unknown>) => {
    setBusyId(m.id); setError("");
    try { await fn(); load(); onChanged?.(); } catch (e) { setError(errMsg(e)); } finally { setBusyId(null); }
  };
  const cancel = (m: MeetingRow) => {
    const reason = prompt(`Cancelar a reunião com ${m.name}? O cliente recebe o cancelamento por e-mail.\n\nMotivo (opcional):`);
    if (reason === null) return;
    act(m, () => api.post(`/scheduling/meetings/${m.id}/cancel`, { reason }));
  };
  const setStatus = (m: MeetingRow, status: string) => act(m, () => api.patch(`/scheduling/meetings/${m.id}/status`, { status }));

  const loadSlots = useCallback(
    (from: string, to: string) => api.get(`/scheduling/meetings/${moving?.id}/slots`, { params: { from, to } }).then((r) => r.data),
    [moving?.id],
  );
  const reschedule = async (iso: string) => {
    if (!moving) return;
    setBusyId(moving.id); setError("");
    try { await api.post(`/scheduling/meetings/${moving.id}/reschedule`, { startAt: iso }); setMoving(null); load(); onChanged?.(); }
    catch (e) { alert(errMsg(e)); }
    finally { setBusyId(null); }
  };

  const groups: [string, MeetingRow[]][] = [];
  for (const m of rows ?? []) {
    const k = dayKey(m.startAt);
    const g = groups.find(([key]) => key === k);
    if (g) g[1].push(m); else groups.push([k, [m]]);
  }
  const now = Date.now();
  const inp = "w-full mt-1 px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground";
  const btn = "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center bg-muted/40 border border-border rounded-xl p-1 gap-0.5">
          {([["upcoming", "Próximas"], ["past", "Passadas"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${scope === k ? "bg-background shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {slug && (
            <button onClick={() => { navigator.clipboard.writeText(bookingUrl(slug)); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className={btn}>
              {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Link de agendamento</>}
            </button>
          )}
          <button onClick={() => setBlocking({ date: dayKey(new Date().toISOString()), start: "09:00", end: "11:00", title: "" })} className={btn}>
            <Ban className="w-3.5 h-3.5" /> Bloquear horário
          </button>
          <Link href="/dashboard/configuracoes?tab=Agendamento" className={btn}><Settings2 className="w-3.5 h-3.5" /> Disponibilidade</Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {scope === "upcoming" && blocks.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Horários bloqueados</p>
          <div className="surface-card divide-y divide-border">
            {blocks.map((b) => (
              <div key={b.id} className="p-3 flex items-center gap-3">
                <Ban className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground first-letter:uppercase">{dayLabel(b.startAt)} · {time(b.startAt)} – {time(b.endAt)}</p>
                  {b.title && <p className="text-xs text-muted-foreground truncate">{b.title}</p>}
                </div>
                <button onClick={() => removeBlock(b)} className={btn} title="Liberar horário"><Trash2 className="w-3.5 h-3.5" /> Liberar</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {rows === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <CalendarClock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">{scope === "upcoming" ? "Nenhuma reunião marcada" : "Nenhuma reunião passada"}</p>
          {scope === "upcoming" && <p className="text-sm text-muted-foreground mt-1">Quando alguém agendar pelo link, ela aparece aqui.</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([k, list]) => (
            <div key={k}>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 first-letter:uppercase">{dayLabel(list[0].startAt)}</p>
              <div className="surface-card divide-y divide-border">
                {list.map((m) => {
                  const st = STATUS[m.status] ?? STATUS.SCHEDULED;
                  const live = m.status === "SCHEDULED" && new Date(m.startAt).getTime() - now < 15 * 60_000 && new Date(m.endAt).getTime() > now;
                  const future = new Date(m.startAt).getTime() > now;
                  const started = !future;
                  return (
                    <div key={m.id} className={`p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${m.status === "CANCELLED" ? "opacity-60" : ""}`}>
                      <div className="sm:w-28 shrink-0">
                        <p className="text-sm font-bold text-foreground">{time(m.startAt)} – {time(m.endAt)}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {m.contact ? <Link href={`/dashboard/contatos/${m.contact.id}`} className="hover:underline">{m.name}</Link> : m.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{[m.phone, m.email].filter(Boolean).join(" · ")}</p>
                        {m.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">“{m.notes}”</p>}
                        {m.status === "CANCELLED" && <p className="text-xs text-muted-foreground mt-1">Cancelada {m.cancelledBy === "CLIENT" ? "pelo cliente" : "pela equipe"}{m.cancelReason ? `: ${m.cancelReason}` : ""}</p>}
                        {m.rescheduleCount > 0 && m.status !== "CANCELLED" && <p className="text-[11px] text-muted-foreground mt-1">Remarcada {m.rescheduleCount}×</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {busyId === m.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        {m.status === "SCHEDULED" && m.meetLink && new Date(m.endAt).getTime() > now && (
                          <a href={m.meetLink} target="_blank" rel="noreferrer"
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${live ? "text-white bg-gradient-primary" : "text-primary border border-primary/40 hover:bg-primary/10"}`}>
                            <Video className="w-3.5 h-3.5" /> Entrar no Meet
                          </a>
                        )}
                        {m.status === "SCHEDULED" && future && (
                          <>
                            <button onClick={() => setMoving(m)} disabled={busyId === m.id} className={btn}><RotateCcw className="w-3.5 h-3.5" /> Remarcar</button>
                            <button onClick={() => cancel(m)} disabled={busyId === m.id} className={btn}><CalendarX className="w-3.5 h-3.5" /> Cancelar</button>
                          </>
                        )}
                        {started && m.status === "SCHEDULED" && (
                          <>
                            <button onClick={() => setStatus(m, "COMPLETED")} disabled={busyId === m.id} className={btn}><Check className="w-3.5 h-3.5" /> Realizada</button>
                            <button onClick={() => setStatus(m, "NO_SHOW")} disabled={busyId === m.id} className={btn}><UserX className="w-3.5 h-3.5" /> Não compareceu</button>
                          </>
                        )}
                        {started && (m.status === "NO_SHOW" || m.status === "COMPLETED") && (
                          <button onClick={() => setStatus(m, "SCHEDULED")} disabled={busyId === m.id} className={btn} title="Desfazer">
                            <RotateCcw className="w-3.5 h-3.5" /> Desfazer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {blocking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-foreground">Bloquear horário</h2>
              <button onClick={() => setBlocking(null)} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Esse período some da página de agendamento. As reuniões já marcadas não mudam.</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Data</span>
                <input type="date" value={blocking.date} min={dayKey(new Date().toISOString())} onChange={(e) => setBlocking({ ...blocking, date: e.target.value })} className={inp} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Início</span>
                  <input type="time" value={blocking.start} onChange={(e) => setBlocking({ ...blocking, start: e.target.value })} className={inp} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Fim</span>
                  <input type="time" value={blocking.end} onChange={(e) => setBlocking({ ...blocking, end: e.target.value })} className={inp} />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-foreground">Motivo (opcional)</span>
                <input value={blocking.title} maxLength={120} placeholder="Ex.: reunião presencial com a FAV" onChange={(e) => setBlocking({ ...blocking, title: e.target.value })} className={inp} />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setBlocking(null)} className="px-4 py-2 text-sm font-medium rounded-xl border border-border text-muted-foreground hover:bg-muted/50">Voltar</button>
              <button onClick={saveBlock} disabled={savingBlock || !blocking.date}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 disabled:opacity-60">
                {savingBlock && <Loader2 className="w-4 h-4 animate-spin" />} Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {moving && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-foreground">Remarcar reunião</h2>
              <button onClick={() => setMoving(null)} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{moving.name} · atual: {dayLabel(moving.startAt)}, {time(moving.startAt)}. O cliente recebe o convite atualizado.</p>
            <SlotPicker load={loadSlots} onConfirm={reschedule} confirmLabel="Remarcar" variant="app" busy={busyId === moving.id} />
          </div>
        </div>
      )}
    </div>
  );
}
