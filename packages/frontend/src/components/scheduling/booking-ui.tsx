"use client";

import { CalendarCheck, Clock, Globe, Video } from "lucide-react";

export interface PageInfo { slug: string; title: string; description: string | null; durationMin: number; timezone: string; hostName: string | null }

/** (85) 99999-9999 enquanto digita; números de fora com + ficam como estão. */
export function maskPhone(v: string) {
  if (v.trim().startsWith("+")) return v.replace(/[^\d+\s()-]/g, "");
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function BookingShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 flex items-start sm:items-center justify-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-4xl">
        {children}
        <p className="text-center text-[11px] text-neutral-400 mt-4">Agendamento Dua Criativa</p>
      </div>
    </main>
  );
}

export function EventSummary({ page, when }: { page: Pick<PageInfo, "title" | "description" | "durationMin" | "hostName">; when?: string }) {
  return (
    <div className="md:w-72 shrink-0 md:border-r border-neutral-200 md:pr-6 pb-5 md:pb-0 border-b md:border-b-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon.svg" alt="Dua" className="w-10 h-10 rounded-lg mb-4" />
      {page.hostName && <p className="text-sm font-medium text-neutral-500">{page.hostName}</p>}
      <h1 className="text-xl font-bold leading-tight mt-0.5">{page.title}</h1>
      <div className="mt-4 space-y-2.5 text-sm text-neutral-600">
        <p className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" /> {page.durationMin} min</p>
        <p className="flex items-center gap-2"><Video className="w-4 h-4 shrink-0" /> Google Meet</p>
        {when && <p className="flex items-start gap-2 font-medium text-neutral-900"><CalendarCheck className="w-4 h-4 shrink-0 mt-0.5" /> <span className="first-letter:uppercase">{when}</span></p>}
        <p className="flex items-center gap-2"><Globe className="w-4 h-4 shrink-0" /> Horário de Brasília</p>
      </div>
      {page.description && <p className="text-sm text-neutral-600 mt-4 whitespace-pre-line leading-relaxed">{page.description}</p>}
    </div>
  );
}

