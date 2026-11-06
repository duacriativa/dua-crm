"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ExternalLink, Loader2, RotateCcw, X } from "lucide-react";

/** idle = esperando a conferência (com @ digitado) ou campo vazio (sem @). */
export type SlotState = "idle" | "found" | "confirmed" | "rejected" | "not_found" | "error" | "invalid";
export interface SlotProfile { username: string; name: string | null; followers: number | null; pictureUrl: string | null }
export interface Slot { handle: string; state: SlotState; profile?: SlotProfile | null }

export const emptySlot = (): Slot => ({ handle: "", state: "idle" });

export function normalizeHandle(raw: string) {
  return raw.trim().replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "").split(/[/?#\s]/)[0].replace(/^@/, "").toLowerCase();
}

const fmtFollowers = (n: number) => `${n.toLocaleString("pt-BR")} seguidor${n === 1 ? "" : "es"}`;

function Avatar({ profile }: { profile: SlotProfile }) {
  const [broken, setBroken] = useState(false);
  if (!profile.pictureUrl || broken) {
    return (
      <span className="w-14 h-14 rounded-full bg-neutral-950 text-white font-bold flex items-center justify-center shrink-0 uppercase">
        {(profile.name || profile.username).slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.pictureUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="w-14 h-14 rounded-full object-cover shrink-0 bg-neutral-200" />
  );
}

/** Um campo de @: consulta o Instagram enquanto digita e pergunta se é a marca certa. */
export function BrandSlot({ slot, placeholder, autoFocus, onChange }: {
  slot: Slot;
  placeholder: string;
  autoFocus?: boolean;
  onChange: (patch: Partial<Slot>) => void;
}) {
  const pending = !!slot.handle && slot.state === "idle";

  useEffect(() => {
    if (!pending) return;
    if (!/^[a-z0-9._]{1,30}$/.test(slot.handle)) { onChange({ state: "invalid" }); return; }
    let stale = false;
    const timer = setTimeout(() => {
      fetch(`/api/v1/public/plano/instagram/${encodeURIComponent(slot.handle)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (stale) return;
          if (d.status === "found") onChange({ state: "found", profile: d });
          else if (d.status === "not_found") onChange({ state: "not_found" });
          else if (d.status === "invalid") onChange({ state: "invalid" });
          else onChange({ state: "error" });
        })
        .catch(() => { if (!stale) onChange({ state: "error" }); });
    }, 700);
    return () => { stale = true; clearTimeout(timer); };
    // onChange muda a cada render; o que dispara a consulta é o @ e o estado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.handle, slot.state]);

  const p = slot.profile;
  const igUrl = `https://www.instagram.com/${p?.username ?? slot.handle}/`;
  const ok = slot.state === "confirmed";

  return (
    <div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">@</span>
        <input
          aria-label={placeholder}
          autoFocus={autoFocus}
          value={slot.handle}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => onChange({ handle: normalizeHandle(e.target.value), state: "idle", profile: null })}
          className={`w-full pl-8 pr-11 py-3.5 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900 placeholder:text-neutral-400 ${ok ? "border-emerald-500" : "border-neutral-300"}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex">
          {pending && <Loader2 aria-label="Conferindo" className="w-5 h-5 animate-spin text-neutral-400" />}
          {ok && <CheckCircle2 aria-label="Confirmado" className="w-5 h-5 text-emerald-600" />}
          {!pending && !ok && slot.handle && (
            <button type="button" aria-label={`Apagar @${slot.handle}`} onClick={() => onChange({ handle: "", state: "idle", profile: null })} className="text-neutral-400 hover:text-neutral-900 p-0.5">
              <X className="w-4 h-4" />
            </button>
          )}
        </span>
      </div>

      {pending && <p className="mt-1.5 text-xs text-neutral-500">Conferindo no Instagram...</p>}

      {slot.state === "invalid" && (
        <p className="mt-1.5 text-sm text-red-700">O @ só pode ter letras, números, ponto e sublinhado.</p>
      )}

      {(slot.state === "found" || ok) && p && (
        <div className={`mt-2 rounded-xl border p-3 ${ok ? "border-emerald-200 bg-emerald-50/60" : "border-neutral-300 bg-white"}`}>
          <div className="flex items-center gap-3">
            <Avatar profile={p} />
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight truncate">{p.name || `@${p.username}`}</p>
              <p className="text-sm text-neutral-600 truncate">@{p.username}</p>
              {p.followers !== null && <p className="text-sm text-neutral-600">{fmtFollowers(p.followers)}</p>}
            </div>
            <a href={igUrl} target="_blank" rel="noreferrer" aria-label="Abrir perfil no Instagram" className="p-2 text-neutral-500 hover:text-neutral-900 shrink-0">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          {ok ? (
            <p className="mt-2 text-sm font-semibold text-emerald-700">Marca confirmada</p>
          ) : (
            <div className="mt-3">
              <p className="font-semibold text-sm">É essa marca?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onChange({ state: "confirmed" })}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800">
                  <Check className="w-4 h-4" /> Sim, é essa
                </button>
                <button type="button" onClick={() => onChange({ state: "rejected" })}
                  className="py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold hover:border-neutral-900">
                  Não é essa
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {slot.state === "rejected" && (
        <p className="mt-2 text-sm text-red-700">Sem problema. Abra o perfil certo no Instagram, copie o @ e corrija aqui, ou apague este campo.</p>
      )}

      {(slot.state === "not_found" || slot.state === "error") && (
        <div className="mt-2 rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm text-amber-950">
          <p className="flex gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {slot.state === "not_found" ? `Não encontramos @${slot.handle}.` : "Não conseguimos consultar o Instagram agora."}
          </p>
          <p className="mt-1">
            {slot.state === "not_found" ? "Confira se o @ está certo. Contas pessoais ou privadas também não aparecem nesta consulta. " : ""}
            Você pode seguir: esse @ fica como <b>não confirmado</b> e a equipe da Dua revisa.
          </p>
          {slot.state === "error" && (
            <button type="button" onClick={() => onChange({ state: "idle" })} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline">
              <RotateCcw className="w-3.5 h-3.5" /> Tentar de novo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
