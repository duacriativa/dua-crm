"use client";

import { useState } from "react";
import {
  User, Palette, RefreshCw, CreditCard, Smartphone, Bell,
  Zap, Puzzle, FileText, Plus, Trash2, RotateCcw, Save,
  Check, ChevronRight, Globe, Building2, Phone, Hash,
  MapPin, Mail, AlertCircle, ArrowRight,
  Users2, ClipboardList, Link2, CalendarClock, Image as ImageIcon, Upload,
  Globe2, FileText as FileText2,
} from "lucide-react";

const tabs = [
  { key: "Perfil",        icon: User },
  { key: "Aparência",     icon: Palette },
  { key: "Atualizações",  icon: RefreshCw },
  { key: "Assinatura",    icon: CreditCard },
  { key: "Mobile",        icon: Smartphone },
  { key: "Notificações",  icon: Bell },
  { key: "Automações",    icon: Zap },
  { key: "Integrações",   icon: Puzzle },
  { key: "Conteúdos",     icon: FileText },
];

/* ── PERFIL ── */
function TabPerfil() {
  const [form, setForm] = useState({
    nome: "Daniel Wendell", empresa: "Dua Criativa",
    telefone: "+55 85 99999-9999", cpfCnpj: "12.345.678/0001-90",
    endereco: "Rua das Flores", numero: "123", bairro: "Meireles",
    cidade: "Fortaleza", estado: "CE", cep: "60165-120", pais: "Brasil",
    email: "dw.wendell@gmail.com",
  });
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const Field = ({ label, k, icon: Icon, required }: { label: string; k: string; icon?: any; required?: boolean }) => (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
        <input value={form[k as keyof typeof form]} onChange={e => f(k, e.target.value)}
          className={`w-full py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground ${Icon ? "pl-9 pr-4" : "px-4"}`} />
      </div>
    </div>
  );
  return (
    <div className="max-w-2xl space-y-6">
      {/* Avatar */}
      <div className="surface-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Foto de perfil</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-bold text-white shadow-glow">D</div>
          <div>
            <button className="px-4 py-2 text-sm font-medium bg-gradient-primary text-white rounded-xl hover:opacity-90 transition-opacity">Alterar foto</button>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou GIF. Máx 2MB.</p>
          </div>
        </div>
      </div>

      {/* Idioma */}
      <div className="surface-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-primary" />Idioma e Região</h2>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
          <span className="text-xl">🇧🇷</span>
          <div>
            <p className="text-sm font-medium text-foreground">Português (Brasil)</p>
            <p className="text-xs text-muted-foreground">Moeda: R$ BRL — Real Brasileiro</p>
          </div>
          <span className="ml-auto text-xs text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">Detectado</span>
        </div>
      </div>

      {/* Dados */}
      <div className="surface-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Dados da conta</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={form.email} disabled className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/30 border border-border rounded-xl text-muted-foreground cursor-not-allowed" />
            </div>
          </div>
          <Field label="Nome Completo" k="nome" icon={User} required />
          <Field label="Nome da Empresa" k="empresa" icon={Building2} />
          <Field label="Telefone" k="telefone" icon={Phone} required />
          <Field label="CPF / CNPJ" k="cpfCnpj" icon={Hash} required />
          <div className="sm:col-span-2"><Field label="Endereço" k="endereco" icon={MapPin} required /></div>
          <Field label="Número" k="numero" required />
          <Field label="Bairro" k="bairro" />
          <Field label="Cidade" k="cidade" required />
          <Field label="Estado" k="estado" required />
          <Field label="CEP" k="cep" required />
          <Field label="País" k="pais" icon={Globe} required />
        </div>
        <button className="mt-5 px-6 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity shadow-elegant">
          Salvar alterações
        </button>
      </div>
    </div>
  );
}

/* ── ASSINATURA ── */
function TabAssinatura() {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Plano atual</h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20">● Ativo</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-5">
          {[
            { label: "Plano",         value: "Starter — Mensal" },
            { label: "Dias Restantes",value: "29 dias" },
            { label: "Próxima cobrança",value: "29/05/2026" },
            { label: "Expiração",     value: "29/05/2026" },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-xl bg-muted/40 border border-border">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border mb-5">
          <div>
            <p className="text-sm font-medium text-foreground">Renovação Automática</p>
            <p className="text-xs text-muted-foreground">Próxima cobrança: 29/05/2026</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20">Ativa</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/60 transition-colors">Histórico de Pagamentos</button>
          <button className="px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">Alterar Plano</button>
          <button className="px-4 py-2 text-sm font-medium text-destructive border border-destructive/30 rounded-xl hover:bg-destructive/10 transition-colors">Cancelar Assinatura</button>
        </div>
      </div>

      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Método de pagamento</h2>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border bg-muted/20">
          <CreditCard className="w-8 h-8 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado</p>
          </div>
          <button className="px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">Cadastrar</button>
        </div>
      </div>
    </div>
  );
}

/* ── MOBILE ── */
const mobileOptions = ["Dashboard","Clientes","Pipelines","Tarefas","Agenda","Kanban de Projetos","Financeiro","Serviços","Contratos","Briefings","Configurações"];
function TabMobile() {
  const [selected, setSelected] = useState(["Dashboard","Clientes","Pipelines","Tarefas"]);
  const toggle = (item: string) => {
    if (selected.includes(item)) { setSelected(p => p.filter(x => x !== item)); return; }
    if (selected.length >= 4) return;
    setSelected(p => [...p, item]);
  };
  return (
    <div className="max-w-lg space-y-4">
      <div className="surface-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-1">Menu Mobile Flutuante</h2>
        <p className="text-xs text-muted-foreground mb-4">Selecione até 4 atalhos para o menu inferior do app.</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {mobileOptions.map(item => {
            const active = selected.includes(item);
            const disabled = !active && selected.length >= 4;
            return (
              <button key={item} onClick={() => toggle(item)} disabled={disabled}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${active ? "bg-primary/15 text-primary border-primary/30" : disabled ? "bg-muted/20 text-muted-foreground/40 border-border cursor-not-allowed" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"}`}>
                {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                {!active && <span className="w-3.5 h-3.5 shrink-0" />}
                {item}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <span>{selected.length}/4 selecionados</span>
          <div className="flex gap-1">
            {selected.map(s => (
              <span key={s} className="px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">{s}</span>
            ))}
          </div>
        </div>
        <button className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">Salvar configuração</button>
      </div>
    </div>
  );
}

/* ── NOTIFICAÇÕES ── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-10 h-6 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}
function TabNotificacoes() {
  const [resumo, setResumo] = useState(false);
  const [notifs, setNotifs] = useState({
    atribuido: { inApp: true,  push: false },
    status:    { inApp: true,  push: true  },
  });
  const toggle = (k: "atribuido"|"status", ch: "inApp"|"push") =>
    setNotifs(p => ({ ...p, [k]: { ...p[k], [ch]: !p[k][ch] } }));
  return (
    <div className="max-w-lg space-y-4">
      <div className="surface-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Resumo Diário</p>
            <p className="text-xs text-muted-foreground mt-0.5">Receba um resumo das atividades do dia</p>
          </div>
          <Toggle value={resumo} onChange={setResumo} />
        </div>
      </div>
      <div className="surface-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-1">Tipos de notificação</h2>
        <p className="text-xs text-muted-foreground mb-4">Configure quais eventos geram notificações in-app e push.</p>
        <div className="space-y-1">
          <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Evento</span><span className="text-center">In-app</span><span className="text-center">Push</span>
          </div>
          {([
            { key: "atribuido", label: "Conteúdo atribuído a mim" },
            { key: "status",    label: "Mudança de status em meus conteúdos" },
          ] as const).map(({ key, label }) => (
            <div key={key} className="grid grid-cols-3 gap-2 items-center px-3 py-3 rounded-xl hover:bg-muted/30 transition-colors">
              <span className="text-sm text-foreground">{label}</span>
              <div className="flex justify-center"><Toggle value={notifs[key].inApp} onChange={() => toggle(key, "inApp")} /></div>
              <div className="flex justify-center"><Toggle value={notifs[key].push}  onChange={() => toggle(key, "push")}  /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── INTEGRAÇÕES ── */
const allIntegrations = [
  { id:"whatsapp",  name:"WhatsApp",   desc:"Conecte sua conta via Evolution API",  icon:"💬", status:"connected" },
  { id:"asaas",     name:"Asaas",      desc:"Cobranças e pagamentos automáticos",   icon:"💳", status:"connected" },
  { id:"instagram", name:"Instagram",  desc:"Mensagens diretas e comentários",      icon:"📸", status:"pending"   },
  { id:"nuvemshop", name:"Nuvemshop",  desc:"Sincronize pedidos e clientes",        icon:"🛒", status:"idle"      },
  { id:"shopify",   name:"Shopify",    desc:"Integração com sua loja Shopify",      icon:"🏪", status:"idle"      },
  { id:"openai",    name:"OpenAI / IA",desc:"Potencialize bots e análises com IA",  icon:"✨", status:"idle"      },
  { id:"stripe",    name:"Stripe",     desc:"Pagamentos internacionais",            icon:"💰", status:"idle"      },
  { id:"gdrive",    name:"Google Drive",desc:"Anexe arquivos da nuvem",             icon:"📁", status:"idle"      },
  { id:"figma",     name:"Figma",      desc:"Importe designs",                      icon:"🎨", status:"idle"      },
  { id:"slack",     name:"Slack",      desc:"Notificações no canal",                icon:"💬", status:"idle"      },
  { id:"zapier",    name:"Zapier",     desc:"Conecte +5000 apps",                   icon:"⚡", status:"idle"      },
  { id:"behance",   name:"Behance",    desc:"Publique no portfólio",                icon:"🖼️", status:"idle"      },
];
const statusColors: Record<string,string> = {
  connected: "bg-success/10 text-success border-success/20",
  pending:   "bg-warning/10 text-warning border-warning/20",
  idle:      "bg-muted/60 text-muted-foreground border-border",
};
const statusLabels: Record<string,string> = { connected:"Conectado", pending:"Pendente", idle:"Não configurado" };
function TabIntegracoes() {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {allIntegrations.map(i => (
          <div key={i.id} className="surface-card p-5 flex flex-col gap-4 hover:shadow-elegant hover:-translate-y-0.5 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-xl">{i.icon}</div>
                <div>
                  <p className="font-semibold text-foreground">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.desc}</p>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border shrink-0 ${statusColors[i.status]}`}>{statusLabels[i.status]}</span>
            </div>
            <button className={`w-full py-2 rounded-xl text-sm font-semibold transition-all ${i.status === "connected" ? "bg-muted/60 text-muted-foreground hover:bg-muted border border-border" : "bg-gradient-primary text-white hover:opacity-90 shadow-elegant"}`}>
              {i.status === "connected" ? "Gerenciar" : "Configurar"}
            </button>
          </div>
        ))}
      </div>
      <div className="surface-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Não encontrou a integração que precisa?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Envie sua sugestão e nossa equipe avaliará.</p>
        </div>
        <button className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity shadow-elegant shrink-0">
          Sugerir Integração
        </button>
      </div>
    </div>
  );
}

/* ── CONTEÚDOS ── */
const defaultSteps = ["Planejamento","Produção","Revisão","Aprovação cliente","Aprovado","Publicação"];
const contentTypes = ["Feed (post)","Reels","Stories","Carrossel","Artigo/Blog","Branding","Apresentação","Foto","Landing page","E-mail marketing"];
function TabConteudos() {
  const [steps, setSteps] = useState(defaultSteps);
  const [newStep, setNewStep] = useState("");
  const required = ["Aprovado","Revisão"];
  const addStep = () => { if (newStep.trim()) { setSteps(p => [...p, newStep.trim()]); setNewStep(""); } };
  const removeStep = (s: string) => { if (!required.includes(s)) setSteps(p => p.filter(x => x !== s)); };
  return (
    <div className="max-w-2xl space-y-6">
      {/* Fluxo */}
      <div className="surface-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-1">Fluxo de Produção de Conteúdos</h2>
        <p className="text-xs text-muted-foreground mb-4">As etapas <strong className="text-foreground">Aprovado</strong> e <strong className="text-foreground">Revisão</strong> são obrigatórias.</p>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border ${required.includes(s) ? "bg-primary/15 text-primary border-primary/30" : "bg-muted/40 text-foreground border-border"}`}>
                {s}
                {!required.includes(s) && (
                  <button onClick={() => removeStep(s)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>
                )}
              </div>
              {i < steps.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          <input value={newStep} onChange={e => setNewStep(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addStep()}
            placeholder="Nova etapa..."
            className="flex-1 px-4 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
          <button onClick={addStep} className="px-4 py-2 text-sm font-medium text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <Plus className="w-4 h-4" />Adicionar etapa
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSteps(defaultSteps)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/60 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />Restaurar padrão
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
            <Save className="w-3.5 h-3.5" />Salvar
          </button>
        </div>
      </div>

      {/* Tipos de conteúdo */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Tipos de conteúdo</h2>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
            <Plus className="w-3.5 h-3.5" />Novo tipo
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Padrão do sistema</p>
        <div className="space-y-1">
          {contentTypes.map(ct => (
            <div key={ct} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
              <span className="text-sm text-foreground">{ct}</span>
              <span className="text-xs text-muted-foreground">0 campo(s) · social</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ── APARÊNCIA ── */
function TabAparencia() {
  const cards = [
    { icon: Palette,      title: "Aparência do Sistema",      desc: "Tema, cores e tipografia da plataforma",                            color: "from-violet-500 to-purple-600" },
    { icon: Users2,       title: "Portal do Cliente",         desc: "Logo, cores, login e mensagens do portal",                         color: "from-pink-500 to-rose-500"    },
    { icon: ClipboardList,title: "Briefings",                 desc: "Aparência da página pública de briefing (herda do Portal do Cliente)",color:"from-blue-500 to-cyan-500"   },
    { icon: FileText2,    title: "Contratos / Checkout",      desc: "Cores, banner e textos da página de aprovação",                    color: "from-emerald-500 to-teal-500" },
    { icon: Globe2,       title: "Página Pública (Portfólio)",desc: "Estilo, blocos e SEO do portfólio",                               color: "from-amber-500 to-orange-500" },
    { icon: Link2,        title: "Link da Bio",               desc: "Tema, SEO e branding da bio",                                      color: "from-fuchsia-500 to-pink-500" },
    { icon: CalendarClock,title: "Página de Agendamento",     desc: "Marca, horários e mensagens da página de agendamento",             color: "from-indigo-500 to-blue-500"  },
  ];
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.title} className="group surface-card p-5 flex items-center gap-4 text-left hover:border-primary/40 hover:-translate-y-0.5 transition-all">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-lg shrink-0`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          );
        })}
      </div>
      <div className="surface-card overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <ImageIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Favicon Global</h2>
            <p className="text-xs text-muted-foreground">Ícone exibido na aba do navegador em páginas públicas. Recomendado: imagem quadrada 64×64px.</p>
          </div>
        </div>
        <div className="p-6 space-y-2">
          <p className="text-xs font-medium text-foreground">URL ou Upload</p>
          <div className="flex gap-2">
            <input placeholder="https://... ou faça upload" className="flex-1 px-4 py-2 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/60 transition-colors shrink-0">
              <Upload className="h-4 w-4" />Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── PLACEHOLDER ── */
function SubPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-4 text-2xl">⚙️</div>
      <p className="font-semibold text-foreground">Configurações de {title} em breve</p>
      <p className="text-sm mt-1 text-muted-foreground">Estamos trabalhando nisso.</p>
    </div>
  );
}
function TabPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4 text-3xl">⚙️</div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm mt-1">Em breve disponível</p>
    </div>
  );
}

/* ── AUTOMAÇÕES ── */
const autoSubTabs = ["Projetos","Tarefas","Notificações","WhatsApp","Novo","Recorrentes","Atalhos"];

function AutoNotificacoes() {
  const [resumo, setResumo] = useState(false);
  const [notifs, setNotifs] = useState({
    atribuido:  { inApp: true,  push: false },
    status:     { inApp: true,  push: true  },
    vencimento: { inApp: true,  push: true  },
    mencao:     { inApp: true,  push: false },
  });
  const toggle = (k: keyof typeof notifs, ch: "inApp"|"push") =>
    setNotifs(p => ({ ...p, [k]: { ...p[k], [ch]: !p[k][ch] } }));

  const Toggle2 = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );

  return (
    <div className="max-w-lg space-y-4">
      <div className="surface-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Resumo Diário</p>
            <p className="text-xs text-muted-foreground mt-0.5">Receba um resumo das atividades do dia</p>
          </div>
          <Toggle2 value={resumo} onChange={() => setResumo(p => !p)} />
        </div>
      </div>
      <div className="surface-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-1">Tipos de notificação</h3>
        <p className="text-xs text-muted-foreground mb-4">Configure quais eventos geram notificações in-app e push.</p>
        <div className="space-y-1">
          <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border mb-1">
            <span>Evento</span><span className="text-center">In-app</span><span className="text-center">Push</span>
          </div>
          {([
            { key: "atribuido",  label: "Conteúdo atribuído a mim" },
            { key: "status",     label: "Mudança de status em meus conteúdos" },
            { key: "vencimento", label: "Prazo de entrega próximo" },
            { key: "mencao",     label: "Menção em comentário" },
          ] as const).map(({ key, label }) => (
            <div key={key} className="grid grid-cols-3 gap-2 items-center px-3 py-3 rounded-xl hover:bg-muted/30 transition-colors">
              <span className="text-sm text-foreground">{label}</span>
              <div className="flex justify-center">
                <Toggle2 value={notifs[key].inApp} onChange={() => toggle(key, "inApp")} />
              </div>
              <div className="flex justify-center">
                <Toggle2 value={notifs[key].push} onChange={() => toggle(key, "push")} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabAutomacoes() {
  const [sub, setSub] = useState("Notificações");
  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-muted/30 border border-border overflow-x-auto scrollbar-none w-fit">
        {autoSubTabs.map(t => (
          <button key={t} onClick={() => setSub(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${sub === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>
      {sub === "Notificações"                                    && <AutoNotificacoes />}
      {["Projetos","Tarefas","WhatsApp","Novo","Recorrentes","Atalhos"].includes(sub) && <SubPlaceholder title={sub} />}
    </div>
  );
}

/* ── PÁGINA ── */
export default function ConfiguracoesPage() {
  const [active, setActive] = useState("Integrações");
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Personalize sua experiência no Dua CRM</p>
      </header>

      {/* Tabs principais */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-muted/40 border border-border overflow-x-auto scrollbar-none">
        {tabs.map(({ key, icon: Icon }) => (
          <button key={key} onClick={() => setActive(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${active === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5 shrink-0" />{key}
          </button>
        ))}
      </div>

      {active === "Perfil"       && <TabPerfil />}
      {active === "Assinatura"   && <TabAssinatura />}
      {active === "Mobile"       && <TabMobile />}
      {active === "Notificações" && <TabNotificacoes />}
      {active === "Automações"   && <TabAutomacoes />}
      {active === "Integrações"  && <TabIntegracoes />}
      {active === "Conteúdos"    && <TabConteudos />}
      {active === "Aparência"   && <TabAparencia />}
      {active === "Atualizações" && <TabPlaceholder title="Atualizações" />}
    </div>
  );
}
