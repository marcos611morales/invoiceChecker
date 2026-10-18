/**
 * «Conceptos» (D-20 to D-22): one row per concept line of the invoices of «Facturas», in XML
 * order, each with the category it resolves to and where that category came from (UI-SPEC Q6,
 * filled on every row, also on rows that do not sum). Under a category filter only the lines
 * of the chosen categories are written (D-21).
 *
 * Rounding (D-13, UI-SPEC Q7b, research Pitfall 10): every amount is rounded to cents when the
 * cell is written, so the rounded lines of an invoice can miss its rounded amount by a few
 * cents. For each summing invoice a «Diferencia de redondeo» line in the supplier's category
 * carries that gap, so the Monto cells of one invoice add up exactly to its Monto in
 * «Facturas», with or without a category filter. Sums per category of this sheet may still differ from the Dashboard by cents,
 * because the Dashboard sums exact amounts and rounds only the result.
 *
 * Every description, name and code is a text cell, so a value beginning with = + - or @ is
 * never evaluated (XLS-03, T-03-27).
 */
import type Big from "big.js";
import { entryAmount, type IvaMode } from "@/domain/accounting/aggregate";
import { conceptAmounts } from "@/domain/accounting/amounts";
import { conceptBreakdown } from "@/domain/accounting/breakdown";
import type { ScopedEntry } from "@/domain/accounting/categories";
import { ZERO, parseDecimal, sum, toMoneyString } from "@/domain/accounting/decimal";
import type { DashboardView } from "@/domain/accounting/view";
import type { CategorySource } from "@/domain/settings/resolver";
import { SIN_CATEGORIA } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import {
  emptyCell,
  moneyCell,
  quantityCell,
  textCell,
  unitPriceCell,
  type SheetColumn,
  type SheetModel,
  type XCell,
} from "../cellModel";
import { amountHeader, type WorkbookContext } from "../workbook";
import { estadoCell, identityCells, identityColumns, optionalMoney, sortEntriesForExport } from "./facturas";

const WIDTH = {
  status: 34,
  description: 50,
  quantity: 12,
  unit: 14,
  clave: 16,
  money: 16,
  category: 32,
  origin: 24,
} as const;

function originText(source: CategorySource): string {
  switch (source) {
    case "regla":
      return es.export.origin.regla;
    case "proveedor":
      return es.export.origin.proveedor;
    case "ninguna":
      return es.export.origin.ninguna;
  }
}

/** A text cell, or an empty one when the XML left the attribute blank. */
function textOrEmpty(value: string): XCell {
  return value.trim() === "" ? emptyCell() : textCell(value);
}

function amountOf(line: { conIva: Big | null; sinIva: Big | null }, mode: IvaMode): Big {
  return (mode === "con" ? line.conIva : line.sinIva) ?? ZERO;
}

/** The amount as it is written to its cell: rounded half-up to cents. */
function roundedCents(value: Big): Big {
  return parseDecimal(toMoneyString(value)) ?? ZERO;
}

export function buildConceptos(view: DashboardView, ctx: WorkbookContext): SheetModel {
  const columns: SheetColumn[] = [
    ...identityColumns(),
    { header: es.export.columns.status, width: WIDTH.status },
    { header: es.export.columns.description, width: WIDTH.description, wrap: true },
    { header: es.export.columns.quantity, width: WIDTH.quantity },
    { header: es.export.columns.unit, width: WIDTH.unit },
    { header: es.export.columns.claveProdServ, width: WIDTH.clave },
    { header: es.export.columns.unitPrice, width: WIDTH.money },
    { header: amountHeader(ctx.mode), width: WIDTH.money },
    { header: es.export.columns.amount, width: WIDTH.money },
    { header: es.export.columns.discount, width: WIDTH.money },
    { header: es.export.columns.iva, width: WIDTH.money },
    { header: es.export.columns.ieps, width: WIDTH.money },
    { header: es.export.columns.category, width: WIDTH.category },
    { header: es.export.columns.origin, width: WIDTH.origin },
  ];

  const selection = view.selected;
  const rows: XCell[][] = [];

  for (const entry of sortEntriesForExport(view.visible)) {
    const lead = [...identityCells(entry), estadoCell(entry)];
    const keptConcepts = new Set<number>();
    for (const part of entry.parts) {
      if (part.concept !== null) keptConcepts.add(part.concept);
    }
    let writtenLines = ZERO;
    entry.invoice.conceptos.forEach((concepto, index) => {
      const amounts = conceptAmounts(concepto, entry.invoice);
      // An unusable amount counts as zero, as in the split of the Dashboard (D-13).
      const lineAmount = amountOf(amounts, ctx.mode);
      if (selection.size > 0 && !keptConcepts.has(index)) return;
      writtenLines = writtenLines.plus(roundedCents(lineAmount));
      const breakdown = conceptBreakdown(concepto, entry.invoice);
      const { category, source } = ctx.resolver.explain(entry.supplierRfc, concepto.descripcion);
      const unidad = concepto.unidad === null ? "" : concepto.unidad.trim();
      rows.push([
        ...lead,
        textCell(concepto.descripcion),
        quantityCell(concepto.cantidad),
        textOrEmpty(unidad === "" ? concepto.claveUnidad : unidad),
        textOrEmpty(concepto.claveProdServ),
        amounts.precioUnitario === null ? emptyCell() : unitPriceCell(amounts.precioUnitario),
        moneyCell(entry.counted ? lineAmount : ZERO),
        optionalMoney(breakdown.importe),
        optionalMoney(breakdown.descuento),
        optionalMoney(breakdown.iva),
        optionalMoney(breakdown.ieps),
        textCell(ctx.nameOf(category)),
        textCell(originText(source)),
      ]);
    });

    const roundingRow = roundingLine(entry, ctx, writtenLines, lead);
    if (roundingRow !== null) rows.push(roundingRow);
  }

  return { name: es.export.sheets.conceptos, columns, rows, totalRow: null };
}

/**
 * The «Diferencia de redondeo» row of a summing invoice, or null when its written lines already
 * add up to its Monto in «Facturas». The target is that same Monto (the partial amount under a
 * category filter, the whole invoice without one), so the Conceptos rows of every invoice always
 * add up exactly to its Facturas row (user decision 2026-10-18). The row is written even when the
 * supplier's category is outside the filter, because only then do the two sheets agree.
 */
function roundingLine(
  entry: ScopedEntry,
  ctx: WorkbookContext,
  writtenLines: Big,
  lead: XCell[],
): XCell[] | null {
  if (!entry.counted) return null;
  const monto = entryAmount(entry, ctx.mode);
  if (monto === null) return null;
  const difference = sum([roundedCents(monto), writtenLines.neg()]);
  if (difference.eq(ZERO)) return null;
  const supplierCategory = ctx.resolver.supplierCategory(entry.supplierRfc);
  return [
    ...lead,
    textCell(es.export.roundingLine),
    emptyCell(),
    emptyCell(),
    emptyCell(),
    emptyCell(),
    moneyCell(difference),
    emptyCell(),
    emptyCell(),
    emptyCell(),
    emptyCell(),
    textCell(ctx.nameOf(supplierCategory)),
    textCell(supplierCategory === SIN_CATEGORIA ? es.export.origin.ninguna : es.export.origin.proveedor),
  ];
}
