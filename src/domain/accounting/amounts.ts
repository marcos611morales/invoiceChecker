/**
 * Per-invoice and per-concept amounts in MXN (REGLA-03, REGLA-04, REGLA-07).
 * Pure: every amount is parsed from the exact XML string through
 * `parseDecimal`, so a damaged attribute becomes a typed failure instead of an
 * exception (D-35). Nothing here rounds, and nothing goes through a
 * floating-point number; rounding is display-only (`toMoneyString`).
 *
 * - Con IVA is the invoice Total; Sin IVA is SubTotal - Descuento + IEPS, with
 *   the IEPS read from the invoice-level Traslados with Impuesto "003" (D-36).
 * - MXN never consults TipoCambio. Any other currency needs a TipoCambio that
 *   is a decimal greater than zero; otherwise the invoice does not sum and no
 *   rate is ever invented (D-10).
 * - Egreso amounts are negative (REGLA-01).
 */
import type Big from "big.js";
import type { Concepto, Impuesto, ParsedInvoice } from "../cfdi/types";
import { ZERO, parseDecimal } from "./decimal";

/** XML attribute that made an invoice unusable (the closed list reported to the user). */
export type AmountField = "Total" | "SubTotal" | "Descuento" | "Importe";

export interface InvoiceAmounts {
  /** Total in MXN, signed (negative for Egreso). */
  conIva: Big;
  /** SubTotal - Descuento + IEPS in MXN, signed (negative for Egreso). */
  sinIva: Big;
  /** Unsigned converted Total, used by the $0 rule. */
  totalMxn: Big;
}

export type AmountResult =
  | { ok: true; amounts: InvoiceAmounts }
  | { ok: false; reason: "moneda-sin-tc" }
  | { ok: false; reason: "invalido"; field: AmountField };

/** Amounts of one concept in MXN; null when the data or the rate is unusable. */
export interface ConceptAmounts {
  /** ValorUnitario in MXN, unsigned. */
  precioUnitario: Big | null;
  /** importe - descuento + traslados - retenciones, signed like the invoice. */
  conIva: Big | null;
  /** importe - descuento + the concept's IEPS, signed like the invoice. */
  sinIva: Big | null;
}

const IEPS_IMPUESTO = "003";
const ONE = ZERO.plus("1");

/**
 * Exchange rate to MXN: one for MXN (TipoCambio is ignored), the invoice's own
 * TipoCambio for any other currency, null when that rate is missing, not a
 * decimal, zero or negative.
 */
function exchangeRate(invoice: ParsedInvoice): Big | null {
  if (invoice.moneda === "MXN") return ONE;
  const rate = parseDecimal(invoice.tipoCambio);
  if (rate === null || rate.lte(ZERO)) return null;
  return rate;
}

/**
 * Sum of the Importe of some taxes. An absent Importe (Exento) counts as zero;
 * one that is not a decimal makes the whole sum null.
 */
function sumImportes(taxes: readonly Impuesto[]): Big | null {
  let total = ZERO;
  for (const tax of taxes) {
    if (tax.importe === null) continue;
    const importe = parseDecimal(tax.importe);
    if (importe === null) return null;
    total = total.plus(importe);
  }
  return total;
}

/** IEPS of the invoice (D-36); null when an IEPS Importe is not a valid decimal. */
export function iepsOf(invoice: ParsedInvoice): Big | null {
  return sumImportes(
    invoice.impuestos.traslados.filter((t) => t.impuesto === IEPS_IMPUESTO),
  );
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
  const ieps = iepsOf(invoice);
  if (ieps === null) return { ok: false, reason: "invalido", field: "Importe" };

  const rate = exchangeRate(invoice);
  if (rate === null) return { ok: false, reason: "moneda-sin-tc" };

  const factor = invoice.tipo === "E" ? rate.neg() : rate;
  return {
    ok: true,
    amounts: {
      conIva: total.times(factor),
      sinIva: subTotal.minus(descuento).plus(ieps).times(factor),
      totalMxn: total.times(rate),
    },
  };
}

const UNUSABLE: ConceptAmounts = { precioUnitario: null, conIva: null, sinIva: null };

/**
 * Amounts of one concept (D-25, D-38), converted and signed like its invoice.
 * A concept whose importe is not a decimal, or whose invoice has no usable
 * exchange rate, is unusable: all fields null. Other damaged values only null
 * the fields that depend on them.
 */
export function conceptAmounts(concepto: Concepto, invoice: ParsedInvoice): ConceptAmounts {
  const rate = exchangeRate(invoice);
  if (rate === null) return UNUSABLE;
  const importe = parseDecimal(concepto.importe);
  if (importe === null) return UNUSABLE;

  const valorUnitario = parseDecimal(concepto.valorUnitario);
  const precioUnitario = valorUnitario === null ? null : valorUnitario.times(rate);

  let descuento = ZERO;
  if (concepto.descuento !== null) {
    const parsed = parseDecimal(concepto.descuento);
    if (parsed === null) return { precioUnitario, conIva: null, sinIva: null };
    descuento = parsed;
  }

  const factor = invoice.tipo === "E" ? rate.neg() : rate;
  const net = importe.minus(descuento);

  const ieps = sumImportes(
    concepto.traslados.filter((t) => t.impuesto === IEPS_IMPUESTO),
  );
  const sinIva = ieps === null ? null : net.plus(ieps).times(factor);

  const traslados = sumImportes(concepto.traslados);
  const retenciones = sumImportes(concepto.retenciones);
  const conIva =
    traslados === null || retenciones === null
      ? null
      : net.plus(traslados).minus(retenciones).times(factor);

  return { precioUnitario, conIva, sinIva };
}
