"use client";

import { useMemo } from "react";
import type { IvaMode } from "@/domain/accounting/aggregate";
import type { DateRange } from "@/domain/accounting/filters";
import { scopeToCategories } from "@/domain/accounting/categories";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { comparePrices, type ProductComparison, type SavingsSummary } from "@/domain/prices/compare";
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
  rows: ProductComparison[];
  summary: SavingsSummary;
  /**
   * Every purchase of the accepted products with every filter ignored (date, supplier, payment
   * method and category). Stable store slots come from it (PREC-06) and the default «no comparable»
   * of a product will too (D-31).
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
    summary: comparison.summary,
    allPurchases,
    historySlots,
  };
}
