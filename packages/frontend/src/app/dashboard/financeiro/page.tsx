"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  TrendingUp, TrendingDown, AlertCircle,
  CheckCircle2, Clock, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

function fmt(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val ?? 0);
}

interface PendingClient {
  name: string;
  total: number;
  items: { dueDate: string; value: number; description?: string }[];
}

interface Summary {
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

export default function FinanceiroPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
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
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>Buscando dados do Asaas...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
        {error}
      </div>
      <button onClick={load} className="mt-3 text-sm text-brand-600 hover:underline">Tentar novamente</button>
    </div>
  );

  if (!data) return null;

  const monthLabel = (() => {
    if (!data.month) return "Este mês";
    const [y, m] = data.month.split("-");
    const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${months[parseInt(m) - 1]}/${y}`;
  })();

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{monthLabel} · dados em tempo real do Asaas</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground/80 border border-border rounded-lg px-3 py-1.5 transition-colors">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total contratado</p>
          <p className="text-2xl font-semibold text-foreground">{fmt(data.total)}</p>
          <p className="text-xs text-muted-foreground mt-1">{(data.receivedCount ?? 0) + (data.pendingCount ?? 0)} clientes</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Já recebido</p>
          <p className="text-2xl font-semibold text-green-600">{fmt(data.received)}</p>
          <div className="flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <p className="text-xs text-muted-foreground">{data.receivedCount ?? 0} pagamentos</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Pendente</p>
          <p className="text-2xl font-semibold text-amber-600">{fmt(data.pending)}</p>
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-amber-500" />
            <p className="text-xs text-muted-foreground">{data.pendingCount ?? 0} cobranças</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Em atraso</p>
          <p className="text-2xl font-semibold text-red-600">{fmt(data.overdue)}</p>
          <div className="flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3 text-red-500" />
            <p className="text-xs text-muted-foreground">{data.overdueCount ?? 0} cobranças</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Ticket médio</p>
          <p className="text-xl font-semibold text-foreground">{fmt(data.ticketMedio ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">por cliente/mês</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">LTV estimado</p>
          <p className="text-xl font-semibold text-foreground">{fmt(data.ltv ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">por cliente (~8 meses)</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">CAC</p>
          <p className="text-xl font-semibold text-foreground">{fmt(data.cac ?? 0)}</p>
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
                    <span className="text-sm font-semibold text-amber-600">{fmt(client.total)}</span>
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
                          <span className="font-medium">{fmt(item.value)}</span>
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
                <span className="text-sm font-semibold text-red-600">{fmt(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.commissions?.total ?? 0) > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Comissões do mês</p>
          <p className="text-xl font-semibold text-violet-600">{fmt(data.commissions.total)}</p>
          <p className="text-xs text-muted-foreground mt-1">ex: comissão Kommo — não incluso no faturamento principal</p>
        </div>
      )}
    </div>
  );
}
