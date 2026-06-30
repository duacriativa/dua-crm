"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { LoaderOne } from "@/components/ui/loader-one";
import {
  TrendingUp, TrendingDown, AlertCircle,
  CheckCircle2, Clock, RefreshCw, ChevronDown, ChevronUp,
  Users, BarChart3, Plus,
} from "lucide-react";

function fmt(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val ?? 0);
}

function monthLabel(month: string) {
  if (!month) return "Este mês";
  const [y, m] = month.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(m) - 1]}/${y}`;
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentYM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PendingClient {
  name: string;
  total: number;
  items: { dueDate: string; value: number; description?: string }[];
}

interface Dashboard {
  month: string;
  received: number;
  receivedCount: number;
  pending: number;
  pendingCount: number;
  overdue: number;
  overdueCount: number;
  total: number;
  inadimplencyRate: number;
  commissions: { total: number };
  pendingByClient: PendingClient[];
  paidItems: any[];
  overdueItems: any[];
  activeContracts?: number;
  ticketMedio?: number;
  ltv?: number;
  cac?: number;
  ltvCacRatio?: number;
}

interface ClientEntry {
  id: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  paidAt: string | null;
  dueDate: string;
  value: number;
}

interface ClientRow {
  contractId: string;
  clientName: string;
  serviceType: string;
  serviceLabel: string;
  monthlyValue: number;
  entry: ClientEntry | null;
}

interface ClientesData {
  month: string;
  totals: { contratado: number; recebido: number; pendente: number };
  byService: Record<string, { label: string; contratado: number; recebido: number; pendente: number }>;
  clients: ClientRow[];
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ hideValues }: { hideValues: boolean }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/financial/dashboard");
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><LoaderOne /></div>;
  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      <button onClick={load} className="mt-3 text-sm text-brand-600 hover:underline">Tentar novamente</button>
    </div>
  );
  if (!data) return null;

  const label = monthLabel(data.month);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label} · dados em tempo real do Asaas</p>
        <button onClick={load} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground/80 border border-border rounded-lg px-3 py-1.5 transition-colors">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total contratado", val: data.total, sub: `${(data.receivedCount ?? 0) + (data.pendingCount ?? 0)} clientes`, color: "text-foreground" },
          { label: "Já recebido", val: data.received, sub: `${data.receivedCount ?? 0} pagamentos`, color: "text-green-600", icon: <CheckCircle2 className="w-3 h-3 text-green-500" /> },
          { label: "Pendente", val: data.pending, sub: `${data.pendingCount ?? 0} cobranças`, color: "text-amber-600", icon: <Clock className="w-3 h-3 text-amber-500" /> },
          { label: "Em atraso", val: data.overdue, sub: `${data.overdueCount ?? 0} cobranças`, color: "text-red-600", icon: <AlertCircle className="w-3 h-3 text-red-500" /> },
        ].map((c) => (
          <div key={c.label} className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-2xl font-semibold ${c.color}`}>{hideValues ? "R$ •••" : fmt(c.val)}</p>
            <div className="flex items-center gap-1 mt-1">{c.icon}<p className="text-xs text-muted-foreground">{c.sub}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Ticket médio</p>
          <p className="text-xl font-semibold text-foreground">{hideValues ? "R$ •••" : fmt(data.ticketMedio ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">por cliente/mês</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">LTV estimado</p>
          <p className="text-xl font-semibold text-foreground">{hideValues ? "R$ •••" : fmt(data.ltv ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">por cliente (~8 meses)</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">CAC</p>
          <p className="text-xl font-semibold text-foreground">{hideValues ? "R$ •••" : fmt(data.cac ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">custo de aquisição</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">LTV / CAC</p>
          <p className="text-xl font-semibold text-foreground">{data.ltvCacRatio ?? 0}x</p>
          <div className="flex items-center gap-1 mt-1">
            {(data.ltvCacRatio ?? 0) >= 3
              ? <TrendingUp className="w-3 h-3 text-green-500" />
              : <TrendingDown className="w-3 h-3 text-red-500" />}
            <p className="text-xs text-muted-foreground">meta: acima de 3x</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-foreground/80">Taxa de inadimplência do mês</p>
          <span className={`text-sm font-semibold ${(data.inadimplencyRate ?? 0) > 20 ? "text-red-600" : (data.inadimplencyRate ?? 0) > 10 ? "text-amber-600" : "text-green-600"}`}>
            {Math.round(data.inadimplencyRate ?? 0)}%
          </span>
        </div>
        <div className="w-full bg-muted/40 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${(data.inadimplencyRate ?? 0) > 20 ? "bg-red-500" : (data.inadimplencyRate ?? 0) > 10 ? "bg-amber-400" : "bg-green-500"}`}
            style={{ width: `${Math.min(data.inadimplencyRate ?? 0, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Meta saudável: abaixo de 15%</p>
      </div>

      {(data.pendingByClient?.length ?? 0) > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Cobranças pendentes por cliente</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {data.pendingByClient.map((client, i) => (
              <div key={i}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                  onClick={() => setExpanded(expanded === client.name ? null : client.name)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-xs font-semibold text-amber-700">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.items.length} cobrança{client.items.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-600">{hideValues ? "R$ •••" : fmt(client.total)}</span>
                    {expanded === client.name ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {expanded === client.name && (
                  <div className="px-4 pb-3 bg-muted/20">
                    {client.items.map((item, j) => (
                      <div key={j} className="flex items-center justify-between py-1.5 text-xs text-muted-foreground">
                        <span>{item.description || "Cobrança"}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">vence {new Date(item.dueDate).toLocaleDateString("pt-BR")}</span>
                          <span className="font-medium">{hideValues ? "R$ •••" : fmt(item.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.overdueItems?.length ?? 0) > 0 && (
        <div className="bg-card rounded-xl border border-red-500/20 overflow-x-auto">
          <div className="px-4 py-3 border-b border-red-100 bg-red-50">
            <h2 className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Em atraso — ação necessária
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {data.overdueItems.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.customerName || item.customer}</p>
                  <p className="text-xs text-muted-foreground">{item.description || "Cobrança"} · venceu {new Date(item.dueDate).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className="text-sm font-semibold text-red-600">{hideValues ? "R$ •••" : fmt(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.commissions?.total ?? 0) > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Comissões do mês</p>
          <p className="text-xl font-semibold text-violet-600">{hideValues ? "R$ •••" : fmt(data.commissions.total)}</p>
          <p className="text-xs text-muted-foreground mt-1">ex: comissão Kommo — não incluso no faturamento principal</p>
        </div>
      )}
    </div>
  );
}

// ─── Clientes Tab ─────────────────────────────────────────────────────────────

const SERVICE_ORDER = ["SOCIAL_MEDIA", "PAID_TRAFFIC", "CRM_SETUP", "CONSULTING", "OTHER"];

function ClientesTab({ hideValues }: { hideValues: boolean }) {
  const [data, setData] = useState<ClientesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(currentYM());
  const [toggling, setToggling] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<ClientRow | null>(null);
  const [addDueDate, setAddDueDate] = useState("");
  const [addValue, setAddValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/financial/clientes?month=${m}`);
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const togglePay = async (client: ClientRow) => {
    if (!client.entry) return;
    const newPaid = client.entry.status !== "PAID";
    setToggling(client.entry.id);
    try {
      await api.patch(`/financial/entries/${client.entry.id}/pay`, { paid: newPaid });
      await load(month);
    } finally {
      setToggling(null);
    }
  };

  const createEntry = async () => {
    if (!addingFor || !addDueDate || !addValue) return;
    setSaving(true);
    try {
      await api.post("/financial/entries", {
        contractId: addingFor.contractId,
        value: parseFloat(addValue.replace(",", ".")),
        dueDate: addDueDate,
        description: "Mensalidade",
      });
      setAddingFor(null);
      setAddDueDate("");
      setAddValue("");
      await load(month);
    } finally {
      setSaving(false);
    }
  };

  const changeMonth = (dir: "prev" | "next") => {
    setMonth((m) => dir === "prev" ? prevMonth(m) : nextMonth(m));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><LoaderOne /></div>;
  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      <button onClick={() => load(month)} className="mt-3 text-sm text-brand-600 hover:underline">Tentar novamente</button>
    </div>
  );
  if (!data) return null;

  const serviceGroups = SERVICE_ORDER
    .filter((s) => data.byService[s])
    .map((s) => ({ key: s, ...data.byService[s] }));

  const clientsByService = (svcType: string) =>
    data.clients.filter((c) => c.serviceType === svcType);

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => changeMonth("prev")} className="text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border text-sm">‹</button>
          <span className="text-sm font-medium text-foreground min-w-[80px] text-center">{monthLabel(month)}</span>
          <button
            onClick={() => changeMonth("next")}
            disabled={month >= currentYM()}
            className="text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border text-sm disabled:opacity-30"
          >›</button>
        </div>
        <button onClick={() => load(month)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground/80 border border-border rounded-lg px-3 py-1.5 transition-colors">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Contratado</p>
          <p className="text-2xl font-semibold text-foreground">{hideValues ? "R$ •••" : fmt(data.totals.contratado)}</p>
          <p className="text-xs text-muted-foreground mt-1">{data.clients.length} clientes ativos</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Recebido</p>
          <p className="text-2xl font-semibold text-green-600">{hideValues ? "R$ •••" : fmt(data.totals.recebido)}</p>
          <p className="text-xs text-muted-foreground mt-1">{data.clients.filter((c) => c.entry?.status === "PAID").length} clientes</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Pendente</p>
          <p className="text-2xl font-semibold text-amber-600">{hideValues ? "R$ •••" : fmt(data.totals.pendente)}</p>
          <p className="text-xs text-muted-foreground mt-1">{data.clients.filter((c) => !c.entry || c.entry.status !== "PAID").length} clientes</p>
        </div>
      </div>

      {/* Service groups */}
      {serviceGroups.map((svc) => (
        <div key={svc.key} className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Service header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">{svc.label}</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">Contratado: <span className="font-medium text-foreground">{hideValues ? "R$ •••" : fmt(svc.contratado)}</span></span>
              <span className="text-green-600 font-medium">{hideValues ? "R$ •••" : fmt(svc.recebido)} recebido</span>
              {svc.pendente > 0 && <span className="text-amber-600 font-medium">{hideValues ? "R$ •••" : fmt(svc.pendente)} pendente</span>}
            </div>
          </div>

          {/* Client rows */}
          <div className="divide-y divide-border">
            {clientsByService(svc.key).map((client) => {
              const isPaid = client.entry?.status === "PAID";
              const hasEntry = !!client.entry;
              const isToggling = toggling === client.entry?.id;

              return (
                <div key={client.contractId} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center text-xs font-semibold text-violet-700">
                      {client.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{client.clientName}</p>
                      {client.entry?.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          vence {new Date(client.entry.dueDate).toLocaleDateString("pt-BR")}
                          {isPaid && client.entry.paidAt && ` · pago em ${new Date(client.entry.paidAt).toLocaleDateString("pt-BR")}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{hideValues ? "R$ •••" : fmt(client.monthlyValue)}</span>
                    {hasEntry ? (
                      <button
                        onClick={() => togglePay(client)}
                        disabled={isToggling}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                          isPaid
                            ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                        } disabled:opacity-50`}
                      >
                        {isToggling ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : isPaid ? (
                          <><CheckCircle2 className="w-3 h-3" /> Pago</>
                        ) : (
                          <><Clock className="w-3 h-3" /> Pendente</>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingFor(client);
                          setAddValue(String(client.monthlyValue));
                          const today = new Date();
                          setAddDueDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-violet-400 hover:text-violet-600 transition-all"
                      >
                        <Plus className="w-3 h-3" /> Lançar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {data.clients.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Nenhum cliente ativo encontrado. Cadastre contratos para ver o painel de clientes.
        </div>
      )}

      {/* Add entry modal */}
      {addingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-foreground mb-1">Lançar cobrança</h3>
            <p className="text-sm text-muted-foreground mb-4">{addingFor.clientName} · {addingFor.serviceLabel}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Valor (R$)</label>
                <input
                  type="number"
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Data de vencimento</label>
                <input
                  type="date"
                  value={addDueDate}
                  onChange={(e) => setAddDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setAddingFor(null)}
                className="flex-1 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/30 transition-colors"
              >Cancelar</button>
              <button
                onClick={createEntry}
                disabled={saving || !addValue || !addDueDate}
                className="flex-1 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors disabled:opacity-50"
              >{saving ? "Salvando..." : "Lançar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "clientes";

export default function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>("clientes");
  const [hideValues, setHideValues] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Financeiro</h1>
        </div>
        <button
          onClick={() => setHideValues((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
        >
          {hideValues ? "Mostrar valores" : "Ocultar valores"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: "clientes", label: "Clientes", icon: <Users className="w-4 h-4" /> },
          { key: "dashboard", label: "Métricas Asaas", icon: <BarChart3 className="w-4 h-4" /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === "clientes" ? <ClientesTab hideValues={hideValues} /> : <DashboardTab hideValues={hideValues} />}
    </div>
  );
}
