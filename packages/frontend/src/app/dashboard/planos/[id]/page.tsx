"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Copy, Download, ExternalLink, FlaskConical, Loader2,
  MessageCircle, RotateCcw, Save, Sparkles, Timer, Undo2, XCircle,
} from "lucide-react";
import api from "@/lib/api";
import { authFetch } from "@/lib/auth-fetch";
import { StatusBadge, dueLabel, errMsg, fmtDateTime } from "@/components/plans/plan-status";
import { PlanEditor } from "@/components/plans/plan-editor";

interface Order {
  id: string; status: string; productName: string; value: number; name: string; phone: string; email: string; cpfCnpj: string;
  instagramHandle: string; answers: Record<string, string>; contactId: string; diagnosisToken: string | null;
  createdAt: string; paidAt: string | null; dueAt: string | null; deliveredAt: string | null; reviewedAt: string | null; reviewedBy: string | null;
  plan: Record<string, any> | null; generating: boolean; generationState: string | null; generationError: string | null; generatedAt: string | null;
  late: boolean; clientUrl: string; pdfUrl: string | null; whatsappText: string | null; sandbox: boolean; notes: string | null;
}

const ANSWERS: [string, string][] = [
  ["nicho", "Produto / nicho"], ["ticket", "Ticket médio"], ["publico", "Público"],
  ["quemPosta", "Quem posta hoje"], ["verba", "Verba mensal"], ["objetivo", "Objetivo principal"],
  ["ondeVende", "Onde vende"], ["referencias", "Marcas de referência"], ["observacoes", "Observações"],
];

const btn = "inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-muted/50 disabled:opacity-50";
const primary = "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-primary hover:opacity-90 disabled:opacity-50 shadow-elegant";

/** Um pedido: pagamento, geração com IA, revisão obrigatória e entrega manual pelo WhatsApp Business. */
export default function PlanoPedidoPage({ params }: { params: { id: string } }) {
  const [o, setO] = useState<Order | null>(null);
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const apply = useCallback((d: Order, keepDraft = false) => {
    setO(d);
    if (!keepDraft) { setDraft(d.plan); setDirty(false); }
  }, []);

  const load = useCallback((keepDraft = false) => {
    return api.get(`/plan-orders/${params.id}`).then((r) => apply(r.data, keepDraft)).catch((e) => setError(errMsg(e)));
  }, [params.id, apply]);
  useEffect(() => { load(); }, [load]);

  // Enquanto gera (ou espera o Pix), atualiza sozinho; não apaga edições em andamento
  const waiting = o?.generating || o?.generationState === "RUNNING" || o?.status === "AWAITING_PAYMENT";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => load(dirty), o?.status === "AWAITING_PAYMENT" ? 10_000 : 4000);
    return () => clearInterval(t);
  }, [waiting, dirty, load, o?.status]);

  const act = async (name: string, fn: () => Promise<any>) => {
    setBusy(name); setError("");
    try { const r = await fn(); if (r?.data) apply(r.data); } catch (e) { setError(errMsg(e)); } finally { setBusy(""); }
  };

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key); setTimeout(() => setCopied(""), 2000);
  };

  const downloadPdf = async () => {
    setBusy("pdf"); setError("");
    try {
      const res = await authFetch(`/api/v1/plan-orders/${params.id}/pdf`);
      if (!res.ok) throw new Error("Não foi possível gerar o PDF.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `plano-90-dias-${o?.instagramHandle ?? "cliente"}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(""); }
  };

  if (!o) {
    return <div className="flex justify-center py-32">{error ? <p className="text-sm text-red-400">{error}</p> : <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}</div>;
  }

  const running = o.generating || o.generationState === "RUNNING";
  const approved = !!o.reviewedAt;
  const phoneDigits = o.phone.replace(/\D/g, "");

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <Link href="/dashboard/planos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Planos 90 dias
        </Link>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{o.name}</h1>
            <p className="text-sm text-muted-foreground">@{o.instagramHandle} · {o.productName} · R$ {o.value.toLocaleString("pt-BR")}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={o.status} approved={approved} />
            {o.dueAt && !["DELIVERED", "CANCELED"].includes(o.status) && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold ${o.late ? "text-red-400" : "text-foreground"}`}>
                <Timer className="w-3.5 h-3.5" /> {dueLabel(o.dueAt)} · até {fmtDateTime(o.dueAt)}
              </span>
            )}
          </div>
        </div>

        {o.late && (
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4" /> Prazo de entrega estourado.
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-2.5">{error}</p>}

        <div className="mt-5 grid lg:grid-cols-[1fr_340px] gap-5 items-start">
          {/* Plano */}
          <div className="min-w-0 space-y-4">
            {o.status === "AWAITING_PAYMENT" && (
              <div className="border border-border rounded-2xl bg-card p-5">
                <p className="font-semibold">Aguardando o Pix.</p>
                <p className="text-sm text-muted-foreground mt-1">Quando o Asaas confirmar, o pedido vira "Pago" e a geração começa sozinha. O prazo de 24h conta a partir do pagamento.</p>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button className={btn} onClick={() => copy("client", o.clientUrl)}>
                    {copied === "client" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Link do Pix para o cliente
                  </button>
                  {o.sandbox && (
                    <button className={btn} disabled={!!busy} onClick={() => act("sim", () => api.post(`/plan-orders/${o.id}/simulate-payment`))}>
                      {busy === "sim" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />} Simular pagamento (sandbox)
                    </button>
                  )}
                </div>
              </div>
            )}

            {running && (
              <div className="border border-primary/30 rounded-2xl bg-primary/5 p-5 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div>
                  <p className="font-semibold">Gerando o plano com IA...</p>
                  <p className="text-sm text-muted-foreground">Leva de 1 a 3 minutos: estratégia, calendário, Reels, legendas e metas.</p>
                </div>
              </div>
            )}

            {o.generationState === "ERROR" && !running && (
              <div className="border border-red-500/30 rounded-2xl bg-red-500/5 p-5">
                <p className="font-semibold text-red-400">A geração falhou</p>
                <p className="text-sm text-muted-foreground mt-1">{o.generationError}</p>
              </div>
            )}

            {o.paidAt && !o.plan && !running && o.status !== "CANCELED" && (
              <button className={primary} disabled={!!busy} onClick={() => act("gen", () => api.post(`/plan-orders/${o.id}/generate`, {}))}>
                <Sparkles className="w-4 h-4" /> Gerar plano com IA
              </button>
            )}

            {draft && (
              <>
                <div className="flex items-center gap-2 flex-wrap sticky top-0 z-10 bg-background/90 backdrop-blur py-2">
                  <button className={primary} disabled={!dirty || !!busy || running}
                    onClick={() => act("save", () => api.patch(`/plan-orders/${o.id}/plan`, { plan: draft }))}>
                    {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar alterações
                  </button>
                  {dirty && <button className={btn} onClick={() => { setDraft(o.plan); setDirty(false); }}><Undo2 className="w-4 h-4" /> Descartar</button>}
                  <button className={btn} disabled={!!busy || dirty} onClick={downloadPdf} title={dirty ? "Salve antes" : undefined}>
                    {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Prévia do PDF
                  </button>
                  {!["DELIVERED", "CANCELED"].includes(o.status) && (
                    <button className={btn} disabled={!!busy || running}
                      onClick={() => confirm("Gerar o plano inteiro de novo? Todas as edições serão perdidas.") && act("gen", () => api.post(`/plan-orders/${o.id}/generate`, {}))}>
                      <RotateCcw className="w-4 h-4" /> Gerar tudo de novo
                    </button>
                  )}
                  {o.plan && o.plan.perfilLido === false && (
                    <span className="text-xs text-amber-500">Gerado sem dados do Instagram (perfil não acessível pela API)</span>
                  )}
                </div>
                <PlanEditor
                  plan={draft}
                  busy={running || !!busy || o.status === "DELIVERED"}
                  onChange={(p) => { setDraft(p); setDirty(true); }}
                  onRegenerate={(part) => act("gen", () => api.post(`/plan-orders/${o.id}/generate`, { part }))}
                />
              </>
            )}
          </div>

          {/* Lateral: revisão, entrega e dados */}
          <aside className="space-y-4 lg:sticky lg:top-4">
            {o.plan && o.status === "IN_REVIEW" && !approved && (
              <div className="border border-violet-500/30 rounded-2xl bg-violet-500/5 p-5">
                <p className="font-semibold">Revisão obrigatória</p>
                <p className="text-sm text-muted-foreground mt-1">Leia o plano, ajuste o que precisar e salve. Nada vai para o cliente antes da aprovação.</p>
                <button className={`${primary} w-full mt-4`} disabled={dirty || !!busy || running}
                  onClick={() => act("approve", () => api.post(`/plan-orders/${o.id}/approve`))}>
                  <CheckCircle2 className="w-4 h-4" /> {dirty ? "Salve antes de aprovar" : "Aprovar e liberar entrega"}
                </button>
              </div>
            )}

            {approved && o.whatsappText && (
              <div className="border border-emerald-500/30 rounded-2xl bg-emerald-500/5 p-5 space-y-3">
                <p className="font-semibold">Entrega pelo WhatsApp Business</p>
                <p className="text-xs text-muted-foreground">Aprovado por {o.reviewedBy} em {fmtDateTime(o.reviewedAt!)}. Envie pelo app no celular e depois marque como entregue.</p>
                <textarea readOnly value={o.whatsappText} rows={9} className="w-full text-xs bg-background border border-border rounded-lg p-2.5" />
                <div className="grid grid-cols-2 gap-2">
                  <button className={btn} onClick={() => copy("wa", o.whatsappText!)}>
                    {copied === "wa" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copiar texto
                  </button>
                  <a className={btn} href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(o.whatsappText)}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="w-4 h-4" /> Abrir no WhatsApp
                  </a>
                  <button className={btn} onClick={() => copy("pdf", o.pdfUrl!)}>
                    {copied === "pdf" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Link do PDF
                  </button>
                  <button className={btn} disabled={!!busy} onClick={downloadPdf}><Download className="w-4 h-4" /> Baixar PDF</button>
                </div>
                {o.status !== "DELIVERED" && (
                  <button className={`${primary} w-full`} disabled={!!busy} onClick={() => act("deliver", () => api.patch(`/plan-orders/${o.id}/status`, { status: "DELIVERED" }))}>
                    <Check className="w-4 h-4" /> Marcar como entregue
                  </button>
                )}
              </div>
            )}

            {o.status === "DELIVERED" && (
              <div className="border border-border rounded-2xl bg-card p-5">
                <p className="font-semibold text-emerald-400">Entregue {o.deliveredAt ? fmtDateTime(o.deliveredAt) : ""}</p>
                <button className={`${btn} w-full mt-3`} disabled={!!busy} onClick={() => act("back", () => api.patch(`/plan-orders/${o.id}/status`, { status: "IN_REVIEW" }))}>
                  <Undo2 className="w-4 h-4" /> Voltar para revisão
                </button>
              </div>
            )}

            <div className="border border-border rounded-2xl bg-card p-5 text-sm space-y-3">
              <p className="font-semibold">Cliente</p>
              <div className="space-y-1 text-muted-foreground">
                <p>{o.phone}</p>
                <p className="break-all">{o.email}</p>
                <p>CPF/CNPJ {o.cpfCnpj}</p>
                <a href={`https://instagram.com/${o.instagramHandle}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  @{o.instagramHandle} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <Link href={`/dashboard/contatos/${o.contactId}`} className="inline-flex items-center gap-1 text-primary text-xs font-semibold hover:underline">
                Abrir contato no CRM
              </Link>
              <div className="border-t border-border pt-3 space-y-2">
                {ANSWERS.filter(([k]) => o.answers?.[k]).map(([k, l]) => (
                  <div key={k}>
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="text-foreground whitespace-pre-line">{o.answers[k]}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 text-xs text-muted-foreground space-y-0.5">
                <p>Pedido {fmtDateTime(o.createdAt)}{o.diagnosisToken ? " · veio do diagnóstico" : ""}</p>
                {o.paidAt && <p>Pago {fmtDateTime(o.paidAt)}</p>}
                {o.generatedAt && <p>Gerado {fmtDateTime(o.generatedAt)}</p>}
                {o.notes && <p className="text-amber-500">{o.notes}</p>}
              </div>
              <button className={`${btn} w-full`} onClick={() => copy("client", o.clientUrl)}>
                {copied === "client" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Link de acompanhamento do cliente
              </button>
              {!["DELIVERED", "CANCELED"].includes(o.status) && (
                <button className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-red-400" disabled={!!busy}
                  onClick={() => confirm("Cancelar este pedido? (o estorno, se houver, é feito no Asaas)") && act("cancel", () => api.patch(`/plan-orders/${o.id}/status`, { status: "CANCELED" }))}>
                  <XCircle className="w-3.5 h-3.5" /> Cancelar pedido
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
