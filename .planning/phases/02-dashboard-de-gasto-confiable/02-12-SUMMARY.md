---
phase: 02-dashboard-de-gasto-confiable
plan: 12
subsystem: ui
tags: [tanstack-table-v9, base-ui, dialog, tooltip, popover, big.js, vitest]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "supplierRanking / monthlySeries selectors, formatMoney / formatPercent, TrendChart, filtered Dashboard and KPI row, shadcn dialog / popover / tooltip / scroll-area / table (Plans 02-05, 02-08 to 02-11)"
provides:
  - "SupplierRanking: top-10 HTML ordered list by net spend with proportional 4 px bars, negative-net tick and guarded divisions"
  - "SupplierDialog: centred / full-screen dialog with a TanStack v9 sortable table of every supplier"
  - "TruncatedText: truncated button with full accessible name; Tooltip on pointer devices, tap Popover on touch devices"
  - "SortHeaderButton, SortIcon, ariaSort shared sort-header pieces"
  - "DashboardTab row: TrendChart (3fr) beside SupplierRanking (2fr) from 1024 px, under the KPI row"
  - "es.charts ranking keys and rankingCaption message function"
affects: [02-13, 02-14, 02-15]

plan_head_before: b0a92588e9c177939583ca6740e15584cbcbe949
plan_head_after: 65153ff6a4313f5decf2ab1c81b2e8083399280f

actuals:
  tokens: 32000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Device class detected with useSyncExternalStore over matchMedia, guarded for its absence (server snapshot false), no setState in an effect"
    - "Big values are only compared with cmp in custom constructSortFn sorts; undefined (not null) values use sortUndefined 'last' so they stay at the end in both directions"
    - "Dialog table mounted only while open (inner component) so the sort state resets on every open"
    - "Bar geometry is a plain percentage derived from Big division after a zero-maximum guard; displayed texts always come from formatMoney / formatPercent"

key-files:
  created:
    - src/components/TruncatedText.tsx
    - src/components/TruncatedText.test.tsx
    - src/components/SortHeaderButton.tsx
    - src/components/SortHeaderButton.test.tsx
    - src/features/dashboard/SupplierRanking.tsx
    - src/features/dashboard/SupplierDialog.tsx
    - src/features/dashboard/SupplierRanking.test.tsx
  modified:
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - tests/support/domPolyfills.ts

key-decisions:
  - "The dialog uses its own 'Cerrar' footer button (showCloseButton=false) because the shadcn dialog.tsx top-right close button carries an English sr-only 'Close'; dialog.tsx was not modified"
  - "Initial focus goes to the dialog title (tabIndex -1, initialFocus ref); Base UI returns focus to the previously focused 'Ver todos' button on close"
  - "InvoiceTable.tsx was left untouched as the plan says; the shared SortHeaderButton is a copy of its markup that Plan 02-13 adopts"

patterns-established:
  - "Spanish-collated, Big-aware and count sort functions defined at module scope with constructSortFn and registered by name in tableFeatures sortFns"

requirements-completed: [DASH-02, DASH-04, DASH-10]

coverage:
  - id: D1
    description: "Top-10 ranking is an ordered list by net spend, with name, amount, proportional bar and caption; no Otros group; Ver todos only above 10 suppliers"
    requirement: "DASH-04"
    verification:
      - kind: unit
        ref: "src/features/dashboard/SupplierRanking.test.tsx#SupplierRanking: the top list (DASH-04, D-22, D-23)"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/SupplierRanking.test.tsx#SupplierRanking: 'Ver todos' (D-22)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Negative net goes last with no fill, a 2 px tick, a true minus and the negative-net caption; zero maximum, lone supplier, all-negative and null pct or ticket never divide by zero"
    requirement: "DASH-04"
    verification:
      - kind: unit
        ref: "src/features/dashboard/SupplierRanking.test.tsx#SupplierRanking: the top list (DASH-04, D-22, D-23)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full supplier dialog: five columns, default Gasto neto descending, ascending-descending-none cycle with aria-sort, Big comparison, Spanish collation, nulls last in both directions, right-aligned tabular numerics"
    requirement: "DASH-04"
    verification:
      - kind: unit
        ref: "src/features/dashboard/SupplierRanking.test.tsx#SupplierDialog: the sortable table (DASH-04, D-22, E6)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dialog focus moves to the title on open and returns to 'Ver todos' on close; Escape and Cerrar close it"
    verification:
      - kind: unit
        ref: "src/features/dashboard/SupplierRanking.test.tsx#SupplierRanking: 'Ver todos' (D-22)"
        status: pass
    human_judgment: false
  - id: D5
    description: "TruncatedText: full text as accessible name, Tooltip on pointer devices, tap Popover on touch (closes on Escape / outside click), pointer fallback without matchMedia, text rendered as text only"
    requirement: "DASH-10"
    verification:
      - kind: unit
        ref: "src/components/TruncatedText.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "SortHeaderButton / SortIcon / ariaSort contract"
    verification:
      - kind: unit
        ref: "src/components/SortHeaderButton.test.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "Dashboard row: trend and ranking in one responsive grid under the KPIs, both following the supplier filter, IVA mode and credit notes, hidden in the filtered-empty state"
    requirement: "DASH-02"
    verification:
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#Dashboard tab: trend and ranking row (DASH-02, DASH-04, DASH-10, D-22, D-23)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Visual result: two-column proportions, 4 px bars, dialog sizing (720 px centred, full screen under 640 px), 480 px scroll area actually scrolling, real touch behavior of the truncated-name Popover"
    verification: []
    human_judgment: true
    rationale: "jsdom performs no layout and has no touch input; the plan defers the visual and device check to the final human check in Plan 02-15"

duration: 13min
completed: 2026-10-15
status: complete
---

# Phase 2 Plan 12: Supplier Ranking, Full List and Dashboard Row Summary

**HTML top-10 supplier ranking by net spend with proportional bars, a TanStack v9 sortable full-list dialog, shared truncated-text (Tooltip / tap Popover) and sort-header components, and the Dashboard row placing the monthly trend beside the ranking**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-15T20:20:00Z
- **Completed:** 2026-10-15T20:33:00Z
- **Tasks:** 2 (both TDD: RED then GREEN each)
- **Files modified:** 13 (7 created, 6 modified)

## Accomplishments
- `TruncatedText`: the name is a truncating button whose aria-label is the full text. Pointer devices get a Tooltip, touch devices (`(hover: none), (pointer: coarse)`) get a Popover on tap; the device class comes from `useSyncExternalStore` over matchMedia with a server snapshot of false and a guard for a missing matchMedia.
- `SortHeaderButton`, `SortIcon`, `ariaSort`: the Phase 1 header markup extracted as shared pieces (InvoiceTable.tsx left untouched).
- `SupplierRanking`: `<ol aria-label="Top 10 de proveedores por gasto neto">` of at most 10 rows at least 68 px high; bar width is abs(net) over the largest abs(net), a negative net shows a 2 px tick and the negative-net caption, every division is guarded, null pct / ticket print a dash. "Ver todos" appears only above 10 suppliers.
- `SupplierDialog`: shadcn Dialog (max 720 px, full screen under 640 px) with a TanStack Table v9 (sorting only) inside a 480 px ScrollArea; Big columns sort through `cmp` only, missing values use `sortUndefined: "last"`, Spanish-collated names, default Gasto neto descending, sort resets on each open.
- `DashboardTab`: `TrendChart` (3fr) beside `SupplierRanking` (2fr) from 1024 px, stacked below, only in the non-empty branch, both fed by `monthlySeries` / `supplierRanking` over the same visible set.

## Task Commits

1. **Task 1: Shared TruncatedText and SortHeaderButton** (TDD)
   - RED: `e6cd7ea` (test)
   - GREEN: `b13dcb5` (feat)
2. **Task 2: Supplier ranking, dialog and composed row** (TDD)
   - RED: `fff086f` (test)
   - GREEN: `65153ff` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Gate Compliance

- **Task 1 RED (`e6cd7ea`):** 13 tests across `TruncatedText.test.tsx` and `SortHeaderButton.test.tsx` failed on assertions (for example `Unable to find an accessible element with the role "button" and name ...`) against compile-only stubs; no load errors, no zero-test discovery. Semantic assessment: the targets executed and failed for the intended reason. **GREEN (`b13dcb5`):** 13 of 13 pass.
- **Task 2 RED (`fff086f`):** 26 failures in `SupplierRanking.test.tsx` and `messages.test.ts` plus 6 in `DashboardTab.test.tsx`, all assertion failures against stubs that render nothing. The RED evidence was not run through `check tdd-red-evidence` because this is a `type: execute` plan with `tdd="true"` tasks, not a `type: tdd` plan. **GREEN (`65153ff`):** all dashboard, component and lib suites pass; `pnpm verify` passes (lint, typecheck, 668 tests, build).
- **REFACTOR:** none.

## Files Created/Modified
- `src/components/TruncatedText.tsx`, `.test.tsx` - truncated text by device class
- `src/components/SortHeaderButton.tsx`, `.test.tsx` - shared sort header pieces
- `src/features/dashboard/SupplierRanking.tsx` - top-10 list and "Ver todos" trigger
- `src/features/dashboard/SupplierDialog.tsx` - full list dialog and v9 table
- `src/features/dashboard/SupplierRanking.test.tsx` - ranking and dialog tests
- `src/features/dashboard/DashboardTab.tsx`, `.test.tsx` - composed trend and ranking row, tests
- `src/lib/copy/es.ts`, `messages.ts`, `messages.test.ts` - ranking copy keys and `rankingCaption`
- `tests/support/domPolyfills.ts` - `Element.getAnimations` stub for jsdom

## Decisions Made
- Dialog close: footer "Cerrar" button with `showCloseButton={false}`, because the shadcn close icon has a hard-coded English sr-only "Close" and `dialog.tsx` must not be touched.
- Focus: title receives initial focus via `initialFocus` ref; return of focus to "Ver todos" is Base UI's default and is asserted in a test.
- The plan said "InvoiceTable.tsx untouched", so `SortHeaderButton` duplicates its header markup until Plan 02-13 swaps it in.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom lacks `Element.getAnimations`, which Base UI's ScrollArea calls**
- **Found during:** Task 2 (GREEN, dialog tests)
- **Issue:** Vitest reported 3 unhandled `element.getAnimations is not a function` errors from `ScrollAreaViewport`, which fails the run.
- **Fix:** Added a `getAnimations` stub returning `[]` to the shared `tests/support/domPolyfills.ts` (the file already stubs ResizeObserver and scrollIntoView).
- **Files modified:** tests/support/domPolyfills.ts (not in the plan's `files_modified`)
- **Verification:** full suite green, no unhandled errors
- **Committed in:** 65153ff

**2. [Rule 1 - Bug] Existing DashboardTab filter test matched the supplier name twice**
- **Found during:** Task 2 (GREEN)
- **Issue:** `pickSupplier` used `screen.getByText(name)`; the ranking card now also prints "Café Árbol", so the query found two elements.
- **Fix:** Scoped the click to the open filter list (`within(screen.getByRole("listbox"))`), test-only change.
- **Files modified:** src/features/dashboard/DashboardTab.test.tsx
- **Verification:** the test passes unchanged in intent
- **Committed in:** 65153ff

**3. [Rule 3 - Blocking] Compile-only stubs in the RED commits**
- **Found during:** Tasks 1 and 2 (RED)
- **Issue:** Tests importing non-existent modules fail as load errors (INVALID_RED).
- **Fix:** Committed stubs with the final signatures so tests fail on assertions.
- **Committed in:** e6cd7ea, fff086f

**4. [Rule 2 - Missing Critical] Extra test file `SortHeaderButton.test.tsx`**
- **Issue:** The plan's file list had no test for SortHeaderButton although its behavior section specifies it; added a small test file so the shared component is covered.
- **Files modified:** src/components/SortHeaderButton.test.tsx (new)
- **Committed in:** e6cd7ea

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 2 blocking)
**Impact on plan:** No scope creep; all changes are test support or coverage.

## Issues Encountered
- First click on the already-descending "Gasto neto" header removes the sort (desc to none), then the next click sorts ascending. This is TanStack's cycle with `sortDescFirst: false` and matches the Facturas table; the test was written to that behavior.
- `pnpm lint` reports one pre-existing warning (unused eslint-disable directive in `src/lib/client/navigation.ts`); 0 errors, out of scope.

## User Setup Required
None - no external service configuration required.

## Copy needing the user's attention
- No UI text was invented: all new strings are the ones in the plan's es.charts list. The dialog's English sr-only "Close" of the stock shadcn close icon is not rendered (the close icon is disabled in favor of the "Cerrar" button).
- The dash "—" is used inside the caption for a missing share or ticket ("— del total · Ticket promedio —"), as the behavior section states; if the user prefers a different wording for that partial case, only `rankingCaption` callers change.

## Known Stubs
None.

## Threat Flags
None. The only new rendering surface is supplier names and amounts as React text nodes and aria-label values (T-02-20); `dialog.tsx` already existed, so no registry code was added (T-02-SC).

## Next Phase Readiness
- Plan 02-13 can import `SortHeaderButton`, `SortIcon`, `ariaSort` and `TruncatedText` and replace InvoiceTable's inline copies.
- Open for the final human check (Plan 02-15): two-column proportions, dialog sizing and real scrolling in the 480 px area, and the touch Popover on a real device.

## Self-Check: PASSED

- Files exist: TruncatedText.tsx / .test.tsx, SortHeaderButton.tsx / .test.tsx, SupplierRanking.tsx / .test.tsx, SupplierDialog.tsx (verified present).
- Commits `e6cd7ea`, `b13dcb5`, `fff086f`, `65153ff` are on the branch.
- Acceptance criteria: `<ol` count 1; `useTable` present with 0 `useReactTable`; 0 `sortFn: "basic"`; 0 "Otros" in both files; no raw-HTML injection under `src/features` or the new components; `git diff --name-only -- src/components/ui` empty; `pnpm typecheck`, `pnpm lint` (0 errors) and `pnpm verify` pass.

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-15*
