/**
 * Opt-in live check of the grouping path against DeepSeek (Plan 04-06, RESEARCH
 * live checkpoint). It never runs in `pnpm vitest run`: set LLM_LIVE=1.
 *
 *   LLM_LIVE=1 pnpm exec vitest run tests/llm.live.test.ts
 *
 * The key is read from the process environment, loading .env.local first when it
 * exists. Only the golden descriptions and synthetic supplier labels leave the
 * machine; nothing is read from Facturas/ and the key is never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groupRequestSchema, type GroupRequest } from "@/domain/llm/contract";
import { isComplete } from "@/domain/llm/reconcile";
import {
  groupWithDeepSeek,
  readDeepseekEnv,
  type DeepseekEnv,
} from "@/lib/server/deepseek";
import { evaluateGolden, goldenSetSchema, type GoldenReport } from "./support/goldenGrouping";

const RUNS = 10;
const RUN_TIMEOUT_MS = 180_000;

interface RunRecord {
  outcome: string;
  attempts: number;
  durationMs: number;
  finishReason: string | null;
  reasoningTokens: number | null;
  report: GoldenReport | null;
}

/** Nearest-rank percentile of a non-empty list. */
function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(fraction * sorted.length));
  return sorted[rank - 1] ?? 0;
}

function describeReport(report: GoldenReport | null): string {
  if (report === null) return "no answer to evaluate";
  return [
    `coverage missing=${report.coverage.missing.length} unknown=${report.coverage.unknown.length} duplicated=${report.coverage.duplicated.length}`,
    `MUST missed=${report.mustGroupMissed.length}`,
    `MUST-NOT violated=${report.mustNotViolated.length}`,
    `SHOULD ${report.shouldGroupHit}/${report.shouldGroupTotal}`,
    `name problems=${report.nameProblems.length}`,
  ].join(" | ");
}

describe.skipIf(process.env.LLM_LIVE !== "1")("DeepSeek live: golden grouping", () => {
  const rawGolden: unknown = JSON.parse(
    readFileSync(resolve(process.cwd(), "tests/fixtures/llm/golden-grouping.json"), "utf8"),
  );
  const golden = goldenSetSchema.parse(rawGolden);
  const request: GroupRequest = groupRequestSchema.parse({ items: golden.items, existing: [] });
  const records: RunRecord[] = [];
  let env: DeepseekEnv | null = null;

  beforeAll(() => {
    const file = resolve(process.cwd(), ".env.local");
    if (existsSync(file)) process.loadEnvFile(file);
    env = readDeepseekEnv();
    if (env === null) {
      throw new Error("DeepSeek is not configured: put the server key in .env.local and run again.");
    }
  });

  afterAll(() => {
    if (records.length === 0) return;
    const durations = records.map((record) => record.durationMs);
    const retried = records.filter((record) => record.attempts > 1).length;
    const failed = records.filter((record) => record.outcome !== "ok").length;
    const thinking = records.filter(
      (record) => (record.reasoningTokens ?? 0) > 0 || record.finishReason !== "stop",
    ).length;
    const mustMissed = records.filter((record) => (record.report?.mustGroupMissed.length ?? 0) > 0);
    const mustNotViolated = records.filter(
      (record) => (record.report?.mustNotViolated.length ?? 0) > 0,
    );
    const shouldHits = records.map(
      (record) => `${record.report?.shouldGroupHit ?? 0}/${record.report?.shouldGroupTotal ?? 0}`,
    );
    console.info(
      [
        "[llm.live] summary",
        `runs=${records.length}`,
        `p95 durationMs=${percentile(durations, 0.95)}`,
        `max durationMs=${Math.max(...durations)}`,
        `runs that needed a retry (first attempt failed)=${retried}`,
        `runs that failed in the end=${failed}`,
        `runs with reasoning tokens or finish_reason other than stop=${thinking}`,
        `runs with a MUST pair missed=${mustMissed.length}`,
        `runs with a MUST-NOT pair violated=${mustNotViolated.length}`,
        `SHOULD hits per run=${shouldHits.join(",")}`,
      ].join("\n  "),
    );
  });

  for (let run = 1; run <= RUNS; run += 1) {
    it(
      `run ${run} of ${RUNS} groups the golden set`,
      async () => {
        if (env === null) throw new Error("DeepSeek is not configured.");
        const result = await groupWithDeepSeek(request, env, AbortSignal.timeout(RUN_TIMEOUT_MS));
        const report = result.ok ? evaluateGolden(golden, result.data) : null;
        const record: RunRecord = {
          outcome: result.ok ? "ok" : result.error,
          attempts: result.meta.attempts,
          durationMs: result.meta.durationMs,
          finishReason: result.meta.finishReason,
          reasoningTokens: result.meta.reasoningTokens,
          report,
        };
        records.push(record);
        console.info(
          [
            `[llm.live] run ${run}`,
            `attempts=${result.meta.attempts}`,
            `durationMs=${result.meta.durationMs}`,
            `finishReason=${result.meta.finishReason ?? "none"}`,
            `promptTokens=${result.meta.promptTokens ?? "none"}`,
            `completionTokens=${result.meta.completionTokens ?? "none"}`,
            `reasoningTokens=${result.meta.reasoningTokens ?? "none"}`,
            `outcome=${record.outcome}`,
            describeReport(report),
          ].join(" | "),
        );
        if (report !== null) {
          for (const pair of report.mustGroupMissed) console.info(`  MUST missed: ${pair.join(" + ")}`);
          for (const pair of report.mustNotViolated) console.info(`  MUST-NOT violated: ${pair.join(" + ")}`);
          for (const problem of report.nameProblems) console.info(`  name problem: ${problem}`);
        }

        expect(result.ok).toBe(true);
        expect(report).not.toBeNull();
        if (report === null) return;
        expect(isComplete(report.coverage)).toBe(true);
        expect(report.mustGroupMissed).toEqual([]);
        expect(report.mustNotViolated).toEqual([]);
      },
      RUN_TIMEOUT_MS,
    );
  }
});
