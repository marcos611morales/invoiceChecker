/**
 * Price comparison of accepted products between stores (Phase 5, D-10 to D-12, D-20, D-21, D-26,
 * D-29, D-30). Pure and exact: every amount is `Big` built from strings, nothing is rounded here
 * (rounding happens only when a figure is displayed).
 *
 * Per product: each purchase gets a content (kg, L or pieces), pieces without a verified size are
 * dropped when any purchase has a size (D-10), the family with the most purchases is compared
 * (D-12), the price of a purchase is its net amount divided by its content, each store gets a
 * minimum, median and last price, the cheapest store is the one with the lowest median (D-20) and
 * the estimated saving adds up what the other stores' purchases cost above that median (D-21).
 */
import type Big from "big.js";
import { ZERO } from "../accounting/decimal";
import type { Product } from "../settings/types";
import { resolveContent, type ContentSource, type NotNormalizedReason } from "./content";
import type { Purchase } from "./purchases";
import type { UnitFamily } from "./units";

export type ComparedPurchase = Purchase &
  (
    | {
        status: "compared";
        family: UnitFamily;
        /** Kg, L or pieces bought. */
        content: Big;
        /** Net amount divided by content, unrounded. */
        price: Big;
        sized: boolean;
        source: ContentSource;
      }
    | {
        status: "not-normalized";
        reason: NotNormalizedReason;
        family: UnitFamily | null;
        content: Big | null;
      }
  );

export interface StoreStats {
  rfc: string;
  name: string;
  count: number;
  min: Big;
  median: Big;
  /** Price of the purchase with the latest literal Fecha. */
  last: Big;
  lastFecha: string;
}

export interface ProductComparison {
  productId: string;
  name: string;
  /** The compared family; null when no purchase could be normalized. */
  family: UnitFamily | null;
  /** True when the compared purchases are pieces without a verified size (D-10). */
  perPiece: boolean;
  /** Median ascending, cheapest first. */
  stores: StoreStats[];
  /** Null below 2 stores (D-02). */
  cheapest: StoreStats | null;
  /** True when the cheapest store won a tie on the median by having more purchases (D-20). */
  decidedByCount: boolean;
  /** Estimated saving (D-21); null without a cheapest store. */
  saving: Big | null;
  /** Fecha descending. */
  purchases: ComparedPurchase[];
  notNormalizedCount: number;
  otherFamilies: { family: UnitFamily; count: number }[];
}

export interface SavingsSummary {
  total: Big;
  /** Products with 2 or more stores. */
  products: number;
  /** Of those, the ones compared per piece without a verified size (D-23). */
  perPieceProducts: number;
}

/** Fixed family order of the tie rule D-29: kg, then L, then pieza. */
const FAMILY_ORDER: readonly UnitFamily[] = ["mass", "volume", "piece"];

/** Spanish order, accents and case ignored (D-30). */
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

/** Median of an ascending list; the even case is the exact mean of the two middle values. */
export function median(sorted: readonly Big[]): Big | null {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  const hi = sorted[mid];
  if (hi === undefined) return null;
  if (n % 2 === 1) return hi;
  const lo = sorted[mid - 1];
  if (lo === undefined) return null;
  return lo.plus(hi).div("2");
}

type Compared = Extract<ComparedPurchase, { status: "compared" }>;
type NotNormalized = Extract<ComparedPurchase, { status: "not-normalized" }>;

/** A purchase with a usable content and amount, before the D-10 and D-12 rules. */
interface Candidate {
  purchase: Purchase;
  family: UnitFamily;
  content: Big;
  amount: Big;
  sized: boolean;
  source: ContentSource;
}

function notNormalized(
  purchase: Purchase,
  reason: NotNormalizedReason,
  family: UnitFamily | null,
  content: Big | null,
): NotNormalized {
  return { ...purchase, status: "not-normalized", reason, family, content };
}

function chooseFamily(candidates: readonly Candidate[]): UnitFamily | null {
  const purchasesBy = new Map<UnitFamily, number>();
  const storesBy = new Map<UnitFamily, Set<string>>();
  for (const candidate of candidates) {
    purchasesBy.set(candidate.family, (purchasesBy.get(candidate.family) ?? 0) + 1);
    const stores = storesBy.get(candidate.family) ?? new Set<string>();
    stores.add(candidate.purchase.storeRfc);
    storesBy.set(candidate.family, stores);
  }
  let best: UnitFamily | null = null;
  let bestPurchases = 0;
  let bestStores = 0;
  // FAMILY_ORDER is walked in order and only a strictly better family replaces the current one,
  // so the fixed order kg > L > pieza decides the last tie (D-29).
  for (const family of FAMILY_ORDER) {
    const count = purchasesBy.get(family) ?? 0;
    if (count === 0) continue;
    const stores = storesBy.get(family)?.size ?? 0;
    if (count > bestPurchases || (count === bestPurchases && stores > bestStores)) {
      best = family;
      bestPurchases = count;
      bestStores = stores;
    }
  }
  return best;
}

function storeStats(group: readonly Compared[]): StoreStats | null {
  const first = group[0];
  if (first === undefined) return null;
  const prices = group.map((p) => p.price).sort((a, b) => a.cmp(b));
  const min = prices[0];
  const mid = median(prices);
  if (min === undefined || mid === null) return null;
  let latest = first;
  for (const purchase of group) {
    if (purchase.fecha > latest.fecha) latest = purchase;
  }
  return {
    rfc: first.storeRfc,
    name: first.storeName,
    count: group.length,
    min,
    median: mid,
    last: latest.price,
    lastFecha: latest.fecha,
  };
}

/** Median ascending; equal medians: more purchases first (D-20), then the es name order (D-30). */
function compareStores(a: StoreStats, b: StoreStats): number {
  const byMedian = a.median.cmp(b.median);
  if (byMedian !== 0) return byMedian;
  if (a.count !== b.count) return b.count - a.count;
  return COLLATOR.compare(a.name, b.name);
}

/** D-21: only the purchases of the other stores, only positive differences, exact. */
function estimatedSaving(
  purchases: readonly Compared[],
  cheapestRfc: string,
  cheapestMedian: Big,
): Big {
  let total = ZERO;
  for (const purchase of purchases) {
    if (purchase.storeRfc === cheapestRfc) continue;
    const difference = purchase.price.minus(cheapestMedian);
    if (difference.gt(ZERO)) total = total.plus(difference.times(purchase.content));
  }
  return total;
}

/** Comparison of one product over its purchases (already filtered by the caller). */
export function compareProduct(
  product: Product,
  purchases: readonly Purchase[],
): ProductComparison {
  const rejected: NotNormalized[] = [];
  let candidates: Candidate[] = [];

  // Content and amount of every purchase. A zero or negative net amount never becomes a price (D-26).
  for (const purchase of purchases) {
    const content = resolveContent(purchase);
    if (!content.ok) {
      rejected.push(notNormalized(purchase, content.reason, null, null));
      continue;
    }
    const { amount } = purchase;
    if (amount === null || amount.lt(ZERO)) {
      rejected.push(notNormalized(purchase, "bad-amount", content.family, content.amount));
    } else if (amount.eq(ZERO)) {
      rejected.push(notNormalized(purchase, "zero-amount", content.family, content.amount));
    } else {
      candidates.push({
        purchase,
        family: content.family,
        content: content.amount,
        amount,
        sized: content.sized,
        source: content.source,
      });
    }
  }

  // D-10: pieces without a verified size are dropped when any purchase of the product has a size.
  if (candidates.some((c) => c.sized)) {
    const kept: Candidate[] = [];
    for (const candidate of candidates) {
      if (candidate.sized) kept.push(candidate);
      else {
        rejected.push(
          notNormalized(
            candidate.purchase,
            "unsized-with-sized-siblings",
            candidate.family,
            candidate.content,
          ),
        );
      }
    }
    candidates = kept;
  }

  // D-12: only the family with the most purchases is compared.
  const family = chooseFamily(candidates);
  const compared: Compared[] = [];
  for (const candidate of candidates) {
    if (candidate.family !== family) {
      rejected.push(
        notNormalized(candidate.purchase, "other-family", candidate.family, candidate.content),
      );
      continue;
    }
    compared.push({
      ...candidate.purchase,
      status: "compared",
      family: candidate.family,
      content: candidate.content,
      price: candidate.amount.div(candidate.content),
      sized: candidate.sized,
      source: candidate.source,
    });
  }

  const groups = new Map<string, Compared[]>();
  for (const purchase of compared) {
    const group = groups.get(purchase.storeRfc) ?? [];
    group.push(purchase);
    groups.set(purchase.storeRfc, group);
  }
  const stores: StoreStats[] = [];
  for (const group of groups.values()) {
    const stats = storeStats(group);
    if (stats !== null) stores.push(stats);
  }
  stores.sort(compareStores);

  const [top, second] = stores;
  const cheapest = top !== undefined && second !== undefined ? top : null;
  const decidedByCount =
    cheapest !== null &&
    second !== undefined &&
    cheapest.median.eq(second.median) &&
    cheapest.count !== second.count;
  const saving =
    cheapest === null ? null : estimatedSaving(compared, cheapest.rfc, cheapest.median);

  const otherCounts = new Map<UnitFamily, number>();
  for (const purchase of rejected) {
    if (purchase.reason === "other-family" && purchase.family !== null) {
      otherCounts.set(purchase.family, (otherCounts.get(purchase.family) ?? 0) + 1);
    }
  }
  const otherFamilies = FAMILY_ORDER.flatMap((other) => {
    const count = otherCounts.get(other);
    return count === undefined ? [] : [{ family: other, count }];
  });

  const all: ComparedPurchase[] = [...compared, ...rejected].sort((a, b) =>
    a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0,
  );

  return {
    productId: product.id,
    name: product.name,
    family,
    perPiece: family === "piece" && compared.length > 0 && compared.every((p) => !p.sized),
    stores,
    cheapest,
    decidedByCount,
    saving,
    purchases: all,
    notNormalizedCount: rejected.length,
    otherFamilies,
  };
}

/**
 * Rows for the products with at least one purchase, in product order, and the savings summary:
 * the total of the savings of the rows with 2 or more stores (D-22, D-23).
 */
export function comparePrices(
  products: readonly Product[],
  purchases: readonly Purchase[],
): { rows: ProductComparison[]; summary: SavingsSummary } {
  const byProduct = new Map<string, Purchase[]>();
  for (const purchase of purchases) {
    const group = byProduct.get(purchase.productId) ?? [];
    group.push(purchase);
    byProduct.set(purchase.productId, group);
  }
  const rows: ProductComparison[] = [];
  let total = ZERO;
  let compared = 0;
  let perPieceProducts = 0;
  for (const product of products) {
    const group = byProduct.get(product.id);
    if (group === undefined || group.length === 0) continue;
    const row = compareProduct(product, group);
    rows.push(row);
    if (row.cheapest !== null) {
      compared += 1;
      if (row.perPiece) perPieceProducts += 1;
      if (row.saving !== null) total = total.plus(row.saving);
    }
  }
  return { rows, summary: { total, products: compared, perPieceProducts } };
}
