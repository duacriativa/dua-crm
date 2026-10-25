"use client";
import { authFetch } from "@/lib/auth-fetch";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, CheckCheck, UserPlus, MessageCircle, Instagram, CalendarClock, StickyNote,
  CircleDollarSign, AlertTriangle, FileClock, ClipboardList, Settings,
} from "lucide-react";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

interface Notif {
  id: string;
  event: string;
  title: string;
  body: string;
  url: string | null;
  count: number;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, { icon: any; color: string }> = {
  lead_new: { icon: UserPlus, color: "text-primary bg-primary/10" },
  message_whatsapp: { icon: MessageCircle, color: "text-emerald-500 bg-emerald-500/10" },
  message_instagram: { icon: Instagram, color: "text-pink-500 bg-pink-500/10" },
  meeting: { icon: CalendarClock, color: "text-sky-500 bg-sky-500/10" },
  team_note: { icon: StickyNote, color: "text-amber-500 bg-amber-500/10" },
  payment_received: { icon: CircleDollarSign, color: "text-emerald-500 bg-emerald-500/10" },
  payment_overdue: { icon: AlertTriangle, color: "text-red-500 bg-red-500/10" },
  contract_expiring: { icon: FileClock, color: "text-orange-500 bg-orange-500/10" },
  plan_order: { icon: ClipboardList, color: "text-violet-500 bg-violet-500/10" },
};

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Sino do topo: histórico real de avisos (Configurações → Notificações escolhe o que entra aqui). */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v1/notifications?limit=40`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
      setLoaded(true);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const markRead = async (id?: string) => {
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (!id || n.id === id) && !n.readAt ? { ...n, readAt: now } : n));
    setUnread((u) => id ? Math.max(0, u - (items.find((n) => n.id === id && !n.readAt) ? 1 : 0)) : 0);
    try {
      await authFetch(`/api/v1/notifications/read`, { method: "POST", headers: authHeaders(), body: JSON.stringify(id ? { id } : {}) });
    } catch {}
  };

  const openItem = (n: Notif) => {
    if (!n.readAt) markRead(n.id);
    setOpen(false);
    if (n.url) router.push(n.url);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen(!open); if (!open) load(); }}
        aria-label="Notificações"
        className={`relative p-2 rounded-xl transition-colors ${open ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"}`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-[calc(3.75rem+env(safe-area-inset-top))] lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[22rem] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-foreground text-sm">Notificações</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={() => markRead()} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted/60 text-xs text-muted-foreground" title="Marcar todas como lidas">
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar lidas
                </button>
              )}
              <button onClick={() => { setOpen(false); router.push(`/dashboard/configuracoes?tab=${encodeURIComponent("Notificações")}`); }}
                className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground" title="Configurar notificações">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[26rem] overflow-y-auto scrollbar-none">
            {loaded && items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação</p>}
            {!loaded && <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>}
            {items.map((n) => {
              const { icon: Icon, color } = ICONS[n.event] ?? { icon: Bell, color: "text-primary bg-primary/10" };
              return (
                <button key={n.id} onClick={() => openItem(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 text-left hover:bg-muted/30 transition-colors ${n.readAt ? "opacity-60" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight truncate">
                      {n.title}{n.count > 1 && <span className="ml-1 text-xs text-muted-foreground font-normal">({n.count})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words">{n.body}</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.readAt && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
