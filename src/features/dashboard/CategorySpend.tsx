"use client";

import type Big from "big.js";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CategoryRow } from "@/domain/accounting/categories";
import { ZERO, fromInteger } from "@/domain/accounting/decimal";
import { es } from "@/lib/copy/es";
import type { MonthKey } from "@/domain/accounting/months";
import { categoryCaption, categorySubCaption, viewCategoryInvoicesAria } from "@/lib/copy/messages";
import { formatMoney, formatPercent, monthYearLabel } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { DeltaLine } from "./DeltaLine";

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

function CategoryItem({
  row,
  name,
  maxAbs,
  index,
  previousLabel,
}: {
  row: CategoryRow;
  name: string;
  maxAbs: Big;
  index: number;
  /** Label of the month the variation is measured against; null without a variation pair. */
  previousLabel: string | null;
}) {
  const revealCategory = useSessionStore((s) => s.revealCategory);
  const negative = row.net.lt(ZERO);
  const fill = fillPercent(row.net, maxAbs);
  return (
    <li>
      <button
        type="button"
        aria-label={viewCategoryInvoicesAria(name)}
        onClick={() => {
          revealCategory(row.category);
        }}
        className="flex min-h-[68px] w-full cursor-pointer flex-col justify-center gap-1.5 rounded-md px-2 py-2 text-left outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className="block min-w-0 flex-1 text-sm font-semibold break-words">{name}</span>
          <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
            {formatMoney(row.net)}
          </span>
        </span>
        <span data-testid="category-track" aria-hidden="true" className="block h-1 w-full rounded-[2px] bg-border">
          {negative ? (
            <span
              data-testid="category-tick"
              className="block h-full rounded-[2px] bg-chart-1"
              style={{ width: "2px" }}
            />
          ) : fill > 0 ? (
            <span
              data-testid="category-fill"
              className="block h-full rounded-[2px] bg-chart-1"
              style={{ width: `${fill}%` }}
            />
          ) : null}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-xs text-muted-foreground">
            {negative
              ? es.charts.negativeNet
              : categoryCaption(
                  row.pct === null ? MISSING : formatPercent(row.pct),
                  formatMoney(row.promedio),
                )}
          </span>
          <DeltaLine
            testId={`category-delta-${String(index)}`}
            delta={row.variation}
            comparisonLabel={previousLabel ?? ""}
            missingText={es.charts.noPreviousMonth}
          />
        </span>
      </button>
    </li>
  );
}

/**
 * Spend per category as an HTML list with proportional bars (DASH-03, DASH-05, DASH-07,
 * D-16, D-17). Every category with spend is listed; there is no "Ver todos". Credit
 * notes are already subtracted in the rows. The sub-caption states the calendar months
 * behind the monthly average and the pair of months the variation compares. While nothing
 * is classified yet the hint Alert points to the Categorías tab (E6 empty). Names are React
 * text nodes, so a stored category name can never inject markup.
 */
export function CategorySpend({
  rows,
  months,
  variationMonths,
  nameOf,
  showHint,
  onGoToCategories,
}: {
  rows: readonly CategoryRow[];
  months: number;
  variationMonths: { last: MonthKey; previous: MonthKey } | null;
  nameOf: (category: string) => string;
  showHint: boolean;
  onGoToCategories: () => void;
}) {
  const maxAbs = rows.reduce((max, row) => {
    const abs = row.net.abs();
    return abs.gt(max) ? abs : max;
  }, ZERO);
  const previousLabel = variationMonths === null ? null : monthYearLabel(variationMonths.previous);
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{es.charts.categoryHeading}</h2>
        {months > 0 ? (
          <p data-testid="category-subcaption" className="text-xs text-muted-foreground">
            {categorySubCaption(
              months,
              variationMonths === null ? null : monthYearLabel(variationMonths.last),
              previousLabel,
            )}
          </p>
        ) : null}
      </div>
      {showHint ? (
        <Alert>
          <Info className="text-muted-foreground!" aria-hidden="true" />
          <AlertDescription className="text-foreground">{es.charts.categoryHint}</AlertDescription>
          <Button
            type="button"
            variant="link"
            className="col-start-2 h-auto justify-self-start p-0 max-sm:min-h-11"
            onClick={onGoToCategories}
          >
            {es.charts.goToCategories}
          </Button>
        </Alert>
      ) : null}
      <ol aria-label={es.charts.categoryHeading} className="flex flex-col">
        {rows.map((row, index) => (
          <CategoryItem
            key={row.category}
            row={row}
            name={nameOf(row.category)}
            maxAbs={maxAbs}
            index={index}
            previousLabel={previousLabel}
          />
        ))}
      </ol>
    </section>
  );
}
