"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck, Globe, Loader2, Video } from "lucide-react";
import { SlotPicker, fmtDay, fmtTime } from "@/components/scheduling/slot-picker";
import { publicApi } from "@/lib/public-api";
import { BookingShell, EventSummary, PageInfo, maskPhone } from "@/components/scheduling/booking-ui";

interface Booked { meeting: { startAt: string; endAt: string; meetLink: string | null; email: string; timezone: string }; manageToken: string }

const inp = "w-full px-3 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900 placeholder:text-neutral-400";

export default function BookingPage({ params }: { params: { slug: string } }) {
  const [page, setPage] = useState<PageInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<Booked | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  useEffect(() => {
    publicApi<PageInfo>(`/${encodeURIComponent(params.slug)}`)
      .then((p) => { setPage(p); document.title = `${p.title} | Dua Criativa`; })
      .catch(() => setNotFound(true));
  }, [params.slug]);

  const load = useCallback(
    (from: string, to: string) => publicApi(`/${encodeURIComponent(params.slug)}/slots?from=${from}&to=${to}`),
    [params.slug],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot) return;
    setSending(true); setError("");
    try {
      const res = await publicApi<Booked>(`/${encodeURIComponent(params.slug)}/book`, { method: "POST", body: { startAt: slot, ...form } });
      setBooked(res);
    } catch (err: any) {
      setError(err.message);
      // Horário tomado por outra pessoa: volta para a escolha com a lista atualizada
      if (err.status === 409 && /horário/i.test(err.message)) { setSlot(null); setPickerKey((k) => k + 1); }
    } finally {
      setSending(false);
    }
  };

  if (notFound) {
    return <BookingShell><div className="bg-white rounded-2xl shadow-sm p-10 text-center"><p className="font-semibold">Página de agendamento não encontrada.</p><p className="text-sm text-neutral-500 mt-1">Confira o link que você recebeu.</p></div></BookingShell>;
  }
  if (!page) {
    return <BookingShell><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div></BookingShell>;
  }

  const tz = page.timezone;
  const when = slot ? `${fmtDay(slot, tz)}, ${fmtTime(slot, tz)}` : undefined;

  if (booked) {
    const m = booked.meeting;
    return (
      <BookingShell>
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10 max-w-lg mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-[#B5FB3D] flex items-center justify-center mx-auto mb-4"><CalendarCheck className="w-6 h-6" /></div>
          <h1 className="text-xl font-bold">Reunião confirmada!</h1>
          <p className="text-sm text-neutral-600 mt-2">Enviamos o convite para <b>{m.email}</b>.</p>
          <div className="mt-6 rounded-xl border border-neutral-200 p-4 text-left text-sm space-y-2">
            <p className="font-semibold">{page.title}</p>
            <p className="flex items-center gap-2 text-neutral-700 first-letter:uppercase"><CalendarCheck className="w-4 h-4 shrink-0" />
              <span className="first-letter:uppercase">{fmtDay(m.startAt, tz)}, {fmtTime(m.startAt, tz)} – {fmtTime(m.endAt, tz)}</span></p>
            <p className="flex items-center gap-2 text-neutral-700"><Globe className="w-4 h-4 shrink-0" /> Horário de Brasília</p>
            {m.meetLink && (
              <p className="flex items-center gap-2"><Video className="w-4 h-4 shrink-0" />
                <a href={m.meetLink} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{m.meetLink.replace("https://", "")}</a></p>
            )}
          </div>
          <a href={`/reuniao/${booked.manageToken}`} className="inline-block mt-5 text-sm text-neutral-500 underline">Precisa remarcar ou cancelar?</a>
        </div>
      </BookingShell>
    );
  }

  return (
    <BookingShell>
      <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 flex flex-col md:flex-row gap-6">
        <EventSummary page={page} when={when} />
        <div className="flex-1 min-w-0">
          {!slot ? (
            <>
              <h2 className="text-lg font-bold mb-4">Escolha o dia e o horário</h2>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <SlotPicker key={pickerKey} load={load} onConfirm={(iso) => { setSlot(iso); setError(""); }} />
            </>
          ) : (
            <form onSubmit={submit} className="max-w-md">
              <button type="button" onClick={() => { setSlot(null); setError(""); }} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-4">
                <ArrowLeft className="w-4 h-4" /> Trocar horário
              </button>
              <h2 className="text-lg font-bold mb-4">Seus dados</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">Nome *</span>
                  <input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inp} mt-1`} autoComplete="name" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">WhatsApp *</span>
                  <input required inputMode="tel" placeholder="(85) 99999-9999" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} className={`${inp} mt-1`} autoComplete="tel" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">E-mail *</span>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inp} mt-1`} autoComplete="email" />
                  <span className="text-xs text-neutral-500">O convite com o link do Google Meet vai para este e-mail.</span>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Quer contar algo antes da reunião?</span>
                  <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inp} mt-1 resize-none`}
                    placeholder="Ex.: @ da sua marca, o que você vende, maior desafio hoje" />
                </label>
              </div>
              {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
              <button type="submit" disabled={sending}
                className="mt-6 w-full sm:w-auto px-6 py-3 rounded-full text-sm font-bold bg-neutral-900 text-[#B5FB3D] hover:bg-black disabled:opacity-60 flex items-center justify-center gap-2">
                {sending && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar reunião
              </button>
            </form>
          )}
        </div>
      </div>
    </BookingShell>
  );
}
