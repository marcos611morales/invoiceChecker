---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 09
subsystem: invoices-category-filter
status: complete
tags: [category-filter, invoice-table, zustand, big.js, tdd]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "ScopedEntry / scopeToCategories / selectView / useDashboardView and setCategories (03-08), DeleteCategoryDialog (03-03), ConceptCategorySelect (03-04, 03-05)"
provides:
  - "sessionStore.dropCategoryFromFilter: a deleted category leaves the session filter"
  - "InvoiceRow.fullAmount and withFullAmounts(): whole-invoice amount of a category-scoped row"
  - "InvoiceTable prop categoryFilter: partial amount with «de {total} total», extra note sentence, dimmed lines of other categories"
  - "Copy: es.invoices.categoryNote, es.invoices.notInCategoryFilter, partOfTotalText"
affects: [03-12, 03-13, 03-14, 03-15]

actuals:
  tokens: 21000
  tasks: 2
  commits: 4
plan_head_before: 53b5d7b4d73ace5b00b1635f82de8f0335a6991b
plan_head_after: c0c7338fe18beed74beba0058bbdc6c19c165d68

tech-stack:
  added: []
  patterns:
    - "A row built from a ScopedEntry keeps its partial amount in amount and the whole invoice in fullAmount; anything that explains the invoice itself reads withFullAmounts(entry)"
    - "Dimming uses the text-muted-foreground token plus an sr-only label, never opacity"

key-files:
  created: []
  modified:
    - src/stores/sessionStore.ts
    - src/stores/sessionStore.test.ts
    - src/features/categories/DeleteCategoryDialog.tsx
    - src/features/categories/CategoryList.test.tsx
    - src/features/invoices/columns.ts
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/features/dashboard/DashboardTab.tsx
    - src/domain/accounting/categories.ts
    - src/domain/accounting/categories.test.ts
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "The extra note sentence is appended to the same Alert as a separate span after the fixed note, so the fixed note text never changes"
  - "A row is «tall» (h-14) whenever the second amount line shows, like credit notes and foreign-currency rows"
  - "Deleting a category drops it from the filter on confirm; Deshacer restores the category but not the filter selection (the filter is session-only UI state)"

patterns-established:
  - "InvoiceTable receives view.selected (the effective selection) as categoryFilter; it never reads filters.categories directly"

requirements-completed: [FILT-03]

coverage:
  - id: D1
    description: "Under the category filter each Monto cell shows the part of the chosen categories and, in 12px muted text, «de {total} total»; the heading counts the kept invoices; Monto sorts by the partial amount; Pago and other non-summing rows stay when a line is selected; without the filter the table is unchanged"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable under the category filter (FILT-03, D-14, D-27, E7 partial)"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#invoice table texts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The table note adds the category sentence only while the filter is active (T-03-37)"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#adds the extra sentence to the table note only while the filter is active (T-03-37)"
        status: pass
    human_judgment: false
  - id: D3
    description: "E7 partial: lines of other categories are muted with the sr-only «No cuenta en el filtro de categoría», their Select stays operable, and the rounding-difference line uses the full invoice amount"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#dims the lines of other categories with the muted token and a screen-reader label, not opacity"
        status: pass
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#keeps the category Select of a dimmed line operable (UI-SPEC Q6)"
        status: pass
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#computes «Diferencia de redondeo» from the full invoice amount, with or without the filter"
        status: pass
    human_judgment: false
  - id: D4
    description: "The category filter is cleared by Quitar filtros/Quitar todas and logout (clearAll), never written to browser storage, and drops a category the user deletes"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "src/stores/sessionStore.test.ts#dropCategoryFromFilter and the storage assertion"
        status: pass
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#takes a deleted category out of the category filter and keeps the others (T-03-38)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Selecting every category plus «Sin categoría» gives the amounts of no filter in the table"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#selecting every category plus «Sin categoría» gives the amounts of no filter (D-27)"
        status: pass
    human_judgment: false

duration: 55 min
completed: 2026-10-17
---

# Phase 3 Plan 09: Category filter in the Facturas table Summary

**The Facturas table follows the Dashboard category filter: each Monto cell shows the part of the chosen categories with «de {total} total» below it, other categories' lines are muted with a screen-reader label, the note explains it, and a deleted category leaves the filter.**

## Performance

- **Duration:** 55 min
- **Tasks:** 2 (TDD, 4 commits)
- **Files modified:** 13

## Accomplishments

- `sessionStore.dropCategoryFromFilter(id)` replaces the set without the id and changes nothing when the id is absent; `DeleteCategoryDialog` calls it on confirm, so no stale chip stays (T-03-38). A test proves the selection never reaches browser storage (only `invoicechecker:settings` is written).
- `InvoiceRow.fullAmount` (from `fullConIva`/`fullSinIva` of a `ScopedEntry`) and `withFullAmounts(entry)`; the concept panel computes «Diferencia de redondeo» from the full invoice amount, so it is identical with or without the filter.
- `InvoiceTable` takes `rows: readonly ScopedEntry[]` and `categoryFilter: ReadonlySet<string>` (DashboardTab passes `view.selected`). Under the filter: second 12px muted line «de $X total» (T-03-37), the extra note sentence, muted-foreground dimming plus `sr-only` «No cuenta en el filtro de categoría» for lines outside the selection, Select still enabled. Sorting by Monto uses the partial amount; the heading counts the scoped rows.
- Copy: `es.invoices.categoryNote`, `es.invoices.notInCategoryFilter`, `partOfTotalText`, plus the missing `noCategoryMatch` test.

## Task Commits

1. Task 1 RED: `118f4d3` test(03-09) failing tests for dropping a deleted category from the filter
2. Task 1 GREEN: `f740f13` feat(03-09) drop a deleted category from the session category filter
3. Task 2 RED: `9bb195e` test(03-09) failing tests for the Facturas table under the category filter
4. Task 2 GREEN: `c0c7338` feat(03-09) show category-partial amounts, dimmed lines and the note in the Facturas table

## TDD Gate Compliance

RED commits precede GREEN commits for both tasks. RED evidence (semantic assessment, from the vitest console output; `gsd_run check tdd-red-evidence` was not run because no TAP/JUnit report was captured): Task 1 RED failed 5 target tests with `dropCategoryFromFilter is not a function` and the delete-dialog assertions still holding the deleted id, while the dismiss guard and the `noCategoryMatch` test passed (the copy already existed). Task 2 RED failed 13 tests: `partOfTotalText is not a function`, missing copy keys, `['$100.00']` instead of `['$100.00', 'de $150.00 total']`, missing note sentence, missing `text-muted-foreground` on the dimmed row, and the scopeToCategories line-less case.

## Verification

- `pnpm exec vitest run --maxWorkers=3 --testTimeout=30000`: 54 test files passed, 1356 tests passed, 8 skipped (pre-existing skips).
- `pnpm typecheck` (`next typegen && tsc --noEmit`): 0 errors. `pnpm lint`: 0 errors, 1 pre-existing warning. `pnpm build`: passes.
- Acceptance greps: `dropCategoryFromFilter` in DeleteCategoryDialog 1 and in sessionStore 2; `noCategoryMatch` in messages.test.ts 2; `categoryFilter` in InvoiceTable 7 and in DashboardTab 1; «No cuenta en el filtro de categoría» in es.ts 1; `opacity-[0-9]` in InvoiceTable.tsx no match.
- Note: a plain `pnpm verify` run on this loaded machine (several worktree agents in parallel) hit vitest's 5 s default timeout and a worker start timeout in unrelated files (DashboardTab.test.tsx, columns.test.ts) after 952 s. The same suite passes in full with `--maxWorkers=3 --testTimeout=30000` (17.9 s), then `pnpm build` passes. No code was changed between the two runs; this is load, not a regression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] scopeToCategories dropped line-less entries even with no category selection**
- **Found during:** Task 2 (existing InvoiceTable tests failed once the Harness fed the table through `scopeToCategories` like the Dashboard does)
- **Issue:** `if (kept.length === 0) continue;` ran for an empty selection too, so an entry with no concept and no amount (a Pago or $0 invoice with no lines) disappeared from the Dashboard table with no filter, contradicting the function's own contract («with an empty selection every entry is kept») and the plan's «without the filter the table is unchanged». Real CFDI 4.0 requires at least one Concepto, so this mostly bites invalid or fixture data, but it was a real regression from Plan 03-08.
- **Fix:** `if (selected.size > 0 && kept.length === 0) continue;`, with a unit test (empty selection keeps it, a non-empty selection drops it).
- **Files modified:** src/domain/accounting/categories.ts, src/domain/accounting/categories.test.ts (neither listed in the plan's `files_modified`)
- **Commits:** 9bb195e (test), c0c7338 (fix)

**2. [Rule 3 - Blocking] InvoiceTable test Harness feeds scoped rows**
- **Found during:** Task 2
- **Issue:** `InvoiceTable.rows` is now `readonly ScopedEntry[]` plus the required `categoryFilter` prop, so the existing test Harness and the two direct renders had to scope their entries and pass the prop.
- **Fix:** Harness gained an optional `categories` prop and scopes with `scopeToCategories`; direct renders use a `scoped()` helper. No assertion of existing tests changed.
- **Commit:** 9bb195e

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). **Impact:** none on scope; the bug fix makes the unfiltered table match the plan.

## Decisions Needing Attention (not blocking)

- **Undo does not restore the filter selection.** Deleting a category removes it from the filter on confirm; «Deshacer» restores the category but the user must reselect it. The filter is session-only UI state and the plan only asked for the drop.
- **«de {total} total» also shows when the selection covers a whole invoice** (the part equals the total, e.g. «$150.00» over «de $150.00 total»). The plan says to show it for every row while the filter is active and it keeps the column consistent; flagging it in case a cleaner rule is preferred.
- **Pre-existing doc text:** the `DeleteCategoryDialog` header comment still says an overlay click dismisses; the 2026-10-17 user decision is Esc and the dismiss button only. The code (Base UI behavior) already matches the decision; only the comment is stale. Left untouched as out of scope.

## Deferred Issues

- `src/lib/client/navigation.ts:6`: ESLint warning «Unused eslint-disable directive» (pre-existing, outside this plan's files).

## Known Stubs

None.

## Threat Flags

None. The category selection stays in memory; no new endpoint, storage or trust boundary. T-03-37 and T-03-38 are mitigated and covered by tests.

## Self-Check: PASSED

- Files exist: all 13 modified files, and this SUMMARY.
- Commits exist in this branch: 118f4d3, f740f13, 9bb195e, c0c7338.
