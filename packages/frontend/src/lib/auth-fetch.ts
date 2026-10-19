/**
 * Sessão do CRM no navegador: access token curto + refresh token rotativo.
 * O backend troca o refresh token a cada uso, então várias requisições que
 * recebem 401 ao mesmo tempo precisam esperar UM único refresh.
 */
let refreshing: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) return null;
        const res = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.accessToken) return null;
        localStorage.setItem("access_token", data.accessToken);
        if (data.refreshToken) localStorage.setItem("refresh_token", data.refreshToken);
        return data.accessToken as string;
      } catch {
        return null;
      }
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

export function endSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  if (typeof window !== "undefined" && window.location.pathname !== "/login") window.location.href = "/login";
}

/**
 * fetch para a API com o token atual; se vier 401 (token vencido),
 * renova a sessão e repete a requisição uma vez.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const withToken = (token: string | null): RequestInit => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return { ...init, headers };
  };

  const res = await fetch(input, withToken(localStorage.getItem("access_token")));
  if (res.status !== 401) return res;

  const token = await refreshAccessToken();
  if (!token) { endSession(); return res; }
  return fetch(input, withToken(token));
}
