/**
 * Purchases of accepted products (Phase 5, D-02, D-03, D-06). A purchase is one concept line of
 * a counted invoice of kind ingreso whose supplier and normalized description are a member of an
 * accepted product. The input is the filtered, category-scoped entry list the Dashboard uses
 * (FILT-05), so a date, supplier or category filter changes the purchases exactly like the figures.
 */
import type Big from "big.js";
import type { IvaMode } from "../accounting/aggregate";
import type { ScopedEntry } from "../accounting/categories";
import { conceptAmounts } from "../accounting/amounts";
import { normalizeDescription, ruleMapKey } from "../settings/normalize";
import type { Product } from "../settings/types";

export interface Purchase {
  productId: string;
  productName: string;
  storeRfc: string;
  storeName: string;
  /** `ruleMapKey(storeRfc, normalizeDescription(descripcion))`: the member identity. */
  memberKey: string;
  descripcion: string;
  claveProdServ: string;
  claveUnidad: string;
  cantidad: string;
  /** The literal invoice Fecha (`YYYY-MM-DDTHH:mm:ss`), never parsed as a Date. */
  fecha: string;
  folio: string | null;
  uuid: string;
  /** Index of the concepto in XML order. */
  conceptIndex: number;
  /** Net amount of the line in the active IVA mode (discount applied); null when unusable. */
  amount: Big | null;
}

/** Member identity to product. A member belongs to one product (Phase 4 D-10). */
export function productIndex(products: readonly Product[]): Map<string, Product> {
  const index = new Map<string, Product>();
  for (const product of products) {
    for (const member of product.members) {
      index.set(ruleMapKey(member.rfc, member.key), product);
    }
  }
  return index;
}

/**
 * Purchases of the accepted products. Only counted invoices of kind ingreso count: `counted`
 * alone is also true for credit notes, which would enter with a negative amount (D-06).
 * The amount is `conceptAmounts(...)` Con IVA or Sin IVA by mode, which already applies the
 * line discount (the ValorUnitario-based field ignores it).
 */
export function extractPurchases(
  entries: readonly ScopedEntry[],
  mode: IvaMode,
  index: ReadonlyMap<string, Product>,
): Purchase[] {
  const purchases: Purchase[] = [];
  for (const entry of entries) {
    if (!(entry.counted && entry.kind === "ingreso")) continue;
    for (const part of entry.parts) {
      if (part.concept === null) continue;
      const concepto = entry.invoice.conceptos[part.concept];
      if (concepto === undefined) continue;
      const memberKey = ruleMapKey(entry.supplierRfc, normalizeDescription(concepto.descripcion));
      const product = index.get(memberKey);
      if (product === undefined) continue;
      const amounts = conceptAmounts(concepto, entry.invoice);
      purchases.push({
        productId: product.id,
        productName: product.name,
        storeRfc: entry.supplierRfc,
        storeName: entry.supplierName,
        memberKey,
        descripcion: concepto.descripcion,
        claveProdServ: concepto.claveProdServ,
        claveUnidad: concepto.claveUnidad,
        cantidad: concepto.cantidad,
        fecha: entry.invoice.fecha,
        folio: entry.invoice.folio,
        uuid: entry.uuid,
        conceptIndex: part.concept,
        amount: mode === "con" ? amounts.conIva : amounts.sinIva,
      });
    }
  }
  return purchases;
}
