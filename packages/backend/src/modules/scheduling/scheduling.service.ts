import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { BookingPage, Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FunnelService } from '../pipelines/funnel.service';
import { PushService } from '../notifications/push.service';
import { normalizePhone, phoneVariants } from '../../common/phone.util';
import { GoogleCalendarService } from './google-calendar.service';
import {
  AvailabilityConfig, DEFAULT_WEEKLY_HOURS, Interval, addDays, bookableWindow, cleanDateOverrides, cleanWeeklyHours,
  computeSlots, dateInZone, isSlotAvailable, zonedToUtc,
} from './availability';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RANGE_DAYS = 62;
export const MEETING_STATUSES = ['SCHEDULED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'] as const;

/**
 * Eventos internos das reuniões (fase 2: gatilho "Reunião agendada" nos bots e
 * lembretes relativos a startAt). Payload: { tenantId, meetingId, contactId, startAt }.
 */
export const MEETING_EVENTS = {
  scheduled: 'meeting.scheduled',
  rescheduled: 'meeting.rescheduled',
  cancelled: 'meeting.cancelled',
  noShow: 'meeting.no_show',
} as const;

export interface BookingInput { startAt: string; name: string; phone: string; email: string; notes?: string }

const appUrl = () => (process.env.PUBLIC_APP_URL ?? 'https://crm.duacriativa.com.br').replace(/\/$/, '');

function cfgOf(p: BookingPage): AvailabilityConfig {
  return {
    durationMin: p.durationMin,
    bufferAfterMin: p.bufferAfterMin,
    slotStepMin: p.slotStepMin,
    minNoticeMin: p.minNoticeMin,
    maxDaysAhead: p.maxDaysAhead,
    timezone: p.timezone,
    weeklyHours: (p.weeklyHours ?? {}) as any,
    dateOverrides: (p.dateOverrides ?? {}) as any,
  };
}

/** "qui., 30/10 às 10:00" no fuso da página */
export function formatWhen(d: Date, timeZone: string) {
  const day = new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'short', day: '2-digit', month: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d);
  return `${day} às ${time}`;
}

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleCalendarService,
    private readonly funnel: FunnelService,
    private readonly push: PushService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Páginas de agendamento (Configurações) ──────────────────────────────────

  /** Páginas do tenant; cria a "Reunião com Especialista de Marketing" na primeira vez. */
  async listPages(tenantId: string) {
    const pages = await this.prisma.bookingPage.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    if (pages.length) return pages;
    const taken = await this.prisma.bookingPage.findUnique({ where: { slug: 'especialista' } });
    const page = await this.prisma.bookingPage.create({
      data: {
        tenantId,
        slug: taken ? `especialista-${tenantId.slice(-6)}` : 'especialista',
        title: 'Reunião com Especialista de Marketing',
        description: 'Uma conversa de 45 minutos por Google Meet para entender o momento da sua marca e mostrar como a Dua pode ajudar a vender mais.',
        weeklyHours: DEFAULT_WEEKLY_HOURS as any,
        dateOverrides: {},
      },
    });
    return [page];
  }

  async updatePage(tenantId: string, id: string, body: any) {
    const page = await this.prisma.bookingPage.findFirst({ where: { id, tenantId } });
    if (!page) throw new NotFoundException('Página não encontrada.');
    const data: any = {};
    const int = (k: string, min: number, max: number) => {
      if (body[k] === undefined) return;
      const n = Number(body[k]);
      if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${k} deve ficar entre ${min} e ${max}.`);
      data[k] = n;
    };
    int('durationMin', 5, 480);
    int('bufferAfterMin', 0, 240);
    int('slotStepMin', 5, 480);
    int('minNoticeMin', 0, 60 * 24 * 30);
    int('maxDaysAhead', 1, 365);
    if (body.title !== undefined) {
      if (!String(body.title).trim()) throw new BadRequestException('Dê um nome ao tipo de reunião.');
      data.title = String(body.title).trim().slice(0, 120);
    }
    if (body.description !== undefined) data.description = String(body.description ?? '').trim().slice(0, 1000) || null;
    if (body.active !== undefined) data.active = !!body.active;
    if (body.slug !== undefined) {
      const slug = String(body.slug).trim().toLowerCase();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) throw new BadRequestException('Link: use letras minúsculas, números e hífen.');
      const other = await this.prisma.bookingPage.findUnique({ where: { slug } });
      if (other && other.id !== id) throw new ConflictException('Esse link já está em uso.');
      data.slug = slug;
    }
    if (body.timezone !== undefined) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: body.timezone }); } catch { throw new BadRequestException('Fuso horário inválido.'); }
      data.timezone = body.timezone;
    }
    try {
      if (body.weeklyHours !== undefined) data.weeklyHours = cleanWeeklyHours(body.weeklyHours);
      if (body.dateOverrides !== undefined) data.dateOverrides = cleanDateOverrides(body.dateOverrides);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
    return this.prisma.bookingPage.update({ where: { id }, data });
  }

  // ── Horários livres ─────────────────────────────────────────────────────────

  /** Ocupados: agenda do Google + reuniões marcadas aqui (com o intervalo depois de cada uma). */
  private async busy(page: BookingPage, from: Date, to: Date, ignore?: Meeting): Promise<Interval[]> {
    const meetings = await this.prisma.meeting.findMany({
      where: { tenantId: page.tenantId, status: 'SCHEDULED', startAt: { lt: to }, endAt: { gt: new Date(from.getTime() - 24 * 3600_000) } },
      select: { id: true, startAt: true, endAt: true, bookingPage: { select: { bufferAfterMin: true } } },
    });
    const own = meetings
      .filter((m) => m.id !== ignore?.id)
      .map((m) => ({ start: m.startAt, end: new Date(m.endAt.getTime() + (m.bookingPage?.bufferAfterMin ?? page.bufferAfterMin) * 60_000) }));
    let google: Interval[] = [];
    try {
      google = (await this.google.busy(page.tenantId, from, to)) ?? [];
    } catch (e: any) {
      // Sem o Google, ainda bloqueia as reuniões do CRM; o erro aparece no log e no status da integração
      this.logger.error(`[Agenda] freebusy falhou (${page.tenantId}): ${e.response?.data?.error?.message ?? e.message}`);
    }
    // O evento da própria reunião que está sendo remarcada não conta como ocupado
    if (ignore) google = google.filter((b) => !(b.start.getTime() === ignore.startAt.getTime() && b.end.getTime() === ignore.endAt.getTime()));
    return [...own, ...google];
  }

  async slots(page: BookingPage, from?: string, to?: string, ignore?: Meeting) {
    const cfg = cfgOf(page);
    const now = new Date();
    const win = bookableWindow(cfg, now);
    const start = from && DATE_RE.test(from) ? from : win.first;
    let end = to && DATE_RE.test(to) ? to : addDays(start, 31);
    if (end > addDays(start, MAX_RANGE_DAYS)) end = addDays(start, MAX_RANGE_DAYS);
    const busy = await this.busy(page, zonedToUtc(start, 0, cfg.timezone), zonedToUtc(addDays(end, 1), 0, cfg.timezone), ignore);
    return { timezone: cfg.timezone, firstDate: win.first, lastDate: win.last, days: computeSlots(cfg, start, end, busy, now) };
  }

  private async checkFree(page: BookingPage, startAt: string, ignore?: Meeting) {
    const cfg = cfgOf(page);
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) throw new BadRequestException('Horário inválido.');
    const day = dateInZone(start, cfg.timezone);
    const busy = await this.busy(page, zonedToUtc(day, 0, cfg.timezone), zonedToUtc(addDays(day, 1), 0, cfg.timezone), ignore);
    if (!isSlotAvailable(cfg, start.toISOString(), busy, new Date())) {
      throw new ConflictException('Esse horário acabou de ser ocupado. Escolha outro.');
    }
    return start;
  }

  // ── Página pública ──────────────────────────────────────────────────────────

  async publicPage(slug: string) {
    const page = await this.prisma.bookingPage.findUnique({ where: { slug }, include: { tenant: { select: { name: true } } } });
    if (!page || !page.active) throw new NotFoundException('Página de agendamento não encontrada.');
    return page;
  }

  publicView(page: BookingPage & { tenant?: { name: string } }) {
    return {
      slug: page.slug, title: page.title, description: page.description, durationMin: page.durationMin,
      timezone: page.timezone, hostName: page.tenant?.name ?? null,
    };
  }

  meetingView(m: Meeting & { bookingPage?: BookingPage | null }) {
    return {
      id: m.id, title: m.title, startAt: m.startAt, endAt: m.endAt, status: m.status, name: m.name, email: m.email,
      meetLink: m.meetLink, slug: m.bookingPage?.slug ?? null, timezone: m.bookingPage?.timezone ?? 'America/Sao_Paulo',
      durationMin: m.bookingPage?.durationMin ?? Math.round((m.endAt.getTime() - m.startAt.getTime()) / 60_000),
    };
  }

  private manageUrl(token: string) { return `${appUrl()}/reuniao/${token}`; }

  private description(m: { phone: string | null; notes: string | null; manageToken: string }) {
    return [
      m.phone ? `WhatsApp: ${m.phone}` : '',
      m.notes ? `Observações: ${m.notes}` : '',
      '',
      `Precisa remarcar ou cancelar? ${this.manageUrl(m.manageToken)}`,
    ].filter((l, i, a) => l || (i > 0 && a[i - 1])).join('\n');
  }

  /** Acha o contato pelo telefone (com/sem nono dígito) ou e-mail; senão cria como lead. */
  private async upsertContact(tenantId: string, name: string, phone: string, email: string) {
    const existing = await this.prisma.contact.findFirst({ where: { tenantId, phone: { in: phoneVariants(phone) } } })
      ?? await this.prisma.contact.findFirst({ where: { tenantId, email: { equals: email, mode: 'insensitive' } } });
    if (existing) {
      return this.prisma.contact.update({
        where: { id: existing.id },
        data: {
          name: !existing.name || existing.name === existing.phone ? name : undefined,
          email: existing.email ? undefined : email,
          phone: existing.phone ? undefined : phone,
          tags: existing.tags.includes('agendou-reuniao') ? undefined : [...existing.tags, 'agendou-reuniao'],
        },
      });
    }
    return this.prisma.contact.create({
      data: { tenantId, type: 'LEAD', name, phone, email, tags: ['agendou-reuniao'] },
    });
  }

  async book(slug: string, input: BookingInput) {
    const page = await this.publicPage(slug);
    const name = String(input.name ?? '').trim().slice(0, 120);
    const email = String(input.email ?? '').trim().toLowerCase().slice(0, 200);
    const phone = normalizePhone(String(input.phone ?? ''));
    const notes = String(input.notes ?? '').trim().slice(0, 1000) || null;
    if (name.length < 2) throw new BadRequestException('Informe seu nome.');
    if (!EMAIL_RE.test(email)) throw new BadRequestException('Informe um e-mail válido.');
    if (!phone || phone.length < 12 || phone.length > 16) throw new BadRequestException('Informe um WhatsApp válido com DDD.');

    const start = await this.checkFree(page, input.startAt);
    const end = new Date(start.getTime() + page.durationMin * 60_000);
    const contact = await this.upsertContact(page.tenantId, name, phone, email);

    const already = await this.prisma.meeting.findFirst({
      where: { tenantId: page.tenantId, contactId: contact.id, bookingPageId: page.id, status: 'SCHEDULED', startAt: { gt: new Date() } },
    });
    if (already) {
      throw new ConflictException(`Você já tem uma reunião marcada para ${formatWhen(already.startAt, page.timezone)}. Para mudar o horário, use o link do convite que enviamos por e-mail.`);
    }

    // Trava por página: duas pessoas no mesmo horário ao mesmo tempo → só uma grava
    const meeting = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${page.id}))`;
      const clash = await tx.meeting.findFirst({
        where: {
          tenantId: page.tenantId, status: 'SCHEDULED',
          startAt: { lt: new Date(end.getTime() + page.bufferAfterMin * 60_000) },
          endAt: { gt: new Date(start.getTime() - page.bufferAfterMin * 60_000) },
        },
      });
      if (clash) throw new ConflictException('Esse horário acabou de ser ocupado. Escolha outro.');
      return tx.meeting.create({
        data: {
          tenantId: page.tenantId, bookingPageId: page.id, contactId: contact.id, title: page.title,
          startAt: start, endAt: end, name, email, phone, notes, manageToken: crypto.randomBytes(24).toString('base64url'),
        },
      });
    });

    const withGoogle = await this.syncCreate(page, meeting);
    const when = formatWhen(start, page.timezone);
    await this.prisma.activity.create({
      data: {
        tenantId: page.tenantId, contactId: contact.id, type: 'NOTE', authorName: 'Agendamento',
        content: `📅 Reunião agendada pelo link: ${when} (${page.title})${withGoogle.meetLink ? `\nMeet: ${withGoogle.meetLink}` : ''}${notes ? `\nObservações: ${notes}` : ''}`,
      },
    }).catch(() => {});
    await this.funnel.ensureLead(page.tenantId, contact.id, 'Origem: Agendamento de reunião');
    this.push.sendToTenant(page.tenantId, {
      title: 'Nova reunião agendada',
      body: `${name} — ${when}${withGoogle.meetLink ? '' : ' (sem Meet: confira o Google)'}`,
      url: '/dashboard/agenda',
      tag: `meeting-${meeting.id}`,
    });
    this.events.emit(MEETING_EVENTS.scheduled, { tenantId: page.tenantId, meetingId: meeting.id, contactId: contact.id, startAt: start });
    return { meeting: this.meetingView({ ...withGoogle, bookingPage: page }), manageToken: meeting.manageToken };
  }

  /** Cria o evento com Meet no Google. Se falhar, a reunião fica no CRM e o time é avisado. */
  private async syncCreate(page: BookingPage, m: Meeting): Promise<Meeting> {
    try {
      const ev = await this.google.createEvent(page.tenantId, {
        summary: `${page.title} — ${m.name}`,
        description: this.description(m),
        start: m.startAt, end: m.endAt, timeZone: page.timezone,
        attendee: { email: m.email, name: m.name },
      }, m.id);
      if (!ev) return m;
      return this.prisma.meeting.update({ where: { id: m.id }, data: { googleEventId: ev.eventId, meetLink: ev.meetLink } });
    } catch (e: any) {
      this.logger.error(`[Agenda] Falha ao criar evento no Google (${m.id}): ${e.response?.data?.error?.message ?? e.message}`);
      return m;
    }
  }

  // ── Link do cliente (remarcar/cancelar) ────────────────────────────────────

  private async byToken(token: string) {
    const m = await this.prisma.meeting.findUnique({ where: { manageToken: String(token ?? '') }, include: { bookingPage: true } });
    if (!m) throw new NotFoundException('Reunião não encontrada.');
    return m;
  }

  async manageView(token: string) {
    const m = await this.byToken(token);
    return { meeting: this.meetingView(m), canChange: m.status === 'SCHEDULED' && m.startAt > new Date() };
  }

  async manageSlots(token: string, from?: string, to?: string) {
    const m = await this.byToken(token);
    if (!m.bookingPage) throw new NotFoundException('Página de agendamento removida.');
    return this.slots(m.bookingPage, from, to, m);
  }

  async cancelByToken(token: string, reason?: string) {
    const m = await this.byToken(token);
    if (m.status !== 'SCHEDULED' || m.startAt <= new Date()) throw new BadRequestException('Essa reunião não pode mais ser cancelada por aqui.');
    return this.meetingView(await this.cancel(m, 'CLIENT', reason));
  }

  async rescheduleByToken(token: string, startAt: string) {
    const m = await this.byToken(token);
    if (m.status !== 'SCHEDULED' || m.startAt <= new Date()) throw new BadRequestException('Essa reunião não pode mais ser remarcada por aqui.');
    return this.meetingView(await this.reschedule(m, startAt, 'CLIENT'));
  }

  // ── Ações comuns (cliente e time) ──────────────────────────────────────────

  private async cancel(m: Meeting & { bookingPage: BookingPage | null }, by: 'CLIENT' | 'TEAM', reason?: string) {
    const updated = await this.prisma.meeting.update({
      where: { id: m.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: by, cancelReason: String(reason ?? '').trim().slice(0, 500) || null },
      include: { bookingPage: true },
    });
    if (m.googleEventId) {
      await this.google.cancelEvent(m.tenantId, m.googleEventId)
        .catch((e) => this.logger.error(`[Agenda] Falha ao cancelar no Google (${m.id}): ${e.message}`));
    }
    const tz = m.bookingPage?.timezone ?? 'America/Sao_Paulo';
    await this.prisma.activity.create({
      data: {
        tenantId: m.tenantId, contactId: m.contactId, type: 'NOTE', authorName: 'Agendamento',
        content: `❌ Reunião de ${formatWhen(m.startAt, tz)} cancelada ${by === 'CLIENT' ? 'pelo cliente' : 'pela equipe'}${updated.cancelReason ? `: ${updated.cancelReason}` : ''}`,
      },
    }).catch(() => {});
    if (by === 'CLIENT') {
      this.push.sendToTenant(m.tenantId, { title: 'Reunião cancelada', body: `${m.name} cancelou ${formatWhen(m.startAt, tz)}`, url: '/dashboard/agenda', tag: `meeting-${m.id}` });
    }
    this.events.emit(MEETING_EVENTS.cancelled, { tenantId: m.tenantId, meetingId: m.id, contactId: m.contactId, startAt: m.startAt, by });
    return updated;
  }

  private async reschedule(m: Meeting & { bookingPage: BookingPage | null }, startAt: string, by: 'CLIENT' | 'TEAM') {
    if (!m.bookingPage) throw new BadRequestException('Página de agendamento removida.');
    const page = m.bookingPage;
    const start = await this.checkFree(page, startAt, m);
    const end = new Date(start.getTime() + page.durationMin * 60_000);
    const updated = await this.prisma.meeting.update({
      where: { id: m.id },
      data: { startAt: start, endAt: end, rescheduleCount: { increment: 1 } },
      include: { bookingPage: true },
    });
    let synced = updated;
    if (m.googleEventId) {
      await this.google.moveEvent(m.tenantId, m.googleEventId, start, end, page.timezone)
        .catch((e) => this.logger.error(`[Agenda] Falha ao remarcar no Google (${m.id}): ${e.message}`));
    } else {
      synced = { ...(await this.syncCreate(page, updated)), bookingPage: page };
    }
    const from = formatWhen(m.startAt, page.timezone);
    const to = formatWhen(start, page.timezone);
    await this.prisma.activity.create({
      data: {
        tenantId: m.tenantId, contactId: m.contactId, type: 'NOTE', authorName: 'Agendamento',
        content: `🔁 Reunião remarcada ${by === 'CLIENT' ? 'pelo cliente' : 'pela equipe'}: ${from} → ${to}`,
      },
    }).catch(() => {});
    if (by === 'CLIENT') {
      this.push.sendToTenant(m.tenantId, { title: 'Reunião remarcada', body: `${m.name}: ${from} → ${to}`, url: '/dashboard/agenda', tag: `meeting-${m.id}` });
    }
    this.events.emit(MEETING_EVENTS.rescheduled, { tenantId: m.tenantId, meetingId: m.id, contactId: m.contactId, startAt: start, previousStartAt: m.startAt, by });
    return synced;
  }

  // ── Tela "Reuniões" ─────────────────────────────────────────────────────────

  async list(tenantId: string, q: { scope?: string; from?: string; to?: string; contactId?: string }) {
    const now = new Date();
    const where: any = { tenantId };
    if (q.contactId) where.contactId = q.contactId;
    let orderBy: any = { startAt: 'asc' };
    if (q.from || q.to) {
      where.startAt = {};
      if (q.from) where.startAt.gte = new Date(q.from);
      if (q.to) where.startAt.lt = new Date(q.to);
    } else if (q.scope === 'past') {
      where.startAt = { lt: now };
      orderBy = { startAt: 'desc' };
    } else {
      // Próximas: inclui a que está acontecendo agora
      where.endAt = { gte: now };
    }
    const rows = await this.prisma.meeting.findMany({
      where, orderBy, take: 200,
      include: { contact: { select: { id: true, name: true, phone: true } }, bookingPage: { select: { slug: true, timezone: true } } },
    });
    return rows;
  }

  private async own(tenantId: string, id: string) {
    const m = await this.prisma.meeting.findFirst({ where: { id, tenantId }, include: { bookingPage: true } });
    if (!m) throw new NotFoundException('Reunião não encontrada.');
    return m;
  }

  async setStatus(tenantId: string, id: string, status: string) {
    if (!['SCHEDULED', 'NO_SHOW', 'COMPLETED'].includes(status)) throw new BadRequestException('Status inválido.');
    const m = await this.own(tenantId, id);
    if (m.status === 'CANCELLED') throw new BadRequestException('Reunião cancelada.');
    if (status !== 'SCHEDULED' && m.startAt > new Date()) throw new BadRequestException('A reunião ainda não começou.');
    const updated = await this.prisma.meeting.update({ where: { id }, data: { status } });
    if (status === 'NO_SHOW' && m.status !== 'NO_SHOW') {
      await this.prisma.activity.create({
        data: { tenantId, contactId: m.contactId, type: 'NOTE', authorName: 'Agendamento', content: `🚫 Não compareceu à reunião de ${formatWhen(m.startAt, m.bookingPage?.timezone ?? 'America/Sao_Paulo')}` },
      }).catch(() => {});
      this.events.emit(MEETING_EVENTS.noShow, { tenantId, meetingId: id, contactId: m.contactId, startAt: m.startAt });
    }
    return updated;
  }

  async cancelByTeam(tenantId: string, id: string, reason?: string) {
    const m = await this.own(tenantId, id);
    if (m.status !== 'SCHEDULED') throw new BadRequestException('Só dá para cancelar reunião marcada.');
    return this.cancel(m, 'TEAM', reason);
  }

  async rescheduleByTeam(tenantId: string, id: string, startAt: string) {
    const m = await this.own(tenantId, id);
    if (m.status !== 'SCHEDULED') throw new BadRequestException('Só dá para remarcar reunião marcada.');
    return this.reschedule(m, startAt, 'TEAM');
  }

  async slotsForMeeting(tenantId: string, id: string, from?: string, to?: string) {
    const m = await this.own(tenantId, id);
    if (!m.bookingPage) throw new BadRequestException('Página de agendamento removida.');
    return this.slots(m.bookingPage, from, to, m);
  }

  manageLink(m: Meeting) { return this.manageUrl(m.manageToken); }
}
