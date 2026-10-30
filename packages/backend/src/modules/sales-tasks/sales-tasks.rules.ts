/**
 * Regras automáticas da tela Tarefas. Funções puras (sem banco): o serviço monta o retrato do CRM,
 * as regras dizem quais tarefas deveriam estar abertas agora, e a sincronização cria as novas e
 * fecha as que a condição sumiu. A mesma situação gera sempre a mesma ruleKey (não duplica).
 */

export type SalesTaskKind =
  | 'MEETING_NEXT_STEP'
  | 'PROPOSAL_FOLLOWUP'
  | 'MEETING_STATUS'
  | 'COMPLETE_PROFILE'
  | 'REPLY'
  | 'BOT_NOTE'
  | 'AI';

export interface DesiredTask {
  ruleKey: string;
  kind: SalesTaskKind;
  contactId: string;
  conversationId: string | null;
  title: string;
  reason: string;
  dueAt: Date;
}

export interface RulesSnapshot {
  now: Date;
  contacts: Record<string, { id: string; name: string | null; phone: string | null; instagramHandle: string | null; type?: string }>;
  meetings: { id: string; contactId: string; status: string; startAt: Date; endAt: Date; createdAt: Date }[];
  /** Todos os cards dos contatos envolvidos (abertos, ganhos e perdidos). */
  leads: { id: string; contactId: string; stageName: string; stageKind: string; value: number | null; updatedAt: Date }[];
  /** Conversas com mensagem recente: a última mensagem e a última mensagem do time (não do bot). */
  conversations: {
    id: string;
    contactId: string;
    status: string;
    lastMessage: { id: string; direction: 'INBOUND' | 'OUTBOUND'; sentAt: Date } | null;
    lastTeamOutboundAt: Date | null;
  }[];
  /** Contatos com bot rodando ou esperando resposta. */
  activeBotContactIds: string[];
  /** Notas do bot recentes. */
  botNotes: { id: string; contactId: string; conversationId: string | null; content: string; createdAt: Date }[];
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const RULES = {
  meetingNextStepAfter: 24 * HOUR,
  proposalSilence: 2 * DAY,
  meetingStatusAfter: 2 * HOUR,
  replyBusinessMinutes: 120,
  meetingLookback: 30 * DAY,
  replyLookback: 14 * DAY,
  botNoteLookback: 7 * DAY,
  /** Proposta acima disso ganha destaque no texto. */
  bigDeal: 150_000,
};

/** Nota do bot de quem respondeu por mensagem em vez de usar o link de agendamento. */
export const BOT_NOTE_PATTERN = /em vez de agendar|respondeu por mensagem/i;

// ── Horário comercial (Brasília, seg–sex, 9h–18h; o Brasil não tem horário de verão desde 2019) ──

const BRT_OFFSET = -3 * HOUR;
const OPEN_MIN = 9 * 60;
const CLOSE_MIN = 18 * 60;

/** Minutos de horário comercial entre `from` e `to`. */
export function businessMinutesBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let total = 0;
  // Dia a dia em horário de Brasília
  const startLocal = new Date(from.getTime() + BRT_OFFSET);
  const endLocal = new Date(to.getTime() + BRT_OFFSET);
  const day = new Date(Date.UTC(startLocal.getUTCFullYear(), startLocal.getUTCMonth(), startLocal.getUTCDate()));
  for (; day.getTime() <= endLocal.getTime(); day.setUTCDate(day.getUTCDate() + 1)) {
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const open = day.getTime() + OPEN_MIN * 60000;
    const close = day.getTime() + CLOSE_MIN * 60000;
    const a = Math.max(open, startLocal.getTime());
    const b = Math.min(close, endLocal.getTime());
    if (b > a) total += (b - a) / 60000;
  }
  return Math.floor(total);
}

/** O instante em que se completam `minutes` minutos de horário comercial a partir de `from`. */
export function addBusinessMinutes(from: Date, minutes: number): Date {
  let left = minutes;
  let cur = from.getTime() + BRT_OFFSET;
  for (let guard = 0; guard < 400; guard++) {
    const d = new Date(cur);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const dow = d.getUTCDay();
    const open = dayStart + OPEN_MIN * 60000;
    const close = dayStart + CLOSE_MIN * 60000;
    if (dow !== 0 && dow !== 6 && cur < close) {
      const a = Math.max(cur, open);
      const avail = (close - a) / 60000;
      if (avail >= left) return new Date(a + left * 60000 - BRT_OFFSET);
      left -= avail;
    }
    cur = dayStart + DAY;
  }
  return new Date(cur - BRT_OFFSET);
}

// ── Regras ──

const firstName = (c?: { name: string | null; phone: string | null }) =>
  (c?.name || '').trim().split(/\s+/)[0] || c?.phone || 'contato';

const fullName = (c?: { name: string | null; phone: string | null }) => (c?.name || '').trim() || c?.phone || 'Contato';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const isProposalStage = (name: string) => norm(name).includes('proposta');

const days = (ms: number) => Math.floor(ms / DAY);

export function evaluateRules(s: RulesSnapshot): DesiredTask[] {
  const now = s.now.getTime();
  const out: DesiredTask[] = [];
  const bot = new Set(s.activeBotContactIds);

  const leadsBy = new Map<string, RulesSnapshot['leads']>();
  for (const l of s.leads) leadsBy.set(l.contactId, [...(leadsBy.get(l.contactId) ?? []), l]);

  const convsBy = new Map<string, RulesSnapshot['conversations']>();
  for (const c of s.conversations) convsBy.set(c.contactId, [...(convsBy.get(c.contactId) ?? []), c]);

  const lastTeamMsg = (contactId: string) => {
    let max = 0;
    for (const c of convsBy.get(contactId) ?? []) if (c.lastTeamOutboundAt) max = Math.max(max, c.lastTeamOutboundAt.getTime());
    return max;
  };
  const mainConv = (contactId: string) => {
    const list = [...(convsBy.get(contactId) ?? [])].sort(
      (a, b) => (b.lastMessage?.sentAt.getTime() ?? 0) - (a.lastMessage?.sentAt.getTime() ?? 0),
    );
    return list[0]?.id ?? null;
  };

  for (const m of s.meetings) {
    const contact = s.contacts[m.contactId];
    const end = m.endAt.getTime();
    const cards = leadsBy.get(m.contactId) ?? [];
    // Cliente (marcado como cliente, ou com card ganho e nenhum aberto): reunião de acompanhamento,
    // não de venda. Sem tarefa de proposta nem de cadastro; só a de marcar se a reunião aconteceu.
    const client = contact?.type === 'CLIENT' || (cards.some((l) => l.stageKind === 'WON') && !cards.some((l) => l.stageKind === 'OPEN'));

    // Reunião feita e o card não andou em 24h
    if (!client && m.status === 'COMPLETED' && now - end >= RULES.meetingNextStepAfter && now - end <= RULES.meetingLookback) {
      const moved = cards.some((l) => l.updatedAt.getTime() > end);
      if (!moved) {
        out.push({
          ruleKey: `meeting_next:${m.id}`,
          kind: 'MEETING_NEXT_STEP',
          contactId: m.contactId,
          conversationId: mainConv(m.contactId),
          title: `Mandar proposta / próximo passo — ${fullName(contact)}`,
          reason: `A reunião foi feita há ${Math.max(1, days(now - end))} dia(s) e o card não andou no funil.`,
          dueAt: new Date(end + RULES.meetingNextStepAfter),
        });
      }
    }

    // Reunião passou e ninguém marcou se aconteceu
    if (m.status === 'SCHEDULED' && now - end >= RULES.meetingStatusAfter && now - end <= RULES.meetingLookback) {
      out.push({
        ruleKey: `meeting_status:${m.id}`,
        kind: 'MEETING_STATUS',
        contactId: m.contactId,
        conversationId: mainConv(m.contactId),
        title: `Marcar se a reunião com ${firstName(contact)} aconteceu`,
        reason: `A reunião de ${m.startAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} passou e continua como agendada.`,
        dueAt: new Date(end + RULES.meetingStatusAfter),
      });
    }

    // Reunião de quem não tem card ou não tem @ do Instagram
    if (!client && (m.status === 'SCHEDULED' || m.status === 'COMPLETED') && now - end <= RULES.meetingLookback) {
      const missing: string[] = [];
      if (cards.length === 0) missing.push('card no funil');
      if (!contact?.instagramHandle?.trim()) missing.push('@ da marca no Instagram');
      if (missing.length) {
        out.push({
          ruleKey: `profile:${m.id}`,
          kind: 'COMPLETE_PROFILE',
          contactId: m.contactId,
          conversationId: mainConv(m.contactId),
          title: `Completar cadastro — ${fullName(contact)}`,
          reason: `Tem reunião, mas falta: ${missing.join(' e ')}.`,
          dueAt: new Date(Math.min(m.startAt.getTime(), Math.max(m.createdAt.getTime(), now))),
        });
      }
    }
  }

  // Proposta enviada há 2 dias sem mensagem do time
  for (const l of s.leads) {
    if (l.stageKind !== 'OPEN' || !isProposalStage(l.stageName)) continue;
    const anchor = Math.max(l.updatedAt.getTime(), lastTeamMsg(l.contactId));
    if (now - anchor < RULES.proposalSilence) continue;
    const contact = s.contacts[l.contactId];
    const big = l.value != null && l.value >= RULES.bigDeal;
    out.push({
      ruleKey: `proposal:${l.id}:${new Date(anchor).toISOString()}`,
      kind: 'PROPOSAL_FOLLOWUP',
      contactId: l.contactId,
      conversationId: mainConv(l.contactId),
      title: `Follow-up da proposta — ${fullName(contact)}${big ? ` (${brl(l.value!)})` : ''}`,
      reason: `Proposta${l.value ? ` de ${brl(l.value)}` : ''} parada há ${days(now - anchor)} dia(s) sem mensagem do time.`,
      dueAt: new Date(anchor + RULES.proposalSilence),
    });
  }

  // Lead escreveu por último e ninguém respondeu em 2h úteis
  for (const c of s.conversations) {
    const last = c.lastMessage;
    if (!last || last.direction !== 'INBOUND') continue;
    if (c.status === 'RESOLVED' || c.status === 'ARCHIVED') continue;
    if (bot.has(c.contactId)) continue;
    if (now - last.sentAt.getTime() > RULES.replyLookback) continue;
    if (businessMinutesBetween(last.sentAt, s.now) < RULES.replyBusinessMinutes) continue;
    const contact = s.contacts[c.contactId];
    out.push({
      ruleKey: `reply:${c.id}:${last.id}`,
      kind: 'REPLY',
      contactId: c.contactId,
      conversationId: c.id,
      title: `Responder ${firstName(contact)}`,
      reason: 'A última mensagem é do contato e ninguém respondeu há mais de 2h úteis.',
      dueAt: addBusinessMinutes(last.sentAt, RULES.replyBusinessMinutes),
    });
  }

  // Nota do bot: respondeu por mensagem em vez de agendar
  for (const n of s.botNotes) {
    if (!BOT_NOTE_PATTERN.test(n.content)) continue;
    const at = n.createdAt.getTime();
    if (now - at > RULES.botNoteLookback) continue;
    if (lastTeamMsg(n.contactId) > at) continue;
    if (s.meetings.some((m) => m.contactId === n.contactId && m.createdAt.getTime() > at && m.status !== 'CANCELLED')) continue;
    const contact = s.contacts[n.contactId];
    out.push({
      ruleKey: `bot_note:${n.id}`,
      kind: 'BOT_NOTE',
      contactId: n.contactId,
      conversationId: n.conversationId ?? mainConv(n.contactId),
      title: `Responder ${firstName(contact)} (não agendou pelo link)`,
      reason: n.content.replace(/\s+/g, ' ').slice(0, 300),
      dueAt: n.createdAt,
    });
  }

  // Uma tarefa por chave (a mesma reunião não gera duas)
  const seen = new Set<string>();
  return out.filter((t) => (seen.has(t.ruleKey) ? false : (seen.add(t.ruleKey), true)));
}

/** O que a sincronização deve fazer com as tarefas de regra abertas e as desejadas agora. */
export function planSync(
  desired: DesiredTask[],
  existing: { id: string; ruleKey: string; status: string; source: string }[],
): { create: DesiredTask[]; autoClose: string[] } {
  const known = new Set(existing.map((e) => e.ruleKey));
  const want = new Set(desired.map((d) => d.ruleKey));
  return {
    // Chave que já existiu (aberta, concluída ou dispensada) não volta
    create: desired.filter((d) => !known.has(d.ruleKey)),
    autoClose: existing.filter((e) => e.source === 'RULE' && e.status === 'OPEN' && !want.has(e.ruleKey)).map((e) => e.id),
  };
}
