"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight, CalendarDays, Camera, Clapperboard, Compass, Layers, Loader2, MessageSquareText,
  ShieldCheck, Sparkles, Target, Timer, Zap,
} from "lucide-react";

interface Info {
  productName: string;
  price: number;
  deliveryHours: number;
}

const LIME = "#B5FB3D";
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

function PlanoPage() {
  const diagnosisToken = useSearchParams().get("d") ?? "";
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const formUrl = `/plano-90-dias/questionario${diagnosisToken ? `?d=${encodeURIComponent(diagnosisToken)}` : ""}`;

  useEffect(() => {
    fetch("/api/v1/public/plano")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((i: Info) => setInfo(i))
      .catch(() => setFailed(true));
  }, []);

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
              <Link href={formUrl} className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full font-bold text-neutral-950 hover:opacity-90 transition-opacity" style={{ background: LIME }}>
                Quero meu plano por {price} <ArrowRight className="w-4 h-4" />
              </Link>
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
              ["Conte sobre a marca", "Responda o questionário em uns 6 minutos, uma pergunta por vez."],
              ["Pague no Pix", `${price}, confirmação na hora.`],
              ["A equipe Dua monta", "Analisamos seu Instagram e montamos o plano no DUA LAB, nosso sistema com a mais alta tecnologia de IA. A equipe revisa tudo antes de enviar."],
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

        {/* Chamada para o questionário */}
        <section id="comprar" className="pb-16 scroll-mt-6">
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8">
              <h2 className="text-2xl font-black tracking-tight">Conte sobre a sua marca</h2>
              <p className="text-neutral-600 mt-2 leading-relaxed">
                O plano nasce das suas respostas: data real do lançamento, onde você faz as fotos, seus concorrentes e o que já está pronto.
                A gente confere os @ das marcas no Instagram com você, para o plano não olhar para a marca errada.
              </p>
              <Link href={formUrl}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full font-bold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                Começar o questionário <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="mt-3 text-xs text-neutral-500 text-center">Leva uns 6 minutos. No final, você recebe o QR Code do Pix de {price}.</p>
            </div>

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
