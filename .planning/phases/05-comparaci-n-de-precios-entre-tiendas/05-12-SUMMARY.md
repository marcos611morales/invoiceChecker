---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 12
subsystem: testing
tags: [playwright, e2e, cfdi, privacy, responsive, recharts]

requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: "Precios tab, price history chart and content editor (plans 05-01 to 05-11)"
provides:
  - "Synthetic CFDI 4.0 XML builder for tests (buildPriceXml) with exact big.js totals"
  - "Production-build Playwright checks of the whole Precios flow, its privacy guarantees and persistence"
  - "Responsive width checks (360, 640, 767, 768, 1024 px) and held-out screenshots for the end-of-phase review"
affects: [phase-05-verification, end-of-phase human review]

commits: 2
plan_head_before: c3f54dc3c8c9a09f009aa05cd36616f6a98ba190
plan_head_after: e77239e9e1efa8874534892a9fed7db0d82954ad

actuals:
  tokens: 9700
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Synthetic invoice folders generated at runtime in the OS temp dir, one per UI-state scenario"
    - "Tooltip assertions through [data-slot=tooltip-content][data-open] (the closing tooltip stays in the DOM while it animates out)"

key-files:
  created:
    - tests/support/pricesXml.ts
    - tests/support/pricesXml.test.ts
    - e2e/prices.spec.ts
    - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/deferred-items.md
  modified: []

key-decisions:
  - "Below 768 px the tab list is asserted to be a scroll container (overflow-x auto) that overflows at 360 and 640 px; at 767 px the six tabs still fit (702 px), so only the in-view check applies there"
  - "A unit test of the builder was added (tests/support/pricesXml.test.ts) so a broken fixture fails in vitest before it fails in the browser"

patterns-established:
  - "The e2e spec never reads Facturas/: every RFC, name, folio, UUID, date and amount is invented in the spec"

requirements-completed: [PREC-01, PREC-02, PREC-03, PREC-04, PREC-05, PREC-06]

coverage:
  - id: D1
    description: "Production build, two synthetic suppliers: the savings card with «estimado», grouped milk with cheapest store, «/ L» median and saving, and per-piece eggs with their badge"
    requirement: "PREC-01"
    verification:
      - kind: e2e
        ref: "e2e/prices.spec.ts#Precios: ahorro estimado, leche agrupada y huevo por pieza"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fuel product hidden by default, shown with «Mostrar los no comparables (1)» and its reason, restored by «Volver a comparar» and hidden again by «Deshacer»"
    requirement: "PREC-03"
    verification:
      - kind: e2e
        ref: "e2e/prices.spec.ts#Precios: ahorro estimado, leche agrupada y huevo por pieza"
        status: pass
    human_judgment: false
  - id: D3
    description: "Opened milk product: per-store table with «Más barata», history chart with 4 markers for 4 normalized purchases and its legend, content section and purchases list"
    requirement: "PREC-06"
    verification:
      - kind: e2e
        ref: "e2e/prices.spec.ts#Precios: ahorro estimado, leche agrupada y huevo por pieza"
        status: pass
    human_judgment: false
  - id: D4
    description: "Capturing the content of an unsized description changes the comparison at once ($21.50 to $22.00 per liter, saving $107.00 to $96.00) and the correction survives a reload plus reloading the folder"
    requirement: "PREC-05"
    verification:
      - kind: e2e
        ref: "e2e/prices.spec.ts#Precios: ahorro estimado, leche agrupada y huevo por pieza"
        status: pass
    human_judgment: false
  - id: D5
    description: "Privacy: no request leaves the origin, none carries XML, none goes to /api/llm; browser storage holds no synthetic folio, UUID, date or invoice total"
    requirement: "PREC-04"
    verification:
      - kind: e2e
        ref: "e2e/prices.spec.ts#Precios: ahorro estimado, leche agrupada y huevo por pieza"
        status: pass
    human_judgment: false
  - id: D6
    description: "At 360, 640, 767, 768 and 1024 px the page never scrolls sideways; below 768 px the tab list is its own scroll container with the active «Precios» trigger in view"
    verification:
      - kind: e2e
        ref: "e2e/prices.spec.ts#a 360, 640, 767, 768 y 1024 px la página de Precios no se desplaza de lado"
        status: pass
    human_judgment: false
  - id: D7
    description: "E4 long-text: 60-character product name and 80-character supplier names clamp to two lines then truncate, with the full text on hover and keyboard focus (screenshots e4-*.png)"
    verification:
      - kind: e2e
        ref: "e2e/prices.spec.ts#E4 texto largo"
        status: pass
    human_judgment: true
    rationale: "Backstop truth: the geometry is asserted, but the look of the wrapped and truncated text is judged on the held-out screenshots at the end of the phase"
  - id: D8
    description: "E7 populated: five stores with two overlapping markers; legend shapes distinct, every series reachable by tooltip in light mode (screenshots e7-*.png). The overlapped circle of series 1 is fully covered by the square of series 2 at the shared point"
    verification:
      - kind: e2e
        ref: "e2e/prices.spec.ts#E7 poblado"
        status: pass
    human_judgment: true
    rationale: "Backstop truth, and the screenshot shows one glyph at the shared point instead of two; whether that is acceptable is a visual judgment (see deferred-items.md)"
  - id: D9
    description: "E8 long-text: a 120-character description clamps to two lines in the content table and the pencil's accessible name is the description cut at 60 characters with an ellipsis (screenshot e8-1024-contenido.png)"
    verification:
      - kind: e2e
        ref: "e2e/prices.spec.ts#E8 texto largo"
        status: pass
    human_judgment: true
    rationale: "Backstop truth: the clamp and the accessible name are asserted; the look of the wrapped description is judged on the held-out screenshot"

duration: 18min
completed: 2026-10-26
status: complete
---

# Phase 5 Plan 12: Production-build proof of the Precios tab Summary

**Playwright checks on the production build prove the whole Precios flow on synthetic CFDI folders (savings card, grouped milk, per-piece eggs, hidden fuel and its undo, store table, history chart markers, content capture that survives a reload), that nothing leaves the browser or reaches storage, the responsive widths, and leave 11 held-out screenshots for the end-of-phase review.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-26T19:10:00Z
- **Completed:** 2026-10-26T19:28:00Z
- **Tasks:** 2
- **Files modified:** 3 created in code (builder, builder test, e2e spec) plus the deferred-items log

## Accomplishments

- `buildPriceXml` writes a CFDI 4.0 Ingreso (cfdi: prefix, TFD 1.1 timbre, ObjetoImp 01) from fake suppliers, with SubTotal, Descuento and Total reconciled exactly with big.js strings and XML-escaped attributes; a jsdom unit test parses its output with the real `parseCfdi`.
- `e2e/prices.spec.ts` flow test: savings card with «estimado»; «Leche entera» at «$21.50 / L» with a $107.00 saving and «1 compra no normalizada»; «Huevo» with the per-piece badge; «Gasolina» hidden, listed with its reason, restored and hidden again with «Deshacer»; the milk detail with «Más barata», a chart with exactly 4 markers for 4 purchases, legend and purchases list; capturing «LECHE DESLACTOSADA» as 1 L moves the row to «$22.00 / L» and $96.00 and survives a page reload plus reloading the folder.
- Privacy assertions over the whole flow: `expectNoXmlLeavesTheBrowser`, no URL containing `/api/llm`, and a scan of every localStorage and sessionStorage entry that finds none of the synthetic folios, UUIDs, dates or invoice totals (with a positive control that the settings are there).
- Widths 360, 640, 767, 768, 1024 px with a product open: the page never scrolls sideways; the active «Precios» trigger is in view after a script click (the shell brings it into view on its own); the list overflows inside itself at 360 and 640 px and fits at 768 and 1024 px.
- Held-out states captured under `test-results/phase5-ui-states/` (not committed): E4 at 1024 and 360 px, E7 light and dark plus a series-3 tooltip, E8 at 1024 px.

## Task Commits

1. **Task 1: Synthetic CFDI builder and the production-build Precios flow with privacy and persistence checks** - `d46e662` (test)
2. **Task 2: Responsive widths and held-out UI-state screenshots for the end-of-phase review** - `e77239e` (test)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `tests/support/pricesXml.ts` - `PriceLine`, `PriceInvoiceSpec`, `buildPriceXml`
- `tests/support/pricesXml.test.ts` - parses the builder output with `parseCfdi` (totals, escaping, optional Descuento)
- `e2e/prices.spec.ts` - five production-build tests: the main flow, widths, E4, E7, E8
- `.planning/phases/05-comparaci-n-de-precios-entre-tiendas/deferred-items.md` - out-of-scope findings (see below)

## Decisions Made

- The width check for the tab list distinguishes «is a scroll container» (asserted below 768 px) from «must overflow» (asserted at 360 and 640 px only), because at 767 px the six tabs fit in 702 px.
- A vitest unit test of the builder was added beyond the plan's file list; it is small and catches fixture errors without a browser.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan assertion «below 768 px the tab list's scrollWidth exceeds its clientWidth» is false at 767 px**
- **Found during:** Task 2 (widths test)
- **Issue:** at 767 px the list's scrollWidth equals its clientWidth (702 px): the six tabs fit, so there is nothing to scroll. The list is still its own scroll container (`max-md:overflow-x-auto`).
- **Fix:** assert `overflow-x` is `auto` or `scroll` below 768 px, assert the overflow only at 360 and 640 px (where the tabs cannot fit), and assert the active trigger lies inside the list at every width below 768 px.
- **Files modified:** e2e/prices.spec.ts
- **Verification:** the widths test passes on the production build, repeated three times
- **Committed in:** e77239e

**2. [Rule 3 - Blocking] `new Big(0)` throws under the app's strict big.js mode**
- **Found during:** Task 1
- **Issue:** importing `pricesFactory` loads `domain/accounting/decimal`, which sets `Big.strict`; numbers are then rejected.
- **Fix:** every `Big` in the builder and the spec is built from strings.
- **Files modified:** tests/support/pricesXml.ts, e2e/prices.spec.ts
- **Committed in:** d46e662

**3. [Rule 1 - Bug] Test selectors that raced or matched too much**
- **Found during:** Tasks 1 and 2
- **Issue:** the toast text also appears in the polite announcement (strict-mode violation, passing only when the announcement had not rendered yet); the base-ui tooltip has no `tooltip` role and a closing tooltip stays in the DOM; programmatic `focus()` does not open a tooltip, keyboard focus does.
- **Fix:** exact text match for the toast, the locator `[data-slot="tooltip-content"][data-open]`, and Tab navigation from the row's expander for the keyboard case.
- **Files modified:** e2e/prices.spec.ts
- **Committed in:** d46e662, e77239e

---

**Total deviations:** 3 auto-fixed (2 bug, 1 blocking)
**Impact on plan:** all in test code; no product code changed, no scope creep.

## Issues Encountered

- **E7 finding for the end-of-phase review (not fixed, logged in deferred-items.md):** when two stores bought on the same date at the same price, the square of series 2 is drawn over the circle of series 1 and covers it completely, so one glyph shows at the shared point and its hover tooltip names only the top store. The stores stay separable by their line colors, the legend and their other purchases. The plan's E7 truth says overlapped markers stay distinguishable by shape and legend, so this is surfaced for a human decision rather than hidden.
- The two screenshot checks the plan lists as visual (contrast of the cheapest-store row, chart themes) were looked at on the captured images: the light and dark charts keep all five shapes and colors readable; E4 and E8 wrap to two lines with an ellipsis; at 360 px the E4 table scrolls inside its box and the page does not.
- `pnpm lint` reports one pre-existing warning (unused eslint-disable in `src/lib/client/navigation.ts`), unrelated and logged.

## Verification

- `pnpm exec playwright test e2e/prices.spec.ts e2e/smoke.spec.ts` (official config: production build, port 3210): 8 passed, 1 skipped (the local real-sample smoke).
- `pnpm exec vitest run tests/fixtures.guard.test.ts`: passed (skipped checks where `Facturas/` is absent).
- `pnpm verify`: lint (0 errors, 1 pre-existing warning), typecheck, 113 test files passed (3509 tests), build: exit 0.
- Acceptance greps: `expectNoXmlLeavesTheBrowser` x2, `buildPriceXml` x1, `/api/llm` x2, `767`/`768` and `scrollWidth` and `phase5-ui-states` present.

## Known Stubs

None.

## Threat Flags

None. The plan adds only test code; no new network endpoint, auth path or schema.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- End-of-phase human check: open `test-results/phase5-ui-states/` (regenerated by every run of `e2e/prices.spec.ts`; not committed) and confirm E4, E7 (see the overlap finding) and E8.

## Self-Check: PASSED

- `tests/support/pricesXml.ts`, `tests/support/pricesXml.test.ts`, `e2e/prices.spec.ts`: present.
- Commits `d46e662` and `e77239e`: present on this branch.

---
*Phase: 05-comparaci-n-de-precios-entre-tiendas*
*Completed: 2026-10-26*
