/**
 * Pending product suggestions (D-11, D-12, D-19, D-25, D-26). A suggestion is a
 * proposed product: a name and the members (supplier RFC plus normalized
 * description) it would gather. Pure and idempotent per member, so a late or
 * repeated answer can never create a duplicate card (RESEARCH Pitfall 6).
 *
 * The pending queue is also a stored contract (D-24, D-30): `pendingQueueSchema` and
 * `resolvePendingQueue` read it back from the browser, where it is untrusted on every load.
 */
import { z } from "zod";
import { ruleMapKey } from "../settings/normalize";
import type { GroupResponse } from "./contract";

export interface SuggestionMember {
  rfc: string;
  key: string;
  /** The readable description, as it appears in the invoices. */
  description: string;
  supplierName: string;
}

export interface ProductSuggestion {
  id: string;
  name: string;
  /** Id of an accepted product for an «Agregar a» card; null for a new product. */
  target: string | null;
  members: SuggestionMember[];
}

/** Version of the stored pending queue (key `invoicechecker:suggestions`, own versioning, D-24). */
export const SUGGESTIONS_VERSION = 1;

/**
 * Caps applied when reading the stored queue and when adding to it (D-24). `members` counts
 * the members of all the product cards together; `categoryRows` are the category suggestions
 * (Plan 04-18). 20,000 members is the number of concept rules the settings allow.
 */
export const PENDING_LIMITS = {
  productCards: 20000,
  members: 20000,
  categoryRows: 7000,
} as const;

/** Longest name of a product suggestion or of a suggested new category, as in the settings. */
const NAME_MAX = 60;

/** The category a category suggestion proposes: one the user has, or a new one by name. */
export type CategoryChoice =
  | { kind: "existing"; categoryId: string }
  | { kind: "new"; name: string };

/**
 * A suggested category for a supplier (by RFC) or for an accepted product (by id). `choice`
 * is null while no category has been proposed or picked. The shape is stored now and filled by
 * Plan 04-18, so the stored contract does not change again inside this phase.
 */
export type CategorySuggestion =
  | { id: string; kind: "supplier"; rfc: string; name: string; choice: CategoryChoice | null }
  | { id: string; kind: "product"; productId: string; name: string; choice: CategoryChoice | null };

/** Everything that waits for review: product cards and category rows (D-24). */
export interface PendingQueue {
  products: ProductSuggestion[];
  categories: CategorySuggestion[];
}

/** The key under which a member counts as taken (same key as the concept rules, D-09). */
export function memberKey(member: SuggestionMember): string {
  return ruleMapKey(member.rfc, member.key);
}

/**
 * Turns the groups of one answer into cards. A group id that the browser never
 * sent is skipped (it has no entry in `idMap`), so an id the model invents can
 * never become a member. A card that ends with no member is kept here and
 * dropped by `enqueueProductSuggestions`.
 */
export function toProductSuggestions(
  groups: GroupResponse["groups"],
  idMap: ReadonlyMap<string, SuggestionMember>,
  targets: ReadonlyMap<string, string>,
  newId: () => string,
): ProductSuggestion[] {
  return groups.map((group) => {
    const members: SuggestionMember[] = [];
    const seen = new Set<string>();
    for (const id of group.ids) {
      const member = idMap.get(id);
      if (member === undefined) continue;
      const key = memberKey(member);
      if (seen.has(key)) continue;
      seen.add(key);
      members.push(member);
    }
    return {
      id: newId(),
      name: group.name,
      target: group.existing === null ? null : (targets.get(group.existing) ?? null),
      members,
    };
  });
}

/** Keys of every member of every pending card. */
export function pendingMemberKeys(queue: readonly ProductSuggestion[]): Set<string> {
  const keys = new Set<string>();
  for (const card of queue) {
    for (const member of card.members) keys.add(memberKey(member));
  }
  return keys;
}

/**
 * The queue as it was, then each incoming card without the members already
 * pending in the queue or earlier in the incoming list; a card left with no
 * member is dropped. Returns a new array; the queued cards are not changed (D-25).
 * It stops adding once a card would pass `PENDING_LIMITS` (cards or members), so a queue
 * that was valid in memory is always valid when it is stored (D-24); the descriptions of
 * the cards left out stay free and can be asked again.
 */
export function enqueueProductSuggestions(
  queue: readonly ProductSuggestion[],
  incoming: readonly ProductSuggestion[],
): ProductSuggestion[] {
  const taken = pendingMemberKeys(queue);
  const next = [...queue];
  let memberCount = 0;
  for (const card of queue) memberCount += card.members.length;
  for (const card of incoming) {
    const members: SuggestionMember[] = [];
    for (const member of card.members) {
      const key = memberKey(member);
      if (taken.has(key)) continue;
      taken.add(key);
      members.push(member);
    }
    if (members.length === 0) continue;
    if (
      next.length >= PENDING_LIMITS.productCards ||
      memberCount + members.length > PENDING_LIMITS.members
    ) {
      break;
    }
    memberCount += members.length;
    next.push({ ...card, members });
  }
  return next;
}

// ---------------------------------------------------------------------------------------
// The stored queue (D-24, D-30). Everything read from browser storage is untrusted: shape,
// limits and integrity are all checked here, and a failure is a plain `safeParse` failure
// that the caller turns into an empty queue plus a notice. No length bound on rfc, key,
// description or supplier name: they come from XML text and a bound could make a valid
// queue unreadable. The schemas are strict, so a field the queue never stores (an amount, a
// UUID, a folio, a date) makes the whole value unreadable instead of being kept.

const memberSchema = z.strictObject({
  rfc: z.string(),
  key: z.string(),
  description: z.string(),
  supplierName: z.string(),
});

/** An empty name is allowed: the user may clear it while editing. */
const productCardSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().max(NAME_MAX),
  target: z.string().nullable(),
  members: z.array(memberSchema).min(1).max(PENDING_LIMITS.members),
});

const categoryChoiceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("existing"), categoryId: z.string().min(1) }),
  z.strictObject({ kind: z.literal("new"), name: z.string().min(1).max(NAME_MAX) }),
]);

/** A row targets a supplier or a product, never both: each kind lists only its own fields. */
const categoryRowSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    id: z.string().min(1),
    kind: z.literal("supplier"),
    rfc: z.string(),
    name: z.string().max(NAME_MAX),
    choice: categoryChoiceSchema.nullable(),
  }),
  z.strictObject({
    id: z.string().min(1),
    kind: z.literal("product"),
    productId: z.string().min(1),
    name: z.string().max(NAME_MAX),
    choice: categoryChoiceSchema.nullable(),
  }),
]);

/**
 * The stored queue with the caps of `PENDING_LIMITS` and the integrity rules: unique card
 * ids, unique category-row ids, a member (rfc plus key) in at most one card, and no more than
 * `PENDING_LIMITS.members` members in all. Member identity is a Set of composite strings,
 * never an object keyed by RFC (Pitfall 8).
 */
export const pendingQueueSchema: z.ZodType<PendingQueue> = z
  .strictObject({
    products: z.array(productCardSchema).max(PENDING_LIMITS.productCards),
    categories: z.array(categoryRowSchema).max(PENDING_LIMITS.categoryRows),
  })
  .superRefine((data, ctx) => {
    const cardIds = new Set<string>();
    const members = new Set<string>();
    let memberCount = 0;
    for (const [index, card] of data.products.entries()) {
      if (cardIds.has(card.id)) {
        ctx.addIssue({ code: "custom", message: "repeated card id", path: ["products", index, "id"] });
      }
      cardIds.add(card.id);
      for (const [memberIndex, member] of card.members.entries()) {
        const key = memberKey(member);
        if (members.has(key)) {
          ctx.addIssue({
            code: "custom",
            message: "member in more than one card",
            path: ["products", index, "members", memberIndex],
          });
        }
        members.add(key);
        memberCount += 1;
      }
    }
    if (memberCount > PENDING_LIMITS.members) {
      ctx.addIssue({ code: "custom", message: "too many members", path: ["products"] });
    }
    const rowIds = new Set<string>();
    for (const [index, row] of data.categories.entries()) {
      if (rowIds.has(row.id)) {
        ctx.addIssue({ code: "custom", message: "repeated row id", path: ["categories", index, "id"] });
      }
      rowIds.add(row.id);
    }
  });

/**
 * Resolution of any stored value into a valid queue. Total: it uses `safeParse` only and never
 * throws, because zustand swallows an exception from `migrate` or `merge` and would silently
 * reset the store (Pitfall 5). absent: nothing stored; ok: a valid stored queue; unreadable:
 * a stored value that could not be used (not the shape, over a limit, breaking an integrity
 * rule, or a version this app does not know), which gives an empty queue. A value with no
 * stored version is read as the current one, like the settings envelope.
 */
export function resolvePendingQueue(
  raw: unknown,
  version: number | undefined,
): { data: PendingQueue; status: "absent" | "ok" | "unreadable" } {
  if (raw === undefined) return { data: emptyQueue(), status: "absent" };
  if (version !== undefined && version !== SUGGESTIONS_VERSION) {
    return { data: emptyQueue(), status: "unreadable" };
  }
  const parsed = pendingQueueSchema.safeParse(raw);
  if (!parsed.success) return { data: emptyQueue(), status: "unreadable" };
  return { data: parsed.data, status: "ok" };
}

/** A queue with nothing pending. New arrays on every call. */
export function emptyQueue(): PendingQueue {
  return { products: [], categories: [] };
}
