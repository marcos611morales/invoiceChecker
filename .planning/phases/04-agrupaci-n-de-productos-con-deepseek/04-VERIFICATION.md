---
phase: 04-agrupaci-n-de-productos-con-deepseek
verified: 2026-10-25T17:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files: [".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-01-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-01-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-02-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-02-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-03-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-03-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-04-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-04-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-05-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-05-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-06-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-06-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-07-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-07-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-08-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-08-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-09-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-09-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-10-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-10-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-11-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-11-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-12-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-12-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-13-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-13-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-14-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-14-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-15-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-15-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-16-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-16-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-17-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-17-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-18-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-18-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-19-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-19-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-20-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-20-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-21-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-21-SUMMARY.md","src/app/api/llm/categorize/route.ts","src/app/api/llm/group/route.ts","src/domain/llm/candidates.ts","src/domain/llm/contract.ts","src/domain/llm/sensitive.ts","src/domain/llm/suggestions.ts","src/domain/settings/resolver.ts","src/features/products/CategorySuggestionsTable.tsx","src/features/products/ReviewQueue.tsx","src/features/products/RunResult.tsx","src/features/products/SendDialog.tsx","src/lib/server/deepseek.ts","src/lib/server/llmRoute.ts","src/lib/server/requireSession.ts","src/stores/llmRunStore.ts","src/stores/suggestionsStore.ts"]
covered_digest: "v3:sha256:df70aba3a4174d454dfe70eb48fdad67989316f0caef999c3b0f9a5e55b48afc"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "Tab list at exactly 640 px overflows by about 17 px (AppShell.tsx line 117 uses max-sm:overflow-x-auto); kept as test.fail in e2e/products.spec.ts"
    category: other
    reason: "Known and recorded in deferred-items.md; UAT item 4 passed with the finding in front of the user. Not a roadmap success criterion"
    evidence_status: "known, accepted at UAT"
  - finding: "Raw-HTML gate of Plan 04-21 fails as literally written on vendored src/components/ui/chart.tsx (dangerouslySetInnerHTML in ChartStyle)"
    category: other
    reason: "Writes CSS variables from the constant trendChartConfig; no XML, supplier or LLM text reaches it. Allow-list decision pending in deferred-items.md"
    evidence_status: "no injection path found"
  - finding: "Open review infos IN-01 (leftOut not reported for category rows / members past their caps), IN-02 (count of a batch whose apply throws half-way), IN-03 (long comment line)"
    category: other
    reason: "Caps are far above expected volume; run state stays consistent; per 04-REVIEW-DISPOSITION.md they are open by choice"
    evidence_status: "none provided"
---

# Phase 4: Agrupación de productos con DeepSeek Verification Report

**Phase Goal:** El usuario pide a DeepSeek que agrupe como "mismo producto" los conceptos con descripciones distintas entre tiendas y que sugiera categorías, revisa cada sugerencia antes de aplicarla, y al LLM solo llegan descripciones y nombres de proveedor por una ruta protegida.
**Verified:** 2026-10-25
**Status:** passed
**Re-verification:** Yes. The previous report (2026-10-22, `human_needed`) went stale because source changed after it (review fixes WR-01..WR-05, IN-01..IN-04, IN-06). It carried no `gaps:`, so all truths were re-checked against the current tree and the changed files were read in full. The five human items of the previous report were run by the user in UAT on 2026-10-25 (04-UAT.md: 8/8 passed, status complete), so nothing is left for a human.

## Goal Achievement

Verified against the code, not the SUMMARYs. Independently run by the verifier on HEAD 003c2fe:

- `tsc --noEmit`: exit 0.
- `eslint .`: exit 0, 0 errors, 1 pre-existing warning (unused disable directive in `src/lib/client/navigation.ts:6`).
- `vitest run`: 100 files passed / 1 skipped, 2947 tests passed / 10 skipped.
- `node scripts/check-bundle-secrets.mjs`: OK (50 files scanned, DeepSeek sentinel included).
- `node scripts/smoke-auth.mjs`: OK (20 checks).
- Targeted rerun of llmRunStore, llmRoute, resolver and the two route test files: 180 passed.
- Playwright was not re-run by the verifier (04-21 SUMMARY: 14 passed, 1 skipped).

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Before sending, the user sees exactly what goes to DeepSeek (descriptions and supplier names, never RFC/UUID/amounts); on confirm gets "same product" groups and category suggestions per supplier and per product | VERIFIED | `SendDialog.tsx` renders from `batch.body.items`, `batch.body.existing`, `batch.body.suppliers/products/categories`, the same objects the client serializes. `contract.ts` request schemas are `z.strictObject` at every level (items: id, description, supplier only) and, new since the last report, every free-text field goes through `safeText`, which refuses RFC, UUID, e-mail and 8+ digit runs (`sensitive.ts`) on the server (400 before DeepSeek). `candidates.ts` keeps sensitive texts out of bodies in the browser. Group route and categorize route both call their DeepSeek function; user live-checked grouping (04-06) and category suggestions (UAT 1, pass) with the real key |
| 2 | Suggestions go to a review queue (accept, rename, split, merge, reject); nothing changes in the dashboard until accepted; accepted work survives reload | VERIFIED | `ReviewQueue.tsx` calls `renameSuggestion`, `splitSuggestion`, `mergeSuggestions`, `rejectSuggestion`, `rejectMany`, `settings.acceptMany`. Queue lives in `suggestionsStore` (own persisted key); dashboard reads only through `useCategorySettings`, which selects from `settingsStore` only (no `suggestionsStore` import there; importers are RunWatcher, ReviewQueue, CategorySuggestionsTable, ProductsTab, AppShell for the counter and rehydrate, llmRunStore). Accepting writes to the persisted settings store |
| 3 | Per-batch progress and cancel; a failed batch keeps what was processed and the run can be resumed | VERIFIED | `llmRunStore.startRun` read in full: per-batch `running` status (batch/total/received/failed), `cancel()` aborts the controller, `aborted \|\| cleared()` is checked before `apply`, each batch is applied as it lands, non-fatal failures end `partial`, fatal ones `stopped`. Post-review: `apply` is inside try/catch (WR-02), logs in dev (IN-06), `groupBatches.apply` drops members taken by settings meanwhile (WR-05) and builds run state in a `finally` from what really landed. Tests at `llmRunStore.test.ts` lines 220 (cancel applies nothing, never sends the next batch, keeps earlier ones), 265/279 (invoices cleared) pass. UAT 2 (live cancel and reload) passed. `ProductsTab` retry uses `freeItems` |
| 4 | Accepting a grouped product with a category gives its concepts that category except hand-adjusted ones; ungrouped concepts use the supplier category or «Sin categoría» | VERIFIED | `resolver.ts` `makeResolver`/`explain`: concept rule (explicit null wins) > accepted product category (only if it still exists) > supplier > «Sin categoría». Used by `useCategorySettings`. `resolver.test.ts` passes; UAT 1 confirmed accepted category rows change «Gasto por categoría» |
| 5 | Any call to the LLM routes without a valid session gets 401; the DeepSeek key appears in no client bundle file and no browser response | VERIFIED | `llmRoute.ts` `readJsonBody` calls `requireSession` first, then exact media type (WR-03), declared size, text size, JSON parse; both routes call it as their first statement. `src/lib/server/llmRoute.ts` and `deepseek.ts` import `server-only`; ESLint forbids `@/lib/server/*` and `server-only` in browser layers (`eslint.config.mjs` line 47). `DEEPSEEK_API_KEY` is read only in `deepseek.ts` lines 85-98; no `NEXT_PUBLIC_` occurrence in `src`, `scripts` or `.env.example`; `connect-src 'self'` in `next.config.ts`. Errors use only our own codes through `statusOf`. Verifier ran `check-bundle-secrets` (OK) and `smoke:auth` (20 checks incl. both LLM routes 401 without session). Route tests assert 401 for no cookie, tampered cookie and a foreign-secret token without calling DeepSeek, and that a DeepSeek 401 never echoes the key |

**Score:** 5/5 truths verified (0 present, behavior-unverified). The behavior-dependent truths (cancel, late-answer drop, partial resume) are backed by named passing tests, not presence alone.

### Review fixes since the last report (re-checked in code)

| Finding | Status in code |
|---------|----------------|
| WR-01 full supplier name kept on accept | `CategorySuggestionsTable.tsx` line 133 uses `row.fullName ?? row.name`; `categorizeBatches` sets `fullName: target.name`. Only pre-fix queued rows with names over 60 chars keep the cut name (IN-05, accepted by user) |
| WR-02 guarded `apply` | try/catch in `startRun` |
| WR-03 exact media type | `readJsonBody` compares `split(";")[0]` to `application/json` |
| WR-04 sensitive text | server `safeText` in `contract.ts`; browser `candidates.ts` guard; `composeRequest` drops sensitive context names; `startCategorizeRun` refuses a body with a sensitive category name; `SendDialog` disables the send button (UAT 8 passed) |
| WR-05 late answers vs settings | `takenBySettings()` filter in `apply` |
| IN-01 shared pipeline | `llmRoute.ts`, order identical on both routes |
| IN-02/03/04/06 | implemented as described in 04-REVIEW-FIX.md; UAT 6 and 7 passed |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/llm/group/route.ts`, `categorize/route.ts` | POST handlers, session first, strict zod, own error codes | VERIFIED | Substantive, wired to `readJsonBody` and `groupWithDeepSeek`/`categorizeWithDeepSeek`, `maxDuration = 120` |
| `src/lib/server/llmRoute.ts` | Shared route pipeline | VERIFIED | 79 lines, `server-only`, used by both routes, unit-tested |
| `src/lib/server/deepseek.ts` | Server-only client | VERIFIED | `server-only`, JSON mode, `thinking: disabled`, `temperature: 0`, key read only here |
| `src/lib/server/requireSession.ts` | Handler-level 401 | VERIFIED | Called by `readJsonBody` |
| `src/domain/llm/contract.ts`, `sensitive.ts` | Strict schemas plus content guard | VERIFIED | Used by routes, client and `candidates.ts` |
| `src/domain/llm/candidates.ts`, `suggestions.ts` | Batching, guard, queue reducers | VERIFIED | Used by `ProductsTab`, stores |
| `src/stores/llmRunStore.ts`, `suggestionsStore.ts` | Runner and persisted queue | VERIFIED | Used by RunWatcher, RunProgress, ProductsTab, ReviewQueue |
| `src/features/products/*` | Dialogs, queue, run UI | VERIFIED | Rendered by `ProductsTab` in `AppShell` |
| `src/domain/settings/resolver.ts` | CAT-04 precedence | VERIFIED | Consumed by `useCategorySettings` |
| `scripts/check-bundle-secrets.mjs`, `scripts/smoke-auth.mjs` | Secret and 401 gates | VERIFIED | Both executed by verifier |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Send dialog | request body | renders `batch.body.*` | WIRED | Same objects serialized by the client |
| Both routes | session check | `readJsonBody` -> `requireSession` | WIRED | First statement of each handler |
| Run store `apply` | suggestions store | `appendMembers`, `enqueueProducts`, `enqueueCategories` | WIRED | Per batch, persisted |
| Review queue / category table accept | settings store | `acceptMany`, `setSupplierCategory`, `setProductCategory` | WIRED | Persisted settings |
| Settings store | dashboard | `makeResolver` via `useCategorySettings` | WIRED | Queue never read by the dashboard |
| Browser | DeepSeek | only through `/api/llm/*` | WIRED | `connect-src 'self'`, key server-only |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ReviewQueue cards | `products` | `resolveProductAnswer` of the route response | Yes (live: 04-06 and UAT 3) | FLOWING |
| CategorySuggestionsTable rows | `categories` | `categorizeBatches` -> `postCategorize` | Yes (live: UAT 1) | FLOWING |
| «Gasto por categoría» | resolver output | settings store | Yes (e2e and UAT 1) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Types | `tsc --noEmit` | exit 0 | PASS |
| Lint | `eslint .` | 0 errors, 1 pre-existing warning | PASS |
| Unit/integration | `vitest run` | 2947 passed, 10 skipped | PASS |
| Runner, route pipeline, resolver, routes | `vitest run` on 5 files | 180 passed | PASS |
| No secret in client output | `check-bundle-secrets.mjs` | OK (50 files) | PASS |
| 401 and key handling on a production server | `smoke-auth.mjs` | OK (20 checks) | PASS |
| Playwright e2e | not re-run by verifier | 04-21 SUMMARY: 14 passed, 1 skipped | SKIP |

### Probe Execution

No probe scripts declared or found (`scripts/*/tests/probe-*.sh`). Step 7c skipped.

### Requirements Coverage

All nine IDs appear in PLAN frontmatter (04-21 lists all nine) and REQUIREMENTS.md maps exactly these nine to Phase 4: no orphans, none unaccounted.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| ACC-03 | 04-02, 04-04, 04-18, 04-21 | LLM routes 401 without valid session, checked in each handler | SATISFIED | `readJsonBody` -> `requireSession` first in both handlers; route tests; `smoke:auth` |
| ACC-04 | 04-01, 04-02, 04-04, 04-06, 04-21 | Key never reaches browser/bundle | SATISFIED | `server-only`, ESLint boundary, bundle scan OK, no `NEXT_PUBLIC_` |
| LLM-01 | 04-01, 04-02, 04-06, 04-14, 04-15, 04-21 | Ask DeepSeek to group same-product concepts | SATISFIED | Group route and UI; live-checked; UAT 3 (JAMON ZWAN pair) passed |
| LLM-02 | 04-18, 04-19, 04-20, 04-21 | Category suggestion per supplier and per product | SATISFIED | Categorize route and table; UAT 1 live pass |
| LLM-03 | 04-01, 04-02, 04-18, 04-20, 04-21 | Only descriptions and supplier names sent; schema validated | SATISFIED | Strict schemas plus server-side `safeText` content refusal (closes previous WR-04 caveat) and browser guard |
| LLM-04 | 04-03, 04-05, 04-07, 04-10, 04-11, 04-13, 04-14, 04-16, 04-17, 04-19, 04-21 | Review queue; nothing applied without review | SATISFIED | ReviewQueue and reducers; dashboard isolated from the queue |
| LLM-05 | 04-04, 04-06, 04-11, 04-12, 04-21 | Progress, cancel, partial failure keeps processed | SATISFIED | `llmRunStore` with tests; UAT 2 live |
| LLM-06 | 04-01, 04-12, 04-14, 04-15, 04-18, 04-20, 04-21 | User told what will be sent before sending | SATISFIED | Dialogs from the serialized bodies; UAT 5 copy review passed |
| CAT-04 | 04-08, 04-09, 04-21 | Rule > product > supplier > Sin categoría | SATISFIED | `resolver.ts` and `resolver.test.ts` |

Bookkeeping, not a code gap: `.planning/REQUIREMENTS.md` still shows all nine as `[ ]` / "Pending" and the ROADMAP progress row for Phase 4 may still read "In Progress". The orchestrator should update both when closing the phase.

### Anti-Patterns Found

No `TBD`, `FIXME`, `XXX`, `TODO` or `HACK` in the non-test phase source files scanned (route files, `src/domain/llm/*`, `resolver.ts`, `src/features/products/*.tsx`, `src/lib/server/*.ts`, both stores). No `any`, `@ts-ignore` or non-null `!` found by the code review (04-REVIEW.md: 0 critical, 0 warning, 3 info).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/shell/AppShell.tsx` | 117 | `max-sm:overflow-x-auto` only below 640 px | Info (advisory) | At exactly 640 px the tab list overflows by about 17 px; known, in deferred-items.md, shown to the user at UAT 4 which passed |
| `src/components/ui/chart.tsx` | 94 | `dangerouslySetInnerHTML` in vendored shadcn `ChartStyle` | Info (advisory) | Constant CSS-variable config only; no untrusted text reaches it |
| `src/stores/llmRunStore.ts` / `suggestions.ts` | 311 / 336, 679-688 | Review IN-01/IN-02 | Info | Caps (7000 rows, 20000 members) far above expected volume |

### Human Verification Required

None. The five items of the previous report plus three additional checks for the review fixes were all run by the user (04-UAT.md: 8 passed, 0 issues). 04-SECURITY.md: threats_open 0 (verified). 04-UI-REVIEW.md: 18/24, no blockers.

### Gaps Summary

No must-have truth failed and no blocker was found. All five roadmap success criteria are backed by code that exists, is wired, is exercised by tests the verifier re-ran (2947 passing), and has been confirmed live by the user with the real DeepSeek key. The review fixes that touched must-have code (server-side sensitive-text rejection, shared route pipeline, guarded run pipeline, late-answer filtering) were read in full and match their claims. Remaining items are advisory and listed in the frontmatter; none is a roadmap-truth failure.

---

_Verified: 2026-10-25T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
