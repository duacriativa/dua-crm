/** Chamadas sem login (página pública de agendamento). Erros viram Error com a mensagem do backend. */
export async function publicApi<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/v1/public/booking${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    const err = new Error(res.status === 429 ? "Muitas tentativas. Aguarde um minuto." : msg || "Algo deu errado. Tente de novo.");
    (err as any).status = res.status;
    throw err;
  }
  return data as T;
}
