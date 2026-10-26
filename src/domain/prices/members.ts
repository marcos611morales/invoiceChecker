/**
 * Per-member content rows of one product (Phase 5, D-13, D-14): for every description (member) of
 * a compared product, how the content of its purchases was obtained, whether the user can type a
 * content for it, how many purchases it has and the quantity of the latest one. The content table
 * of Plan 05-11 shows these rows; this module only reads a `ProductComparison`.
 *
 * A member is not edited when all of its purchases are bought by weight or volume (the XML
 * quantity wins, D-14); a member with at least one piece-unit purchase is editable.
 */
import type Big from "big.js";
import type { ContentCorrection } from "../settings/types";
import { normalizeDescription } from "../settings/normalize";
import type { ComparedPurchase, ProductComparison } from "./compare";
import type { NotNormalizedReason } from "./content";
import { readSize } from "./sizeReader";
import { unitRuleOf, type UnitFamily } from "./units";

/** How the content of a member was obtained. */
export type MemberStatus = "corrected" | "detected" | "unsized" | "not-normalized" | "xml";

export interface MemberContent {
  /** `ruleMapKey(rfc, key)`: the member identity. */
  memberKey: string;
  rfc: string;
  /** The normalized description, the second half of the identity. */
  key: string;
  /** The readable description of the latest purchase of the member. */
  description: string;
  storeName: string;
  /** Purchases of the member in the row, whatever happened to them. */
  purchases: number;
  /** True when the member has a piece-unit purchase, i.e. a typed content can apply. */
  editable: boolean;
  /** The family when every purchase is weight or volume, otherwise null. */
  xmlFamily: "mass" | "volume" | null;
  status: MemberStatus;
  /** The size read from the description of a piece-unit purchase, when there is one. */
  detected: { family: UnitFamily; amount: Big } | null;
  /** The stored correction of the member, applied or not. */
  correction: ContentCorrection | null;
  /** Why a not-normalized member does not compare, when the content explains it. */
  reason: NotNormalizedReason | null;
  /** The XML quantity of the latest purchase. */
  latestCantidad: string;
}

/** Reasons a typed content can fix or that come from the unit itself; an amount problem is not one. */
const CONTENT_REASONS: ReadonlySet<NotNormalizedReason> = new Set<NotNormalizedReason>([
  "unit-unknown",
  "bad-quantity",
  "unsized-with-sized-siblings",
  "other-family",
]);

/** Spanish order, accents and case ignored (D-30). */
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

function isPieceUnit(purchase: ComparedPurchase): boolean {
  return unitRuleOf(purchase.claveUnidad)?.family === "piece";
}

/** The weight or volume family of a purchase's unit, or null for a piece or unknown unit. */
function weightOrVolume(purchase: ComparedPurchase): "mass" | "volume" | null {
  const family = unitRuleOf(purchase.claveUnidad)?.family;
  return family === "mass" || family === "volume" ? family : null;
}

/** The key half of a member identity; the normalized description when the identity is not ours. */
function keyOf(memberKey: string, rfc: string, descripcion: string): string {
  const prefix = `${rfc}\u0000`;
  return memberKey.startsWith(prefix) ? memberKey.slice(prefix.length) : normalizeDescription(descripcion);
}

/** Latest purchase by literal fecha; the first of equal ones, so the row order breaks ties. */
function latestOf(group: readonly ComparedPurchase[]): ComparedPurchase | null {
  let latest: ComparedPurchase | null = null;
  for (const purchase of group) {
    if (latest === null || purchase.fecha > latest.fecha) latest = purchase;
  }
  return latest;
}

function rankOf(status: MemberStatus): number {
  if (status === "not-normalized") return 0;
  if (status === "corrected") return 1;
  return 2;
}

function contentOf(
  group: readonly ComparedPurchase[],
  memberKey: string,
  corrections: ReadonlyMap<string, ContentCorrection>,
): MemberContent | null {
  const latest = latestOf(group);
  if (latest === null) return null;
  const pieces = group.filter(isPieceUnit);
  const editable = pieces.length > 0;

  let xmlFamily: "mass" | "volume" | null = null;
  if (!editable) {
    const family = weightOrVolume(latest);
    xmlFamily = group.every((purchase) => weightOrVolume(purchase) !== null) ? family : null;
  }

  let detected: MemberContent["detected"] = null;
  const latestPiece = latestOf(pieces);
  if (latestPiece !== null) {
    const reading = readSize(latestPiece.descripcion);
    if (reading.kind === "size") detected = { family: reading.family, amount: reading.total };
  }

  let reason: NotNormalizedReason | null = null;
  const byRecency = [...group].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  for (const purchase of byRecency) {
    if (purchase.status === "not-normalized" && CONTENT_REASONS.has(purchase.reason)) {
      reason = purchase.reason;
      break;
    }
  }

  const correction = corrections.get(memberKey) ?? null;
  let status: MemberStatus;
  if (reason !== null) status = "not-normalized";
  else if (correction !== null && editable) status = "corrected";
  else if (editable) status = detected !== null ? "detected" : "unsized";
  else status = "xml";

  return {
    memberKey,
    rfc: latest.storeRfc,
    key: keyOf(memberKey, latest.storeRfc, latest.descripcion),
    description: latest.descripcion,
    storeName: latest.storeName,
    purchases: group.length,
    editable,
    xmlFamily,
    status,
    detected,
    correction,
    reason,
    latestCantidad: latest.cantidad,
  };
}

/**
 * The members of a compared product with how each one's content was obtained, ordered
 * not-normalized first, then corrected, then the rest, ties by description in Spanish order.
 * A stored correction that cannot apply (the member is bought by weight or volume only) is
 * exposed in `correction` but does not make the member «corrected»: its content comes from the XML.
 */
export function memberContents(
  row: ProductComparison,
  corrections: ReadonlyMap<string, ContentCorrection>,
): MemberContent[] {
  const groups = new Map<string, ComparedPurchase[]>();
  for (const purchase of row.purchases) {
    const group = groups.get(purchase.memberKey) ?? [];
    group.push(purchase);
    groups.set(purchase.memberKey, group);
  }
  const members: MemberContent[] = [];
  for (const [memberKey, group] of groups) {
    const member = contentOf(group, memberKey, corrections);
    if (member !== null) members.push(member);
  }
  return members.sort((a, b) => {
    const byRank = rankOf(a.status) - rankOf(b.status);
    if (byRank !== 0) return byRank;
    const byDescription = COLLATOR.compare(a.description, b.description);
    if (byDescription !== 0) return byDescription;
    return a.memberKey < b.memberKey ? -1 : a.memberKey > b.memberKey ? 1 : 0;
  });
}
