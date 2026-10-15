/**
 * Exact decimal arithmetic for money (REGLA-04).
 *
 * `Big.strict = true` is set in this file only. In strict mode big.js rejects
 * numbers and `valueOf`, so a float can never slip into a sum: construct only
 * from strings, compare with `.cmp/.eq/.gt/.lt`, print with `.toString()`.
 * Rounding happens only when an amount is displayed (`toMoneyString`).
 */
import Big from "big.js";

Big.strict = true;
Big.DP = 20; // division precision (only averages and percentages divide)
Big.RM = Big.roundHalfUp;
// Plain notation from toString for every magnitude this layer can reach.
Big.PE = 1000;
Big.NE = -1000;

/** Optional minus, 1 to 18 integer digits, 0 to 12 decimals, no exponent (T-02-01). */
const DECIMAL_RE = /^-?\d{1,18}(\.\d{1,12})?$/;

export const ZERO = new Big("0");

/**
 * Exact XML decimal to `Big`. Returns null for null, empty or junk input
 * (letters, exponents, too many digits); it never throws.
 */
export function parseDecimal(raw: string | null): Big | null {
  if (raw === null) return null;
  const text = raw.trim();
  return DECIMAL_RE.test(text) ? new Big(text) : null;
}

export function sum(values: Iterable<Big>): Big {
  let total = ZERO;
  for (const value of values) total = total.plus(value);
  return total;
}

/**
 * Exact decimal of a safe integer such as a count of invoices or months. Strict
 * Big rejects numbers, so it is built from the integer's decimal string; any
 * other input (fraction, NaN, infinity, beyond 2^53) gives ZERO.
 */
export function fromInteger(n: number): Big {
  return Number.isSafeInteger(n) ? new Big(String(n)) : ZERO;
}

/**
 * Display string such as "1234.50": half-up, 2 decimals, and any zero prints as
 * "0.00" (never "-0.00"). Feed this string to `Intl`, never a number.
 */
export function toMoneyString(value: Big): string {
  const rounded = value.round(2, Big.roundHalfUp);
  if (rounded.eq(ZERO)) return "0.00";
  // toString keeps the exact digits; pad to two decimals by hand so no
  // fixed-point float formatter is involved anywhere in the accounting layer.
  const [integer = "0", fraction = ""] = rounded.toString().split(".");
  return `${integer}.${fraction.padEnd(2, "0")}`;
}
