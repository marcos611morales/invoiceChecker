---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 15
subsystem: export
status: complete
tags: [excel, resumen-categoria, resumen-proveedor, parametros, workbook, vitest]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "XCell/SheetModel, WorkbookContext, buildWorkbook, amountHeader (03-12); writer and ExportButton with the context building (03-13); buildFacturas, buildConceptos (03-14); DashboardView.categories/ranking/current/variationMonths (03-08)"
provides:
  - "buildResumenCategoria: Dashboard category block as a sheet, Total row from view.current"
  - "buildResumenProveedor: every supplier of the filter, Total row with the Facturas and Ticket promedio KPIs"
  - "buildParametros: export time, mode, range, filter labels, invoice count, Gasto total, variation months, note"
  - "buildWorkbook returns the six sheets of XLS-01 in UI-SPEC order"
  - "variationMonthText message and es.export.{summary,noPreviousMonth,params} copy"
affects: [03-16, 03-17]

actuals:
  tokens: 30000
  tasks: 2
  commits: 4
plan_head_before: 066c5fd99f856a3720285dea1d8a5d120cd86341
plan_head_after: 29d6f8e9e306331e568666606a4304e46e025e84

tech-stack:
  added: []
  patterns:
    - "Summary sheets read only view and ctx; Total rows come from view.current, never from a re-sum of rounded cells"
    - "Every name, RFC and parameter value is a textCell (format @), so a leading = + - @ is never evaluated"
    - "TDD with skeleton builders that return an empty sheet, so the RED commit fails on assertions and not on a missing import"

key-files:
  created:
    - src/features/export/sheets/resumenCategoria.ts
    - src/features/export/sheets/resumenCategoria.test.ts
    - src/features/export/sheets/resumenProveedor.ts
    - src/features/export/sheets/resumenProveedor.test.ts
    - src/features/export/sheets/parametros.ts
    - src/features/export/sheets/parametros.test.ts
  modified:
    - src/features/export/workbook.ts
    - src/features/export/workbook.test.ts
    - src/features/export/ExportButton.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "Modo de montos in Parámetros uses two explicit strings (es.export.params.modeCon / modeSin) because the existing IVA captions start with «Montos» and the tooltip text does not compose into the wording the plan fixes"
  - "ExportButton.tsx needed no change: Plan 03-13 already builds exportedAtText (exportedAtText helper) and the three label lists with selectedNames over the whole ledger; this plan added the tests that pin that behaviour"

patterns-established:
  - "Copy for the summary sheets lives under es.export.summary; Parámetros under es.export.params"

requirements-completed: [XLS-01, XLS-02, XLS-03]

duration: 10 min
completed: 2026-10-18
---

# Phase 3 Plan 15: Summary sheets and Parámetros Summary

**The workbook now has the six sheets of XLS-01 in UI-SPEC order: Resumen por categoría and Resumen por proveedor repeat the Dashboard figures with Total rows read from view.current, and Parámetros records mode, range, filter labels, export time and variation months.**

## Accomplishments

- **Resumen por categoría** (`buildResumenCategoria`): one row per `view.categories` entry in Dashboard order (Categoría, Monto con/sin IVA, % del total, Promedio mensual, Variación %), «Sin categoría» included, «Sin dato del mes anterior» as text when the variation is null, widths 32/16/12/16/16. Total row: Gasto total, 100 % (empty unless the total is above zero), the monthly average KPI, empty variation.
- **Resumen por proveedor** (`buildResumenProveedor`): every `view.ranking` entry (12 suppliers give 12 rows, not 10), RFC and name as text, share and ticket empty when null. Total row: Gasto total, 100 %, the Facturas KPI (A-1) and the Ticket promedio KPI.
- **Parámetros** (`buildParametros`): ten rows in the UI-SPEC order; «Todos»/«Todas» or the selected names joined with ", ", mode wording, range via `rangeText` (or «—»), invoice count and Gasto total as number cells, «dic 2025 vs. nov 2025» through `variationMonthText` (or «—»), the exported-at text unchanged and the exclusion note.
- **Workbook order**: Facturas, Conceptos, Resumen por categoría, Resumen por proveedor, Resumen por mes, Parámetros; asserted in `workbook.test.ts` and `ExportButton.test.tsx`.
- **ExportButton context** pinned by tests with a fixed system time (dd/mm/aaaa hh:mm in local time, «Todos/Todas» without filters, selected supplier, category and forma names with filters).

## Task Commits

1. Task 1 RED: `a64178e` test(03-15): failing tests for the category and supplier summary sheets
2. Task 1 GREEN: `fdbb389` feat(03-15): category and supplier summary sheets in the workbook
3. Task 2 RED: `17747e7` test(03-15): failing tests for Parámetros and the six-sheet workbook
4. Task 2 GREEN: `29d6f8e` feat(03-15): Parámetros sheet and the six-sheet workbook

## TDD Gate Compliance

Both tasks have a `test(03-15)` commit followed by a `feat(03-15)` commit. RED evidence: the new builders were committed as skeletons that return an empty sheet (and `variationMonthText` returned an empty string), so every new test failed on its planned assertion (13 failures in Task 1 across both sheet files plus the workbook order test; 13 failures in Task 2), not on a missing import. The `gsd_run check tdd-red-evidence` classifier was not run because the plan is `type: execute` and `workflow.tdd_mode` gate enforcement applies to `type: tdd` plans.

## Deviations from Plan

None in behaviour. Notes:

- The plan lists ExportButton.tsx under the files to modify, but its context building (exportedAtText, supplierLabels, categoryLabels, formaLabels) already existed from Plan 03-13, so only its tests changed.
- `es.export.params` gained `modeCon`, `modeSin`, `parameter`, `value` and `none` (the «—» text) beyond the keys named in the plan, to hold the exact wording the plan's truths require.
- `es.export.summary` (extra column headers) was added for the two summary sheets, as the plan asks for their headers as copy.

## Verification

- `pnpm exec vitest run src/features/export src/lib`: 18 files, 310 tests passed.
- `pnpm exec vitest run` (full): 69 files passed, 3 skipped; 1569 tests passed, 8 skipped.
- `pnpm typecheck` (next typegen + tsc --noEmit): clean. A bare `pnpm tsc --noEmit` reports `LayoutProps` not found in `src/app/layout.tsx` until `next typegen` has run in a fresh worktree; this is environmental and pre-existing.
- `pnpm lint`: 0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), not touched by this plan.
- `pnpm build`: succeeds.
- Acceptance greps: `buildResumenCategoria`/`buildResumenProveedor`/`buildParametros` present in workbook.ts, `view.current` present in both summary builders, the exclusion note appears once in es.ts.

## Known Stubs

None.

## Threat Flags

None. T-03-41 is mitigated: every name in the summaries and in Parámetros is a `textCell`, with tests using "=HYPERLINK(1)" for supplier, category and selected-label values.

## Self-Check: PASSED

- Created files exist: resumenCategoria.ts, resumenProveedor.ts, parametros.ts and their tests.
- Commits a64178e, fdbb389, 17747e7, 29d6f8e are ancestors of HEAD.
