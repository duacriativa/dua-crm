"use client";

import { useState } from "react";
import {
  User, Palette, RefreshCw, CreditCard, Smartphone, Bell,
  Zap, Puzzle, FileText, Plus, Trash2, Save, Check,
  ChevronRight, Globe, Building2, Phone, Hash,
  MapPin, Mail, AlertCircle, Upload, MessageCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

const tabs = [
  { key: "Perfil",       icon: User },
  { key: "Aparência",    icon: Palette },
  { key: "Notificações", icon: Bell },
  { key: "Integrações",  icon: Puzzle },
];

/* ── PERFIL ── */
function TabPerfil() {
  const [form, setForm] = useState({
    nome: "Daniel Wendell", empresa: "Dua Criativa",
    telefone: "+55 85 99999-9999", cpfCnpj: "12.345.678/0001-90",
    endereco: "Rua das Flores", numero: "123", bairro: "Meireles",
    cidade: "Fortaleza", estado: "CE", cep: "60165-120",
  });
  const [saved, setSaved] = useState(false);

  const inp = "w-full px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground";

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-foreground mb-4">Informações da Empresa</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Nome / Responsável</label>
            <input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} className={inp} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Empresa</label>
            <input value={form.empresa} onChange={e => setForm(f => ({...f, empresa: e.target.value}))} className={inp} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Telefone</label>
            <input value={form.telefone} onChange={e => setForm(f => ({...f, telefone: e.target.value}))} className={inp} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">CPF / CNPJ</label>
            <input value={form.cpfCnpj} onChange={e => setForm(f => ({...f, cpfCnpj: e.target.value}))} className={inp} />
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-base font-bold text-foreground mb-4">Endereço</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-foreground block mb-1.5">Endereço</label>
            <input value={form.endereco} onChange={e => setForm(f => ({...f, endereco: e.target.value}))} className={inp} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Número</label>
            <input value={form.numero} onChange={e => setForm(f => ({...f, numero: e.target.value}))} className={inp} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Bairro</label>
            <input value={form.bairro} onChange={e => setForm(f => ({...f, bairro: e.target.value}))} className={inp} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Cidade</label>
            <input value={form.cidade} onChange={e => setForm(f => ({...f, cidade: e.target.value}))} className={inp} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">CEP</label>
            <input value={form.cep} onChange={e => setForm(f => ({...f, cep: e.target.value}))} className={inp} />
          </div>
        </div>
      </div>
      <button onClick={save} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity">
        {saved ? <><Check className="w-4 h-4" />Salvo!</> : <><Save className="w-4 h-4" />Salvar Alterações</>}
      </button>
    </div>
  );
}

/* ── APARÊNCIA ── */
function TabAparencia() {
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-base font-bold text-foreground mb-4">Aparência</h2>
      <div className="surface-card p-5">
        <p className="text-sm font-medium text-foreground mb-1">Tema</p>
        <p className="text-xs text-muted-foreground mb-3">Escolha entre modo escuro e claro</p>
        <div className="flex gap-3">
          {["Escuro", "Claro", "Sistema"].map(t => (
            <button key={t} className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${t === "Escuro" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="surface-card p-5">
        <p className="text-sm font-medium text-foreground mb-1">Cor de destaque</p>
        <p className="text-xs text-muted-foreground mb-3">Cor principal do CRM</p>
        <div className="flex gap-2">
          {["#8B5CF6","#6366F1","#EC4899","#10B981","#F59E0B","#3B82F6"].map(cor => (
            <button key={cor} className={`w-8 h-8 rounded-full border-2 transition-all ${cor === "#8B5CF6" ? "border-white scale-110" : "border-transparent hover:scale-105"}`}
              style={{backgroundColor: cor}} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── NOTIFICAÇÕES ── */
function TabNotificacoes() {
  const [notifs, setNotifs] = useState({
    novoLead: true, contratoVencendo: true, pagamentoPendente: true,
    mensagemWhatsapp: false, relatorioSemanal: true,
  });
  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-base font-bold text-foreground mb-4">Notificações</h2>
      {[
        { key: "novoLead", label: "Novo lead captado", sub: "Quando um novo lead entrar no funil" },
        { key: "contratoVencendo", label: "Contrato vencendo", sub: "30 dias antes do fim do contrato" },
        { key: "pagamentoPendente", label: "Pagamento pendente", sub: "Cobranças em atraso no Asaas" },
        { key: "mensagemWhatsapp", label: "Nova mensagem WhatsApp", sub: "Notificação de mensagens não lidas" },
        { key: "relatorioSemanal", label: "Relatório semanal", sub: "Resumo dos resultados da semana" },
      ].map(({ key, label, sub }) => (
        <div key={key} className="surface-card flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
          <button onClick={() => setNotifs(n => ({...n, [key]: !(n as any)[key]}))}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${(notifs as any)[key] ? "bg-primary" : "bg-muted"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${(notifs as any)[key] ? "left-5" : "left-0.5"}`} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── INTEGRAÇÕES ── */
function TabIntegracoes() {
  const router = useRouter();

  const integrations = [
    {
      key: "whatsapp",
      name: "WhatsApp",
      desc: "Conecte sua conta via Evolution API",
      icon: "💬",
      status: "disconnected",
      action: () => router.push("/dashboard/whatsapp"),
    },
    {
      key: "asaas",
      name: "Asaas",
      desc: "Cobranças e pagamentos automáticos",
      icon: "💳",
      status: "connected",
      action: () => {},
    },
  ];

  const comingSoon = [
    { name: "Google Agenda", desc: "Sincronize compromissos", icon: "📅" },
    { name: "Instagram", desc: "Mensagens diretas e comentários", icon: "📸" },
    { name: "OpenAI / IA", desc: "Potencialize bots e análises", icon: "✨" },
    { name: "Google Drive", desc: "Anexe arquivos da nuvem", icon: "📁" },
    { name: "Zapier", desc: "Conecte +5000 apps", icon: "⚡" },
    { name: "Nuvemshop", desc: "Sincronize pedidos e clientes", icon: "🛒" },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground mb-4">Integrações Ativas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {integrations.map(intg => (
            <div key={intg.key} className="surface-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-xl">{intg.icon}</div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{intg.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{intg.desc}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  intg.status === "connected"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                }`}>
                  {intg.status === "connected" ? "Conectado" : "Desconectado"}
                </span>
              </div>
              <button
                onClick={intg.action}
                className={`w-full py-2 text-sm font-medium rounded-xl transition-colors ${
                  intg.status === "connected"
                    ? "border border-border text-muted-foreground hover:bg-muted/50"
                    : "text-white bg-gradient-primary hover:opacity-90"
                }`}>
                {intg.status === "connected" ? "Gerenciar" : "Configurar"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-bold text-foreground mb-1">Em breve</h2>
        <p className="text-xs text-muted-foreground mb-4">Integrações que estamos desenvolvendo</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {comingSoon.map(intg => (
            <div key={intg.name} className="surface-card p-4 opacity-60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-lg">{intg.icon}</div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{intg.name}</p>
                  <p className="text-xs text-muted-foreground">{intg.desc}</p>
                </div>
              </div>
              <div className="w-full py-1.5 text-center text-xs font-medium text-muted-foreground border border-border rounded-xl">
                Em breve
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Não encontrou a integração que precisa?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Envie sua sugestão e avaliaremos.</p>
        </div>
        <button className="px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl hover:opacity-90 transition-opacity shrink-0">
          Sugerir Integração
        </button>
      </div>
    </div>
  );
}

/* ── PÁGINA PRINCIPAL ── */
export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState("Perfil");

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-background/80 backdrop-blur-xl px-6 py-5 shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Personalize sua experiência no Dua CRM</p>
        <div className="flex gap-1 mt-4 overflow-x-auto scrollbar-none">
          {tabs.map(({ key, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap ${
                activeTab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}>
              <Icon className="w-4 h-4" />{key}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto scrollbar-none p-6">
        {activeTab === "Perfil" && <TabPerfil />}
        {activeTab === "Aparência" && <TabAparencia />}
        {activeTab === "Notificações" && <TabNotificacoes />}
        {activeTab === "Integrações" && <TabIntegracoes />}
      </div>
    </div>
  );
}
