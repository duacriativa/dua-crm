"use client";

import { TrendingUp, Users, DollarSign, Activity, ArrowUpRight, ArrowDownRight, MessageSquare, Sparkles, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = "";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

function fmt(v: number) {
  return v >= 1000 ? `R$ ${v.toLocaleString("pt-BR")}` : `R$ ${v}`;
}

function MetricCard({ label, value, hint, badge, trend, icon: Icon, accent, hide }: {
  label: string; value: string; hint: string; badge: string;
  trend?: "up" | "down" | "neutral"; icon: any; accent?: boolean; hide?: boolean;
}) {
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className={`relative overflow-hidden surface-card p-5 transition-all hover:shadow-elegant hover:-translate-y-0.5 ${accent ? "ring-1 ring-primary/40" : ""}`}>
      {accent && <div className="absolute inset-0 bg-gradient-glow opacity-50 pointer-events-none" />}
      <div className="relative flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <div className={`h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center ${trendColor}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="text-3xl font-bold tracking-tight text-foreground">{hide ? "•••" : value}</p>
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
        <span className="self-start text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground border border-border font-normal">
          {hide ? "•••" : badge}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">{children}</h2>;
}

export default function DashboardPage() {
  const router = useRouter();
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const [hideValues, setHideValues] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fin, setFin] = useState<any>(null);
  const [contacts, setContacts] = useState<any>(null);
  const [convos, setConvos] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [finRes, contactsRes, convosRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/financial/dashboard`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/v1/contacts/stats`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/v1/conversations?limit=4&status=OPEN`, { headers: authHeaders() }),
      ]);
      if (finRes.ok) setFin(await finRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (convosRes.ok) {
        const d = await convosRes.json();
        setConvos(Array.isArray(d) ? d : d.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Métricas calculadas ──
  const totalLeads = contacts?.leads?.total ?? 0;
  const received = fin?.received ?? 0;
  const pending = fin?.pending ?? 0;
  const overdue = fin?.overdue ?? 0;
  const total = received + pending;
  const receivedPct = total > 0 ? Math.round((received / total) * 100) : 0;
  const ticketMedio = fin?.ticketMedio ?? 0;
  const activeContracts = fin?.activeContracts ?? 0;
  const ltv = fin?.ltv ?? 0;
  const ltvCac = fin?.ltvCacRatio ?? 0;
  const cac = fin?.cac ?? 0;
  const inadimplencia = fin?.inadimplencyRate ?? 0;

  const acquisition = [
    { label: "Leads recebidos",          value: String(totalLeads),           hint: "total na base",         badge: "acumulado",             icon: Users,        trend: "up" as const    },
    { label: "Leads ultra qualificados", value: "—",                          hint: "dentro do ICP",         badge: "em breve",              icon: Sparkles,     trend: "neutral" as const, accent: true },
    { label: "Contratos ativos",         value: String(activeContracts),      hint: "clientes pagantes",     badge: `ticket R$ ${ticketMedio.toLocaleString("pt-BR")}`, icon: Activity, trend: "up" as const },
    { label: "CAC",                      value: cac > 0 ? fmt(cac) : "—",    hint: "custo de aquisição",    badge: "ads ÷ novos clientes",  icon: TrendingUp,   trend: "neutral" as const },
  ];

  const sales = [
    { label: "Faturamento do mês",  value: fmt(total),      hint: "contratado + pendente",   badge: `${fmt(received)} recebido`,      icon: DollarSign,    trend: "up" as const    },
    { label: "Já recebido",         value: fmt(received),   hint: `${fin?.receivedCount ?? 0} pagamentos`, badge: `${receivedPct}% do total`, icon: ArrowUpRight, trend: "up" as const },
    { label: "Ticket médio",        value: ticketMedio > 0 ? fmt(ticketMedio) : "—", hint: "por cliente/mês", badge: `${activeContracts} contratos ativos`, icon: TrendingUp, trend: "up" as const },
    { label: "Pendente",            value: fmt(pending),    hint: `${fin?.pendingCount ?? 0} cobranças`,   badge: "a receber este mês",   icon: Activity,      trend: "neutral" as const },
  ];

  const retention = [
    { label: "LTV estimado",   value: ltv > 0 ? fmt(ltv) : "—",              hint: "por cliente (~8 meses)",      badge: "ticket × retenção",     icon: TrendingUp,    trend: "up" as const,      accent: true },
    { label: "LTV / CAC",      value: ltvCac > 0 ? `${ltvCac}x` : "—",       hint: "retorno por real investido",  badge: "Meta: >3x",             icon: Sparkles,      trend: ltvCac >= 3 ? "up" as const : "down" as const },
    { label: "Inadimplência",  value: `${inadimplencia.toFixed(1)}%`,         hint: "cobranças vencidas",          badge: inadimplencia < 5 ? "Saudável" : "Atenção", icon: Activity, trend: inadimplencia < 5 ? "neutral" as const : "down" as const },
    { label: "Em atraso",      value: overdue > 0 ? fmt(overdue) : "R$ 0",    hint: `${fin?.overdueCount ?? 0} cobranças vencidas`, badge: overdue > 0 ? "ação necessária" : "Tudo em dia", icon: ArrowDownRight, trend: overdue > 0 ? "down" as const : "up" as const },
  ];

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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${hideValues ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
                {hideValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{hideValues ? "Oculto" : "Ocultar"}</span>
              </button>
              <button onClick={load} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:bg-muted/50 transition-all disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-1 capitalize">Hoje, {today}</p>
          </div>
          <span className="self-start text-xs px-3 py-1.5 rounded-full bg-success/10 text-success border border-success/20 font-medium">
            ● {loading ? "Carregando..." : "Tudo operando"}
          </span>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            <section className="mb-10">
              <SectionTitle>Aquisição de leads</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {acquisition.map((m) => <MetricCard key={m.label} {...m} hide={hideValues} />)}
              </div>
            </section>

            <section className="mb-10">
              <SectionTitle>Vendas e conversão</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {sales.map((m) => <MetricCard key={m.label} {...m} hide={hideValues} />)}
              </div>
            </section>

            <section className="mb-10">
              <SectionTitle>Retenção e valor do cliente</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {retention.map((m) => <MetricCard key={m.label} {...m} hide={hideValues} />)}
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
                  <button onClick={() => router.push("/dashboard/conversas")} className="text-xs text-primary hover:underline">Ver todas →</button>
                </div>
                <div className="space-y-1">
                  {convos.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conversa aberta</p>
                  ) : convos.map((c: any) => (
                    <div key={c.id} onClick={() => router.push(`/dashboard/conversas?id=${c.id}`)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer">
                      <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">
                        {(c.contact?.name || c.externalId || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground truncate">{c.contact?.name || c.externalId}</p>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.lastMessage || "Sem mensagens"}</p>
                      </div>
                      {(c.unreadCount ?? 0) > 0 && (
                        <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                          {c.unreadCount}
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
          </>
        )}
      </div>
    </div>
  );
}
