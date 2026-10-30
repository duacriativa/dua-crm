"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check, X, Loader2, RefreshCw, MessageCircle, User, Sparkles, CalendarClock, FileText, Reply,
  ClipboardCheck, UserCog, Bot, RotateCcw, AlertTriangle, Gift, Cake, Copy,
} from "lucide-react";
import api from "@/lib/api";

interface Task {
  id: string;
  kind: string;
  title: string;
  reason: string;
  dueAt: string;
  status: "OPEN" | "DONE" | "DISMISSED";
  source: "RULE" | "AI" | "BIRTHDAY";
  conversationId: string | null;
  closedAt: string | null;
  closedBy: string | null;
  contact: { id: string; name: string; phone: string | null; instagramHandle: string | null };
}
interface Counts { all: number; overdue: number; today: number }

const FILTERS = [
  { key: "today", label: "Hoje" },
  { key: "overdue", label: "Atrasadas" },
  { key: "all", label: "Todas" },
  { key: "closed", label: "Fechadas" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const KIND: Record<string, { label: string; icon: any; color: string }> = {
  MEETING_NEXT_STEP: { label: "Pós-reunião", icon: FileText, color: "text-violet-400 bg-violet-500/10" },
  PROPOSAL_FOLLOWUP: { label: "Proposta", icon: ClipboardCheck, color: "text-amber-400 bg-amber-500/10" },
  MEETING_STATUS: { label: "Reunião", icon: CalendarClock, color: "text-sky-400 bg-sky-500/10" },
  COMPLETE_PROFILE: { label: "Cadastro", icon: UserCog, color: "text-orange-400 bg-orange-500/10" },
  REPLY: { label: "Responder", icon: Reply, color: "text-emerald-400 bg-emerald-500/10" },
  BOT_NOTE: { label: "Aviso do bot", icon: Bot, color: "text-teal-400 bg-teal-500/10" },
  AI: { label: "IA", icon: Sparkles, color: "text-primary bg-primary/10" },
  BIRTHDAY_GIFT: { label: "Presente", icon: Gift, color: "text-pink-400 bg-pink-500/10" },
  BIRTHDAY: { label: "Aniversário", icon: Cake, color: "text-pink-400 bg-pink-500/10" },
};

const errMsg = (e: any) => e?.response?.data?.message || e?.message || "Erro ao carregar.";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** "atrasada há 2 dias", "vence hoje 14:00"… */
function dueText(iso: string) {
  const d = new Date(iso);
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startToday.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (days > 0) return { text: days === 1 ? "desde ontem" : `atrasada há ${days} dias`, late: true };
  if (days === 0) return { text: d.getTime() <= Date.now() ? `hoje, desde ${hm}` : `hoje, ${hm}`, late: false };
  return { text: `${d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} ${hm}`, late: false };
}

function conversationHref(t: Task) {
  if (t.conversationId) return `/dashboard/conversas?conv=${t.conversationId}`;
  if (t.contact.phone) return `/dashboard/conversas?phone=${encodeURIComponent(t.contact.phone)}&name=${encodeURIComponent(t.contact.name || "")}`;
  return null;
}

/** Tarefas do comercial: criadas pelas regras automáticas e pela leitura diária da IA. */
export default function TarefasPage() {
  const [filter, setFilter] = useState<FilterKey>("today");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [summary, setSummary] = useState<{ date?: string; text?: string }>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (t: Task) => {
    try { await navigator.clipboard.writeText(t.reason); setCopied(t.id); setTimeout(() => setCopied(null), 2000); } catch { setError("Não deu para copiar."); }
  };

  const load = useCallback(() => {
    setError("");
    const params = filter === "closed" ? { status: "CLOSED" } : { filter };
    return api.get("/sales-tasks", { params })
      .then((r) => { setTasks(r.data.tasks); setCounts(r.data.counts); window.dispatchEvent(new Event("sales-tasks-changed")); })
      .catch((e) => { setTasks([]); setError(errMsg(e)); });
  }, [filter]);

  useEffect(() => { setTasks(null); load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { api.get("/sales-tasks/summary").then((r) => setSummary(r.data || {})).catch(() => {}); }, []);

  const act = async (t: Task, action: "done" | "dismiss" | "reopen") => {
    setBusy(t.id);
    try {
      await api.post(`/sales-tasks/${t.id}/${action}`);
      setTasks((list) => (list ?? []).filter((x) => x.id !== t.id));
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try { await api.post("/sales-tasks/run"); await load(); } catch (e) { setError(errMsg(e)); } finally { setRefreshing(false); }
  };

  const countOf = (k: FilterKey) => (k === "closed" || !counts ? "" : counts[k === "today" ? "today" : k === "overdue" ? "overdue" : "all"]);

  // Segunda: o resumo da semana aparece no topo durante a semana (até domingo)
  const showSummary = !!summary.text && !!summary.date && Date.now() - new Date(`${summary.date}T12:00:00`).getTime() < 6 * 86_400_000;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-background/80 backdrop-blur-xl px-4 sm:px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">O que o comercial precisa fazer agora · regras automáticas a cada 15 min, leitura da IA nos dias úteis às 8h e aniversários de clientes</p>
          </div>
          <button onClick={refresh} disabled={refreshing} title="Atualizar agora"
            className="p-2 border border-border rounded-xl hover:bg-muted/50 disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap border ${filter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {f.label} <span className="opacity-70">{countOf(f.key)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {showSummary && filter !== "closed" && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-2"><Sparkles className="w-3.5 h-3.5" /> Resumo da semana</p>
            <p className="text-sm text-foreground whitespace-pre-line">{summary.text}</p>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!tasks ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <Check className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === "today" ? "Nada para hoje." : filter === "overdue" ? "Nenhuma tarefa atrasada." : filter === "closed" ? "Nenhuma tarefa fechada nos últimos 14 dias." : "Nenhuma tarefa aberta."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => {
              const k = KIND[t.kind] ?? KIND.AI;
              const due = dueText(t.dueAt);
              const conv = conversationHref(t);
              const closed = t.status !== "OPEN";
              return (
                <li key={t.id} className={`rounded-2xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${!closed && due.late ? "border-red-500/30" : "border-border"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.color}`}>
                    <k.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${closed ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.title}</p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${k.color}`}>{k.label}</span>
                    </div>
                    {t.kind === "BIRTHDAY" ? (
                      <div className="mt-1.5 rounded-xl border border-pink-500/20 bg-pink-500/5 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-pink-400 mb-1">Mensagem pronta (revise antes de enviar)</p>
                        <p className="text-sm text-foreground whitespace-pre-line">{t.reason}</p>
                        <button onClick={() => copy(t)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-pink-400 hover:underline">
                          {copied === t.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied === t.id ? "Copiada" : "Copiar mensagem"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.reason}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                      {closed ? (
                        <span className="text-muted-foreground">
                          {t.status === "DONE" ? "Concluída" : "Dispensada"}{t.closedBy ? ` por ${t.closedBy}` : ""}{t.closedAt ? ` · ${fmt(t.closedAt)}` : ""}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 font-medium ${due.late ? "text-red-400" : "text-foreground"}`}>
                          {due.late && <AlertTriangle className="w-3 h-3" />}{due.text}
                        </span>
                      )}
                      {conv && (
                        <Link href={conv} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <MessageCircle className="w-3.5 h-3.5" /> Conversa
                        </Link>
                      )}
                      <Link href={`/dashboard/contatos/${t.contact.id}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
                        <User className="w-3.5 h-3.5" /> {t.contact.name || t.contact.phone}
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {closed ? (
                      <button onClick={() => act(t, "reopen")} disabled={busy === t.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted/50 disabled:opacity-50">
                        <RotateCcw className="w-3.5 h-3.5" /> Reabrir
                      </button>
                    ) : (
                      <>
                        <button onClick={() => act(t, "dismiss")} disabled={busy === t.id} title="Dispensar: não precisa fazer"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50">
                          <X className="w-3.5 h-3.5" /> Dispensar
                        </button>
                        <button onClick={() => act(t, "done")} disabled={busy === t.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                          {busy === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Concluir
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
