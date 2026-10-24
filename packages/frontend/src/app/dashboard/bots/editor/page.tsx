"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReactFlowProvider } from "reactflow";
import { Loader2 } from "lucide-react";
import { Bot, botsApi } from "@/components/bots/bot-api";
import { BotEditor } from "@/components/bots/bot-editor";

/** Editor visual de um bot: /dashboard/bots/editor?id=… (aberto pela engrenagem na lista de bots). */
function EditorPage() {
  const id = useSearchParams().get("id");
  const [bot, setBot] = useState<Bot | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const found = (await botsApi.list()).find((b) => b.id === id) ?? null;
      if (!found) setError("Bot não encontrado.");
      setBot(found);
      return found;
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!bot) {
    return (
      <div className="fixed inset-0 z-40 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
        {error || <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <BotEditor bot={bot} onSaved={load} />
    </ReactFlowProvider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EditorPage />
    </Suspense>
  );
}
