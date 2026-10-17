/**
 * Interpolated es-MX sentences and labels. Static strings live in `es.ts` and
 * value formatting (dates, money, folios) in `src/lib/format.ts`.
 */
import { monthYearLabel } from "@/lib/format";
import type { MonthKey } from "@/domain/accounting/months";
import type { IncidentType, SubstitutionState } from "@/domain/accounting/quality";
import type { RejectReason, TipoComprobante } from "@/domain/cfdi/types";
import type {
  BatchSummary,
  DuplicateFile,
  IgnoredKind,
} from "@/domain/import/types";
import { es } from "./es";

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

/** Heading of the invoices table: every row after the filters, summing or not (D-24). */
export function invoicesHeading(n: number): string {
  return `Facturas (${n})`;
}

/** Caption under the type badge of a credit note, with the imputation month label (D-15). */
export function appliesToText(monthLabel: string): string {
  return `aplica a ${monthLabel}`;
}

/** Panel line shown only when the concept sum and the invoice amount differ once rounded (D-25). */
export function roundingLine(amountText: string): string {
  return `Diferencia de redondeo: ${amountText}`;
}

/** Panel line of a PPD invoice with a loaded Pago complement (REGLA-09). */
export function paidLine(dateText: string, formaName: string): string {
  return `Pagada el ${dateText} con ${formaName}`;
}

/** Panel line of a substituted original (D-08). */
export function substitutedLine(ref: string): string {
  return `Sustituida por la factura ${ref}. No se suma.`;
}

/** Panel line of a foreign currency invoice that has an exchange rate (D-10). */
export function originalCurrencyLine(moneda: string, tc: string): string {
  return `Moneda original: ${moneda} \u00b7 TC ${tc}`;
}

/** Line under the MXN amount: the original amount, with the rate when there is one (D-10). */
export function foreignAmountLine(
  moneda: string,
  amountText: string,
  tc: string | null,
): string {
  return tc === null
    ? `${moneda} ${amountText}`
    : `${moneda} ${amountText} \u00b7 TC ${tc}`;
}

/** Visible and screen reader title of the concepts panel of one invoice (D-24). */
export function conceptsPanelTitle(ref: string): string {
  return `Conceptos de la factura ${ref}`;
}

/** Accessible name of the row menu trigger of one invoice. */
export function rowMenuAria(ref: string): string {
  return `Acciones de la factura ${ref}`;
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

/** Accessible name of the monthly trend chart (D-21). */
export function trendAriaLabel(from: MonthKey, to: MonthKey): string {
  return `Gasto por mes de ${monthYearLabel(from)} a ${monthYearLabel(to)}`;
}

/** Legend entry of the dashed average line, with the exact amount text (D-21). */
export function averageLegend(amountText: string): string {
  return `Promedio mensual: ${amountText}`;
}

/** Caption of a ranking row: share of the total and average ticket, already formatted (D-23). */
export function rankingCaption(pctText: string, ticketText: string): string {
  return `${pctText} del total · Ticket promedio ${ticketText}`;
}

/** Caption of a category row: share of the total and monthly average, already formatted (D-16). */
export function categoryCaption(pctText: string, promedioText: string): string {
  return `${pctText} del total · Promedio mensual ${promedioText}`;
}

// Calidad de datos: card and accordion titles and the sentence of every incident row (CAL-01).

/** Card and accordion title of an incident type (D-32, D-35, D-46). */
export function incidentTitle(type: IncidentType): string {
  switch (type) {
    case "nc-sin-relacionada":
      return es.quality.titles.ncSinRelacionada;
    case "nc-varias-relacionadas":
      return es.quality.titles.ncVariasRelacionadas;
    case "sustituciones":
      return es.quality.titles.sustituciones;
    case "moneda-sin-tc":
      return es.quality.titles.monedaSinTc;
    case "datos-invalidos":
      return es.quality.titles.datosInvalidos;
    case "cero":
      return es.quality.titles.cero;
    case "redondeo":
      return es.quality.titles.redondeo;
    case "ppd-sin-complemento":
      return es.quality.titles.ppd;
    case "excluidas":
      return es.quality.titles.excluidas;
    case "sustituidas":
      return es.quality.titles.sustituidas;
  }
}

/** Credit note without a loaded related invoice: it subtracts in its own month. */
export function ncSinRelacionadaRow(monthLabel: string): string {
  return `Se resta en su propia fecha (${monthLabel}) porque la factura relacionada no está cargada.`;
}

/** D-46: month of the oldest loaded related invoice and how many loaded ones decide it. */
export function ncVariasRelacionadasRow(monthLabel: string, n: number): string {
  return `Aplica a ${monthLabel}: la relacionada más antigua de ${n}`;
}

/** Substitution (TipoRelacion 04): the short UUID of the original and what became of it. */
export function sustitucionRow(shortUuid: string, state: SubstitutionState): string {
  const head = `Sustituye a la factura ${shortUuid}….`;
  switch (state) {
    case "excluida":
      return `${head} La original quedó excluida.`;
    case "no-cargada":
      return `${head} La original no está cargada.`;
    case "reincluida":
      return `${head} La original se volvió a incluir.`;
  }
}

export function ceroRow(): string {
  return "Total en $0: no cuenta en el número de facturas ni en los promedios.";
}

export function redondeoTotalRow(diffText: string): string {
  return `El Total del XML difiere en ${diffText} de Subtotal − Descuento + traslados − retenciones.`;
}

export function redondeoConceptosRow(diffText: string): string {
  return `La suma de los conceptos difiere en ${diffText} del Subtotal.`;
}

export function ppdRow(): string {
  return 'Pago en parcialidades o diferido sin complemento de pago cargado; en filtros aparece como "Por definir (sin complemento de pago)".';
}

export function monedaRow(moneda: string): string {
  return `${moneda} sin tipo de cambio: no se suma`;
}

/** Field name to its gendered label, built once; a Map so "__proto__" is just an unknown field (D-47). */
const INVALID_FIELD_LABELS = new Map<string, string>(es.quality.invalidFields);

/** "{label}: no se suma" with the label agreeing in gender with the damaged field (D-35, D-47). */
export function datosInvalidosRow(field: string | null): string {
  const label =
    (field === null ? undefined : INVALID_FIELD_LABELS.get(field)) ??
    es.quality.invalidFieldFallback;
  return `${label}: no se suma`;
}

export function excluidaRow(): string {
  return "Excluida por ti en esta sesión.";
}

export function sustituidaRow(ref: string): string {
  return substitutedLine(ref);
}

/** Visible text of the Calidad de datos tab trigger: the counter shows only above zero (D-04). */
export function qualityTabLabel(n: number): string {
  return n > 0 ? `${es.tabs.quality} · ${n}` : es.tabs.quality;
}

/** Accessible name of the Calidad de datos tab trigger; "1 incidencia" for one row (A-7). */
export function qualityTabAria(n: number): string {
  if (n <= 0) return es.tabs.quality;
  return n === 1
    ? `${es.tabs.quality}, 1 incidencia`
    : `${es.tabs.quality}, ${n} incidencias`;
}

/** Dashboard Alert when the filters hide the invoice that "Ver factura" asked for (UI-SPEC decision 6). */
export function hiddenInvoiceNotice(ref: string): string {
  return `La factura ${ref} no se ve porque los filtros la ocultan.`;
}

/** Accessible name of the default-category Select of one supplier row (UI-SPEC, Categoría por proveedor). */
export function supplierCategoryAria(name: string): string {
  return `Categoría por defecto de ${name}`;
}
