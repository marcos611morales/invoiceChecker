// RED stub: replaced by the implementation in the GREEN commit.
export type MonthKey = string;
export function monthOfFecha(_fecha: string): MonthKey | null {
  return null;
}
export function monthsInRange(_from: MonthKey, _to: MonthKey): MonthKey[] {
  return [];
}
export function previousPeriod(
  from: MonthKey,
  to: MonthKey,
): { from: MonthKey; to: MonthKey } {
  return { from, to };
}
export function compareMonths(_a: MonthKey, _b: MonthKey): number {
  return 0;
}
