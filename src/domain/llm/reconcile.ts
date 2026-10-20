/**
 * Coverage invariant and product-name normalization (D-11, D-12). RED skeleton:
 * the bodies are replaced in the GREEN commit.
 */

export interface Coverage {
  missing: string[];
  unknown: string[];
  duplicated: string[];
}

export function coverageOf(
  sentIds: readonly string[],
  groups: readonly { ids: readonly string[] }[],
): Coverage {
  void sentIds;
  void groups;
  return { missing: [], unknown: [], duplicated: [] };
}

export function isComplete(coverage: Coverage): boolean {
  void coverage;
  return false;
}

export function normalizeProductName(raw: string): string {
  return raw;
}
