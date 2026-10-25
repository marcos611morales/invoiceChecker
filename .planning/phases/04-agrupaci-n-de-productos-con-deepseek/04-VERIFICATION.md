---
phase: 04-agrupaci-n-de-productos-con-deepseek
verified: 2026-10-22T14:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files: [".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-01-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-01-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-02-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-02-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-03-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-03-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-04-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-04-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-05-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-05-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-06-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-06-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-07-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-07-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-08-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-08-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-09-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-09-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-10-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-10-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-11-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-11-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-12-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-12-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-13-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-13-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-14-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-14-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-15-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-15-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-16-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-16-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-17-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-17-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-18-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-18-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-19-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-19-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-20-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-20-SUMMARY.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-21-PLAN.md",".planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-21-SUMMARY.md","src/app/api/llm/categorize/route.ts","src/app/api/llm/group/route.ts","src/domain/llm/candidates.ts","src/domain/llm/contract.ts","src/domain/settings/resolver.ts","src/features/products/ReviewQueue.tsx","src/features/products/SendDialog.tsx","src/lib/server/deepseek.ts","src/lib/server/requireSession.ts","src/stores/llmRunStore.ts","src/stores/suggestionsStore.ts"]
covered_digest: "v3:sha256:ede7a6163bd75dce4f6b4b6a4f8ef4916881ca0881b81ca24c4e0370954354ef"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "«Sugerir categorías» with the real key: accept a few products, press «Sugerir categorías», read the dialog, then accept two rows and look at «Gasto por categoría»"
    expected: "Dialog lists only supplier names, product names with member descriptions and the user's category names; every supplier/product returns an existing category or a «Nueva: ...» one; at least 80% plausible; accepted rows change «Gasto por categoría»"
    why_human: "Category quality needs the real DeepSeek key and a person's judgment. The live check of 04-06 covered only «Agrupar productos»; the categorize route was only exercised with mocks (e2e) and unit stubs"
  - test: "Live cancel: press «Agrupar productos» after loading a new invoice, then «Detener lotes» while a batch runs; reload"
    expected: "No card of the canceled batch appears later; cards that had arrived before are still there after reload"
    why_human: "Unit tests (llmRunStore) and one mocked e2e prove the guards; real network timing against DeepSeek was never exercised by hand"
  - test: "D-32 pair: re-run grouping on the real sample and look for «JAMON ZWAN» (Walmart) and «JAMON ZWAN VIRGINIA» (Productos de Consumo Z), plus the manchego and deslactosada pairs"
    expected: "They land in one card or in an «Agregar a» card now that cross-batch carry (Plan 04-15) exists"
    why_human: "04-06-CHECKPOINT-RESULT records them split in two samples before cross-batch carry existed; no live re-check was done after 04-15. This is a model-quality outcome (needs the real key), not a code defect"
  - test: "Tabs between 640 and 767 px, light and dark themes: run card, queue cards, bulk bar, focus rings; open test-results/phase4-ui-states/ screenshots"
    expected: "Five tabs with counters do not wrap and scroll inside the list if needed; truncation/tooltips look right"
    why_human: "Visual judgment. Known: at exactly 640 px the tab list overflows by about 17 px (AppShell.tsx max-sm:overflow-x-auto), kept as test.fail"
  - test: "Read README and in-app footer privacy text"
    expected: "States that only descriptions and supplier names go to DeepSeek, only when asked, never RFC, UUID or amounts; names no country or retention period"
    why_human: "Copy review; the footer string was seen by the executor, the README paragraph was only grepped by the verifier (README line 3 matches), not judged"
---

# Phase 4: Agrupación de productos con DeepSeek Verification Report

**Phase Goal:** El usuario pide a DeepSeek que agrupe como "mismo producto" los conceptos con descripciones distintas entre tiendas y que sugiera categorías, revisa cada sugerencia antes de aplicarla, y al LLM solo llegan descripciones y nombres de proveedor por una ruta protegida.
**Verified:** 2026-10-22
**Status:** human_needed
**Re-verification:** No, initial verification

## Goal Achievement

Verified against the code, not the SUMMARYs. Independently re-run by the verifier on current main (HEAD 7132bee): `pnpm tsc --noEmit` exit 0; `pnpm eslint .` exit 0 (0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts`); `pnpm vitest run` 98 files passed / 1 skipped, 2881 tests passed / 10 skipped; `node scripts/check-bundle-secrets.mjs` OK (50 files scanned, includes DeepSeek sentinel); `pnpm smoke:auth` OK (20 checks). Playwright was not re-run by the verifier (relies on the 04-21 SUMMARY: 14 passed, 1 skipped).

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Before sending, the user sees exactly what goes to DeepSeek (descriptions and supplier names, never RFC/UUID/amounts); on confirm gets "same product" groups and category suggestions per supplier and per product | VERIFIED | `SendDialog.tsx` renders from `batch.body.items` / `batch.body.existing` / `body.categories`, the very objects the client serializes (not a parallel list); «No enviar» holds initial focus. Request schemas in `contract.ts` are `z.strictObject` at every level (items: id, description, supplier only). `candidates.ts` `isSensitive`/`looksSensitive` keep RFC/UUID/e-mail/8+ digit strings out of every body and list them as withheld. `groupWithDeepSeek` and the categorize route exist; group live-checked by the user on real data (04-06-CHECKPOINT-RESULT: 227 descriptions, 2 batches, 196 cards, ~82% multi-member quality, send dialog showed no RFC/UUID/amounts). Categorize route covered by route/unit tests and mocked e2e only (see human item 1) |
| 2 | Suggestions go to a review queue (accept, rename, split, merge, reject); nothing changes in the dashboard until accepted; accepted work survives reload | VERIFIED | `ReviewQueue.tsx` wires `renameSuggestion`, `splitSuggestion`, `mergeSuggestions`, `turnIntoAddCard`, `dropMember`, `rejectSuggestion/rejectMany`, `acceptMany`. The queue lives in `suggestionsStore` (key `invoicechecker:suggestions`); the dashboard resolver (`useCategorySettings` -> `makeResolver(settings)`) reads only the settings store, and no dashboard code imports `suggestionsStore` (grep: only products/shell/run store do). Accept writes to `settingsStore` (persisted `invoicechecker:settings`, v3). Live: accepted «Topochico mineral» and «Sprite 600 ml», caption 227 -> 221 after reload |
| 3 | Per-batch progress and cancel; a failed batch keeps what was processed and the run can be resumed | VERIFIED | `llmRunStore.startRun`: per-batch status (`batch`/`total`/`received`), `cancel()` aborts the controller, late answers dropped after abort or session clear (`signal.aborted \|\| cleared()` before `apply`), `apply` enqueues each batch as it lands and the persisted queue stores it; non-fatal failures become `partial` with `failed` count, fatal ones `stopped`; `RunResult` «Reintentar» re-runs only still-free items (`freeItems` excludes queued/accepted/«No agrupar» keys, `ProductsTab.tsx` line 70-75). Unit tests in `llmRunStore.test.ts` and mocked e2e cancel test pass. Caveat: WR-02 (unguarded `outcome.apply()`), see Anti-Patterns |
| 4 | Accepting a grouped product with a category gives its concepts that category except hand-adjusted ones; ungrouped concepts use the supplier category or «Sin categoría» | VERIFIED | `resolver.ts` `makeResolver`/`explain`: precedence 1 concept rule (including explicit null = «Sin categoría») > 2 accepted product category (only if the category still exists) > 3 supplier category > 4 «Sin categoría». Used by `useCategorySettings`. `resolver.test.ts` passes in the 2881-test run; mocked e2e shows accepting a category row changes «Gasto por categoría» |
| 5 | Any call to the LLM routes without a valid session gets 401; the DeepSeek key appears in no client bundle file and no browser response | VERIFIED | `requireSession(request)` is the first statement of both `group/route.ts` and `categorize/route.ts` (before content-type, body or env reads); `src/proxy.ts` matcher is fail-closed and also 401s `/api/*`. `DEEPSEEK_API_KEY` is read only in `src/lib/server/deepseek.ts` (`import "server-only"`), ESLint restricts browser layers from importing `@/lib/server/*`; no `NEXT_PUBLIC_` anywhere in `src`/`.env.example`. Verifier ran `check-bundle-secrets.mjs` (sentinel scan of `.next/static` and prerendered output: OK) and `smoke:auth` (20 checks, both LLM routes: 401 without session, 400 malformed, 500 `server_not_configured` with empty key). Errors return only our own codes (`statusOf`), never an upstream body or status. `connect-src 'self'` confirmed in `next.config.ts` |

**Score:** 5/5 truths verified (0 present, behavior-unverified). Live-model-quality items are listed under human verification rather than counted against truths.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/llm/group/route.ts`, `categorize/route.ts` | POST handlers, session first, strict zod, own error codes | VERIFIED | Substantive (86/88 lines), call `groupWithDeepSeek`/categorize equivalent, `maxDuration = 120` |
| `src/lib/server/deepseek.ts` | Server-only DeepSeek client with retry, timeout, taxonomy | VERIFIED | 534 lines, `server-only`, JSON mode, `thinking: disabled`, `temperature: 0`, one `console.info` with codes/counts only |
| `src/lib/server/requireSession.ts` | Handler-level 401 | VERIFIED | Wired in both routes |
| `src/domain/llm/contract.ts` | Strict request/response schemas, limits, error codes | VERIFIED | Wired by routes, client, candidates |
| `src/domain/llm/candidates.ts` | Free items, batching, sensitive guard, categorize targets | VERIFIED | Wired by `ProductsTab` |
| `src/domain/llm/suggestions.ts` | Queue reducers (accept/merge/split/...) | VERIFIED | 913 lines, wired by `suggestionsStore` |
| `src/stores/llmRunStore.ts` | Run runner (progress, cancel, partial) | VERIFIED | Wired by `RunWatcher`, `RunProgress`, `ProductsTab` |
| `src/stores/suggestionsStore.ts` | Persisted pending queue | VERIFIED | zustand `persist`, zod-resolved on load |
| `src/features/products/*` | Send dialogs, queue, run UI, category table | VERIFIED | Rendered by `ProductsTab` in `AppShell` |
| `src/domain/settings/resolver.ts` | CAT-04 precedence | VERIFIED | Consumed by `useCategorySettings` |
| `scripts/check-bundle-secrets.mjs`, `scripts/smoke-auth.mjs` | Secret and 401 gates | VERIFIED | Both executed by verifier |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Send dialog | request body | renders `batch.body.*` | WIRED | Same objects serialized by `llmClient` |
| Run store `apply` | suggestions store | `enqueueProducts/appendMembers/enqueueCategories` | WIRED | Per batch, persisted |
| Review queue accept | settings store | `acceptMany`, `setSupplierCategory`, `setProductCategory` | WIRED | Persisted settings v3 |
| Settings store | dashboard | `makeResolver` via `useCategorySettings` | WIRED | Queue never read by dashboard |
| Browser | DeepSeek | only through `/api/llm/*` | WIRED | `connect-src 'self'`; key server-only |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ReviewQueue cards | `products` | `resolveProductAnswer` of the route response | Yes (live-checked on real data in 04-06) | FLOWING |
| CategorySuggestionsTable rows | `categories` | `categorizeBatches` -> `postCategorize` | Yes in mocked e2e; never with the real model | FLOWING (mocked) |
| «Gasto por categoría» | resolver output | settings store | Yes (e2e) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Types | `pnpm tsc --noEmit` | exit 0 | PASS |
| Lint | `pnpm eslint .` | 0 errors, 1 warning (pre-existing) | PASS |
| Unit/integration | `pnpm vitest run` | 2881 passed, 10 skipped | PASS |
| No secret in client output | `node scripts/check-bundle-secrets.mjs` | OK (50 files) | PASS |
| 401 and key handling on a production server | `pnpm smoke:auth` | OK (20 checks) | PASS |
| Playwright e2e | not re-run by verifier | 04-21 SUMMARY: 14 passed, 1 skipped | SKIP (unverified by verifier) |

### Probe Execution

No probe scripts declared or found (`scripts/*/tests/probe-*.sh`). Step 7c skipped.

### Requirements Coverage

All nine IDs appear in the 04-21 PLAN frontmatter and in the union of the other plans; REQUIREMENTS.md maps exactly these nine to Phase 4 (no orphans).

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| ACC-03 | 04-02, 04-04, 04-18, 04-21 | LLM routes 401 without valid session, checked in each handler | SATISFIED | `requireSession` first statement in both handlers; smoke:auth |
| ACC-04 | 04-01, 04-02, 04-04, 04-06, 04-21 | Key never reaches browser/bundle | SATISFIED | server-only module, ESLint boundary, bundle scan OK |
| LLM-01 | 04-01, 04-02, 04-06, 04-14, 04-15, 04-21 | User can ask DeepSeek to group same-product concepts | SATISFIED | Group route + UI; live-checked on real data (open D-32 quality item in human verification) |
| LLM-02 | 04-18, 04-19, 04-20, 04-21 | Category suggestion per supplier and per product | SATISFIED (code); quality NEEDS HUMAN | Categorize route + table; only mocked/unit-tested, no live run |
| LLM-03 | 04-01, 04-02, 04-18, 04-20, 04-21 | Only descriptions and supplier names sent; schema validated | SATISFIED with caveat | Strict zod schemas + client sensitive-pattern guard; see WR-04 (no content rule server-side; category names and earlier-card context names unguarded) |
| LLM-04 | 04-03, 04-05, 04-07, 04-10, 04-11, 04-13, 04-14, 04-16, 04-17, 04-19, 04-21 | Review queue: accept, rename, split, merge, reject; nothing applied without review | SATISFIED | ReviewQueue + suggestions reducers; dashboard isolated from queue |
| LLM-05 | 04-04, 04-06, 04-11, 04-12, 04-21 | Progress, cancel, partial failure keeps processed | SATISFIED | llmRunStore; tests; WR-02 edge noted |
| LLM-06 | 04-01, 04-12, 04-14, 04-15, 04-18, 04-20, 04-21 | User told what will be sent before sending | SATISFIED | SendDialog / category dialog from the serialized bodies; footer and README text |
| CAT-04 | 04-08, 04-09, 04-21 | Precedence rule > product > supplier > Sin categoría | SATISFIED | `resolver.ts` + `resolver.test.ts` |

Bookkeeping: `.planning/REQUIREMENTS.md` still shows all nine as `[ ]` / "Pending" and ROADMAP progress shows Phase 4 "In Progress". These should be updated by the orchestrator when the phase closes; they are not code gaps.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` debt markers in phase files (the only `XXX` hits are the SAT currency code in `columns.ts` and its tests). No `TODO`/`HACK`. Code review (04-REVIEW.md): 0 critical, 5 warnings, 4 info, all still open per 04-REVIEW-DISPOSITION.md. The verifier read the code for each warning below.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/stores/llmRunStore.ts` / `CategorySuggestionsTable.tsx` | 236-241 / 133, 268 | WR-01: supplier names cut to 60 chars with «…» (`cutText`) are stored as the supplier name when a category suggestion is accepted | Warning | Real data-integrity bug: long legal names get a permanently truncated, ellipsis-terminated `supplierCategories[].name` (also written to the downloaded settings file). Assignment is keyed by RFC so categories still resolve; the stored display name is wrong |
| `src/stores/llmRunStore.ts` | 331 | WR-02: `outcome.apply()` is not inside try/catch | Warning | If it throws (e.g. `crypto.randomUUID` unavailable), `startRun` rejects despite its "never throws" contract, `void startGroupRun(...)` becomes an unhandled rejection and remaining batches are silently abandoned. Unlikely on https/localhost |
| `group/route.ts` 55, `categorize/route.ts` 57 | | WR-03: `content-type` checked with `.includes("application/json")` | Warning | Weak CSRF-style barrier; not exploitable today because the session cookie is `SameSite=Lax` and the session is required first |
| `candidates.ts` 418-422, `llmRunStore.ts` 130-137, `contract.ts` | | WR-04: sensitive-pattern guard not applied to category names or earlier-card context names; server enforces shape only, not content | Warning | LLM-03 is met at the key level (strict schemas) and for descriptions/supplier names in the browser, but a category name that looks like an RFC or a long number would be sent (the user sees it in the dialog) and a modified client could post sensitive text in permitted fields behind the session. Defense in depth gap against the stated hard constraint |
| llmRunStore late-answer path | | WR-05: late batch answers not re-checked against products accepted or «No agrupar» marks made meanwhile | Warning | Per review; not re-traced by the verifier |
| `src/components/ui/chart.tsx` | 94 | `dangerouslySetInnerHTML` in vendored shadcn `ChartStyle` fails the 04-21 raw-HTML grep gate as literally written | Info | Benign: writes CSS variables from the constant `trendChartConfig`; no XML, supplier or LLM text reaches it. Decision pending: allow-list the file in the gate |
| `src/features/shell/AppShell.tsx` | 117 | Tab list scrolls only below 640 px (`max-sm:`) | Warning | At exactly 640 px with a «Productos · n» counter the tabs overflow the list by about 17 px; UI-SPEC asks for scrolling there. Kept as `test.fail`. Not a roadmap success criterion |
| IN-01 to IN-04 | | Duplicated route code; «Nueva: X» not re-selectable; member-cap `break` drops later cards silently; one empty `i` array fails the whole batch | Info | Per review |

### Human Verification Required

See the `human_verification` list in the frontmatter (5 items): category-suggestion quality with the real key, live cancel, the D-32 JAMON ZWAN pair after cross-batch carry, tab bar and theme visual pass (including the 640 px finding), and a README/footer privacy copy read.

### Gaps Summary

No must-have truth failed and no BLOCKER was found. All five roadmap success criteria are backed by code that exists, is wired, and is exercised by tests that the verifier re-ran (2881 passing), plus a live user-approved check of grouping on real data. The status is `human_needed` rather than `passed` because several outcomes need a person with the real DeepSeek key: «Sugerir categorías» has never run against the real model, the D-32 cross-batch pair has not been re-checked live since Plan 04-15, and the 640-767 px visual pass is unjudged.

Items for the phase-close decision (none is a roadmap-truth failure, none is auto-deferred because no later phase covers them):
- Five open code-review warnings (WR-01 stored truncated supplier name is the one with a real wrong-data effect; WR-04 is the one touching the stated privacy hard constraint). Fix via `/gsd-code-review 04 --fix` or accept.
- Tab list at 640 px (fix is a one-line class change in `AppShell.tsx` plus removing the `test.fail`).
- Raw-HTML gate vs vendored `chart.tsx` (allow-list recommended).
- The deferred "auto-accept all suggestions" idea is intentionally out of this phase (`.planning/todos/pending/auto-accept-product-suggestions.md`) and is not a gap.

---

_Verified: 2026-10-22T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
