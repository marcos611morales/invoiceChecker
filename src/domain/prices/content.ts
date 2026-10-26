/**
 * Content of one purchase line: how many kg, L or pieces the line bought (Phase 5, D-09).
 * Weight and volume units use the XML quantity times the unit factor and ignore the
 * description (D-09 step 2). A piece unit takes its size from the description when the reader
 * finds one (D-09 step 3, D-25: kg, L or counted pieces, `sized: true`, source "description");
 * otherwise the content is the number of pieces and the line is `sized: false`.
 *
 * A content correction the user typed for the member comes first, but only on a piece unit
 * (D-09 step 1, D-14): the content is the XML quantity times the pieces per pack times the typed
 * amount, in the family of the typed unit, `sized: true`, source "user". A weight or volume unit
 * keeps the XML quantity whatever a correction says. A correction that cannot be read as exact
 * numbers is ignored, never thrown on.
 */
import type Big from "big.js";
import { ZERO, parseDecimal } from "../accounting/decimal";
import type { ContentCorrection, ContentUnit } from "../settings/types";
import { readSize } from "./sizeReader";
import { unitRuleOf, type UnitFamily } from "./units";

/** Why a purchase does not enter the comparison. */
export type NotNormalizedReason =
  | "unit-unknown"
  | "bad-quantity"
  | "bad-amount"
  | "zero-amount"
  | "unsized-with-sized-siblings"
  | "other-family";

/** Where the content came from. */
export type ContentSource = "xml" | "description" | "user" | "unsized";

export type LineContent =
  | { ok: true; family: UnitFamily; amount: Big; sized: boolean; source: ContentSource }
  | { ok: false; reason: "unit-unknown" | "bad-quantity" };

/** Family and factor to kg, L or pieces of each unit a user can type. */
const CORRECTION_UNITS: ReadonlyMap<ContentUnit, { family: UnitFamily; factor: string }> = new Map([
  ["g", { family: "mass", factor: "0.001" }],
  ["kg", { family: "mass", factor: "1" }],
  ["ml", { family: "volume", factor: "0.001" }],
  ["l", { family: "volume", factor: "1" }],
  ["piezas", { family: "piece", factor: "1" }],
]);

/**
 * The content of one purchase unit under a correction, or null when the correction cannot be used
 * (pieces per pack that is not a whole number of at least 1, an amount that is not exact decimal
 * text greater than 0, an unknown unit).
 */
function correctedContent(
  cantidad: Big,
  correction: ContentCorrection,
): { family: UnitFamily; amount: Big } | null {
  const { packs } = correction;
  if (!Number.isInteger(packs) || packs < 1) return null;
  const amount = parseDecimal(correction.amount);
  if (amount === null || amount.lte(ZERO)) return null;
  const unit = CORRECTION_UNITS.get(correction.unit);
  if (unit === undefined) return null;
  return {
    family: unit.family,
    amount: cantidad.times(String(packs)).times(amount).times(unit.factor),
  };
}

/**
 * Content of one line from its SAT unit and XML quantity, and the user's correction of its member
 * when there is one (piece units only). Never throws.
 */
export function resolveContent(
  line: {
    claveUnidad: string;
    cantidad: string;
    descripcion: string;
  },
  correction?: ContentCorrection | null,
): LineContent {
  const cantidad = parseDecimal(line.cantidad);
  if (cantidad === null || cantidad.lte(ZERO)) return { ok: false, reason: "bad-quantity" };
  const rule = unitRuleOf(line.claveUnidad);
  if (rule === null) return { ok: false, reason: "unit-unknown" };
  if (rule.family === "piece") {
    if (correction !== null && correction !== undefined) {
      const corrected = correctedContent(cantidad, correction);
      if (corrected !== null) {
        return { ok: true, ...corrected, sized: true, source: "user" };
      }
    }
    const reading = readSize(line.descripcion);
    if (reading.kind === "size") {
      return {
        ok: true,
        family: reading.family,
        amount: cantidad.times(reading.total),
        sized: true,
        source: "description",
      };
    }
    return {
      ok: true,
      family: "piece",
      amount: cantidad.times(rule.factor),
      sized: false,
      source: "unsized",
    };
  }
  return {
    ok: true,
    family: rule.family,
    amount: cantidad.times(rule.factor),
    sized: true,
    source: "xml",
  };
}
