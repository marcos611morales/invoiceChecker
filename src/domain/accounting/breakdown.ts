/**
 * The XML reference amounts of an invoice and of a concept for the Excel detail sheets
 * (UI-SPEC Q7a). Every value is the XML value converted to MXN with the invoice's own
 * TipoCambio, and unsigned: a credit note keeps the positive figures of its XML (only the
 * Monto column carries the sign). The rate rule is the one of `amounts.ts`: one for MXN,
 * the invoice's TipoCambio when it is a decimal above zero, otherwise every value is null
 * and no rate is invented. IVA is the Traslados with Impuesto "002" and IEPS those with
 * "003" (assumption A-2). Pure, exact, never throws.
 */
import type Big from "big.js";
import type { Concepto, Impuesto, ParsedInvoice } from "../cfdi/types";
import { exchangeRate, sumImportes } from "./amounts";
import { parseDecimal } from "./decimal";

const IVA_IMPUESTO = "002";
const IEPS_IMPUESTO = "003";

/** Invoice-level XML amounts in MXN; `rate` is null for MXN and for an unusable rate. */
export interface InvoiceBreakdown {
  subtotal: Big | null;
  /** Null when the invoice states no Descuento (or a damaged one). */
  descuento: Big | null;
  iva: Big | null;
  ieps: Big | null;
  total: Big | null;
  /** The TipoCambio applied; null for an MXN invoice and when it is unusable. */
  rate: Big | null;
}

/** Concept-level XML amounts in MXN. */
export interface ConceptBreakdown {
  importe: Big | null;
  descuento: Big | null;
  iva: Big | null;
  ieps: Big | null;
}

function taxesOf(taxes: readonly Impuesto[], impuesto: string): Big | null {
  return sumImportes(taxes.filter((t) => t.impuesto === impuesto));
}

function scaled(value: Big | null, rate: Big): Big | null {
  return value === null ? null : value.times(rate);
}

/** An optional XML decimal: absent or damaged is null, otherwise the converted value. */
function optional(raw: string | null, rate: Big): Big | null {
  return scaled(parseDecimal(raw), rate);
}

export function invoiceBreakdown(invoice: ParsedInvoice): InvoiceBreakdown {
  const rate = exchangeRate(invoice);
  if (rate === null) {
    return { subtotal: null, descuento: null, iva: null, ieps: null, total: null, rate: null };
  }
  const { traslados } = invoice.impuestos;
  return {
    subtotal: optional(invoice.subTotal, rate),
    descuento: optional(invoice.descuento, rate),
    iva: scaled(taxesOf(traslados, IVA_IMPUESTO), rate),
    ieps: scaled(taxesOf(traslados, IEPS_IMPUESTO), rate),
    total: optional(invoice.total, rate),
    rate: invoice.moneda === "MXN" ? null : rate,
  };
}

export function conceptBreakdown(concepto: Concepto, invoice: ParsedInvoice): ConceptBreakdown {
  const rate = exchangeRate(invoice);
  if (rate === null) return { importe: null, descuento: null, iva: null, ieps: null };
  return {
    importe: optional(concepto.importe, rate),
    descuento: optional(concepto.descuento, rate),
    iva: scaled(taxesOf(concepto.traslados, IVA_IMPUESTO), rate),
    ieps: scaled(taxesOf(concepto.traslados, IEPS_IMPUESTO), rate),
  };
}
