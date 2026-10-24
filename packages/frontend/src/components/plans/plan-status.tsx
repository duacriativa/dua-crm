export const PLAN_STATUS: Record<string, { label: string; cls: string }> = {
  AWAITING_PAYMENT: { label: "Aguardando pagamento", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  PAID: { label: "Pago", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  IN_PRODUCTION: { label: "Em produção", cls: "bg-primary/15 text-primary border-primary/30" },
  IN_REVIEW: { label: "Em revisão", cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  DELIVERED: { label: "Entregue", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  CANCELED: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ status, approved }: { status: string; approved?: boolean }) {
  const s = PLAN_STATUS[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  const label = status === "IN_REVIEW" && approved ? "Aprovado · enviar" : s.label;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${s.cls}`}>{label}</span>;
}

const TZ = "America/Sao_Paulo";
export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** "faltam 5h 20min" / "atrasado 2h 10min" a partir do prazo. */
export function dueLabel(dueAt: string, now = Date.now()) {
  const diff = new Date(dueAt).getTime() - now;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600_000);
  const m = Math.floor((abs % 3600_000) / 60_000);
  const t = h ? `${h}h ${m}min` : `${m}min`;
  return diff >= 0 ? `faltam ${t}` : `atrasado ${t}`;
}

export const errMsg = (e: any) => {
  const m = e?.response?.data?.message;
  return (Array.isArray(m) ? m[0] : m) || e?.message || "Algo deu errado.";
};
