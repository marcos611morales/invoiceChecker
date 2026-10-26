"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductComparison } from "@/domain/prices/compare";
import { es } from "@/lib/copy/es";
import { purchasesCount } from "@/lib/copy/messages";
import { formatMoney, shortDateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const copy = es.prices.detail.stores;

/**
 * One row per compared store, cheapest median first (PREC-01). The cheapest store is lifted,
 * its median is 600 and its name carries a «Más barata» badge with a check, so the highlight is
 * never color alone (PREC-04, D-20). Store names are shown as React text, never the RFC.
 */
export function StoreTable({ row }: { row: ProductComparison }) {
  const cheapestRfc = row.cheapest?.rfc;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="bg-background hover:bg-background">
            <TableHead className="font-semibold">{copy.columns.store}</TableHead>
            <TableHead className="text-right font-semibold">{copy.columns.min}</TableHead>
            <TableHead className="text-right font-semibold">{copy.columns.median}</TableHead>
            <TableHead className="text-right font-semibold">{copy.columns.last}</TableHead>
            <TableHead className="text-right font-semibold">{copy.columns.purchases}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {row.stores.map((store) => {
            const cheapest = store.rfc === cheapestRfc;
            return (
              <TableRow
                key={store.rfc}
                className={cn("h-12 hover:bg-background", cheapest && "bg-background")}
              >
                <TableCell className="whitespace-normal">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words">{store.name}</span>
                    {cheapest ? (
                      <Badge variant="outline">
                        <Check aria-hidden="true" className="text-positive" />
                        {copy.cheapestBadge}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(store.min)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", cheapest && "font-semibold")}>
                  {formatMoney(store.median)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{formatMoney(store.last)}</span>
                    <span className="text-xs text-muted-foreground">
                      {shortDateLabel(store.lastFecha)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{purchasesCount(store.count)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {row.decidedByCount ? <p className="text-xs text-muted-foreground">{copy.tieNote}</p> : null}
      {row.cheapest !== null && row.cheapest.count === 1 ? (
        <p className="text-xs text-muted-foreground">{copy.singlePurchaseCaution}</p>
      ) : null}
      {row.perPiece ? <p className="text-xs text-muted-foreground">{copy.perPieceCaption}</p> : null}
    </div>
  );
}
