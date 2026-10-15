---
phase: 02-dashboard-de-gasto-confiable
plan: 13
subsystem: ui
tags: [tanstack-table-v9, big.js, zustand, sonner, base-ui-menu, shadcn, vitest, playwright]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "Ledger (02-04), session store with excludeInvoice/reincludeInvoice (02-06), filtered Dashboard (02-09), SortHeaderButton and TruncatedText (02-12)"
provides:
  - "Ledger-driven row model (toInvoiceRows), concept rows, rounding difference, foreign currency info and payment index in columns.ts"
  - "InvoiceTable: sortable, 50 per page, expandable concept panels, attenuated non-summing rows, row menu to exclude and re-include with undo toast"
  - "format helpers formatQuantity, formatUnitPrice, formatExchangeRate, shortUuid, invoiceRef; es.invoices copy; message functions for the table"
  - "shadcn dropdown-menu copy-in (Base UI Menu, no new npm dependency)"
  - "Dashboard ends with the Facturas table; Phase 1 'Facturas cargadas' copy removed"
affects: [02-14 calidad de datos, 02-15 ver factura focus (data-testid expand-{uuid}, data-row-id)]

actuals:
  tokens: 52000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Money sort built with constructSortFn using Big.cmp only (no basic comparison on Big); undefined last via sortUndefined"
    - "Open panels kept in a ReadonlySet of invoice ids so sorting, paging and filtering keep them"
    - "Attenuation with the muted-foreground token only; no opacity utility on rows or cells"
    - "Row menu trigger = DropdownMenuTrigger render={<Button/>}; toasts through sonner with 6 s duration"

key-files:
  created:
    - src/components/ui/dropdown-menu.tsx
  modified:
    - src/features/invoices/columns.ts
    - src/features/invoices/columns.test.ts
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/lib/format.ts
    - src/lib/format.test.ts
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - e2e/smoke.spec.ts

key-decisions:
  - "Row state precedence: no-suma first, then excluida, then sustituida, else normal (as the plan states), so a row that never counts never offers a menu"
  - "The original-currency line follows the active IVA mode and is unsigned (assumption A-1); concept Monto of a credit note is negative, unit price positive (A-2)"
  - "Undo of an exclusion calls reincludeInvoice as the plan says, which also records the uuid in restored"
  - "Rounding difference = rounded invoice amount minus rounded concept sum, signed, shown only when they differ and every concept amount is usable"

patterns-established:
  - "ConceptRow/InvoiceRow are pure derivations of LedgerEntry + IVA mode; components never re-sum money"
  - "Sorting integration tests run a real useTable through renderHook in jsdom (constructTable alone needs the React reactivity feature)"

requirements-completed: [DASH-09, REGLA-08, REGLA-06, REGLA-07, DASH-10]

coverage:
  - id: D1
    description: "Dashboard ends with 'Facturas ({n})', the note, and a sortable TanStack v9 table with chevron, Fecha, Proveedor, Folio, Forma de pago, Tipo, Monto and actions; default Fecha descending; aria-sort cycle; 50 per page with kept/clamped page and footer only above one page"
    requirement: DASH-09
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable heading, note and default order"
        status: pass
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable pagination"
        status: pass
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#Dashboard tab: Facturas table"
        status: pass
    human_judgment: false
  - id: D2
    description: "Money sort never throws on Big, orders on the signed value and puts the dash last; Fecha by literal ISO, Folio as text, text columns in Spanish collation"
    requirement: DASH-09
    verification:
      - kind: unit
        ref: "src/features/invoices/columns.test.ts#module-scope features and columns"
        status: pass
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable sorting"
        status: pass
    human_judgment: false
  - id: D3
    description: "Credit notes negative with badge and imputation caption; Pago, Traslado, Nomina, $0 and foreign-without-rate rows stay visible in muted text with 'No suma' and no opacity; foreign currency line and panel line"
    requirement: REGLA-06
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable rows that do not sum or are special"
        status: pass
    human_judgment: false
  - id: D4
    description: "Concept panels: chevron-only toggle with aria-expanded/aria-controls, several open, kept across sort/page/filter, concept columns, rounding line only on a rounded difference, paid line, substituted line"
    requirement: REGLA-07
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable concept panels"
        status: pass
      - kind: unit
        ref: "src/features/invoices/columns.test.ts#conceptRows"
        status: pass
    human_judgment: false
  - id: D5
    description: "Instant exclusion from the row menu (no dialog), Excluida badge and struck-through amount, totals recompute, 6 s toast with Deshacer exclusión, Volver a incluir on excluded and substituted rows, nothing stored in the browser, focus returns to the trigger"
    requirement: REGLA-08
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable exclusion"
        status: pass
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#recomputes the Gasto total when an invoice is excluded from its row menu"
        status: pass
    human_judgment: false
  - id: D6
    description: "Overflow, truncation and wrapping backstops (960 px min width inside an overflow-x-auto container, truncated supplier and forma de pago, concept descriptions wrapping anywhere, markup-like text rendered as text)"
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable layout, long text and untrusted text"
        status: pass
    human_judgment: true
    rationale: "Tests assert the classes and DOM, not the rendered pixels; the real horizontal scroll under 1024 px, the 56 px wrapped rows and the 7:1 contrast of attenuated rows need a visual check"
  - id: D7
    description: "Formatting helpers and Spanish copy of the table (formatQuantity, formatUnitPrice, formatExchangeRate, shortUuid, invoiceRef, es.invoices, message functions); Phase 1 table copy removed"
    requirement: DASH-10
    verification:
      - kind: unit
        ref: "src/lib/format.test.ts#formatQuantity"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#invoice table texts"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-10-15
status: complete
plan_head_before: d4b2f2508f23574725735cac7d3df84212d670d8
plan_head_after: dc09f4c34beca3d738d1c1110c48a3a864a26ade
---

# Phase 2 Plan 13: Invoice table with concept panels and exclusion Summary

**Ledger-driven Facturas table on TanStack v9 (Big-safe money sort, 50 per page, expandable concept panels, attenuated non-summing rows) with an instant "Excluir factura" row menu, 6 s undo toast and session-only exclusion, replacing the Phase 1 table.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-15T20:31:00Z (approximate; start time was not captured at launch)
- **Completed:** 2026-10-15T20:47:32Z
- **Tasks:** 2 (both TDD: RED then GREEN)
- **Files modified:** 13 (12 modified, 1 created; 0 deleted)

## Accomplishments

- `columns.ts` now builds rows from ledger entries (`toInvoiceRows`), explains concepts (`conceptRows`, `roundingDifference`), foreign currency (`foreignInfo`) and Pago payments (`buildPaymentIndex`); money sorting compares Big values only with `cmp`, so TanStack can never call the basic comparison on a Big.
- `InvoiceTable` shows every entry behind the KPIs: credit notes negative with "aplica a {mes}" or "sin factura relacionada", non-summing rows muted with "No suma", "Excluida" with a struck-through amount, "Sustituida", the foreign-currency line, and an expandable panel per invoice.
- The "⋯" menu (Base UI Menu through the shadcn `dropdown-menu` copy-in) excludes instantly, toasts "Factura excluida" with "Deshacer exclusión" for 6 s, and offers "Volver a incluir" on excluded and substituted rows; rows that never count render no menu but keep the 48 px cell.
- The Dashboard ends with the table; the Phase 1 heading, note and `es.table` keys are gone; the Playwright smoke asserts "Facturas (4)".

## Task Commits

1. **Task 1: Row model, concept rows, payment index, formatting helpers and invoice copy**
   - RED `31d4a05` (test) - failing tests for format helpers, messages, row model, sorting
   - GREEN `27b10df` (feat) - implementation plus a transitional `InvoiceTable` placeholder so typecheck/lint stay green between tasks
2. **Task 2: InvoiceTable with expandable concept panels, row menu, exclusion toasts and pagination**
   - RED `8da2e97` (test) - 33 failing component tests against the placeholder
   - GREEN `dc09f4c` (feat) - component, dropdown-menu copy-in, Dashboard wiring, smoke update

**Plan metadata:** the SUMMARY commit (docs) follows these four.

### TDD evidence

- RED 1: `pnpm exec vitest run src/lib/format.test.ts src/lib/copy/messages.test.ts src/features/invoices/columns.test.ts` gave 36 failed, 66 passed; every target failed with `TypeError: <function> is not a function` for the missing exports (semantic assessment: the planned behavior did not exist, the failures are not setup or syntax faults). The `gsd_run check tdd-red-evidence` classifier was not run: `workflow.tdd_mode` is not enabled and the plan is `type: execute`.
- GREEN 1: same command, 157 passed.
- RED 2: `pnpm exec vitest run src/features/invoices/InvoiceTable.test.tsx` gave 33 failed (all assertion failures: nothing rendered by the placeholder).
- GREEN 2: 56 passed in `src/features/invoices`, 283 passed in `src/features`.

## Files Created/Modified

- `src/features/invoices/columns.ts` - row model, concept rows, rounding difference, foreign info, payment index, module-scope features and columns
- `src/features/invoices/InvoiceTable.tsx` - the table, panels, row menu, toasts, pagination
- `src/components/ui/dropdown-menu.tsx` - shadcn copy-in (no existing component changed, package.json and lockfile untouched)
- `src/features/dashboard/DashboardTab.tsx` - renders the table after the trend and ranking row
- `src/lib/format.ts` - `formatQuantity`, `formatUnitPrice`, `formatExchangeRate`, `shortUuid`, `invoiceRef`
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - `es.invoices.*`, message functions; `es.table` reduced to the pagination keys; `facturasCargadasHeading` removed
- tests: `columns.test.ts`, `InvoiceTable.test.tsx`, `format.test.ts`, `messages.test.ts`, `DashboardTab.test.tsx`; `e2e/smoke.spec.ts`

## Decisions Made

- Followed the plan's row-state precedence and assumptions A-1 and A-2 (see frontmatter).
- Added `formatExchangeRate` and the helpers `roundingDifference`, `foreignInfo` (extra exports, not in the interfaces block) so the component stays free of arithmetic.
- The Task 1 commit replaces the Phase 1 `InvoiceTable` with a placeholder returning null (nothing mounted it) so each task commit passes typecheck, lint and tests; Task 2 replaces the placeholder.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing Dashboard tests broke because the new table repeats text they looked up globally**
- **Found during:** Task 2 (Dashboard wiring)
- **Issue:** `DashboardTab.test.tsx` found "Por definir (sin complemento de pago)" with `getByText` (now also in a table cell) and asserted no `nota de crédito` text anywhere (now in the table note).
- **Fix:** scoped the first to the filter option (`getByRole("option", ...)`) and the second to the `kpi-facturas` card. No production code changed for this.
- **Files modified:** `src/features/dashboard/DashboardTab.test.tsx`
- **Committed in:** `dc09f4c`

**2. [Rule 3 - Blocking] Table sorting tests cannot use `constructTable` in the node environment**
- **Found during:** Task 1 GREEN
- **Issue:** `constructTable` requires the React reactivity feature injected by `useTable`; `columns.test.ts` therefore uses `renderHook(useTable)` and runs under jsdom instead of node.
- **Fix:** added `// @vitest-environment jsdom` to `columns.test.ts`.
- **Committed in:** `27b10df`

**3. [Rule 3 - Blocking] Phase 1 InvoiceTable could not compile once its row model and copy were removed**
- **Found during:** Task 1
- **Issue:** the plan removes the Phase 1 copy in Task 1 but replaces the component only in Task 2.
- **Fix:** transitional placeholder component and a one-assertion placeholder test, replaced by Task 2.
- **Committed in:** `27b10df`, replaced in `dc09f4c`

---

**Total deviations:** 3 auto-fixed (1 bug in tests, 2 blocking)
**Impact on plan:** none on behavior or scope.

## Issues Encountered

- One of my own tests first asserted `not.toMatch(/opacity-/)` on the whole tbody; the shared `Button` base class carries `disabled:opacity-50`. The test now inspects rows, cells and their spans and divs; the acceptance grep on `InvoiceTable.tsx` is 0.
- `pnpm lint` reports one warning in `src/lib/client/navigation.ts` (unused eslint-disable directive); it is pre-existing and out of scope.

## Verification

- `pnpm verify` (lint, typecheck, vitest 717 passed / 8 skipped, `next build`) exits 0.
- Playwright smoke (`pnpm exec playwright test`) was runnable here with the config's test-only defaults: 3 passed, 1 skipped (the real-sample test, needs `E2E_FACTURAS_DIR`), including the new "Facturas (4)" assertion.
- Acceptance greps: `useReactTable` 0, `sortDescFirst: false` 1, `enableMultiSort: false` 1, `AlertDialog` 0, `opacity-[0-9]+` 0 in `InvoiceTable.tsx`, no storage APIs or raw-HTML injection in `src/features/invoices`, `Facturas cargadas` 0 and `Facturas (4)` 1 in the smoke.

## Known Stubs

None. The transitional placeholder created in Task 1 was replaced in Task 2.

## Threat Flags

None beyond the plan's threat model: T-02-22 (text only, markup test), T-02-23 (visible state, toast, Volver a incluir), T-02-24 (no storage write, spy test), T-02-SC (copy-in only, no existing component modified, no dependency change).

## User Setup Required

None - no external service configuration required.

## UI texts and formats to confirm (not fixed by the plan or UI-SPEC)

1. Exchange rate format: always 2 to 6 decimals ("18.2" shows "18.20", "18.123400" shows "18.1234"); the spec only gives "TC 18.20".
2. Cantidad is shown plain without thousands separators ("1.5", "2", "10000").
3. A concept without Unidad and ClaveUnidad, and an invoice without forma de pago, show "—".
4. The rounding line is signed: for a credit note it can read "Diferencia de redondeo: −$0.01".
5. If a PPD invoice has several loaded Pagos, the panel shows one "Pagada el ..." line per payment.
6. The undo action reuses `reincludeInvoice` as planned, so it also stores the uuid in `restored`; a substitute loaded later for that uuid would not auto-exclude it.
7. `tipoLabel` in `messages.ts` (labels "Egreso" etc.) is now unused by the UI; left in place with its tests.

## Next Phase Readiness

- `data-testid="expand-{uuid}"` and `data-row-id="{uuid}"` are in place for Plan 02-15 to focus and scroll a row; `invoiceRef`, `shortUuid`, `InvoiceRow` and `conceptRows` are available for Plan 02-14.
- Visual checks still pending for a human (see coverage D6).

## Self-Check: PASSED

- Created/modified files exist on disk (`columns.ts`, `InvoiceTable.tsx`, `dropdown-menu.tsx`, tests).
- Commits `31d4a05`, `27b10df`, `8da2e97`, `dc09f4c` are ancestors of HEAD.
- No file deleted in any task commit.

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-15*
