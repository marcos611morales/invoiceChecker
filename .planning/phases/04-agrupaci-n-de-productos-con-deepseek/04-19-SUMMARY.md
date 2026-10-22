---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 19
subsystem: llm
tags: [deepseek, categories, zustand, base-ui-select, review-queue, a11y]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "Category rows in the pending queue, read-only CategoryRows in ProductsTab, settings actions for supplier and product categories (plans 04-08, 04-11, 04-18)"
provides:
  - "pruneCategoryRows, removeCategoryRow, restoreCategoryRow and setCategoryChoice: pure reducers over the pending queue that keep it valid for pendingQueueSchema"
  - "Queue store actions removeCategoryRow, restoreCategoryRow, setCategoryChoice and pruneCategories (each sets only categories)"
  - "CategorySuggestionsTable: type Badge, name, preselected Select (Nueva: nombre first, no Sin categoría), per-row Aceptar and Rechazar with Deshacer"
  - "Accept writes the supplier default category (RFC and name) or the product category; a new category is created on first use and reused; refusals shown under the row"
  - "ProductsTab prunes rows whose supplier or product got a category by other means, or whose product was deleted"
affects: [04-20 Aceptar todas and smoke probe, 04-21 live check]

plan_head_before: caf6252fab45ed322c65bf37dddff3d350c496a6
plan_head_after: b5d0ccbeb6cf8a8c5e21b145e8a77cf45bfcd6f3
commits: 3

actuals:
  tokens: 21200
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Accept plans on a draft first: planAccept runs addCategory and setSupplierCategory on a copy of the settings, and only a fully valid plan is committed through the store actions, so a refusal never leaves a created category behind"
    - "Accept re-validates the row with pruneCategoryRows against the live settings, so a stale row is dropped even before the tab effect has run"

key-files:
  created:
    - src/features/products/CategorySuggestionsTable.tsx
    - src/features/products/CategorySuggestionsTable.test.tsx
  modified:
    - src/domain/llm/suggestions.ts
    - src/domain/llm/suggestions.test.ts
    - src/stores/suggestionsStore.ts
    - src/stores/suggestionsStore.test.ts
    - src/features/products/ProductsTab.tsx
    - src/features/products/CategorizeFlow.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "Pure reducers (remove, restore, choose) live in suggestions.ts next to the product-card ones, not only in the store; the store actions delegate and write only when the reducer returns a different object"
  - "«Aceptar» keeps aria-disabled (never disabled) when the Select has no usable value; the press is ignored"
  - "A proposed new name equal to the reserved «Sin categoría» is refused by addCategory's own validation and shows the existing reserved-name text under the row; no new copy"
  - "Focus after a row leaves (accept or reject): the next row's Select, the section heading when the row was the last of several, the tab heading when the section unmounts"
  - "The section heading stays «Sugerencias de categoría · {n}» (as shipped in 04-18 and as the product queue does); see Items that need a decision"

patterns-established:
  - "Draft-then-commit for multi-step settings writes from a suggestion"

requirements-completed: [LLM-02, LLM-04]

coverage:
  - id: D1
    description: "pruneCategoryRows drops supplier rows whose supplier has a default category (that exists) and product rows whose product has a category or was deleted; same object when nothing changes; remove/restore keep the index; setCategoryChoice stores an existing id or a trimmed new name of 1 to 60 characters; every result passes pendingQueueSchema and inputs are never mutated"
    requirement: "LLM-04"
    verification:
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#pruneCategoryRows (D-07, D-18, D-34, A-3)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#removeCategoryRow and restoreCategoryRow (D-18, D-22)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#setCategoryChoice (D-17, D-18)"
        status: pass
      - kind: unit
        ref: "src/stores/suggestionsStore.test.ts#category row actions of the queue store (D-17, D-18, D-22, A-3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "E5 populated: heading with count, intro, column headers, 760px table, type Badge, name, product caption with two descriptions and «+k», Select preselected on the suggested category («Nueva: …» first, no «Sin categoría»)"
    requirement: "LLM-02"
    verification:
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#the table and its rows (D-23, E5 populated)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Aceptar writes the supplier default category with RFC and name (moving the lines' category) or the product category; a new category is created on the first accepted row and reused; a name matching an existing category reuses it; toasts, announcement and focus follow the spec"
    requirement: "LLM-02"
    verification:
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#«Aceptar» on a supplier row (D-18)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#a new category (D-17)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#focus after a row leaves (a11y)"
        status: pass
    human_judgment: false
  - id: D4
    description: "E5 error: the 200-category limit, the 5,000-supplier limit and the reserved name show under the row and create nothing; a deleted suggested category shows «Elige una categoría» with Aceptar aria-disabled"
    requirement: "LLM-02"
    verification:
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#refusals of «Aceptar» (E5 error)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Rechazar removes the row with «Sugerencia rechazada» and a 6 s «Deshacer» that restores it in place; a row whose target got a category by other means, or whose product was deleted, leaves the table without being applied; nothing in the settings changes before Aceptar"
    requirement: "LLM-04"
    verification:
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#«Rechazar» and «Deshacer» (D-22)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#a row whose target got a category by other means (D-07, D-18, D-34, A-3)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#the table inside the tab (LLM-04)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual layout of the table (column widths, Select width 240px, 56px rows, mobile stacking of the Select and 44px targets) and the touch behavior of the truncated names"
    verification: []
    human_judgment: true
    rationale: "Pixel layout and responsive behavior are not asserted by jsdom tests; the UI-SPEC marks long-text of E5 as a held-out visual check (Plan 04-21)"

duration: 24min
completed: 2026-10-22
status: complete
---

# Phase 4 Plan 19: Category suggestion review table Summary

**«Sugerencias de categoría» table with the Select preselected on DeepSeek's category («Nueva: …» first, never «Sin categoría»), per-row Aceptar that writes the supplier default category or the product category (creating a new category only on accept and reusing it), Rechazar with Deshacer, and pruning of rows whose target already got a category.**

## Performance

- **Duration:** about 24 min (start time reconstructed from the first test run; not captured at spawn)
- **Completed:** 2026-10-22T18:24:17Z
- **Tasks:** 2 (Task 1 as RED then GREEN)
- **Files modified:** 11 (2 created, 9 modified)

## Accomplishments

- Pure reducers `pruneCategoryRows`, `removeCategoryRow`, `restoreCategoryRow`, `setCategoryChoice` in `suggestions.ts` plus the four store actions; every result is a valid stored queue and a no-op returns the same object so nothing is written.
- `CategorySuggestionsTable` replaces the read-only `CategoryRows`: Tipo Badge, Nombre (`TruncatedText`, product caption with two descriptions and «+k»), the Select (240px, full width under 640px) and «Aceptar»/«Rechazar» with row-naming aria-labels.
- Accept resolves the choice (existing id, or a new name matched case-insensitively against the user's categories, otherwise created through `addCategory` rules), plans the whole write on a draft first, then commits through the settings store. Supplier rows store RFC and name (D-18); product rows store the product category.
- Stale rows never overwrite a category the user chose: `ProductsTab` runs `pruneCategories` in an effect, and accept itself re-checks with `pruneCategoryRows` against the live settings.

## Task Commits

1. **Task 1 RED: failing tests for the category-row reducers** - `61ef210` (test)
2. **Task 1 GREEN: reducers (prune, remove, restore, choose)** - `17991a5` (feat)
3. **Task 2: category suggestion table, tab wiring, copy** - `b5d0ccb` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `src/domain/llm/suggestions.ts` - `PruneSettings`, `RemovedCategoryRow` and the four reducers
- `src/stores/suggestionsStore.ts` - `removeCategoryRow`, `restoreCategoryRow`, `setCategoryChoice`, `pruneCategories`
- `src/features/products/CategorySuggestionsTable.tsx` - the table, `planAccept` (draft validation), focus and toasts
- `src/features/products/ProductsTab.tsx` - table in place of the read-only rows, prune effect
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - column headers, rejection toast, accept toasts, announcement, aria labels, refusal texts (`categoryAcceptedToast`, `categoryCreatedToast`, `categoryAcceptedAnnouncement`, `categoryAcceptErrorText`, `categorySelectAria`, `moreMembersLabel`)
- Tests: `suggestions.test.ts`, `suggestionsStore.test.ts`, `CategorySuggestionsTable.test.tsx` (39 tests), `messages.test.ts`, and `CategorizeFlow.test.tsx` adjusted (rows are now `tr` with a Select)

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing 04-18 test depended on the read-only rows**
- **Found during:** Task 2
- **Issue:** `CategorizeFlow.test.tsx` looked rows up as `li` and read the category as plain text; the table renders `tr` rows with a Select.
- **Fix:** `categoryRow` now finds the `tr`; the category is asserted on the row's combobox text.
- **Files modified:** src/features/products/CategorizeFlow.test.tsx
- **Verification:** `pnpm verify`
- **Committed in:** b5d0ccb

**2. [Rule 2 - Missing critical functionality] Stale-row check at accept time and draft validation**
- **Found during:** Task 2
- **Issue:** The prune effect runs after render, so a row could still be accepted in the gap and overwrite a category the user just chose; and creating the new category before the assignment could leave an orphan category when the 5,000-supplier limit refuses the assignment.
- **Fix:** Accept re-runs `pruneCategoryRows` against the live settings, and `planAccept` validates category creation plus the assignment on a draft before anything is written.
- **Files modified:** src/features/products/CategorySuggestionsTable.tsx
- **Verification:** tests "is dropped by «Aceptar», never applied over the category the user chose" and "creates no category when the 5,000-supplier limit refuses the assignment"
- **Committed in:** b5d0ccb

**3. [Scope] Reducers also exported as pure functions**
- The plan's interface block lists only `pruneCategoryRows` as a domain function and the rest as store actions. The other three reducers are pure functions in `suggestions.ts` (the module's pattern) and the store actions delegate to them.

**4. [Scope] RED stubs**
- The RED commit (`61ef210`) includes inert stub exports of the four reducers so the tests fail on their assertions instead of on missing imports; the GREEN commit replaces them.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical), 2 scope notes
**Impact on plan:** No scope creep; the second fix enforces the plan's own prohibition (never overwrite a category the user chose).

## Issues Encountered

None. The only lint output is the pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), out of scope.

## Items that need a decision

Per CLAUDE.md §1 these were not chosen silently where the plan or UI-SPEC is silent or contradictory; each is easy to change.

1. **Section heading wording.** The plan's truths say both «Sugerencias de categoría · {n}» and, for zero-one-many, that the heading reads «1 sugerencia» / «{n} sugerencias». UI-SPEC line 280 reads «Sugerencias de categoría · {n}» with «("1 sugerencia")». I kept the heading shipped in 04-18 and used by the product queue («Sugerencias de categoría · 1», «· 3»). If the owner wants «Sugerencias de categoría · 1 sugerencia», it is a one-line change in `categoryRowsHeading` (and its tests).
2. **«Mostrar {n} más» (50 rows at a time).** UI-SPEC lists 50 rows then «Mostrar {n} más» for E5 overflow, but this plan's truths and files do not include it; all pending rows render. A batch is at most 150 entries so the table can reach a few hundred rows. I assume it belongs to Plan 04-20 together with «Aceptar todas» and the search; confirm.
3. **Going back to «Nueva: {nombre}».** Once the user picks an existing category in a row whose choice was new, the «Nueva» item disappears (UI-SPEC: it is listed only when the row's choice is new) and the proposed name is not kept. To get it back the user rejects (Deshacer restores the row with its original choice) or accepts. Keeping the original proposal on the row would need a new stored field.
4. **Focus after «Rechazar».** The plan specifies focus movement only for «Aceptar». I applied the same rule to «Rechazar» (next row's Select, heading when last, tab heading when the section unmounts) so focus is not lost when the pressed button leaves the page, and I reused the existing `rejectedAnnouncement` ("Sugerencia rechazada. Quedan n sugerencias.") for the live region.
5. **Where the refusal text sits.** The UI-SPEC does not say where the limit message goes; it is rendered under the Select of the row and linked to «Aceptar» with `aria-describedby` (no `role="alert"`, like the product cards).
6. **Name of the buttons.** Row buttons reuse the product-card labels («Aceptar la sugerencia «{nombre}»», «Rechazar la sugerencia «{nombre}»») as UI-SPEC line 458 asks for rows. A product card and a category row with the very same name would have identical accessible names.
7. **Reserved «Sin categoría» (hand-off from 04-18).** Handled with the existing category-name validation: accepting a proposed «Sin categoría» shows «Sin categoría» es un nombre reservado. (the Categorías text) under the row and applies nothing. The row stays so the user can pick another category or reject it.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or trust boundary; T-04-38 is mitigated as planned: new names are trimmed and capped at 60 by `setCategoryChoice`, created only on accept through `addCategory` (reserved, duplicate, 200-limit rules), and rows whose target got a category are pruned, never applied.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-20 can add «Aceptar todas» on top of `planAccept` (it is local to the table file; export or move it to reuse it for the bulk apply) and the removal/restore actions of the store.
- The table, the prune effect and the store actions are in place; the quality of the real suggestions and the visual layout remain for the live check (Plan 04-21).

## Self-Check: PASSED

- Created files exist: `src/features/products/CategorySuggestionsTable.tsx`, `src/features/products/CategorySuggestionsTable.test.tsx`.
- Commits `61ef210`, `17991a5` and `b5d0ccb` are ancestors of HEAD; `git rev-list --count` from the plan base gives 3.
- `pnpm verify` (lint, typecheck, test, build) passes: 2736 tests passed, 75 skipped (live tests); lint shows only the pre-existing warning.
- Acceptance greps: `min-w-[760px]` 1, `Nueva: ` in messages.ts 2, `pruneCategor` in ProductsTab 3, no `dangerouslySetInnerHTML`.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-22*
