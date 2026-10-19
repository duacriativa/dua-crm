"use client";
import { authFetch } from "@/lib/auth-fetch";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldCheck, KeyRound } from "lucide-react";

const API_URL = "";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

declare global {
  interface Window { FB?: any; fbAsyncInit?: () => void; }
}

interface CloudConfig { appId: string | null; configId: string | null; graphVersion: string; ready: boolean; }

function loadFacebookSdk(appId: string, version: string): Promise<void> {
  return new Promise((resolve) => {
    if (window.FB) { resolve(); return; }
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/pt_BR/sdk.js";
    s.async = true; s.defer = true; s.crossOrigin = "anonymous";
    document.body.appendChild(s);
  });
}

/**
 * Conecta o WhatsApp da empresa pela API oficial da Meta via Embedded Signup,
 * no modo Coexistência (o número continua funcionando no app WhatsApp Business).
 */
export function CloudConnect({ onConnected }: { onConnected: () => void }) {
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ wabaId: "", accessToken: "" });
  const sessionInfo = useRef<{ phoneNumberId?: string; wabaId?: string }>({});

  useEffect(() => {
    authFetch(`${API_URL}/api/v1/whatsapp-cloud/config`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setConfig)
      .catch(() => setConfig(null));

    // O Embedded Signup devolve phone_number_id e waba_id via postMessage
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event?.startsWith("FINISH")) {
          sessionInfo.current = { phoneNumberId: data.data?.phone_number_id, wabaId: data.data?.waba_id };
        } else if (data.event === "CANCEL") {
          setError(data.data?.current_step ? `Cadastro cancelado na etapa: ${data.data.current_step}` : "Cadastro cancelado.");
        } else if (data.event === "ERROR") {
          setError(data.data?.error_message || "Erro no cadastro da Meta.");
        }
      } catch { /* mensagens não-JSON do SDK */ }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const finish = async (code: string) => {
    // O postMessage pode chegar alguns ms depois do callback do login
    for (let i = 0; i < 20 && !sessionInfo.current.phoneNumberId; i++) await new Promise((r) => setTimeout(r, 250));
    // Sem os IDs o backend descobre a conta e o número pelo token
    const { phoneNumberId, wabaId } = sessionInfo.current;
    try {
      const res = await authFetch(`${API_URL}/api/v1/whatsapp-cloud/embedded-signup`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ code, phoneNumberId, wabaId, coexistence: true, redirectUri: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.message || "Falha ao concluir a conexão."); return; }
      onConnected();
    } catch {
      setError("Erro de rede ao concluir a conexão.");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!config?.ready || !config.appId) return;
    setError(null);
    setBusy(true);
    sessionInfo.current = {};
    await loadFacebookSdk(config.appId, config.graphVersion);
    window.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        if (code) finish(code);
        else { setBusy(false); setError((prev) => prev ?? "Login na Meta não concluído."); }
      },
      {
        config_id: config.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      },
    );
  };

  const connectManual = async () => {
    if (!manual.wabaId.trim() || !manual.accessToken.trim()) { setError("Preencha o ID da conta e o token."); return; }
    setError(null);
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/whatsapp-cloud/manual`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ wabaId: manual.wabaId.trim(), accessToken: manual.accessToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.message || "Falha ao conectar."); return; }
      setManual({ wabaId: "", accessToken: "" });
      onConnected();
    } catch {
      setError("Erro de rede ao conectar.");
    } finally {
      setBusy(false);
    }
  };

  if (!config) return null;

  return (
    <div className="w-full">
      <button onClick={start} disabled={!config.ready || busy}
        className="w-full py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold text-white bg-[#25D366] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
        {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
        Conectar API oficial (coexistência)
      </button>
      <p className="text-[11px] text-muted-foreground mt-2">
        {config.ready
          ? "Seu número continua no app WhatsApp Business do celular e as conversas chegam aqui."
          : "Falta configurar META_APP_ID, META_APP_SECRET e META_CONFIG_ID no backend."}
      </p>
      <button onClick={() => setShowManual((v) => !v)}
        className="mt-3 flex items-center justify-center gap-1.5 w-full text-xs font-medium text-muted-foreground hover:text-foreground">
        <KeyRound className="w-3.5 h-3.5" /> Conectar conta existente com token
      </button>
      {showManual && (
        <div className="mt-3 space-y-2 text-left">
          <input value={manual.wabaId} onChange={(e) => setManual((m) => ({ ...m, wabaId: e.target.value }))}
            placeholder="ID da conta do WhatsApp (WABA)" inputMode="numeric"
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input value={manual.accessToken} onChange={(e) => setManual((m) => ({ ...m, accessToken: e.target.value }))}
            placeholder="Token do usuário do sistema" type="password" autoComplete="off"
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <button onClick={connectManual} disabled={busy}
            className="w-full py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50">
            {busy ? "Conectando..." : "Conectar"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
    </div>
  );
}
