---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 15
subsystem: ui
tags: [tanstack-table-v9, pagination, shadcn, badge, alert, empty-state]
requires:
  - phase: 01-14
    provides: InvoiceTable with sorting, module-scope features and columns, tipoLabel and heading helpers
provides:
  - paginationRangeText, paginationPageText (src/lib/copy/messages.ts)
  - 50-row paginated "Facturas cargadas" table with footer and page clamping
  - Tipo outline Badge, D-22 note in an inline Alert (role="note"), "Ninguna factura válida" Empty state
  - shadcn badge, empty and alert components
affects: [01-16]
tech-stack:
  added: []
  patterns:
    - "TanStack Table v9 pagination: rowPaginationFeature + createPaginatedRowModel at module scope, controlled pagination state, autoResetPageIndex false"
    - "Page clamp as a conditional state update during render (derived-state pattern), never an effect"
key-files:
  created:
    - src/components/ui/badge.tsx
    - src/components/ui/empty.tsx
    - src/components/ui/alert.tsx
  modified:
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - src/features/invoices/columns.ts
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
key-decisions:
  - "Page clamp: the stored pageIndex is reset to 0 during render when it is no longer below the page count, so a later growth of the data does not resurrect a forgotten page"
  - "The note Alert overrides the default role with role=\"note\" so a static note is not announced on every load"
  - "The empty state is a section labelled with es.table.heading (aria-label) because no visible heading exists when there are no invoices"
patterns-established:
  - "INITIAL_PAGINATION constant (pageIndex 0, pageSize 50) feeds both useState and the page-size arithmetic"
requirements-completed: [CARGA-05]
duration: 20min
completed: 2026-10-14
status: complete
commits: 4
plan_head_before: 25e1ceab80334bfff0a6e8e93da2752b00d52836
plan_head_after: 9dd4034bc6ca01a41e39d8301daa79cf96e9af9e
actuals:
  tokens: 14000
  tasks: 2
  commits: 4
---

# Phase 1 Plan 15: Pagination, badge, Alert note and empty state Summary

**The "Facturas cargadas" table now pages at 50 rows with the UI-SPEC footer (range, page text, Anterior/Siguiente), keeps or resets the page correctly, shows Tipo as an outline Badge, the D-22 note in an inline role="note" Alert, and "Ninguna factura válida" when files were processed but none is valid.**

## Accomplishments

- `paginationRangeText` (singular "Mostrando 1 de 1" for a one-row range, en dash otherwise) and `paginationPageText` in `messages.ts`.
- `rowPaginationFeature` and `createPaginatedRowModel()` added to the module-scope `features` (stable references, Pitfall 9).
- `InvoiceTable`: controlled pagination next to controlled sorting, `autoResetPageIndex: false`, footer only when there is more than one page, buttons disabled at the ends and 44 px targets under 640 px (`max-sm:h-11 max-sm:min-w-11`). Sorting keeps the page; a new batch keeps the page if it still exists, else page 1.
- Tipo renders as `Badge variant="outline"`; the note renders in shadcn `Alert` with an Info icon and `role="note"`; the zero-invoice-with-report case renders shadcn `Empty` with the UI-SPEC copy and no `<table>`.
- No `tfoot`, no `reduce(`, no sum of amounts anywhere (D-22).

## Task Commits

1. Task 1 RED: `2e63b88` test(01-15) failing pagination tests
2. Task 1 GREEN: `9971426` feat(01-15) paginate the table at 50 rows
3. Task 2 RED: `69d2ded` test(01-15) failing badge/alert/empty tests plus shadcn badge, empty, alert copy-ins
4. Task 2 GREEN: `9dd4034` feat(01-15) Tipo badge, note Alert and empty state

## Verification

- `pnpm verify` (lint, typecheck, vitest 219 tests, next build): green. Lint reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), not caused by this plan and left untouched.
- `pnpm smoke:auth`: "smoke-auth: OK (14 checks)".
- `package.json` and `pnpm-lock.yaml` unchanged by this plan (`shadcn add` added only component files).
- Acceptance greps: `rowPaginationFeature` in columns.ts, `autoResetPageIndex: false` and `pageSize: 50` in InvoiceTable.tsx, no `tfoot`/`TableFooter`/`reduce(`.

## Deviations from Plan

None - plan executed as written. One implementation note: `pageSize: 50` lives in an `INITIAL_PAGINATION` constant so the acceptance grep matches while the same value drives the range arithmetic.

## Human check pending

The plan's `<human-check>` (build + start, page through the 143-invoice sample, sort on page 3, rechazos folder, 360 px overflow) was not run by this executor; it needs a browser. Automated coverage: 120-row paging, singular range, page retention on sort, clamp after clearAll plus smaller batch, empty state, badge slot, alert role.

## Known Stubs

None.

## Threat Flags

None. T-01-40 mitigated (50-row pages, clamped index); T-01-SC mitigated (no dependency changes).

## Self-Check: PASSED

- Files present: badge.tsx, empty.tsx, alert.tsx, InvoiceTable.tsx, columns.ts, messages.ts.
- Commits present: 2e63b88, 9971426, 69d2ded, 9dd4034.
