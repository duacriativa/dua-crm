"use client";

import { useState, useCallback, useEffect } from "react";
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

  const save = () => {
    localStorage.setItem("dua-crm-profile", JSON.stringify(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Carregar ao montar
  useState(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("dua-crm-profile");
    if (saved) try { setForm(JSON.parse(saved)); } catch {}
  });

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

/* ── Definição dos temas ── */
const THEMES = [
  {
    id: "padrao", label: "Padrão", desc: "Escuro com vermelho vibrante", type: "dark",
    colors: ["#1a1a2e","#e11d48","#a855f7"],
    vars: { background:"240 14% 6%", card:"240 12% 9%", primary:"263 85% 65%", primaryGlow:"280 90% 72%", border:"240 8% 16%", muted:"240 8% 14%", sidebar:"240 14% 5%" },
  },
  {
    id: "midnight", label: "Midnight", desc: "Ultra escuro com azul profundo", type: "dark",
    colors: ["#0a0a1a","#1d4ed8","#60a5fa"],
    vars: { background:"230 25% 4%", card:"230 20% 7%", primary:"217 91% 60%", primaryGlow:"213 94% 68%", border:"230 15% 14%", muted:"230 15% 11%", sidebar:"230 25% 3%" },
  },
  {
    id: "amoled", label: "AMOLED", desc: "Preto puro com rosa", type: "dark",
    colors: ["#000000","#000000","#ec4899"],
    vars: { background:"0 0% 0%", card:"0 0% 4%", primary:"330 81% 60%", primaryGlow:"336 84% 68%", border:"0 0% 10%", muted:"0 0% 8%", sidebar:"0 0% 0%" },
  },
  {
    id: "blackblue", label: "Black & Blue", desc: "Preto puro com azul elétrico", type: "dark",
    colors: ["#000000","#1e40af","#60a5fa"],
    vars: { background:"0 0% 0%", card:"0 0% 5%", primary:"213 94% 68%", primaryGlow:"210 100% 74%", border:"0 0% 12%", muted:"0 0% 9%", sidebar:"0 0% 0%" },
  },
  {
    id: "blackgreen", label: "Black & Green", desc: "Preto puro com verde neon", type: "dark",
    colors: ["#000000","#15803d","#4ade80"],
    vars: { background:"0 0% 0%", card:"0 0% 5%", primary:"142 71% 45%", primaryGlow:"142 76% 55%", border:"0 0% 12%", muted:"0 0% 9%", sidebar:"0 0% 0%" },
  },
  {
    id: "blackpurple", label: "Black & Purple", desc: "Preto puro com roxo vibrante", type: "dark",
    colors: ["#000000","#7c3aed","#a78bfa"],
    vars: { background:"0 0% 0%", card:"0 0% 5%", primary:"258 90% 66%", primaryGlow:"262 83% 74%", border:"0 0% 12%", muted:"0 0% 9%", sidebar:"0 0% 0%" },
  },
  {
    id: "emerald", label: "Emerald", desc: "Escuro com verde esmeralda", type: "dark",
    colors: ["#0a1628","#065f46","#34d399"],
    vars: { background:"215 50% 9%", card:"215 45% 12%", primary:"160 84% 39%", primaryGlow:"158 64% 52%", border:"215 30% 18%", muted:"215 30% 14%", sidebar:"215 50% 7%" },
  },
  {
    id: "ocean", label: "Ocean", desc: "Escuro com ciano oceano", type: "dark",
    colors: ["#0c1a2e","#0891b2","#22d3ee"],
    vars: { background:"215 55% 8%", card:"215 50% 11%", primary:"189 94% 43%", primaryGlow:"187 96% 54%", border:"215 30% 17%", muted:"215 30% 13%", sidebar:"215 55% 6%" },
  },
  {
    id: "purplerain", label: "Purple Rain", desc: "Escuro com roxo intenso", type: "dark",
    colors: ["#1a0533","#7c3aed","#c084fc"],
    vars: { background:"272 60% 7%", card:"272 55% 10%", primary:"270 91% 65%", primaryGlow:"272 96% 74%", border:"272 35% 17%", muted:"272 35% 13%", sidebar:"272 60% 5%" },
  },
  {
    id: "monochrome", label: "Monocromático", desc: "Preto e branco, claro", type: "light",
    colors: ["#ffffff","#f4f4f5","#18181b"],
    vars: { background:"0 0% 98%", card:"0 0% 100%", primary:"0 0% 9%", primaryGlow:"0 0% 20%", border:"0 0% 89%", muted:"0 0% 94%", sidebar:"0 0% 96%" },
  },
  {
    id: "rosaclaro", label: "Rosa Claro", desc: "Claro com rosa vibrante", type: "light",
    colors: ["#fff1f2","#f43f5e","#fda4af"],
    vars: { background:"350 100% 97%", card:"0 0% 100%", primary:"347 77% 50%", primaryGlow:"345 83% 62%", border:"350 30% 88%", muted:"350 20% 94%", sidebar:"350 50% 96%" },
  },
  {
    id: "azulclaro", label: "Azul Claro", desc: "Claro com azul suave", type: "light",
    colors: ["#eff6ff","#3b82f6","#93c5fd"],
    vars: { background:"214 100% 97%", card:"0 0% 100%", primary:"217 91% 60%", primaryGlow:"213 94% 68%", border:"214 30% 88%", muted:"214 50% 93%", sidebar:"214 60% 95%" },
  },
  {
    id: "custom-dark", label: "Personalizado", desc: "Escolha sua cor — escuro", type: "dark",
    colors: ["#1a1a2e","#8B5CF6","#a78bfa"],
    vars: { background:"240 14% 6%", card:"240 12% 9%", primary:"263 85% 65%", primaryGlow:"280 90% 72%", border:"240 8% 16%", muted:"240 8% 14%", sidebar:"240 14% 5%" },
  },
  {
    id: "custom-light", label: "Personalizado", desc: "Escolha sua cor — claro", type: "light",
    colors: ["#ffffff","#8B5CF6","#a78bfa"],
    vars: { background:"0 0% 98%", card:"0 0% 100%", primary:"263 85% 65%", primaryGlow:"280 90% 72%", border:"0 0% 89%", muted:"0 0% 94%", sidebar:"0 0% 96%" },
  },
];

function applyTheme(theme: typeof THEMES[0]) {
  const root = document.documentElement;
  const v = theme.vars;
  const isDark = theme.type === "dark";

  root.style.setProperty("--background", v.background);
  root.style.setProperty("--foreground", isDark ? "0 0% 98%" : "240 10% 4%");
  root.style.setProperty("--card", v.card);
  root.style.setProperty("--card-foreground", isDark ? "0 0% 98%" : "240 10% 4%");
  root.style.setProperty("--popover", v.card);
  root.style.setProperty("--popover-foreground", isDark ? "0 0% 98%" : "240 10% 4%");
  root.style.setProperty("--primary", v.primary);
  root.style.setProperty("--primary-glow", v.primaryGlow);
  root.style.setProperty("--primary-foreground", isDark ? "0 0% 100%" : "0 0% 100%");
  root.style.setProperty("--muted", v.muted);
  root.style.setProperty("--muted-foreground", isDark ? "240 5% 60%" : "240 4% 46%");
  root.style.setProperty("--border", v.border);
  root.style.setProperty("--input", v.border);
  root.style.setProperty("--ring", v.primary);
  root.style.setProperty("--sidebar-background", v.sidebar);
  root.style.setProperty("--sidebar-foreground", isDark ? "240 5% 75%" : "240 10% 20%");
  root.style.setProperty("--sidebar-primary", v.primary);
  root.style.setProperty("--sidebar-border", v.muted);
  root.style.setProperty("--sidebar-accent", isDark ? "240 10% 12%" : "240 5% 92%");
  root.style.setProperty("--sidebar-accent-foreground", isDark ? "0 0% 98%" : "240 10% 10%");
  root.style.setProperty("--accent", isDark ? "263 70% 22%" : "214 32% 91%");
  root.style.setProperty("--accent-foreground", isDark ? "0 0% 98%" : "240 10% 4%");
  root.style.setProperty("--secondary", isDark ? "240 10% 14%" : "214 32% 91%");
  root.style.setProperty("--secondary-foreground", isDark ? "0 0% 98%" : "240 10% 4%");
  root.style.setProperty("--gradient-primary", `linear-gradient(135deg, hsl(${v.primary}), hsl(${v.primaryGlow}))`);
  root.style.setProperty("--gradient-card", isDark
    ? `linear-gradient(180deg, hsl(${v.card}), hsl(${v.background}))`
    : `linear-gradient(180deg, hsl(0 0% 100%), hsl(${v.muted}))`);

  localStorage.setItem("dua-crm-theme", theme.id);
}

/* ── APARÊNCIA ── */
function TabAparencia() {
  const [activeTheme, setActiveTheme] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("dua-crm-theme") ?? "padrao";
    return "padrao";
  });
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("dua-crm-fontsize") ?? "normal";
    return "normal";
  });
  const [customDarkColor, setCustomDarkColor] = useState(
    () => typeof window !== "undefined" ? (localStorage.getItem("dua-crm-custom-dark") ?? "#8B5CF6") : "#8B5CF6"
  );
  const [customLightColor, setCustomLightColor] = useState(
    () => typeof window !== "undefined" ? (localStorage.getItem("dua-crm-custom-light") ?? "#8B5CF6") : "#8B5CF6"
  );

  // Converte hex para HSL string
  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h=0,s=0,l=(max+min)/2;
    if(max!==min){const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);
      switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}}
    return `${Math.round(h*360)} ${Math.round(s*100)}% ${Math.round(l*100)}%`;
  };

  const applyCustomColor = (hex: string, isDark: boolean) => {
    const hsl = hexToHsl(hex);
    const themeId = isDark ? "custom-dark" : "custom-light";
    const baseTheme = THEMES.find(t => t.id === themeId)!;
    const glowH = parseInt(hsl.split(" ")[0]) + 15;
    const glowHsl = `${glowH % 360} ${hsl.split(" ")[1]} ${parseInt(hsl.split(" ")[2])+8}%`;
    const customTheme = { ...baseTheme, vars: { ...baseTheme.vars, primary: hsl, primaryGlow: glowHsl } };
    applyTheme(customTheme as any);
    localStorage.setItem(isDark ? "dua-crm-custom-dark" : "dua-crm-custom-light", hex);
    setActiveTheme(themeId);
  };

  const selectTheme = (theme: typeof THEMES[0]) => {
    if (theme.id === "custom-dark" || theme.id === "custom-light") {
      const isDark = theme.id === "custom-dark";
      const hex = isDark ? customDarkColor : customLightColor;
      applyCustomColor(hex, isDark);
    } else {
      setActiveTheme(theme.id);
      applyTheme(theme);
    }
  };

  const selectFontSize = (size: string, px: number) => {
    setFontSize(size);
    document.documentElement.style.fontSize = `${px}px`;
    localStorage.setItem("dua-crm-fontsize", size);
  };

  const darkThemes = THEMES.filter(t => t.type === "dark");
  const lightThemes = THEMES.filter(t => t.type === "light");

  return (
    <div className="max-w-3xl space-y-6">
      {/* Temas escuros */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
          🌙 Temas escuros
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {darkThemes.map(theme => {
            const isCustom = theme.id === "custom-dark";
            const isActive = activeTheme === theme.id;
            return (
              <div key={theme.id} className={`surface-card p-4 text-left hover:border-primary/50 transition-all relative cursor-pointer ${isActive ? "border-primary ring-1 ring-primary/40" : ""}`}
                onClick={() => selectTheme(theme)}>
                {isActive && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                {isCustom ? (
                  <div className="mb-2">
                    <div className="w-full h-5 rounded-lg mb-1.5" style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }} />
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: customDarkColor }} />
                      <input type="color" value={customDarkColor}
                        onChange={e => { setCustomDarkColor(e.target.value); applyCustomColor(e.target.value, true); }}
                        onClick={e => e.stopPropagation()}
                        className="w-full h-5 opacity-0 absolute cursor-pointer" />
                      <span className="text-[9px] text-muted-foreground font-mono">{customDarkColor}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1 mb-2">
                    {theme.colors.map((col, i) => (
                      <div key={i} className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: col }} />
                    ))}
                  </div>
                )}
                <p className="text-xs font-semibold text-foreground">{theme.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{theme.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Temas claros */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
          ☀️ Temas claros
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {lightThemes.map(theme => {
            const isCustom = theme.id === "custom-light";
            const isActive = activeTheme === theme.id;
            return (
              <div key={theme.id} className={`surface-card p-4 text-left hover:border-primary/50 transition-all relative cursor-pointer ${isActive ? "border-primary ring-1 ring-primary/40" : ""}`}
                onClick={() => selectTheme(theme)}>
                {isActive && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                {isCustom ? (
                  <div className="mb-2">
                    <div className="w-full h-5 rounded-lg mb-1.5" style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }} />
                    <div className="flex items-center gap-2 relative">
                      <div className="w-5 h-5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: customLightColor }} />
                      <input type="color" value={customLightColor}
                        onChange={e => { setCustomLightColor(e.target.value); applyCustomColor(e.target.value, false); }}
                        onClick={e => e.stopPropagation()}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full" />
                      <span className="text-[9px] text-muted-foreground font-mono">{customLightColor}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1 mb-2">
                    {theme.colors.map((col, i) => (
                      <div key={i} className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: col }} />
                    ))}
                  </div>
                )}
                <p className="text-xs font-semibold text-foreground">{theme.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{theme.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tamanho da fonte */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
          T Tamanho da fonte
        </p>
        <p className="text-xs text-muted-foreground mb-3">Reduza o tamanho das fontes do sistema, incluindo menu e textos gerais.</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "normal", label: "Aa — Normal", sub: "Tamanho padrão (16px)", px: 16 },
            { key: "reduzido", label: "Aa — Reduzido", sub: "1px menor (14px)", px: 14 },
            { key: "compacto", label: "Aa — Compacto", sub: "2px menor (13px)", px: 13 },
          ].map(opt => (
            <button key={opt.key} onClick={() => selectFontSize(opt.key, opt.px)}
              className={`surface-card p-4 text-left hover:border-primary/50 transition-all ${fontSize === opt.key ? "border-primary ring-1 ring-primary/40" : ""}`}>
              <p className="text-sm font-semibold text-foreground">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Restaurar */}
      <button onClick={() => {
        const def = THEMES[0];
        selectTheme(def);
        selectFontSize("normal", 16);
      }} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition-colors">
        🔄 Restaurar tema padrão
      </button>
    </div>
  );
}

/* ── NOTIFICAÇÕES ── */
function TabNotificacoes() {
  const [notifs, setNotifs] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dua-crm-notifs");
      if (saved) try { return JSON.parse(saved); } catch {}
    }
    return { novoLead: true, contratoVencendo: true, pagamentoPendente: true, mensagemWhatsapp: false, relatorioSemanal: true };
  });

  const toggleNotif = (key: string) => {
    setNotifs((n: any) => {
      const updated = { ...n, [key]: !n[key] };
      localStorage.setItem("dua-crm-notifs", JSON.stringify(updated));
      return updated;
    });
  };
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
          <button onClick={() => toggleNotif(key)}
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
  const [waStatus, setWaStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  const checkWaStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/whatsapp/status`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setWaStatus(data.connected ? "connected" : "disconnected");
    } catch {
      setWaStatus("disconnected");
    }
  }, []);

  useEffect(() => { checkWaStatus(); }, [checkWaStatus]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          
          {/* Card Especial do WhatsApp */}
          <div className="surface-card p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-xl">💬</div>
                <div>
                  <p className="font-semibold text-foreground text-sm">WhatsApp</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Conecte sua conta do WhatsApp</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                waStatus === "connected"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : waStatus === "checking" ? "bg-muted text-muted-foreground" : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}>
                {waStatus === "connected" ? "Conectado" : waStatus === "checking" ? "Verificando..." : "Desconectado"}
              </span>
            </div>

            <button
              onClick={() => router.push("/dashboard/whatsapp")}
              className={`w-full py-2 mt-auto text-sm font-medium rounded-xl transition-colors ${
                waStatus === "connected"
                  ? "border border-border text-muted-foreground hover:bg-muted/50"
                  : "text-white bg-gradient-primary hover:opacity-90"
              }`}>
              {waStatus === "connected" ? "Gerenciar" : "Configurar"}
            </button>
          </div>

          {/* Card do Asaas */}
          <div className="surface-card p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-xl">💳</div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Asaas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Cobranças e pagamentos automáticos</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                Conectado
              </span>
            </div>
            <button className="w-full py-2 mt-auto text-sm font-medium rounded-xl transition-colors border border-border text-muted-foreground hover:bg-muted/50">
              Gerenciar
            </button>
          </div>

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

  // Aplicar tema salvo ao carregar
  useState(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("dua-crm-theme");
    if (saved) {
      const theme = THEMES.find(t => t.id === saved);
      if (theme) applyTheme(theme);
    }
    const fs = localStorage.getItem("dua-crm-fontsize");
    if (fs) {
      const sizes: Record<string,number> = { normal:16, reduzido:14, compacto:13 };
      if (sizes[fs]) document.documentElement.style.fontSize = `${sizes[fs]}px`;
    }
  });

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
