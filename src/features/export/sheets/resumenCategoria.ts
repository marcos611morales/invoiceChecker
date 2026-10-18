/**
 * «Resumen por categoría» (D-23): the Dashboard's category block as a sheet. One row per
 * `view.categories` entry, in the same order, so «Sin categoría» appears when it has spend.
 * The variation reads «Sin dato del mes anterior» when there is no comparable month. The Total
 * row comes from `view.current` (the Gasto total and the monthly average KPI), never from a sum
 * of the rounded rows, so it equals the Dashboard figure; its variation is left empty.
 *
 * Category names are text cells, so a name that starts with = + - or @ is never evaluated
 * (XLS-03, T-03-41).
 */
import { ZERO, fromInteger } from "@/domain/accounting/decimal";
import type { DashboardView } from "@/domain/accounting/view";
import { es } from "@/lib/copy/es";
import {
  emptyCell,
  moneyCell,
  percentCell,
  textCell,
  type SheetModel,
  type XCell,
} from "../cellModel";
import { amountHeader, type WorkbookContext } from "../workbook";

const ONE = fromInteger(1);

export function buildResumenCategoria(view: DashboardView, ctx: WorkbookContext): SheetModel {
  const rows: XCell[][] = view.categories.map((row) => [
    textCell(ctx.nameOf(row.category)),
    moneyCell(row.net),
    row.pct === null ? emptyCell() : percentCell(row.pct),
    moneyCell(row.promedio),
    row.variation === null ? textCell(es.export.noPreviousMonth) : percentCell(row.variation),
  ]);
  return {
    name: es.export.sheets.resumenCategoria,
    columns: [
      { header: es.export.columns.category, width: 32 },
      { header: amountHeader(ctx.mode), width: 16 },
      { header: es.export.summary.pct, width: 12 },
      { header: es.export.summary.monthlyAverage, width: 16 },
      { header: es.export.summary.variation, width: 16, wrap: true },
    ],
    rows,
    totalRow: [
      textCell(es.export.total),
      moneyCell(view.current.gasto),
      view.current.gasto.gt(ZERO) ? percentCell(ONE) : emptyCell(),
      moneyCell(view.current.promedio),
      emptyCell(),
    ],
  };
}
