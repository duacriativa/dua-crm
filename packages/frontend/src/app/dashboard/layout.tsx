import { Sidebar } from "@/components/ui/sidebar";
import { AsaasNotificationsProvider } from "@/components/ui/asaas-notifications";
import { Bell, Search, Globe, Headphones, Trophy } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <AsaasNotificationsProvider />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header — desktop only (mobile has its own in Sidebar) */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-xl items-center gap-3 px-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Buscar clientes, leads, conversas…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden xl:flex items-center gap-3 px-4 py-2 rounded-xl bg-muted/40 border border-border">
              <Trophy className="h-4 w-4 text-warning shrink-0" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground">R$ 7.800</span>
                  <span className="text-muted-foreground">/ R$ 10.000</span>
                </div>
                <div className="h-1 w-32 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[78%] rounded-full bg-gradient-primary" />
                </div>
              </div>
            </div>
            <button className="p-2 rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground">
              <Globe className="h-5 w-5" />
            </button>
            <button className="p-2 rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground">
              <Headphones className="h-5 w-5" />
            </button>
            <button className="relative p-2 rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto pt-14 pb-16 lg:pt-0 lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
