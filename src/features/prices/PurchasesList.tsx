"use client";

import { useState } from "react";
import { TruncatedText } from "@/components/TruncatedText";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ComparedPurchase } from "@/domain/prices/compare";
import type { UnitFamily } from "@/domain/prices/units";
import { es } from "@/lib/copy/es";
import { notNormalizedReasonText, showMore } from "@/lib/copy/messages";
import { formatContent, formatFolio, formatQuantity, shortDateLabel, unitPriceText } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Purchases shown before «Mostrar {n} más» (UI-SPEC E9 overflow). */
const FIRST_PAGE = 20;

const copy = es.prices.detail.purchases.columns;

/** The family the product is compared in: the one of any compared purchase. */
function comparedFamilyOf(purchases: readonly ComparedPurchase[]): UnitFamily | null {
  for (const purchase of purchases) {
    if (purchase.status === "compared") return purchase.family;
  }
  return null;
}

/** Content cell: the total content bought, or «No normalizado» with the reason as a caption. */
function ContentCell({
  purchase,
  comparedFamily,
}: {
  purchase: ComparedPurchase;
  comparedFamily: UnitFamily | null;
}) {
  if (purchase.status === "compared") return <>{formatContent(purchase.content, purchase.family)}</>;
  return (
    <div className="flex flex-col gap-0.5">
      <span>{es.prices.notNormalized}</span>
      <span className="text-xs text-muted-foreground">
        {notNormalizedReasonText(purchase, comparedFamily)}
      </span>
    </div>
  );
}

/**
 * Every purchase of a product inside the filters, newest first (D-08): date, store, folio, the
 * description exactly as the XML states it, the XML quantity, the content bought and the unit
 * price, or the reason the purchase is not part of the comparison. Not-normalized rows keep their
 * place in date order in muted text. Only store names and folios are shown, never RFC or UUID;
 * all vendor text is rendered as React text.
 */
export function PurchasesList({ purchases }: { purchases: readonly ComparedPurchase[] }) {
  const [showAll, setShowAll] = useState(false);
  const comparedFamily = comparedFamilyOf(purchases);
  const visible = showAll ? purchases : purchases.slice(0, FIRST_PAGE);
  const hidden = purchases.length - visible.length;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Table className="min-w-[880px]">
        <TableHeader>
          <TableRow className="bg-background hover:bg-background">
            <TableHead className="font-semibold">{copy.date}</TableHead>
            <TableHead className="font-semibold">{copy.store}</TableHead>
            <TableHead className="font-semibold">{copy.folio}</TableHead>
            <TableHead className="font-semibold">{copy.description}</TableHead>
            <TableHead className="text-right font-semibold">{copy.quantity}</TableHead>
            <TableHead className="font-semibold">{copy.content}</TableHead>
            <TableHead className="text-right font-semibold">{copy.unitPrice}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((purchase) => (
            <TableRow
              key={`${purchase.uuid}-${String(purchase.conceptIndex)}`}
              className={cn(
                "h-12 hover:bg-background",
                purchase.status === "not-normalized" && "text-muted-foreground",
              )}
            >
              <TableCell className="whitespace-nowrap">{shortDateLabel(purchase.fecha)}</TableCell>
              <TableCell className="max-w-[200px] whitespace-normal break-words">
                {purchase.storeName}
              </TableCell>
              <TableCell>{formatFolio(purchase.folio)}</TableCell>
              <TableCell className="max-w-[320px] whitespace-normal">
                <TruncatedText
                  text={purchase.descripcion}
                  className="line-clamp-2 whitespace-normal break-words"
                />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatQuantity(purchase.cantidad)}</TableCell>
              <TableCell className="whitespace-normal tabular-nums">
                <ContentCell purchase={purchase} comparedFamily={comparedFamily} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {purchase.status === "compared" ? (
                  unitPriceText(purchase.price, purchase.family)
                ) : (
                  <span className="text-muted-foreground">{es.prices.none}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hidden > 0 ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            className="max-sm:h-11"
            onClick={() => {
              setShowAll(true);
            }}
          >
            {showMore(hidden)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
