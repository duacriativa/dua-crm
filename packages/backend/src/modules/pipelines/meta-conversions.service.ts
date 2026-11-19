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
 * Só contatos que chegaram por anúncio (têm adCtwaClid, gravado pelo webhook do
 * WhatsApp a partir do "referral") são enviados: é ele que liga o evento ao clique.
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
      select: { id: true, adCtwaClid: true },
    });
    // Sem clique em anúncio não há como atribuir: nada a enviar
    if (!contact?.adCtwaClid) return { status: 'NO_CTWA' as const };

    // Mesmo evento para o mesmo clique só vai uma vez (lead indo e voltando de etapa)
    const eventId = crypto
      .createHash('sha256')
      .update(`${contact.id}|${eventName}|${contact.adCtwaClid}`)
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
          eventName,
          eventId,
          stageId: opts.stageId ?? null,
          value: opts.value ?? null,
          status,
          error: error?.slice(0, 500) ?? null,
        },
      });

    const cred = await this.prisma.metaCredential.findUnique({ where: { tenantId } });
    if (!cred) {
      await log('SKIPPED', 'WhatsApp oficial não conectado');
      return { status: 'SKIPPED' as const };
    }
    const accessToken = this.encryption.decrypt(cred.accessToken);

    let datasetId: string;
    try {
      datasetId = cred.datasetId || (await this.ensureDataset(tenantId, cred.wabaId, accessToken));
    } catch (err: any) {
      const msg = this.graphError(err);
      await log('FAILED', `Dataset: ${msg}`);
      this.logger.warn(`[CAPI] Não foi possível obter o dataset da WABA ${cred.wabaId}: ${msg}`);
      return { status: 'FAILED' as const, error: msg };
    }

    const event: any = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: {
        whatsapp_business_account_id: cred.wabaId,
        ctwa_clid: contact.adCtwaClid,
      },
    };
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
      this.logger.log(`[CAPI] ${eventName} enviado (contato ${contact.id}${opts.value ? `, R$${opts.value}` : ''})`);
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
