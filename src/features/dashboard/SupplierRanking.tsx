"use client";

import { useState } from "react";
import type Big from "big.js";
import { Button } from "@/components/ui/button";
import type { SupplierRow } from "@/domain/accounting/aggregate";
import { ZERO, fromInteger } from "@/domain/accounting/decimal";
import { es } from "@/lib/copy/es";
import { rankingCaption, viewSupplierInvoicesAria } from "@/lib/copy/messages";
import { formatMoney, formatPercent } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { SupplierDialog } from "./SupplierDialog";

/** The ranking shows the first rows only; the dialog lists everyone (D-22). */
const TOP = 10;

const HUNDRED = fromInteger(100);
const MISSING = "—";

/**
 * Bar width in percent, for geometry only: abs(net) over the largest abs(net) of
 * the list. A negative or zero net gets no fill, and a zero maximum never
 * divides (T-02-21), so Big's division error cannot occur.
 */
function fillPercent(net: Big, maxAbs: Big): number {
  if (net.lte(ZERO) || maxAbs.lte(ZERO)) return 0;
  return Number(net.div(maxAbs).times(HUNDRED).toFixed(2));
}

function RankingRow({ row, maxAbs }: { row: SupplierRow; maxAbs: Big }) {
  const revealSupplier = useSessionStore((s) => s.revealSupplier);
  const negative = row.net.lt(ZERO);
  const fill = fillPercent(row.net, maxAbs);
  return (
    <li>
      <button
        type="button"
        aria-label={viewSupplierInvoicesAria(row.name)}
        onClick={() => {
          revealSupplier(row.rfc);
        }}
        className="flex min-h-[68px] w-full cursor-pointer flex-col justify-center gap-1.5 rounded-md px-2 py-2 text-left outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className="block min-w-0 flex-1 text-sm font-semibold break-words">{row.name}</span>
          <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
            {formatMoney(row.net)}
          </span>
        </span>
        <span data-testid="ranking-track" aria-hidden="true" className="block h-1 w-full rounded-[2px] bg-border">
          {negative ? (
            <span
              data-testid="ranking-tick"
              className="block h-full rounded-[2px] bg-chart-1"
              style={{ width: "2px" }}
            />
          ) : fill > 0 ? (
            <span
              data-testid="ranking-fill"
              className="block h-full rounded-[2px] bg-chart-1"
              style={{ width: `${fill}%` }}
            />
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {negative
            ? es.charts.negativeNet
            : rankingCaption(
                row.pct === null ? MISSING : formatPercent(row.pct),
                row.ticket === null ? MISSING : formatMoney(row.ticket),
              )}
        </span>
      </button>
    </li>
  );
}

/**
 * Top 10 suppliers by net spend as an HTML list with proportional bars (DASH-04,
 * D-22, D-23). Credit notes are already subtracted in the rows. There is no
 * catch-all group: "Ver todos" opens the complete list when there are more than 10.
 * Each top-10 row is a button that adds the supplier to the filter and goes to the Facturas
 * table (D-18); the name wraps, because the truncation helper's own trigger cannot sit inside
 * a button. The dialog rows stay non-interactive.
 */
export function SupplierRanking({ rows }: { rows: readonly SupplierRow[] }) {
  const [open, setOpen] = useState(false);
  const top = rows.slice(0, TOP);
  const maxAbs = top.reduce((max, row) => {
    const abs = row.net.abs();
    return abs.gt(max) ? abs : max;
  }, ZERO);
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-background p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">{es.charts.rankingHeading}</h2>
          <p className="text-xs text-muted-foreground">{es.charts.rankingSub}</p>
        </div>
        {rows.length > TOP ? (
          <Button
            type="button"
            variant="outline"
            className="max-sm:h-11"
            onClick={() => setOpen(true)}
          >
            {es.charts.seeAll}
          </Button>
        ) : null}
      </div>
      <ol aria-label={es.charts.rankingAria} className="flex flex-col">
        {top.map((row) => (
          <RankingRow key={row.rfc} row={row} maxAbs={maxAbs} />
        ))}
      </ol>
      {rows.length > TOP ? <SupplierDialog rows={rows} open={open} onOpenChange={setOpen} /> : null}
    </section>
  );
}
