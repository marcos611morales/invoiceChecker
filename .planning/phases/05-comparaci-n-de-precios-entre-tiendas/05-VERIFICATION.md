---
phase: 05-comparaci-n-de-precios-entre-tiendas
verified: 2026-10-26T23:20:00Z
status: human_needed
score: 6/10 must-haves verified
covered_files:
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-01-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-01-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-02-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-02-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-03-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-03-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-04-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-04-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-05-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-05-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-06-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-06-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-07-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-07-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-08-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-08-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-09-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-09-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-10-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-10-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-11-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-11-SUMMARY.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-12-PLAN.md
  - .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-12-SUMMARY.md
  - e2e/prices.spec.ts
  - src/domain/prices/comparable.ts
  - src/domain/prices/compare.ts
  - src/domain/prices/content.ts
  - src/domain/prices/history.ts
  - src/domain/prices/members.ts
  - src/domain/prices/purchases.ts
  - src/domain/prices/sizeReader.ts
  - src/domain/prices/units.ts
  - src/domain/settings/prices.ts
  - src/features/prices/ContentEditor.tsx
  - src/features/prices/ContentTable.tsx
  - src/features/prices/HistoryChart.tsx
  - src/features/prices/PreciosTab.tsx
  - src/features/prices/PricesTable.tsx
  - src/features/prices/ProductDetail.tsx
  - src/features/prices/PurchasesList.tsx
  - src/features/prices/StoreTable.tsx
  - src/features/prices/usePricesView.ts
covered_digest: "v3:sha256:e7c97ca69a17bbb2909c5552194ebf0cd3acd64c6afdcbaa957dc053d56fe703"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the production build, load a folder with at least two suppliers, open Precios at 360, 640, 767, 768 and 1024 px wide"
    expected: "The page never scrolls sideways; below 768 px the tab list scrolls inside its own container and the active «Precios» trigger stays in view"
    why_human: "Layout measurement needs a real browser; the Playwright spec claims it passed (05-12) but this verification did not re-run it"
  - test: "E4 long text: view the products table with a 60-character product name and long supplier names at 1024 and 360 px (held-out screenshots in test-results/phase5-ui-states/e4-*.png)"
    expected: "Names wrap to two lines and then truncate, the full text shows on hover and on keyboard focus"
    why_human: "Declared verification: backstop in 05-12 must_haves; a visual judgment grep cannot make"
  - test: "E7 populated: open the history of a product with several stores in light and dark mode (e7-light-chart.png, e7-dark-chart.png, e7-light-tooltip-series3.png)"
    expected: "Series 3 to 5 are identifiable by shape, legend and tooltip in light mode; overlapping markers stay distinguishable. Known: two markers at exactly the same date and price hide each other (deferred-items.md item 1; the user accepted this on 2026-10-26)"
    why_human: "Declared verification: backstop; chart look and color contrast need a person"
  - test: "E8 long text: open the content table of a product whose description is 120 characters long (e8-1024-contenido.png) and tab to its edit button"
    expected: "The description wraps in the table; the edit button's accessible name stops at 60 characters"
    why_human: "Declared verification: backstop; keyboard and screen-reader behavior need a person"
---

# Phase 5: Comparación de precios entre tiendas Verification Report

**Phase Goal:** El usuario ve, para cada producto agrupado, en qué tienda le sale más barato, cuánto podría ahorrar y cómo ha cambiado su precio en el tiempo, comparando solo cantidades comparables.
**Verified:** 2026-10-26T23:20:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

No blocker found. Every ROADMAP success criterion and every requirement (PREC-01 to PREC-06) is backed by code that exists, is wired into the Precios tab, and has passing tests. What remains are four visual and layout checks that the plan itself marked as human or backstop.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1 | SC1: for each grouped product the user sees, per store, the net unit price (discount applied): minimum, median, last and number of purchases, with the cheapest store highlighted | ✓ VERIFIED | `purchases.ts` takes `conceptAmounts(...)` which does `importe - descuento` (+ taxes in Con IVA mode, + IEPS in Sin IVA). `compare.ts` `storeStats` builds min, median, last (latest literal fecha) and count; stores sort by median. `StoreTable.tsx` renders the four figures per store and a «Más barata» badge with a Check icon (not color alone) on `row.cheapest`. `PricesTable.tsx` shows the cheapest store and its price in the product row. Covered by `compare.test.ts` (sorting, even-count median, last price by largest fecha, ties) and `purchases.test.ts` (discount in both IVA modes). |
| 2 | SC2: only prices of the same unit family (kg, L, pieza) are compared; products whose unit cannot be normalized are marked «no normalizado» | ✓ VERIFIED | `units.ts` maps SAT ClaveUnidad to mass, volume or piece with exact decimal factors; the free-text Unidad is never used. `compare.ts` `chooseFamily` keeps one family (most purchases, then most stores, then kg > L > pieza); the rest become `other-family`. Pieces without a size become `unsized-with-sized-siblings` when any purchase has a size. Zero or negative amounts, unknown units and bad quantities become typed reasons. `PricesTable` shows `notNormalizedBadge(n)` and «No normalizado» in the price cell; `PurchasesList` shows «No normalizado» with the reason text. Tests: `compare.test.ts` (D-10, D-12, D-26, D-29), `units.test.ts`, `content.test.ts`, `sizeReader.test.ts` (covers CR-01, CR-02, WR-01 fixes: «1,500 ML» = 1.5 L, «1/2 KG» = 0.5 kg, «1L CAJA» ambiguous). |
| 3 | SC3: services, fuel and similar are not in the comparison by default, and the user can change the «no comparable» mark | ✓ VERIFIED | `comparable.ts`: `classifyClave` treats prefixes 1510 and 151115 as fuel and segments 70 to 94 as services; a product is hidden only if every purchase is service or fuel, computed over all purchases with filters ignored. `usePricesView.ts` drops hidden rows from the savings summary. `PreciosTab.tsx` hides them unless «Mostrar los no comparables (n)» is checked. `PricesTable.tsx` `RowMenu` calls `setPriceOverride` / `restorePriceOverride` (with «Deshacer» toast) in `settingsStore.ts`, which delegates to `domain/settings/prices.ts` reducers. Tests: `comparable.test.ts`, `settings/prices.test.ts`, `settingsStore.test.ts`, `PricesTable.test.tsx`, `PreciosTab.test.tsx`. |
| 4 | SC4: an estimated saving, labeled as estimated, from having bought at the cheapest store, and the product's price history over time | ✓ VERIFIED | `compare.ts` `estimatedSaving` (D-21) adds `(price - cheapest median) x content` over the other stores' purchases, positive differences only, exact `Big`. Labels: «Ahorro estimado» plus an «estimado» badge in `PreciosTab`, and `savingCalculationNote` in `ProductDetail`. `history.ts` builds per-store series with stable slots and literal-date X values; `HistoryChart.tsx` is a recharts `ScatterChart` with one marker per normalized purchase, a legend and a tooltip, rendered in `ProductDetail`. Tests: `compare.test.ts` saving cases, `history.test.ts`, `HistoryChart.test.tsx`. |
| 5 | Plan 05-12: capturing a product's content changes the comparison at once and the correction persists across a reload (settings persist, invoices do not) | ✓ VERIFIED | `usePricesView.ts` builds a `corrections` map from `settings.contentCorrections` and passes it to `comparePrices`; `content.ts` `correctedContent` applies it to piece units. `compare.test.ts` cases D-28 prove the comparison changes. Settings are versioned (`SETTINGS_VERSION = 4`) with a zod schema. The browser reload step itself relies on the 05-12 Playwright run, which was not repeated here. |
| 6 | Plan 05-12 prohibitions: nothing from Precios goes to a server or DeepSeek; no invoice amount, date, folio or UUID in browser storage | ✓ VERIFIED | `grep` for `fetch(` and `/api/` in `src/features/prices` and `src/domain/prices` (non-test) returns nothing. Stored data is only `priceOverrides` (productId + boolean) and `contentCorrections` (rfc, normalized key, unit, amount, packs typed by the user). `e2e/prices.spec.ts` line 435 asserts zero `/api/llm` requests. 05-SECURITY.md reports threats_open 0 (as reported by the orchestrator, not re-audited). |
| 7 | Plan 05-12: at 360, 640, 767, 768 and 1024 px the page never scrolls sideways; below 768 px the tab list scrolls inside its container with «Precios» in view | ? UNCERTAIN (human) | `e2e/prices.spec.ts` line 492 contains the check and 05-12-SUMMARY reports it passing. Not re-run here (needs a production build and a browser). Routed to human verification. |
| 8 | E4 long text wraps two lines then truncates, full text on hover and focus (backstop) | ? UNCERTAIN (human) | `PricesTable` uses `TruncatedText` with `line-clamp-2`. Declared `verification: backstop`, so it abstains without a person. Screenshots exist in `test-results/phase5-ui-states/` (gitignored). |
| 9 | E7 populated: overlapping markers and series 3 to 5 stay distinguishable (backstop) | ? UNCERTAIN (human) | Shapes, legend and tooltip exist in `HistoryChart.tsx`. Known limit: two markers at exactly the same date and price hide each other. The user accepted that on 2026-10-26 (deferred-items.md). Needs a person to confirm the rest. |
| 10 | E8 long text: 120-character descriptions wrap and the edit button's accessible name stops at 60 characters (backstop) | ? UNCERTAIN (human) | Test exists at `e2e/prices.spec.ts` line 707; screenshot `e8-1024-contenido.png` exists. Needs a person. |

**Score:** 6/10 truths verified (4 await a human; none FAILED)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/domain/prices/purchases.ts` | Purchases of accepted products with net amount | ✓ VERIFIED | Substantive, used by `usePricesView` |
| `src/domain/prices/units.ts` | SAT unit table | ✓ VERIFIED | Mass, volume, 17 piece codes; used by `content.ts` |
| `src/domain/prices/content.ts` | Content per line, user correction | ✓ VERIFIED | Used by `compare.ts` |
| `src/domain/prices/sizeReader.ts` | Size from description | ✓ VERIFIED | Review fixes CR-01, CR-02, WR-01 present and tested |
| `src/domain/prices/compare.ts` | Per-store stats, cheapest, saving, summary | ✓ VERIFIED | Used by `usePricesView` |
| `src/domain/prices/comparable.ts` | Default «no comparable» | ✓ VERIFIED | Used by `usePricesView` |
| `src/domain/prices/history.ts` | Series and stable slots | ✓ VERIFIED | Used by `HistoryChart` and `usePricesView` |
| `src/domain/settings/prices.ts` | Override and correction reducers | ✓ VERIFIED | Used by `settingsStore.ts` |
| `src/features/prices/*` (PreciosTab, PricesTable, ProductDetail, StoreTable, HistoryChart, PurchasesList, ContentTable, ContentEditor, usePricesView) | UI | ✓ VERIFIED | `AppShell.tsx` registers `{ value: "precios", Panel: PreciosTab }` |
| `tests/support/pricesXml.ts`, `e2e/prices.spec.ts` | Synthetic XML builder and browser spec | ✓ VERIFIED (exists) | Spec not re-run by this verification |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `AppShell.tsx` | `PreciosTab` | tab registry, value `precios` | WIRED | line 14 import, line 79 registration |
| `PreciosTab` | `usePricesView` | hook | WIRED | reads rows, summary, comparability, historySlots |
| `usePricesView` | `useDashboardView` | filtered, category-scoped entries | WIRED | same entries as every dashboard figure (FILT-05) |
| `usePricesView` | `comparePrices` | purchases + corrections map | WIRED | |
| `PricesTable` row menu | `settingsStore.setPriceOverride` | `useSettingsStore` | WIRED | persists and offers undo |
| `ProductDetail` | `StoreTable`, `HistoryChart`, `ContentTable`, `PurchasesList` | child components | WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `PreciosTab` savings card | `summary.total` | `summarizeSavings(kept)` over `comparePrices` over `extractPurchases(view.visible)` over the loaded ledger | Yes | ✓ FLOWING |
| `StoreTable` | `row.stores` | `storeStats` from compared purchases | Yes | ✓ FLOWING |
| `HistoryChart` | `historySeries(row, slots)` | `row.purchases` with `status: compared` | Yes | ✓ FLOWING |
| `PricesTable` | `rows` prop | `shown` from `usePricesView().rows` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Type check | `pnpm tsc --noEmit` | no output | ✓ PASS |
| Lint | `pnpm eslint src e2e tests` | 0 errors, 1 warning (pre-existing, `src/lib/client/navigation.ts:6`) | ✓ PASS |
| Phase 5 unit, component and real-sample tests | `FACTURAS_DIR=.../Facturas pnpm vitest run src/domain/prices src/domain/settings/prices.test.ts src/features/prices tests/support` | 20 files, 503 tests passed, none skipped (the real-sample suites ran) | ✓ PASS |
| Full suite and `next build` | not re-run; orchestrator reported 3,619 passed / 10 skipped and build OK | | ? SKIP |
| Playwright `e2e/prices.spec.ts` | not re-run (needs production build and a browser) | | ? SKIP |

### Probe Execution

Step 7c: SKIPPED. The phase declares no `probe-*.sh` scripts and none exist for it.

### Requirements Coverage

All six IDs appear in the PLAN frontmatter of the phase and in REQUIREMENTS.md. No orphans: every PREC ID that REQUIREMENTS.md maps to Phase 5 is claimed by at least one plan.

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| PREC-01 | 05-01, 05-03, 05-04, 05-06, 05-12 | Per product, net unit price per store: min, median, last, count | ✓ SATISFIED | Truth 1 |
| PREC-02 | 05-01, 05-03, 05-04, 05-05, 05-06, 05-10, 05-11, 05-12 | Same unit family only; «no normalizado» otherwise | ✓ SATISFIED | Truth 2 |
| PREC-03 | 05-02, 05-08, 05-09, 05-12 | Services and fuel excluded by default; user can change the mark | ✓ SATISFIED | Truth 3 |
| PREC-04 | 05-01, 05-03, 05-04, 05-06, 05-12 | Cheapest store per product | ✓ SATISFIED | Truth 1 |
| PREC-05 | 05-01, 05-03, 05-04, 05-06, 05-08, 05-09, 05-10, 05-11, 05-12 | Estimated saving, labeled as estimated | ✓ SATISFIED | Truth 4 |
| PREC-06 | 05-07, 05-12 | Price history over time | ✓ SATISFIED | Truth 4 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (Phase 5 source) | | No `TBD`, `FIXME` or `XXX`; no stub returns; the only `placeholder` match is the search input's legitimate attribute | none | None |
| `src/lib/client/navigation.ts` | 6 | Unused eslint-disable directive | ℹ️ Info | Pre-existing, outside Phase 5 |
| `src/domain/prices/*`, `HistoryChart.tsx`, content editor | | 05-REVIEW IN-01 to IN-05 open (unused code, duplicated constants, chart Y rounded to cents, editor stores amount text as typed, date labels accept impossible days the history rejects) | ℹ️ Info | Recorded as info only; none affects a requirement |
| `HistoryChart.tsx` | | Two markers at exactly the same date and price hide each other | ℹ️ Info | User accepted this on 2026-10-26 (deferred-items.md) |

### Human Verification Required

#### 1. Responsive layout at five widths
**Test:** Open Precios in the production build at 360, 640, 767, 768 and 1024 px.
**Expected:** No sideways page scroll; the tab list scrolls inside itself below 768 px with «Precios» in view.
**Why human:** Needs a real browser; not re-run in this verification.

#### 2. E4 long text in the products table
**Test:** 60-character product name and long supplier names at 1024 and 360 px.
**Expected:** Two lines then truncation, full text on hover and focus.
**Why human:** `verification: backstop`.

#### 3. E7 history chart look (light and dark)
**Test:** A product with three to five stores.
**Expected:** Series identifiable by shape, legend and tooltip; the exact-overlap hiding is the accepted limit.
**Why human:** `verification: backstop`; visual and contrast judgment.

#### 4. E8 content table and edit button
**Test:** 120-character description; tab to the edit button.
**Expected:** Description wraps; accessible name stops at 60 characters.
**Why human:** `verification: backstop`; keyboard and screen-reader behavior.

### Gaps Summary

No gaps. Four items are left for a person because the plan itself declared them as visual or backstop checks.

Housekeeping the orchestrator should do at phase close (not a code gap): `.planning/REQUIREMENTS.md` still shows PREC-01 to PREC-06 as unchecked and «Pending» in the traceability table, and `.planning/ROADMAP.md` still shows Phase 5 as `[ ]` although 12/12 plans are executed. 05-UI-REVIEW.md (19/24) has three advisory fixes not applied; they await the user's choice and do not affect any must-have.

---

_Verified: 2026-10-26T23:20:00Z_
_Verifier: Claude (gsd-verifier)_
