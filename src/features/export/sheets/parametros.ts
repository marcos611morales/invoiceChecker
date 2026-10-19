/**
 * «Parámetros» (XLS-01): which filters, mode and moment produced the file, so the accountant
 * can reproduce it. Two columns, Parámetro and Valor. Every value is a text cell (format @), so
 * a supplier or category name that starts with = + - or @ is never evaluated (T-03-41); the only
 * numbers are the invoice count (the Facturas KPI, A-1) and the Gasto total, both read from
 * `view.current` so they equal the Dashboard. The Nota also says that each amount is rounded to
 * cents, so a column sum can differ by cents from the Gasto total and the summary Total rows
 * (D-20, WR-02).
 */
import type { DashboardView } from "@/domain/accounting/view";
import { es } from "@/lib/copy/es";
import { variationMonthText } from "@/lib/copy/messages";
import { monthYearLabel, rangeText } from "@/lib/format";
import { countCell, moneyCell, textCell, type SheetModel, type XCell } from "../cellModel";
import type { WorkbookContext } from "../workbook";

const NAMES_SEPARATOR = ", ";

/** The selected names joined, or the «all» word when nothing is selected. */
function namesOrAll(labels: readonly string[], all: string): string {
  return labels.length === 0 ? all : labels.join(NAMES_SEPARATOR);
}

function row(label: string, value: XCell): XCell[] {
  return [textCell(label), value];
}

export function buildParametros(view: DashboardView, ctx: WorkbookContext): SheetModel {
  const p = es.export.params;
  const range = view.range === null ? p.none : rangeText(view.range.from, view.range.to);
  const variation =
    view.variationMonths === null
      ? p.none
      : variationMonthText(
          monthYearLabel(view.variationMonths.last),
          monthYearLabel(view.variationMonths.previous),
        );
  return {
    name: es.export.sheets.parametros,
    columns: [
      { header: p.parameter, width: 32 },
      { header: p.value, width: 60, wrap: true },
    ],
    rows: [
      row(p.exportedAt, textCell(ctx.exportedAtText)),
      row(p.mode, textCell(ctx.mode === "con" ? p.modeCon : p.modeSin)),
      row(p.range, textCell(range)),
      row(p.suppliers, textCell(namesOrAll(ctx.supplierLabels, p.all))),
      row(p.categories, textCell(namesOrAll(ctx.categoryLabels, p.allFem))),
      row(p.formas, textCell(namesOrAll(ctx.formaLabels, p.allFem))),
      row(p.invoices, countCell(view.current.facturas)),
      row(p.total, moneyCell(view.current.gasto)),
      row(p.variationMonth, textCell(variation)),
      row(p.note, textCell(p.noteText)),
    ],
    totalRow: null,
  };
}
