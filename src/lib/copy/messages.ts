/**
 * Interpolated es-MX sentences and labels. Static strings live in `es.ts` and
 * value formatting (dates, money, folios) in `src/lib/format.ts`.
 */
import type { RejectReason, TipoComprobante } from "@/domain/cfdi/types";
import type {
  BatchSummary,
  DuplicateFile,
  IgnoredKind,
} from "@/domain/import/types";

/** Spanish reason shown next to a rejected file (D-14, D-15). */
export function rejectReasonText(
  reason: RejectReason | "unreadable",
  detail?: string,
): string {
  switch (reason) {
    case "cfdi-3x":
      return detail !== undefined && detail !== ""
        ? `Es CFDI ${detail}; solo se acepta 4.0`
        : "Versión de CFDI no admitida; solo se acepta 4.0";
    case "not-cfdi":
      return "No es un CFDI";
    case "malformed":
      return "XML dañado";
    case "no-timbre":
      return "Sin timbre fiscal (no es válido ante el SAT)";
    case "too-large":
      return "Archivo demasiado grande (máx. 2 MB)";
    case "unreadable":
      return "No se pudo leer el archivo";
  }
}

/** Spanish label of a TipoDeComprobante (D-17). */
export function tipoLabel(
  tipo: TipoComprobante,
): "Ingreso" | "Egreso" | "Pago" | "Traslado" | "Nómina" {
  switch (tipo) {
    case "I":
      return "Ingreso";
    case "E":
      return "Egreso";
    case "P":
      return "Pago";
    case "T":
      return "Traslado";
    case "N":
      return "Nómina";
  }
}

/** Batch summary after each selection (D-20): zero parts omitted, singular for 1. */
export function batchToastText(summary: BatchSummary): string {
  const { added, duplicates, rejected, ignored } = summary;
  const head =
    added === 0
      ? "No se agregó ninguna factura nueva"
      : added === 1
        ? "Se agregó 1"
        : `Se agregaron ${added}`;
  const parts = [head];
  if (duplicates > 0) {
    parts.push(`${duplicates} ${duplicates === 1 ? "duplicada" : "duplicadas"}`);
  }
  if (rejected > 0) {
    parts.push(`${rejected} ${rejected === 1 ? "rechazada" : "rechazadas"}`);
  }
  if (ignored > 0) {
    parts.push(`${ignored} ${ignored === 1 ? "ignorado" : "ignorados"}`);
  }
  return parts.join(", ");
}

/** Spanish reason shown next to an ignored file (D-12, D-13). */
export function ignoredReasonText(kind: IgnoredKind): string {
  switch (kind) {
    case "pdf":
      return "PDF (solo se leen los XML)";
    case "zip":
      return "Descomprime el ZIP y suelta la carpeta";
    case "other":
      return "No es un archivo XML";
  }
}

/** Duplicate row (D-18): the copy, its original and the first 8 UUID characters. */
export function duplicateRowText(duplicate: DuplicateFile): string {
  return `${duplicate.file.name} es la misma factura que ${duplicate.originalFile.name} (UUID ${duplicate.uuid.slice(0, 8)}…)`;
}

/** Row for an invoice whose receptor differs from the most frequent one (D-16). */
export function receptorDistintoText(fileName: string, rfc: string): string {
  return `${fileName}: Receptor distinto: ${rfc}`;
}

/** Progress while parsing (D-11). */
export function processingText(done: number, total: number): string {
  return `Procesando ${done} de ${total}`;
}

/** Accordion trigger: group name with its file count. */
export function groupTriggerText(label: string, count: number): string {
  return `${label} (${count})`;
}

/** Sub-label of the "Traslado y nómina" card (D-17). */
export function trasladoNominaSubLabel(traslado: number, nomina: number): string {
  return `Traslado: ${traslado}, Nómina: ${nomina}`;
}

/** Sub-label of the "Ignorados" card. */
export function ignoradosSubLabel(pdf: number, otros: number): string {
  return `PDF: ${pdf}, otros: ${otros}`;
}
