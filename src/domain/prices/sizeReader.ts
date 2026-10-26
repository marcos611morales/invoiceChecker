/**
 * Conservative presentation-size reader for CFDI descriptions (Phase 5, D-09 step 3, D-25, D-34,
 * D-35). It is used only for piece-unit purchases: a weight or volume unit always takes the XML
 * quantity (D-09 step 2) and never calls this module.
 *
 * It reads a weight or volume with an explicit unit («12/1L», «2KG», «375G», «1.730K»,
 * «12/355CCSAB») and a single piece count with an explicit token («50PZ», «BONAFO18PK»,
 * «300 Piezas»). Bare numbers without a unit are never read. Anything with two different
 * readings, a weight or volume next to a piece count, or a single reading next to a pack word
 * (PACK, PAQ, PQ, CJ, CAJA, FAJILLA, DOCENA, or a bare «N P») gives no size: a guessed
 * presentation must never reach a compared price (RESEARCH Pitfalls 2-5).
 *
 * Descriptions are untrusted vendor text: they are cut to MAX_DESCRIPTION_LENGTH before any
 * pattern runs, every quantifier is bounded and no pattern nests repetition, so matching is linear.
 */
import Big from "big.js";
import "../accounting/decimal";
import type { UnitFamily } from "./units";

/** Result of reading a presentation size. `total` is in kg, L or pieces. */
export type SizeReading =
  | { kind: "size"; family: UnitFamily; total: Big; text: string }
  | { kind: "ambiguous"; reason: "conflict" | "pack-token"; texts: string[] }
  | { kind: "none" };

/** Descriptions are cut to this many characters (after accents and case are normalized). */
export const MAX_DESCRIPTION_LENGTH = 300;

/** A weight or volume reading above this many kg or L is discarded as a misread. */
const MAX_WEIGHT_VOLUME = "1000";
/** A piece count outside 1..MAX_PIECES is discarded. */
const MAX_PIECES = 10000;

interface UnitRule {
  family: "mass" | "volume";
  factor: string;
  /** «1.700 GR»: a dot followed by exactly three digits is a thousands dot for g and mL. */
  thousandsDot: boolean;
}

const KG: UnitRule = { family: "mass", factor: "1", thousandsDot: false };
const G: UnitRule = { family: "mass", factor: "0.001", thousandsDot: true };
const L: UnitRule = { family: "volume", factor: "1", thousandsDot: false };
const ML: UnitRule = { family: "volume", factor: "0.001", thousandsDot: true };

const UNIT_RULES = new Map<string, UnitRule>([
  ["KILOGRAMOS", KG],
  ["KILOGRAMO", KG],
  ["KILOS", KG],
  ["KILO", KG],
  ["KGS", KG],
  ["KGR", KG],
  ["KG", KG],
  ["K", KG],
  ["GRAMOS", G],
  ["GRAMO", G],
  ["GRS", G],
  ["GR", G],
  ["G", G],
  ["LITROS", L],
  ["LITRO", L],
  ["LTS", L],
  ["LT", L],
  ["L", L],
  ["MILILITROS", ML],
  ["MILILITRO", ML],
  ["MLS", ML],
  ["ML", ML],
  ["CC", ML],
]);

const UNIT_ALT =
  "KILOGRAMOS?|KILOS?|KGS?|KGR|GRAMOS?|GRS?|MILILITROS?|MLS?|CC|LITROS?|LTS?|LT|K|G|L";
const NUM = "(\\d+(?:[.,]\\d+)?)";
// [1] pack count (1-2 digits), [2] number, [3] unit. The number must not continue a longer number.
const PLAIN = new RegExp(
  `(?<![\\d.,])(?:(\\d{1,2})\\s*[/X]\\s*)?${NUM}\\s?(${UNIT_ALT})(?![A-Z0-9])`,
  "g",
);
// «12/355CCSAB»: only CC and ML may carry glued letters, and only right after the number.
const GLUED = new RegExp(`(?<![\\d.,])(?:(\\d{1,2})\\s*[/X]\\s*)?${NUM}(CC|ML)(?=[A-Z])`, "g");
// [1] pack count (1-2 digits), [2] piece count (1-4 digits), [3] token (D-35).
const PIECE = /(?<![\d.,])(?:(\d{1,2})\s*[/X]\s*)?(\d{1,4})\s?(PZAS|PZA|PZS|PZ|PIEZAS|PIEZA|PKS|PK)(?![A-Z0-9])/g;
// Pack words of a weight or volume reading (RESEARCH). It also matches PZ/PK counts, which is
// harmless there: a piece count next to a weight or volume is already a conflict.
const PACK_TOKEN =
  /\b(PACK|PAQ|PQ|CJ|CAJA|FAJILLAS?|DOCENA)\b|\b\d+\s*(PZ|PZA|PZAS|PIEZAS|PK|P)\b|\dPK\b/;
// Pack words next to a piece count. The piece tokens themselves (PZ...PKS) are NOT pack words.
const PIECE_PACK_WORD = /\b(PACK|PAQ|PQ|CJ|CAJA|FAJILLAS?|DOCENA)\b|\b\d+\s*P\b/;

interface Found {
  family: UnitFamily;
  total: Big;
  text: string;
  explicitPack: boolean;
}

function stripText(description: string): string {
  return description
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .slice(0, MAX_DESCRIPTION_LENGTH);
}

/**
 * "1.700" with a gram/millilitre unit is a thousands dot (1,700 g); "1.730" with K or L is a decimal.
 * A comma followed by exactly three digits is a thousands separator for every unit (es-MX writing:
 * "1,500 ML" is 1500 mL, "1,000 G" is 1000 g); a comma followed by one or two digits is a decimal.
 */
function numberText(raw: string, rule: UnitRule): string {
  if (rule.thousandsDot && /^\d{1,3}\.\d{3}$/.test(raw)) return raw.replace(".", "");
  if (/^\d{1,3},\d{3}$/.test(raw)) return raw.replace(",", "");
  return raw.replace(",", ".");
}

function readWeightVolume(text: string): Found[] {
  const found: Found[] = [];
  for (const re of [PLAIN, GLUED]) {
    for (const match of text.matchAll(re)) {
      const [whole, packText, numText, unitText] = match;
      if (numText === undefined || unitText === undefined) continue;
      const rule = UNIT_RULES.get(unitText);
      if (rule === undefined) continue;
      const size = new Big(numberText(numText, rule)).times(rule.factor);
      const pack = packText === undefined ? null : new Big(packText);
      const total = pack === null ? size : size.times(pack);
      if (size.lte("0") || (pack !== null && pack.lte("0")) || total.gt(MAX_WEIGHT_VOLUME)) {
        continue;
      }
      found.push({
        family: rule.family,
        total,
        text: whole.trim(),
        explicitPack: pack !== null,
      });
    }
  }
  return found;
}

function readPieces(text: string): Found[] {
  const found: Found[] = [];
  for (const match of text.matchAll(PIECE)) {
    const [whole, packText, countText] = match;
    if (countText === undefined) continue;
    const count = Number(countText);
    if (count < 1 || count > MAX_PIECES) continue;
    found.push({
      family: "piece",
      total: new Big(countText),
      text: whole.trim(),
      explicitPack: packText !== undefined,
    });
  }
  return found;
}

function hasConflict(found: readonly Found[]): boolean {
  const distinct = new Set(found.map((f) => `${f.family}:${f.total.toString()}`));
  return distinct.size > 1;
}

/** Reads the presentation size of a description. Pure; never throws. */
export function readSize(description: string): SizeReading {
  const text = stripText(description);
  const weightVolume = readWeightVolume(text);
  const pieces = readPieces(text);
  const all = [...weightVolume, ...pieces];
  const first = all[0];
  if (first === undefined) return { kind: "none" };

  // A weight or volume next to a piece count, or two different values of one kind.
  if ((weightVolume.length > 0 && pieces.length > 0) || hasConflict(weightVolume) || hasConflict(pieces)) {
    return { kind: "ambiguous", reason: "conflict", texts: all.map((f) => f.text) };
  }

  if (weightVolume.length > 0) {
    if (!weightVolume.some((f) => f.explicitPack) && PACK_TOKEN.test(text)) {
      return { kind: "ambiguous", reason: "pack-token", texts: [first.text] };
    }
  } else if (pieces.some((f) => f.explicitPack) || PIECE_PACK_WORD.test(text)) {
    // «12/50PZ» is a pack of counts, not a count: the multiplication is not guessed.
    return { kind: "ambiguous", reason: "pack-token", texts: [first.text] };
  }
  return { kind: "size", family: first.family, total: first.total, text: first.text };
}
