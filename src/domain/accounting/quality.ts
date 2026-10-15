/**
 * Data-quality incidents derived from the ledger (CAL-01, REGLA-06). One pure
 * pass over the unfiltered ledger lists everything that can change or limit the
 * analysis, in ten fixed types. The panel only reports: no incident changes an
 * amount, and nothing here hides an invoice from the totals (D-09, D-35).
 *
 * Amounts are checked from the exact XML strings through `parseDecimal` and Big
 * comparisons; a value that does not parse skips that one check silently and
 * never throws (T-02-27). No Date and no floating-point number is involved, and
 * groupings use Map (UUIDs come from XML, D-43). An invoice may appear in
 * several types, and the counter counts rows, not invoices.
 */
import type Big from "big.js";
import type { ParsedInvoice } from "../cfdi/types";
import { ZERO, parseDecimal } from "./decimal";
import { PPD_SIN_COMPLEMENTO, type LedgerEntry } from "./ledger";
import type { MonthKey } from "./months";

export type IncidentType =
  | "nc-sin-relacionada"
  | "nc-varias-relacionadas"
  | "sustituciones"
  | "moneda-sin-tc"
  | "datos-invalidos"
  | "cero"
  | "redondeo"
  | "ppd-sin-complemento"
  | "excluidas"
  | "sustituidas";

/** Fixed order of cards and accordions (UI-SPEC order, D-35 after moneda, D-46 after the NC entry). */
export const INCIDENT_ORDER: readonly IncidentType[] = [
  "nc-sin-relacionada",
  "nc-varias-relacionadas",
  "sustituciones",
  "moneda-sin-tc",
  "datos-invalidos",
  "cero",
  "redondeo",
  "ppd-sin-complemento",
  "excluidas",
  "sustituidas",
];

/**
 * Types whose accordion opens by itself and that can raise the alert of D-04.
 * "nc-varias-relacionadas" is deliberately absent: the credit note already
 * subtracts in the month of its oldest loaded related invoice (D-46).
 */
export const AMOUNT_CHANGING_TYPES: ReadonlySet<IncidentType> = new Set<IncidentType>([
  "nc-sin-relacionada",
  "sustituciones",
  "moneda-sin-tc",
  "datos-invalidos",
]);

/** Closed list of XML attributes that can make an invoice unusable (never XML text). */
export type InvalidFieldName = "Total" | "SubTotal" | "Descuento" | "Importe" | "Fecha";

/** State of the original invoice named by a substitution. */
export type SubstitutionState = "no-cargada" | "excluida" | "reincluida";

export type IncidentDetail =
  | { kind: "nc-sin-relacionada"; month: MonthKey | null }
  | { kind: "nc-varias-relacionadas"; month: MonthKey | null; relatedLoadedCount: number }
  | { kind: "sustituciones"; targetUuid: string; state: SubstitutionState }
  | { kind: "moneda-sin-tc"; moneda: string }
  | { kind: "datos-invalidos"; field: InvalidFieldName | null }
  | { kind: "cero" }
  | { kind: "redondeo"; totalDiff: Big | null; conceptsDiff: Big | null }
  | { kind: "ppd-sin-complemento" }
  | { kind: "excluidas" }
  | { kind: "sustituidas"; substitutedBy: string | null };

export interface Incident {
  /** Unique within one result; stable for the same ledger. */
  key: string;
  type: IncidentType;
  entry: LedgerEntry;
  detail: IncidentDetail;
}

export interface QualitySummary {
  /** Every type is present, with [] when it has no rows. */
  byType: ReadonlyMap<IncidentType, readonly Incident[]>;
  /** Number of incident rows across the ten types. */
  total: number;
  /** An incident that can change the amounts the dashboard shows (D-04). */
  amountChanging: boolean;
}

/** An invoice is a rounding incident only when a difference is strictly greater than this (D-09). */
const ROUNDING_TOLERANCE = ZERO.plus("0.01");

function asInvalidField(value: string | null): InvalidFieldName | null {
  switch (value) {
    case "Total":
    case "SubTotal":
    case "Descuento":
    case "Importe":
    case "Fecha":
      return value;
    default:
      return null;
  }
}

/** An absent optional amount is zero; one that is present and not a decimal is unusable (null). */
function decimalOrZero(raw: string | null): Big | null {
  return raw === null ? ZERO : parseDecimal(raw);
}

/** |Total - (SubTotal - Descuento + traslados - retenciones)| when it exceeds the tolerance. */
function totalDifference(invoice: ParsedInvoice): Big | null {
  const total = parseDecimal(invoice.total);
  const subTotal = parseDecimal(invoice.subTotal);
  const descuento = decimalOrZero(invoice.descuento);
  const traslados = decimalOrZero(invoice.totalImpuestosTrasladados);
  const retenidos = decimalOrZero(invoice.totalImpuestosRetenidos);
  if (
    total === null ||
    subTotal === null ||
    descuento === null ||
    traslados === null ||
    retenidos === null
  ) {
    return null;
  }
  const expected = subTotal.minus(descuento).plus(traslados).minus(retenidos);
  const difference = total.minus(expected).abs();
  return difference.gt(ROUNDING_TOLERANCE) ? difference : null;
}

/** |sum of the concept importes - SubTotal| when it exceeds the tolerance. */
function conceptsDifference(invoice: ParsedInvoice): Big | null {
  if (invoice.conceptos.length === 0) return null;
  const subTotal = parseDecimal(invoice.subTotal);
  if (subTotal === null) return null;
  let conceptsTotal = ZERO;
  for (const concepto of invoice.conceptos) {
    const importe = parseDecimal(concepto.importe);
    if (importe === null) return null;
    conceptsTotal = conceptsTotal.plus(importe);
  }
  const difference = conceptsTotal.minus(subTotal).abs();
  return difference.gt(ROUNDING_TOLERANCE) ? difference : null;
}

function roundingDetail(entry: LedgerEntry): IncidentDetail | null {
  if (entry.kind !== "ingreso" && entry.kind !== "nota-credito") return null;
  const totalDiff = totalDifference(entry.invoice);
  const conceptsDiff = conceptsDifference(entry.invoice);
  if (totalDiff === null && conceptsDiff === null) return null;
  return { kind: "redondeo", totalDiff, conceptsDiff };
}

/** D-46: a counted credit note whose loaded related invoices fall in two or more different months. */
function variasRelacionadasDetail(
  entry: LedgerEntry,
  byUuid: ReadonlyMap<string, LedgerEntry>,
): IncidentDetail | null {
  if (entry.kind !== "nota-credito" || !entry.counted) return null;
  const months = new Set<MonthKey>();
  for (const uuid of entry.relatedLoaded) {
    const month = byUuid.get(uuid)?.ownMonth;
    if (month !== undefined && month !== null) months.add(month);
  }
  if (months.size < 2) return null;
  // The imputation month is the one the ledger already chose (oldest related invoice, D-34).
  return {
    kind: "nc-varias-relacionadas",
    month: entry.month,
    relatedLoadedCount: entry.relatedLoaded.length,
  };
}

function substitutionState(original: LedgerEntry | undefined): SubstitutionState {
  if (original === undefined) return "no-cargada";
  return original.exclusion === null ? "reincluida" : "excluida";
}

export function qualityIncidents(ledger: readonly LedgerEntry[]): Incident[] {
  const byUuid = new Map<string, LedgerEntry>();
  for (const entry of ledger) {
    if (!byUuid.has(entry.uuid)) byUuid.set(entry.uuid, entry);
  }
  const buckets = new Map<IncidentType, Incident[]>();
  for (const type of INCIDENT_ORDER) buckets.set(type, []);

  function add(type: IncidentType, entry: LedgerEntry, detail: IncidentDetail, suffix = ""): void {
    buckets.get(type)?.push({ key: `${type}:${entry.uuid}${suffix}`, type, entry, detail });
  }

  for (const entry of ledger) {
    if (entry.kind === "nota-credito" && entry.counted && entry.relatedLoaded.length === 0) {
      add("nc-sin-relacionada", entry, { kind: "nc-sin-relacionada", month: entry.ownMonth });
    }
    const varias = variasRelacionadasDetail(entry, byUuid);
    if (varias !== null) add("nc-varias-relacionadas", entry, varias);
    for (const targetUuid of entry.substitutes) {
      add(
        "sustituciones",
        entry,
        {
          kind: "sustituciones",
          targetUuid,
          state: substitutionState(byUuid.get(targetUuid)),
        },
        `:${targetUuid}`,
      );
    }
    if (entry.noSuma === "moneda-sin-tc") {
      add("moneda-sin-tc", entry, { kind: "moneda-sin-tc", moneda: entry.invoice.moneda });
    }
    if (entry.noSuma === "invalido") {
      add("datos-invalidos", entry, {
        kind: "datos-invalidos",
        field: asInvalidField(entry.invalidField),
      });
    }
    if (entry.noSuma === "cero") add("cero", entry, { kind: "cero" });
    const redondeo = roundingDetail(entry);
    if (redondeo !== null) add("redondeo", entry, redondeo);
    if (entry.formas.length === 1 && entry.formas[0] === PPD_SIN_COMPLEMENTO) {
      add("ppd-sin-complemento", entry, { kind: "ppd-sin-complemento" });
    }
    if (entry.exclusion === "manual") add("excluidas", entry, { kind: "excluidas" });
    if (entry.exclusion === "sustituida") {
      add("sustituidas", entry, { kind: "sustituidas", substitutedBy: entry.substitutedBy });
    }
  }

  const incidents: Incident[] = [];
  for (const type of INCIDENT_ORDER) incidents.push(...(buckets.get(type) ?? []));
  return incidents;
}

/** True when the incident can change the amounts shown (D-04, D-35, D-46). */
function changesAmounts(incident: Incident): boolean {
  if (!AMOUNT_CHANGING_TYPES.has(incident.type)) return false;
  // A substitution only changes amounts while its original is excluded.
  if (incident.detail.kind === "sustituciones") return incident.detail.state === "excluida";
  return true;
}

export function qualitySummary(ledger: readonly LedgerEntry[]): QualitySummary {
  const incidents = qualityIncidents(ledger);
  const grouped = new Map<IncidentType, Incident[]>();
  for (const type of INCIDENT_ORDER) grouped.set(type, []);
  for (const incident of incidents) grouped.get(incident.type)?.push(incident);
  return {
    byType: grouped,
    total: incidents.length,
    amountChanging: incidents.some(changesAmounts),
  };
}
