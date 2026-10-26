/**
 * Table of SAT ClaveUnidad codes that can be compared by price (Phase 5, D-09 step 2, D-11,
 * D-32). A code belongs to one family (mass, volume or piece) and carries the factor that
 * turns one unit of it into the base unit of the family: kg, L or pieza. Factors are decimal
 * strings so `Big` builds them exactly (strict mode rejects numbers).
 *
 * The free-text `Unidad` attribute is inconsistent in real invoices and is never used; only the
 * catalog code classifies a line.
 */

export type UnitFamily = "mass" | "volume" | "piece";

export interface UnitRule {
  family: UnitFamily;
  /** Decimal string: how many kg, L or pieces one unit of this code is. */
  factor: string;
}

const MASS: readonly (readonly [string, string])[] = [
  ["KGM", "1"],
  ["GRM", "0.001"],
  ["MGM", "0.000001"],
  ["TNE", "1000"],
  ["LBR", "0.45359237"],
  ["ONZ", "0.028349523125"],
];

const VOLUME: readonly (readonly [string, string])[] = [
  ["LTR", "1"],
  ["MLT", "0.001"],
  ["CMQ", "0.001"],
  ["CLT", "0.01"],
  ["DLT", "0.1"],
  ["MTQ", "1000"],
  ["GLL", "3.785411784"],
];

/** The four codes of D-09 followed by the extra piece codes of D-32. */
const PIECE: readonly string[] = [
  "H87",
  "XUN",
  "XPK",
  "E48",
  "EA",
  "ACT",
  "XBX",
  "X4G",
  "XBJ",
  "XBO",
  "XBG",
  "XCT",
  "XCS",
  "XPA",
  "SET",
  "KT",
  "XKI",
];

/**
 * A Map and not an object keyed by the XML value, so a code such as "__proto__" stays plain
 * data. Module scope: built once.
 */
const RULES: ReadonlyMap<string, UnitRule> = new Map<string, UnitRule>([
  ...MASS.map(([code, factor]): [string, UnitRule] => [code, { family: "mass", factor }]),
  ...VOLUME.map(([code, factor]): [string, UnitRule] => [code, { family: "volume", factor }]),
  ...PIECE.map((code): [string, UnitRule] => [code, { family: "piece", factor: "1" }]),
]);

/** The rule of a ClaveUnidad (trimmed, uppercased lookup), or null when it has no equivalence. */
export function unitRuleOf(claveUnidad: string): UnitRule | null {
  return RULES.get(claveUnidad.trim().toUpperCase()) ?? null;
}
