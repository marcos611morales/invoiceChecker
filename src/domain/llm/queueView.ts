/**
 * The view of the pending product queue (D-20, UI-SPEC queue defaults): the order the cards are
 * listed in, how a card that lands during a run is placed, the filters and the search, the counts
 * of the filter toggles, and accepting many cards at once. Pure: it never mutates its input and it
 * never touches a store. Relative imports only, so the domain stays free of the app layers.
 */
import { normalizeDescription } from "../settings/normalize";
import {
  acceptProduct,
  addMembersToProduct,
  type AcceptProductError,
} from "../settings/products";
import type { SettingsData } from "../settings/types";
import { memberKey, type ProductSuggestion } from "./suggestions";

/** The four filter toggles of the queue (UI-SPEC line 245). */
export type QueueFilter = "todas" | "varios" | "deUno" | "paraAgregar";

const collator = new Intl.Collator("es", { sensitivity: "base" });

/** «Agregar a» cards, then groups of several members, then singletons (UI-SPEC queue order). */
function rankOf(card: ProductSuggestion): 0 | 1 | 2 {
  if (card.target !== null) return 0;
  return card.members.length > 1 ? 1 : 2;
}

function totalLines(card: ProductSuggestion, lines: (key: string) => number): number {
  return card.members.reduce((sum, member) => sum + lines(memberKey(member)), 0);
}

/**
 * The queue in review order (UI-SPEC queue order): «Agregar a» cards first, in arrival order; then
 * cards with several members, members descending and then total loaded lines descending; then
 * one-member cards, lines descending and then the name with the Spanish collator. `lines(key)` is
 * the count of loaded lines of a member (`memberKey`); 0 means none is loaded. Cards that tie in
 * everything keep their arrival order. Returns a new array.
 */
export function orderQueue(
  cards: readonly ProductSuggestion[],
  lines: (key: string) => number,
): ProductSuggestion[] {
  const entries = cards.map((card, index) => ({
    card,
    index,
    rank: rankOf(card),
    lines: totalLines(card, lines),
  }));
  entries.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.rank === 1) {
      const bySize = b.card.members.length - a.card.members.length;
      if (bySize !== 0) return bySize;
    }
    if (a.rank !== 0) {
      const byLines = b.lines - a.lines;
      if (byLines !== 0) return byLines;
    }
    if (a.rank === 2) {
      const byName = collator.compare(a.card.name, b.card.name);
      if (byName !== 0) return byName;
    }
    return a.index - b.index;
  });
  return entries.map((entry) => entry.card);
}

/**
 * Keeps the position of the cards the user is already working on while a run adds more (UI-SPEC):
 * the ids of `previousIds` that are still in `ordered` come first, in their previous order, and the
 * cards that are new follow in the order of `ordered`. The cards returned are the ones in `ordered`,
 * so an edited card shows its current state. Each card appears once. Returns a new array.
 */
export function stableOrder(
  previousIds: readonly string[],
  ordered: readonly ProductSuggestion[],
): ProductSuggestion[] {
  const byId = new Map(ordered.map((card) => [card.id, card]));
  const placed = new Set<string>();
  const result: ProductSuggestion[] = [];
  for (const id of previousIds) {
    const card = byId.get(id);
    if (card === undefined || placed.has(id)) continue;
    placed.add(id);
    result.push(card);
  }
  for (const card of ordered) {
    if (placed.has(card.id)) continue;
    placed.add(card.id);
    result.push(card);
  }
  return result;
}

function matchesFilter(card: ProductSuggestion, filter: QueueFilter): boolean {
  switch (filter) {
    case "todas":
      return true;
    case "varios":
      return card.target === null && card.members.length >= 2;
    case "deUno":
      return card.target === null && card.members.length === 1;
    case "paraAgregar":
      return card.target !== null;
  }
}

function matchesSearch(
  card: ProductSuggestion,
  query: string,
  displayName: ((card: ProductSuggestion) => string) | undefined,
): boolean {
  if (query === "") return true;
  const names = displayName === undefined ? [card.name] : [card.name, displayName(card)];
  if (names.some((name) => normalizeDescription(name).includes(query))) return true;
  return card.members.some(
    (member) =>
      normalizeDescription(member.description).includes(query) ||
      normalizeDescription(member.supplierName).includes(query),
  );
}

/**
 * The cards that match the filter and the search, in the order received. The search looks in the
 * name, in the descriptions of the members and in their supplier names, ignoring case and accents
 * (but not «ñ», as everywhere else) with `normalizeDescription` on both sides. `displayName` is the
 * name the card is shown with when it is not its own (an «Agregar a» card is titled with the name
 * of its product); when given, the search also looks in it. A blank search matches every card.
 */
export function filterQueue(
  cards: readonly ProductSuggestion[],
  filter: QueueFilter,
  search: string,
  displayName?: (card: ProductSuggestion) => string,
): ProductSuggestion[] {
  const query = normalizeDescription(search);
  return cards.filter((card) => matchesFilter(card, filter) && matchesSearch(card, query, displayName));
}

/** How many of ALL the pending cards each filter keeps, whatever the search says (UI-SPEC line 245). */
export function filterCounts(cards: readonly ProductSuggestion[]): Record<QueueFilter, number> {
  const counts: Record<QueueFilter, number> = { todas: 0, varios: 0, deUno: 0, paraAgregar: 0 };
  for (const card of cards) {
    counts.todas += 1;
    if (card.target !== null) counts.paraAgregar += 1;
    else if (card.members.length > 1) counts.varios += 1;
    else counts.deUno += 1;
  }
  return counts;
}

/**
 * What accepting many cards at once did (D-20, D-35). `acceptedIds` are the cards that were applied
 * and `refused` the ones that were not, each with the reason the single-card rules gave; a refused
 * card changes nothing. `created` counts the products that were created and `addedTo` the cards that
 * added descriptions to a product that already existed.
 */
export interface BulkAcceptResult {
  next: SettingsData;
  acceptedIds: string[];
  refused: { id: string; reason: AcceptProductError | "gone" }[];
  created: number;
  addedTo: number;
}

/**
 * Accepts `cards` one after the other, in the order given (D-20, D-35). Every card follows the rules
 * of a single card against the settings the previous one left: a card without target goes through
 * `acceptProduct` with all its members and a fresh id from `newId`; an «Agregar a» card goes through
 * `addMembersToProduct` with all its members. A card the rules refuse (a repeated name, a member
 * already taken, a limit, a product that is gone) is reported and leaves the settings as they were,
 * so the result always passes the stored validation. When no card is accepted `next` is the very
 * same object as `settings`.
 */
export function acceptMany(
  settings: SettingsData,
  cards: readonly ProductSuggestion[],
  newId: () => string,
): BulkAcceptResult {
  let running = settings;
  const acceptedIds: string[] = [];
  const refused: BulkAcceptResult["refused"] = [];
  let created = 0;
  let addedTo = 0;
  for (const card of cards) {
    if (card.target === null) {
      const result = acceptProduct(running, { name: card.name, members: card.members }, newId());
      if (result.ok) {
        running = result.next;
        acceptedIds.push(card.id);
        created += 1;
      } else {
        refused.push({ id: card.id, reason: result.reason });
      }
      continue;
    }
    const result = addMembersToProduct(running, card.target, card.members);
    if (result.ok) {
      running = result.next;
      acceptedIds.push(card.id);
      addedTo += 1;
    } else {
      refused.push({ id: card.id, reason: result.reason });
    }
  }
  return { next: running, acceptedIds, refused, created, addedTo };
}
