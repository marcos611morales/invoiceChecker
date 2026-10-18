---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 12
subsystem: export
tags: [excel, big.js, cell-model, utc-dates, vitest]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "selectView / DashboardView (03-08), useDashboardView (03-10)"
  - phase: 02
    provides: "toMoneyString, parseDecimal, monthYearLabel, monthsInRange"
provides:
  - "Library-independent cell and sheet model (XCell, SheetModel) with exact decimal strings and UTC dates"
  - "monthlyCounts: counted Ingreso per calendar month, zero-filled, aligned with monthlySeries"
  - "buildResumenMes sheet model, WorkbookContext, buildWorkbook, amountHeader"
  - "exportFileName (D-19, A-3)"
  - "es.export copy block"
affects: [03-13, 03-14, 03-15]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 28141d2e1b364c1e5ef785ed419f166cf093a86d
plan_head_after: f6efcf37ec52fb61ef2956ae50525e585315698c

tech-stack:
  added: []
  patterns:
    - "Sheet builders are pure (view, ctx) => SheetModel over the same DashboardView the Dashboard renders; a thin writer (03-13) maps models to the library"
    - "Number cells carry exact big.js decimal strings; dates are built only with Date.UTC from the literal Fecha"
    - "Test view built with the real selectView over makeEntry ledgers (tests/support/exportFactory.ts)"

key-files:
  created:
    - src/features/export/cellModel.ts
    - src/features/export/cellModel.test.ts
    - src/features/export/sheets/resumenMes.ts
    - src/features/export/sheets/resumenMes.test.ts
    - src/features/export/workbook.ts
    - src/features/export/workbook.test.ts
    - src/features/export/fileName.ts
    - tests/support/exportFactory.ts
  modified:
    - src/domain/accounting/aggregate.ts
    - src/domain/accounting/aggregate.test.ts
    - src/lib/copy/es.ts

key-decisions:
  - "quantityCell keeps a non-decimal quantity as a text cell (and blank as an empty cell) instead of dropping it or throwing"
  - "Unit price and percent cells hold the value rounded to 6 decimals without trailing zeros; rate cells always 4 decimals; zero never prints as -0"
  - "Test helper lives in tests/support/exportFactory.ts (not src) so production code never imports it"

patterns-established:
  - "Constructors in the cell model never throw: unusable input becomes an empty or text cell"

requirements-completed: [XLS-01, XLS-02, XLS-03]

coverage:
  - id: D1
    description: "Cell model with exact decimal strings and calendar-correct UTC dates (three time zones)"
    requirement: XLS-03
    verification:
      - kind: unit
        ref: "src/features/export/cellModel.test.ts (also run with TZ=Asia/Tokyo and TZ=America/Mexico_City)"
        status: pass
    human_judgment: false
  - id: D2
    description: "monthlyCounts follows the Facturas KPI definition"
    requirement: XLS-02
    verification:
      - kind: unit
        ref: "src/domain/accounting/aggregate.test.ts#monthlyCounts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Resumen por mes sheet model whose Total row equals the Dashboard Gasto total and Facturas KPI"
    requirement: XLS-02
    verification:
      - kind: unit
        ref: "src/features/export/sheets/resumenMes.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Workbook order and D-19 export file name"
    requirement: XLS-01
    verification:
      - kind: unit
        ref: "src/features/export/workbook.test.ts"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 12: Workbook model and Resumen por mes Summary

**Library-independent Excel workbook model: exact-decimal-string cells, Date.UTC-only dates, the "Resumen por mes" sheet read from the Dashboard's own view, and the D-19 file name.**

## Performance

- **Duration:** 9 min
- **Tasks:** 2 (both TDD)
- **Files:** 8 created, 3 modified

## Accomplishments

- `cellModel.ts`: `XCell`/`SheetModel` and constructors (`moneyCell`, `unitPriceCell`, `quantityCell`, `rateCell`, `percentCell`, `countCell`, `dateCell`, `textCell`, `emptyCell`, `excelDateOfFecha`). No cell holds a JS float; dates come only from `Date.UTC` of the literal Fecha, null for unusable Fecha, impossible days (30 feb) and years before 1900.
- `monthlyCounts` in `aggregate.ts`: counted Ingreso per month over the range, zero-filled, null range gives an empty list; its sum equals the Facturas KPI.
- `buildResumenMes`: one row per month (months at $0 or negative included), Mes as `monthYearLabel` text, amount header from `amountHeader(mode)`, Total row from `view.current` (equals the Dashboard).
- `WorkbookContext`, `buildWorkbook` (Resumen por mes only for now), `amountHeader`, `exportFileName` (`gastos-2025-01_2025-12-con-iva.xlsx`, `gastos-con-iva.xlsx` without a range) and `es.export` copy.

## TDD Gate Compliance

Two RED/GREEN cycles, one per task.

- RED 1 (`dd7985b`): skeleton stubs plus tests; 17 target tests failed on assertions (for example `expected +0 to be 1748390400000`, `expected [] to deeply equal [ ...(3) ]`), no load or syntax errors, 32 pre-existing tests green. Semantic assessment: each target test ran and failed on the planned value.
- GREEN 1 (`09099a3`): cell model and `monthlyCounts`; 49 passed, 14 cell-model tests also green under TZ=Asia/Tokyo and TZ=America/Mexico_City.
- RED 2 (`4b7821f`): 9 target tests failed on assertions against empty stubs.
- GREEN 2 (`f6efcf3`): sheet, workbook, file name and copy; 23 passed.
- Not run: the `gsd_run check tdd-red-evidence` classifier (gsd-tools is not installed in this environment and `workflow.tdd_mode` is not enabled); RED evidence was inspected by hand from the vitest output above. No REFACTOR commit was needed.

Commits: `dd7985b` test, `09099a3` feat, `4b7821f` test, `f6efcf3` feat.

## Deviations from Plan

### Auto-fixed Issues

None to code. Notes:

**1. [Rule 3 - Blocking, structural] Test helper placed in tests/support**
- **Found during:** Task 2 RED
- **Issue:** both new test files need a real `DashboardView` and a `WorkbookContext`; the plan lists no helper file.
- **Fix:** `tests/support/exportFactory.ts` (next to `ledgerFactory.ts`), not imported by production code. Not listed in `files_modified`.
- **Commit:** 4b7821f

**2. Circular import between workbook.ts and sheets/resumenMes.ts**
- `amountHeader` must be exported from `workbook.ts` (plan interfaces) and `resumenMes.ts` uses it, while `workbook.ts` imports `buildResumenMes`. Both are hoisted function declarations used only at call time, so it is safe; ESLint, tsc, vitest and `next build` pass. Later plans that add more sheets will follow the same shape.

**Total deviations:** 0 auto-fixed bugs, 1 added test-support file, 1 noted import cycle. **Impact:** none on behavior.

## Decisions needing no user input but worth recording

- `quantityCell` with a value that is not a valid decimal returns a text cell with the trimmed raw value (blank gives an empty cell). The plan only said "constructors never throw"; this keeps the information visible rather than silently dropping it. Say so if you prefer an empty cell.
- `percentCell`/`unitPriceCell` strings are not padded (`"0.124"`, `"12.5"`); `rateCell` is padded to 4 decimals (`"18.2000"`).

## Verification

- `pnpm exec vitest run src/features/export src/domain/accounting/aggregate.test.ts`: passed (49 tests).
- `TZ=Asia/Tokyo` and `TZ=America/Mexico_City` runs of `cellModel.test.ts`: passed (14 each).
- `pnpm verify` (lint, `next typegen && tsc --noEmit`, `vitest run`, `next build`): exit 0; 58 files passed, 3 skipped, 1452 tests passed, 8 skipped.
- `pnpm exec eslint .`: 0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive; not touched by this plan, out of scope).
- Acceptance greps: `Date.UTC` appears 4 times in `cellModel.ts`; no `new Date(<lowercase>` match; `export function monthlyCounts` count 1; `gastos-` in `fileName.ts`; `buildResumenMes` in `workbook.ts`.

## Known Stubs

None. (The RED-step skeletons were replaced in the GREEN commits.)

## Threat Flags

None. T-03-39 mitigated: dates only via `Date.UTC`, money only as big.js strings, tests in three time zones.

## Next Phase Readiness

Ready for 03-13 (install write-excel-file, `toLibrarySheet` writer and the "Exportar a Excel" button using `buildWorkbook` and `exportFileName`).

## Self-Check: PASSED

Created files exist on disk, commits `dd7985b`, `09099a3`, `4b7821f`, `f6efcf3` are ancestors of HEAD, `pnpm verify` is green.
