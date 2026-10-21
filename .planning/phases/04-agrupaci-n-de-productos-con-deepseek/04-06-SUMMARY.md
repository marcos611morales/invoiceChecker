---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 06
subsystem: llm
tags: [deepseek, golden-set, vitest, live-check, batch-limits, prompt]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "groupWithDeepSeek, the protected /api/llm/group route, LLM_LIMITS and the client with its timeout (plans 04-01 to 04-05)"
provides:
  - "Golden grouping fixture (MUST, SHOULD and MUST-NOT cases, synthetic suppliers only) and a pure evaluator with tests"
  - "Opt-in live DeepSeek run (LLM_LIVE=1) that never executes in pnpm vitest run"
  - "System prompt that groups by brand and keeps explicit types apart (measured 10/10 on the golden set)"
  - "Batch limit 120 items and the 6144 / 50 s / 110 s / 120 s / 130 s time budget chosen with the user's real key"
affects: [04-07 and later plans that send batches to DeepSeek, 04-21 end-of-phase live check]

plan_head_before: cf77f28ad230411dfa5ed9e79b3251387b4bef55
plan_head_after: 7991c2d793df6c288fde5873f6f58a1aef7aeabc
commits: 6

actuals:
  tokens: 14000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Opt-in live test with describe.skipIf(process.env.LLM_LIVE !== '1'); key loaded from .env.local with process.loadEnvFile, never printed"
    - "Golden quality bar as data (JSON) plus a pure evaluator, not as prose"

key-files:
  created:
    - tests/fixtures/llm/golden-grouping.json
    - tests/support/goldenGrouping.ts
    - tests/goldenGrouping.test.ts
    - tests/llm.live.test.ts
  modified:
    - src/domain/llm/contract.ts
    - src/lib/server/deepseek.ts
    - src/app/api/llm/group/route.ts
    - src/lib/client/llmClient.ts
    - src/domain/llm/candidates.test.ts
    - src/lib/server/deepseek.test.ts
    - src/app/api/llm/group/route.test.ts
    - src/features/products/ProductsTab.test.tsx

key-decisions:
  - "lower-120 chosen by the user at the checkpoint: LLM_LIMITS.groupItems 120, GROUP_MAX_TOKENS 6144, ATTEMPT_TIMEOUT_MS 50000, DEADLINE_MS 110000, maxDuration 120, CLIENT_TIMEOUT_MS 130000 (D-28, RESEARCH OQ3)"
  - "User chose to adjust the prompt (not the golden set) after the MUST-NOT violation; final rule: group by brand, keep explicit types apart without a shared brand, with neutral examples not taken from the golden set"
  - "tests/llm.live.test.ts keeps its own 180 s per-run test timeout; it is above the new 110 s server deadline, so no change was needed"

patterns-established:
  - "A threshold that the code asserts (limits, timeouts) lives in one constant and every test asserts the same number, so changing the budget is a mechanical edit"

requirements-completed: [LLM-01, LLM-05, ACC-04]

coverage:
  - id: D1
    description: "Golden grouping fixture with MUST, SHOULD and MUST-NOT cases (D-32), synthetic supplier labels only, validated by goldenSetSchema and the fixtures guard"
    requirement: "LLM-01"
    verification:
      - kind: unit
        ref: "tests/goldenGrouping.test.ts#fixture parses with goldenSetSchema"
        status: pass
      - kind: unit
        ref: "tests/fixtures.guard.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pure evaluator evaluateGolden (coverage, MUST misses, SHOULD hits, MUST-NOT violations, name problems)"
    requirement: "LLM-05"
    verification:
      - kind: unit
        ref: "tests/goldenGrouping.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Opt-in live run that is skipped unless LLM_LIVE=1, so pnpm vitest run never calls DeepSeek and never prints the key"
    requirement: "ACC-04"
    verification:
      - kind: unit
        ref: "pnpm vitest run (tests/llm.live.test.ts reported as skipped)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Batch limit 120 and the time budget in the code match the set chosen at the checkpoint, and every test asserting the old values was updated"
    requirement: "LLM-01"
    verification:
      - kind: unit
        ref: "pnpm exec vitest run src/domain/llm src/lib/server src/app/api/llm src/features/products"
        status: pass
      - kind: other
        ref: "pnpm verify (lint, typecheck, test, build)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Quality of the grouping on the real 227-description sample (card review, accept and reload, second sample, wrong-key injection) with the 120-item batches"
    requirement: "LLM-01"
    verification: []
    human_judgment: true
    rationale: "Steps 3-6 of the live checkpoint were not done; the user will repeat them on the new batch size after this plan merges"

duration: "continuation ~12 min (first session not timed)"
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 06: Golden grouping set, live DeepSeek check and chosen batch limits Summary

**Golden grouping set with a tested evaluator, an opt-in live DeepSeek run, a brand-based grouping prompt that passed the golden set 10/10, and the batch limit lowered from 250 to 120 items (6144 tokens, 50 s attempt, 110 s deadline) after the real 227-item sample came back incomplete.**

## Performance

- **Duration:** continuation ~12 min; the first session and the checkpoint wait were not timed
- **Completed:** 2026-10-21
- **Tasks:** 3 (Task 1 TDD, Task 2 human-verify checkpoint, Task 3 constants)
- **Files:** 4 created, 8 modified

## Accomplishments

- `tests/fixtures/llm/golden-grouping.json` holds 14 items with synthetic suppliers, the two MUST pairs (leche entera, JAMON ZWAN with JAMON ZWAN VIRGINIA from another supplier, D-32), the SHOULD pairs and the MUST-NOT pairs; `evaluateGolden` is pure and covered by tests.
- `tests/llm.live.test.ts` runs the golden request 10 times only with `LLM_LIVE=1`; the default suite reports it skipped.
- The user ran it against DeepSeek and the system prompt was fixed twice until the golden set passed (see Deviations).
- The user ran the real 2025 sample (227 descriptions) in one 250-limit batch and it failed with `incomplete_response`; the user chose lower-120 and Task 3 applied it.

## Task Commits

1. **Task 1 (RED): failing tests for the golden grouping evaluator** - `bacd968` (test)
2. **Task 1 (GREEN): evaluator and opt-in live run** - `505e530` (feat)
3. **Task 2: live DeepSeek check** - checkpoint, no commit (the user ran it; results below)
4. **Task 2a (orchestrator, on the user's decision): do not merge distinct varieties of the same food** - `49c0226` (fix)
5. **Task 2b (orchestrator, on the user's decision): group by brand, keep explicit types apart** - `188d123` (fix)
6. **Task 3: apply lower-120 limits and timeouts** - `7991c2d` (fix)

`commits: 6` is `git rev-list --count cf77f28..HEAD` measured before this SUMMARY commit; it includes the merge commit `4599300` the orchestrator made in the worktree, so five commits are plan work plus that merge.

## Files Created/Modified

- `tests/fixtures/llm/golden-grouping.json` - golden items and MUST, SHOULD, MUST-NOT cases
- `tests/support/goldenGrouping.ts` - `goldenSetSchema`, `GoldenReport`, `evaluateGolden`
- `tests/goldenGrouping.test.ts` - evaluator behavior and fixture parse
- `tests/llm.live.test.ts` - opt-in live run (10 sequential runs, per-run line and final summary)
- `src/domain/llm/contract.ts` - `groupItems: 120`
- `src/lib/server/deepseek.ts` - prompt rules (2a, 2b); `DEADLINE_MS` 110000, `ATTEMPT_TIMEOUT_MS` 50000, `GROUP_MAX_TOKENS` 6144
- `src/app/api/llm/group/route.ts` - `maxDuration = 120`
- `src/lib/client/llmClient.ts` - `CLIENT_TIMEOUT_MS = 130000`
- `src/domain/llm/candidates.test.ts`, `src/lib/server/deepseek.test.ts`, `src/app/api/llm/group/route.test.ts`, `src/features/products/ProductsTab.test.tsx` - assert the new values

## TDD RED evidence assessment (Task 1)

The RED commit `bacd968` contains the fixture, the schema, the tests and an `evaluateGolden` stub; its message records that 13 tests failed on the planned assertions (perfect answer, missed MUST pair, MUST-NOT violation, name problems, missing id in coverage). The failures were assertion failures of the target tests, not import, syntax or zero-test faults, and the fixture-parse test passed as intended. No machine-checked `gsd_run check tdd-red-evidence` record was persisted by the first session and this continuation did not re-run RED (it would require reverting the GREEN commit), so this assessment rests on the RED commit message and on the GREEN commit `505e530` turning the same tests green. The plan is `type: execute` with `tdd="true"` on one task, not a plan-level `type: tdd` plan, so the plan-level gate sequence section does not apply.

## Live check measurements (Task 2, recorded from the user's report)

| Measurement | Result |
|-------------|--------|
| Missing balance | The first attempts returned `upstream_balance` (HTTP 402) on all 10 runs until the user topped up the DeepSeek account; the 402 was correctly not retried |
| Golden run, original prompt | 10/10 runs ok at attempt 1, `finishReason` stop, `reasoningTokens` empty (JSON mode works with thinking disabled), coverage complete, both MUST pairs and 3/3 SHOULD every run; p95 7409 ms (others 1.0 to 1.4 s); about 644 prompt and 157 completion tokens; MUST-NOT violated 10/10 («MM JAMONSERR», i11, grouped with i10 and i14, the JAMON ZWAN pair) |
| Golden run, rule v1 (`49c0226`, serrano versus virginia example) | MUST i10+i14 missed 10/10; MUST-NOT i11+i10 still 5/10; p95 1737 ms; 712 prompt tokens |
| Golden run, rule v2 (`188d123`, group by brand, neutral examples) | Passed 10/10 (MUST misses 0, MUST-NOT violations 0). The exact p95 of this run was not reported |
| Real data, 227 descriptions in one batch (250 limit) | `POST /api/llm/group` returned 502 twice: `outcome incomplete_response`, 2 attempts, 23825 ms, `finishReason` stop, 6999 prompt tokens, 3543 completion tokens. The model answered in full but omitted, duplicated or invented ids, so the coverage invariant rejected the batch |
| Tokens versus estimate | About 7k in and 2.7k out were estimated; 6999 in matches, 3543 out is about 1.3 times, under the 1.5 times threshold, so the prompt is not too long |
| First-attempt failure rate | Golden: 0/10 failed at attempt 1 (all ok at attempt 1). Real sample: 2/2 attempts failed with `incomplete_response` |
| Resume signal | **lower-120**, chosen to fix `incomplete_response` on the real 227-item sample |

### Chosen set (applied in Task 3, commit `7991c2d`)

| Constant | Was | Now |
|----------|-----|-----|
| `LLM_LIMITS.groupItems` | 250 | 120 |
| `GROUP_MAX_TOKENS` | 8192 | 6144 |
| `ATTEMPT_TIMEOUT_MS` | 80000 | 50000 |
| `DEADLINE_MS` | 170000 | 110000 |
| route `maxDuration` | 180 | 120 |
| `CLIENT_TIMEOUT_MS` | 190000 | 130000 |

Candidate batch splits asserted by tests are now 0, 1, 120, 121 (61 and 60) and 240 (120 and 120). The system prompt from `188d123` is unchanged.

## Pending human verification

The user did not complete steps 3 to 6 of the checkpoint on the real data. They are NOT passed and will be repeated on the new batch size after this plan merges:

1. Review of the first 30 multi-member cards (at least 80% right as they are, names readable Spanish) with 120-item batches.
2. Accept two cards, reload, and check the accepted descriptions are no longer counted in the caption.
3. A second run on the real sample for a second latency and failure sample (step 4), including the real p95 per batch with 120 items.
4. Wrong-key injection: «DeepSeek rechazó la clave de acceso del servidor. Avisa a quien administra la aplicación.» after one batch.
5. Compare tokens per 120-item batch with the estimate.
6. The exact p95 of the final golden run (rule v2) was not reported; it was reported as passing 10/10.

The expectation that 120-item batches remove `incomplete_response` on the 227-item sample is not yet confirmed; it is the reason the user picked lower-120.

## Decisions Made

- lower-120 (user decision at the checkpoint), applying the plan's second branch exactly.
- Prompt adjustment instead of changing the golden set (user decision after the MUST-NOT violation); neutral examples so the prompt does not echo the golden items.
- `tests/llm.live.test.ts` `RUN_TIMEOUT_MS` (180 s) left as it was: it is above the new 110 s deadline, and the plan asked for 180 s.

## Deviations from Plan

### Prompt fixes made during the checkpoint (orchestrator commits, on the user's decision)

**1. [User decision - prompt] Do not merge distinct varieties of the same food**
- **Found during:** Task 2 (live golden run)
- **Issue:** MUST-NOT violated 10/10: «MM JAMONSERR» (serrano) grouped with the JAMON ZWAN pair.
- **Fix:** Added a rule to the system prompt with a serrano/virginia example.
- **Files modified:** `src/lib/server/deepseek.ts`
- **Verification:** Live run: MUST i10+i14 missed 10/10 and MUST-NOT still 5/10, so the rule was both too strong and not enough.
- **Committed in:** `49c0226`

**2. [User decision - prompt] Group by brand, keep explicit types apart without a shared brand**
- **Found during:** Task 2 (live golden run after rule v1)
- **Issue:** Rule v1 split JAMON ZWAN from JAMON ZWAN VIRGINIA and still merged ZWAN with serrano in 5/10.
- **Fix:** Rewrote the rule to group by brand and keep explicit types apart only without a shared brand; examples are neutral and not taken from the golden set.
- **Files modified:** `src/lib/server/deepseek.ts`
- **Verification:** The user reports the golden run passed 10/10 (MUST and MUST-NOT both 0).
- **Committed in:** `188d123`

### Auto-fixed Issues

None in this continuation. Task 3 changed exactly the constants and test assertions the plan lists.

---

**Total deviations:** 2 prompt fixes made at the user's request during the checkpoint; no auto-fixes.
**Impact on plan:** The prompt changes touch `src/lib/server/deepseek.ts`, which the plan lists in `files_modified`; scope is unchanged.

## Issues Encountered

- The first live attempts failed with `upstream_balance` (HTTP 402) until the user topped up the DeepSeek account; the code correctly did not retry.
- The 227-item real sample failed with `incomplete_response` in one 250-limit batch (see measurements). Mitigated, not yet confirmed, by lower-120.

## Verification

- `pnpm exec vitest run src/domain/llm src/lib/server src/app/api/llm src/features/products`: 7 files, 183 tests passed.
- `pnpm verify` (eslint, `next typegen && tsc --noEmit`, `vitest run`, `next build`): all passed; 79 test files passed and 6 skipped, 1961 tests passed and 75 skipped (`tests/llm.live.test.ts` among the skipped; nothing called DeepSeek in this continuation).
- Acceptance: `grep -c "groupItems: 120" src/domain/llm/contract.ts` prints 1; `grep -cE "maxDuration[[:space:]]=[[:space:]]120;" src/app/api/llm/group/route.ts` prints 1.

## Known Stubs

None. `evaluateGolden` was a deliberate stub only in the RED commit.

## Threat Flags

None. No new endpoints, auth paths or file access; the live test prints meta only and reads `.env.local` solely for the opt-in run (T-04-16); the fixture has synthetic suppliers only (T-04-17).

## User Setup Required

`DEEPSEEK_API_KEY` in `.env.local` (git-ignored) for the opt-in live run, as in the plan's `user_setup`; no other configuration.

## Next Phase Readiness

- The server limits are consistent end to end (120 items, 6144 tokens, 50 s, 110 s, route 120 s, client 130 s).
- Before relying on the Productos flow on real data, the user should repeat the pending human verification above on 120-item batches.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*

## Self-Check: PASSED

Created files found on disk (4 of 4). Commits found in the branch history: `bacd968`, `505e530`, `49c0226`, `188d123`, `7991c2d`. Task 3 acceptance greps pass and `pnpm verify` exits 0.
