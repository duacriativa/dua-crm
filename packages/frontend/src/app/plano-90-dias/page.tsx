"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight, CalendarDays, Camera, Clapperboard, Compass, Layers, Loader2, MessageSquareText,
  ShieldCheck, Sparkles, Target, Timer, Zap,
} from "lucide-react";
import { maskPhone } from "@/components/scheduling/booking-ui";

interface Info {
  productName: string;
  price: number;
  deliveryHours: number;
  options: { quemPosta: string[]; verba: string[] };
  prefill: { name: string; phone: string; email: string; instagramHandle: string } | null;
}

const LIME = "#B5FB3D";
const inp = "w-full px-3 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900 placeholder:text-neutral-400";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0 });

const INCLUDED = [
  { icon: Compass, t: "Estratégia e posicionamento", d: "Como sua marca deve ser percebida, para quem fala e com qual tom de voz." },
  { icon: Layers, t: "Pilares de conteúdo", d: "Os 4 ou 5 assuntos da marca, na proporção certa para engajar e vender." },
  { icon: CalendarDays, t: "Calendário de 12 semanas", d: "Feed e stories semana a semana: o que postar, em que formato e em que dia." },
  { icon: Clapperboard, t: "Roteiros de Reels", d: "Roteiros prontos para gravar com o celular, com gancho, cenas e CTA." },
  { icon: MessageSquareText, t: "Legendas prontas", d: "Legendas no tom da sua marca, com chamada para ação e hashtags." },
  { icon: Sparkles, t: "Ideias de stories", d: "Banco de ideias de bastidores, prova social, venda e relacionamento." },
  { icon: Camera, t: "O que contratar", d: "Foto, modelo, tráfego e ferramentas: o que vale o investimento na sua verba." },
  { icon: Target, t: "Metas de 90 dias", d: "Metas mês a mês, com números, e um checklist para a primeira semana." },
];

function cpfMask(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="block text-xs text-neutral-500 mt-0.5">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function PlanoPage() {
  const router = useRouter();
  const diagnosisToken = useSearchParams().get("d") ?? "";
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({
    name: "", phone: "", email: "", cpfCnpj: "", instagramHandle: "",
    nicho: "", ticket: "", publico: "", quemPosta: "", verba: "", observacoes: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => {
    fetch(`/api/v1/public/plano${diagnosisToken ? `?d=${encodeURIComponent(diagnosisToken)}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((i: Info) => {
        setInfo(i);
        if (i.prefill) {
          setF((s) => ({
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setError("");
    try {
      const res = await fetch("/api/v1/public/plano/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, diagnosisToken: diagnosisToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
        throw new Error(res.status === 429 ? "Muitas tentativas. Aguarde um minuto." : msg || "Algo deu errado. Tente de novo.");
      }
      router.push(`/plano-90-dias/pedido/${data.token}`);
    } catch (err: any) {
      setError(err.message);
      setSending(false);
    }
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

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      {/* Topo */}
      <section className="bg-neutral-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-14 sm:pb-20">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="" className="w-8 h-8 rounded-md" />
            <span className="font-bold tracking-tight">Dua Criativa</span>
          </div>
          <div className="mt-12 sm:mt-16 max-w-3xl">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-neutral-950" style={{ background: LIME }}>
              <Zap className="w-3.5 h-3.5" /> Entrega em até {info.deliveryHours}h
            </p>
            <h1 className="mt-5 text-4xl sm:text-5xl font-black leading-[1.05] tracking-tight">{info.productName}</h1>
            <p className="mt-5 text-lg sm:text-xl text-white/75 leading-relaxed">
              Um plano de conteúdo e estratégia de 3 meses feito para a sua marca de moda, a partir do seu Instagram de verdade.
              Você sabe exatamente o que postar, quando e por quê.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <a href="#comprar" className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full font-bold text-neutral-950 hover:opacity-90 transition-opacity" style={{ background: LIME }}>
                Quero meu plano por {price} <ArrowRight className="w-4 h-4" />
              </a>
              <p className="text-sm text-white/60">Pagamento único no Pix · sem mensalidade</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* O que vem */}
        <section className="py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">O que vem no plano</h2>
          <p className="text-neutral-600 mt-2">Um PDF completo, pronto para a sua equipe (ou você) executar.</p>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INCLUDED.map(({ icon: I, t, d }) => (
              <div key={t} className="bg-white rounded-2xl p-5 shadow-sm">
                <span className="w-10 h-10 rounded-xl bg-neutral-950 flex items-center justify-center"><I className="w-5 h-5" style={{ color: LIME }} /></span>
                <p className="font-bold mt-4 leading-snug">{t}</p>
                <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Como funciona */}
        <section className="pb-14 sm:pb-20">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Como funciona</h2>
          <ol className="mt-8 grid sm:grid-cols-4 gap-4">
            {[
              ["Conte sobre a marca", "Preencha o formulário abaixo em 2 minutos."],
              ["Pague no Pix", `${price}, confirmação na hora.`],
              ["A gente monta", "Lemos seu Instagram, usamos IA e a equipe da Dua revisa tudo."],
              ["Receba no WhatsApp", `O PDF chega em até ${info.deliveryHours}h depois do pagamento.`],
            ].map(([t, d], i) => (
              <li key={t} className="flex sm:flex-col gap-4">
                <span className="w-10 h-10 rounded-full bg-neutral-950 font-black flex items-center justify-center shrink-0" style={{ color: LIME }}>{i + 1}</span>
                <div>
                  <p className="font-bold">{t}</p>
                  <p className="text-sm text-neutral-600 mt-0.5 leading-relaxed">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Formulário */}
        <section id="comprar" className="pb-16 scroll-mt-6">
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Sobre você e a sua marca</h2>
                <p className="text-sm text-neutral-500 mt-1">Quanto mais detalhe, mais personalizado fica o plano.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Seu nome"><input required className={inp} value={f.name} onChange={set("name")} autoComplete="name" /></Field>
                <Field label="WhatsApp"><input required className={inp} value={f.phone} inputMode="tel" placeholder="(85) 99999-9999"
                  onChange={(e) => setF((s) => ({ ...s, phone: maskPhone(e.target.value) }))} autoComplete="tel" /></Field>
                <Field label="E-mail"><input required type="email" className={inp} value={f.email} onChange={set("email")} autoComplete="email" /></Field>
                <Field label="CPF ou CNPJ" hint="Exigido pelo banco para emitir o Pix.">
                  <input required className={inp} value={f.cpfCnpj} inputMode="numeric" onChange={(e) => setF((s) => ({ ...s, cpfCnpj: cpfMask(e.target.value) }))} />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="@ do Instagram da marca">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">@</span>
                    <input required className={`${inp} pl-7`} value={f.instagramHandle} placeholder="suamarca"
                      onChange={(e) => setF((s) => ({ ...s, instagramHandle: e.target.value.replace(/^@/, "").trim() }))} />
                  </div>
                </Field>
                <Field label="Ticket médio" hint="Valor médio de cada venda.">
                  <input required className={inp} value={f.ticket} placeholder="Ex.: R$ 180" onChange={set("ticket")} />
                </Field>
              </div>

              <Field label="Produto / nicho" hint="O que a marca vende e qual o estilo.">
                <input required className={inp} value={f.nicho} placeholder="Ex.: moda feminina casual, vestidos e conjuntos de linho" onChange={set("nicho")} />
              </Field>
              <Field label="Público" hint="Quem compra de você: idade, estilo de vida, onde mora.">
                <textarea required rows={2} className={inp} value={f.publico} placeholder="Ex.: mulheres de 25 a 40 anos, trabalham fora, Fortaleza e Nordeste" onChange={set("publico")} />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Quem posta hoje?">
                  <select required className={inp} value={f.quemPosta} onChange={set("quemPosta")}>
                    <option value="">Escolha</option>
                    {info.options.quemPosta.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Verba mensal para conteúdo e anúncio">
                  <select required className={inp} value={f.verba} onChange={set("verba")}>
                    <option value="">Escolha</option>
                    {info.options.verba.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Algo mais que a gente deve saber? (opcional)">
                <textarea rows={2} className={inp} value={f.observacoes} placeholder="Lançamentos previstos, loja física, o que já tentou..." onChange={set("observacoes")} />
              </Field>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button type="submit" disabled={sending}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full font-bold bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-60 transition-colors">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {sending ? "Gerando o Pix..." : `Gerar Pix de ${price}`}
              </button>
              <p className="text-xs text-neutral-500 text-center">Ao continuar, você recebe o QR Code do Pix na próxima tela.</p>
            </form>

            <aside className="bg-neutral-950 text-white rounded-2xl p-6 lg:sticky lg:top-6">
              <p className="text-sm text-white/60">{info.productName}</p>
              <p className="text-4xl font-black mt-1" style={{ color: LIME }}>{price}</p>
              <p className="text-sm text-white/60">pagamento único no Pix</p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex gap-2.5"><Timer className="w-4 h-4 shrink-0 mt-0.5" style={{ color: LIME }} /> Entrega em até {info.deliveryHours}h após a confirmação do pagamento</li>
                <li className="flex gap-2.5"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: LIME }} /> Revisado pela equipe da Dua antes de chegar em você</li>
                <li className="flex gap-2.5"><MessageSquareText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: LIME }} /> Enviado no seu WhatsApp, em PDF</li>
              </ul>
            </aside>
          </div>
        </section>
      </div>

      <footer className="text-center text-[11px] text-neutral-400 pb-8 px-4">
        Dua Criativa · Marketing para marcas de moda · Fortaleza
      </footer>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlanoPage />
    </Suspense>
  );
}
