"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ProductComparison } from "@/domain/prices/compare";
import { es } from "@/lib/copy/es";
import {
  cheapestSummaryParts,
  familyLine,
  mixedFamiliesNote,
  savingCalculationNote,
  singleStoreSummary,
} from "@/lib/copy/messages";
import { formatMoney, unitPriceText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StoreTable } from "./StoreTable";

/** Informational note: an Info icon and a polite status role (it is not an error). */
function Note({ text }: { text: string }) {
  return (
    <Alert role="status">
      <Info aria-hidden="true" />
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

/**
 * Summary of the cheapest store and the estimated saving, or the single store of the product
 * (D-02, D-21). The saving is always called «estimado» and its calculation is explained.
 */
function Summary({ row }: { row: ProductComparison }) {
  const { cheapest, saving, family } = row;
  const onlyStore = row.stores.length === 1 ? row.stores[0] : undefined;
  if (cheapest === null && onlyStore === undefined && family === null) return null;
  return (
    <div className="flex flex-col gap-1">
      {cheapest !== null && saving !== null && family !== null ? (
        <>
          <p className="text-sm">
            {cheapestSummaryParts(
              cheapest.name,
              unitPriceText(cheapest.median, family),
              formatMoney(saving),
            ).map((part, index) => (
              <span key={index} className={cn(part.strong && "font-semibold")}>
                {part.text}
              </span>
            ))}
          </p>
          <p className="text-xs text-muted-foreground">{savingCalculationNote(cheapest.name)}</p>
        </>
      ) : null}
      {onlyStore !== undefined ? <p className="text-sm">{singleStoreSummary(onlyStore.name)}</p> : null}
      {family !== null ? <p className="text-xs text-muted-foreground">{familyLine(family)}</p> : null}
    </div>
  );
}

/**
 * Expanded panel of a product of the Precios tab (D-07): alerts, summary, prices per store.
 * The history chart, the content editor and the purchases list are added by later plans. Every
 * vendor and store name is rendered as React text.
 */
export function ProductDetail({ row }: { row: ProductComparison }) {
  const storesHeadingId = useId();
  const comparable = row.stores.length > 0;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {row.family !== null && row.otherFamilies.length > 0 ? (
        <Note text={mixedFamiliesNote(row.family, row.otherFamilies)} />
      ) : null}
      {!comparable ? <Note text={es.prices.detail.noneComparable} /> : null}
      <Summary row={row} />
      {comparable ? (
        <section aria-labelledby={storesHeadingId} className="flex min-w-0 flex-col gap-2">
          <h3 id={storesHeadingId} className="text-sm font-semibold">
            {es.prices.detail.storesHeading}
          </h3>
          <StoreTable row={row} />
        </section>
      ) : null}
    </div>
  );
}
