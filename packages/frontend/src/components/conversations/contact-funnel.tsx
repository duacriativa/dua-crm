"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, KanbanSquare } from "lucide-react";
import api from "@/lib/api";

interface Stage { id: string; name: string; color: string; kind: "OPEN" | "WON" | "LOST" }
interface Pipeline { id: string; name: string; stages: Stage[] }
interface Card { id: string; stageId: string; pipelineId: string; value: number | null }

const errMsg = (e: any) => [].concat(e?.response?.data?.message ?? e?.message ?? "Erro").join(" ");

/** Painel da conversa: em que etapa do funil o contato está, e troca de etapa sem abrir o funil. */
export function ContactFunnel({ contactId, onChanged }: { contactId: string; onChanged?: () => void }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    return api.get(`/pipelines/contact/${contactId}`)
      .then((r) => { setPipelines(r.data.pipelines); setCards(r.data.cards); })
      .catch((e) => { setCards([]); setError(errMsg(e)); });
  }, [contactId]);
  useEffect(() => { setCards(null); load(); }, [load]);

  const stageOf = (id: string) => pipelines.flatMap((p) => p.stages).find((s) => s.id === id);

  const move = async (card: Card, toStageId: string) => {
    if (toStageId === card.stageId) return;
    const to = stageOf(toStageId);
    const extra: { value?: number; lostReason?: string } = {};
    // Ganho/perda: mesmo pedido do funil (valor fechado / motivo)
    if (to?.kind === "WON") {
      const v = prompt(`Valor fechado em R$ (${to.name})`, card.value ? String(card.value).replace(".", ",") : "");
      if (v === null) return;
      const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(n)) extra.value = n;
    } else if (to?.kind === "LOST") {
      const r = prompt(`Motivo da perda (${to.name})`, "");
      if (r === null) return;
      if (r.trim()) extra.lostReason = r.trim();
    }
    setBusy(card.id);
    setError("");
    try {
      await api.patch(`/pipelines/leads/${card.id}/move`, { stageId: toStageId, ...extra });
      await load();
      onChanged?.();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const add = async (stageId: string) => {
    if (!stageId) return;
    setBusy("new");
    setError("");
    try {
      await api.post(`/pipelines/stages/${stageId}/leads`, { contactId });
      await load();
      onChanged?.();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const select = "w-full text-xs font-medium text-gray-800 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-300 disabled:opacity-50";

  return (
    <div className="p-4 border-b border-gray-100 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Funil</p>
        <Link href="/dashboard/funil" className="text-[11px] text-gray-400 hover:text-brand-600 flex items-center gap-1"><KanbanSquare className="w-3 h-3" /> abrir</Link>
      </div>
      {cards === null ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
      ) : cards.length === 0 ? (
        <select value="" disabled={busy === "new"} onChange={(e) => add(e.target.value)} className={select}>
          <option value="">+ Adicionar ao funil…</option>
          {pipelines.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {p.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          ))}
        </select>
      ) : (
        cards.map((card) => {
          const p = pipelines.find((x) => x.id === card.pipelineId);
          const current = stageOf(card.stageId);
          return (
            <div key={card.id} className="space-y-1">
              <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: current?.color }} />
                {p?.name}{card.value ? ` · R$ ${card.value.toLocaleString("pt-BR")}` : ""}
                {busy === card.id && <Loader2 className="w-3 h-3 animate-spin" />}
              </p>
              <select value={card.stageId} disabled={busy === card.id} onChange={(e) => move(card, e.target.value)} className={select}>
                {p?.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          );
        })
      )}
      {cards && cards.length > 0 && (
        <p className="text-[10px] text-gray-400 leading-snug">Etapa com bot (ex.: Oferta Consultoria) dispara a mensagem assim que o card entra.</p>
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
