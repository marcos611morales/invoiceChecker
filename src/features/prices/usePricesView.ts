"use client";

import { useMemo } from "react";
import type { IvaMode } from "@/domain/accounting/aggregate";
import type { DateRange } from "@/domain/accounting/filters";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { comparePrices, type ProductComparison, type SavingsSummary } from "@/domain/prices/compare";
import { extractPurchases, productIndex } from "@/domain/prices/purchases";
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
}

/**
 * The one hook that turns the session, the settings and the filters into the rows and the
 * summary of the Precios tab. It reads the Dashboard's own view, so the purchases come from the
 * same filtered, category-scoped entries as every Dashboard figure (FILT-05, D-02, D-03), and
 * everything after that is memoized on its inputs.
 */
export function usePricesView(): PricesViewState {
  const { ledger, settings, mode, view } = useDashboardView();
  const { products } = settings;
  const index = useMemo(() => productIndex(products), [products]);
  const purchases = useMemo(
    () => extractPurchases(view.visible, mode, index),
    [view.visible, mode, index],
  );
  const comparison = useMemo(() => comparePrices(products, purchases), [products, purchases]);
  return {
    ledger,
    span: view.span,
    mode,
    hasProducts: products.length > 0,
    rows: comparison.rows,
    summary: comparison.summary,
  };
}
