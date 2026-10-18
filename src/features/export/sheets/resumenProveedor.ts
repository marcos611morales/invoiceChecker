/**
 * «Resumen por proveedor» (D-23): every supplier of the filter, not only the top 10 of the
 * Dashboard. RFC and name are text cells (XLS-03, T-03-41). The Total row is read from
 * `view.current`: the Gasto total, 100 % when that total is above zero, the Facturas KPI
 * (flagged assumption A-1) and the Ticket promedio KPI.
 */
import { ZERO, fromInteger } from "@/domain/accounting/decimal";
import type { DashboardView } from "@/domain/accounting/view";
import { es } from "@/lib/copy/es";
import {
  countCell,
  emptyCell,
  moneyCell,
  percentCell,
  textCell,
  type SheetModel,
  type XCell,
} from "../cellModel";
import { amountHeader, type WorkbookContext } from "../workbook";

const ONE = fromInteger(1);

export function buildResumenProveedor(view: DashboardView, ctx: WorkbookContext): SheetModel {
  const rows: XCell[][] = view.ranking.map((row) => [
    textCell(row.rfc),
    textCell(row.name),
    moneyCell(row.net),
    row.pct === null ? emptyCell() : percentCell(row.pct),
    countCell(row.facturas),
    row.ticket === null ? emptyCell() : moneyCell(row.ticket),
  ]);
  return {
    name: es.export.sheets.resumenProveedor,
    columns: [
      { header: es.export.summary.rfc, width: 16 },
      { header: es.export.columns.supplier, width: 36 },
      { header: amountHeader(ctx.mode), width: 16 },
      { header: es.export.summary.pct, width: 12 },
      { header: es.export.invoices, width: 12 },
      { header: es.export.summary.ticket, width: 16 },
    ],
    rows,
    totalRow: [
      textCell(es.export.total),
      emptyCell(),
      moneyCell(view.current.gasto),
      view.current.gasto.gt(ZERO) ? percentCell(ONE) : emptyCell(),
      countCell(view.current.facturas),
      view.current.ticket === null ? emptyCell() : moneyCell(view.current.ticket),
    ],
  };
}
