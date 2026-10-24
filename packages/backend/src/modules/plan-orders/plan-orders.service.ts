import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PlanOrder } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { FunnelService } from '../pipelines/funnel.service';
import { PushService } from '../notifications/push.service';
import { InstagramProfileService, normalizeInstagramHandle } from '../contacts/instagram-profile.service';
import { normalizePhone, phoneVariants } from '../../common/phone.util';
import {
  PLAN_FORM_OPTIONS, PLAN_TAGS, PlanAnswers, PlanStatus, planConfig, planOrderUrl, planPdfUrl,
} from './plan.config';
import { PLAN_PARTS, PlanContent, PlanPart, generatePlan } from './plan-generator';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PAID_EVENTS = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'];
const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
/** Geração parada há mais que isso (ex.: o servidor reiniciou no meio) pode ser disparada de novo. */
const STALE_GENERATION_MS = 15 * 60_000;

/** Valida CPF (11 dígitos) ou CNPJ (14) pelos dígitos verificadores. */
export function validCpfCnpj(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (!/^\d{11}$|^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((s, w, k) => s + Number(base[k]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (d.length === 11) {
    const w1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calc(d, w1);
    const d2 = calc(d, [11, ...w1]);
    return d1 === Number(d[9]) && d2 === Number(d[10]);
  }
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(d, w1);
  const d2 = calc(d, [6, ...w1]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/** Data (AAAA-MM-DD) de amanhã em Brasília: vencimento do Pix. */
function tomorrowBr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + 86400_000));
}

const fmtWhen = (d: Date) =>
  d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Pedidos do plano de 3 meses: formulário público → Pix (Asaas) → webhook/pagamento →
 * geração com Claude → revisão humana → entrega manual (PDF + texto para o WhatsApp Business).
 */
@Injectable()
export class PlanOrdersService {
  private readonly logger = new Logger(PlanOrdersService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
    private readonly funnel: FunnelService,
    private readonly push: PushService,
    private readonly instagramProfile: InstagramProfileService,
  ) {}

  private async tenantId() {
    const t = await this.prisma.tenant.findUnique({ where: { slug: planConfig().tenantSlug }, select: { id: true } });
    if (!t) throw new ServiceUnavailableException('Página indisponível no momento.');
    return t.id;
  }

  // ── Página pública ────────────────────────────────────────────────────────

  /** Dados da página de venda; com o token do diagnóstico, já devolve o contato para preencher o formulário. */
  async publicInfo(diagnosisToken?: string) {
    const c = planConfig();
    let prefill: Record<string, string> | null = null;
    if (diagnosisToken) {
      const d = await this.prisma.instagramDiagnosis.findUnique({
        where: { token: String(diagnosisToken) },
        include: { contact: { select: { name: true, phone: true, email: true } } },
      });
      if (d) {
        prefill = {
          name: d.contact.name ?? '',
          phone: (d.contact.phone ?? '').replace(/^\+55/, ''),
          email: d.contact.email ?? '',
          instagramHandle: d.instagramHandle,
        };
      }
    }
    return {
      productName: c.productName, price: c.price, deliveryHours: c.deliveryHours,
      options: PLAN_FORM_OPTIONS, prefill, sandbox: this.asaas.isSandbox,
    };
  }

  async create(body: any) {
    const c = planConfig();
    const s = (v: any, max: number) => String(v ?? '').trim().slice(0, max);
    const name = s(body?.name, 120);
    const email = s(body?.email, 200).toLowerCase();
    const phone = normalizePhone(s(body?.phone, 40));
    const cpfCnpj = s(body?.cpfCnpj, 20).replace(/\D/g, '');
    const instagramHandle = normalizeInstagramHandle(s(body?.instagramHandle, 120));
    const answers: PlanAnswers = {
      nicho: s(body?.nicho, 300), ticket: s(body?.ticket, 60), publico: s(body?.publico, 500),
      quemPosta: s(body?.quemPosta, 80), verba: s(body?.verba, 80), observacoes: s(body?.observacoes, 1000) || undefined,
    };
    const diagnosisToken = s(body?.diagnosisToken, 64) || null;

    if (name.length < 2) throw new BadRequestException('Informe seu nome.');
    if (!phone || phone.length < 12 || phone.length > 16) throw new BadRequestException('Informe um WhatsApp válido com DDD.');
    if (!EMAIL_RE.test(email)) throw new BadRequestException('Informe um e-mail válido.');
    if (!validCpfCnpj(cpfCnpj)) throw new BadRequestException('Informe um CPF ou CNPJ válido (é exigido para emitir o Pix).');
    if (!/^[a-z0-9._]{1,30}$/.test(instagramHandle)) throw new BadRequestException('Informe o @ do Instagram da marca.');
    if (answers.nicho.length < 2) throw new BadRequestException('Conte qual é o produto ou nicho da marca.');
    if (!answers.ticket) throw new BadRequestException('Informe o ticket médio.');
    if (answers.publico.length < 2) throw new BadRequestException('Conte quem é o seu público.');
    if (!answers.quemPosta) throw new BadRequestException('Diga quem posta hoje.');
    if (!answers.verba) throw new BadRequestException('Escolha a verba mensal.');

    const tenantId = await this.tenantId();
    const contact = await this.upsertContact(tenantId, { name, phone, email, instagramHandle });

    // Mesma pessoa reenviando o formulário com o Pix ainda aberto: reaproveita a cobrança
    const open = await this.prisma.planOrder.findFirst({
      where: { tenantId, cpfCnpj, status: 'AWAITING_PAYMENT', asaasPaymentId: { not: null }, createdAt: { gt: new Date(Date.now() - 20 * 3600_000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (open && open.value === c.price) {
      await this.prisma.planOrder.update({
        where: { id: open.id },
        data: { name, phone, email, instagramHandle, answers: answers as any, contactId: contact.id, diagnosisToken: diagnosisToken ?? open.diagnosisToken },
      });
      return { token: open.token };
    }

    let order = await this.prisma.planOrder.create({
      data: {
        tenantId, contactId: contact.id, token: crypto.randomBytes(24).toString('base64url'),
        productName: c.productName, value: c.price, name, phone, email, cpfCnpj, instagramHandle,
        answers: answers as any, diagnosisToken,
      },
    });

    try {
      const customer = await this.asaas.findOrCreateCustomer({
        name, cpfCnpj, email, mobilePhone: phone.replace(/^\+55/, ''), externalReference: contact.id,
      });
      const payment = await this.asaas.createPixPayment({
        customer: customer.id, value: c.price, dueDate: tomorrowBr(),
        description: `${c.productName} - @${instagramHandle}`, externalReference: order.id,
      });
      const qr = await this.asaas.getPixQrCode(payment.id);
      order = await this.prisma.planOrder.update({
        where: { id: order.id },
        data: {
          asaasCustomerId: customer.id, asaasPaymentId: payment.id, pixPayload: qr.payload, pixQrImage: qr.encodedImage,
          pixExpiresAt: qr.expirationDate ? new Date(qr.expirationDate.replace(' ', 'T') + '-03:00') : null,
        },
      });
    } catch (err: any) {
      this.logger.error(`[Plano] Falha ao gerar o Pix do pedido ${order.id}: ${err.message}`);
      await this.prisma.planOrder.update({ where: { id: order.id }, data: { status: 'CANCELED', notes: `Pix não gerado: ${String(err.message).slice(0, 300)}` } });
      throw new ServiceUnavailableException('Não conseguimos gerar o Pix agora. Tente de novo em alguns minutos ou fale com a gente no WhatsApp.');
    }

    await this.note(order, `🧾 Pedido do ${c.productName} (R$ ${c.price}) criado pela página. Aguardando o Pix.`);
    return { token: order.token };
  }

  /** Página de acompanhamento do cliente. Enquanto não pagou, confere o Asaas a cada 15s (caso o webhook atrase). */
  async publicOrder(token: string) {
    let o = await this.byToken(token);
    if (o.status === 'AWAITING_PAYMENT' && (!o.paymentCheckedAt || Date.now() - o.paymentCheckedAt.getTime() > 15_000)) {
      o = (await this.syncPayment(o)) ?? o;
    }
    const delivered = !!o.reviewedAt && ['IN_REVIEW', 'DELIVERED'].includes(o.status);
    return {
      productName: o.productName, value: o.value, name: o.name, instagramHandle: o.instagramHandle,
      status: o.status === 'PAID' ? 'IN_PRODUCTION' : o.status, // cliente não precisa ver a diferença
      paid: !!o.paidAt, paidAt: o.paidAt, dueAt: o.dueAt, deliveryHours: planConfig().deliveryHours,
      pix: o.status === 'AWAITING_PAYMENT' ? { payload: o.pixPayload, qrImage: o.pixQrImage, expiresAt: o.pixExpiresAt } : null,
      pdfUrl: delivered ? `/api/v1/public/plano/pedido/${o.token}/pdf` : null,
    };
  }

  async byToken(token: string) {
    const o = await this.prisma.planOrder.findUnique({ where: { token: String(token ?? '') } });
    if (!o) throw new NotFoundException('Pedido não encontrado.');
    return o;
  }

  /** PDF para o cliente: só depois da revisão da equipe. */
  async publicPdfOrder(token: string) {
    const o = await this.byToken(token);
    if (!o.reviewedAt || !o.plan || !['IN_REVIEW', 'DELIVERED'].includes(o.status)) throw new NotFoundException('O plano ainda está em produção.');
    return o;
  }

  // ── Pagamento ─────────────────────────────────────────────────────────────

  /** Webhook do Asaas (POST /webhooks/asaas). Não confia no corpo: confere o status direto na API. */
  async handleAsaasEvent(event: string, payment: any, accessToken?: string) {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expected && accessToken !== expected) {
      this.logger.warn('[Plano] Webhook do Asaas com token inválido: ignorado para pedidos do plano');
      return;
    }
    if (!PAID_EVENTS.includes(event) || !payment?.id) return;
    const order = await this.prisma.planOrder.findUnique({ where: { asaasPaymentId: String(payment.id) } });
    if (!order || order.status !== 'AWAITING_PAYMENT') return;
    await this.syncPayment(order);
  }

  /** Consulta a cobrança no Asaas; se paga, marca o pedido. Nunca lança erro. */
  async syncPayment(order: PlanOrder): Promise<PlanOrder | null> {
    if (!order.asaasPaymentId) return null;
    try {
      const p = await this.asaas.getPayment(order.asaasPaymentId);
      if (PAID_STATUSES.includes(p.status)) {
        return this.markPaid(order.id);
      }
      return this.prisma.planOrder.update({ where: { id: order.id }, data: { paymentCheckedAt: new Date() } });
    } catch (err: any) {
      this.logger.warn(`[Plano] Falha ao consultar o pagamento ${order.asaasPaymentId}: ${err.message}`);
      return null;
    }
  }

  /** Marca como pago (uma vez só), avisa a equipe e começa a gerar o plano. */
  async markPaid(orderId: string, paidAt = new Date()) {
    const due = new Date(paidAt.getTime() + planConfig().deliveryHours * 3600_000);
    const res = await this.prisma.planOrder.updateMany({
      where: { id: orderId, status: 'AWAITING_PAYMENT' },
      data: { status: 'PAID', paidAt, dueAt: due, paymentCheckedAt: new Date() },
    });
    const order = await this.prisma.planOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (res.count === 0) return order;

    this.logger.log(`💰 [Plano] Pedido ${order.id} pago (@${order.instagramHandle})`);
    const contact = await this.prisma.contact.findUnique({ where: { id: order.contactId }, select: { tags: true } });
    if (contact && !contact.tags.includes(PLAN_TAGS.paid)) {
      await this.prisma.contact.update({ where: { id: order.contactId }, data: { tags: [...contact.tags, PLAN_TAGS.paid] } });
    }
    const stage = planConfig().funnelStage;
    if (stage) await this.funnel.advanceTo(order.tenantId, order.contactId, stage, `Comprou o ${order.productName}`);
    else await this.funnel.ensureLead(order.tenantId, order.contactId, `Comprou o ${order.productName}`);
    await this.note(order, `💰 Pix de R$ ${order.value} confirmado. Entrega até ${fmtWhen(due)}.`);
    this.push.sendToTenant(order.tenantId, {
      title: `${order.productName}: pagamento confirmado`,
      body: `${order.name} (@${order.instagramHandle}) — entregar até ${fmtWhen(due)}`,
      url: `/dashboard/planos/${order.id}`,
      tag: `plan-${order.id}`,
    });
    this.startGeneration(order.id);
    return order;
  }

  // ── Geração ───────────────────────────────────────────────────────────────

  /** Dispara a geração em segundo plano. `part` gera de novo só uma parte do plano. */
  startGeneration(orderId: string, part?: PlanPart) {
    if (this.running.has(orderId)) return false;
    this.running.add(orderId);
    this.generate(orderId, part)
      .catch((err) => this.logger.error(`[Plano] Geração do pedido ${orderId} falhou: ${err.message}`))
      .finally(() => this.running.delete(orderId));
    return true;
  }

  private async generate(orderId: string, part?: PlanPart) {
    const order = await this.prisma.planOrder.findUniqueOrThrow({ where: { id: orderId } });
    await this.prisma.planOrder.update({
      where: { id: orderId },
      data: {
        generationState: 'RUNNING', generationError: null, generationStartedAt: new Date(),
        // Plano inteiro novo volta para produção; refazer uma parte mantém em revisão
        ...(part ? {} : { status: 'IN_PRODUCTION' }), reviewedAt: null, reviewedBy: null,
      },
    });
    try {
      const profile = await this.instagramProfile.fetch(order.instagramHandle);
      const plan = await generatePlan(
        {
          productName: order.productName, brandName: order.name, instagramHandle: order.instagramHandle,
          answers: order.answers as unknown as PlanAnswers, profile: profile.data, profileReason: profile.reason,
        },
        part ? (order.plan as unknown as PlanContent) : null,
        part,
      );
      await this.prisma.planOrder.update({
        where: { id: orderId },
        data: {
          plan: { ...plan, perfilLido: !!profile.data } as any, generationState: 'DONE', generatedAt: new Date(),
          status: 'IN_REVIEW',
        },
      });
      this.push.sendToTenant(order.tenantId, {
        title: `${order.productName} pronto para revisão`,
        body: `${order.name} (@${order.instagramHandle})`,
        url: `/dashboard/planos/${order.id}`,
        tag: `plan-${order.id}`,
      });
    } catch (err: any) {
      await this.prisma.planOrder.update({
        where: { id: orderId },
        data: { generationState: 'ERROR', generationError: String(err.message ?? err).slice(0, 500) },
      });
      throw err;
    }
  }

  // ── Equipe ────────────────────────────────────────────────────────────────

  async list(tenantId: string, status?: string) {
    const orders = await this.prisma.planOrder.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true, status: true, productName: true, value: true, name: true, phone: true, email: true, instagramHandle: true,
        createdAt: true, paidAt: true, dueAt: true, deliveredAt: true, reviewedAt: true, generationState: true, generationError: true,
        contactId: true,
      },
    });
    const now = Date.now();
    return orders.map((o) => ({ ...o, late: this.isLate(o, now) }));
  }

  private isLate(o: { status: string; dueAt: Date | null }, now = Date.now()) {
    return !!o.dueAt && o.dueAt.getTime() < now && !['DELIVERED', 'CANCELED'].includes(o.status);
  }

  async get(tenantId: string, id: string) {
    const o = await this.prisma.planOrder.findFirst({ where: { id, tenantId } });
    if (!o) throw new NotFoundException('Pedido não encontrado.');
    const stale = o.generationState === 'RUNNING' && !this.running.has(o.id) &&
      (!o.generationStartedAt || Date.now() - o.generationStartedAt.getTime() > STALE_GENERATION_MS);
    const { pixQrImage, ...rest } = o;
    return {
      ...rest,
      generating: this.running.has(o.id),
      generationState: stale ? 'ERROR' : o.generationState,
      generationError: stale ? 'A geração foi interrompida (o servidor reiniciou?). Gere de novo.' : o.generationError,
      late: this.isLate(o),
      clientUrl: planOrderUrl(o.token),
      pdfUrl: o.reviewedAt ? planPdfUrl(o.token) : null,
      whatsappText: o.reviewedAt ? this.whatsappText(o) : null,
      sandbox: this.asaas.isSandbox,
    };
  }

  async generateFromTeam(tenantId: string, id: string, part?: string) {
    const o = await this.prisma.planOrder.findFirst({ where: { id, tenantId } });
    if (!o) throw new NotFoundException('Pedido não encontrado.');
    if (!o.paidAt) throw new BadRequestException('O pedido ainda não foi pago.');
    if (o.status === 'DELIVERED' || o.status === 'CANCELED') throw new BadRequestException('Volte o pedido para revisão antes de gerar de novo.');
    if (part && !PLAN_PARTS.includes(part as PlanPart)) throw new BadRequestException('Parte inválida.');
    if (part && !o.plan) throw new BadRequestException('Gere o plano inteiro primeiro.');
    if (!this.startGeneration(o.id, part as PlanPart | undefined)) throw new BadRequestException('O plano já está sendo gerado.');
    return this.get(tenantId, id);
  }

  /** Edição da equipe na revisão. Qualquer mudança tira a aprovação (precisa aprovar de novo). */
  async updatePlan(tenantId: string, id: string, plan: any) {
    const o = await this.prisma.planOrder.findFirst({ where: { id, tenantId } });
    if (!o) throw new NotFoundException('Pedido não encontrado.');
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new BadRequestException('Plano inválido.');
    if (this.running.has(o.id)) throw new BadRequestException('Aguarde a geração terminar para editar.');
    await this.prisma.planOrder.update({ where: { id }, data: { plan, reviewedAt: null, reviewedBy: null } });
    return this.get(tenantId, id);
  }

  async approve(tenantId: string, id: string, userName: string) {
    const o = await this.prisma.planOrder.findFirst({ where: { id, tenantId } });
    if (!o) throw new NotFoundException('Pedido não encontrado.');
    if (o.status !== 'IN_REVIEW' || !o.plan) throw new BadRequestException('Só dá para aprovar um plano em revisão.');
    await this.prisma.planOrder.update({ where: { id }, data: { reviewedAt: new Date(), reviewedBy: userName } });
    return this.get(tenantId, id);
  }

  /** Mudanças manuais: entregue (depois de enviar pelo WhatsApp), cancelar, voltar para revisão. */
  async setStatus(tenantId: string, id: string, status: PlanStatus) {
    const o = await this.prisma.planOrder.findFirst({ where: { id, tenantId } });
    if (!o) throw new NotFoundException('Pedido não encontrado.');
    if (status === 'DELIVERED') {
      if (!o.reviewedAt) throw new BadRequestException('Aprove o plano antes de marcar como entregue.');
      await this.prisma.planOrder.update({ where: { id }, data: { status, deliveredAt: new Date() } });
      await this.note(o, `✅ ${o.productName} entregue.`);
    } else if (status === 'CANCELED') {
      await this.prisma.planOrder.update({ where: { id }, data: { status } });
    } else if (status === 'IN_REVIEW') {
      if (!o.plan) throw new BadRequestException('O plano ainda não foi gerado.');
      await this.prisma.planOrder.update({ where: { id }, data: { status, deliveredAt: null } });
    } else {
      throw new BadRequestException('Status inválido.');
    }
    return this.get(tenantId, id);
  }

  /** Só no sandbox do Asaas: simula o Pix pago (para testar o fluxo inteiro). */
  async simulatePayment(tenantId: string, id: string) {
    if (!this.asaas.isSandbox) throw new BadRequestException('Só funciona com o Asaas em sandbox.');
    const o = await this.prisma.planOrder.findFirst({ where: { id, tenantId } });
    if (!o?.asaasPaymentId) throw new NotFoundException('Pedido sem cobrança.');
    await this.asaas.confirmSandboxPayment(o.asaasPaymentId);
    await this.syncPayment(o);
    return this.get(tenantId, id);
  }

  async teamPdfOrder(tenantId: string, id: string) {
    const o = await this.prisma.planOrder.findFirst({ where: { id, tenantId } });
    if (!o?.plan) throw new NotFoundException('Plano ainda não gerado.');
    return o;
  }

  /** Texto para colar no WhatsApp Business (envio manual, sem template). */
  whatsappText(o: PlanOrder) {
    const first = (o.name || '').trim().split(/\s+/)[0];
    const plan = o.plan as unknown as PlanContent | null;
    const metas = plan?.metas?.[0]?.metas?.slice(0, 2) ?? [];
    const passos = plan?.primeiros_passos?.slice(0, 3) ?? [];
    return [
      `Oi${first ? `, ${first}` : ''}! Tudo bem? 😊`,
      `Seu *${o.productName}* da *@${o.instagramHandle}* está pronto!`,
      '',
      'Nele você encontra: estratégia e posicionamento, pilares de conteúdo, calendário de 12 semanas de feed e stories, roteiros de Reels, legendas prontas, ideias de stories, o que contratar e as metas dos 90 dias.',
      '',
      ...(passos.length ? ['*Para começar já esta semana:*', ...passos.map((p) => `• ${p}`), ''] : []),
      ...(metas.length ? ['*Metas do primeiro mês:*', ...metas.map((m) => `• ${m}`), ''] : []),
      `Baixe o plano completo em PDF: ${planPdfUrl(o.token)}`,
      '',
      'Qualquer dúvida, é só responder aqui. Bora colocar em prática! 🚀',
      'Equipe Dua Criativa',
    ].join('\n');
  }

  // ── Auxiliares ────────────────────────────────────────────────────────────

  /** Acha o contato pelo telefone (com/sem nono dígito) ou e-mail; senão cria como lead. */
  private async upsertContact(tenantId: string, d: { name: string; phone: string; email: string; instagramHandle: string }) {
    const existing = await this.prisma.contact.findFirst({ where: { tenantId, phone: { in: phoneVariants(d.phone) } } })
      ?? await this.prisma.contact.findFirst({ where: { tenantId, email: { equals: d.email, mode: 'insensitive' } } });
    if (existing) {
      return this.prisma.contact.update({
        where: { id: existing.id },
        data: {
          name: !existing.name || existing.name === existing.phone ? d.name : undefined,
          email: existing.email ? undefined : d.email,
          phone: existing.phone ? undefined : d.phone,
          instagramHandle: existing.instagramHandle ? undefined : d.instagramHandle,
          tags: existing.tags.includes(PLAN_TAGS.ordered) ? undefined : [...existing.tags, PLAN_TAGS.ordered],
        },
      });
    }
    return this.prisma.contact.create({
      data: { tenantId, type: 'LEAD', name: d.name, phone: d.phone, email: d.email, instagramHandle: d.instagramHandle, tags: [PLAN_TAGS.ordered] },
    });
  }

  private async note(o: PlanOrder, content: string) {
    await this.prisma.activity.create({
      data: { tenantId: o.tenantId, contactId: o.contactId, type: 'NOTE', authorName: o.productName, content },
    }).catch(() => {});
  }
}
