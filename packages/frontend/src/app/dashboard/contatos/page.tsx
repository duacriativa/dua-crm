"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Download, Upload, Phone, Mail,
  MoreVertical, User, Edit, MessageCircle, SlidersHorizontal, X, RefreshCw,
  Crown, Heart, TrendingUp, Bell, Snowflake, Skull, Sparkles,
  ArrowUpRight, ArrowDownRight, AlertTriangle, LayoutGrid, List as ListIcon,
  BarChart2, Info,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

/* ── tipos ── */
type SegmentTab = "ALL"|"NEW"|"ACTIVE"|"VIP"|"AT_RISK"|"DORMANT";
interface Contact {
  id:string; name:string; phone?:string; email?:string;
  segment?:string; tags?:string[]; createdAt:string;
  totalSpent:number; orderCount:number; lastPurchaseAt?:string;
}

/* ── RFV ── */
type RfvKey = "champions"|"loyal"|"potential"|"new"|"promising"|"needAttention"|"aboutToSleep"|"atRisk"|"cantLose"|"hibernating"|"lost";
interface RfvSeg { key:RfvKey; label:string; description:string; icon:any; bg:string; border:string; text:string; }

const RFV: Record<RfvKey,RfvSeg> = {
  champions:    {key:"champions",    label:"Campeões",           description:"Compraram recente, com frequência e alto valor.",      icon:Crown,         bg:"bg-sky-600",    border:"border-sky-700",    text:"text-white"},
  loyal:        {key:"loyal",        label:"Clientes leais",     description:"Frequentes e bom valor. Engaje com fidelidade.",       icon:Heart,         bg:"bg-sky-200",    border:"border-sky-300",    text:"text-sky-900"},
  potential:    {key:"potential",    label:"Potenciais leais",   description:"Compraram recente, valor médio. Faça upsell.",         icon:TrendingUp,    bg:"bg-sky-100",    border:"border-sky-200",    text:"text-sky-900"},
  new:          {key:"new",          label:"Clientes recentes",  description:"Compra recente, baixa frequência. Onboarding.",        icon:Sparkles,      bg:"bg-amber-300",  border:"border-amber-400",  text:"text-amber-900"},
  promising:    {key:"promising",    label:"Promissores",        description:"Recente mas gastou pouco. Eduque sobre valor.",        icon:ArrowUpRight,  bg:"bg-sky-500",    border:"border-sky-600",    text:"text-white"},
  needAttention:{key:"needAttention",label:"Precisam de atenção",description:"Recência, freq. e valor médios. Reative.",            icon:Bell,          bg:"bg-emerald-500",border:"border-emerald-600", text:"text-white"},
  aboutToSleep: {key:"aboutToSleep", label:"Prestes a dormir",  description:"Caindo de engajamento. Campanha de reativação.",       icon:Snowflake,     bg:"bg-sky-300",    border:"border-sky-400",    text:"text-sky-900"},
  atRisk:       {key:"atRisk",       label:"Em risco",           description:"Bons clientes que sumiram. Personalize a abordagem.", icon:AlertTriangle, bg:"bg-cyan-500",   border:"border-cyan-600",   text:"text-white"},
  cantLose:     {key:"cantLose",     label:"Não pode perdê-los", description:"Alto valor, sumiram. PRIORIDADE máxima.",             icon:AlertTriangle, bg:"bg-yellow-300", border:"border-yellow-400", text:"text-yellow-900"},
  hibernating:  {key:"hibernating",  label:"Hibernando",         description:"Inativos há muito tempo, valor médio.",               icon:Snowflake,     bg:"bg-slate-700",  border:"border-slate-800",  text:"text-white"},
  lost:         {key:"lost",         label:"Perdidos",           description:"Praticamente perdidos. Última tentativa ou arquive.", icon:Skull,         bg:"bg-rose-400",   border:"border-rose-500",   text:"text-white"},
};

function calcRFV(c:Contact):{r:number;f:number;v:number}{
  let r=1;
  if(c.lastPurchaseAt){const d=Math.floor((Date.now()-new Date(c.lastPurchaseAt).getTime())/86400000);r=d<=7?5:d<=30?4:d<=60?3:d<=120?2:1;}
  else{const d=Math.floor((Date.now()-new Date(c.createdAt).getTime())/86400000);r=d<=14?2:1;}
  const oc=c.orderCount??0;const f=oc>=10?5:oc>=5?4:oc>=3?3:oc>=1?2:1;
  const ts=c.totalSpent??0;const v=ts>=5000?5:ts>=2000?4:ts>=800?3:ts>=200?2:1;
  return{r,f,v};
}
function classifyRFV(r:number,f:number,v:number):RfvKey{
  if(r>=4&&f>=4&&v>=4)return"champions";if(r>=3&&f>=4)return"loyal";
  if(r>=4&&f<=2&&v<=2)return"new";if(r>=4&&f<=3)return"potential";
  if(r>=3&&f<=2&&v<=2)return"promising";if(r<=2&&f>=4&&v>=4)return"cantLose";
  if(r<=2&&f>=3&&v>=3)return"atRisk";if(r===2&&f<=2)return"aboutToSleep";
  if(r<=2&&f<=2&&v<=2)return"lost";if(r<=2)return"hibernating";
  return"needAttention";
}
type EC=Contact&{r:number;f:number;v:number;rfvKey:RfvKey;rfvSeg:RfvSeg};
function enrich(c:Contact):EC{const{r,f,v}=calcRFV(c);const rfvKey=classifyRFV(r,f,v);return{...c,r,f,v,rfvKey,rfvSeg:RFV[rfvKey]};}

const segTabs:{label:string;value:SegmentTab}[]=[
  {label:"Todos",value:"ALL"},{label:"Novos",value:"NEW"},{label:"Ativos",value:"ACTIVE"},
  {label:"VIP",value:"VIP"},{label:"Em Risco",value:"AT_RISK"},{label:"Inativos",value:"DORMANT"},
];

function RfvBadge({seg}:{seg:RfvSeg}){const Icon=seg.icon;return(
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${seg.bg} ${seg.text} ${seg.border}`}>
    <Icon className="w-3 h-3 shrink-0"/>{seg.label}
  </span>
);}
function Dots({value}:{value:number}){return(
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(n=><span key={n} className={`h-1.5 w-1.5 rounded-full ${n<=value?"bg-primary":"bg-muted"}`}/>)}
  </div>
);}

const MATRIX_BLOCKS:{key:RfvKey;col:[number,number];row:[number,number]}[]=[
  {key:"cantLose",col:[1,3],row:[1,3]},{key:"loyal",col:[4,6],row:[1,4]},{key:"champions",col:[10,3],row:[1,2]},
  {key:"atRisk",col:[1,3],row:[4,4]},{key:"needAttention",col:[6,2],row:[5,2]},{key:"potential",col:[8,5],row:[3,5]},
  {key:"lost",col:[1,3],row:[8,5]},{key:"hibernating",col:[4,2],row:[8,2]},{key:"aboutToSleep",col:[6,2],row:[8,4]},
  {key:"promising",col:[8,2],row:[10,3]},{key:"new",col:[10,3],row:[10,3]},
];

type ViewMode="list"|"grid"|"matrix";

export default function ContatosPage(){
  const router=useRouter();
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [activeSeg,setActiveSeg]=useState<SegmentTab>("ALL");
  const [viewMode,setViewMode]=useState<ViewMode>("list");
  const [rfvFilter,setRfvFilter]=useState<RfvKey|"all">("all");
  const [showNew,setShowNew]=useState(false);
  const [newC,setNewC]=useState({name:"",phone:"",email:""});

  const fetchContacts=useCallback(async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({limit:"200"});
      if(activeSeg!=="ALL")p.set("segment",activeSeg);
      if(search)p.set("search",search);
      const res=await fetch(`${API_URL}/api/v1/contacts?${p}`,{headers:authHeaders()});
      if(!res.ok)return;
      const data=await res.json();
      setContacts(data.contacts??[]);setTotal(data.total??0);
    }finally{setLoading(false);}
  },[activeSeg,search]);

  useEffect(()=>{fetchContacts();},[fetchContacts]);

  const enriched=useMemo(()=>contacts.map(enrich),[contacts]);
  const filtered=useMemo(()=>rfvFilter==="all"?enriched:enriched.filter(c=>c.rfvKey===rfvFilter),[enriched,rfvFilter]);

  const totalSpent=enriched.reduce((s,c)=>s+(c.totalSpent??0),0);
  const champions=enriched.filter(c=>c.rfvKey==="champions").length;
  const atRisk=enriched.filter(c=>c.rfvKey==="atRisk"||c.rfvKey==="cantLose").length;
  const dormant=enriched.filter(c=>c.rfvKey==="lost"||c.rfvKey==="hibernating").length;

  const dist=(Object.keys(RFV)as RfvKey[])
    .map(k=>({key:k,seg:RFV[k],count:enriched.filter(c=>c.rfvKey===k).length}))
    .filter(d=>d.count>0).sort((a,b)=>b.count-a.count);

  const addContact=async()=>{
    if(!newC.name.trim())return;
    await fetch(`${API_URL}/api/v1/contacts`,{method:"POST",headers:authHeaders(),body:JSON.stringify(newC)});
    setNewC({name:"",phone:"",email:""});setShowNew(false);fetchContacts();
  };

  const isRfvMode=viewMode==="matrix"||viewMode==="grid";

  return(
    <div className="h-full flex flex-col bg-background animate-fade-in">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-xl px-4 py-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h1 className="text-lg font-bold text-foreground">Contatos</h1>
            <p className="text-xs text-muted-foreground">{loading?"Carregando...":`${total} contatos cadastrados`}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/60 transition-colors">
              <Upload className="w-4 h-4"/><span>Importar</span>
            </button>
            <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/60 transition-colors">
              <Download className="w-4 h-4"/><span>Exportar</span>
            </button>
            <button onClick={()=>setShowNew(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity shadow-elegant">
              <Plus className="w-4 h-4"/><span>Novo Contato</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, telefone..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"/>
          </div>
          <div className="flex items-center gap-0.5 bg-muted/40 border border-border rounded-xl p-1 shrink-0">
            {([["list",ListIcon,"Lista"],["grid",LayoutGrid,"Grid"],["matrix",BarChart2,"Matriz"]] as const).map(([mode,Icon,label])=>(
              <button key={mode} onClick={()=>setViewMode(mode)} title={label}
                className={`p-1.5 rounded-lg transition-colors ${viewMode===mode?"bg-background shadow text-primary":"text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-4 h-4"/>
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/60 transition-colors shrink-0">
            <SlidersHorizontal className="w-4 h-4"/><span className="hidden sm:inline">Filtros</span>
          </button>
        </div>
        {viewMode==="list"&&(
          <div className="flex gap-1 mt-3 overflow-x-auto pb-1 scrollbar-none">
            {segTabs.map(tab=>{
              const count=tab.value==="ALL"?contacts.length:contacts.filter(c=>c.segment===tab.value).length;
              return(
                <button key={tab.value} onClick={()=>setActiveSeg(tab.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors ${activeSeg===tab.value?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
                  {tab.label}<span className={`ml-1 text-[10px] ${activeSeg===tab.value?"text-primary-foreground/70":"text-muted-foreground"}`}>({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto scrollbar-none">
        {/* KPIs */}
        {isRfvMode&&!loading&&enriched.length>0&&(
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
            {[
              {label:"Total gasto",value:`R$ ${totalSpent.toLocaleString("pt-BR")}`,hint:"Soma de todos os contatos",tone:"primary",Icon:undefined},
              {label:"Campeões",value:String(champions),hint:"R, F e V altos",tone:"success",Icon:Crown},
              {label:"Em risco",value:String(atRisk),hint:"Bons clientes sumindo",tone:"danger",Icon:AlertTriangle},
              {label:"Dormentes",value:String(dormant),hint:"Hibernando ou perdidos",tone:"muted",Icon:Snowflake},
            ].map(({label,value,hint,tone,Icon})=>{
              const tones={primary:"border-primary/30 bg-primary/5",success:"border-success/30 bg-success/5",danger:"border-destructive/30 bg-destructive/5",muted:"border-border bg-muted/30"};
              return(
                <div key={label} className={`rounded-2xl border p-4 ${tones[tone as keyof typeof tones]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    {Icon&&<Icon className="w-4 h-4 text-muted-foreground"/>}
                  </div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Chips RFV */}
        {isRfvMode&&!loading&&enriched.length>0&&(
          <div className="px-4 pb-3">
            <div className="surface-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-muted-foreground">Filtrar por segmento</p>
                <Info className="w-3.5 h-3.5 text-muted-foreground"/>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={()=>setRfvFilter("all")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${rfvFilter==="all"?"bg-primary text-primary-foreground border-primary":"bg-muted/40 text-muted-foreground border-border hover:bg-muted/60"}`}>
                  Todos · {enriched.length}
                </button>
                {dist.map(d=>{const Icon=d.seg.icon;const active=rfvFilter===d.key;return(
                  <button key={d.key} onClick={()=>setRfvFilter(active?"all":d.key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${active?`${d.seg.bg} ${d.seg.text} ${d.seg.border} ring-2 ring-offset-2 ring-offset-background ring-primary/40`:`${d.seg.bg} ${d.seg.text} ${d.seg.border} opacity-75 hover:opacity-100`}`}>
                    <Icon className="w-3 h-3"/>{d.seg.label} · {d.count}
                  </button>
                );})}
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        {!loading&&filtered.length>0&&viewMode==="list"&&(
          <>
            <div className="block sm:hidden divide-y divide-border">
              {filtered.map(c=>(
                <div key={c.id} onClick={()=>router.push(`/dashboard/contatos/${c.id}`)}
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary text-white font-bold text-sm flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    {c.phone&&<p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3"/>{c.phone}</p>}
                    <div className="mt-1"><RfvBadge seg={c.rfvSeg}/></div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p className="font-mono font-medium text-foreground">R$ {(c.totalSpent??0).toLocaleString("pt-BR")}</p>
                    <p>{c.orderCount??0} pedidos</p>
                  </div>
                </div>
              ))}
            </div>
            <table className="hidden sm:table w-full text-sm">
              <thead className="border-b border-border bg-muted/20 sticky top-0 z-10">
                <tr>
                  {["Contato","Segmento RFV","Score","Total gasto","Pedidos","Última compra",""].map((h,i)=>(
                    <th key={i} className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${i>=3?"text-right hidden lg:table-cell":i===2||i===6?"text-left":""} ${i===6?"w-10":""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(c=>{
                  const lp=c.lastPurchaseAt?new Date(c.lastPurchaseAt).toLocaleDateString("pt-BR"):"—";
                  return(
                    <tr key={c.id} onClick={()=>router.push(`/dashboard/contatos/${c.id}`)}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-primary text-white font-bold text-sm flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
                          <div>
                            <p className="font-medium text-foreground">{c.name}</p>
                            {c.phone&&<p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3"/>{c.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><RfvBadge seg={c.rfvSeg}/></td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {(["r","f","v"]as const).map(dim=>(
                            <div key={dim} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground w-3 uppercase">{dim}</span>
                              <Dots value={c[dim]}/>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium text-foreground hidden lg:table-cell">R$ {(c.totalSpent??0).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{c.orderCount??0}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{lp}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e=>{e.stopPropagation();router.push(`/dashboard/conversas?phone=${encodeURIComponent(c.phone||"")}&name=${encodeURIComponent(c.name||"")}`);}}
                            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"><MessageCircle className="w-4 h-4"/></button>
                          <button className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4"/></button>
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
        {!loading&&filtered.length>0&&viewMode==="grid"&&(
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(c=>(
              <div key={c.id} onClick={()=>router.push(`/dashboard/contatos/${c.id}`)}
                className={`surface-card p-5 cursor-pointer hover:shadow-elegant hover:-translate-y-0.5 transition-all border-l-2 ${c.rfvSeg.border}`}>
                {/* Nome + setor */}
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-bold text-foreground text-base leading-tight">{c.name}</p>
                    <RfvBadge seg={c.rfvSeg}/>
                  </div>
                  {c.segment&&<p className="text-xs text-muted-foreground">{c.segment}</p>}
                  {c.email&&<p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                </div>
                {/* Scores R F V numéricos */}
                <div className="flex items-center gap-3 mb-3 px-3 py-2.5 rounded-xl bg-muted/30 border border-border">
                  {([
                    {dim:"r",color:"text-sky-400",   label:"R"},
                    {dim:"f",color:"text-violet-400", label:"F"},
                    {dim:"v",color:"text-emerald-400",label:"V"},
                  ] as const).map(({dim,color,label})=>(
                    <div key={dim} className="flex items-baseline gap-0.5">
                      <span className={`text-xs font-bold ${color}`}>{label}</span>
                      <span className="text-xl font-bold text-foreground">{c[dim]}</span>
                    </div>
                  ))}
                  <div className="ml-auto text-[10px] text-muted-foreground font-mono">
                    {c.r>=4&&c.f>=4&&c.v>=4?"R5F5V5":c.rfvKey==="cantLose"?"R2F5V5":c.rfvKey==="lost"?"R1F1V1":`R${c.r}F${c.f}V${c.v}`}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{c.orderCount??0} pedidos</span>
                  <span className="font-mono font-semibold text-foreground">R$ {(c.totalSpent??0).toLocaleString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Matriz */}
        {!loading&&filtered.length>0&&viewMode==="matrix"&&(
          <div className="p-4">
            <div className="surface-card p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground text-sm">Matriz RFM</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Posição combina <strong>Recência</strong> (horizontal) com <strong>Frequência + Valor</strong> (vertical).</p>
              </div>
              <div className="flex gap-3">
                <div className="flex w-5 items-center justify-center shrink-0">
                  <span className="text-[10px] font-medium text-muted-foreground -rotate-90 whitespace-nowrap">Freq + Valor ↑</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="grid w-full gap-1" style={{gridTemplateColumns:"repeat(12, minmax(0,1fr))",gridTemplateRows:"repeat(12, minmax(0,1fr))",aspectRatio:"1/1"}}>
                    {MATRIX_BLOCKS.map(b=>{
                      const seg=RFV[b.key];const list=filtered.filter(c=>c.rfvKey===b.key);const Icon=seg.icon;
                      return(
                        <div key={b.key} title={`${seg.label} — ${seg.description}`}
                          className={`relative flex flex-col justify-between overflow-hidden rounded-lg border p-1.5 transition-transform hover:scale-[1.02] cursor-pointer ${seg.bg} ${seg.border} ${seg.text}`}
                          style={{gridColumn:`${b.col[0]} / span ${b.col[1]}`,gridRow:`${b.row[0]} / span ${b.row[1]}`}}>
                          <div className="flex items-start justify-between gap-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <Icon className="w-3 h-3 shrink-0"/>
                              <span className="text-[10px] font-semibold leading-tight line-clamp-2">{seg.label}</span>
                            </div>
                            {list.length>0&&<span className="text-[10px] font-bold bg-black/10 rounded-full px-1 shrink-0">{list.length}</span>}
                          </div>
                          {list.length>0&&(
                            <div className="flex flex-wrap gap-0.5 mt-1">
                              {list.slice(0,12).map(c=><span key={c.id} className="h-1.5 w-1.5 rounded-full bg-white/60" title={c.name}/>)}
                              {list.length>12&&<span className="text-[9px] opacity-70">+{list.length-12}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-right text-[10px] font-medium text-muted-foreground mt-1">Recência →</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading&&(
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mb-2 opacity-40"/>
            <p className="text-sm">Carregando...</p>
          </div>
        )}
        {!loading&&filtered.length===0&&(
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <User className="w-10 h-10 mb-3 opacity-30"/>
            <p className="text-sm font-medium">Nenhum contato encontrado</p>
            <p className="text-xs mt-1 opacity-70">Os contatos do WhatsApp aparecem automaticamente ao receber mensagens</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showNew&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">Novo Contato</h2>
              <button onClick={()=>setShowNew(false)} className="p-1.5 rounded-xl hover:bg-muted/60 transition-colors"><X className="w-4 h-4 text-muted-foreground"/></button>
            </div>
            <div className="space-y-4">
              {[{label:"Nome *",key:"name",ph:"Ex: Ana Lima"},{label:"WhatsApp",key:"phone",ph:"+55 11 99999-9999"},{label:"E-mail",key:"email",ph:"ana@email.com"}].map(f=>(
                <div key={f.key}>
                  <label className="text-sm font-medium text-foreground block mb-1.5">{f.label}</label>
                  <input value={newC[f.key as keyof typeof newC]} onChange={e=>setNewC(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.ph} autoFocus={f.key==="name"}
                    className="w-full px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"/>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowNew(false)} className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted/60 transition-colors">Cancelar</button>
              <button onClick={addContact} className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
