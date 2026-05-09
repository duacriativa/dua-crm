"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Bell, Search, Globe, Headphones, Trophy, X, UserPlus, TrendingUp, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

/* ── Busca Global ── */
function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const [contacts, convs] = await Promise.all([
        fetch(`${API_URL}/api/v1/contacts?search=${encodeURIComponent(q)}&limit=5`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
        fetch(`${API_URL}/api/v1/conversations?search=${encodeURIComponent(q)}&limit=3`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
      ]);
      const items: any[] = [];
      (contacts.contacts ?? []).forEach((c: any) => items.push({ type: c.type === "CLIENT" ? "cliente" : "lead", id: c.id, name: c.name, sub: c.phone || c.email || "", href: `/dashboard/contatos/${c.id}` }));
      (convs.conversations ?? convs ?? []).forEach((c: any) => items.push({ type: "conversa", id: c.id, name: c.contactName, sub: c.lastMessage || "WhatsApp", href: `/dashboard/whatsapp` }));
      setResults(items);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const typeColor: Record<string, string> = { cliente: "text-emerald-400", lead: "text-primary", conversa: "text-blue-400" };
  const typeLabel: Record<string, string> = { cliente: "Cliente", lead: "Lead", conversa: "Conversa" };

  return (
    <div ref={ref} className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar clientes, leads, conversas…"
        className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
      />
      {open && query && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          {loading && <div className="px-4 py-3 text-xs text-muted-foreground">Buscando...</div>}
          {!loading && results.length === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">Nenhum resultado para "{query}"</div>}
          {results.map((r, i) => (
            <button key={i} onClick={() => { router.push(r.href); setOpen(false); setQuery(""); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/50 last:border-0 text-left">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-muted/50 ${typeColor[r.type]}`}>{typeLabel[r.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Notificações ── */
function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/contacts?limit=10&sort=createdAt`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const contacts = (data.contacts ?? []).slice(0, 8).map((c: any) => ({
        id: c.id,
        name: c.name,
        origem: c.tags?.includes("formulario") ? "Formulário" : "WhatsApp",
        date: c.createdAt,
        read: false,
        href: `/dashboard/funil`,
      }));
      setNotifs(contacts);
      setUnread(contacts.length);
    } catch {}
  }, []);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const markAllRead = () => { setNotifs(n => n.map(x => ({ ...x, read: true }))); setUnread(0); };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen(!open); if (!open) setUnread(0); }}
        className={`relative p-2 rounded-xl transition-colors ${open ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"}`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-foreground text-sm">Notificações</p>
            <button onClick={markAllRead} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground" title="Limpar tudo">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-none">
            {notifs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notificação</p>}
            {notifs.map(n => (
              <button key={n.id} onClick={() => { router.push(n.href); setOpen(false); }}
                className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 text-left hover:bg-muted/30 transition-colors ${n.read ? "opacity-60" : ""}`}>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <UserPlus className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">Nova oportunidade: {n.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Origem: {n.origem}</p>
                  <p className="text-xs text-muted-foreground">{new Date(n.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">Mostrando últimos leads captados</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Troféu / Meta ── */
function TrophyWidget() {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState(() => {
    if (typeof window !== "undefined") return Number(localStorage.getItem("dua-crm-meta") || "54000");
    return 54000;
  });
  const [editMeta, setEditMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");
  const [atual, setAtual] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Busca valor recebido real do Asaas
  useEffect(() => {
    fetch(`${API_URL}/api/v1/financial/summary`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.received) setAtual(d.received); })
      .catch(() => {});
  }, []);

  const percent = Math.min(100, (atual / meta) * 100);
  const fmtBR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const MARCOS = [1000,5000,10000,20000,30000,40000,50000,75000,100000];
  const PLACAS = [
    { label: "100K", valor: 100000, icon: "🏆" },
    { label: "250K", valor: 250000, icon: "👑" },
    { label: "500K", valor: 500000, icon: "👑" },
    { label: "1M", valor: 1000000, icon: "✨" },
  ];

  const MESES = ["jun/25","jul/25","ago/25","set/25","out/25","nov/25","dez/25","jan/26","fev/26","mar/26","abr/26","mai/26"];
  const HISTORICO = [0,0,0,0,0,0,0,0,0,0,atual,0];
  const maxVal = Math.max(...HISTORICO, 1);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative hidden xl:block">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${open ? "bg-primary/10 border-primary/40" : "bg-muted/40 border-border hover:border-primary/30"}`}>
        <Trophy className="h-4 w-4 text-warning shrink-0" />
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-foreground">{fmtBR(atual)}</span>
            <span className="text-muted-foreground">/ {fmtBR(meta)}</span>
          </div>
          <div className="h-1 w-32 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[85vh] overflow-y-auto scrollbar-none">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <Trophy className="w-5 h-5 text-warning" />
            <h2 className="font-bold text-foreground">Suas Conquistas</h2>
            <button onClick={() => setOpen(false)} className="ml-auto p-1 rounded-lg hover:bg-muted/60 text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>

          {/* Faturamento total */}
          <div className="mx-4 mt-4 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-center">
            <p className="text-xs text-muted-foreground mb-1">Faturamento Total</p>
            <p className="text-3xl font-black text-primary">{fmtBR(atual)}</p>
          </div>

          {/* Meta editável */}
          <div className="mx-4 mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Meta mensal</p>
            {editMeta ? (
              <div className="flex items-center gap-2">
                <input type="number" value={metaInput} onChange={e => setMetaInput(e.target.value)}
                  className="w-28 px-2 py-1 text-xs bg-muted/50 border border-border rounded-lg text-foreground" />
                <button onClick={() => { const v = Number(metaInput); if (v > 0) { setMeta(v); localStorage.setItem("dua-crm-meta", String(v)); } setEditMeta(false); }}
                  className="text-xs px-2 py-1 bg-primary text-white rounded-lg">OK</button>
                <button onClick={() => setEditMeta(false)} className="text-xs text-muted-foreground">✕</button>
              </div>
            ) : (
              <button onClick={() => { setMetaInput(String(meta)); setEditMeta(true); }}
                className="text-xs text-primary hover:underline flex items-center gap-1">
                {fmtBR(meta)} <span className="text-[10px]">✏️</span>
              </button>
            )}
          </div>

          {/* Barra de progresso */}
          <div className="mx-4 mt-2 mb-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{percent.toFixed(0)}% da meta</p>
          </div>

          {/* Placas */}
          <div className="px-4 py-3 border-t border-border mt-2">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">👑 Placas de Conquista</p>
            <div className="grid grid-cols-4 gap-2">
              {PLACAS.map(p => {
                const unlocked = atual >= p.valor;
                return (
                  <div key={p.label} className={`flex flex-col items-center gap-1 p-2 rounded-xl border ${unlocked ? "border-primary/40 bg-primary/10" : "border-border bg-muted/20 opacity-50"}`}>
                    <span className="text-lg">{p.icon}</span>
                    {!unlocked && <span className="text-xs text-muted-foreground">🔒</span>}
                    <span className="text-[10px] font-bold text-foreground">{p.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Linha do tempo */}
          <div className="px-4 pb-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mt-3 mb-2 flex items-center gap-1">🎯 Linha do Tempo</p>
            <div className="space-y-1">
              {MARCOS.map(marco => {
                const conquistado = atual >= marco;
                const falta = marco - atual;
                return (
                  <div key={marco} className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-sm ${conquistado ? "border-emerald-500/30 bg-emerald-500/10" : "border-border bg-muted/20"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${conquistado ? "bg-emerald-500 text-white" : "bg-muted/50 text-muted-foreground border border-border"}`}>
                      {conquistado ? "✓" : "○"}
                    </div>
                    <span className={`flex-1 font-medium ${conquistado ? "text-foreground" : "text-muted-foreground"}`}>{fmtBR(marco)}</span>
                    <span className={`text-xs ${conquistado ? "text-emerald-400 font-semibold" : "text-muted-foreground"}`}>
                      {conquistado ? "✓ Conquistado" : `faltam ${fmtBR(falta)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Faturamento mensal */}
          <div className="px-4 pb-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mt-3 mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Faturamento Mensal</p>
            <div className="space-y-1">
              {MESES.map((mes, i) => {
                const val = HISTORICO[i];
                const w = val > 0 ? Math.max(8, (val / maxVal) * 100) : 4;
                const isAtual = i === 10;
                return (
                  <div key={mes} className="flex items-center gap-2 text-xs">
                    <span className={`w-12 text-right shrink-0 ${isAtual ? "text-primary font-semibold" : "text-muted-foreground"}`}>{mes}</span>
                    <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                      {val > 0 && (
                        <div className={`h-full rounded flex items-center justify-end pr-2 text-[10px] font-bold text-white ${isAtual ? "bg-primary" : "bg-muted-foreground/60"}`}
                          style={{ width: `${w}%` }}>
                          {fmtBR(val)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — desktop */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-xl items-center gap-3 px-6 shrink-0">
          <GlobalSearch />
          <TrophyWidget />
          <div className="flex items-center gap-1 xl:ml-0 ml-auto">
            <button className="p-2 rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground">
              <Globe className="h-5 w-5" />
            </button>
            <button className="p-2 rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground">
              <Headphones className="h-5 w-5" />
            </button>
            <NotificationsDropdown />
          </div>
        </header>
        <main className="flex-1 overflow-auto pt-14 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
