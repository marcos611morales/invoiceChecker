---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 04
subsystem: api
tags: [deepseek, retry, deadline, server-only, eslint, secrets-scan, smoke-test, vitest]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "04-02: protected /api/llm/group route and the server-only deepseek.ts module with one attempt"
provides:
  - "groupWithDeepSeek with one deadline-aware retry, full error taxonomy, meta and one content-free log line"
  - "LlmClock / REAL_CLOCK time seam"
  - "mergeSameNamedGroups (same-name merge of one answer)"
  - "Leak-proof route tests, source guard test, ESLint server boundary"
  - "check-bundle-secrets with a DeepSeek sentinel over static and prerendered output; smoke-auth probes of the LLM route"
affects: [04-06 live check, 04-05 (parallel, no shared files)]

plan_head_before: 81be1988ce1d06f33c4ea795becc040dcf66d326
plan_head_after: 1707de186f1cef70f9022495aa1246bc25be1686

actuals:
  tokens: 36000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Time seam (LlmClock) so deadline logic is tested without fake timers"
    - "Response factories for repeated upstream answers (a Response body reads once)"
    - "no-restricted-imports boundary for browser-side folders, tests exempt"

key-files:
  created:
    - src/lib/server/deepseek.test.ts
    - src/domain/llm/reconcile.test.ts
    - tests/llmSecrets.guard.test.ts
  modified:
    - src/lib/server/deepseek.ts
    - src/domain/llm/reconcile.ts
    - src/app/api/llm/group/route.test.ts
    - eslint.config.mjs
    - scripts/check-bundle-secrets.mjs
    - scripts/smoke-auth.mjs
    - README.md

key-decisions:
  - "Non-listed non-2xx upstream statuses (for example 404) map to upstream_unavailable but are not retried; only 429 and 5xx are"
  - "A numeric Retry-After is used only when the wait still leaves the 20 s retry budget; otherwise the 1 to 2 s jitter applies"
  - "Caller abort (browser gone) is final: upstream_timeout, no retry, the abort reaches fetch"
  - "ESLint boundary also lists **/lib/server/* so a relative import cannot slip past @/lib/server/*"

patterns-established:
  - "Server logging: exactly one console.info('[llm] {json}') per call with codes and counts only"
  - "Leak tests: spy on all four console methods and assert no key, upstream text, description or supplier"

requirements-completed: [ACC-03, ACC-04, LLM-05]

coverage:
  - id: D1
    description: "Server retries a flaky grouping answer once, never retries refusals a retry cannot fix, and stays inside the 170 s deadline"
    requirement: LLM-05
    verification:
      - kind: unit
        ref: "src/lib/server/deepseek.test.ts#one retry for a flaky answer, refusals not retried, 429 wait, 5xx, the 170-second deadline, the caller's signal"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every failure maps to our own code and status; same-name groups merge; one content-free log line per call"
    requirement: LLM-05
    verification:
      - kind: unit
        ref: "src/lib/server/deepseek.test.ts#one content-free log line per call; src/domain/llm/reconcile.test.ts#mergeSameNamedGroups"
        status: pass
    human_judgment: false
  - id: D3
    description: "The key, upstream text and invoice text never appear in a response body, header or log across every upstream branch"
    requirement: ACC-04
    verification:
      - kind: unit
        ref: "src/app/api/llm/group/route.test.ts#nothing of the key or of the invoices leaves"
        status: pass
      - kind: unit
        ref: "tests/llmSecrets.guard.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Browser-side code cannot import the server modules (ESLint) and the production build carries no DeepSeek key or variable name"
    requirement: ACC-04
    verification:
      - kind: other
        ref: "pnpm lint (no-restricted-imports verified against a temporary offender)"
        status: pass
      - kind: other
        ref: "node scripts/check-bundle-secrets.mjs"
        status: pass
    human_judgment: false
  - id: D5
    description: "A production server refuses unauthenticated, malformed and unconfigured grouping calls without reaching DeepSeek"
    requirement: ACC-03
    verification:
      - kind: other
        ref: "pnpm build && pnpm smoke:auth (17 checks)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 04: Grouping route hardening Summary

**Deadline-aware single retry for DeepSeek grouping (170 s budget, 80 s per attempt, 20 s minimum retry budget), full error taxonomy with one content-free log line, same-name group merge, and automated proof (route sentinel tests, source guard, ESLint boundary, build scan, production smoke probes) that the key never leaks.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 3 (Task 1 as RED then GREEN)
- **Files modified:** 10 (3 created)

## Accomplishments

- `groupWithDeepSeek(request, env, signal, clock = REAL_CLOCK)` now makes at most 2 attempts: each attempt is capped at `min(80 s, remaining - 5 s)`, no retry starts with under 20 s left, 429 waits 1 to 2 s with jitter (or a numeric `Retry-After` that still leaves the budget), 500/502/503/504, network errors, attempt timeouts, empty/non-JSON/off-schema/cut-off/incomplete answers are retried, and 400/401/402/422 and the caller's abort are final.
- Failures are reported only as our own codes (`upstream_auth`, `upstream_balance`, `upstream_rejected`, `upstream_rate_limited`, `upstream_unavailable`, `upstream_timeout`, `invalid_response`, `incomplete_response`), with `meta.attempts` and the last attempt's finish reason and token counts.
- Exactly one `console.info("[llm] {...}")` line per call (route, outcome, attempts, durationMs, finishReason, three token counts); no other console call in the module.
- `mergeSameNamedGroups` merges groups whose names differ only in case and edge spaces (first name, ids in order, first non-null `existing`), applied before the coverage check.
- Route tests drive 12 upstream scenarios plus an attempt timeout, a browser abort and a tampered cookie with a key-echoing upstream body, asserting no key, upstream marker, `Bearer`, description or supplier in any body, header or console argument. A deliberate `console.warn(env.apiKey)` mutation made 14 of them fail, then was reverted.
- `tests/llmSecrets.guard.test.ts`: no public-prefixed DeepSeek variable, the key variable only in the server module and stubbing tests, every non-test file under `src/lib/server` starts with `import "server-only"`.
- ESLint: `src/features`, `src/components`, `src/stores`, `src/lib/client`, `src/lib/copy` (tests exempt) cannot import `@/lib/server/*`, `**/lib/server/*` or `server-only` (verified on a temporary offender, then removed).
- `check-bundle-secrets.mjs` adds a DeepSeek sentinel and the names `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL`, and also scans the prerendered `.html` and `.rsc` under `.next/server/app`; `smoke-auth.mjs` starts servers with an empty DeepSeek key and checks 400 (text/plain), 400 (extra `rfc`), 500 `server_not_configured`; README step 7 updated.

## Task Commits

1. **Task 1 RED:** `f83dd6a` (test) failing tests for retry, mapping, log line and merge
2. **Task 1 GREEN:** `93334af` (feat) retrying `groupWithDeepSeek`, `mergeSameNamedGroups`, route tests moved to response factories
3. **Task 2:** `ed0e4b2` (test) sentinel route tests, source guard, ESLint boundary
4. **Task 3:** `1707de1` (feat) bundle scan and smoke probes, README

## TDD Gate Compliance

- **RED:** `f83dd6a`. 34 of 41 new tests failed (the 7 that passed already described behavior the single-attempt code had, such as not retrying a 401). The classifier verdict `RED_EVIDENCE_OK` was obtained for the `reconcile.test.ts` target (`mergeSameNamedGroups is not a function`, tap-flat report); the combined run could not be classified because Vitest's reporter emits multi-line assertion diffs that are not valid TAP. Semantic assessment: the failing `deepseek.test.ts` tests failed on the planned assertions (attempts 1 instead of 2, no sleep recorded, no `[llm]` line), not on setup errors.
- **GREEN:** `93334af`, all pass.
- **REFACTOR:** none needed.

## Decisions Made

- Other non-2xx statuses are mapped to `upstream_unavailable` without a retry (a second call cannot fix them); the plan listed the retried statuses explicitly.
- Retry-After beyond what the budget allows falls back to the jitter wait rather than skipping the retry.
- The extra `**/lib/server/*` ESLint pattern was added so a relative import cannot bypass `@/lib/server/*`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing route tests fed one upstream answer to a now-retrying route**
- **Found during:** Task 1
- **Issue:** `mockResolvedValueOnce` left the second attempt with `undefined`, so 9 route tests reported `upstream_unavailable`/502 instead of the intended code (some passed for the wrong reason).
- **Fix:** an `always(factory)` helper answers every attempt with a fresh Response; also asserted two calls for retried failures.
- **Files modified:** `src/app/api/llm/group/route.test.ts`
- **Committed in:** `93334af`

**2. [Rule 3 - Blocking] Guard allow-list extended with the slice test**
- **Found during:** Task 2
- **Issue:** the plan allows `DEEPSEEK_API_KEY` only in `src/lib/server/deepseek.ts` and test files under `src/lib/server` and `src/app/api/llm`, but the existing `src/features/products/ProductsTab.test.tsx` (Plan 04-02 slice test) stubs the key.
- **Fix:** that one test file was added explicitly to the allow-list with a comment; it is a test, so the ESLint boundary already exempts it.
- **Files modified:** `tests/llmSecrets.guard.test.ts`
- **Committed in:** `ed0e4b2`

**3. [Plan inconsistency, resolved conservatively] Timeout-at-150-s case**
- The plan's behavior list says a timeout with the clock at 150 s elapsed means no retry "(less than 20 s left)", but exactly 20 s left is not less than 20 s. The implementation follows the must-have wording (no retry below 20 s left); the tests use 160 s and 155 s for the no-retry cases.

**Total deviations:** 3 (1 bug in tests, 1 blocking allow-list, 1 plan wording note). **Impact:** none on scope.

## Issues Encountered

- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable); out of scope, untouched.
- The production smoke test and bundle scan ran against the real build in this worktree and passed; no real DeepSeek call was made anywhere.

## Verification

- `pnpm exec vitest run`: 76 files passed, 5 skipped; 1903 tests passed, 65 skipped
- `pnpm tsc --noEmit` and `pnpm typecheck`: clean
- `pnpm lint`: 0 errors, 1 pre-existing warning
- `node scripts/check-bundle-secrets.mjs`: `check-bundle-secrets: OK (50 files scanned)`
- `pnpm build && pnpm smoke:auth`: `smoke-auth: OK (17 checks)`

## Known Stubs

None.

## Threat Flags

None. The new surface (retry loop, log line, scan scripts) is covered by T-04-08 to T-04-12.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The grouping route is hardened and proven leak-free in automated checks; Plan 04-06 can run the live DeepSeek check using the `[llm]` log line and `meta` to confirm thinking stayed off.

## Self-Check: PASSED

Created files present (`src/lib/server/deepseek.test.ts`, `src/domain/llm/reconcile.test.ts`, `tests/llmSecrets.guard.test.ts`); commits `f83dd6a`, `93334af`, `ed0e4b2`, `1707de1` are on the branch.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-20*
