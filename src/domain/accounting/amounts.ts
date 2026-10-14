/**
 * Per-invoice amounts in MXN (REGLA-01, REGLA-03). Pure: parses the exact XML
 * strings through `parseDecimal`, so a damaged attribute becomes a typed failure
 * instead of an exception (D-35). Foreign currency and the IEPS term arrive in
 * Plan 02-03.
 */
import type Big from "big.js";
import type { Concepto, ParsedInvoice } from "../cfdi/types";
import { ZERO, parseDecimal } from "./decimal";

export type AmountField = "Total" | "SubTotal" | "Descuento" | "Importe";

export interface InvoiceAmounts {
  /** Total, signed (negative for Egreso). */
  conIva: Big;
  /** SubTotal minus Descuento, signed (negative for Egreso). */
  sinIva: Big;
  /** Unsigned converted Total, used by the $0 rule. */
  totalMxn: Big;
}

export type AmountResult =
  | { ok: true; amounts: InvoiceAmounts }
  | { ok: false; reason: "moneda-sin-tc" }
  | { ok: false; reason: "invalido"; field: AmountField };

// RED stubs: replaced by the implementation in the GREEN commit.
export interface ConceptAmounts {
  precioUnitario: Big | null;
  conIva: Big | null;
  sinIva: Big | null;
}
export function iepsOf(_invoice: ParsedInvoice): Big | null {
  return null;
}
export function conceptAmounts(_concepto: Concepto, _invoice: ParsedInvoice): ConceptAmounts {
  return { precioUnitario: null, conIva: null, sinIva: null };
}

export function invoiceAmounts(invoice: ParsedInvoice): AmountResult {
  const total = parseDecimal(invoice.total);
  if (total === null) return { ok: false, reason: "invalido", field: "Total" };
  const subTotal = parseDecimal(invoice.subTotal);
  if (subTotal === null) {
    return { ok: false, reason: "invalido", field: "SubTotal" };
  }
  // An absent Descuento counts as zero; a present but damaged one is invalid.
  let descuento = ZERO;
  if (invoice.descuento !== null) {
    const parsed = parseDecimal(invoice.descuento);
    if (parsed === null) {
      return { ok: false, reason: "invalido", field: "Descuento" };
    }
    descuento = parsed;
  }
  if (invoice.moneda !== "MXN") return { ok: false, reason: "moneda-sin-tc" };

  const sinIva = subTotal.minus(descuento);
  const negative = invoice.tipo === "E";
  return {
    ok: true,
    amounts: {
      conIva: negative ? total.neg() : total,
      sinIva: negative ? sinIva.neg() : sinIva,
      totalMxn: total,
    },
  };
}
