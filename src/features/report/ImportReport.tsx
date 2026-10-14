"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

  const busy = useSessionStore((s) => s.progress.phase !== "idle");
  const clearAll = useSessionStore((s) => s.clearAll);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dismissRef = useRef<HTMLButtonElement>(null);

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
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger
            render={<Button variant="outline" disabled={busy} />}
          >
            {es.global.resetAll}
          </AlertDialogTrigger>
          <AlertDialogContent initialFocus={dismissRef}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl leading-[1.2] font-semibold">
                {es.dialogs.resetAll.title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {es.dialogs.resetAll.body}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel ref={dismissRef}>
                {es.dialogs.resetAll.dismiss}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  clearAll();
                  setDialogOpen(false);
                }}
              >
                {es.dialogs.resetAll.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <SummaryCards counts={counts} />
      <ReportAccordions />
    </section>
  );
}
