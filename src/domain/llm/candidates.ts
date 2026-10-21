/**
 * What can be sent to DeepSeek and how it is packed (D-03, D-04, D-05, D-25,
 * D-28, LLM-03, LLM-06). The items come from every concept of every loaded
 * invoice; the request bodies are built once here and the same objects are both
 * listed in the send dialog and serialized by the browser client, so what the
 * user sees is what travels (RESEARCH Pattern 4). Pure: no clock, no randomness.
 */
import type { LedgerEntry } from "../accounting/ledger";
import { normalizeDescription, ruleMapKey } from "../settings/normalize";
import { LLM_LIMITS, type GroupRequest } from "./contract";
import type { SuggestionMember } from "./suggestions";

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
  const context = [...existing]
    .sort((a, b) => COLLATOR.compare(a.name, b.name) || comparePlain(a.productId, b.productId))
    .slice(0, LLM_LIMITS.contextNames);
  const total = free.length;
  const count = total === 0 ? 0 : Math.ceil(total / max);
  const sorted = [...free].sort(compareItems);
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
  };
}
