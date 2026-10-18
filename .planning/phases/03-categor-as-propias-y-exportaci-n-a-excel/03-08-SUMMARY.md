---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 08
subsystem: dashboard-category-filter
status: complete
tags: [category-filter, selectView, big.js, zustand, cmdk, tdd]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "splitEntry / EntryPart / categoryBreakdown (03-01), useCategorySettings and Resolver (03-02, 03-04), MultiSelectFilter and the filter bar (Phase 2)"
provides:
  - "Filters.categories (session, not persisted) and exported compareOptions"
  - "scopeToCategories: any-part membership rule (D-27) with exact partial amounts and the full amounts kept apart"
  - "categoryOptions: every category plus Sin categoria with D-28 counts"
  - "selectView / ViewInput / DashboardView: one pure function for every Dashboard figure"
  - "useDashboardView: hook shared by the Dashboard and the future Excel export button (FILT-05)"
  - "Categoria trigger, chip, popover footer and caption in the Dashboard"
affects: [03-09, 03-12, 03-13, 03-14, 03-15]

actuals:
  tokens: 19000
  tasks: 2
  commits: 4
plan_head_before: 113f9cab7e44b2f55c38246d8754b67714918a0a
plan_head_after: 90eb456f1713ee2e814a90e53cfc1161b599db60

tech-stack:
  added: []
  patterns:
    - "Category scoping is a separate stage after applyFilters; the existing applyFilters contract is untouched"
    - "A scoped entry carries partial conIva/sinIva so every existing selector (kpis, monthlySeries, supplierRanking, totalSpend) works unchanged"
    - "One pure selectView memoized in one hook; components never call selectors directly"

key-files:
  created:
    - src/domain/accounting/view.ts
    - src/domain/accounting/view.test.ts
    - src/features/dashboard/useDashboardView.ts
  modified:
    - src/domain/accounting/filters.ts
    - src/domain/accounting/filters.test.ts
    - src/domain/accounting/categories.ts
    - src/domain/accounting/categories.test.ts
    - src/stores/sessionStore.ts
    - src/stores/sessionStore.test.ts
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/features/dashboard/FilterBar.tsx
    - src/features/dashboard/FilterBar.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts

key-decisions:
  - "An entry whose every part is kept keeps its original conIva/sinIva object untouched, so selecting every category (plus Sin categoria) is exactly the unfiltered figure even if an entry's parts do not add to its amount"
  - "ScopedEntry.parts holds the kept parts (all parts for an empty selection); categoryBreakdown reads them and never re-splits"
  - "selectView restricts the selection to known category ids plus SIN_CATEGORIA; a stale-only selection behaves as no filter (T-03-20)"
  - "The category caption keys off view.selected (effective selection), so it is shown exactly when the figures are partial"

patterns-established:
  - "Dashboard figures = selectView(useDashboardView()); the Excel export reads the same result"

requirements-completed: [FILT-03]

coverage:
  - id: D1
    description: "Categoria trigger between Proveedor and Forma de pago (320 px popover, search «Buscar categoria», footer «Limpiar categorias», no-match text), options «{nombre} ({n})» sorted by count then name with (0) categories and Sin categoria always present, counts ignoring the other filters"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "src/features/dashboard/FilterBar.test.tsx#FilterBar category filter (FILT-03, D-15, D-28)"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/categories.test.ts#categoryOptions (D-15, D-28)"
        status: pass
    human_judgment: false
  - id: D2
    description: "With the filter active, Gasto total, trend and supplier ranking add only the chosen parts (lines plus the rounding difference), Facturas counts invoices with any part and Ticket is partial spend over that count; selecting every category equals the unfiltered figures"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "src/domain/accounting/categories.test.ts#scopeToCategories (D-14, D-27)"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/view.test.ts#selectView with a category filter (D-14, D-27)"
        status: pass
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#Dashboard tab: category filter (FILT-03, D-14, D-15, D-27, UI-SPEC Q3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Chip «Categoria: n1, n2 +k» with «Quitar filtro Categoria», caption under the mode caption only while active, fold count «Filtros · n», cleared by Quitar filtros and the chip, kept by the previous-period comparison, «Gasto por categoria» limited to the chosen categories"
    requirement: FILT-03
    verification:
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#Dashboard tab: category filter (FILT-03, D-14, D-15, D-27, UI-SPEC Q3)"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/view.test.ts#keeps the category filter in the previous period of the KPI deltas"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every Dashboard figure comes from one selectView through useDashboardView (shared with the future export)"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "src/domain/accounting/view.test.ts#reproduces the figures the Dashboard computed before, in both modes"
        status: pass
    human_judgment: false

duration: 45 min
completed: 2026-10-17
---

# Phase 3 Plan 08: Category filter and shared Dashboard view Summary

**«Categoria» filter for the Dashboard with exact any-part scoping (concept lines plus the D-13 rounding difference), D-28 option counts, and a single pure `selectView` behind `useDashboardView` that the Excel export will also read.**

## Accomplishments

- `Filters.categories` (in memory, never persisted) is carried by `previousFilters`, checked by `isDefaultFilters` and emptied by `clearFilters`/`clearAll`; `compareOptions` is now exported.
- `scopeToCategories` keeps only the selected parts of each entry, drops entries with none, and rebuilds `conIva`/`sinIva` as the exact big.js sum of the kept parts; the full amounts stay in `fullConIva`/`fullSinIva`. Non-summing rows (Pago, $0, Excluida, Sustituida, invalid) stay or go by the categories of their lines.
- `categoryOptions` lists every settings category plus «Sin categoria» with the number of loaded invoices that have any part in it, ignoring every other filter, sorted by count, name, key.
- `categoryBreakdown` now takes scoped entries and reads their parts; its share is relative to the filtered total.
- `selectView` produces span, range, effective selection, scoped visible set, KPIs, previous-period deltas (same selection), trend, supplier ranking and category rows. Stale ids are ignored (T-03-20).
- `useDashboardView` memoizes it; `DashboardTab` no longer calls any selector itself.
- UI: «Categoria» trigger (320 px) between Proveedor and Forma de pago, chip with two names then «+k», caption under the mode caption only while the filter is active, fold count.

## Task Commits

1. Task 1 RED: `d841ee4` test(03-08) failing tests for scoping, options and selectView
2. Task 1 GREEN: `d923cd1` feat(03-08) scope the ledger to a category selection and add selectView
3. Task 2 RED: `5773132` test(03-08) failing tests for the Categoria filter, chip, caption and session action
4. Task 2 GREEN: `90eb456` feat(03-08) Categoria filter, chip and caption on a shared useDashboardView

## TDD Gate Compliance

RED commits precede GREEN commits for both tasks. RED evidence (semantic assessment): Task 1 RED failed on the planned assertions (`categoryOptions is not a function`, `Cannot find module './view'`, `EMPTY_FILTERS.categories` undefined, previousFilters/isDefaultFilters ignoring categories); Task 2 RED failed with 23 tests on the planned behavior (`setCategories` not a function, no Categoria trigger, no caption) while the 135 pre-existing tests in those files kept passing. The `gsd_run check tdd-red-evidence` classifier was not run (no JUnit/TAP report was captured); the evidence above is from the vitest console output.

## Verification

- `pnpm verify` (eslint, `next typegen && tsc --noEmit`, vitest, `next build`): passed. 54 test files passed, 1335 tests passed, 8 skipped (pre-existing skips).
- `pnpm tsc --noEmit`: 0 errors. `pnpm eslint .`: 0 errors, 1 pre-existing warning (see Deferred Issues).
- Task 1 acceptance greps (`categories: ReadonlySet<string>`, `compareOptions`, `scopeToCategories`, `categoryOptions`, `selectView`): each prints 1; the «every category» identity cases are listed and pass.
- Task 2 acceptance greps: `useDashboardView` in DashboardTab 3, selector calls 0, `setCategories` in FilterBar 4, `category-caption` 1, «Limpiar categorias» 1, `noCategoryMatch` 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DashboardTab adapted to the new categoryBreakdown signature in Task 1**
- **Found during:** Task 1 (`pnpm typecheck` is part of Task 1 verify)
- **Issue:** Changing `categoryBreakdown` broke the only caller, DashboardTab, before Task 2 moves it to `selectView`.
- **Fix:** Minimal interim call `categoryBreakdown(scopeToCategories(visible, new Set(), resolver), ...)`, replaced entirely by `useDashboardView` in Task 2.
- **Files modified:** src/features/dashboard/DashboardTab.tsx
- **Commit:** d923cd1

**2. [Rule 1 - Test fixture] Real seed name of the Servicios category**
- **Found during:** Task 1 GREEN
- **Issue:** The new categoryOptions test expected the label «Servicios»; the seeded category is «Servicios (luz, agua, internet, teléfono)».
- **Fix:** Test expectation corrected (no production change).
- **Commit:** d923cd1

**Total deviations:** 2 auto-fixed. **Impact:** none on scope or behavior.

## Decisions Needing Attention (not blocking)

- **InvoiceTable receives scoped rows now.** The plan says `InvoiceTable rows = view.visible`. With a category filter active the table therefore already lists only invoices with a part in the selection and reads the partial amount from `conIva`/`sinIva`, but it does not yet show «de {total} total» or dim other categories' lines. That presentation is Plan 03-09 per the plan and UI-SPEC; `fullConIva`/`fullSinIva` are already available on each row for it.
- **Stale ids in the chip.** `selectView` ignores stale category ids, so the caption and the figures treat a stale-only selection as no filter, but the chip (built from `filters.categories` in the FilterBar) would still show the stale key. Removing a deleted category from the selection belongs to the delete-category work in Plan 03-09, which this plan's objective names explicitly.
- **Entries with no parts.** An entry with no concept and a zero amount has no part and is dropped by any non-empty category selection. A counted entry always has a nonzero amount (a zero total does not sum) and so always has a part; valid CFDI 4.0 requires at least one Concepto. No behavior change was needed.

## Deferred Issues

- `src/lib/client/navigation.ts:6`: ESLint warning "Unused eslint-disable directive" (pre-existing, outside this plan's files).

## Known Stubs

None.

## Threat Flags

None. The category selection is in-memory UI state; no new endpoint, storage or trust boundary.

## Self-Check: PASSED

- Files exist: view.ts, view.test.ts, useDashboardView.ts, and the 12 modified files.
- Commits exist in this branch: d841ee4, d923cd1, 5773132, 90eb456.
