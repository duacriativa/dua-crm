"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

/**
 * Retorno do Google depois de "Conectar Google" (Configurações → Integrações).
 * Troca o code pelo refresh token no backend e volta para Configurações.
 * Esta URL precisa estar nas "URIs de redirecionamento autorizados" do cliente OAuth.
 */
export default function GoogleCallbackPage() {
  const [error, setError] = useState("");
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const q = new URLSearchParams(window.location.search);
    if (q.get("error")) { setError(q.get("error") === "access_denied" ? "Você não autorizou o acesso ao Google Agenda." : `Google: ${q.get("error")}`); return; }
    const redirectUri = `${window.location.origin}/integracoes/google/callback`;
    authFetch("/api/v1/google/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` },
      body: JSON.stringify({ code: q.get("code"), state: q.get("state"), redirectUri }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Não foi possível conectar.");
        window.location.replace("/dashboard/configuracoes?tab=Integra%C3%A7%C3%B5es&google=ok");
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      {error ? (
        <div className="surface-card p-6 max-w-sm text-center">
          <p className="font-semibold">Não deu para conectar o Google</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <a href="/dashboard/configuracoes?tab=Integra%C3%A7%C3%B5es" className="inline-block mt-4 px-4 py-2 text-sm font-semibold text-white bg-gradient-primary rounded-xl">Voltar</a>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Conectando ao Google Agenda…</p>
      )}
    </main>
  );
}
