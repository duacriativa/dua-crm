import { Injectable } from '@nestjs/common';

/** Aceita "@loja", "loja" ou URL do perfil e devolve só o username. */
export function normalizeInstagramHandle(raw: string): string {
  const semUrl = raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0];
  return semUrl.replace(/^@/, '').toLowerCase();
}

/** Resultado da conferência rápida de um @ (questionário do plano). */
export type InstagramLookup =
  | { status: 'found'; username: string; name: string | null; followers: number | null; pictureUrl: string | null }
  | { status: 'not_found' }
  | { status: 'error' };

const LOOKUP_TTL_MS = 10 * 60_000;
const LOOKUP_CACHE_MAX = 500;

/** Perfil do Instagram via Graph API (Business Discovery). Usado pela análise e pelo diagnóstico. */
@Injectable()
export class InstagramProfileService {
  private igBusinessId: string | null = null;
  private readonly lookups = new Map<string, { at: number; result: InstagramLookup }>();

  /** Conta do Instagram da Dua, que faz as consultas. Null se o token não enxerga nenhuma. */
  private async businessId(graph: string, token: string) {
    if (this.igBusinessId) return this.igBusinessId;
    this.igBusinessId = process.env.INSTAGRAM_BUSINESS_ID || null;
    if (!this.igBusinessId) {
      const r = await fetch(`${graph}/me/accounts?fields=instagram_business_account&access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(15000) });
      const pages: any = await r.json();
      this.igBusinessId = pages.data?.find((p: any) => p.instagram_business_account)?.instagram_business_account?.id ?? null;
    }
    return this.igBusinessId;
  }

  /**
   * Foto, nome e seguidores de um @, para a cliente confirmar se é a marca certa. Nunca lança erro.
   * `username` precisa vir validado. O formulário público chama isto a cada @ digitado: guarda o
   * resultado por 10 min para não gastar a cota da API; erro não fica guardado, para poder tentar de novo.
   */
  async lookup(username: string): Promise<InstagramLookup> {
    const hit = this.lookups.get(username);
    if (hit && Date.now() - hit.at < LOOKUP_TTL_MS) return hit.result;

    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) return { status: 'error' };
    const graph = 'https://graph.facebook.com/v21.0';
    try {
      const id = await this.businessId(graph, token);
      if (!id) return { status: 'error' };
      const fields = `business_discovery.username(${username}){username,name,followers_count,profile_picture_url}`;
      const r = await fetch(`${graph}/${id}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(8000) });
      const body: any = await r.json();
      const p = body.business_discovery;
      let result: InstagramLookup;
      if (r.ok && p) {
        result = {
          status: 'found', username: p.username ?? username, name: p.name ?? null,
          followers: p.followers_count ?? null, pictureUrl: p.profile_picture_url ?? null,
        };
      } else {
        const msg: string = body.error?.error_user_msg || body.error?.message || '';
        if (!/cannot be found|invalid user id|not.*business/i.test(msg)) {
          console.warn(`[Instagram] Conferência de @ falhou: ${msg.slice(0, 200) || `HTTP ${r.status}`}`);
          return { status: 'error' };
        }
        result = { status: 'not_found' };
      }
      if (this.lookups.size >= LOOKUP_CACHE_MAX) this.lookups.clear();
      this.lookups.set(username, { at: Date.now(), result });
      return result;
    } catch (err: any) {
      console.warn(`[Instagram] Conferência de @ falhou: ${err.message}`);
      return { status: 'error' };
    }
  }

  /**
   * Busca bio, números e últimos posts de um perfil comercial/criador via Business Discovery
   * (Graph API), usando o Instagram da Dua. Requer INSTAGRAM_ACCESS_TOKEN (usuário de sistema
   * com instagram_basic + pages_show_list); INSTAGRAM_BUSINESS_ID é opcional.
   * Nunca lança erro: sem dados, devolve o motivo para a IA não inventar.
   */
  async fetch(username: string): Promise<{ data: any | null; reason?: string }> {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) return { data: null, reason: 'integração com o Instagram não configurada' };
    const graph = 'https://graph.facebook.com/v21.0';

    try {
      if (!(await this.businessId(graph, token))) return { data: null, reason: 'conta do Instagram da Dua não encontrada no token' };

      const fields =
        `business_discovery.username(${username}){username,name,biography,website,followers_count,follows_count,media_count,` +
        `media.limit(12){caption,media_type,media_product_type,like_count,comments_count,timestamp}}`;
      const r = await fetch(`${graph}/${this.igBusinessId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(15000) });
      const body: any = await r.json();
      if (!r.ok || !body.business_discovery) {
        const msg: string = body.error?.error_user_msg || body.error?.message || `HTTP ${r.status}`;
        // Perfis pessoais ou inexistentes não são visíveis pelo Business Discovery
        const reason = /cannot be found|invalid user id|not.*business/i.test(msg)
          ? 'perfil pessoal, privado ou inexistente (a API só enxerga contas comerciais e de criador)'
          : `erro na API do Instagram: ${msg.slice(0, 200)}`;
        return { data: null, reason };
      }

      const p = body.business_discovery;
      const posts = (p.media?.data ?? []).map((m: any) => ({
        data: m.timestamp?.slice(0, 10),
        formato: m.media_product_type === 'REELS' ? 'REELS' : m.media_type,
        curtidas: m.like_count,
        comentarios: m.comments_count,
        legenda: (m.caption ?? '').slice(0, 300),
      }));
      const interacoes = posts.reduce((s: number, m: any) => s + (m.curtidas ?? 0) + (m.comentarios ?? 0), 0);
      const engajamento = posts.length && p.followers_count
        ? `${((interacoes / posts.length / p.followers_count) * 100).toFixed(2)}%`
        : null;

      return {
        data: {
          username: p.username, nome: p.name, bio: p.biography, site: p.website,
          seguidores: p.followers_count, seguindo: p.follows_count, total_posts: p.media_count,
          engajamento_medio_por_post: engajamento, ultimos_posts: posts,
        },
      };
    } catch (err: any) {
      return { data: null, reason: `falha ao consultar o Instagram: ${err.message}` };
    }
  }
}
