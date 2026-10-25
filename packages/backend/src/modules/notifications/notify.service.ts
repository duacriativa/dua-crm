import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from './push.service';
import { NOTIFY_EVENTS, NotifyEvent, NotifyPrefs, defaultPrefs } from './notify.events';

interface NotifyPayload {
  title: string;
  body: string;
  url?: string;
  /** Agrupa no push (substitui o anterior no aparelho) e junta avisos não lidos no sino. */
  tag?: string;
  /** Só avisa uma vez por chave (ex.: contrato vencendo). */
  once?: string;
}

const prefsKey = (tenantId: string) => `notif-prefs:${tenantId}`;
const TZ = 'America/Sao_Paulo';
const DAY = 24 * 60 * 60 * 1000;

/**
 * Ponto único de aviso do CRM: respeita as chaves de Configurações → Notificações,
 * grava no sino e manda o push (fora do horário de silêncio). Nunca lança erro.
 */
@Injectable()
export class NotifyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotifyService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  onModuleInit() {
    // Contratos vencendo + limpeza do sino: alguns minutos após subir e depois a cada 6h
    setTimeout(() => this.dailyChecks(), 5 * 60 * 1000).unref();
    this.timer = setInterval(() => this.dailyChecks(), 6 * 60 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async getPrefs(tenantId: string): Promise<NotifyPrefs> {
    const base = defaultPrefs();
    const row = await this.prisma.appSetting.findUnique({ where: { key: prefsKey(tenantId) } }).catch(() => null);
    if (!row) return base;
    try {
      const saved = JSON.parse(row.value);
      for (const k of Object.keys(base.events) as NotifyEvent[]) {
        if (saved.events?.[k]) base.events[k] = { push: saved.events[k].push !== false, bell: saved.events[k].bell !== false };
      }
      if (saved.quiet) base.quiet = { ...base.quiet, ...saved.quiet };
    } catch {}
    return base;
  }

  async savePrefs(tenantId: string, input: Partial<NotifyPrefs>) {
    const prefs = await this.getPrefs(tenantId);
    for (const k of Object.keys(prefs.events) as NotifyEvent[]) {
      const e = input.events?.[k];
      if (e) prefs.events[k] = { push: !!e.push, bell: !!e.bell };
    }
    if (input.quiet) {
      const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
      prefs.quiet = {
        enabled: !!input.quiet.enabled,
        start: hhmm.test(input.quiet.start) ? input.quiet.start : prefs.quiet.start,
        end: hhmm.test(input.quiet.end) ? input.quiet.end : prefs.quiet.end,
      };
    }
    const value = JSON.stringify(prefs);
    await this.prisma.appSetting.upsert({ where: { key: prefsKey(tenantId) }, create: { key: prefsKey(tenantId), value }, update: { value } });
    return prefs;
  }

  async send(tenantId: string, event: NotifyEvent, payload: NotifyPayload) {
    try {
      const prefs = await this.getPrefs(tenantId);
      const on = prefs.events[event];
      if (!on.push && !on.bell) return;

      if (payload.once) {
        // Marca antes de avisar: duas checagens ao mesmo tempo não repetem o aviso
        const key = `notif-once:${tenantId}:${payload.once}`;
        const created = await this.prisma.appSetting.createMany({ data: [{ key, value: new Date().toISOString() }], skipDuplicates: true });
        if (created.count === 0) return;
      }

      if (on.bell) {
        const groupKey = payload.tag ?? null;
        const open = groupKey
          ? await this.prisma.notification.findFirst({ where: { tenantId, groupKey, readAt: null }, orderBy: { createdAt: 'desc' } })
          : null;
        const data = { event, title: payload.title.slice(0, 200), body: payload.body.slice(0, 500), url: payload.url ?? null };
        if (open) {
          await this.prisma.notification.update({ where: { id: open.id }, data: {
            ...data,
            // Mensagens da mesma conversa somam; reunião agendada → cancelada só troca o texto
            ...(event.startsWith('message_') ? { count: { increment: 1 } } : {}),
            createdAt: new Date(),
          } });
        } else {
          await this.prisma.notification.create({ data: { tenantId, groupKey, ...data } });
        }
      }

      if (on.push && !this.inQuietHours(prefs.quiet)) {
        await this.push.sendToTenant(tenantId, { title: payload.title, body: payload.body, url: payload.url, tag: payload.tag });
      }
    } catch (err: any) {
      this.logger.warn(`[Notify] Falha (${event}): ${err.message}`);
    }
  }

  private inQuietHours(q: NotifyPrefs['quiet']) {
    if (!q.enabled) return false;
    const now = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    const { start, end } = q;
    if (start === end) return false;
    return start < end ? now >= start && now < end : now >= start || now < end;
  }

  // ── Sino ────────────────────────────────────────────────

  async list(tenantId: string, limit = 30) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { tenantId, OR: [{ readAt: null }, { createdAt: { gte: new Date(Date.now() - 30 * DAY) } }] },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 100),
      }),
      this.prisma.notification.count({ where: { tenantId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(tenantId: string, id?: string) {
    await this.prisma.notification.updateMany({ where: { tenantId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
    return { ok: true };
  }

  // ── Avisos vindos de eventos ────────────────────────────

  @OnEvent('funnel.lead_created', { async: true })
  async onLeadCreated(e: { tenantId: string; contactId: string; notes?: string | null }) {
    const contact = await this.prisma.contact.findFirst({ where: { id: e.contactId, tenantId: e.tenantId }, select: { name: true, phone: true } }).catch(() => null);
    if (!contact) return;
    const origin = e.notes?.startsWith('Origem: ') ? e.notes.slice(8) : e.notes;
    await this.send(e.tenantId, 'lead_new', {
      title: 'Novo lead no funil',
      body: `${contact.name || contact.phone || 'Contato'}${origin ? ` — ${origin}` : ''}`,
      url: '/dashboard/funil',
      tag: `lead-${e.contactId}`,
    });
  }

  /** Contratos ativos que terminam nos próximos 30 dias (avisa uma vez por data de fim) e limpeza do sino. */
  async dailyChecks() {
    try {
      const now = new Date();
      const contracts = await this.prisma.contract.findMany({
        where: { status: 'ACTIVE', endsAt: { gte: now, lte: new Date(now.getTime() + 30 * DAY) } },
        select: { id: true, tenantId: true, clientName: true, endsAt: true, monthlyValue: true },
      });
      for (const c of contracts) {
        const end = c.endsAt!;
        const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY));
        await this.send(c.tenantId, 'contract_expiring', {
          title: 'Contrato vencendo',
          body: `${c.clientName} — termina em ${end.toLocaleDateString('pt-BR', { timeZone: TZ })} (${days === 0 ? 'hoje' : `${days} dia${days === 1 ? '' : 's'}`})`,
          url: '/dashboard/contratos',
          tag: `contract-${c.id}`,
          once: `contract-expiring:${c.id}:${end.toISOString().slice(0, 10)}`,
        });
      }
      // Sino guarda 90 dias; marcadores de "avisar uma vez" de contratos já vencidos saem depois de 1 ano
      await this.prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * DAY) } } });
      await this.prisma.appSetting.deleteMany({ where: { key: { startsWith: 'notif-once:' }, updatedAt: { lt: new Date(now.getTime() - 365 * DAY) } } });
    } catch (err: any) {
      this.logger.warn(`[Notify] Checagem diária falhou: ${err.message}`);
    }
  }

  catalog() {
    return Object.entries(NOTIFY_EVENTS).map(([key, v]) => ({ key, ...v }));
  }
}
