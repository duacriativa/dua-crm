"use client";

import { TemplatesManager } from "@/components/whatsapp/templates";

export default function ModelosChatPage() {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-background/80 backdrop-blur-xl px-6 py-5 shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Modelos de chat</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Templates do WhatsApp para enviar fora da janela de 24h</p>
      </div>
      <div className="flex-1 overflow-auto scrollbar-none p-6">
        <TemplatesManager />
      </div>
    </div>
  );
}
