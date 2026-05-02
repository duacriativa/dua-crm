"use client";

import { TrendingUp, Users, DollarSign, Activity, ArrowUpRight, ArrowDownRight, MessageSquare, Sparkles, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type Metric = {
  label: string; value: string; hint: string; badge: string;
  trend?: "up" | "down" | "neutral"; icon: any; accent?: boolean;
};

const acquisition: Metric[] = [
  { label: "Leads recebidos",          value: "151",        hint: "total na base",        badge: "este mês",        icon: Users,       trend: "up"      },
  { label: "Leads ultra qualificados", value: "0",          hint: "dentro do ICP",        badge: "0% dos leads",    icon: Sparkles,    trend: "neutral", accent: true },
  { label: "Leads qualificados",       value: "0",          hint: "potencial médio",      badge: "0% dos leads",    icon: Activity,    trend: "neutral" },
  { label: "Leads frios",              value: "132",        hint: "pouco qualificados",   badge: "87% dos leads",   icon: TrendingUp,  trend: "down"    },
];
const sales: Metric[] = [
  { label: "Faturamento do mês", value: "R$ 49.259", hint: "contratado em abril",   badge: "R$ 40.959 recebido", icon: DollarSign,    trend: "up"     },
  { label: "Já recebido",        value: "R$ 40.959", hint: "22 pagamentos",         badge: "81% do total",       icon: ArrowUpRight,  trend: "up"     },
  { label: "Ticket médio",       value: "R$ 2.007",  hint: "por cliente/mês",       badge: "24 contratos ativos",icon: TrendingUp,    trend: "up"     },
  { label: "CAC",                value: "R$ 240",    hint: "custo de aquisição",    badge: "R$ 1.200 ads ÷ novos",icon: Users,        trend: "neutral"},
];
const retention: Metric[] = [
  { label: "LTV estimado",  value: "R$ 16.058", hint: "por cliente (~8 meses)",     badge: "ticket × retenção",  icon: TrendingUp,    trend: "up",      accent: true },
  { label: "LTV / CAC",     value: "66.9x",     hint: "retorno por real investido", badge: "Saudável (meta: >3x)",icon: Sparkles,     trend: "up"       },
  { label: "Inadimplência", value: "2%",        hint: "cobranças vencidas",         badge: "Saudável",            icon: Activity,     trend: "neutral"  },
  { label: "Em atraso",     value: "R$ 1.000",  hint: "1 cobrança vencida",         badge: "ação necessária",     icon: ArrowDownRight,trend: "down"    },
];

function MetricCard({ m, hide }: { m: Metric; hide?: boolean }) {
  const Icon = m.icon;
  const trendColor = m.trend === "up" ? "text-success" : m.trend === "down" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className={`relative overflow-hidden surface-card p-5 transition-all hover:shadow-elegant hover:-translate-y-0.5 ${m.accent ? "ring-1 ring-primary/40" : ""}`}>
      {m.accent && <div className="absolute inset-0 bg-gradient-glow opacity-50 pointer-events-none" />}
      <div className="relative flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
          <div className={`h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center ${trendColor}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="text-3xl font-bold tracking-tight text-foreground">{hide ? "•••" : m.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{m.hint}</p>
        </div>
        <span className="self-start text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground border border-border font-normal">
          {hide ? "•••" : m.badge}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">{children}</h2>;
}

const recentConvos = [
  { name: "Tchu.bi + Dua 💜", msg: "Valor correto 85,00 camisa gio", time: "17:33", unread: 2 },
  { name: "AYA - mkt dua",    msg: "Próxima reunião confirmada",      time: "17:25", unread: 1 },
  { name: "Team Tráfego - Dua",msg: "Relatório semanal em anexo",    time: "17:16", unread: 0 },
  { name: "Doce Caju - ADS",  msg: "Campanha pausada para revisão",   time: "17:00", unread: 0 },
];

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const [hideValues, setHideValues] = useState(false);

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-glow pointer-events-none" />
      <div className="relative p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-in">
        <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
              <button
                onClick={() => setHideValues(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${hideValues ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                title={hideValues ? "Mostrar valores" : "Esconder valores"}>
                {hideValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{hideValues ? "Oculto" : "Ocultar"}</span>
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-1 capitalize">Hoje, {today}</p>
          </div>
          <span className="self-start text-xs px-3 py-1.5 rounded-full bg-success/10 text-success border border-success/20 font-medium">
            ● Tudo operando
          </span>
        </header>

        <section className="mb-10">
          <SectionTitle>Aquisição de leads</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {acquisition.map((m) => <MetricCard key={m.label} m={m} hide={hideValues} />)}
          </div>
        </section>

        <section className="mb-10">
          <SectionTitle>Vendas e conversão</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {sales.map((m) => <MetricCard key={m.label} m={m} hide={hideValues} />)}
          </div>
        </section>

        <section className="mb-10">
          <SectionTitle>Retenção e valor do cliente</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {retention.map((m) => <MetricCard key={m.label} m={m} hide={hideValues} />)}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Conversas recentes */}
          <div className="surface-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Conversas recentes</h3>
              </div>
              <button className="text-xs text-primary hover:underline">Ver todas →</button>
            </div>
            <div className="space-y-1">
              {recentConvos.map((c) => (
                <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer">
                  <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">
                    {c.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{c.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.msg}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Agentes IA */}
          <div className="surface-card p-6 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Agentes de IA</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Seus assistentes inteligentes prontos para ajudar.</p>
              <div className="space-y-2">
                {["Analista", "Copywriter", "Designer"].map((a) => (
                  <div key={a} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer">
                    <span className="text-sm font-medium text-foreground">{a}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">BETA</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">Uso este mês</p>
                <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full w-[42%] rounded-full bg-gradient-primary" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">42% do limite</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
