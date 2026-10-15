import type { MonthPoint } from "@/domain/accounting/aggregate";
import type { MonthKey } from "@/domain/accounting/months";

export interface TrendDatum {
  month: MonthKey;
  tick: string;
  amount: number;
  amountText: string;
}

export function tickLabel(month: MonthKey, spansYears: boolean): string {
  return spansYears ? month : month;
}

export function toTrendData(points: readonly MonthPoint[]): TrendDatum[] {
  return points.map((p) => ({ month: p.month, tick: "", amount: 1, amountText: "" }));
}

export function isTrendDatum(value: unknown): value is TrendDatum {
  return value !== null;
}
