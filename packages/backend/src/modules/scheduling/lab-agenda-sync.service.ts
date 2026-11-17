import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MEETING_EVENTS } from './scheduling.service';

/**
 * Leva as reuniões agendadas pelo link para a Agenda do Tasks no DUA LAB
 * (lab.duacriativa.com, rota /api/integracoes/crm-agenda). Lá vira evento
 * público com o dono da agenda marcado, e aparece no Dua Office.
 *
 * Manda sempre o estado atual da reunião (lido do banco), então aviso
 * repetido ou fora de ordem não estraga nada. Só sai o id, o horário e o
 * primeiro nome: telefone, e-mail, Instagram e Meet ficam aqui.
 * Falha no Lab nunca trava o agendamento: tenta 3 vezes e registra no log.
 * Ao subir, reenvia as reuniões futuras (cobre aviso perdido num deploy).
 *
 * Variáveis (backend): LAB_AGENDA_WEBHOOK_URL e LAB_AGENDA_WEBHOOK_SECRET
 * (o mesmo valor de CRM_AGENDA_WEBHOOK_SECRET na Vercel do Lab). Opcional:
 * LAB_AGENDA_TENANT_ID para mandar só as reuniões de um tenant.
 * Sem URL ou segredo, não faz nada.
 */
type LabEvent = 'scheduled' | 'rescheduled' | 'cancelled' | 'no_show' | 'completed';

const RETRY_DELAYS_MS = [0, 5_000, 30_000];

@Injectable()
export class LabAgendaSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LabAgendaSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get config() {
    const url = process.env.LAB_AGENDA_WEBHOOK_URL?.trim();
    const secret = process.env.LAB_AGENDA_WEBHOOK_SECRET?.trim();
    return url && secret ? { url, secret, tenantId: process.env.LAB_AGENDA_TENANT_ID?.trim() || null } : null;
  }

  @OnEvent(MEETING_EVENTS.scheduled, { async: true })
  onScheduled(p: { meetingId: string }) { return this.sync(p.meetingId, 'scheduled'); }

  @OnEvent(MEETING_EVENTS.rescheduled, { async: true })
  onRescheduled(p: { meetingId: string }) { return this.sync(p.meetingId, 'rescheduled'); }

  @OnEvent(MEETING_EVENTS.cancelled, { async: true })
  onCancelled(p: { meetingId: string }) { return this.sync(p.meetingId, 'cancelled'); }

  @OnEvent(MEETING_EVENTS.noShow, { async: true })
  onNoShow(p: { meetingId: string }) { return this.sync(p.meetingId, 'no_show'); }

  @OnEvent(MEETING_EVENTS.completed, { async: true })
  onCompleted(p: { meetingId: string }) { return this.sync(p.meetingId, 'completed'); }

  /** Ao subir: reenvia as reuniões marcadas que ainda não acabaram (idempotente no Lab). */
  async onApplicationBootstrap() {
    const cfg = this.config;
    if (!cfg) return;
    setTimeout(() => {
      this.resendUpcoming().catch((e) => this.logger.error(`[Lab] Reenvio das próximas falhou: ${e.message}`));
    }, 10_000);
  }

  async resendUpcoming() {
    const cfg = this.config;
    if (!cfg) return 0;
    const rows = await this.prisma.meeting.findMany({
      where: { status: 'SCHEDULED', endAt: { gte: new Date() }, ...(cfg.tenantId ? { tenantId: cfg.tenantId } : {}) },
      select: { id: true },
      orderBy: { startAt: 'asc' },
      take: 200,
    });
    for (const r of rows) await this.sync(r.id, 'scheduled');
    this.logger.log(`[Lab] ${rows.length} reunião(ões) futura(s) reenviada(s) para a Agenda do Tasks`);
    return rows.length;
  }

  private async sync(meetingId: string, event: LabEvent) {
    const cfg = this.config;
    if (!cfg) return;
    const m = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, tenantId: true, status: true, startAt: true, endAt: true, name: true },
    });
    if (!m) return;
    if (cfg.tenantId && m.tenantId !== cfg.tenantId) return;

    // O estado do banco manda (um "agendada" atrasado não ressuscita a cancelada).
    const current: LabEvent =
      m.status === 'CANCELLED' ? 'cancelled'
        : m.status === 'NO_SHOW' ? 'no_show'
          : m.status === 'COMPLETED' ? 'completed'
            : event === 'rescheduled' ? 'rescheduled' : 'scheduled';
    const firstName = (m.name ?? '').trim().split(/\s+/)[0] ?? '';
    const body = JSON.stringify({
      event: current,
      meeting: { id: m.id, startAt: m.startAt.toISOString(), endAt: m.endAt.toISOString(), firstName },
    });

    for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
      if (RETRY_DELAYS_MS[i]) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
      try {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = crypto.createHmac('sha256', cfg.secret).update(`${timestamp}.${body}`).digest('hex');
        const res = await fetch(cfg.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-dua-timestamp': timestamp, 'x-dua-signature': signature },
          body,
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) return;
        // 4xx (assinatura, corpo) não melhora tentando de novo.
        if (res.status < 500) {
          this.logger.error(`[Lab] Agenda recusou a reunião ${m.id} (${current}): HTTP ${res.status}`);
          return;
        }
        this.logger.warn(`[Lab] Agenda respondeu ${res.status} para a reunião ${m.id} (tentativa ${i + 1})`);
      } catch (e: any) {
        this.logger.warn(`[Lab] Falha ao avisar a Agenda sobre a reunião ${m.id} (tentativa ${i + 1}): ${e.message}`);
      }
    }
    this.logger.error(`[Lab] Reunião ${m.id} (${current}) não chegou na Agenda do Tasks depois de ${RETRY_DELAYS_MS.length} tentativas`);
  }
}
