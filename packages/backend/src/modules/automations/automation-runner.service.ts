import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppCloudService } from '../whatsapp-cloud/whatsapp-cloud.service';
import { phoneVariants, toBrDigits } from '../../common/phone.util';
import { AutomationConditions, AutomationStep, DEFAULT_REPLY_TIMEOUT_S } from './automation-steps';

const ACTIVE = ['RUNNING', 'WAITING_REPLY'];
const POLL_MS = 5000;
// Enquanto um passo executa, a sessão fica "reservada" por esse tempo (evita duas instâncias executarem a mesma)
const LEASE_MS = 2 * 60_000;

/** Eventos que os outros módulos emitem para os bots. */
export interface LeadFormEvent { tenantId: string; contactId: string }
export interface InboundMessageEvent { tenantId: string; contactId: string; conversationId: string }

/**
 * Executor dos bots. Cada sessão (AutomationRun) guarda no banco o passo atual e
 * quando continuar, então esperas de tempo e por resposta sobrevivem a deploy/reinício.
 * Um laço a cada 5s pega as sessões vencidas; eventos (formulário, resposta) adiantam o laço.
 */
@Injectable()
export class AutomationRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationRunner.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private tickAgain = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloud: WhatsAppCloudService,
  ) {}

  onModuleInit() {
    if (process.env.AUTOMATIONS_DISABLED === 'true') return;
    this.timer = setInterval(() => this.kick(), POLL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Gatilhos ───────────────────────────────────────────────────────────────

  @OnEvent('lead.form_submitted', { async: true })
  async onLeadForm(e: LeadFormEvent) {
    await this.trigger(e.tenantId, 'LEAD_FORM_SUBMITTED', e.contactId);
  }

  @OnEvent('whatsapp.inbound', { async: true })
  async onInbound(e: InboundMessageEvent) {
    try {
      const now = new Date();
      await this.prisma.automationRun.updateMany({
        where: { tenantId: e.tenantId, contactId: e.contactId, status: { in: ACTIVE }, repliedAt: null },
        data: { repliedAt: now },
      });
      // Quem estava esperando resposta segue para o próximo passo
      const waiting = await this.prisma.automationRun.findMany({
        where: { tenantId: e.tenantId, contactId: e.contactId, status: 'WAITING_REPLY' },
        select: { id: true, stepIndex: true },
      });
      for (const r of waiting) {
        await this.prisma.automationRun.updateMany({
          where: { id: r.id, status: 'WAITING_REPLY', stepIndex: r.stepIndex },
          data: { status: 'RUNNING', stepIndex: r.stepIndex + 1, nextRunAt: now, conversationId: e.conversationId },
        });
      }
      if (waiting.length) this.kick();
    } catch (err: any) {
      this.logger.error(`[Bots] Falha ao tratar resposta de ${e.contactId}: ${err.message}`);
    }
  }

  /** Abre uma sessão de cada bot ativo desse gatilho para o contato. */
  async trigger(tenantId: string, trigger: string, contactId: string) {
    try {
      const automations = await this.prisma.automation.findMany({
        where: { tenantId, trigger: trigger as any, active: true },
      });
      if (!automations.length) return;
      const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { phone: true } });
      if (!contact?.phone) return;

      for (const a of automations) {
        const cond = (a.conditions ?? {}) as AutomationConditions;
        if (cond.onlyPhones?.length) {
          const allowed = new Set(cond.onlyPhones.flatMap((p) => phoneVariants(p)));
          if (!phoneVariants(contact.phone).some((v) => allowed.has(v))) continue;
        }
        // Não repete: já tem sessão em andamento, ou começou nas últimas 24h (form enviado 2x)
        const recent = await this.prisma.automationRun.findFirst({
          where: {
            automationId: a.id,
            contactId,
            OR: [{ status: { in: ACTIVE } }, { startedAt: { gte: new Date(Date.now() - 24 * 3600_000) } }],
          },
          select: { id: true },
        });
        if (recent) continue;
        await this.start(a.id, tenantId, contactId);
      }
    } catch (err: any) {
      this.logger.error(`[Bots] Falha no gatilho ${trigger} (${contactId}): ${err.message}`);
    }
  }

  /** Começa uma sessão já (também usado pelo "testar com um contato"). */
  async start(automationId: string, tenantId: string, contactId: string, opts: { isTest?: boolean } = {}) {
    const run = await this.prisma.automationRun.create({
      data: { tenantId, automationId, contactId, status: 'RUNNING', stepIndex: 0, nextRunAt: new Date(), isTest: !!opts.isTest },
    });
    await this.prisma.automation.update({ where: { id: automationId }, data: { runCount: { increment: 1 } } });
    this.logger.log(`[Bots] Sessão ${run.id} iniciada (bot ${automationId}, contato ${contactId})`);
    this.kick();
    return run;
  }

  // ── Laço ───────────────────────────────────────────────────────────────────

  kick() {
    if (this.ticking) { this.tickAgain = true; return; }
    this.ticking = true;
    this.tick()
      .catch((err) => this.logger.error(`[Bots] Erro no laço: ${err.message}`))
      .finally(() => {
        this.ticking = false;
        if (this.tickAgain) { this.tickAgain = false; this.kick(); }
      });
  }

  private async tick() {
    for (let round = 0; round < 10; round++) {
      const due = await this.prisma.automationRun.findMany({
        where: { status: { in: ACTIVE }, nextRunAt: { lte: new Date() } },
        orderBy: { nextRunAt: 'asc' },
        take: 20,
      });
      if (!due.length) return;
      for (const run of due) {
        // Reserva atômica: se outra instância pegou antes, pula
        const claimed = await this.prisma.automationRun.updateMany({
          where: { id: run.id, status: run.status, stepIndex: run.stepIndex, nextRunAt: run.nextRunAt },
          data: { nextRunAt: new Date(Date.now() + LEASE_MS) },
        });
        if (claimed.count === 1) await this.process(run.id);
      }
    }
  }

  private async process(runId: string) {
    const run = await this.prisma.automationRun.findUnique({ where: { id: runId }, include: { automation: true } });
    if (!run) return;
    const finish = (status: string, lastError?: string) =>
      this.prisma.automationRun.update({
        where: { id: run.id },
        data: { status, finishedAt: new Date(), nextRunAt: null, ...(lastError ? { lastError: lastError.slice(0, 500) } : {}) },
      });

    // Prazo da espera por resposta venceu sem resposta: encerra
    if (run.status === 'WAITING_REPLY') { await finish('EXPIRED'); return; }
    // Teste manual roda mesmo com o bot pausado
    if (!run.automation.active && !run.isTest) { await finish('CANCELLED'); return; }

    const steps = (Array.isArray(run.automation.actions) ? run.automation.actions : []) as unknown as AutomationStep[];
    let i = run.stepIndex;
    try {
      for (; i < steps.length; i++) {
        const step = steps[i];
        if (step.type === 'wait') {
          await this.prisma.automationRun.update({
            where: { id: run.id },
            data: { stepIndex: i + 1, nextRunAt: new Date(Date.now() + step.seconds * 1000) },
          });
          // Espera curta: acorda na hora certa em vez de esperar o próximo ciclo de 5s
          if (step.seconds <= 300) setTimeout(() => this.kick(), step.seconds * 1000 + 50);
          return;
        }
        if (step.type === 'wait_reply') {
          const timeout = step.timeoutSeconds || DEFAULT_REPLY_TIMEOUT_S;
          await this.prisma.automationRun.update({
            where: { id: run.id },
            data: { status: 'WAITING_REPLY', stepIndex: i, nextRunAt: new Date(Date.now() + timeout * 1000) },
          });
          return;
        }
        const sent = await this.execute(run, step);
        // Grava o avanço a cada passo: se o processo cair, não reenvia o que já foi
        await this.prisma.automationRun.update({
          where: { id: run.id },
          data: { stepIndex: i + 1, ...(sent ? { sentCount: { increment: 1 }, conversationId: sent } : {}) },
        });
      }
      await finish('COMPLETED');
      this.logger.log(`[Bots] Sessão ${run.id} concluída`);
    } catch (err: any) {
      this.logger.warn(`[Bots] Sessão ${run.id} falhou no passo ${i + 1}: ${err.message}`);
      await this.prisma.automationRun.update({ where: { id: run.id }, data: { stepIndex: i } });
      await finish('FAILED', err.message);
    }
  }

  // ── Passos ─────────────────────────────────────────────────────────────────

  /** Executa um passo de ação. Retorna o id da conversa quando enviou mensagem. */
  private async execute(run: { tenantId: string; contactId: string }, step: AutomationStep): Promise<string | null> {
    const contact = await this.prisma.contact.findFirst({ where: { id: run.contactId, tenantId: run.tenantId } });
    if (!contact) throw new Error('Contato não existe mais.');

    if (step.type === 'move_stage') {
      await this.moveStage(run.tenantId, contact.id, step);
      return null;
    }

    const digits = toBrDigits(contact.phone || '');
    if (!digits) throw new Error('Contato sem telefone.');
    const vars = varsOf(contact.name, contact.phone);

    if (step.type === 'send_text') {
      const text = fillVars(step.text, vars);
      const { externalId } = await this.cloud.sendText(run.tenantId, digits, text);
      return this.recordOutbound(run.tenantId, contact.id, digits, { type: 'TEXT', content: text, externalId });
    }

    if (step.type === 'send_template') {
      const named = step.parameterFormat === 'NAMED';
      const params = (step.params ?? []).map((p) => ({ key: p.key, text: fillVars(p.value, vars).trim() || vars.primeiro_nome }));
      const components = params.length
        ? [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: p.text, ...(named ? { parameter_name: p.key } : {}) })) }]
        : [];
      const { externalId } = await this.cloud.sendTemplate(run.tenantId, digits, step.templateName, step.language || 'pt_BR', components);
      const values = Object.fromEntries(params.map((p) => [p.key, p.text]));
      const preview = step.bodyText
        ? step.bodyText.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, k) => values[k] ?? all)
        : `[template: ${step.templateName}]`;
      return this.recordOutbound(run.tenantId, contact.id, digits, { type: 'TEMPLATE', content: preview, externalId, templateName: step.templateName });
    }
    return null;
  }

  /** Grava a mensagem enviada na conversa do contato (cria a conversa se o lead nunca falou com a gente). */
  private async recordOutbound(
    tenantId: string,
    contactId: string,
    digits: string,
    msg: { type: 'TEXT' | 'TEMPLATE'; content: string; externalId: string | null; templateName?: string },
  ) {
    let conv = await this.prisma.conversation.findFirst({
      where: { tenantId, channel: 'WHATSAPP', contactId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conv) {
      conv = await this.prisma.conversation.upsert({
        where: { tenantId_externalId: { tenantId, externalId: `${digits}@s.whatsapp.net` } },
        update: {},
        create: { tenantId, channel: 'WHATSAPP', status: 'OPEN', contactId, externalId: `${digits}@s.whatsapp.net` },
      });
    }
    await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: 'OUTBOUND',
        type: msg.type,
        content: msg.content,
        templateName: msg.templateName ?? null,
        externalId: msg.externalId,
        senderName: 'Bot',
        sentAt: new Date(),
      },
    });
    await this.prisma.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });
    return conv.id;
  }

  /**
   * Move o card do contato no funil da etapa escolhida (cria o card se não houver).
   * Não volta etapas: se o card já está mais adiante, fica onde está.
   */
  private async moveStage(tenantId: string, contactId: string, step: { stageId?: string; stageName?: string }) {
    const stage = step.stageId
      ? await this.prisma.pipelineStage.findFirst({ where: { id: step.stageId, pipeline: { tenantId } } })
      : await this.prisma.pipelineStage.findFirst({
          where: { name: { equals: step.stageName, mode: 'insensitive' }, pipeline: { tenantId } },
          orderBy: { pipeline: { createdAt: 'asc' } },
        });
    if (!stage) throw new Error(`Etapa do funil não encontrada: ${step.stageName ?? step.stageId}`);

    const lead = await this.prisma.pipelineLead.findFirst({
      where: { contactId, stage: { pipelineId: stage.pipelineId } },
      include: { stage: { select: { position: true } } },
    });
    const now = new Date();
    const outcome =
      stage.kind === 'WON' ? { wonAt: lead?.wonAt ?? now, lostAt: null, lostReason: null }
      : stage.kind === 'LOST' ? { lostAt: lead?.lostAt ?? now, wonAt: null }
      : { wonAt: null, lostAt: null, lostReason: null };

    if (!lead) {
      const count = await this.prisma.pipelineLead.count({ where: { stageId: stage.id } });
      await this.prisma.pipelineLead.create({ data: { stageId: stage.id, contactId, position: count, ...outcome } });
    } else if (lead.stageId !== stage.id && lead.stage.position < stage.position) {
      await this.prisma.pipelineLead.update({ where: { id: lead.id }, data: { stageId: stage.id, ...outcome } });
    } else {
      return;
    }
    if (stage.kind === 'WON') {
      await this.prisma.contact.updateMany({ where: { id: contactId, tenantId, type: 'LEAD' }, data: { type: 'CLIENT', clientSince: now } });
    }
  }
}

/** Variáveis disponíveis nos textos: {{nome}} e {{primeiro_nome}}. */
export function varsOf(name: string | null, phone: string | null) {
  const clean = (name || '').trim();
  // Contato criado pelo WhatsApp sem nome fica com o número como nome
  const real = clean && clean !== phone && !/^\+?[\d\s()-]+$/.test(clean) ? clean : '';
  const first = real.split(/\s+/)[0] || '';
  const cap = first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : '';
  return { nome: real || 'você', primeiro_nome: cap || 'você' };
}

export function fillVars(text: string, vars: Record<string, string>) {
  return (text || '').replace(/\{\{\s*(nome|primeiro_nome)\s*\}\}/gi, (_, k) => vars[k.toLowerCase()] ?? '');
}
