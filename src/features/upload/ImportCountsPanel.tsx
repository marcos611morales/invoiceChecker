"use client";

import type { ChangeEvent } from "react";
import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import type { ParseResult } from "@/domain/cfdi/types";
import { rejectReasonText } from "@/lib/copy/messages";
import { useSessionStore } from "@/stores/sessionStore";
import type { IgnoredFile, ParsedFile } from "@/stores/sessionStore";

// React's typings lack the non-standard webkitdirectory attribute (Pitfall 10).
const folderInputProps = { webkitdirectory: "" };

function isHidden(name: string): boolean {
  return name.startsWith(".") || name.toLowerCase() === "thumbs.db";
}

async function parseFile(file: File): Promise<ParseResult> {
  try {
    return parseCfdi(await file.text());
  } catch {
    return { ok: false, reason: "malformed", detail: "unreadable" };
  }
}

export function ImportCountsPanel() {
  const parsed = useSessionStore((s) => s.parsed);
  const ignored = useSessionStore((s) => s.ignored);
  const addBatch = useSessionStore((s) => s.addBatch);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = ""; // allow picking the same folder again
    const batchParsed: ParsedFile[] = [];
    const batchIgnored: IgnoredFile[] = [];
    for (const file of files) {
      if (isHidden(file.name)) continue; // D-12
      if (file.name.toLowerCase().endsWith(".xml")) {
        batchParsed.push({ name: file.name, result: await parseFile(file) });
      } else {
        batchIgnored.push({ name: file.name });
      }
    }
    addBatch(batchParsed, batchIgnored);
  }

  let ingreso = 0;
  let egreso = 0;
  let pago = 0;
  let traslado = 0;
  let nomina = 0;
  const rejected: { name: string; reason: string }[] = [];
  for (const { name, result } of parsed) {
    if (!result.ok) {
      rejected.push({
        name,
        reason:
          result.reason === "malformed" && result.detail === "unreadable"
            ? rejectReasonText("unreadable")
            : rejectReasonText(result.reason, result.detail),
      });
    } else if (result.invoice.tipo === "I") {
      ingreso += 1;
    } else if (result.invoice.tipo === "E") {
      egreso += 1;
    } else if (result.invoice.tipo === "P") {
      pago += 1;
    } else if (result.invoice.tipo === "T") {
      traslado += 1;
    } else {
      nomina += 1;
    }
  }

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
        {parsed.length} XML: Ingreso {ingreso}, Egreso {egreso}, Pago {pago},
        Traslado {traslado}, Nómina {nomina} · Rechazados {rejected.length} ·
        Ignorados {ignored.length}
      </p>
      {rejected.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-medium">Rechazados</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {rejected.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <span className="font-mono">{item.name}</span>: {item.reason}
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
