"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, Instagram, Tag, Calendar,
  DollarSign, MessageCircle, Edit, MoreVertical,
  User, Clock, Globe, Filter, Briefcase, Search,
  Save, ChevronRight, Sparkles, AlertTriangle, TrendingUp,
  Star, Zap
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

interface Contact {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  instagramHandle?: string | null;
  tags?: string[];
  notes?: string | null;
  analysisInstagram?: string | null;
  segment?: string;
  createdAt: string;
  updatedAt: string;
  pipelineLeads?: any[];
}

interface InstagramAnalysis {
  score?: number;
  resumo?: string;
  pontos_fortes?: string[];
  oportunidades?: string[];
  alertas?: string[];
  estrategia_recomendada?: string;
  mensagem_whatsapp?: string;
}

const LOADING_STEPS = [
  "Buscando perfil...",
  "Analisando conteúdo...",
  "Gerando estratégia...",
  "Escrevendo mensagem...",
];

export default function ContactProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Instagram analysis state
  const [analysisText, setAnalysisText] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisSaving, setAnalysisSaving] = useState(false);
  const [analysisSaved, setAnalysisSaved] = useState(false);
  const [parsedAnalysis, setParsedAnalysis] = useState<InstagramAnalysis | null>(null);

  const fetchContact = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/contacts/${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Não foi possível carregar os dados do contato.");
      const data = await res.json();
      setContact(data);
      if (data.analysisInstagram) {
        setAnalysisText(data.analysisInstagram);
        tryParseAnalysis(data.analysisInstagram);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchContact();
  }, [id, fetchContact]);

  function tryParseAnalysis(text: string) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setParsedAnalysis(parsed);
      }
    } catch {
      // keep raw text if parse fails
    }
  }

  async function handleGenerateAnalysis() {
    if (!contact?.instagramHandle) return;
    setAnalysisLoading(true);
    setAnalysisStep(0);
    setAnalysisText("");
    setParsedAnalysis(null);
    setAnalysisSaved(false);

    // Animate loading steps
    let step = 0;
    const stepInterval = setInterval(() => {
      step = (step + 1) % LOADING_STEPS.length;
      setAnalysisStep(step);
    }, 1800);

    try {
      const res = await fetch(`${API_URL}/api/v1/contacts/${id}/analyze-instagram`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao gerar análise.");
      setAnalysisText(data.analysis || "");
      if (data.parsed) setParsedAnalysis(data.parsed);
      else tryParseAnalysis(data.analysis || "");
    } catch (err: any) {
      setAnalysisText(`Erro: ${err.message}`);
    } finally {
      clearInterval(stepInterval);
      setAnalysisLoading(false);
    }
  }

  async function handleSaveAnalysis() {
    setAnalysisSaving(true);
    try {
      await fetch(`${API_URL}/api/v1/contacts/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ analysisInstagram: analysisText }),
      });
      setAnalysisSaved(true);
      setTimeout(() => setAnalysisSaved(false), 3000);
    } catch {
      // silent fail
    } finally {
      setAnalysisSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <User className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Contato não encontrado</h2>
        <p className="max-w-xs text-center text-sm mb-6">{error || "O perfil solicitado não está disponível ou foi removido."}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para contatos
        </button>
      </div>
    );
  }

  // Parse fields from notes if they follow our [Formulário] pattern
  const parseFields = () => {
    const fields: any = {};
    if (contact.notes) {
      const notes = contact.notes;
      if (notes.includes("Investimento atual:")) fields.investimento = notes.split("Investimento atual:")[1].split("\n")[0].trim();
      if (notes.includes("Faturamento:")) fields.faturamento = notes.split("Faturamento:")[1].split("\n")[0].trim();
      if (notes.includes("Atendimento de leads:")) fields.atendimento = notes.split("Atendimento de leads:")[1].split("\n")[0].trim();
      if (notes.includes("Interesse:")) fields.interesse = notes.split("Interesse:")[1].split("\n")[0].trim();
    }
    return fields;
  };

  const aditionalFields = parseFields();

  return (
    <div className="h-full flex flex-col bg-[#F9FAFB]">
      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 border border-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{contact.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <User size={12} /> Perfil do Contato
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="text-xs font-semibold text-brand-600 uppercase tracking-widest bg-brand-50 px-2 py-0.5 rounded-full">
                  {contact.segment || "NEW"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/dashboard/conversas?phone=${encodeURIComponent(contact.phone || "")}&name=${encodeURIComponent(contact.name || "")}`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition-all shadow-md shadow-brand-100"
            >
              <MessageCircle className="w-4 h-4" />
              Abrir Chat
            </button>
            <button className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Coluna Esquerda */}
          <div className="lg:col-span-2 space-y-6">

            {/* Card: Dados do Perfil */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <User size={120} />
              </div>

              <div className="flex items-start gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                  <Briefcase size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Perfil do Negócio</h2>
                  <p className="text-sm text-gray-400">Informações coletadas durante o cadastro</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition-all hover:bg-white hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-green-600">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Faturamento Mensal</p>
                      <p className="text-sm font-semibold text-gray-800">{aditionalFields.faturamento || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition-all hover:bg-white hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-purple-600">
                      <Tag size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Modelo de Venda</p>
                      <p className="text-sm font-semibold text-gray-800">Instagram/WhatsApp</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition-all hover:bg-white hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-blue-600">
                      <Filter size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Investimento Atual</p>
                      <p className="text-sm font-semibold text-gray-800">{aditionalFields.investimento || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition-all hover:bg-white hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-orange-600">
                      <ArrowLeft size={20} className="rotate-180" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Interesse</p>
                      <p className="text-sm font-semibold text-gray-800">{aditionalFields.interesse || "Não informado"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Notas e Observações */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Filter size={20} />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Notas e Observações</h2>
                </div>
                <button className="text-sm text-brand-600 font-bold hover:underline flex items-center gap-1">
                  <Edit size={14} /> Editar
                </button>
              </div>
              <div className="bg-amber-50/30 rounded-2xl p-6 border border-amber-100/50">
                <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">
                  {contact.notes || "Nenhuma nota adicionada a este contato."}
                </p>
              </div>
            </div>

            {/* ── Card: Análise de Perfil Instagram ── */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white">
                  <Instagram size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Análise de Perfil Instagram</h2>
                  <p className="text-xs text-gray-400">
                    {contact.instagramHandle
                      ? `@${contact.instagramHandle.replace("@", "")}`
                      : "Nenhum Instagram cadastrado"}
                  </p>
                </div>
                {parsedAnalysis?.score !== undefined && (
                  <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 border border-purple-100">
                    <Sparkles size={14} className="text-purple-600" />
                    <span className="text-sm font-bold text-purple-700">Score</span>
                    <span className="text-xl font-black text-purple-600">{parsedAnalysis.score}</span>
                    <span className="text-xs text-purple-400">/100</span>
                  </div>
                )}
              </div>

              {/* Trigger button */}
              {!analysisLoading && !analysisText && (
                <button
                  onClick={handleGenerateAnalysis}
                  disabled={!contact.instagramHandle}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  <Search size={16} /> 🔍 Gerar análise
                </button>
              )}

              {/* Loading state */}
              {analysisLoading && (
                <div className="flex flex-col items-center gap-6 py-8">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-purple-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Instagram size={20} className="text-purple-600" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    {LOADING_STEPS.map((step, i) => (
                      <div
                        key={step}
                        className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                          i === analysisStep
                            ? "text-purple-700 font-bold scale-105"
                            : i < analysisStep
                            ? "text-green-500 line-through opacity-60"
                            : "text-gray-300"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          i === analysisStep ? "bg-purple-500 animate-pulse" :
                          i < analysisStep ? "bg-green-400" : "bg-gray-200"
                        }`} />
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Result — parsed view */}
              {!analysisLoading && parsedAnalysis && (
                <div className="space-y-5 mt-2">
                  {parsedAnalysis.resumo && (
                    <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
                      <p className="text-sm text-purple-900 leading-relaxed">{parsedAnalysis.resumo}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parsedAnalysis.pontos_fortes && parsedAnalysis.pontos_fortes.length > 0 && (
                      <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                        <div className="flex items-center gap-2 mb-3">
                          <Star size={14} className="text-green-600" />
                          <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Pontos Fortes</span>
                        </div>
                        <ul className="space-y-1.5">
                          {parsedAnalysis.pontos_fortes.map((p, i) => (
                            <li key={i} className="text-xs text-green-800 flex gap-2">
                              <span className="text-green-400 mt-0.5">•</span>{p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsedAnalysis.oportunidades && parsedAnalysis.oportunidades.length > 0 && (
                      <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp size={14} className="text-blue-600" />
                          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Oportunidades</span>
                        </div>
                        <ul className="space-y-1.5">
                          {parsedAnalysis.oportunidades.map((o, i) => (
                            <li key={i} className="text-xs text-blue-800 flex gap-2">
                              <span className="text-blue-400 mt-0.5">•</span>{o}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsedAnalysis.alertas && parsedAnalysis.alertas.length > 0 && (
                      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle size={14} className="text-amber-600" />
                          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Alertas</span>
                        </div>
                        <ul className="space-y-1.5">
                          {parsedAnalysis.alertas.map((a, i) => (
                            <li key={i} className="text-xs text-amber-800 flex gap-2">
                              <span className="text-amber-400 mt-0.5">•</span>{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsedAnalysis.estrategia_recomendada && (
                      <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                        <div className="flex items-center gap-2 mb-3">
                          <Zap size={14} className="text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Estratégia</span>
                        </div>
                        <p className="text-xs text-indigo-800 leading-relaxed">{parsedAnalysis.estrategia_recomendada}</p>
                      </div>
                    )}
                  </div>

                  {parsedAnalysis.mensagem_whatsapp && (
                    <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageCircle size={14} className="text-green-600" />
                        <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Mensagem WhatsApp Pronta</span>
                      </div>
                      <p className="text-sm text-green-900 leading-relaxed whitespace-pre-wrap">{parsedAnalysis.mensagem_whatsapp}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Textarea (raw/edit mode) */}
              {!analysisLoading && analysisText && (
                <div className="mt-4 space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Texto bruto / editar</label>
                  <textarea
                    value={analysisText}
                    onChange={(e) => {
                      setAnalysisText(e.target.value);
                      tryParseAnalysis(e.target.value);
                    }}
                    rows={6}
                    className="w-full border border-gray-200 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed resize-y focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveAnalysis}
                      disabled={analysisSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      <Save size={14} />
                      {analysisSaving ? "Salvando..." : analysisSaved ? "✓ Salvo!" : "Salvar análise"}
                    </button>
                    <button
                      onClick={handleGenerateAnalysis}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors border border-purple-100"
                    >
                      <Search size={14} /> Regenerar
                    </button>
                  </div>
                </div>
              )}

              {/* Gerar novamente se só mostra parsed sem text edit */}
              {!analysisLoading && parsedAnalysis && !analysisText.trim() === false && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleSaveAnalysis}
                    disabled={analysisSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    <Save size={14} />
                    {analysisSaving ? "Salvando..." : analysisSaved ? "✓ Salvo!" : "Salvar análise"}
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Coluna Direita */}
          <div className="space-y-6">

            {/* Contato Rápido */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-1">Informações de Contato</h3>

              <div className="space-y-4">
                <div className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter leading-none mb-1">WhatsApp</p>
                      <p className="text-sm font-semibold text-gray-800">{contact.phone || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter leading-none mb-1">E-mail</p>
                      <p className="text-sm font-semibold text-gray-800 truncate max-w-[140px]">{contact.email || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600">
                      <Instagram size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter leading-none mb-1">Instagram</p>
                      <p className="text-sm font-semibold text-gray-800">{contact.instagramHandle ? `@${contact.instagramHandle.replace('@', '')}` : "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline do Lead */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-1">Histórico do CRM</h3>

              <div className="space-y-6">
                <div className="relative pl-6 border-l-2 border-gray-100 pb-1">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-brand-500 shadow-sm" />
                  <p className="text-xs font-bold text-gray-800">Primeiro Cadastro</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Calendar size={10} /> {new Date(contact.createdAt).toLocaleDateString("pt-BR")} às {new Date(contact.createdAt).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="relative pl-6 border-l-2 border-gray-100 pb-1">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-gray-200 shadow-sm" />
                  <p className="text-xs font-bold text-gray-600">Última Atualização</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock size={10} /> {new Date(contact.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-1">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {contact.tags && contact.tags.length > 0 ? (
                  contact.tags.map(tag => (
                    <span key={tag} className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-gray-600 text-[11px] font-bold rounded-xl whitespace-nowrap">
                      {tag}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-gray-300 px-1 italic">Nenhuma tag</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
