"use client";

import { useEffect, useCallback } from "react";

const API = "";

function fmt(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function showNotification(title: string, body: string, type: "success" | "warning") {
  // Notificação do browser se permitida
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.svg" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") new Notification(title, { body, icon: "/favicon.svg" });
      });
    }
  }

  // Toast visual na página
  const toast = document.createElement("div");
  const color = type === "success" ? "#10B981" : "#EF9F27";
  toast.innerHTML = `
    <div style="
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: white; border-radius: 12px; padding: 14px 18px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12); border-left: 4px solid ${color};
      max-width: 320px; animation: slideIn 0.3s ease;
    ">
      <p style="font-weight: 600; font-size: 14px; color: #111; margin: 0 0 4px">${title}</p>
      <p style="font-size: 13px; color: #666; margin: 0">${body}</p>
    </div>
    <style>@keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }</style>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

export function useAsaasNotifications() {
  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    // SSE com token via query param
    const url = `${API}/api/v1/notifications/stream?token=${token}`;
    const es = new EventSource(url);

    es.addEventListener("payment_received", (e) => {
      try {
        const data = JSON.parse(e.data);
        showNotification(
          `💰 Pagamento recebido!`,
          `${data.customerName} pagou ${fmt(data.value)}`,
          "success"
        );
      } catch {}
    });

    es.addEventListener("payment_overdue", (e) => {
      try {
        const data = JSON.parse(e.data);
        showNotification(
          `⚠️ Pagamento em atraso`,
          `${data.customerName} — ${fmt(data.value)} vencido`,
          "warning"
        );
      } catch {}
    });

    es.onerror = () => {
      es.close();
      // Reconecta em 30 segundos
      setTimeout(connect, 30000);
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);
}
