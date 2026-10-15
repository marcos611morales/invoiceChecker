"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { kpiDeltas, kpis, monthlySeries, supplierRanking } from "@/domain/accounting/aggregate";
import {
  applyFilters,
  loadedSpan,
  previousFilters,
  resolveRange,
} from "@/domain/accounting/filters";
import { buildLedger } from "@/domain/accounting/ledger";
import { previousPeriod } from "@/domain/accounting/months";
import { InvoiceTable } from "@/features/invoices/InvoiceTable";
import { es } from "@/lib/copy/es";
import { periodLabel } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { FilterBar } from "./FilterBar";
import { KpiRow } from "./KpiRow";
import { SupplierRanking } from "./SupplierRanking";
import { TrendChart } from "./TrendChart";

/**
 * Dashboard panel. The ledger is built from the session invoices plus the manual
 * exclusions and restorations (REGLA-08). One visible set is computed with
 * `applyFilters` and everything below the filter bar reads it (FILT-05), in the
 * order of D-03: filter bar, mode caption, content. The KPIs are read in the IVA
 * mode of the settings store (REGLA-03) and compared with the previous period of
 * equal length under the same supplier and forma filters (D-20). Switching the
 * mode only picks the other stored amount; it never rebuilds the ledger.
 */
export function DashboardTab() {
  const invoices = useSessionStore((s) => s.invoices);
  const excluded = useSessionStore((s) => s.excluded);
  const restored = useSessionStore((s) => s.restored);
  const filters = useSessionStore((s) => s.filters);
  const clearFilters = useSessionStore((s) => s.clearFilters);
  const ivaMode = useSettingsStore((s) => s.ivaMode);
  const ledger = useMemo(
    () => buildLedger(invoices, { excluded, restored }),
    [invoices, excluded, restored],
  );
  const span = useMemo(() => loadedSpan(ledger), [ledger]);
  const visible = useMemo(() => applyFilters(ledger, filters, span), [ledger, filters, span]);
  const range = useMemo(() => resolveRange(filters, span), [filters, span]);
  const current = useMemo(() => kpis(visible, range, ivaMode), [visible, range, ivaMode]);
  const prevRange = useMemo(
    () => (range === null ? null : previousPeriod(range.from, range.to)),
    [range],
  );
  const previousVisible = useMemo(
    () =>
      range === null ? [] : applyFilters(ledger, previousFilters(filters, range), span),
    [ledger, filters, range, span],
  );
  const previous = useMemo(
    () => kpis(previousVisible, prevRange, ivaMode),
    [previousVisible, prevRange, ivaMode],
  );
  const deltas = useMemo(() => kpiDeltas(current, previous), [current, previous]);
  const previousLabel = prevRange === null ? "" : periodLabel(prevRange.from, prevRange.to);
  const series = useMemo(() => monthlySeries(visible, range, ivaMode), [visible, range, ivaMode]);
  const ranking = useMemo(() => supplierRanking(visible, ivaMode), [visible, ivaMode]);

  if (ledger.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle className="text-base">{es.dashboard.noInvoicesHeading}</EmptyTitle>
          <EmptyDescription>{es.dashboard.noInvoicesBody}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <FilterBar ledger={ledger} span={span} />
        <p data-testid="mode-caption" className="text-xs text-muted-foreground">
          {ivaMode === "sin" ? es.iva.captionSin : es.iva.captionCon}
        </p>
      </div>
      {visible.length === 0 ? (
        <Empty data-testid="dashboard-empty-filtered" className="border">
          <EmptyHeader>
            <EmptyTitle className="text-base">{es.dashboard.emptyFilteredHeading}</EmptyTitle>
            <EmptyDescription>{es.dashboard.emptyFilteredBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="lg" onClick={clearFilters}>
              {es.filters.reset}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <KpiRow current={current} deltas={deltas} previousLabel={previousLabel} mode={ivaMode} />
          <div
            data-testid="trend-ranking-row"
            className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
          >
            {range === null ? null : (
              <TrendChart series={series} promedio={current.promedio} range={range} />
            )}
            <SupplierRanking rows={ranking} />
          </div>
          <InvoiceTable rows={visible} ledger={ledger} mode={ivaMode} />
        </>
      )}
    </div>
  );
}
