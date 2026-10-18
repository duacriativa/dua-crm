import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { FunnelService } from '../pipelines/funnel.service';

type MsgType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'INTERACTIVE';

interface ParsedMessage {
  type: MsgType;
  content: string;
  mediaId: string | null;
  quotedExternalId: string | null;
}

/**
 * WhatsApp Cloud API oficial (Meta), com suporte a Coexistência:
 * o número continua no app WhatsApp Business do celular e as mensagens
 * enviadas pelo app chegam aqui como "smb_message_echoes".
 *
 * Credenciais por tenant ficam em MetaCredential (token criptografado).
 * Variáveis de ambiente do app Meta: META_APP_ID, META_APP_SECRET,
 * META_CONFIG_ID (Embedded Signup), WA_WEBHOOK_VERIFY_TOKEN, GRAPH_API_VERSION.
 */
@Injectable()
export class WhatsAppCloudService {
  private readonly logger = new Logger(WhatsAppCloudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly funnel: FunnelService,
  ) {}

  // Lê sempre do process.env em cada chamada (evita problema de inicialização)
  private get graphUrl() {
    return `https://graph.facebook.com/${process.env.GRAPH_API_VERSION || 'v23.0'}`;
  }

  // ── Credenciais ────────────────────────────────────────────────────────────

  async getCredential(tenantId: string) {
    const cred = await this.prisma.metaCredential.findUnique({ where: { tenantId } });
    if (!cred) return null;
    return { ...cred, accessToken: this.encryption.decrypt(cred.accessToken) };
  }

  async isConnected(tenantId: string) {
    const cred = await this.prisma.metaCredential.findUnique({ where: { tenantId }, select: { id: true } });
    return !!cred;
  }

  private async saveCredential(tenantId: string, phoneNumberId: string, wabaId: string, accessToken: string) {
    const data = {
      phoneNumberId,
      wabaId,
      accessToken: this.encryption.encrypt(accessToken),
      verifyToken: process.env.WA_WEBHOOK_VERIFY_TOKEN || crypto.randomBytes(16).toString('hex'),
    };
    await this.prisma.metaCredential.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }

  /** Config pública para o Embedded Signup no frontend (sem segredos). */
  publicConfig() {
    return {
      appId: process.env.META_APP_ID || null,
      configId: process.env.META_CONFIG_ID || null,
      graphVersion: process.env.GRAPH_API_VERSION || 'v23.0',
      ready: !!(process.env.META_APP_ID && process.env.META_CONFIG_ID && process.env.META_APP_SECRET),
    };
  }

  async getStatus(tenantId: string) {
    const cred = await this.getCredential(tenantId);
    if (!cred) return { connected: false, provider: 'cloud' };
    try {
      const res = await axios.get(`${this.graphUrl}/${cred.phoneNumberId}`, {
        params: { fields: 'display_phone_number,verified_name,quality_rating,platform_type,status' },
        headers: { Authorization: `Bearer ${cred.accessToken}` },
        timeout: 10000,
      });
      return { connected: true, provider: 'cloud', phoneNumberId: cred.phoneNumberId, wabaId: cred.wabaId, ...res.data };
    } catch (err: any) {
      const error = err?.response?.data?.error?.message ?? err.message;
      this.logger.warn(`[Cloud] Status falhou para tenant ${tenantId}: ${error}`);
      return { connected: true, provider: 'cloud', phoneNumberId: cred.phoneNumberId, wabaId: cred.wabaId, healthy: false, error };
    }
  }

  async disconnect(tenantId: string) {
    await this.prisma.metaCredential.deleteMany({ where: { tenantId } });
    return { success: true };
  }

  // ── Onboarding ─────────────────────────────────────────────────────────────

  /**
   * Finaliza o Embedded Signup (inclusive Coexistência):
   * troca o `code` por um token de negócio, inscreve o app na WABA
   * e pede a sincronização de contatos e histórico do app.
   */
  async completeEmbeddedSignup(tenantId: string, code: string, wabaId: string | undefined, phoneNumberId: string | undefined, coexistence: boolean) {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) throw new BadRequestException('META_APP_ID/META_APP_SECRET não configurados no backend.');
    if (!code) throw new BadRequestException('code é obrigatório.');

    let accessToken: string;
    try {
      const res = await axios.get(`${this.graphUrl}/oauth/access_token`, {
        params: { client_id: appId, client_secret: appSecret, code },
        timeout: 15000,
      });
      accessToken = res.data?.access_token;
    } catch (err: any) {
      throw new BadRequestException(`Falha ao trocar code por token: ${err?.response?.data?.error?.message ?? err.message}`);
    }
    if (!accessToken) throw new BadRequestException('Meta não retornou access_token.');

    // O Embedded Signup às vezes não devolve os IDs (ex.: conta já autorizada antes):
    // descobre a WABA pelo token e o número pela WABA.
    if (!wabaId || !phoneNumberId) {
      const found = await this.discoverAssets(accessToken, wabaId);
      wabaId = found.wabaId;
      phoneNumberId = found.phoneNumberId;
    }

    await this.subscribeApp(wabaId, accessToken);
    await this.saveCredential(tenantId, phoneNumberId, wabaId, accessToken);

    if (coexistence) {
      // Precisa ser chamado em até 24h após o onboarding (falha sem efeito se o número não for coexistência)
      await this.requestSmbSync(phoneNumberId, accessToken, 'smb_app_state_sync');
      await this.requestSmbSync(phoneNumberId, accessToken, 'history');
    }

    this.logger.log(`[Cloud] Tenant ${tenantId} conectado (phone ${phoneNumberId}, coexistence=${coexistence})`);
    return this.getStatus(tenantId);
  }

  private async discoverAssets(accessToken: string, wabaId?: string) {
    const auth = { Authorization: `Bearer ${accessToken}` };
    if (!wabaId) {
      const dbg = await axios.get(`${this.graphUrl}/debug_token`, {
        params: { input_token: accessToken, access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}` },
        timeout: 15000,
      });
      const scopes: any[] = dbg.data?.data?.granular_scopes ?? [];
      wabaId = scopes.find((s) => s.scope === 'whatsapp_business_management')?.target_ids?.[0]
        ?? scopes.find((s) => s.scope === 'whatsapp_business_messaging')?.target_ids?.[0];
    }
    if (!wabaId) throw new BadRequestException('Nenhuma conta do WhatsApp Business foi compartilhada com o app.');

    const phones = await axios.get(`${this.graphUrl}/${wabaId}/phone_numbers`, {
      params: { fields: 'id,display_phone_number,verified_name,platform_type' },
      headers: auth,
      timeout: 15000,
    });
    const list: any[] = phones.data?.data ?? [];
    this.logger.log(`[Cloud] WABA ${wabaId} números: ${list.map((p) => `${p.display_phone_number}(${p.platform_type})`).join(', ')}`);
    const phone = list.find((p) => p.platform_type === 'CLOUD_API') ?? list[0];
    if (!phone) throw new BadRequestException('A conta do WhatsApp Business não tem número cadastrado.');
    return { wabaId, phoneNumberId: phone.id as string };
  }

  /** Conexão manual com token de System User (alternativa ao Embedded Signup). */
  async connectManual(tenantId: string, phoneNumberId: string, wabaId: string, accessToken: string) {
    if (!phoneNumberId || !wabaId || !accessToken) throw new BadRequestException('phoneNumberId, wabaId e accessToken são obrigatórios.');
    try {
      await axios.get(`${this.graphUrl}/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
    } catch (err: any) {
      throw new BadRequestException(`Token ou phoneNumberId inválido: ${err?.response?.data?.error?.message ?? err.message}`);
    }
    await this.subscribeApp(wabaId, accessToken);
    await this.saveCredential(tenantId, phoneNumberId, wabaId, accessToken);
    return this.getStatus(tenantId);
  }

  private async subscribeApp(wabaId: string, accessToken: string) {
    try {
      await axios.post(`${this.graphUrl}/${wabaId}/subscribed_apps`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
    } catch (err: any) {
      throw new BadRequestException(`Falha ao inscrever app na WABA: ${err?.response?.data?.error?.message ?? err.message}`);
    }
  }

  private async requestSmbSync(phoneNumberId: string, accessToken: string, syncType: 'smb_app_state_sync' | 'history') {
    try {
      await axios.post(
        `${this.graphUrl}/${phoneNumberId}/smb_app_data`,
        { messaging_product: 'whatsapp', sync_type: syncType },
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 },
      );
      this.logger.log(`[Cloud] Sync ${syncType} solicitado para ${phoneNumberId}`);
    } catch (err: any) {
      this.logger.warn(`[Cloud] Sync ${syncType} falhou: ${err?.response?.data?.error?.message ?? err.message}`);
    }
  }

  // ── Envio ──────────────────────────────────────────────────────────────────

  private toWaId(phone: string) {
    let digits = (phone || '').replace(/\D/g, '');
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = '55' + digits;
    return digits;
  }

  private async post(tenantId: string, path: string, body: any) {
    const cred = await this.getCredential(tenantId);
    if (!cred) throw new NotFoundException('WhatsApp oficial não conectado.');
    try {
      const res = await axios.post(`${this.graphUrl}/${cred.phoneNumberId}/${path}`, body, {
        headers: { Authorization: `Bearer ${cred.accessToken}` },
        timeout: 30000,
      });
      return res.data;
    } catch (err: any) {
      const e = err?.response?.data?.error;
      // 131047 = fora da janela de 24h (precisa de template)
      const msg = e?.code === 131047
        ? 'Fora da janela de 24h: o contato precisa mandar mensagem antes, ou use um template aprovado.'
        : (e?.message ?? err.message);
      throw new BadRequestException(msg);
    }
  }

  async sendText(tenantId: string, to: string, text: string, replyToExternalId?: string) {
    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.toWaId(to),
      type: 'text',
      text: { body: text, preview_url: true },
    };
    if (replyToExternalId) body.context = { message_id: replyToExternalId };
    const data = await this.post(tenantId, 'messages', body);
    return { externalId: data?.messages?.[0]?.id ?? null };
  }

  async sendMedia(
    tenantId: string,
    to: string,
    base64: string,
    mediatype: 'image' | 'video' | 'document' | 'audio',
    filename: string,
    caption: string,
  ) {
    const cred = await this.getCredential(tenantId);
    if (!cred) throw new NotFoundException('WhatsApp oficial não conectado.');

    const match = base64.match(/^data:([^;]+);base64,(.*)$/);
    const mime = match?.[1] || 'application/octet-stream';
    const buffer = Buffer.from(match?.[2] ?? base64, 'base64');

    // Upload da mídia (multipart) → media id
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append('file', new Blob([buffer], { type: mime }), filename || 'arquivo');
    let mediaId: string;
    try {
      const up = await axios.post(`${this.graphUrl}/${cred.phoneNumberId}/media`, form, {
        headers: { Authorization: `Bearer ${cred.accessToken}` },
        timeout: 60000,
        maxBodyLength: Infinity,
      });
      mediaId = up.data?.id;
    } catch (err: any) {
      throw new BadRequestException(`Falha no upload da mídia: ${err?.response?.data?.error?.message ?? err.message}`);
    }

    const media: any = { id: mediaId };
    if (caption && mediatype !== 'audio') media.caption = caption;
    if (mediatype === 'document') media.filename = filename;

    const data = await this.post(tenantId, 'messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.toWaId(to),
      type: mediatype,
      [mediatype]: media,
    });
    return { externalId: data?.messages?.[0]?.id ?? null, mediaId };
  }

  /** Baixa uma mídia da Cloud API e devolve como data URI. */
  async downloadMedia(tenantId: string, mediaId: string) {
    const cred = await this.getCredential(tenantId);
    if (!cred) throw new NotFoundException('WhatsApp oficial não conectado.');
    const auth = { Authorization: `Bearer ${cred.accessToken}` };
    const meta = await axios.get(`${this.graphUrl}/${mediaId}`, { headers: auth, timeout: 15000 });
    const file = await axios.get(meta.data.url, { headers: auth, responseType: 'arraybuffer', timeout: 60000 });
    const mime = meta.data.mime_type || 'application/octet-stream';
    return `data:${mime};base64,${Buffer.from(file.data).toString('base64')}`;
  }

  // ── Webhook ────────────────────────────────────────────────────────────────

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.META_APP_SECRET;
    if (!secret) {
      this.logger.warn('[Cloud] META_APP_SECRET ausente — assinatura do webhook NÃO verificada');
      return true;
    }
    if (!rawBody || !signature?.startsWith('sha256=')) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  async processWebhook(payload: any) {
    if (payload?.object !== 'whatsapp_business_account') return;
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        try {
          await this.handleChange(change.field, change.value ?? {});
        } catch (err: any) {
          this.logger.error(`[Cloud] Erro processando ${change.field}: ${err.message}`);
        }
      }
    }
  }

  private async handleChange(field: string, value: any) {
    const phoneNumberId = value?.metadata?.phone_number_id;
    const cred = phoneNumberId
      ? await this.prisma.metaCredential.findFirst({ where: { phoneNumberId }, select: { tenantId: true } })
      : null;
    if (!cred) {
      this.logger.warn(`[Cloud] Webhook ${field} para phone_number_id desconhecido: ${phoneNumberId}`);
      return;
    }
    const tenantId = cred.tenantId;
    const businessNumber = (value?.metadata?.display_phone_number || '').replace(/\D/g, '');

    if (field === 'messages') {
      const names = new Map<string, string>();
      for (const c of value.contacts ?? []) names.set(c.wa_id, c.profile?.name);
      for (const m of value.messages ?? []) {
        await this.saveMessage(tenantId, m.from, names.get(m.from) || null, 'INBOUND', m);
      }
      for (const s of value.statuses ?? []) await this.applyStatus(s);
      return;
    }

    // Coexistência: mensagens enviadas pelo app WhatsApp Business do celular
    if (field === 'smb_message_echoes') {
      for (const m of value.message_echoes ?? []) {
        await this.saveMessage(tenantId, m.to, null, 'OUTBOUND', m);
      }
      return;
    }

    // Coexistência: histórico importado do app (até 6 meses)
    if (field === 'history') {
      for (const h of value.history ?? []) {
        for (const thread of h.threads ?? []) {
          const customer = thread.id;
          for (const m of thread.messages ?? []) {
            const fromBusiness = (m.from || '').replace(/\D/g, '') === businessNumber;
            await this.saveMessage(tenantId, customer, null, fromBusiness ? 'OUTBOUND' : 'INBOUND', m, { history: true });
          }
        }
      }
      return;
    }

    // Coexistência: agenda de contatos do app
    if (field === 'smb_app_state_sync') {
      for (const item of value.state_sync ?? []) {
        if (item.type !== 'contact' || item.action === 'remove') continue;
        const phone = `+${this.toWaId(item.contact?.phone_number || '')}`;
        const name = item.contact?.full_name || item.contact?.first_name;
        if (phone.length < 8 || !name) continue;
        await this.prisma.contact.updateMany({ where: { tenantId, phone }, data: { name } });
      }
      return;
    }

    this.logger.log(`[Cloud] Campo de webhook ignorado: ${field}`);
  }

  private parseMessage(m: any): ParsedMessage {
    const quotedExternalId = m.context?.id ?? null;
    switch (m.type) {
      case 'text':
        return { type: 'TEXT', content: m.text?.body ?? '', mediaId: null, quotedExternalId };
      case 'image':
        return { type: 'IMAGE', content: m.image?.caption || '[imagem]', mediaId: m.image?.id ?? null, quotedExternalId };
      case 'sticker':
        return { type: 'IMAGE', content: '[figurinha]', mediaId: m.sticker?.id ?? null, quotedExternalId };
      case 'video':
        return { type: 'VIDEO', content: m.video?.caption || '[vídeo]', mediaId: m.video?.id ?? null, quotedExternalId };
      case 'audio':
        return { type: 'AUDIO', content: '[áudio]', mediaId: m.audio?.id ?? null, quotedExternalId };
      case 'document':
        return { type: 'DOCUMENT', content: m.document?.filename || m.document?.caption || '[documento]', mediaId: m.document?.id ?? null, quotedExternalId };
      case 'button':
        return { type: 'INTERACTIVE', content: m.button?.text ?? '[botão]', mediaId: null, quotedExternalId };
      case 'interactive':
        return {
          type: 'INTERACTIVE',
          content: m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '[resposta]',
          mediaId: null,
          quotedExternalId,
        };
      case 'location':
        return { type: 'TEXT', content: `📍 ${m.location?.name || ''} https://maps.google.com/?q=${m.location?.latitude},${m.location?.longitude}`.trim(), mediaId: null, quotedExternalId };
      case 'contacts':
        return { type: 'TEXT', content: `👤 ${m.contacts?.map((c: any) => c.name?.formatted_name).join(', ') || 'contato'}`, mediaId: null, quotedExternalId };
      case 'reaction':
        return { type: 'TEXT', content: `${m.reaction?.emoji || ''} (reação)`, mediaId: null, quotedExternalId: m.reaction?.message_id ?? null };
      default:
        return { type: 'TEXT', content: `[${m.type || 'mensagem'}]`, mediaId: null, quotedExternalId };
    }
  }

  /** Encontra/cria contato e conversa pelo número e grava a mensagem (idempotente pelo wamid). */
  private async saveMessage(
    tenantId: string,
    customerWaId: string,
    profileName: string | null,
    direction: 'INBOUND' | 'OUTBOUND',
    m: any,
    opts: { history?: boolean } = {},
  ) {
    if (!customerWaId || !m?.id) return;
    if (m.type === 'reaction' && !m.reaction?.emoji) return; // remoção de reação

    const already = await this.prisma.message.findFirst({ where: { externalId: m.id }, select: { id: true } });
    if (already) return;

    const raw = this.toWaId(customerWaId);
    const phone = `+${raw}`;
    // Brasil: variantes com e sem o nono dígito
    const variants = [phone];
    if (raw.startsWith('55') && raw.length === 12) variants.push(`+${raw.slice(0, 4)}9${raw.slice(4)}`);
    if (raw.startsWith('55') && raw.length === 13) variants.push(`+${raw.slice(0, 4)}${raw.slice(5)}`);

    let contact = await this.prisma.contact.findFirst({ where: { tenantId, phone: { in: variants } } });
    const isNewContact = !contact;
    if (!contact) {
      contact = await this.prisma.contact.create({
        data: { tenantId, name: profileName || phone, phone, leadScore: 0, qualification: 'UNQUALIFIED', type: 'LEAD' },
      });
    } else if (profileName && contact.name === contact.phone) {
      contact = await this.prisma.contact.update({ where: { id: contact.id }, data: { name: profileName } });
    }

    let conv = await this.prisma.conversation.findFirst({
      where: { tenantId, channel: 'WHATSAPP', contactId: contact.id },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: { tenantId, channel: 'WHATSAPP', status: 'OPEN', contactId: contact.id, externalId: `${raw}@s.whatsapp.net` },
      });
    }

    const parsed = this.parseMessage(m);
    const sentAt = m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date();

    await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction,
        type: parsed.type,
        content: parsed.content,
        mediaId: parsed.mediaId,
        externalId: m.id,
        quotedExternalId: parsed.quotedExternalId,
        sentAt,
      },
    });

    if (!opts.history) {
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data: { updatedAt: new Date(), ...(direction === 'INBOUND' && conv.status === 'RESOLVED' ? { status: 'OPEN' } : {}) },
      });
    }

    // Alimenta o funil: lead novo que chamou agora cai na 1ª etapa
    if (direction === 'INBOUND' && !opts.history) {
      await this.funnel.ensureLead(tenantId, contact.id, isNewContact ? 'Origem: WhatsApp' : undefined);
    }
  }

  private async applyStatus(s: any) {
    if (!s?.id) return;
    const at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
    const data: any = {};
    if (s.status === 'delivered') data.deliveredAt = at;
    if (s.status === 'read') data.readAt = at;
    if (s.status === 'failed') data.errorCode = String(s.errors?.[0]?.code ?? 'failed');
    if (Object.keys(data).length === 0) return;
    await this.prisma.message.updateMany({ where: { externalId: s.id }, data });
  }
}
