import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotifyService } from '../notifications/notify.service';
import { askClaude, parseJsonObject } from '../contacts/claude';
import { DesiredTask, RulesSnapshot, evaluateRules, planSync } from './sales-tasks.rules';

const TZ = 'America/Sao_Paulo';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BRT_OFFSET = -3 * HOUR;
const TICK_MS = 15 * 60 * 1000;
/** Leitura da IA: dias úteis a partir das 8h de Brasília (uma vez por dia, até o meio-dia). */
const AI_HOUR = 8;
const AI_LAST_HOUR = 12;

export type TaskFilter = 'today' | 'overdue' | 'all';

/** Data e hora de Brasília de um instante. */
function brt(d: Date) {
  const l = new Date(d.getTime() + BRT_OFFSET);
  return { date: l.toISOString().slice(0, 10), hour: l.getUTCHours(), dow: l.getUTCDay() };
}

/** Início do dia (Brasília) de `d`, em UTC. */
function startOfDayBrt(d: Date) {
  const l = new Date(d.getTime() + BRT_OFFSET);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - BRT_OFFSET);
}

/**
 * Tarefas do comercial: a cada 15 min as regras abrem e fecham tarefas sozinhas; nos dias úteis
 * às 8h o Claude lê as conversas do dia anterior e os cards abertos e sugere o que as regras não pegam.
 */
@Injectable()
export class SalesTasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SalesTasksService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifyService,
  ) {}

  onModuleInit() {
    setTimeout(() => this.tick(), 2 * 60 * 1000).unref();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { active: true }, select: { id: true } });
      for (const t of tenants) {
        await this.runRules(t.id).catch((e) => this.logger.error(`[Tarefas] Regras falharam (${t.id}): ${e.message}`));
        await this.maybeDailyAi(t.id).catch((e) => this.logger.error(`[Tarefas] Leitura da IA falhou (${t.id}): ${e.message}`));
      }
    } finally {
      this.running = false;
    }
  }

  // ── Regras ──────────────────────────────────────────────

  async loadSnapshot(tenantId: string, now = new Date()): Promise<RulesSnapshot> {
    const since30 = new Date(now.getTime() - 30 * DAY);
    const since60 = new Date(now.getTime() - 60 * DAY);

    const [meetings, leads, lastMsgs, lastTeam, runs, notes] = await Promise.all([
      this.prisma.meeting.findMany({
        where: { tenantId, endAt: { gte: since30 }, startAt: { lte: new Date(now.getTime() + 60 * DAY) } },
        select: { id: true, contactId: true, status: true, startAt: true, endAt: true, createdAt: true },
      }),
      this.prisma.pipelineLead.findMany({
        where: { stage: { pipeline: { tenantId } } },
        select: { id: true, contactId: true, value: true, updatedAt: true, stage: { select: { name: true, kind: true } } },
      }),
      this.prisma.$queryRaw<{ conversationId: string; id: string; direction: 'INBOUND' | 'OUTBOUND'; sentAt: Date }[]>`
        SELECT DISTINCT ON (m."conversationId") m."conversationId", m."id", m."direction"::text AS "direction", m."sentAt"
        FROM "Message" m JOIN "Conversation" c ON c."id" = m."conversationId"
        WHERE c."tenantId" = ${tenantId} AND m."sentAt" >= ${since30}
        ORDER BY m."conversationId", m."sentAt" DESC`,
      this.prisma.$queryRaw<{ conversationId: string; sentAt: Date }[]>`
        SELECT m."conversationId", MAX(m."sentAt") AS "sentAt"
        FROM "Message" m JOIN "Conversation" c ON c."id" = m."conversationId"
        WHERE c."tenantId" = ${tenantId} AND m."sentAt" >= ${since60} AND m."direction" = 'OUTBOUND'
          AND (m."senderName" IS NULL OR m."senderName" <> 'Bot')
        GROUP BY m."conversationId"`,
      this.prisma.automationRun.findMany({
        where: { tenantId, isTest: false, status: { in: ['RUNNING', 'WAITING_REPLY'] } },
        select: { contactId: true },
      }),
      this.prisma.activity.findMany({
        where: { tenantId, authorName: 'Bot', createdAt: { gte: new Date(now.getTime() - 7 * DAY) } },
        select: { id: true, contactId: true, conversationId: true, content: true, createdAt: true },
      }),
    ]);

    const convIds = [...new Set([...lastMsgs.map((m) => m.conversationId), ...lastTeam.map((m) => m.conversationId)])];
    const convs = convIds.length
      ? await this.prisma.conversation.findMany({ where: { id: { in: convIds } }, select: { id: true, contactId: true, status: true } })
      : [];
    const lastBy = new Map(lastMsgs.map((m) => [m.conversationId, m]));
    const teamBy = new Map(lastTeam.map((m) => [m.conversationId, m.sentAt]));

    const contactIds = [...new Set([...meetings.map((m) => m.contactId), ...leads.map((l) => l.contactId), ...convs.map((c) => c.contactId), ...notes.map((n) => n.contactId)])];
    const contacts = contactIds.length
      ? await this.prisma.contact.findMany({ where: { tenantId, id: { in: contactIds } }, select: { id: true, name: true, phone: true, instagramHandle: true } })
      : [];

    return {
      now,
      contacts: Object.fromEntries(contacts.map((c) => [c.id, c])),
      meetings,
      leads: leads.map((l) => ({ id: l.id, contactId: l.contactId, value: l.value, updatedAt: l.updatedAt, stageName: l.stage.name, stageKind: l.stage.kind })),
      conversations: convs.map((c) => {
        const last = lastBy.get(c.id);
        return {
          id: c.id,
          contactId: c.contactId,
          status: c.status,
          lastMessage: last ? { id: last.id, direction: last.direction, sentAt: new Date(last.sentAt) } : null,
          lastTeamOutboundAt: teamBy.has(c.id) ? new Date(teamBy.get(c.id)!) : null,
        };
      }),
      activeBotContactIds: [...new Set(runs.map((r) => r.contactId))],
      botNotes: notes,
    };
  }

  /** Aplica as regras: cria as tarefas novas e fecha as que a condição sumiu. */
  async runRules(tenantId: string) {
    const snapshot = await this.loadSnapshot(tenantId);
    const desired = evaluateRules(snapshot);
    const existing = await this.prisma.salesTask.findMany({
      where: { tenantId, OR: [{ ruleKey: { in: desired.map((d) => d.ruleKey) } }, { source: 'RULE', status: 'OPEN' }] },
      select: { id: true, ruleKey: true, status: true, source: true },
    });
    const { create, autoClose } = planSync(desired, existing);

    if (autoClose.length) {
      await this.prisma.salesTask.updateMany({
        where: { id: { in: autoClose }, status: 'OPEN' },
        data: { status: 'DONE', closedAt: new Date(), closedBy: 'Sistema' },
      });
    }
    const created = await this.createTasks(tenantId, create, 'RULE');
    await this.announce(tenantId, created);
    return { created: created.length, closed: autoClose.length };
  }

  private async createTasks(tenantId: string, tasks: DesiredTask[], source: 'RULE' | 'AI') {
    const created: DesiredTask[] = [];
    for (const t of tasks) {
      const r = await this.prisma.salesTask.createMany({
        data: [{ tenantId, source, ruleKey: t.ruleKey, kind: t.kind, contactId: t.contactId, conversationId: t.conversationId, title: t.title.slice(0, 200), reason: t.reason.slice(0, 1000), dueAt: t.dueAt }],
        skipDuplicates: true,
      });
      if (r.count) created.push(t);
    }
    return created;
  }

  private async announce(tenantId: string, created: { title: string }[], title?: string) {
    if (!created.length) return;
    await this.notifier.send(tenantId, 'sales_task', {
      title: title ?? (created.length === 1 ? 'Nova tarefa' : `${created.length} tarefas novas`),
      body: created.slice(0, 3).map((t) => t.title).join(' · ') + (created.length > 3 ? ` e mais ${created.length - 3}` : ''),
      url: '/dashboard/tarefas',
      tag: 'sales-tasks',
    });
  }

  // ── Leitura diária da IA ────────────────────────────────

  private async maybeDailyAi(tenantId: string, now = new Date()) {
    if (!process.env.ANTHROPIC_API_KEY) return;
    const { date, hour, dow } = brt(now);
    if (dow === 0 || dow === 6 || hour < AI_HOUR || hour >= AI_LAST_HOUR) return;
    // Marca antes de rodar: duas instâncias (deploy) não leem duas vezes
    const key = `sales-tasks-ai:${tenantId}:${date}`;
    const lock = await this.prisma.appSetting.createMany({ data: [{ key, value: now.toISOString() }], skipDuplicates: true });
    if (lock.count === 0) return;
    await this.dailyAi(tenantId, now);
  }

  /** Lê as conversas recentes e os cards abertos; cria tarefas que as regras não pegam. Segunda: resumo da semana. */
  async dailyAi(tenantId: string, now = new Date()) {
    const monday = brt(now).dow === 1;
    // Segunda lê desde sexta de manhã (o fim de semana entra)
    const since = new Date(now.getTime() - (monday ? 72 : 24) * HOUR);

    const recent = await this.prisma.message.findMany({
      where: { sentAt: { gte: since }, conversation: { tenantId } },
      orderBy: { sentAt: 'asc' },
      take: 1500,
      select: { conversationId: true, direction: true, content: true, transcription: true, senderName: true, sentAt: true, type: true },
    });
    const convIds = [...new Set(recent.map((m) => m.conversationId))];
    const convs = convIds.length
      ? await this.prisma.conversation.findMany({ where: { id: { in: convIds } }, select: { id: true, contactId: true, channel: true, contact: { select: { name: true, phone: true, type: true } } } })
      : [];
    const openLeads = await this.prisma.pipelineLead.findMany({
      where: { stage: { kind: 'OPEN', pipeline: { tenantId } } },
      select: { contactId: true, value: true, updatedAt: true, stage: { select: { name: true } }, contact: { select: { name: true, phone: true } } },
    });
    const openTasks = await this.prisma.salesTask.findMany({ where: { tenantId, status: 'OPEN' }, select: { contactId: true, title: true } });

    const stageOf = new Map(openLeads.map((l) => [l.contactId, l]));
    const contactName = new Map<string, string>();
    for (const c of convs) contactName.set(c.contactId, c.contact.name || c.contact.phone || 'Contato');
    for (const l of openLeads) contactName.set(l.contactId, l.contact.name || l.contact.phone || 'Contato');

    const fmt = (d: Date) => d.toLocaleString('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    let budget = 60_000;
    const blocks: string[] = [];
    for (const c of convs) {
      const lead = stageOf.get(c.contactId);
      const lines = recent
        .filter((m) => m.conversationId === c.id)
        .slice(-40)
        .map((m) => {
          const who = m.direction === 'INBOUND' ? 'Contato' : m.senderName === 'Bot' ? 'Bot' : 'Time';
          const text = (m.transcription || m.content || `[${m.type}]`).replace(/\s+/g, ' ').slice(0, 300);
          return `[${fmt(m.sentAt)}] ${who}: ${text}`;
        });
      const block = [
        `### contactId=${c.contactId} — ${contactName.get(c.contactId)} (${c.channel}${c.contact.type === 'CLIENT' ? ', cliente' : ''})`,
        lead ? `Card: ${lead.stage.name}${lead.value ? `, R$ ${lead.value.toLocaleString('pt-BR')}` : ''}` : 'Sem card aberto',
        ...lines,
      ].join('\n');
      if (budget - block.length < 0) break;
      budget -= block.length;
      blocks.push(block);
    }
    const cards = openLeads.map((l) => `- contactId=${l.contactId} — ${contactName.get(l.contactId)}: ${l.stage.name}${l.value ? `, R$ ${l.value.toLocaleString('pt-BR')}` : ''}, parado há ${Math.floor((now.getTime() - l.updatedAt.getTime()) / DAY)} dia(s)`);
    const tasksTxt = openTasks.map((t) => `- contactId=${t.contactId}: ${t.title}`);

    let weekly = '';
    if (monday) weekly = await this.weeklyStats(tenantId, now);

    if (!blocks.length && !cards.length && !weekly) return { created: 0 };

    const system = [
      'Você é o assistente comercial da Dua Criativa, agência de marketing para marcas de moda. Lê as conversas do WhatsApp/Instagram e o funil e aponta o que o time precisa fazer.',
      'Crie tarefas só para compromissos e próximos passos que alguém do time precisa cumprir e que ainda não foram cumpridos na conversa: ex. "prometeu enviar o material", "ficou de mandar o orçamento", "cliente pediu para ligar na quinta", "lead pediu um tempo até segunda".',
      'NÃO crie tarefa para: responder mensagem sem resposta, follow-up de proposta parada, reunião sem status, cadastro incompleto (as regras automáticas já cuidam disso); nada que já esteja na lista de tarefas abertas; nada que o time já fez.',
      'Use só contactId que aparece nos dados. Título curto no imperativo (até 80 caracteres), com o nome do contato. Motivo: 1 frase citando o que foi dito.',
      'Responda só com JSON válido, sem texto fora dele.',
    ].join('\n');
    const prompt = [
      `Agora: ${fmt(now)} (horário de Brasília).`,
      '',
      '## Tarefas já abertas (não repetir)',
      tasksTxt.join('\n') || '(nenhuma)',
      '',
      '## Cards abertos no funil',
      cards.join('\n') || '(nenhum)',
      '',
      `## Conversas com atividade desde ${fmt(since)}`,
      blocks.join('\n\n') || '(nenhuma)',
      ...(monday ? ['', '## Números da semana passada', weekly] : []),
      '',
      'Formato:',
      `{"tasks":[{"contactId":"...","title":"...","reason":"...","dueInHours":4}]${monday ? ',"summary":"resumo da semana em até 8 linhas: o que andou, o que travou e as 3 prioridades desta semana"' : ''}}`,
      'Sem nada a fazer: {"tasks":[]}.',
    ].join('\n');

    const text = await askClaude({ system, prompt, maxTokens: 2000, timeoutMs: 120000 });
    const out = parseJsonObject(text);
    if (!out) {
      this.logger.warn(`[Tarefas] IA não devolveu JSON: ${text.slice(0, 200)}`);
      return { created: 0 };
    }

    const known = new Set(contactName.keys());
    const normTitle = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\W+/g, ' ').trim();
    const openTitles = new Set(openTasks.map((t) => `${t.contactId}|${normTitle(t.title)}`));
    const date = brt(now).date;
    const desired: DesiredTask[] = [];
    for (const t of Array.isArray(out.tasks) ? out.tasks.slice(0, 20) : []) {
      if (!t || typeof t.title !== 'string' || !known.has(t.contactId)) continue;
      const title = t.title.trim().slice(0, 120);
      if (!title || openTitles.has(`${t.contactId}|${normTitle(title)}`)) continue;
      const hours = Math.min(Math.max(Number(t.dueInHours) || 4, 0), 24 * 14);
      const conv = convs.find((c) => c.contactId === t.contactId);
      desired.push({
        ruleKey: `ai:${date}:${t.contactId}:${createHash('sha1').update(normTitle(title)).digest('hex').slice(0, 10)}`,
        kind: 'AI',
        contactId: t.contactId,
        conversationId: conv?.id ?? null,
        title,
        reason: String(t.reason ?? '').trim() || 'Sugestão da leitura diária da IA.',
        dueAt: new Date(now.getTime() + hours * HOUR),
      });
    }
    const created = await this.createTasks(tenantId, desired, 'AI');
    await this.announce(tenantId, created, created.length === 1 ? 'Leitura do dia: 1 tarefa' : `Leitura do dia: ${created.length} tarefas`);

    if (monday && typeof out.summary === 'string' && out.summary.trim()) {
      const key = `sales-tasks-weekly:${tenantId}`;
      const value = JSON.stringify({ date, text: out.summary.trim().slice(0, 4000) });
      await this.prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
      await this.notifier.send(tenantId, 'sales_task', {
        title: 'Resumo da semana',
        body: out.summary.trim().replace(/\s+/g, ' ').slice(0, 300),
        url: '/dashboard/tarefas',
        tag: 'sales-tasks-weekly',
      });
    }
    this.logger.log(`[Tarefas] Leitura da IA (${tenantId}): ${created.length} tarefa(s)`);
    return { created: created.length };
  }

  /** Números dos últimos 7 dias para o resumo de segunda. */
  private async weeklyStats(tenantId: string, now: Date) {
    const since = new Date(now.getTime() - 7 * DAY);
    const [tasks, meetings, won, lost, newLeads] = await Promise.all([
      this.prisma.salesTask.findMany({ where: { tenantId, OR: [{ createdAt: { gte: since } }, { closedAt: { gte: since } }] }, select: { kind: true, status: true, closedBy: true, createdAt: true } }),
      this.prisma.meeting.groupBy({ by: ['status'], where: { tenantId, startAt: { gte: since, lte: now } }, _count: true }),
      this.prisma.pipelineLead.findMany({ where: { stage: { pipeline: { tenantId } }, wonAt: { gte: since } }, select: { value: true } }),
      this.prisma.pipelineLead.count({ where: { stage: { pipeline: { tenantId } }, lostAt: { gte: since } } }),
      this.prisma.contact.count({ where: { tenantId, createdAt: { gte: since } } }),
    ]);
    const created = tasks.filter((t) => t.createdAt >= since);
    const byKind: Record<string, number> = {};
    for (const t of created) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
    return [
      `Contatos novos: ${newLeads}`,
      `Reuniões: ${meetings.map((m) => `${m.status} ${m._count}`).join(', ') || 'nenhuma'}`,
      `Fechados: ${won.length} (R$ ${won.reduce((s, l) => s + (l.value ?? 0), 0).toLocaleString('pt-BR')}); perdidos: ${lost}`,
      `Tarefas criadas: ${created.length} (${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ') || '—'})`,
      `Concluídas pelo time: ${tasks.filter((t) => t.status === 'DONE' && t.closedBy !== 'Sistema').length}; fecharam sozinhas: ${tasks.filter((t) => t.closedBy === 'Sistema').length}; dispensadas: ${tasks.filter((t) => t.status === 'DISMISSED').length}`,
      `Ainda abertas: ${await this.prisma.salesTask.count({ where: { tenantId, status: 'OPEN' } })}`,
    ].join('\n');
  }

  // ── Tela ────────────────────────────────────────────────

  async list(tenantId: string, filter: TaskFilter, status = 'OPEN') {
    const now = new Date();
    const today = startOfDayBrt(now);
    const tomorrow = new Date(today.getTime() + DAY);
    const due = filter === 'today' ? { gte: today, lt: tomorrow } : filter === 'overdue' ? { lt: today } : undefined;
    const tasks = await this.prisma.salesTask.findMany({
      where: {
        tenantId,
        ...(status === 'CLOSED' ? { status: { in: ['DONE', 'DISMISSED'] }, closedAt: { gte: new Date(now.getTime() - 14 * DAY) } } : { status: 'OPEN' }),
        ...(due && status !== 'CLOSED' ? { dueAt: due } : {}),
      },
      orderBy: status === 'CLOSED' ? { closedAt: 'desc' } : { dueAt: 'asc' },
      take: 300,
      include: { contact: { select: { id: true, name: true, phone: true, instagramHandle: true } } },
    });
    return { tasks, counts: await this.counts(tenantId) };
  }

  async counts(tenantId: string) {
    const today = startOfDayBrt(new Date());
    const tomorrow = new Date(today.getTime() + DAY);
    const [all, overdue, todayN] = await Promise.all([
      this.prisma.salesTask.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.salesTask.count({ where: { tenantId, status: 'OPEN', dueAt: { lt: today } } }),
      this.prisma.salesTask.count({ where: { tenantId, status: 'OPEN', dueAt: { gte: today, lt: tomorrow } } }),
    ]);
    return { all, overdue, today: todayN };
  }

  async close(tenantId: string, userId: string, id: string, status: 'DONE' | 'DISMISSED') {
    const task = await this.prisma.salesTask.findFirst({ where: { id, tenantId } });
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, signature: true } });
    return this.prisma.salesTask.update({
      where: { id },
      data: { status, closedAt: new Date(), closedBy: user?.signature || user?.name || 'Time' },
    });
  }

  async reopen(tenantId: string, id: string) {
    const task = await this.prisma.salesTask.findFirst({ where: { id, tenantId } });
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    return this.prisma.salesTask.update({ where: { id }, data: { status: 'OPEN', closedAt: null, closedBy: null } });
  }

  async weeklySummary(tenantId: string) {
    const row = await this.prisma.appSetting.findUnique({ where: { key: `sales-tasks-weekly:${tenantId}` } }).catch(() => null);
    if (!row) return null;
    try {
      return JSON.parse(row.value) as { date: string; text: string };
    } catch {
      return null;
    }
  }
}
