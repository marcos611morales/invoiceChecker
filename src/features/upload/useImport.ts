"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { es } from "@/lib/copy/es";
import { batchToastText } from "@/lib/copy/messages";
import { ingest } from "@/lib/client/ingest";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Runs one import batch into the session store (D-11, D-20): shows progress while
 * reading/parsing, one toast with the batch summary at the end, and an error toast
 * if the whole import fails. It never moves focus.
 */
export function useImport(): { run: (files: readonly File[]) => Promise<void> } {
  const run = useCallback(async (files: readonly File[]): Promise<void> => {
    const store = useSessionStore.getState();
    // A second selection while a batch is processing is ignored.
    if (store.progress.phase !== "idle") return;
    if (files.length === 0) return;

    // Captured before any await so a clear while parsing makes this batch stale (Pitfall 12).
    const generation = store.generation;
    const isCurrent = (): boolean =>
      useSessionStore.getState().generation === generation;

    store.setProgress({ phase: "listing" });
    try {
      const batch = await ingest(files, {
        onProgress: (done, total) => {
          if (isCurrent()) {
            useSessionStore
              .getState()
              .setProgress({ phase: "parsing", done, total });
          }
        },
        isCancelled: () => !isCurrent(),
      });
      if (batch !== null) {
        const summary = useSessionStore.getState().applyBatch(batch, generation);
        if (summary !== null) {
          toast(batchToastText(summary));
          // Only a finished batch switches the tab (D-44): Dashboard when the session holds
          // any invoice (even if this batch added none), Importación when it holds none.
          const loaded = useSessionStore.getState();
          loaded.setActiveTab(
            loaded.invoices.length > 0 ? "dashboard" : "importacion",
          );
        }
      }
    } catch {
      if (isCurrent()) toast.error(es.errors.importFailed);
    } finally {
      if (isCurrent()) useSessionStore.getState().setProgress({ phase: "idle" });
    }
  }, []);

  return { run };
}
