import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppCloudService } from '../whatsapp-cloud/whatsapp-cloud.service';
import { NotifyService } from '../notifications/notify.service';
import { phoneVariants, toBrDigits } from '../../common/phone.util';
import { MEETING_EVENTS, appUrl } from '../scheduling/scheduling.service';
import {
  AutomationConditions, AutomationStep, DEFAULT_MEETING_STATUS_TIMEOUT_S, MEETING_LATE_GRACE_MS, Reminder, StepTarget, WINDOW_MS,
  dueReminder, giveUpAfter, meetingWaitAt, originFromText, originLabel, salesChannelPhrase, sameAnswer, waitPlan, waitUntil,
} from './automation-steps';

const ACTIVE = ['RUNNING', 'WAITING_REPLY'];
const POLL_MS = 5000;
// Enquanto um passo executa, a sessão fica "reservada" por esse tempo (evita duas instâncias executarem a mesma)
const LEASE_MS = 2 * 60_000;
// Índice de "encerrar o bot" nos desvios
const END = -1;
// Passos seguidos sem espera numa mesma execução (protege contra "ir para" em círculo)
const MAX_STEPS_PER_RUN = 60;
// Respondeu até esse tempo depois de o bot desistir por falta de resposta: o bot retoma
const REVIVE_MS = 7 * 24 * 3600_000;
// "Primeira mensagem no WhatsApp" só vale para contato criado há menos que isso
const NEW_CONTACT_MS = 24 * 3600_000;

/** Eventos que os outros módulos emitem para os bots. */
export interface LeadFormEvent { tenantId: string; contactId: string }
export interface InboundMessageEvent { tenantId: string; contactId: string; conversationId: string; firstMessage?: boolean }
export interface HumanMessageEvent { tenantId: string; conversationId: string }
export interface StageEnteredEvent { tenantId: string; contactId: string; stageId: string }
export interface MeetingEvent { tenantId: string; meetingId: string; contactId: string; startAt: Date }

type RunWithBot = {
  id: string; tenantId: string; contactId: string; conversationId: string | null; status: string; stepIndex: number; startedAt: Date;
  remindersSent?: number; automation: { actions: any };
};
type RunRef = { id: string; tenantId: string; contactId: string; conversationId: string | null; startedAt: Date; meetingId: string | null };

const stepsOf = (actions: any) => (Array.isArray(actions) ? actions : []) as AutomationStep[];

/** Posição do destino de um desvio: vazio = próximo, "end" = encerra. */
function indexOf(steps: AutomationStep[], target: StepTarget, current: number) {
  if (!target) return current + 1;
  if (target === 'end') return END;
  const i = steps.findIndex((s) => s.id === target);
  return i >= 0 ? i : END;
}

/** Para onde o bot vai quando o contato responde no passo `i` (botão escolhido, texto livre ou resposta qualquer). */
function afterReply(steps: AutomationStep[], i: number, answer: string) {
  const step = steps[i];
  if (step?.type === 'send_buttons') {
    const chosen = step.buttons.find((b) => sameAnswer(b.title, answer));
    return indexOf(steps, chosen ? chosen.goto : step.onOther, i);
  }
  if (step?.type === 'wait_reply') return indexOf(steps, step.onReply, i);
  return i + 1;
}

/**
 * Respondeu um lembrete em template ("oi, sim!"): isso não é a resposta da pergunta, então o bot
 * pergunta de novo — os botões outra vez, ou o texto da pergunta antes da espera. null = segue normal.
 */
function askAgainAt(steps: AutomationStep[], i: number, answer: string) {
  const step = steps[i];
  if (step?.type === 'send_buttons') return step.buttons.some((b) => sameAnswer(b.title, answer)) ? null : i;
  if (step?.type === 'wait_reply' && steps[i - 1]?.type === 'send_text') return i - 1;
  return null;
}

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
    private readonly notifier: NotifyService,
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

  /** Alguém do time arrastou o card para outra etapa: dispara os bots daquela etapa. */
  @OnEvent('funnel.stage_entered', { async: true })
  async onStageEntered(e: StageEnteredEvent) {
    await this.trigger(e.tenantId, 'LEAD_STAGE_ENTERED', e.contactId, { stageId: e.stageId });
  }

  @OnEvent(MEETING_EVENTS.scheduled, { async: true })
  async onMeetingScheduled(e: MeetingEvent) {
    await this.trigger(e.tenantId, 'MEETING_SCHEDULED', e.contactId, { meetingId: e.meetingId });
  }

  /** Remarcou: as esperas da reunião recalculam com o novo horário. */
  @OnEvent(MEETING_EVENTS.rescheduled, { async: true })
  async onMeetingRescheduled(e: MeetingEvent) {
    await this.wakeMeetingRuns(e.meetingId, ['wait_meeting']);
  }

  /** Time marcou "não compareceu" ou "realizada": quem espera o status segue o caminho. */
  @OnEvent(MEETING_EVENTS.noShow, { async: true })
  async onMeetingNoShow(e: MeetingEvent) {
    await this.wakeMeetingRuns(e.meetingId, ['meeting_status']);
  }

  @OnEvent(MEETING_EVENTS.completed, { async: true })
  async onMeetingCompleted(e: MeetingEvent) {
    await this.wakeMeetingRuns(e.meetingId, ['meeting_status']);
  }

  @OnEvent(MEETING_EVENTS.cancelled, { async: true })
  async onMeetingCancelled(e: MeetingEvent) {
    try {
      const { count } = await this.prisma.automationRun.updateMany({
        where: { tenantId: e.tenantId, meetingId: e.meetingId, status: { in: ACTIVE } },
        data: { status: 'CANCELLED', finishedAt: new Date(), nextRunAt: null, lastError: 'Reunião cancelada' },
      });
      if (count) this.logger.log(`[Bots] ${count} sessão(ões) da reunião ${e.meetingId} cancelada(s)`);
    } catch (err: any) {
      this.logger.error(`[Bots] Falha ao cancelar sessões da reunião ${e.meetingId}: ${err.message}`);
    }
  }

  /** Sessões da reunião paradas num passo desses tipos rodam de novo agora (o passo relê a reunião). */
  private async wakeMeetingRuns(meetingId: string, types: string[]) {
    try {
      const runs = await this.prisma.automationRun.findMany({
        where: { meetingId, status: 'RUNNING' },
        include: { automation: { select: { actions: true } } },
      });
      let woke = 0;
      for (const r of runs) {
        if (!types.includes(stepsOf(r.automation.actions)[r.stepIndex]?.type)) continue;
        const { count } = await this.prisma.automationRun.updateMany({
          where: { id: r.id, status: 'RUNNING', stepIndex: r.stepIndex },
          data: { nextRunAt: new Date() },
        });
        woke += count;
      }
      if (woke) this.kick();
    } catch (err: any) {
      this.logger.error(`[Bots] Falha ao atualizar sessões da reunião ${meetingId}: ${err.message}`);
    }
  }

  @OnEvent('whatsapp.inbound', { async: true })
  async onInbound(e: InboundMessageEvent) {
    try {
      const now = new Date();
      await this.prisma.automationRun.updateMany({
        where: { tenantId: e.tenantId, contactId: e.contactId, status: { in: ACTIVE }, repliedAt: null },
        data: { repliedAt: now },
      });
      // Quem estava esperando resposta segue o fluxo (o botão escolhido decide o caminho)
      const waiting = await this.prisma.automationRun.findMany({
        where: { tenantId: e.tenantId, contactId: e.contactId, status: 'WAITING_REPLY' },
        include: { automation: { select: { actions: true } } },
      });
      if (waiting.length) {
        const reply = await this.prisma.message.findFirst({
          where: { conversationId: e.conversationId, direction: 'INBOUND' },
          orderBy: { sentAt: 'desc' },
          select: { content: true },
        });
        for (const r of waiting) await this.resume(r, reply?.content ?? '', e.conversationId);
        this.kick();
      } else {
        await this.revive(e);
      }
    } catch (err: any) {
      this.logger.error(`[Bots] Falha ao tratar resposta de ${e.contactId}: ${err.message}`);
    }
    // Depois das respostas: a sessão nova não pode ser tomada por resposta a esta mensagem
    if (e.firstMessage) await this.onFirstMessage(e);
  }

  /**
   * Lead novo chamou direto no WhatsApp (bio do Instagram, botão do site, anúncio, indicação).
   * Fica de fora: cliente, contato antigo, quem preencheu o formulário e quem já está num bot.
   */
  private async onFirstMessage(e: InboundMessageEvent) {
    try {
      const contact = await this.prisma.contact.findFirst({
        where: { id: e.contactId, tenantId: e.tenantId },
        select: { type: true, createdAt: true, monthlyRevenue: true, saleModel: true },
      });
      if (!contact || contact.type !== 'LEAD') return;
      if (Date.now() - contact.createdAt.getTime() > NEW_CONTACT_MS) return;
      if (contact.monthlyRevenue || contact.saleModel) return;
      const busy = await this.prisma.automationRun.findFirst({
        where: { tenantId: e.tenantId, contactId: e.contactId, status: { in: ACTIVE } },
        select: { id: true },
      });
      if (busy) return;
      await this.trigger(e.tenantId, 'WHATSAPP_FIRST_MESSAGE', e.contactId);
    } catch (err: any) {
      this.logger.error(`[Bots] Falha no gatilho de 1ª mensagem (${e.contactId}): ${err.message}`);
    }
  }

  /** Alguém do time escreveu na conversa (CRM ou app do WhatsApp): o bot sai de cena. */
  @OnEvent('conversation.human_message', { async: true })
  async onHumanMessage(e: HumanMessageEvent) {
    try {
      const conv = await this.prisma.conversation.findFirst({ where: { id: e.conversationId, tenantId: e.tenantId }, select: { contactId: true } });
      if (!conv) return;
      // Lembretes de reunião continuam mesmo com o time conversando
      const { count } = await this.prisma.automationRun.updateMany({
        where: { tenantId: e.tenantId, contactId: conv.contactId, status: { in: ACTIVE }, meetingId: null },
        data: { status: 'HANDED_OFF', finishedAt: new Date(), nextRunAt: null },
      });
      if (count) this.logger.log(`[Bots] ${count} sessão(ões) do contato ${conv.contactId} assumida(s) pelo time`);
    } catch (err: any) {
      this.logger.error(`[Bots] Falha ao pausar bot da conversa ${e.conversationId}: ${err.message}`);
    }
  }

  /** Abre uma sessão de cada bot ativo desse gatilho para o contato. */
  async trigger(tenantId: string, trigger: string, contactId: string, opts: { meetingId?: string; stageId?: string } = {}) {
    try {
      const automations = await this.prisma.automation.findMany({
        where: { tenantId, trigger: trigger as any, active: true },
      });
      if (!automations.length) return;
      const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { phone: true } });
      if (!contact?.phone) return;

      for (const a of automations) {
        const cond = (a.conditions ?? {}) as AutomationConditions;
        if (trigger === 'LEAD_STAGE_ENTERED' && cond.stageId !== opts.stageId) continue;
        if (cond.onlyPhones?.length) {
          const allowed = new Set(cond.onlyPhones.flatMap((p) => phoneVariants(p)));
          if (!phoneVariants(contact.phone).some((v) => allowed.has(v))) continue;
        }
        // Não repete: já tem sessão em andamento, ou começou nas últimas 24h (form enviado 2x).
        // Reunião: uma sessão por reunião (cancelou e marcou outra → sessão nova)
        const recent = await this.prisma.automationRun.findFirst({
          where: opts.meetingId
            ? { automationId: a.id, meetingId: opts.meetingId }
            : {
                automationId: a.id,
                contactId,
                OR: [{ status: { in: ACTIVE } }, { startedAt: { gte: new Date(Date.now() - 24 * 3600_000) } }],
              },
          select: { id: true },
        });
        if (recent) continue;
        await this.start(a.id, tenantId, contactId, { meetingId: opts.meetingId });
      }
    } catch (err: any) {
      this.logger.error(`[Bots] Falha no gatilho ${trigger} (${contactId}): ${err.message}`);
    }
  }

  /** Começa uma sessão já (também usado pelo "testar com um contato"). */
  async start(automationId: string, tenantId: string, contactId: string, opts: { isTest?: boolean; meetingId?: string } = {}) {
    const run = await this.prisma.automationRun.create({
      data: {
        tenantId, automationId, contactId, status: 'RUNNING', stepIndex: 0, nextRunAt: new Date(), isTest: !!opts.isTest,
        meetingId: opts.meetingId ?? null,
      },
    });
    await this.prisma.automation.update({ where: { id: automationId }, data: { runCount: { increment: 1 } } });
    this.logger.log(`[Bots] Sessão ${run.id} iniciada (bot ${automationId}, contato ${contactId})`);
    this.kick();
    return run;
  }

  /**
   * A pessoa respondeu depois que o bot desistiu por falta de resposta (até 7 dias, sem o time ter
   * escrito depois): o bot volta para a pergunta em que parou e segue com essa resposta. Desfaz as
   * etiquetas e a etapa do caminho de "sem resposta" e avisa o time.
   */
  private async revive(e: InboundMessageEvent) {
    const run = await this.prisma.automationRun.findFirst({
      where: {
        tenantId: e.tenantId, contactId: e.contactId, status: { in: ['COMPLETED', 'EXPIRED'] },
        timedOutStep: { not: null }, finishedAt: { gte: new Date(Date.now() - REVIVE_MS) },
      },
      orderBy: { finishedAt: 'desc' },
      include: { automation: true },
    });
    if (!run?.finishedAt || !run.timedOutStep || (!run.automation.active && !run.isTest)) return;
    const busy = await this.prisma.automationRun.findFirst({
      where: { tenantId: e.tenantId, contactId: e.contactId, status: { in: ACTIVE } },
      select: { id: true },
    });
    if (busy) return;
    const steps = stepsOf(run.automation.actions);
    const k = steps.findIndex((s) => s.id === run.timedOutStep);
    if (k < 0 || (steps[k].type !== 'wait_reply' && steps[k].type !== 'send_buttons')) return;
    // O time já entrou na conversa depois que o bot desistiu: a conversa é deles
    const human = await this.prisma.message.findFirst({
      where: {
        conversation: { tenantId: e.tenantId, contactId: e.contactId }, direction: 'OUTBOUND', sentAt: { gt: run.finishedAt },
        OR: [{ senderName: null }, { senderName: { not: 'Bot' } }],
      },
      select: { id: true },
    });
    if (human) return;

    const claimed = await this.prisma.automationRun.updateMany({
      where: { id: run.id, status: run.status, finishedAt: run.finishedAt },
      data: { status: 'WAITING_REPLY', stepIndex: k, finishedAt: null, timedOutStep: null, nextRunAt: new Date(Date.now() + LEASE_MS), conversationId: e.conversationId },
    });
    if (claimed.count !== 1) return;
    this.logger.log(`[Bots] Sessão ${run.id} retomada: o contato respondeu depois do "sem resposta"`);

    try {
      await this.undoGiveUp(run, steps);
      const contact = await this.prisma.contact.findFirst({ where: { id: run.contactId }, select: { id: true, name: true, phone: true } });
      if (contact) {
        const { primeiro_nome } = varsOf(contact.name, contact.phone);
        await this.notify({ ...run, conversationId: e.conversationId }, contact,
          `${primeiro_nome === 'você' ? 'O contato' : primeiro_nome} respondeu depois que o bot tinha desistido. O bot retomou de onde parou.`);
      }
    } catch (err: any) {
      this.logger.warn(`[Bots] Sessão ${run.id}: falha ao desfazer o "sem resposta": ${err.message}`);
    }
    const reply = await this.prisma.message.findFirst({
      where: { conversationId: e.conversationId, direction: 'INBOUND' },
      orderBy: { sentAt: 'desc' },
      select: { content: true },
    });
    await this.resume({ ...run, status: 'WAITING_REPLY', stepIndex: k }, reply?.content ?? '', e.conversationId);
    this.kick();
  }

  /** Desfaz o que o caminho de "sem resposta" fez: tira as etiquetas e devolve o card à etapa de antes. */
  private async undoGiveUp(run: { tenantId: string; contactId: string; timedOutStep: string | null; visitedSteps: string[] }, steps: AutomationStep[]) {
    const at = run.visitedSteps.lastIndexOf(run.timedOutStep!);
    if (at < 0) return;
    const byId = (id: string) => steps.find((s) => s.id === id);
    const after = run.visitedSteps.slice(at + 1).map(byId).filter(Boolean) as AutomationStep[];
    const before = run.visitedSteps.slice(0, at).map(byId).filter(Boolean) as AutomationStep[];

    const tags = after.flatMap((s) => (s.type === 'add_tag' ? [s.tag] : []));
    if (tags.length) {
      const contact = await this.prisma.contact.findFirst({ where: { id: run.contactId, tenantId: run.tenantId }, select: { tags: true } });
      if (contact) await this.prisma.contact.update({ where: { id: run.contactId }, data: { tags: contact.tags.filter((t) => !tags.includes(t)) } });
    }

    const moved = [...after].reverse().find((s) => s.type === 'move_stage');
    const prev = [...before].reverse().find((s) => s.type === 'move_stage');
    if (moved?.type !== 'move_stage' || prev?.type !== 'move_stage') return;
    const stageOf = (s: { stageId?: string; stageName?: string }) => s.stageId
      ? this.prisma.pipelineStage.findFirst({ where: { id: s.stageId, pipeline: { tenantId: run.tenantId } } })
      : this.prisma.pipelineStage.findFirst({ where: { name: { equals: s.stageName, mode: 'insensitive' }, pipeline: { tenantId: run.tenantId } }, orderBy: { pipeline: { createdAt: 'asc' } } });
    const [from, to] = await Promise.all([stageOf(moved), stageOf(prev)]);
    if (!from || !to || from.pipelineId !== to.pipelineId) return;
    // Só se o card ainda está onde o bot deixou (o time pode já ter movido)
    await this.prisma.pipelineLead.updateMany({
      where: { contactId: run.contactId, stageId: from.id },
      data: { stageId: to.id, wonAt: null, lostAt: null, lostReason: null },
    });
  }

  /** Sessão esperando resposta recebeu uma: segue para o passo do caminho escolhido. */
  private async resume(run: RunWithBot, answer: string, conversationId: string | null) {
    const steps = stepsOf(run.automation.actions);
    const again = run.remindersSent && (await this.lastBotWasTemplate(conversationId)) ? askAgainAt(steps, run.stepIndex, answer) : null;
    const next = again ?? afterReply(steps, run.stepIndex, answer);
    const now = new Date();
    await this.prisma.automationRun.updateMany({
      where: { id: run.id, status: 'WAITING_REPLY', stepIndex: run.stepIndex },
      data: next === END
        ? { status: 'COMPLETED', finishedAt: now, nextRunAt: null, conversationId }
        : { status: 'RUNNING', stepIndex: next, nextRunAt: now, conversationId },
    });
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
    if (!run || !ACTIVE.includes(run.status)) return;
    // Só encerra se ainda estiver ativa (o time pode ter assumido no meio)
    const finish = (status: string, lastError?: string, extra: { timedOutStep?: string } = {}) =>
      this.prisma.automationRun.updateMany({
        where: { id: run.id, status: { in: ACTIVE } },
        data: { status, finishedAt: new Date(), nextRunAt: null, ...extra, ...(lastError ? { lastError: lastError.slice(0, 500) } : {}) },
      });

    // Teste manual roda mesmo com o bot pausado
    if (!run.automation.active && !run.isTest) { await finish('CANCELLED'); return; }

    const steps = stepsOf(run.automation.actions);
    let i = run.stepIndex;

    // Espera por resposta: hora de um lembrete, ou o prazo venceu e segue pelo caminho de "sem resposta" (ou encerra)
    if (run.status === 'WAITING_REPLY') {
      const step = steps[i];
      if (run.waitingSince && step && (step.type === 'wait_reply' || step.type === 'send_buttons')) {
        const cond = (run.automation.conditions ?? {}) as AutomationConditions;
        const plan = waitPlan(run.waitingSince, run.remindersSent, step, cond);
        const now = Date.now();
        const due = dueReminder(run.waitingSince, run.remindersSent, cond, now);
        if (due !== null) {
          try {
            await this.remind(run, step, cond.reminders![due]);
          } catch (err: any) {
            // Lembrete que falhou não derruba a sessão: segue esperando a resposta
            this.logger.warn(`[Bots] Lembrete ${due + 1} da sessão ${run.id} falhou: ${err.message}`);
          }
          const next = waitPlan(run.waitingSince, due + 1, step, cond);
          // Lembrete atrasado (o prazo já tinha passado): ainda assim dá o tempo de resposta inteiro
          const until = next.reminderAt ?? new Date(Math.max(next.deadline.getTime(), giveUpAfter(now, cond).getTime()));
          await this.prisma.automationRun.updateMany({
            where: { id: run.id, status: 'WAITING_REPLY', stepIndex: i },
            data: { remindersSent: due + 1, nextRunAt: until },
          });
          return;
        }
        const until = plan.reminderAt ?? plan.deadline;
        if (until.getTime() > now) {
          await this.prisma.automationRun.updateMany({ where: { id: run.id, status: 'WAITING_REPLY', stepIndex: i }, data: { nextRunAt: until } });
          return;
        }
      }
      const onTimeout = step && (step.type === 'wait_reply' || step.type === 'send_buttons') ? step.onTimeout : undefined;
      if (!onTimeout || indexOf(steps, onTimeout, i) === END) { await finish('EXPIRED', undefined, { timedOutStep: step?.id }); return; }
      const waited = step.id;
      i = indexOf(steps, onTimeout, i);
      await this.prisma.automationRun.update({ where: { id: run.id }, data: { status: 'RUNNING', stepIndex: i, timedOutStep: waited ?? null } });
    }

    let conversationId = run.conversationId;
    try {
      for (let n = 0; ; n++) {
        if (n >= MAX_STEPS_PER_RUN) throw new Error('O bot entrou em círculo: revise os passos "Ir para".');
        if (i === END || i >= steps.length) {
          await finish('COMPLETED');
          this.logger.log(`[Bots] Sessão ${run.id} concluída`);
          return;
        }
        // Entre um passo e outro o time pode ter assumido a conversa
        if (n > 0 && !(await this.stillActive(run.id))) return;
        const step = steps[i];
        // Só para os contadores do editor ("passaram por"); falha aqui não afeta a sessão
        if (step.id) {
          await this.prisma.automationRun
            .update({ where: { id: run.id }, data: { visitedSteps: { push: step.id } } })
            .catch(() => {});
        }

        if (step.type === 'wait') {
          await this.prisma.automationRun.update({
            where: { id: run.id },
            data: { stepIndex: i + 1, nextRunAt: waitUntil(new Date(), step.seconds, step.alignTo, step.alignWeekends) },
          });
          // Espera curta: acorda na hora certa em vez de esperar o próximo ciclo de 5s
          if (step.seconds <= 300 && !step.alignTo) setTimeout(() => this.kick(), step.seconds * 1000 + 50);
          return;
        }

        if (step.type === 'wait_meeting' || step.type === 'meeting_status') {
          const meeting = await this.meetingOf(run);
          if (meeting.status === 'CANCELLED') { await finish('CANCELLED', 'Reunião cancelada'); return; }
          const now = Date.now();
          // Até quando fica parado neste passo (o passo roda de novo e relê a reunião)
          let until: Date | null = null;
          if (step.type === 'wait_meeting') {
            const at = meetingWaitAt(meeting.startAt, step);
            if (at.getTime() > now) until = at;
            // Chegou atrasado (marcou em cima da hora ou remarcou para mais cedo): pula o lembrete
            else i = indexOf(steps, now - at.getTime() > MEETING_LATE_GRACE_MS ? step.onLate : step.onTime, i);
          } else if (meeting.status === 'NO_SHOW') i = indexOf(steps, step.onNoShow, i);
          else if (meeting.status === 'COMPLETED') i = indexOf(steps, step.onDone, i);
          else {
            const deadline = new Date(meeting.endAt.getTime() + (step.timeoutSeconds || DEFAULT_MEETING_STATUS_TIMEOUT_S) * 1000);
            if (deadline.getTime() > now) until = deadline;
            else i = step.onTimeout ? indexOf(steps, step.onTimeout, i) : END;
          }
          if (until) {
            await this.prisma.automationRun.update({ where: { id: run.id }, data: { stepIndex: i, nextRunAt: until } });
            if (until.getTime() - now <= 300_000) setTimeout(() => this.kick(), until.getTime() - now + 50);
            return;
          }
          if (i !== END) await this.prisma.automationRun.update({ where: { id: run.id }, data: { stepIndex: i } });
          continue;
        }

        if (step.type === 'check_origin') {
          i = indexOf(steps, (await this.originKnown(run, conversationId)) ? step.onKnown : step.onUnknown, i);
          if (i !== END) await this.prisma.automationRun.update({ where: { id: run.id }, data: { stepIndex: i } });
          continue;
        }

        if (step.type === 'goto' || step.type === 'end') {
          i = step.type === 'end' ? END : indexOf(steps, step.target, i);
          if (i !== END) await this.prisma.automationRun.update({ where: { id: run.id }, data: { stepIndex: i } });
          continue;
        }

        if (step.type === 'send_buttons') {
          const sent = await this.execute({ ...run, conversationId }, step);
          if (sent) conversationId = sent;
          await this.prisma.automationRun.update({ where: { id: run.id }, data: { sentCount: { increment: 1 }, conversationId } });
        }

        if (step.type === 'wait_reply' || step.type === 'send_buttons') {
          const since = new Date();
          const plan = waitPlan(since, 0, step, (run.automation.conditions ?? {}) as AutomationConditions);
          await this.prisma.automationRun.update({
            where: { id: run.id },
            data: { status: 'WAITING_REPLY', stepIndex: i, waitingSince: since, remindersSent: 0, timedOutStep: null, nextRunAt: plan.reminderAt ?? plan.deadline },
          });
          // O contato pode ter respondido enquanto o passo rodava
          const answer = await this.replyAfterBot(conversationId);
          if (answer !== null) {
            await this.resume({ ...run, status: 'WAITING_REPLY', stepIndex: i, conversationId }, answer, conversationId);
            this.kick();
          }
          return;
        }

        const sent = await this.execute({ ...run, conversationId }, step);
        if (sent) conversationId = sent;
        // Grava o avanço a cada passo: se o processo cair, não reenvia o que já foi
        await this.prisma.automationRun.update({
          where: { id: run.id },
          data: { stepIndex: i + 1, ...(sent ? { sentCount: { increment: 1 }, conversationId: sent } : {}) },
        });
        i++;
      }
    } catch (err: any) {
      this.logger.warn(`[Bots] Sessão ${run.id} falhou no passo ${i + 1}: ${err.message}`);
      await this.prisma.automationRun.updateMany({ where: { id: run.id, status: { in: ACTIVE } }, data: { stepIndex: Math.max(i, 0) } });
      await finish('FAILED', err.message);
    }
  }

  /**
   * Já sabemos de onde o contato veio? Sem origem gravada, tenta o texto pronto dos links
   * nas mensagens recentes dele (no teste a mensagem pode ter chegado antes da sessão).
   */
  private async originKnown(run: { tenantId: string; contactId: string; startedAt: Date }, conversationId: string | null) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: run.contactId, tenantId: run.tenantId },
      select: { id: true, leadOrigin: true, utmSource: true },
    });
    if (!contact) return false;
    if (contact.leadOrigin) return true;
    const msgs = await this.prisma.message.findMany({
      where: {
        direction: 'INBOUND',
        sentAt: { gte: new Date(run.startedAt.getTime() - 24 * 3600_000) },
        ...(conversationId ? { conversationId } : { conversation: { tenantId: run.tenantId, contactId: contact.id } }),
      },
      orderBy: { sentAt: 'asc' },
      take: 10,
      select: { content: true },
    });
    const hit = msgs.map((m) => originFromText(m.content)).find(Boolean);
    if (!hit) return false;
    await this.prisma.contact.update({
      where: { id: contact.id },
      data: { leadOrigin: hit.leadOrigin, ...(!contact.utmSource && { utmSource: hit.utmSource, utmMedium: hit.utmMedium }) },
    });
    return true;
  }

  /** Reunião da sessão (gatilho "Reunião agendada"). */
  private async meetingOf(run: { tenantId: string; meetingId: string | null }) {
    if (!run.meetingId) throw new Error('Sessão sem reunião: passos de reunião só funcionam com o gatilho "Reunião agendada".');
    const m = await this.prisma.meeting.findFirst({
      where: { id: run.meetingId, tenantId: run.tenantId },
      include: { bookingPage: { select: { slug: true, timezone: true } } },
    });
    if (!m) throw new Error('A reunião não existe mais.');
    return m;
  }

  private async stillActive(runId: string) {
    const r = await this.prisma.automationRun.findUnique({ where: { id: runId }, select: { status: true } });
    return !!r && ACTIVE.includes(r.status);
  }

  /** Última mensagem do contato depois da última mensagem do bot nessa conversa (null = não respondeu). */
  private async replyAfterBot(conversationId: string | null) {
    if (!conversationId) return null;
    const lastBot = await this.prisma.message.findFirst({
      where: { conversationId, direction: 'OUTBOUND', senderName: 'Bot' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    if (!lastBot) return null;
    const reply = await this.prisma.message.findFirst({
      where: { conversationId, direction: 'INBOUND', sentAt: { gt: lastBot.sentAt } },
      orderBy: { sentAt: 'desc' },
      select: { content: true },
    });
    return reply ? reply.content : null;
  }

  /** A última mensagem do bot nessa conversa foi um template (lembrete com a janela fechada)? */
  private async lastBotWasTemplate(conversationId: string | null) {
    if (!conversationId) return false;
    const last = await this.prisma.message.findFirst({
      where: { conversationId, direction: 'OUTBOUND', senderName: 'Bot' },
      orderBy: { sentAt: 'desc' },
      select: { type: true },
    });
    return last?.type === 'TEMPLATE';
  }

  /** A janela de 24h do WhatsApp está aberta (o contato escreveu há menos de 24h)? */
  private async windowOpen(run: { tenantId: string; contactId: string; conversationId: string | null }) {
    const last = await this.prisma.message.findFirst({
      where: {
        direction: 'INBOUND',
        ...(run.conversationId ? { conversationId: run.conversationId } : { conversation: { tenantId: run.tenantId, contactId: run.contactId, channel: 'WHATSAPP' } }),
      },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    return !!last && Date.now() - last.sentAt.getTime() < WINDOW_MS;
  }

  /**
   * Lembrete para quem não respondeu. Texto: só com a janela aberta (senão pula); numa pergunta
   * com botões vai com os mesmos botões, para a pessoa só tocar. Template: sai sempre.
   */
  private async remind(run: RunRef, step: AutomationStep, reminder: Reminder | undefined) {
    if (!reminder) return;
    let msg: AutomationStep;
    if (reminder.type === 'send_template') {
      const { afterSeconds, ...tpl } = reminder;
      msg = tpl;
    } else {
      if (!(await this.windowOpen(run))) {
        this.logger.log(`[Bots] Lembrete de texto da sessão ${run.id} pulado: janela de 24h fechada`);
        return;
      }
      msg = step.type === 'send_buttons'
        ? { type: 'send_buttons', text: reminder.text, buttons: step.buttons.map((b) => ({ title: b.title })) }
        : { type: 'send_text', text: reminder.text };
    }
    const sent = await this.execute(run, msg);
    if (sent) {
      await this.prisma.automationRun.update({ where: { id: run.id }, data: { sentCount: { increment: 1 }, conversationId: sent } });
    }
    this.logger.log(`[Bots] Lembrete (${reminder.type === 'send_template' ? reminder.templateName : 'texto'}) enviado na sessão ${run.id}`);
  }

  // ── Passos ─────────────────────────────────────────────────────────────────

  /** Executa um passo de ação. Retorna o id da conversa quando enviou mensagem. */
  private async execute(
    run: RunRef,
    step: AutomationStep,
  ): Promise<string | null> {
    const contact = await this.prisma.contact.findFirst({ where: { id: run.contactId, tenantId: run.tenantId } });
    if (!contact) throw new Error('Contato não existe mais.');

    if (step.type === 'move_stage') {
      await this.moveStage(run.tenantId, contact.id, step);
      return null;
    }

    if (step.type === 'add_tag') {
      if (!contact.tags.includes(step.tag)) {
        await this.prisma.contact.update({ where: { id: contact.id }, data: { tags: [...contact.tags, step.tag] } });
      }
      return null;
    }

    if (step.type === 'set_origin') {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { leadOrigin: step.origin, ...(step.source && !contact.utmSource && { utmSource: step.source, utmMedium: 'whatsapp' }) },
      });
      return null;
    }

    const vars = varsOf(contact.name, contact.phone, {
      origem: originLabel(contact),
      canal_venda: salesChannelPhrase(contact.saleModel),
      modelo_venda: contact.saleModel ?? '',
      faturamento: contact.monthlyRevenue ?? '',
    });
    if (run.meetingId) Object.assign(vars, meetingVars(await this.meetingOf(run)));
    const needsAnswers = 'text' in step && /\{\{\s*respostas\s*\}\}/i.test(step.text);
    if (needsAnswers) vars.respostas = await this.answersOf(run.conversationId, run.startedAt);

    if (step.type === 'notify') {
      await this.notify(run, contact, fillVars(step.text, vars), step.to);
      return null;
    }

    const digits = toBrDigits(contact.phone || '');
    if (!digits) throw new Error('Contato sem telefone.');

    if (step.type === 'send_text') {
      const text = fillVars(step.text, vars);
      const { externalId } = await this.cloud.sendText(run.tenantId, digits, text);
      return this.recordOutbound(run.tenantId, contact.id, digits, { type: 'TEXT', content: text, externalId });
    }

    if (step.type === 'send_buttons') {
      const text = fillVars(step.text, vars);
      const titles = step.buttons.map((b) => b.title);
      const { externalId } = await this.cloud.sendButtons(run.tenantId, digits, text, titles);
      const content = `${text}\n\n${titles.map((t) => `[ ${t} ]`).join('  ')}`;
      return this.recordOutbound(run.tenantId, contact.id, digits, { type: 'INTERACTIVE', content, externalId });
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

  /** O que o contato escreveu desde o início da sessão, uma linha por mensagem. */
  private async answersOf(conversationId: string | null, since: Date) {
    if (!conversationId) return '';
    const msgs = await this.prisma.message.findMany({
      where: { conversationId, direction: 'INBOUND', sentAt: { gte: since } },
      orderBy: { sentAt: 'asc' },
      take: 20,
      select: { content: true },
    });
    return msgs.map((m) => `• ${m.content.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
  }

  /** Aviso para o time: nota interna na conversa do contato + notificação nos aparelhos. */
  private async notify(
    run: { id: string; tenantId: string; conversationId: string | null },
    contact: { id: string; name: string | null; phone: string | null },
    text: string,
    to?: string,
  ) {
    const conversationId = run.conversationId
      ?? (await this.prisma.conversation.findFirst({
        where: { tenantId: run.tenantId, channel: 'WHATSAPP', contactId: contact.id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      }))?.id
      ?? null;
    await this.prisma.activity.create({
      data: { tenantId: run.tenantId, contactId: contact.id, conversationId, type: 'NOTE', content: text, authorName: 'Bot', recipientName: to ?? null },
    });
    this.notifier.send(run.tenantId, 'team_note', {
      title: to ? `Para ${to} — do Bot` : 'Aviso do Bot',
      body: `${contact.name || contact.phone || 'Contato'}: ${text.replace(/\s+/g, ' ').slice(0, 140)}`,
      url: contact.phone ? `/dashboard/conversas?phone=${encodeURIComponent(contact.phone)}` : '/dashboard/conversas',
      tag: `bot-${run.id}`,
    });
  }

  /** Grava a mensagem enviada na conversa do contato (cria a conversa se o lead nunca falou com a gente). */
  private async recordOutbound(
    tenantId: string,
    contactId: string,
    digits: string,
    msg: { type: 'TEXT' | 'TEMPLATE' | 'INTERACTIVE'; content: string; externalId: string | null; templateName?: string },
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

/** {{reuniao_data}} ("quinta-feira, 30/10"), {{reuniao_hora}}, {{meet}}, {{link_remarcar}} e {{link_agendamento}}, no fuso da página. */
export function meetingVars(m: { startAt: Date; meetLink: string | null; manageToken: string; bookingPage: { slug: string; timezone: string } | null }) {
  const timeZone = m.bookingPage?.timezone ?? 'America/Sao_Paulo';
  const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'long' }).format(m.startAt);
  const day = new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit' }).format(m.startAt);
  const manage = `${appUrl()}/reuniao/${m.manageToken}`;
  return {
    reuniao_data: `${weekday}, ${day}`,
    reuniao_hora: new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(m.startAt),
    // Sem Meet (falha no Google): a página da reunião, que mostra os detalhes
    meet: m.meetLink || manage,
    link_remarcar: manage,
    link_agendamento: m.bookingPage ? `${appUrl()}/agendar/${m.bookingPage.slug}` : '',
  };
}

/** Variáveis dos textos: {{nome}}, {{primeiro_nome}} e as extras (canal_venda, faturamento, respostas…). */
export function varsOf(name: string | null, phone: string | null, extra: Record<string, string> = {}): Record<string, string> {
  const clean = (name || '').trim();
  // Contato criado pelo WhatsApp sem nome fica com o número como nome
  const real = clean && clean !== phone && !/^\+?[\d\s()-]+$/.test(clean) ? clean : '';
  const first = real.split(/\s+/)[0] || '';
  const cap = first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : '';
  return { nome: real || 'você', primeiro_nome: cap || 'você', ...extra };
}

/**
 * Preenche as variáveis conhecidas. A linha com uma variável vazia sai do texto
 * (ex.: "Vi aqui que vocês vendem {{canal_venda}}." some quando o form não trouxe o modelo).
 */
export function fillVars(text: string, vars: Record<string, string>) {
  return (text || '')
    .split('\n')
    .flatMap((line) => {
      let empty = false;
      const out = line.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, k) => {
        const key = String(k).toLowerCase();
        if (!(key in vars)) return all;
        if (!vars[key]) empty = true;
        return vars[key];
      });
      return empty ? [] : [out];
    })
    .join('\n');
}
