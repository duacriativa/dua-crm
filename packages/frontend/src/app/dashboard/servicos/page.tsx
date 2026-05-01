"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit2, Trash2, Search, RefreshCw, X, Check,
  Package, Layers, ShoppingCart, Lightbulb, ToggleLeft,
  ToggleRight, ChevronDown, DollarSign, Tag, FileText,
  LayoutGrid, List as ListIcon, Briefcase,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

/* ── Tipos ── */
interface Service {
  id: string; name: string; description?: string;
  price: number; cost: number; currency: string;
  category?: string; isRecurring: boolean; recurringPeriod?: string;
  isPublic: boolean; isOnForm: boolean; commission?: number;
  isActive: boolean; createdAt: string;
}

/* ── Categorias sugeridas para agências de moda ── */
const CATEGORIES = ["Social Media","Tráfego Pago","Design","Branding","Consultoria","Marketing","Produção","Outro"];

const RECURRENCE_OPTIONS = ["mensal","trimestral","semestral","anual"];

/* ── Sugestões pré-definidas (igual ao DGFlow) ── */
const SUGGESTIONS = [
  {
    group: "Para Agências de Moda",
    items: [
      { name: "Social Media (Mensal)", description: "Gestão de redes sociais com criação de conteúdo", price: 2600, isRecurring: true, recurringPeriod: "mensal", category: "Social Media" },
      { name: "Gestão de Tráfego (Mensal)", description: "Gerenciamento mensal de campanhas pagas", price: 1800, isRecurring: true, recurringPeriod: "mensal", category: "Tráfego Pago" },
      { name: "Planejamento Estratégico", description: "Estratégia digital e planejamento de marketing", price: 2000, isRecurring: false, category: "Consultoria" },
      { name: "Identidade Visual", description: "Logo, paleta, tipografia e manual de marca", price: 2500, isRecurring: false, category: "Branding" },
      { name: "Consultoria 1h", description: "Sessão de consultoria estratégica por hora", price: 497, isRecurring: false, category: "Consultoria" },
      { name: "Produção de Conteúdo", description: "Fotografia e vídeo para redes sociais", price: 1500, isRecurring: false, category: "Produção" },
    ],
  },
  {
    group: "Serviços Recorrentes",
    items: [
      { name: "Relatórios Mensais", description: "Relatório detalhado de resultados por mês", price: 600, isRecurring: true, recurringPeriod: "mensal", category: "Marketing" },
      { name: "Email Marketing", description: "Criação e disparo de campanhas de email", price: 900, isRecurring: true, recurringPeriod: "mensal", category: "Marketing" },
      { name: "CRM Setup", description: "Implantação e configuração do CRM", price: 1200, isRecurring: false, category: "Consultoria" },
    ],
  },
];

const EMPTY_FORM = {
  name: "", description: "", price: 0, cost: 0,
  category: "", isRecurring: false, recurringPeriod: "mensal",
  isPublic: true, isOnForm: true, commission: "",
};

type Tab = "servicos" | "produtos" | "planos" | "checkout";

export default function ServicosPage() {
  const [tab, setTab] = useState<Tab>("servicos");
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modal estados
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<"choose" | "suggest" | "form">("choose");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/services`, { headers: authHeaders() });
      if (!res.ok) return;
      setServices(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalStep("choose");
    setShowModal(true);
  };

  const openEdit = (s: Service) => {
    setEditingId(s.id);
    setForm({
      name: s.name, description: s.description ?? "",
      price: s.price, cost: s.cost, category: s.category ?? "",
      isRecurring: s.isRecurring, recurringPeriod: s.recurringPeriod ?? "mensal",
      isPublic: s.isPublic, isOnForm: s.isOnForm,
      commission: s.commission !== undefined && s.commission !== null ? String(s.commission) : "",
    });
    setModalStep("form");
    setShowModal(true);
  };

  const applySuggestion = (sug: typeof SUGGESTIONS[0]["items"][0]) => {
    setForm(f => ({
      ...f,
      name: sug.name,
      description: sug.description,
      price: sug.price,
      isRecurring: sug.isRecurring,
      recurringPeriod: (sug as any).recurringPeriod ?? "mensal",
      category: sug.category,
    }));
    setModalStep("form");
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description || undefined,
        price: Number(form.price),
        cost: Number(form.cost),
        category: form.category || undefined,
        isRecurring: form.isRecurring,
        recurringPeriod: form.isRecurring ? form.recurringPeriod : undefined,
        isPublic: form.isPublic,
        isOnForm: form.isOnForm,
        commission: form.commission !== "" ? Number(form.commission) : undefined,
      };
      if (editingId) {
        await fetch(`${API_URL}/api/v1/services/${editingId}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
      } else {
        await fetch(`${API_URL}/api/v1/services`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      }
      setShowModal(false);
      fetchServices();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/api/v1/services/${id}`, { method: "DELETE", headers: authHeaders() });
    setDeleteConfirm(null);
    fetchServices();
  };

  const inp = "w-full px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground";

  return (
    <div className="h-full flex flex-col bg-background">

      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-xl px-6 py-5 shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Meus Serviços</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie seu catálogo de serviços e preços</p>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-border pb-0">
          {([
            { key: "servicos", label: "Serviços", icon: Briefcase },
            { key: "produtos", label: "Produtos", icon: Package },
            { key: "planos", label: "Planos", icon: Layers },
            { key: "checkout", label: "Checkout", icon: ShoppingCart },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                tab === key
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Aba Serviços ── */}
      {tab === "servicos" && (
        <div className="flex-1 overflow-auto scrollbar-none">
          {/* Barra de ações */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <Tag className="w-4 h-4" />Gerenciar Categorias
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-primary/40 rounded-xl hover:bg-primary/5 transition-colors">
              <FileText className="w-4 h-4 text-primary" /><span className="text-primary">Novo Orçamento</span>
            </button>
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity shadow-elegant ml-auto">
              <Plus className="w-4 h-4" />Novo Serviço
            </button>
          </div>

          {/* Busca + toggle */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, descrição ou categoria..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
            </div>
            <div className="flex items-center gap-0.5 bg-muted/40 border border-border rounded-xl p-1">
              {([["grid", LayoutGrid], ["list", ListIcon]] as const).map(([mode, Icon]) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === mode ? "bg-background shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="p-6">
            {loading && (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />Carregando...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                  <Briefcase className="w-8 h-8 opacity-30" />
                </div>
                <p className="text-sm font-medium mb-1">Nenhum serviço cadastrado</p>
                <p className="text-xs opacity-60">Crie seu primeiro serviço para começar</p>
                <button onClick={openNew}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" />Novo Serviço
                </button>
              </div>
            )}

            {/* Grid view */}
            {!loading && filtered.length > 0 && viewMode === "grid" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(s => (
                  <div key={s.id} className="surface-card p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground text-base leading-tight">{s.name}</h3>
                        {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${s.isActive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}>
                        {s.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    {/* Portfólio / Formulário badges */}
                    <div className="flex gap-1.5">
                      {s.isPublic && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-muted/50 border border-border text-muted-foreground">
                          <FileText className="w-2.5 h-2.5" />Portfólio
                        </span>
                      )}
                      {s.isOnForm && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-muted/50 border border-border text-muted-foreground">
                          <FileText className="w-2.5 h-2.5" />Formulário
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm border-t border-border pt-3">
                      <div>
                        {s.category && <p className="text-xs text-muted-foreground">Categoria: <span className="font-medium text-foreground">{s.category}</span></p>}
                        <p className="text-xs text-muted-foreground mt-0.5">Preço: <span className="font-bold text-primary text-sm">R$ {s.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></p>
                        {s.isRecurring && s.recurringPeriod && (
                          <p className="text-xs text-muted-foreground mt-0.5">Recorrente: <span className="font-medium text-foreground">{s.recurringPeriod}</span></p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />Editar
                      </button>
                      <button onClick={() => setDeleteConfirm(s.id)}
                        className="p-2 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* List view */}
            {!loading && filtered.length > 0 && viewMode === "list" && (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/20">
                  <tr>
                    {["Serviço", "Categoria", "Preço", "Recorrente", "Status", ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{s.name}</p>
                        {s.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{s.description}</p>}
                      </td>
                      <td className="px-4 py-3"><span className="text-xs text-muted-foreground">{s.category ?? "—"}</span></td>
                      <td className="px-4 py-3 font-bold text-primary">R$ {s.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.isRecurring ? (s.recurringPeriod ?? "sim") : "não"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.isActive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}>
                          {s.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteConfirm(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Aba Produtos ── */}
      {tab === "produtos" && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div />
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" />Novo Produto
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
              <Package className="w-8 h-8 opacity-30" />
            </div>
            <p className="font-medium">Nenhum produto cadastrado</p>
            <p className="text-xs opacity-60">Cadastre seus produtos para controlar estoque, custos e margens.</p>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity mt-2">
              <Plus className="w-4 h-4" />Novo Produto
            </button>
          </div>
        </div>
      )}

      {/* ── Aba Planos ── */}
      {tab === "planos" && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input placeholder="Buscar planos..." className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none text-foreground placeholder:text-muted-foreground" />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity ml-auto">
              <Plus className="w-4 h-4" />Novo Plano
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
              <Layers className="w-8 h-8 opacity-30" />
            </div>
            <p className="font-medium">Nenhum plano cadastrado</p>
            <p className="text-xs opacity-60">Crie planos agrupando serviços existentes com um valor fixo</p>
          </div>
        </div>
      )}

      {/* ── Aba Checkout ── */}
      {tab === "checkout" && (
        <div className="flex-1 overflow-auto scrollbar-none p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Catálogo de Checkout <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">BETA</span></h2>
              <p className="text-sm text-muted-foreground mt-0.5">Serviços disponíveis para pagamento online via Asaas</p>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
                Importar serviços
              </button>
              <button onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" />Novo serviço
              </button>
            </div>
          </div>

          {services.length === 0 ? (
            <div className="surface-card flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground mb-5">
              <ShoppingCart className="w-10 h-10 opacity-20" />
              <p className="text-sm">Nenhum serviço cadastrado. Crie seu primeiro serviço para gerar o link de checkout.</p>
            </div>
          ) : (
            <div className="surface-card p-4 mb-5">
              <p className="text-sm font-medium text-foreground mb-3">{services.filter(s => s.isPublic).length} serviços disponíveis no checkout</p>
            </div>
          )}

          <div className="surface-card p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-lg">⚙️</span> Personalizar Checkout
            </h3>
            {[
              { label: "Cores e tema", icon: "🎨" },
              { label: "Logo e imagem", icon: "🖼️" },
              { label: "Textos customizados", icon: "T" },
            ].map(item => (
              <div key={item.label}
                className="flex items-center justify-between py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/20 px-2 rounded-xl transition-colors">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>{item.label}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
            <button className="w-full mt-4 py-3 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
              Salvar configurações
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL ══════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-lg font-bold text-foreground">
                {editingId ? "Editar Serviço" : "Cadastrar Novo Serviço"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Step 1: Escolher método ── */}
            {modalStep === "choose" && (
              <div className="p-6">
                <p className="text-center text-sm text-muted-foreground mb-6">Como deseja criar seu serviço?</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setModalStep("suggest")}
                    className="surface-card p-6 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors cursor-pointer">
                    <Lightbulb className="w-8 h-8 text-primary" />
                    <p className="font-bold text-foreground">Usar modelo pré-definido</p>
                    <p className="text-xs text-muted-foreground text-center">Escolha entre sugestões prontas para agências de moda</p>
                  </button>
                  <button onClick={() => { setForm(EMPTY_FORM); setModalStep("form"); }}
                    className="surface-card p-6 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors cursor-pointer">
                    <Plus className="w-8 h-8 text-primary" />
                    <p className="font-bold text-foreground">Criar personalizado</p>
                    <p className="text-xs text-muted-foreground text-center">Preencha todos os campos manualmente do zero</p>
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Sugestões ── */}
            {modalStep === "suggest" && (
              <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-4">
                <p className="text-primary font-semibold flex items-center gap-1.5 mb-4">
                  <Lightbulb className="w-4 h-4" />Sugestões de Serviços
                </p>
                {SUGGESTIONS.map(group => (
                  <div key={group.group} className="mb-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.group}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map(item => (
                        <button key={item.name} onClick={() => applySuggestion(item)}
                          className="surface-card p-3 text-left hover:border-primary/40 transition-colors cursor-pointer">
                          <p className="font-semibold text-foreground text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                          <p className="text-primary font-bold text-sm mt-2">
                            R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            {item.isRecurring && <span className="text-xs font-normal text-muted-foreground ml-1">/{(item as any).recurringPeriod}</span>}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={() => { setForm(EMPTY_FORM); setModalStep("form"); }}
                  className="w-full py-3 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors mt-2">
                  Ou criar serviço personalizado
                </button>
              </div>
            )}

            {/* ── Step 3: Form ── */}
            {modalStep === "form" && (
              <>
                <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-5 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Nome do Serviço <span className="text-red-400">*</span></label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Logo Design" autoFocus className={inp} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Descrição</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={3} placeholder="Descreva o que está incluso no serviço"
                      className={`${inp} resize-none`} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Preço</label>
                      <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                        placeholder="1500.00" className={inp} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Custo</label>
                      <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: Number(e.target.value) }))}
                        placeholder="0.00" className={inp} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Moeda</label>
                      <div className="relative">
                        <select className={`${inp} appearance-none pr-8`} defaultValue="BRL">
                          <option value="BRL">R$ BRL</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Categoria</label>
                      <div className="relative">
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                          className={`${inp} appearance-none pr-8`}>
                          <option value="">Selecione</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Toggles */}
                  {[
                    {
                      key: "isRecurring", label: "Serviço Recorrente",
                      sub: "Cobrança mensal, trimestral ou anual",
                    },
                    {
                      key: "isPublic", label: "Exibir na Página Pública",
                      sub: "Mostrar este serviço na sua landing page/portfólio",
                    },
                    {
                      key: "isOnForm", label: "Exibir no Formulário de Leads",
                      sub: "Disponibilizar como opção no formulário de captação",
                    },
                  ].map(({ key, label, sub }) => (
                    <div key={key} className="flex items-center justify-between p-4 surface-card">
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                        className={`w-11 h-6 rounded-full transition-colors relative ${(form as any)[key] ? "bg-primary" : "bg-muted"}`}>
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${(form as any)[key] ? "left-5" : "left-0.5"}`} />
                      </button>
                    </div>
                  ))}

                  {/* Recorrência (se isRecurring) */}
                  {form.isRecurring && (
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Período de recorrência</label>
                      <div className="flex gap-2 flex-wrap">
                        {RECURRENCE_OPTIONS.map(opt => (
                          <button key={opt} onClick={() => setForm(f => ({ ...f, recurringPeriod: opt }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${form.recurringPeriod === opt ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comissão */}
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Comissão padrão (%)</label>
                    <input type="number" value={form.commission} onChange={e => setForm(f => ({ ...f, commission: e.target.value }))}
                      placeholder="Ex: 10" className={inp} />
                    <p className="text-xs text-muted-foreground mt-1">Percentual de comissão padrão para este serviço.</p>
                  </div>
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
                  {!editingId && (
                    <button onClick={() => setModalStep("suggest")}
                      className="px-4 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
                      Ver Sugestões
                    </button>
                  )}
                  <button onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={!form.name.trim() || saving}
                    className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />Salvando...</> : <><Check className="w-4 h-4" />{editingId ? "Editar Serviço" : "Cadastrar Novo Serviço"}</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Confirmar exclusão ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-foreground mb-2">Excluir serviço?</h3>
            <p className="text-sm text-muted-foreground mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
