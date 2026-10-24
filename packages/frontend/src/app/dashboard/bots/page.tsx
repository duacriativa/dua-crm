"use client";

import { useCallback, useEffect, useState } from "react";
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
  FlaskConical,
  Loader2,
} from "lucide-react";
import { fetchTemplates } from "@/components/whatsapp/templates";
import { Bot as BotFlow, botsApi, findFollowupTemplate, findFormTemplate, formBotPreset, formQualifyPreset } from "@/components/bots/bot-api";

// Os prontos já funcionam; os outros entram conforme forem migrados do Kommo
const TEMPLATES = [
  { id: "form", name: "Cadastro no site", description: "1ª mensagem no WhatsApp para quem preencheu o formulário (igual ao Kommo)", icon: "📝", color: "bg-blue-50 border-blue-200", ready: true },
  { id: "qualify", name: "Qualificação do cadastro no site", description: "1ª mensagem + follow-up, entende o momento da marca e convida para a call (roteiro Dua Lab)", icon: "🎯", color: "bg-purple-50 border-purple-200", ready: true },
  { id: "t3", name: "Follow-up", description: "Reengaja leads que pararam de responder", icon: "🔄", color: "bg-red-50 border-red-200", ready: false },
  { id: "t4", name: "Pós-venda / NPS", description: "Acompanhamento e NPS após a venda fechada", icon: "⭐", color: "bg-yellow-50 border-yellow-200", ready: false },
];

const statusConfig = {
  active: { label: "Ativo", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  paused: { label: "Pausado", color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400" },
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
};

const statusOf = (b: BotFlow) => (b.active ? "active" : "paused") as keyof typeof statusConfig;

export default function BotsPage() {
  const [bots, setBots] = useState<BotFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const router = useRouter();
  const openEditor = (id: string) => router.push(`/dashboard/bots/editor?id=${id}`);

  const load = useCallback(() => {
    botsApi.list()
      .then((data) => { setBots(data); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Contadores mudam sozinhos enquanto os bots rodam
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const toggleStatus = async (bot: BotFlow) => {
    if (bot.active && bot.stats.active > 0 && !confirm(`Pausar encerra ${bot.stats.active} sessão(ões) em andamento. Continuar?`)) return;
    try {
      await botsApi.update(bot.id, { active: !bot.active });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const deleteBot = async (bot: BotFlow) => {
    setOpenMenu(null);
    if (!confirm(`Excluir o bot "${bot.name}" e o histórico de sessões?`)) return;
    await botsApi.remove(bot.id).catch((e) => alert(e.message));
    load();
  };

  const duplicateBot = async (bot: BotFlow) => {
    setOpenMenu(null);
    await botsApi.create({ name: `${bot.name} (cópia)`, description: bot.description, trigger: bot.trigger, conditions: bot.conditions, actions: bot.actions, active: false })
      .catch((e) => alert(e.message));
    load();
  };

  const createFromTemplate = async (id: string) => {
    if (id !== "form" && id !== "qualify") return;
    setCreating(true);
    try {
      const templates = await fetchTemplates().catch(() => []);
      const preset = id === "form"
        ? formBotPreset(findFormTemplate(templates))
        : formQualifyPreset(findFormTemplate(templates), findFollowupTemplate(templates));
      const bot = await botsApi.create(preset);
      setShowNew(false);
      openEditor(bot.id);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const totalActive = bots.filter((b) => b.active).length;
  const totalSessions = bots.reduce((a, b) => a + b.stats.sessions, 0);
  const totalReplied = bots.reduce((a, b) => a + b.stats.replied, 0);
  const avgConversion = totalSessions > 0 ? Math.round((totalReplied / totalSessions) * 100) : 0;

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
            { label: "Taxa de Resposta", value: `${avgConversion}%`, icon: <TrendingUp className="w-4 h-4" />, color: "text-brand-600 bg-brand-50" },
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
            const st = statusConfig[statusOf(bot)];
            const convRate = bot.stats.sessions > 0 ? Math.round((bot.stats.replied / bot.stats.sessions) * 100) : 0;
            const testOnly = (bot.conditions?.onlyPhones ?? []).length > 0;

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
                        {testOnly && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-50 text-amber-700" title={bot.conditions.onlyPhones!.join(", ")}>
                            <FlaskConical className="w-3 h-3" /> Só números de teste
                          </span>
                        )}
                        {bot.stats.active > 0 && (
                          <span className="text-[11px] text-blue-600">{bot.stats.active} em andamento</span>
                        )}
                        {bot.stats.failed > 0 && (
                          <span className="text-[11px] text-red-600">{bot.stats.failed} com falha</span>
                        )}
                      </div>
                      {bot.description && <p className="text-xs text-gray-400 mt-0.5">{bot.description}</p>}
                      <div className="flex items-center gap-1.5 mt-2">
                        <Zap className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">{bot.triggerLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Sessões</p>
                      <p className="text-sm font-bold text-gray-800">{bot.stats.sessions}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-0.5" title="Contatos que responderam durante o bot">Resposta</p>
                      <p className="text-sm font-bold text-gray-800">{convRate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Enviados</p>
                      <p className="text-sm font-bold text-gray-800">{bot.stats.sent}</p>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => toggleStatus(bot)}
                        className={`p-2 rounded-xl transition-colors ${
                          bot.active
                            ? "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                            : "bg-green-50 text-green-600 hover:bg-green-100"
                        }`}
                        title={bot.active ? "Pausar" : "Ativar"}
                      >
                        {bot.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openEditor(bot.id)}
                        className="p-2 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                        title="Configurar"
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
                            <button onClick={() => duplicateBot(bot)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                              <Copy className="w-3.5 h-3.5" /> Duplicar
                            </button>
                            <button
                              onClick={() => deleteBot(bot)}
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

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {loading && (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        )}

        {!loading && bots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bot className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum bot criado ainda</p>
            <p className="text-xs mt-1 opacity-70">Crie seu primeiro fluxo automático</p>
            <button
              onClick={() => setShowNew(true)}
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
                <p className="text-sm text-gray-400">Escolha um modelo para começar (o bot nasce pausado)</p>
              </div>
              <button onClick={() => setShowNew(false)} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  disabled={!tpl.ready || creating}
                  onClick={() => createFromTemplate(tpl.id)}
                  className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all group ${tpl.color} ${tpl.ready ? "hover:shadow-md" : "opacity-50 cursor-not-allowed"}`}
                >
                  <span className="text-2xl">{tpl.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{tpl.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tpl.description}</p>
                    {!tpl.ready && <p className="text-[11px] text-gray-400 mt-1">Em breve</p>}
                  </div>
                  {tpl.ready && (creating
                    ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0 mt-0.5" />
                    : <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors shrink-0 mt-0.5" />)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
