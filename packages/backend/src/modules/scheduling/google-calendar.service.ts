import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { Interval } from './availability';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL = 'https://www.googleapis.com/calendar/v3';
// Ler ocupado/livre e criar/alterar os eventos das reuniões; e-mail só para mostrar a conta conectada
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
];
const STATE_TTL_MS = 15 * 60_000;

/** O que fica (criptografado) em Integration.config do tipo GOOGLE. */
interface GoogleConfig {
  refreshToken: string;
  email?: string;
  calendarId?: string; // padrão: "primary"
  connectedAt?: string;
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendee: { email: string; name: string };
}

/**
 * Conexão OAuth com o Google Agenda (conta suporte@duacriativa.com, app "Interno" no Workspace)
 * e chamadas à Calendar API. Usa axios direto: só precisamos de 5 endpoints.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private tokens = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  private get clientId() { return process.env.GOOGLE_CLIENT_ID ?? ''; }
  private get clientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ''; }

  isConfigured() { return !!(this.clientId && this.clientSecret); }

  /** Callbacks aceitos: os da env GOOGLE_REDIRECT_URIS (vírgula) ou o padrão de produção + localhost. */
  private checkRedirect(uri: string) {
    const allowed = (process.env.GOOGLE_REDIRECT_URIS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const ok = allowed.length
      ? allowed.includes(uri)
      : uri === 'https://crm.duacriativa.com.br/integracoes/google/callback' || /^http:\/\/localhost:\d+\/integracoes\/google\/callback$/.test(uri);
    if (!ok) throw new BadRequestException('URL de retorno não autorizada.');
  }

  // ── Conexão ────────────────────────────────────────────────────────────────

  /** state assinado: amarra o retorno do Google ao tenant que pediu e expira em 15 min. */
  private sign(payload: string) {
    return crypto.createHmac('sha256', process.env.ENCRYPTION_KEY ?? '').update(payload).digest('hex').slice(0, 32);
  }

  authUrl(tenantId: string, redirectUri: string) {
    if (!this.isConfigured()) throw new BadRequestException('Faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no servidor.');
    this.checkRedirect(redirectUri);
    const payload = `${tenantId}.${Date.now()}`;
    const state = `${payload}.${this.sign(payload)}`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent', // garante o refresh token mesmo se a conta já autorizou antes
      include_granted_scopes: 'true',
      login_hint: process.env.GOOGLE_LOGIN_HINT ?? 'suporte@duacriativa.com',
      state,
    });
    return `${AUTH_URL}?${params}`;
  }

  async connect(tenantId: string, code: string, state: string, redirectUri: string) {
    this.checkRedirect(redirectUri);
    const [stTenant, ts, sig] = (state ?? '').split('.');
    if (stTenant !== tenantId || sig !== this.sign(`${stTenant}.${ts}`) || Date.now() - Number(ts) > STATE_TTL_MS) {
      throw new BadRequestException('Link de autorização inválido ou vencido. Tente conectar de novo.');
    }
    let data: any;
    try {
      ({ data } = await axios.post(TOKEN_URL, new URLSearchParams({
        code, client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code',
      })));
    } catch (e: any) {
      throw new BadRequestException(`Google recusou a autorização: ${e.response?.data?.error_description ?? e.message}`);
    }
    if (!data.refresh_token) throw new BadRequestException('O Google não devolveu o refresh token. Remova o acesso do app na conta Google e conecte de novo.');
    const granted = String(data.scope ?? '');
    if (!granted.includes('calendar.events') || !granted.includes('calendar.freebusy')) {
      throw new BadRequestException('Marque as permissões do Google Agenda na tela do Google.');
    }
    // id_token veio direto do Google por TLS: só lemos o e-mail
    let email: string | undefined;
    try { email = JSON.parse(Buffer.from(String(data.id_token).split('.')[1], 'base64url').toString()).email; } catch {}

    const cfg: GoogleConfig = { refreshToken: data.refresh_token, email, calendarId: 'primary', connectedAt: new Date().toISOString() };
    const config = this.encryption.encrypt(JSON.stringify(cfg));
    await this.prisma.integration.upsert({
      where: { tenantId_type: { tenantId, type: 'GOOGLE' } },
      create: { tenantId, type: 'GOOGLE', config, active: true },
      update: { config, active: true },
    });
    this.tokens.set(tenantId, { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 });
    return { connected: true, email };
  }

  async disconnect(tenantId: string) {
    const cfg = await this.config(tenantId);
    if (cfg) await axios.post('https://oauth2.googleapis.com/revoke', new URLSearchParams({ token: cfg.refreshToken })).catch(() => {});
    await this.prisma.integration.deleteMany({ where: { tenantId, type: 'GOOGLE' } });
    this.tokens.delete(tenantId);
  }

  async status(tenantId: string) {
    const cfg = await this.config(tenantId);
    return { configured: this.isConfigured(), connected: !!cfg, email: cfg?.email ?? null, connectedAt: cfg?.connectedAt ?? null };
  }

  private async config(tenantId: string): Promise<GoogleConfig | null> {
    const row = await this.prisma.integration.findFirst({ where: { tenantId, type: 'GOOGLE', active: true } });
    if (!row) return null;
    try { return JSON.parse(this.encryption.decrypt(row.config)); } catch { return null; }
  }

  async isConnected(tenantId: string) { return !!(await this.config(tenantId)); }

  private async accessToken(tenantId: string): Promise<{ token: string; calendarId: string } | null> {
    const cfg = await this.config(tenantId);
    if (!cfg) return null;
    const cached = this.tokens.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return { token: cached.token, calendarId: cfg.calendarId ?? 'primary' };
    try {
      const { data } = await axios.post(TOKEN_URL, new URLSearchParams({
        client_id: this.clientId, client_secret: this.clientSecret, refresh_token: cfg.refreshToken, grant_type: 'refresh_token',
      }));
      this.tokens.set(tenantId, { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 });
      return { token: data.access_token, calendarId: cfg.calendarId ?? 'primary' };
    } catch (e: any) {
      // invalid_grant = acesso revogado na conta Google: precisa conectar de novo
      this.logger.error(`[Google] Falha ao renovar token (${tenantId}): ${e.response?.data?.error ?? e.message}`);
      throw new Error('Conexão com o Google expirou. Conecte de novo em Configurações.');
    }
  }

  // ── Agenda ─────────────────────────────────────────────────────────────────

  /** Períodos ocupados na agenda (null = Google não conectado). */
  async busy(tenantId: string, from: Date, to: Date): Promise<Interval[] | null> {
    const auth = await this.accessToken(tenantId);
    if (!auth) return null;
    const { data } = await axios.post(`${CAL}/freeBusy`, {
      timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: auth.calendarId }],
    }, { headers: { Authorization: `Bearer ${auth.token}` } });
    const cal = data.calendars?.[auth.calendarId];
    if (cal?.errors?.length) throw new Error(`Google Agenda: ${cal.errors[0].reason}`);
    return (cal?.busy ?? []).map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) }));
  }

  /** Cria o evento com Google Meet e convida o cliente por e-mail. */
  async createEvent(tenantId: string, e: CalendarEventInput, requestId: string) {
    const auth = await this.accessToken(tenantId);
    if (!auth) return null;
    const { data } = await axios.post(
      `${CAL}/calendars/${encodeURIComponent(auth.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        summary: e.summary,
        description: e.description,
        start: { dateTime: e.start.toISOString(), timeZone: e.timeZone },
        end: { dateTime: e.end.toISOString(), timeZone: e.timeZone },
        attendees: [{ email: e.attendee.email, displayName: e.attendee.name }],
        conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        guestsCanModify: false,
      },
      { headers: { Authorization: `Bearer ${auth.token}` } },
    );
    const meet = data.hangoutLink
      ?? data.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === 'video')?.uri
      ?? null;
    return { eventId: data.id as string, meetLink: meet as string | null };
  }

  /** Remarca: o link do Meet continua o mesmo; o cliente recebe a atualização. */
  async moveEvent(tenantId: string, eventId: string, start: Date, end: Date, timeZone: string, description?: string) {
    const auth = await this.accessToken(tenantId);
    if (!auth) return;
    await axios.patch(
      `${CAL}/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { start: { dateTime: start.toISOString(), timeZone }, end: { dateTime: end.toISOString(), timeZone }, ...(description ? { description } : {}) },
      { headers: { Authorization: `Bearer ${auth.token}` } },
    );
  }

  /** Cancela no Google (o cliente recebe o cancelamento por e-mail). Evento já apagado não é erro. */
  async cancelEvent(tenantId: string, eventId: string) {
    const auth = await this.accessToken(tenantId);
    if (!auth) return;
    try {
      await axios.delete(
        `${CAL}/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
        { headers: { Authorization: `Bearer ${auth.token}` } },
      );
    } catch (e: any) {
      if (![404, 410].includes(e.response?.status)) throw e;
    }
  }
}
