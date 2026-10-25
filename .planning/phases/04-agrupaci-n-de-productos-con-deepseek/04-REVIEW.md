---
phase: 04-agrupaci-n-de-productos-con-deepseek
reviewed: 2026-10-25T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/app/api/llm/categorize/route.test.ts
  - src/app/api/llm/categorize/route.ts
  - src/app/api/llm/group/route.test.ts
  - src/app/api/llm/group/route.ts
  - src/domain/llm/candidates.ts
  - src/domain/llm/contract.ts
  - src/domain/llm/sensitive.ts
  - src/domain/llm/suggestions.test.ts
  - src/domain/llm/suggestions.ts
  - src/features/products/CategorySuggestionsTable.test.tsx
  - src/features/products/CategorySuggestionsTable.tsx
  - src/features/products/SendDialog.test.tsx
  - src/features/products/SendDialog.tsx
  - src/lib/copy/messages.test.ts
  - src/lib/copy/messages.ts
  - src/stores/llmRunStore.test.ts
  - src/stores/llmRunStore.ts
findings:
  critical: 0
  warning: 0
  info: 6
  total: 6
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-25
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This is a re-review after fixes WR-01 to WR-05 (see `04-REVIEW-FIX.md` and `git diff 9986ecb..HEAD`). I read every listed file in full and traced each fix through its callers. I found no bugs, security gaps or regressions in the five fixes. The four Info findings from the previous review still apply to the current code, and I added two new Info findings about the fixes.

Verification of the fixes:

- **WR-01 (supplier name truncated and persisted).** Correct. `categorizeBatches` sets `fullName` to the untrimmed-to-60 `target.name`. `planAccept` and `applyRow` both write `row.fullName ?? row.name`, so the draft check and the real write use the same value. `copyCategoryRow` carries `fullName`, so «Deshacer» restores the row intact. `setCategoryChoice` and `pruneCategoryRows` keep it through spread and filter. `categoryRowSchema` accepts it as optional on the supplier variant only, so an old queue still loads. `supplierAssignmentSchema.name` has no length cap, so a long name stays valid in the settings. Toasts and aria labels still use the cut `name`. The one gap is old rows (IN-05).
- **WR-02 (throwing `apply`).** Correct. The `try/catch` around `outcome.apply()` keeps `startRun` from rejecting, and the `finally` still frees the slot. The test covers the path. One small gap (IN-06).
- **WR-03 (content type).** Correct in both routes. `split(";")[0]?.trim().toLowerCase() === "application/json"` rejects `text/plain; application/json` and a missing header, and accepts any case with a charset. Both routes still call `requireSession` first.
- **WR-04 (sensitive text).**
  - Every free-text field of both request schemas uses `safeText`, and the client builders check the same strings. The client checks both the whole text and the cut text, and the server checks the trimmed, cut text that is sent. I found no case where the client lets a text through that the server then refuses, so a body made by the app should not hit the new non-retryable 400, which would stop the whole run through `stopsRun`.
  - `sensitive.ts` has no imports, so `contract.ts` does not depend on `candidates.ts`. The patterns have no `g` flag, so they hold no state between calls.
  - `composeRequest` drops a sensitive card name and keeps the ids consecutive.
  - `startCategorizeRun` refuses a run on `sensitiveCategories` and on a re-scan of the bodies.
  - The send dialog shows the alert and disables «Enviar a DeepSeek». `ProductsTab` only opens the dialog when something can be sent.
- **WR-05 (late answer).** Correct. `takenBySettings()` reads the live settings at apply time, with the same key function (`ruleMapKey`) as `memberKey`. Filtering at group-id level is sound: a group left with no member becomes an empty card that `enqueueProductSuggestions` drops, and `runCards` is only filled for cards found in the queue after the write. The two new tests cover the mark case and the accepted-product case.

## Info

### IN-01: The two LLM routes duplicate about 70 lines

**File:** `src/app/api/llm/group/route.ts:14-89` and `src/app/api/llm/categorize/route.ts:14-91`
**Issue:** `statusOf`, `failure` and the whole request pipeline are copied: session, content type, declared size, text size, JSON parse, and the schema parse. The pipeline differs only in the schema and the DeepSeek call. WR-03 had to be fixed twice, in the same lines of both files. Any later change to this security-relevant sequence can drift between the two.
**Fix:** Extract one helper, for example `src/lib/server/llmRoute.ts`, that exports `failure` and `readJsonBody(request): Promise<{ ok: true; json: unknown } | { ok: false; response: NextResponse }>`. Each route then keeps only its schema and its DeepSeek call.

### IN-02: Once the user picks an existing category on a row, the model's proposed «Nueva: X» choice cannot be selected again

**File:** `src/features/products/CategorySuggestionsTable.tsx:369-375` (also 417-425)
**Issue:** `choose()` ignores any value that does not start with `category:`. The «Nueva: X» item exists only while `row.choice.kind === "new"`. After the user picks an existing category, `setCategoryChoice` replaces the choice, and the «Nueva» item disappears from `items`. To go back to the model's proposal the user must reject and re-run the model, or type the same name in «Mis categorías». Nothing in the UI says this.
**Fix:** Keep the proposed new name on the row (for example `proposedNew?: string`), or keep it in component state, and always include the «Nueva: …» item while the row has one. Handle `NEW_VALUE` in `choose()` by calling `setCategoryChoice(row.id, { kind: "new", name })`.

### IN-03: `enqueueProductSuggestions` stops at the first card that does not fit, and nothing tells the user

**File:** `src/domain/llm/suggestions.ts:274-279`
**Issue:** When a card would pass `PENDING_LIMITS.productCards` or `members`, the loop `break`s. Later, smaller cards that would fit are dropped too. The run counts only the cards that entered (`after.length - before`), so the user sees a lower «received» number with no explanation. The members of the dropped cards stay free and can be asked again, but the user is never told to do so.
**Fix:** Use `continue` instead of `break` for the member limit, so smaller cards still fit. Have the store return or flag how many cards were left out, and show one line in the run result («N sugerencias no cupieron en la cola; revisa la cola y vuelve a intentarlo»).

### IN-04: One empty group makes the whole grouping batch fail

**File:** `src/domain/llm/contract.ts:123-131`
**Issue:** `groupModelOutputSchema` requires `i: z.array(z.string()).min(1)` for every group. If the model returns a single group with `"i": []`, `safeParse` fails in `src/lib/server/deepseek.ts:314`. The route then answers `invalid_response`, and up to 120 valid groups of that batch are lost. A retry costs a full DeepSeek call.
**Fix:** Accept empty `i` arrays in the model schema and drop those groups after parsing, before the coverage check. Coverage of the sent ids is still checked afterwards, so nothing unsafe gets through.

### IN-05: A supplier row saved before WR-01 still writes the cut name, ending in «…», to the settings

**File:** `src/features/products/CategorySuggestionsTable.tsx:133` and `:270`, `src/domain/llm/suggestions.ts:69`
**Issue:** The fix is additive on purpose: for a row without `fullName`, `row.fullName ?? row.name` writes `name`, which is the 60-character cut ending in «…». A queue stored by the earlier version can still hold such rows (only for suppliers with names longer than 60 characters). Accepting one persists the truncated name into `supplierCategories[].name`, which is the problem WR-01 fixed for new rows. The decision to do this was taken on 2026-10-25, so the impact is small. It should be written down, not forgotten.
**Fix:** Either accept this and note it in the fix report, or have `applyRow` look up the full supplier name from the loaded ledger by RFC when `fullName` is absent and `name` ends with «…».

### IN-06: A throwing `apply` is swallowed with no trace, and a half-done apply leaves run state behind

**File:** `src/stores/llmRunStore.ts:366-373` and `:195-228`
**Issue:** The new `catch` around `outcome.apply()` records `invalid_response` and nothing else; the real error is lost, so a bug in the mapping or write cannot be diagnosed from the field. Also, `apply` in `groupBatches` runs `appendMembers`, then `enqueueProducts`, then fills `runCards`. If it throws after `appendMembers`, those members are already queued but the batch counts as failed and `runCards` misses its cards. Later batches then do not see the new cards as context, and a retry can find the descriptions already pending (they are skipped, so no duplicate is created). This is a robustness gap only; the pending state stays valid.
**Fix:** Log the error in development, for example `catch (error) { if (process.env.NODE_ENV !== "production") console.error(error); ... }`, if the project's ESLint rules allow it. In `groupBatches.apply`, build the `runCards` entries after the store writes in one step, so a throw before the writes leaves the run state clean.

---

_Reviewed: 2026-10-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
