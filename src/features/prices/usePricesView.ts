"use client";

import { useMemo } from "react";
import type { IvaMode } from "@/domain/accounting/aggregate";
import type { DateRange } from "@/domain/accounting/filters";
import { scopeToCategories } from "@/domain/accounting/categories";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import {
  comparabilityOf,
  defaultsByProduct,
  type Comparability,
} from "@/domain/prices/comparable";
import {
  comparePrices,
  summarizeSavings,
  type ProductComparison,
  type SavingsSummary,
} from "@/domain/prices/compare";
import { assignSlots, type SeriesSlot } from "@/domain/prices/history";
import { extractPurchases, productIndex, type Purchase } from "@/domain/prices/purchases";
import { useDashboardView } from "@/features/dashboard/useDashboardView";

export interface PricesViewState {
  ledger: LedgerEntry[];
  /** First to last loaded month, or null when no entry has a month. */
  span: DateRange | null;
  mode: IvaMode;
  /** True when at least one product has been accepted. */
  hasProducts: boolean;
  /** Every product with purchases within the filters, comparable or not. */
  rows: ProductComparison[];
  /** Savings of the comparable rows only (D-18, D-22). */
  summary: SavingsSummary;
  /** Product id to its effective comparability; every row has an entry. */
  comparability: ReadonlyMap<string, Comparability>;
  /** Rows that are not comparable (by default or by the user), i.e. hidden from the savings (D-22). */
  hiddenCount: number;
  /**
   * Every purchase of the accepted products with every filter ignored (date, supplier, payment
   * method and category). Stable store slots (PREC-06) and the default «no comparable» of each
   * product (D-31) come from it, so a filter never changes either.
   */
  allPurchases: Purchase[];
  /** Product id to store RFC to series slot, from the unfiltered compared stores of the product. */
  historySlots: ReadonlyMap<string, ReadonlyMap<string, SeriesSlot>>;
}

/** An empty category selection keeps every part of every entry. */
const NO_CATEGORIES: ReadonlySet<string> = new Set();

/**
 * The one hook that turns the session, the settings and the filters into the rows and the
 * summary of the Precios tab. It reads the Dashboard's own view, so the purchases come from the
 * same filtered, category-scoped entries as every Dashboard figure (FILT-05, D-02, D-03), and
 * everything after that is memoized on its inputs.
 */
export function usePricesView(): PricesViewState {
  const { ledger, settings, resolver, mode, view } = useDashboardView();
  const { products } = settings;
  const index = useMemo(() => productIndex(products), [products]);
  const purchases = useMemo(
    () => extractPurchases(view.visible, mode, index),
    [view.visible, mode, index],
  );
  const comparison = useMemo(() => comparePrices(products, purchases), [products, purchases]);
  const allPurchases = useMemo(
    () => extractPurchases(scopeToCategories(ledger, NO_CATEGORIES, resolver), mode, index),
    [ledger, resolver, mode, index],
  );
  const defaults = useMemo(() => defaultsByProduct(allPurchases), [allPurchases]);
  const overrides = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const override of settings.priceOverrides) map.set(override.productId, override.comparable);
    return map;
  }, [settings.priceOverrides]);
  const comparability = useMemo(() => {
    const states = new Map<string, Comparability>();
    for (const row of comparison.rows) {
      states.set(row.productId, comparabilityOf(row.productId, defaults, overrides));
    }
    return states;
  }, [comparison.rows, defaults, overrides]);
  const { summary, hiddenCount } = useMemo(() => {
    const kept = comparison.rows.filter((row) => comparability.get(row.productId)?.comparable ?? true);
    return {
      summary: summarizeSavings(kept),
      hiddenCount: comparison.rows.length - kept.length,
    };
  }, [comparison.rows, comparability]);
  const unfiltered = useMemo(() => comparePrices(products, allPurchases), [products, allPurchases]);
  const historySlots = useMemo(() => {
    const slots = new Map<string, ReadonlyMap<string, SeriesSlot>>();
    for (const row of unfiltered.rows) slots.set(row.productId, assignSlots(row.stores));
    return slots;
  }, [unfiltered]);
  return {
    ledger,
    span: view.span,
    mode,
    hasProducts: products.length > 0,
    rows: comparison.rows,
    summary,
    comparability,
    hiddenCount,
    allPurchases,
    historySlots,
  };
}
