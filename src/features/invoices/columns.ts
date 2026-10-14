import {
  constructSortFn,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { LoadedInvoice } from "@/domain/import/types";
import { es } from "@/lib/copy/es";
import { tipoLabel } from "@/lib/copy/messages";

/**
 * One display row of the "Facturas cargadas" table (D-21). Every value is what
 * the XML states; nothing here is computed from other invoices (D-22).
 */
export interface InvoiceRow {
  id: string;
  /** Literal CFDI `Fecha` (ISO, no zone); sorted as a string (D-23). */
  fecha: string;
  proveedor: string;
  tipo: string;
  /** `undefined` (not null) when absent so `sortUndefined: "last"` applies. */
  folio: string | undefined;
  /** Exact XML total string. */
  total: string;
  moneda: string;
  conceptos: number;
}

/** Maps the session invoices to display rows. */
export function toInvoiceRows(
  invoices: readonly LoadedInvoice[],
): InvoiceRow[] {
  return invoices.map(({ invoice }) => ({
    id: invoice.uuid,
    fecha: invoice.fecha,
    proveedor: invoice.emisor.nombre ?? invoice.emisor.rfc,
    tipo: tipoLabel(invoice.tipo),
    folio: invoice.folio === null || invoice.folio === "" ? undefined : invoice.folio,
    total: invoice.total,
    moneda: invoice.moneda,
    conceptos: invoice.conceptos.length,
  }));
}

// Module scope on purpose: stable references keep TanStack from re-running the
// row models on every render (Pitfall 9).
const collator = new Intl.Collator("es", { sensitivity: "base" });

const sortFn_es = constructSortFn({
  resolveDataValue: (value) => String(value ?? ""),
  sort: (a, b) => collator.compare(String(a), String(b)),
});

/** Sorting only in this plan; Plan 01-15 adds pagination. */
export const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text, es: sortFn_es },
});

const helper = createColumnHelper<typeof features, InvoiceRow>();

export const columns = helper.columns([
  helper.accessor("fecha", {
    id: "fecha",
    header: es.table.columns.date,
    sortFn: "text",
  }),
  helper.accessor("proveedor", {
    id: "proveedor",
    header: es.table.columns.supplier,
    sortFn: "es",
  }),
  helper.accessor("tipo", {
    id: "tipo",
    header: es.table.columns.type,
    sortFn: "es",
  }),
  helper.accessor("folio", {
    id: "folio",
    header: es.table.columns.folio,
    sortFn: "text",
    sortUndefined: "last",
  }),
  helper.accessor((row) => Number(row.total), {
    id: "total",
    header: es.table.columns.total,
    sortFn: "basic",
  }),
  helper.accessor("conceptos", {
    id: "conceptos",
    header: es.table.columns.concepts,
    sortFn: "basic",
  }),
]);
