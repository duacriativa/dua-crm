"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export interface SlotsResponse { timezone: string; firstDate: string; lastDate: string; days: Record<string, string[]> }

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEK = ["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];
const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export const fmtTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const fmtDay = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

/** Cores do seletor: "light" na página pública, "app" no CRM (segue o tema). */
const THEMES = {
  light: {
    title: "text-neutral-900", muted: "text-neutral-500", nav: "text-neutral-700 hover:bg-neutral-100 disabled:opacity-30",
    dayOn: "bg-[#B5FB3D]/25 text-neutral-900 font-bold hover:bg-[#B5FB3D]/50", dayOff: "text-neutral-300",
    daySel: "bg-neutral-900 text-[#B5FB3D] font-bold", today: "ring-1 ring-neutral-400",
    slot: "border border-neutral-300 text-neutral-900 hover:border-neutral-900",
    slotSel: "bg-neutral-500 text-white border border-neutral-500", confirm: "bg-neutral-900 text-[#B5FB3D] hover:bg-black",
  },
  app: {
    title: "text-foreground", muted: "text-muted-foreground", nav: "text-muted-foreground hover:bg-muted/50 disabled:opacity-30",
    dayOn: "bg-primary/10 text-primary font-bold hover:bg-primary/20", dayOff: "text-muted-foreground/40",
    daySel: "bg-primary text-white font-bold", today: "ring-1 ring-primary/40",
    slot: "border border-primary/40 text-primary hover:bg-primary/10",
    slotSel: "bg-foreground/80 text-background border border-transparent", confirm: "bg-gradient-primary text-white hover:opacity-90",
  },
};

export function SlotPicker({ load, onConfirm, confirmLabel = "Próximo", variant = "light", busy = false }: {
  load: (from: string, to: string) => Promise<SlotsResponse>;
  onConfirm: (iso: string, tz: string) => void;
  confirmLabel?: string;
  variant?: keyof typeof THEMES;
  busy?: boolean;
}) {
  const t = THEMES[variant];
  const now = new Date();
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth()]);
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const [y, m] = ym;
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    const last = new Date(y, m + 1, 0).getDate();
    load(key(y, m, 1), key(y, m, last))
      .then((d) => {
        if (!alive) return;
        setData(d);
        // Abre no primeiro dia com horário (mês atual) — igual ao Calendly
        setDay((cur) => (cur && d.days[cur] ? cur : Object.keys(d.days).sort()[0] ?? null));
      })
      .catch((e) => alive && setError(e?.message || "Não foi possível carregar os horários."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [y, m, load]);

  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const todayKey = key(now.getFullYear(), now.getMonth(), now.getDate());
  const canPrev = y > now.getFullYear() || m > now.getMonth();
  const canNext = !data || key(y, m, daysInMonth) < data.lastDate;
  const tz = data?.timezone ?? "America/Sao_Paulo";
  const slots = useMemo(() => (day && data?.days[day]) || [], [day, data]);
  const hasAny = !!data && Object.keys(data.days).length > 0;

  const move = (delta: number) => {
    const d = new Date(y, m + delta, 1);
    setYm([d.getFullYear(), d.getMonth()]); setDay(null); setSlot(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => move(-1)} disabled={!canPrev} className={`p-2 rounded-full ${t.nav}`} aria-label="Mês anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className={`text-sm font-semibold ${t.title}`}>{MONTHS[m]} {y}</p>
          <button type="button" onClick={() => move(1)} disabled={!canNext} className={`p-2 rounded-full ${t.nav}`} aria-label="Próximo mês">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEK.map((w) => <div key={w} className={`text-[10px] font-semibold py-1 ${t.muted}`}>{w}</div>)}
          {Array.from({ length: cells }).map((_, i) => {
            const n = i - firstDow + 1;
            if (n < 1 || n > daysInMonth) return <div key={i} />;
            const k = key(y, m, n);
            const open = !!data?.days[k];
            return (
              <button key={i} type="button" disabled={!open || loading} onClick={() => { setDay(k); setSlot(null); }}
                className={`aspect-square max-h-11 w-full mx-auto rounded-full text-sm transition-colors ${
                  day === k ? t.daySel : open ? t.dayOn : t.dayOff
                } ${k === todayKey && day !== k ? t.today : ""}`}>
                {n}
              </button>
            );
          })}
        </div>
        <p className={`text-xs mt-4 ${t.muted}`}>Fuso horário: Brasília (GMT-3)</p>
      </div>

      <div className="lg:w-56 shrink-0">
        {loading ? (
          <div className={`flex items-center gap-2 text-sm ${t.muted} py-6`}><Loader2 className="w-4 h-4 animate-spin" /> Carregando horários…</div>
        ) : error ? (
          <p className="text-sm text-red-500 py-6">{error}</p>
        ) : !hasAny ? (
          <p className={`text-sm ${t.muted} py-6`}>Sem horários livres neste mês.{canNext ? " Veja o próximo." : ""}</p>
        ) : !day ? (
          <p className={`text-sm ${t.muted} py-6`}>Escolha um dia.</p>
        ) : (
          <>
            <p className={`text-sm font-semibold mb-3 first-letter:uppercase ${t.title}`}>{fmtDay(slots[0], tz)}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-1 gap-2 lg:max-h-80 lg:overflow-y-auto lg:pr-1">
              {slots.map((s) => (
                slot === s ? (
                  <div key={s} className="flex gap-2 col-span-3 sm:col-span-4 lg:col-span-1">
                    <span className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-center ${t.slotSel}`}>{fmtTime(s, tz)}</span>
                    <button type="button" disabled={busy} onClick={() => onConfirm(s, tz)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 ${t.confirm}`}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : confirmLabel}
                    </button>
                  </div>
                ) : (
                  <button key={s} type="button" onClick={() => setSlot(s)}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${t.slot}`}>
                    {fmtTime(s, tz)}
                  </button>
                )
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
