"use client";

import { useState } from "react";
import {
  Plus, Search, FileText, Clock, CheckCircle, Layers,
  X, Check, ChevronRight, Settings, Layout,
  Image as ImageIcon, Video, Globe, Hash, Trash2,
  Link2, Copy, Send, GripVertical, ChevronDown,
  Pencil, Eye, ArrowLeft,
} from "lucide-react";

/* ── Tipos ── */
type BriefingType = "logo"|"landing"|"social"|"branding"|"video"|"personalizado";
type BriefingStatus = "pending"|"answered"|"draft";
type QuestionType = "short"|"long"|"select"|"boolean"|"number";

interface Question {
  id: string; text: string; type: QuestionType; required: boolean; options?: string[];
}
interface BriefingTemplate {
  id: string; name: string; type: BriefingType;
  questions: Question[]; isCustom?: boolean; createdAt: string;
}
interface Briefing {
  id: string; client: string; templateId: string; templateName: string;
  status: BriefingStatus; createdAt: string; answeredAt?: string;
  answers?: Record<string, string>;
}

/* ── Templates padrão ── */
const DEFAULT_TEMPLATES: BriefingTemplate[] = [
  {
    id: "logo", name: "Logo", type: "logo", createdAt: "",
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
  {
    id: "landing", name: "Landing Page", type: "landing", createdAt: "",
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
  {
    id: "social", name: "Social Media / Criativos", type: "social", createdAt: "",
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
  {
    id: "branding", name: "Branding / Identidade Visual", type: "branding", createdAt: "",
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
  {
    id: "video", name: "Vídeo / Motion", type: "video", createdAt: "",
    questions: [
      { id: "1", text: "Tipo de vídeo desejado", type: "short", required: true },
      { id: "2", text: "Duração estimada", type: "short", required: true },
      { id: "3", text: "Roteiro já está definido?", type: "boolean", required: true },
      { id: "4", text: "Referências de vídeos que gosta", type: "long", required: false },
      { id: "5", text: "Trilha sonora / estilo musical", type: "short", required: false },
      { id: "6", text: "Prazo de entrega", type: "short", required: true },
    ],
  },
];

const TYPE_ICONS: Record<BriefingType, any> = {
  logo: Hash, landing: Globe, social: ImageIcon,
  branding: Layers, video: Video, personalizado: Pencil,
};
const STATUS_CONFIG: Record<BriefingStatus, { label: string; color: string }> = {
  pending:  { label: "Pendente",   color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  answered: { label: "Respondido", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  draft:    { label: "Rascunho",   color: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};
const Q_TYPE_LABELS: Record<QuestionType, string> = {
  short: "Texto curto", long: "Texto longo",
  select: "Múltipla escolha", boolean: "Sim / Não", number: "Número",
};

const inp = "w-full px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground";

/* ── Builder de Briefing Personalizado ── */
function CustomBuilder({
  onSave, onCancel, initial,
}: {
  onSave: (tmpl: BriefingTemplate) => void;
  onCancel: () => void;
  initial?: BriefingTemplate;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [questions, setQuestions] = useState<Question[]>(initial?.questions ?? []);
  const [newQ, setNewQ] = useState({ text: "", type: "short" as QuestionType, required: false });

  const addQ = () => {
    if (!newQ.text.trim()) return;
    setQuestions(qs => [...qs, { id: Date.now().toString(), ...newQ }]);
    setNewQ({ text: "", type: "short", required: false });
  };

  const removeQ = (id: string) => setQuestions(qs => qs.filter(q => q.id !== id));

  const save = () => {
    if (!name.trim() || questions.length === 0) return;
    onSave({
      id: initial?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      type: "personalizado",
      questions,
      isCustom: true,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border shrink-0">
          <button onClick={onCancel} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">
              {initial ? "Editar" : "Criar"} Briefing Personalizado
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Crie perguntas específicas para o seu projeto</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-5 space-y-5">
          {/* Nome do briefing */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Nome do Briefing <span className="text-red-400">*</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              placeholder="Ex: Onboarding Cliente Moda, Briefing Social Media Premium..."
              className={inp} />
          </div>

          {/* Lista de perguntas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">
                Perguntas <span className="text-muted-foreground text-xs">({questions.length})</span>
              </p>
            </div>

            {questions.length === 0 && (
              <div className="surface-card flex flex-col items-center py-8 gap-2 text-muted-foreground mb-3">
                <FileText className="w-7 h-7 opacity-20" />
                <p className="text-xs">Nenhuma pergunta adicionada ainda</p>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {questions.map((q, i) => (
                <div key={q.id} className="surface-card px-4 py-3 flex items-start gap-3">
                  <span className="text-xs font-bold text-muted-foreground mt-0.5 shrink-0 w-5 text-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{q.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        {Q_TYPE_LABELS[q.type]}
                      </span>
                      {q.required && (
                        <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                          Obrigatória
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => removeQ(q.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar pergunta */}
            <div className="surface-card p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                + Adicionar Pergunta
              </p>
              <input value={newQ.text} onChange={e => setNewQ(q => ({ ...q, text: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") addQ(); }}
                placeholder="Digite a pergunta..."
                className={inp} />
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[140px]">
                  <select value={newQ.type} onChange={e => setNewQ(q => ({ ...q, type: e.target.value as QuestionType }))}
                    className={`${inp} appearance-none pr-8`}>
                    {Object.entries(Q_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <button onClick={() => setNewQ(q => ({ ...q, required: !q.required }))}
                    className={`w-9 h-5 rounded-full transition-colors relative ${newQ.required ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${newQ.required ? "left-4" : "left-0.5"}`} />
                  </button>
                  <span className="text-xs text-muted-foreground">Obrigatória</span>
                </label>
                <button onClick={addQ} disabled={!newQ.text.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0">
                  <Plus className="w-4 h-4" />Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0 pb-safe">
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={!name.trim() || questions.length === 0}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            {initial ? "Salvar alterações" : "Salvar Briefing"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal: Preencher Briefing ── */
function FillBriefingModal({
  template, onSave, onCancel,
}: {
  template: BriefingTemplate;
  onSave: (b: Briefing) => void;
  onCancel: () => void;
}) {
  const [client, setClient] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const save = () => {
    if (!client.trim()) return;
    onSave({
      id: Date.now().toString(), client: client.trim(),
      templateId: template.id, templateName: template.name,
      status: "pending", createdAt: new Date().toISOString(), answers,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">{template.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{template.questions.length} perguntas</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Cliente <span className="text-red-400">*</span>
            </label>
            <input value={client} onChange={e => setClient(e.target.value)} autoFocus
              placeholder="Nome do cliente" className={inp} />
          </div>
          {template.questions.map((q, i) => (
            <div key={q.id}>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                {i + 1}. {q.text}{q.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {q.type === "long" ? (
                <textarea rows={3} value={answers[q.id] ?? ""}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  className={`${inp} resize-none`} placeholder="Sua resposta..." />
              ) : q.type === "boolean" ? (
                <div className="flex gap-2">
                  {["Sim", "Não", "Não sei"].map(opt => (
                    <button key={opt} onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                      className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${answers[q.id] === opt ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : q.type === "number" ? (
                <input type="number" value={answers[q.id] ?? ""}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="0" className={inp} />
              ) : (
                <input value={answers[q.id] ?? ""}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Sua resposta..." className={inp} />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0 pb-safe">
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={!client.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />Salvar Briefing
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Página principal ── */
export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [customTemplates, setCustomTemplates] = useState<BriefingTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Estados dos modais
  const [showTypeSelect, setShowTypeSelect] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BriefingTemplate | undefined>();
  const [fillTemplate, setFillTemplate] = useState<BriefingTemplate | null>(null);
  const [showTemplatesMgr, setShowTemplatesMgr] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  const filtered = briefings.filter(b => {
    const matchSearch = b.client.toLowerCase().includes(search.toLowerCase()) ||
      b.templateName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    const matchType = typeFilter === "all" ||
      allTemplates.find(t => t.id === b.templateId)?.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const stats = {
    total: briefings.length,
    pending: briefings.filter(b => b.status === "pending").length,
    answered: briefings.filter(b => b.status === "answered").length,
    types: allTemplates.length,
  };

  const handleSaveTemplate = (tmpl: BriefingTemplate) => {
    setCustomTemplates(prev => {
      const idx = prev.findIndex(t => t.id === tmpl.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = tmpl; return n; }
      return [...prev, tmpl];
    });
    setShowBuilder(false);
    setEditingTemplate(undefined);
    // Abrir direto para preencher
    setFillTemplate(tmpl);
  };

  const handleSaveBriefing = (b: Briefing) => {
    setBriefings(prev => [b, ...prev]);
    setFillTemplate(null);
    setShowTypeSelect(false);
  };

  const copyLink = (briefingId: string) => {
    const link = `${window.location.origin}/briefing/${briefingId}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(briefingId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteTemplate = (id: string) => {
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
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
            <button onClick={() => setShowTemplatesMgr(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <Layout className="w-4 h-4" />Meus Templates
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
            { label: "Templates", value: stats.types, icon: Layers, color: "text-blue-400" },
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente ou briefing..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none text-foreground">
            <option value="all">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="answered">Respondido</option>
            <option value="draft">Rascunho</option>
          </select>
        </div>
      </div>

      {/* Lista de briefings */}
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
              const tmpl = allTemplates.find(t => t.id === b.templateId);
              const Icon = TYPE_ICONS[tmpl?.type ?? "personalizado"];
              const st = STATUS_CONFIG[b.status];
              return (
                <div key={b.id} className="surface-card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{b.client}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.templateName} · {new Date(b.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${st.color}`}>
                    {st.label}
                  </span>
                  <button onClick={() => copyLink(b.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors shrink-0">
                    {copiedId === b.id ? <><Check className="w-3.5 h-3.5 text-emerald-400" />Copiado!</> : <><Link2 className="w-3.5 h-3.5" />Link</>}
                  </button>
                  <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Selecionar tipo ── */}
      {showTypeSelect && !fillTemplate && !showBuilder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg p-6 pb-safe">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-foreground">Selecione o Tipo de Briefing</h2>
              <button onClick={() => setShowTypeSelect(false)} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-5">Escolha um template existente ou crie um personalizado</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Templates padrão */}
              {DEFAULT_TEMPLATES.map(tmpl => {
                const Icon = TYPE_ICONS[tmpl.type];
                return (
                  <button key={tmpl.id} onClick={() => setFillTemplate(tmpl)}
                    className="surface-card p-4 text-left hover:border-primary/40 transition-all">
                    <Icon className="w-5 h-5 text-primary mb-2" />
                    <p className="font-semibold text-foreground text-sm">{tmpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tmpl.questions.length} perguntas</p>
                  </button>
                );
              })}
              {/* Templates personalizados salvos */}
              {customTemplates.map(tmpl => (
                <button key={tmpl.id} onClick={() => setFillTemplate(tmpl)}
                  className="surface-card p-4 text-left hover:border-primary/40 transition-all border-primary/20 bg-primary/5">
                  <Pencil className="w-5 h-5 text-primary mb-2" />
                  <p className="font-semibold text-foreground text-sm">{tmpl.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tmpl.questions.length} perguntas · Personalizado</p>
                </button>
              ))}
            </div>

            {/* Botão personalizado */}
            <button onClick={() => { setEditingTemplate(undefined); setShowBuilder(true); }}
              className="w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
              <Pencil className="w-4 h-4" />Criar Briefing Personalizado
            </button>
          </div>
        </div>
      )}

      {/* ── Builder personalizado ── */}
      {showBuilder && (
        <CustomBuilder
          initial={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => { setShowBuilder(false); setEditingTemplate(undefined); }}
        />
      )}

      {/* ── Preencher briefing ── */}
      {fillTemplate && (
        <FillBriefingModal
          template={fillTemplate}
          onSave={handleSaveBriefing}
          onCancel={() => setFillTemplate(null)}
        />
      )}

      {/* ── Gerenciador de templates ── */}
      {showTemplatesMgr && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg p-6 pb-safe">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">Meus Templates</h2>
              <button onClick={() => setShowTemplatesMgr(false)} className="p-1.5 rounded-xl hover:bg-muted/60 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {customTemplates.length === 0 ? (
              <div className="surface-card flex flex-col items-center py-10 gap-3 text-muted-foreground mb-4">
                <Pencil className="w-8 h-8 opacity-20" />
                <p className="text-sm font-medium">Nenhum template personalizado</p>
                <p className="text-xs opacity-60 text-center">Crie briefings personalizados com suas próprias perguntas</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {customTemplates.map(tmpl => (
                  <div key={tmpl.id} className="surface-card p-4 flex items-center gap-3">
                    <Pencil className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{tmpl.name}</p>
                      <p className="text-xs text-muted-foreground">{tmpl.questions.length} perguntas</p>
                    </div>
                    <button onClick={() => { setEditingTemplate(tmpl); setShowTemplatesMgr(false); setShowBuilder(true); }}
                      className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteTemplate(tmpl.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Templates Padrão
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_TEMPLATES.map(tmpl => {
                const Icon = TYPE_ICONS[tmpl.type];
                return (
                  <div key={tmpl.id} className="surface-card p-3 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tmpl.name}</p>
                      <p className="text-xs text-muted-foreground">{tmpl.questions.length} perguntas</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={() => { setShowTemplatesMgr(false); setEditingTemplate(undefined); setShowBuilder(true); }}
              className="w-full mt-4 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />Novo Template Personalizado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
