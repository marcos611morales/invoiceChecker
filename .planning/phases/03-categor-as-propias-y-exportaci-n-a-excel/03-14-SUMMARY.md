---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 14
subsystem: export
tags: [excel, facturas, conceptos, estado, rounding, big.js, vitest]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "XCell/SheetModel, WorkbookContext, buildWorkbook, amountHeader, es.export (03-12); writer and ExportButton (03-13); ScopedEntry and DashboardView.selected (03-04, 03-08); Resolver.explain (03-03)"
provides:
  - "status.ts: rowState (moved out of the table) and entryStatus, one shared Estado for table and workbook"
  - "breakdown.ts: invoiceBreakdown / conceptBreakdown, XML amounts in MXN, unsigned, null when the rate is unusable"
  - "buildFacturas with the full-amount column under a category filter and sortEntriesForExport"
  - "buildConceptos with Categoria, Origen and the Diferencia de redondeo lines"
  - "buildWorkbook order Facturas, Conceptos, Resumen por mes"
affects: [03-15, 03-16]

actuals:
  tokens: 30000
  tasks: 2
  commits: 4
plan_head_before: b1fa7ec6bd0e09483960a2472cb6ca96578da58d
plan_head_after: 7d938c7d50c31ebdcd8ef7e5970ea128a2a6108f

tech-stack:
  added: []
  patterns:
    - "Both detail sheets share one sort (sortEntriesForExport) and one set of identity cells/columns exported from facturas.ts"
    - "A text/code/name is always a textCell; breakdown figures are moneyCell or emptyCell, never a made-up zero"
    - "Rounding lines are computed from the cents written to the cells (toMoneyString then parseDecimal), not from the exact amounts"

key-files:
  created:
    - src/domain/accounting/status.ts
    - src/domain/accounting/status.test.ts
    - src/domain/accounting/breakdown.ts
    - src/domain/accounting/breakdown.test.ts
    - src/features/export/sheets/facturas.ts
    - src/features/export/sheets/facturas.test.ts
    - src/features/export/sheets/conceptos.ts
    - src/features/export/sheets/conceptos.test.ts
  modified:
    - src/domain/accounting/amounts.ts
    - src/features/invoices/columns.ts
    - src/features/export/workbook.ts
    - src/features/export/workbook.test.ts
    - src/features/export/ExportButton.test.tsx
    - src/lib/copy/es.ts
    - tests/support/exportFactory.ts

key-decisions:
  - "A noSuma 'tipo' entry whose kind is Ingreso or Nota de credito (impossible in the ledger) reads «No suma: datos inválidos» instead of a silent «Suma»"
  - "Pago entries (Moneda XXX, no TipoCambio) get empty breakdown cells, because the rate rule of amounts.ts gives no usable rate and none is invented"
  - "A summing invoice with no concept lines gets one «Diferencia de redondeo» line holding its whole amount, which is what the Dashboard split does (D-13) and keeps Conceptos reconciled"

patterns-established:
  - "Export test helper takes settings and a category selection (contextFor, viewFor) so sheets can be tested under real resolver rules"

requirements-completed: [XLS-01, XLS-02, XLS-03]

coverage:
  - id: D1
    description: "entryStatus/rowState shared by the table and the workbook with the same precedence"
    requirement: XLS-02
    verification:
      - kind: unit
        ref: "src/domain/accounting/status.test.ts; src/features/invoices/columns.test.ts and InvoiceTable.test.tsx unchanged and green"
        status: pass
    human_judgment: false
  - id: D2
    description: "XML breakdown in MXN, unsigned, IVA 002 / IEPS 003, null on an unusable rate"
    requirement: XLS-02
    verification:
      - kind: unit
        ref: "src/domain/accounting/breakdown.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Facturas sheet: every filtered invoice in order, Monto 0 for non-summing rows, full-amount column under a category filter, date/text/number cell types"
    requirement: XLS-01
    verification:
      - kind: unit
        ref: "src/features/export/sheets/facturas.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Conceptos sheet with Categoria/Origen on every row, category filter, formula-safe text, and rounding lines that reconcile each invoice with Facturas"
    requirement: XLS-03
    verification:
      - kind: unit
        ref: "src/features/export/sheets/conceptos.test.ts#adds up, for every summing invoice of a mix, to its Monto in Facturas"
        status: pass
    human_judgment: false
  - id: D5
    description: "How the two new sheets look and read when the downloaded file is opened in Excel, Numbers or LibreOffice"
    requirement: XLS-01
    verification: []
    human_judgment: true
    rationale: "Cell models are unit tested and the writer was checked in 03-13, but only a person opening the real file sees wrapping, widths and the feel of a ~150-row Conceptos sheet"

duration: 22min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 14: Facturas and Conceptos sheets Summary

**Shared Estado (`entryStatus`/`rowState`), XML breakdown converted to MXN, and the «Facturas» and «Conceptos» sheets, with «Diferencia de redondeo» lines that make every summing invoice add up exactly to its Monto in Facturas.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2 (both TDD)
- **Files:** 8 created, 7 modified

## Accomplishments

- `status.ts`: `rowState` moved out of `columns.ts` unchanged (the Phase 2 table tests pass untouched; `columns.ts` re-exports `RowState`) and `entryStatus` added with the same precedence: no-suma reason first (a `tipo` is named by its kind), then manual exclusion, then substitution.
- `breakdown.ts`: `invoiceBreakdown` and `conceptBreakdown` read XML strings with `parseDecimal`, convert with the same rate rule as `amounts.ts` (now exported: `exchangeRate`, `sumImportes`), never sign them, and return all nulls when a foreign invoice has no usable rate. IVA is Traslados `002`, IEPS `003`.
- `buildFacturas`: all 16 columns in UI-SPEC order with the contract widths, sorted by literal Fecha then folio (empty folio last) through the exported `sortEntriesForExport`. Monto is zero for rows that do not sum. With a category selection the full-amount column «Monto de la factura completa (con/sin IVA)» follows Monto. Fecha is a date cell; RFC, UUID, folio (`00123` stays text), names and formas are text cells; Tipo de cambio is a `0.0000` number only for a foreign currency with a usable rate. No Total row.
- `buildConceptos`: one row per line in XML order, Estado, Cantidad (`#,##0.######`), Precio unitario (`$#,##0.00####`), Monto (0 on non-summing rows), Importe/Descuento/IVA/IEPS from `conceptBreakdown`, Categoria and Origen from `resolver.explain` on every row. Under a category filter only the lines of the chosen categories are written. The rounding line is computed as the rounded invoice amount minus the sum of the rounded lines (all lines, unusable ones as zero) and is added only when it is not zero and, with a selection, only if the supplier's category is selected.
- `buildWorkbook` returns Facturas, Conceptos, Resumen por mes (03-15 inserts the rest).
- Copy: `es.export.status`, `es.export.columns`, `es.export.origin`, `es.export.roundingLine`.

## Task Commits

1. Task 1 RED: `e79c3b3` test (status, breakdown, Facturas; skeleton stubs; test helper with settings and selection)
2. Task 1 GREEN: `dfc848a` feat
3. Task 2 RED: `6ec8272` test (Conceptos; skeleton; copy)
4. Task 2 GREEN: `7d938c7` feat

## TDD Gate Compliance

- RED 1 (`e79c3b3`): 28 target tests failed on assertions (for example `expected null to be '100'`, `expected 'suma' to be 'pago'`, `expected [] to deeply equal [ 'Facturas', ... ]`); no load, syntax or zero-test errors. Semantic assessment: each target ran against a stub and failed on the planned value.
- GREEN 1 (`dfc848a`): 521 passed in `src/domain/accounting src/features/invoices src/features/export` apart from two 03-13 `ExportButton` assertions that pinned the old one-sheet workbook; updated (see Deviations), then 79 passed in `src/features/export`.
- RED 2 (`6ec8272`): 12 Conceptos tests and the workbook-order test failed on assertions (`expected [] to have a length of 4`, `expected undefined to deeply equal ...`), nothing failed to load.
- GREEN 2 (`7d938c7`): 414 passed across `src/features/export src/domain/accounting`; `pnpm verify` green.
- Not run: the `gsd_run check tdd-red-evidence` classifier (gsd-tools is not installed in this environment); RED evidence inspected by hand from the vitest output. No REFACTOR commit was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 03-13 ExportButton tests pinned the one-sheet workbook**
- **Found during:** Task 1 GREEN
- **Issue:** two assertions in `ExportButton.test.tsx` expected `["Resumen por mes"]` and read `sheets[0].columns[1]` as the Resumen amount header. They fail as soon as the workbook gains sheets.
- **Fix:** expect the sheet list that the workbook now has, and look the Resumen sheet up by name. Behavior of the button is untouched.
- **Files modified:** `src/features/export/ExportButton.test.tsx` (not in the plan's `files_modified`)
- **Commits:** `dfc848a`, `6ec8272`

**2. [Structural] `exchangeRate` and `sumImportes` exported from `amounts.ts`**
- The plan says to use "the same rate rule as amounts.ts". Exporting the two existing functions avoids a second copy of the rule that could drift. No logic changed. `amounts.ts` is not in `files_modified`.

**3. [Structural] `kindLabel` exported from `columns.ts`, test helper extended**
- `Tipo` in Facturas reads the same text as the table, so the existing private `kindLabel` is now exported. `tests/support/exportFactory.ts` gained `contextFor` and `viewFor` (settings and category selection); `viewOf`/`testContext` keep their signatures.

**Total deviations:** 1 auto-fixed (blocking test expectation), 2 structural notes. **Impact:** none on behavior.

## Decisions needing no user input but worth recording

- An inconsistent `noSuma: "tipo"` entry of kind Ingreso or Nota de credito (the ledger never produces it) reads «No suma: datos inválidos».
- Pago, and any foreign currency without a usable TipoCambio, show empty breakdown cells (Subtotal to Total) while Moneda stays; no rate is invented. Say so if you prefer the XML zeros of a Pago to appear.
- A summing invoice with no concept lines produces one «Diferencia de redondeo» line with its whole amount, matching how the Dashboard split assigns it to the supplier's category.
- Under a category filter, the invoice amounts in Facturas are the exact partial sums rounded once, while Conceptos rounds each line. The rounding line is computed from the full invoice amount (as the plan states), so for an invoice partly outside the filter the Conceptos cells can differ from the partial Monto by a cent or two. Without a filter they match exactly (tested), and in the filter case where the whole-invoice rounding matters (supplier category selected) the tested example matches.

## Verification

- `pnpm exec vitest run src/domain/accounting src/features/invoices src/features/export`: passed.
- `pnpm verify` (eslint, `next typegen && tsc --noEmit`, `vitest run`, `next build`): exit 0; 66 files passed, 3 skipped, 1544 tests passed, 8 skipped; production build succeeded. Default workers, no timeout rerun needed.
- `pnpm eslint`: 0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive; untouched, out of scope).
- Task 1 acceptance: `function stateOf` count 0 and `rowState` count 2 in `columns.ts`; `export function entryStatus` 1; `"002"` 2 in `breakdown.ts`; «No suma: moneda sin tipo de cambio» 1 in `es.ts`; `InvoiceTable.test.tsx`, `facturas.test.ts`, `status.test.ts` pass.
- Task 2 acceptance: `export function buildConceptos` 1; «Diferencia de redondeo» 1 and «Ajuste del concepto» 1 in `es.ts`; `conceptos.test.ts` and `workbook.test.ts` pass and list the reconciliation case.

## Known Stubs

None. The RED skeletons were replaced in the GREEN commits.

## Threat Flags

None beyond the plan's register. T-03-27 (every XML string is a text cell; test with `=SUMA(A1)`), T-03-28 (dates only through `dateCell`, folio `00123` stays text) and T-03-29 (Monto from the same `selectView` entries, 0 for non-summing rows, rounding lines, reconciliation test over a 25-invoice mix) are implemented.

## Issues Encountered

None blocking. For a human, because Vitest cannot see it: open a real export in Excel, Numbers or LibreOffice and check the two new sheets (wrapping of Descripción, widths, the «Diferencia de redondeo» lines in a real month). Plan 03-16 covers the production-build download.

## Next Phase Readiness

Ready for 03-15: it only needs to insert «Resumen por categoría», «Resumen por proveedor» and «Parámetros» into `buildWorkbook` in UI-SPEC order, reusing `identityCells`, `optionalMoney` and the same context.

## Self-Check: PASSED

- Created files exist on disk: `status.ts`, `status.test.ts`, `breakdown.ts`, `breakdown.test.ts`, `facturas.ts`, `facturas.test.ts`, `conceptos.ts`, `conceptos.test.ts`.
- Commits `e79c3b3`, `dfc848a`, `6ec8272`, `7d938c7` are ancestors of HEAD; `git rev-list --count b1fa7ec..HEAD` is 4 at SUMMARY time.
- `pnpm verify` is green.
