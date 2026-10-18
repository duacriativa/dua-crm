"use client";

import { useEffect, useState } from "react";
import { Bell, X, Share } from "lucide-react";

const API_URL = "";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "hidden" | "ask" | "install-ios" | "working";

/**
 * Registra o service worker e oferece ativar notificações push neste aparelho.
 * No iPhone, push só funciona com o CRM instalado na Tela de Início.
 */
export function PushPrompt() {
  const [state, setState] = useState<State>("hidden");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});

    let dismissed = false;
    try { dismissed = localStorage.getItem("push_prompt_dismissed") === "1"; } catch {}
    if (dismissed) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    if (isIOS && !standalone) { setState("install-ios"); return; }
    if (!("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission === "default") { setState("ask"); return; }
    if (Notification.permission === "granted") {
      // Já permitido: garante que este aparelho está inscrito no backend
      subscribe(true).catch(() => {});
    }
  }, []);

  const subscribe = async (silent = false) => {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await fetch(`${API_URL}/api/v1/push/public-key`, { headers: authHeaders() }).then((r) => r.json());
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    }
    await fetch(`${API_URL}/api/v1/push/subscribe`, { method: "POST", headers: authHeaders(), body: JSON.stringify(sub.toJSON()) });
    if (!silent) await fetch(`${API_URL}/api/v1/push/test`, { method: "POST", headers: authHeaders() });
  };

  const enable = async () => {
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") { await subscribe(); setState("hidden"); }
      else setState("hidden");
    } catch {
      alert("Não foi possível ativar as notificações neste aparelho.");
      setState("ask");
    }
  };

  const dismiss = () => {
    try { localStorage.setItem("push_prompt_dismissed", "1"); } catch {}
    setState("hidden");
  };

  if (state === "hidden") return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20 text-sm">
      {state === "install-ios" ? (
        <>
          <Share className="w-4 h-4 text-primary shrink-0" />
          <p className="flex-1 text-foreground/90 text-xs sm:text-sm">
            Para receber notificações no iPhone: toque em <b>Compartilhar</b> e depois <b>Adicionar à Tela de Início</b>. Abra o CRM pelo ícone.
          </p>
        </>
      ) : (
        <>
          <Bell className="w-4 h-4 text-primary shrink-0" />
          <p className="flex-1 text-foreground/90 text-xs sm:text-sm">Receba um aviso neste aparelho quando chegar mensagem no WhatsApp.</p>
          <button onClick={enable} disabled={state === "working"}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 shrink-0">
            {state === "working" ? "Ativando..." : "Ativar notificações"}
          </button>
        </>
      )}
      <button onClick={dismiss} className="p-1 rounded-md text-muted-foreground hover:bg-muted/50 shrink-0" aria-label="Fechar">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
