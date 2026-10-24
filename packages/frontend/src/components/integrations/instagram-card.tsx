"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, Copy, Check } from "lucide-react";
import api from "@/lib/api";

interface IgStatus {
  configured: boolean; connected: boolean; webhookPath: string;
  username?: string | null; pageName?: string | null; igUserId?: string;
  missingScopes?: string[] | null; pageSubscribed?: boolean | null;
  subscribedApps?: { id: string; name: string; fields: string[] }[]; subscribedAppsError?: string | null;
  subscribeError?: string | null;
}

const errMsg = (e: any) => {
  const m = e?.response?.data?.message;
  return (Array.isArray(m) ? m[0] : m) || e?.message || "Algo deu errado.";
};

/** Conecta com o token do usuário de sistema que já está no servidor (INSTAGRAM_ACCESS_TOKEN). */
export async function startInstagramConnect(accessToken?: string) {
  return (await api.post("/instagram/connect", accessToken ? { accessToken } : {})).data as IgStatus;
}

/* ── Card do Instagram em Integrações: DMs na caixa de entrada e regras de palavra-chave ── */
export function InstagramCard({ onChange }: { onChange?: () => void } = {}) {
  const [st, setSt] = useState<IgStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api.get("/instagram/status").then((r) => setSt(r.data)).catch((e) => setError(errMsg(e))), []);
  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setBusy(true); setError("");
    try {
      const res = await startInstagramConnect(token.trim() || undefined);
      setSt(res); setToken(""); setShowToken(false); onChange?.();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const disconnect = async () => {
    if (!confirm("Desconectar o Instagram? As DMs param de entrar no CRM e as regras de palavra-chave param de responder.")) return;
    setBusy(true);
    try { await api.delete("/instagram"); await load(); onChange?.(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const webhookUrl = typeof window !== "undefined" && st ? `${window.location.origin}${st.webhookPath}` : "";
  const copy = () => { navigator.clipboard.writeText(webhookUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const others = st?.subscribedApps ?? [];
  return (
    <div className="surface-card p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-xl">📸</div>
          <div>
            <p className="font-semibold text-foreground text-sm">Instagram</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {st?.connected ? `@${st.username ?? "?"}${st.pageName ? ` · ${st.pageName}` : ""}` : "DMs, comentários e stories no CRM"}
            </p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          st?.connected ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
          {st === null ? "Verificando..." : st.connected ? "Conectado" : "Desconectado"}
        </span>
      </div>

      {st?.connected && (
        <div className="space-y-2 mb-3 text-xs">
          {!!st.missingScopes?.length && (
            <p className="flex gap-1.5 text-amber-400"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Faltam permissões no token: {st.missingScopes.join(", ")}. Gere um token novo do usuário de sistema com elas e conecte de novo.</p>
          )}
          {st.pageSubscribed === false && (
            <p className="flex gap-1.5 text-amber-400"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              O app não está inscrito na Página{st.subscribeError ? ` (${st.subscribeError})` : ""}: as DMs não chegam. Clique em "Reconectar".</p>
          )}
          {others.length > 0 && (
            <p className="flex gap-1.5 text-amber-400"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Também recebem os eventos da Página: {others.map((a) => a.name).join(", ")}. Se algum deles responde DMs (ex.: Kommo), desligue lá para não responder em dobro.</p>
          )}
          <div>
            <p className="text-muted-foreground mb-1">Webhook (app da Meta → Instagram → Webhooks):</p>
            <button onClick={copy} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border text-left text-foreground hover:bg-muted/50">
              <span className="truncate flex-1 font-mono text-[11px]">{webhookUrl}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>
      )}
      {st && !st.connected && !st.configured && !showToken && (
        <p className="text-xs text-amber-400 mb-3">Falta INSTAGRAM_ACCESS_TOKEN no servidor: cole o token do usuário de sistema.</p>
      )}
      {(showToken || (st && !st.connected && !st.configured)) && (
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token do usuário de sistema (opcional)"
          className="w-full mb-3 bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      )}
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="flex gap-2 mt-auto">
        <button onClick={connect} disabled={busy}
          className={`flex-1 py-2 text-sm font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 ${
            st?.connected ? "border border-border text-muted-foreground hover:bg-muted/50" : "text-white bg-gradient-primary hover:opacity-90"}`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}{st?.connected ? "Reconectar" : "Conectar Instagram"}
        </button>
        {!showToken && st?.configured && (
          <button onClick={() => setShowToken(true)} className="px-3 py-2 text-xs rounded-xl border border-border text-muted-foreground hover:bg-muted/50">Outro token</button>
        )}
        {st?.connected && (
          <button onClick={disconnect} disabled={busy} className="flex-1 py-2 text-sm font-medium rounded-xl border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50">
            Desconectar
          </button>
        )}
      </div>
    </div>
  );
}
