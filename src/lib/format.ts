/**
 * es-MX value formatting for the invoice table (dates, money, folios).
 *
 * No Spanish sentences live here (see `messages.ts`/`es.ts`). Amounts are only
 * formatted one by one as each XML states them; nothing here adds them together
 * (D-22).
 */

const MISSING_VALUE = "—";

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

/** Folio as the XML states it, "—" when the attribute is absent. */
export function formatFolio(folio: string | null): string {
  return folio === null || folio === "" ? MISSING_VALUE : folio;
}
