"use client";

import { useMemo, useState } from "react";
import { ZERO } from "@/domain/accounting/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterBar } from "@/features/dashboard/FilterBar";
import { PRODUCTS_TITLE_ID } from "@/features/products/focusTargets";
import { es } from "@/lib/copy/es";
import {
  noSearchMatch,
  pricesCountLine,
  savingsPerPieceNote,
  savingsProductsLabel,
} from "@/lib/copy/messages";
import { formatMoney, normalizeSearch } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import { PricesTable } from "./PricesTable";
import { usePricesView } from "./usePricesView";

/** Id of the tab heading, the focus target of the later «Ir a Productos» round trip. */
export const PRICES_TITLE_ID = "prices-title";

/** How long to wait for the Productos panel to mount after switching tabs, in animation frames. */
const FOCUS_FRAMES = 10;

/** Focuses the Productos heading once its panel is mounted (same retry as the run toast). */
function focusProductsHeading(): void {
  let frames = FOCUS_FRAMES;
  const attempt = () => {
    const target = document.getElementById(PRODUCTS_TITLE_ID);
    if (target !== null) {
      target.focus();
      return;
    }
    frames -= 1;
    if (frames > 0) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}

/**
 * Precios tab (Phase 5): where each accepted product is cheapest and how much would have been
 * saved. Every figure is computed in the browser from the same filtered, category-scoped entries
 * as the Dashboard; nothing here is sent anywhere. Vertical order: heading, filter bar and
 * captions, savings card, tools row, products block (UI-SPEC composition). The search narrows the
 * table only; the card follows the filters, not the search (D-03, D-07).
 */
export function PreciosTab() {
  const clearFilters = useSessionStore((s) => s.clearFilters);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const { ledger, span, mode, hasProducts, rows, summary, historySlots } = usePricesView();
  const [search, setSearch] = useState("");

  const needle = normalizeSearch(search);
  const shown = useMemo(
    () => (needle === "" ? rows : rows.filter((row) => normalizeSearch(row.name).includes(needle))),
    [rows, needle],
  );

  const heading = (
    <div className="flex flex-col gap-1">
      <h2 id={PRICES_TITLE_ID} tabIndex={-1} className="text-xl leading-[1.2] font-semibold">
        {es.prices.heading}
      </h2>
      <p className="text-xs text-muted-foreground">{es.prices.intro}</p>
    </div>
  );

  if (!hasProducts) {
    return (
      <section className="flex min-w-0 flex-col gap-8">
        {heading}
        <Empty data-testid="prices-empty-products" className="border py-12">
          <EmptyHeader>
            <EmptyTitle className="text-base">{es.prices.empty.noProductsHeading}</EmptyTitle>
            <EmptyDescription>{es.prices.empty.noProductsBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                setActiveTab("productos");
                focusProductsHeading();
              }}
            >
              {es.prices.empty.goToProducts}
            </Button>
          </EmptyContent>
        </Empty>
      </section>
    );
  }

  const zero = summary.total.eq(ZERO);
  return (
    <section className="flex min-w-0 flex-col gap-8">
      {heading}
      <div className="flex flex-col gap-2">
        <FilterBar ledger={ledger} span={span} />
        <p data-testid="mode-caption" className="text-xs text-muted-foreground">
          {mode === "sin" ? es.iva.captionSin : es.iva.captionCon}
        </p>
        <p className="text-xs text-muted-foreground">{es.prices.modeNote}</p>
      </div>
      {rows.length === 0 ? (
        <Empty data-testid="prices-empty-filtered" className="border py-12">
          <EmptyHeader>
            <EmptyTitle className="text-base">{es.prices.empty.noPurchasesHeading}</EmptyTitle>
            <EmptyDescription>{es.prices.empty.noPurchasesBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" size="lg" onClick={clearFilters}>
              {es.filters.reset}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div
            data-testid="prices-savings"
            className="flex w-full max-w-[480px] flex-col gap-1 rounded-lg border bg-secondary p-4"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{es.prices.savings.label}</span>
              <Badge variant="outline">{es.prices.savings.badge}</Badge>
            </div>
            <div
              data-testid="prices-savings-total"
              className={cn(
                "text-[28px] leading-[1.2] font-semibold tabular-nums whitespace-nowrap",
                zero && "text-muted-foreground",
              )}
            >
              {formatMoney(summary.total)}
            </div>
            <p data-testid="prices-savings-sub" className="text-xs text-muted-foreground">
              {summary.products === 0
                ? es.prices.savings.zero
                : savingsProductsLabel(summary.products)}
            </p>
            <p className="text-xs text-muted-foreground">{es.prices.savings.note}</p>
            {summary.perPieceProducts > 0 ? (
              <p className="text-xs text-muted-foreground">
                {savingsPerPieceNote(summary.perPieceProducts)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="w-full sm:w-80">
              <Label htmlFor="prices-search" className="sr-only">
                {es.prices.search.label}
              </Label>
              <Input
                id="prices-search"
                type="search"
                value={search}
                placeholder={es.prices.search.placeholder}
                className="h-9 max-sm:h-11"
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
              />
            </div>
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {pricesCountLine(shown.length)}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-4 rounded-lg border bg-background p-6">
            {shown.length === 0 ? (
              <p data-testid="prices-no-match" className="py-6 text-center text-sm text-muted-foreground">
                {noSearchMatch(search.trim())}
              </p>
            ) : (
              <PricesTable rows={shown} historySlots={historySlots} />
            )}
          </div>
        </>
      )}
    </section>
  );
}
