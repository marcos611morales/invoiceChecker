/**
 * «Resumen por mes» (D-23): one row per calendar month of the range, including months at
 * $0, Mes as text, the amount in the chosen mode and the number of counted Ingreso
 * invoices. The Total row is the rounded exact total of the view, so it equals the
 * Dashboard's Gasto total and Facturas KPI (a sum of the rounded rows can differ by a cent,
 * as on screen).
 */
import { monthlyCounts } from "@/domain/accounting/aggregate";
import type { DashboardView } from "@/domain/accounting/view";
import { es } from "@/lib/copy/es";
import { monthYearLabel } from "@/lib/format";
import { countCell, moneyCell, textCell, type SheetModel, type XCell } from "../cellModel";
import { amountHeader, type WorkbookContext } from "../workbook";

export function buildResumenMes(view: DashboardView, ctx: WorkbookContext): SheetModel {
  const counts = monthlyCounts(view.visible, view.range);
  const rows: XCell[][] = view.series.map((point, index) => [
    textCell(monthYearLabel(point.month)),
    moneyCell(point.amount),
    countCell(counts[index]?.facturas ?? 0),
  ]);
  return {
    name: es.export.sheets.resumenMes,
    columns: [
      { header: es.export.month, width: 12 },
      { header: amountHeader(ctx.mode), width: 16 },
      { header: es.export.invoices, width: 12 },
    ],
    rows,
    totalRow: [
      textCell(es.export.total),
      moneyCell(view.current.gasto),
      countCell(view.current.facturas),
    ],
  };
}
