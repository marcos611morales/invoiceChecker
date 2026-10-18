/**
 * Test helper shared by the workbook identity tests (anonymized and real data): reads cells out
 * of the library-independent SheetModel and states the identities between the workbook and the
 * Dashboard view. Assertion failures carry only booleans and labels, never an amount, an RFC, a
 * name or a UUID, so the same checks are safe over the real sample. Not imported by production code.
 */
import Big from "big.js";
import { expect } from "vitest";
import type { IvaMode } from "@/domain/accounting/aggregate";
import { ZERO, sum, toMoneyString } from "@/domain/accounting/decimal";
import type { DashboardView } from "@/domain/accounting/view";
import type { SheetModel, XCell } from "@/features/export/cellModel";
import { amountHeader } from "@/features/export/workbook";
import { es } from "@/lib/copy/es";

export function sheetNamed(sheets: readonly SheetModel[], name: string): SheetModel {
  const found = sheets.find((sheet) => sheet.name === name);
  if (found === undefined) throw new Error("sheet missing from the workbook");
  return found;
}

export function columnIndex(sheet: SheetModel, header: string): number {
  const index = sheet.columns.findIndex((column) => column.header === header);
  if (index < 0) throw new Error("column missing from the sheet");
  return index;
}

function cellAt(row: readonly XCell[], index: number): XCell {
  const cell = row[index];
  if (cell === undefined) throw new Error("row shorter than its columns");
  return cell;
}

/** The exact decimal string of a number cell. */
export function numberText(row: readonly XCell[], index: number): string {
  const cell = cellAt(row, index);
  if (cell.kind !== "number") throw new Error("expected a number cell");
  return cell.value;
}

/** The text of a text cell. */
export function textOf(row: readonly XCell[], index: number): string {
  const cell = cellAt(row, index);
  if (cell.kind !== "text") throw new Error("expected a text cell");
  return cell.value;
}

/** True when the cell is empty (an absent figure). */
export function isEmptyCell(row: readonly XCell[], index: number): boolean {
  return cellAt(row, index).kind === "empty";
}

export function totalRowOf(sheet: SheetModel): readonly XCell[] {
  if (sheet.totalRow === null) throw new Error("sheet has no Total row");
  return sheet.totalRow;
}

/** The value cell of the «Parámetros» row whose label is `label`. */
export function parameterRow(parametros: SheetModel, label: string): readonly XCell[] {
  const row = parametros.rows.find((candidate) => {
    const first = candidate[0];
    return first !== undefined && first.kind === "text" && first.value === label;
  });
  if (row === undefined) throw new Error("parameter row missing");
  return row;
}

/** Monto of every row of a detail sheet, grouped by the UUID column (summed exactly). */
export function montoByUuid(sheet: SheetModel, mode: IvaMode): Map<string, Big> {
  const uuidAt = columnIndex(sheet, es.export.columns.uuid);
  const montoAt = columnIndex(sheet, amountHeader(mode));
  const grouped = new Map<string, Big[]>();
  for (const row of sheet.rows) {
    const uuid = textOf(row, uuidAt);
    const amount = new Big(numberText(row, montoAt));
    const known = grouped.get(uuid);
    if (known === undefined) grouped.set(uuid, [amount]);
    else known.push(amount);
  }
  const totals = new Map<string, Big>();
  for (const [uuid, amounts] of grouped) totals.set(uuid, sum(amounts));
  return totals;
}

/** Every Total row of the workbook equals the Dashboard figure of the same view, to the cent. */
export function expectTotalsEqualDashboard(
  sheets: readonly SheetModel[],
  view: DashboardView,
  mode: IvaMode,
): void {
  const gasto = toMoneyString(view.current.gasto);
  const facturas = String(view.current.facturas);
  const monto = amountHeader(mode);

  const categoria = sheetNamed(sheets, es.export.sheets.resumenCategoria);
  const categoriaTotal = totalRowOf(categoria);
  expect(numberText(categoriaTotal, columnIndex(categoria, monto)) === gasto).toBe(true);
  expect(
    numberText(categoriaTotal, columnIndex(categoria, es.export.summary.monthlyAverage)) ===
      toMoneyString(view.current.promedio),
  ).toBe(true);

  const proveedor = sheetNamed(sheets, es.export.sheets.resumenProveedor);
  const proveedorTotal = totalRowOf(proveedor);
  expect(numberText(proveedorTotal, columnIndex(proveedor, monto)) === gasto).toBe(true);
  expect(numberText(proveedorTotal, columnIndex(proveedor, es.export.invoices)) === facturas).toBe(
    true,
  );
  const ticketAt = columnIndex(proveedor, es.export.summary.ticket);
  if (view.current.ticket === null) {
    expect(isEmptyCell(proveedorTotal, ticketAt)).toBe(true);
  } else {
    expect(numberText(proveedorTotal, ticketAt) === toMoneyString(view.current.ticket)).toBe(true);
  }

  const mes = sheetNamed(sheets, es.export.sheets.resumenMes);
  const mesTotal = totalRowOf(mes);
  expect(numberText(mesTotal, columnIndex(mes, monto)) === gasto).toBe(true);
  expect(numberText(mesTotal, columnIndex(mes, es.export.invoices)) === facturas).toBe(true);

  const parametros = sheetNamed(sheets, es.export.sheets.parametros);
  expect(numberText(parameterRow(parametros, es.export.params.total), 1) === gasto).toBe(true);
  expect(numberText(parameterRow(parametros, es.export.params.invoices), 1) === facturas).toBe(
    true,
  );
}

/** The exact category nets of the view add up to its Gasto total, and so do the sheet's rows to the Dashboard's. */
export function expectCategoriesAddUp(view: DashboardView, sheets: readonly SheetModel[]): void {
  const nets = sum(view.categories.map((row) => row.net));
  expect(nets.eq(view.current.gasto)).toBe(true);
  const categoria = sheetNamed(sheets, es.export.sheets.resumenCategoria);
  expect(categoria.rows).toHaveLength(view.categories.length);
}

/** For every invoice, the Monto cells of «Conceptos» add up to its Monto in «Facturas» (user decision 2026-10-18). */
export function expectConceptosReconcileWithFacturas(
  sheets: readonly SheetModel[],
  mode: IvaMode,
): void {
  const facturas = montoByUuid(sheetNamed(sheets, es.export.sheets.facturas), mode);
  const conceptos = montoByUuid(sheetNamed(sheets, es.export.sheets.conceptos), mode);
  for (const uuid of conceptos.keys()) {
    expect(facturas.has(uuid)).toBe(true);
  }
  let mismatches = 0;
  for (const [uuid, monto] of facturas) {
    const lines = conceptos.get(uuid) ?? ZERO;
    if (!lines.eq(monto)) mismatches += 1;
  }
  expect(mismatches).toBe(0);
}

/** The Monto column of «Facturas», summed exactly. */
export function facturasMontoSum(sheets: readonly SheetModel[], mode: IvaMode): Big {
  return sum(montoByUuid(sheetNamed(sheets, es.export.sheets.facturas), mode).values());
}
