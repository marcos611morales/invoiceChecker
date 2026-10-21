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
import type { BackupFailure, BackupSummary } from "@/domain/settings/backup";
import type { AcceptProductError } from "@/domain/settings/products";
import { LIMITS } from "@/domain/settings/types";
import type { LlmFailure } from "@/lib/client/llmClient";
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

/** Second line of the Monto cell under the category filter: the invoice total behind the partial amount (D-14). */
export function partOfTotalText(totalText: string): string {
  return `de ${totalText} total`;
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

/** Empty category search (UI-SPEC "Filter by category"). */
export function noCategoryMatch(text: string): string {
  return `Ninguna categoría coincide con «${text}». Revisa la búsqueda.`;
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

/** Accessible name of a «Gasto por categoría» row button: it shows that category's invoices (D-18). */
export function viewCategoryInvoicesAria(name: string): string {
  return `Ver facturas de la categoría ${name}`;
}

/** Accessible name of a supplier ranking row button: it shows that supplier's invoices (D-18). */
export function viewSupplierInvoicesAria(name: string): string {
  return `Ver facturas de ${name}`;
}

/**
 * Sub-caption of the «Gasto por categoría» block (D-16, D-17): the calendar months behind the
 * monthly average and, when there is a variation pair, the two months it compares. Month labels
 * arrive formatted; null labels leave only the average part.
 */
export function categorySubCaption(
  months: number,
  lastLabel: string | null,
  previousLabel: string | null,
): string {
  const average = `Promedio mensual entre ${months === 1 ? "1 mes" : `${String(months)} meses`} del calendario`;
  if (lastLabel === null || previousLabel === null) return average;
  return `${average} · Variación: ${lastLabel} vs. ${previousLabel}`;
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

/** Longest description kept in the accessible name of a concept selector (UI-SPEC E7 long-text). */
const CONCEPT_ARIA_MAX = 60;

/** Accessible name of the category Select of one concept line: the description is cut at 60 characters with «…». */
export function conceptCategoryAria(descripcion: string): string {
  return `Categoría del concepto «${capCodePoints(descripcion, CONCEPT_ARIA_MAX)}»`;
}

/**
 * Cuts a text to at most `max` code points in total: a longer text keeps `max - 1` code
 * points plus «…», so the cap includes the ellipsis and an emoji is never split.
 */
function capCodePoints(text: string, max: number): string {
  const characters = Array.from(text);
  return characters.length > max ? `${characters.slice(0, max - 1).join("")}…` : text;
}

/** Longest description kept in the change toast, «…» included (UI-SPEC E7 long-text, user decision 2026-10-17). */
const CONCEPT_TOAST_MAX = 40;

/**
 * Toast after a concept category change (UI-SPEC Q5): «Categoría de «{descripción}» cambiada
 * a {categoría}». The description is cut at 40 characters in total, the last one being «…»,
 * by the same rule as the selector's aria-label; the category name is never cut.
 */
export function categoryChangedToast(descripcion: string, categoria: string): string {
  return `Categoría de «${capCodePoints(descripcion, CONCEPT_TOAST_MAX)}» cambiada a ${categoria}`;
}

/**
 * Start of the caption under an adjusted concept (D-09): «Aplica a 1 línea de» or
 * «Aplica a {n} líneas de»; the supplier name follows in its own truncating element.
 */
export function appliesToLinesText(n: number): string {
  return n === 1 ? "Aplica a 1 línea de" : `Aplica a ${String(n)} líneas de`;
}

/** Count under the «Mis categorías» heading: «1 categoría» or «{n} categorías». */
export function categoryCountLabel(n: number): string {
  return n === 1 ? "1 categoría" : `${String(n)} categorías`;
}

/**
 * Usage caption of one category row (UI-SPEC): «{n} proveedores · {m} conceptos» with
 * the singular forms, a zero part omitted and «Sin uso» when both are zero.
 */
export function usageCaption(suppliers: number, concepts: number): string {
  const parts: string[] = [];
  if (suppliers > 0) {
    parts.push(suppliers === 1 ? "1 proveedor" : `${String(suppliers)} proveedores`);
  }
  if (concepts > 0) {
    parts.push(concepts === 1 ? "1 concepto" : `${String(concepts)} conceptos`);
  }
  return parts.length === 0 ? es.categories.list.unused : parts.join(" · ");
}

/** `aria-label` of the pencil of one category row. */
export function renameCategoryAria(name: string): string {
  return `Renombrar categoría ${name}`;
}

/** `aria-label` of the trash button of one category row. */
export function deleteCategoryAria(name: string): string {
  return `Borrar categoría ${name}`;
}

/** `aria-label` of the inline rename input. */
export function renameInputAria(name: string): string {
  return `Nuevo nombre de la categoría ${name}`;
}

/** Polite announcement after adding a category. */
export function categoryAddedText(name: string): string {
  return `Categoría «${name}» agregada`;
}

/** Polite announcement after renaming a category. */
export function categoryRenamedText(name: string): string {
  return `Categoría renombrada a «${name}»`;
}

/** Title of the delete-category dialog. */
export function deleteCategoryTitle(name: string): string {
  return `¿Borrar la categoría «${name}»?`;
}

/**
 * Body of the delete-category dialog (D-05): what still points at the category, a zero
 * part omitted and the singular for one; the unused body when nothing does.
 */
export function deleteCategoryBody(suppliers: number, concepts: number): string {
  const parts: string[] = [];
  if (suppliers > 0) {
    parts.push(suppliers === 1 ? "1 proveedor" : `${String(suppliers)} proveedores`);
  }
  if (concepts > 0) {
    parts.push(concepts === 1 ? "1 concepto" : `${String(concepts)} conceptos`);
  }
  if (parts.length === 0) return es.dialogs.deleteCategory.unusedBody;
  return `La usan ${parts.join(" y ")}.`;
}

// Settings file: download toast, invalid-file Alert, replace dialog (D-07, D-08, UI-SPEC E3 and E4).

/** Toast after «Descargar ajustes». */
export function settingsDownloadedToast(name: string): string {
  return `Ajustes descargados: ${name}`;
}

/** Reason of an invalid settings file, the {motivo} of the Alert. */
export function backupReasonText(reason: BackupFailure): string {
  switch (reason) {
    case "not-invoicechecker":
      return es.categories.backup.reasons.notInvoiceChecker;
    case "damaged":
      return es.categories.backup.reasons.damaged;
    case "newer":
      return es.categories.backup.reasons.newer;
    case "too-large":
      return es.categories.backup.reasons.tooLarge;
  }
}

/** Text of the invalid-file Alert. The file name is user text, shown in full (E4 long-text). */
export function invalidFileText(name: string, motivo: string): string {
  return `No se pudo usar el archivo «${name}»: ${motivo}. Tus ajustes actuales no cambiaron.`;
}

/** {resumen} of the replace dialog: always the three parts, a zero reads «0 …» (D-08). */
export function replaceSummaryText(summary: BackupSummary): string {
  const suppliers =
    summary.suppliers === 1 ? "1 proveedor" : `${String(summary.suppliers)} proveedores`;
  const concepts =
    summary.concepts === 1
      ? "1 concepto ajustado"
      : `${String(summary.concepts)} conceptos ajustados`;
  return `${categoryCountLabel(summary.categories)}, ${suppliers}, ${concepts}`;
}

/** Body of the replace dialog. */
export function replaceSettingsBody(name: string, resumen: string): string {
  return `El archivo «${name}» contiene ${resumen}. Se reemplazarán tus categorías, las categorías de proveedores, los conceptos ajustados y el modo de IVA actuales. Si quieres conservarlos, descárgalos antes.`;
}

/** Success toast of the Excel export; the file name has a bounded pattern (E8 long-text). */
export function excelDownloadedToast(name: string): string {
  return `Excel descargado: ${name}`;
}

function twoDigits(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * «Exportado el» moment of the Parámetros sheet in the user's local time, dd/mm/aaaa hh:mm.
 * It is an instant on the clock, not a calendar day of an invoice, so local getters are right.
 */
export function exportedAtText(moment: Date): string {
  const day = twoDigits(moment.getDate());
  const month = twoDigits(moment.getMonth() + 1);
  const time = `${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}`;
  return `${day}/${month}/${String(moment.getFullYear())} ${time}`;
}

/** «Mes de la variación» of the Parámetros sheet: «dic 2025 vs. nov 2025» (last month vs. the one before). */
export function variationMonthText(last: string, previous: string): string {
  return `${last} vs. ${previous}`;
}

// Productos tab: free count, send summary, run line and failures (Phase 4, UI-SPEC Copywriting Contract).

/** Caption under «Agrupar productos»: «{n} descripciones sin agrupar», «1 descripción sin agrupar». */
export function freeDescriptionsCaption(n: number): string {
  return n === 1 ? "1 descripción sin agrupar" : `${String(n)} descripciones sin agrupar`;
}

/**
 * Summary of the send dialog (D-08, locked): the verb stays plural because two kinds of
 * data always travel; «1 descripción de concepto» and «1 nombre de proveedor» for one.
 */
export function groupSendSummary(descriptions: number, suppliers: number): string {
  const first =
    descriptions === 1
      ? "1 descripción de concepto"
      : `${String(descriptions)} descripciones de conceptos`;
  const second =
    suppliers === 1 ? "1 nombre de proveedor" : `${String(suppliers)} nombres de proveedor`;
  return `Se enviarán a DeepSeek ${first} y ${second}. No se envían RFC, UUID, montos, fechas ni folios.`;
}

/** Heading of the literal list in the send dialog. */
export function itemsGroupHeading(n: number): string {
  return `Descripciones y proveedores (${String(n)})`;
}

/** First line of the run status: «Agrupando productos · Lote {k} de {M}». */
export function runLine(kind: "group" | "categorize", k: number, total: number): string {
  const verb = kind === "group" ? "Agrupando productos" : "Sugiriendo categorías";
  return `${verb} · Lote ${String(k)} de ${String(total)}`;
}

/** The message already ends with its own period; the Alert adds the sentence about kept suggestions. */
export function stoppedText(k: number, total: number, message: string): string {
  return `Se detuvo el proceso en el lote ${String(k)} de ${String(total)}. ${message} Las sugerencias que ya llegaron se conservaron.`;
}

/** Our own message for each failure of a batch; an upstream detail never reaches the user. */
export function failureText(error: LlmFailure): string {
  const failures = es.products.failures;
  switch (error) {
    case "unauthorized":
      return failures.unauthorized;
    case "server_not_configured":
      return failures.serverNotConfigured;
    case "upstream_auth":
      return failures.upstreamAuth;
    case "upstream_balance":
      return failures.upstreamBalance;
    case "upstream_rate_limited":
    case "upstream_unavailable":
      return failures.overloaded;
    case "upstream_timeout":
      return failures.timeout;
    case "invalid_response":
    case "aborted":
      return failures.invalid;
    case "incomplete_response":
      return failures.incomplete;
    case "offline":
      return failures.offline;
    case "bad_request":
    case "payload_too_large":
    case "upstream_rejected":
      return failures.badRequest;
  }
}

/** Heading of the pending product cards: «Sugerencias de productos · {n}». */
export function productQueueHeading(n: number): string {
  return `Sugerencias de productos · ${String(n)}`;
}

/** Heading of «Mis productos»: «Mis productos · 1 producto» or «Mis productos · {n} productos». */
export function productsHeading(n: number): string {
  return `Mis productos · ${n === 1 ? "1 producto" : `${String(n)} productos`}`;
}

/** Members cell of a product row: «1 miembro» or «{n} miembros». */
export function membersCount(n: number): string {
  return n === 1 ? "1 miembro" : `${String(n)} miembros`;
}

/** Suppliers cell: the first two distinct names, then «+{k}» for the rest. */
export function suppliersCell(names: readonly string[]): string {
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${shown} +${String(names.length - 2)}` : shown;
}

/** `aria-label` of the expander button of a product row. */
export function expandMembersAria(name: string, open: boolean): string {
  return open ? `Ocultar miembros de ${name}` : `Ver miembros de ${name}`;
}

/** `aria-label` of the pencil of one product row. */
export function renameProductAria(name: string): string {
  return `Renombrar producto ${name}`;
}

/** `aria-label` of the trash button of one product row. */
export function deleteProductAria(name: string): string {
  return `Borrar producto ${name}`;
}

/** `aria-label` of the inline product rename input. */
export function renameProductInputAria(name: string): string {
  return `Nuevo nombre del producto ${name}`;
}

/** Toast after «Borrar producto»: the name is cut at 40 characters in total, «…» included. */
export function productDeletedToast(name: string): string {
  return `Producto «${capCodePoints(name, PRODUCT_TOAST_MAX)}» borrado`;
}

/**
 * Description line of that toast (D-15): «Sus {n} descripciones vuelven a quedar libres.»
 * The singular is the grammatical form of the same sentence.
 */
export function productFreedText(n: number): string {
  return n === 1
    ? "Su descripción vuelve a quedar libre."
    : `Sus ${String(n)} descripciones vuelven a quedar libres.`;
}

/** Toast when removing or moving the last member also deleted the product (UI-SPEC OQ5). */
export function productEmptiedToast(name: string): string {
  return `Producto «${capCodePoints(name, PRODUCT_TOAST_MAX)}» borrado porque se quedó sin descripciones`;
}

/** Longest description kept in the `aria-label` of a member action, «…» included (UI-SPEC: 60). */
const MEMBER_ARIA_MAX = 60;

/** `aria-label` of the «Mover a otro producto» button of one member. */
export function moveMemberAria(description: string): string {
  return `Mover «${capCodePoints(description, MEMBER_ARIA_MAX)}» a otro producto`;
}

/** `aria-label` of the «Quitar del producto» button of one member. */
export function removeMemberAria(description: string): string {
  return `Quitar «${capCodePoints(description, MEMBER_ARIA_MAX)}» del producto`;
}

/** Toast after taking a member out of a product (D-15): the description is cut at 40 characters. */
export function memberRemovedToast(description: string, product: string): string {
  return `«${capCodePoints(description, PRODUCT_TOAST_MAX)}» quitada de «${product}»`;
}

/** Toast after moving a member to another product (D-15): the description is cut at 40 characters. */
export function memberMovedToast(description: string, product: string): string {
  return `«${capCodePoints(description, PRODUCT_TOAST_MAX)}» movida a «${product}»`;
}

/** Empty text of the product picker: «Ningún producto coincide con «{texto}».» */
export function noProductMatches(text: string): string {
  return `Ningún producto coincide con «${text}».`;
}

/** Caption of a card member: the supplier and its loaded lines, «1 línea» for one (D-19). */
export function memberCaption(supplierName: string, lines: number): string {
  return lines === 1
    ? `${supplierName} · 1 línea`
    : `${supplierName} · ${String(lines)} líneas`;
}

/** Longest product name kept in the creation toast, «…» included (UI-SPEC: 40 characters). */
const PRODUCT_TOAST_MAX = 40;

/** Accessible name of «Aceptar» inside a card, so a list of buttons is unambiguous (UI-SPEC). */
export function acceptSuggestionAria(name: string): string {
  return `Aceptar la sugerencia «${name}»`;
}

/** Toast after «Aceptar»: the name is cut at 40 characters in total, the last one being «…». */
export function productCreatedToast(name: string): string {
  return `Producto «${capCodePoints(name, PRODUCT_TOAST_MAX)}» creado`;
}

/**
 * Polite announcement after «Aceptar»: «Producto «{nombre}» creado. Quedan {n} sugerencias.»
 * The singular («Queda 1 sugerencia.») and the empty queue («No quedan sugerencias.») are
 * the grammatical forms of the same sentence.
 */
export function productCreatedAnnouncement(name: string, remaining: number): string {
  const left =
    remaining === 0
      ? "No quedan sugerencias."
      : remaining === 1
        ? "Queda 1 sugerencia."
        : `Quedan ${String(remaining)} sugerencias.`;
  return `Producto «${name}» creado. ${left}`;
}

/** Text under a card's buttons when «Aceptar» is refused (UI-SPEC lines 264-268, E4). */
export function acceptErrorText(reason: AcceptProductError): string {
  const errors = es.products.queue.errors;
  switch (reason) {
    case "empty":
      return errors.empty;
    case "duplicate":
      return errors.duplicate;
    case "reserved":
      return errors.reserved;
    case "too-long":
      return errors.tooLong;
    case "limit":
      return `Alcanzaste el límite de ${LIMITS.products.toLocaleString("en-US")} productos. Borra alguno para aceptar más.`;
    case "members-taken":
    case "no-members":
      return errors.membersTaken;
  }
}
