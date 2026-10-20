---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 02
subsystem: llm
tags: [deepseek, next-route-handler, server-only, session, zod, zustand, vitest]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "Plan 04-01 tracer: POST /api/llm/group with the DeepSeek section inside route.ts, run store, SuggestionCards inside ProductsTab"
provides:
  - "requireSession: in-handler session check that returns the proxy's exact 401 (ACC-03)"
  - "src/lib/server/deepseek.ts: the only module that reads DEEPSEEK_API_KEY and calls DeepSeek, behind import server-only (ACC-04)"
  - "src/domain/llm/reconcile.ts: coverageOf, isComplete, normalizeProductName (D-11, D-12)"
  - "Browser coverage re-check in llmRunStore before anything is enqueued (OQ3)"
  - "ReviewQueue component with the former SuggestionCards markup"
  - "Route branch tests with a stubbed upstream and builder/schema/queue privacy tests"
  - ".env.example and README entries for DEEPSEEK_API_KEY and DEEPSEEK_MODEL, README privacy statement per OQ1, five-tab smoke test"
affects: [04-03, 04-04, 04-05, 04-11, 04-12, 04-13, 04-14, 04-15]

actuals:
  tokens: 18800
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Handler-level session check as the first statement of every LLM route (defense in depth behind the proxy)"
    - "Server-only module owns the secret and the upstream call; the route has no environment access"
    - "The model's answer is accepted only when every sent id comes back exactly once, checked on the server and again in the browser"
    - "jsdom tests that go through a route handler replace only verifySessionToken (jose rejects cross-realm keys under jsdom); route.test.ts runs the real check in node"

key-files:
  created:
    - src/lib/server/requireSession.ts
    - src/lib/server/deepseek.ts
    - src/domain/llm/reconcile.ts
    - src/features/products/ReviewQueue.tsx
    - src/app/api/llm/group/route.test.ts
    - src/domain/llm/candidates.test.ts
  modified:
    - src/app/api/llm/group/route.ts
    - src/stores/llmRunStore.ts
    - src/features/products/ProductsTab.tsx
    - src/features/products/ProductsTab.test.tsx
    - .env.example
    - README.md
    - e2e/smoke.spec.ts

key-decisions:
  - "normalizeProductName turns each control character into a space and then collapses whitespace (kept from the 04-01 cleanName), so «Leche\\nentera» stays two words instead of fusing"
  - "Coverage is computed on the model's raw groups before names are built, so an incomplete answer never reaches name normalization"
  - "ProductsTab.test.tsx mocks only verifySessionToken (true exactly for one sentinel cookie); the real JWT check is proven in route.test.ts"

patterns-established:
  - "Pattern: tests that need an incomplete 200 in the browser use fetchMock.mockImplementationOnce to bypass the route and prove the second line of defense on its own"

requirements-completed: [ACC-03, ACC-04, LLM-01, LLM-03]

coverage:
  - id: D1
    description: "POST /api/llm/group checks the session first: no cookie, a tampered cookie or a token of another secret give the proxy's exact 401 and DeepSeek is never called"
    requirement: "ACC-03"
    verification:
      - kind: unit
        ref: "src/app/api/llm/group/route.test.ts#POST /api/llm/group: the session is checked inside the handler (ACC-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The route answers 400 bad_request, 413 payload_too_large and 500 server_not_configured as specified and calls DeepSeek in none of those cases"
    requirement: "LLM-03"
    verification:
      - kind: unit
        ref: "src/app/api/llm/group/route.test.ts#POST /api/llm/group: the request checks (LLM-03, D-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The key and the upstream call live only in the server-only module; the upstream request has the documented shape; an upstream 401 becomes 502 upstream_auth with retryable false; no response carries the key"
    requirement: "ACC-04"
    verification:
      - kind: unit
        ref: "src/app/api/llm/group/route.test.ts#POST /api/llm/group: the DeepSeek call (ACC-04, D-29)"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#stops the run with upstream_auth on a DeepSeek 401, adds no card and never shows the key"
        status: pass
    human_judgment: false
  - id: D4
    description: "An answer that leaves out, repeats or invents an id enqueues nothing: 502 incomplete_response from the server, and the browser re-checks coverage before enqueueing; the descriptions stay free"
    requirement: "LLM-01"
    verification:
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#coverageOf and isComplete (D-11)"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: an answer that does not cover what was sent (D-11, OQ3)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Proposed names lose control characters and runs of spaces, are trimmed and cut to 60; an empty name takes the first description of its group"
    requirement: "LLM-01"
    verification:
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#normalizeProductName (D-12, Pitfall 7)"
        status: pass
      - kind: unit
        ref: "src/app/api/llm/group/route.test.ts#names a group whose name is empty after cleaning with the first description of the group"
        status: pass
    human_judgment: false
  - id: D6
    description: "Builder privacy and split rules: duplicate lines collapse per supplier, the same text at two suppliers stays two items, tipo P/E and excluded invoices are included, 250/251 items give 1/2 batches, and no serialized body contains an RFC, UUID, folio, date or amount"
    requirement: "LLM-03"
    verification:
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#collectItems (D-03, D-09, OQ2)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#buildGroupRun (D-28, LLM-03)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#groupRequestSchema (LLM-03)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The cards render from their own ReviewQueue component with the same markup, and an expired session during a run shows «Tu sesión terminó...» with «Iniciar sesión» to /login"
    requirement: "ACC-03"
    verification:
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: the session during a run (ACC-03)"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: the queue (D-19)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The tab list reads Dashboard, Categorías, Productos, Calidad de datos, Importación in the shell unit test and in the production smoke test"
    requirement: "LLM-01"
    verification:
      - kind: unit
        ref: "src/features/shell/AppShell.test.tsx#lists Dashboard, Categorías, Productos, Calidad de datos and Importación in that order"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test e2e/smoke.spec.ts"
        status: pass
    human_judgment: false
  - id: D9
    description: "README and .env.example tell whoever deploys which variables to set, and README does not promise more privacy than the app gives (no country, no retention claim)"
    requirement: "ACC-04"
    verification: []
    human_judgment: true
    rationale: "Wording of the privacy statement (UI-SPEC OQ1 prohibition on claiming where DeepSeek stores or processes the data) is a judgment call; greps only prove the variable names and the word DeepSeek are present"

duration: 9min
completed: 2026-10-20
status: complete
plan_head_before: 58ffdf7db81ebdd732c722107afa49d98c718262
plan_head_after: a6e56f3bc413207dff0bffda12448e158dd1ed87
commits: 4
---

# Phase 4 Plan 02: Protected grouping route Summary

**The grouping route now checks the session inside the handler, keeps the DeepSeek key and call in a server-only module, refuses any model answer that does not cover each sent id exactly once (server and browser), and ships with its branch tests, DeepSeek deployment docs and a five-tab smoke test.**

## Performance

- **Duration:** about 9 min (start captured at 2026-10-20T00:56:08Z, after reading the plan and sources; end 2026-10-20T01:04:25Z)
- **Tasks:** 3 (Task 1 TDD: RED then GREEN; Tasks 2 and 3 auto)
- **Files:** 13 (6 created, 7 modified)

## Accomplishments

- ACC-03: `requireSession(request)` is the first statement of `POST`; no cookie, a tampered cookie and a token signed with another secret all give the proxy's exact `{"error":"unauthorized"}` 401 before any parsing and without a DeepSeek call.
- ACC-04: `src/lib/server/deepseek.ts` (first line `import "server-only"`) is the only reader of `DEEPSEEK_API_KEY` and the only caller of DeepSeek; `route.ts` has no environment access. Every error becomes one of our own codes and statuses, and no response body carried the stubbed key in any test.
- D-11/OQ3: `coverageOf` + `isComplete` refuse omitted, repeated or invented ids with `502 incomplete_response` (retryable) on the server, and `llmRunStore` re-checks the same invariant before enqueueing, so a bad answer adds no card and its descriptions stay free.
- D-12: `normalizeProductName` (control characters, whitespace, trim, 60 characters with «…»); an empty result takes the first description of the group.
- Tests: 36 route tests (every branch with a stubbed upstream), 32 builder/schema/queue/reconcile tests, 5 new slice tests (incomplete answers, browser re-check, no session).
- Docs: `.env.example`, README privacy sentence (OQ1 wording, no country or retention), deployment step 4 with both variables for Production and Preview, and the smoke test expecting the five tabs.
- Verification: `pnpm verify` (lint 0 errors, typecheck, 1801 tests passed, build) exits 0, and `pnpm exec playwright test e2e/smoke.spec.ts` passed 3 with 1 expected skip.

## Task Commits

1. **Task 1 RED:** failing tests for the in-handler session check, coverage invariant and name normalization - `567a6c8` (test)
2. **Task 1 GREEN:** session check in the handler, server-only DeepSeek module, coverage invariant - `ae5bf7e` (feat)
3. **Task 2:** browser coverage re-check, `ReviewQueue`, slice test through the session check - `c6b687e` (feat)
4. **Task 3:** DeepSeek variables, privacy statement and five-tab smoke test - `a6e56f3` (docs)

**Plan metadata:** committed separately with this SUMMARY (docs).

## TDD Gate Compliance

Task 1 (`tdd="true"`):

- **RED (`567a6c8`):** 15 of 68 tests failed, all on the planned assertions: 4 session tests (route answered 400/200 instead of 401 because the handler had no session check), 3 incomplete-answer tests (route answered 200 with partial groups), 5 `coverageOf`/`isComplete` cases and 3 `normalizeProductName` cases against a skeleton `reconcile.ts` that returns inert values. The skeleton was committed in the RED commit only so the imports resolve; no failure was a syntax, import or fixture error. One RED run had an invalid failure caused by my own wrong expected order in a new test (`collectItems` supplier order); I fixed the test before committing, so it is not in the RED evidence. The other 53 tests (characterization of behavior moved from 04-01) passed from the start, as expected.
- **GREEN (`ae5bf7e`):** all 68 tests pass; typecheck and lint clean.
- **REFACTOR:** none needed.
- `gsd_run check tdd-red-evidence` was not used: `workflow.tdd_mode` is not enabled in this project.

## Files Created/Modified

- `src/lib/server/requireSession.ts` - returns null for a valid session, else the proxy's exact 401
- `src/lib/server/deepseek.ts` - `DEEPSEEK_URL`, `DEFAULT_MODEL`, `DeepseekEnv`, `readDeepseekEnv`, `DeepseekResult`, `groupWithDeepSeek` (moved from route.ts, now with coverage and name normalization)
- `src/domain/llm/reconcile.ts` - `Coverage`, `coverageOf`, `isComplete`, `normalizeProductName`
- `src/app/api/llm/group/route.ts` - session check first, no environment access, imports the server-only module
- `src/stores/llmRunStore.ts` - stops with `incomplete_response` when the sent ids are not covered
- `src/features/products/ReviewQueue.tsx` / `ProductsTab.tsx` - cards moved out unchanged
- `src/app/api/llm/group/route.test.ts`, `src/domain/llm/candidates.test.ts`, `src/features/products/ProductsTab.test.tsx` - tests
- `.env.example`, `README.md`, `e2e/smoke.spec.ts` - docs and smoke test

## Decisions Made

- `normalizeProductName` keeps the 04-01 behavior of replacing each control character with a space before collapsing whitespace, so a newline between two words does not fuse them; the plan's wording («removes control characters») is satisfied for every observable case.
- Coverage is computed on the model's raw groups, before names are built, so an incomplete answer is rejected before any normalization work.
- The jsdom slice test mocks only `verifySessionToken` (true for one sentinel cookie, false otherwise); the real HS256 check is covered in `route.test.ts` under node.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan 04-01 slice-test fixtures contradicted the new coverage invariant**
- **Found during:** Task 2
- **Issue:** `milkAnswer` grouped only two of five descriptions and one test fed an answer that invents and repeats ids. With D-11 enforced on the server these answers now give `502 incomplete_response`, so nine tests of 04-01 failed, and the plan's instruction to «keep every Plan 04-01 assertion» could not hold for them.
- **Fix:** `milkAnswer` now covers every sent id (the milk group plus a one-description group for each other description); assertions that depended on the old partial answer were adapted (queue length 1 became 4, queue heading «· 4», the second-press test seeds the pending milk card in the store and answers its three remaining ids, and the caption lookups are scoped to the milk card). The test «enqueues only the known first-seen members when the answer invents an id or repeats one» was replaced by three tests that assert the new, required behavior (the run stops with the incomplete message, no card, descriptions stay free). A new test asserts nothing is left free after a complete answer.
- **Files modified:** `src/features/products/ProductsTab.test.tsx`
- **Verification:** `pnpm exec vitest run src/features/products` (28 passed), `pnpm verify`
- **Committed in:** `c6b687e`

**2. [Rule 3 - Blocking] jose rejects its own keys under jsdom**
- **Found during:** Task 2
- **Issue:** `createSessionToken` in `ProductsTab.test.tsx` (jsdom) fails with «Key for the HS256 algorithm must be one of type CryptoKey, KeyObject, JSON Web Key, or Uint8Array» (cross-realm `Uint8Array`), the case the plan anticipated.
- **Fix:** the plan's fallback: `vi.mock("@/lib/server/session")` replaces only `verifySessionToken` (true exactly for the sentinel cookie; everything else from the module is the real one). The test's fetch stub adds that cookie, and one test sends no cookie to prove the handler turns it into the stopped Alert with the session message and the «Iniciar sesión» link. `route.test.ts` proves the real session check.
- **Files modified:** `src/features/products/ProductsTab.test.tsx`
- **Committed in:** `c6b687e`

---

**Total deviations:** 2 auto-fixed (1 bug/test consistency, 1 blocking)
**Impact on plan:** Both follow directly from the plan's own requirements (the invariant it asks for; the fallback it names). No scope creep. `src/features/shell/AppShell.test.tsx` needed no change: Plan 04-01 already contains both the five-tab order case and the «opens the Productos panel when its tab is clicked» case that this plan asked to add, so I did not duplicate them.

## Issues Encountered

- The Plan 04-01 summary's note that "any first failure stops the run" still holds: an `incomplete_response` is retryable per the contract, but no «Reintentar» button exists until Plans 04-04 and 04-12; pressing «Agrupar productos» again is the equivalent action.
- A pre-existing lint warning in `src/lib/client/navigation.ts` was left alone (already in `deferred-items.md`).
- `scripts/check-bundle-secrets.mjs` still does not look for `DEEPSEEK_API_KEY` in the client bundle (RESEARCH lines 600+ propose it). It is not in this plan's files; `import "server-only"` makes the build fail if a client module imports the module that reads the key. Worth adding in a later plan if the ACC-04 bundle proof is wanted.
- Questions I could not ask (CLAUDE.md §1) and did not need to decide: none changes this plan's acceptance. The control-character handling (replace by space vs delete) above is the only wording choice, and it keeps the 04-01 behavior.

## User Setup Required

`DEEPSEEK_API_KEY` (required) and `DEEPSEEK_MODEL` (optional, default `deepseek-flash`) must exist as server environment variables in `.env.local` and in Vercel (Production and Preview) before the live DeepSeek check. They are now listed in `.env.example` and README. No automated test needs a real key.

## Known Stubs

None added by this plan. The stubs recorded in 04-01 (`existing` context always empty, in-memory suggestions queue, no accept/reject actions) are unchanged and belong to later plans.

## Threat Flags

None. The surfaces touched (`/api/llm/group`, the outbound call to `api.deepseek.com`, the README privacy statement) are the ones in the plan's threat register: T-04-44 and T-04-45 are mitigated and tested, T-04-46 is mitigated on both sides with tests, T-04-47 by the README wording (judgment).

## Next Phase Readiness

- Plans 04-03 onward can rely on `requireSession` for any new LLM route, on `deepseek.ts` as the only upstream caller, on `coverageOf`/`isComplete`/`normalizeProductName` in `src/domain/llm/reconcile.ts` (Plan 04-04 creates `reconcile.test.ts`), and on `ReviewQueue({ cards, lines })` as the card container.
- The live behavior with a real key is still unchecked (Plan 04-06 per the 04-01 summary).

## Self-Check: PASSED

- Created files exist on disk: requireSession.ts, deepseek.ts, reconcile.ts, ReviewQueue.tsx, route.test.ts, candidates.test.ts (6 of 6 found).
- Commits `567a6c8`, `ae5bf7e`, `c6b687e`, `a6e56f3` exist in this branch's history.
- All acceptance greps of the three tasks pass; `pnpm verify` exits 0 and `pnpm exec playwright test e2e/smoke.spec.ts` passes.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-20*
