/**
 * The ledger: one mode-independent entry per loaded invoice. Every view
 * (KPIs now; trend, ranking, table and quality panel in later plans) reads from
 * it. An invoice that cannot be summed stays in the ledger with a reason
 * instead of being dropped or throwing (D-35).
 */
import type Big from "big.js";
import type { ParsedInvoice, TipoComprobante } from "../cfdi/types";
import type { LoadedInvoice } from "../import/types";
import { invoiceAmounts } from "./amounts";
import type { MonthKey } from "./months";

/** Form-of-payment sentinel of a PPD invoice with no loaded Pago complement. */
export const PPD_SIN_COMPLEMENTO = "PPD_SIN_COMPLEMENTO";

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
  supplierRfc: string;
  supplierName: string;
  ownMonth: MonthKey | null;
  month: MonthKey | null;
  relatedLoaded: string[];
  relatedCount: number;
  formas: string[];
  substitutedBy: string | null;
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

function buildEntry(
  loaded: LoadedInvoice,
  overrides: LedgerOverrides,
): LedgerEntry {
  const { invoice } = loaded;
  const kind = kindOf(invoice.tipo);
  let noSuma: NoSuma = null;
  let invalidField: string | null = null;
  let conIva: Big | null = null;
  let sinIva: Big | null = null;

  if (kind === "pago" || kind === "traslado" || kind === "nomina") {
    noSuma = "tipo";
  } else {
    const result = invoiceAmounts(invoice);
    if (result.ok) {
      conIva = result.amounts.conIva;
      sinIva = result.amounts.sinIva;
    } else {
      noSuma = result.reason;
      invalidField = result.reason === "invalido" ? result.field : null;
    }
  }

  const exclusion: Exclusion = overrides.excluded.has(invoice.uuid)
    ? "manual"
    : null;
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
    supplierName: invoice.emisor.nombre ?? invoice.emisor.rfc,
    ownMonth: null,
    month: null,
    relatedLoaded: [],
    relatedCount: 0,
    formas: [],
    substitutedBy: null,
    substitutes: [],
  };
}

export function buildLedger(
  invoices: readonly LoadedInvoice[],
  overrides: LedgerOverrides,
): LedgerEntry[] {
  return invoices.map((loaded) => buildEntry(loaded, overrides));
}
