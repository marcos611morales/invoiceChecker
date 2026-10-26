---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 07
subsystem: ui
tags: [recharts, scatter-chart, price-history, series-tokens, big.js, accessibility]

requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: "comparePrices/ProductComparison (05-02..03), PricesTable + ProductDetail panel (05-04, 05-06), format helpers"
provides:
  - "history.ts: stable store slots (assignSlots), literal-date day numbers (dayNumber) and per-store history series (historySeries)"
  - "usePricesView.allPurchases (every filter ignored) and historySlots (product id to store RFC to slot)"
  - "HistoryChart: ScatterChart with a joined line per store, custom markers by slot, per-purchase tooltip, HTML legend, accessible label"
  - "--series-1..6 tokens (light and dark) and --color-series-1..6 theme mappings"
  - "format.ts longDateLabel and monthTickLabel; es.ts/messages.ts history copy"
affects: [05-08 (reuses allPurchases for the D-31 default), 05-12 (browser check of chart geometry and both themes)]

actuals:
  tokens: 16700
  tasks: 2
  commits: 2
plan_head_before: e68032f077ec7f67fb7f195a8c020e1aca4f7c4c
plan_head_after: 61ddde67f54c46d9f3e526f2ce9ccc8981b0a65a

tech-stack:
  added: []
  patterns:
    - "Chart datum carries pre-formatted texts from exact Big values; the numeric y is geometry only, and the tooltip reads it through a type guard (no cast)"
    - "Recharts shape passed as a React element (cloned with cx/cy) with a transparent 24 px hit circle"
    - "Static ChartConfig keyed by slot (tienda1..tienda6, otras); store names are React text only"
    - "Slot colors in HTML (legend, tooltip) via literal Tailwind classes text-series-N, mapped through @theme inline"

key-files:
  created:
    - src/domain/prices/history.ts
    - src/domain/prices/history.test.ts
    - src/features/prices/HistoryChart.tsx
    - src/features/prices/HistoryChart.test.tsx
  modified:
    - src/features/prices/usePricesView.ts
    - src/features/prices/PreciosTab.tsx
    - src/features/prices/PricesTable.tsx
    - src/features/prices/ProductDetail.tsx
    - src/app/globals.css
    - src/lib/format.ts
    - src/lib/format.test.ts
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - src/features/prices/PreciosTab.test.tsx
    - src/features/prices/PurchasesList.test.tsx

key-decisions:
  - "D-33 followed: ScatterChart (item tooltips) with one Scatter per store, line + lineType joint + lineJointType linear for the six colored slots, no line for the folded 'otras' series"
  - "Slots come from the unfiltered comparison (comparePrices over allPurchases), so a date or supplier filter never repaints a surviving store; a store absent from the unfiltered list falls into 'Otras tiendas' (A-7)"
  - "historySlots/slots props on PricesTable/ProductDetail are optional with an empty-map default (every store would fold into 'Otras tiendas'); PreciosTab always passes the real map. This keeps the existing ~40 call sites in tests unchanged"
  - "Month names for longDateLabel and monthTickLabel come from the existing static Spanish arrays (like the rest of format.ts), not Intl, so 'sep' and 'septiembre' never depend on ICU data"
  - "The aria-label dates use the long form ('del 5 de enero de 2025 al 28 de mayo de 2025'); the plan only said {fecha}"

patterns-established:
  - "A chart derived from ProductComparison is computed inside the component with useMemo and returns null when nothing can be plotted; the host decides whether to render the section heading"

requirements-completed: [PREC-06]

coverage:
  - id: D1
    description: "Stable per-store series slots from the unfiltered purchases (es collator, six slots then 'otras'), literal-date day numbers, date-ordered per-store series with not-normalized purchases excluded"
    requirement: PREC-06
    verification:
      - kind: unit
        ref: "src/domain/prices/history.test.ts"
        status: pass
      - kind: integration
        ref: "src/features/prices/PreciosTab.test.tsx#keeps the color slot of a store when the supplier filter hides the other store"
        status: pass
    human_judgment: false
  - id: D2
    description: "ScatterChart history in the opened product: joined line per store, marker per purchase, tooltip per purchase naming the store, HTML legend with glyphs, role img label, single-purchase and excluded captions, static chart config"
    requirement: PREC-06
    verification:
      - kind: unit
        ref: "src/features/prices/HistoryChart.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Visual result of the chart in a real browser: marker shapes and sizes, ring, line weight, tick thinning, Y/X padding, light-mode contrast of series 3 to 5, both themes"
    verification: []
    human_judgment: true
    rationale: "jsdom draws the SVG at a fixed mocked size but cannot judge legibility, overlap or contrast; Plan 05-12 holds the real-browser check"

duration: 25min
completed: 2026-10-26
status: complete
---

# Phase 05 Plan 07: Price history per store Summary

**Per-store price history inside the opened product: a Recharts ScatterChart with a joined line and a distinct marker shape per store, a tooltip per purchase, stable store colors that survive filters, an HTML legend and the accessible label (PREC-06, D-24, D-33).**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-26
- **Tasks:** 2
- **Files modified:** 16 (4 created, 12 modified)

## Accomplishments

- `history.ts` (pure, exact `Big`): `assignSlots` orders the stores of a product with the `es` collator (RFC breaks ties) into `tienda1..tienda6` and `otras`; `dayNumber` reads only the literal `YYYY-MM-DD` and rejects impossible dates; `historySeries` builds date-ordered series from compared purchases, counts the rest as excluded and reports the first and last plotted date.
- `usePricesView` now exposes `allPurchases` (category scope with an empty selection, every filter ignored) and `historySlots`, computed from one unfiltered `comparePrices`, so a surviving store keeps its color when a date or supplier filter hides another store (verified end to end in the Precios tab test).
- `HistoryChart` (D-33): one `Scatter` per series, 2 px linear joint line for the colored slots and none for `otras`; custom markers (circle, square, diamond, triangle, inverted triangle, pentagon, plus) at 10 px with a 2 px background ring and a 24 px transparent hit circle; compact es-MX Y ticks 64 px wide with a 10 % padded domain not forced to zero; month ticks «may 2025» that thin out above 12; unit title, legend, role img label and the two captions.
- Series tokens `--series-1..6` in light and dark with their `--color-series-N` mappings; the chart config is static (T-05-17) and a test feeds a hostile store name to prove it never reaches the style block.
- The panel shows section «Historial de precios» between the per-store table and the purchases, only when a purchase is compared.

## Task Commits

1. **Task 1: Pure history series and stable store slots** - `bd0083a` (feat)
2. **Task 2: ScatterChart history, tooltip, legend, accessible text, panel wiring** - `61ddde6` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `src/domain/prices/history.ts` - slots, day numbers and per-store series
- `src/domain/prices/history.test.ts` - slot order, overflow, `__proto__`, day numbers, series, filter-stable slots
- `src/features/prices/HistoryChart.tsx` - chart, markers, tooltip, legend, captions, static config
- `src/features/prices/HistoryChart.test.tsx` - legend, label, captions, ScatterChart structure, hover tooltip, static config, tooltip guard
- `src/features/prices/usePricesView.ts` - `allPurchases`, `historySlots`
- `src/features/prices/{PreciosTab,PricesTable,ProductDetail}.tsx` - slot threading and the history section
- `src/app/globals.css` - series tokens
- `src/lib/format.ts`, `format.test.ts` - `longDateLabel`, `monthTickLabel`
- `src/lib/copy/{es,messages}.ts`, `messages.test.ts` - history copy and messages
- `src/features/prices/PreciosTab.test.tsx`, `PurchasesList.test.tsx` - integration test for stable slots; the panel heading list now includes «Historial de precios»

## Decisions Made

See `key-decisions` in the frontmatter. In short: D-33 followed as written; slots from the unfiltered comparison; optional slot props with a safe empty default; static Spanish month arrays instead of Intl; long dates in the aria-label.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Infinite loop in the month-tick walk for an empty series**
- **Found during:** Task 2 (first run of HistoryChart.test.tsx hung)
- **Issue:** `plotArea` ran inside `useMemo` before the empty-case early return; with no points the bounds were `Infinity`/`-Infinity` and `monthStartTicks` never ended.
- **Fix:** `plotArea` returns `null` for no data, `monthStartTicks` returns `[]` for non-finite bounds, and the component returns `null` when `plot` is `null`.
- **Files modified:** src/features/prices/HistoryChart.tsx
- **Verification:** the "renders no chart for a product with zero normalized purchases" test passes.
- **Committed in:** 61ddde6

**2. [Rule 3 - Blocking] Existing test pinned the panel's section list**
- **Found during:** Task 2 (`PurchasesList.test.tsx` "shows the purchases section after the per-store table")
- **Issue:** The new section is rendered between the per-store table and the purchases, as the plan wires it, so the old two-heading expectation failed.
- **Fix:** the expected headings now include «Historial de precios».
- **Files modified:** src/features/prices/PurchasesList.test.tsx
- **Committed in:** 61ddde6

### Implementation notes (not behavior changes)

- `dayNumber` builds the date with `setUTCFullYear` + UTC getters instead of `Date.UTC(...)` so years below 100 are not remapped to 19xx; the result equals `Date.UTC(y, m - 1, d) / 86400000` for every normal year (tested). The acceptance grep for `Date.UTC` in history.ts matches only because the comment names it.
- `PreciosTab.test.tsx` and `PurchasesList.test.tsx` are outside the plan's `files_modified` list; they were touched for the integration test and the heading expectation above.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking test expectation)
**Impact on plan:** No scope change; both fixes were needed for correctness of the planned behavior.

## Issues Encountered

- The first test run hung in the infinite loop above. The test worker (PID 13243, 100 % CPU) could not be killed from the sandbox (kill was denied by the permission classifier), so it may still be running in the background of this machine and can be killed by the user with `kill 13243`.
- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable). It is outside this plan and was left alone.

## Verification

- `pnpm exec vitest run src/domain/prices src/features/prices src/lib` passes.
- `pnpm verify` (lint, typecheck, vitest, build) exits 0: 113 files passed, 1 skipped, 3350 tests passed, 10 skipped (run with `FACTURAS_DIR` set to the real sample).
- All task acceptance criteria re-run and passing (grep counts: `series-6` 3, `tienda6` 3, `isAnimationActive={false}` 1, `role="img"` 1, `ScatterChart` 4, `D-33` 2, `HistoryChart` in ProductDetail 2; `history.ts` has no `@/(lib|stores|features|components)` import).
- Chart geometry as drawn in a real browser, the overlap of markers at the same date and price, and the light-mode contrast of slots 3 to 5 are not judged here (jsdom); they belong to Plan 05-12.

## Known Stubs

None.

## Threat Flags

None. The threat register items were applied: T-05-17 (static config keys, test with a hostile store name), T-05-18 (store names and folios only as React text, tooltip type guard instead of a cast), T-05-SC (nothing installed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `allPurchases` is ready for the D-31 default «no comparable» in Plan 05-08.
- Plan 05-12 should open a product with 2 and 7 stores in both themes and check marker legibility, tick thinning and the tooltip hit area.

## Self-Check: PASSED

---
*Phase: 05-comparaci-n-de-precios-entre-tiendas*
*Completed: 2026-10-26*
