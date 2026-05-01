"use client";

import { useState } from "react";
import {
  Plus, Search, FileText, Clock, CheckCircle, Layers,
  X, Check, ChevronRight, RefreshCw, Settings, Layout,
  Image as ImageIcon, Video, Briefcase, Globe, Hash, ToggleLeft,
} from "lucide-react";

/* ── Tipos ── */
type BriefingType = "logo"|"landing"|"social"|"branding"|"video"|"outro";
type BriefingStatus = "pending"|"answered"|"draft";

interface Briefing {
  id: string; client: string; type: BriefingType;
  status: BriefingStatus; createdAt: string; answeredAt?: string;
}

interface Question { id: string; text: string; type: "short"|"long"|"select"|"boolean"; required: boolean; }

/* ── Templates padrão ── */
const TEMPLATES: Record<BriefingType, { label: string; icon: any; questions: Question[] }> = {
  logo: {
    label: "Logo", icon: Hash,
    questions: [
      { id: "1", text: "Qual o nome da marca?", type: "short", required: true },
      { id: "2", text: "Descreva o negócio em 2-3 frases", type: "long", required: true },
      { id: "3", text: "Qual o público-alvo?", type: "short", required: true },
      { id: "4", text: "Tem alguma referência visual?", type: "long", required: false },
      { id: "5", text: "Tem alguma cor preferida?", type: "short", required: false },
      { id: "6", text: "Já tem manual de marca?", type: "boolean", required: false },
      { id: "7", text: "Prazo desejado", type: "short", required: true },
      { id: "8", text: "Observações adicionais", type: "long", required: false },
    ],
  },
  landing: {
    label: "Landing Page", icon: Globe,
    questions: [
      { id: "1", text: "Qual o objetivo da página?", type: "long", required: true },
      { id: "2", text: "Qual o produto/serviço oferecido?", type: "short", required: true },
      { id: "3", text: "Qual o público-alvo?", type: "short", required: true },
      { id: "4", text: "Tem domínio registrado?", type: "boolean", required: true },
      { id: "5", text: "Referências de páginas que gosta", type: "long", required: false },
      { id: "6", text: "Textos e copywriting já definidos?", type: "boolean", required: false },
      { id: "7", text: "Prazo desejado", type: "short", required: true },
    ],
  },
  social: {
    label: "Social Media / Criativos", icon: ImageIcon,
    questions: [
      { id: "1", text: "Quais redes sociais serão trabalhadas?", type: "short", required: true },
      { id: "2", text: "Quantos posts por semana?", type: "short", required: true },
      { id: "3", text: "Tem manual de marca?", type: "boolean", required: true },
      { id: "4", text: "Quais temas/assuntos abordar?", type: "long", required: true },
      { id: "5", text: "Perfis de referência", type: "short", required: false },
      { id: "6", text: "Tom de voz da marca", type: "short", required: true },
      { id: "7", text: "Observações adicionais", type: "long", required: false },
    ],
  },
  branding: {
    label: "Branding / Identidade Visual", icon: Layers,
    questions: [
      { id: "1", text: "Nome da marca", type: "short", required: true },
      { id: "2", text: "Missão, visão e valores", type: "long", required: false },
      { id: "3", text: "Público-alvo detalhado", type: "long", required: true },
      { id: "4", text: "Marcas que admira (referências)", type: "long", required: false },
      { id: "5", text: "Palavras que definem a marca", type: "short", required: true },
      { id: "6", text: "Cores que você gosta / não gosta", type: "short", required: false },
      { id: "7", text: "Prazo desejado", type: "short", required: true },
    ],
  },
  video: {
    label: "Vídeo / Motion", icon: Video,
    questions: [
      { id: "1", text: "Tipo de vídeo desejado", type: "short", required: true },
      { id: "2", text: "Duração estimada", type: "short", required: true },
      { id: "3", text: "Roteiro já está definido?", type: "boolean", required: true },
      { id: "4", text: "Referências de vídeos que gosta", type: "long", required: false },
      { id: "5", text: "Trilha sonora / estilo musical", type: "short", required: false },
      { id: "6", text: "Prazo de entrega", type: "short", required: true },
    ],
  },
  outro: {
    label: "Outro", icon: FileText,
    questions: [
      { id: "1", text: "Descreva o projeto", type: "long", required: true },
      { id: "2", text: "Objetivo principal", type: "long", required: true },
      { id: "3", text: "Prazo desejado", type: "short", required: true },
      { id: "4", text: "Referências", type: "long", required: false },
      { id: "5", text: "Observações adicionais", type: "long", required: false },
    ],
  },
};

const TYPE_LABELS: Record<BriefingType, string> = {
  logo: "Logo", landing: "Landing Page", social: "Social Media / Criativos",
  branding: "Branding / Identidade Visual", video: "Vídeo / Motion", outro: "Outro",
};
const STATUS_CONFIG: Record<BriefingStatus, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  answered: { label: "Respondido", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  draft: { label: "Rascunho", color: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const inp = "w-full px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground";

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modais
  const [showTypeSelect, setShowTypeSelect] = useState(false);
  const [selectedType, setSelectedType] = useState<BriefingType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [showTemplates, setShowTemplates] = useState(false);
  const [showExtraQ, setShowExtraQ] = useState(false);
  const [extraQType, setExtraQType] = useState<BriefingType>("logo");
  const [newQ, setNewQ] = useState({ text: "", type: "short" as Question["type"], required: false });

  const filtered = briefings.filter(b => {
    const matchSearch = b.client.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    const matchType = typeFilter === "all" || b.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const createBriefing = () => {
    if (!selectedType || !clientName.trim()) return;
    const b: Briefing = {
      id: Date.now().toString(), client: clientName, type: selectedType,
      status: "pending", createdAt: new Date().toISOString(),
    };
    setBriefings(prev => [b, ...prev]);
    setShowForm(false);
    setClientName(""); setAnswers({}); setSelectedType(null);
  };

  const stats = {
    total: briefings.length,
    pending: briefings.filter(b => b.status === "pending").length,
    answered: briefings.filter(b => b.status === "answered").length,
    types: Object.keys(TEMPLATES).length,
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-xl px-6 py-5 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Briefings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie os briefings dos seus clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <Layout className="w-4 h-4" />Meus Templates
            </button>
            <button onClick={() => setShowExtraQ(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <Settings className="w-4 h-4" />Perguntas Extra
            </button>
            <button onClick={() => setShowTypeSelect(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity shadow-elegant">
              <Plus className="w-4 h-4" />Novo Briefing
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "Total", value: stats.total, icon: FileText, color: "text-violet-400" },
            { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-amber-400" },
            { label: "Respondidos", value: stats.answered, icon: CheckCircle, color: "text-emerald-400" },
            { label: "Tipos", value: stats.types, icon: Layers, color: "text-blue-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="surface-card p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <div>
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none text-foreground">
            <option value="all">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="answered">Respondido</option>
            <option value="draft">Rascunho</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none text-foreground">
            <option value="all">Todos os tipos</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto scrollbar-none p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
              <FileText className="w-8 h-8 opacity-30" />
            </div>
            <p className="font-medium">Nenhum briefing encontrado</p>
            <p className="text-xs opacity-60">Crie seu primeiro briefing para enviar aos clientes</p>
            <button onClick={() => setShowTypeSelect(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" />Criar Briefing
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(b => {
              const tmpl = TEMPLATES[b.type];
              const Icon = tmpl.icon;
              const st = STATUS_CONFIG[b.status];
              return (
                <div key={b.id} className="surface-card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{b.client}</p>
                    <p className="text-xs text-muted-foreground">{TYPE_LABELS[b.type]} · {new Date(b.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${st.color}`}>{st.label}</span>
                  <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Selecionar tipo ── */}
      {showTypeSelect && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">Selecione o Tipo de Briefing</h2>
              <button onClick={() => setShowTypeSelect(false)} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {(Object.entries(TEMPLATES) as [BriefingType, typeof TEMPLATES[BriefingType]][]).map(([key, tmpl]) => {
                const Icon = tmpl.icon;
                return (
                  <button key={key} onClick={() => setSelectedType(key)}
                    className={`surface-card p-4 text-left hover:border-primary/40 transition-all ${selectedType === key ? "border-primary bg-primary/5" : ""}`}>
                    <Icon className="w-5 h-5 text-primary mb-2" />
                    <p className="font-semibold text-foreground text-sm">{tmpl.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tmpl.questions.length} perguntas</p>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { if (selectedType) { setShowTypeSelect(false); setShowForm(true); } }}
              disabled={!selectedType}
              className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Formulário do briefing ── */}
      {showForm && selectedType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-bold text-foreground">Novo Briefing — {TEMPLATES[selectedType].label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{TEMPLATES[selectedType].questions.length} perguntas</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Cliente *</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Nome do cliente" className={inp} autoFocus />
              </div>
              {TEMPLATES[selectedType].questions.map((q, i) => (
                <div key={q.id}>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    {i + 1}. {q.text} {q.required && <span className="text-red-400">*</span>}
                  </label>
                  {q.type === "long" ? (
                    <textarea rows={3} value={answers[q.id] ?? ""} onChange={e => setAnswers(a => ({...a, [q.id]: e.target.value}))}
                      className={`${inp} resize-none`} />
                  ) : q.type === "boolean" ? (
                    <div className="flex gap-2">
                      {["Sim","Não","Não sei"].map(opt => (
                        <button key={opt} onClick={() => setAnswers(a => ({...a, [q.id]: opt}))}
                          className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${answers[q.id] === opt ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input value={answers[q.id] ?? ""} onChange={e => setAnswers(a => ({...a, [q.id]: e.target.value}))}
                      placeholder="Sua resposta..." className={inp} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
                Cancelar
              </button>
              <button onClick={createBriefing} disabled={!clientName.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />Criar Briefing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Meus Templates ── */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">Meus Templates de Briefing</h2>
              <button onClick={() => setShowTemplates(false)} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Templates Personalizados</p>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
                <Plus className="w-3.5 h-3.5" />Criar Template
              </button>
            </div>
            <div className="surface-card flex flex-col items-center py-10 gap-3 text-muted-foreground mb-5">
              <FileText className="w-8 h-8 opacity-20" />
              <p className="text-sm font-medium">Nenhum template personalizado</p>
              <p className="text-xs opacity-60">Crie do zero ou importe um template padrão abaixo</p>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-xl hover:bg-muted/50 transition-colors text-foreground">
                <Plus className="w-3.5 h-3.5" />Criar Template
              </button>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Templates Padrão (importe para personalizar)</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(TEMPLATES) as [BriefingType, typeof TEMPLATES[BriefingType]][]).map(([key, tmpl]) => {
                const Icon = tmpl.icon;
                return (
                  <div key={key} className="surface-card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{tmpl.label}</p>
                        <p className="text-xs text-muted-foreground">{tmpl.questions.length} perguntas</p>
                      </div>
                    </div>
                    <button className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Perguntas Extra ── */}
      {showExtraQ && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">Perguntas Customizadas</h2>
              <button onClick={() => setShowExtraQ(false)} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            {/* Tabs de tipo */}
            <div className="flex gap-1 overflow-x-auto scrollbar-none mb-4">
              {(Object.entries(TEMPLATES) as [BriefingType, any][]).map(([key, tmpl]) => (
                <button key={key} onClick={() => setExtraQType(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-colors ${extraQType === key ? "bg-primary text-white" : "border border-border text-muted-foreground hover:bg-muted/50"}`}>
                  {tmpl.label}
                </button>
              ))}
            </div>
            <div className="surface-card flex flex-col items-center py-8 gap-2 text-muted-foreground mb-4">
              <p className="text-sm font-medium">Nenhuma pergunta customizada para {TEMPLATES[extraQType].label}</p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Adicionar Nova Pergunta</p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Pergunta</label>
                <input value={newQ.text} onChange={e => setNewQ(q => ({...q, text: e.target.value}))}
                  placeholder="Digite a pergunta..." className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo de Resposta</label>
                  <select value={newQ.type} onChange={e => setNewQ(q => ({...q, type: e.target.value as any}))}
                    className={`${inp} appearance-none`}>
                    <option value="short">Texto curto</option>
                    <option value="long">Texto longo</option>
                    <option value="boolean">Sim/Não</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <span className="text-xs text-muted-foreground">Obrigatório?</span>
                    <button onClick={() => setNewQ(q => ({...q, required: !q.required}))}
                      className={`w-9 h-5 rounded-full transition-colors relative ${newQ.required ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${newQ.required ? "left-4" : "left-0.5"}`} />
                    </button>
                  </label>
                </div>
              </div>
              <button disabled={!newQ.text.trim()}
                className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />Adicionar Pergunta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
