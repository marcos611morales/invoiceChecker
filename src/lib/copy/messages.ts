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

/** Heading of the loaded invoices table (D-21). */
export function facturasCargadasHeading(n: number): string {
  return `Facturas cargadas (${n})`;
}

/** Left side of the table pagination footer: "Mostrando 51–100 de 120" (D-23). */
export function paginationRangeText(a: number, b: number, n: number): string {
  if (a === b) return `Mostrando ${a} de ${n}`;
  return `Mostrando ${a}–${b} de ${n}`;
}

/** Page indicator of the table pagination footer (D-23). */
export function paginationPageText(p: number, total: number): string {
  return `Página ${p} de ${total}`;
}

/** Sub-label of the "Ignorados" card. */
export function ignoradosSubLabel(pdf: number, otros: number): string {
  return `PDF: ${pdf}, otros: ${otros}`;
}

/** Empty supplier search (UI-SPEC "Filters"). */
export function noSupplierMatch(text: string): string {
  return `Ningún proveedor coincide con «${text}». Revisa la búsqueda.`;
}

/** Empty forma de pago search (UI-SPEC "Filters"). */
export function noFormaMatch(text: string): string {
  return `Ninguna forma de pago coincide con «${text}». Revisa la búsqueda.`;
}

/** Filter option: name with its invoice count. */
export function optionLabel(name: string, count: number): string {
  return `${name} (${count})`;
}

/** Filter chip: label, the first `shown` names and "+N" for the rest. */
export function chipText(label: string, names: readonly string[], shown: number): string {
  const head = names.slice(0, shown).join(", ");
  const rest = names.length - shown;
  return rest > 0 ? `${label}: ${head} +${rest}` : `${label}: ${head}`;
}

/** Accessible name of a chip's remove button. */
export function removeChipAria(label: string): string {
  return `Quitar filtro ${label}`;
}

/** Mobile filters button, with the number of active filters when there are any. */
export function filtersButtonText(activeCount: number): string {
  return activeCount > 0 ? `Filtros \u00b7 ${activeCount}` : "Filtros";
}

/** Sub-label of the Facturas card: credit notes counted apart (D-18). */
export function notasSubLabel(n: number): string {
  return n === 1 ? "+1 nota de crédito" : `+${n} notas de crédito`;
}

/** Sub-label of the Promedio mensual card: the stated divisor (DASH-06). */
export function monthsSubLabel(n: number): string {
  return n === 1 ? "Entre 1 mes del calendario" : `Entre ${n} meses del calendario`;
}

/** Delta line of a KPI card: the signed percent against the previous period (D-20). */
export function deltaLine(percent: string, period: string): string {
  return `${percent} vs. ${period}`;
}
