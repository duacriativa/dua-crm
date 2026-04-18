"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Smartphone, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const QR_EXPIRY_SECONDS = 40;

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "loading";

export default function WhatsAppPage() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("dua-criativa");
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [qrCountdown, setQrCountdown] = useState(QR_EXPIRY_SECONDS);
  const qrRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectRef = useRef<(silent?: boolean) => Promise<void>>(() => Promise.resolve());

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/whatsapp/status`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStatus(data.connected ? "connected" : "disconnected");
      if (data.connected) setQrCode(null);
    } catch {
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Polling a cada 3s quando QR code está visível
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/whatsapp/status`, { headers });
        const data = await res.json();
        if (data.connected) {
          setStatus("connected");
          setQrCode(null);
          setPolling(false);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [polling]);

  const stopQrRefresh = useCallback(() => {
    if (qrRefreshRef.current) {
      clearInterval(qrRefreshRef.current);
      qrRefreshRef.current = null;
    }
  }, []);

  const connectWhatsApp = useCallback(async (silent = false) => {
    if (!silent) setError("");
    if (!silent) setStatus("connecting");
    stopQrRefresh();
    try {
      const res = await fetch(`${API_URL}/api/v1/whatsapp/connect`, {
        method: "POST",
        headers,
        body: JSON.stringify({ instanceName }),
      });
      const data = await res.json();
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setQrCountdown(QR_EXPIRY_SECONDS);
        setPolling(true);
        // Auto-refresh removido para evitar que a requisição cancele o pareamento
        qrRefreshRef.current = setInterval(() => {
          setQrCountdown((c) => {
            if (c <= 1) {
              if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      } else if (data.connected) {
        setStatus("connected");
        stopQrRefresh();
      } else {
        throw new Error(data.message || "Erro ao gerar QR code");
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.message || "Não foi possível conectar. Tente novamente.");
        setStatus("disconnected");
      }
    }
  }, [instanceName, stopQrRefresh]);

  // Mantém a ref sempre atualizada com a versão mais recente da função
  useEffect(() => { connectRef.current = connectWhatsApp; }, [connectWhatsApp]);

  useEffect(() => () => stopQrRefresh(), [stopQrRefresh]);

  const disconnectWhatsApp = async () => {
    stopQrRefresh();
    try {
      await fetch(`${API_URL}/api/v1/whatsapp/disconnect`, { method: "POST", headers });
      setStatus("disconnected");
      setQrCode(null);
      setPolling(false);
    } catch {
      setError("Erro ao desconectar.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business</h1>
          <p className="text-gray-500 mt-1">Conecte seu WhatsApp via QR code para enviar e receber mensagens</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                status === "connected" ? "bg-green-100" :
                status === "connecting" ? "bg-orange-100" : "bg-gray-100"
              }`}>
                <Smartphone className={`w-6 h-6 ${
                  status === "connected" ? "text-green-600" :
                  status === "connecting" ? "text-orange-500" : "text-gray-400"
                }`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {status === "connected" ? "WhatsApp Conectado" :
                   status === "connecting" ? "Aguardando leitura..." :
                   status === "loading" ? "Verificando..." : "Não conectado"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {status === "connected" ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-xs text-green-600 font-medium">Online e recebendo mensagens</span></>
                  ) : status === "connecting" ? (
                    <><RefreshCw className="w-3.5 h-3.5 text-orange-500 animate-spin" /><span className="text-xs text-orange-500">Escaneie o QR code com seu celular</span></>
                  ) : (
                    <><WifiOff className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">Desconectado</span></>
                  )}
                </div>
              </div>
            </div>

            {status === "connected" ? (
              <button
                onClick={disconnectWhatsApp}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
              >
                Desconectar
              </button>
            ) : status !== "connecting" && status !== "loading" ? (
              <button
                onClick={() => connectWhatsApp(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
              >
                Conectar
              </button>
            ) : null}
          </div>
        </div>

        {/* QR Code */}
        {qrCode && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 mb-6 text-center">
            <h2 className="font-semibold text-gray-900 mb-2">Escaneie o QR Code</h2>
            <p className="text-sm text-gray-500 mb-6">Abra o WhatsApp no seu celular → Dispositivos conectados → Conectar dispositivo</p>
            <div className="flex justify-center">
              <img
                src={qrCode}
                alt="QR Code WhatsApp"
                className="w-64 h-64 rounded-2xl border border-gray-100"
              />
            </div>
            <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              QR renova automaticamente em {qrCountdown}s
            </p>
            <button
              onClick={() => connectWhatsApp(false)}
              className="mt-4 px-4 py-2 text-sm font-medium text-orange-600 border border-orange-200 rounded-xl hover:bg-orange-50 transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Gerar novo QR code
            </button>
          </div>
        )}

        {/* Connected success */}
        {status === "connected" && (
          <div className="bg-green-50 border border-green-100 rounded-3xl p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-green-800">WhatsApp conectado com sucesso!</p>
            <p className="text-sm text-green-600 mt-1">Agora você pode enviar e receber mensagens pelo CRM.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Instructions */}
        {status === "disconnected" && !qrCode && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Como conectar</h3>
            <ol className="space-y-3">
              {[
                "Clique em \"Conectar\" acima",
                "Um QR code vai aparecer",
                "Abra o WhatsApp no seu celular",
                "Vá em Dispositivos conectados → Conectar dispositivo",
                "Escaneie o QR code",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
