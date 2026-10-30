import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { FunnelService } from '../pipelines/funnel.service';
import { NotifyService } from '../notifications/notify.service';
import { fillVars, varsOf } from '../automations/automation-runner.service';

/** Permissões que o token do usuário de sistema precisa ter para a caixa de entrada e as regras. */
const REQUIRED_SCOPES = [
  'instagram_basic', 'instagram_manage_messages', 'instagram_manage_comments',
  'pages_show_list', 'pages_read_engagement', 'pages_manage_metadata',
];

/** Janela de mensagens da Meta: 24h livres; até 7 dias só com a tag HUMAN_AGENT (atendimento humano). */
const WINDOW_MS = 24 * 3600_000;
const HUMAN_AGENT_MS = 7 * 24 * 3600_000;

/** A mesma regra não responde de novo ao mesmo contato dentro desse tempo (evita repetir em cada mensagem). */
const RULE_COOLDOWN_MS = 3600_000;

/** O eco de uma mensagem enviada pelo CRM pode chegar antes de o envio gravar o mid. */
const ECHO_DELAY_MS = 3000;

/** Como cada gatilho aparece na nota do card no funil. */
const TRIGGER_ORIGIN: Record<string, string> = {
  COMMENT: 'comentário', STORY_REPLY: 'resposta ao story', STORY_MENTION: 'menção no story', DM_KEYWORD: 'palavra-chave na DM', FIRST_DM: 'primeira DM',
};

export const IG_TRIGGERS = ['COMMENT', 'STORY_REPLY', 'STORY_MENTION', 'DM_KEYWORD', 'FIRST_DM'] as const;
export type IgTrigger = (typeof IG_TRIGGERS)[number];

/** Botão da DM: com url abre o link; sem url, o toque volta como mensagem com o título (dá para encadear outra regra). */
export type RuleButton = { title: string; url?: string };

/** Funil das regras de brinde/conteúdo: lead frio, separado do funil de vendas. */
/** Funil dos leads do Instagram (DMs, comentários e stories), separado do funil de vendas. */
const INSTAGRAM_FUNNEL = {
  name: 'Instagram',
  stages: [
    { name: 'Entrou pelo Instagram', color: '#EC4899' },
    { name: 'Conversando', color: '#F59E0B' },
    { name: 'Qualificado', color: '#8B5CF6' },
    { name: 'Enviado para Vendas', color: '#10B981' },
    { name: 'Sem interesse', color: '#EF4444', kind: 'LOST' },
  ],
};

type MsgType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'INTERACTIVE';

interface ParsedIgMessage {
  type: MsgType;
  content: string;
  mediaUrl: string | null;
  quotedContent: string | null;
  quotedType: string | null;
  quotedExternalId: string | null;
  story: 'reply' | 'mention' | null;
  sharedMedia?: boolean; // post compartilhado: o link pode ser foto ou vídeo (descobre ao gravar)
}

type Account = { tenantId: string; pageId: string; pageName: string | null; igUserId: string; username: string | null; pageToken: string };

/** Compara textos ignorando maiúsculas, acentos e pontuação. */
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9#@]+/g, ' ').trim();

/** Alguma palavra-chave aparece no texto como palavra inteira (sem palavras-chave = qualquer texto). */
export function matchesKeywords(text: string, keywords: string[]) {
  const list = keywords.map(norm).filter(Boolean);
  if (!list.length) return true;
  const t = ` ${norm(text)} `;
  return list.some((k) => t.includes(` ${k} `));
}

/**
 * Mensagens do Instagram pela API do Instagram com Login do Facebook (Messenger Platform):
 * DMs entram na caixa de entrada como conversas do canal INSTAGRAM, viram contato e lead
 * no funil, e as regras de palavra-chave respondem comentários (Private Replies),
 * respostas/menções a stories e DMs.
 *
 * O token salvo é o da Página ligada ao @ (obtido com o token do usuário de sistema).
 * Variáveis: INSTAGRAM_ACCESS_TOKEN (token do usuário de sistema, também usado na análise
 * de perfis), IG_WEBHOOK_VERIFY_TOKEN (ou WA_WEBHOOK_VERIFY_TOKEN), META_APP_ID/META_APP_SECRET.
 */
@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly funnel: FunnelService,
    private readonly notify: NotifyService,
    private readonly events: EventEmitter2,
  ) {}

  private get graphUrl() {
    return `https://graph.facebook.com/${process.env.GRAPH_API_VERSION || 'v23.0'}`;
  }

  private graphError(err: any) {
    const e = err?.response?.data?.error;
    return e?.error_user_msg || e?.message || err.message;
  }

  // ── Conta ──────────────────────────────────────────────────────────────────

  async getAccount(tenantId: string): Promise<Account | null> {
    const acc = await this.prisma.instagramAccount.findUnique({ where: { tenantId } });
    if (!acc) return null;
    return { ...acc, pageToken: this.encryption.decrypt(acc.pageToken) };
  }

  private async requireAccount(tenantId: string) {
    const acc = await this.getAccount(tenantId);
    if (!acc) throw new NotFoundException('Instagram não conectado. Conecte em Configurações → Integrações.');
    return acc;
  }

  /** Permissões concedidas ao token (o da Página herda as do usuário de sistema). */
  private async scopesOf(token: string): Promise<string[] | null> {
    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) return null;
    try {
      const res = await axios.get(`${this.graphUrl}/debug_token`, {
        params: { input_token: token, access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}` },
        timeout: 15000,
      });
      return res.data?.data?.scopes ?? [];
    } catch {
      return null;
    }
  }

  async getStatus(tenantId: string) {
    const acc = await this.getAccount(tenantId);
    const base = { configured: !!process.env.INSTAGRAM_ACCESS_TOKEN, webhookPath: '/api/v1/instagram/webhook' };
    if (!acc) return { ...base, connected: false };

    const auth = { Authorization: `Bearer ${acc.pageToken}` };
    const [scopes, apps] = await Promise.all([
      this.scopesOf(acc.pageToken),
      // Apps que recebem os eventos da Página: o Kommo aparece aqui enquanto estiver ligado às DMs
      axios.get(`${this.graphUrl}/${acc.pageId}/subscribed_apps`, { headers: auth, timeout: 15000 })
        .then((r) => (r.data?.data ?? []).map((a: any) => ({ id: a.id, name: a.name, fields: a.subscribed_fields ?? [] })))
        .catch((err) => ({ error: this.graphError(err) })),
    ]);
    const appList = Array.isArray(apps) ? apps : [];
    const thisApp = appList.find((a: any) => a.id === process.env.META_APP_ID);
    return {
      ...base,
      connected: true,
      username: acc.username,
      igUserId: acc.igUserId,
      pageId: acc.pageId,
      pageName: acc.pageName,
      missingScopes: scopes ? REQUIRED_SCOPES.filter((s) => !scopes.includes(s)) : null,
      pageSubscribed: Array.isArray(apps) ? !!thisApp : null,
      subscribedApps: appList.filter((a: any) => a.id !== process.env.META_APP_ID),
      subscribedAppsError: Array.isArray(apps) ? null : apps.error,
    };
  }

  /**
   * Conecta com o token do usuário de sistema (o do corpo ou INSTAGRAM_ACCESS_TOKEN):
   * acha a Página com Instagram ligado, guarda o token da Página e inscreve o app nela.
   */
  async connect(tenantId: string, accessToken?: string, pageId?: string) {
    const token = (accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
    if (!token) throw new BadRequestException('Cole o token do usuário de sistema ou defina INSTAGRAM_ACCESS_TOKEN no servidor.');

    let pages: any[];
    try {
      const res = await axios.get(`${this.graphUrl}/me/accounts`, {
        params: { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: 100 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      pages = res.data?.data ?? [];
    } catch (err: any) {
      throw new BadRequestException(`Token inválido: ${this.graphError(err)}`);
    }
    const withIg = pages.filter((p) => p.instagram_business_account?.id);
    const page = pageId ? withIg.find((p) => p.id === pageId) : withIg[0];
    if (!page) {
      throw new BadRequestException(pages.length
        ? 'Nenhuma Página do token tem conta do Instagram ligada.'
        : 'O token não enxerga nenhuma Página: dê ao usuário de sistema acesso à Página no Gerenciador de Negócios.');
    }
    if (!page.access_token) throw new BadRequestException('A Meta não devolveu o token da Página: falta a permissão pages_show_list.');

    const ig = page.instagram_business_account;
    const data = { pageId: page.id, pageName: page.name ?? null, igUserId: ig.id, username: ig.username ?? null, pageToken: this.encryption.encrypt(page.access_token) };
    await this.prisma.instagramAccount.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });

    const subscribeError = await this.subscribePage(page.id, page.access_token);
    this.logger.log(`[IG] Tenant ${tenantId} conectado: @${ig.username} (página ${page.id})${subscribeError ? ` — inscrição falhou: ${subscribeError}` : ''}`);
    return { ...(await this.getStatus(tenantId)), subscribeError };
  }

  /** Sem a inscrição na Página, os webhooks de mensagens do Instagram não chegam. */
  private async subscribePage(pageId: string, pageToken: string): Promise<string | null> {
    try {
      await axios.post(`${this.graphUrl}/${pageId}/subscribed_apps`, null, {
        params: { subscribed_fields: 'feed' },
        headers: { Authorization: `Bearer ${pageToken}` },
        timeout: 15000,
      });
      return null;
    } catch (err: any) {
      return this.graphError(err);
    }
  }

  async disconnect(tenantId: string) {
    await this.prisma.instagramAccount.deleteMany({ where: { tenantId } });
    return { success: true };
  }

  /** Últimos posts e reels, para escolher onde a regra de comentário vale. */
  async listMedia(tenantId: string) {
    const acc = await this.requireAccount(tenantId);
    try {
      const res = await axios.get(`${this.graphUrl}/${acc.igUserId}/media`, {
        params: { fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp', limit: 30 },
        headers: { Authorization: `Bearer ${acc.pageToken}` },
        timeout: 15000,
      });
      return res.data?.data ?? [];
    } catch (err: any) {
      throw new BadRequestException(`Não foi possível listar os posts: ${this.graphError(err)}`);
    }
  }

  // ── Envio ──────────────────────────────────────────────────────────────────

  private async postMessage(acc: Account, body: any) {
    try {
      const res = await axios.post(`${this.graphUrl}/me/messages`, body, {
        headers: { Authorization: `Bearer ${acc.pageToken}` },
        timeout: 30000,
      });
      return { externalId: (res.data?.message_id as string) ?? null, recipientId: (res.data?.recipient_id as string) ?? null };
    } catch (err: any) {
      const e = err?.response?.data?.error;
      // 10 / 2534022: fora da janela permitida para esse tipo de envio
      const outside = e?.code === 10 || e?.error_subcode === 2534022 || /outside of allowed window/i.test(e?.message ?? '');
      throw new BadRequestException(outside
        ? body.tag === 'HUMAN_AGENT'
          ? 'Fora das 24h: o envio com a tag de atendimento humano precisa do recurso "Human Agent" liberado no app da Meta.'
          : 'Fora da janela de 24h do Instagram: o contato precisa mandar mensagem antes.'
        : this.graphError(err));
    }
  }

  /** Texto para um contato (IGSID). Com humanAgent, usa a tag HUMAN_AGENT (até 7 dias depois da última mensagem dele). */
  async sendText(tenantId: string, igsid: string, text: string, opts: { humanAgent?: boolean } = {}) {
    const acc = await this.requireAccount(tenantId);
    return this.postMessage(acc, {
      recipient: { id: igsid },
      message: { text },
      ...(opts.humanAgent ? { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' } : { messaging_type: 'RESPONSE' }),
    });
  }

  /**
   * Envio pela caixa de entrada respeitando a janela: até 24h depois da última mensagem do
   * contato vai normal; até 7 dias, com a tag HUMAN_AGENT; depois disso a Meta não deixa.
   */
  async sendFromInbox(tenantId: string, conv: { id: string; externalId: string | null; contact: { instagramId: string | null } }, text: string) {
    const igsid = conv.contact.instagramId || (conv.externalId?.startsWith('ig:') ? conv.externalId.slice(3) : '');
    if (!igsid) throw new BadRequestException('Conversa do Instagram sem o id do contato.');
    const last = await this.prisma.message.findFirst({
      where: { conversationId: conv.id, direction: 'INBOUND' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    const age = last ? Date.now() - last.sentAt.getTime() : Infinity;
    if (age > HUMAN_AGENT_MS) {
      throw new BadRequestException(last
        ? 'Passaram mais de 7 dias desde a última mensagem do contato: o Instagram só deixa responder depois que ele escrever de novo.'
        : 'O contato ainda não mandou mensagem no Direct: o Instagram só deixa responder depois que ele escrever.');
    }
    return this.sendText(tenantId, igsid, text, { humanAgent: age > WINDOW_MS });
  }

  /**
   * Mensagem de uma regra, com botões quando houver (modelo de botões do Instagram).
   * Se o Instagram recusar o modelo, manda o texto com os links e respostas rápidas.
   * `recipient` é { id } (DM) ou { comment_id } (resposta privada: 1 por comentário, em até 7 dias).
   */
  private async sendRuleMessage(acc: Account, recipient: { id: string } | { comment_id: string }, text: string, buttons: RuleButton[]) {
    if (!buttons.length) return this.postMessage(acc, { recipient, message: { text } });
    try {
      return await this.postMessage(acc, {
        recipient,
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text,
              buttons: buttons.map((b) => (b.url ? { type: 'web_url', url: b.url, title: b.title } : { type: 'postback', title: b.title, payload: b.title })),
            },
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(`[IG] Modelo com botões recusado (${err.message}): enviando como texto`);
      const links = buttons.filter((b) => b.url).map((b) => `👉 ${b.title}: ${b.url}`).join('\n');
      const replies = buttons.filter((b) => !b.url);
      return this.postMessage(acc, {
        recipient,
        message: {
          text: links ? `${text}\n\n${links}` : text,
          ...(replies.length ? { quick_replies: replies.map((b) => ({ content_type: 'text', title: b.title, payload: b.title })) } : {}),
        },
      });
    }
  }

  private async publicReply(acc: Account, commentId: string, text: string) {
    try {
      await axios.post(`${this.graphUrl}/${commentId}/replies`, null, {
        params: { message: text },
        headers: { Authorization: `Bearer ${acc.pageToken}` },
        timeout: 15000,
      });
    } catch (err: any) {
      throw new Error(`resposta pública: ${this.graphError(err)}`);
    }
  }

  /** Nome, @ e foto de quem mandou mensagem (precisa de instagram_manage_messages). */
  private async profileOf(acc: Account, igsid: string): Promise<{ name?: string; username?: string; profile_pic?: string }> {
    try {
      const res = await axios.get(`${this.graphUrl}/${igsid}`, {
        params: { fields: 'name,username,profile_pic' },
        headers: { Authorization: `Bearer ${acc.pageToken}` },
        timeout: 10000,
      });
      return res.data ?? {};
    } catch (err: any) {
      this.logger.warn(`[IG] Perfil de ${igsid} indisponível: ${this.graphError(err)}`);
      return {};
    }
  }

  // ── Webhook ────────────────────────────────────────────────────────────────

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.META_APP_SECRET;
    if (!secret) {
      this.logger.warn('[IG] META_APP_SECRET ausente — assinatura do webhook NÃO verificada');
      return true;
    }
    if (!rawBody || !signature?.startsWith('sha256=')) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  async processWebhook(payload: any) {
    if (payload?.object !== 'instagram') return;
    for (const entry of payload.entry ?? []) {
      const row = await this.prisma.instagramAccount.findUnique({ where: { igUserId: String(entry.id) } });
      if (!row) {
        this.logger.warn(`[IG] Webhook para conta desconhecida: ${entry.id}`);
        continue;
      }
      const acc: Account = { ...row, pageToken: this.encryption.decrypt(row.pageToken) };
      for (const ev of entry.messaging ?? []) {
        await this.safely('messaging', () => this.handleMessaging(acc, ev));
      }
      for (const change of entry.changes ?? []) {
        const v = change.value ?? {};
        if (change.field === 'comments' || change.field === 'live_comments') {
          await this.safely(change.field, () => this.handleComment(acc, v));
        } else if (change.field === 'messages' && v.sender) {
          // "Testar" do painel da Meta e algumas versões mandam a mensagem dentro de changes
          await this.safely('messages', () => this.handleMessaging(acc, v));
        } else {
          this.logger.log(`[IG] Campo de webhook ignorado: ${change.field}`);
        }
      }
    }
  }

  private async safely(what: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err: any) {
      this.logger.error(`[IG] Erro processando ${what}: ${err.message}`);
    }
  }

  private async handleMessaging(acc: Account, ev: any) {
    const ours = (id: any) => id && (String(id) === acc.igUserId || String(id) === acc.pageId);
    const echo = !!ev.message?.is_echo || ours(ev.sender?.id);
    const customer = String((echo ? ev.recipient?.id : ev.sender?.id) ?? '');
    if (!customer || ours(customer)) return;

    // Leu as mensagens: marca as nossas como lidas
    if (ev.read) {
      const conv = await this.findConversation(acc.tenantId, customer);
      if (conv) {
        await this.prisma.message.updateMany({
          where: { conversationId: conv.id, direction: 'OUTBOUND', readAt: null },
          data: { readAt: new Date(Number(ev.timestamp) || Date.now()) },
        });
      }
      return;
    }

    if (ev.reaction) {
      if (ev.reaction.action !== 'react') return;
      const emoji = ev.reaction.emoji || '❤️';
      await this.saveMessage(acc, customer, echo ? 'OUTBOUND' : 'INBOUND', `${ev.reaction.mid}:r:${ev.sender?.id}`, ev.timestamp, {
        type: 'TEXT', content: `${emoji} (reação)`, mediaUrl: null, quotedContent: null, quotedType: null, quotedExternalId: ev.reaction.mid ?? null, story: null,
      });
      return;
    }

    if (ev.postback) {
      await this.saveMessage(acc, customer, 'INBOUND', ev.postback.mid || `pb:${customer}:${ev.timestamp}`, ev.timestamp, {
        type: 'INTERACTIVE', content: ev.postback.title || ev.postback.payload || '[botão]', mediaUrl: null, quotedContent: null, quotedType: null, quotedExternalId: null, story: null,
      });
      return;
    }

    const m = ev.message;
    if (!m?.mid || m.is_deleted) return;
    await this.saveMessage(acc, customer, echo ? 'OUTBOUND' : 'INBOUND', m.mid, ev.timestamp, this.parseMessage(m));
  }

  private parseMessage(m: any): ParsedIgMessage {
    const base: ParsedIgMessage = {
      type: 'TEXT', content: m.text ?? '', mediaUrl: null,
      quotedContent: null, quotedType: null, quotedExternalId: m.reply_to?.mid ?? null, story: null,
    };
    if (m.reply_to?.story) {
      base.story = 'reply';
      base.quotedType = 'STORY';
      base.quotedContent = 'Respondeu ao seu story';
      base.quotedExternalId = m.reply_to.story.id ?? null;
      base.mediaUrl = m.reply_to.story.url ?? null;
    }
    if (m.quick_reply?.payload) base.type = 'INTERACTIVE';
    const att = m.attachments?.[0];
    if (att) {
      const url = att.payload?.url ?? null;
      switch (att.type) {
        case 'story_mention':
          return { ...base, type: 'IMAGE', content: '[mencionou você no story]', mediaUrl: url, story: 'mention' };
        case 'image':
          return { ...base, type: 'IMAGE', content: m.text || '[imagem]', mediaUrl: url };
        case 'video':
        case 'ig_reel':
        case 'reel':
          return { ...base, type: 'VIDEO', content: m.text || att.payload?.title || (att.type === 'video' ? '[vídeo]' : '[reel compartilhado]'), mediaUrl: url };
        case 'audio':
          return { ...base, type: 'AUDIO', content: '[áudio]', mediaUrl: url };
        case 'file':
          return { ...base, type: 'DOCUMENT', content: '[arquivo]', mediaUrl: url };
        case 'share':
        case 'ig_post':
          return url
            ? { ...base, type: 'IMAGE', content: m.text || att.payload?.title || '[post compartilhado]', mediaUrl: url, sharedMedia: true }
            : { ...base, content: m.text || '[post compartilhado]' };
        case 'template': {
          // Cartão com botões mandado por outra conta comercial (geralmente automação/propaganda)
          const text = templateText(att.payload);
          const img = (att.payload?.generic?.elements ?? att.payload?.elements ?? [])[0]?.image_url ?? null;
          return img
            ? { ...base, type: 'IMAGE', content: m.text || text, mediaUrl: img }
            : { ...base, content: m.text || text };
        }
        default:
          return { ...base, content: m.text || `[${att.type || 'anexo'}]` };
      }
    }
    if (m.is_unsupported) return { ...base, content: '[mensagem não suportada pela API]' };
    return base;
  }

  /** O link do post compartilhado é um vídeo (reel) ou uma foto? Pergunta o tipo ao CDN da Meta. */
  private async isVideo(url: string) {
    try {
      const res = await axios.head(url, { timeout: 5000, maxRedirects: 3 });
      return String(res.headers['content-type'] ?? '').startsWith('video/');
    } catch {
      return false;
    }
  }

  private findConversation(tenantId: string, igsid: string) {
    return this.prisma.conversation.findFirst({
      where: { tenantId, channel: 'INSTAGRAM', contact: { instagramId: igsid } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Contato e conversa do Instagram pelo IGSID (cria os dois na primeira vez). */
  private async ensureContact(acc: Account, igsid: string, hint: { username?: string | null } = {}) {
    let contact = await this.prisma.contact.findFirst({ where: { tenantId: acc.tenantId, instagramId: igsid } });
    const isNew = !contact;
    if (!contact) {
      const p = await this.profileOf(acc, igsid);
      const username = p.username || hint.username || null;
      contact = await this.prisma.contact.create({
        data: {
          tenantId: acc.tenantId,
          name: p.name || (username ? `@${username}` : `Instagram ${igsid.slice(-4)}`),
          instagramId: igsid,
          instagramHandle: username,
          profilePicUrl: p.profile_pic ?? null,
          leadOrigin: 'ORGANIC',
          utmSource: 'instagram',
          utmMedium: 'direct',
          type: 'LEAD',
        },
      });
    } else if (hint.username && !contact.instagramHandle) {
      contact = await this.prisma.contact.update({ where: { id: contact.id }, data: { instagramHandle: hint.username } });
    }

    let conv = await this.findConversation(acc.tenantId, igsid);
    if (!conv) {
      conv = await this.prisma.conversation.upsert({
        where: { tenantId_externalId: { tenantId: acc.tenantId, externalId: `ig:${igsid}` } },
        update: {},
        create: {
          tenantId: acc.tenantId, channel: 'INSTAGRAM', status: 'OPEN', contactId: contact.id,
          externalId: `ig:${igsid}`, profilePicUrl: contact.profilePicUrl,
        },
      });
    }
    return { contact, conv, isNew };
  }

  /** Grava a mensagem (idempotente pelo mid) e, se veio do contato, alimenta o funil e as regras. */
  private async saveMessage(acc: Account, igsid: string, direction: 'INBOUND' | 'OUTBOUND', mid: string, timestamp: any, parsed: ParsedIgMessage) {
    // Mensagem que o próprio CRM mandou volta como eco: espera o envio terminar de gravar
    if (direction === 'OUTBOUND') await new Promise((r) => setTimeout(r, ECHO_DELAY_MS));
    const already = await this.prisma.message.findFirst({ where: { externalId: mid }, select: { id: true } });
    if (already) return;

    if (parsed.sharedMedia && parsed.mediaUrl && (await this.isVideo(parsed.mediaUrl))) parsed = { ...parsed, type: 'VIDEO' };

    const { contact, conv, isNew } = await this.ensureContact(acc, igsid);
    const quoted = parsed.quotedExternalId && !parsed.quotedContent
      ? await this.prisma.message.findFirst({ where: { externalId: parsed.quotedExternalId }, select: { content: true, type: true } })
      : null;

    await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction,
        type: parsed.type,
        content: parsed.content,
        mediaUrl: parsed.mediaUrl,
        externalId: mid,
        quotedExternalId: parsed.quotedExternalId,
        quotedContent: parsed.quotedContent ?? quoted?.content ?? null,
        quotedType: parsed.quotedType ?? quoted?.type ?? null,
        sentAt: timestamp ? new Date(Number(timestamp)) : new Date(),
      },
    });
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date(), ...(direction === 'INBOUND' && (conv.status === 'RESOLVED' || conv.status === 'IN_PROGRESS') ? { status: 'OPEN' } : {}) },
    });

    // Respondido pelo app do Instagram: o time assumiu a conversa
    if (direction === 'OUTBOUND') {
      this.events.emit('conversation.human_message', { tenantId: acc.tenantId, conversationId: conv.id });
      return;
    }

    this.events.emit('instagram.inbound', { tenantId: acc.tenantId, contactId: contact.id, conversationId: conv.id, firstMessage: isNew });
    this.notify.send(acc.tenantId, 'message_instagram', {
      title: `${contact.name} · Instagram`,
      body: parsed.content.slice(0, 140),
      url: `/dashboard/conversas?conv=${conv.id}`,
      tag: conv.id,
    });

    const trigger: IgTrigger = parsed.story === 'reply' ? 'STORY_REPLY' : parsed.story === 'mention' ? 'STORY_MENTION' : 'DM_KEYWORD';
    let rule = await this.runDmRule(acc, trigger, parsed.content, contact, conv.id, igsid);
    // Primeira DM de quem nunca falou com a gente e não caiu em palavra-chave: boas-vindas
    if (!rule && isNew && trigger === 'DM_KEYWORD') rule = await this.runDmRule(acc, 'FIRST_DM', parsed.content, contact, conv.id, igsid);

    // Funil: a regra pode mandar para uma etapa própria; senão, quem ainda não tem card em nenhum
    // funil entra no funil Instagram (quem já está em Vendas, por ex. veio do WhatsApp, fica onde está)
    if (!rule?.stageId && !(await this.prisma.pipelineLead.findFirst({ where: { contactId: contact.id }, select: { id: true } }))) {
      await this.toDefaultFunnel(acc.tenantId, contact.id, isNew ? 'Origem: Instagram — Direct' : undefined);
    }
  }

  // ── Regras de palavra-chave ────────────────────────────────────────────────

  private async rulesFor(tenantId: string, trigger: IgTrigger) {
    return this.prisma.instagramAutomation.findMany({
      where: { tenantId, trigger, active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Story ou DM: a primeira regra que bate responde na DM (uma vez por hora por contato). Devolve a regra que respondeu. */
  private async runDmRule(
    acc: Account, trigger: IgTrigger, text: string,
    contact: { id: string; name: string; tags: string[]; instagramHandle: string | null }, conversationId: string, igsid: string,
  ) {
    // Menção a story não tem texto: palavras-chave não se aplicam
    // Menção a story e boas-vindas não usam palavra-chave
    const rule = (await this.rulesFor(acc.tenantId, trigger))
      .find((r) => trigger === 'STORY_MENTION' || trigger === 'FIRST_DM' || matchesKeywords(text, r.keywords));
    if (!rule) return null;

    const reply = fillVars(rule.dmText, this.varsFor(contact.name, contact.instagramHandle));
    const recent = await this.prisma.message.findFirst({
      where: { conversationId, direction: 'OUTBOUND', senderName: 'Bot', content: { startsWith: reply }, sentAt: { gte: new Date(Date.now() - RULE_COOLDOWN_MS) } },
      select: { id: true },
    });
    if (recent) return null;

    try {
      const buttons = this.buttonsOf(rule);
      const { externalId } = await this.sendRuleMessage(acc, { id: igsid }, reply, buttons);
      await this.recordBotMessage(conversationId, this.withButtons(reply, buttons), externalId);
      await this.afterRule(rule, contact, `Origem: Instagram — ${TRIGGER_ORIGIN[trigger]}`);
      this.logger.log(`[IG] Regra "${rule.name}" (${trigger}) respondeu ${contact.id}`);
      return rule;
    } catch (err: any) {
      this.logger.warn(`[IG] Regra "${rule.name}" falhou para ${contact.id}: ${err.message}`);
      return null;
    }
  }

  private buttonsOf(rule: { buttons: any }): RuleButton[] {
    return Array.isArray(rule.buttons) ? rule.buttons : [];
  }

  /** Texto do balão no CRM: a mensagem e os botões, como no WhatsApp. */
  private withButtons(text: string, buttons: RuleButton[]) {
    return buttons.length ? `${text}\n\n${buttons.map((b) => `[ ${b.title} ]`).join('  ')}` : text;
  }

  /**
   * Comentário com a palavra-chave: resposta privada na DM (Private Replies, 1 por comentário)
   * e, se a regra tiver, resposta pública no comentário.
   */
  private async handleComment(acc: Account, v: any) {
    const commentId = v.id ? String(v.id) : '';
    const fromId = v.from?.id ? String(v.from.id) : '';
    if (!commentId || !fromId || fromId === acc.igUserId) return; // nossas próprias respostas
    const text = String(v.text ?? '');
    const mediaId = v.media?.id ? String(v.media.id) : null;

    const rule = (await this.rulesFor(acc.tenantId, 'COMMENT'))
      .find((r) => (!r.mediaIds.length || (mediaId && r.mediaIds.includes(mediaId))) && matchesKeywords(text, r.keywords));
    if (!rule) return;

    // Reserva o comentário antes de enviar: webhook repetido não responde duas vezes
    try {
      await this.prisma.instagramCommentReply.create({
        data: { commentId, tenantId: acc.tenantId, automationId: rule.id, mediaId, username: v.from?.username ?? null, text: text.slice(0, 1000), status: 'SENT' },
      });
    } catch {
      return;
    }

    const username: string | undefined = v.from?.username;
    const vars = this.varsFor(username ? `@${username}` : '', username);
    const dm = fillVars(rule.dmText, vars);
    try {
      const buttons = this.buttonsOf(rule);
      const { externalId, recipientId } = await this.sendRuleMessage(acc, { comment_id: commentId }, dm, buttons);
      const { contact, conv, isNew } = await this.ensureContact(acc, recipientId || fromId, { username });
      await this.recordBotMessage(conv.id, this.withButtons(dm, buttons), externalId, `Comentário: "${text.slice(0, 300)}"`);
      const origin = `Origem: Instagram — comentário "${text.slice(0, 80)}"`;
      if (!rule.stageId) await this.toDefaultFunnel(acc.tenantId, contact.id, isNew ? origin : undefined);
      await this.afterRule(rule, contact, origin);

      if (rule.publicReplies.length) {
        const pick = rule.publicReplies[Math.floor(Math.random() * rule.publicReplies.length)];
        await this.publicReply(acc, commentId, fillVars(pick, vars));
      }
      this.logger.log(`[IG] Regra "${rule.name}" respondeu o comentário ${commentId} (@${username ?? fromId})`);
    } catch (err: any) {
      this.logger.warn(`[IG] Regra "${rule.name}" falhou no comentário ${commentId}: ${err.message}`);
      await this.prisma.instagramCommentReply.update({ where: { commentId }, data: { status: 'FAILED', error: String(err.message).slice(0, 500) } }).catch(() => {});
    }
  }

  /** {{nome}}, {{primeiro_nome}} e {{usuario}} (@ do Instagram). */
  private varsFor(name: string, username: string | null | undefined) {
    const real = name && !name.startsWith('@') && !name.startsWith('Instagram ') ? name : '';
    return { ...varsOf(real, null), usuario: username ? `@${username}` : '' };
  }

  private async recordBotMessage(conversationId: string, content: string, externalId: string | null, quotedContent?: string) {
    await this.prisma.message.create({
      data: {
        conversationId, direction: 'OUTBOUND', type: 'TEXT', content, externalId, senderName: 'Bot', sentAt: new Date(),
        ...(quotedContent ? { quotedContent, quotedType: 'COMMENT' } : {}),
      },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  }

  private async afterRule(rule: { id: string; tenantId: string; tag: string | null; stageId: string | null }, contact: { id: string; tags: string[] }, origin: string) {
    await this.prisma.instagramAutomation.update({ where: { id: rule.id }, data: { runCount: { increment: 1 } } });
    if (rule.stageId) await this.funnel.ensureLeadAt(rule.tenantId, contact.id, rule.stageId, origin);
    if (rule.tag && !contact.tags.includes(rule.tag)) {
      await this.prisma.contact.update({ where: { id: contact.id }, data: { tags: [...contact.tags, rule.tag] } });
    }
  }

  // ── Funis ──────────────────────────────────────────────────────────────────

  /** Lead do Instagram sem etapa escolhida na regra: 1ª etapa do funil "Instagram" ou, sem ele, do funil principal. */
  private async toDefaultFunnel(tenantId: string, contactId: string, notes?: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { kind: 'OPEN', pipeline: { tenantId, name: { equals: INSTAGRAM_FUNNEL.name, mode: 'insensitive' } } },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    if (stage) await this.funnel.ensureLeadAt(tenantId, contactId, stage.id, notes);
    else await this.funnel.ensureLead(tenantId, contactId, notes);
  }

  /** Funis e etapas (sem os cards), para escolher onde a regra coloca o contato. */
  listFunnels(tenantId: string) {
    return this.prisma.pipeline.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, stages: { orderBy: { position: 'asc' }, select: { id: true, name: true, kind: true } } },
    });
  }

  /** Cria o funil "Instagram" (leads frios dos brindes/conteúdo); se já existir, devolve o que está lá. */
  async ensureInstagramFunnel(tenantId: string) {
    const existing = await this.prisma.pipeline.findFirst({ where: { tenantId, name: { equals: INSTAGRAM_FUNNEL.name, mode: 'insensitive' } } });
    if (!existing) {
      // O funil principal é o mais antigo: este, criado depois, nunca vira o principal
      await this.prisma.pipeline.create({
        data: {
          tenantId,
          name: INSTAGRAM_FUNNEL.name,
          stages: { create: INSTAGRAM_FUNNEL.stages.map((st, position) => ({ ...st, position })) },
        },
      });
    }
    return this.listFunnels(tenantId);
  }

  // ── CRUD das regras ────────────────────────────────────────────────────────

  listAutomations(tenantId: string) {
    return this.prisma.instagramAutomation.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  }

  /** Últimos comentários tratados (para conferir se a regra está respondendo). */
  listCommentReplies(tenantId: string) {
    return this.prisma.instagramCommentReply.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  private sanitize(body: any, partial = false) {
    const list = (v: any, max: number, len: number) =>
      (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\n]/) : [])
        .map((s: any) => String(s ?? '').trim().slice(0, len)).filter(Boolean).slice(0, max);
    const out: any = {};
    if (!partial || body.name !== undefined) {
      out.name = String(body.name ?? '').trim().slice(0, 80);
      if (!out.name) throw new BadRequestException('Dê um nome para a regra.');
    }
    if (!partial || body.trigger !== undefined) {
      if (!IG_TRIGGERS.includes(body.trigger)) throw new BadRequestException('Gatilho inválido.');
      out.trigger = body.trigger;
    }
    if (!partial || body.dmText !== undefined) {
      out.dmText = String(body.dmText ?? '').trim();
      if (!out.dmText) throw new BadRequestException('Escreva a mensagem que vai na DM.');
      if (out.dmText.length > 1000) throw new BadRequestException('A mensagem passa de 1000 caracteres (limite do Instagram).');
    }
    if (!partial || body.keywords !== undefined) out.keywords = list(body.keywords, 20, 60);
    if (!partial || body.mediaIds !== undefined) out.mediaIds = list(body.mediaIds, 50, 40);
    if (!partial || body.publicReplies !== undefined) out.publicReplies = list(body.publicReplies, 10, 300);
    if (!partial || body.tag !== undefined) out.tag = String(body.tag ?? '').trim().slice(0, 60) || null;
    if (!partial || body.stageId !== undefined) out.stageId = String(body.stageId ?? '').trim() || null;
    if (!partial || body.buttons !== undefined) {
      const buttons: RuleButton[] = (Array.isArray(body.buttons) ? body.buttons : [])
        .map((b: any) => ({ title: String(b?.title ?? '').trim(), url: String(b?.url ?? '').trim() }))
        .filter((b: RuleButton) => b.title)
        .map((b: RuleButton) => (b.url ? b : { title: b.title }));
      if (buttons.length > 3) throw new BadRequestException('Use no máximo 3 botões.');
      if (buttons.some((b) => b.title.length > 20)) throw new BadRequestException('Texto do botão com mais de 20 caracteres (limite do Instagram).');
      if (buttons.some((b) => b.url && !/^https?:\/\/\S+$/i.test(b.url))) throw new BadRequestException('Link do botão inválido: comece com https://');
      out.buttons = buttons;
    }
    if (out.buttons?.length && out.dmText && out.dmText.length > 640) throw new BadRequestException('Com botões, a mensagem pode ter até 640 caracteres.');
    if (body.active !== undefined) out.active = !!body.active;
    return out;
  }

  /** A etapa escolhida precisa ser de um funil do tenant. */
  private async checkStage(tenantId: string, stageId: string | null | undefined) {
    if (!stageId) return;
    const ok = await this.prisma.pipelineStage.findFirst({ where: { id: stageId, pipeline: { tenantId } }, select: { id: true } });
    if (!ok) throw new BadRequestException('Etapa do funil não encontrada.');
  }

  async createAutomation(tenantId: string, body: any) {
    const data = this.sanitize(body);
    await this.checkStage(tenantId, data.stageId);
    return this.prisma.instagramAutomation.create({ data: { tenantId, ...data } });
  }

  async updateAutomation(tenantId: string, id: string, body: any) {
    const data = this.sanitize(body, true);
    await this.checkStage(tenantId, data.stageId);
    const { count } = await this.prisma.instagramAutomation.updateMany({ where: { id, tenantId }, data });
    if (!count) throw new NotFoundException('Regra não encontrada.');
    return this.prisma.instagramAutomation.findUnique({ where: { id } });
  }

  async removeAutomation(tenantId: string, id: string) {
    const { count } = await this.prisma.instagramAutomation.deleteMany({ where: { id, tenantId } });
    if (!count) throw new NotFoundException('Regra não encontrada.');
    return { ok: true };
  }
}

/** Texto de um cartão "template" do Instagram: título, subtítulo, texto e botões com link. */
function templateText(payload: any): string {
  const elements: any[] = payload?.generic?.elements ?? payload?.elements ?? [];
  const lines: string[] = [];
  if (payload?.text) lines.push(payload.text);
  for (const e of elements) {
    if (e?.title) lines.push(e.title);
    if (e?.subtitle) lines.push(e.subtitle);
    for (const b of e?.buttons ?? []) if (b?.title) lines.push(`🔘 ${b.title}${b.url ? ` — ${b.url}` : ''}`);
  }
  for (const b of payload?.buttons ?? []) if (b?.title) lines.push(`🔘 ${b.title}${b.url ? ` — ${b.url}` : ''}`);
  return lines.length ? lines.join('\n') : '[cartão com botões]';
}
