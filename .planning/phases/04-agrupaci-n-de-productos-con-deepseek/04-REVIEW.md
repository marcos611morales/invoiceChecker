---
phase: 04-agrupaci-n-de-productos-con-deepseek
reviewed: 2026-10-25T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/app/api/llm/categorize/route.ts
  - src/app/api/llm/group/route.ts
  - src/domain/llm/contract.ts
  - src/domain/llm/suggestions.test.ts
  - src/domain/llm/suggestions.ts
  - src/features/products/CategorySuggestionsTable.test.tsx
  - src/features/products/CategorySuggestionsTable.tsx
  - src/features/products/ProductsTab.test.tsx
  - src/features/products/RunResult.test.tsx
  - src/features/products/RunResult.tsx
  - src/features/shell/AppShell.test.tsx
  - src/lib/copy/messages.test.ts
  - src/lib/copy/messages.ts
  - src/lib/server/deepseek.test.ts
  - src/lib/server/deepseek.ts
  - src/lib/server/llmRoute.test.ts
  - src/lib/server/llmRoute.ts
  - src/stores/llmRunStore.test.ts
  - src/stores/llmRunStore.ts
  - src/stores/suggestionsStore.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-25
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This is a re-review after the fixes for IN-01, IN-02, IN-03, IN-04 and IN-06. IN-05 was accepted by the user and is not raised again. I read the sources in full and compared them with the previous revision (`git diff 07598a9..HEAD`).

I could not run `tsc`, `eslint` or `vitest`: `pnpm` and `node` are not on the PATH of this sandbox. The review is static. The fix report says the three gates passed on `main` at 79ed569.

**IN-01 (shared route pipeline): correct.** I compared `readJsonBody` and `failure` with the removed inline code of both routes, step by step. The order is the same on both routes: `requireSession` first (401), then exact media type (400), declared `content-length` (413), text read failure (400), real byte size (413), JSON parse (400). After that come the route's own strict schema (400), `readDeepseekEnv` (500) and the DeepSeek call. The `statusOf` mapping was moved without changes. Both routes now build their responses the same way. `server-only` guards the helper. No new problem.

**IN-02 (`proposedNew`): correct.** The field is optional and bounded to 1..60 in both row schemas. The run store sets it only for a «new» answer. The model's name is already bounded by `categorizeResponseSchema` (trimmed, 1..60), so a stored queue cannot become unreadable because of it. `copyCategoryRow` carries it, so «Deshacer» restores it. `choose(NEW_VALUE)` no longer gets dropped by the old `startsWith(CATEGORY_PREFIX)` guard. Rows saved before the field existed still load.

**IN-03 (`leftOut`): correct for product cards.**
- `continue` instead of `break` is right. A left-out card does not mark its members as taken. Cards that only lose members to dedupe are not counted as left out.
- The count goes through `enqueueProducts`, `ApplyResult`, the runner and the four ended states.
- `RunResult` shows the Alert for a clean `finished` run and a line under the other results. The `finished` status stays until the user dismisses it, so the Alert is not lost to an auto-dismiss. `RunWatcher` only toasts and does not reset the status.
- The singular and plural texts are grammatical and match the fix report. See IN-01 below for a coverage gap.

**IN-04 (empty group): correct.** The empty group is dropped before naming, merging and the coverage check. An answer that omits an id is still `incomplete_response`. A wrong shape is still `invalid_response`.

**IN-06 (try/finally): correct.** The `finally` runs after the store writes and registers only the cards that really landed (`landed.find`), so a throw before any write leaves the run state clean and a throw half-way leaves it equal to the queue. The error is re-thrown by the `finally` semantics, and the runner's `catch` counts the batch as failed. The runner's own `try/finally` frees the slot and never leaves a stale «running» status. The `NODE_ENV` check is inlined by Next, and the tests restore their spies and env stubs.

No CLAUDE.md violation found: there is no `any`, no `!`, no `@ts-ignore`, and the one `as unknown` in `llmRoute.test.ts` is a test-only widening of `response.json()`.

## Info

### IN-01: The «no cupo en la cola» notice covers product cards only

**File:** `src/stores/llmRunStore.ts:311` and `src/domain/llm/suggestions.ts:336`, `:679-688`
**Issue:** IN-03 makes a full queue visible for product cards, but two other paths still drop valid suggestions without counting them.
- `categorizeBatches.apply` always returns `leftOut: 0`, while `enqueueCategorySuggestions` stops at `PENDING_LIMITS.categoryRows` (7000) with a plain `break`. Rows past the cap vanish, and the run ends as a clean `finished`.
- `appendSuggestionMembers` stops at `PENDING_LIMITS.members` (20000) and skips the rest without a count.

Both caps are far above the expected volume (about 150 invoices), so this is not reachable in normal use. It does leave the IN-03 guarantee («the user is told when something does not fit») true only for new cards.
**Fix:** Optional. Have `enqueueCategorySuggestions` report the rows it refused for the cap (as the product version does) and return it from `apply`. Otherwise add a comment at `leftOut: 0` that explains why it is zero, so the next reader does not take it for a missing implementation.

### IN-02: A batch whose `apply` throws after writing is counted as failed and loses its `received`/`leftOut`

**File:** `src/stores/llmRunStore.ts:224-250` and `:394-405`
**Issue:** If `appendMembers` or `enqueueProducts` throws half-way, the `finally` keeps the run state consistent with the queue (the IN-06 goal), but the exception skips the `return { added, leftOut }`. The runner then does `failed += 1` and does not add what did land to `received`. The result can say «1 lote falló» while some cards of that batch are in the queue, and the toast count is lower than the queue. The case needs a throwing store write, which the current code does not produce, and the run state is correct, so only the numbers are off.
**Fix:** Optional. Leave as is, or note in the comment above the `try` that the count of a throwing batch is intentionally not reported.

### IN-03: Long doc comment line in `RunResult`

**File:** `src/features/products/RunResult.tsx:20`
**Issue:** The edited JSDoc has a very long line («so does a line under the other results). `onRetry` is the same handler...») that joins two sentences after the rewrap, so the comment reads awkwardly and is the only line in the file well past the usual width.
**Fix:** Rewrap the paragraph so `onRetry` starts its own sentence line.

---

_Reviewed: 2026-10-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
