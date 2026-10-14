"use client";

import type { ChangeEvent } from "react";
import { classifyFile } from "@/domain/import/classifyFile";
import { batchToastText, processingText } from "@/lib/copy/messages";
import { ingest } from "@/lib/client/ingest";
import { useSessionStore } from "@/stores/sessionStore";

// React's typings lack the non-standard webkitdirectory attribute (Pitfall 10).
const folderInputProps = { webkitdirectory: "" };

export function ImportCountsPanel() {
  const progress = useSessionStore((s) => s.progress);
  const lastSummary = useSessionStore((s) => s.lastSummary);

  const busy = progress.phase !== "idle";

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = ""; // allow picking the same folder again
    if (files.length === 0) return;

    // Captured before any await so a clear while parsing makes this batch stale (Pitfall 12).
    const store = useSessionStore.getState();
    const generation = store.generation;
    const isCurrent = () => useSessionStore.getState().generation === generation;
    const total = files.filter((file) => classifyFile(file.name) === "xml").length;

    store.setProgress({ phase: "parsing", done: 0, total });
    try {
      const batch = await ingest(files, {
        onProgress: (done, count) => {
          if (isCurrent()) {
            useSessionStore
              .getState()
              .setProgress({ phase: "parsing", done, total: count });
          }
        },
        isCancelled: () => !isCurrent(),
      });
      if (batch !== null) useSessionStore.getState().applyBatch(batch, generation);
    } finally {
      if (isCurrent()) useSessionStore.getState().setProgress({ phase: "idle" });
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Seleccionar archivos
          <input type="file" multiple disabled={busy} onChange={onPick} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Seleccionar carpeta
          <input
            type="file"
            multiple
            disabled={busy}
            {...folderInputProps}
            onChange={onPick}
          />
        </label>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm">
        {progress.phase === "parsing"
          ? processingText(progress.done, progress.total)
          : progress.phase === "listing"
            ? "Leyendo archivos…"
            : ""}
      </p>
      <p aria-live="polite" className="min-h-5 text-sm font-medium">
        {lastSummary !== null ? batchToastText(lastSummary) : ""}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Tus facturas se procesan en este navegador y no se suben a ningún
        servidor
      </p>
    </section>
  );
}
