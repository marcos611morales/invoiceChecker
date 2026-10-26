import type Big from "big.js";
import { ZERO, parseDecimal } from "@/domain/accounting/decimal";
import type { Concepto, Impuesto, ParsedInvoice } from "@/domain/cfdi/types";
import { normalizeDescription } from "@/domain/settings/normalize";
import type { Product } from "@/domain/settings/types";
import { makeInvoice } from "./ledgerFactory";

/**
 * A synthetic concept line: unit H87 (pieza), quantity 1, importe 100.00 and no taxes or
 * discount unless overridden. Override any field; nested arrays are replaced, not merged.
 */
export function makeConcepto(overrides: Partial<Concepto> = {}): Concepto {
  return {
    claveProdServ: "01010101",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: "Pieza",
    descripcion: "PRODUCTO DE PRUEBA",
    valorUnitario: "100.00",
    importe: "100.00",
    descuento: null,
    objetoImp: "01",
    traslados: [],
    retenciones: [],
    ...overrides,
  };
}

function sumOf(values: readonly (string | null)[]): Big {
  let total = ZERO;
  for (const value of values) {
    const parsed = parseDecimal(value);
    if (parsed !== null) total = total.plus(parsed);
  }
  return total;
}

function importesOf(taxes: readonly Impuesto[]): (string | null)[] {
  return taxes.map((tax) => tax.importe);
}

export interface PurchaseInvoiceInput {
  rfc: string;
  nombre: string;
  fecha?: string;
  folio?: string | null;
  tipo?: "I" | "E";
  conceptos: Concepto[];
}

/**
 * An invoice of one supplier whose SubTotal, Descuento, Total and tax totals are derived
 * exactly (big.js, from strings) from its concepts, so the ledger counts it as a normal Ingreso
 * (or Egreso with `tipo: "E"`). The invoice-level traslados are the concept traslados in order.
 */
export function purchaseInvoice(input: PurchaseInvoiceInput): ParsedInvoice {
  const { rfc, nombre, conceptos } = input;
  const subTotal = sumOf(conceptos.map((c) => c.importe));
  const hasDiscount = conceptos.some((c) => c.descuento !== null);
  const descuento = sumOf(conceptos.map((c) => c.descuento));
  const traslados = conceptos.flatMap((c) => c.traslados);
  const retenciones = conceptos.flatMap((c) => c.retenciones);
  const trasladado = sumOf(importesOf(traslados));
  const retenido = sumOf(importesOf(retenciones));
  const total = subTotal.minus(descuento).plus(trasladado).minus(retenido);
  return makeInvoice({
    tipo: input.tipo ?? "I",
    fecha: input.fecha ?? "2025-01-15T10:00:00",
    folio: input.folio ?? null,
    emisor: { rfc, nombre },
    conceptos,
    subTotal: subTotal.toString(),
    descuento: hasDiscount ? descuento.toString() : null,
    total: total.toString(),
    totalImpuestosTrasladados: traslados.length > 0 ? trasladado.toString() : null,
    totalImpuestosRetenidos: retenciones.length > 0 ? retenido.toString() : null,
    impuestos: { traslados, retenciones },
  });
}

/**
 * An accepted product whose members are keyed by the normalized description, the way the
 * settings store them. The id defaults to a slug of the name.
 */
export function makeProduct(
  name: string,
  members: readonly { rfc: string; descripcion: string; supplierName: string }[],
  id?: string,
): Product {
  return {
    id: id ?? `prod-${normalizeDescription(name).replace(/\s+/g, "-")}`,
    name,
    categoryId: null,
    members: members.map((member) => ({
      rfc: member.rfc,
      key: normalizeDescription(member.descripcion),
      description: member.descripcion,
      supplierName: member.supplierName,
    })),
  };
}
