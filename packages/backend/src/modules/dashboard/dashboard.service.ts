import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAdsInsights, MetaAdsService } from '../meta-ads/meta-ads.service';
import { originOf } from '../pipelines/pipelines.controller';
import { diaBR, isDiaValido, periodoAnterior, periodoBR, PeriodoBR, somaDias } from '../../common/periodo-br.util';

// Contato com uma dessas tags não conta em leads nem reuniões (conversas de teste da equipe)
const TEST_TAGS = ['teste', 'Teste', 'TESTE'];
const MAX_DAYS = 366;
const DAY_MS = 24 * 3600_000;

type LeadContact = { type: string; tags: string[] | null; createdAt: Date; won: boolean };

const isTest = (tags: string[] | null) => !!tags?.some((t) => TEST_TAGS.includes(t));

/**
 * Lead = contato que apareceu pela primeira vez no período, tirando:
 *  - quem já é cliente e não virou cliente por uma venda do funil (fala do financeiro no WhatsApp);
 *  - contatos de teste (tag "teste").
 * Quem fechou venda vira CLIENT, mas continua contando como lead do dia em que chegou.
 */
function classify(c: LeadContact): 'lead' | 'client' | 'test' {
  if (isTest(c.tags)) return 'test';
  if (c.type === 'CLIENT' && !c.won) return 'client';
  return 'lead';
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Grupo do resumo do pipeline, achado pelo nome/tipo da etapa (não pelo id). */
function stageGroup(s: { name: string; kind: string; position: number }, firstOpen: number) {
  if (s.kind === 'WON') return 'fechados';
  if (s.kind === 'LOST') return 'perdidos';
  const n = norm(s.name);
  if (n.includes('qualific')) return 'qualificacao';
  if (n.includes('reuni')) return 'reuniao';
  if (n.includes('proposta') || n.includes('negocia')) return 'negociacao';
  if (n.includes('novo') || s.position === firstOpen) return 'novo';
  return 'outros';
}

const ratio = (a: number, b: number, digits = 1) => (b > 0 ? Math.round((a / b) * 10 ** digits) / 10 ** digits : null);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  return Math.round(v * 10) / 10;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaAds: MetaAdsService,
  ) {}

  async overview(tenantId: string, fromQ?: string, toQ?: string) {
    const today = diaBR();
    const from = fromQ || somaDias(today, -6);
    const to = toQ || today;
    if (!isDiaValido(from) || !isDiaValido(to)) throw new BadRequestException('Datas inválidas (use AAAA-MM-DD).');
    if (from > to) throw new BadRequestException('A data inicial é depois da final.');
    const cur = periodoBR(from, to);
    if (cur.days > MAX_DAYS) throw new BadRequestException(`Período máximo de ${MAX_DAYS} dias.`);
    const prev = periodoAnterior(cur);

    const [now, before, pipeline, metaStatus] = await Promise.all([
      this.periodStats(tenantId, cur),
      this.periodStats(tenantId, prev),
      this.pipelineSummary(tenantId, cur),
      this.metaAds.status(tenantId),
    ]);

    // Meta Ads: os dois períodos ao vivo (com cache de 10 min no serviço)
    let meta: MetaAdsInsights | null = null;
    let metaPrev: MetaAdsInsights | null = null;
    let metaError: string | null = null;
    if (metaStatus.connected && metaStatus.accountId) {
      try {
        [meta, metaPrev] = await Promise.all([
          this.metaAds.insights(tenantId, cur.from, cur.to),
          this.metaAds.insights(tenantId, prev.from, prev.to),
        ]);
      } catch (e: any) {
        metaError = e.message;
      }
    }

    const efficiency = (s: typeof now, m: MetaAdsInsights | null) => ({
      cpl: m ? ratio(m.spend, m.results, 2) : null, // custo por lead do Meta
      cac: m ? ratio(m.spend, s.sales.count, 2) : null,
      roas: m ? ratio(s.sales.value, m.spend, 2) : null,
      costPerMeeting: m ? ratio(m.spend, s.meetings.scheduled, 2) : null,
    });

    // Série diária: leads do CRM × investimento e resultados do Meta
    const metaByDay = new Map((meta?.days ?? []).map((d) => [d.date, d]));
    const daily: { date: string; leads: number; spend: number; metaResults: number }[] = [];
    for (let d = cur.from; d <= cur.to; d = somaDias(d, 1)) {
      const m = metaByDay.get(d);
      daily.push({ date: d, leads: now.leadsByDay.get(d) ?? 0, spend: m?.spend ?? 0, metaResults: m ? m.leads + m.conversations : 0 });
    }

    const strip = ({ leadsByDay, ...rest }: typeof now) => rest;
    return {
      period: { from: cur.from, to: cur.to, days: cur.days },
      previousPeriod: { from: prev.from, to: prev.to },
      current: strip(now),
      previous: strip(before),
      pipeline,
      meta: {
        configured: metaStatus.configured,
        connected: metaStatus.connected,
        accountName: metaStatus.accountName,
        needsAccount: metaStatus.connected && !metaStatus.accountId,
        error: metaError,
        current: meta && { spend: meta.spend, results: meta.results, leads: meta.leads, conversations: meta.conversations },
        previous: metaPrev && { spend: metaPrev.spend, results: metaPrev.results, leads: metaPrev.leads, conversations: metaPrev.conversations },
      },
      efficiency: { current: efficiency(now, meta), previous: efficiency(before, metaPrev) },
      daily,
    };
  }

  /** Números que dependem do período: leads, reuniões, vendas e tempos. */
  private async periodStats(tenantId: string, p: PeriodoBR) {
    const range = { gte: p.start, lt: p.end };
    const [contacts, booked, held, won, lost] = await Promise.all([
      this.prisma.contact.findMany({
        where: { tenantId, createdAt: range },
        select: { type: true, tags: true, createdAt: true, pipelineLeads: { where: { wonAt: { not: null } }, select: { id: true }, take: 1 } },
      }),
      // Agendadas no período (pela data em que a pessoa marcou)
      this.prisma.meeting.findMany({
        where: { tenantId, createdAt: range },
        select: { status: true, createdAt: true, contact: { select: { tags: true, createdAt: true } } },
      }),
      // Realizadas / não compareceu: pela data da reunião
      this.prisma.meeting.findMany({
        where: { tenantId, startAt: range, status: { in: ['COMPLETED', 'NO_SHOW'] } },
        select: { status: true, contact: { select: { tags: true } } },
      }),
      this.prisma.pipelineLead.findMany({
        where: { stage: { pipeline: { tenantId } }, wonAt: range },
        select: { value: true, wonAt: true, contact: { select: { leadOrigin: true, adId: true, utmSource: true, utmMedium: true, createdAt: true } } },
      }),
      this.prisma.pipelineLead.count({ where: { stage: { pipeline: { tenantId } }, lostAt: range } }),
    ]);

    let leads = 0, clients = 0, tests = 0;
    const leadsByDay = new Map<string, number>();
    for (const c of contacts) {
      const kind = classify({ ...c, won: c.pipelineLeads.length > 0 });
      if (kind === 'client') clients++;
      else if (kind === 'test') tests++;
      else {
        leads++;
        const d = diaBR(c.createdAt);
        leadsByDay.set(d, (leadsByDay.get(d) ?? 0) + 1);
      }
    }

    const realBooked = booked.filter((m) => !isTest(m.contact.tags));
    const scheduled = realBooked.filter((m) => m.status !== 'CANCELLED');
    const realHeld = held.filter((m) => !isTest(m.contact.tags));
    const completed = realHeld.filter((m) => m.status === 'COMPLETED').length;
    const noShow = realHeld.length - completed;

    const value = won.reduce((a, l) => a + (l.value ?? 0), 0);
    const byOrigin = new Map<string, { origin: string; count: number; value: number }>();
    for (const l of won) {
      const origin = originOf(l.contact);
      const row = byOrigin.get(origin) ?? { origin, count: 0, value: 0 };
      row.count += 1;
      row.value += l.value ?? 0;
      byOrigin.set(origin, row);
    }

    const days = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / DAY_MS);
    return {
      leads: { count: leads, excluded: { clients, tests } },
      leadsByDay,
      meetings: {
        scheduled: scheduled.length,
        cancelled: realBooked.length - scheduled.length,
        completed,
        noShow,
        showRate: pct(completed, completed + noShow),
      },
      sales: {
        count: won.length,
        value,
        ticket: won.length ? Math.round(value / won.length) : null,
        conversion: pct(won.length, leads), // vendas ÷ leads que chegaram no período
        lost,
        byOrigin: [...byOrigin.values()].sort((a, b) => b.value - a.value),
      },
      // Mediana (não média): contato antigo da base que compra agora distorceria a média
      times: {
        leadToMeetingDays: median(scheduled.map((m) => days(m.contact.createdAt, m.createdAt))),
        leadToSaleDays: median(won.map((l) => days(l.contact.createdAt, l.wonAt!))),
      },
    };
  }

  /** Resumo do funil "Vendas": cards em cada etapa agora; fechados também no período. */
  private async pipelineSummary(tenantId: string, p: PeriodoBR) {
    const pipelines = await this.prisma.pipeline.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    const pipe = pipelines.find((x) => norm(x.name).trim() === 'vendas') ?? pipelines[0];
    if (!pipe) return null;

    const [counts, wonInPeriod] = await Promise.all([
      this.prisma.pipelineLead.groupBy({
        by: ['stageId'],
        where: { stage: { pipelineId: pipe.id } },
        _count: { _all: true },
        _sum: { value: true },
      }),
      this.prisma.pipelineLead.count({ where: { stage: { pipelineId: pipe.id }, wonAt: { gte: p.start, lt: p.end } } }),
    ]);
    const byStage = new Map(counts.map((c) => [c.stageId, { count: c._count._all, value: c._sum.value ?? 0 }]));
    const firstOpen = pipe.stages.find((s) => s.kind === 'OPEN')?.position ?? 0;

    const stages = pipe.stages.map((s) => ({
      id: s.id, name: s.name, kind: s.kind, color: s.color,
      group: stageGroup(s, firstOpen),
      count: byStage.get(s.id)?.count ?? 0,
      value: byStage.get(s.id)?.value ?? 0,
    }));
    const groups: Record<string, { count: number; value: number; stages: string[] }> = {};
    for (const s of stages) {
      const g = (groups[s.group] ??= { count: 0, value: 0, stages: [] });
      g.count += s.count;
      g.value += s.value;
      g.stages.push(s.name);
    }
    const open = stages.filter((s) => s.kind === 'OPEN');
    return {
      id: pipe.id,
      name: pipe.name,
      stages,
      groups,
      open: { count: open.reduce((a, s) => a + s.count, 0), value: open.reduce((a, s) => a + s.value, 0) },
      wonInPeriod,
    };
  }
}
