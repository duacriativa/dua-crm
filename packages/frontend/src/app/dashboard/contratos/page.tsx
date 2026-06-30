"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  FileText, Plus, Calendar, TrendingUp, RefreshCw,
  CheckCircle2, XCircle, Star, ChevronDown, ChevronUp,
} from "lucide-react";

function fmt(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

const SERVICE_CONFIG: Record<string, { label: string; short: string; color: string; bg: string }> = {
  SOCIAL_MEDIA: { label: "Gerenciamento de Redes Sociais", short: "G. Redes", color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  PAID_TRAFFIC:  { label: "Tráfego Pago / Anúncios",       short: "G. Anúncios", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  CRM_SETUP:     { label: "Implantação de CRM",             short: "CRM",         color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  CONSULTING:    { label: "Consultoria",                    short: "Consultoria", color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  OTHER:         { label: "Outros",                         short: "Outro",       color: "text-gray-600",   bg: "bg-gray-50 border-gray-200" },
};

const SERVICE_ORDER = ["SOCIAL_MEDIA", "PAID_TRAFFIC", "CRM_SETUP", "CONSULTING", "OTHER"];

interface Contract {
  id: string;
  clientName: string;
  serviceType: string;
  status: string;
  monthlyValue: number;
  totalValue: number;
  installments: number;
  installmentsPaid: number;
  signedAt: string;
  startsAt: string;
  endsAt?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  anniversaryInfo: {
    monthsActive: number;
    nextAnniversary: string;
    daysUntilNextAnniversary: number;
    nextMilestone: number | null;
    monthsToNextMilestone: number | null;
    isUpsellOpportunity: boolean;
  };
}

function ClientCard({ c, onCancel }: { c: Contract; onCancel: (c: Contract) => void }) {
  const [open, setOpen] = useState(false);
  const ann = c.anniversaryInfo;
  const isActive = c.status === "ACTIVE";
  const isCancelled = c.status === "CANCELLED";

  return (
    <div className={`bg-card rounded-xl border transition-all ${isCancelled ? "border-red-200/60 opacity-70" : "border-border hover:border-border/80"}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCancelled ? "bg-red-50 text-red-400" : "bg-violet-100 text-violet-700"}`}>
            {c.clientName.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{c.clientName}</span>
              {isCancelled && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Cancelado
                </span>
              )}
              {isActive && ann?.isUpsellOpportunity && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-600 flex items-center gap-1">
                  <Star className="w-3 h-3" /> upsell
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {fmt(c.monthlyValue)}/mês
              {isActive && ann && ` · ${ann.monthsActive} ${ann.monthsActive === 1 ? "mês" : "meses"} de contrato`}
              {isCancelled && c.cancelledAt && ` · cancelado em ${new Date(c.cancelledAt).toLocaleDateString("pt-BR")}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isActive && ann?.daysUntilNextAnniversary <= 7 && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {ann.daysUntilNextAnniversary === 0 ? "Aniversário hoje!" : `Aniv. em ${ann.daysUntilNextAnniversary}d`}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="block text-muted-foreground/60 mb-0.5">Assinou em</span>
              <span className="font-medium text-foreground/80">{new Date(c.signedAt).toLocaleDateString("pt-BR")}</span>
            </div>
            <div>
              <span className="block text-muted-foreground/60 mb-0.5">Início</span>
              <span className="font-medium text-foreground/80">{new Date(c.startsAt).toLocaleDateString("pt-BR")}</span>
            </div>
            {c.endsAt && (
              <div>
                <span className="block text-muted-foreground/60 mb-0.5">Encerra em</span>
                <span className="font-medium text-foreground/80">{new Date(c.endsAt).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {c.installments > 1 && (
              <div>
                <span className="block text-muted-foreground/60 mb-0.5">Parcelas</span>
                <span className="font-medium text-foreground/80">{c.installmentsPaid}/{c.installments} pagas</span>
              </div>
            )}
          </div>

          {isActive && ann?.nextMilestone && (
            <div className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2">
              <TrendingUp className="w-3 h-3 shrink-0" />
              Marco de {ann.nextMilestone} meses em {ann.monthsToNextMilestone} {ann.monthsToNextMilestone === 1 ? "mês" : "meses"} — oportunidade de upsell
            </div>
          )}

          {c.notes && (
            <p className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">{c.notes}</p>
          )}

          {isCancelled && c.cancellationReason && (
            <div className="text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <span className="font-medium text-red-600">Motivo: </span>
              <span className="text-red-500">{c.cancellationReason}</span>
            </div>
          )}

          {isActive && (
            <button
              onClick={() => onCancel(c)}
              className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors mt-1"
            >
              Cancelar contrato
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "CANCELLED">("ACTIVE");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clientName: "", serviceType: "SOCIAL_MEDIA", monthlyValue: "",
    totalValue: "", installments: "1", signedAt: "", startsAt: "", endsAt: "",
    notes: "", clicksignDocId: "",
  });
  const [saving, setSaving] = useState(false);
  const [cancelModal, setCancelModal] = useState<Contract | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/contracts");
      setContracts(Array.isArray(res.data) ? res.data : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/contracts", {
        ...form,
        monthlyValue: parseFloat(form.monthlyValue),
        totalValue: parseFloat(form.totalValue || form.monthlyValue),
        installments: parseInt(form.installments),
        endsAt: form.endsAt || undefined,
      });
      setShowForm(false);
      setForm({ clientName: "", serviceType: "SOCIAL_MEDIA", monthlyValue: "", totalValue: "", installments: "1", signedAt: "", startsAt: "", endsAt: "", notes: "", clicksignDocId: "" });
      load();
    } catch { } finally { setSaving(false); }
  };

  const cancelContract = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.patch(`/contracts/${cancelModal.id}/cancel`, { reason: cancelReason });
      setCancelModal(null);
      setCancelReason("");
      load();
    } catch { } finally { setCancelling(false); }
  };

  const activeContracts = contracts.filter((c) => c.status === "ACTIVE");
  const filtered = filter === "ALL" ? contracts : contracts.filter((c) => c.status === filter);
  const upsellNow = activeContracts.filter((c) => c.anniversaryInfo?.isUpsellOpportunity);
  const anniversariesSoon = activeContracts.filter((c) => c.anniversaryInfo?.daysUntilNextAnniversary <= 7);

  // Group filtered contracts by service type
  const grouped = SERVICE_ORDER
    .map((svc) => ({
      svc,
      items: filtered.filter((c) => c.serviceType === svc),
    }))
    .filter((g) => g.items.length > 0);

  const totalMensal = activeContracts.reduce((s, c) => s + c.monthlyValue, 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeContracts.length} ativos · {fmt(totalMensal)}/mês
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo contrato
        </button>
      </div>

      {/* Alertas */}
      {upsellNow.length > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-semibold text-violet-700">Oportunidades de upsell</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {upsellNow.map((c) => (
              <span key={c.id} className="text-xs bg-white border border-violet-200 text-violet-700 rounded-lg px-3 py-1.5 font-medium">
                {c.clientName} · {c.anniversaryInfo.monthsActive} meses
              </span>
            ))}
          </div>
          <p className="text-xs text-violet-500 mt-2">Múltiplo de 3 meses — momento ideal para oferecer upgrade ou serviço adicional.</p>
        </div>
      )}

      {anniversariesSoon.length > 0 && !upsellNow.some((u) => anniversariesSoon.find((a) => a.id === u.id)) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-700">Aniversários nos próximos 7 dias</p>
          </div>
          {anniversariesSoon.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1">
              <span className="text-sm text-amber-800 font-medium">{c.clientName}</span>
              <span className="text-xs text-amber-600">
                {c.anniversaryInfo.daysUntilNextAnniversary === 0 ? "Hoje!" : `Em ${c.anniversaryInfo.daysUntilNextAnniversary} dias`} · {c.anniversaryInfo.monthsActive + 1}º mês
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Cadastrar contrato</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Cliente</label>
              <input className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} placeholder="Ex: Amiche" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Serviço</label>
              <select className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" value={form.serviceType} onChange={e => setForm(p => ({ ...p, serviceType: e.target.value }))}>
                {SERVICE_ORDER.map((k) => <option key={k} value={k}>{SERVICE_CONFIG[k].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Valor mensal (R$)</label>
              <input type="number" className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" value={form.monthlyValue} onChange={e => setForm(p => ({ ...p, monthlyValue: e.target.value }))} placeholder="2500" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Parcelas (1 = recorrente)</label>
              <input type="number" className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" value={form.installments} onChange={e => setForm(p => ({ ...p, installments: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Data de assinatura</label>
              <input type="date" className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" value={form.signedAt} onChange={e => setForm(p => ({ ...p, signedAt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Início do contrato</label>
              <input type="date" className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" value={form.startsAt} onChange={e => setForm(p => ({ ...p, startsAt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Fim (vazio = recorrente)</label>
              <input type="date" className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" value={form.endsAt} onChange={e => setForm(p => ({ ...p, endsAt: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Observações</label>
            <textarea className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar contrato"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-muted-foreground px-4 py-2 rounded-lg border border-border hover:bg-muted/20">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2">
        {([["ACTIVE", "Ativos"], ["CANCELLED", "Cancelados"], ["ALL", "Todos"]] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted/20"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Modal cancelamento */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-base font-semibold text-foreground mb-1">Cancelar contrato</h2>
            <p className="text-sm text-muted-foreground mb-4">{cancelModal.clientName} · {SERVICE_CONFIG[cancelModal.serviceType]?.short}</p>
            <label className="block text-xs text-muted-foreground mb-1.5">Motivo do cancelamento</label>
            <textarea
              className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              rows={3}
              placeholder="Ex: Cliente encerrou atividades, inadimplência, concorrente..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mb-5">O contrato fica registrado como cancelado. Não será apagado.</p>
            <div className="flex gap-2">
              <button
                onClick={cancelContract}
                disabled={!cancelReason.trim() || cancelling}
                className="flex-1 bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
              <button onClick={() => { setCancelModal(null); setCancelReason(""); }} className="text-sm text-muted-foreground px-4 py-2 rounded-lg border border-border hover:bg-muted/20">
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista agrupada */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <RefreshCw className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum contrato encontrado.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-primary text-sm font-medium hover:underline">Cadastrar o primeiro</button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ svc, items }) => {
            const conf = SERVICE_CONFIG[svc];
            const total = items.filter((c) => c.status === "ACTIVE").reduce((s, c) => s + c.monthlyValue, 0);
            return (
              <div key={svc}>
                {/* Group header */}
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border mb-2 ${conf.bg}`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-4 h-4 ${conf.color}`} />
                    <span className={`text-sm font-semibold ${conf.color}`}>{conf.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-white/60 ${conf.color} font-medium`}>
                      {items.filter(c => c.status === "ACTIVE").length} ativos
                    </span>
                  </div>
                  {total > 0 && (
                    <span className={`text-sm font-semibold ${conf.color}`}>{fmt(total)}/mês</span>
                  )}
                </div>
                {/* Cards */}
                <div className="space-y-2">
                  {items.map((c) => (
                    <ClientCard key={c.id} c={c} onCancel={setCancelModal} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
