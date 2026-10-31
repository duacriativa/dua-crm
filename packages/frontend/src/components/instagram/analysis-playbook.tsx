"use client";

import { useState } from "react";
import { CalendarDays, Check, Copy, GalleryHorizontal, Gem, Headphones, Layers, MessageSquareQuote, Type } from "lucide-react";

/** Campos da análise que vêm do playbook de moda (ver backend fashion-playbook.ts). Todos opcionais: análises antigas não têm. */
export interface AnalysisPlaybook {
  nicho?: string;
  pilares?: Partial<Record<"desejo" | "valor" | "direcao_compra", { nota: number | null; leitura: string }>>;
  bio?: { leitura?: string; sugestao?: string };
  produto_vitrine?: { produto?: string; ideias?: string[] };
  ideias_carrossel?: { titulo: string; slides: string[] }[];
  stories?: { sequencia?: string[]; caixinhas?: string[] };
  calendario?: { data: string; ocasiao: string; ideia: string }[];
  atendimento?: string[];
}

const PILARES = [
  { key: "desejo", nome: "Desejo", dica: "A cliente se imagina usando a peça?" },
  { key: "valor", nome: "Valor", dica: "Ela entende por que vale o preço?" },
  { key: "direcao_compra", nome: "Direção de compra", dica: "Ela sabe como comprar agora?" },
] as const;

function barColor(n: number) {
  if (n >= 70) return "bg-green-500";
  if (n >= 45) return "bg-amber-500";
  return "bg-red-500";
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      {ok ? <Check size={12} /> : <Copy size={12} />} {ok ? "Copiado" : "Copiar"}
    </button>
  );
}

function Card({ icon, title, color, action, children }: {
  icon: React.ReactNode; title: string; color: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl p-4 border ${color}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider flex-1">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

const fmtDate = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

/** Seções extras da análise do Instagram: pilares, bio, produto vitrine, carrosséis, stories, calendário e atendimento. */
export function AnalysisPlaybookView({ a }: { a: AnalysisPlaybook }) {
  const pilares = PILARES.filter((p) => a.pilares?.[p.key]);
  const ideiasProduto = a.produto_vitrine?.ideias?.filter(Boolean) ?? [];
  const carrosseis = a.ideias_carrossel?.filter((c) => c?.titulo) ?? [];
  const sequencia = a.stories?.sequencia?.filter(Boolean) ?? [];
  const caixinhas = a.stories?.caixinhas?.filter(Boolean) ?? [];
  const calendario = a.calendario?.filter((c) => c?.data && c?.ocasiao) ?? [];
  const atendimento = a.atendimento?.filter(Boolean) ?? [];

  if (!pilares.length && !a.bio?.sugestao && !ideiasProduto.length && !carrosseis.length && !sequencia.length && !calendario.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      {(a.nicho || pilares.length > 0) && (
        <div className="rounded-2xl p-4 border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Gem size={14} className="text-purple-500" />
            <span className="text-xs font-bold uppercase tracking-wider flex-1">Desejo · Valor · Direção de compra</span>
            {a.nicho && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">{a.nicho}</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pilares.map((p) => {
              const v = a.pilares![p.key]!;
              return (
                <div key={p.key} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold">{p.nome}</span>
                    {typeof v.nota === "number" && <span className="text-sm font-black">{v.nota}</span>}
                  </div>
                  {typeof v.nota === "number" && (
                    <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor(v.nota)}`} style={{ width: `${Math.max(3, v.nota)}%` }} />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">{p.dica}</p>
                  <p className="text-xs text-foreground leading-relaxed mt-1.5">{v.leitura}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {a.bio?.sugestao && (
          <Card icon={<Type size={14} className="text-sky-500" />} title="Bio sugerida" color="bg-sky-500/10 border-sky-500/20"
            action={<CopyButton text={a.bio.sugestao} />}>
            {a.bio.leitura && <p className="text-xs text-muted-foreground mb-2">{a.bio.leitura}</p>}
            <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{a.bio.sugestao}</p>
          </Card>
        )}

        {ideiasProduto.length > 0 && (
          <Card icon={<Layers size={14} className="text-pink-500" />} title={`1 peça, ${ideiasProduto.length} vendas`} color="bg-pink-500/10 border-pink-500/20">
            {a.produto_vitrine?.produto && <p className="text-sm font-bold mb-2">{a.produto_vitrine.produto}</p>}
            <ol className="space-y-1.5 list-decimal pl-4">
              {ideiasProduto.map((x, i) => <li key={i} className="text-xs leading-relaxed">{x}</li>)}
            </ol>
          </Card>
        )}
      </div>

      {carrosseis.length > 0 && (
        <Card icon={<GalleryHorizontal size={14} className="text-indigo-500" />} title="Ideias de carrossel" color="bg-indigo-500/10 border-indigo-500/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {carrosseis.map((c, i) => (
              <div key={i} className="rounded-xl bg-background/60 p-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold leading-snug">{c.titulo}</p>
                  <CopyButton text={[c.titulo, ...c.slides.map((s, j) => `${j + 1}. ${s}`)].join("\n")} />
                </div>
                <ol className="mt-2 space-y-1">
                  {c.slides.map((s, j) => (
                    <li key={j} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="font-bold text-foreground shrink-0">{j + 1}.</span>{s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sequencia.length > 0 && (
          <Card icon={<MessageSquareQuote size={14} className="text-orange-500" />} title="Sequência de stories para vender" color="bg-orange-500/10 border-orange-500/20">
            <ol className="space-y-1.5">
              {sequencia.map((s, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-600 font-bold text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {caixinhas.length > 0 && (
          <Card icon={<MessageSquareQuote size={14} className="text-fuchsia-500" />} title="Caixinhas de perguntas" color="bg-fuchsia-500/10 border-fuchsia-500/20"
            action={<CopyButton text={caixinhas.join("\n")} />}>
            <ul className="space-y-1.5">
              {caixinhas.map((q, i) => <li key={i} className="text-xs leading-relaxed">“{q}”</li>)}
            </ul>
          </Card>
        )}

        {calendario.length > 0 && (
          <Card icon={<CalendarDays size={14} className="text-teal-500" />} title="Calendário: próximas datas" color="bg-teal-500/10 border-teal-500/20">
            <ul className="space-y-2">
              {calendario.map((c, i) => (
                <li key={i} className="text-xs">
                  <span className="font-bold">{fmtDate(c.data)} · {c.ocasiao}</span>
                  <p className="text-muted-foreground leading-relaxed">{c.ideia}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {atendimento.length > 0 && (
          <Card icon={<Headphones size={14} className="text-cyan-500" />} title="Atendimento que converte" color="bg-cyan-500/10 border-cyan-500/20">
            <ul className="space-y-1.5">
              {atendimento.map((x, i) => (
                <li key={i} className="text-xs flex gap-2"><span className="text-cyan-500 shrink-0">•</span>{x}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
