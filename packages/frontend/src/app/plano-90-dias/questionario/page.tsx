"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRight, AtSign, CalendarDays, Check, Clock, Loader2, MapPin, Pencil, QrCode, Undo2,
} from "lucide-react";
import { maskPhone } from "@/components/scheduling/booking-ui";
import { BrandSlot, Slot, emptySlot, normalizeHandle } from "./brand-slot";

interface Options {
  quemPosta: string[]; verba: string[]; objetivo: string[]; ondeVende: string[];
  pecasProntas: string[]; identidade: string[]; quemAparece: string[]; localFotos: string[];
}
interface Info {
  productName: string;
  price: number;
  deliveryHours: number;
  options: Options;
  prefill: { name: string; phone: string; email: string; instagramHandle: string } | null;
}

interface Answers {
  name: string; phone: string; email: string; instagramHandle: string;
  nicho: string; publico: string; cidadeRegiao: string; ticket: string; faixaPreco: string; gradeTamanhos: string;
  ondeVende: string[]; objetivo: string; pecasProntas: string;
  lancamentoStatus: string; lancamentoData: string; localFotos: string; identidade: string; quemAparece: string[];
  quemPosta: string; verba: string;
  inspiradoras: Slot[]; semInspiradoras: boolean;
  concorrentes: Slot[]; semConcorrentes: boolean;
  observacoes: string;
}
type TextField = "name" | "phone" | "email" | "instagramHandle" | "nicho" | "publico" | "cidadeRegiao" | "ticket" | "faixaPreco" | "gradeTamanhos" | "localFotos" | "observacoes";
type ChoiceField = "objetivo" | "pecasProntas" | "identidade" | "quemPosta" | "verba";
type MultiField = "ondeVende" | "quemAparece";
type BrandField = "inspiradoras" | "concorrentes";

type Step = { id: string; stage: number; label: string; title: string; hint?: string } & (
  | { kind: "text"; field: TextField; placeholder?: string; multiline?: boolean; inputMode?: "tel" | "email"; optional?: boolean; prefix?: string; suggestions?: string[] }
  | { kind: "choice"; field: ChoiceField; options: string[] }
  | { kind: "multi"; field: MultiField; options: string[] }
  | { kind: "launch" }
  | { kind: "brands"; field: BrandField; skip: "semInspiradoras" | "semConcorrentes"; min: number; skipLabel: string }
  | { kind: "review" }
  | { kind: "cpf" }
);

const LIME = "#B5FB3D";
const DRAFT_KEY = "plano90-questionario";
const STAGES = ["Você", "Sua marca", "Seu conteúdo", "Referências", "Finalizar"];
const LAUNCH = [
  { id: "data", label: "Tenho data de lançamento", hint: "A data real entra no calendário, uma única vez." },
  { id: "sem_data", label: "Vou lançar, mas ainda sem data", hint: "O plano prepara a marca sem fixar uma semana." },
  { id: "nao", label: "Não tenho lançamento nos próximos 3 meses", hint: "O plano não inclui lançamento." },
];
const input = "w-full px-4 py-3.5 bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900 placeholder:text-neutral-400";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0 });
const todayBr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

const INITIAL: Answers = {
  name: "", phone: "", email: "", instagramHandle: "",
  nicho: "", publico: "", cidadeRegiao: "", ticket: "", faixaPreco: "", gradeTamanhos: "",
  ondeVende: [], objetivo: "", pecasProntas: "", lancamentoStatus: "", lancamentoData: "", localFotos: "", identidade: "", quemAparece: [],
  quemPosta: "", verba: "",
  inspiradoras: [emptySlot(), emptySlot(), emptySlot()], semInspiradoras: false,
  concorrentes: [emptySlot(), emptySlot(), emptySlot()], semConcorrentes: false,
  observacoes: "",
};

function cpfMask(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

function buildSteps(o: Options): Step[] {
  return [
    { id: "nome", stage: 0, label: "Nome", kind: "text", field: "name", title: "Pra começar, como você se chama?", placeholder: "Seu nome" },
    { id: "whatsapp", stage: 0, label: "WhatsApp", kind: "text", field: "phone", inputMode: "tel", title: "Qual é o seu WhatsApp?", hint: "É por lá que o plano chega.", placeholder: "(85) 99999-9999" },
    { id: "email", stage: 0, label: "E-mail", kind: "text", field: "email", inputMode: "email", title: "E o seu e-mail?", placeholder: "voce@suamarca.com.br" },

    { id: "instagram", stage: 1, label: "Instagram da marca", kind: "text", field: "instagramHandle", prefix: "@", title: "Qual é o @ da sua marca no Instagram?", hint: "A gente lê o perfil real para montar o diagnóstico.", placeholder: "suamarca" },
    { id: "nicho", stage: 1, label: "Produto / nicho", kind: "text", field: "nicho", title: "O que a sua marca vende?", hint: "Conte o produto e o estilo.", placeholder: "Ex.: moda feminina casual, vestidos e conjuntos de linho" },
    { id: "publico", stage: 1, label: "Público", kind: "text", field: "publico", multiline: true, title: "Quem compra de você?", hint: "Idade, estilo de vida, onde mora.", placeholder: "Ex.: mulheres de 25 a 40 anos, trabalham fora, gostam de peças versáteis" },
    { id: "cidade", stage: 1, label: "Cidade ou região", kind: "text", field: "cidadeRegiao", title: "Em que cidade ou região você atende?", hint: "Se vende para todo o Brasil, é só dizer.", placeholder: "Ex.: Fortaleza e região, com envio para todo o Brasil" },
    { id: "ticket", stage: 1, label: "Ticket médio", kind: "text", field: "ticket", title: "Qual é o valor médio de cada venda?", hint: "O ticket médio, mesmo que seja uma estimativa.", placeholder: "Ex.: R$ 180" },
    { id: "preco", stage: 1, label: "Faixa de preço", kind: "text", field: "faixaPreco", title: "Qual é a faixa de preço das peças?", hint: "Da mais barata à mais cara.", placeholder: "Ex.: de R$ 89 a R$ 320" },
    { id: "grade", stage: 1, label: "Grade de tamanhos", kind: "text", field: "gradeTamanhos", title: "Qual é a grade de tamanhos?", placeholder: "Ex.: P ao GG, ou 36 ao 46" },
    { id: "onde-vende", stage: 1, label: "Onde vende", kind: "multi", field: "ondeVende", options: o.ondeVende, title: "Onde você vende hoje?", hint: "Pode marcar mais de um." },

    { id: "objetivo", stage: 2, label: "Objetivo", kind: "choice", field: "objetivo", options: o.objetivo, title: "Qual é o objetivo principal nos próximos 3 meses?" },
    { id: "pecas", stage: 2, label: "Peças", kind: "choice", field: "pecasProntas", options: o.pecasProntas, title: "As peças já estão prontas?", hint: "Assim o plano só marca foto de produto quando a peça existir." },
    { id: "lancamento", stage: 2, label: "Lançamento", kind: "launch", title: "Você tem lançamento nos próximos 3 meses?" },
    { id: "fotos", stage: 2, label: "Local das fotos", kind: "text", field: "localFotos", suggestions: o.localFotos, title: "Onde você faz ou pretende fazer as fotos?", hint: "Escolha uma opção ou escreva com as suas palavras.", placeholder: "Ex.: estúdio no bairro, praia no fim de tarde" },
    { id: "identidade", stage: 2, label: "Logo e identidade", kind: "choice", field: "identidade", options: o.identidade, title: "Você já tem logo e identidade visual?" },
    { id: "quem-aparece", stage: 2, label: "Quem aparece", kind: "multi", field: "quemAparece", options: o.quemAparece, title: "Quem aparece no conteúdo?", hint: "Pode marcar mais de um." },
    { id: "quem-posta", stage: 2, label: "Quem posta", kind: "choice", field: "quemPosta", options: o.quemPosta, title: "Quem posta hoje?" },
    { id: "verba", stage: 2, label: "Verba", kind: "choice", field: "verba", options: o.verba, title: "Qual é a verba mensal para conteúdo e anúncio?" },

    { id: "inspiradoras", stage: 3, label: "Marcas que inspiram", kind: "brands", field: "inspiradoras", skip: "semInspiradoras", min: 1, skipLabel: "Não tenho marca de referência", title: "Quais marcas inspiram você?", hint: "Até 3 marcas. Elas ajudam a definir o estilo do plano." },
    { id: "concorrentes", stage: 3, label: "Concorrentes", kind: "brands", field: "concorrentes", skip: "semConcorrentes", min: 3, skipLabel: "Não conheço 3 concorrentes, quero seguir com o que tenho", title: "Quem são os seus 3 concorrentes?", hint: "Marcas que disputam a mesma cliente que você." },
    { id: "observacoes", stage: 3, label: "Observações", kind: "text", field: "observacoes", multiline: true, optional: true, title: "Algo mais que a gente deve saber?", hint: "Opcional.", placeholder: "O que já tentou, datas importantes, o que não quer no plano..." },

    { id: "revisao", stage: 4, label: "Revisão", kind: "review", title: "Confere se está tudo certo?", hint: "Toque em uma resposta para corrigir." },
    { id: "pagamento", stage: 4, label: "CPF ou CNPJ", kind: "cpf", title: "Por último, seu CPF ou CNPJ", hint: "O banco exige esse dado para emitir o Pix." },
  ];
}

const filled = (slots: Slot[]) => slots.filter((s) => s.handle);

/** O que falta nesta tela para seguir. Vazio = pode avançar. */
function problem(s: Step, a: Answers): string {
  switch (s.kind) {
    case "text": {
      const v = a[s.field].trim();
      if (s.optional) return "";
      if (s.field === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Informe um e-mail válido.";
      if (s.field === "phone") return v.replace(/\D/g, "").length >= 10 ? "" : "Informe o WhatsApp com DDD.";
      if (s.field === "instagramHandle") return /^[a-z0-9._]{1,30}$/.test(v) ? "" : "Informe o @ da sua marca.";
      return v.length >= 2 ? "" : "Responda para continuar.";
    }
    case "choice": return a[s.field] ? "" : "Escolha uma opção para continuar.";
    case "multi": return a[s.field].length ? "" : "Marque pelo menos uma opção.";
    case "launch":
      if (!a.lancamentoStatus) return "Escolha uma opção para continuar.";
      if (a.lancamentoStatus !== "data") return "";
      if (!a.lancamentoData) return "Informe a data do lançamento.";
      return a.lancamentoData < todayBr() ? "A data do lançamento precisa ser hoje ou depois." : "";
    case "brands": {
      const slots = filled(a[s.field]);
      if (slots.some((x) => x.state === "idle")) return "Aguarde a conferência do @.";
      if (slots.some((x) => x.state === "found")) return "Responda se é essa marca para continuar.";
      if (slots.some((x) => x.state === "rejected" || x.state === "invalid")) return "Corrija ou apague o @ marcado para continuar.";
      if (new Set(slots.map((x) => x.handle)).size < slots.length) return "Tem um @ repetido. Corrija ou apague para continuar.";
      if (slots.length < s.min && !a[s.skip]) {
        return s.min === 1 ? "Informe uma marca ou marque que não tem referência." : `Informe os ${s.min} concorrentes ou marque que não conhece todos.`;
      }
      return "";
    }
    default: return "";
  }
}

/** Resposta em uma linha, para a revisão. */
function summary(s: Step, a: Answers): string {
  switch (s.kind) {
    case "text": return s.prefix ? `${s.prefix}${a[s.field]}` : a[s.field];
    case "choice": return a[s.field];
    case "multi": return a[s.field].join(", ");
    case "launch":
      if (a.lancamentoStatus === "data") return `Lançamento em ${fmtDate(a.lancamentoData)}`;
      return LAUNCH.find((l) => l.id === a.lancamentoStatus)?.label ?? "";
    case "brands": {
      const list = filled(a[s.field]);
      return list.length ? list.map((x) => `@${x.handle}${x.state === "confirmed" ? "" : " (não confirmado)"}`).join(", ") : "Nenhuma informada";
    }
    default: return "";
  }
}

function Option({ on, label, hint, multi, onClick }: { on: boolean; label: string; hint?: string; multi?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`w-full text-left px-4 py-3.5 rounded-xl border flex items-center gap-3 transition-colors ${on ? "bg-neutral-950 text-white border-neutral-950" : "bg-white border-neutral-300 hover:border-neutral-900"}`}>
      <span className={`w-5 h-5 shrink-0 flex items-center justify-center border ${multi ? "rounded-md" : "rounded-full"} ${on ? "border-transparent" : "border-neutral-400"}`} style={on ? { background: LIME } : undefined}>
        {on && <Check className="w-3.5 h-3.5 text-neutral-950" />}
      </span>
      <span>
        <span className="font-semibold block leading-snug">{label}</span>
        {hint && <span className={`text-sm block mt-0.5 ${on ? "text-white/70" : "text-neutral-500"}`}>{hint}</span>}
      </span>
    </button>
  );
}

/** Painel do lado direito: o plano vai tomando forma com as respostas (só em telas grandes). */
function Preview({ a, pct, productName, hours }: { a: Answers; pct: number; productName: string; hours: number }) {
  const launch = a.lancamentoStatus === "data"
    ? (a.lancamentoData ? fmtDate(a.lancamentoData) : "—")
    : a.lancamentoStatus === "sem_data" ? "Ainda sem data" : a.lancamentoStatus === "nao" ? "Sem lançamento" : "—";
  const brands = [...a.inspiradoras, ...a.concorrentes].filter((s) => s.state === "confirmed").length;
  return (
    <aside className="hidden lg:flex sticky top-0 h-screen bg-neutral-950 items-center justify-center overflow-hidden" aria-hidden>
      <div className="absolute w-[32rem] h-[32rem] rounded-full opacity-10 -bottom-48 -right-32" style={{ background: LIME }} />
      <div className="relative w-[22rem]">
        <div className="absolute -top-7 -left-8 z-10 bg-white rounded-xl shadow-lg px-3.5 py-2.5 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black"
            style={{ background: `conic-gradient(#0a0a0a ${pct * 3.6}deg, #e5e5e5 0deg)` }}>
            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center">{pct}%</span>
          </span>
          <span className="text-xs leading-tight"><b className="block text-sm">Seu plano</b><span className="text-neutral-500">tomando forma</span></span>
        </div>
        <div className="rounded-3xl p-6 pt-10 rotate-[-2deg] shadow-2xl text-neutral-950" style={{ background: LIME }}>
          <p className="text-2xl font-black leading-tight truncate">@{a.instagramHandle || "suamarca"}</p>
          <p className="text-sm font-semibold opacity-70 truncate">{a.name.trim() || "Seu nome"}</p>
          <div className="grid grid-cols-2 gap-2 mt-5">
            <div className="rounded-xl bg-neutral-950/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1"><MapPin className="w-3 h-3" /> Região</p>
              <p className="text-sm font-bold truncate mt-0.5">{a.cidadeRegiao || "—"}</p>
            </div>
            <div className="rounded-xl bg-neutral-950/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Lançamento</p>
              <p className="text-sm font-bold truncate mt-0.5">{launch}</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium line-clamp-2 min-h-[2.5rem]">{a.nicho || "O que a sua marca vende"}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border border-neutral-950/30">
            <AtSign className="w-3 h-3" /> {brands} {brands === 1 ? "marca confirmada" : "marcas confirmadas"}
          </p>
          <div className="mt-5 pt-3 border-t border-neutral-950/20 text-xs font-semibold flex justify-between gap-3">
            <span className="truncate">{productName}</span>
            <span className="shrink-0">Até {hours}h</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Questionario() {
  const router = useRouter();
  const diagnosisToken = useSearchParams().get("d") ?? "";
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const [a, setA] = useState<Answers>(INITIAL);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [stepId, setStepId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);

  // Rascunho nesta aba, para recarregar a página não apagar nada (o CPF nunca é guardado)
  useEffect(() => {
    let draft: Partial<Answers> | null = null;
    try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null"); } catch { /* sem armazenamento */ }
    if (draft) setA((s) => ({ ...s, ...draft }));
    const hash = window.location.hash.slice(1);
    if (hash && !draft) window.location.hash = "";
    else setStepId(hash || null);
    setReady(true);
    fetch(`/api/v1/public/plano${diagnosisToken ? `?d=${encodeURIComponent(diagnosisToken)}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((i: Info) => {
        setInfo(i);
        if (i.prefill) {
          setA((s) => ({
            ...s,
            name: s.name || i.prefill!.name,
            phone: s.phone || maskPhone(i.prefill!.phone),
            email: s.email || i.prefill!.email,
            instagramHandle: s.instagramHandle || i.prefill!.instagramHandle,
          }));
        }
      })
      .catch(() => setFailed(true));
  }, [diagnosisToken]);

  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(a)); } catch { /* sem armazenamento */ }
  }, [a, ready]);

  // A tela atual fica no # da URL: o botão voltar do navegador volta uma pergunta, em vez de sair da página
  useEffect(() => {
    const onHash = () => { setStepId(window.location.hash.slice(1) || null); setError(""); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const steps = useMemo(() => (info ? buildSteps(info.options) : []), [info]);
  const index = steps.findIndex((s) => s.id === stepId);
  const step = index >= 0 ? steps[index] : null;
  const go = (id: string) => { window.location.hash = id; };
  const update = <K extends keyof Answers>(k: K, v: Answers[K]) => { setA((s) => ({ ...s, [k]: v })); setError(""); };
  const patchSlot = (field: BrandField, i: number, patch: Partial<Slot>) => {
    setA((s) => ({ ...s, [field]: s[field].map((x, k) => (k === i ? { ...x, ...patch } : x)) }));
    setError("");
  };

  const submit = async () => {
    const missing = steps.find((s) => problem(s, a));
    if (missing) { setEditing(true); go(missing.id); return; }
    if (![11, 14].includes(cpfCnpj.replace(/\D/g, "").length)) { setError("Informe um CPF ou CNPJ válido."); return; }
    setSending(true); setError("");
    const brands = (slots: Slot[]) => filled(slots).map((s) => ({ handle: s.handle, confirmed: s.state === "confirmed" }));
    try {
      const { inspiradoras, concorrentes, semInspiradoras: _i, semConcorrentes: _c, ...rest } = a;
      const res = await fetch("/api/v1/public/plano/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest, cpfCnpj,
          inspiradoras: brands(inspiradoras), concorrentes: brands(concorrentes),
          diagnosisToken: diagnosisToken || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
        throw new Error(res.status === 429 ? "Muitas tentativas. Aguarde um minuto." : msg || "Algo deu errado. Tente de novo.");
      }
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* sem armazenamento */ }
      router.push(`/plano-90-dias/pedido/${data.token}`);
    } catch (err: any) {
      setError(err.message);
      setSending(false);
    }
  };

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!step) return;
    const p = problem(step, a);
    if (p) { setError(p); return; }
    if (step.kind === "cpf") { submit(); return; }
    if (editing) { setEditing(false); go("revisao"); return; }
    go(steps[index + 1].id);
  };

  if (failed) {
    return (
      <main className="min-h-screen bg-neutral-100 flex items-center justify-center px-4">
        <p className="text-sm text-neutral-600">Página indisponível no momento. Tente de novo em alguns minutos.</p>
      </main>
    );
  }
  if (!info) {
    return <main className="min-h-screen bg-neutral-100 flex justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></main>;
  }

  const price = brl(info.price);
  const pct = step ? Math.round((index / steps.length) * 100) : 0;
  const pending = [...filled(a.inspiradoras), ...filled(a.concorrentes)].filter((s) => s.state !== "confirmed");

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 lg:grid lg:grid-cols-2">
      <style>{`@keyframes q-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.q-in{animation:q-in .22s ease-out}@media (prefers-reduced-motion:reduce){.q-in{animation:none}}`}</style>
      <div className="min-h-screen flex flex-col px-4 sm:px-8 py-6">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-md" />
          <span className="font-bold tracking-tight text-sm">Dua Criativa</span>
        </div>

        <div className="flex-1 flex items-center justify-center py-8">
          <div className="w-full max-w-md">
            {!step ? (
              <div className="q-in">
                <p className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-950 text-white">{info.productName}</p>
                <h1 className="mt-5 text-4xl sm:text-5xl font-black leading-[1.05] tracking-tight">
                  Vamos montar os 90 dias da <span className="px-2 rounded-lg inline-block" style={{ background: LIME }}>sua marca</span>.
                </h1>
                <p className="mt-5 text-neutral-600 leading-relaxed">
                  Responda sobre a sua marca e receba, em até {info.deliveryHours}h, um plano com o que postar, quando e por quê, pronto para você executar.
                  Quanto mais certas as respostas, mais o plano fala da sua marca.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex gap-3"><Clock className="w-5 h-5 shrink-0 text-neutral-500" /> Leva uns 6 minutos, uma pergunta por vez</li>
                  <li className="flex gap-3"><Undo2 className="w-5 h-5 shrink-0 text-neutral-500" /> Dá para voltar e mudar sem perder nada</li>
                  <li className="flex gap-3"><AtSign className="w-5 h-5 shrink-0 text-neutral-500" /> A gente confere os @ das marcas no Instagram com você</li>
                  <li className="flex gap-3"><QrCode className="w-5 h-5 shrink-0 text-neutral-500" /> No final, o pagamento de {price} no Pix</li>
                </ul>
                <button type="button" onClick={() => go(steps[0].id)}
                  className="mt-8 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full font-bold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                  Começar <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button type="button" aria-label="Voltar" className="p-1.5 -ml-1.5 rounded-full hover:bg-neutral-200"
                    onClick={() => { setEditing(false); window.location.hash = index > 0 ? steps[index - 1].id : ""; }}>
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex-1 flex gap-1.5" role="progressbar" aria-label="Progresso do questionário" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    {STAGES.map((name, i) => {
                      const inStage = steps.filter((s) => s.stage === i);
                      const done = steps.slice(0, index).filter((s) => s.stage === i).length;
                      return (
                        <span key={name} className="flex-1 h-1.5 rounded-full bg-neutral-300 overflow-hidden">
                          <span className="block h-full bg-neutral-950 transition-all duration-300" style={{ width: `${(done / inStage.length) * 100}%` }} />
                        </span>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold text-neutral-500">Etapa {step.stage + 1} de {STAGES.length} · {STAGES[step.stage]}</p>

                <form key={step.id} onSubmit={next} noValidate className="q-in mt-6">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">{step.title}</h1>
                  {step.hint && <p className="mt-2 text-neutral-600">{step.hint}</p>}

                  <div className="mt-5">
                    {step.kind === "text" && (
                      step.multiline ? (
                        <textarea autoFocus rows={3} className={input} aria-label={step.title} placeholder={step.placeholder} value={a[step.field]} onChange={(e) => update(step.field, e.target.value)} />
                      ) : (
                        <div className="relative">
                          {step.prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">{step.prefix}</span>}
                          <input autoFocus className={`${input} ${step.prefix ? "pl-8" : ""}`} aria-label={step.title} placeholder={step.placeholder} inputMode={step.inputMode}
                            autoCapitalize={step.prefix || step.inputMode === "email" ? "none" : undefined} value={a[step.field]}
                            onChange={(e) => {
                              const v = e.target.value;
                              update(step.field, step.field === "phone" ? maskPhone(v) : step.field === "instagramHandle" ? normalizeHandle(v) : v);
                            }} />
                        </div>
                      )
                    )}
                    {step.kind === "text" && step.suggestions && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {step.suggestions.map((o) => (
                          <button key={o} type="button" aria-pressed={a[step.field] === o} onClick={() => update(step.field, o)}
                            className={`px-3 py-2 text-sm rounded-full border transition-colors ${a[step.field] === o ? "bg-neutral-950 text-white border-neutral-950" : "bg-white border-neutral-300 hover:border-neutral-900"}`}>
                            {o}
                          </button>
                        ))}
                      </div>
                    )}

                    {step.kind === "choice" && (
                      <div className="space-y-2">
                        {step.options.map((o) => <Option key={o} label={o} on={a[step.field] === o} onClick={() => update(step.field, o)} />)}
                      </div>
                    )}

                    {step.kind === "multi" && (
                      <div className="space-y-2">
                        {step.options.map((o) => {
                          const on = a[step.field].includes(o);
                          return <Option key={o} multi label={o} on={on} onClick={() => update(step.field, on ? a[step.field].filter((x) => x !== o) : [...a[step.field], o])} />;
                        })}
                      </div>
                    )}

                    {step.kind === "launch" && (
                      <div className="space-y-2">
                        {LAUNCH.map((l) => <Option key={l.id} label={l.label} hint={l.hint} on={a.lancamentoStatus === l.id} onClick={() => update("lancamentoStatus", l.id)} />)}
                        {a.lancamentoStatus === "data" && (
                          <label className="block pt-2">
                            <span className="text-sm font-semibold">Data real do lançamento</span>
                            <input type="date" min={todayBr()} className={`${input} mt-1.5`} value={a.lancamentoData} onChange={(e) => update("lancamentoData", e.target.value)} />
                          </label>
                        )}
                      </div>
                    )}

                    {step.kind === "brands" && (
                      <div className="space-y-3">
                        <div role="note" className="rounded-xl bg-amber-100 border-2 border-amber-400 p-3.5 text-sm text-amber-950 flex gap-2.5">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <p><b>Confira cada @ com atenção.</b> Abra o perfil da marca no Instagram e copie o @ exatamente como aparece. Um @ errado faz o plano olhar para a marca errada.</p>
                        </div>
                        {a[step.field].map((slot, i) => (
                          <BrandSlot key={i} slot={slot} autoFocus={i === 0} placeholder={step.field === "concorrentes" ? `concorrente ${i + 1}` : `marca ${i + 1}`}
                            onChange={(patch) => patchSlot(step.field, i, patch)} />
                        ))}
                        <label className="flex gap-2.5 items-start text-sm text-neutral-700 pt-1 cursor-pointer">
                          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-neutral-950" checked={a[step.skip]} onChange={(e) => update(step.skip, e.target.checked)} />
                          {step.skipLabel}
                        </label>
                      </div>
                    )}

                    {step.kind === "review" && (
                      <div>
                        {pending.length > 0 && (
                          <div role="note" className="mb-3 rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm text-amber-950 flex gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>{pending.map((s) => `@${s.handle}`).join(", ")} {pending.length === 1 ? "ficou" : "ficaram"} sem confirmação. A equipe da Dua revisa antes de entregar o plano.</p>
                          </div>
                        )}
                        <ul className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-200">
                          {steps.filter((s) => !["review", "cpf"].includes(s.kind) && summary(s, a)).map((s) => (
                            <li key={s.id}>
                              <button type="button" onClick={() => { setEditing(true); go(s.id); }} className="w-full text-left px-3.5 py-2.5 flex gap-3 items-start hover:bg-neutral-50">
                                <span className="flex-1 min-w-0">
                                  <span className="block text-xs text-neutral-500">{s.label}</span>
                                  <span className="block text-sm font-medium break-words">{summary(s, a)}</span>
                                </span>
                                <Pencil className="w-3.5 h-3.5 mt-1 text-neutral-400 shrink-0" aria-hidden />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {step.kind === "cpf" && (
                      <input autoFocus className={input} aria-label="CPF ou CNPJ" inputMode="numeric" placeholder="000.000.000-00" value={cpfCnpj}
                        onChange={(e) => { setCpfCnpj(cpfMask(e.target.value)); setError(""); }} />
                    )}
                  </div>

                  {error && <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                  <button type="submit" disabled={sending}
                    className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full font-bold bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-60 transition-colors">
                    {step.kind !== "cpf" && <>{editing ? "Salvar e voltar à revisão" : step.kind === "review" ? "Está tudo certo" : "Continuar"} <ArrowRight className="w-4 h-4" /></>}
                    {step.kind === "cpf" && (sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando o Pix...</> : `Gerar Pix de ${price}`)}
                  </button>
                  {step.kind === "cpf" && <p className="mt-3 text-xs text-neutral-500 text-center">O QR Code do Pix aparece na próxima tela.</p>}
                </form>
              </>
            )}
          </div>
        </div>
      </div>
      <Preview a={a} pct={pct} productName={info.productName} hours={info.deliveryHours} />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Questionario />
    </Suspense>
  );
}
