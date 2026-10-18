"use client";

import { useEffect, useMemo } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { qualitySummary } from "@/domain/accounting/quality";
import { InvoiceTable } from "@/features/invoices/InvoiceTable";
import { es } from "@/lib/copy/es";
import { hiddenInvoiceNotice } from "@/lib/copy/messages";
import { invoiceRef, periodLabel } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { CategorySpend } from "./CategorySpend";
import { FilterBar } from "./FilterBar";
import { KpiRow } from "./KpiRow";
import { SupplierRanking } from "./SupplierRanking";
import { TrendChart } from "./TrendChart";
import { useDashboardView } from "./useDashboardView";

/**
 * Dashboard panel. The ledger is built from the session invoices plus the manual
 * exclusions and restorations (REGLA-08). Every figure below the filter bar comes from one
 * `selectView` result, read through `useDashboardView`, which the Excel export reads too
 * (FILT-05), in the order of D-03: filter bar, mode caption, category caption, content. The
 * KPIs are read in the IVA mode of the settings store (REGLA-03) and compared with the
 * previous period of equal length under the same supplier, forma and category filters (D-20).
 * While a category filter is active the amounts are partial and the caption says so (D-14).
 * Switching the mode only picks the other stored amount; it never rebuilds the ledger.
 */
export function DashboardTab() {
  const clearFilters = useSessionStore((s) => s.clearFilters);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const focusRequest = useSessionStore((s) => s.focusRequest);
  const clearFocusRequest = useSessionStore((s) => s.clearFocusRequest);
  const { ledger, nameOf, mode: ivaMode, view } = useDashboardView();
  const { span, range, visible, current, deltas, series, ranking, categories } = view;
  // The unfiltered ledger decides the notice: an incident changes the amounts whether or
  // not the current filters show its invoice (D-04). The informational D-46 type never
  // raises it; `amountChanging` already excludes it.
  const amountChanging = useMemo(() => qualitySummary(ledger).amountChanging, [ledger]);
  const previousLabel =
    view.previousRange === null ? "" : periodLabel(view.previousRange.from, view.previousRange.to);

  // "Ver factura" asked for an invoice the current filters hide (UI-SPEC decision 6): the
  // filters stay as they are and the Alert below offers to remove them.
  const hiddenEntry = useMemo(() => {
    if (focusRequest === null) return null;
    const entry = ledger.find((candidate) => candidate.uuid === focusRequest.uuid);
    if (entry === undefined) return null;
    return visible.some((candidate) => candidate.uuid === entry.uuid) ? null : entry;
  }, [focusRequest, ledger, visible]);
  // A request for an invoice that is not loaded has nothing to show: drop it.
  const unknownRequest =
    focusRequest !== null && !ledger.some((candidate) => candidate.uuid === focusRequest.uuid);
  useEffect(() => {
    if (unknownRequest) clearFocusRequest();
  }, [unknownRequest, clearFocusRequest]);

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
      {amountChanging ? (
        <Alert>
          <TriangleAlert className="text-muted-foreground!" aria-hidden="true" />
          <AlertDescription className="text-foreground">
            {es.dashboard.incidentsNotice}
          </AlertDescription>
          <Button
            type="button"
            variant="link"
            className="col-start-2 h-auto justify-self-start p-0 max-sm:min-h-11"
            onClick={() => {
              setActiveTab("calidad");
            }}
          >
            {es.dashboard.seeQuality}
          </Button>
        </Alert>
      ) : null}
      {hiddenEntry === null ? null : (
        <Alert>
          <Info className="text-muted-foreground!" aria-hidden="true" />
          <AlertDescription className="text-foreground">
            {hiddenInvoiceNotice(invoiceRef(hiddenEntry.invoice.folio, hiddenEntry.uuid))}
          </AlertDescription>
          <Button
            type="button"
            variant="link"
            className="col-start-2 h-auto justify-self-start p-0 max-sm:min-h-11"
            onClick={clearFilters}
          >
            {es.filters.reset}
          </Button>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <FilterBar ledger={ledger} span={span} />
        <p data-testid="mode-caption" className="text-xs text-muted-foreground">
          {ivaMode === "sin" ? es.iva.captionSin : es.iva.captionCon}
        </p>
        {view.selected.size > 0 ? (
          <p data-testid="category-caption" className="text-xs text-muted-foreground">
            {es.filters.categoryCaption}
          </p>
        ) : null}
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
          {range === null ? null : (
            <TrendChart series={series} promedio={current.promedio} range={range} />
          )}
          <div
            data-testid="category-supplier-row"
            className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2"
          >
            <CategorySpend rows={categories} nameOf={nameOf} />
            <SupplierRanking rows={ranking} />
          </div>
          <InvoiceTable rows={visible} ledger={ledger} mode={ivaMode} />
        </>
      )}
    </div>
  );
}
