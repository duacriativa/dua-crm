import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AutomationRunner } from './automation-runner.service';
import { sanitizeSteps, TRIGGER_LABEL } from './automation-steps';
import { normalizePhone, phoneVariants } from '../../common/phone.util';

const ACTIVE = ['RUNNING', 'WAITING_REPLY'];

function conditionsOf(input: any) {
  const onlyPhones = Array.isArray(input?.onlyPhones)
    ? input.onlyPhones.map((p: any) => normalizePhone(String(p))).filter(Boolean)
    : [];
  return onlyPhones.length ? { onlyPhones } : {};
}

function stepsOrThrow(actions: any, strict = true) {
  try {
    return sanitizeSteps(actions, strict);
  } catch (err: any) {
    throw new BadRequestException(err.message);
  }
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
   * Onde as sessões estão agora e onde terminaram, por passo (índice em `actions`).
   * O histórico completo do caminho não é guardado: só o passo atual de cada sessão.
   */
  @Get(':id/step-stats')
  async stepStats(@Request() req: any, @Param('id') id: string) {
    const groups = await this.prisma.automationRun.groupBy({
      by: ['stepIndex', 'status'],
      where: { tenantId: req.user.tenantId, automationId: id, isTest: false },
      _count: { _all: true },
    });
    return groups.map((g) => ({ stepIndex: g.stepIndex, status: g.status, count: g._count._all }));
  }

  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException('Dê um nome ao bot.');
    // Gatilhos já ligados ao executor (os outros do enum ainda não disparam)
    if (!['LEAD_FORM_SUBMITTED'].includes(body?.trigger)) throw new BadRequestException('Gatilho ainda não disponível.');
    return this.prisma.automation.create({
      data: {
        tenantId: req.user.tenantId,
        name,
        description: body.description?.trim() || null,
        trigger: body.trigger,
        conditions: conditionsOf(body.conditions),
        actions: stepsOrThrow(body.actions, body.active === true) as any,
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
    if (body.conditions !== undefined) data.conditions = conditionsOf(body.conditions);
    if (body.active !== undefined) data.active = body.active === true;
    const willBeActive = data.active ?? current.active;
    if (body.actions !== undefined) data.actions = stepsOrThrow(body.actions, willBeActive);
    // Ligar exige os passos completos (template escolhido, etapa etc.)
    else if (willBeActive && !current.active) stepsOrThrow(current.actions, true);

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

    const run = await this.runner.start(id, tenantId, contact.id, { isTest: true });
    return { ok: true, runId: run.id, contactId: contact.id };
  }
}
