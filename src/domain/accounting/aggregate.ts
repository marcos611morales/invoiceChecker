/**
 * Selectors over the ledger. The IVA mode only picks which of the two stored
 * amounts is read; it never recomputes the ledger, and which entries count
 * never changes with it (D-37).
 *
 * Every selector takes the visible set produced by `applyFilters` and nothing
 * else about the ledger, so KPIs, trend and ranking cannot disagree (FILT-05).
 * Big division by zero throws, so every division is guarded before it runs
 * (T-02-09). Groupings use Map (supplier RFCs come from XML, T-02-10). No amount
 * becomes a floating-point number here; fractions such as 0.124 (12.4 %) stay
 * exact decimals and chart geometry is converted later, in the UI layer.
 */
import type Big from "big.js";
import { ZERO, fromInteger, sum } from "./decimal";
import type { DateRange } from "./filters";
import type { LedgerEntry } from "./ledger";
import { monthsInRange, type MonthKey } from "./months";

export type IvaMode = "con" | "sin";

/** Spanish order, accents and case ignored (the same rule as the filter options). */
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

export function entryAmount(entry: LedgerEntry, mode: IvaMode): Big | null {
  return mode === "con" ? entry.conIva : entry.sinIva;
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

export interface KpiResult {
  /** Net spend: counted Ingreso minus counted credit notes. */
  gasto: Big;
  /** Counted Ingreso entries only (D-18). */
  facturas: number;
  /** Counted credit notes, reported apart (D-18). */
  notas: number;
  /** gasto over facturas; null when there is no counted invoice (D-19, D-39). */
  ticket: Big | null;
  /** gasto over the calendar months of the range; zero for a null range (DASH-06). */
  promedio: Big;
  months: number;
  /** At least one entry is counted. */
  hasData: boolean;
}

export function kpis(
  visible: readonly LedgerEntry[],
  range: DateRange | null,
  mode: IvaMode,
): KpiResult {
  let facturas = 0;
  let notas = 0;
  let hasData = false;
  for (const entry of visible) {
    if (!entry.counted) continue;
    hasData = true;
    if (entry.kind === "ingreso") facturas += 1;
    else if (entry.kind === "nota-credito") notas += 1;
  }
  const gasto = totalSpend(visible, mode);
  const months = range === null ? 0 : monthsInRange(range.from, range.to).length;
  return {
    gasto,
    facturas,
    notas,
    ticket: facturas > 0 ? gasto.div(fromInteger(facturas)) : null,
    promedio: months > 0 ? gasto.div(fromInteger(months)) : ZERO,
    months,
    hasData,
  };
}

/** Fractions: 0.124 means 12.4 %. */
export interface KpiDeltas {
  gasto: Big | null;
  facturas: Big | null;
  ticket: Big | null;
  promedio: Big | null;
}

/**
 * (current - previous) / previous, or null when the previous value is missing
 * or not above zero: a change against zero or a non-positive base is never
 * computed (D-20).
 */
export function deltaFraction(current: Big, previous: Big | null): Big | null {
  if (previous === null || previous.lte(ZERO)) return null;
  return current.minus(previous).div(previous);
}

export function kpiDeltas(current: KpiResult, previous: KpiResult): KpiDeltas {
  if (!previous.hasData) {
    return { gasto: null, facturas: null, ticket: null, promedio: null };
  }
  return {
    gasto: deltaFraction(current.gasto, previous.gasto),
    facturas: deltaFraction(fromInteger(current.facturas), fromInteger(previous.facturas)),
    ticket:
      current.ticket === null || previous.ticket === null
        ? null
        : deltaFraction(current.ticket, previous.ticket),
    promedio: deltaFraction(current.promedio, previous.promedio),
  };
}

export interface MonthPoint {
  month: MonthKey;
  amount: Big;
}

/**
 * One point per calendar month of the range, zero-filled (DASH-02, D-21).
 * Credit notes sit in their imputation month, so a month can be negative.
 */
export function monthlySeries(
  visible: readonly LedgerEntry[],
  range: DateRange | null,
  mode: IvaMode,
): MonthPoint[] {
  if (range === null) return [];
  const perMonth = new Map<MonthKey, Big[]>();
  for (const entry of visible) {
    if (!entry.counted || entry.month === null) continue;
    const amount = entryAmount(entry, mode);
    if (amount === null) continue;
    const known = perMonth.get(entry.month);
    if (known === undefined) perMonth.set(entry.month, [amount]);
    else known.push(amount);
  }
  return monthsInRange(range.from, range.to).map((month) => ({
    month,
    amount: sum(perMonth.get(month) ?? []),
  }));
}

export interface SupplierRow {
  rfc: string;
  name: string;
  /** Net spend: the supplier's credit notes are subtracted (D-23). */
  net: Big;
  facturas: number;
  /** net over facturas; null when the supplier has no counted invoice. */
  ticket: Big | null;
  /** Share of the overall gasto as a fraction; null when that gasto is not above zero. */
  pct: Big | null;
}

interface SupplierAccumulator {
  rfc: string;
  name: string;
  amounts: Big[];
  facturas: number;
}

/**
 * Ranking per RFC (D-43) by net spend, highest first; a negative net sorts
 * after every positive one (D-23). Ties break by Spanish-collated name, then RFC.
 */
export function supplierRanking(
  visible: readonly LedgerEntry[],
  mode: IvaMode,
): SupplierRow[] {
  const bySupplier = new Map<string, SupplierAccumulator>();
  for (const entry of visible) {
    if (!entry.counted) continue;
    const amount = entryAmount(entry, mode);
    if (amount === null) continue;
    let acc = bySupplier.get(entry.supplierRfc);
    if (acc === undefined) {
      acc = { rfc: entry.supplierRfc, name: entry.supplierName, amounts: [], facturas: 0 };
      bySupplier.set(entry.supplierRfc, acc);
    }
    acc.amounts.push(amount);
    if (entry.kind === "ingreso") acc.facturas += 1;
  }

  const total = totalSpend(visible, mode);
  const rows: SupplierRow[] = [];
  for (const acc of bySupplier.values()) {
    const net = sum(acc.amounts);
    rows.push({
      rfc: acc.rfc,
      name: acc.name,
      net,
      facturas: acc.facturas,
      ticket: acc.facturas > 0 ? net.div(fromInteger(acc.facturas)) : null,
      pct: total.gt(ZERO) ? net.div(total) : null,
    });
  }
  return rows.sort((a, b) => {
    const byNet = b.net.cmp(a.net);
    if (byNet !== 0) return byNet;
    const byName = COLLATOR.compare(a.name, b.name);
    if (byName !== 0) return byName;
    return a.rfc < b.rfc ? -1 : a.rfc > b.rfc ? 1 : 0;
  });
}
