/**
 * What can be sent to DeepSeek and how it is packed (D-03, D-04, D-05, D-25,
 * D-28, LLM-03, LLM-06). The items come from every concept of every loaded
 * invoice; the request bodies are built once here and the same objects are both
 * listed in the send dialog and serialized by the browser client, so what the
 * user sees is what travels (RESEARCH Pattern 4). Pure: no clock, no randomness.
 */
import type { LedgerEntry } from "../accounting/ledger";
import { orderedCategories } from "../settings/categories";
import { normalizeDescription, ruleMapKey } from "../settings/normalize";
import type { Category, SettingsData } from "../settings/types";
import { LLM_LIMITS, type CategorizeRequest, type GroupRequest } from "./contract";
import { isSensitive } from "./sensitive";
import type { PendingQueue, SuggestionMember } from "./suggestions";

/** One distinct pair of supplier RFC and normalized description. */
export interface LlmItem {
  rfc: string;
  key: string;
  /** The first readable description seen for this pair. */
  description: string;
  supplierName: string;
  /** Concept lines of the loaded invoices with this pair. */
  lines: number;
}

const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

function comparePlain(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** A supplier with no readable name falls back to its RFC; that must never travel (LLM-03). */
function hasReadableName(entry: LedgerEntry): boolean {
  const name = entry.supplierName.trim();
  return name !== "" && name.toLowerCase() !== entry.supplierRfc.trim().toLowerCase();
}

/** Supplier name, then description, then the plain RFC and key as tie-breakers (stable and total). */
function compareItems(a: LlmItem, b: LlmItem): number {
  return (
    COLLATOR.compare(a.supplierName, b.supplierName) ||
    COLLATOR.compare(a.description, b.description) ||
    comparePlain(a.rfc, b.rfc) ||
    comparePlain(a.key, b.key)
  );
}

/**
 * Every concept of every entry, whatever its tipo, exclusion or whether the
 * invoice counts (D-03, OQ2), one item per supplier RFC and normalized
 * description, sorted by supplier name then description. A concept whose
 * description normalizes to nothing is skipped, and so is one of a supplier
 * that has no name other than its RFC.
 */
export function collectItems(entries: readonly LedgerEntry[]): LlmItem[] {
  const byKey = new Map<string, LlmItem>();
  for (const entry of entries) {
    if (!hasReadableName(entry)) continue;
    for (const concepto of entry.invoice.conceptos) {
      const key = normalizeDescription(concepto.descripcion);
      if (key === "") continue;
      const mapKey = ruleMapKey(entry.supplierRfc, key);
      const known = byKey.get(mapKey);
      if (known === undefined) {
        byKey.set(mapKey, {
          rfc: entry.supplierRfc,
          key,
          description: concepto.descripcion.trim(),
          supplierName: entry.supplierName,
          lines: 1,
        });
      } else {
        known.lines += 1;
      }
    }
  }
  return [...byKey.values()].sort(compareItems);
}

/** The items whose key (rfc plus normalized description) is not in `taken`. */
export function freeItems(
  items: readonly LlmItem[],
  taken: ReadonlySet<string>,
): LlmItem[] {
  return items.filter((item) => !taken.has(ruleMapKey(item.rfc, item.key)));
}

// The sensitive-pattern guard (UI-SPEC OQ7, LLM-03, T-04-40): `isSensitive` and its patterns live
// in ./sensitive.ts, which has no imports so the request schemas can use it too (WR-04).
export { isSensitive };

/**
 * True when the text or its cut version is sensitive: the version that is sent is what matters,
 * but a cut can leave a pattern's start in the body (an RFC followed by «…» reads as a whole one),
 * so the whole text counts too.
 */
export function looksSensitive(text: string, max: number): boolean {
  return isSensitive(text) || isSensitive(cutText(text, max));
}

/** An item is withheld when its description or its supplier name looks sensitive. */
function itemIsWithheld(item: LlmItem): boolean {
  return (
    looksSensitive(item.description, LLM_LIMITS.description) ||
    looksSensitive(item.supplierName, LLM_LIMITS.supplier)
  );
}

/**
 * The items that must not be sent because their description or supplier name looks like an RFC,
 * a UUID, an e-mail address or a long number (UI-SPEC OQ7), in the order given.
 */
export function withheldItems(items: readonly LlmItem[]): LlmItem[] {
  return items.filter(itemIsWithheld);
}

/**
 * Trims, and above `max` characters keeps the first `max - 1` plus «…», so the
 * result never exceeds `max` UTF-16 units (the unit zod counts) and an emoji is
 * never split.
 */
export function cutText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  let head = trimmed.slice(0, max - 1);
  const last = head.charCodeAt(head.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) head = head.slice(0, -1);
  return `${head.trimEnd()}…`;
}

/**
 * What a context id (p1..pK) of a request stands for, kept in the browser only (D-21, D-33).
 * An accepted product, or a card that an earlier batch of the same run put in the pending queue
 * (D-28, D-33). A pending target is only ever resolved at apply time, against the queue and the
 * settings as they are then, because the user may have accepted or rejected the card meanwhile.
 */
export type ContextTarget =
  | { kind: "product"; productId: string }
  | { kind: "pending"; suggestionId: string };

/** One request: the body that is sent and the browser-only maps behind its ids. */
export interface GroupBatch {
  body: GroupRequest;
  /** Item id (i1..iK) to the member it stands for. Never leaves the browser. */
  idMap: Map<string, SuggestionMember>;
  /** Context id (p1..pK) to the accepted product it stands for (pending cards are added per run). Never leaves the browser. */
  targets: Map<string, ContextTarget>;
}

export interface GroupRun {
  batches: GroupBatch[];
  /** Items across every batch body. */
  items: number;
  /** Distinct supplier names across every batch body. */
  suppliers: number;
  /** Product names that travel as context. */
  contextNames: number;
  /** Items kept out of every body (sensitive pattern); shown in the dialog only, never sent. */
  withheld: LlmItem[];
}

/**
 * Splits the free items into M = ceil(N / max) batches of near-equal size (D-28). The items are
 * sorted by supplier name then description and dealt round-robin (item j goes to batch j mod M),
 * so every supplier is spread across the batches instead of one big supplier filling one of
 * them. Each batch keeps the sorted order; its ids are i1..iK in that order, the description and
 * the supplier are cut to their limits, and the context names are p1..pK.
 *
 * `existing` are the accepted products (D-04, D-33): their names go on every batch body as
 * context, sorted by name with the es collator, and only the first `LLM_LIMITS.contextNames` of
 * them. The names of the cards still pending from earlier runs are never passed here (D-33).
 */
export function buildGroupRun(
  free: readonly LlmItem[],
  existing: readonly { productId: string; name: string }[],
  max: number = LLM_LIMITS.groupItems,
): GroupRun {
  // A sensitive text never travels: not as an item, and not as the name of an accepted product.
  const withheld = withheldItems(free);
  const kept = new Set(withheld);
  const sendable = free.filter((item) => !kept.has(item));
  const context = existing
    .filter((product) => !looksSensitive(product.name, LLM_LIMITS.productName))
    .sort((a, b) => COLLATOR.compare(a.name, b.name) || comparePlain(a.productId, b.productId))
    .slice(0, LLM_LIMITS.contextNames);
  const total = sendable.length;
  const count = total === 0 ? 0 : Math.ceil(total / max);
  const sorted = [...sendable].sort(compareItems);
  const slices: LlmItem[][] = Array.from({ length: count }, () => []);
  sorted.forEach((item, index) => {
    slices[index % count]?.push(item);
  });
  const batches: GroupBatch[] = [];
  const suppliers = new Set<string>();
  for (const slice of slices) {
    const idMap = new Map<string, SuggestionMember>();
    const items = slice.map((item, index) => {
      const id = `i${String(index + 1)}`;
      idMap.set(id, {
        rfc: item.rfc,
        key: item.key,
        description: item.description,
        supplierName: item.supplierName,
      });
      const supplier = cutText(item.supplierName, LLM_LIMITS.supplier);
      suppliers.add(supplier);
      return {
        id,
        description: cutText(item.description, LLM_LIMITS.description),
        supplier,
      };
    });
    const targets = new Map<string, ContextTarget>();
    const names = context.map((product, index) => {
      const id = `p${String(index + 1)}`;
      targets.set(id, { kind: "product", productId: product.productId });
      return { id, name: cutText(product.name, LLM_LIMITS.productName) };
    });
    batches.push({ body: { items, existing: names }, idMap, targets });
  }
  return {
    batches,
    items: total,
    suppliers: suppliers.size,
    contextNames: context.length,
    withheld,
  };
}

// ---------------------------------------------------------------------------------------
// «Sugerir categorías» (LLM-02, D-07, D-17, A-2). What is sent: the names of the suppliers and
// products that have no category, the descriptions of the members of each product and the names of
// the user's categories. Never an RFC, a UUID, an amount, a date or a folio (LLM-03).

/** A supplier (by RFC, kept in the browser) or an accepted product that is waiting for a category. */
export type CategorizeTarget =
  | { kind: "supplier"; rfc: string; name: string }
  | { kind: "product"; productId: string; name: string; members: string[] };

/** The part of the settings that decides who needs a category. */
type CategorizeSettings = Pick<SettingsData, "categories" | "supplierCategories" | "products">;

/** The key of a target in the pending category rows; the same as `categoryTargetKey` of suggestions.ts. */
function pendingKey(target: { kind: "supplier"; rfc: string } | { kind: "product"; productId: string }): string {
  return target.kind === "supplier" ? `supplier:${target.rfc}` : `product:${target.productId}`;
}

function compareTargets(a: CategorizeTarget, b: CategorizeTarget): number {
  const idA = a.kind === "supplier" ? a.rfc : a.productId;
  const idB = b.kind === "supplier" ? b.rfc : b.productId;
  return COLLATOR.compare(a.name, b.name) || comparePlain(idA, idB);
}

/**
 * The suppliers and the products that «Sugerir categorías» would send (D-07): the loaded
 * suppliers (one per RFC, with the name the ledger shows) that have no default category, and the
 * accepted products that have no category. One that already has a category is never listed, so a
 * category the user chose can never be overwritten; one that already has a pending row is left out
 * (A-2, one row per target). A supplier whose only name is its RFC is left out like in
 * `collectItems`, and so is a product with no readable member. Suppliers first, then products,
 * each by name with the es collator.
 */
export function collectCategorizeTargets(
  entries: readonly LedgerEntry[],
  settings: CategorizeSettings,
  queue: PendingQueue,
): CategorizeTarget[] {
  const known = new Set(settings.categories.map((category) => category.id));
  const assigned = new Set(
    settings.supplierCategories
      .filter((assignment) => known.has(assignment.categoryId))
      .map((assignment) => assignment.rfc),
  );
  const pending = new Set(queue.categories.map((row) => pendingKey(row)));
  const suppliers = new Map<string, CategorizeTarget>();
  for (const entry of entries) {
    if (!hasReadableName(entry)) continue;
    const rfc = entry.supplierRfc;
    if (suppliers.has(rfc) || assigned.has(rfc) || pending.has(pendingKey({ kind: "supplier", rfc }))) {
      continue;
    }
    suppliers.set(rfc, { kind: "supplier", rfc, name: entry.supplierName.trim() });
  }
  const products: CategorizeTarget[] = [];
  for (const product of settings.products) {
    if (product.categoryId !== null && known.has(product.categoryId)) continue;
    if (pending.has(pendingKey({ kind: "product", productId: product.id }))) continue;
    const members = product.members
      .map((member) => member.description.trim())
      .filter((description) => description !== "");
    if (members.length === 0 || product.name.trim() === "") continue;
    products.push({
      kind: "product",
      productId: product.id,
      name: product.name.trim(),
      members,
    });
  }
  return [...[...suppliers.values()].sort(compareTargets), ...products.sort(compareTargets)];
}

/** One request of a «Sugerir categorías» run and the browser-only maps behind its ids. */
export interface CategorizeBatch {
  body: CategorizeRequest;
  /** Supplier id (s#) or product id (q#) to the target it stands for. Never leaves the browser. */
  idMap: Map<string, CategorizeTarget>;
  /** Category code (c#) to the category id it stands for. Never leaves the browser. */
  codeMap: Map<string, string>;
}

export interface CategorizeRun {
  batches: CategorizeBatch[];
  /** Supplier names across every batch body. */
  suppliers: number;
  /** Product names across every batch body. */
  products: number;
  /** Member descriptions across every batch body. */
  members: number;
  /** The user's category names that travel on every batch. */
  categories: number;
  /** Targets kept out of every body (sensitive pattern); shown in the dialog only, never sent. */
  withheld: CategorizeTarget[];
  /**
   * The names of the user's categories that would travel and look sensitive (the name or its cut
   * version), in the order they would travel. While it is not empty the run must not be sent: the
   * dialog tells the user which category to rename and the store refuses to start it (WR-04).
   */
  sensitiveCategories: string[];
}

/**
 * Largest serialized body of one request, below the route's `LLM_LIMITS.requestBytes` (256 KB)
 * with room to spare: products with many long member descriptions can be heavy, so a batch that
 * would pass it is split instead of being refused by the route.
 */
const CATEGORIZE_BODY_BYTES = 200000;

function bytesOf(body: CategorizeRequest): number {
  return new TextEncoder().encode(JSON.stringify(body)).length;
}

/**
 * The member descriptions that travel for a product: cut to 200, the first 100, none repeated. A
 * description that looks sensitive is left out (the product still goes with the others).
 */
function memberTexts(target: Extract<CategorizeTarget, { kind: "product" }>): string[] {
  const seen = new Set<string>();
  const texts: string[] = [];
  for (const description of target.members) {
    if (looksSensitive(description, LLM_LIMITS.description)) continue;
    const text = cutText(description, LLM_LIMITS.description);
    if (text === "" || seen.has(text)) continue;
    seen.add(text);
    texts.push(text);
    if (texts.length >= LLM_LIMITS.membersPerProduct) break;
  }
  return texts;
}

/**
 * A target is withheld when its name looks like an RFC, a UUID, an e-mail address or a long number,
 * or, for a product, when no member description is left to send (UI-SPEC OQ7, LLM-03).
 */
function targetIsWithheld(target: CategorizeTarget): boolean {
  if (target.kind === "supplier") return looksSensitive(target.name, LLM_LIMITS.supplier);
  return looksSensitive(target.name, LLM_LIMITS.productName) || memberTexts(target).length === 0;
}

/** The targets that must not be sent (see `targetIsWithheld`), in the order given. */
export function withheldTargets(targets: readonly CategorizeTarget[]): CategorizeTarget[] {
  return targets.filter(targetIsWithheld);
}

/** Builds the batch of these targets: ids s1.. and q1.. in the order given, c1..cN for the categories. */
function categorizeBatchOf(
  targets: readonly CategorizeTarget[],
  sorted: readonly Category[],
): CategorizeBatch {
  const idMap = new Map<string, CategorizeTarget>();
  const suppliers: CategorizeRequest["suppliers"] = [];
  const products: CategorizeRequest["products"] = [];
  for (const target of targets) {
    if (target.kind === "supplier") {
      const id = `s${String(suppliers.length + 1)}`;
      idMap.set(id, target);
      suppliers.push({ id, name: cutText(target.name, LLM_LIMITS.supplier) });
    } else {
      const members = memberTexts(target);
      if (members.length === 0) continue;
      const id = `q${String(products.length + 1)}`;
      idMap.set(id, target);
      products.push({ id, name: cutText(target.name, LLM_LIMITS.productName), members });
    }
  }
  const codeMap = new Map<string, string>();
  const names = sorted.map((category, index) => {
    const id = `c${String(index + 1)}`;
    codeMap.set(id, category.id);
    return { id, name: cutText(category.name, LLM_LIMITS.productName) };
  });
  return { body: { suppliers, products, categories: names }, idMap, codeMap };
}

/** Halves a group of targets until each part fits the byte budget (a single target always does). */
function fitting(
  targets: readonly CategorizeTarget[],
  sorted: readonly Category[],
): CategorizeBatch[] {
  const batch = categorizeBatchOf(targets, sorted);
  if (targets.length < 2 || bytesOf(batch.body) <= CATEGORIZE_BODY_BYTES) return [batch];
  const half = Math.ceil(targets.length / 2);
  return [
    ...fitting(targets.slice(0, half), sorted),
    ...fitting(targets.slice(half), sorted),
  ];
}

/**
 * Splits the targets into M = ceil(E / max) batches of near-equal size in the order given (the
 * suppliers come first, as `collectCategorizeTargets` returns them), and splits further any batch
 * whose body would pass the byte budget. Every batch carries the user's categories in the order
 * of `orderedCategories` as c1..cN (at most `LLM_LIMITS.categories`), so a code means the same
 * category in each of them. A product is never sent without a readable member.
 */
export function buildCategorizeRun(
  asked: readonly CategorizeTarget[],
  categories: readonly Category[],
  max: number = LLM_LIMITS.categorizeEntries,
): CategorizeRun {
  const sorted = orderedCategories(categories).slice(0, LLM_LIMITS.categories);
  // A withheld target is in no body at all: it does not count for the batch sizes either.
  const withheld = withheldTargets(asked);
  const kept = new Set(withheld);
  const targets = asked.filter((target) => !kept.has(target));
  const total = targets.length;
  const count = total === 0 ? 0 : Math.ceil(total / max);
  const batches: CategorizeBatch[] = [];
  let start = 0;
  for (let index = 0; index < count; index += 1) {
    const size = Math.floor(total / count) + (index < total % count ? 1 : 0);
    batches.push(...fitting(targets.slice(start, start + size), sorted));
    start += size;
  }
  const sent = batches.filter((batch) => batch.body.suppliers.length + batch.body.products.length > 0);
  let suppliers = 0;
  let products = 0;
  let members = 0;
  for (const batch of sent) {
    suppliers += batch.body.suppliers.length;
    products += batch.body.products.length;
    for (const product of batch.body.products) members += product.members.length;
  }
  return {
    batches: sent,
    suppliers,
    products,
    members,
    categories: sent.length === 0 ? 0 : sorted.length,
    withheld,
    sensitiveCategories: sorted
      .filter((category) => looksSensitive(category.name, LLM_LIMITS.productName))
      .map((category) => category.name),
  };
}
