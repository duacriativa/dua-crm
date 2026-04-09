"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  Filter,
  Megaphone,
  Bot,
  Settings,
  ChevronDown,
  ChevronsRight,
  Bell,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Zap,
  RefreshCw,
  Calendar,
  MoreHorizontal,
  Phone,
  Instagram,
  CheckCircle2,
  AlertCircle,
  Search,
  Package,
  ArrowUpRight,
  Wifi,
  WifiOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  icon: React.ElementType;
  label: string;
  badge?: number;
  href: string;
};

type KpiCard = {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
};

type Lead = {
  name: string;
  handle: string;
  channel: "whatsapp" | "instagram";
  status: "open" | "in_progress" | "resolved";
  lastMessage: string;
  time: string;
  agent?: string;
};

type AIAgent = {
  name: string;
  description: string;
  status: "active" | "online" | "paused";
  icon: React.ElementType;
};

type TopProduct = {
  name: string;
  ref: string;
  units: number;
  emoji: string;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",   href: "/dashboard" },
  { icon: MessageCircle,   label: "Conversas",   href: "/conversas", badge: 12 },
  { icon: Users,           label: "Contatos",    href: "/contatos" },
  { icon: Filter,          label: "Funil",       href: "/funil", badge: 8 },
  { icon: Megaphone,       label: "Campanhas",   href: "/campanhas" },
  { icon: Bot,             label: "Bots",        href: "/bots" },
  { icon: Settings,        label: "Configurações", href: "/configuracoes" },
];

const kpis: KpiCard[] = [
  {
    label: "Vendas/mês",
    value: "R$ 284k",
    change: 42,
    icon: ShoppingBag,
    iconBg: "bg-brand-50",
    iconColor: "text-brand-600",
  },
  {
    label: "Conversas IA",
    value: "3.847",
    change: 128,
    icon: MessageCircle,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    label: "Conversão",
    value: "34%",
    change: 18,
    icon: TrendingUp,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    label: "Ticket Médio",
    value: "R$ 890",
    change: 12,
    icon: Zap,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
];

const recentLeads: Lead[] = [
  {
    name: "Amiche®",
    handle: "@amiche",
    channel: "instagram",
    status: "open",
    lastMessage: "Olá! Vi vocês no Instagram e quero saber mais sobre os planos",
    time: "2 min",
  },
  {
    name: "Luiza Modas",
    handle: "+55 11 99999-0001",
    channel: "whatsapp",
    status: "in_progress",
    lastMessage: "Ta vou analisar com meu esposo",
    time: "18 min",
    agent: "Duda",
  },
  {
    name: "Over Limit Fitness",
    handle: "+55 11 99999-0002",
    channel: "whatsapp",
    status: "in_progress",
    lastMessage: "Salesbot: Tem mais algu...",
    time: "1h",
  },
  {
    name: "Cris Alves",
    handle: "+55 11 99999-0003",
    channel: "whatsapp",
    status: "open",
    lastMessage: "Salesbot: No dia 24/04...",
    time: "2h",
  },
  {
    name: "Dani Botelho",
    handle: "+55 11 99999-0004",
    channel: "whatsapp",
    status: "resolved",
    lastMessage: "Perfeito, estou à disposi...",
    time: "4h",
    agent: "Duda",
  },
];

const aiAgents: AIAgent[] = [
  { name: "Atendimento",  description: "12 conversas ativas",  status: "active", icon: MessageCircle },
  { name: "Qualificação", description: "8 leads na fila",      status: "online", icon: Users },
  { name: "Reativação",   description: "23 clientes inativos", status: "active", icon: RefreshCw },
  { name: "Follow-up",    description: "47 tarefas hoje",      status: "paused", icon: Calendar },
];

const topProducts: TopProduct[] = [
  { name: "Conjunto Verão",  ref: "CV-2024", units: 847, emoji: "👗" },
  { name: "Blusa Cropped",   ref: "BC-1122", units: 623, emoji: "👕" },
  { name: "Calça Pantalona", ref: "CP-0987", units: 412, emoji: "👖" },
  { name: "Vestido Linho",   ref: "VL-0456", units: 298, emoji: "👘" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s: Lead["status"]) {
  if (s === "open")        return { label: "Aberta",       cls: "bg-amber-100 text-amber-700" };
  if (s === "in_progress") return { label: "Em andamento", cls: "bg-blue-100 text-blue-700" };
  return                          { label: "Resolvida",    cls: "bg-emerald-100 text-emerald-700" };
}

function agentStatusConfig(s: AIAgent["status"]) {
  if (s === "active") return { label: "Ativo",   cls: "bg-brand-100 text-brand-700",    dot: "bg-brand-500" };
  if (s === "online") return { label: "Online",  cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" };
  return                     { label: "Pausado", cls: "bg-gray-100 text-gray-500",       dot: "bg-gray-400" };
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ open, setOpen, selected, setSelected }: {
  open: boolean;
  setOpen: (v: boolean) => void;
  selected: string;
  setSelected: (v: string) => void;
}) {
  return (
    <nav
      className={`relative flex flex-col shrink-0 h-screen transition-all duration-300 ease-in-out
        ${open ? "w-60" : "w-16"}
        bg-brand-600 text-white`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-brand-500/40`}>
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 shrink-0">
          <span className="text-white font-bold text-lg leading-none">D</span>
        </div>
        {open && (
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">Dua CRM</p>
            <p className="text-xs text-brand-200 truncate">Plano Crescimento</p>
          </div>
        )}
        {open && <ChevronDown className="ml-auto h-4 w-4 text-brand-300 shrink-0" />}
      </div>

      {/* Nav */}
      <div className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, badge, href }) => {
          const active = selected === label;
          return (
            <button
              key={label}
              onClick={() => setSelected(label)}
              className={`relative flex items-center gap-3 w-full h-10 px-2.5 rounded-lg transition-all duration-150
                ${active
                  ? "bg-white/20 text-white"
                  : "text-brand-200 hover:bg-white/10 hover:text-white"
                }`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {open && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
              {badge && open && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 text-xs font-semibold px-1">
                  {badge}
                </span>
              )}
              {badge && !open && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* WhatsApp status */}
      {open && (
        <div className="mx-3 mb-3 p-3 rounded-lg bg-white/10 border border-white/10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-emerald-400 flex items-center justify-center">
                <Phone className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-300 border-2 border-brand-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">WhatsApp</p>
              <p className="text-xs text-brand-200">Conectado via QR</p>
            </div>
            <Wifi className="ml-auto h-3.5 w-3.5 text-emerald-300 shrink-0" />
          </div>
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-3 border-t border-brand-500/40 text-brand-200 hover:text-white hover:bg-white/5 transition-colors"
      >
        <ChevronsRight
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
        {open && <span className="text-xs">Recolher</span>}
      </button>
    </nav>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ card }: { card: KpiCard }) {
  const { icon: Icon, label, value, change, iconBg, iconColor } = card;
  const positive = change >= 0;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full
          ${positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? "+" : ""}{change}%
        </div>
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ─── AI Agent Row ─────────────────────────────────────────────────────────────

function AgentRow({ agent }: { agent: AIAgent }) {
  const { icon: Icon, name, description, status } = agent;
  const cfg = agentStatusConfig(status);
  return (
    <div className="flex items-center gap-3 py-3 px-1">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 shrink-0">
        <Icon className="h-4 w-4 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
        <p className="text-xs text-gray-400 truncate">{description}</p>
      </div>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </div>
    </div>
  );
}

// ─── Lead Row ─────────────────────────────────────────────────────────────────

function LeadRow({ lead }: { lead: Lead }) {
  const st = statusLabel(lead.status);
  return (
    <div className="flex items-start gap-3 py-3 px-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shrink-0 text-white text-sm font-bold">
        {lead.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-800 truncate">{lead.name}</p>
          {lead.channel === "whatsapp"
            ? <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
            : <Instagram className="h-3 w-3 text-pink-500 shrink-0" />}
        </div>
        <p className="text-xs text-gray-400 truncate">{lead.lastMessage}</p>
        {lead.agent && (
          <p className="text-xs text-brand-500 mt-0.5">→ {lead.agent}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-xs text-gray-400">{lead.time}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
      </div>
    </div>
  );
}

// ─── Main Dashboard Content ───────────────────────────────────────────────────

function DashboardContent() {
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
              <input
                type="text"
                placeholder="Buscar leads..."
                className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 w-48"
              />
            </div>
            <button className="relative p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold">
              D
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => <KpiCard key={kpi.label} card={kpi} />)}
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversas recentes */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-800">Conversas recentes</h2>
              <button className="flex items-center gap-1 text-xs text-brand-600 font-semibold hover:text-brand-700">
                Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-3 py-1 divide-y divide-gray-50">
              {recentLeads.map((lead) => (
                <LeadRow key={lead.name} lead={lead} />
              ))}
            </div>
          </div>

          {/* Agentes de IA */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-800">Agentes de IA</h2>
              <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 divide-y divide-gray-50">
              {aiAgents.map((agent) => (
                <AgentRow key={agent.name} agent={agent} />
              ))}
            </div>

            {/* IA respondendo */}
            <div className="mx-4 mb-4 mt-3 p-3.5 rounded-xl bg-brand-50 border border-brand-100">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-brand-700">IA respondendo agora</p>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: "Qualificação", pct: 92 },
                  { label: "Reativação",   pct: 78 },
                  { label: "Follow-up",    pct: 54 },
                ].map(({ label, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-brand-600 mb-0.5">
                      <span>{label}</span><span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mais vendidos */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-800">Mais vendidos</h2>
              </div>
              <button className="flex items-center gap-1 text-xs text-brand-600 font-semibold hover:text-brand-700">
                Ver catálogo <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.ref} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-lg shrink-0">
                    {p.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">REF: {p.ref}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-600">{p.units.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-gray-400">unidades</p>
                  </div>
                  {i === 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold shrink-0">
                      #1
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Funil de qualificação + status */}
          <div className="space-y-4">
            {/* Funil */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Funil de vendas</h2>
              <div className="space-y-2">
                {[
                  { stage: "Novos leads",     count: 346, pct: 100, color: "bg-gray-200" },
                  { stage: "Qualificando",    count: 184, pct: 53,  color: "bg-brand-200" },
                  { stage: "Proposta enviada", count: 67, pct: 19,  color: "bg-brand-400" },
                  { stage: "Fechado",          count: 23, pct: 7,   color: "bg-brand-600" },
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

            {/* Integrações */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Integrações</h2>
              <div className="space-y-2.5">
                {[
                  { name: "WhatsApp Business", status: true,  info: "Conectado via QR",   icon: Phone },
                  { name: "Instagram",          status: true,  info: "Página vinculada",    icon: Instagram },
                  { name: "Nuvemshop",          status: false, info: "Não configurado",     icon: Package },
                ].map(({ name, status, info, icon: Icon }) => (
                  <div key={name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status ? "bg-emerald-50" : "bg-gray-50"}`}>
                      <Icon className={`h-4 w-4 ${status ? "text-emerald-600" : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{name}</p>
                      <p className="text-xs text-gray-400">{info}</p>
                    </div>
                    {status
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <AlertCircle className="h-4 w-4 text-gray-300 shrink-0" />
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────

export function CRMDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selected, setSelected] = useState("Dashboard");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        selected={selected}
        setSelected={setSelected}
      />
      <DashboardContent />
    </div>
  );
}

export default CRMDashboard;
