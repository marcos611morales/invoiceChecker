"use client";

import type { DateRange } from "@/domain/accounting/filters";

/** RED skeleton: wrong on purpose, replaced by the real implementation. */
export function thisYearRange(span: DateRange): DateRange {
  return span;
}

/** RED skeleton: wrong on purpose, replaced by the real implementation. */
export function lastMonthsRange(span: DateRange, n: number): DateRange {
  void n;
  return span;
}

/** RED skeleton: renders nothing. */
export function DateRangeFilter(props: {
  span: DateRange;
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}) {
  void props;
  return null;
}
