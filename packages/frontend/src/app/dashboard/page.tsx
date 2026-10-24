"use client";
import { authFetch } from "@/lib/auth-fetch";

import {
  TrendingUp, Users, DollarSign, Activity, ArrowUpRight, ArrowDownRight, Sparkles, RefreshCw, Trophy, Target,
  Megaphone, CalendarCheck, Filter, FileText, Clock, Wallet, MousePointerClick, Receipt,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

const API_URL = "";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

const HIDE_KEY = "dua-crm-ocultar-valores";
const PERIOD_KEY = "dua-crm-dashboard-periodo";
const MASK = "R$ •••";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: Math.abs(v) < 100 && v % 1 !== 0 ? 2 : 0 });
}
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR")}%`);
const fmtDays = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v < 1 ? "< 1 dia" : `${v.toLocaleString("pt-BR")} ${v === 1 ? "dia" : "dias"}`);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// ── Período (dias no horário de Brasília, UTC-3 fixo) ──
type Preset = "hoje" | "ontem" | "7d" | "30d" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "hoje", label: "Hoje" }, { key: "ontem", label: "Ontem" }, { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" }, { key: "custom", label: "Personalizado" },
];
const todayBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
function addDays(d: string, n: number) {
  const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10);
}
function presetRange(p: Preset): [string, string] {
  const t = todayBR();
  if (p === "hoje") return [t, t];
  if (p === "ontem") return [addDays(t, -1), addDays(t, -1)];
  if (p === "30d") return [addDays(t, -29), t];
  return [addDays(t, -6), t];
}

// ── Comparação com o período anterior ──
type Delta = { text: string; good: boolean | null } | null;
/** lowerIsBetter: custos (CPL, CAC...) — cair é bom. */
function delta(cur: number | null | undefined, prev: number | null | undefined, lowerIsBetter = false): Delta {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return null;
  if (prev === 0) return cur === 0 ? { text: "= anterior", good: null } : { text: "novo vs 0", good: !lowerIsBetter };
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return { text: "= anterior", good: null };
  return { text: `${p > 0 ? "↑" : "↓"} ${Math.abs(p)}% vs anterior`, good: lowerIsBetter ? p < 0 : p > 0 };
}

function MetricCard({ label, value, hint, badge, delta: d, icon: Icon, accent, onBadgeClick }: {
  label: string; value: string; hint: string; badge?: string; delta?: Delta;
  icon: any; accent?: boolean; onBadgeClick?: () => void;
}) {
  const deltaColor = d?.good === true ? "text-success bg-success/10 border-success/20" : d?.good === false ? "text-destructive bg-destructive/10 border-destructive/20" : "text-muted-foreground bg-muted/60 border-border";
  return (
    <div className={`relative overflow-hidden surface-card p-5 transition-all hover:shadow-elegant hover:-translate-y-0.5 ${accent ? "ring-1 ring-primary/40" : ""}`}>
      {accent && <div className="absolute inset-0 bg-gradient-glow opacity-50 pointer-events-none" />}
      <div className="relative flex flex-col gap-3 h-full">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {d && <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${deltaColor}`}>{d.text}</span>}
          {badge && (onBadgeClick ? (
            <button onClick={onBadgeClick} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20">{badge}</button>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground border border-border">{badge}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Barras diárias de uma série (um gráfico por medida: nada de dois eixos). */
function DailyBars({ title, total, data, format }: {
  title: string; total: string; data: { date: string; value: number }[]; format: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="surface-card p-5">
      <div className="flex items-baseline justify-between mb-4 gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground text-right">
          {h ? <><span className="text-foreground font-medium">{format(h.value)}</span> em {ddmm(h.date)}</> : <>Total <span className="text-foreground font-medium">{total}</span></>}
        </p>
      </div>
      <div className="relative h-32 flex items-end gap-[2px] border-b border-border" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setHover(i)}>
            <div className={`w-full rounded-t-[4px] transition-opacity ${hover === null || hover === i ? "opacity-100" : "opacity-40"} ${d.value > 0 ? "bg-primary" : ""}`}
              style={{ height: d.value > 0 ? `${Math.max((d.value / max) * 100, 3)}%` : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
        <span>{data[0] && ddmm(data[0].date)}</span>
        {data.length > 2 && <span>{ddmm(data[Math.floor(data.length / 2)].date)}</span>}
        <span>{data.length > 1 && ddmm(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

const ORIGIN_LABELS: Record<string, string> = { ADS: "Anúncio", ORGANIC: "Orgânico", REFERRAL: "Indicação", OTHER: "Outro", UNKNOWN: "Não informado" };

function SectionTitle({ children, note }: { children: string; note?: string }) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
      {children}{note && <span className="normal-case tracking-normal font-normal ml-2 text-muted-foreground/70">{note}</span>}
    </h2>
  );
}

const chip = "px-2.5 py-1 rounded-full bg-muted/60 border border-border text-muted-foreground";

export default function DashboardPage() {
  const router = useRouter();
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
  const [preset, setPreset] = useState<Preset>("7d");
  const [range, setRange] = useState<[string, string]>(() => presetRange("7d"));
  const [hideValues, setHideValues] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [fin, setFin] = useState<any>(null);

  // Período salvo (os presets são recalculados para o dia de hoje)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PERIOD_KEY) || "null");
      if (saved?.preset === "custom" && saved.from && saved.to) { setPreset("custom"); setRange([saved.from, saved.to]); }
      else if (saved?.preset && saved.preset !== "custom") { setPreset(saved.preset); setRange(presetRange(saved.preset)); }
    } catch {}
  }, []);

  // Mesmo "ocultar valores" do topo (olho ao lado da meta de faturamento)
  useEffect(() => {
    const read = () => { try { setHideValues(localStorage.getItem(HIDE_KEY) === "1"); } catch {} };
    read();
    const onToggle = (e: Event) => setHideValues(!!(e as CustomEvent).detail);
    window.addEventListener(HIDE_KEY, onToggle);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(HIDE_KEY, onToggle); window.removeEventListener("storage", read); };
  }, []);

  const savePeriod = (p: Preset, r: [string, string]) => {
    try { localStorage.setItem(PERIOD_KEY, JSON.stringify({ preset: p, from: r[0], to: r[1] })); } catch {}
  };
  const choosePreset = (p: Preset) => {
    const r = p === "custom" ? range : presetRange(p);
    setPreset(p);
    setRange(r);
    savePeriod(p, r);
  };
  const setCustom = (i: 0 | 1, v: string) => {
    if (!v) return;
    const r: [string, string] = i === 0 ? [v, range[1] < v ? v : range[1]] : [range[0] > v ? v : range[0], v];
    setRange(r);
    savePeriod("custom", r);
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [ovRes, finRes] = await Promise.all([
        authFetch(`${API_URL}/api/v1/dashboard/overview?from=${range[0]}&to=${range[1]}`, { headers: authHeaders() }),
        authFetch(`${API_URL}/api/v1/financial/dashboard`, { headers: authHeaders() }),
      ]);
      if (ovRes.ok) setData(await ovRes.json());
      else setError((await ovRes.json().catch(() => ({})))?.message || "Não foi possível carregar o dashboard.");
      if (finRes.ok) setFin(await finRes.json());
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const money = (v: number | null | undefined) => (v === null || v === undefined ? "—" : hideValues ? MASK : fmt(v));
  const goIntegrations = () => router.push("/dashboard/configuracoes?tab=Integra%C3%A7%C3%B5es");

  const cur = data?.current;
  const prev = data?.previous;
  const meta = data?.meta;
  const mCur = meta?.current;
  const mPrev = meta?.previous;
  const eff = data?.efficiency?.current;
  const effPrev = data?.efficiency?.previous;
  const pipe = data?.pipeline;
  const periodLabel = data ? (data.period.from === data.period.to ? ddmm(data.period.from) : `${ddmm(data.period.from)} a ${ddmm(data.period.to)}`) : "";

  const daily: any[] = data?.daily ?? [];
  const leadSeries = useMemo(() => daily.map((d) => ({ date: d.date, value: d.leads })), [daily]);
  const spendSeries = useMemo(() => daily.map((d) => ({ date: d.date, value: d.spend })), [daily]);

  // Meta sem conexão: os cards dizem o que falta e levam a Integrações
  const metaMissing: string | null = !meta?.connected ? "conectar Meta Ads" : meta?.needsAccount ? "escolher a conta" : meta?.error ? "erro no Meta" : null;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const acquisition = !cur ? [] : [
    { label: "Leads no período", value: fmtNum(cur.leads.count), icon: Users, accent: true,
      hint: "contatos novos, sem clientes e testes",
      badge: cur.leads.excluded.clients + cur.leads.excluded.tests > 0
        ? `fora: ${plural(cur.leads.excluded.clients, "cliente", "clientes")} · ${plural(cur.leads.excluded.tests, "teste", "testes")}`
        : undefined,
      delta: delta(cur.leads.count, prev?.leads.count) },
    { label: "Investimento Meta", value: mCur ? money(mCur.spend) : "—", icon: Wallet,
      hint: meta?.accountName ? `conta ${meta.accountName}` : "valor gasto nos anúncios",
      badge: metaMissing ?? undefined, onBadgeClick: metaMissing ? goIntegrations : undefined,
      delta: mCur ? delta(mCur.spend, mPrev?.spend) : null },
    { label: "Leads Meta", value: mCur ? fmtNum(mCur.results) : "—", icon: MousePointerClick,
      hint: "resultados registrados pelo Meta",
      badge: mCur ? `${fmtNum(mCur.conversations)} conversas · ${fmtNum(mCur.leads)} cadastros` : metaMissing ?? undefined,
      onBadgeClick: !mCur && metaMissing ? goIntegrations : undefined,
      delta: mCur ? delta(mCur.results, mPrev?.results) : null },
    { label: "Custo por lead", value: money(eff?.cpl), icon: Receipt,
      hint: "investimento ÷ leads do Meta",
      badge: mCur && cur.leads.count > 0 ? `${money(mCur.spend / cur.leads.count)} por lead do CRM` : undefined,
      delta: delta(eff?.cpl, effPrev?.cpl, true) },
  ];

  // Funil em degraus: Leads → Reuniões agendadas → Realizadas → Vendas
  const steps: { label: string; value: number }[] = !cur ? [] : [
    { label: "Leads", value: cur.leads.count },
    { label: "Reuniões agendadas", value: cur.meetings.scheduled },
    { label: "Reuniões realizadas", value: cur.meetings.completed },
    { label: "Vendas", value: cur.sales.count },
  ];
  const stepMax = Math.max(...steps.map((s) => s.value), 1);

  const g = pipe?.groups ?? {};
  const pipelineCards = !pipe ? [] : [
    { label: "Qualificação", value: fmtNum(g.qualificacao?.count ?? 0), icon: Filter, hint: "cards nessa etapa agora",
      badge: `${money(g.qualificacao?.value ?? 0)} em valor` },
    { label: "Reunião agendada", value: fmtNum(g.reuniao?.count ?? 0), icon: CalendarCheck, hint: "cards nessa etapa agora",
      badge: `${money(g.reuniao?.value ?? 0)} em valor` },
    { label: "Proposta / Negociação", value: fmtNum(g.negociacao?.count ?? 0), icon: FileText,
      hint: "cards nessas etapas agora", badge: `${money(g.negociacao?.value ?? 0)} em valor` },
    { label: "Fechados (ganho)", value: fmtNum(g.fechados?.count ?? 0), icon: Trophy, accent: true, hint: "total na etapa de ganho",
      badge: `${pipe.wonInPeriod} no período` },
  ];

  const salesCards = !cur ? [] : [
    { label: "Vendas no período", value: money(cur.sales.value), icon: Trophy, accent: true,
      hint: `${plural(cur.sales.count, "venda fechada", "vendas fechadas")} no funil`,
      delta: delta(cur.sales.value, prev?.sales.value) },
    { label: "Ticket médio", value: money(cur.sales.ticket), icon: TrendingUp, hint: "valor médio por venda fechada",
      delta: delta(cur.sales.ticket, prev?.sales.ticket) },
    { label: "Conversão", value: fmtPct(cur.sales.conversion), icon: Target, hint: "vendas ÷ leads do período",
      badge: plural(cur.sales.lost, "perdido", "perdidos"), delta: delta(cur.sales.conversion, prev?.sales.conversion) },
    { label: "CAC · ROAS", value: money(eff?.cac), icon: Megaphone, hint: "investimento ÷ vendas fechadas",
      badge: eff?.roas != null ? `ROAS ${eff.roas.toLocaleString("pt-BR")}x` : metaMissing ?? "sem vendas no período",
      onBadgeClick: eff?.roas == null && metaMissing ? goIntegrations : undefined,
      delta: delta(eff?.cac, effPrev?.cac, true) },
  ];

  // ── Financeiro e retenção: Asaas (mês corrente) + contratos do CRM; não seguem o filtro ──
  const received = fin?.received ?? 0;
  const pending = fin?.pending ?? 0;
  const overdue = fin?.overdue ?? 0;
  const total = received + pending;
  const receivedPct = total > 0 ? Math.round((received / total) * 100) : 0;
  const ticketContrato = fin?.ticketMedio ?? 0;
  const activeContracts = fin?.activeContracts ?? 0;
  const ltv = fin?.ltv ?? 0;
  const ltvCac = eff?.cac ? Math.round((ltv / eff.cac) * 10) / 10 : null;
  const inadimplencia = fin?.inadimplencyRate ?? 0;

  const financeCards = [
    { label: "Faturamento do mês", value: money(total), hint: "recebido + pendente", badge: `${money(received)} recebido`, icon: DollarSign },
    { label: "Já recebido", value: money(received), hint: plural(fin?.receivedCount ?? 0, "pagamento", "pagamentos"), badge: `${receivedPct}% do total`, icon: ArrowUpRight },
    { label: "Contratos ativos", value: fmtNum(activeContracts), hint: "clientes pagantes", badge: `ticket ${money(ticketContrato)}/mês`, icon: Activity },
    { label: "Pendente", value: money(pending), hint: plural(fin?.pendingCount ?? 0, "cobrança", "cobranças"), badge: "a receber este mês", icon: Clock },
  ];
  const retention = [
    { label: "LTV estimado", value: ltv > 0 ? money(ltv) : "—", hint: "por cliente (~8 meses)", badge: "ticket dos contratos × 8", icon: TrendingUp, accent: true },
    { label: "LTV / CAC", value: ltvCac ? `${ltvCac.toLocaleString("pt-BR")}x` : "—", hint: "retorno por real investido",
      badge: ltvCac ? (ltvCac >= 3 ? "acima da meta (>3x)" : "abaixo da meta (>3x)") : "precisa do CAC do período", icon: Sparkles },
    { label: "Inadimplência", value: `${inadimplencia.toFixed(1).replace(".", ",")}%`, hint: "vencido ÷ (recebido no mês + vencido)",
      badge: inadimplencia < 5 ? "Saudável" : "Atenção", icon: Activity },
    { label: "Em atraso", value: money(overdue), hint: plural(fin?.overdueCount ?? 0, "cobrança vencida", "cobranças vencidas"),
      badge: overdue > 0 ? "ação necessária" : "Tudo em dia", icon: ArrowDownRight },
  ];

  const dateInput = "px-2.5 py-1.5 rounded-xl bg-muted/50 border border-border text-foreground [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-glow pointer-events-none" />
      <div className="relative p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-in">
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
                <button onClick={load} disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:bg-muted/50 transition-all disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Atualizar</span>
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1 capitalize">Hoje, {today}</p>
            </div>
            <span className={`self-start md:self-auto text-xs px-3 py-1.5 rounded-full border font-medium ${error ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-success/10 text-success border-success/20"}`}>
              ● {loading ? "Carregando..." : error ? "Erro ao carregar" : `Período: ${periodLabel}`}
            </span>
          </div>

          {/* Filtro de período: vale para todos os blocos, menos Financeiro/Retenção (Asaas, mês atual) */}
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => choosePreset(p.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${preset === p.key ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
                {p.label}
              </button>
            ))}
            {preset === "custom" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="date" value={range[0]} max={todayBR()} onChange={(e) => setCustom(0, e.target.value)} className={dateInput} />
                até
                <input type="date" value={range[1]} max={todayBR()} onChange={(e) => setCustom(1, e.target.value)} className={dateInput} />
              </div>
            )}
          </div>
        </header>

        {loading && !data ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : error && !data ? (
          <div className="surface-card p-6 text-sm text-destructive">{error}</div>
        ) : cur && (
          <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
            {error && <div className="surface-card p-4 mb-6 text-sm text-destructive">{error}</div>}

            <section className="mb-10">
              <SectionTitle note={`comparado a ${ddmm(data.previousPeriod.from)}–${ddmm(data.previousPeriod.to)}`}>Aquisição</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {acquisition.map((m) => <MetricCard key={m.label} {...m} />)}
              </div>
              {meta?.error && <p className="text-xs text-destructive mt-3">{meta.error}</p>}
              {daily.length > 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <DailyBars title="Leads por dia" total={fmtNum(cur.leads.count)} data={leadSeries} format={fmtNum} />
                  {mCur ? (
                    <DailyBars title="Investimento Meta por dia" total={money(mCur.spend)} data={spendSeries} format={(v) => (hideValues ? MASK : fmt(v))} />
                  ) : (
                    <div className="surface-card p-5 flex flex-col items-center justify-center text-center gap-3">
                      <p className="text-sm text-muted-foreground">Conecte o Meta Ads para ver o investimento por dia ao lado dos leads.</p>
                      <button onClick={goIntegrations} className="px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl">Ir para Integrações</button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="mb-10">
              <SectionTitle>Funil de conversão no período</SectionTitle>
              <div className="surface-card p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  {steps.map((s, i) => {
                    const before = i > 0 ? steps[i - 1].value : 0;
                    const rate = before > 0 ? Math.round((s.value / before) * 1000) / 10 : null;
                    return (
                      <div key={s.label}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                          {i > 0 && <span className="text-xs text-muted-foreground shrink-0">{fmtPct(rate)} da anterior</span>}
                        </div>
                        <p className="text-2xl font-bold text-foreground mt-1">{fmtNum(s.value)}</p>
                        <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
                          <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${s.value > 0 ? Math.max((s.value / stepMax) * 100, 2) : 0}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border text-xs">
                  <span className={chip}>
                    Comparecimento <span className="text-foreground font-medium">{fmtPct(cur.meetings.showRate)}</span>
                    {" "}({cur.meetings.completed} realizadas · {cur.meetings.noShow} faltaram)
                  </span>
                  {cur.meetings.cancelled > 0 && <span className={chip}>{plural(cur.meetings.cancelled, "cancelada", "canceladas")}</span>}
                  <span className={chip}>Custo por reunião <span className="text-foreground font-medium">{money(eff?.costPerMeeting)}</span></span>
                  <span className={chip}>Lead → agendar <span className="text-foreground font-medium">{fmtDays(cur.times.leadToMeetingDays)}</span></span>
                  <span className={chip}>Lead → venda <span className="text-foreground font-medium">{fmtDays(cur.times.leadToSaleDays)}</span></span>
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-2">Tempos em mediana. Reuniões de contatos com a tag “teste” ficam de fora.</p>
              </div>
            </section>

            {pipe && (
              <section className="mb-10">
                <div className="flex items-baseline justify-between gap-2">
                  <SectionTitle note={`${fmtNum(g.novo?.count ?? 0)} em Novo Lead · ${money(pipe.open.value)} em aberto`}>{`Pipeline agora: ${pipe.name}`}</SectionTitle>
                  <button onClick={() => router.push("/dashboard/funil")} className="text-xs text-primary hover:underline mb-4 shrink-0">Abrir funil →</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {pipelineCards.map((m) => <MetricCard key={m.label} {...m} />)}
                </div>
              </section>
            )}

            <section className="mb-10">
              <SectionTitle>Vendas no período</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {salesCards.map((m) => <MetricCard key={m.label} {...m} />)}
              </div>
              <div className="surface-card p-5 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Megaphone className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Vendas por origem</h3>
                </div>
                {cur.sales.byOrigin.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma venda fechada no período. Ao arrastar um card para a etapa de ganho, ela aparece aqui.</p>
                ) : (
                  <div className="space-y-2.5">
                    {cur.sales.byOrigin.map((o: { origin: string; count: number; value: number }) => {
                      const p = cur.sales.value > 0 ? Math.round((o.value / cur.sales.value) * 100) : 0;
                      return (
                        <div key={o.origin}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-foreground">{ORIGIN_LABELS[o.origin] ?? o.origin}</span>
                            <span className="text-muted-foreground">
                              {plural(o.count, "venda", "vendas")} · <span className="text-foreground font-medium">{money(o.value)}</span> · {p}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${Math.max(p, 2)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="mb-10">
              <SectionTitle note="mês atual, pelo Asaas (não segue o filtro)">Financeiro: contratos e cobranças</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {financeCards.map((m) => <MetricCard key={m.label} {...m} />)}
              </div>
            </section>

            <section className="mb-4">
              <SectionTitle note="Asaas + contratos do CRM; LTV/CAC usa o CAC do período">Retenção e valor do cliente</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {retention.map((m) => <MetricCard key={m.label} {...m} />)}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
