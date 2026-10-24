"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";

interface MetaAdsStatus {
  configured: boolean; connected: boolean;
  accountId: string | null; accountName: string | null; userName: string | null; expiresAt: string | null;
}
interface AdAccount { id: string; name: string; currency?: string; active: boolean }

const errMsg = (e: any) => {
  const m = e?.response?.data?.message;
  return (Array.isArray(m) ? m[0] : m) || e?.message || "Algo deu errado.";
};

/** Leva para a tela de autorização do Meta (volta em /integracoes/meta/callback). */
export async function startMetaConnect() {
  const redirectUri = `${window.location.origin}/integracoes/meta/callback`;
  const { data } = await api.get("/meta-ads/auth-url", { params: { redirectUri } });
  window.location.href = data.url;
}

/* ── Card do Meta Ads em Integrações: investimento e leads dos anúncios no Dashboard ── */
export function MetaAdsCard({ onChange }: { onChange?: () => void } = {}) {
  const [st, setSt] = useState<MetaAdsStatus | null>(null);
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => api.get("/meta-ads/status").then((r) => setSt(r.data)).catch(() => setSt(null)), []);
  useEffect(() => { load(); }, [load]);

  // Conectado sem conta escolhida (o usuário enxerga mais de uma): lista para escolher
  const choosing = !!st?.connected && (!st.accountId || accounts !== null);
  useEffect(() => {
    if (st?.connected && !st.accountId && accounts === null)
      api.get("/meta-ads/accounts").then((r) => setAccounts(r.data)).catch((e) => setError(errMsg(e)));
  }, [st, accounts]);

  const connect = async () => {
    setBusy(true); setError("");
    try { await startMetaConnect(); } catch (e) { setError(errMsg(e)); setBusy(false); }
  };
  const changeAccount = async () => {
    setBusy(true); setError("");
    try { setAccounts((await api.get("/meta-ads/accounts")).data); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const pick = async (accountId: string) => {
    setBusy(true); setError("");
    // Recarrega o status (já com a conta) antes de fechar a lista; ao contrário, o efeito de cima
    // via "sem conta" por um instante e buscava a lista de novo, deixando-a aberta
    try { await api.post("/meta-ads/account", { accountId }); await load(); setAccounts(null); onChange?.(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const disconnect = async () => {
    if (!confirm("Desconectar o Meta Ads? O Dashboard deixa de mostrar investimento, leads dos anúncios, CAC e ROAS.")) return;
    setBusy(true);
    try { await api.delete("/meta-ads"); await load(); setAccounts(null); onChange?.(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="surface-card p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-xl">📣</div>
          <div>
            <p className="font-semibold text-foreground text-sm">Meta Ads</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {st?.connected ? st.accountName ?? "Escolha a conta de anúncios" : "Investimento e leads dos anúncios (só leitura)"}
            </p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          st?.connected && st.accountId ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
          {st === null ? "Verificando..." : st.connected ? (st.accountId ? "Conectado" : "Falta a conta") : "Desconectado"}
        </span>
      </div>
      {st && !st.configured && <p className="text-xs text-amber-400 mb-3">Faltam META_ADS_APP_ID e META_ADS_APP_SECRET no servidor.</p>}
      {st?.connected && st.userName && !choosing && <p className="text-xs text-muted-foreground mb-3">Conectado por {st.userName}</p>}
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {choosing && (
        <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
          {accounts === null ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando contas…</p>
          ) : accounts.map((a) => (
            <button key={a.id} onClick={() => pick(a.id)} disabled={busy}
              className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors disabled:opacity-50 ${
                a.id === st?.accountId ? "border-primary/50 bg-primary/10 text-foreground" : "border-border hover:bg-muted/50 text-foreground"}`}>
              {a.name} <span className="text-xs text-muted-foreground">· {a.id}{a.active ? "" : " · inativa"}</span>
            </button>
          ))}
        </div>
      )}

      {st?.connected ? (
        <div className="flex gap-2 mt-auto">
          {!choosing && (
            <button onClick={changeAccount} disabled={busy} className="flex-1 py-2 text-sm font-medium rounded-xl border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50">
              Trocar conta
            </button>
          )}
          <button onClick={disconnect} disabled={busy} className="flex-1 py-2 text-sm font-medium rounded-xl border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50">
            Desconectar
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={busy || (st !== null && !st.configured)}
          className="w-full py-2 mt-auto text-sm font-medium rounded-xl text-white bg-gradient-primary hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Conectar Meta Ads
        </button>
      )}
    </div>
  );
}
