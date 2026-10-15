/**
 * Chart adapter of the monthly trend (D-21). Pure, no React.
 *
 * `amount` is the plotting value only: chart geometry is the one place where a
 * floating-point number is acceptable, and it is derived from the 2-dp money
 * string. Every text a person reads (tooltip, table, legend) comes from
 * `amountText`, which is the shared exact formatter (REGLA-04, D-26).
 */
import type { MonthPoint } from "@/domain/accounting/aggregate";
import { toMoneyString } from "@/domain/accounting/decimal";
import type { MonthKey } from "@/domain/accounting/months";
import { formatMoney, monthShortLabel } from "@/lib/format";

export interface TrendDatum {
  month: MonthKey;
  tick: string;
  amount: number;
  amountText: string;
}

/** "ene" inside one calendar year, "ene 25" when the range spans years. */
export function tickLabel(month: MonthKey, spansYears: boolean): string {
  const short = monthShortLabel(month);
  return spansYears ? `${short} ${month.slice(2, 4)}` : short;
}

/** Number for geometry from an exact money string; never a negative zero. */
function plottingValue(point: MonthPoint): number {
  const value = Number(toMoneyString(point.amount));
  return value === 0 ? 0 : value;
}

/** One datum per month point, zero-spend and negative months included. */
export function toTrendData(points: readonly MonthPoint[]): TrendDatum[] {
  const first = points[0];
  const last = points[points.length - 1];
  const spansYears =
    first !== undefined && last !== undefined && first.month.slice(0, 4) !== last.month.slice(0, 4);
  return points.map((point) => ({
    month: point.month,
    tick: tickLabel(point.month, spansYears),
    amount: plottingValue(point),
    amountText: formatMoney(point.amount),
  }));
}

/** Narrows the untyped payload recharts hands to tooltip callbacks. */
export function isTrendDatum(value: unknown): value is TrendDatum {
  if (typeof value !== "object" || value === null) return false;
  return (
    "month" in value &&
    typeof value.month === "string" &&
    "tick" in value &&
    typeof value.tick === "string" &&
    "amount" in value &&
    typeof value.amount === "number" &&
    "amountText" in value &&
    typeof value.amountText === "string"
  );
}
