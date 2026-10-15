"use client";

import { useMemo } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { buildLedger } from "@/domain/accounting/ledger";
import { qualitySummary } from "@/domain/accounting/quality";
import { reportCounts } from "@/domain/import/report";
import { es } from "@/lib/copy/es";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { QualityAccordions } from "./QualityAccordions";
import { QualityCards } from "./QualityCards";

/**
 * Calidad de datos panel (CAL-01, D-31): title, mode caption, one card per incident
 * type, and below them the accordions of the types that have rows. It reads the
 * whole unfiltered ledger, built from the session invoices plus the manual
 * exclusions and restorations exactly like the Dashboard (REGLA-08), so the Dashboard
 * filters never hide an incident. The panel only reports; it never changes an amount.
 */
export function QualityTab() {
  const invoices = useSessionStore((s) => s.invoices);
  const rejected = useSessionStore((s) => s.rejected);
  const duplicates = useSessionStore((s) => s.duplicates);
  const ignored = useSessionStore((s) => s.ignored);
  const firstFileByUuid = useSessionStore((s) => s.firstFileByUuid);
  const excluded = useSessionStore((s) => s.excluded);
  const restored = useSessionStore((s) => s.restored);
  const ivaMode = useSettingsStore((s) => s.ivaMode);

  const ledger = useMemo(
    () => buildLedger(invoices, { excluded, restored }),
    [invoices, excluded, restored],
  );
  const summary = useMemo(() => qualitySummary(ledger), [ledger]);
  const counts = reportCounts({
    invoices,
    rejected,
    duplicates,
    ignored,
    firstFileByUuid,
  });

  return (
    <section aria-labelledby="quality-heading" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 id="quality-heading" className="text-xl leading-[1.2] font-semibold">
          {es.quality.heading}
        </h2>
        <p className="text-sm">{es.quality.intro}</p>
        <p data-testid="mode-caption" className="text-xs text-muted-foreground">
          {ivaMode === "sin" ? es.iva.captionSin : es.iva.captionCon}
        </p>
      </div>
      <QualityCards
        summary={summary}
        duplicados={counts.duplicados}
        rechazados={counts.rechazados}
      />
      {summary.total === 0 ? (
        <Empty data-testid="quality-empty" className="border">
          <EmptyHeader>
            <EmptyTitle className="text-base">{es.quality.emptyHeading}</EmptyTitle>
            <EmptyDescription>{es.quality.emptyBody}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <QualityAccordions summary={summary} ledger={ledger} mode={ivaMode} />
      )}
    </section>
  );
}
