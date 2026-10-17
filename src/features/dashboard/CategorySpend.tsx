"use client";

import type Big from "big.js";
import type { CategoryRow } from "@/domain/accounting/categories";
import { ZERO, fromInteger } from "@/domain/accounting/decimal";
import { es } from "@/lib/copy/es";
import { categoryCaption } from "@/lib/copy/messages";
import { formatMoney, formatPercent } from "@/lib/format";

const HUNDRED = fromInteger(100);
const MISSING = "—";

/**
 * Bar width in percent, for geometry only: abs(net) over the largest abs(net) of
 * the list. A negative or zero net gets no fill, and a zero maximum never
 * divides, so Big's division error cannot occur.
 */
function fillPercent(net: Big, maxAbs: Big): number {
  if (net.lte(ZERO) || maxAbs.lte(ZERO)) return 0;
  return Number(net.div(maxAbs).times(HUNDRED).toFixed(2));
}

function CategoryItem({ row, name, maxAbs }: { row: CategoryRow; name: string; maxAbs: Big }) {
  const negative = row.net.lt(ZERO);
  const fill = fillPercent(row.net, maxAbs);
  return (
    <li className="flex min-h-[68px] flex-col justify-center gap-1.5 py-2">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0 flex-1 text-sm font-semibold break-words">{name}</div>
        <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
          {formatMoney(row.net)}
        </span>
      </div>
      <div data-testid="category-track" aria-hidden="true" className="h-1 w-full rounded-[2px] bg-border">
        {negative ? (
          <div
            data-testid="category-tick"
            className="h-full rounded-[2px] bg-chart-1"
            style={{ width: "2px" }}
          />
        ) : fill > 0 ? (
          <div
            data-testid="category-fill"
            className="h-full rounded-[2px] bg-chart-1"
            style={{ width: `${fill}%` }}
          />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {negative
          ? es.charts.negativeNet
          : categoryCaption(
              row.pct === null ? MISSING : formatPercent(row.pct),
              formatMoney(row.promedio),
            )}
      </p>
    </li>
  );
}

/**
 * Spend per category as an HTML list with proportional bars (DASH-03, DASH-05,
 * D-16). Every category with spend is listed; there is no "Ver todos". Credit
 * notes are already subtracted in the rows. Names are React text nodes, so a
 * stored category name can never inject markup.
 */
export function CategorySpend({
  rows,
  nameOf,
}: {
  rows: readonly CategoryRow[];
  nameOf: (category: string) => string;
}) {
  const maxAbs = rows.reduce((max, row) => {
    const abs = row.net.abs();
    return abs.gt(max) ? abs : max;
  }, ZERO);
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{es.charts.categoryHeading}</h2>
      </div>
      <ol aria-label={es.charts.categoryHeading} className="flex flex-col">
        {rows.map((row) => (
          <CategoryItem key={row.category} row={row} name={nameOf(row.category)} maxAbs={maxAbs} />
        ))}
      </ol>
    </section>
  );
}
