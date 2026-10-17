---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 02
subsystem: categories-ui
tags: [zustand, base-ui-select, tabs, categories, reducer, tdd]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "Plan 03-01: settings v2 store, resolver, categoryBreakdown, Gasto por categoría block"
provides:
  - "setSupplierCategory reducer (SupplierResult) with the D-30 limit and the unknown-category refusal"
  - "orderedCategories: Spanish order with the seed Otros last by stable id"
  - "Store action setSupplierCategory applying only ok results in one set call"
  - "useCategorySettings / makeNameOf shared by the Dashboard and the Categorías tab"
  - "Categorías tab (second tab) with the Categoría por proveedor table and per-row Select"
  - "Four-tab shell with horizontal scroll below 640 px and scrollIntoView of the active trigger"
affects: [03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10, 03-11, 03-12, 03-13]

actuals:
  tokens: 21000
  tasks: 2
  commits: 3
plan_head_before: c629ca98e3dcd21f04e4a66b8a81ef3f1343a89b
plan_head_after: 07ed52a07d466182b6d4ebc7a5d574235577f4b4

tech-stack:
  added: []
  patterns:
    - "Pure settings reducers returning a result union; the store applies only ok results in a single set"
    - "One shared hook (useCategorySettings) memoizing settings, resolver and nameOf on the four primitive store selectors"
    - "Base UI Select driven by an items list, with a wrapping span inside SelectItem to override the shared nowrap item text"

key-files:
  created:
    - src/domain/settings/assignments.ts
    - src/domain/settings/categories.ts
    - src/domain/settings/settings.test.ts
    - src/features/categories/useCategorySettings.ts
    - src/features/categories/CategoriesTab.tsx
    - src/features/categories/SupplierCategoryTable.tsx
    - src/features/categories/CategoriesTab.test.tsx
  modified:
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/stores/sessionStore.ts
    - src/features/shell/AppShell.tsx
    - src/features/shell/AppShell.test.tsx
    - src/features/shell/guards.test.tsx
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts

key-decisions:
  - "setSupplierCategory with null always succeeds (removing an rfc that has no assignment is a no-op); the limit only blocks appending a new rfc, so an existing assignment can still be changed or removed in a full list."
  - "The row Select is controlled by resolver.supplierCategory(rfc), so a refused change (limit) leaves the control on the stored value; no toast, which belongs to Plan 03-06."
  - "Plan 03-02 renders the supplier table as a plain shadcn Table with the fixed default sort (Facturas desc, then name in Spanish); TanStack sorting, pagination, saved-only suppliers and Quitar asignación stay in Plan 03-06 as planned."

patterns-established:
  - "Tests that mount AppShell must import tests/support/domPolyfills (jsdom has no scrollIntoView)"

requirements-completed: [CAT-02]

coverage:
  - id: D1
    description: "Choosing a category in a supplier row of the Categorías tab shows that supplier's net spend under that category in Gasto por categoría and every unassigned supplier under Sin categoría, rows adding up to Gasto total"
    requirement: "CAT-02"
    verification:
      - kind: integration
        ref: "src/features/categories/CategoriesTab.test.tsx#shows the chosen category in the Dashboard block, adding up to Gasto total"
        status: pass
    human_judgment: false
  - id: D2
    description: "The choice is stored at once as version 2 (the four settings fields), survives a reload, and Sin categoría removes the assignment"
    requirement: "CAT-02"
    verification:
      - kind: integration
        ref: "src/features/categories/CategoriesTab.test.tsx#stores version 2 with the defaults plus that one assignment and restores it after a reload"
        status: pass
      - kind: integration
        ref: "src/features/categories/CategoriesTab.test.tsx#removes the assignment when Sin categoría is chosen"
        status: pass
    human_judgment: false
  - id: D3
    description: "The reducer refuses unknown-category and a 5,001st assignment, never mutates its input, and the store applies only ok results; assignments survive a category rename (stable ids)"
    requirement: "CAT-02"
    verification:
      - kind: unit
        ref: "src/domain/settings/settings.test.ts#setSupplierCategory"
        status: pass
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore setSupplierCategory (CAT-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Loaded screen has four tabs in the order Dashboard, Categorías, Calidad de datos, Importación; the empty screen has none; the active trigger is scrolled into view on every tab change"
    verification:
      - kind: integration
        ref: "src/features/shell/AppShell.test.tsx#lists Dashboard, Categorías, Calidad de datos and Importación in that order"
        status: pass
      - kind: integration
        ref: "src/features/shell/AppShell.test.tsx#scrolls the newly active trigger into view when the tab changes"
        status: pass
    human_judgment: false
  - id: D5
    description: "Below 640 px the tab list scrolls horizontally inside its container with a hidden scrollbar, and the Select trigger grows to a 44 px full-width control"
    verification:
      - kind: integration
        ref: "src/features/shell/AppShell.test.tsx#keeps the list on one line, scrolling horizontally below 640 px (UI-SPEC Q2)"
        status: pass
    human_judgment: true
    rationale: "Class names are asserted in jsdom; the real horizontal scrolling at 312 px, the hidden scrollbar and the wrapping Select item text need a human look in a real browser"

duration: 22min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 02: Categorías tab with supplier default category Summary

**A new Categorías tab where each loaded supplier gets a default-category Select backed by a pure, limit-aware reducer and the persisted v2 store, feeding the Dashboard's «Gasto por categoría» block through one shared settings hook, inside a four-tab shell that scrolls horizontally on small screens**

## Performance

- **Duration:** about 22 min
- **Tasks:** 2 of 2
- **Files:** 7 created, 10 modified
- **Commits:** 3 production commits

## Accomplishments

- Task 1 (TDD): `setSupplierCategory` reducer (append, refresh name and category, remove with null, `unknown-category`, `limit` at 5,000, frozen-input test), `orderedCategories` (Spanish collator, seed «Otros» last by id even when renamed «Aaa»), and the store action that applies only an ok result in one `set` so persist writes once and a refused result writes nothing. RED was a stub that returned neutral values, so all 11 target tests failed on their assertions before GREEN.
- Task 2: `AppTab` gains `"categorias"`; shell TABS are Dashboard, Categorías, Calidad de datos, Importación; the tab list gets `max-sm:overflow-x-auto` with a hidden scrollbar and an effect that calls `scrollIntoView({ inline: "nearest", block: "nearest" })` on the active trigger when the tab changes; `useCategorySettings` and `makeNameOf` replace the three memos in `DashboardTab.tsx`; `CategoriesTab` and `SupplierCategoryTable` (Proveedor with `TruncatedText`, RFC mono, Facturas right-aligned, Select with `Categoría por defecto de {proveedor}`, trigger `w-[296px]`, full width and 44 px below 640 px, items wrap, «Sin categoría» muted and first); new copy keys and `supplierCategoryAria`.
- End-to-end test: choosing «Limpieza e higiene» for the first supplier and opening Dashboard shows `$174.01` under that category and `$116.00` under «Sin categoría»; the rows add up to `kpi-gasto` with cents computed independently (including the one-cent gap and the Sin IVA path through a stored Phase 2 contract). The stored value is `version: 2` with the defaults plus that one assignment, and rehydrating it brings the Select back to the same category.

## Task Commits

1. **Task 1 RED:** `b51bf98` (test) - failing tests with neutral stubs
2. **Task 1 GREEN:** `41b283d` (feat) - reducer, ordering, store action
3. **Task 2:** `07ed52a` (feat) - Categorías tab, shell, shared hook, copy, tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom has no `scrollIntoView`, so every test that mounts `AppShell` without the polyfill crashed**
- **Found during:** Task 2 (full test run after adding the scroll effect)
- **Issue:** `src/features/shell/guards.test.tsx` rendered `AppShell` without `tests/support/domPolyfills`, so the new effect threw `scrollIntoView is not a function`.
- **Fix:** imported `tests/support/domPolyfills` in `guards.test.tsx` (the project convention for jsdom tests, as the polyfill's own header says). No production code guard was added, since every real browser has the method.
- **Files modified:** `src/features/shell/guards.test.tsx`

**2. [Rule 1 - Bug] Existing Dashboard test asserted the three-tab order**
- **Found during:** Task 2
- **Issue:** `DashboardTab.test.tsx` "lists Dashboard, Calidad de datos ... and Importación" expected three tabs.
- **Fix:** updated the expected names to the four-tab order (a consequence of D-01/Q2, not new behavior).
- **Files modified:** `src/features/dashboard/DashboardTab.test.tsx`

**3. [Plan file list] Store action tests added to `src/stores/settingsStore.test.ts`**
- The plan lists `settings.test.ts` for the reducer tests and does not list the store test file; the four store-action cases (ok result persists once, null removes, refused result writes nothing, 5,001st refused) were added to the existing store test file because they need the persisted store. The plan's verify command already runs `src/stores`.

---

**Total deviations:** 3 (1 blocking test-environment fix, 1 test expectation update, 1 file-list addition)
**Impact on plan:** None on behavior or scope.

## Issues Encountered

- Mid-run the Base UI tab panels exposed duplicate `columnheader` names when queried at screen level in the Categorías test; the query was scoped to the «Categoría por proveedor» region instead. No production change.
- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), untouched by this plan and out of scope.

## Verification

- `pnpm verify`: lint (0 errors, 1 pre-existing warning), `next typegen && tsc --noEmit` clean, `vitest run` 970 passed / 8 skipped (3 files skipped), `next build` succeeded.
- Task 1 and Task 2 acceptance criteria re-run: `setSupplierCategory` and `orderedCategories` exports 1 each; store contains the action; settings tests list «limit», «unknown-category» and the renamed «Otros» cases; `"categorias"` x2, `CategoriesTab` x2, `max-sm:overflow-x-auto` x1, `scrollIntoView` x1 in AppShell.tsx; `useCategorySettings` x2 in DashboardTab.tsx; `setSupplierCategory` x2 in SupplierCategoryTable.tsx; first line of CategoriesTab.test.tsx is `// @vitest-environment jsdom`; no raw-HTML injection in `src/features`.
- CLAUDE.md rules: no `any`, `@ts-ignore`, non-null `!` or unverified `as` in the new code or tests (only `as const` literals in the test batch helper, as elsewhere in the repo).

## Known Stubs

None. The supplier table intentionally omits sorting, pagination, saved-only suppliers («Sin facturas cargadas», «Quitar asignación») and the 5,000-assignment toast; these are Plan 03-06 per the plan text and are not stubs of this plan's goal.

## Threat Flags

None beyond the plan's threat model. T-03-33 (supplier and category names rendered as React text only, covered by a hostile-name test and the raw-HTML grep) and T-03-34 (`setSupplierCategory` refuses `limit` and `unknown-category`, store applies only ok results, covered in `settings.test.ts` and `settingsStore.test.ts`) are mitigated.

## Next Phase Readiness

Ready for the next wave plans. The Categorías tab composition leaves room above the supplier section for the «Mis categorías» card and the backup buttons; `useCategorySettings` and `orderedCategories` are available for the delete-dialog Select and the concept-rule editors.

## Self-Check: PASSED

- Created files present on disk: assignments.ts, categories.ts, settings.test.ts, useCategorySettings.ts, CategoriesTab.tsx, SupplierCategoryTable.tsx, CategoriesTab.test.tsx.
- Commits `b51bf98`, `41b283d` and `07ed52a` are ancestors of HEAD.
