/**
 * Data-quality incidents derived from the ledger (CAL-01). RED stub: the types
 * and constants are final, the derivation functions are not implemented yet.
 */
import type Big from "big.js";
import type { LedgerEntry } from "./ledger";
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

export const AMOUNT_CHANGING_TYPES: ReadonlySet<IncidentType> = new Set<IncidentType>([
  "nc-sin-relacionada",
  "sustituciones",
  "moneda-sin-tc",
  "datos-invalidos",
]);

export type InvalidFieldName = "Total" | "SubTotal" | "Descuento" | "Importe" | "Fecha";

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
  key: string;
  type: IncidentType;
  entry: LedgerEntry;
  detail: IncidentDetail;
}

export interface QualitySummary {
  byType: ReadonlyMap<IncidentType, readonly Incident[]>;
  total: number;
  amountChanging: boolean;
}

export function qualityIncidents(_ledger: readonly LedgerEntry[]): Incident[] {
  return [];
}

export function qualitySummary(_ledger: readonly LedgerEntry[]): QualitySummary {
  return { byType: new Map(), total: 0, amountChanging: false };
}
