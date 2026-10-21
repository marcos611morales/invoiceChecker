import Big from "big.js";
import {
  constructSortFn,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import { entryAmount } from "@/domain/accounting/aggregate";
import type { IvaMode } from "@/domain/accounting/aggregate";
import { conceptAmounts, iepsOf } from "@/domain/accounting/amounts";
import type { ScopedEntry } from "@/domain/accounting/categories";
import { ZERO, parseDecimal, sum, toMoneyString } from "@/domain/accounting/decimal";
import type { EntryKind, LedgerEntry } from "@/domain/accounting/ledger";
import { rowState } from "@/domain/accounting/status";
import type { RowState } from "@/domain/accounting/status";
import { normalizeDescription } from "@/domain/settings/normalize";
import type { CategorySource, Resolver } from "@/domain/settings/resolver";
import { es } from "@/lib/copy/es";
import {
  formaPagoLabel,
  formatExchangeRate,
  formatQuantity,
} from "@/lib/format";

export type { RowState };

/**
 * One display row of the Facturas table (D-24), built from a ledger entry.
 * `amount` is `undefined` (not null) when the entry has none so that
 * `sortUndefined: "last"` applies, and so does a missing folio.
 */
export interface InvoiceRow {
  id: string;
  entry: LedgerEntry;
  /** Literal CFDI `Fecha` (ISO, no zone); sorted as a string. */
  fecha: string;
  proveedor: string;
  folio: string | undefined;
  /** SAT names of the formas de pago joined with ", " ("" when none). */
  formasText: string;
  tipoLabel: string;
  /** Signed MXN amount of the active IVA mode; undefined when the entry has none. */
  amount: Big | undefined;
  /**
   * Signed MXN amount of the whole invoice in the active mode, set only for a row built from a
   * category-scoped entry whose full amount exists. Under a category filter `amount` is the part
   * of the chosen categories and this is the total shown under it (D-14).
   */
  fullAmount: Big | undefined;
  state: RowState;
}

/** Spanish name of an entry kind; the Excel «Tipo» column reads the same text. */
export function kindLabel(kind: EntryKind): string {
  switch (kind) {
    case "ingreso":
      return es.invoices.kinds.ingreso;
    case "nota-credito":
      return es.invoices.kinds.notaCredito;
    case "pago":
      return es.invoices.kinds.pago;
    case "traslado":
      return es.invoices.kinds.traslado;
    case "nomina":
      return es.invoices.kinds.nomina;
  }
}

/** True for an entry that went through `scopeToCategories` and so carries its full amounts apart. */
function isScoped(entry: LedgerEntry): entry is ScopedEntry {
  return "fullConIva" in entry && "fullSinIva" in entry && "parts" in entry;
}

/**
 * The entry with its whole-invoice amounts. A category-scoped entry holds only the part of the
 * chosen categories in `conIva`/`sinIva`; anything that explains the invoice itself (the rounding
 * difference of the concept panel) must read the full amounts, so it is the same with or without
 * the category filter (D-14). An entry that was never scoped is returned as it is.
 */
export function withFullAmounts(entry: LedgerEntry): LedgerEntry {
  if (!isScoped(entry)) return entry;
  return { ...entry, conIva: entry.fullConIva, sinIva: entry.fullSinIva };
}

/**
 * Maps every ledger entry, counted or not, to a display row (D-27). Scoped entries (the
 * category filter) are accepted: `amount` then follows their partial amounts and `fullAmount`
 * their whole-invoice amounts.
 */
export function toInvoiceRows(
  entries: readonly LedgerEntry[],
  mode: IvaMode,
): InvoiceRow[] {
  return entries.map((entry) => ({
    id: entry.uuid,
    entry,
    fecha: entry.invoice.fecha,
    proveedor: entry.supplierName,
    folio:
      entry.invoice.folio === null || entry.invoice.folio === ""
        ? undefined
        : entry.invoice.folio,
    formasText: entry.formas.map(formaPagoLabel).join(", "),
    tipoLabel: kindLabel(entry.kind),
    amount: entryAmount(entry, mode) ?? undefined,
    fullAmount: isScoped(entry) ? (entryAmount(withFullAmounts(entry), mode) ?? undefined) : undefined,
    state: rowState(entry),
  }));
}

/** One concept of the expanded panel, already converted to MXN (D-25, D-38). */
export interface ConceptRow {
  key: string;
  descripcion: string;
  /** Quantity text with trailing zeros trimmed. */
  cantidad: string;
  /** Unidad text, else the ClaveUnidad; "" when neither is stated. */
  unidad: string;
  unidadIsClave: boolean;
  /** ValorUnitario in MXN, unsigned. */
  precioUnitario: Big | null;
  /** Amount of the active mode, signed like the invoice; null when unusable. */
  monto: Big | null;
  /** Category id of the line (rule, then product, then supplier), or the reserved «Sin categoría» key (D-09, D-11). */
  category: string;
  /** Where that category came from: a rule of the line, its product, its supplier, or nothing. */
  source: CategorySource;
  /** Name of the product that gives the category, only when `source` is "producto" (D-16). */
  productName: string | null;
  /** Normalized description: the key of the rule that a change on this line stores (D-10). */
  ruleKey: string;
}

/** Concepts of an entry in the active IVA mode, with the category each line resolves to (D-25, D-11). Keys are index based and stable. */
export function conceptRows(
  entry: LedgerEntry,
  mode: IvaMode,
  resolver: Resolver,
): ConceptRow[] {
  return entry.invoice.conceptos.map((concepto, index) => {
    const amounts = conceptAmounts(concepto, entry.invoice);
    const unidadText = concepto.unidad === null ? "" : concepto.unidad.trim();
    const unidadIsClave = unidadText === "";
    const { category, source, product } = resolver.explain(entry.supplierRfc, concepto.descripcion);
    return {
      key: String(index),
      descripcion: concepto.descripcion,
      cantidad: formatQuantity(concepto.cantidad),
      unidad: unidadIsClave ? concepto.claveUnidad : unidadText,
      unidadIsClave,
      precioUnitario: amounts.precioUnitario,
      monto: mode === "con" ? amounts.conIva : amounts.sinIva,
      category,
      source,
      productName: source === "producto" && product !== null ? product.name : null,
      ruleKey: normalizeDescription(concepto.descripcion),
    };
  });
}

/**
 * Invoice amount minus the concept sum, both rounded to cents, when they
 * differ; null otherwise or when either side cannot be computed. The invoice
 * amount governs; this only explains the gap (D-25).
 */
export function roundingDifference(
  entry: LedgerEntry,
  mode: IvaMode,
): Big | null {
  const invoiceAmount = entryAmount(entry, mode);
  if (invoiceAmount === null) return null;
  if (entry.invoice.conceptos.length === 0) return null;
  const montos: Big[] = [];
  for (const concepto of entry.invoice.conceptos) {
    const amounts = conceptAmounts(concepto, entry.invoice);
    const monto = mode === "con" ? amounts.conIva : amounts.sinIva;
    if (monto === null) return null;
    montos.push(monto);
  }
  const rounded = parseDecimal(toMoneyString(invoiceAmount));
  const conceptSum = parseDecimal(toMoneyString(sum(montos)));
  if (rounded === null || conceptSum === null || rounded.eq(conceptSum)) {
    return null;
  }
  return rounded.minus(conceptSum);
}

/** Original currency data of a foreign currency invoice (D-10). */
export interface ForeignInfo {
  moneda: string;
  /** Original amount of the active mode, unsigned, 2 decimals. */
  amountText: string;
  /** Exchange rate text, or null when the invoice has no usable TipoCambio. */
  tc: string | null;
}

/** Original amount of the active IVA mode, unsigned; null when a value is damaged. */
function originalAmount(entry: LedgerEntry, mode: IvaMode): Big | null {
  const { invoice } = entry;
  if (mode === "con") return parseDecimal(invoice.total);
  const subTotal = parseDecimal(invoice.subTotal);
  const ieps = iepsOf(invoice);
  if (subTotal === null || ieps === null) return null;
  let descuento = ZERO;
  if (invoice.descuento !== null) {
    const parsed = parseDecimal(invoice.descuento);
    if (parsed === null) return null;
    descuento = parsed;
  }
  return subTotal.minus(descuento).plus(ieps);
}

/**
 * Foreign currency line data for an Ingreso or credit note not in MXN; null
 * for MXN, for the Pago currency XXX and for other kinds. The original amount
 * follows the active IVA mode so that amount times TC equals the MXN amount
 * shown (assumption A-1), and it is unsigned even for credit notes.
 */
export function foreignInfo(entry: LedgerEntry, mode: IvaMode): ForeignInfo | null {
  if (entry.kind !== "ingreso" && entry.kind !== "nota-credito") return null;
  const { invoice } = entry;
  const currency = invoice.moneda.trim().toUpperCase();
  if (currency === "" || currency === "MXN" || currency === "XXX") return null;
  const original = originalAmount(entry, mode);
  if (original === null) return null;
  const rate = parseDecimal(invoice.tipoCambio);
  return {
    moneda: invoice.moneda.trim(),
    amountText: toMoneyString(original),
    tc: rate === null || rate.lte(ZERO) ? null : formatExchangeRate(rate),
  };
}

/** One payment that settles an invoice, from a loaded Pago complement (REGLA-09). */
export interface PaymentInfo {
  fechaPago: string;
  formaDePagoP: string;
}

/** Paid invoice uuid -> every Pago docto that references it, across all Pago entries. */
export function buildPaymentIndex(
  ledger: readonly LedgerEntry[],
): Map<string, PaymentInfo[]> {
  const index = new Map<string, PaymentInfo[]>();
  for (const entry of ledger) {
    if (entry.kind !== "pago") continue;
    for (const pago of entry.invoice.pagos) {
      for (const docto of pago.doctos) {
        const info: PaymentInfo = {
          fechaPago: pago.fechaPago,
          formaDePagoP: pago.formaDePagoP,
        };
        const known = index.get(docto.idDocumento);
        if (known === undefined) index.set(docto.idDocumento, [info]);
        else known.push(info);
      }
    }
  }
  return index;
}

// Module scope on purpose: stable references keep TanStack from re-running the
// row models on every render (Pitfall 9).
const collator = new Intl.Collator("es", { sensitivity: "base" });

/** Spanish-collated text order (accents and case ignored). */
const sortFn_es = constructSortFn({
  resolveDataValue: (value: unknown) => String(value ?? ""),
  sort: (a: unknown, b: unknown) => collator.compare(String(a), String(b)),
});

/**
 * Exact decimal order. The basic sort compares with `<` and `>` and throws on a
 * Big under strict mode (Pitfall 1), so Big values are only ever compared with
 * their `cmp` method. `undefined` never reaches this function: the column sets
 * `sortUndefined: "last"`.
 */
const sortFn_money = constructSortFn({
  sort: (a: unknown, b: unknown) => (a instanceof Big && b instanceof Big ? a.cmp(b) : 0),
});

/** Sorting (D-24) and 50-row client-side pagination. */
export const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { text: sortFn_text, es: sortFn_es, money: sortFn_money },
});

const helper = createColumnHelper<typeof features, InvoiceRow>();

/**
 * Data columns. The chevron and the actions columns are display-only and live
 * in the component, around these.
 */
export const columns = helper.columns([
  helper.accessor("fecha", {
    id: "fecha",
    header: es.invoices.columns.date,
    sortFn: "text",
  }),
  helper.accessor("proveedor", {
    id: "proveedor",
    header: es.invoices.columns.supplier,
    sortFn: "es",
  }),
  helper.accessor("folio", {
    id: "folio",
    header: es.invoices.columns.folio,
    sortFn: "text",
    sortUndefined: "last",
  }),
  helper.accessor("formasText", {
    id: "formasText",
    header: es.invoices.columns.forma,
    sortFn: "es",
  }),
  helper.accessor("tipoLabel", {
    id: "tipoLabel",
    header: es.invoices.columns.type,
    sortFn: "es",
  }),
  helper.accessor("amount", {
    id: "amount",
    header: es.invoices.columns.amount,
    sortFn: "money",
    sortUndefined: "last",
  }),
]);
