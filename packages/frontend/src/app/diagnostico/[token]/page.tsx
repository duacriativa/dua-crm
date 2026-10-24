"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarCheck, Download, Instagram, Loader2, Sparkles, Star, TrendingUp } from "lucide-react";

interface Diagnosis {
  instagramHandle: string;
  score: number | null;
  resumo: string;
  nota_explicacao?: string;
  metricas?: {
    seguidores: number | null;
    posts: number | null;
    engajamento: string | null;
    melhorPost: { data: string | null; formato: string; curtidas: number; comentarios: number } | null;
  } | null;
  pontos_fortes: string[];
  oportunidades: string[];
  proximos_passos: { titulo: string; descricao: string }[];
  createdAt: string;
  bookingUrl: string;
  pdfUrl: string;
}

const LIME = "#B5FB3D";

/** Frase da nota sempre positiva: o diagnóstico é para nutrir, não para assustar. */
function scoreLabel(score: number) {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Muito bom";
  if (score >= 50) return "Bom começo";
  return "Muito espaço para crescer";
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-36 h-36 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={LIME} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white leading-none">{score}</span>
        <span className="text-xs text-white/60 mt-1">de 100</span>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      {children}
      <footer className="text-center text-[11px] text-neutral-400 py-8 px-4">
        Dua Criativa · Marketing para marcas de moda · Fortaleza
      </footer>
    </main>
  );
}

/** Análise de perfil gratuita que a Dua envia para leads (link sem login). Mesmo conteúdo do PDF. */
export default function DiagnosticoPage({ params }: { params: { token: string } }) {
  const preview = useSearchParams().get("preview") === "1";
  const [d, setD] = useState<Diagnosis | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/public/diagnostico/${encodeURIComponent(params.token)}${preview ? "?preview=1" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setNotFound(true));
  }, [params.token, preview]);

  if (notFound) {
    return (
      <Shell>
        <div className="max-w-md mx-auto px-4 pt-24 text-center">
          <p className="font-semibold">Diagnóstico não encontrado.</p>
          <p className="text-sm text-neutral-500 mt-1">Confira o link que você recebeu ou fale com a gente pelo WhatsApp.</p>
        </div>
      </Shell>
    );
  }
  if (!d) {
    return <Shell><div className="flex justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div></Shell>;
  }

  const date = new Date(d.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Shell>
      {/* Topo */}
      <section className="bg-neutral-950 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-10 sm:pb-14">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="" className="w-8 h-8 rounded-md" />
            <span className="font-bold tracking-tight">Dua Criativa</span>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-8">
            <div className="flex-1 min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-neutral-950" style={{ background: LIME }}>
                <Sparkles className="w-3.5 h-3.5" /> Análise gratuita
              </p>
              <h1 className="mt-4 text-3xl sm:text-4xl font-black leading-tight tracking-tight">Análise de Perfil</h1>
              <p className="mt-1 text-xl sm:text-2xl font-bold break-words" style={{ color: LIME }}>@{d.instagramHandle}</p>
              <p className="mt-3 text-sm text-white/60 flex items-center gap-1.5">
                <Instagram className="w-4 h-4" /> Análise feita em {date}
              </p>
            </div>
            {d.score !== null && (
              <div className="flex items-center gap-4">
                <ScoreRing score={d.score} />
                <div className="sm:hidden">
                  <p className="text-xs text-white/60 uppercase tracking-wider font-bold">Nota do perfil</p>
                  <p className="text-lg font-bold" style={{ color: LIME }}>{scoreLabel(d.score)}</p>
                </div>
              </div>
            )}
          </div>
          {d.score !== null && (
            <p className="hidden sm:block mt-4 text-right text-sm font-bold" style={{ color: LIME }}>{scoreLabel(d.score)}</p>
          )}
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-6 space-y-5">
        {/* Resumo */}
        <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-7">
          <p className="text-base sm:text-lg leading-relaxed">{d.resumo}</p>
          {d.score !== null && (
            <div className="mt-5 rounded-xl bg-neutral-100 p-4">
              <p className="text-sm font-bold">O que a nota significa</p>
              <p className="text-sm text-neutral-600 mt-1 leading-relaxed">
                {d.nota_explicacao || "A nota vai de 0 a 100 e resume conteúdo, constância, engajamento e clareza do perfil para quem chega pela primeira vez."}
              </p>
            </div>
          )}
        </section>

        {d.metricas && (
          <section className="grid grid-cols-3 gap-3">
            {[
              d.metricas.seguidores !== null ? { v: d.metricas.seguidores.toLocaleString("pt-BR"), l: "seguidores" } : null,
              d.metricas.engajamento ? { v: d.metricas.engajamento.replace(".", ","), l: "engajamento por post" } : null,
              d.metricas.posts !== null ? { v: d.metricas.posts.toLocaleString("pt-BR"), l: "posts" } : null,
            ].filter(Boolean).map((m) => (
              <div key={m!.l} className="bg-white rounded-2xl shadow-sm p-4 min-w-0">
                <p className="text-lg sm:text-2xl font-black truncate">{m!.v}</p>
                <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">{m!.l}</p>
              </div>
            ))}
            {d.metricas.melhorPost && (
              <p className="col-span-3 text-sm text-neutral-600 px-1">
                Post com mais interações nos últimos 12: {d.metricas.melhorPost.formato}
                {d.metricas.melhorPost.data ? ` de ${d.metricas.melhorPost.data.split("-").reverse().slice(0, 2).join("/")}` : ""}, com{" "}
                {d.metricas.melhorPost.curtidas.toLocaleString("pt-BR")} curtidas e {d.metricas.melhorPost.comentarios.toLocaleString("pt-BR")} comentários.
              </p>
            )}
          </section>
        )}

        <div className="grid sm:grid-cols-2 gap-5">
          {d.pontos_fortes.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-bold"><Star className="w-4 h-4" /> O que já funciona bem</h2>
              <ul className="mt-4 space-y-3">
                {d.pontos_fortes.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-neutral-700">
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: LIME, boxShadow: "0 0 0 1px #000" }} />{p}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.oportunidades.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-bold"><TrendingUp className="w-4 h-4" /> Possíveis pontos de melhoria</h2>
              <ul className="mt-4 space-y-3">
                {d.oportunidades.map((o, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-neutral-700">
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-neutral-900" />{o}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Próximos passos */}
        <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-7">
          <h2 className="text-xl font-black tracking-tight">Próximos passos</h2>
          <p className="text-sm text-neutral-500 mt-1">Dá para começar ainda esta semana, em ordem de impacto.</p>
          <ol className="mt-5 space-y-4">
            {d.proximos_passos.map((p, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-9 h-9 rounded-full bg-neutral-950 font-black flex items-center justify-center shrink-0" style={{ color: LIME }}>{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{p.titulo}</p>
                  <p className="text-sm text-neutral-600 leading-relaxed mt-0.5">{p.descricao}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="rounded-2xl p-6 sm:p-8 bg-neutral-950 text-white flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1">
            <h2 className="text-xl font-black leading-tight">Quer ajuda para colocar isso em prática?</h2>
            <p className="text-sm text-white/70 mt-2 leading-relaxed">
              Agende uma conversa gratuita com um especialista da Dua. A gente olha a análise junto com você e mostra por onde começar.
            </p>
          </div>
          <a href={d.bookingUrl}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-neutral-950 hover:opacity-90 transition-opacity shrink-0"
            style={{ background: LIME }}>
            <CalendarCheck className="w-4 h-4" /> Agendar conversa <ArrowRight className="w-4 h-4" />
          </a>
        </section>

        <div className="text-center">
          <a href={`${d.pdfUrl}${preview ? "?preview=1" : ""}`} download={`analise-perfil-${d.instagramHandle.toLowerCase()}.pdf`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-950 underline underline-offset-4">
            <Download className="w-4 h-4" /> Baixar esta análise em PDF
          </a>
        </div>
      </div>
    </Shell>
  );
}
