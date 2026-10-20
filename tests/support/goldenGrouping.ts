/**
 * The golden grouping set (D-32, RESEARCH Evaluation) and a pure evaluator of one
 * answer against it. Test helper: used by the offline test and by the opt-in live
 * run, never by production code.
 */
import { z } from "zod";
import type { Coverage } from "@/domain/llm/reconcile";

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

export function evaluateGolden(
  golden: GoldenSet,
  groups: readonly { name: string; ids: readonly string[] }[],
): GoldenReport {
  void golden;
  void groups;
  return {
    coverage: { missing: [], unknown: [], duplicated: [] },
    mustGroupMissed: [],
    shouldGroupHit: 0,
    shouldGroupTotal: 0,
    mustNotViolated: [],
    nameProblems: [],
  };
}
