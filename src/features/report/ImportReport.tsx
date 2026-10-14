"use client";

import { reportCounts } from "@/domain/import/report";
import { es } from "@/lib/copy/es";
import { useSessionStore } from "@/stores/sessionStore";
import { ReportAccordions } from "./ReportAccordions";
import { SummaryCards } from "./SummaryCards";

/** Import report of the whole session: header, summary cards and ordered accordions (D-19). */
export function ImportReport() {
  const invoices = useSessionStore((s) => s.invoices);
  const rejected = useSessionStore((s) => s.rejected);
  const duplicates = useSessionStore((s) => s.duplicates);
  const ignored = useSessionStore((s) => s.ignored);
  const firstFileByUuid = useSessionStore((s) => s.firstFileByUuid);

  const counts = reportCounts({
    invoices,
    rejected,
    duplicates,
    ignored,
    firstFileByUuid,
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl leading-[1.2] font-semibold">
          {es.report.heading}
        </h2>
      </div>
      <SummaryCards counts={counts} />
      <ReportAccordions />
    </section>
  );
}
