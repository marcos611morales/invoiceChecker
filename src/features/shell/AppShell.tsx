"use client";

import { ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasReport } from "@/domain/import/report";
import { ImportReport } from "@/features/report/ImportReport";
import { EmptyDropzone } from "@/features/upload/EmptyDropzone";
import { ProcessingIndicator } from "@/features/upload/ProcessingIndicator";
import { UploadRoot, useUpload } from "@/features/upload/UploadRoot";
import { es } from "@/lib/copy/es";
import { useSessionStore } from "@/stores/sessionStore";
import { TopBar } from "./TopBar";
import { useBeforeUnload } from "./useBeforeUnload";

/** Top bar button shown on the loaded screen only (D-10); inert while a batch runs. */
function AddInvoicesButton() {
  const { openFiles, processing } = useUpload();
  return (
    <Button
      type="button"
      disabled={processing}
      onClick={openFiles}
      className="h-9 max-sm:size-11 max-sm:px-0"
      aria-label={es.global.addInvoices}
    >
      <Upload className="size-4" aria-hidden="true" />
      <span className="max-sm:sr-only">{es.global.addInvoices}</span>
    </Button>
  );
}

export function AppShell() {
  // The report shows as soon as any non-hidden file was processed (D-10).
  const reportVisible = useSessionStore((s) => hasReport(s));
  // The unload warning keys on loaded invoices, not on the report (D-07b).
  const hasInvoices = useSessionStore((s) => s.invoices.length > 0);
  useBeforeUnload(hasInvoices);
  return (
    <UploadRoot>
      <TopBar actions={reportVisible ? <AddInvoicesButton /> : null} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pt-8 pb-16">
        <ProcessingIndicator />
        {reportVisible ? <ImportReport /> : <EmptyDropzone />}
        {reportVisible && (
          <footer className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3" aria-hidden="true" />
            <p>{es.global.privacyLine}</p>
          </footer>
        )}
      </main>
    </UploadRoot>
  );
}
