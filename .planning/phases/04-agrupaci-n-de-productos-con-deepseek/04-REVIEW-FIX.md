---
phase: 04-agrupaci-n-de-productos-con-deepseek
fixed_at: 2026-10-25T00:00:00Z
review_path: .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 3
skipped: 2
status: partial
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-25
**Source review:** .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (0 critical, 5 warning)
- Fixed: 3
- Skipped: 2 (both "needs user decision")

## Fixed Issues

### WR-02: `startRun` does not guard `outcome.apply()`

**Files modified:** `src/stores/llmRunStore.ts`, `src/stores/llmRunStore.test.ts`
**Commit:** 2cc343b
**Applied fix:** `outcome.apply()` is wrapped in try/catch. A throwing apply now counts the batch as failed (`failed += 1`, `lastError = "invalid_response"`) and the run goes on, so `startRun` keeps its "never throws" contract and ends as `partial` instead of rejecting. New test: a batch whose apply throws, followed by a good batch; the promise resolves and the status is `partial`.

### WR-03: Weak content-type check on both LLM routes

**Files modified:** `src/app/api/llm/group/route.ts`, `src/app/api/llm/categorize/route.ts`, `src/app/api/llm/group/route.test.ts`, `src/app/api/llm/categorize/route.test.ts`
**Commit:** f771b69
**Applied fix:** Both routes now compare the media type exactly (`content-type` split at `;`, trimmed, lowercased, must equal `application/json`). The shared-helper extraction (IN-01) was not done: it is out of scope (Info). New tests in both route suites: `text/plain; application/json` gives 400 and never calls DeepSeek; `Application/JSON; charset=utf-8` is accepted (200).

### WR-05: A late batch answer is enqueued without re-checking accepted products and «No agrupar» marks

**Files modified:** `src/stores/llmRunStore.ts`, `src/stores/llmRunStore.test.ts`
**Commit:** a6f302f
**Status:** fixed: requires human verification (logic change)
**Applied fix:** In `groupBatches.apply`, the member keys held by the live settings (all accepted-product members and all `ungroupedConcepts`) are collected by a new `takenBySettings()` helper, and the ids whose member is taken are removed from each group before `resolveProductAnswer` runs. A group left with no member produces an empty card that `enqueueProductSuggestions` already drops; empty appends are already dropped as well. The reviewer's snippet used `productMemberKeys`/`ungroupedKeys`, which do not exist in the code, so the filter was done at group-id level instead of on the resolved cards. Two new tests (a mark added in flight, a product accepted in flight) fail without the fix and pass with it.

## Skipped Issues

### WR-01: Supplier names are truncated to 60 characters and then persisted into the settings

**File:** `src/stores/llmRunStore.ts:236-241`, `src/features/products/CategorySuggestionsTable.tsx:133,268`
**Reason:** needs user decision. CLAUDE.md rule 1 (ask, never infer): the fix requires choosing what is stored when a supplier name is longer than 60 characters, and the options change the persisted queue schema.
**Options:**
1. Add an optional `fullName` to `categoryRowSchema` (the reviewer's suggestion) and write `row.fullName ?? row.name` to `supplierCategories[].name`. Changes the stored pending-queue schema (additive, optional, so old queues still load).
2. Do not store the name in the row for suppliers; resolve the full name from the ledger by RFC at accept time. No schema change, but accept depends on the invoices still being loaded, and the ledger may hold more than one name per RFC (which one wins is another decision).
3. Raise the row `name` cap for suppliers only (for example 200) and do not cut the supplier name in the queue. Smallest change, but the display width and the 60 limit used for products and for the LLM payload then differ.
**Recommendation:** option 1: additive, keeps the display cut and the settings data separate, and does not depend on loaded invoices.
**Original issue:** Accepting a supplier suggestion writes a permanently truncated, ellipsis-terminated name into `supplierCategories[].name` and into the downloaded settings file.

### WR-04: Sensitive-pattern guard does not cover every text that reaches DeepSeek, and the server enforces no content rule

**File:** `src/domain/llm/candidates.ts:418-422`, `src/stores/llmRunStore.ts:130-137`, `src/domain/llm/contract.ts:77-165`, both routes
**Reason:** needs user decision. The fix has two parts that each need a product/privacy choice, and the second one changes server behavior.
**Options:**
- Client side (category names and earlier-card context names): (a) withhold a sensitive name by dropping that category or context card from the request; (b) send it with a neutral placeholder; (c) block the run and tell the user which category name is the problem. The review lists withheld items in the send dialog today, so (a) or (c) would need new UI text.
- Server side: (a) reject (400) any string field matching `isSensitive`, which can also reject legitimate descriptions the browser would already have withheld, and requires moving `isSensitive` and its patterns out of `candidates.ts` into a shared module; (b) keep shape validation only (current behavior) and rely on the client guard.
**Recommendation:** client side (a) for context names and (c) for user category names (they are the user's own text, so they should be told); server side (a), with the patterns extracted to a dependency-free module, since the privacy constraint is stated as hard.
**Original issue:** User category names and the names of earlier cards reach DeepSeek without the sensitive-pattern check, and the routes validate only shape and length.

## Verification

Run in the main checkout (`/Users/marcosmorales/Documents/Atzomx/InvoiceChecker`) after the three fix commits were fast-forwarded onto `main`. The fixes themselves were edited and checked per file in an isolated worktree (with `vitest`, `eslint`, `tsc` run through the shared `node_modules`); the worktree has no `.next/types`, so its `tsc` showed only the generated-type error `LayoutProps` in `src/app/layout.tsx`, which does not occur in the main checkout.

- `pnpm tsc --noEmit`: passed, no output.
- `pnpm eslint .`: 0 errors, 1 warning (pre-existing, unrelated: unused `eslint-disable` directive in `src/lib/client/navigation.ts:6`).
- `pnpm vitest run`: 98 test files passed, 1 skipped; 2888 tests passed, 10 skipped.

Not in scope here: Info findings (IN-01 to IN-04), because `fix_scope` is `critical_warning`.

---

_Fixed: 2026-10-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
