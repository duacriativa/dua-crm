"use client";

import { useState, useEffect, useRef, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import api from "@/lib/api";
import {
  LayoutDashboard, MessageCircle, Users,
  Settings, ChevronLeft, ChevronRight, LogOut, Kanban,
  Menu, X, DollarSign, FileText, Plus,
  Calendar, Bot, Megaphone, Workflow,
  ChevronUp, ChevronDown, User, CreditCard, ClipboardList, ListChecks,
} from "lucide-react";

type Icon = ComponentType<{ className?: string }>;
type SubItem = { label: string; href?: string; soon?: boolean };
type GroupItem = { icon: Icon; label: string; href?: string; children?: SubItem[] };
type NavItem = { icon: Icon; label: string; href?: string; badge?: number; group?: GroupItem[] };

/* Automações no estilo do Kommo: Bots, Modelos (chat/email) e Transmissão */
const automationItems: GroupItem[] = [
  { icon: Bot,       label: "Bots",        href: "/dashboard/bots" },
  { icon: FileText,  label: "Modelos",     children: [
    { label: "Modelos de chat",  href: "/dashboard/modelos/chat" },
    { label: "Modelos de email", soon: true },
  ] },
  { icon: Megaphone, label: "Transmissão", href: "/dashboard/campanhas" },
];

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",     href: "/dashboard" },
  { icon: Users,           label: "Clientes",      href: "/dashboard/contatos" },
  { icon: Kanban,          label: "Funil",         href: "/dashboard/funil" },
  { icon: MessageCircle,   label: "Conversas",     href: "/dashboard/conversas", badge: 12 },
  { icon: ListChecks,      label: "Tarefas",       href: "/dashboard/tarefas" },
  { icon: Calendar,        label: "Agenda",        href: "/dashboard/agenda" },
  { icon: Workflow,        label: "Automações",    group: automationItems },
  { icon: DollarSign,      label: "Financeiro",    href: "/dashboard/financeiro" },
  { icon: ClipboardList,   label: "Planos 90 dias", href: "/dashboard/planos" },
  { icon: Settings,        label: "Configurações", href: "/dashboard/configuracoes" },
];

/** Tarefas abertas do comercial (contador do menu): a cada minuto e quando a tela Tarefas muda algo. */
function useTaskCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const load = () => api.get("/sales-tasks/count").then((r) => setN(r.data?.all ?? 0)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener("sales-tasks-changed", load);
    return () => { clearInterval(t); window.removeEventListener("sales-tasks-changed", load); };
  }, []);
  return n;
}

/** Contador do item: o da tela Tarefas é real; os demais vêm fixos do menu. */
const badgeOf = (item: NavItem, tasks: number) => (item.href === "/dashboard/tarefas" ? tasks : item.badge ?? 0);

const isPathActive = (pathname: string, href?: string) =>
  !href ? false : href === "/dashboard" ? pathname === href : pathname.startsWith(href);

const groupActive = (pathname: string, group: GroupItem[]) =>
  group.some(g => isPathActive(pathname, g.href) || g.children?.some(c => isPathActive(pathname, c.href)));

const itemCls = (active: boolean) =>
  `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-sidebar-accent text-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`;

const flyoutItemCls = (active: boolean) =>
  `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors text-left ${active ? "bg-primary/15 text-primary font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`;

const SoonTag = () => (
  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/60 rounded-full px-1.5 py-0.5">em breve</span>
);

/* Item com seta que abre um flyout ao lado (e um segundo nível para "Modelos").
   Usa posição fixa para não ser cortado pelo overflow da nav. */
function FlyoutGroup({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const group = item.group!;
  const active = groupActive(pathname, group);

  useEffect(() => { setOpen(false); setSub(null); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) { setOpen(false); setSub(null); }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setSub(null); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    const aside = btnRef.current?.closest("aside")?.getBoundingClientRect();
    if (r) { setTop(r.top); setLeft((aside?.right ?? r.right) + 8); }
    setOpen(o => !o);
    setSub(null);
  };

  const go = (href: string) => { router.push(href); setOpen(false); setSub(null); };
  const subGroup = group.find(g => g.label === sub);

  return (
    <>
      <button ref={btnRef} onClick={toggle} title={collapsed ? item.label : undefined}
        aria-haspopup="menu" aria-expanded={open}
        className={itemCls(active || open)}>
        <item.icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
        {!collapsed && <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "translate-x-0.5" : ""}`} />}
      </button>

      {open && (
        <div ref={panelRef} role="menu" className="fixed z-50 flex items-start gap-2" style={{ top, left }}>
          <div className="w-56 bg-sidebar border border-sidebar-border rounded-xl shadow-2xl p-1.5">
            <p className="px-3 pt-1.5 pb-2 text-xs font-medium text-muted-foreground border-b border-sidebar-border mb-1">{item.label}</p>
            {group.map(g => {
              const gActive = isPathActive(pathname, g.href) || !!g.children?.some(c => isPathActive(pathname, c.href));
              return (
                <button key={g.label} role="menuitem"
                  onClick={() => g.children ? setSub(g.label) : g.href && go(g.href)}
                  onMouseEnter={() => setSub(g.children ? g.label : null)}
                  className={flyoutItemCls(gActive || sub === g.label)}>
                  <g.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{g.label}</span>
                  {g.children && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
          {subGroup?.children && (
            <div className="w-56 bg-sidebar border border-sidebar-border rounded-xl shadow-2xl p-1.5" style={{ marginTop: 44 }}>
              <p className="px-3 pt-1.5 pb-2 text-xs font-medium text-muted-foreground border-b border-sidebar-border mb-1">{subGroup.label}</p>
              {subGroup.children.map(c => (
                <button key={c.label} role="menuitem" disabled={c.soon}
                  onClick={() => c.href && go(c.href)}
                  className={c.soon ? `${flyoutItemCls(false)} opacity-60 cursor-not-allowed hover:bg-transparent hover:text-sidebar-foreground` : flyoutItemCls(isPathActive(pathname, c.href))}>
                  <span className="flex-1">{c.label}</span>
                  {c.soon && <SoonTag />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* No celular o grupo abre em lista, dentro da gaveta */
function MobileGroup({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const router = useRouter();
  const group = item.group!;
  const [open, setOpen] = useState(() => groupActive(pathname, group));
  const active = groupActive(pathname, group);

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${active ? "text-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}>
        <item.icon className="w-5 h-5 shrink-0" />
        <span className="flex-1">{item.label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-6 pl-3 border-l border-sidebar-border space-y-0.5 py-1">
          {group.map(g => g.children ? (
            <div key={g.label}>
              <p className="flex items-center gap-3 px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                <g.icon className="w-4 h-4 shrink-0" />{g.label}
              </p>
              {g.children.map(c => (
                <button key={c.label} disabled={c.soon} onClick={() => c.href && router.push(c.href)}
                  className={`${flyoutItemCls(isPathActive(pathname, c.href))} pl-10 ${c.soon ? "opacity-60 cursor-not-allowed" : ""}`}>
                  <span className="flex-1">{c.label}</span>
                  {c.soon && <SoonTag />}
                </button>
              ))}
            </div>
          ) : (
            <button key={g.label} onClick={() => g.href && router.push(g.href)}
              className={flyoutItemCls(isPathActive(pathname, g.href))}>
              <g.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{g.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserFooter({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <div className="px-3 pb-4 pt-3 border-t border-sidebar-border relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-sidebar-accent/60 transition-all">
        <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">D</div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-foreground truncate">Daniel</p>
              <p className="text-xs text-muted-foreground truncate">Plano PRO</p>
            </div>
            <ChevronUp className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "" : "rotate-180"}`} />
          </>
        )}
      </button>

      {open && !collapsed && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-sidebar border border-sidebar-border rounded-xl shadow-2xl overflow-hidden z-50">
          <button onClick={() => { router.push("/dashboard/configuracoes"); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
            <User className="w-4 h-4 shrink-0" />
            <span>Meu perfil</span>
          </button>
          <button onClick={() => { router.push("/dashboard/configuracoes"); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Assinatura</span>
          </button>
          <button onClick={() => { router.push("/dashboard/configuracoes"); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
            <Settings className="w-4 h-4 shrink-0" />
            <span>Configurações</span>
          </button>
          <div className="h-px bg-sidebar-border mx-3" />
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  );
}

function DesktopSidebar({ tasks }: { tasks: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  };

  const isActive = (href?: string) => isPathActive(pathname, href);

  return (
    <aside className={`relative hidden lg:flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0 ${collapsed ? "w-16" : "w-60"}`}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
        {collapsed ? (
          <img src="/favicon.svg" alt="Dua CRM" className="w-8 h-8 rounded-xl shrink-0 shadow-glow" />
        ) : (
          <img src="/brand/logo-dua-crm-branco.png" alt="dua.crm" className="h-7 w-auto" />
        )}
      </div>

      {/* Nova Venda button */}
      <div className="px-3 pt-4 pb-2">
        <button className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity ${collapsed ? "px-2" : "px-4"}`}>
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Nova Venda</span>}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          if (item.group) return <FlyoutGroup key={item.label} item={item} collapsed={collapsed} />;
          const active = isActive(item.href);
          return (
            <button key={item.href} onClick={() => item.href && router.push(item.href)} title={collapsed ? item.label : undefined}
              className={itemCls(active)}>
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && badgeOf(item, tasks) > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {badgeOf(item, tasks)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer user with dropdown */}
      <UserFooter collapsed={collapsed} onLogout={handleLogout} />

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 bg-sidebar-accent border border-sidebar-border rounded-full flex items-center justify-center hover:bg-muted transition-colors z-10">
        {collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground" />}
      </button>
    </aside>
  );
}

function MobileNav({ tasks }: { tasks: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  };

  const isActive = (href?: string) => isPathActive(pathname, href);

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <img src="/brand/logo-dua-crm-branco.png" alt="dua.crm" className="h-6 w-auto" />
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <button onClick={() => setOpen(true)} className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </header>

      {open && <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />}

      <aside className={`lg:hidden fixed top-0 right-0 bottom-0 z-50 w-72 bg-sidebar text-sidebar-foreground flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <img src="/brand/logo-dua-crm-branco.png" alt="dua.crm" className="h-7 w-auto" />
          </div>
          <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto scrollbar-none">
          {navItems.map((item) => {
            if (item.group) return <MobileGroup key={item.label} item={item} />;
            const active = isActive(item.href);
            return (
              <button key={item.href} onClick={() => item.href && router.push(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${active ? "bg-sidebar-accent text-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badgeOf(item, tasks) > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {badgeOf(item, tasks)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 border-t border-sidebar-border">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-all">
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <nav className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border flex items-center pb-[env(safe-area-inset-bottom)]">
        {navItems.slice(0, 4).map((item) => {
          const active = isActive(item.href);
          return (
            <button key={item.href} onClick={() => item.href && router.push(item.href)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 relative transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {badgeOf(item, tasks) > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-18px)] bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {badgeOf(item, tasks)}
                </span>
              )}
            </button>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex-1 flex flex-col items-center gap-1 py-2.5 text-muted-foreground hover:text-foreground transition-colors">
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>
    </>
  );
}

export function Sidebar() {
  const tasks = useTaskCount();
  return (
    <>
      <DesktopSidebar tasks={tasks} />
      <MobileNav tasks={tasks} />
    </>
  );
}
