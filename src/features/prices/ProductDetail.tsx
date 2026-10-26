"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ProductComparison } from "@/domain/prices/compare";
import type { SeriesSlot } from "@/domain/prices/history";
import { es } from "@/lib/copy/es";
import {
  cheapestSummaryParts,
  familyLine,
  missingContentNotice,
  mixedFamiliesNote,
  savingCalculationNote,
  singleStoreSummary,
} from "@/lib/copy/messages";
import { formatMoney, unitPriceText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ContentTable, contentSectionId, missingContent } from "./ContentTable";
import { HistoryChart } from "./HistoryChart";
import { PurchasesList } from "./PurchasesList";
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
 * Notice of the descriptions that lack their content (D-13): how many leave purchases out of the
 * comparison, and a link-style button that moves focus to the content section (its heading id is
 * built from CONTENT_SECTION_ID and the product id).
 */
function MissingContentNotice({ row }: { row: ProductComparison }) {
  const { descriptions, purchases } = missingContent(row);
  if (descriptions === 0) return null;
  return (
    <Alert role="status">
      <Info aria-hidden="true" />
      <AlertDescription>
        <span>{missingContentNotice(descriptions, purchases)}</span>{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 max-sm:min-h-11"
          onClick={() => {
            document.getElementById(contentSectionId(row.productId))?.focus();
          }}
        >
          {es.prices.detail.content.capture}
        </Button>
      </AlertDescription>
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

/** Slots of a product when the caller has none: every store falls into «Otras tiendas». */
const NO_SLOTS: ReadonlyMap<string, SeriesSlot> = new Map();

/**
 * Expanded panel of a product of the Precios tab (D-07): alerts, summary, prices per store, the
 * price history, the content of each description and the purchases list. `slots` are
 * the stable series slots of the product's stores (PREC-06). Every vendor and store name is
 * rendered as React text.
 */
export function ProductDetail({
  row,
  slots = NO_SLOTS,
  onAnnounce,
}: {
  row: ProductComparison;
  slots?: ReadonlyMap<string, SeriesSlot>;
  /** Receives the polite announcements of the content editor (D-15). */
  onAnnounce?: (message: string) => void;
}) {
  const storesHeadingId = useId();
  const historyHeadingId = useId();
  const purchasesHeadingId = useId();
  const comparable = row.stores.length > 0;
  const hasHistory =
    comparable && row.purchases.some((purchase) => purchase.status === "compared");
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {row.family !== null && row.otherFamilies.length > 0 ? (
        <Note text={mixedFamiliesNote(row.family, row.otherFamilies)} />
      ) : null}
      <MissingContentNotice row={row} />
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
      {hasHistory ? (
        <section aria-labelledby={historyHeadingId} className="flex min-w-0 flex-col gap-2">
          <h3 id={historyHeadingId} className="text-sm font-semibold">
            {es.prices.detail.history.heading}
          </h3>
          <HistoryChart row={row} slots={slots} />
        </section>
      ) : null}
      <ContentTable row={row} onAnnounce={onAnnounce} />
      <section aria-labelledby={purchasesHeadingId} className="flex min-w-0 flex-col gap-2">
        <h3 id={purchasesHeadingId} className="text-sm font-semibold">
          {es.prices.detail.purchasesHeading}
        </h3>
        <PurchasesList purchases={row.purchases} />
      </section>
    </div>
  );
}
