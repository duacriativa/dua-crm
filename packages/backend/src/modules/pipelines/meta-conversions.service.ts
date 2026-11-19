import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

/** Eventos aceitos pela Conversions API com action_source = business_messaging. */
export const META_EVENTS = ['LeadSubmitted', 'QualifiedLead', 'InitiateCheckout', 'Purchase'] as const;
export type MetaEventName = (typeof META_EVENTS)[number];

export function isMetaEvent(v: unknown): v is MetaEventName {
  return typeof v === 'string' && (META_EVENTS as readonly string[]).includes(v);
}

/** Evento que a etapa dispara: o escolhido, ou o padrão (1ª etapa = lead, etapa de ganho = venda). */
export function stageMetaEvent(stage: { metaEvent: string | null; kind: string; position: number }): MetaEventName | null {
  if (stage.metaEvent === 'NONE') return null;
  if (isMetaEvent(stage.metaEvent)) return stage.metaEvent;
  if (stage.kind === 'WON') return 'Purchase';
  if (stage.position === 0 && stage.kind === 'OPEN') return 'LeadSubmitted';
  return null;
}

/**
 * Envia eventos do funil para a Meta (Conversions API para Business Messaging),
 * para as campanhas Click-to-WhatsApp otimizarem por lead qualificado / venda
 * e não só por "conversa iniciada".
 *
 * Lead de anúncio Click-to-WhatsApp (tem adCtwaClid) vai para o dataset da WABA.
 * Os demais (leads do site) vão para o Pixel do site (META_PIXEL_ID + META_PIXEL_TOKEN),
 * casados por telefone/e-mail com hash e pelo fbc/fbp que o site manda no formulário.
 * "Lead" do site o próprio site já envia, então aí o CRM só manda as etapas seguintes.
 *
 * Escuta "funnel.stage_entered" (card movido) e "funnel.lead_created" (card novo);
 * quem move cards sem emitir esses eventos chama onLeadInStage direto.
 *
 * O token salvo em MetaCredential precisa da permissão whatsapp_business_manage_events.
 * Desligar: META_CAPI_ENABLED=false.
 */
@Injectable()
export class MetaConversionsService {
  private readonly logger = new Logger(MetaConversionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  private get graphUrl() {
    return `https://graph.facebook.com/${process.env.GRAPH_API_VERSION || 'v23.0'}`;
  }

  private get enabled() {
    return process.env.META_CAPI_ENABLED !== 'false';
  }

  @OnEvent('funnel.stage_entered', { async: true })
  async onStageEnteredEvent(e: { tenantId: string; contactId: string; stageId: string }) {
    await this.onLeadInStage(e.tenantId, e.contactId, e.stageId);
  }

  @OnEvent('funnel.lead_created', { async: true })
  async onLeadCreatedEvent(e: { tenantId: string; contactId: string }) {
    // Card recém-criado: a etapa é a do card mais novo do contato
    const lead = await this.prisma.pipelineLead.findFirst({
      where: { contactId: e.contactId, stage: { pipeline: { tenantId: e.tenantId } } },
      orderBy: { createdAt: 'desc' },
      select: { stageId: true },
    });
    if (lead) await this.onLeadInStage(e.tenantId, e.contactId, lead.stageId);
  }

  /** Card do contato está na etapa `stageId`: envia o evento da etapa, se houver. Nunca lança erro. */
  async onLeadInStage(tenantId: string, contactId: string, stageId: string) {
    try {
      const stage = await this.prisma.pipelineStage.findFirst({
        where: { id: stageId, pipeline: { tenantId } },
        select: { id: true, metaEvent: true, kind: true, position: true },
      });
      if (!stage) return;
      const eventName = stageMetaEvent(stage);
      if (!eventName) return;
      const lead = await this.prisma.pipelineLead.findFirst({ where: { contactId, stageId }, select: { value: true } });
      await this.send(tenantId, contactId, eventName, { value: lead?.value ?? null, stageId: stage.id });
    } catch (err: any) {
      this.logger.warn(`[CAPI] Falha ao processar etapa ${stageId} do contato ${contactId}: ${err.message}`);
    }
  }

  /** Mesmo que onLeadInStage, sem bloquear quem chamou. */
  fireLeadInStage(tenantId: string, contactId: string, stageId: string) {
    void this.onLeadInStage(tenantId, contactId, stageId);
  }

  async send(tenantId: string, contactId: string, eventName: MetaEventName, opts: { value?: number | null; stageId?: string } = {}) {
    if (!this.enabled) return { status: 'DISABLED' as const };

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, adCtwaClid: true, phone: true, email: true, metaFbc: true, metaFbp: true },
    });
    if (!contact) return { status: 'NO_CONTACT' as const };

    // Dois caminhos:
    //  - veio de anúncio Click-to-WhatsApp (tem ctwa_clid) → dataset da WABA, business_messaging
    //  - demais leads (site) → Pixel do site, casando por telefone/e-mail (hash) e fbc/fbp
    const viaWhatsApp = !!contact.adCtwaClid;
    const pixelId = process.env.META_PIXEL_ID;
    const pixelToken = process.env.META_PIXEL_TOKEN;
    if (!viaWhatsApp) {
      // O site já manda "Lead" sozinho para o Pixel: o CRM só manda o que acontece depois
      if (eventName === 'LeadSubmitted') return { status: 'SITE_SENDS_LEAD' as const };
      if (!pixelId || !pixelToken) return { status: 'NO_PIXEL' as const };
      if (!contact.phone && !contact.email) return { status: 'NO_MATCH_KEYS' as const };
    }

    // Mesmo evento para o mesmo lead (e o mesmo clique) só vai uma vez
    const eventId = crypto
      .createHash('sha256')
      .update(`${contact.id}|${eventName}|${contact.adCtwaClid ?? 'pixel'}`)
      .digest('hex')
      .slice(0, 32);
    const already = await this.prisma.metaEventLog.findFirst({
      where: { tenantId, eventId, status: 'SENT' },
      select: { id: true },
    });
    if (already) return { status: 'DUPLICATE' as const };

    const log = (status: 'SENT' | 'SKIPPED' | 'FAILED', error?: string) =>
      this.prisma.metaEventLog.create({
        data: {
          tenantId,
          contactId: contact.id,
          eventName: viaWhatsApp ? eventName : `pixel:${eventName}`,
          eventId,
          stageId: opts.stageId ?? null,
          value: opts.value ?? null,
          status,
          error: error?.slice(0, 500) ?? null,
        },
      });

    let datasetId: string;
    let accessToken: string;
    const event: any = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
    };

    if (viaWhatsApp) {
      const cred = await this.prisma.metaCredential.findUnique({ where: { tenantId } });
      if (!cred) {
        await log('SKIPPED', 'WhatsApp oficial não conectado');
        return { status: 'SKIPPED' as const };
      }
      accessToken = this.encryption.decrypt(cred.accessToken);
      try {
        datasetId = cred.datasetId || (await this.ensureDataset(tenantId, cred.wabaId, accessToken));
      } catch (err: any) {
        const msg = this.graphError(err);
        await log('FAILED', `Dataset: ${msg}`);
        this.logger.warn(`[CAPI] Não foi possível obter o dataset da WABA ${cred.wabaId}: ${msg}`);
        return { status: 'FAILED' as const, error: msg };
      }
      event.action_source = 'business_messaging';
      event.messaging_channel = 'whatsapp';
      event.user_data = { whatsapp_business_account_id: cred.wabaId, ctwa_clid: contact.adCtwaClid };
    } else {
      datasetId = pixelId!;
      accessToken = pixelToken!;
      // Evento gerado pelo CRM (não por uma página): system_generated
      event.action_source = 'system_generated';
      const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
      const userData: any = { external_id: [sha(contact.id)], country: [sha('br')] };
      const digits = (contact.phone || '').replace(/\D/g, '');
      if (digits) userData.ph = [sha(digits)];
      const email = (contact.email || '').trim().toLowerCase();
      if (email) userData.em = [sha(email)];
      if (contact.metaFbc) userData.fbc = contact.metaFbc;
      if (contact.metaFbp) userData.fbp = contact.metaFbp;
      event.user_data = userData;
    }
    if (eventName === 'Purchase' || (opts.value && opts.value > 0)) {
      event.custom_data = { currency: 'BRL', value: Number(opts.value ?? 0) };
    }

    try {
      await axios.post(
        `${this.graphUrl}/${datasetId}/events`,
        { data: [event], ...(process.env.META_CAPI_TEST_CODE ? { test_event_code: process.env.META_CAPI_TEST_CODE } : {}) },
        { params: { access_token: accessToken }, timeout: 15000 },
      );
      await log('SENT');
      this.logger.log(`[CAPI] ${eventName} enviado via ${viaWhatsApp ? 'WhatsApp' : 'Pixel'} (contato ${contact.id}${opts.value ? `, R$${opts.value}` : ''})`);
      return { status: 'SENT' as const };
    } catch (err: any) {
      const msg = this.graphError(err);
      await log('FAILED', msg);
      this.logger.warn(`[CAPI] ${eventName} falhou (contato ${contact.id}): ${msg}`);
      return { status: 'FAILED' as const, error: msg };
    }
  }

  /** Dataset da CAPI ligado à WABA: busca o existente ou cria (a Meta devolve o mesmo id). */
  private async ensureDataset(tenantId: string, wabaId: string, accessToken: string) {
    const auth = { params: { access_token: accessToken }, timeout: 15000 };
    let id: string | undefined;
    try {
      const res = await axios.get(`${this.graphUrl}/${wabaId}/dataset`, auth);
      id = res.data?.data?.[0]?.id ?? res.data?.id;
    } catch {
      /* sem dataset ainda: cria abaixo */
    }
    if (!id) {
      const res = await axios.post(`${this.graphUrl}/${wabaId}/dataset`, {}, auth);
      id = res.data?.id;
    }
    if (!id) throw new Error('A Meta não retornou o id do dataset.');
    await this.prisma.metaCredential.update({ where: { tenantId }, data: { datasetId: id } });
    this.logger.log(`[CAPI] Dataset ${id} ligado à WABA ${wabaId}`);
    return id;
  }

  private graphError(err: any): string {
    const e = err?.response?.data?.error;
    return e?.error_user_msg || e?.message || err?.message || 'erro desconhecido';
  }

  /** Últimos envios, para conferir na tela. */
  async recent(tenantId: string, limit = 50) {
    return this.prisma.metaEventLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
