"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck, CalendarX, Globe, Loader2, Video } from "lucide-react";
import { SlotPicker, fmtDay, fmtTime } from "@/components/scheduling/slot-picker";
import { BookingShell, EventSummary } from "@/components/scheduling/booking-ui";
import { publicApi } from "@/lib/public-api";

interface MeetingInfo {
  title: string; startAt: string; endAt: string; status: string; name: string; email: string;
  meetLink: string | null; slug: string | null; timezone: string; durationMin: number;
}

/** Link do convite: o cliente vê a reunião, remarca ou cancela. */
export default function ManageMeetingPage({ params }: { params: { token: string } }) {
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
  const [canChange, setCanChange] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"" | "rescheduled" | "cancelled">("");
  const [pickerKey, setPickerKey] = useState(0);
  const base = `/manage/${encodeURIComponent(params.token)}`;

  useEffect(() => {
    publicApi<{ meeting: MeetingInfo; canChange: boolean }>(base)
      .then((r) => { setMeeting(r.meeting); setCanChange(r.canChange); })
      .catch(() => setNotFound(true));
  }, [base]);

  const load = useCallback((from: string, to: string) => publicApi(`${base}/slots?from=${from}&to=${to}`), [base]);

  const reschedule = async (iso: string) => {
    setBusy(true); setError("");
    try {
      const m = await publicApi<MeetingInfo>(`${base}/reschedule`, { method: "POST", body: { startAt: iso } });
      setMeeting(m); setDone("rescheduled"); setMode("view");
    } catch (e: any) {
      setError(e.message); setPickerKey((k) => k + 1);
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true); setError("");
    try {
      const m = await publicApi<MeetingInfo>(`${base}/cancel`, { method: "POST", body: { reason } });
      setMeeting(m); setCanChange(false); setDone("cancelled"); setMode("view");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (notFound) {
    return <BookingShell><div className="bg-white rounded-2xl shadow-sm p-10 text-center"><p className="font-semibold">Reunião não encontrada.</p><p className="text-sm text-neutral-500 mt-1">Confira o link do convite.</p></div></BookingShell>;
  }
  if (!meeting) {
    return <BookingShell><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div></BookingShell>;
  }

  const tz = meeting.timezone;
  const when = `${fmtDay(meeting.startAt, tz)}, ${fmtTime(meeting.startAt, tz)} – ${fmtTime(meeting.endAt, tz)}`;
  const cancelled = meeting.status === "CANCELLED";

  return (
    <BookingShell>
      <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 flex flex-col md:flex-row gap-6">
        <EventSummary page={{ title: meeting.title, description: null, durationMin: meeting.durationMin, hostName: "Dua Criativa" }} />
        <div className="flex-1 min-w-0">
          {mode === "reschedule" ? (
            <>
              <button onClick={() => { setMode("view"); setError(""); }} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-4">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
              <h2 className="text-lg font-bold mb-1">Escolha o novo horário</h2>
              <p className="text-sm text-neutral-500 mb-4 first-letter:uppercase">Atual: {when}</p>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <SlotPicker key={pickerKey} load={load} onConfirm={reschedule} confirmLabel="Remarcar" busy={busy} />
            </>
          ) : (
            <div className="max-w-md">
              {done === "rescheduled" && <p className="mb-4 text-sm font-medium rounded-lg bg-[#B5FB3D]/30 px-3 py-2">Pronto! Reunião remarcada. O convite foi atualizado no seu e-mail.</p>}
              {done === "cancelled" && <p className="mb-4 text-sm font-medium rounded-lg bg-neutral-100 px-3 py-2">Reunião cancelada. Avisamos a equipe da Dua.</p>}
              <h2 className="text-lg font-bold">{cancelled ? "Reunião cancelada" : "Sua reunião"}</h2>
              <div className={`mt-4 rounded-xl border border-neutral-200 p-4 text-sm space-y-2 ${cancelled ? "opacity-60 line-through" : ""}`}>
                <p className="flex items-center gap-2"><CalendarCheck className="w-4 h-4 shrink-0" /><span className="first-letter:uppercase">{when}</span></p>
                <p className="flex items-center gap-2 text-neutral-600"><Globe className="w-4 h-4 shrink-0" /> Horário de Brasília</p>
                {meeting.meetLink && !cancelled && (
                  <p className="flex items-center gap-2"><Video className="w-4 h-4 shrink-0" />
                    <a href={meeting.meetLink} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{meeting.meetLink.replace("https://", "")}</a></p>
                )}
              </div>

              {canChange && mode === "view" && (
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button onClick={() => { setMode("reschedule"); setDone(""); }} className="px-5 py-2.5 rounded-full text-sm font-bold bg-neutral-900 text-[#B5FB3D] hover:bg-black">Remarcar</button>
                  <button onClick={() => { setMode("cancel"); setDone(""); }} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-neutral-300 hover:border-neutral-900">Cancelar reunião</button>
                </div>
              )}
              {mode === "cancel" && (
                <div className="mt-6 space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium">Quer contar o motivo? (opcional)</span>
                    <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                      className="mt-1 w-full px-3 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 resize-none" />
                  </label>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="flex gap-3">
                    <button onClick={cancel} disabled={busy} className="px-5 py-2.5 rounded-full text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarX className="w-4 h-4" />} Confirmar cancelamento
                    </button>
                    <button onClick={() => { setMode("view"); setError(""); }} className="px-4 py-2.5 text-sm text-neutral-500">Voltar</button>
                  </div>
                </div>
              )}
              {cancelled && meeting.slug && (
                <a href={`/agendar/${meeting.slug}`} className="inline-block mt-6 px-5 py-2.5 rounded-full text-sm font-bold bg-neutral-900 text-[#B5FB3D]">Agendar outro horário</a>
              )}
              {!canChange && !cancelled && <p className="text-sm text-neutral-500 mt-6">Essa reunião já passou ou não pode mais ser alterada por aqui. Fale com a gente pelo WhatsApp.</p>}
            </div>
          )}
        </div>
      </div>
    </BookingShell>
  );
}
