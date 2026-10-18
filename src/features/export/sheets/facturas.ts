/**
 * «Facturas» (D-20 to D-22): every invoice of the current filters, including those that do not
 * sum, one row each. Monto is the amount of the chosen IVA mode for the rows that sum and zero
 * for the rest, so the column adds up to the Dashboard figure; Estado says why a row does not
 * sum. Under a category filter Monto is the part of the chosen categories and a column with
 * the whole invoice follows it (D-21). The Subtotal to Total columns are the XML values
 * converted to MXN, unsigned (UI-SPEC Q7a); Moneda and Tipo de cambio say how.
 *
 * Every RFC, UUID, folio and name is a text cell: it is never evaluated as a formula and never
 * turned into a number (XLS-03, T-03-27, T-03-28).
 */
import type Big from "big.js";
import { entryAmount, type IvaMode } from "@/domain/accounting/aggregate";
import { invoiceBreakdown } from "@/domain/accounting/breakdown";
import type { ScopedEntry } from "@/domain/accounting/categories";
import { ZERO } from "@/domain/accounting/decimal";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { entryStatus, type EntryStatus } from "@/domain/accounting/status";
import type { DashboardView } from "@/domain/accounting/view";
import { es } from "@/lib/copy/es";
import { formaPagoLabel } from "@/lib/format";
import { kindLabel } from "@/features/invoices/columns";
import {
  dateCell,
  emptyCell,
  moneyCell,
  rateCell,
  textCell,
  type SheetColumn,
  type SheetModel,
  type XCell,
} from "../cellModel";
import { amountHeader, type WorkbookContext } from "../workbook";

const WIDTH = {
  date: 12,
  supplier: 36,
  rfc: 16,
  folio: 14,
  uuid: 38,
  type: 16,
  status: 34,
  forma: 32,
  money: 16,
  currency: 12,
  rate: 12,
} as const;

/** Plain text order, enough for the fixed CFDI Fecha shape and folios. */
function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function folioOf(entry: LedgerEntry): string | null {
  const { folio } = entry.invoice;
  return folio === null || folio === "" ? null : folio;
}

/**
 * The order of both detail sheets: the literal Fecha ascending, then the folio, with an empty
 * folio last. A copy is returned and the sort is stable, so equal rows keep the ledger order.
 */
export function sortEntriesForExport<T extends LedgerEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const byFecha = compareText(a.invoice.fecha, b.invoice.fecha);
    if (byFecha !== 0) return byFecha;
    const folioA = folioOf(a);
    const folioB = folioOf(b);
    if (folioA === null && folioB === null) return 0;
    if (folioA === null) return 1;
    if (folioB === null) return -1;
    return compareText(folioA, folioB);
  });
}

/** The columns Fecha to UUID that both detail sheets start with. */
export function identityColumns(): SheetColumn[] {
  return [
    { header: es.export.columns.date, width: WIDTH.date },
    { header: es.export.columns.supplier, width: WIDTH.supplier },
    { header: es.export.columns.rfc, width: WIDTH.rfc },
    { header: es.export.columns.folio, width: WIDTH.folio },
    { header: es.export.columns.uuid, width: WIDTH.uuid },
  ];
}

/** Fecha, Proveedor, RFC emisor, Folio and UUID of an entry; names and codes are text cells. */
export function identityCells(entry: LedgerEntry): XCell[] {
  const folio = folioOf(entry);
  return [
    dateCell(entry.invoice.fecha),
    textCell(entry.supplierName),
    textCell(entry.supplierRfc),
    folio === null ? emptyCell() : textCell(folio),
    textCell(entry.uuid),
  ];
}

const STATUS_TEXT: Record<EntryStatus, string> = {
  suma: es.export.status.suma,
  pago: es.export.status.pago,
  traslado: es.export.status.traslado,
  nomina: es.export.status.nomina,
  cero: es.export.status.cero,
  "moneda-sin-tc": es.export.status.monedaSinTc,
  invalido: es.export.status.invalido,
  excluida: es.export.status.excluida,
  sustituida: es.export.status.sustituida,
};

/** The Estado cell of an entry, from the same function as the table (D-20). */
export function estadoCell(entry: LedgerEntry): XCell {
  return textCell(STATUS_TEXT[entryStatus(entry)]);
}

/** A breakdown figure, empty when the invoice states none or its rate is unusable. */
export function optionalMoney(value: Big | null): XCell {
  return value === null ? emptyCell() : moneyCell(value);
}

/** The whole-invoice amount of a counted row; zero for a row that does not sum. */
function fullAmountOf(entry: ScopedEntry, mode: IvaMode): Big {
  if (!entry.counted) return ZERO;
  return (mode === "con" ? entry.fullConIva : entry.fullSinIva) ?? ZERO;
}

export function buildFacturas(view: DashboardView, ctx: WorkbookContext): SheetModel {
  const scoped = view.selected.size > 0;
  const money = (header: string): SheetColumn => ({ header, width: WIDTH.money });
  const columns: SheetColumn[] = [
    ...identityColumns(),
    { header: es.export.columns.type, width: WIDTH.type },
    { header: es.export.columns.status, width: WIDTH.status },
    { header: es.export.columns.forma, width: WIDTH.forma },
    money(amountHeader(ctx.mode)),
    ...(scoped
      ? [
          money(
            ctx.mode === "con"
              ? es.export.columns.fullAmountCon
              : es.export.columns.fullAmountSin,
          ),
        ]
      : []),
    money(es.export.columns.subtotal),
    money(es.export.columns.discount),
    money(es.export.columns.iva),
    money(es.export.columns.ieps),
    money(es.export.columns.total),
    { header: es.export.columns.currency, width: WIDTH.currency },
    { header: es.export.columns.exchangeRate, width: WIDTH.rate },
  ];

  const rows: XCell[][] = sortEntriesForExport(view.visible).map((entry) => {
    const breakdown = invoiceBreakdown(entry.invoice);
    const monto = entry.counted ? (entryAmount(entry, ctx.mode) ?? ZERO) : ZERO;
    return [
      ...identityCells(entry),
      textCell(kindLabel(entry.kind)),
      estadoCell(entry),
      textCell(entry.formas.map(formaPagoLabel).join(", ")),
      moneyCell(monto),
      ...(scoped ? [moneyCell(fullAmountOf(entry, ctx.mode))] : []),
      optionalMoney(breakdown.subtotal),
      optionalMoney(breakdown.descuento),
      optionalMoney(breakdown.iva),
      optionalMoney(breakdown.ieps),
      optionalMoney(breakdown.total),
      textCell(entry.invoice.moneda),
      breakdown.rate === null ? emptyCell() : rateCell(breakdown.rate),
    ];
  });

  return { name: es.export.sheets.facturas, columns, rows, totalRow: null };
}
