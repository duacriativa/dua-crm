// Cálculo dos horários livres da página de agendamento. Funções puras (sem banco nem Google).

/** Faixas do dia, ex.: [["09:00","11:30"],["14:15","16:45"]]. */
export type DayRanges = [string, string][];
/** Grade semanal: chave = dia da semana (0 = domingo … 6 = sábado). */
export type WeeklyHours = Record<string, DayRanges>;
/** Exceções por data (YYYY-MM-DD): [] = dia fechado; faixas = substituem a grade daquele dia. */
export type DateOverrides = Record<string, DayRanges>;

export interface AvailabilityConfig {
  durationMin: number;
  bufferAfterMin: number;
  slotStepMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  timezone: string;
  weeklyHours: WeeklyHours;
  dateOverrides: DateOverrides;
}

export interface Interval { start: Date; end: Date }

// Disponibilidade padrão da Dua (a mesma do Calendly)
export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  '1': [['09:00', '17:00']],
  '2': [['09:00', '11:30'], ['14:15', '16:45']],
  '3': [['09:00', '11:30'], ['14:15', '16:45']],
  '4': [['09:00', '11:30'], ['13:00', '16:45']],
  '5': [['09:00', '11:30'], ['14:15', '16:45']],
};

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Valida e ordena faixas; lança Error com mensagem legível. */
export function cleanRanges(input: unknown, label: string): DayRanges {
  if (!Array.isArray(input)) throw new Error(`${label}: faixas inválidas`);
  const ranges = input.map((r) => {
    if (!Array.isArray(r) || r.length !== 2 || !TIME_RE.test(r[0]) || !TIME_RE.test(r[1])) {
      throw new Error(`${label}: use HH:MM`);
    }
    if (toMin(r[1]) <= toMin(r[0])) throw new Error(`${label}: ${r[0]}–${r[1]} termina antes de começar`);
    return [r[0], r[1]] as [string, string];
  });
  ranges.sort((a, b) => toMin(a[0]) - toMin(b[0]));
  for (let i = 1; i < ranges.length; i++) {
    if (toMin(ranges[i][0]) < toMin(ranges[i - 1][1])) throw new Error(`${label}: faixas sobrepostas`);
  }
  return ranges;
}

export function cleanWeeklyHours(input: unknown): WeeklyHours {
  if (!input || typeof input !== 'object') throw new Error('Grade semanal inválida');
  const out: WeeklyHours = {};
  for (let d = 0; d <= 6; d++) {
    const v = (input as any)[String(d)];
    if (v == null) continue;
    const ranges = cleanRanges(v, DAY_NAMES[d]);
    if (ranges.length) out[String(d)] = ranges;
  }
  return out;
}

export function cleanDateOverrides(input: unknown): DateOverrides {
  if (input == null) return {};
  if (typeof input !== 'object') throw new Error('Exceções inválidas');
  const out: DateOverrides = {};
  for (const [date, v] of Object.entries(input as any)) {
    if (!DATE_RE.test(date)) throw new Error(`Data inválida: ${date}`);
    out[date] = cleanRanges(v, date);
  }
  return out;
}

// ── Fuso horário ────────────────────────────────────────────────────────────

/** Diferença (ms) entre o relógio do fuso e o UTC naquele instante. */
function tzOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "2026-10-27" + 540 min no fuso → instante UTC. */
export function zonedToUtc(date: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - tzOffsetMs(new Date(guess), timeZone);
  // Segunda passada acerta dias de troca de horário de verão
  return new Date(guess - tzOffsetMs(new Date(first), timeZone));
}

/** Data (YYYY-MM-DD) de um instante no fuso. */
export function dateInZone(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Faixas que valem num dia: exceção da data ou a grade da semana. */
export function rangesFor(cfg: AvailabilityConfig, date: string): DayRanges {
  return cfg.dateOverrides[date] ?? cfg.weeklyHours[String(weekday(date))] ?? [];
}

/** Primeiro e último dia que a página aceita (no fuso da página). */
export function bookableWindow(cfg: AvailabilityConfig, now: Date) {
  const first = dateInZone(now, cfg.timezone);
  return { first, last: addDays(first, cfg.maxDaysAhead) };
}

/**
 * Horários livres entre `from` e `to` (datas inclusivas, no fuso da página).
 * Um horário vale quando a reunião cabe na faixa e [início, fim + intervalo) não bate
 * com nenhum período ocupado. `busy` já deve vir com o intervalo das reuniões nossas.
 */
export function computeSlots(cfg: AvailabilityConfig, from: string, to: string, busy: Interval[], now: Date) {
  const { first, last } = bookableWindow(cfg, now);
  const start = from > first ? from : first;
  const end = to < last ? to : last;
  const earliest = now.getTime() + cfg.minNoticeMin * 60_000;
  const step = Math.max(5, cfg.slotStepMin || cfg.durationMin);
  const days: Record<string, string[]> = {};

  for (let date = start; date <= end; date = addDays(date, 1)) {
    const slots: string[] = [];
    for (const [a, b] of rangesFor(cfg, date)) {
      for (let m = toMin(a); m + cfg.durationMin <= toMin(b); m += step) {
        const s = zonedToUtc(date, m, cfg.timezone);
        if (s.getTime() < earliest) continue;
        const blockEnd = s.getTime() + (cfg.durationMin + cfg.bufferAfterMin) * 60_000;
        const clash = busy.some((x) => x.start.getTime() < blockEnd && x.end.getTime() > s.getTime());
        if (!clash) slots.push(s.toISOString());
      }
    }
    if (slots.length) days[date] = slots;
  }
  return days;
}

/** O horário escolhido continua livre? (confere de novo na hora de gravar) */
export function isSlotAvailable(cfg: AvailabilityConfig, startIso: string, busy: Interval[], now: Date) {
  const startAt = new Date(startIso);
  if (Number.isNaN(startAt.getTime())) return false;
  const date = dateInZone(startAt, cfg.timezone);
  return (computeSlots(cfg, date, date, busy, now)[date] ?? []).includes(startAt.toISOString());
}
