import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
// Só leitura: investimento e resultados dos anúncios. Nada é criado ou alterado na conta.
const SCOPE = 'ads_read';
const STATE_TTL_MS = 15 * 60_000;
const RENEW_BEFORE_MS = 10 * 24 * 3600_000; // renova o token quando faltarem 10 dias
const CACHE_MS = 10 * 60_000;

// Mesmo critério do DUA LAB (lib/integrations/meta.ts): o Meta devolve o mesmo evento por vários
// ângulos (pixel, CAPI, agrupado...). Pega UM action_type canônico por prioridade, nunca soma.
const LEAD_ACTIONS = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];
const CONVERSATION_ACTIONS = ['onsite_conversion.messaging_conversation_started_7d'];

/** O que fica (criptografado) em Integration.config do tipo META_ADS. */
interface MetaAdsConfig {
  accessToken: string;
  expiresAt: string;
  accountId?: string; // sem o prefixo act_
  accountName?: string;
  currency?: string;
  userName?: string;
  connectedAt?: string;
}

export interface MetaAdsDay {
  date: string; // YYYY-MM-DD no fuso da conta de anúncios
  spend: number;
  leads: number; // formulário/pixel de lead
  conversations: number; // conversas iniciadas (anúncio para WhatsApp)
}

export interface MetaAdsInsights {
  spend: number;
  leads: number;
  conversations: number;
  results: number; // leads + conversas: o "Leads Meta" do dashboard
  days: MetaAdsDay[];
}

type Action = { action_type: string; value: string };

function pick(actions: Action[] | undefined, priority: string[]) {
  if (!actions) return 0;
  for (const t of priority) {
    const hit = actions.find((a) => a.action_type === t);
    if (hit) return Number(hit.value ?? 0);
  }
  return 0;
}

/**
 * Conexão OAuth com o Meta Ads (Facebook Login + Marketing API, escopo ads_read) e leitura dos
 * insights da conta de anúncios. Padrão do DUA LAB: o Meta não tem refresh token, então o token
 * curto vira long-lived (~60 dias) e é trocado por um novo perto de vencer.
 */
@Injectable()
export class MetaAdsService {
  private readonly logger = new Logger(MetaAdsService.name);
  private cache = new Map<string, { at: number; data: MetaAdsInsights }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // App "dua lab" (o que tem acesso à Marketing API), separado do app do WhatsApp (META_APP_ID)
  private get appId() { return process.env.META_ADS_APP_ID ?? ''; }
  private get appSecret() { return process.env.META_ADS_APP_SECRET ?? ''; }

  isConfigured() { return !!(this.appId && this.appSecret); }

  /** Callbacks aceitos: os da env META_ADS_REDIRECT_URIS (vírgula) ou o padrão de produção + localhost. */
  private checkRedirect(uri: string) {
    const allowed = (process.env.META_ADS_REDIRECT_URIS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const ok = allowed.length
      ? allowed.includes(uri)
      : uri === 'https://crm.duacriativa.com.br/integracoes/meta/callback' || /^http:\/\/localhost:\d+\/integracoes\/meta\/callback$/.test(uri);
    if (!ok) throw new BadRequestException('URL de retorno não autorizada.');
  }

  // ── Conexão ────────────────────────────────────────────────────────────────

  /** state assinado: amarra o retorno do Meta ao tenant que pediu e expira em 15 min. */
  private sign(payload: string) {
    return crypto.createHmac('sha256', process.env.ENCRYPTION_KEY ?? '').update(`meta-ads.${payload}`).digest('hex').slice(0, 32);
  }

  authUrl(tenantId: string, redirectUri: string) {
    if (!this.isConfigured()) throw new BadRequestException('Faltam META_ADS_APP_ID e META_ADS_APP_SECRET no servidor.');
    this.checkRedirect(redirectUri);
    const payload = `${tenantId}.${Date.now()}`;
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      state: `${payload}.${this.sign(payload)}`,
    });
    return `${AUTH_URL}?${params}`;
  }

  private async longLived(shortToken: string) {
    const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: { grant_type: 'fb_exchange_token', client_id: this.appId, client_secret: this.appSecret, fb_exchange_token: shortToken },
    });
    // Sem expires_in = token que não vence (raro); guarda 60 dias para tentar renovar mesmo assim
    const ms = (Number(data.expires_in) || 60 * 24 * 3600) * 1000;
    return { accessToken: data.access_token as string, expiresAt: new Date(Date.now() + ms).toISOString() };
  }

  async connect(tenantId: string, code: string, state: string, redirectUri: string) {
    this.checkRedirect(redirectUri);
    const [stTenant, ts, sig] = (state ?? '').split('.');
    if (stTenant !== tenantId || sig !== this.sign(`${stTenant}.${ts}`) || Date.now() - Number(ts) > STATE_TTL_MS) {
      throw new BadRequestException('Link de autorização inválido ou vencido. Tente conectar de novo.');
    }
    let tokens: { accessToken: string; expiresAt: string };
    try {
      const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
        params: { client_id: this.appId, client_secret: this.appSecret, redirect_uri: redirectUri, code },
      });
      tokens = await this.longLived(data.access_token);
    } catch (e: any) {
      throw new BadRequestException(`O Meta recusou a autorização: ${e.response?.data?.error?.message ?? e.message}`);
    }
    let userName: string | undefined;
    try { ({ data: { name: userName } } = await axios.get(`${GRAPH}/me`, { params: { fields: 'name', access_token: tokens.accessToken } })); } catch {}

    const accounts = await this.fetchAccounts(tokens.accessToken);
    if (!accounts.length) throw new BadRequestException('Essa conta do Facebook não tem acesso a nenhuma conta de anúncios.');
    const only = accounts.length === 1 ? accounts[0] : undefined;
    await this.save(tenantId, {
      ...tokens, userName, connectedAt: new Date().toISOString(),
      accountId: only?.id, accountName: only?.name, currency: only?.currency,
    });
    this.clearCache(tenantId);
    return { connected: true, needsAccount: !only };
  }

  private async fetchAccounts(token: string) {
    const { data } = await axios.get(`${GRAPH}/me/adaccounts`, {
      params: { fields: 'account_id,name,currency,account_status', limit: 200, access_token: token },
    });
    return (data.data ?? []).map((a: any) => ({ id: String(a.account_id), name: String(a.name), currency: a.currency, active: a.account_status === 1 }));
  }

  /** Contas de anúncios que o usuário conectado enxerga (para escolher quando há mais de uma). */
  async accounts(tenantId: string) {
    const token = await this.token(tenantId);
    if (!token) throw new BadRequestException('Meta Ads não conectado.');
    return this.fetchAccounts(token);
  }

  async selectAccount(tenantId: string, accountId: string) {
    const cfg = await this.config(tenantId);
    if (!cfg) throw new BadRequestException('Meta Ads não conectado.');
    const acc = (await this.accounts(tenantId)).find((a: any) => a.id === accountId.replace(/^act_/, ''));
    if (!acc) throw new BadRequestException('Conta de anúncios não encontrada.');
    await this.save(tenantId, { ...cfg, accountId: acc.id, accountName: acc.name, currency: acc.currency });
    this.clearCache(tenantId);
    return { accountId: acc.id, accountName: acc.name };
  }

  async disconnect(tenantId: string) {
    const cfg = await this.config(tenantId);
    // Tira a permissão do app na conta do Facebook; se falhar, apaga do CRM do mesmo jeito
    if (cfg) await axios.delete(`${GRAPH}/me/permissions`, { params: { access_token: cfg.accessToken } }).catch(() => {});
    await this.prisma.integration.deleteMany({ where: { tenantId, type: 'META_ADS' } });
    this.clearCache(tenantId);
  }

  async status(tenantId: string) {
    const cfg = await this.config(tenantId);
    return {
      configured: this.isConfigured(),
      connected: !!cfg,
      accountId: cfg?.accountId ?? null,
      accountName: cfg?.accountName ?? null,
      userName: cfg?.userName ?? null,
      expiresAt: cfg?.expiresAt ?? null,
    };
  }

  private async save(tenantId: string, cfg: MetaAdsConfig) {
    const config = this.encryption.encrypt(JSON.stringify(cfg));
    await this.prisma.integration.upsert({
      where: { tenantId_type: { tenantId, type: 'META_ADS' } },
      create: { tenantId, type: 'META_ADS', config, active: true },
      update: { config, active: true },
    });
  }

  private async config(tenantId: string): Promise<MetaAdsConfig | null> {
    const row = await this.prisma.integration.findFirst({ where: { tenantId, type: 'META_ADS', active: true } });
    if (!row) return null;
    try { return JSON.parse(this.encryption.decrypt(row.config)); } catch { return null; }
  }

  /** Token válido; troca por um novo long-lived quando faltam menos de 10 dias para vencer. */
  private async token(tenantId: string): Promise<string | null> {
    const cfg = await this.config(tenantId);
    if (!cfg) return null;
    const left = new Date(cfg.expiresAt).getTime() - Date.now();
    if (left <= 0) throw new Error('A conexão com o Meta Ads venceu. Conecte de novo em Configurações → Integrações.');
    if (left < RENEW_BEFORE_MS) {
      try {
        const fresh = await this.longLived(cfg.accessToken);
        await this.save(tenantId, { ...cfg, ...fresh });
        return fresh.accessToken;
      } catch (e: any) {
        this.logger.warn(`[MetaAds] Falha ao renovar token (${tenantId}): ${e.response?.data?.error?.message ?? e.message}`);
      }
    }
    return cfg.accessToken;
  }

  private clearCache(tenantId: string) {
    for (const k of this.cache.keys()) if (k.startsWith(`${tenantId}|`)) this.cache.delete(k);
  }

  // ── Insights ───────────────────────────────────────────────────────────────

  /**
   * Investimento, leads e conversas por dia entre since e until (YYYY-MM-DD, inclusive, no fuso
   * da conta de anúncios). null = Meta Ads não conectado ou sem conta escolhida.
   */
  async insights(tenantId: string, since: string, until: string): Promise<MetaAdsInsights | null> {
    const cfg = await this.config(tenantId);
    if (!cfg?.accountId) return null;
    const key = `${tenantId}|${cfg.accountId}|${since}|${until}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

    const token = await this.token(tenantId);
    if (!token) return null;
    const days: MetaAdsDay[] = [];
    let url: string | null = `${GRAPH}/act_${cfg.accountId}/insights`;
    let params: Record<string, string> | undefined = {
      level: 'account',
      fields: 'spend,actions',
      time_range: JSON.stringify({ since, until }),
      time_increment: '1',
      limit: '500',
      access_token: token,
    };
    try {
      while (url) {
        const res: { data: any } = await axios.get(url, { params });
        for (const r of res.data.data ?? []) {
          days.push({
            date: r.date_start,
            spend: Number(r.spend ?? 0),
            leads: pick(r.actions, LEAD_ACTIONS),
            conversations: pick(r.actions, CONVERSATION_ACTIONS),
          });
        }
        url = res.data.paging?.next ?? null; // o "next" já traz todos os parâmetros
        params = undefined;
      }
    } catch (e: any) {
      const msg = e.response?.data?.error?.message ?? e.message;
      this.logger.error(`[MetaAds] Insights (${tenantId}): ${msg}`);
      throw new Error(`Meta Ads: ${msg}`);
    }
    const sum = (f: (d: MetaAdsDay) => number) => days.reduce((a, d) => a + f(d), 0);
    const leads = sum((d) => d.leads);
    const conversations = sum((d) => d.conversations);
    const data: MetaAdsInsights = {
      spend: Math.round(sum((d) => d.spend) * 100) / 100,
      leads,
      conversations,
      results: leads + conversations,
      days,
    };
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }
}
