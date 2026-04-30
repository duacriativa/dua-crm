"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, MessageCircle, Users, Megaphone, Bot,
  Settings, ChevronLeft, ChevronRight, LogOut, Kanban,
  Menu, X, DollarSign, FileText, Smartphone, Plus,
  ChevronDown, Bell, Trophy,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard",     href: "/dashboard" },
  { icon: MessageCircle,   label: "Conversas",     href: "/dashboard/conversas", badge: 12 },
  { icon: Users,           label: "Contatos",      href: "/dashboard/contatos" },
  { icon: Kanban,          label: "Funil",         href: "/dashboard/funil" },
  { icon: DollarSign,      label: "Financeiro",    href: "/dashboard/financeiro" },
  { icon: FileText,        label: "Contratos",     href: "/dashboard/contratos" },
  { icon: Megaphone,       label: "Campanhas",     href: "/dashboard/campanhas" },
  { icon: Bot,             label: "Bots",          href: "/dashboard/bots" },
  { icon: Smartphone,      label: "WhatsApp",      href: "/dashboard/whatsapp" },
  { icon: Settings,        label: "Configurações", href: "/dashboard/configuracoes" },
];

function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className={`relative hidden lg:flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0 ${collapsed ? "w-16" : "w-60"}`}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
          <span className="text-white font-bold text-sm">D</span>
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-foreground">
            dua<span className="text-primary">CRM</span>
          </span>
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
          const active = isActive(item.href);
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-sidebar-accent text-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer user */}
      <div className="px-3 pb-4 pt-3 border-t border-sidebar-border space-y-2">
        {/* Meta de vendas */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-sidebar-accent/60">
            <Trophy className="w-4 h-4 text-warning shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-foreground">R$ 7.800</span>
                <span className="text-muted-foreground">/ R$ 10.000</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden"><div className="h-full w-[78%] rounded-full bg-gradient-primary" /></div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">D</div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Daniel</p>
              <p className="text-xs text-muted-foreground truncate">Plano PRO</p>
            </div>
          )}
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-all">
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 bg-sidebar-accent border border-sidebar-border rounded-full flex items-center justify-center hover:bg-muted transition-colors z-10">
        {collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground" />}
      </button>
    </aside>
  );
}

function MobileNav() {
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

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const currentLabel = navItems.find((i) => isActive(i.href))?.label ?? "Dashboard";

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">D</span>
          </div>
          <span className="font-semibold text-sm text-foreground">
            dua<span className="text-primary">CRM</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="relative p-2 rounded-xl hover:bg-sidebar-accent transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
          </button>
          <button onClick={() => setOpen(true)} className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </header>

      {open && <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />}

      <aside className={`lg:hidden fixed top-0 right-0 bottom-0 z-50 w-72 bg-sidebar text-sidebar-foreground flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-lg font-bold text-foreground">dua<span className="text-primary">CRM</span></span>
          </div>
          <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto scrollbar-none">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <button key={item.href} onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${active ? "bg-sidebar-accent text-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-6 pt-3 border-t border-sidebar-border">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-all">
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border flex items-center">
        {navItems.slice(0, 4).map((item) => {
          const active = isActive(item.href);
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 relative transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.badge && (
                <span className="absolute top-1.5 right-[calc(50%-18px)] bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {item.badge}
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
  return (
    <>
      <DesktopSidebar />
      <MobileNav />
    </>
  );
}
