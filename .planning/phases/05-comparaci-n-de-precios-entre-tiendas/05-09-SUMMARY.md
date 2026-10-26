---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 09
subsystem: ui
tags: [prices, comparability, row-menu, undo, live-region, focus, base-ui, zustand]

requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: "usePricesView comparability and hiddenCount, store setPriceOverride / restorePriceOverride (05-08); BackupSummary.corrections / overrides (05-02); PricesTable expander column (05-06)"
provides:
  - "«Mostrar los no comparables ({n})» checkbox in the tools row; hidden rows muted with the «No comparable» badge, the reason caption, dashes and no expander"
  - "Third empty state when every product with purchases is hidden, and the storage write-failure Alert in the tab"
  - "«⋯» row menu (Tooltip, one item per state) that marks or unmarks at once, toasts with «Deshacer» (6 s) and announces in a polite live region"
  - "Focus rules: heading «Precios» when the marked row leaves the list, the row's «⋯» button when it stays"
  - "replaceSummaryText ending with «, {n} correcciones de contenido, {m} marcas de no comparable»"
affects: [05-10, 05-11, 05-12]

actuals:
  tokens: 15500
  tasks: 2
  commits: 4
plan_head_before: f9c93ca26deac048c387266159f639114f607ae1
plan_head_after: 7ed5bd75919426e0d52adb09803459ffb2b432bd

tech-stack:
  added: []
  patterns:
    - "PricesTable reads comparability from a prop (default: every row compared) and calls the store actions itself; the tab only supplies showHidden, comparableCount and onAnnounce"
    - "Focus after a menu action goes through the menu's finalFocus: a ref set by the action decides between the tab heading and the trigger, so base-ui's own focus return cannot overwrite it"
    - "PRICES_TITLE_ID lives in focusTargets.ts (re-exported by PreciosTab) so the table can focus the heading without importing the tab"

key-files:
  created:
    - src/features/prices/focusTargets.ts
  modified:
    - src/features/prices/PreciosTab.tsx
    - src/features/prices/PricesTable.tsx
    - src/features/prices/PreciosTab.test.tsx
    - src/features/prices/PricesTable.test.tsx
    - src/features/prices/ProductDetail.test.tsx
    - src/features/categories/BackupControls.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "A hidden row keeps the Tiendas count (muted) and shows «—» in Cheapest, Precio and Ahorro, and drops its other badges (por pieza, no normalizadas); its menu offers «Volver a comparar»"
  - "In the all-hidden state the savings card is not rendered (UI-SPEC: state 3 keeps the filter bar and the tools row only)"
  - "«Quedan {n} productos» counts the compared products within the filters after the change, search ignored; the singular reads «Queda 1 producto.»"
  - "When the store refuses a change (unknown product or the 2,000-mark limit) the menu does nothing visible: no toast, no announcement, no copy invented (the UI-SPEC has no overrides-limit text)"
  - "«Deshacer» also clears the live region, so a stale «marcado como no comparable» sentence is not left for screen-reader browsing"

patterns-established:
  - "Non-comparable rows: text-muted-foreground, outline Badge, 12px muted reason caption, never opacity"

requirements-completed: [PREC-03, PREC-05]

coverage:
  - id: D1
    description: "Hidden products stay out of the table while the checkbox is off, are counted in «Mostrar los no comparables ({n})» (zero included) and appear muted with badge, default or user reason, dashes and no expander when it is on"
    requirement: PREC-03
    verification:
      - kind: unit
        ref: "src/features/prices/PreciosTab.test.tsx#Mostrar los no comparables (PREC-03, D-07, D-18, D-22)"
        status: pass
    human_judgment: false
  - id: D2
    description: "All-hidden empty state without a button, filter bar and tools row kept; storage Alert while writes fail and the mark still applies in memory"
    requirement: PREC-03
    verification:
      - kind: unit
        ref: "src/features/prices/PreciosTab.test.tsx#Mostrar los no comparables (PREC-03, D-07, D-18, D-22)"
        status: pass
      - kind: unit
        ref: "src/features/prices/PreciosTab.test.tsx#Row menu: marking a product as no comparable (PREC-03, D-18, D-19, E5)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Row menu marks or unmarks at once with «Deshacer» restoring the previous state exactly, toast and announcement copy with the 60 and 40 character cuts, card total follows"
    requirement: PREC-05
    verification:
      - kind: unit
        ref: "src/features/prices/PricesTable.test.tsx#PricesTable row menu (D-18, D-19, E5)"
        status: pass
      - kind: unit
        ref: "src/features/prices/PreciosTab.test.tsx#Row menu: marking a product as no comparable (PREC-03, D-18, D-19, E5)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Focus lands on the Precios heading when the row leaves and stays on the «⋯» button when it stays (jsdom); real-browser focus return after the menu closes and the visual muted look are not covered by an automated test"
    requirement: PREC-03
    verification:
      - kind: unit
        ref: "src/features/prices/PricesTable.test.tsx#PricesTable row menu (D-18, D-19, E5)"
        status: pass
    human_judgment: true
    rationale: "Focus handoff between a closing Base UI menu and a removed row is verified in jsdom only; a keyboard/screen-reader pass in a real browser and the muted contrast look need a person"
  - id: D5
    description: "Replace-settings summary ends with corrections and «no comparable» marks, singular, plural and zero as «0 …»"
    requirement: PREC-03
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#settings file messages (D-07, D-08)"
        status: pass
      - kind: unit
        ref: "src/features/categories/BackupControls.test.tsx#BackupControls: upload of a valid file (D-08)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-26
status: complete
---

# Phase 5 Plan 09: «No comparable» mark in the Precios tab Summary

**The Precios tab now shows, reveals and changes the «no comparable» mark: a counted «Mostrar los no comparables» checkbox with muted, explained hidden rows, a «⋯» row menu that marks or unmarks at once with «Deshacer», polite announcements and focus rules, and a replace-settings summary that counts corrections and marks.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 2 (both TDD, RED then GREEN commit each)
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments
- Checkbox «Mostrar los no comparables ({n})» (session state, not persisted) in the tools row beside the count line; `n` is `hiddenCount`, «(0)» stays visible. The table receives the comparable rows, plus the hidden ones when the box is on; the card keeps counting comparable products only.
- Hidden rows: muted name, outline «No comparable» badge, the default or user reason caption, «—» in Tienda más barata, Precio and Ahorro, no expander.
- All-hidden state: heading and body from the UI-SPEC with no button; filter bar and tools row stay, the savings card is not shown. The existing write-failure Alert renders between the captions and the card while `writeFailed` holds.
- `RowMenu` in the new last column («Acciones», sr-only): Tooltip plus DropdownMenu with the one item of the row's state. It calls `setPriceOverride(id, !hidden, defaultComparable)`, toasts for 6 s with «Deshacer» (`restorePriceOverride(id, previous)`) and announces through `onAnnounce` into an always-mounted `aria-live="polite"` sr-only region.
- Focus: the menu's `finalFocus` returns the Precios heading when the row leaves (mark with the box off) and the trigger otherwise.
- `replaceSummaryText` appends «, {n} correcciones de contenido, {m} marcas de no comparable» with singular forms and `0 …` for zero.

## Task Commits

1. **Task 1 RED: failing tests for checkbox, hidden rows, empty state, notice** - `24f8d74` (test)
2. **Task 1 GREEN: checkbox, de-emphasised rows, all-hidden empty state, storage Alert** - `e488247` (feat)
3. **Task 2 RED: failing tests for the row menu, undo, announcements, focus, summary** - `c8b08f8` (test)
4. **Task 2 GREEN: row menu with undo, announcements, focus and the summary sentence** - `7ed5bd7` (feat)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `src/features/prices/PreciosTab.tsx` - checkbox, hidden-row filtering, all-hidden state, storage Alert, live region
- `src/features/prices/PricesTable.tsx` - hidden rows, `RowMenu`, actions column, store calls, toast and announcements
- `src/features/prices/focusTargets.ts` - `PRICES_TITLE_ID` (re-exported by `PreciosTab`)
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - static copy, `showHiddenLabel`, `priceMenuAria`, toasts, announcements, extended `replaceSummaryText`
- Tests: `PreciosTab.test.tsx`, `PricesTable.test.tsx`, `messages.test.ts`, plus expectation updates in `ProductDetail.test.tsx` and `BackupControls.test.tsx`

## Decisions Made
See `key-decisions` above. The two worth a human look: the savings card is hidden in the all-hidden state, and a store refusal (limit of 2,000 marks) is silent because the UI-SPEC defines no copy for it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests that assert the old table shape and summary text**
- **Found during:** Task 2
- **Issue:** The new actions column changes the panel `colSpan` (6 to 7) in `ProductDetail.test.tsx` and the header list in `PreciosTab.test.tsx`; the longer replace summary breaks four literal assertions in `BackupControls.test.tsx`. These files are outside the plan's list.
- **Fix:** Updated the expectations to the new, specified behavior.
- **Files modified:** `src/features/prices/ProductDetail.test.tsx`, `src/features/categories/BackupControls.test.tsx`
- **Verification:** `pnpm verify` exits 0.
- **Committed in:** `7ed5bd7`

**2. [Rule 3 - Blocking] `PRICES_TITLE_ID` moved to `focusTargets.ts`**
- **Found during:** Task 2
- **Issue:** The table must focus the heading, but `PreciosTab` imports the table, so importing the id from the tab would be a cycle.
- **Fix:** New `focusTargets.ts` holds the constant; `PreciosTab` re-exports it, so the plan's `PreciosTab` export still holds.
- **Committed in:** `e488247`

---

**Total deviations:** 2 auto-fixed (both blocking, no scope change)
**Impact on plan:** None on behavior; one extra tiny file.

## Issues Encountered
- A first storage-failure test set `writeFailed` by hand, but a successful localStorage write in jsdom flips it back; the test now makes `Storage.prototype.setItem` throw, which is the real condition.
- `pnpm lint` still reports the one pre-existing warning in `src/lib/client/navigation.ts`, unrelated and untouched.

## Known Stubs

None. Every value shown comes from the view, the store or static copy.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 05-10 to 05-12 can rely on `PricesTable` accepting `comparability`, `showHidden`, `comparableCount` and `onAnnounce`, and on the actions column being last (`colSpan` is `columns.length + 2`).
- Open for the human: the behavior when the override list is full (2,000 marks) is silent; a UI-SPEC line for it would let the menu say so.

## Self-Check: PASSED

- Files exist: `focusTargets.ts`, `PreciosTab.tsx`, `PricesTable.tsx`, `05-09-SUMMARY.md`
- Commits `24f8d74`, `e488247`, `c8b08f8`, `7ed5bd7` are ancestors of HEAD
- `pnpm verify` (lint, typecheck, full vitest, next build) exits 0; acceptance greps for both tasks pass

---
*Phase: 05-comparaci-n-de-precios-entre-tiendas*
*Completed: 2026-10-26*
