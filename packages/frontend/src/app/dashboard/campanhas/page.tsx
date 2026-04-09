"use client";

import { useState } from "react";
import {
  Plus,
  Megaphone,
  Send,
  Clock,
  CheckCheck,
  XCircle,
  MoreVertical,
  Users,
  TrendingUp,
  BarChart2,
  Search,
  X,
  CalendarDays,
  MessageCircle,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: "sent" | "scheduled" | "draft" | "failed";
  channel: "WHATSAPP" | "INSTAGRAM";
  scheduledAt?: string;
  sentAt?: string;
  total: number;
  delivered: number;
  read: number;
  createdAt: string;
}

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "1",
    name: "Lançamento Coleção Verão",
    message: "🌞 A nova coleção Verão 2024 acabou de chegar! Confira os looks exclusivos...",
    status: "sent",
    channel: "WHATSAPP",
    sentAt: "2024-03-15T10:00:00",
    total: 342,
    delivered: 335,
    read: 287,
    createdAt: "2024-03-14",
  },
  {
    id: "2",
    name: "Promoção Dia das Mães",
    message: "💐 Especial Dia das Mães: 20% OFF em toda a loja! Válido até domingo...",
    status: "scheduled",
    channel: "WHATSAPP",
    scheduledAt: "2024-05-10T09:00:00",
    total: 410,
    delivered: 0,
    read: 0,
    createdAt: "2024-04-08",
  },
  {
    id: "3",
    name: "Reengajamento Inativos",
    message: "Sentimos sua falta! 😊 Temos novidades incríveis te esperando...",
    status: "draft",
    channel: "WHATSAPP",
    total: 98,
    delivered: 0,
    read: 0,
    createdAt: "2024-04-05",
  },
  {
    id: "4",
    name: "Black Friday Preview",
    message: "⚡ Pré-Black Friday exclusivo para clientes VIP! Acesso antecipado...",
    status: "failed",
    channel: "WHATSAPP",
    sentAt: "2024-03-01T08:00:00",
    total: 156,
    delivered: 12,
    read: 8,
    createdAt: "2024-02-28",
  },
];

const statusConfig = {
  sent: { label: "Enviada", color: "bg-green-100 text-green-700", icon: <CheckCheck className="w-3.5 h-3.5" /> },
  scheduled: { label: "Agendada", color: "bg-blue-100 text-blue-700", icon: <Clock className="w-3.5 h-3.5" /> },
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-500", icon: <MessageCircle className="w-3.5 h-3.5" /> },
  failed: { label: "Falhou", color: "bg-red-100 text-red-700", icon: <XCircle className="w-3.5 h-3.5" /> },
};

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", message: "" });

  const filtered = campaigns.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.message.toLowerCase().includes(search.toLowerCase())
  );

  const totalSent = campaigns.filter((c) => c.status === "sent").reduce((a, c) => a + c.total, 0);
  const totalDelivered = campaigns.reduce((a, c) => a + c.delivered, 0);
  const totalRead = campaigns.reduce((a, c) => a + c.read, 0);

  const createCampaign = () => {
    if (!newCampaign.name.trim()) return;
    const c: Campaign = {
      id: `camp-${Date.now()}`,
      ...newCampaign,
      status: "draft",
      channel: "WHATSAPP",
      total: 0,
      delivered: 0,
      read: 0,
      createdAt: new Date().toISOString(),
    };
    setCampaigns((prev) => [c, ...prev]);
    setNewCampaign({ name: "", message: "" });
    setShowNew(false);
  };

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Campanhas</h1>
            <p className="text-sm text-gray-400 mt-0.5">Envio em massa para seus contatos</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Campanha
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Mensagens Enviadas", value: totalSent.toLocaleString(), icon: <Send className="w-4 h-4" />, color: "text-brand-600 bg-brand-50" },
            { label: "Entregues", value: totalDelivered.toLocaleString(), icon: <CheckCheck className="w-4 h-4" />, color: "text-green-600 bg-green-50" },
            { label: "Lidas", value: totalRead.toLocaleString(), icon: <TrendingUp className="w-4 h-4" />, color: "text-blue-600 bg-blue-50" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${stat.color}`}>{stat.icon}</div>
              <div>
                <p className="text-xs text-gray-400">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar campanhas..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Campaigns list */}
        <div className="space-y-3">
          {filtered.map((camp) => {
            const st = statusConfig[camp.status];
            const deliveryRate = camp.total > 0 ? Math.round((camp.delivered / camp.total) * 100) : 0;
            const readRate = camp.delivered > 0 ? Math.round((camp.read / camp.delivered) * 100) : 0;

            return (
              <div
                key={camp.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="p-2.5 bg-brand-50 rounded-xl shrink-0">
                      <Megaphone className="w-5 h-5 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm">{camp.name}</h3>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${st.color}`}>
                          {st.icon}
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1">{camp.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        {camp.sentAt && (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Send className="w-3 h-3" />
                            Enviada {new Date(camp.sentAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {camp.scheduledAt && (
                          <span className="text-[11px] text-blue-500 flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            Agendada {new Date(camp.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Contatos</p>
                      <p className="text-sm font-bold text-gray-800">{camp.total}</p>
                    </div>
                    {camp.status === "sent" && (
                      <>
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Entregues</p>
                          <p className="text-sm font-bold text-gray-800">{deliveryRate}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Lidas</p>
                          <p className="text-sm font-bold text-gray-800">{readRate}%</p>
                        </div>
                      </>
                    )}
                    <button className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Megaphone className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma campanha encontrada</p>
          </div>
        )}
      </div>

      {/* New campaign modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Nova Campanha</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome da Campanha *</label>
                <input
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Lançamento Coleção Inverno"
                  autoFocus
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Mensagem</label>
                <textarea
                  value={newCampaign.message}
                  onChange={(e) => setNewCampaign((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Digite a mensagem da campanha..."
                  rows={4}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={createCampaign} className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700">
                Criar Rascunho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
