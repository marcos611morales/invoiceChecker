---
phase: 04-agrupaci-n-de-productos-con-deepseek
reviewed: 2026-10-22T00:00:00Z
depth: standard
files_reviewed: 104
files_reviewed_list:
  - .env.example
  - README.md
  - e2e/helpers.ts
  - e2e/products.spec.ts
  - e2e/smoke.spec.ts
  - eslint.config.mjs
  - playwright.config.ts
  - scripts/check-bundle-secrets.mjs
  - scripts/smoke-auth.mjs
  - src/app/api/llm/categorize/route.test.ts
  - src/app/api/llm/categorize/route.ts
  - src/app/api/llm/group/route.test.ts
  - src/app/api/llm/group/route.ts
  - src/domain/llm/candidates.anon.test.ts
  - src/domain/llm/candidates.test.ts
  - src/domain/llm/candidates.ts
  - src/domain/llm/contract.ts
  - src/domain/llm/queueView.test.ts
  - src/domain/llm/queueView.ts
  - src/domain/llm/reconcile.test.ts
  - src/domain/llm/reconcile.ts
  - src/domain/llm/suggestions.test.ts
  - src/domain/llm/suggestions.ts
  - src/domain/settings/backup.test.ts
  - src/domain/settings/backup.ts
  - src/domain/settings/categories.test.ts
  - src/domain/settings/categories.ts
  - src/domain/settings/migrate.ts
  - src/domain/settings/products.test.ts
  - src/domain/settings/products.ts
  - src/domain/settings/resolver.test.ts
  - src/domain/settings/resolver.ts
  - src/domain/settings/rules.test.ts
  - src/domain/settings/schema.ts
  - src/domain/settings/settings.test.ts
  - src/domain/settings/types.ts
  - src/features/categories/BackupControls.test.tsx
  - src/features/categories/BackupControls.tsx
  - src/features/categories/CategoriesTab.test.tsx
  - src/features/categories/CategoryList.test.tsx
  - src/features/categories/CategoryList.tsx
  - src/features/categories/DeleteCategoryDialog.tsx
  - src/features/categories/useCategorySettings.ts
  - src/features/dashboard/DashboardTab.test.tsx
  - src/features/export/sheets/conceptos.test.ts
  - src/features/export/sheets/conceptos.ts
  - src/features/invoices/ConceptCategorySelect.tsx
  - src/features/invoices/InvoiceTable.test.tsx
  - src/features/invoices/InvoiceTable.tsx
  - src/features/invoices/columns.test.ts
  - src/features/invoices/columns.ts
  - src/features/products/BulkAcceptDialog.tsx
  - src/features/products/CategorizeFlow.test.tsx
  - src/features/products/CategoryBulkDialog.tsx
  - src/features/products/CategorySuggestionsTable.test.tsx
  - src/features/products/CategorySuggestionsTable.tsx
  - src/features/products/IconAction.tsx
  - src/features/products/ProductList.test.tsx
  - src/features/products/ProductList.tsx
  - src/features/products/ProductMembers.tsx
  - src/features/products/ProductPicker.tsx
  - src/features/products/ProductsTab.test.tsx
  - src/features/products/ProductsTab.tsx
  - src/features/products/QueueBulk.test.tsx
  - src/features/products/QueueToolbar.tsx
  - src/features/products/ReviewQueue.test.tsx
  - src/features/products/ReviewQueue.tsx
  - src/features/products/RunProgress.test.tsx
  - src/features/products/RunProgress.tsx
  - src/features/products/RunResult.tsx
  - src/features/products/RunWatcher.tsx
  - src/features/products/SendDialog.test.tsx
  - src/features/products/SendDialog.tsx
  - src/features/products/UngroupedList.tsx
  - src/features/products/focusTargets.ts
  - src/features/shell/AppShell.test.tsx
  - src/features/shell/AppShell.tsx
  - src/lib/client/llmClient.ts
  - src/lib/copy/es.ts
  - src/lib/copy/messages.test.ts
  - src/lib/copy/messages.ts
  - src/lib/server/deepseek.test.ts
  - src/lib/server/deepseek.ts
  - src/lib/server/requireSession.ts
  - src/stores/llmRunStore.test.ts
  - src/stores/llmRunStore.ts
  - src/stores/safeStorage.test.ts
  - src/stores/safeStorage.ts
  - src/stores/sessionStore.ts
  - src/stores/settingsStore.test.ts
  - src/stores/settingsStore.ts
  - src/stores/storageStatusStore.ts
  - src/stores/suggestionsStore.test.ts
  - src/stores/suggestionsStore.ts
  - tests/fixtures/llm/golden-grouping.json
  - tests/fixtures/settings/ajustes-archivo-2.json
  - tests/goldenGrouping.test.ts
  - tests/llm.live.test.ts
  - tests/llmSecrets.guard.test.ts
  - tests/support/deepseekEnv.ts
  - tests/support/goldenGrouping.ts
  - tests/support/reviewQueue.ts
  - tests/support/settingsStorage.ts
  - tests/support/suggestionsStorage.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-22
**Depth:** standard
**Files Reviewed:** 104
**Status:** issues_found

## Summary

All 56 non-test source files were read in full. The test files were skimmed: a script found no test file with fewer `expect(` calls than test cases, and I read `llmRunStore.test.ts`, `candidates.anon.test.ts` and the opening of `group/route.test.ts` in detail. I did not run `tsc`, `eslint` or `vitest`. No `any`, `@ts-ignore`, non-null `!` or unjustified `as` cast was found in the reviewed files. The only casts are `as unknown` on `JSON.parse` results in tests.

The areas called out in the brief hold up under scrutiny:

- **Authentication.** `requireSession` is the first statement of both routes, before any body, content-type or environment read. The proxy checks again, and the session token is bound to the password through an HMAC claim.
- **Secrets.** `DEEPSEEK_API_KEY` is read only in `src/lib/server/deepseek.ts`, which has `import "server-only"`. ESLint forbids importing it from browser layers. `console.info` logs only codes and counts. Upstream bodies, headers and error text never reach the client. The bundle scan script and the source-guard test back this up.
- **LLM output.** Model output is parsed with zod, then the coverage check requires every id exactly once with none unknown or repeated. Group and category-code references are resolved against what was sent.
- **Stored data.** Every localStorage read goes through an envelope check plus `resolvePersisted` / `resolvePendingQueue`, which are total (`safeParse` only).
- **Reducers.** They are immutable and return the same object on a no-op. Undo values are deep copies. Product-category integrity holds in every writer: `setProductCategory`, `deleteCategory`, `restoreCategory`, `restoreProduct`, backup import and the stored schema.
- **Run runner.** The cancel, session-generation and late-response guards are correct for every path I traced. A late answer after cancel or clear is dropped before `apply`.

I found no critical defects. The five warnings are real behavioral or defense-in-depth gaps; the four info items are minor.

## Warnings

### WR-01: Supplier names are truncated to 60 characters and then persisted into the settings

**File:** `src/stores/llmRunStore.ts:236-241` (cause), `src/features/products/CategorySuggestionsTable.tsx:133,268` (effect)
**Issue:** `categorizeBatches` builds every category row with `const name = cutText(target.name, LLM_LIMITS.productName)`. This is also applied to supplier rows, so a supplier name longer than 60 characters becomes `"…first 59 chars…"`. The row name is stored in the pending queue and is later passed as the supplier name to `setSupplierCategory(draft, row.rfc, row.name, categoryId)` (planAccept) and to `useSettingsStore.getState().setSupplierCategory(row.rfc, row.name, categoryId)` (applyRow). Accepting a suggestion therefore writes a permanently truncated, ellipsis-terminated name into `supplierCategories[].name`. That value is also written to the downloaded settings file. Long legal names ("COMERCIALIZADORA ... S.A. DE C.V.") are common in CFDI. Every other writer of this field stores the full name.
**Fix:** Keep the full name for the settings write and cut only for display and the 60-character queue schema. The pending-queue row schema caps `name` at 60, so either store the display name and look the full name up from the ledger at accept time, or add a separate field:
```ts
// llmRunStore.ts, categorizeBatches
const display = cutText(target.name, LLM_LIMITS.productName);
rows.push(
  target.kind === "supplier"
    ? { id, kind: "supplier", rfc: target.rfc, name: display, fullName: target.name, choice }
    : { id, kind: "product", productId: target.productId, name: display, choice },
);
// CategorySuggestionsTable: setSupplierCategory(row.rfc, row.fullName ?? row.name, categoryId)
```
This needs `fullName` added to `categoryRowSchema` (`z.string().optional()`). The alternative is to resolve the supplier name from the ledger when accepting.

### WR-02: `startRun` does not guard `outcome.apply()`, so a throwing apply rejects the run promise and loses the run state

**File:** `src/stores/llmRunStore.ts:331`
**Issue:** `batch.send` is wrapped in try/catch, but `received += outcome.apply()` is not. `apply` runs `resolveProductAnswer`, `newSuggestionId()` (`crypto.randomUUID()`, which is undefined outside secure contexts) and the store writes. If it throws, the `finally` block resets status to `idle`. `startRun` then rejects, even though its documented contract is "It never throws". The callers use `void startGroupRun(run)`, so this becomes an unhandled rejection. The batches already applied are kept but the user sees no `partial` or `stopped` result and no error, and the remaining batches are silently abandoned.
**Fix:**
```ts
try {
  received += outcome.apply();
} catch {
  failed += 1;
  lastError = "invalid_response";
  continue;
}
```

### WR-03: Weak content-type check on both LLM routes

**File:** `src/app/api/llm/group/route.ts:55`, `src/app/api/llm/categorize/route.ts:57`
**Issue:** `request.headers.get("content-type")?.includes("application/json")` accepts any value that contains the substring. A cross-site request with `Content-Type: text/plain; application/json` is a CORS-"simple" request, so it needs no preflight, yet it passes this gate. Today `SameSite=Lax` on the session cookie keeps such a request unauthenticated, so this is not exploitable now. The content-type gate is the only CSRF-style barrier at the handler, and it is weaker than it looks. The route tests only cover `text/plain` and a missing header.
**Fix:** Compare the media type exactly, and put it in one shared helper (see IN-01):
```ts
const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
if (mediaType !== "application/json") return failure("bad_request");
```
Add a route test for `text/plain; application/json`.

### WR-04: Sensitive-pattern guard does not cover every text that reaches DeepSeek, and the server enforces no content rule

**File:** `src/domain/llm/candidates.ts:418-422` (category names), `src/stores/llmRunStore.ts:130-137` (earlier-card names), `src/domain/llm/contract.ts:77-165` and both routes
**Issue:** The privacy requirement is that only descriptions and names reach the LLM, never RFC, UUID, amounts or folios. The guard (`isSensitive` / `looksSensitive`) is applied in the browser to item descriptions, supplier names, accepted-product names, target names and member descriptions. It is not applied to:
1. The user's category names in `categorizeBatchOf` (`cutText(category.name, ...)` only). A category named after an RFC or a long number is sent on every batch.
2. The names of earlier cards added as context by `composeRequest`. These come from model output, not from the guarded inputs.

The server side validates shape and length only: `z.strictObject` blocks extra fields but any string in a permitted field passes. The guard therefore exists only in the browser, and the dialog lists what the browser built, not what a modified client or extension could post. The route is behind the session, so this is defense in depth, but "strict zod schemas, sensitive-pattern guard" is stated as a hard constraint.
**Fix:** Apply the same filter to category names and context card names (drop or withhold the name), and move `isSensitive` into a shared pure module so the route schemas can reject a sensitive string:
```ts
const safeText = (max: number) =>
  z.string().trim().min(1).max(max).refine((text) => !isSensitive(text), "sensitive");
```
Use `safeText` for `description`, `supplier`, `name` and `members` in `groupRequestSchema` and `categorizeRequestSchema`. Note that `candidates.ts` imports `../accounting/ledger`, so `isSensitive` and its patterns should be extracted to their own file first to keep `contract.ts` free of those imports.

### WR-05: A late batch answer is enqueued without re-checking the accepted products and «No agrupar» marks

**File:** `src/stores/llmRunStore.ts:169-192` with `src/domain/llm/suggestions.ts:245-272`
**Issue:** `groupBatches.apply` runs up to ~130 seconds after the request body was built. `enqueueProductSuggestions` deduplicates only against members already pending in the queue. If the user restores a settings file ("Subir ajustes" replaces products and marks wholesale) or otherwise puts one of the in-flight descriptions into a product or a «No agrupar» mark while the batch is in flight, the card is still enqueued. A description marked "never send" and re-surfacing as a suggestion contradicts D-22. Accepting such a card later fails with "members-taken", so the data stays consistent, but the user gets a card that cannot be accepted until it is rejected.
**Fix:** In `apply`, drop members already taken by the live settings before enqueueing:
```ts
const settings = useSettingsStore.getState();
const taken = new Set([
  ...productMemberKeys(settings),
  ...ungroupedKeys(settings),
]);
const cards = answer.cards
  .map((card) => ({ ...card, members: card.members.filter((m) => !taken.has(memberKey(m))) }))
  .filter((card) => card.members.length > 0);
```

## Info

### IN-01: The two LLM routes duplicate about 70 lines

**File:** `src/app/api/llm/group/route.ts:14-86`, `src/app/api/llm/categorize/route.ts:14-88`
**Issue:** `statusOf`, `failure` and the whole read pipeline are copied verbatim. The pipeline is content type, declared length, `text()`, byte count, `JSON.parse`, then safeParse. WR-03 shows the cost: the fix must be applied in two places.
**Fix:** Extract a `readJsonBody(request, schema)` helper and `failure` into `src/lib/server/llmRoute.ts`, which starts with `import "server-only"`.

### IN-02: Once the user picks an existing category on a row, the model's proposed «Nueva: X» choice cannot be selected again

**File:** `src/features/products/CategorySuggestionsTable.tsx:365-371,413-416`
**Issue:** The «Nueva: …» item is rendered only while `row.choice.kind === "new"`. `choose` writes `{ kind: "existing" }` and ignores `NEW_VALUE`. After one change of mind, the proposed new category is gone from the Select. The only way back is Rechazar then Deshacer. The `{ kind: "new" }` choice is also lost, so the proposal cannot be re-applied.
**Fix:** Keep the proposed name on the row, for example `proposedName` set when the answer arrives, and always render the «Nueva» item when it exists. Extending `setCategoryChoice` to accept `{ kind: "new", name }` from the Select would also work.

### IN-03: `enqueueProductSuggestions` stops at the first card that does not fit, and nothing tells the user

**File:** `src/domain/llm/suggestions.ts:262-267`
**Issue:** `break` on the first card that would pass `PENDING_LIMITS.members` also discards all later cards, even smaller ones that would fit. `apply` then returns a smaller `received` and the run still ends as `finished`, so the descriptions silently stay "free". Reaching 20,000 pending members is unlikely, so this is theoretical today.
**Fix:** Use `continue` for the member limit, keeping `break` only for the card-count limit. Optionally surface a toast when fewer cards entered than were returned.

### IN-04: One empty group makes the whole grouping batch fail

**File:** `src/domain/llm/contract.ts:104-112`
**Issue:** `groupModelOutputSchema` requires `i: z.array(z.string()).min(1)` for every group. A single `{"n":"X","i":[]}` from the model fails the whole parse (`invalid_response`), costing a retry and possibly the batch, although the remaining groups and the coverage check would have been enough.
**Fix:** Accept empty `i` in the schema and filter those groups out in `interpretGroups` before `mergeSameNamedGroups`. The coverage check still guards completeness.

---

_Reviewed: 2026-10-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
