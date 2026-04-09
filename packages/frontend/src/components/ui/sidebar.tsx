"use client";

import { useState } from "react";
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
  Bell,
  Kanban,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard",     href: "/dashboard" },
  { icon: MessageCircle,   label: "Conversas",     href: "/dashboard/conversas", badge: 12 },
  { icon: Users,           label: "Contatos",      href: "/dashboard/contatos" },
  { icon: Kanban,          label: "Funil",         href: "/dashboard/funil" },
  { icon: Megaphone,       label: "Campanhas",     href: "/dashboard/campanhas" },
  { icon: Bot,             label: "Bots",          href: "/dashboard/bots" },
  { icon: Smartphone,      label: "WhatsApp",      href: "/dashboard/whatsapp" },
  { icon: Settings,        label: "Configurações", href: "/dashboard/configuracoes" },
];

export function Sidebar() {
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
      className={`relative flex flex-col h-screen bg-gray-900 text-white transition-all duration-300 shrink-0 ${
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
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
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

      {/* Bottom */}
      <div className="px-2 pb-4 space-y-1 border-t border-gray-800 pt-3">
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
