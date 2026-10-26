"use client";

import { ZERO } from "@/domain/accounting/decimal";
import { Badge } from "@/components/ui/badge";
import { es } from "@/lib/copy/es";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PricesTable } from "./PricesTable";
import { usePricesView } from "./usePricesView";

/** Id of the tab heading, the focus target of the later «Ir a Productos» round trip. */
export const PRICES_TITLE_ID = "prices-title";

/**
 * Precios tab (Phase 5): where each accepted product is cheapest and how much would have been
 * saved. Every figure is computed in the browser from the same filtered, category-scoped entries
 * as the Dashboard; nothing here is sent anywhere.
 */
export function PreciosTab() {
  const { rows, summary } = usePricesView();
  const zero = summary.total.eq(ZERO);
  return (
    <section className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 id={PRICES_TITLE_ID} tabIndex={-1} className="text-xl leading-[1.2] font-semibold">
          {es.prices.heading}
        </h2>
        <p className="text-xs text-muted-foreground">{es.prices.intro}</p>
      </div>
      <div
        data-testid="prices-savings"
        className="flex max-w-[480px] flex-col gap-1 rounded-lg border bg-secondary p-4"
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
        <p className="text-xs text-muted-foreground">{es.prices.savings.note}</p>
      </div>
      {rows.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-4 rounded-lg border bg-background p-6">
          <PricesTable rows={rows} />
        </div>
      ) : null}
    </section>
  );
}
