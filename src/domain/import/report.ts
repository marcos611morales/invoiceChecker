import type { FileRef, ImportState, LoadedInvoice } from "./types";

export interface ReportCounts {
  ingreso: number;
  egreso: number;
  pago: number;
  traslado: number;
  nomina: number;
  duplicados: number;
  rechazados: number;
  ignorados: number;
  ignoradosPdf: number;
  ignoradosOtros: number;
}

/** Counts by group over the accumulated session (D-17, D-19). Traslado and Nómina are counted, never spend. */
export function reportCounts(state: ImportState): ReportCounts {
  const counts: ReportCounts = {
    ingreso: 0,
    egreso: 0,
    pago: 0,
    traslado: 0,
    nomina: 0,
    duplicados: state.duplicates.length,
    rechazados: state.rejected.length,
    ignorados: state.ignored.length,
    ignoradosPdf: 0,
    ignoradosOtros: 0,
  };
  for (const { invoice } of state.invoices) {
    switch (invoice.tipo) {
      case "I":
        counts.ingreso += 1;
        break;
      case "E":
        counts.egreso += 1;
        break;
      case "P":
        counts.pago += 1;
        break;
      case "T":
        counts.traslado += 1;
        break;
      case "N":
        counts.nomina += 1;
        break;
    }
  }
  for (const item of state.ignored) {
    if (item.kind === "pdf") counts.ignoradosPdf += 1;
    else counts.ignoradosOtros += 1;
  }
  return counts;
}

/** Receptor RFC with the most invoices; ties go to the one seen first (D-16). Never hardcoded. */
export function receptorMasFrecuente(
  invoices: readonly LoadedInvoice[],
): string | null {
  // Map keeps insertion order, so the first RFC seen wins a tie.
  const counts = new Map<string, number>();
  for (const { invoice } of invoices) {
    const rfc = invoice.receptor.rfc;
    counts.set(rfc, (counts.get(rfc) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [rfc, count] of counts) {
    if (count > bestCount) {
      best = rfc;
      bestCount = count;
    }
  }
  return best;
}

/** Invoices whose receptor RFC differs from the most frequent one (D-16). */
export function receptorDistinto(
  invoices: readonly LoadedInvoice[],
): Array<{ file: FileRef; rfc: string }> {
  const main = receptorMasFrecuente(invoices);
  if (main === null) return [];
  const result: Array<{ file: FileRef; rfc: string }> = [];
  for (const { file, invoice } of invoices) {
    if (invoice.receptor.rfc !== main) {
      result.push({ file, rfc: invoice.receptor.rfc });
    }
  }
  return result;
}

/** True once any non-hidden file was processed in the session. */
export function hasReport(state: ImportState): boolean {
  return (
    state.invoices.length +
      state.duplicates.length +
      state.rejected.length +
      state.ignored.length >
    0
  );
}
