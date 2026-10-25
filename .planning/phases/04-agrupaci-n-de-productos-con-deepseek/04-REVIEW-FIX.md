---
phase: 04-agrupaci-n-de-productos-con-deepseek
fixed_at: 2026-10-25T00:00:00Z
review_path: .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-25
**Source review:** .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (0 critical, 5 warning)
- Fixed: 5
- Skipped: 0
- WR-01 and WR-04 were first skipped for a user decision and were fixed afterwards, following the user's decisions of 2026-10-25.

## Fixed Issues

### WR-01: Supplier names are truncated to 60 characters and then persisted into the settings

**Files modified:** `src/domain/llm/suggestions.ts`, `src/domain/llm/suggestions.test.ts`, `src/stores/llmRunStore.ts`, `src/stores/llmRunStore.test.ts`, `src/features/products/CategorySuggestionsTable.tsx`, `src/features/products/CategorySuggestionsTable.test.tsx`
**Commit:** 4f4c025
**Status:** fixed: requires human verification (logic change)
**Decision taken:** option 1 (additive optional `fullName`).
**Applied fix:** Supplier category rows gain an optional `fullName` (type and `categoryRowSchema`, supplier variant only; `SUGGESTIONS_VERSION` is unchanged, so a queue saved before this change still loads with status `ok`). `categorizeBatches` keeps the cut name in `name` for display and sets `fullName` to the full trimmed name. Accepting a supplier row (single or bulk, both go through `applyRow`, and the `planAccept` draft check) now writes `row.fullName ?? row.name` to `supplierCategories[].name`; toasts, announcements and aria labels keep showing the cut name. `copyCategoryRow` carries `fullName` so «Deshacer» gives the row back intact. New tests: old queue without `fullName` still loads, a 120-character `fullName` is kept, remove/restore keeps it, a 90-character supplier gets a cut `name` plus the full `fullName`, and accepting such a row stores the full name.

### WR-02: `startRun` does not guard `outcome.apply()`, so a throwing apply rejects the run promise and loses the run state

**Files modified:** `src/stores/llmRunStore.ts`, `src/stores/llmRunStore.test.ts`
**Commit:** 2cc343b
**Applied fix:** `outcome.apply()` is wrapped in try/catch. A throwing apply now counts the batch as failed (`failed += 1`, `lastError = "invalid_response"`) and the run goes on, so `startRun` keeps its "never throws" contract and ends as `partial` instead of rejecting. New test: a batch whose apply throws, followed by a good batch; the promise resolves and the status is `partial`.

### WR-03: Weak content-type check on both LLM routes

**Files modified:** `src/app/api/llm/group/route.ts`, `src/app/api/llm/categorize/route.ts`, `src/app/api/llm/group/route.test.ts`, `src/app/api/llm/categorize/route.test.ts`
**Commit:** f771b69
**Applied fix:** Both routes now compare the media type exactly (`content-type` split at `;`, trimmed, lowercased, must equal `application/json`). The shared-helper extraction (IN-01) was not done: it is out of scope (Info). New tests in both route suites: `text/plain; application/json` gives 400 and never calls DeepSeek; `Application/JSON; charset=utf-8` is accepted (200).

### WR-04: Sensitive-pattern guard does not cover every text that reaches DeepSeek, and the server enforces no content rule

**Files modified:** `src/domain/llm/sensitive.ts` (new), `src/domain/llm/candidates.ts`, `src/domain/llm/contract.ts`, `src/stores/llmRunStore.ts`, `src/stores/llmRunStore.test.ts`, `src/lib/copy/messages.ts`, `src/lib/copy/messages.test.ts`, `src/features/products/SendDialog.tsx`, `src/features/products/SendDialog.test.tsx`, `src/app/api/llm/group/route.test.ts`, `src/app/api/llm/categorize/route.test.ts`
**Commit:** e0b9995, 2069467
**Status:** fixed: requires human verification (logic change)
**Decision taken:** client (a) for earlier-card context names (dropped silently), client (c) for the user's category names (the run is blocked and the user is told which category to rename), server (a) (reject with 400, patterns in a dependency-free module).
**Applied fix:** `isSensitive` and its four patterns moved to `src/domain/llm/sensitive.ts`, which has no imports (still re-exported from `candidates.ts`; `looksSensitive` is now exported there). The request schemas use a `safeText` field (trimmed, bounded, refusing sensitive text) for every free-text field of both routes, so a sensitive string gives the existing `400 {error: "bad_request", retryable: false}` before DeepSeek is called; the route handlers are unchanged. `composeRequest` leaves out an earlier-card name that looks sensitive, keeping the context ids consecutive. `CategorizeRun.sensitiveCategories` lists the user's category names that look sensitive; `startCategorizeRun` refuses such a run (and any run whose body carries a sensitive category name) without a status change; the «Sugerir categorías» send dialog shows the user's sentence (`sensitiveCategoriesText`) in a red `role="alert"` paragraph under the summary and disables «Enviar a DeepSeek». New tests in both route suites, the store, `messages.test.ts` and `SendDialog.test.tsx`.

### WR-05: A late batch answer is enqueued without re-checking the accepted products and «No agrupar» marks

**Files modified:** `src/stores/llmRunStore.ts`, `src/stores/llmRunStore.test.ts`
**Commit:** a6f302f
**Status:** fixed: requires human verification (logic change)
**Applied fix:** In `groupBatches.apply`, the member keys held by the live settings (all accepted-product members and all `ungroupedConcepts`) are collected by a new `takenBySettings()` helper, and the ids whose member is taken are removed from each group before `resolveProductAnswer` runs. A group left with no member produces an empty card that `enqueueProductSuggestions` already drops; empty appends are already dropped as well. The reviewer's snippet used `productMemberKeys`/`ungroupedKeys`, which do not exist in the code, so the filter was done at group-id level instead of on the resolved cards. Two new tests (a mark added in flight, a product accepted in flight) fail without the fix and pass with it.

## Verification

Run in the isolated worktree of quick task 261025-cgg (`.claude/worktrees/agent-a851fe94ebda7ded2`), through the main checkout's binaries (`node_modules/.bin/tsc`, `eslint`, `vitest`) because pnpm refuses the worktree's symlinked `node_modules`. The worktree has no `.next/types`, so `tsc` shows the expected generated-type error `LayoutProps` in `src/app/layout.tsx` (it does not occur in the main checkout). The three gates still have to be re-run in the main checkout after the merge.

- `tsc --noEmit`: only the expected `src/app/layout.tsx(24,50): error TS2304: Cannot find name 'LayoutProps'.`; no other error.
- `eslint .`: 0 errors, 1 warning (pre-existing, unrelated: unused `eslint-disable` directive in `src/lib/client/navigation.ts:6`).
- `vitest run`: 93 test files passed, 6 skipped; 2846 tests passed, 75 skipped. The extra skips versus the main checkout are the `*.realdata.test.ts` suites (the untracked `Facturas/` data is not in the worktree) plus the 10 live-LLM tests that always skip.

Not in scope here: Info findings (IN-01 to IN-04), because `fix_scope` is `critical_warning`.

---

_Fixed: 2026-10-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
