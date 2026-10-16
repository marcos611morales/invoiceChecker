/**
 * Month helpers over the literal CFDI Fecha (REGLA-05). The month of an
 * invoice is the first seven characters of its Fecha ("2025-08-31T21:20:35"
 * is "2025-08"): Fecha has no time zone, so it is never turned into an
 * instant. Month arithmetic is plain integers (year * 12 + month index).
 * Display names of months live with the formatting code, not here.
 *
 * A Fecha whose literal year falls outside the plausible window
 * (MIN_FECHA_YEAR .. currentYear + 1, both ends included) has no month (D-48):
 * a damaged year such as 0001 or 2205 must neither sum nor stretch the loaded
 * month span. The domain never reads a clock; the caller injects the year.
 */

/** "YYYY-MM". */
export type MonthKey = string;

/** First year a CFDI Fecha may carry (D-48); CFDI 4.0 did not exist before it. */
export const MIN_FECHA_YEAR = 2000;

/**
 * What the Fecha-to-month conversion needs from the outside world: the
 * browser's local calendar year, injected by the caller because the domain
 * never reads a clock (D-48).
 */
export interface FechaContext {
  currentYear: number;
}

const FECHA_RE =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Month of a CFDI Fecha, or null when the Fecha does not have the CFDI shape or
 * its literal year is outside MIN_FECHA_YEAR .. the injected year plus one, both
 * ends included (D-48). The Fecha is never turned into a Date (REGLA-05).
 */
export function monthOfFecha(fecha: string, context: FechaContext): MonthKey | null {
  const match = FECHA_RE.exec(fecha);
  if (match === null) return null;
  const [, yearText, monthText, dayText] = match;
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    return null;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12) return null;
  const monthDays = DAYS_IN_MONTH[month - 1] ?? 0;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : monthDays;
  if (day < 1 || day > maxDay) return null;
  if (year < MIN_FECHA_YEAR || year > context.currentYear + 1) return null;
  return `${yearText}-${monthText}`;
}

/** Integer position of a month key; NaN when the key is not YYYY-MM. */
function monthIndex(key: MonthKey): number {
  const match = MONTH_KEY_RE.exec(key);
  if (match === null) return Number.NaN;
  const [, yearText, monthText] = match;
  if (yearText === undefined || monthText === undefined) return Number.NaN;
  return Number(yearText) * 12 + (Number(monthText) - 1);
}

function monthFromIndex(index: number): MonthKey {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** Every month from `from` to `to`, both included; empty when reversed or invalid. */
export function monthsInRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const start = monthIndex(from);
  const end = monthIndex(to);
  const months: MonthKey[] = [];
  for (let index = start; index <= end; index += 1) {
    months.push(monthFromIndex(index));
  }
  return months;
}

/** The same number of months immediately before `from` (D-20). */
export function previousPeriod(
  from: MonthKey,
  to: MonthKey,
): { from: MonthKey; to: MonthKey } {
  const start = monthIndex(from);
  const length = monthIndex(to) - start + 1;
  if (!Number.isFinite(length)) return { from, to }; // invalid key: nothing to shift
  return {
    from: monthFromIndex(start - length),
    to: monthFromIndex(start - 1),
  };
}

/** Chronological order for sort callbacks (the fixed YYYY-MM shape compares as text). */
export function compareMonths(a: MonthKey, b: MonthKey): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
