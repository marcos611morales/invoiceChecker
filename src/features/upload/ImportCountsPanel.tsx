"use client";

import type { ChangeEvent } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { ProcessingIndicator } from "./ProcessingIndicator";
import { useImport } from "./useImport";

// React's typings lack the non-standard webkitdirectory attribute (Pitfall 10).
const folderInputProps = { webkitdirectory: "" };

export function ImportCountsPanel() {
  const busy = useSessionStore((s) => s.progress.phase !== "idle");
  const { run } = useImport();

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = ""; // allow picking the same folder again
    void run(files);
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
      <ProcessingIndicator />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Tus facturas se procesan en este navegador y no se suben a ningún
        servidor
      </p>
    </section>
  );
}
