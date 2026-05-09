"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, Instagram, Tag, Calendar,
  DollarSign, MessageCircle, Edit, MoreVertical, Trash2,
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


/* ── NotesEditor ── */
function NotesEditor({ contactId, initialNotes }: { contactId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/v1/contacts/${contactId}`, {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify({ notes }),
      });
      setEditing(false);
    } finally { setSaving(false); }
  };
  if (editing) return (
    <div className="space-y-2">
      <textarea rows={5} value={notes} onChange={e => setNotes(e.target.value)} autoFocus
        className="w-full px-4 py-3 text-sm bg-muted/50 border border-primary/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground resize-none" />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={() => setEditing(false)} className="px-4 py-2 text-xs text-muted-foreground border border-border rounded-xl hover:bg-muted/50">Cancelar</button>
      </div>
    </div>
  );
  return (
    <div className="bg-muted/30 rounded-2xl p-5 border border-border cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setEditing(true)}>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {notes || <span className="text-muted-foreground italic">Clique para adicionar uma nota...</span>}
      </p>
    </div>
  );
}

/* ── ContactInfoEditor ── */
function ContactInfoEditor({ contact, onSave }: { contact: any; onSave: (f: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone: contact.phone || "", email: contact.email || "", instagramHandle: contact.instagramHandle || "" });

  const save = async () => {
    setSaving(true);
    try {
      const phone = form.phone.trim() || null;
      const email = form.email.trim() || null;
      const instagramHandle = form.instagramHandle.trim().replace("@", "") || null;
      await fetch(`${API_URL}/api/v1/contacts/${contact.id}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ phone, email, instagramHandle }),
      });
      onSave({ phone, email, instagramHandle });
      setEditing(false);
    } finally { setSaving(false); }
  };

  const inp = "w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground";

  return (
    <div className="bg-card surface-card p-5 shadow-none border border-border">
      <div className="flex items-center justify-between mb-5 px-1">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Informações de Contato</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
            <Edit size={12} /> Editar
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter block mb-1">WhatsApp</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+5511999999999" className={inp} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter block mb-1">E-mail</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@exemplo.com" type="email" className={inp} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter block mb-1">Instagram</label>
            <input value={form.instagramHandle} onChange={e => setForm(f => ({ ...f, instagramHandle: e.target.value }))}
              placeholder="@suamarca" className={inp} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 text-xs font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-2 text-xs text-muted-foreground border border-border rounded-xl hover:bg-muted/50">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {[
            { label: "WhatsApp", value: contact.phone, icon: <Phone size={18} />, color: "bg-green-500/10 text-green-600" },
            { label: "E-mail", value: contact.email, icon: <Mail size={18} />, color: "bg-blue-500/10 text-blue-600" },
            { label: "Instagram", value: contact.instagramHandle ? `@${contact.instagramHandle.replace("@", "")}` : null, icon: <Instagram size={18} />, color: "bg-pink-500/10 text-pink-500" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/30 transition-colors">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter leading-none mb-1">{label}</p>
                <p className="text-sm font-semibold text-foreground truncate">{value || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── BusinessProfileEditor ── */
const FATURAMENTO_OPTIONS = ["Menos de R$ 50k/mês","R$ 50k – R$ 100k/mês","R$ 100k – R$ 150k/mês","Acima de R$ 150k/mês"];
const MODELO_VENDA_OPTIONS = ["E-commerce próprio","Instagram/WhatsApp","Marketplace (Shopee, Mercado Livre)","Loja física + online","Atacado"];

function BusinessProfileEditor({ contact, onSave }: { contact: any; onSave: (f: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ faturamento: "", investimento: "", modelo: "", interesse: "", instagram: contact.instagramHandle || "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (contact.notes) {
      const n = contact.notes;
      setForm(f => ({
        ...f,
        faturamento: n.includes("Faturamento:") ? n.split("Faturamento:")[1].split("\n")[0].trim() : f.faturamento,
        investimento: n.includes("Investimento atual:") ? n.split("Investimento atual:")[1].split("\n")[0].trim() : f.investimento,
        modelo: n.includes("Modelo de venda:") ? n.split("Modelo de venda:")[1].split("\n")[0].trim() : f.modelo,
        interesse: n.includes("Interesse:") ? n.split("Interesse:")[1].split("\n")[0].trim() : f.interesse,
      }));
    }
  }, [contact.notes]);
  const save = async () => {
    setSaving(true);
    try {
      const profileBlock = [
        form.faturamento && `Faturamento: ${form.faturamento}`,
        form.investimento && `Investimento atual: ${form.investimento}`,
        form.modelo && `Modelo de venda: ${form.modelo}`,
        form.interesse && `Interesse: ${form.interesse}`,
      ].filter(Boolean).join("\n");
      const cleanNotes = (contact.notes || "").split("\n")
        .filter((l: string) => !l.startsWith("Faturamento:") && !l.startsWith("Investimento atual:") && !l.startsWith("Modelo de venda:") && !l.startsWith("Interesse:"))
        .join("\n").trim();
      const body: any = { instagramHandle: form.instagram || null, notes: [profileBlock, cleanNotes].filter(Boolean).join("\n") };
      await fetch(`${API_URL}/api/v1/contacts/${contact.id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
      onSave({ faturamento: form.faturamento, investimento: form.investimento, interesse: form.interesse });
      setOpen(false);
    } finally { setSaving(false); }
  };
  const inp = "w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground";
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors ml-auto">
        <Edit size={12} /> Editar
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto scrollbar-none">
            <h3 className="text-lg font-bold text-foreground mb-4">Editar Perfil do Negócio</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">@Instagram</label>
                <input value={form.instagram} onChange={e => setForm(f => ({...f, instagram: e.target.value}))} placeholder="@suamarca" className={inp} /></div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Faturamento Mensal</label>
                <select value={form.faturamento} onChange={e => setForm(f => ({...f, faturamento: e.target.value}))} className={`${inp} appearance-none`}>
                  <option value="">Selecione...</option>{FATURAMENTO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select></div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Modelo de Venda</label>
                <select value={form.modelo} onChange={e => setForm(f => ({...f, modelo: e.target.value}))} className={`${inp} appearance-none`}>
                  <option value="">Selecione...</option>{MODELO_VENDA_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select></div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Investimento Atual em Marketing</label>
                <input value={form.investimento} onChange={e => setForm(f => ({...f, investimento: e.target.value}))} placeholder="Ex: R$ 1.000/mês em ads" className={inp} /></div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Interesse / Serviço</label>
                <input value={form.interesse} onChange={e => setForm(f => ({...f, interesse: e.target.value}))} placeholder="Ex: Social Media, Tráfego" className={inp} /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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

  // Additional fields parsed from notes — must be declared at top level (Rules of Hooks)
  const [aditionalFields, setAditionalFields] = useState<any>({});
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

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

  useEffect(() => {
    if (contact) {
      const notes = contact.notes || "";
      const fields: any = {};
      if (notes.includes("Investimento atual:")) fields.investimento = notes.split("Investimento atual:")[1].split("\n")[0].trim();
      if (notes.includes("Faturamento:")) fields.faturamento = notes.split("Faturamento:")[1].split("\n")[0].trim();
      if (notes.includes("Atendimento de leads:")) fields.atendimento = notes.split("Atendimento de leads:")[1].split("\n")[0].trim();
      if (notes.includes("Interesse:")) fields.interesse = notes.split("Interesse:")[1].split("\n")[0].trim();
      setAditionalFields(fields);
    }
  }, [contact]);

  async function handleDeleteContact() {
    if (!contact) return;
    if (!confirm(`Excluir "${contact.name}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    setShowMenu(false);
    await fetch(`${API_URL}/api/v1/contacts/${contact.id}`, { method: "DELETE", headers: authHeaders() });
    router.push("/dashboard/contatos");
  }

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
      <div className="h-full flex items-center justify-center bg-muted/30/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
        <User className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-bold text-foreground mb-2">Contato não encontrado</h2>
        <p className="max-w-xs text-center text-sm mb-6">{error || "O perfil solicitado não está disponível ou foi removido."}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-6 py-2.5 bg-card border border-border rounded-xl font-semibold text-foreground/80 hover:bg-muted/30 transition-all shadow-none border border-border"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para contatos
        </button>
      </div>
    );
  }


  return (
    <div className="h-full flex flex-col bg-background">
      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2.5 rounded-xl hover:bg-muted/50 text-muted-foreground transition-colors bg-muted/30 border border-border"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{contact.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User size={12} /> Perfil do Contato
                </span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="text-xs font-semibold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">
                  {contact.segment || "NEW"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/dashboard/conversas?phone=${encodeURIComponent(contact.phone || "")}&name=${encodeURIComponent(contact.name || "")}`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Abrir Chat
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
                className="p-2.5 rounded-xl border border-border hover:bg-muted/40 text-muted-foreground transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-12 bg-card border border-border rounded-2xl shadow-elegant z-50 w-48 py-1 overflow-hidden">
                  <button
                    onClick={handleDeleteContact}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} /> Excluir contato
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Coluna Esquerda */}
          <div className="lg:col-span-2 space-y-6">

            {/* Card: Dados do Perfil */}
            <div className="bg-card surface-card p-6 shadow-none border border-border relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <User size={120} />
              </div>

              <div className="flex items-start gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Briefcase size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-foreground">Perfil do Negócio</h2>
                  <p className="text-sm text-muted-foreground">Informações coletadas durante o cadastro</p>
                </div>
                <BusinessProfileEditor contact={contact} onSave={(fields) => setAditionalFields(fields)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border transition-all hover:bg-card hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-none border border-border text-green-600">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Faturamento Mensal</p>
                      <p className="text-sm font-semibold text-foreground">{aditionalFields.faturamento || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border transition-all hover:bg-card hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-none border border-border text-purple-600">
                      <Tag size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Modelo de Venda</p>
                      <p className="text-sm font-semibold text-foreground">Instagram/WhatsApp</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border transition-all hover:bg-card hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-none border border-border text-blue-600">
                      <Filter size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Investimento Atual</p>
                      <p className="text-sm font-semibold text-foreground">{aditionalFields.investimento || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border transition-all hover:bg-card hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-none border border-border text-orange-600">
                      <ArrowLeft size={20} className="rotate-180" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Interesse</p>
                      <p className="text-sm font-semibold text-foreground">{aditionalFields.interesse || "Não informado"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Notas e Observações */}
            <div className="bg-card surface-card p-6 shadow-none border border-border">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Filter size={20} />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">Notas e Observações</h2>
                </div>
                <button className="text-sm text-primary font-bold hover:underline flex items-center gap-1">
                  <Edit size={14} /> Editar
                </button>
              </div>
              <NotesEditor contactId={contact.id} initialNotes={contact.notes || ""} />
            </div>

            {/* ── Card: Análise de Perfil Instagram ── */}
            <div className="bg-card surface-card p-6 shadow-none border border-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white">
                  <Instagram size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Análise de Perfil Instagram</h2>
                  <p className="text-xs text-muted-foreground">
                    {contact.instagramHandle
                      ? `@${contact.instagramHandle.replace("@", "")}`
                      : "Nenhum Instagram cadastrado"}
                  </p>
                </div>
                {parsedAnalysis?.score !== undefined && (
                  <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                    <Sparkles size={14} className="text-purple-600" />
                    <span className="text-sm font-bold text-primary">Score</span>
                    <span className="text-xl font-black text-purple-600">{parsedAnalysis.score}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
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
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
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
                            ? "text-primary font-bold scale-105"
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
                    <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
                      <p className="text-sm text-purple-900 leading-relaxed">{parsedAnalysis.resumo}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parsedAnalysis.pontos_fortes && parsedAnalysis.pontos_fortes.length > 0 && (
                      <div className="bg-green-500/10 rounded-2xl p-4 border border-green-100">
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
                      <div className="bg-blue-500/10 rounded-2xl p-4 border border-blue-100">
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
                      <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-100">
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
                    <div className="bg-green-500/10 rounded-2xl p-4 border border-green-200">
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
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Texto bruto / editar</label>
                  <textarea
                    value={analysisText}
                    onChange={(e) => {
                      setAnalysisText(e.target.value);
                      tryParseAnalysis(e.target.value);
                    }}
                    rows={6}
                    className="w-full border border-border rounded-2xl p-4 text-sm text-foreground/80 leading-relaxed resize-y focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveAnalysis}
                      disabled={analysisSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-none border border-border"
                    >
                      <Save size={14} />
                      {analysisSaving ? "Salvando..." : analysisSaved ? "✓ Salvo!" : "Salvar análise"}
                    </button>
                    <button
                      onClick={handleGenerateAnalysis}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-primary bg-primary/10 hover:bg-purple-100 transition-colors border border-primary/20"
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

            {/* Informações de Contato */}
            <ContactInfoEditor contact={contact} onSave={(updated) => setContact(c => c ? { ...c, ...updated } : c)} />

            {/* Timeline do Lead */}
            <div className="bg-card surface-card p-5 shadow-none border border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6 px-1">Histórico do CRM</h3>

              <div className="space-y-6">
                <div className="relative pl-6 border-l-2 border-border pb-1">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-card border-2 border-brand-500 shadow-none border border-border" />
                  <p className="text-xs font-bold text-foreground">Primeiro Cadastro</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar size={10} /> {new Date(contact.createdAt).toLocaleDateString("pt-BR")} às {new Date(contact.createdAt).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="relative pl-6 border-l-2 border-border pb-1">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-card border-2 border-border shadow-none border border-border" />
                  <p className="text-xs font-bold text-muted-foreground">Última Atualização</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock size={10} /> {new Date(contact.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-card surface-card p-5 shadow-none border border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 px-1">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {contact.tags && contact.tags.length > 0 ? (
                  contact.tags.map(tag => (
                    <span key={tag} className="px-3 py-1.5 bg-muted/30 border border-border text-muted-foreground text-[11px] font-bold rounded-xl whitespace-nowrap">
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
