"use client";

import { useRef, useState } from "react";
import { cn } from "cn";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { categoryOptions } from "@/domain/accounting/categories";
import { formaOptions, supplierOptions } from "@/domain/accounting/filters";
import { selectedNames } from "@/features/dashboard/MultiSelectFilter";
import { useDashboardView } from "@/features/dashboard/useDashboardView";
import { downloadBlob } from "@/lib/client/download";
import { es } from "@/lib/copy/es";
import { excelDownloadedToast, exportedAtText } from "@/lib/copy/messages";
import { formaPagoLabel } from "@/lib/format";
import { exportFileName } from "./fileName";
import { buildWorkbook, type WorkbookContext } from "./workbook";
import { writeWorkbook } from "./writeWorkbook";

/**
 * «Exportar a Excel» of the top bar (D-19, XLS-02). It reads the same `selectView` result as
 * the Dashboard through `useDashboardView`, so the file always holds the figures on screen, and
 * whichever tab is open it exports the Dashboard's filters and IVA mode.
 *
 * Everything happens in the browser: the workbook is built, written and handed to a temporary
 * download link; nothing is requested from a server or stored. While it runs the button stays
 * focusable but inert (aria-busy), and a second activation starts no second export. With no
 * invoice under the filters it is aria-disabled instead of disabled, so its Tooltip can still
 * explain why (D-24).
 */
export function ExportButton() {
  const { ledger, filters, settings, resolver, nameOf, mode, view } = useDashboardView();
  const [pending, setPending] = useState(false);
  // A ref, not the state, blocks a second activation in the same tick as the first.
  const running = useRef(false);
  const empty = view.visible.length === 0;

  async function run(): Promise<void> {
    if (running.current || empty) return;
    running.current = true;
    setPending(true);
    try {
      const ctx: WorkbookContext = {
        mode,
        nameOf,
        resolver,
        exportedAtText: exportedAtText(new Date()),
        supplierLabels: selectedNames(supplierOptions(ledger), filters.suppliers),
        // Parámetros must list the categories that produced the file (WR-01).
        categoryLabels: selectedNames(
          categoryOptions(ledger, resolver, settings.categories, nameOf),
          view.selected,
        ),
        formaLabels: selectedNames(formaOptions(ledger, formaPagoLabel), filters.formas),
      };
      const blob = await writeWorkbook(buildWorkbook(view, ctx));
      const name = exportFileName(view.range, mode);
      downloadBlob(blob, name);
      toast(excelDownloadedToast(name));
    } catch {
      toast(es.export.failed);
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={es.export.button}
            aria-busy={pending ? true : undefined}
            aria-disabled={empty ? true : undefined}
            onClick={() => {
              void run();
            }}
            className="h-9 max-lg:size-9 max-lg:px-0 max-sm:size-11"
          />
        }
      >
        {pending ? (
          <Spinner aria-hidden="true" role="presentation" />
        ) : (
          <FileSpreadsheet className="size-4" aria-hidden="true" />
        )}
        {/* Both labels share one grid cell, so the button keeps its width while it works. */}
        <span className="grid max-lg:sr-only">
          <span
            aria-hidden={pending ? true : undefined}
            className={cn("col-start-1 row-start-1", pending && "invisible")}
          >
            {es.export.button}
          </span>
          <span
            aria-hidden={pending ? undefined : true}
            className={cn("col-start-1 row-start-1", !pending && "invisible")}
          >
            {es.export.pending}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{empty ? es.export.disabledReason : es.export.button}</TooltipContent>
    </Tooltip>
  );
}
