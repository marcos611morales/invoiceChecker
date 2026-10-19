/**
 * The one pure function that produces every figure of the Dashboard for the current
 * filters (FILT-05). The Dashboard and the Excel export both read its result through
 * `useDashboardView`, so KPIs, trend, rankings, tables and export cannot disagree.
 *
 * Pipeline: `applyFilters` (date, supplier, forma) then `scopeToCategories` (category,
 * D-14, D-27), for the current period and, with the same selection, for the previous
 * period of equal length (D-20). Nothing here reads the clock or the settings store.
 */
import type { Resolver } from "../settings/resolver";
import { SIN_CATEGORIA } from "../settings/types";
import {
  kpiDeltas,
  kpis,
  monthlySeries,
  supplierRanking,
  type IvaMode,
  type KpiDeltas,
  type KpiResult,
  type MonthPoint,
  type SupplierRow,
} from "./aggregate";
import {
  categoryBreakdown,
  categoryMonthTotals,
  scopeToCategories,
  type CategoryRow,
  type ScopedEntry,
} from "./categories";
import {
  applyFilters,
  loadedSpan,
  previousFilters,
  resolveRange,
  type DateRange,
  type Filters,
} from "./filters";
import type { LedgerEntry } from "./ledger";
import { previousPeriod, type MonthKey } from "./months";

export interface ViewInput {
  ledger: readonly LedgerEntry[];
  filters: Filters;
  resolver: Resolver;
  mode: IvaMode;
  nameOf: (key: string) => string;
  /** Ids of the categories that exist now; a selected id outside this set is stale. */
  knownCategories: ReadonlySet<string>;
}

export interface DashboardView {
  /** First to last loaded month, or null when no entry has a month. */
  span: DateRange | null;
  /** The explicit range, otherwise the span. */
  range: DateRange | null;
  /** The effective category selection: known ids plus SIN_CATEGORIA, stale ids removed. */
  selected: ReadonlySet<string>;
  /** Entries visible under every filter, scoped to the selected categories. */
  visible: ScopedEntry[];
  current: KpiResult;
  previousRange: DateRange | null;
  deltas: KpiDeltas;
  series: MonthPoint[];
  ranking: SupplierRow[];
  categories: CategoryRow[];
  /**
   * The pair of months behind the variation of each category (D-17): the last month of the
   * range and the previous calendar month, which may lie outside the range. Null without a range.
   */
  variationMonths: { last: MonthKey; previous: MonthKey } | null;
}

/**
 * A selection can hold ids of categories deleted meanwhile; they are ignored so a stale
 * id can never hide every invoice (T-03-20). Only stale ids left selected means no filter.
 * It is also the rule the session store uses to prune the filter after «Subir ajustes» and the
 * rule FilterBar and the export read, so screen, figures and file agree (WR-01).
 */
export function effectiveSelection(
  selected: ReadonlySet<string>,
  known: ReadonlySet<string>,
): ReadonlySet<string> {
  const effective = new Set<string>();
  for (const id of selected) {
    if (id === SIN_CATEGORIA || known.has(id)) effective.add(id);
  }
  return effective;
}

export function selectView(input: ViewInput): DashboardView {
  const { ledger, filters, resolver, mode, nameOf, knownCategories } = input;
  const span = loadedSpan(ledger);
  const range = resolveRange(filters, span);
  const selected = effectiveSelection(filters.categories, knownCategories);
  const visible = scopeToCategories(applyFilters(ledger, filters, span), selected, resolver);
  const current = kpis(visible, range, mode);
  const previousRange = range === null ? null : previousPeriod(range.from, range.to);
  const previousVisible =
    range === null
      ? []
      : scopeToCategories(
          applyFilters(ledger, previousFilters(filters, range), span),
          selected,
          resolver,
        );
  const previous = kpis(previousVisible, previousRange, mode);
  // D-17: the last month of the range against the previous calendar month, under every filter
  // except the date: the pair is read with its own range, so the previous month may lie outside
  // the one the user chose.
  const variationMonths =
    range === null
      ? null
      : { last: range.to, previous: previousPeriod(range.to, range.to).from };
  const pairVisible =
    variationMonths === null
      ? []
      : scopeToCategories(
          applyFilters(
            ledger,
            { ...filters, range: { from: variationMonths.previous, to: variationMonths.last } },
            span,
          ),
          selected,
          resolver,
        );
  const variation =
    variationMonths === null
      ? null
      : {
          last: categoryMonthTotals(pairVisible, variationMonths.last, mode),
          previous: categoryMonthTotals(pairVisible, variationMonths.previous, mode),
        };
  return {
    span,
    range,
    selected,
    visible,
    current,
    previousRange,
    deltas: kpiDeltas(current, previous),
    series: monthlySeries(visible, range, mode),
    ranking: supplierRanking(visible, mode),
    categories: categoryBreakdown(visible, mode, current.months, nameOf, variation),
    variationMonths,
  };
}
