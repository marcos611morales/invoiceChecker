---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 18
subsystem: ui
tags: [zustand, react, filters, excel-export, gap-closure]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "Category filter, settings backup (Subir ajustes), Parametros sheet (plans 03-01..03-17)"
provides:
  - "effectiveSelection exported from view.ts as the single stale-id rule"
  - "pruneCategoryFilter session action, called by the replace-settings confirm handler"
  - "FilterBar and ExportButton reading the effective category selection"
affects: [03 verification, UAT G-03-7-WR01]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 0e80f16b8962f0847bbdc03c0b3f154a7ffd4dc9
plan_head_after: 8c4b045b3e7cdc728e59d8c3a2406f31642f0ce6

tech-stack:
  added: []
  patterns:
    - "One shared effectiveSelection rule for the store prune, the figures, the FilterBar and the export"

key-files:
  created: []
  modified:
    - src/domain/accounting/view.ts
    - src/stores/sessionStore.ts
    - src/stores/sessionStore.test.ts
    - src/features/categories/BackupControls.tsx
    - src/features/categories/BackupControls.test.tsx
    - src/features/dashboard/FilterBar.tsx
    - src/features/dashboard/FilterBar.test.tsx
    - src/features/export/ExportButton.tsx
    - src/features/export/ExportButton.test.tsx

key-decisions:
  - "Pruning is silent (no new UI copy), like the delete path T-03-38"
  - "FilterBar derives a Filters value with the effective category set and uses it for chip, count and reset; FilterTriggers gets selectedCategories as a prop"

patterns-established:
  - "Readers of the category filter use effectiveSelection (or view.selected), never the raw session set"

requirements-completed: [FILT-03, AJUS-02, XLS-01, XLS-02]

coverage:
  - id: D1
    description: "Confirming «Reemplazar mis ajustes» prunes the session category filter to existing ids plus Sin categoria; «Conservar los mios» changes nothing"
    requirement: AJUS-02
    verification:
      - kind: integration
        ref: "src/features/categories/BackupControls.test.tsx#WR-01: confirming the replace keeps only existing categories in the chip and in Parámetros"
        status: pass
      - kind: unit
        ref: "src/stores/sessionStore.test.ts#pruneCategoryFilter keeps only known ids and SIN_CATEGORIA, in a new Set (WR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "FilterBar chip, Categoria trigger, filter count and Quitar filtros never show a category id that does not exist"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "src/features/dashboard/FilterBar.test.tsx#WR-01"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Categorias row of Parametros lists the applied categories or Todas, never a raw id"
    requirement: XLS-02
    verification:
      - kind: unit
        ref: "src/features/export/ExportButton.test.tsx#WR-01"
        status: pass
      - kind: integration
        ref: "src/features/categories/BackupControls.test.tsx#WR-01 shell cases (writer receives Sin categoría, Otros / Todas)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Production-build walkthrough with the real XML (delete category, download, undo, filter, restore, check chip and Excel Parametros)"
    verification: []
    human_judgment: true
    rationale: "Plan's human-check: opening the exported file in Excel and the production build need a human"

duration: 12min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 18: Prune category filter on restore (WR-01) Summary

**Restoring a settings file now prunes stale ids from the session category filter, and FilterBar plus the Excel Parametros sheet read the same effectiveSelection rule as the figures, so a raw category id can no longer reach the chip or the file.**

## Performance

- **Duration:** about 12 min
- **Tasks:** 2 (1 tracer, 1 auto), both TDD
- **Files modified:** 9

## Accomplishments
- `effectiveSelection` is exported from `view.ts` and is the one rule behind `selectView`, the store prune, FilterBar and the export.
- New `pruneCategoryFilter(known)` store action: keeps SIN_CATEGORIA and known ids in a new Set, leaves the filters object untouched (same reference, no `set`) when nothing is dropped, and does not touch focus or reveal requests.
- `BackupControls` confirm handler calls it right after `replaceAll`; cancel path untouched.
- FilterBar chip, Categoria trigger, active-filter count and «Quitar filtros» use the effective selection; an unknown id is dropped by the first toggle.
- ExportButton builds `categoryLabels` from `view.selected`.

## Task Commits

1. **Task 1 (tracer): prune on restore** - `597cf86` (test, RED), `3d27f4e` (feat, GREEN)
2. **Task 2: effective selection in FilterBar and ExportButton** - `c0951c2` (test, RED), `8c4b045` (feat, GREEN)

**Plan metadata:** committed after this file (docs: complete plan)

## TDD Gate Compliance

- Task 1 RED: 5 tests failed on the planned assertions (`pruneCategoryFilter is not a function` x3, and the shell tests where the stale `seed:limpieza-higiene` id stayed selected). The «Conservar los míos» case passed, as expected (nothing changes today either). Semantic assessment: failures are the intended ones, not import or fixture errors.
- Task 2 RED: 4 tests failed where the raw id `borrada` was printed in the chip and in the Parametros row. Semantic assessment: intended assertions.
- GREEN: the full suite passes (1703 passed, 65 skipped, the skips pre-exist).
- No REFACTOR commit was needed.

## Files Created/Modified
- `src/domain/accounting/view.ts` - `effectiveSelection` exported, doc extended
- `src/stores/sessionStore.ts` - `pruneCategoryFilter` action
- `src/features/categories/BackupControls.tsx` - confirm handler prunes the filter
- `src/features/dashboard/FilterBar.tsx` - effective selection for chip, trigger, count, reset
- `src/features/export/ExportButton.tsx` - `categoryLabels` from `view.selected`
- Four test files extended with WR-01 cases (store, shell/BackupControls, FilterBar, ExportButton)

## Decisions Made
None beyond the plan: pruning is silent and adds no UI copy (plan note for the executor).

## Deviations from Plan

None - plan executed exactly as written.

Environment note (not a deviation): the worktree had no `node_modules`, so a symlink to the main checkout's `node_modules` was created (gitignored, not committed) and the tools were run through `node_modules/.bin` instead of `pnpm exec`, because `pnpm` tried to re-run an install and aborted. `pnpm tsc --noEmit` reports one error, `src/app/layout.tsx(24,50): Cannot find name 'LayoutProps'`, which comes from Next's generated types under `.next/types` that exist only in the main checkout; it is in a file this plan does not touch. `eslint .` reports 0 errors and the pre-existing unused-directive warning in `src/lib/client/navigation.ts`.

## Issues Encountered
None in the code. The `LayoutProps` type error above is an artifact of the worktree.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- G-03-7-WR01 is closed in code and tests. The human check from Task 2 (production build with the real XML, open «Parámetros» in Excel) remains for UAT.

## Self-Check: PASSED
- Commits 597cf86, 3d27f4e, c0951c2, 8c4b045 exist on the branch.
- Acceptance greps match the plan (effectiveSelection exported once, pruneCategoryFilter wired, no `filters.categories` read left in ExportButton or FilterBar).

---
*Phase: 03-categor-as-propias-y-exportaci-n-a-excel*
*Completed: 2026-10-18*
