---
phase: 04-agrupaci-n-de-productos-con-deepseek
fixed_at: 2026-10-25T00:00:00Z
review_path: .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-25
**Source review:** .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (fix scope `all`: 0 Critical, 0 Warning, 6 Info)
- Fixed: 5
- Skipped: 1 (IN-05, accepted by the user, no code change)

This report replaces the earlier one, which described WR-01 to WR-05. Those fixes are in git history.

## Fixed Issues

### IN-01: The two LLM routes duplicate about 70 lines

**Files modified:** `src/lib/server/llmRoute.ts` (new), `src/lib/server/llmRoute.test.ts` (new), `src/app/api/llm/group/route.ts`, `src/app/api/llm/categorize/route.ts`
**Commit:** 01df0d5
**Applied fix:** New helper `src/lib/server/llmRoute.ts` exports `failure(code)` and `readJsonBody(request)`. `readJsonBody` runs the whole shared sequence in the same order as before: session, exact media type, declared size, text size, JSON parse. It returns `{ ok: true, json }` or `{ ok: false, response }`. Each route now keeps only its strict schema, its env check and its DeepSeek call. The helper imports `server-only`, so the lint rule that keeps `src/lib/server/*` out of browser code still applies. New unit tests cover `failure` (own status, retryable flag), the session-first order, the media type (case, charset, `text/plain; application/json`, missing), both size checks (also with a lying header) and invalid JSON. The existing route tests still pass unchanged.

### IN-02: Once the user picks an existing category on a row, the model's proposed «Nueva: X» choice cannot be selected again

**Files modified:** `src/domain/llm/suggestions.ts`, `src/stores/llmRunStore.ts`, `src/features/products/CategorySuggestionsTable.tsx`, `src/domain/llm/suggestions.test.ts`, `src/stores/llmRunStore.test.ts`, `src/features/products/CategorySuggestionsTable.test.tsx`
**Commit:** e76abc8
**Applied fix:** Both row kinds got an optional `proposedNew` (1 to 60 characters) in the type and in `categoryRowSchema`, so a queue saved before it existed still loads, unchanged. `categorizeBatches` sets it when the model answers with a new name. `copyCategoryRow` carries it, so «Deshacer» restores it. In the table, a new helper `newCategoryName(row)` returns the chosen new name, else `proposedNew`, else null. The «Nueva: …» item is listed while it returns a name, and `choose()` handles `NEW_VALUE` by calling `setCategoryChoice(row.id, { kind: "new", name })`. No new UI text. Tests: schema accepts and bounds the field and old rows load; remove and restore keep it; the run store sets it only for a «new» answer; the table lists the item for a row with an existing choice and a proposal, and the user can go back to it from another category on supplier and product rows, with the settings untouched.

### IN-03: `enqueueProductSuggestions` stops at the first card that does not fit, and nothing tells the user

**Files modified:** `src/domain/llm/suggestions.ts`, `src/stores/suggestionsStore.ts`, `src/stores/llmRunStore.ts`, `src/features/products/RunResult.tsx`, `src/lib/copy/messages.ts`, and tests (`suggestions.test.ts`, `llmRunStore.test.ts`, `messages.test.ts`, `RunResult.test.tsx` new, `ProductsTab.test.tsx`, `AppShell.test.tsx`)
**Commit:** 3b1bc0d
**Applied fix:**
- `enqueueProductSuggestionsWithOverflow` uses `continue` instead of `break`, so smaller cards that fit still enter, and returns `{ products, leftOut }`. `enqueueProductSuggestions` is a thin wrapper that keeps its old signature. A card that is left out no longer marks its members as taken, so a later card that shares a member can still use it.
- `enqueueProducts` in the store now returns `leftOut`. `RunBatch.apply` now returns `{ added, leftOut }` (was a number). The runner adds up `leftOut` and the four ended states (`finished`, `partial`, `stopped`, `canceled`) carry it.
- `src/lib/copy/messages.ts` has `leftOutText(n)` with the exact texts: «{N} sugerencias no cupieron en la cola; revisa la cola y vuelve a intentarlo.» and the singular «1 sugerencia no cupo en la cola; revisa la cola y vuelve a intentarlo.»
- `RunResult` shows the line only when `leftOut > 0`: an Info Alert (same style as the canceled one) for a clean `finished` run, which had no Alert before, and a `text-xs text-muted-foreground` line under the canceled, partial and stopped results, like the existing failure reason line.
- Public API change: `RunBatch.apply` and the run `status` shapes changed (additive `leftOut`). Tests that compared `status` with `toEqual` or called `apply()` were updated.

### IN-04: One empty group makes the whole grouping batch fail

**Files modified:** `src/domain/llm/contract.ts`, `src/lib/server/deepseek.ts`, `src/lib/server/deepseek.test.ts`
**Commit:** c28dde4
**Applied fix:** `groupModelOutputSchema` no longer requires `min(1)` on `i`. `interpretGroups` skips a group with no ids before naming, merging and the coverage check. Coverage of the sent ids is still checked afterwards, so an answer that omits an id is still an `incomplete_response`. Tests: valid groups survive an empty one on the first attempt; an empty group is not merged into a same-named group; a missing id after the drop is still `incomplete_response`; a wrong shape (`i` not an array) is still `invalid_response`.

### IN-06: A throwing `apply` is swallowed with no trace, and a half-done apply leaves run state behind

**Files modified:** `src/stores/llmRunStore.ts`, `src/stores/llmRunStore.test.ts`
**Commit:** 79ed569
**Applied fix:** ESLint has no `no-console` rule here, so no disable comment was needed. The `catch` around `outcome.apply()` now does `if (process.env.NODE_ENV !== "production") console.error(error)` before counting the failed batch. In `groupBatches.apply`, the `runCards` entries are now built in a `finally` after the store writes, from the cards that really landed in the queue, and registered in one step. A throw before any write leaves the run state clean. A throw half-way (for example after `appendMembers`) leaves it equal to the queue, so later batches name the cards that are there. This goes slightly beyond a plain reorder because the review's half-done case needs it. Tests: the error is logged outside production and not logged in production; a write that throws first leaves batch 2 without batch 1's names; a write that throws after landing leaves batch 2 naming those cards.

## Skipped Issues

### IN-05: A supplier row saved before WR-01 still writes the cut name, ending in «…», to the settings

**File:** `src/features/products/CategorySuggestionsTable.tsx:133` and `:270`, `src/domain/llm/suggestions.ts:69`
**Reason:** accepted by user on 2026-10-25: only rows queued before WR-01, supplier names over 60 chars. No code change.
**Original issue:** For a row without `fullName`, `row.fullName ?? row.name` writes `name`, which is the 60-character cut ending in «…». A queue stored by the version before WR-01 can still hold such rows (only for suppliers with names longer than 60 characters). Accepting one persists the truncated name into `supplierCategories[].name`.

## Verification

Where it ran: the fixes were made and checked file by file in an isolated worktree (`.claude/worktrees/rf-04-30089-…`, with `node_modules` linked to the main checkout). The worktree is gone. After the fast-forward of `main` to 79ed569, the three gates were run again in the main checkout, so these numbers can be reproduced from the tree you are looking at:

- `pnpm tsc --noEmit`: no errors.
- `pnpm eslint .`: 0 errors, 1 warning. The warning is the unused `eslint-disable` directive in `src/lib/client/navigation.ts:6`, a file this run did not touch.
- `pnpm vitest run`: 100 test files passed, 1 skipped; 2947 tests passed, 10 skipped; 0 failed.

Human check recommended: IN-02 and IN-03 change what the user sees (the select list of a category row, and a new line in the run result), and IN-06 changes the run bookkeeping on an error path. Their logic is covered by tests, but not by a visual check.

---

_Fixed: 2026-10-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
