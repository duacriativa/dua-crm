"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  FileText, Plus, Calendar, TrendingUp, RefreshCw,
  CheckCircle2, Clock, XCircle, Star, AlertCircle,
} from "lucide-react";


function fmt(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

const SERVICE_LABELS: Record<string, string> = {
  SOCIAL_MEDIA: "Redes Sociais",
  PAID_TRAFFIC: "Tráfego Pago",
  CRM_SETUP: "Implantação CRM",
  CONSULTING: "Consultoria",
  OTHER: "Outros",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ACTIVE: { label: "Ativo", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 },
  FINISHED: { label: "Encerrado", color: "text-gray-500 bg-gray-50 border-gray-200", icon: XCircle },
  CANCELLED: { label: "Cancelado", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle },
};

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
  anniversaryInfo: {
    monthsActive: number;
    nextAnniversary: string;
    daysUntilNextAnniversary: number;
    nextMilestone: number | null;
    monthsToNextMilestone: number | null;
    isUpsellOpportunity: boolean;
  };
}

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "FINISHED" | "CANCELLED">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clientName: "", serviceType: "SOCIAL_MEDIA", monthlyValue: "",
    totalValue: "", installments: "1", signedAt: "", startsAt: "", endsAt: "",
    notes: "", clicksignDocId: "",
  });
  const [saving, setSaving] = useState(false);
  const [cancelModal, setCancelModal] = useState<{ id: string; name: string } | null>(null);
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

  const filtered = contracts.filter((c) => filter === "ALL" || c.status === filter);
  const upsellNow = contracts.filter((c) => c.anniversaryInfo?.isUpsellOpportunity && c.status === "ACTIVE");
  const anniversariesSoon = contracts.filter((c) => c.status === "ACTIVE" && c.anniversaryInfo?.daysUntilNextAnniversary <= 7);

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contracts.filter(c => c.status === "ACTIVE").length} ativos · aniversários e oportunidades de upsell</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo contrato
        </button>
      </div>

      {/* Alertas de upsell */}
      {upsellNow.length > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-semibold text-violet-700">Oportunidades de upsell agora</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {upsellNow.map((c) => (
              <span key={c.id} className="text-xs bg-white border border-violet-200 text-violet-700 rounded-lg px-3 py-1.5 font-medium">
                {c.clientName} · {c.anniversaryInfo.monthsActive} meses
              </span>
            ))}
          </div>
          <p className="text-xs text-violet-600 mt-2">Esses clientes completaram um múltiplo de 3 meses — momento ideal para oferecer upgrade ou serviço adicional.</p>
        </div>
      )}

      {/* Aniversários próximos */}
      {anniversariesSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-700">Aniversários de contrato nos próximos 7 dias</p>
          </div>
          {anniversariesSoon.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1">
              <span className="text-sm text-amber-800 font-medium">{c.clientName}</span>
              <span className="text-xs text-amber-600">{c.anniversaryInfo.daysUntilNextAnniversary === 0 ? "Hoje!" : `Em ${c.anniversaryInfo.daysUntilNextAnniversary} dias`} · {c.anniversaryInfo.monthsActive + 1}º mês</span>
            </div>
          ))}
        </div>
      )}

      {/* Formulário novo contrato */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Cadastrar contrato</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cliente</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} placeholder="Ex: Amiche" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Serviço</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.serviceType} onChange={e => setForm(p => ({ ...p, serviceType: e.target.value }))}>
                {Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valor mensal (R$)</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.monthlyValue} onChange={e => setForm(p => ({ ...p, monthlyValue: e.target.value }))} placeholder="2500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Parcelas (1 = recorrente)</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.installments} onChange={e => setForm(p => ({ ...p, installments: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data de assinatura</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.signedAt} onChange={e => setForm(p => ({ ...p, signedAt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Início do contrato</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.startsAt} onChange={e => setForm(p => ({ ...p, startsAt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fim (deixe vazio se recorrente)</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.endsAt} onChange={e => setForm(p => ({ ...p, endsAt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ID Clicksign (opcional)</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.clicksignDocId} onChange={e => setForm(p => ({ ...p, clicksignDocId: e.target.value }))} placeholder="Doc ID do Clicksign" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Observações</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar contrato"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2">
        {(["ALL", "ACTIVE", "FINISHED", "CANCELLED"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
            {f === "ALL" ? "Todos" : f === "ACTIVE" ? "Ativos" : f === "FINISHED" ? "Encerrados" : "Cancelados"}
          </button>
        ))}
      </div>

      {/* Modal de cancelamento */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md shadow-xl">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Cancelar contrato</h2>
            <p className="text-xs text-gray-500 mb-4">{cancelModal.name}</p>
            <label className="block text-xs text-gray-500 mb-1">Motivo do cancelamento</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-1"
              rows={3}
              placeholder="Ex: Cliente faliu, problema pessoal, inadimplência, rescisão..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <p className="text-xs text-gray-400 mb-4">O contrato ficará registrado como cancelado com este motivo. Não será apagado.</p>
            <div className="flex gap-2">
              <button
                onClick={cancelContract}
                disabled={!cancelReason.trim() || cancelling}
                className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
              <button onClick={() => { setCancelModal(null); setCancelReason(""); }} className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de contratos */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
          <RefreshCw className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum contrato cadastrado ainda.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-brand-600 text-sm font-medium hover:underline">Cadastrar o primeiro</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const statusConf = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.ACTIVE;
            const StatusIcon = statusConf.icon;
            const ann = c.anniversaryInfo;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-sm font-semibold text-brand-700 shrink-0">
                      {c.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{c.clientName}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusConf.color}`}>
                          {statusConf.label}
                        </span>
                        {ann?.isUpsellOpportunity && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 flex items-center gap-1">
                            <Star className="w-3 h-3" /> upsell
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{SERVICE_LABELS[c.serviceType]} · {fmt(c.monthlyValue)}/mês</p>
                      {c.installments > 1 && (
                        <p className="text-xs text-gray-400 mt-0.5">{c.installmentsPaid}/{c.installments} parcelas pagas</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Assinou em</p>
                    <p className="text-sm font-medium text-gray-700">{new Date(c.signedAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>

                {/* Info de aniversário */}
                {ann && c.status === "ACTIVE" && (
                  <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {ann.monthsActive} {ann.monthsActive === 1 ? "mês" : "meses"} de contrato
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      próximo aniversário em {ann.daysUntilNextAnniversary === 0 ? "hoje" : `${ann.daysUntilNextAnniversary} dias`}
                    </span>
                    {ann.nextMilestone && (
                      <span className="flex items-center gap-1 text-violet-500">
                        <TrendingUp className="w-3 h-3" />
                        marco de {ann.nextMilestone} meses em {ann.monthsToNextMilestone} {ann.monthsToNextMilestone === 1 ? "mês" : "meses"}
                      </span>
                    )}
                  </div>
                )}
                {c.notes && (
                  <p className="mt-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">{c.notes}</p>
                )}
                {c.status === "CANCELLED" && (c as any).cancellationReason && (
                  <div className="mt-2 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <span className="font-medium text-red-600">Motivo: </span>
                    <span className="text-red-500">{(c as any).cancellationReason}</span>
                    {(c as any).cancelledAt && (
                      <span className="text-red-400 ml-2">· {new Date((c as any).cancelledAt).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                )}
                {c.status === "ACTIVE" && (
                  <button
                    onClick={() => setCancelModal({ id: c.id, name: c.clientName })}
                    className="mt-3 text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
                  >
                    Cancelar contrato
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
