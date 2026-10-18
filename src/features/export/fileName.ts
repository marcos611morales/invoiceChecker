/**
 * File name of the export (D-19, A-3): the range of the Dashboard and the IVA mode, for
 * example gastos-2025-01_2025-12-con-iva.xlsx; without a range, gastos-con-iva.xlsx.
 */
import type { IvaMode } from "@/domain/accounting/aggregate";
import type { DateRange } from "@/domain/accounting/filters";

export function exportFileName(range: DateRange | null, mode: IvaMode): string {
  const ivaPart = `${mode}-iva`;
  const rangePart = range === null ? "" : `${range.from}_${range.to}-`;
  return `gastos-${rangePart}${ivaPart}.xlsx`;
}
