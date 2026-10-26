import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AutomationRunner } from './automation-runner.service';
import { MEETING_STEPS, sanitizeReminders, sanitizeSteps, TRIGGER_LABEL } from './automation-steps';
import { normalizePhone, phoneVariants } from '../../common/phone.util';

const ACTIVE = ['RUNNING', 'WAITING_REPLY'];

function conditionsOf(input: any, strict = true) {
  const onlyPhones = Array.isArray(input?.onlyPhones)
    ? input.onlyPhones.map((p: any) => normalizePhone(String(p))).filter(Boolean)
    : [];
  let reminders;
  try {
    reminders = sanitizeReminders(input?.reminders, strict);
  } catch (err: any) {
    throw new BadRequestException(err.message);
  }
  const giveUp = Math.round(Number(input?.giveUpSeconds));
  return {
    ...(onlyPhones.length ? { onlyPhones } : {}),
    ...(reminders.length ? { reminders } : {}),
    ...(reminders.length && giveUp >= 3600 && giveUp <= 30 * 24 * 3600 ? { giveUpSeconds: giveUp } : {}),
  };
}

// Gatilhos já ligados ao executor (os outros do enum ainda não disparam)
const TRIGGERS = ['LEAD_FORM_SUBMITTED', 'WHATSAPP_FIRST_MESSAGE', 'MEETING_SCHEDULED'];

function stepsOrThrow(actions: any, strict = true, trigger?: string) {
  let steps;
  try {
    steps = sanitizeSteps(actions, strict);
  } catch (err: any) {
    throw new BadRequestException(err.message);
  }
  if (trigger && trigger !== 'MEETING_SCHEDULED' && steps.some((s) => MEETING_STEPS.includes(s.type))) {
    throw new BadRequestException('Os passos de reunião só funcionam com o gatilho "Reunião agendada".');
  }
  return steps;
}

@Controller('automations')
@UseGuards(JwtAuthGuard)
export class AutomationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: AutomationRunner,
  ) {}

  /** Bots com os números da tela: sessões, ativas, enviados e quem respondeu. */
  @Get()
  async list(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const [automations, byStatus, sums, replied] = await Promise.all([
      this.prisma.automation.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.automationRun.groupBy({ by: ['automationId', 'status'], where: { tenantId }, _count: { _all: true } }),
      this.prisma.automationRun.groupBy({ by: ['automationId'], where: { tenantId }, _sum: { sentCount: true }, _max: { startedAt: true } }),
      this.prisma.automationRun.groupBy({ by: ['automationId'], where: { tenantId, repliedAt: { not: null } }, _count: { _all: true } }),
    ]);
    return automations.map((a) => {
      const counts: Record<string, number> = {};
      for (const r of byStatus) if (r.automationId === a.id) counts[r.status] = r._count._all;
      const sum = sums.find((s) => s.automationId === a.id);
      const sessions = Object.values(counts).reduce((x, y) => x + y, 0);
      return {
        ...a,
        triggerLabel: TRIGGER_LABEL[a.trigger] ?? a.trigger,
        stats: {
          sessions,
          active: ACTIVE.reduce((x, s) => x + (counts[s] ?? 0), 0),
          completed: counts.COMPLETED ?? 0,
          failed: counts.FAILED ?? 0,
          sent: sum?._sum.sentCount ?? 0,
          replied: replied.find((r) => r.automationId === a.id)?._count._all ?? 0,
          lastRunAt: sum?._max.startedAt ?? null,
        },
      };
    });
  }

  /** Últimas sessões do bot (para conferir o que aconteceu com cada contato). */
  @Get(':id/runs')
  async runs(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const runs = await this.prisma.automationRun.findMany({
      where: { tenantId, automationId: id },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId, id: { in: [...new Set(runs.map((r) => r.contactId))] } },
      select: { id: true, name: true, phone: true },
    });
    return runs.map((r) => ({ ...r, contact: contacts.find((c) => c.id === r.contactId) ?? null }));
  }

  /**
   * Onde as sessões estão agora e onde terminaram, por passo (índice em `actions`),
   * e quantas passaram por cada passo (id), a partir de `visitedSteps`.
   */
  @Get(':id/step-stats')
  async stepStats(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const [groups, visited, tracked] = await Promise.all([
      this.prisma.automationRun.groupBy({
        by: ['stepIndex', 'status'],
        where: { tenantId, automationId: id, isTest: false },
        _count: { _all: true },
      }),
      // Sessões que passaram por cada passo (cada sessão conta uma vez por passo)
      this.prisma.$queryRaw<{ stepId: string; count: number }[]>`
        SELECT s."stepId", COUNT(DISTINCT r.id)::int AS count
        FROM "AutomationRun" r, unnest(r."visitedSteps") AS s("stepId")
        WHERE r."tenantId" = ${tenantId} AND r."automationId" = ${id} AND r."isTest" = false
        GROUP BY s."stepId"`,
      this.prisma.automationRun.count({ where: { tenantId, automationId: id, isTest: false, NOT: { visitedSteps: { isEmpty: true } } } }),
    ]);
    return {
      runs: groups.map((g) => ({ stepIndex: g.stepIndex, status: g.status, count: g._count._all })),
      visited: Object.fromEntries(visited.map((v) => [v.stepId, v.count])),
      tracked, // sessões com histórico (as anteriores ao histórico não entram no "passaram")
    };
  }

  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException('Dê um nome ao bot.');
    if (!TRIGGERS.includes(body?.trigger)) throw new BadRequestException('Gatilho ainda não disponível.');
    return this.prisma.automation.create({
      data: {
        tenantId: req.user.tenantId,
        name,
        description: body.description?.trim() || null,
        trigger: body.trigger,
        conditions: conditionsOf(body.conditions, body.active === true),
        actions: stepsOrThrow(body.actions, body.active === true, body.trigger) as any,
        // Nasce pausado: só liga depois de desligar o equivalente no Kommo
        active: body.active === true,
      },
    });
  }

  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = req.user.tenantId;
    const current = await this.prisma.automation.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Bot não encontrado');

    const data: any = {};
    if (body.name !== undefined) {
      if (!String(body.name).trim()) throw new BadRequestException('Dê um nome ao bot.');
      data.name = String(body.name).trim();
    }
    if (body.description !== undefined) data.description = String(body.description || '').trim() || null;
    if (body.active !== undefined) data.active = body.active === true;
    const willBeActive = data.active ?? current.active;
    if (body.conditions !== undefined) data.conditions = conditionsOf(body.conditions, willBeActive);
    // Ligar exige os lembretes completos (template escolhido)
    else if (willBeActive && !current.active) conditionsOf(current.conditions, true);
    if (body.actions !== undefined) data.actions = stepsOrThrow(body.actions, willBeActive, current.trigger);
    // Ligar exige os passos completos (template escolhido, etapa etc.)
    else if (willBeActive && !current.active) stepsOrThrow(current.actions, true, current.trigger);

    const updated = await this.prisma.automation.update({ where: { id }, data });
    // Pausar encerra as sessões em andamento (senão elas voltariam fora de contexto ao religar)
    if (current.active && data.active === false) {
      await this.prisma.automationRun.updateMany({
        where: { automationId: id, status: { in: ACTIVE }, isTest: false },
        data: { status: 'CANCELLED', finishedAt: new Date(), nextRunAt: null },
      });
    }
    return updated;
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.prisma.automation.deleteMany({ where: { id, tenantId: req.user.tenantId } });
    return { ok: true };
  }

  /**
   * Roda o bot agora para um número (mesmo pausado e sem o gatilho), para testar
   * com o próprio WhatsApp. Cria o contato se o número ainda não existir.
   */
  @Post(':id/test')
  async test(@Request() req: any, @Param('id') id: string, @Body() body: { phone: string; name?: string }) {
    const tenantId = req.user.tenantId;
    const automation = await this.prisma.automation.findFirst({ where: { id, tenantId } });
    if (!automation) throw new NotFoundException('Bot não encontrado');
    stepsOrThrow(automation.actions, true);
    conditionsOf(automation.conditions, true);
    const phone = normalizePhone(String(body?.phone ?? ''));
    if (!phone || phone.length < 12) throw new BadRequestException('Informe um número com DDD.');

    const contact =
      (await this.prisma.contact.findFirst({ where: { tenantId, phone: { in: phoneVariants(phone) } } })) ??
      (await this.prisma.contact.create({
        data: { tenantId, type: 'LEAD', name: body.name?.trim() || 'Teste do bot', phone, tags: ['teste-bot'] },
      }));
    const running = await this.prisma.automationRun.findFirst({
      where: { automationId: id, contactId: contact.id, status: { in: ACTIVE } },
      select: { id: true },
    });
    if (running) throw new BadRequestException('Esse número já tem uma sessão em andamento neste bot.');

    // Bot de reunião: o teste usa a próxima reunião marcada desse número
    let meetingId: string | undefined;
    if (automation.trigger === 'MEETING_SCHEDULED') {
      const meeting = await this.prisma.meeting.findFirst({
        where: { tenantId, contactId: contact.id, status: 'SCHEDULED', endAt: { gt: new Date() } },
        orderBy: { startAt: 'asc' },
        select: { id: true },
      });
      if (!meeting) throw new BadRequestException('Esse número não tem reunião marcada. Agende uma pelo link de agendamento para testar.');
      meetingId = meeting.id;
    }

    const run = await this.runner.start(id, tenantId, contact.id, { isTest: true, meetingId });
    return { ok: true, runId: run.id, contactId: contact.id };
  }
}
