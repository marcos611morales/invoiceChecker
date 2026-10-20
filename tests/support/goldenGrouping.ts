/**
 * The golden grouping set (D-32, RESEARCH Evaluation) and a pure evaluator of one
 * answer against it. Test helper: used by the offline test and by the opt-in live
 * run, never by production code.
 */
import { z } from "zod";
import { LLM_LIMITS } from "@/domain/llm/contract";
import { coverageOf, normalizeProductName, type Coverage } from "@/domain/llm/reconcile";

const idListSchema = z.array(z.string().min(1)).min(2);

export const goldenSetSchema = z
  .strictObject({
    items: z
      .array(
        z.strictObject({
          id: z.string().min(1),
          description: z.string().min(1),
          supplier: z.string().min(1),
        }),
      )
      .min(1),
    mustGroup: z.array(idListSchema),
    shouldGroup: z.array(idListSchema),
    mustNotGroup: z.array(idListSchema),
  })
  .superRefine((golden, context) => {
    const known = new Set(golden.items.map((item) => item.id));
    if (known.size !== golden.items.length) {
      context.addIssue({ code: "custom", message: "item ids must be unique" });
    }
    for (const kind of ["mustGroup", "shouldGroup", "mustNotGroup"] as const) {
      for (const ids of golden[kind]) {
        if (ids.some((id) => !known.has(id))) {
          context.addIssue({ code: "custom", message: `${kind} names an id that is not an item` });
        }
      }
    }
  });

export type GoldenSet = z.infer<typeof goldenSetSchema>;

export interface GoldenReport {
  /** Hard invariant (D-11): every sent id exactly once, nothing else. */
  coverage: Coverage;
  /** MUST-group cases whose ids did not all land in one group. */
  mustGroupMissed: string[][];
  shouldGroupHit: number;
  shouldGroupTotal: number;
  /** MUST-NOT cases whose ids all landed in one group. */
  mustNotViolated: string[][];
  /** One readable line per problem with a product name (D-12). */
  nameProblems: string[];
}

/** The name rule of D-04 and D-12: edge spaces and case do not matter. */
function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** «Sin categoría» is a category label, never a product name; accents do not matter. */
function isSinCategoria(name: string): boolean {
  return (
    name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .trim()
      .toLowerCase() === "sin categoria"
  );
}

function nameProblemsOf(groups: readonly { name: string }[]): string[] {
  const problems: string[] = [];
  const firstSeen = new Map<string, string>();
  for (const { name } of groups) {
    const normalized = normalizeProductName(name);
    if (normalized === "") {
      problems.push("a product has an empty name");
      continue;
    }
    if (name.trim().length > LLM_LIMITS.productName) {
      problems.push(`«${normalized}…» is longer than ${LLM_LIMITS.productName} characters`);
    }
    if (isSinCategoria(normalized)) {
      problems.push(`«${normalized}» is a category label, not a product name`);
    }
    const key = nameKey(normalized);
    const first = firstSeen.get(key);
    if (first === undefined) firstSeen.set(key, normalized);
    else problems.push(`«${normalized}» is repeated (same as «${first}» ignoring case)`);
  }
  return problems;
}

export function evaluateGolden(
  golden: GoldenSet,
  groups: readonly { name: string; ids: readonly string[] }[],
): GoldenReport {
  const coverage = coverageOf(
    golden.items.map((item) => item.id),
    groups,
  );

  // The first group that holds each id; a repeated id keeps its first group (coverage reports the repeat).
  const groupOf = new Map<string, number>();
  groups.forEach((group, index) => {
    for (const id of group.ids) {
      if (!groupOf.has(id)) groupOf.set(id, index);
    }
  });
  const together = (ids: readonly string[]): boolean => {
    const first = ids[0] === undefined ? undefined : groupOf.get(ids[0]);
    return first !== undefined && ids.every((id) => groupOf.get(id) === first);
  };

  return {
    coverage,
    mustGroupMissed: golden.mustGroup.filter((ids) => !together(ids)),
    shouldGroupHit: golden.shouldGroup.filter(together).length,
    shouldGroupTotal: golden.shouldGroup.length,
    mustNotViolated: golden.mustNotGroup.filter(together),
    nameProblems: nameProblemsOf(groups),
  };
}
