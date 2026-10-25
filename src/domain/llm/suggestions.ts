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
import { cutText, type ContextTarget } from "./candidates";
import { LLM_LIMITS, type GroupResponse } from "./contract";

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
  | {
      id: string;
      kind: "supplier";
      rfc: string;
      name: string;
      /**
       * The uncut supplier name, written to the settings when the suggestion is accepted (`name`
       * is cut to the product-name limit and only meant for display). Absent on rows saved before
       * it existed: accepting those writes `name`.
       */
      fullName?: string;
      /** The new category name the model proposed; see `proposedNew` on the product row. */
      proposedNew?: string;
      choice: CategoryChoice | null;
    }
  | {
      id: string;
      kind: "product";
      productId: string;
      name: string;
      /**
       * The new category name the model proposed for this row, kept after the user picks an
       * existing category so «Nueva: …» can be chosen again. Absent when the model answered with
       * an existing category and on rows saved before it existed.
       */
      proposedNew?: string;
      choice: CategoryChoice | null;
    };

/**
 * The key under which a supplier or a product counts as pending for a category (A-2, D-23): one
 * row per supplier (by RFC) or per product (by id). A row and the target it was built for give
 * the same key. The prefix keeps a supplier and a product apart, whatever their ids are.
 */
export function categoryTargetKey(
  target: { kind: "supplier"; rfc: string } | { kind: "product"; productId: string },
): string {
  return target.kind === "supplier" ? `supplier:${target.rfc}` : `product:${target.productId}`;
}

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
 * What the browser knows when it applies the answer of a batch of a multi-batch run (D-28, D-33):
 * the pending queue as it is now, the accepted product that holds a member (or null), and the
 * member keys of each card this run enqueued (by suggestion id), as they were when it entered the
 * queue. It is read-only here; the caller builds it from the live stores at apply time.
 */
export interface RunContext {
  queue: readonly ProductSuggestion[];
  productIdOfMember: (key: string) => string | null;
  runCards: ReadonlyMap<string, readonly string[]>;
}

/** Members a group adds to a card that is still pending (the card keeps its id and its name). */
export interface MemberAppend {
  cardId: string;
  members: SuggestionMember[];
}

/** What one answer becomes: new cards for the queue and members for cards already in it. */
export interface ProductAnswer {
  cards: ProductSuggestion[];
  appends: MemberAppend[];
}

type Destination =
  | { kind: "new" }
  | { kind: "product"; productId: string }
  | { kind: "pending"; cardId: string };

/**
 * Where a group goes (D-21, D-33). No target is a new card. A product target is an «Agregar a»
 * card. A pending target joins that card while it is still in the queue; once the user accepted
 * it, the product that holds one of its members becomes the target; once the user rejected it (or
 * the product is gone, or the card is unknown), the group keeps its own new card.
 */
function destinationOf(target: ContextTarget | undefined, context: RunContext | undefined): Destination {
  if (target === undefined) return { kind: "new" };
  switch (target.kind) {
    case "product":
      return { kind: "product", productId: target.productId };
    case "pending": {
      if (context === undefined) return { kind: "new" };
      if (context.queue.some((card) => card.id === target.suggestionId)) {
        return { kind: "pending", cardId: target.suggestionId };
      }
      for (const key of context.runCards.get(target.suggestionId) ?? []) {
        const productId = context.productIdOfMember(key);
        if (productId !== null) return { kind: "product", productId };
      }
      return { kind: "new" };
    }
  }
}

/**
 * Turns the groups of one answer into cards and appends. A group id that the browser never
 * sent is skipped (it has no entry in `idMap`), so an id the model invents can never become a
 * member. A card that ends with no member is kept here and dropped by `enqueueProductSuggestions`.
 *
 * A group placed with an accepted product (`existing` resolves to a product target) becomes an
 * «Agregar a» card whose `target` is that product's id (D-21). Two groups of one answer that
 * point at the same product become one card, at the position of the first, with the members in
 * answer order and none repeated; a context id the browser never sent leaves a new product.
 *
 * A group placed with a card an earlier batch of the same run enqueued (a pending target, D-28,
 * D-33) is resolved against `context`, which is the queue and the settings at apply time: a card
 * still pending receives the members (an append, no new card); an accepted card becomes an
 * «Agregar a» card for the product that holds its members; a rejected one leaves a new card with
 * the group's own name. Without `context` a pending target is a new card.
 */
export function resolveProductAnswer(
  groups: GroupResponse["groups"],
  idMap: ReadonlyMap<string, SuggestionMember>,
  targets: ReadonlyMap<string, ContextTarget>,
  newId: () => string,
  context?: RunContext,
): ProductAnswer {
  const cards: ProductSuggestion[] = [];
  const byProduct = new Map<string, { card: ProductSuggestion; seen: Set<string> }>();
  const appendTo = new Map<string, { members: SuggestionMember[]; seen: Set<string> }>();
  for (const group of groups) {
    const destination = destinationOf(
      group.existing === null ? undefined : targets.get(group.existing),
      context,
    );
    if (destination.kind === "pending") {
      let pending = appendTo.get(destination.cardId);
      if (pending === undefined) {
        const queued = context?.queue.find((card) => card.id === destination.cardId);
        pending = { members: [], seen: new Set((queued?.members ?? []).map(memberKey)) };
        appendTo.set(destination.cardId, pending);
      }
      for (const id of group.ids) {
        const member = idMap.get(id);
        if (member === undefined) continue;
        const key = memberKey(member);
        if (pending.seen.has(key)) continue;
        pending.seen.add(key);
        pending.members.push(member);
      }
      continue;
    }
    const productId = destination.kind === "product" ? destination.productId : null;
    const shared = productId === null ? undefined : byProduct.get(productId);
    const card: ProductSuggestion = shared?.card ?? {
      id: newId(),
      name: group.name,
      target: productId,
      members: [],
    };
    const seen = shared?.seen ?? new Set<string>();
    for (const id of group.ids) {
      const member = idMap.get(id);
      if (member === undefined) continue;
      const key = memberKey(member);
      if (seen.has(key)) continue;
      seen.add(key);
      card.members.push(member);
    }
    if (shared === undefined) {
      cards.push(card);
      if (productId !== null) byProduct.set(productId, { card, seen });
    }
  }
  const appends: MemberAppend[] = [];
  for (const [cardId, pending] of appendTo) {
    if (pending.members.length > 0) appends.push({ cardId, members: pending.members });
  }
  return { cards, appends };
}

/**
 * The cards of one answer when no earlier batch of the run is involved: the product targets of
 * `resolveProductAnswer` without a run context (a pending target would be a new card).
 */
export function toProductSuggestions(
  groups: GroupResponse["groups"],
  idMap: ReadonlyMap<string, SuggestionMember>,
  targets: ReadonlyMap<string, ContextTarget>,
  newId: () => string,
): ProductSuggestion[] {
  return resolveProductAnswer(groups, idMap, targets, newId).cards;
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

/**
 * The queued category rows plus each incoming row whose target (`categoryTargetKey`) is not
 * pending yet, in incoming order (A-2, D-23): a target that already has a row, or that repeats
 * inside the incoming list, is skipped, so a late or repeated answer never makes a second row.
 * It stops adding at `PENDING_LIMITS.categoryRows`, so a queue valid in memory is valid stored.
 * Returns a new array; the queued rows are not changed.
 */
export function enqueueCategorySuggestions(
  queue: readonly CategorySuggestion[],
  incoming: readonly CategorySuggestion[],
): CategorySuggestion[] {
  const taken = new Set(queue.map((row) => categoryTargetKey(row)));
  const next = [...queue];
  for (const row of incoming) {
    const key = categoryTargetKey(row);
    if (taken.has(key)) continue;
    if (next.length >= PENDING_LIMITS.categoryRows) break;
    taken.add(key);
    next.push(row);
  }
  return next;
}

/** The part of the settings that decides who still needs a category. */
export interface PruneSettings {
  categories: readonly { id: string }[];
  supplierCategories: readonly { rfc: string; categoryId: string }[];
  products: readonly { id: string; categoryId: string | null }[];
}

/**
 * The queue without the category rows whose target no longer needs a category (D-07, D-18, D-34,
 * A-3): a supplier that now has a default category (one that exists), a product that now has a
 * category, and a product that no longer exists. A row whose target got a category by other means
 * is dropped, never applied, so a category the user chose is never overwritten. Every other row
 * stays in its place and the product cards are untouched. When no row goes, the very same queue
 * object comes back, so the store can tell that nothing needs to be written. Pure; the input is
 * not mutated.
 */
export function pruneCategoryRows(queue: PendingQueue, settings: PruneSettings): PendingQueue {
  if (queue.categories.length === 0) return queue;
  const known = new Set(settings.categories.map((category) => category.id));
  const assigned = new Set(
    settings.supplierCategories
      .filter((assignment) => known.has(assignment.categoryId))
      .map((assignment) => assignment.rfc),
  );
  const products = new Map(settings.products.map((product) => [product.id, product.categoryId]));
  const keep = (row: CategorySuggestion): boolean => {
    if (row.kind === "supplier") return !assigned.has(row.rfc);
    const categoryId = products.get(row.productId);
    if (categoryId === undefined) return false;
    return categoryId === null || !known.has(categoryId);
  };
  const categories = queue.categories.filter(keep);
  if (categories.length === queue.categories.length) return queue;
  return { ...queue, categories };
}

/** A category row taken out and the position it had, which is all `restoreCategoryRow` needs (D-22). */
export interface RemovedCategoryRow {
  row: CategorySuggestion;
  index: number;
}

/** A copy of a row that shares nothing with the original, so an undo value never aliases the queue. */
function copyCategoryRow(row: CategorySuggestion): CategorySuggestion {
  const choice: CategoryChoice | null =
    row.choice === null
      ? null
      : row.choice.kind === "existing"
        ? { kind: "existing", categoryId: row.choice.categoryId }
        : { kind: "new", name: row.choice.name };
  return row.kind === "supplier"
    ? {
        id: row.id,
        kind: "supplier",
        rfc: row.rfc,
        name: row.name,
        ...(row.fullName === undefined ? {} : { fullName: row.fullName }),
        ...(row.proposedNew === undefined ? {} : { proposedNew: row.proposedNew }),
        choice,
      }
    : {
        id: row.id,
        kind: "product",
        productId: row.productId,
        name: row.name,
        ...(row.proposedNew === undefined ? {} : { proposedNew: row.proposedNew }),
        choice,
      };
}

/**
 * Takes a category row out of the queue (D-22). Returns the queue without it and the value for
 * «Deshacer», or null when the id is unknown. Pure; the input is not mutated.
 */
export function removeCategoryRow(
  queue: PendingQueue,
  id: string,
): { next: PendingQueue; removed: RemovedCategoryRow } | null {
  const index = queue.categories.findIndex((row) => row.id === id);
  const row = queue.categories[index];
  if (row === undefined) return null;
  return {
    next: { ...queue, categories: queue.categories.filter((candidate) => candidate.id !== id) },
    removed: { row: copyCategoryRow(row), index },
  };
}

/**
 * Puts a removed category row back at min(index, length) (D-22). A row whose id is already in the
 * queue, whose target has another row now, or that would pass `PENDING_LIMITS.categoryRows` is
 * not restored: in every refusal the same queue comes back.
 */
export function restoreCategoryRow(queue: PendingQueue, removed: RemovedCategoryRow): PendingQueue {
  const key = categoryTargetKey(removed.row);
  if (queue.categories.some((row) => row.id === removed.row.id || categoryTargetKey(row) === key)) {
    return queue;
  }
  if (queue.categories.length >= PENDING_LIMITS.categoryRows) return queue;
  const categories = [...queue.categories];
  categories.splice(
    Math.min(Math.max(removed.index, 0), categories.length),
    0,
    copyCategoryRow(removed.row),
  );
  return { ...queue, categories };
}

function sameChoice(a: CategoryChoice | null, b: CategoryChoice): boolean {
  if (a === null) return false;
  if (a.kind === "existing") return b.kind === "existing" && a.categoryId === b.categoryId;
  return b.kind === "new" && a.name === b.name;
}

/**
 * Stores the category the user picked on a row (D-17): an existing category id, or a new name of
 * 1 to 60 characters once trimmed. An empty id, an empty or over-long name, an unknown row or the
 * choice the row already has is no change: the same queue comes back.
 */
export function setCategoryChoice(
  queue: PendingQueue,
  id: string,
  choice: CategoryChoice,
): PendingQueue {
  const current = queue.categories.find((row) => row.id === id);
  if (current === undefined) return queue;
  let next: CategoryChoice;
  if (choice.kind === "existing") {
    if (choice.categoryId === "") return queue;
    next = { kind: "existing", categoryId: choice.categoryId };
  } else {
    const name = choice.name.trim();
    if (name === "" || name.length > NAME_MAX) return queue;
    next = { kind: "new", name };
  }
  if (sameChoice(current.choice, next)) return queue;
  return {
    ...queue,
    categories: queue.categories.map((row) => (row.id === id ? { ...row, choice: next } : row)),
  };
}

// ---------------------------------------------------------------------------------------
// Review actions over the queue (D-12, D-19, D-22). Each one is a pure reducer over the whole
// queue that never mutates its input and never produces a value `pendingQueueSchema` would
// reject, because the queue is written to the browser after every change. A refused or
// useless change returns the very same queue object, so the store can tell that nothing
// needs to be written. The «Deshacer» of each action gets back exactly what it removed.

/** `text` cut to at most `max` UTF-16 units without splitting a surrogate pair (the schema counts units). */
function cutName(text: string, max: number): string {
  if (text.length <= max) return text;
  let cut = "";
  for (const character of text) {
    if (cut.length + character.length > max) break;
    cut += character;
  }
  return cut;
}

/** A copy that shares nothing with the original, so an undo value never aliases the queue. */
function copyCard(card: ProductSuggestion): ProductSuggestion {
  return {
    id: card.id,
    name: card.name,
    target: card.target,
    members: card.members.map(copyMember),
  };
}

function copyMember(member: SuggestionMember): SuggestionMember {
  return {
    rfc: member.rfc,
    key: member.key,
    description: member.description,
    supplierName: member.supplierName,
  };
}

function withCards(queue: PendingQueue, products: ProductSuggestion[]): PendingQueue {
  return { ...queue, products };
}

function memberTotal(cards: readonly ProductSuggestion[]): number {
  return cards.reduce((sum, card) => sum + card.members.length, 0);
}

/** `items` with `item` inserted at `index`, clamped to the list. */
function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  const position = Math.min(Math.max(index, 0), items.length);
  return [...items.slice(0, position), item, ...items.slice(position)];
}

/**
 * Stores the name the user typed on a card, cut to 60 (D-12). The name is kept as typed: it is
 * trimmed and checked when the card is accepted, and an empty name is allowed while editing.
 * An unknown id, or the very same name, is no change: the same queue comes back.
 */
export function renameSuggestion(queue: PendingQueue, id: string, name: string): PendingQueue {
  const current = queue.products.find((card) => card.id === id);
  if (current === undefined) return queue;
  const cut = cutName(name, NAME_MAX);
  if (cut === current.name) return queue;
  return withCards(
    queue,
    queue.products.map((card) => (card.id === id ? { ...card, name: cut } : card)),
  );
}

/** A rejected card and the position it had, which is all `restoreSuggestion` needs (D-22). */
export interface RemovedSuggestion {
  card: ProductSuggestion;
  index: number;
}

/**
 * Takes a card out of the queue (D-22). Its descriptions are free again, because they are no
 * longer pending. Returns the value for «Deshacer», or null when the id is unknown.
 */
export function removeSuggestion(
  queue: PendingQueue,
  id: string,
): { next: PendingQueue; removed: RemovedSuggestion } | null {
  const index = queue.products.findIndex((card) => card.id === id);
  const card = queue.products[index];
  if (card === undefined) return null;
  return {
    next: withCards(
      queue,
      queue.products.filter((candidate) => candidate.id !== id),
    ),
    removed: { card: copyCard(card), index },
  };
}

/**
 * Puts a removed card back at min(index, length) (D-22). A member that is pending in another
 * card now is left out, and a card left with no member is not restored; so is a card whose id
 * is already in the queue or that would pass `PENDING_LIMITS`. In every refusal the same queue
 * comes back.
 */
export function restoreSuggestion(queue: PendingQueue, removed: RemovedSuggestion): PendingQueue {
  const taken = pendingMemberKeys(queue.products);
  const members = removed.card.members.filter((member) => !taken.has(memberKey(member)));
  if (members.length === 0) return queue;
  if (queue.products.some((card) => card.id === removed.card.id)) return queue;
  if (
    queue.products.length >= PENDING_LIMITS.productCards ||
    memberTotal(queue.products) + members.length > PENDING_LIMITS.members
  ) {
    return queue;
  }
  const card: ProductSuggestion = { ...copyCard(removed.card), members: members.map(copyMember) };
  return withCards(queue, insertAt(queue.products, removed.index, card));
}

/**
 * A member taken out of a card (D-19, D-22). `card` is set when the member was the only one, so
 * the whole card went with it and `restoreMember` brings the card back; otherwise `index` is the
 * position the member had inside the card.
 */
export interface DroppedMember {
  cardId: string;
  member: SuggestionMember;
  index: number;
  card: RemovedSuggestion | null;
}

/**
 * Takes one member (`key` is `memberKey`) out of a card (D-22). The only member of a card cannot
 * stay alone in an empty card: the card is removed too. Returns null when the card or the member
 * is unknown.
 */
export function dropMember(
  queue: PendingQueue,
  cardId: string,
  key: string,
): { next: PendingQueue; dropped: DroppedMember } | null {
  const card = queue.products.find((candidate) => candidate.id === cardId);
  if (card === undefined) return null;
  const index = card.members.findIndex((member) => memberKey(member) === key);
  const member = card.members[index];
  if (member === undefined) return null;
  if (card.members.length === 1) {
    const removal = removeSuggestion(queue, cardId);
    if (removal === null) return null;
    return {
      next: removal.next,
      dropped: { cardId, member: copyMember(member), index, card: removal.removed },
    };
  }
  return {
    next: withCards(
      queue,
      queue.products.map((candidate) =>
        candidate.id === cardId
          ? { ...candidate, members: candidate.members.filter((_, at) => at !== index) }
          : candidate,
      ),
    ),
    dropped: { cardId, member: copyMember(member), index, card: null },
  };
}

/**
 * Reverses `dropMember` (D-22): a deleted card comes back whole, a member goes back to its index
 * in its card. When the card is gone, the member is pending somewhere now, or a limit would
 * break, the same queue comes back.
 */
export function restoreMember(queue: PendingQueue, dropped: DroppedMember): PendingQueue {
  if (dropped.card !== null) return restoreSuggestion(queue, dropped.card);
  if (!queue.products.some((card) => card.id === dropped.cardId)) return queue;
  if (pendingMemberKeys(queue.products).has(memberKey(dropped.member))) return queue;
  if (memberTotal(queue.products) + 1 > PENDING_LIMITS.members) return queue;
  return withCards(
    queue,
    queue.products.map((card) =>
      card.id === dropped.cardId
        ? { ...card, members: insertAt(card.members, dropped.index, copyMember(dropped.member)) }
        : card,
    ),
  );
}

/**
 * Adds members at the end of a pending card (D-33): the card is the one an earlier batch of the
 * same run enqueued and a later batch placed more descriptions with. Idempotent per member: one
 * that is pending in any card is skipped, and it stops at `PENDING_LIMITS.members`. An unknown
 * card, or nothing to add, is no change: the same queue comes back.
 */
export function appendSuggestionMembers(
  queue: PendingQueue,
  cardId: string,
  members: readonly SuggestionMember[],
): PendingQueue {
  if (!queue.products.some((card) => card.id === cardId)) return queue;
  const taken = pendingMemberKeys(queue.products);
  let room = PENDING_LIMITS.members - memberTotal(queue.products);
  const added: SuggestionMember[] = [];
  for (const member of members) {
    const key = memberKey(member);
    if (taken.has(key)) continue;
    if (room <= 0) break;
    taken.add(key);
    added.push(copyMember(member));
    room -= 1;
  }
  if (added.length === 0) return queue;
  return withCards(
    queue,
    queue.products.map((card) =>
      card.id === cardId ? { ...card, members: [...card.members, ...added] } : card,
    ),
  );
}

/**
 * What «Deshacer» needs after a join, a turn into «Agregar a» or a split (D-19): the cards as they
 * were before the change, each with the index it had, and the id of the card the change created
 * (null when it created none).
 */
export interface QueueUndo {
  cards: { card: ProductSuggestion; index: number }[];
  createdId: string | null;
}

/**
 * Joins card `fromId` into card `intoId` (D-19): the members of `from` go to the end of `into`
 * and `from` is removed. `into` keeps its id, its name and its target. Returns null for the same
 * card twice or an unknown id. The number of members in the queue does not change.
 */
export function mergeSuggestions(
  queue: PendingQueue,
  fromId: string,
  intoId: string,
): { next: PendingQueue; undo: QueueUndo } | null {
  if (fromId === intoId) return null;
  const fromIndex = queue.products.findIndex((card) => card.id === fromId);
  const intoIndex = queue.products.findIndex((card) => card.id === intoId);
  const from = queue.products[fromIndex];
  const into = queue.products[intoIndex];
  if (from === undefined || into === undefined) return null;
  const joined: ProductSuggestion = {
    ...into,
    members: [...into.members, ...from.members.map(copyMember)],
  };
  return {
    next: withCards(
      queue,
      queue.products
        .filter((card) => card.id !== fromId)
        .map((card) => (card.id === intoId ? joined : card)),
    ),
    undo: {
      cards: [
        { card: copyCard(from), index: fromIndex },
        { card: copyCard(into), index: intoIndex },
      ],
      createdId: null,
    },
  };
}

/**
 * Turns a card into an «Agregar a» card for the accepted product `productId` (D-19, D-21): only
 * its target changes, its members stay. Nothing reaches the settings here; that happens on
 * «Aceptar». Returns null for an unknown card, an empty product id or a card that already points
 * at that product.
 */
export function turnIntoAddCard(
  queue: PendingQueue,
  id: string,
  productId: string,
): { next: PendingQueue; undo: QueueUndo } | null {
  const index = queue.products.findIndex((card) => card.id === id);
  const current = queue.products[index];
  if (current === undefined || productId === "" || current.target === productId) return null;
  return {
    next: withCards(
      queue,
      queue.products.map((card) => (card.id === id ? { ...card, target: productId } : card)),
    ),
    undo: { cards: [{ card: copyCard(current), index }], createdId: null },
  };
}

/**
 * Splits the members whose `memberKey` is in `keys` off card `id` into a new product card, placed
 * right below it (D-19). Both cards keep the members in the order the card had. The new card has
 * no target (it is a new product, even when the original is an «Agregar a» card) and is named
 * after its first member, cut to 60. Returns null unless at least one but not all of the card's
 * members are named (keys the card does not have are ignored), the new id is empty or already in
 * the queue, or the queue is at its card cap.
 */
export function splitSuggestion(
  queue: PendingQueue,
  id: string,
  keys: readonly string[],
  newId: string,
): { next: PendingQueue; undo: QueueUndo } | null {
  const index = queue.products.findIndex((card) => card.id === id);
  const current = queue.products[index];
  if (current === undefined) return null;
  const wanted = new Set(keys);
  const moved = current.members.filter((member) => wanted.has(memberKey(member)));
  const first = moved[0];
  if (first === undefined || moved.length === current.members.length) return null;
  if (newId === "" || queue.products.some((card) => card.id === newId)) return null;
  if (queue.products.length >= PENDING_LIMITS.productCards) return null;
  const created: ProductSuggestion = {
    id: newId,
    name: cutText(first.description, LLM_LIMITS.productName),
    target: null,
    members: moved.map(copyMember),
  };
  const staying = current.members.filter((member) => !wanted.has(memberKey(member)));
  const products = [...queue.products];
  products.splice(index, 1, { ...current, members: staying }, created);
  return {
    next: withCards(queue, products),
    undo: { cards: [{ card: copyCard(current), index }], createdId: newId },
  };
}

/**
 * Reverses `mergeSuggestions`, `turnIntoAddCard` or `splitSuggestion` (D-19, D-22): the card the
 * change created is removed and the saved cards go back to the index they had. A saved member
 * that is pending in another card now is left out, a saved card left with no member is not
 * restored, and a member that a later batch added to one of these cards since stays (with the
 * saved card of the same id, or with the first restored card when its own card was the created
 * one), so no pending suggestion is lost. When none of the cards of the change is in the queue any
 * more (it was accepted or rejected), the same queue comes back.
 */
export function undoQueueChange(queue: PendingQueue, undo: QueueUndo): PendingQueue {
  const savedIds = new Set(undo.cards.map((entry) => entry.card.id));
  const touched = queue.products.filter(
    (card) => savedIds.has(card.id) || card.id === undo.createdId,
  );
  if (touched.length === 0) return queue;
  const rest = queue.products.filter((card) => !touched.includes(card));
  const taken = pendingMemberKeys(rest);
  const known = new Set<string>();
  for (const entry of undo.cards) {
    for (const member of entry.card.members) known.add(memberKey(member));
  }
  // Members that arrived after the change, by the card (saved id) they now sit in.
  const later = new Map<string, SuggestionMember[]>();
  const orphans: SuggestionMember[] = [];
  for (const card of touched) {
    const extra = card.members.filter((member) => !known.has(memberKey(member)));
    if (savedIds.has(card.id)) later.set(card.id, extra);
    else orphans.push(...extra);
  }
  const restored: { index: number; card: ProductSuggestion }[] = [];
  for (const entry of [...undo.cards].sort((a, b) => a.index - b.index)) {
    const members = [...entry.card.members, ...(later.get(entry.card.id) ?? [])].filter(
      (member) => !taken.has(memberKey(member)),
    );
    for (const member of members) taken.add(memberKey(member));
    if (members.length === 0) continue;
    restored.push({ index: entry.index, card: { ...copyCard(entry.card), members: members.map(copyMember) } });
  }
  const first = restored[0];
  // Nothing can be restored (every saved member is pending elsewhere now): refuse, keep the queue.
  if (first === undefined) return queue;
  for (const member of orphans) {
    if (taken.has(memberKey(member))) continue;
    taken.add(memberKey(member));
    first.card.members.push(copyMember(member));
  }
  const products = [...rest];
  for (const entry of restored) {
    products.splice(Math.min(Math.max(entry.index, 0), products.length), 0, entry.card);
  }
  return withCards(queue, products);
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
    fullName: z.string().optional(),
    proposedNew: z.string().min(1).max(NAME_MAX).optional(),
    choice: categoryChoiceSchema.nullable(),
  }),
  z.strictObject({
    id: z.string().min(1),
    kind: z.literal("product"),
    productId: z.string().min(1),
    name: z.string().max(NAME_MAX),
    proposedNew: z.string().min(1).max(NAME_MAX).optional(),
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
