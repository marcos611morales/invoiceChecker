/**
 * Library-independent cell and sheet model of the Excel export (XLS-03).
 *
 * Number cells hold the exact decimal STRING produced from big.js, never a JavaScript
 * number: the writer (Plan 03-13) converts at the last moment, so no amount drifts
 * through floating point inside the model. Dates are built only with `Date.UTC` from the
 * literal CFDI Fecha, so the same calendar day appears in every time zone (REGLA-05).
 * Constructors never throw: an unusable value becomes an empty or text cell.
 */
import Big from "big.js";
import { ZERO, parseDecimal, toMoneyString } from "@/domain/accounting/decimal";

export type NumberFormat =
  | "$#,##0.00"
  | "$#,##0.00####"
  | "#,##0.######"
  | "0.0000"
  | "0.0%"
  | "#,##0";

export type XCell =
  | { kind: "text"; value: string }
  | { kind: "number"; value: string; format: NumberFormat }
  | { kind: "date"; value: Date | null }
  | { kind: "empty" };

export interface SheetColumn {
  header: string;
  width: number;
  wrap?: boolean;
}

export interface SheetModel {
  name: string;
  columns: SheetColumn[];
  rows: XCell[][];
  totalRow: XCell[] | null;
}

/** Earliest year a date cell may carry; Excel's date system starts in 1900. */
const MIN_EXCEL_YEAR = 1900;

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2})?$/;

export function textCell(value: string): XCell {
  return { kind: "text", value };
}

export function emptyCell(): XCell {
  return { kind: "empty" };
}

/** An exact amount as `1234.50`, half-up to 2 decimals, never "-0.00". */
export function moneyCell(value: Big): XCell {
  return { kind: "number", value: toMoneyString(value), format: "$#,##0.00" };
}

/** `value` rounded half-up to `dp` decimals, without trailing zeros and never "-0". */
function trimmedDecimal(value: Big, dp: number): string {
  const rounded = value.round(dp, Big.roundHalfUp);
  return rounded.eq(ZERO) ? "0" : rounded.toFixed();
}

/** A unit price: ValorUnitario carries up to 6 decimals. */
export function unitPriceCell(value: Big): XCell {
  return { kind: "number", value: trimmedDecimal(value, 6), format: "$#,##0.00####" };
}

/** A quantity as a decimal without trailing zeros; text that is not a decimal stays text. */
export function quantityCell(raw: string): XCell {
  const text = raw.trim();
  if (text === "") return emptyCell();
  const value = parseDecimal(text);
  if (value === null) return textCell(text);
  return { kind: "number", value: trimmedDecimal(value, 6), format: "#,##0.######" };
}

/** An exchange rate or similar, always 4 decimals. */
export function rateCell(value: Big): XCell {
  const rounded = value.round(4, Big.roundHalfUp);
  return {
    kind: "number",
    value: rounded.eq(ZERO) ? "0.0000" : rounded.toFixed(4),
    format: "0.0000",
  };
}

/** A fraction such as 0.124, shown by the spreadsheet as 12.4 %. */
export function percentCell(fraction: Big): XCell {
  return { kind: "number", value: trimmedDecimal(fraction, 6), format: "0.0%" };
}

/** A whole count; anything that is not a safe integer becomes an empty cell. */
export function countCell(n: number): XCell {
  if (!Number.isSafeInteger(n)) return emptyCell();
  return { kind: "number", value: String(n), format: "#,##0" };
}

/**
 * The calendar day of a CFDI Fecha as a Date at UTC midnight, or null when the Fecha does
 * not have the CFDI shape, names a day that does not exist or has a year before 1900.
 * Built only with `Date.UTC` from the literal digits, never from a parsed string or the
 * local time zone (Pitfall 2).
 */
export function excelDateOfFecha(fecha: string): Date | null {
  const match = FECHA_RE.exec(fecha);
  if (match === null) return null;
  const [, yearText, monthText, dayText] = match;
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    return null;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < MIN_EXCEL_YEAR) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls an impossible day over (30 February); the round trip catches it.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** A date cell from a literal Fecha; an unusable Fecha gives an empty date cell. */
export function dateCell(fecha: string): XCell {
  return { kind: "date", value: excelDateOfFecha(fecha) };
}
