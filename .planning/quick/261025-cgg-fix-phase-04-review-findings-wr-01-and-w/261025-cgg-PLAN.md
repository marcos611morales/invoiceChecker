---
phase: quick-261025-cgg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/domain/llm/suggestions.ts
  - src/domain/llm/suggestions.test.ts
  - src/stores/llmRunStore.ts
  - src/stores/llmRunStore.test.ts
  - src/features/products/CategorySuggestionsTable.tsx
  - src/features/products/CategorySuggestionsTable.test.tsx
  - src/domain/llm/sensitive.ts
  - src/domain/llm/candidates.ts
  - src/domain/llm/contract.ts
  - src/app/api/llm/group/route.test.ts
  - src/app/api/llm/categorize/route.test.ts
  - src/lib/copy/messages.ts
  - src/lib/copy/messages.test.ts
  - src/features/products/SendDialog.tsx
  - src/features/products/SendDialog.test.tsx
  - .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW-FIX.md
autonomous: true
requirements: [LLM-02, LLM-03, LLM-04, LLM-06]

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Accepting a supplier category suggestion whose supplier name is longer than 60 characters stores the full, uncut name in settings supplierCategories[].name (so also in the downloaded settings file), while the suggestions table, its toast and its aria labels keep showing the cut name (WR-01)"
    - "A pending queue saved before this change (supplier rows with no fullName) still loads with status ok, and accepting one of its rows stores row.name exactly as before (WR-01)"
    - "A card name produced by an earlier batch of the same run that looks sensitive (the name or its cut version) never travels in a later batch's existing list; the remaining context ids stay consecutive and no UI text changes (WR-04.1)"
    - "When any user category name (or its cut version) looks sensitive, the «Sugerir categorías» send dialog shows the exact blocking sentence and its «Enviar a DeepSeek» button is disabled; startCategorizeRun sends nothing for such a run even when called directly (WR-04.2)"
    - "Both LLM routes answer 400 {error: bad_request, retryable: false} without calling DeepSeek to any request whose description, supplier, name, members, categories or existing (context) string looks sensitive, and a clean request still answers 200 (WR-04.3)"
    - "isSensitive and its four patterns live in a module with no imports; every existing import of isSensitive from candidates keeps working (WR-04.3)"
    - "04-REVIEW-FIX.md lists WR-01..WR-05 as fixed, frontmatter fixed: 5, skipped: 0, status: all_fixed, and its Verification section reports the real gate results"
  artifacts:
    - path: src/domain/llm/sensitive.ts
      provides: "isSensitive(text: string): boolean plus the RFC, UUID, e-mail and long-number patterns; zero imports"
    - path: src/domain/llm/suggestions.ts
      provides: "optional fullName on the supplier variant of CategorySuggestion and of categoryRowSchema"
    - path: src/domain/llm/contract.ts
      provides: "request schemas whose free-text fields refuse sensitive text"
    - path: src/lib/copy/messages.ts
      provides: "sensitiveCategoriesText(names) with the user's exact Spanish sentence"
  key_links:
    - from: src/features/products/CategorySuggestionsTable.tsx
      to: setSupplierCategory
      via: "planAccept and applyRow pass row.fullName ?? row.name for supplier rows"
      pattern: "row\\.fullName \\?\\? row\\.name"
    - from: src/domain/llm/contract.ts
      to: src/domain/llm/sensitive.ts
      via: "safeText refine used by groupRequestSchema and categorizeRequestSchema; both routes already map a failed safeParse to failure(\"bad_request\")"
      pattern: "isSensitive"
    - from: src/stores/llmRunStore.ts
      to: src/domain/llm/candidates.ts
      via: "composeRequest drops names where looksSensitive is true; startCategorizeRun refuses runs with sensitive category names"
      pattern: "looksSensitive|sensitiveCategories"
    - from: src/features/products/SendDialog.tsx
      to: src/lib/copy/messages.ts
      via: "CategorizeSendDialog renders sensitiveCategoriesText(run.sensitiveCategories) and disables the confirm button"
      pattern: "sensitiveCategoriesText"
---

<objective>
Close the two phase-04 code-review findings that were skipped for a user decision, using the decisions the user has now made (locked; do not revisit or re-ask them):

- WR-01: a supplier name cut to 60 characters is written into the settings when a category suggestion is accepted. Fix: optional `fullName` on the pending supplier row; display keeps the cut `name`; accept writes `row.fullName ?? row.name`.
- WR-04: the sensitive-pattern guard misses earlier-card context names (drop silently) and user category names (block sending, with an exact Spanish message, also guarded in the store), and the server enforces nothing (move `isSensitive` to a dependency-free module and reject sensitive strings with 400 in both routes).
- Then record both as fixed in 04-REVIEW-FIX.md.

Purpose: the project's hard privacy rule (LLM-03: no RFC, UUID, e-mail or long number reaches DeepSeek) holds for every text and is enforced on the server too, and the settings never hold a damaged supplier name.
Output: the code and test changes below, three atomic commits, an updated 04-REVIEW-FIX.md.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md
@.planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW.md
@.planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW-FIX.md

## Project rules that bind every task (CLAUDE.md)

- No `any`, no non-null `!`, no `@ts-ignore`/`@ts-nocheck`, no `as` on unverified data. `noUncheckedIndexedAccess` is on.
- If something this plan does not cover turns out to be ambiguous, STOP and report it; do not pick silently. The decisions listed in the objective are final and must not be re-asked.
- Done means `pnpm tsc --noEmit`, `pnpm eslint .` and `pnpm vitest run` pass; report failures with their output.

## How to run the tools

- Node lives at `$HOME/.nvm/versions/node/v24.14.0/bin` and is not on the default PATH: prefix commands with `PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"`.
- In the main checkout, use `pnpm vitest run …`, `pnpm eslint .`, `pnpm tsc --noEmit` as written in the verify blocks.
- In a git worktree, pnpm refuses the symlinked `node_modules`. Run the same tools through the main checkout's binaries instead (main checkout path = first line of `git worktree list`; binaries in its `node_modules/.bin/`: `vitest`, `eslint`, `tsc`), with the worktree as cwd. In a worktree `tsc --noEmit` also reports a spurious missing `LayoutProps` in `src/app/layout.tsx` (no generated `.next/types`); that single error is expected there and is not a failure of this plan. The final gates must also be run in the main checkout after the worktree is merged.

## Interfaces the executor needs (extracted; read the files for the rest)

- `src/domain/llm/contract.ts`: `LLM_LIMITS` has `description: 200`, `supplier: 120`, `productName: 60`. `groupRequestSchema` free-text fields: `items[].description`, `items[].supplier`, `existing[].name`. `categorizeRequestSchema` free-text fields: `suppliers[].name`, `products[].name`, `products[].members[]`, `categories[].name`. Ids are regex-bound and need no check. The existing refine on `categorizeRequestSchema` uses the `{ message: "…" }` form.
- Both routes (`src/app/api/llm/group/route.ts`, `src/app/api/llm/categorize/route.ts`) already do `const parsed = <schema>.safeParse(json); if (!parsed.success) return failure("bad_request");`, and `failure("bad_request")` answers status 400 with body `{ error: "bad_request", retryable: false }`. The route tests assert exactly that shape (`expect(result.json).toEqual({ error: "bad_request", retryable: false })`) and `expect(fetchMock).not.toHaveBeenCalled()`.
- `src/domain/llm/candidates.ts`: `isSensitive(text)` (exported) and four module constants `RFC_PATTERN`, `UUID_PATTERN`, `EMAIL_PATTERN`, `LONG_NUMBER_PATTERN` at lines ~90-118; private `looksSensitive(text, max)` = `isSensitive(text) || isSensitive(cutText(text, max))` at ~125; `cutText(text, max)` exported at ~150; `buildCategorizeRun(asked, categories, max)` builds `sorted = orderedCategories(categories).slice(0, LLM_LIMITS.categories)` and returns `CategorizeRun { batches, suppliers, products, members, categories, withheld }`; `categorizeBatchOf` puts `cutText(category.name, LLM_LIMITS.productName)` into `body.categories`.
- `src/stores/llmRunStore.ts`: `composeRequest(batch, earlier)` (~138-155) appends earlier run card names as `p(K+1)…`; `categorizeBatches(run)` builds rows with `const name = cutText(target.name, LLM_LIMITS.productName)` (~261-267); `startCategorizeRun: (run) => get().startRun("categorize", categorizeBatches(run))` (~387).
- `src/domain/llm/suggestions.ts`: `CategorySuggestion` union type (~58-60); `categoryRowSchema` strict discriminated union (~827-843); `copyCategoryRow` rebuilds rows field by field (~340-350); `SUGGESTIONS_VERSION` and `resolvePendingQueue(raw, version)`.
- `src/features/products/CategorySuggestionsTable.tsx`: `planAccept` calls `setSupplierCategory(draft, row.rfc, row.name, categoryId)` (~133); `applyRow` calls `useSettingsStore.getState().setSupplierCategory(row.rfc, row.name, categoryId)` (~268); bulk accept goes through `applyRow` too. Every other `row.name` use (TruncatedText, toasts, announcements, aria labels) is display.
- `src/features/products/SendDialog.tsx`: `SendDialogShell({ open, onOpenChange, onConfirm, summary, lines, groups })` renders `AlertDialogAction` (a shadcn Button, accepts `disabled`) with `es.products.dialog.confirm` = «Enviar a DeepSeek»; `CategorizeSendDialog({ run, open, onOpenChange, onConfirm })`. ProductsTab opens this dialog for both the first send and «Reintentar», so the dialog is the only UI path to a categorize send.
- `src/lib/copy/messages.ts`: `withheldHeading(n)` (~650) and the private `joinParts(parts)` (~675) that returns «a», «a y b», «a, b y c».
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: WR-01 end to end — keep the full supplier name from the run to the settings</name>
  <files>src/domain/llm/suggestions.ts, src/domain/llm/suggestions.test.ts, src/stores/llmRunStore.ts, src/stores/llmRunStore.test.ts, src/features/products/CategorySuggestionsTable.tsx, src/features/products/CategorySuggestionsTable.test.tsx</files>
  <read_first>src/domain/llm/suggestions.ts (lines 40-80, 270-370, 800-913), src/stores/llmRunStore.ts (lines 224-280), src/features/products/CategorySuggestionsTable.tsx (lines 95-145, 230-320), src/features/products/CategorySuggestionsTable.test.tsx (lines 1-110 and the «Aceptar» on a supplier row describe), src/domain/llm/suggestions.test.ts (resolvePendingQueue describe, ~103-200)</read_first>
  <behavior>
    - resolvePendingQueue with a stored queue whose supplier row has no fullName (the shape saved before this change) returns status "ok" and the row unchanged.
    - resolvePendingQueue with a supplier row that has a fullName of 120 characters returns status "ok" and keeps fullName as stored.
    - removeCategoryRow followed by restoreCategoryRow (the «Deshacer» path through copyCategoryRow) gives back a supplier row with its fullName intact.
    - categorizeBatches for a supplier target whose name is 90 characters produces a row whose name equals cutText(name, 60) (60 units, ending in «…») and whose fullName equals the full trimmed name; a product row has no fullName key.
    - In CategorySuggestionsTable, accepting a supplier row whose name is the cut text and whose fullName is the 90-character name stores the 90-character name in useSettingsStore supplierCategories[].name; the toast still shows the cut name.
    - The existing test that accepts ROW_UNO (no fullName) still stores "Tienda Uno" (row.name fallback).
  </behavior>
  <action>
Implements WR-01 per the user's locked decision (option 1 of 04-REVIEW-FIX.md: additive optional field, display cut name, settings get the full name).

1. src/domain/llm/suggestions.ts: add `fullName?: string` to the supplier variant of the `CategorySuggestion` type only (product rows do not need it: their accept writes by productId), with a doc line saying it is the uncut supplier name written to the settings on accept, absent on rows saved before it existed. In `categoryRowSchema`, add `fullName: z.string().optional()` to the supplier `z.strictObject` only. No length bound, matching the comment above the stored-queue schemas (XML-derived text is not bounded so a valid queue never becomes unreadable). Do NOT change `SUGGESTIONS_VERSION`: a bump would make every saved queue unreadable, and the user required old queues to keep loading. In `copyCategoryRow`, carry fullName for supplier rows only when it is defined (conditional spread), so a row without it stays without the key. Check every other place in this file that rebuilds a supplier row field by field (search for `kind: "supplier"`) and carry fullName the same way; spreads already keep it.

2. src/stores/llmRunStore.ts `categorizeBatches`: keep `const name = cutText(target.name, LLM_LIMITS.productName)` for display; for supplier targets also set `fullName: target.name` (the target name is already trimmed by collectCategorizeTargets). Product rows unchanged.

3. src/features/products/CategorySuggestionsTable.tsx: in `planAccept` (the pure draft check, ~line 133) and in `applyRow` (the real write, ~line 268), pass `row.fullName ?? row.name` as the name argument of `setSupplierCategory`. Leave every display use of `row.name` (TruncatedText, categoryAcceptedToast, categoryCreatedToast, categoryAcceptedAnnouncement, the aria-label helpers) untouched: the user decided the cut name stays for display.

4. Tests (write them first, see behavior): suggestions.test.ts gets the two resolvePendingQueue cases and the remove/restore case; llmRunStore.test.ts gets the 90-character supplier case in the `categorizeBatches` describe (reuse its `CATEGORY_TARGETS`/`categorizeAnswer` helpers, add a long-named supplier target); CategorySuggestionsTable.test.tsx gets the long-name accept case in the «Aceptar» on a supplier row describe (seed a row with `name: cutText(long, 60)` and `fullName: long`, then assert `supplierCategories` equals `[{ rfc, name: long, categoryId }]`). If an existing test compares a whole supplier row produced by categorizeBatches with toEqual and now fails only because of the new fullName key, update that expectation to include fullName (that is the intended new shape); report any other failure instead of adjusting it.
  </action>
  <verify>
    <automated>PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" pnpm vitest run src/domain/llm/suggestions.test.ts src/stores/llmRunStore.test.ts src/features/products/CategorySuggestionsTable.test.tsx src/features/products/CategorizeFlow.test.tsx src/stores/suggestionsStore.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "row.fullName ?? row.name" src/features/products/CategorySuggestionsTable.tsx` is 2.
    - `grep -c "fullName: z.string().optional()" src/domain/llm/suggestions.ts` is 1.
    - `grep -c "export const SUGGESTIONS_VERSION = 1;" src/domain/llm/suggestions.ts` is 1 (version unchanged).
    - The new tests in the three test files pass and the verify command exits 0.
  </acceptance_criteria>
  <done>A supplier suggestion for a long legal name is stored in full in the settings on accept (single and bulk accept both go through applyRow), the table still shows the cut name, old saved queues load unchanged, and the work is committed as `fix(04): WR-01 keep the full supplier name when a category suggestion is accepted`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: WR-04 shared guard — dependency-free isSensitive, server 400 on sensitive text, earlier-card names dropped</name>
  <files>src/domain/llm/sensitive.ts, src/domain/llm/candidates.ts, src/domain/llm/contract.ts, src/stores/llmRunStore.ts, src/stores/llmRunStore.test.ts, src/app/api/llm/group/route.test.ts, src/app/api/llm/categorize/route.test.ts</files>
  <read_first>src/domain/llm/candidates.ts (lines 1-160), src/domain/llm/contract.ts (whole file), src/stores/llmRunStore.ts (lines 131-155), src/stores/llmRunStore.test.ts (the «groupBatches: earlier-batch names on later batches» describe, ~520-600, and its helpers twoBatchRun, answer, bodies), src/app/api/llm/group/route.test.ts (lines 1-230), src/app/api/llm/categorize/route.test.ts (lines 1-260)</read_first>
  <behavior>
    - group route: a body whose items[0].description is "PAGO RFC EKU9003173C9" answers 400 with json {error: "bad_request", retryable: false} and fetch is never called; the same for items[0].supplier "ventas@tienda.mx" and for existing [{id: "p1", name: "3f2504e0-4f89-41d3-9a0c-0305e82c3301"}]; the clean BODY answers 200.
    - categorize route: 400 bad_request, fetch never called, for each of: suppliers[0].name "Tienda EKU9003173C9", products[0].name "Leche 12345678", products[0].members containing "3F2504E0-4F89-41D3-9A0C-0305E82C3301", categories[0].name "pedidos@tienda.mx"; the clean BODY answers 200.
    - groupBatches over a two-batch run: batch 1's answer names two cards "Uno" and "PEDIDO 12345678"; batch 2's request existing is exactly [p1 accepted name, {id: "p2", name: "Uno"}] — the sensitive name is absent and ids stay consecutive.
    - The existing isSensitive tests in src/domain/llm/candidates.test.ts and the bodies built by buildGroupRun/buildCategorizeRun in candidates.test.ts and candidates.anon.test.ts still pass without edits.
  </behavior>
  <action>
Implements WR-04 parts 1 and 3 per the user's locked decisions (client: silently drop sensitive earlier-card context names, no UI text; server: reject sensitive strings with 400, patterns in a dependency-free module).

1. Create src/domain/llm/sensitive.ts with no imports at all. Move into it, unchanged in behavior, the four pattern constants (RFC, UUID, e-mail, long number) and `isSensitive` from candidates.ts, together with their doc comments and the section comment about the guard (UI-SPEC OQ7, LLM-03, T-04-40). Add a module doc comment saying it is shared by the browser builders and the request schemas of the LLM routes, so it must stay free of imports. `isSensitive` is the only export.

2. src/domain/llm/candidates.ts: delete the moved constants and function, import `isSensitive` from "./sensitive" and re-export it (`export { isSensitive };`) so every existing `import { isSensitive } from "./candidates"` / `"@/domain/llm/candidates"` keeps working. Leave a one-line comment where the block was, pointing to sensitive.ts. Turn the private `looksSensitive(text, max)` into an exported function (keep it here: it needs `cutText`), keeping its doc comment.

3. src/domain/llm/contract.ts: import `isSensitive` from "./sensitive". Add a private helper `safeText(max)` that returns `z.string().trim().min(1).max(max).refine((text) => !isSensitive(text), { message: "sensitive" })`. Use it for the seven free-text fields listed in the interfaces section (group: items description and supplier, existing name; categorize: suppliers name, products name, each member, categories name), replacing their current `z.string().trim().min(1).max(…)` chains with the same max values. Do not touch the id regexes, the array bounds, the top-level categorize refine or any response/model-output schema. Update the module header ("Pure: zod only.") to say it depends on zod and the import-free sensitive.ts, and note on the request schemas that a field that looks like an RFC, a UUID, an e-mail or a long number makes the body invalid (LLM-03, WR-04). The route files need no code change: both already return `failure("bad_request")` (400, `{ error: "bad_request", retryable: false }`) when `safeParse` fails, which is the existing 400 shape the user asked to reuse; do not add a second check in the routes.

4. src/stores/llmRunStore.ts `composeRequest`: import `looksSensitive` from "@/domain/llm/candidates" (next to `cutText`). In the loop over earlier cards, skip a card when `looksSensitive(card.name, LLM_LIMITS.productName)` is true, before computing the id, so the ids of the names that are sent stay consecutive. No status, toast or text for a skipped name (user decision: silent). Extend the doc comment of composeRequest with one sentence saying such a name is left out.

5. Tests first (see behavior): add a describe "the sensitive-pattern guard (WR-04)" to each route test file, built on the file's existing BODY, request(), answer(), fetchMock and success-answer helpers (group: oneGroup; categorize: goodAnswer); add the sensitive-context case to the earlier-batch describe in llmRunStore.test.ts using its twoBatchRun/answer/bodies helpers.
  </action>
  <verify>
    <automated>PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" pnpm vitest run src/app/api/llm src/domain/llm src/stores/llmRunStore.test.ts src/features/products</automated>
  </verify>
  <acceptance_criteria>
    - `test "$(grep -c '^import' src/domain/llm/sensitive.ts)" = 0` succeeds and `grep -c "export function isSensitive" src/domain/llm/sensitive.ts` is 1.
    - `grep -c "const RFC_PATTERN" src/domain/llm/candidates.ts` is 0 and `grep -c "export function looksSensitive" src/domain/llm/candidates.ts` is 1.
    - `grep -c "safeText(" src/domain/llm/contract.ts` is at least 8 (one definition, seven uses).
    - `grep -c "looksSensitive" src/stores/llmRunStore.ts` is at least 2 (import and use).
    - `git diff --quiet 4394cdc -- src/app/api/llm/group/route.ts src/app/api/llm/categorize/route.ts` succeeds (route handlers unchanged since the planning base commit).
    - The verify command exits 0, including the untouched isSensitive tests in candidates.test.ts.
  </acceptance_criteria>
  <done>The routes refuse any sensitive free text with the existing 400 shape before DeepSeek is called, earlier-card names that look sensitive never travel, isSensitive sits in an import-free module still reachable through candidates, and the work is committed as `fix(04): WR-04 reject sensitive text on the LLM routes and drop sensitive context names`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: WR-04 user category names — block the send with the user's message, guard the run start, record the fixes</name>
  <files>src/domain/llm/candidates.ts, src/stores/llmRunStore.ts, src/stores/llmRunStore.test.ts, src/lib/copy/messages.ts, src/lib/copy/messages.test.ts, src/features/products/SendDialog.tsx, src/features/products/SendDialog.test.tsx, .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW-FIX.md</files>
  <read_first>src/domain/llm/candidates.ts (lines 330-483), src/features/products/SendDialog.tsx (whole file), src/features/products/SendDialog.test.tsx (lines 1-60 and 140-245), src/lib/copy/messages.ts (lines 640-700), src/lib/copy/messages.test.ts (the withheldHeading test near line 1291), src/stores/llmRunStore.test.ts (the categorizeBatches describe, ~758-900), .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW-FIX.md</read_first>
  <behavior>
    - sensitiveCategoriesText(["Pagos EKU9003173C9"]) returns exactly: No se puede enviar: la categoría «Pagos EKU9003173C9» contiene algo que parece un RFC, un UUID, un correo o un número largo. Cámbiale el nombre en la pestaña Categorías y vuelve a intentarlo.
    - sensitiveCategoriesText(["A", "B"]) returns exactly: No se puede enviar: las categorías «A» y «B» contienen algo que parece un RFC, un UUID, un correo o un número largo. Cámbiales el nombre en la pestaña Categorías y vuelve a intentarlo.
    - sensitiveCategoriesText(["A", "B", "C"]) uses «A», «B» y «C» in the same plural sentence.
    - buildCategorizeRun with the user's categories including "Pagos EKU9003173C9" gives run.sensitiveCategories equal to ["Pagos EKU9003173C9"]; with clean categories it is [].
    - startCategorizeRun on that run resolves, postCategorize is never called and the run status stays { phase: "idle" }; the same holds for a copy of the run with sensitiveCategories forced to [] whose batch body still carries the sensitive category name (UI-bypass case).
    - CategorizeSendDialog for that run shows the exact singular sentence, the «Enviar a DeepSeek» button is disabled and clicking it does not call onConfirm; for a clean run the sentence is absent and the button is enabled (the existing tests keep passing).
  </behavior>
  <action>
Implements WR-04 part 2 per the user's locked decision (option (c): block the run and tell the user which category name is the problem, with the user's exact text; also guarded in the store), then part 4 (the report).

1. src/domain/llm/candidates.ts: add `sensitiveCategories: string[]` to `CategorizeRun`, documented as the names of the user's categories that would travel and that look sensitive (the name or its cut version), in the order they would travel; while it is not empty the run must not be sent. In `buildCategorizeRun`, compute it from `sorted` with `looksSensitive(category.name, LLM_LIMITS.productName)`, mapping to `category.name`. Leave the bodies as built (the dialog keeps listing what the run holds; nothing is sent while blocked).

2. src/stores/llmRunStore.ts `startCategorizeRun`: before calling startRun, return a resolved promise without starting anything when `run.sensitiveCategories.length > 0` or when any `batch.body.categories[].name` of the run satisfies `isSensitive` (import it from "@/domain/llm/candidates"; the body names are already cut, so this second check covers a run object built or altered outside buildCategorizeRun). No status change and no text: the dialog is where the user is told. Document the guard in the JSDoc of `startCategorizeRun` in the `LlmRunState` interface.

3. src/lib/copy/messages.ts: add an exported `sensitiveCategoriesText(names: readonly string[]): string`, placed after `joinParts`, with a doc comment in the style of `withheldHeading` (state that the sentences are the user's, 2026-10-25, WR-04). One name: «No se puede enviar: la categoría «{nombre}» contiene algo que parece un RFC, un UUID, un correo o un número largo. Cámbiale el nombre en la pestaña Categorías y vuelve a intentarlo.» Two or more: «No se puede enviar: las categorías {lista} contienen algo que parece un RFC, un UUID, un correo o un número largo. Cámbiales el nombre en la pestaña Categorías y vuelve a intentarlo.», where {lista} is `joinParts` over each name wrapped in « ». The caller only uses it with at least one name; say so in the doc comment.

4. src/features/products/SendDialog.tsx (planner's choice for placement, the user fixed only the text and the disabled button): add a `blocked: string | null` prop to `SendDialogShell`. When not null, render it right under `AlertDialogDescription` (before `lines`) as a `<p>` with `role="alert"` and the classes `text-sm text-destructive break-words` (the inline-error style already used in CategorySuggestionsTable), set `disabled` on `AlertDialogAction`, and make its onClick do nothing while blocked (do not set `confirmed.current`, do not call onConfirm). `SendDialog` (grouping) passes `blocked={null}`. `CategorizeSendDialog` passes `sensitiveCategoriesText(run.sensitiveCategories)` when `run.sensitiveCategories.length > 0`, else null. «No enviar» keeps the initial focus and keeps working.

5. Tests first (see behavior): messages.test.ts for the three counts; llmRunStore.test.ts in the categorizeBatches describe for the two store-guard cases (build the run with buildCategorizeRun from its CATEGORY_TARGETS plus a category list that includes a sensitive name); SendDialog.test.tsx in the categorize describe for the blocked and clean dialog. In the blocked dialog test, do not pass the bodies through the file's travelledCategorize helper: categorizeRequestSchema now rejects them by design.

6. Full gates, then the report. Run `pnpm tsc --noEmit`, `pnpm eslint .` and `pnpm vitest run` (see "How to run the tools" for a worktree). Then edit .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW-FIX.md with Edit (not Write):
   - frontmatter: `fixed: 5`, `skipped: 0`, `status: all_fixed`; leave the other keys.
   - Summary: «Fixed: 5», «Skipped: 0»; add one line saying WR-01 and WR-04 were fixed after the user's decisions of 2026-10-25.
   - Move WR-01 and WR-04 under «## Fixed Issues», with the exact titles of 04-REVIEW.md («### WR-01: Supplier names are truncated to 60 characters and then persisted into the settings» and «### WR-04: Sensitive-pattern guard does not cover every text that reaches DeepSeek, and the server enforces no content rule»), ordering the fixed entries WR-01..WR-05. Each gets **Files modified:**, **Commit:** (the short hash of this plan's commit for it; WR-04 lists the Task 2 and Task 3 commits), **Status:** fixed: requires human verification (logic change), the decision taken (WR-01 option 1; WR-04 client (a) for context names, (c) for category names, server (a)) and **Applied fix:** in the style of the existing entries.
   - Delete the skipped-issues section (its heading and both entries): nothing is skipped any more.
   - Verification: replace the three result lines with the real results of this run (test file and test counts from vitest, the eslint error/warning counts, the tsc outcome) and say where they were run. If they were run in a worktree, say so, name the expected `LayoutProps` tsc error, and state that the gates still have to be re-run in the main checkout after the merge.
   Commit code and report together as `fix(04): WR-04 block «Sugerir categorías» when a category name looks sensitive` (or commit the report separately as `docs(04): record WR-01 and WR-04 fixes`).
  </action>
  <verify>
    <automated>PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" pnpm tsc --noEmit && PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" pnpm eslint . && PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" pnpm vitest run</automated>
    <human-check>Open Productos, rename a category in Categorías to one containing an RFC (for example «Pagos EKU9003173C9»), press «Sugerir categorías»: the dialog shows the blocking sentence in red and «Enviar a DeepSeek» is disabled; rename it back and the button is enabled again.</human-check>
  </verify>
  <acceptance_criteria>
    - `grep -c "export function sensitiveCategoriesText" src/lib/copy/messages.ts` is 1.
    - `grep -c "sensitiveCategories" src/domain/llm/candidates.ts` is at least 2 and `grep -c "sensitiveCategories" src/stores/llmRunStore.ts` is at least 1.
    - `grep -c "sensitiveCategoriesText" src/features/products/SendDialog.tsx` is at least 2 (import and use).
    - With F=.planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW-FIX.md: `grep -c "^status: all_fixed" "$F"` is 1, `grep -c "^fixed: 5" "$F"` is 1, `grep -c "^skipped: 0" "$F"` is 1, `grep -c "^### WR-0[1-5]:" "$F"` is 5, and `test "$(grep -c '^## Skipped' "$F")" = 0` succeeds.
    - tsc, eslint (0 errors; the pre-existing unused-directive warning in src/lib/client/navigation.ts may remain) and vitest all pass, with the worktree-only `LayoutProps` exception described in the context.
  </acceptance_criteria>
  <done>A category name that looks sensitive can no longer reach DeepSeek: the dialog explains which one with the user's sentence and cannot send, and startCategorizeRun refuses the run even if called directly. 04-REVIEW-FIX.md shows 5 fixed, 0 skipped, all_fixed, with real verification results. All commits made.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api/llm/group, /api/llm/categorize | Request bodies are untrusted: a modified client or an extension can post any string in a permitted field |
| DeepSeek output → later request | Card names come from model output and are sent again as context |
| user input → request | Category names are the user's own text and travel on every categorize batch |
| localStorage → pending queue | The stored queue, now with fullName, is untrusted on load |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-cgg-01 | Information disclosure | llmRunStore composeRequest (earlier-card names) | medium | mitigate | Skip any card name for which looksSensitive(name, 60) is true before it is added to existing (Task 2) |
| T-cgg-02 | Information disclosure | buildCategorizeRun / startCategorizeRun (user category names) | medium | mitigate | sensitiveCategories blocks the dialog's send button; startCategorizeRun refuses runs with sensitive names in the list or in any body (Task 3) |
| T-cgg-03 | Information disclosure / Tampering | groupRequestSchema, categorizeRequestSchema used by both routes | high | mitigate | safeText refine on every free-text field; a failed safeParse already answers 400 bad_request before readDeepseekEnv and the DeepSeek call (Task 2, route tests prove fetch is never called) |
| T-cgg-04 | Tampering | categoryRowSchema fullName from localStorage | low | mitigate | Strict schema with fullName as an optional string on supplier rows only; anything else makes the queue unreadable (existing resolvePendingQueue path); the value is only written to settings name and rendered as React text |
| T-cgg-05 | Denial of service | server refine false positives | low | accept | The browser withholds or blocks the same patterns first, so bodies built by the app never trip the server rule; a 400 from a tampered body ends the run with the existing non-retryable message |
| T-cgg-SC | Tampering | npm/pnpm installs | low | accept | This plan installs no package; no legitimacy gate needed |
</threat_model>

<verification>
- `pnpm tsc --noEmit`, `pnpm eslint .`, `pnpm vitest run` pass (main checkout; in a worktree only the known `LayoutProps` tsc error is allowed, and the gates are re-run in main after merge).
- Route tests: sensitive string in each free-text field gives 400 `{ error: "bad_request", retryable: false }` with no DeepSeek call; clean body gives 200, in both route suites.
- Store tests: long supplier name keeps fullName; sensitive earlier-card name absent from batch 2; sensitive category run never posts.
- UI tests: accept writes the full name; blocked dialog shows the exact sentence with the button disabled.
- 04-REVIEW-FIX.md frontmatter and sections as listed in Task 3.
</verification>

<success_criteria>
- WR-01 and WR-04 fixed exactly as the user decided, with no change to SUGGESTIONS_VERSION and no new UI text beyond the one blocking sentence.
- Every new behavior covered by a test that fails without the change.
- Three gates green; 04-REVIEW-FIX.md reports 5 fixed, 0 skipped, all_fixed.
</success_criteria>

<output>
Create `.planning/quick/261025-cgg-fix-phase-04-review-findings-wr-01-and-w/261025-cgg-SUMMARY.md` when done, listing the commits, the gate results and where they were run.
</output>
