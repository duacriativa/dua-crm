"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, RefreshCw, Timer } from "lucide-react";
import api from "@/lib/api";
import { PLAN_STATUS, StatusBadge, dueLabel, errMsg, fmtDateTime } from "@/components/plans/plan-status";

interface Row {
  id: string; status: string; productName: string; value: number; name: string; phone: string; email: string;
  instagramHandle: string; createdAt: string; paidAt: string | null; dueAt: string | null; deliveredAt: string | null;
  reviewedAt: string | null; generationState: string | null; generationError: string | null; late: boolean;
}

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "open", label: "A entregar" },
  ...Object.entries(PLAN_STATUS).map(([key, s]) => ({ key, label: s.label })),
];

/** Pedidos do plano de 3 meses (página /plano-90-dias): prazo de entrega contado do pagamento. */
export default function PlanosPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("open");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(() => {
    setError("");
    api.get("/plan-orders").then((r) => setRows(r.data)).catch((e) => { setRows([]); setError(errMsg(e)); });
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);

  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/plano-90-dias` : "/plano-90-dias";
  const copyLink = async () => {
    await navigator.clipboard.writeText(pageUrl).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const open = (r: Row) => ["PAID", "IN_PRODUCTION", "IN_REVIEW"].includes(r.status);
  const shown = (rows ?? []).filter((r) => (filter === "open" ? open(r) : !filter || r.status === filter));
  // A entregar: atrasados primeiro, depois o prazo mais curto
  if (filter === "open") shown.sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const lateCount = (rows ?? []).filter((r) => r.late).length;
  const count = (key: string) => (rows ?? []).filter((r) => (key === "open" ? open(r) : !key || r.status === key)).length;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-background/80 backdrop-blur-xl px-6 py-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Planos 90 dias</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Pedidos pagos no Pix pela página de venda · entrega em até 24h depois do pagamento</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyLink} className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted/50">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copiado" : "Copiar link da página"}
            </button>
            <a href="/plano-90-dias" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted/50">
              <ExternalLink className="w-4 h-4" /> Abrir
            </a>
            <button onClick={load} title="Atualizar" className="p-2 border border-border rounded-xl hover:bg-muted/50"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap border ${filter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {f.label} <span className="opacity-70">{rows ? count(f.key) : ""}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {lateCount > 0 && (
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4" /> {lateCount} {lateCount === 1 ? "pedido atrasado" : "pedidos atrasados"} (passou de 24h do pagamento)
          </div>
        )}
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {!rows ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-20">Nenhum pedido aqui.</p>
        ) : (
          <div className="border border-border rounded-2xl overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Cliente</th>
                  <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Pedido</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th className="text-left font-medium px-4 py-2.5">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className={`border-t border-border hover:bg-muted/30 ${r.late ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/planos/${r.id}`} className="font-semibold text-foreground hover:underline">{r.name}</Link>
                      <p className="text-xs text-muted-foreground">@{r.instagramHandle}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {fmtDateTime(r.createdAt)} · R$ {r.value.toLocaleString("pt-BR")}
                      {r.paidAt && <><br />pago {fmtDateTime(r.paidAt)}</>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} approved={!!r.reviewedAt} />
                      {r.generationState === "RUNNING" && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> gerando com IA</p>}
                      {r.generationState === "ERROR" && <p className="text-[11px] text-red-400 mt-1">falha na geração</p>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.status === "DELIVERED" && r.deliveredAt ? (
                        <span className="text-emerald-400">entregue {fmtDateTime(r.deliveredAt)}</span>
                      ) : r.dueAt && r.status !== "CANCELED" ? (
                        <span className={`inline-flex items-center gap-1 font-semibold ${r.late ? "text-red-400" : "text-foreground"}`}>
                          <Timer className="w-3.5 h-3.5" /> {dueLabel(r.dueAt)}
                          <span className="font-normal text-muted-foreground">({fmtDateTime(r.dueAt)})</span>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
