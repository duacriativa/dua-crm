import { Sidebar } from "@/components/ui/sidebar";
import { AsaasNotificationsProvider } from "@/components/ui/asaas-notifications";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <AsaasNotificationsProvider />
      <main className="flex-1 overflow-auto pt-14 pb-16 lg:pt-0 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
