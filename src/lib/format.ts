/**
 * es-MX value formatting (dates, months, money, folios, labels).
 *
 * No Spanish sentences live here (see `messages.ts`/`es.ts`). `formatTotal`
 * formats one XML amount as stated; `formatMoney` formats an already computed
 * exact decimal (the one shared money formatter of Phase 2, D-26). Month names
 * come from static Spanish arrays and string slicing, never from a Date object
 * (REGLA-05). Nothing here adds amounts together: sums live in
 * `src/domain/accounting`.
 */
import Big from "big.js";
import { ZERO, parseDecimal, toMoneyString } from "@/domain/accounting/decimal";
import { PPD_SIN_COMPLEMENTO } from "@/domain/accounting/ledger";
import type { MonthKey } from "@/domain/accounting/months";
import { formaPagoName } from "@/domain/cfdi/catalogs";
import type { UnitFamily } from "@/domain/prices/units";
import type { ContentCorrection } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";

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

/**
 * A unit price of the Precios tab as «$50.00 / kg», «$50.00 / L» or «$50.00 / pieza». The exact
 * price is rounded half-up to 2 decimals here and nowhere else (REGLA-04).
 */
export function unitPriceText(price: Big, family: UnitFamily): string {
  return `${formatMoney(price)} / ${es.prices.units[family]}`;
}

/**
 * A total content of a purchase as «0.375 kg», «24 L», «6 piezas» or «1 pieza»: up to three
 * decimals, trailing zeros trimmed, rounded half-up here and nowhere else (REGLA-04).
 */
export function formatContent(amount: Big, family: UnitFamily): string {
  const rounded = amount.round(3, Big.roundHalfUp);
  const text = rounded.eq(ZERO) ? "0" : rounded.toFixed();
  if (family === "piece") {
    return `${text} ${rounded.eq("1") ? es.prices.units.piece : es.prices.detail.piecesPlural}`;
  }
  return `${text} ${es.prices.units[family]}`;
}

/**
 * A content the user typed as «12 × 1 L» (more than one piece per pack), «375 g» or «6 piezas»:
 * the typed amount without trailing zeros and the unit label. The text is for display only; the
 * stored correction keeps the amount as typed (D-14, D-15).
 */
export function formatCorrection(
  correction: Pick<ContentCorrection, "packs" | "amount" | "unit">,
): string {
  const parsed = parseDecimal(correction.amount);
  const amount = parsed === null ? correction.amount : parsed.toFixed();
  const labels = es.prices.detail.content.units;
  const unit =
    correction.unit === "piezas" ? (amount === "1" ? labels.pieza : labels.piezas) : labels[correction.unit];
  const content = `${amount} ${unit}`;
  return correction.packs > 1 ? `${String(correction.packs)} × ${content}` : content;
}

const SHORT_DATE = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Short es-MX date of the literal CFDI `Fecha`: «28 may 2025». The date parts are read from the
 * string and formatted as UTC, so no local time zone can shift the day (REGLA-05). A malformed
 * value is returned unchanged.
 */
export function shortDateLabel(fecha: string): string {
  const match = ISO_DATE_PREFIX.exec(fecha);
  if (match === null) return fecha;
  const [, year, month, day] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) return fecha;
  return SHORT_DATE.format(new Date(Date.UTC(Number(year), monthNumber - 1, dayNumber)));
}

/**
 * A concept quantity as a decimal without trailing zeros (D-25): "1.500000" gives
 * "1.5", "2.000000" gives "2". Rounds half-up to at most 6 decimals and never
 * prints an exponent. Text that is not a valid decimal is returned unchanged.
 */
export function formatQuantity(raw: string): string {
  const value = parseDecimal(raw);
  if (value === null) return raw;
  const rounded = value.round(6, Big.roundHalfUp);
  return rounded.eq(ZERO) ? "0" : rounded.toFixed();
}

/**
 * A unit price in MXN with 2 to 6 fraction digits, because ValorUnitario carries
 * up to 6 decimals (D-25). "—" when there is no price. The decimal string goes to
 * Intl as a string, so no float is involved.
 */
export function formatUnitPrice(value: Big | null): string {
  if (value === null) return MISSING_VALUE;
  const decimal = value.toFixed();
  let text = decimal;
  if (isNumericLiteral(decimal)) {
    try {
      text = new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(decimal);
    } catch {
      text = decimal;
    }
  }
  return text.startsWith("-") ? `${TRUE_MINUS}${text.slice(1)}` : text;
}

/**
 * An exchange rate (TipoCambio) as plain decimal text with at least 2 and at
 * most 6 decimals: "18.2" gives "18.20" (D-10). Rounds half-up only here.
 */
export function formatExchangeRate(value: Big): string {
  const [integer = "0", fraction = ""] = value.round(6, Big.roundHalfUp).toFixed().split(".");
  return `${integer}.${fraction.padEnd(2, "0")}`;
}

/** First 8 characters of a UUID, the short reference shown to the user. */
export function shortUuid(uuid: string): string {
  return uuid.slice(0, 8);
}

/** How an invoice is named in the interface: its folio, else the short UUID. */
export function invoiceRef(folio: string | null, uuid: string): string {
  return folio === null || folio === "" ? shortUuid(uuid) : folio;
}

/** Folio as the XML states it, "—" when the attribute is absent. */
export function formatFolio(folio: string | null): string {
  return folio === null || folio === "" ? MISSING_VALUE : folio;
}

const MONTHS_SHORT: readonly string[] = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const MONTHS_LONG: readonly string[] = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Year and zero-based month index of a YYYY-MM key, or null when malformed. */
function splitMonthKey(key: MonthKey): { year: string; index: number } | null {
  const match = MONTH_KEY.exec(key);
  if (match === null) return null;
  const [, year, month] = match;
  if (year === undefined || month === undefined) return null;
  return { year, index: Number(month) - 1 };
}

/** "ene" for "2025-01"; a malformed key is returned unchanged. */
export function monthShortLabel(key: MonthKey): string {
  const parts = splitMonthKey(key);
  if (parts === null) return key;
  return MONTHS_SHORT[parts.index] ?? key;
}

/** "ene 2025" for "2025-01"; a malformed key is returned unchanged. */
export function monthYearLabel(key: MonthKey): string {
  const parts = splitMonthKey(key);
  if (parts === null) return key;
  const name = MONTHS_SHORT[parts.index];
  return name === undefined ? key : `${name} ${parts.year}`;
}

/** "mayo 2025" for "2025-05"; a malformed key is returned unchanged. */
export function monthLongLabel(key: MonthKey): string {
  const parts = splitMonthKey(key);
  if (parts === null) return key;
  const name = MONTHS_LONG[parts.index];
  return name === undefined ? key : `${name} ${parts.year}`;
}

/** One month as its long label, otherwise "ene 2025 \u2013 dic 2025" (spaced en dash). */
export function rangeText(from: MonthKey, to: MonthKey): string {
  if (from === to) return monthLongLabel(from);
  return `${monthYearLabel(from)} \u2013 ${monthYearLabel(to)}`;
}

/**
 * Long es-MX date of the literal CFDI `Fecha`: «28 de mayo de 2025». Read from the string with the
 * static month names, so no local time zone can shift the day (REGLA-05). A malformed value is
 * returned unchanged.
 */
export function longDateLabel(fecha: string): string {
  const match = ISO_DATE_PREFIX.exec(fecha);
  if (match === null) return fecha;
  const [, year, month, day] = match;
  const monthNumber = Number(month);
  const dayOfMonth = Number(day);
  const name = MONTHS_LONG[monthNumber - 1];
  if (name === undefined || dayOfMonth < 1 || dayOfMonth > 31) return fecha;
  return `${String(dayOfMonth)} de ${name} de ${String(year)}`;
}

/**
 * Tick of the time axis of the price history: «may 2025» for a day number (days since 1970-01-01,
 * UTC). The day count is turned back into a UTC date, never a local one (REGLA-05).
 */
export function monthTickLabel(day: number): string {
  const date = new Date(day * 86_400_000);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return monthYearLabel(`${String(date.getUTCFullYear()).padStart(4, "0")}-${month}`);
}

/**
 * Label of a forma de pago code: the SAT catalog name, never the bare code
 * (D-14). An unknown code reads "Forma de pago {código}" and the PPD sentinel
 * reads "Por definir (sin complemento de pago)" (D-16).
 */
export function formaPagoLabel(code: string): string {
  if (code === PPD_SIN_COMPLEMENTO) return "Por definir (sin complemento de pago)";
  return formaPagoName(code) ?? `Forma de pago ${code}`;
}

/** Search key: lowercase, accents removed, trimmed (D-43). */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Fraction (0.124) as a percentage rounded half-up to one decimal; display-time only (REGLA-04). */
function roundedPercent(fraction: Big): Big {
  return fraction.times("100").round(1, Big.roundHalfUp);
}

/**
 * A fraction as a percent with a space: 0.124 gives "12.4 %" (D-40). Rounds
 * half-up to one decimal here and nowhere else, uses the true minus sign for
 * negatives and prints "0.0 %" for anything that rounds to zero. Composed by
 * hand because `Intl` percent style writes no space (Pitfall 10).
 */
export function formatPercent(fraction: Big): string {
  const rounded = roundedPercent(fraction);
  const magnitude = rounded.abs().toFixed(1);
  let text = magnitude;
  if (isNumericLiteral(magnitude)) {
    try {
      text = new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(magnitude);
    } catch {
      text = magnitude;
    }
  }
  const sign = rounded.lt(ZERO) ? TRUE_MINUS : "";
  return `${sign}${text} %`;
}

export type DeltaDirection = "up" | "down" | "flat";

/**
 * Signed delta text and its direction, both derived from the rounded value so
 * "+0.0 %" or "−0.0 %" never appear (D-20).
 */
export function formatDelta(fraction: Big): { text: string; direction: DeltaDirection } {
  const rounded = roundedPercent(fraction);
  if (rounded.gt(ZERO)) return { text: `+${formatPercent(fraction)}`, direction: "up" };
  if (rounded.lt(ZERO)) return { text: formatPercent(fraction), direction: "down" };
  return { text: formatPercent(ZERO), direction: "flat" };
}

/**
 * Label of a period: "may 2025", "ene\u2013jun 2025" within a year and
 * "dic 2024\u2013feb 2025" across years (unspaced en dash).
 */
export function periodLabel(from: MonthKey, to: MonthKey): string {
  if (from === to) return monthYearLabel(from);
  if (from.slice(0, 4) === to.slice(0, 4)) {
    return `${monthShortLabel(from)}\u2013${monthYearLabel(to)}`;
  }
  return `${monthYearLabel(from)}\u2013${monthYearLabel(to)}`;
}

/** A whole count with es-MX grouping. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("es-MX").format(n);
}
