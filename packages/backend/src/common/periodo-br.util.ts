/**
 * Datas no horário de Brasília. O Brasil não tem horário de verão desde 2019, então o fuso é
 * fixo em UTC-3: o dia D começa em D 03:00 UTC.
 */
const OFFSET_MS = 3 * 3600_000;
const DAY_MS = 24 * 3600_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" do instante no horário de Brasília. */
export function diaBR(d: Date = new Date()) {
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

/** Instante em que o dia "YYYY-MM-DD" começa em Brasília. */
export function inicioDiaBR(dia: string) {
  return new Date(`${dia}T03:00:00.000Z`);
}

export function somaDias(dia: string, n: number) {
  return new Date(inicioDiaBR(dia).getTime() + n * DAY_MS - OFFSET_MS).toISOString().slice(0, 10);
}

export function isDiaValido(dia: string) {
  return ISO_DAY.test(dia) && !Number.isNaN(inicioDiaBR(dia).getTime()) && diaBR(inicioDiaBR(dia)) === dia;
}

export interface PeriodoBR {
  from: string; // primeiro dia (inclusive)
  to: string; // último dia (inclusive)
  start: Date; // início de "from" em Brasília
  end: Date; // início do dia seguinte a "to" (exclusivo)
  days: number;
}

/** Período de dias inteiros [from, to] em Brasília. */
export function periodoBR(from: string, to: string): PeriodoBR {
  const start = inicioDiaBR(from);
  const end = inicioDiaBR(somaDias(to, 1));
  return { from, to, start, end, days: Math.round((end.getTime() - start.getTime()) / DAY_MS) };
}

/** Período de mesmo tamanho imediatamente antes (ex.: últimos 7 dias → os 7 anteriores). */
export function periodoAnterior(p: PeriodoBR): PeriodoBR {
  return periodoBR(somaDias(p.from, -p.days), somaDias(p.from, -1));
}
