/**
 * The ledger: one mode-independent entry per loaded invoice. Every view
 * (KPIs now; trend, ranking, table and quality panel in later plans) reads from
 * it. An invoice that cannot be summed stays in the ledger with a reason
 * instead of being dropped or throwing (D-35).
 *
 * All grouping uses Map and Set (never plain objects keyed by RFC, UUID or
 * name), so values such as "__proto__" are harmless (D-43). Nothing here
 * touches a Date or a floating-point number: months come from the literal
 * Fecha and amounts stay exact decimals.
 */
import type Big from "big.js";
import type { ParsedInvoice, TipoComprobante } from "../cfdi/types";
import type { LoadedInvoice } from "../import/types";
import { invoiceAmounts } from "./amounts";
import { ZERO } from "./decimal";
import { monthOfFecha, type MonthKey } from "./months";

/** Form-of-payment sentinel of a PPD invoice with no loaded Pago complement (D-17). */
export const PPD_SIN_COMPLEMENTO = "PPD_SIN_COMPLEMENTO";

/** TipoRelacion of a substitution: the related original is replaced (D-08). */
const TIPO_RELACION_SUSTITUCION = "04";

export type EntryKind =
  | "ingreso"
  | "nota-credito"
  | "pago"
  | "traslado"
  | "nomina";

/** Why an entry does not add to the spend; null when nothing prevents it. */
export type NoSuma = null | "tipo" | "cero" | "moneda-sin-tc" | "invalido";

export type Exclusion = null | "manual" | "sustituida";

export interface LedgerOverrides {
  excluded: ReadonlySet<string>;
  restored: ReadonlySet<string>;
}

export const EMPTY_OVERRIDES: LedgerOverrides = {
  excluded: new Set<string>(),
  restored: new Set<string>(),
};

export interface LedgerEntry {
  uuid: string;
  invoice: ParsedInvoice;
  kind: EntryKind;
  noSuma: NoSuma;
  /** XML attribute name that made the entry invalid, when noSuma is "invalido". */
  invalidField: string | null;
  exclusion: Exclusion;
  counted: boolean;
  conIva: Big | null;
  sinIva: Big | null;
  /** Supplier identity: the emisor RFC (D-43). */
  supplierRfc: string;
  /** Most frequent Nombre of that RFC among the loaded invoices; the RFC when none. */
  supplierName: string;
  /** Month of the invoice's own Fecha; null only when the Fecha is malformed. */
  ownMonth: MonthKey | null;
  /** Imputation month: ownMonth, except credit notes with a loaded related invoice (D-34). */
  month: MonthKey | null;
  /** Credit notes: loaded related invoices, oldest Fecha first, never itself; [] otherwise. */
  relatedLoaded: string[];
  /** Distinct UUIDs (other than its own) listed in the entry's relacionados, loaded or not. */
  relatedCount: number;
  /** SAT FormaPago codes ascending, or exactly [PPD_SIN_COMPLEMENTO]; [] when none (D-16, D-17). */
  formas: string[];
  /** First loaded invoice (load order) that lists this UUID in a TipoRelacion 04 group. */
  substitutedBy: string | null;
  /** UUIDs listed in this entry's own TipoRelacion 04 groups, loaded or not. */
  substitutes: string[];
}

function kindOf(tipo: TipoComprobante): EntryKind {
  switch (tipo) {
    case "I":
      return "ingreso";
    case "E":
      return "nota-credito";
    case "P":
      return "pago";
    case "T":
      return "traslado";
    case "N":
      return "nomina";
  }
}

/** Plain text order, enough for the fixed CFDI Fecha shape and the SAT codes. */
function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Distinct UUIDs listed in the given relacionados groups, excluding the invoice itself, in listing order. */
function listedUuids(
  invoice: ParsedInvoice,
  accept: (tipoRelacion: string) => boolean,
): string[] {
  const seen = new Set<string>();
  for (const group of invoice.relacionados) {
    if (!accept(group.tipoRelacion)) continue;
    for (const uuid of group.uuids) {
      if (uuid !== invoice.uuid) seen.add(uuid);
    }
  }
  return [...seen];
}

interface SubstitutionIndex {
  /** substituted UUID -> first loaded invoice (load order) that lists it. */
  substitutedBy: Map<string, string>;
  /** invoice UUID -> UUIDs listed in its own 04 groups. */
  substitutes: Map<string, string[]>;
}

function indexSubstitutions(
  invoices: readonly LoadedInvoice[],
): SubstitutionIndex {
  const substitutedBy = new Map<string, string>();
  const substitutes = new Map<string, string[]>();
  for (const { invoice } of invoices) {
    const listed = listedUuids(
      invoice,
      (tipo) => tipo === TIPO_RELACION_SUSTITUCION,
    );
    if (listed.length === 0) continue;
    substitutes.set(invoice.uuid, listed);
    for (const uuid of listed) {
      if (!substitutedBy.has(uuid)) substitutedBy.set(uuid, invoice.uuid);
    }
  }
  return { substitutedBy, substitutes };
}

/** document UUID -> forms of payment of every loaded Pago complement that references it (REGLA-09). */
function indexPaymentForms(
  invoices: readonly LoadedInvoice[],
): Map<string, Set<string>> {
  const forms = new Map<string, Set<string>>();
  for (const { invoice } of invoices) {
    if (invoice.tipo !== "P") continue;
    for (const pago of invoice.pagos) {
      for (const docto of pago.doctos) {
        const known = forms.get(docto.idDocumento);
        if (known === undefined) {
          forms.set(docto.idDocumento, new Set([pago.formaDePagoP]));
        } else {
          known.add(pago.formaDePagoP);
        }
      }
    }
  }
  return forms;
}

/** RFC -> display name: the most frequent Nombre, first seen on a tie, the RFC when none (D-43). */
function indexSupplierNames(
  invoices: readonly LoadedInvoice[],
): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const { invoice } of invoices) {
    const { rfc, nombre } = invoice.emisor;
    const perRfc = counts.get(rfc) ?? new Map<string, number>();
    counts.set(rfc, perRfc);
    if (nombre === null || nombre.trim() === "") continue;
    perRfc.set(nombre, (perRfc.get(nombre) ?? 0) + 1);
  }
  const names = new Map<string, string>();
  for (const [rfc, perRfc] of counts) {
    let best = rfc;
    let bestCount = 0;
    for (const [nombre, count] of perRfc) {
      if (count > bestCount) {
        best = nombre;
        bestCount = count;
      }
    }
    names.set(rfc, best);
  }
  return names;
}

function isPpd(invoice: ParsedInvoice): boolean {
  return invoice.metodoPago === "PPD" || invoice.formaPago === "99";
}

function formasOf(
  invoice: ParsedInvoice,
  paymentForms: Map<string, Set<string>>,
): string[] {
  if (isPpd(invoice)) {
    const known = paymentForms.get(invoice.uuid);
    if (known === undefined || known.size === 0) return [PPD_SIN_COMPLEMENTO];
    return [...known].sort(compareText);
  }
  return invoice.formaPago === null ? [] : [invoice.formaPago];
}

interface Imputation {
  relatedLoaded: string[];
  month: MonthKey | null;
}

/**
 * Imputation month (REGLA-02, D-34): a credit note goes to the month of its
 * loaded related invoice, the one with the oldest literal Fecha when there are
 * several; with none loaded (or none with a usable Fecha) it keeps its own.
 */
function imputationOf(
  invoice: ParsedInvoice,
  kind: EntryKind,
  ownMonth: MonthKey | null,
  byUuid: Map<string, ParsedInvoice>,
): Imputation {
  if (kind !== "nota-credito") return { relatedLoaded: [], month: ownMonth };
  const related: ParsedInvoice[] = [];
  for (const uuid of listedUuids(invoice, () => true)) {
    const found = byUuid.get(uuid);
    if (found !== undefined) related.push(found);
  }
  related.sort((a, b) => compareText(a.fecha, b.fecha));
  let month = ownMonth;
  for (const candidate of related) {
    const candidateMonth = monthOfFecha(candidate.fecha);
    if (candidateMonth !== null) {
      month = candidateMonth;
      break;
    }
  }
  return { relatedLoaded: related.map((r) => r.uuid), month };
}

interface Amounts {
  noSuma: NoSuma;
  invalidField: string | null;
  conIva: Big | null;
  sinIva: Big | null;
}

/**
 * Amounts and the reason an invoice does not sum, never throwing (D-35).
 * Precedence: tipo, invalid amount, invalid Fecha, moneda-sin-tc, cero. The
 * $0 rule looks at the converted Total only, so it never depends on the IVA
 * mode (REGLA-06, D-37).
 */
function amountsOf(
  invoice: ParsedInvoice,
  kind: EntryKind,
  ownMonth: MonthKey | null,
): Amounts {
  if (kind === "pago" || kind === "traslado" || kind === "nomina") {
    return { noSuma: "tipo", invalidField: null, conIva: null, sinIva: null };
  }
  const result = invoiceAmounts(invoice);
  if (!result.ok && result.reason === "invalido") {
    return {
      noSuma: "invalido",
      invalidField: result.field,
      conIva: null,
      sinIva: null,
    };
  }
  const conIva = result.ok ? result.amounts.conIva : null;
  const sinIva = result.ok ? result.amounts.sinIva : null;
  if (ownMonth === null) {
    return { noSuma: "invalido", invalidField: "Fecha", conIva, sinIva };
  }
  if (!result.ok) {
    return { noSuma: result.reason, invalidField: null, conIva, sinIva };
  }
  if (result.amounts.totalMxn.eq(ZERO)) {
    return { noSuma: "cero", invalidField: null, conIva, sinIva };
  }
  return { noSuma: null, invalidField: null, conIva, sinIva };
}

export function buildLedger(
  invoices: readonly LoadedInvoice[],
  overrides: LedgerOverrides,
): LedgerEntry[] {
  const byUuid = new Map<string, ParsedInvoice>();
  for (const { invoice } of invoices) {
    if (!byUuid.has(invoice.uuid)) byUuid.set(invoice.uuid, invoice);
  }
  const substitutions = indexSubstitutions(invoices);
  const paymentForms = indexPaymentForms(invoices);
  const supplierNames = indexSupplierNames(invoices);

  return invoices.map(({ invoice }) => {
    const kind = kindOf(invoice.tipo);
    const ownMonth = monthOfFecha(invoice.fecha);
    const { relatedLoaded, month } = imputationOf(invoice, kind, ownMonth, byUuid);
    const { noSuma, invalidField, conIva, sinIva } = amountsOf(invoice, kind, ownMonth);

    const substitutedBy = substitutions.substitutedBy.get(invoice.uuid) ?? null;
    let exclusion: Exclusion = null;
    if (overrides.excluded.has(invoice.uuid)) {
      exclusion = "manual";
    } else if (substitutedBy !== null && !overrides.restored.has(invoice.uuid)) {
      // D-42: the state of the substituting invoice is never consulted.
      exclusion = "sustituida";
    }

    return {
      uuid: invoice.uuid,
      invoice,
      kind,
      noSuma,
      invalidField,
      exclusion,
      counted: noSuma === null && exclusion === null,
      conIva,
      sinIva,
      supplierRfc: invoice.emisor.rfc,
      supplierName: supplierNames.get(invoice.emisor.rfc) ?? invoice.emisor.rfc,
      ownMonth,
      month,
      relatedLoaded,
      relatedCount: listedUuids(invoice, () => true).length,
      formas: formasOf(invoice, paymentForms),
      substitutedBy,
      substitutes: substitutions.substitutes.get(invoice.uuid) ?? [],
    };
  });
}
