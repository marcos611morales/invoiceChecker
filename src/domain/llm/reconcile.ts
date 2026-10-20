/**
 * The answer of the model is untrusted (D-11, D-12, OQ3). Two pure checks keep
 * it honest: every id that was sent comes back exactly once and nothing else
 * does (coverage), and a proposed product name is made safe to show and to
 * store. Pure: relative imports only.
 */
import { cutText } from "./candidates";
import { LLM_LIMITS } from "./contract";

export interface Coverage {
  /** Sent ids that no group contains. */
  missing: string[];
  /** Ids in a group that were never sent. */
  unknown: string[];
  /** Sent ids that appear again after their first appearance (one entry per extra appearance). */
  duplicated: string[];
}

/** How the groups of an answer cover the ids that were sent. */
export function coverageOf(
  sentIds: readonly string[],
  groups: readonly { ids: readonly string[] }[],
): Coverage {
  const sent = new Set(sentIds);
  const seen = new Set<string>();
  const unknown: string[] = [];
  const duplicated: string[] = [];
  for (const group of groups) {
    for (const id of group.ids) {
      if (!sent.has(id)) unknown.push(id);
      else if (seen.has(id)) duplicated.push(id);
      else seen.add(id);
    }
  }
  return { missing: sentIds.filter((id) => !seen.has(id)), unknown, duplicated };
}

/** An answer is usable only when nothing is missing, unknown or repeated. */
export function isComplete(coverage: Coverage): boolean {
  return (
    coverage.missing.length === 0 &&
    coverage.unknown.length === 0 &&
    coverage.duplicated.length === 0
  );
}

/**
 * A product name from the model: control characters out (each one becomes a
 * space, so «a\nb» stays two words), runs of whitespace collapsed, trimmed and cut
 * to the name limit. "" when nothing usable is left; the caller picks a fallback.
 */
export function normalizeProductName(raw: string): string {
  return cutText(
    raw.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim(),
    LLM_LIMITS.productName,
  );
}
