/**
 * Content of one purchase line: how many kg, L or pieces the line bought (Phase 5, D-09).
 * Weight and volume units use the XML quantity times the unit factor and ignore the
 * description (D-09 step 2). A piece unit has no verified size here: the content is the
 * number of pieces and the line is `sized: false` (the size reader of Plan 05-05 and the
 * user's correction of Plan 05-10 plug into this function).
 */
import type Big from "big.js";
import { ZERO, parseDecimal } from "../accounting/decimal";
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

/** Content of one line from its SAT unit and XML quantity. Never throws. */
export function resolveContent(line: {
  claveUnidad: string;
  cantidad: string;
  descripcion: string;
}): LineContent {
  const cantidad = parseDecimal(line.cantidad);
  if (cantidad === null || cantidad.lte(ZERO)) return { ok: false, reason: "bad-quantity" };
  const rule = unitRuleOf(line.claveUnidad);
  if (rule === null) return { ok: false, reason: "unit-unknown" };
  if (rule.family === "piece") {
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
