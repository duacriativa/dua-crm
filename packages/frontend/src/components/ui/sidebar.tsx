"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  Megaphone,
  Bot,
  Settings,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Kanban,
  Menu,
  X,
  DollarSign,
  FileText,
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

// ── Desktop sidebar (lg+) ─────────────────────────────────────────────────────
function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  };

  return (
    <aside
      className={`relative hidden lg:flex flex-col h-screen bg-gray-900 text-white transition-all duration-300 shrink-0 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">D</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight">Dua CRM</p>
            <p className="text-xs text-gray-400">Dua Criativa</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-brand-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="flex-1 text-left">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span className="bg-brand-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-gray-800 pt-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 bg-gray-700 border border-gray-600 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-gray-300" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-gray-300" />
        )}
      </button>
    </aside>
  );
}

// ── Mobile header + drawer ────────────────────────────────────────────────────
function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Fecha o drawer ao navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloqueia scroll do body quando drawer aberto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  };

  const currentLabel = navItems.find(
    (i) => pathname === i.href || (i.href !== "/dashboard" && pathname.startsWith(i.href))
  )?.label ?? "Dashboard";

  return (
    <>
      {/* Top header bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-gray-900 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">D</span>
          </div>
          <span className="font-semibold text-sm">{currentLabel}</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-xl hover:bg-gray-800 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-50 w-72 bg-gray-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Dua CRM</p>
              <p className="text-xs text-gray-400">Dua Criativa</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                  active
                    ? "bg-brand-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="bg-brand-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom tab bar hint + logout */}
        <div className="px-3 pb-6 border-t border-gray-800 pt-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Bottom tab bar (5 itens principais) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-800 flex items-center safe-bottom">
        {navItems.slice(0, 4).map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 relative transition-colors ${
                active ? "text-brand-400" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.badge && (
                <span className="absolute top-1.5 right-[calc(50%-18px)] bg-brand-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
        {/* "Mais" abre o drawer */}
        <button
          onClick={() => setOpen(true)}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileNav />
    </>
  );
}
