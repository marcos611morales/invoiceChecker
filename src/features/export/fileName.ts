/** Skeleton for the RED step. */
import type { IvaMode } from "@/domain/accounting/aggregate";
import type { DateRange } from "@/domain/accounting/filters";

export function exportFileName(_range: DateRange | null, _mode: IvaMode): string {
  return "";
}
