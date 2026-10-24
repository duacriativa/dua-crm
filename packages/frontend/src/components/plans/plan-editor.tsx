"use client";

import { useEffect, useRef } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";

const LABELS: Record<string, string> = {
  resumo: "Resumo", diagnostico: "Onde a marca está hoje", posicionamento: "Posicionamento", publico: "Público",
  diferenciais: "Diferenciais", tom_de_voz: "Tom de voz", frequencia: "Frequência de postagem",
  nome: "Nome", objetivo: "Objetivo", percentual: "% do conteúdo", exemplos: "Exemplos",
  semana: "Semana", tema: "Tema", feed: "Posts do feed", dia: "Dia", formato: "Formato", pilar: "Pilar", ideia: "Ideia",
  stories: "Stories", titulo: "Título", gancho: "Gancho", roteiro: "Cenas", texto_na_tela: "Texto na tela", cta: "CTA",
  audio: "Áudio", legenda: "Legenda", hashtags: "Hashtags", categoria: "Categoria", ideias: "Ideias", item: "Item",
  quando: "Quando", investimento: "Investimento", por_que: "Por quê", mes: "Mês", foco: "Foco", metas: "Metas",
};

/** Seções do plano, na ordem do PDF, e qual parte da geração refaz cada uma. */
export const PLAN_SECTIONS: { keys: string[]; title: string; part: string }[] = [
  { keys: ["estrategia"], title: "Estratégia e posicionamento", part: "estrategia" },
  { keys: ["pilares"], title: "Pilares de conteúdo", part: "estrategia" },
  { keys: ["calendario"], title: "Calendário de 12 semanas", part: "calendario" },
  { keys: ["reels"], title: "Roteiros de Reels", part: "reels" },
  { keys: ["legendas"], title: "Legendas prontas", part: "legendas" },
  { keys: ["stories"], title: "Ideias de stories", part: "legendas" },
  { keys: ["contratar"], title: "O que contratar", part: "investimento" },
  { keys: ["metas", "primeiros_passos"], title: "Metas de 90 dias e checklist", part: "investimento" },
];

const PART_LABEL: Record<string, string> = {
  estrategia: "estratégia e pilares", calendario: "calendário", reels: "Reels", legendas: "legendas e stories", investimento: "contratações, metas e checklist",
};

/** O JSONB do Postgres reordena as chaves: o editor mostra na ordem do PDF. */
const KEY_ORDER = [
  "resumo", "diagnostico", "posicionamento", "publico", "diferenciais", "tom_de_voz", "frequencia",
  "semana", "mes", "nome", "titulo", "item", "categoria", "tema", "foco", "objetivo", "percentual", "exemplos",
  "dia", "formato", "pilar", "ideia", "feed", "stories", "gancho", "roteiro", "texto_na_tela", "cta", "audio",
  "legenda", "hashtags", "ideias", "quando", "investimento", "por_que", "metas",
];
const rank = (k: string) => { const i = KEY_ORDER.indexOf(k); return i < 0 ? 999 : i; };

const label = (k: string) => LABELS[k] ?? k.replace(/_/g, " ");
const area = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed";

function AutoText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; }
  }, [value]);
  return <textarea ref={ref} rows={1} className={area} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** Item vazio com o mesmo formato do primeiro (para "Adicionar"). */
function blank(sample: any): any {
  if (typeof sample === "string") return "";
  if (typeof sample === "number") return 0;
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === "object") return Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, blank(v)]));
  return "";
}

const summary = (o: any) => {
  const t = o?.semana !== undefined ? `Semana ${o.semana}${o.tema ? ` · ${o.tema}` : ""}` : o?.mes !== undefined ? `Mês ${o.mes}${o.foco ? ` · ${o.foco}` : ""}` : "";
  return t || o?.titulo || o?.nome || o?.tema || o?.item || o?.categoria || o?.dia || "Item";
};

/** Editor genérico do JSON do plano: textos viram caixas de texto, listas podem ganhar e perder itens. */
function Node({ k, value, onChange, depth }: { k: string; value: any; onChange: (v: any) => void; depth: number }) {
  if (typeof value === "string") return <AutoText value={value} onChange={onChange} />;
  if (typeof value === "number") {
    return <input type="number" className={`${area} w-28`} value={value} onChange={(e) => onChange(Number(e.target.value))} />;
  }
  if (Array.isArray(value)) {
    const objects = value.some((v) => v && typeof v === "object");
    const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
    const add = () => onChange([...value, value.length ? blank(value[0]) : ""]);
    return (
      <div className="space-y-2">
        {value.map((item, i) =>
          objects ? (
            <details key={i} open={depth === 0 && value.length <= 5} className="border border-border rounded-xl bg-muted/20">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="flex-1 truncate">{summary(item)}</span>
                <button type="button" title="Remover" onClick={(e) => { e.preventDefault(); if (confirm("Remover este item?")) remove(i); }}
                  className="p-1 text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </summary>
              <div className="px-3 pb-3">
                <Node k={k} value={item} depth={depth + 1} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
              </div>
            </details>
          ) : (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1"><Node k={k} value={item} depth={depth + 1} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} /></div>
              <button type="button" title="Remover" onClick={() => remove(i)} className="p-2 text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ),
        )}
        <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="space-y-3">
        {Object.entries(value).sort(([a], [b]) => rank(a) - rank(b)).map(([ck, cv]) => (
          <div key={ck}>
            <p className="text-xs font-semibold text-muted-foreground mb-1">{label(ck)}</p>
            <Node k={ck} value={cv} depth={depth + 1} onChange={(v) => onChange({ ...value, [ck]: v })} />
          </div>
        ))}
      </div>
    );
  }
  return <AutoText value={value === null || value === undefined ? "" : String(value)} onChange={onChange} />;
}

export function PlanEditor({ plan, onChange, onRegenerate, busy }: {
  plan: Record<string, any>;
  onChange: (p: Record<string, any>) => void;
  onRegenerate: (part: string) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-3">
      {PLAN_SECTIONS.map((s, i) => (
        <details key={s.title} open={i === 0} className="border border-border rounded-2xl bg-card">
          <summary className="cursor-pointer px-4 py-3 font-bold flex items-center gap-2">
            <span className="flex-1">{s.title}</span>
            <button type="button" disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (confirm(`Gerar de novo ${PART_LABEL[s.part]} com a IA? O que você editou nessa parte será substituído.`)) onRegenerate(s.part);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40">
              <RotateCcw className="w-3.5 h-3.5" /> Gerar de novo
            </button>
          </summary>
          <div className="px-4 pb-4 space-y-4">
            {s.keys.map((k) => (
              <div key={k}>
                {s.keys.length > 1 && <p className="text-sm font-semibold mb-2">{k === "primeiros_passos" ? "Checklist da primeira semana" : label(k)}</p>}
                <Node k={k} value={plan[k] ?? (k === "estrategia" ? {} : [])} depth={0} onChange={(v) => onChange({ ...plan, [k]: v })} />
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
