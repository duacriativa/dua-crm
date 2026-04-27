"use client";

import React, { useEffect, useState } from "react";
import {
  MessageCircle, Users, Bot, Bell, TrendingUp, TrendingDown,
  ShoppingBag, Zap, RefreshCw, Calendar, MoreHorizontal, Phone,
  Instagram, CheckCircle2, AlertCircle, Search, Package,
  ArrowUpRight, DollarSign, Star, Activity, UserCheck,
} from "lucide-react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

function fmt(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val ?? 0);
}

type Lead = {
  name: string; handle: string; channel: "whatsapp" | "instagram";
  status: "open" | "in_progress" | "resolved"; lastMessage: string; time: string; agent?: string;
};
type AIAgent = {
  name: string; description: string; status: "active" | "online" | "paused"; icon: React.ElementType;
};

const recentLeads: Lead[] = [
  { name: "Amiche®", handle: "@amiche", channel: "instagram", status: "open", lastMessage: "Olá! Vi vocês no Instagram e quero saber mais sobre os planos", time: "2 min" },
  { name: "Luiza Modas", handle: "+55 85 99999-0001", channel: "whatsapp", status: "in_progress", lastMessage: "Ta vou analisar com meu esposo", time: "18 min", agent: "Duda" },
  { name: "Over Limit Fitness", handle: "+55 85 99999-0002", channel: "whatsapp", status: "in_progress", lastMessage: "Salesbot: Tem mais algu...", time: "1h" },
  { name: "Cris Alves", handle: "+55 85 99999-0003", channel: "whatsapp", status: "open", lastMessage: "Salesbot: No dia 24/04...", time: "2h" },
  { name: "Dani Botelho", handle: "+55 85 99999-0004", channel: "whatsapp", status: "resolved", lastMessage: "Perfeito, estou à disposi...", time: "4h", agent: "Duda" },
];

const aiAgents: AIAgent[] = [
  { name: "Atendimento", description: "12 conversas ativas", status: "active", icon: MessageCircle },
  { name: "Qualificação", description: "8 leads na fila", status: "online", icon: UserCheck },
  { name: "Reativação", description: "23 clientes inativos", status: "active", icon: RefreshCw },
  { name: "Follow-up", description: "47 tarefas hoje", status: "paused", icon: Calendar },
];

const statusMap = {
  open: { label: "Aberta", cls: "bg-amber-50 text-amber-700" },
  in_progress: { label: "Em andamento", cls: "bg-brand-50 text-brand-700" },
  resolved: { label: "Resolvida", cls: "bg-emerald-50 text-emerald-700" },
};
const agentStatusMap = {
  active: { dot: "bg-brand-500", label: "Ativo" },
  online: { dot: "bg-emerald-500", label: "Online" },
  paused: { dot: "bg-gray-300", label: "Pausado" },
};

function LeadRow({ lead }: { lead: Lead }) {
  const s = statusMap[lead.status];
  return (
    <div className="flex items-start gap-3 py-3 px-2 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${lead.channel === "instagram" ? "bg-pink-100 text-pink-600" : "bg-emerald-100 text-emerald-600"}`}>
        {lead.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-800 truncate">{lead.name}</p>
          {lead.channel === "instagram" ? <Instagram className="h-3 w-3 text-pink-400 shrink-0" /> : <Phone className="h-3 w-3 text-emerald-400 shrink-0" />}
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">{lead.lastMessage}</p>
        {lead.agent && <p className="text-xs text-brand-500 mt-0.5">→ {lead.agent}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-gray-400">{lead.time}</p>
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${s.cls}`}>{s.label}</span>
      </div>
    </div>
  );
}

function AgentRow({ agent }: { agent: AIAgent }) {
  const s = agentStatusMap[agent.status];
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
        <agent.icon className="h-4 w-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{agent.name}</p>
        <p className="text-xs text-gray-400">{agent.description}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className={`w-2 h-2 rounded-full ${s.dot}`} />
        <span className="text-xs text-gray-500">{s.label}</span>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, badge, badgeGreen, highlight }: {
  label: string; value: string; sub: string; badge?: string; badgeGreen?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 ${highlight ? "border-teal-200 bg-teal-50/30" : "border-gray-100"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${highlight ? "text-teal-700" : "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      {badge && (
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-2 ${badgeGreen ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Dashboard Content ────────────────────────────────────────────────────────
function DashboardContent() {
  const router = useRouter();
  const [financial, setFinancial] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/financial/dashboard").catch(() => null),
      api.get("/contacts/stats").catch(() => null),
    ]).then(([fin, st]) => {
      if (fin?.data) setFinancial(fin.data);
      if (st?.data) setStats(st.data);
    }).finally(() => setLoading(false));
  }, []);

  const ticketMedio = financial?.ticketMedio ?? 0;
  const ltv = financial?.ltv ?? 0;
  const cac = financial?.cac ?? 0;
  const ltvCac = financial?.ltvCacRatio ?? 0;
  const received = financial?.received ?? 0;
  const pending = financial?.pending ?? 0;
  const overdue = financial?.overdue ?? 0;
  const inadimplencia = financial?.inadimplencyRate ?? 0;
  const activeContracts = financial?.activeContracts ?? 0;
  const totalLeads = stats?.total ?? 0;
  const ultraLeads = stats?.ultra ?? 0;
  const qualifiedLeads = stats?.qualified ?? 0;
  const coldLeads = stats?.cold ?? 0;

  return (
    <div className="flex-1 min-h-screen bg-gray-50 overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">Hoje, {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Buscar leads..." className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 w-48" />
            </div>
            <button className="relative p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold">D</div>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">

        {/* ── Bloco 1: Aquisição de leads ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Aquisição de leads</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Leads recebidos" value={loading ? "..." : String(totalLeads)} sub="total na base" badge="este mês" badgeGreen />
            <MetricCard label="Leads ultra qualificados" value={loading ? "..." : String(ultraLeads)} sub="dentro do ICP" badge={totalLeads ? `${Math.round((ultraLeads/totalLeads)*100)}% dos leads` : "tag ICP"} highlight />
            <MetricCard label="Leads qualificados" value={loading ? "..." : String(qualifiedLeads)} sub="potencial médio" badge={totalLeads ? `${Math.round((qualifiedLeads/totalLeads)*100)}% dos leads` : "—"} badgeGreen={qualifiedLeads > 0} />
            <MetricCard label="Leads frios" value={loading ? "..." : String(coldLeads)} sub="pouco qualificados" badge={totalLeads ? `${Math.round((coldLeads/totalLeads)*100)}% dos leads` : "—"} />
          </div>
        </div>

        {/* ── Bloco 2: Vendas e conversão ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Vendas e conversão</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Faturamento do mês"
              value={loading ? "..." : fmt(received + pending)}
              sub="contratado em abril"
              badge={loading ? "" : `${fmt(received)} recebido`}
              badgeGreen
            />
            <MetricCard
              label="Já recebido"
              value={loading ? "..." : fmt(received)}
              sub={`${financial?.receivedCount ?? 0} pagamentos`}
              badge={loading ? "" : `${Math.round((received / (received + pending + overdue || 1)) * 100)}% do total`}
              badgeGreen
            />
            <MetricCard
              label="Ticket médio"
              value={loading ? "..." : fmt(ticketMedio)}
              sub="por cliente/mês"
              badge={activeContracts ? `${activeContracts} contratos ativos` : undefined}
              badgeGreen
            />
            <MetricCard
              label="CAC"
              value={loading ? "..." : fmt(cac)}
              sub="custo de aquisição"
              badge={cac ? "R$1.200 ads ÷ novos clientes" : "sem clientes novos"}
            />
          </div>
        </div>

        {/* ── Bloco 3: Retenção e valor ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Retenção e valor do cliente</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="LTV estimado" value={loading ? "..." : fmt(ltv)} sub="por cliente (~8 meses)" badge="ticket × retenção" badgeGreen={ltv > 0} />
            <MetricCard label="LTV / CAC" value={loading ? "..." : `${ltvCac}x`} sub="retorno por real investido" badge={ltvCac >= 3 ? "Saudável (meta: >3x)" : "Atenção"} badgeGreen={ltvCac >= 3} />
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">Inadimplência</p>
              <p className={`text-2xl font-bold ${inadimplencia > 15 ? "text-red-600" : "text-emerald-700"}`}>
                {loading ? "..." : `${Math.round(inadimplencia)}%`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">cobranças vencidas</p>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${inadimplencia > 15 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(inadimplencia, 100)}%` }} />
              </div>
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-2 ${inadimplencia <= 15 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {inadimplencia <= 15 ? "Saudável" : "Acima da meta"}
              </span>
            </div>
            <MetricCard
              label="Em atraso"
              value={loading ? "..." : fmt(overdue)}
              sub={`${financial?.overdueCount ?? 0} cobranças vencidas`}
              badge={overdue > 0 ? "ação necessária" : "tudo em dia"}
              badgeGreen={overdue === 0}
            />
          </div>
        </div>

        {/* ── Linha do meio: Conversas + Agentes ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-800">Conversas recentes</h2>
              <button onClick={() => router.push("/dashboard/conversas")} className="flex items-center gap-1 text-xs text-brand-600 font-semibold hover:text-brand-700">
                Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-3 py-1 divide-y divide-gray-50">
              {recentLeads.map((lead) => <LeadRow key={lead.name} lead={lead} />)}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-800">Agentes de IA</h2>
              <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 divide-y divide-gray-50">
              {aiAgents.map((agent) => <AgentRow key={agent.name} agent={agent} />)}
            </div>
            <div className="mx-4 mb-4 mt-3 p-3.5 rounded-xl bg-brand-50 border border-brand-100">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-brand-700">IA respondendo agora</p>
              </div>
              <div className="space-y-1.5">
                {[{ label: "Qualificação", pct: 92 }, { label: "Reativação", pct: 78 }, { label: "Follow-up", pct: 54 }].map(({ label, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-brand-600 mb-0.5"><span>{label}</span><span>{pct}%</span></div>
                    <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Linha inferior: Funil + Integrações ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Funil de vendas</h2>
            <div className="space-y-2">
              {[
                { stage: "Novos leads", count: totalLeads, pct: 100, color: "bg-gray-200" },
                { stage: "Qualificando", count: qualifiedLeads + ultraLeads, pct: totalLeads ? Math.round(((qualifiedLeads + ultraLeads) / totalLeads) * 100) : 0, color: "bg-brand-200" },
                { stage: "Ultra qualificados (ICP)", count: ultraLeads, pct: totalLeads ? Math.round((ultraLeads / totalLeads) * 100) : 0, color: "bg-brand-400" },
                { stage: "Fechado", count: activeContracts, pct: totalLeads ? Math.round((activeContracts / totalLeads) * 100) : 0, color: "bg-brand-600" },
              ].map(({ stage, count, pct, color }) => (
                <div key={stage}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="font-medium">{stage}</span>
                    <span className="font-semibold text-gray-700">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Integrações ativas</h2>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
                  <Phone className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-800">WhatsApp Business</p>
                  <p className="text-xs text-emerald-600">Conectado via QR · Evolution API v1.8.7</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">Asaas</p>
                  <p className="text-xs text-gray-500">Financeiro em tempo real</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              </div>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs font-medium text-blue-700 mb-1">Canais de entrada de leads</p>
              <p className="text-xs text-blue-600">Landing page duacriativa.com/trafegopago → CRM automaticamente</p>
              <p className="text-xs text-blue-600 mt-0.5">WhatsApp direto → inbox de conversas</p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export function CRMDashboard() { return <DashboardContent />; }
export default CRMDashboard;
