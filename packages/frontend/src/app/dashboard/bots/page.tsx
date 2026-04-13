"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Bot,
  Play,
  Pause,
  MoreVertical,
  Zap,
  TrendingUp,
  Users,
  X,
  Settings,
  Copy,
  Trash2,
  ArrowRight,
} from "lucide-react";

interface BotFlow {
  id: string;
  name: string;
  trigger: string;
  status: "active" | "paused" | "draft";
  sessions: number;
  conversions: number;
  totalSent: number;
  createdAt: string;
  description?: string;
}

const MOCK_BOTS: BotFlow[] = [
  {
    id: "1",
    name: "Boas-vindas Novos Clientes",
    trigger: "Primeira mensagem recebida",
    status: "active",
    sessions: 142,
    conversions: 38,
    totalSent: 142,
    createdAt: "2024-02-10",
    description: "Envia mensagem de boas-vindas e apresenta o catálogo",
  },
  {
    id: "2",
    name: "Recuperação de Carrinho",
    trigger: "Tag: carrinho_abandonado",
    status: "active",
    sessions: 67,
    conversions: 21,
    totalSent: 67,
    createdAt: "2024-02-20",
    description: "Lembra o cliente do carrinho abandonado após 1h",
  },
  {
    id: "3",
    name: "Pós-venda e NPS",
    trigger: "Status: Fechado (ganho)",
    status: "paused",
    sessions: 89,
    conversions: 74,
    totalSent: 89,
    createdAt: "2024-03-01",
    description: "Envia pesquisa de satisfação 3 dias após a compra",
  },
  {
    id: "4",
    name: "Qualificação Automática",
    trigger: "Palavra-chave: preço, valor, quanto",
    status: "draft",
    sessions: 0,
    conversions: 0,
    totalSent: 0,
    createdAt: "2024-04-07",
    description: "Qualifica leads que perguntam sobre preços",
  },
];

const TEMPLATES = [
  { id: "t1", name: "Boas-vindas", description: "Receba novos contatos com uma mensagem automática", icon: "👋", color: "bg-blue-50 border-blue-200" },
  { id: "t2", name: "Qualificação de Leads", description: "Perguntas automáticas para qualificar prospects", icon: "🎯", color: "bg-purple-50 border-purple-200" },
  { id: "t3", name: "Suporte / FAQ", description: "Responde dúvidas frequentes automaticamente", icon: "💬", color: "bg-green-50 border-green-200" },
  { id: "t4", name: "Pós-venda", description: "Acompanhamento e NPS após compra finalizada", icon: "⭐", color: "bg-yellow-50 border-yellow-200" },
  { id: "t5", name: "Recuperação", description: "Reengaja leads que sumiram ou abandonaram carrinho", icon: "🔄", color: "bg-red-50 border-red-200" },
  { id: "t6", name: "Do zero", description: "Crie seu fluxo personalizado do início", icon: "✨", color: "bg-gray-50 border-gray-200" },
];

const statusConfig = {
  active: { label: "Ativo", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  paused: { label: "Pausado", color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400" },
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
};

export default function BotsPage() {
  const router = useRouter();
  const [bots, setBots] = useState<BotFlow[]>(MOCK_BOTS);
  const [showNew, setShowNew] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleStatus = (id: string) => {
    setBots((prev) =>
      prev.map((b) => b.id === id ? { ...b, status: b.status === "active" ? "paused" : "active" } : b)
    );
  };

  const deleteBot = (id: string) => {
    setBots((prev) => prev.filter((b) => b.id !== id));
    setOpenMenu(null);
  };

  const totalActive = bots.filter((b) => b.status === "active").length;
  const totalSessions = bots.reduce((a, b) => a + b.sessions, 0);
  const avgConversion =
    bots.filter((b) => b.totalSent > 0).length > 0
      ? Math.round((bots.reduce((a, b) => a + b.conversions, 0) / bots.reduce((a, b) => a + b.totalSent, 0)) * 100)
      : 0;

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <div className="p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Bots & Automações</h1>
            <p className="text-sm text-gray-400 mt-0.5">Fluxos automáticos de atendimento e vendas</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar Bot
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Bots Ativos", value: totalActive, icon: <Zap className="w-4 h-4" />, color: "text-green-600 bg-green-50" },
            { label: "Sessões Totais", value: totalSessions, icon: <Users className="w-4 h-4" />, color: "text-blue-600 bg-blue-50" },
            { label: "Taxa de Conversão", value: `${avgConversion}%`, icon: <TrendingUp className="w-4 h-4" />, color: "text-brand-600 bg-brand-50" },
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

        {/* Bots list */}
        <div className="space-y-3">
          {bots.map((bot) => {
            const st = statusConfig[bot.status];
            const convRate = bot.totalSent > 0 ? Math.round((bot.conversions / bot.totalSent) * 100) : 0;

            return (
              <div key={bot.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="p-2.5 bg-brand-50 rounded-xl shrink-0">
                      <Bot className="w-5 h-5 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-sm">{bot.name}</h3>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${st.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>
                      {bot.description && <p className="text-xs text-gray-400 mt-0.5">{bot.description}</p>}
                      <div className="flex items-center gap-1.5 mt-2">
                        <Zap className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">{bot.trigger}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Sessões</p>
                      <p className="text-sm font-bold text-gray-800">{bot.sessions}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Conversão</p>
                      <p className="text-sm font-bold text-gray-800">{convRate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Enviados</p>
                      <p className="text-sm font-bold text-gray-800">{bot.totalSent}</p>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => toggleStatus(bot.id)}
                        className={`p-2 rounded-xl transition-colors ${
                          bot.status === "active"
                            ? "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                            : "bg-green-50 text-green-600 hover:bg-green-100"
                        }`}
                        title={bot.status === "active" ? "Pausar" : "Ativar"}
                      >
                        {bot.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/bots/editor?id=${bot.id}&name=${encodeURIComponent(bot.name)}`)}
                        className="p-2 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                        title="Editar fluxo"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === bot.id ? null : bot.id)}
                          className="p-2 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenu === bot.id && (
                          <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                              <Copy className="w-3.5 h-3.5" /> Duplicar
                            </button>
                            <button
                              onClick={() => deleteBot(bot.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {bots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bot className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum bot criado ainda</p>
            <p className="text-xs mt-1 opacity-70">Crie seu primeiro fluxo automático</p>
            <button
              onClick={() => router.push("/dashboard/bots/editor?name=Novo+Bot")}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar Bot
            </button>
          </div>
        )}
      </div>

      {/* New bot modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Criar Bot</h2>
                <p className="text-sm text-gray-400">Escolha um template para começar</p>
              </div>
              <button onClick={() => setShowNew(false)} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    setShowNew(false);
                    router.push(`/dashboard/bots/editor?name=${encodeURIComponent(tpl.name)}`);
                  }}
                  className={`flex items-start gap-3 p-4 rounded-2xl border text-left hover:shadow-md transition-all group ${tpl.color}`}
                >
                  <span className="text-2xl">{tpl.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{tpl.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tpl.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
