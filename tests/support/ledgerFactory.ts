import Big from "big.js";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import type { LoadedInvoice } from "@/domain/import/types";

let counter = 0;

/** A synthetic UUID shape that is never a real identifier; unique within the run. */
function nextUuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

/**
 * A complete, valid MXN Ingreso with a unique uuid unless one is given.
 * Override any field; nested objects are replaced, not merged.
 */
export function makeInvoice(overrides: Partial<ParsedInvoice> = {}): ParsedInvoice {
  return {
    uuid: nextUuid(),
    version: "4.0",
    fecha: "2025-01-15T10:00:00",
    tipo: "I",
    serie: null,
    folio: null,
    moneda: "MXN",
    tipoCambio: null,
    formaPago: "28",
    metodoPago: "PUE",
    subTotal: "100.00",
    descuento: null,
    total: "116.00",
    totalImpuestosTrasladados: "16.00",
    totalImpuestosRetenidos: null,
    impuestos: { traslados: [], retenciones: [] },
    emisor: { rfc: "EMI010101AAA", nombre: "Proveedor de prueba" },
    receptor: { rfc: "CAF010101AAA", nombre: "Coworking de prueba" },
    conceptos: [],
    relacionados: [],
    pagos: [],
    ...overrides,
  };
}

/** Wraps an invoice as the import layer stores it. */
export function loaded(invoice: ParsedInvoice): LoadedInvoice {
  return { file: { name: `${invoice.uuid}.xml`, path: `${invoice.uuid}.xml` }, invoice };
}

/**
 * A counted Ingreso entry. Amounts are Big values built from strings; override
 * any field (the entry's uuid and supplier follow `invoice` unless given).
 */
export function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  const invoice = overrides.invoice ?? makeInvoice(overrides.uuid === undefined ? {} : { uuid: overrides.uuid });
  return {
    uuid: invoice.uuid,
    invoice,
    kind: "ingreso",
    noSuma: null,
    invalidField: null,
    exclusion: null,
    counted: true,
    conIva: new Big("116.00"),
    sinIva: new Big("100.00"),
    supplierRfc: invoice.emisor.rfc,
    supplierName: invoice.emisor.nombre ?? invoice.emisor.rfc,
    ownMonth: "2025-01",
    month: "2025-01",
    relatedLoaded: [],
    relatedCount: 0,
    formas: invoice.formaPago === null ? [] : [invoice.formaPago],
    substitutedBy: null,
    substitutes: [],
    ...overrides,
  };
}
