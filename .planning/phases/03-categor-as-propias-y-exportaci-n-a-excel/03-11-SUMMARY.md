---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 11
subsystem: ui
tags: [zustand, react, accessibility, dashboard, drill-down]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "Filters.categories and setCategories (03-08), CategorySpend with DeltaLine rows (03-10), useDashboardView"
  - phase: 02
    provides: "SupplierRanking, InvoiceTable section and focusRequest effect, session store with setSuppliers"
provides:
  - "Session store revealRequest counter with revealCategory(key) and revealSupplier(rfc)"
  - "Facturas section scroll-and-focus effect keyed on revealRequest (block start, reduced motion aware, heading focus)"
  - "Category rows and top-10 supplier rows as native buttons that add the filter and move to the Facturas table"
  - "Messages viewCategoryInvoicesAria and viewSupplierInvoicesAria"
affects: [03-12, 03-17, phase-04]

actuals:
  tokens: 52000
  tasks: 2
  commits: 4
plan_head_before: 42b035bbe586bc622436d992cf98622d3474f7c7
plan_head_after: 4855ae40052ac8bc56c327aff7f855dc3d691d63

tech-stack:
  added: []
  patterns:
    - "One-shot UI request as a monotonically increasing counter in the session store; the consumer keeps the value seen at mount in a ref so remounting never replays it"
    - "Row buttons made of phrasing content only (spans) so they stay valid HTML inside a button"

key-files:
  created: []
  modified:
    - src/stores/sessionStore.ts
    - src/stores/sessionStore.test.ts
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/features/dashboard/CategorySpend.tsx
    - src/features/dashboard/CategorySpend.test.tsx
    - src/features/dashboard/SupplierRanking.tsx
    - src/features/dashboard/SupplierRanking.test.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/features/dashboard/DeltaLine.tsx
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "revealCategory/revealSupplier keep the same filters object when the value is already selected (set semantics) and still bump revealRequest, so a repeated click scrolls again"
  - "The reveal effect treats the revealRequest value present at mount as handled (ref initialised from the store), so switching back to the Dashboard tab never replays an old reveal"
  - "The Facturas heading keeps the browser default focus indication (no outline-none) so keyboard users see where focus landed"
  - "Accessible names carry the full category or supplier name, uncapped, because the visible text is never truncated here (the capCodePoints rule applies to the capped concept texts only)"

patterns-established:
  - "Drill-down by filter: a row click adds a removable chip filter and moves to the table, with no dialog or detail screen (D-18)"

requirements-completed: [DASH-08]

coverage:
  - id: D1
    description: "A click on a category row adds the category to the filter, scrolls to Facturas and focuses its heading, with no dialog and no expanded row"
    requirement: DASH-08
    verification:
      - kind: automated_ui
        ref: "src/features/dashboard/DashboardTab.test.tsx#a click on a category row adds the filter, announces the chip, scrolls to Facturas and focuses its heading"
        status: pass
      - kind: unit
        ref: "src/stores/sessionStore.test.ts#revealCategory adds the key as a new Set, bumps revealRequest and clears the focus request (D-18)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Supplier ranking rows are buttons named «Ver facturas de {proveedor}» that add the supplier filter with the same scroll and focus; the Ver todos dialog rows stay non-interactive"
    requirement: DASH-08
    verification:
      - kind: automated_ui
        ref: "src/features/dashboard/DashboardTab.test.tsx#a click on a supplier ranking row filters by that supplier and goes to the Facturas table"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/SupplierRanking.test.tsx#keeps the dialog rows non-interactive: no row reveals invoices there (D-18)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Facturas section scroll behavior: block start, auto under prefers-reduced-motion or without matchMedia, 72 px top margin (124 px below 640 px), preventScroll heading focus, no replay of the value present at mount"
    requirement: DASH-08
    verification:
      - kind: unit
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable reveal request (D-18, DASH-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real-browser feel of the row hover, focus ring, 44 px touch target and the smooth scroll landing under the sticky header"
    requirement: DASH-08
    verification: []
    human_judgment: true
    rationale: "jsdom asserts the classes and the scrollIntoView arguments, not the rendered geometry or the sticky-header clearance"

duration: 17min
completed: 2026-10-18
status: complete
---

# Phase 03 Plan 11: Category and supplier rows open their invoices Summary

**Category and top-10 supplier rows are now native buttons that add a removable filter chip and scroll to the Facturas table, backed by a `revealRequest` counter in the session store and a scroll-and-focus effect on the table heading (D-18, DASH-08).**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-18T03:32:00Z
- **Completed:** 2026-10-18T03:49:49Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- `sessionStore` gained `revealRequest` (0 at start, reset by `clearAll`), `revealCategory(key)` and `revealSupplier(rfc)`: each adds its value to the matching filter set (unchanged when already selected), clears any pending `focusRequest` and bumps the counter.
- `InvoiceTable` reacts to a bumped `revealRequest`: `scrollIntoView({ block: "start" })` on the section (smooth, or auto when reduced motion matches or `matchMedia` is missing) and focus on the «Facturas ({n})» heading with `preventScroll`. The section carries `scroll-mt-[72px]` and `max-sm:scroll-mt-[124px]`; the heading has `tabIndex={-1}`. No row is expanded.
- `CategorySpend` and `SupplierRanking` rows are full-width native buttons (min height 68 px, `hover:bg-secondary`, 2 px focus ring) with the accessible names «Ver facturas de la categoría {nombre}» and «Ver facturas de {proveedor}». The supplier name now wraps instead of truncating; `TruncatedText` is no longer used in the ranking.
- Integration tests in `DashboardTab.test.tsx` prove the whole chain: click, chip in the polite live region, scroll, heading focus, removable chip.

## Task Commits

1. **Task 1: Reveal actions in the store and the Facturas scroll-and-focus effect** (TDD)
   - RED `485c11d` (test): 8 store tests and 8 table tests failing on the missing reveal API
   - GREEN `c073b59` (feat)
2. **Task 2: Category and supplier rows as buttons** (TDD)
   - RED `9c9d8cc` (test): 25 failing tests (messages, row buttons, integration, updated ranking expectations)
   - GREEN `4855ae4` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## TDD Gate Compliance

RED and GREEN commits exist for both tasks, in order. No REFACTOR commit was needed.
RED evidence: each RED run failed on the planned behavior (missing `revealCategory`/`revealSupplier`/`revealRequest`, missing `viewCategoryInvoicesAria`/`viewSupplierInvoicesAria`, rows without a button), not on syntax or load errors. The RED commits are not type-clean by construction (they call store methods that did not exist yet), which is inherent to test-first on a new API; every GREEN commit passes `pnpm typecheck`.

## Files Created/Modified

- `src/stores/sessionStore.ts` - `revealRequest`, `revealCategory`, `revealSupplier`, reset in `clearAll`
- `src/features/invoices/InvoiceTable.tsx` - scroll margins, focusable heading, reveal effect
- `src/features/dashboard/CategorySpend.tsx` - row button, `revealCategory` on click
- `src/features/dashboard/SupplierRanking.tsx` - row button, `revealSupplier` on click, wrapping name
- `src/features/dashboard/DeltaLine.tsx` - spans instead of divs (valid inside a button)
- `src/lib/copy/messages.ts` - `viewCategoryInvoicesAria`, `viewSupplierInvoicesAria`
- Test files for each of the above plus `DashboardTab.test.tsx` (new integration describe, updated ranking button names)

## Decisions Made

See `key-decisions` in the frontmatter. No ambiguity required a user question: the plan, the UI-SPEC lines 359-366 and the accessibility floor cover every behavior implemented.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Row buttons would have held block elements (invalid HTML)**
- **Found during:** Task 2
- **Issue:** The plan asks for one button holding three lines. Putting `div` and `p` elements inside a `button` is invalid HTML (a button accepts phrasing content only), and `DeltaLine` rendered a `div`.
- **Fix:** The row lines are `span` elements with block/flex classes. `DeltaLine.tsx` (not in the plan's `files_modified`) now renders spans; its test ids and classes are unchanged, so the KPI cards are unaffected.
- **Files modified:** `src/features/dashboard/CategorySpend.tsx`, `src/features/dashboard/SupplierRanking.tsx`, `src/features/dashboard/DeltaLine.tsx`
- **Verification:** all dashboard tests and `pnpm verify` pass
- **Committed in:** `4855ae4`

### Interpretation note (no code deviation)

The plan's behavior line «The "Ver todos" dialog rows have no buttons» was read as «no reveal buttons». The dialog's name cell still uses `TruncatedText`, whose own trigger is a button, and the plan says the dialog list "stays as it is". The test asserts no button named «Ver facturas de …» in the dialog body and that clicking a dialog row changes no filter.

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Valid markup inside the row buttons; no scope creep (one extra one-line-class file touched).

## Issues Encountered

- `pnpm lint` reports one pre-existing warning (`Unused eslint-disable directive` in `src/lib/client/navigation.ts`), unrelated to this plan and left alone (0 errors).
- The harness blocked some compound shell commands (heredocs, `git` combined with other commands) inside the worktree; they were split or replaced by the Edit tool. No effect on the result.

## Verification

- `pnpm exec vitest run src/stores src/features/dashboard src/features/invoices src/lib`: 20 files, 678 tests passed.
- `pnpm verify` (lint, typecheck, test, build): exit 0; 55 test files passed, 3 skipped (1424 tests passed, 8 skipped). Single full-suite run was enough; no timeouts, so the `--maxWorkers=3 --testTimeout=30000` rerun was not needed.
- `pnpm tsc --noEmit` (through `pnpm typecheck`) and `pnpm eslint .` (through `pnpm lint`): 0 errors.
- Acceptance greps: `revealRequest` x5 and `scroll-mt-[72px]` x1 in `InvoiceTable.tsx`; `revealCategory` x3 / `revealSupplier` x2 in the store; `revealCategory` x2 in `CategorySpend.tsx`; `revealSupplier` x2 in `SupplierRanking.tsx`; `TruncatedText` x0 in `SupplierRanking.tsx`; no raw-HTML injection in `src/features/dashboard`.

## Known Stubs

None.

## Threat Flags

None. T-03-22 is mitigated: names reach the DOM only as React text nodes and `aria-label` attribute values; the acceptance grep for raw-HTML injection passes, and hostile-name tests exist for both rows.

## Observation for a later plan

A button with an `aria-label` hides its inner text from assistive tech, so a screen reader announces «Ver facturas de …» but not the amount, share or variation shown in the row. The plan and UI-SPEC prescribe exactly this name, so it was kept; adding `aria-describedby` to the amount and caption lines would restore that information if the user wants it.

## Next Phase Readiness

DASH-08 and the click part of E6 are done, completing ROADMAP criterion 3. Plan 03-17 repeats the raw-HTML grep over `src/features`.

## Self-Check: PASSED

- Modified files exist on disk (store, table, both dashboard blocks, `DeltaLine.tsx`, messages and their tests).
- Commits `485c11d`, `c073b59`, `9c9d8cc`, `4855ae4` are ancestors of HEAD; `git rev-list --count` from the recorded base is 4.

---
*Phase: 03-categor-as-propias-y-exportaci-n-a-excel*
*Completed: 2026-10-18*
