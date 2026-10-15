import type Big from "big.js";
import type { MonthPoint } from "@/domain/accounting/aggregate";
import type { DateRange } from "@/domain/accounting/filters";

export function TrendChart(_props: {
  series: readonly MonthPoint[];
  promedio: Big;
  range: DateRange;
}) {
  return null;
}
