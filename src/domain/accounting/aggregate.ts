/**
 * Selectors over the ledger. The IVA mode only picks which of the two stored
 * amounts is read; it never recomputes the ledger.
 */
import type Big from "big.js";
import { ZERO, sum } from "./decimal";
import type { DateRange } from "./filters";
import type { LedgerEntry } from "./ledger";
import type { MonthKey } from "./months";

export type IvaMode = "con" | "sin";

export function entryAmount(entry: LedgerEntry, mode: IvaMode): Big | null {
  return mode === "con" ? entry.conIva : entry.sinIva;
}

/* RED stubs: the surface of the new selectors with no behavior. */
export interface KpiResult {
  gasto: Big;
  facturas: number;
  notas: number;
  ticket: Big | null;
  promedio: Big;
  months: number;
  hasData: boolean;
}

export interface KpiDeltas {
  gasto: Big | null;
  facturas: Big | null;
  ticket: Big | null;
  promedio: Big | null;
}

export interface MonthPoint {
  month: MonthKey;
  amount: Big;
}

export interface SupplierRow {
  rfc: string;
  name: string;
  net: Big;
  facturas: number;
  ticket: Big | null;
  pct: Big | null;
}

export function kpis(
  visible: readonly LedgerEntry[],
  range: DateRange | null,
  mode: IvaMode,
): KpiResult {
  void visible;
  void range;
  void mode;
  return { gasto: ZERO, facturas: -1, notas: -1, ticket: ZERO, promedio: ZERO, months: -1, hasData: false };
}

export function deltaFraction(current: Big, previous: Big | null): Big | null {
  void previous;
  return current;
}

export function kpiDeltas(current: KpiResult, previous: KpiResult): KpiDeltas {
  void previous;
  return { gasto: current.gasto, facturas: null, ticket: null, promedio: null };
}

export function monthlySeries(
  visible: readonly LedgerEntry[],
  range: DateRange | null,
  mode: IvaMode,
): MonthPoint[] {
  void visible;
  void mode;
  return range === null ? [{ month: "0000-00", amount: ZERO }] : [];
}

export function supplierRanking(visible: readonly LedgerEntry[], mode: IvaMode): SupplierRow[] {
  void visible;
  void mode;
  return [];
}

/** Sum of every counted entry: Ingreso positive, Egreso already negative. */
export function totalSpend(
  entries: readonly LedgerEntry[],
  mode: IvaMode,
): Big {
  const amounts: Big[] = [];
  for (const entry of entries) {
    if (!entry.counted) continue;
    const amount = entryAmount(entry, mode);
    if (amount !== null) amounts.push(amount);
  }
  return sum(amounts);
}
