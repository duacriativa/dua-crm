"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Mail, Phone, X, RefreshCw,
  LayoutGrid, List as ListIcon, Link2, ChevronDown,
  Tag, FileText, MapPin, Hash, Users, TrendingUp,
  AlertCircle, Star, Check, MessageCircle, Edit,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

/* ── Tipos ── */
interface Contact {
  id: string; name: string; phone?: string; email?: string;
  segment?: string; tags?: string[]; createdAt: string;
  totalSpent: number; orderCount: number; lastPurchaseAt?: string; notes?: string;
  type?: string; clientSince?: string;
  contracts?: { monthlyValue: number; serviceType: string }[];
}

/* ── Serviços (virá do módulo Serviços futuramente) ── */
const SERVICES_OPTIONS = [
  "Social Media","Gestão de Tráfego","Branding / Identidade Visual",
  "Criação de Site","E-commerce","Produção de Conteúdo",
  "Assessoria de Imprensa","Consultoria de Marketing",
  "Campanhas Pagas (Meta Ads)","Campanhas Pagas (Google Ads)",
  "Email Marketing","Influencer Marketing","Fotografia e Vídeo","Outro",
];

const SEG_COLOR: Record<string,string> = {
  NEW: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  VIP: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  AT_RISK: "bg-red-500/15 text-red-400 border-red-500/30",
  DORMANT: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};
const SEG_LABEL: Record<string,string> = {
  NEW:"Novo", ACTIVE:"Ativo", VIP:"VIP", AT_RISK:"Em Risco", DORMANT:"Inativo",
};

const AVATAR_COLORS = [
  "from-violet-500 to-purple-600","from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600","from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600","from-indigo-500 to-blue-600",
];
function avatarGrad(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

const EMPTY_FORM = {
  name:"", phone:"", email:"", cpfCnpj:"", zipCode:"",
  address:"", number:"", complement:"", neighborhood:"",
  city:"", state:"", projectInterest:"", tags:"", notes:"",
};


function TagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tags = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t].join(","));
    setInput("");
  };

  const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag).join(","));

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") { e.preventDefault(); addTag(input); }
    if (e.key === "Backspace" && !input && tags.length) removeTag(tags[tags.length - 1]);
  };

  return (
    <div className="min-h-[42px] flex flex-wrap gap-1.5 px-3 py-2 bg-muted/50 border border-border rounded-xl focus-within:ring-2 focus-within:ring-primary/50 cursor-text"
      onClick={() => document.getElementById("tag-input-field")?.focus()}>
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
          {tag}
          <button type="button" onClick={e => { e.stopPropagation(); removeTag(tag); }} className="hover:text-red-400 transition-colors">×</button>
        </span>
      ))}
      <input id="tag-input-field" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? "Branding, Urgente..." : ""}
        className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground" />
    </div>
  );
}

export default function ContatosPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list"|"grid">("list");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [segFilter, setSegFilter] = useState("ALL");

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: "200", type: "CLIENT" });
      if (segFilter !== "ALL") p.set("segment", segFilter);
      if (search) p.set("search", search);
      const res = await fetch(`${API_URL}/api/v1/contacts?${p}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setContacts(data.contacts ?? []); setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  }, [segFilter, search]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const [stats, setStats] = useState({ totalClients: 0, newThisMonth: 0, renewalsSoon: 0, mrr: 0 });

  useEffect(() => {
    fetch(`${API_URL}/api/v1/contacts/stats`, { headers: authHeaders() })
      .then(r => r.json()).then(data => setStats(data)).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const notesText = [
        form.projectInterest ? `Serviço: ${form.projectInterest}` : "",
        form.address ? `Endereço: ${form.address}${form.number ? ", "+form.number : ""}${form.complement ? " "+form.complement : ""} - ${form.neighborhood}, ${form.city}/${form.state} - CEP ${form.zipCode}` : "",
        form.cpfCnpj ? `CPF/CNPJ: ${form.cpfCnpj}` : "",
        form.notes,
      ].filter(Boolean).join("\n");
      await fetch(`${API_URL}/api/v1/contacts`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone || undefined,
          email: form.email || undefined,
          notes: notesText || undefined,
          tags: form.tags ? form.tags.split(",").map(t=>t.trim()).filter(Boolean) : [],
          type: "CLIENT",
        }),
      });
      setForm(EMPTY_FORM); setShowModal(false); fetchContacts();
    } finally { setSaving(false); }
  };

  const handleCepBlur = async () => {
    const cep = form.zipCode.replace(/\D/g,"");
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) setForm(f => ({
        ...f, address: data.logradouro||f.address,
        neighborhood: data.bairro||f.neighborhood,
        city: data.localidade||f.city, state: data.uf||f.state,
      }));
    } catch {}
  };

  const segTabs = [
    {label:"Todos",value:"ALL",count:total},
    {label:"Novos",value:"NEW",count:contacts.filter(c=>c.segment==="NEW").length},
    {label:"Ativos",value:"ACTIVE",count:contacts.filter(c=>c.segment==="ACTIVE").length},
    {label:"VIP",value:"VIP",count:contacts.filter(c=>c.segment==="VIP").length},
    {label:"Em Risco",value:"AT_RISK",count:contacts.filter(c=>c.segment==="AT_RISK").length},
    {label:"Inativos",value:"DORMANT",count:contacts.filter(c=>c.segment==="DORMANT").length},
  ];

  const inp = "w-full px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground";

  return (
    <div className="h-full flex flex-col bg-background">

      {/* ── Topo ── */}
      <div className="border-b border-border bg-background/80 backdrop-blur-xl px-6 py-5 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie todos os seus clientes cadastrados</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <Link2 className="w-4 h-4"/><span>Link de Cadastro</span>
            </button>
            <button onClick={()=>setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity shadow-elegant">
              <Plus className="w-4 h-4"/><span>Cadastrar Cliente</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            {label:"Total de Clientes",value:loading?"—":String(stats.totalClients),sub:null,Icon:Users,c:"text-violet-400",bg:"bg-violet-500/10 border-violet-500/20"},
            {label:"Novos este Mês",value:loading?"—":String(stats.newThisMonth),sub:null,Icon:TrendingUp,c:"text-emerald-400",bg:"bg-emerald-500/10 border-emerald-500/20"},
            {label:"Renovações próximas",value:loading?"—":String(stats.renewalsSoon),sub:"nos próximos 30 dias",Icon:AlertCircle,c:"text-amber-400",bg:"bg-amber-500/10 border-amber-500/20"},
            {label:"MRR (Receita Mensal)",value:loading?"—":`R$ ${stats.mrr.toLocaleString("pt-BR",{minimumFractionDigits:2})}`,sub:"contratos ativos",Icon:Star,c:"text-blue-400",bg:"bg-blue-500/10 border-blue-500/20"},
          ].map(({label,value,sub,Icon,c,bg})=>(
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <Icon className={`w-4 h-4 ${c}`}/>
              </div>
              <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
              {sub&&<p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Busca + toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Buscar por nome, email, empresa..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"/>
          </div>
          <div className="flex items-center gap-0.5 bg-muted/40 border border-border rounded-xl p-1 shrink-0">
            {([["list",ListIcon],["grid",LayoutGrid]] as const).map(([mode,Icon])=>(
              <button key={mode} onClick={()=>setViewMode(mode)}
                className={`p-2 rounded-lg transition-colors ${viewMode===mode?"bg-background shadow text-primary":"text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-4 h-4"/>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5 scrollbar-none">
          {segTabs.map(tab=>(
            <button key={tab.value} onClick={()=>setSegFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${segFilter===tab.value?"bg-primary text-white":"text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
              {tab.label}<span className={`ml-1 ${segFilter===tab.value?"text-white/70":"text-muted-foreground"}`}>({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista / Grid ── */}
      <div className="flex-1 overflow-auto scrollbar-none">
        {loading&&(
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mb-2 opacity-40"/>
            <p className="text-sm">Carregando...</p>
          </div>
        )}

        {!loading&&contacts.length===0&&(
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 opacity-30"/>
            </div>
            <p className="text-sm font-medium">Nenhum cliente cadastrado ainda.</p>
            <p className="text-xs mt-1 opacity-70">Comece adicionando seu primeiro cliente!</p>
            <button onClick={()=>setShowModal(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4"/>Cadastrar Cliente
            </button>
          </div>
        )}

        {/* Lista desktop */}
        {!loading&&contacts.length>0&&viewMode==="list"&&(
          <>
            <div className="block sm:hidden divide-y divide-border">
              {contacts.map(c=>(
                <div key={c.id} onClick={()=>router.push(`/dashboard/contatos/${c.id}`)}
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGrad(c.name)} text-white font-bold text-sm flex items-center justify-center shrink-0`}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    {c.phone&&<p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3"/>{c.phone}</p>}
                    {c.email&&!c.phone&&<p className="text-xs text-muted-foreground truncate mt-0.5">{c.email}</p>}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {c.segment&&<span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SEG_COLOR[c.segment]??SEG_COLOR.NEW}`}>{SEG_LABEL[c.segment]??c.segment}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-semibold text-foreground">R$ {(c.totalSpent??0).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
            <table className="hidden sm:table w-full text-sm">
              <thead className="border-b border-border bg-muted/20 sticky top-0 z-10">
                <tr>
                  {["Cliente","Contato","Segmento","Serviço","Tags",""].map((h,i)=>(
                    <th key={i} className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left ${i===5?"w-12":""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map(c=>{
                  const service = c.notes?.split("\n").find(l=>l.startsWith("Serviço:"))?.replace("Serviço: ","");
                  return(
                    <tr key={c.id} onClick={()=>router.push(`/dashboard/contatos/${c.id}`)}
                      className="hover:bg-muted/25 transition-colors group cursor-pointer">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGrad(c.name)} text-white font-bold text-sm flex items-center justify-center shrink-0`}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{c.name}</p>
                            {c.email&&<p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.phone?<p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3"/>{c.phone}</p>:<span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {c.segment?<span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${SEG_COLOR[c.segment]??SEG_COLOR.NEW}`}>{SEG_LABEL[c.segment]??c.segment}</span>:<span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {service?<span className="text-xs text-muted-foreground bg-muted/40 border border-border px-2 py-1 rounded-lg">{service}</span>:<span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags??[]).slice(0,2).map(tag=>(
                            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">{tag}</span>
                          ))}
                          {(c.tags??[]).length>2&&<span className="px-2 py-0.5 rounded-full text-[10px] text-muted-foreground">+{(c.tags??[]).length-2}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e=>{e.stopPropagation();router.push(`/dashboard/conversas?phone=${encodeURIComponent(c.phone||"")}&name=${encodeURIComponent(c.name||"")}`);}}
                            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"><MessageCircle className="w-4 h-4"/></button>
                          <button onClick={e=>{e.stopPropagation();router.push(`/dashboard/contatos/${c.id}`);}}
                            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"><Edit className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {/* Grid */}
        {!loading&&contacts.length>0&&viewMode==="grid"&&(
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5">
            {contacts.map(c=>{
              const service = c.notes?.split("\n").find(l=>l.startsWith("Serviço:"))?.replace("Serviço: ","");
              return(
                <div key={c.id} onClick={()=>router.push(`/dashboard/contatos/${c.id}`)}
                  className="surface-card p-5 cursor-pointer hover:shadow-elegant hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGrad(c.name)} text-white font-bold flex items-center justify-center shrink-0`}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{c.name}</p>
                      {c.email&&<p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                      {c.phone&&<p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {c.segment&&<span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SEG_COLOR[c.segment]??SEG_COLOR.NEW}`}>{SEG_LABEL[c.segment]??c.segment}</span>}
                    {service&&<span className="text-[10px] text-muted-foreground bg-muted/40 border border-border px-2 py-0.5 rounded-full truncate max-w-[120px]">{service}</span>}
                  </div>
                  {(c.tags??[]).length>0&&(
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(c.tags??[]).slice(0,3).map(tag=><span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">{tag}</span>)}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">{c.orderCount??0} pedidos</p>
                    <p className="text-sm font-bold text-foreground font-mono">R$ {(c.totalSpent??0).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════ MODAL ══════════════════ */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-bold text-foreground">Cadastrar Cliente</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Preencha os dados do novo cliente</p>
              </div>
              <button onClick={()=>{setShowModal(false);setForm(EMPTY_FORM);}}
                className="p-2 rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-5 space-y-5">
              {/* Pipeline */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Pipeline (opcional)</label>
                <div className="relative">
                  <select className={`${inp} appearance-none pr-10 border-2 border-primary/40`}>
                    <option value="">Selecione um pipeline</option>
                    <option>Leads</option><option>Vendas</option><option>Clientes Ativos</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/>
                </div>
              </div>

              {/* Dados principais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground block mb-1.5">Nome Cliente/Empresa <span className="text-red-400">*</span></label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                    placeholder="Ex: João Silva ou Agência XYZ" autoFocus className={inp}/>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Email</label>
                  <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                    <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                      placeholder="cliente@email.com" className={`${inp} pl-9`}/>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Telefone</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground shrink-0">
                      🇧🇷 <span className="text-muted-foreground text-xs">+55</span>
                    </div>
                    <input type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                      placeholder="(85) 99999-9999" className={`${inp} flex-1`}/>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground block mb-1.5">CPF/CNPJ</label>
                  <div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                    <input value={form.cpfCnpj} onChange={e=>setForm(f=>({...f,cpfCnpj:e.target.value}))}
                      placeholder="00.000.000/0000-00" className={`${inp} pl-9`}/>
                  </div>
                </div>
              </div>

              {/* CEP + Endereço */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5"/>Endereço
                </p>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">CEP</label>
                  <input value={form.zipCode} onChange={e=>setForm(f=>({...f,zipCode:e.target.value}))}
                    onBlur={handleCepBlur} placeholder="00000-000" className={inp}/>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-foreground block mb-1.5">Endereço</label>
                    <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}
                      placeholder="Rua, Avenida..." className={inp}/>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Número</label>
                    <input value={form.number} onChange={e=>setForm(f=>({...f,number:e.target.value}))}
                      placeholder="Nº" className={inp}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {label:"Complemento",key:"complement",ph:"Apto, Sala..."},
                    {label:"Bairro",key:"neighborhood",ph:"Bairro"},
                    {label:"Cidade",key:"city",ph:"Cidade"},
                    {label:"Estado",key:"state",ph:"UF"},
                  ].map(({label,key,ph})=>(
                    <div key={key}>
                      <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
                      <input value={(form as any)[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                        placeholder={ph} maxLength={key==="state"?2:undefined} className={inp}/>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projeto/Interesse */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Projeto/Interesse</label>
                <div className="relative">
                  <select value={form.projectInterest} onChange={e=>setForm(f=>({...f,projectInterest:e.target.value}))}
                    className={`${inp} appearance-none pr-10`}>
                    <option value="">Ex: Logo, Site, Social Media</option>
                    {SERVICES_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/>
                </div>
              </div>

              {/* Tags — chips interativos */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground"/>Tags
                </label>
                <TagInput value={form.tags} onChange={v => setForm(f => ({...f, tags: v}))} />
                <p className="text-xs text-muted-foreground mt-1">Digite e pressione vírgula ou Enter para adicionar</p>
              </div>

              {/* Observações */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground"/>Observações
                </label>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  rows={3} placeholder="Notas sobre o lead"
                  className={`${inp} resize-none`}/>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
              <button onClick={()=>{setShowModal(false);setForm(EMPTY_FORM);}}
                className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors whitespace-nowrap">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!form.name.trim()||saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap">
                {saving?<><RefreshCw className="w-4 h-4 animate-spin"/>Salvando...</>:<><Check className="w-4 h-4"/>Cadastrar Cliente</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
