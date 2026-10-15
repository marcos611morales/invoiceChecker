/**
 * Filters over the ledger and the one function that applies them (FILT-05).
 * Every dashboard view (KPIs, trend, ranking, table, export) takes the result
 * of `applyFilters` and nothing else, so the views cannot disagree.
 *
 * Supplier RFCs and forma codes come from XML, so every grouping uses Map and
 * Set (a plain object keyed by "__proto__" would misbehave). Nothing here
 * touches a Date: months are the literal YYYY-MM keys of months.ts.
 */
import type { LedgerEntry } from "./ledger";
import { compareMonths, previousPeriod, type MonthKey } from "./months";

/** Inclusive month range. */
export interface DateRange {
  from: MonthKey;
  to: MonthKey;
}

export interface Filters {
  /** null means "the whole loaded span" (D-12), so a wider later batch widens the view. */
  range: DateRange | null;
  /** Selected supplier RFCs; empty means no supplier filter (FILT-02). */
  suppliers: ReadonlySet<string>;
  /** Selected forma de pago codes or the PPD sentinel; empty means no filter (FILT-04). */
  formas: ReadonlySet<string>;
}

export interface FilterOption {
  key: string;
  label: string;
  count: number;
}

export const EMPTY_FILTERS: Filters = {
  range: null,
  suppliers: new Set<string>(),
  formas: new Set<string>(),
};

/** One collator for every option list: Spanish order, accents and case ignored. */
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

/**
 * First to last month over ALL loaded entries, whatever their kind, counted
 * state or exclusion (D-12, D-41). Entries with no month are ignored.
 */
export function loadedSpan(entries: readonly LedgerEntry[]): DateRange | null {
  let from: MonthKey | null = null;
  let to: MonthKey | null = null;
  for (const entry of entries) {
    const month = entry.month;
    if (month === null) continue;
    if (from === null || compareMonths(month, from) < 0) from = month;
    if (to === null || compareMonths(month, to) > 0) to = month;
  }
  if (from === null || to === null) return null;
  return { from, to };
}

/** The explicit range when there is one, otherwise the loaded span. */
export function resolveRange(filters: Filters, span: DateRange | null): DateRange | null {
  return filters.range ?? span;
}

/** A range equal to the span is stored as null (D-12), any other range is kept. */
export function normalizeRange(range: DateRange, span: DateRange | null): DateRange | null {
  if (span !== null && range.from === span.from && range.to === span.to) return null;
  return range;
}

function inRange(month: MonthKey | null, range: DateRange | null): boolean {
  // An entry with no month (damaged Fecha) stays visible so it can be reviewed;
  // it never sums, so no total depends on this choice.
  if (range === null || month === null) return true;
  return compareMonths(month, range.from) >= 0 && compareMonths(month, range.to) <= 0;
}

function intersects(formas: readonly string[], selected: ReadonlySet<string>): boolean {
  for (const forma of formas) {
    if (selected.has(forma)) return true;
  }
  return false;
}

/**
 * The visible set: the date filter reads the imputation month (D-15), the
 * supplier filter reads the RFC, the forma filter keeps entries whose forms
 * intersect the selection; the three combine with AND. Input order is kept and
 * the input is never mutated.
 */
export function applyFilters(
  entries: readonly LedgerEntry[],
  filters: Filters,
  span: DateRange | null,
): LedgerEntry[] {
  const range = resolveRange(filters, span);
  return entries.filter((entry) => {
    if (!inRange(entry.month, range)) return false;
    if (filters.suppliers.size > 0 && !filters.suppliers.has(entry.supplierRfc)) return false;
    if (filters.formas.size > 0 && !intersects(entry.formas, filters.formas)) return false;
    return true;
  });
}

function compareOptions(a: FilterOption, b: FilterOption): number {
  if (a.count !== b.count) return b.count - a.count;
  const byLabel = COLLATOR.compare(a.label, b.label);
  if (byLabel !== 0) return byLabel;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** Supplier options over all loaded entries; the key is the RFC (D-14, D-43). */
export function supplierOptions(entries: readonly LedgerEntry[]): FilterOption[] {
  const options = new Map<string, FilterOption>();
  for (const entry of entries) {
    const known = options.get(entry.supplierRfc);
    if (known === undefined) {
      options.set(entry.supplierRfc, {
        key: entry.supplierRfc,
        label: entry.supplierName,
        count: 1,
      });
    } else {
      known.count += 1;
    }
  }
  return [...options.values()].sort(compareOptions);
}

/**
 * Forma de pago options over all loaded entries: an entry counts once per form
 * it carries (D-16). The label comes from the caller so the domain holds no UI copy.
 */
export function formaOptions(
  entries: readonly LedgerEntry[],
  labelOf: (code: string) => string,
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const forma of new Set(entry.formas)) {
      counts.set(forma, (counts.get(forma) ?? 0) + 1);
    }
  }
  const options: FilterOption[] = [];
  for (const [key, count] of counts) {
    options.push({ key, label: labelOf(key), count });
  }
  return options.sort(compareOptions);
}

/** Same supplier and forma selection over the preceding period of equal length (D-20). */
export function previousFilters(filters: Filters, range: DateRange): Filters {
  return {
    range: previousPeriod(range.from, range.to),
    suppliers: filters.suppliers,
    formas: filters.formas,
  };
}

export function isDefaultFilters(filters: Filters): boolean {
  return (
    filters.range === null && filters.suppliers.size === 0 && filters.formas.size === 0
  );
}
