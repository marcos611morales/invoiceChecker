/**
 * Pending product suggestions (D-11, D-12, D-19, D-25, D-26). A suggestion is a
 * proposed product: a name and the members (supplier RFC plus normalized
 * description) it would gather. Pure and idempotent per member, so a late or
 * repeated answer can never create a duplicate card (RESEARCH Pitfall 6).
 */
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
 */
export function enqueueProductSuggestions(
  queue: readonly ProductSuggestion[],
  incoming: readonly ProductSuggestion[],
): ProductSuggestion[] {
  const taken = pendingMemberKeys(queue);
  const next = [...queue];
  for (const card of incoming) {
    const members: SuggestionMember[] = [];
    for (const member of card.members) {
      const key = memberKey(member);
      if (taken.has(key)) continue;
      taken.add(key);
      members.push(member);
    }
    if (members.length === 0) continue;
    next.push({ ...card, members });
  }
  return next;
}
