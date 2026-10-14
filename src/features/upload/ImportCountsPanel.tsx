"use client";

import type { ChangeEvent } from "react";
import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import { classifyFile } from "@/domain/import/classifyFile";
import { reportCounts } from "@/domain/import/report";
import type { BatchEntry, FileRef } from "@/domain/import/types";
import { rejectReasonText } from "@/lib/copy/messages";
import { useSessionStore } from "@/stores/sessionStore";

// React's typings lack the non-standard webkitdirectory attribute (Pitfall 10).
const folderInputProps = { webkitdirectory: "" };

function fileRef(file: File): FileRef {
  return {
    name: file.name,
    path: file.webkitRelativePath !== "" ? file.webkitRelativePath : file.name,
  };
}

async function toEntry(file: File): Promise<BatchEntry | null> {
  const kind = classifyFile(file.name);
  if (kind === "hidden") return null; // D-12: dropped, not listed
  const ref = fileRef(file);
  if (kind !== "xml") return { kind: "ignored", file: ref, ignoredKind: kind };
  try {
    return { kind: "parsed", file: ref, result: parseCfdi(await file.text()) };
  } catch {
    return { kind: "unreadable", file: ref };
  }
}

export function ImportCountsPanel() {
  const invoices = useSessionStore((s) => s.invoices);
  const rejected = useSessionStore((s) => s.rejected);
  const duplicates = useSessionStore((s) => s.duplicates);
  const ignored = useSessionStore((s) => s.ignored);
  const firstFileByUuid = useSessionStore((s) => s.firstFileByUuid);
  const applyBatch = useSessionStore((s) => s.applyBatch);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = ""; // allow picking the same folder again
    // Captured before any await so a clear while parsing makes this batch stale.
    const generation = useSessionStore.getState().generation;
    const batch: BatchEntry[] = [];
    for (const file of files) {
      const entry = await toEntry(file);
      if (entry !== null) batch.push(entry);
    }
    applyBatch(batch, generation);
  }

  const counts = reportCounts({
    invoices,
    rejected,
    duplicates,
    ignored,
    firstFileByUuid,
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Seleccionar archivos
          <input type="file" multiple onChange={onPick} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Seleccionar carpeta
          <input type="file" multiple {...folderInputProps} onChange={onPick} />
        </label>
      </div>
      <p aria-live="polite">
        {invoices.length} XML: Ingreso {counts.ingreso}, Egreso {counts.egreso},
        Pago {counts.pago}, Traslado {counts.traslado}, Nómina {counts.nomina}
        {" · "}Duplicados {counts.duplicados} · Rechazados {counts.rechazados} ·
        Ignorados {counts.ignorados} (PDF {counts.ignoradosPdf}, otros{" "}
        {counts.ignoradosOtros})
      </p>
      {rejected.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-medium">Rechazados</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {rejected.map((item, index) => (
              <li key={`${item.file.path}-${index}`}>
                <span className="font-mono">{item.file.name}</span>:{" "}
                {rejectReasonText(item.reason, item.detail)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Tus facturas se procesan en este navegador y no se suben a ningún
        servidor
      </p>
    </section>
  );
}
