/**
 * es-MX value formatting (dates, money, folios).
 *
 * No Spanish sentences live here (see `messages.ts`/`es.ts`). `formatTotal`
 * formats one XML amount as stated; `formatMoney` formats an already computed
 * exact decimal (the one shared money formatter of Phase 2, D-26). Nothing here
 * adds amounts together: sums live in `src/domain/accounting`.
 */
import type Big from "big.js";
import { toMoneyString } from "@/domain/accounting/decimal";

const MISSING_VALUE = "—";

/** True minus sign (U+2212) used for negative amounts (UI-SPEC, D-26). */
const TRUE_MINUS = "−";

const MONEY_STRING = /^-?\d+(\.\d+)?$/;

/** Narrows a decimal string to the literal type `Intl.NumberFormat` accepts. */
function isNumericLiteral(text: string): text is `${number}` {
  return MONEY_STRING.test(text);
}

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * `dd/mm/yyyy` from the literal CFDI `Fecha` (D-23). The date part is sliced out
 * of the string, never parsed through a Date object, so no time zone can shift
 * the day. A malformed value is returned unchanged.
 */
export function formatFechaIso(iso: string): string {
  const match = ISO_DATE_PREFIX.exec(iso);
  if (match === null) return iso;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * The XML total in es-MX with the XML currency. "—" for currency XXX (Pago,
 * Pitfall 11); an unknown currency code or a non-numeric amount falls back to
 * the raw amount followed by the code instead of throwing.
 */
export function formatTotal(total: string, moneda: string): string {
  const currency = moneda.trim().toUpperCase();
  if (currency === "XXX") return MISSING_VALUE;
  const amount = Number(total);
  if (total.trim() === "" || !Number.isFinite(amount)) {
    return `${total} ${moneda}`.trim();
  }
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${total} ${moneda}`.trim();
  }
}

/**
 * An exact MXN amount as `$1,234.50`, rounded half-up to 2 decimals only here
 * (REGLA-04), never "-$0.00", with the true minus sign for negatives (D-26).
 * The decimal string goes to Intl as a string, so no float is involved.
 */
export function formatMoney(value: Big): string {
  const decimal = toMoneyString(value);
  let text = decimal;
  if (isNumericLiteral(decimal)) {
    try {
      text = new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(decimal);
    } catch {
      text = decimal;
    }
  }
  return text.startsWith("-") ? `${TRUE_MINUS}${text.slice(1)}` : text;
}

/** Folio as the XML states it, "—" when the attribute is absent. */
export function formatFolio(folio: string | null): string {
  return folio === null || folio === "" ? MISSING_VALUE : folio;
}
