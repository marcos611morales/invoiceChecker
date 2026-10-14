---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 14
subsystem: ui
tags: [tanstack-table-v9, shadcn, intl, sorting, nextjs]
requires:
  - phase: 01-13
    provides: AppShell loaded screen, hasReport, sessionStore invoices
  - phase: 01-02
    provides: ParsedInvoice literal strings (fecha, total, moneda, folio)
provides:
  - formatFechaIso, formatTotal, formatFolio (src/lib/format.ts)
  - facturasCargadasHeading (src/lib/copy/messages.ts)
  - InvoiceRow, toInvoiceRows, module-scope features and columns (src/features/invoices/columns.ts)
  - InvoiceTable sortable "Facturas cargadas" table rendered by AppShell after ImportReport
  - shadcn table component (src/components/ui/table.tsx)
affects: [01-15, 01-16]
tech-stack:
  added: []
  patterns:
    - "TanStack Table v9: tableFeatures at module scope, constructSortFn for the es collation sort, controlled sorting state, sortDescFirst false"
    - "Display-only amounts: formatted one by one, never summed (D-22)"
key-files:
  created:
    - src/lib/format.ts
    - src/lib/format.test.ts
    - src/features/invoices/columns.ts
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/components/ui/table.tsx
  modified:
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - src/features/shell/AppShell.tsx
key-decisions:
  - "The Spanish sort function is built with constructSortFn (public v9 API) around a module-scope Intl.Collator('es', base), avoiding any explicit any"
  - "InvoiceTable renders nothing when there are no invoices as well as when there is no report; the 'Ninguna factura válida' empty state belongs to Plan 01-15"
  - "Sort icons use the primary token, which is the UI-SPEC accent"
patterns-established:
  - "Missing optional values are undefined in InvoiceRow so sortUndefined last applies; display goes through formatFolio"
requirements-completed: [CARGA-05]
duration: 25min
completed: 2026-10-14
status: complete
commits: 4
plan_head_before: 20aa3995a52960b173fcfb4ea13cb3019dc00608
plan_head_after: 437ed46e9b6f027c429adcc8257a65f8780ecc7b
actuals:
  tokens: 21000
  tasks: 2
  commits: 4
---

# Phase 1 Plan 14: Facturas cargadas table Summary

**Sortable "Facturas cargadas" table on TanStack Table v9 showing each XML's date, provider, type, folio, total and concept count exactly as stated, with es collation sorting, default Fecha descending and no sums of any kind.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 2 (both TDD: RED commit then GREEN commit)
- **Files:** 9 created or modified

## Accomplishments

- `src/lib/format.ts`: `formatFechaIso` slices the literal ISO string (no Date object), `formatTotal` uses `Intl.NumberFormat("es-MX")` with the XML currency, returns "—" for XXX and falls back to the raw amount plus code for unknown currencies or non-numeric amounts, `formatFolio` shows "—" when absent.
- `InvoiceTable` with six columns, header buttons cycling ascending, descending, unsorted with `aria-sort` on the `th`, default Fecha descending, Fecha sorted by the literal ISO string, Total numerically, Proveedor and Tipo with es collation (Ábaco before Banco, Ñandú after Nube), missing Folio always last.
- D-22 note always visible under the heading; no `tfoot`, no `reduce`, no sum.
- Provider cell truncates at 280 px with a Tooltip carrying the full name; the shadcn table container scrolls horizontally so the page never does.
- AppShell renders the table after the import report.

## Task Commits

1. Task 1 RED: `06d1123` test(01-14) failing format and heading tests
2. Task 1 GREEN: `0321ca8` feat(01-14) value formatting and heading message
3. Task 2 RED: `7b54522` test(01-14) failing InvoiceTable tests plus shadcn table copy-in
4. Task 2 GREEN: `437ed46` feat(01-14) sortable table, columns and AppShell wiring

## Verification

- `pnpm verify` (eslint, typecheck, vitest, next build) passes: 202 tests passed, 3 skipped (pre-existing real-data skips). ESLint reports one pre-existing warning in `src/lib/client/navigation.ts` (unused disable directive), not touched by this plan.
- Acceptance greps: `sortDescFirst: false` and `enableMultiSort: false` present, `useTable` used and no `useReactTable`, no `tfoot`/`TableFooter`/`reduce(` in the table files, no `dangerouslySetInnerHTML` in `src/features`, no `new Date` in `format.ts`, no package.json or pnpm-lock.yaml change by this plan.

## Deviations from Plan

None - plan executed as written. Notes:

- `InvoiceTable` also returns null when `hasReport` is true but there are zero invoices (the plan only states the `hasReport` false case). An empty heading "(0)" would be misleading, and Plan 01-15 adds the documented empty state.
- The plan's `columns.ts` interface mentions `features`/`columns` exports; both are exported so the component can import them.

## Known Stubs

None.

## Deferred / Backstop items

- Visual check of the 90-character provider-name truncation and the 360 px horizontal scroll (must_haves backstop) was not run in a real browser; it is covered structurally by tests (`truncate`, `max-w-[280px]`, `overflow-x-auto`) and left to the phase visual verification.

## Threat Flags

None. Provider names, folios and totals render as React text nodes only (T-01-36); no new endpoints or storage.

## Self-Check: PASSED

- Files exist: src/lib/format.ts, src/features/invoices/columns.ts, src/features/invoices/InvoiceTable.tsx, src/features/invoices/InvoiceTable.test.tsx, src/components/ui/table.tsx
- Commits 06d1123, 0321ca8, 7b54522, 437ed46 are on the branch.
