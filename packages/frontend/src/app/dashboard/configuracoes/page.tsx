"use client";

import { useState } from "react";

const tabs = ["Perfil","Aparência","Atualizações","Assinatura","Mobile","Notificações","Automações","Integrações","Conteúdos"];

const integrations = [
  { id:"whatsapp",  name:"WhatsApp",        desc:"Conecte sua conta via Evolution API", icon:"💬", status:"connected" },
  { id:"asaas",     name:"Asaas",           desc:"Cobranças e pagamentos automáticos",  icon:"💳", status:"connected" },
  { id:"instagram", name:"Instagram",       desc:"Mensagens diretas e comentários",     icon:"📸", status:"pending"   },
  { id:"nuvemshop", name:"Nuvemshop",       desc:"Sincronize pedidos e clientes",       icon:"🛒", status:"idle"      },
  { id:"shopify",   name:"Shopify",         desc:"Integração com sua loja Shopify",     icon:"🏪", status:"idle"      },
  { id:"openai",    name:"OpenAI / IA",     desc:"Potencialize bots e análises com IA", icon:"✨", status:"idle"      },
];

const statusColors: Record<string, string> = {
  connected: "bg-success/10 text-success border-success/20",
  pending:   "bg-warning/10 text-warning border-warning/20",
  idle:      "bg-muted/60 text-muted-foreground border-border",
};
const statusLabels: Record<string, string> = {
  connected: "Conectado", pending: "Pendente", idle: "Não configurado",
};

export default function ConfiguracoesPage() {
  const [active, setActive] = useState("Integrações");

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Personalize sua experiência no Dua CRM</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-muted/40 border border-border overflow-x-auto scrollbar-none">
        {tabs.map(t => (
          <button key={t} onClick={() => setActive(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${active === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Integrações */}
      {active === "Integrações" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map(i => (
            <div key={i.id} className="surface-card p-5 flex flex-col gap-4 hover:shadow-elegant hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-xl">{i.icon}</div>
                  <div>
                    <p className="font-semibold text-foreground">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.desc}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${statusColors[i.status]}`}>{statusLabels[i.status]}</span>
              </div>
              <button className={`w-full py-2 rounded-xl text-sm font-semibold transition-all ${i.status === "connected" ? "bg-muted/60 text-muted-foreground hover:bg-muted border border-border" : "bg-gradient-primary text-white hover:opacity-90 shadow-elegant"}`}>
                {i.status === "connected" ? "Gerenciar" : "Configurar"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Perfil */}
      {active === "Perfil" && (
        <div className="surface-card p-6 max-w-lg">
          <h2 className="text-lg font-semibold text-foreground mb-4">Meu perfil</h2>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-bold text-white shadow-glow">D</div>
            <div>
              <p className="font-semibold text-foreground">Daniel Guedes</p>
              <p className="text-sm text-muted-foreground">Plano PRO</p>
            </div>
          </div>
          <div className="space-y-3">
            {[{label:"Nome",value:"Daniel Guedes"},{label:"E-mail",value:"daniel@duacriativa.com"},{label:"WhatsApp",value:"+55 85 99999-9999"}].map(f=>(
              <div key={f.label}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{f.label}</label>
                <input defaultValue={f.value} className="w-full px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"/>
              </div>
            ))}
            <button className="w-full py-2.5 mt-2 rounded-xl text-sm font-semibold text-white bg-gradient-primary hover:opacity-90 transition-opacity">Salvar alterações</button>
          </div>
        </div>
      )}

      {/* Outros tabs — placeholder */}
      {!["Integrações","Perfil"].includes(active) && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4 text-3xl">⚙️</div>
          <p className="font-semibold text-foreground">{active}</p>
          <p className="text-sm mt-1">Em breve disponível</p>
        </div>
      )}
    </div>
  );
}
