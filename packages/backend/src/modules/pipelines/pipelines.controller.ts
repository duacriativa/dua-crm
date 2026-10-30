import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';

const STAGE_KINDS = ['OPEN', 'WON', 'LOST'];
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'ads', 'ctwa'];

/** Origem para relatório: a marcada à mão vence; senão deduz do anúncio/UTM. */
export function originOf(c: { leadOrigin: string | null; adId: string | null; utmSource: string | null; utmMedium: string | null }) {
  if (c.leadOrigin) return c.leadOrigin;
  if (c.adId) return 'ADS';
  if (c.utmMedium && PAID_MEDIUMS.includes(c.utmMedium.toLowerCase())) return 'ADS';
  if (c.utmSource) return 'OTHER';
  return 'UNKNOWN';
}

/** Início do mês corrente no horário de Brasília (UTC-3, sem horário de verão). */
function monthStartBR(offsetMonths = 0) {
  const br = new Date(Date.now() - 3 * 3600_000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth() + offsetMonths, 1, 3));
}

@Controller('pipelines')
@UseGuards(JwtAuthGuard)
export class PipelinesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Pipelines ──────────────────────────────────────────────────────────────

  @Get()
  async findAll(@Request() req: any) {
    return this.prisma.pipeline.findMany({
      where: { tenantId: req.user.tenantId },
      include: {
        stages: {
          orderBy: { position: 'asc' },
          include: {
            leads: {
              include: {
                contact: {
                  select: {
                    id: true, name: true, phone: true, tags: true, instagramHandle: true, notes: true,
                    leadOrigin: true, adId: true, adHeadline: true, adSourceUrl: true,
                    utmSource: true, utmMedium: true, utmCampaign: true,
                  },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post()
  async create(@Request() req: any, @Body() body: { name: string }) {
    return this.prisma.pipeline.create({
      data: {
        tenantId: req.user.tenantId,
        name: body.name,
        stages: {
          create: [
            { name: 'Novo Lead', color: '#6366F1', position: 0 },
            { name: 'Em Andamento', color: '#F59E0B', position: 1 },
            { name: 'Fechado', color: '#10B981', position: 2, kind: 'WON' },
          ],
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.prisma.pipeline.deleteMany({ where: { id, tenantId: req.user.tenantId } });
  }

  // ── Stages ─────────────────────────────────────────────────────────────────

  @Post(':pipelineId/stages')
  async createStage(
    @Request() req: any,
    @Param('pipelineId') pipelineId: string,
    @Body() body: { name: string; color?: string },
  ) {
    const count = await this.prisma.pipelineStage.count({ where: { pipelineId } });
    return this.prisma.pipelineStage.create({
      data: { pipelineId, name: body.name, color: body.color || '#6366F1', position: count },
    });
  }

  @Patch('stages/:stageId')
  async updateStage(
    @Request() req: any,
    @Param('stageId') stageId: string,
    @Body() body: { name?: string; color?: string; position?: number; kind?: string },
  ) {
    if (body.kind === undefined) {
      return this.prisma.pipelineStage.update({ where: { id: stageId }, data: body });
    }
    if (!STAGE_KINDS.includes(body.kind)) throw new BadRequestException('Tipo de etapa inválido');
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { tenantId: req.user.tenantId } },
      select: { id: true },
    });
    if (!stage) throw new NotFoundException('Etapa não encontrada');

    // Os cards que já estão na etapa passam a contar como ganhos/perdidos (ou voltam a abertos)
    const now = new Date();
    const outcome =
      body.kind === 'WON' ? { wonAt: now, lostAt: null, lostReason: null }
      : body.kind === 'LOST' ? { lostAt: now, wonAt: null }
      : { wonAt: null, lostAt: null, lostReason: null };
    const [updated] = await this.prisma.$transaction([
      this.prisma.pipelineStage.update({ where: { id: stageId }, data: body }),
      this.prisma.pipelineLead.updateMany({
        where: { stageId, ...(body.kind === 'WON' ? { wonAt: null } : body.kind === 'LOST' ? { lostAt: null } : {}) },
        data: outcome,
      }),
    ]);
    return updated;
  }

  @Delete('stages/:stageId')
  async removeStage(@Param('stageId') stageId: string) {
    return this.prisma.pipelineStage.deleteMany({ where: { id: stageId } });
  }

  /** Funis (só as etapas) e os cards de um contato: painel da conversa troca a etapa sem abrir o funil. */
  @Get('contact/:contactId')
  async forContact(@Request() req: any, @Param('contactId') contactId: string) {
    const tenantId = req.user.tenantId;
    const [pipelines, cards] = await Promise.all([
      this.prisma.pipeline.findMany({
        where: { tenantId },
        select: { id: true, name: true, stages: { select: { id: true, name: true, color: true, kind: true }, orderBy: { position: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.pipelineLead.findMany({
        where: { contactId, stage: { pipeline: { tenantId } } },
        select: { id: true, stageId: true, value: true, updatedAt: true, stage: { select: { pipelineId: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return {
      pipelines,
      cards: cards.map((c) => ({ id: c.id, stageId: c.stageId, pipelineId: c.stage.pipelineId, value: c.value, updatedAt: c.updatedAt })),
    };
  }

  // ── Leads ──────────────────────────────────────────────────────────────────

  @Post('stages/:stageId/leads')
  async createLead(
    @Request() req: any,
    @Param('stageId') stageId: string,
    @Body() body: { name: string; phone?: string; email?: string; value?: number; contactId?: string },
  ) {
    const count = await this.prisma.pipelineLead.count({ where: { stageId } });

    let contactId = body.contactId;
    if (!contactId && body.name) {
      const contact = await this.prisma.contact.create({
        data: {
          tenantId: req.user.tenantId,
          name: body.name,
          phone: body.phone || null,
          email: body.email || null,
        },
      });
      contactId = contact.id;
    }

    return this.prisma.pipelineLead.create({
      data: { stageId, contactId: contactId!, value: body.value || null, position: count },
      include: { contact: { select: { id: true, name: true, phone: true } } },
    });
  }

  /**
   * Move o card. Numa etapa de ganho grava a data do fechamento e o valor fechado
   * (e o contato vira cliente); numa de perda grava data e motivo; numa aberta limpa os dois.
   */
  @Patch('leads/:leadId/move')
  async moveLead(
    @Request() req: any,
    @Param('leadId') leadId: string,
    @Body() body: { stageId: string; value?: number; lostReason?: string; wonItem?: string },
  ) {
    const tenantId = req.user.tenantId;
    const [stage, lead] = await Promise.all([
      this.prisma.pipelineStage.findFirst({ where: { id: body.stageId, pipeline: { tenantId } }, select: { kind: true } }),
      this.prisma.pipelineLead.findFirst({
        where: { id: leadId, stage: { pipeline: { tenantId } } },
        select: { contactId: true, stageId: true, wonAt: true, lostAt: true },
      }),
    ]);
    if (!stage || !lead) throw new NotFoundException('Card ou etapa não encontrado');

    const value = typeof body.value === 'number' && Number.isFinite(body.value) && body.value >= 0 ? body.value : undefined;
    const lostReason = typeof body.lostReason === 'string' && body.lostReason.trim() ? body.lostReason.trim().slice(0, 500) : undefined;
    const wonItem = stage.kind === 'WON' && typeof body.wonItem === 'string' && body.wonItem.trim() ? body.wonItem.trim().slice(0, 200) : undefined;
    const now = new Date();
    const outcome =
      stage.kind === 'WON' ? { wonAt: lead.wonAt ?? now, lostAt: null, lostReason: null }
      : stage.kind === 'LOST' ? { lostAt: lead.lostAt ?? now, wonAt: null, ...(lostReason !== undefined && { lostReason }) }
      : { wonAt: null, lostAt: null, lostReason: null };

    const updated = await this.prisma.pipelineLead.update({
      where: { id: leadId },
      data: { stageId: body.stageId, ...outcome, ...(value !== undefined && { value }), ...(wonItem !== undefined && { wonItem }) },
    });
    if (stage.kind === 'WON') {
      await this.prisma.contact.updateMany({
        where: { id: lead.contactId, tenantId, type: 'LEAD' },
        data: { type: 'CLIENT', clientSince: now },
      });
    }
    // Bots com o gatilho "Card entrou na etapa do funil"
    if (lead.stageId !== body.stageId) {
      this.events.emit('funnel.stage_entered', { tenantId, contactId: lead.contactId, stageId: body.stageId });
    }
    return updated;
  }

  @Patch('leads/:leadId')
  async updateLead(
    @Request() req: any,
    @Param('leadId') leadId: string,
    @Body() body: { value?: number | null; notes?: string; lostReason?: string; wonItem?: string | null },
  ) {
    // Só campos editáveis, e só em card do próprio tenant
    const lead = await this.prisma.pipelineLead.findFirst({ where: { id: leadId, stage: { pipeline: { tenantId: req.user.tenantId } } }, select: { id: true } });
    if (!lead) throw new NotFoundException('Card não encontrado');
    const { value, notes, lostReason, wonItem } = body;
    return this.prisma.pipelineLead.update({
      where: { id: leadId },
      data: {
        ...(value !== undefined && { value }),
        ...(notes !== undefined && { notes }),
        ...(lostReason !== undefined && { lostReason }),
        ...(wonItem !== undefined && { wonItem: wonItem?.trim().slice(0, 200) || null }),
      },
    });
  }

  // ── Resumo de vendas (dashboard) ───────────────────────────────────────────

  /** Vendas do mês corrente (horário de Brasília), com comparação ao mês anterior e quebra por origem. */
  @Get('sales-stats')
  async salesStats(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const start = monthStartBR();
    const end = monthStartBR(1);
    const prevStart = monthStartBR(-1);
    const inTenant = { stage: { pipeline: { tenantId } } };
    const contactSelect = { leadOrigin: true, adId: true, utmSource: true, utmMedium: true };

    const [won, prevWon, lostCount, newLeads, open] = await Promise.all([
      this.prisma.pipelineLead.findMany({
        where: { ...inTenant, wonAt: { gte: start, lt: end } },
        select: { value: true, contact: { select: contactSelect } },
      }),
      this.prisma.pipelineLead.aggregate({
        where: { ...inTenant, wonAt: { gte: prevStart, lt: start } },
        _count: true,
        _sum: { value: true },
      }),
      this.prisma.pipelineLead.count({ where: { ...inTenant, lostAt: { gte: start, lt: end } } }),
      this.prisma.pipelineLead.count({ where: { ...inTenant, createdAt: { gte: start, lt: end } } }),
      this.prisma.pipelineLead.aggregate({
        where: { stage: { kind: 'OPEN', pipeline: { tenantId } } },
        _count: true,
        _sum: { value: true },
      }),
    ]);

    const wonValue = won.reduce((a, l) => a + (l.value ?? 0), 0);
    const byOrigin = new Map<string, { origin: string; count: number; value: number }>();
    for (const l of won) {
      const origin = originOf(l.contact);
      const row = byOrigin.get(origin) ?? { origin, count: 0, value: 0 };
      row.count += 1;
      row.value += l.value ?? 0;
      byOrigin.set(origin, row);
    }

    return {
      period: { from: start, to: end },
      won: { count: won.length, value: wonValue },
      prevWon: { count: prevWon._count, value: prevWon._sum.value ?? 0 },
      lost: { count: lostCount },
      open: { count: open._count, value: open._sum.value ?? 0 },
      newLeads,
      ticketMedio: won.length ? Math.round(wonValue / won.length) : 0,
      conversionRate: newLeads ? Math.round((won.length / newLeads) * 1000) / 10 : 0,
      byOrigin: [...byOrigin.values()].sort((a, b) => b.value - a.value),
    };
  }

  @Delete('leads/:leadId')
  async removeLead(@Param('leadId') leadId: string) {
    return this.prisma.pipelineLead.deleteMany({ where: { id: leadId } });
  }
}
