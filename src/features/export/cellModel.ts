/**
 * Library-independent cell and sheet model of the Excel export (XLS-03).
 * Skeleton for the RED step: types only, constructors not implemented yet.
 */
import type Big from "big.js";

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

export function textCell(_value: string): XCell {
  return { kind: "empty" };
}
export function moneyCell(_value: Big): XCell {
  return { kind: "empty" };
}
export function unitPriceCell(_value: Big): XCell {
  return { kind: "empty" };
}
export function quantityCell(_raw: string): XCell {
  return { kind: "empty" };
}
export function rateCell(_value: Big): XCell {
  return { kind: "empty" };
}
export function percentCell(_fraction: Big): XCell {
  return { kind: "empty" };
}
export function countCell(_n: number): XCell {
  return { kind: "empty" };
}
export function dateCell(_fecha: string): XCell {
  return { kind: "empty" };
}
export function emptyCell(): XCell {
  return { kind: "empty" };
}
export function excelDateOfFecha(_fecha: string): Date | null {
  return new Date(0);
}
