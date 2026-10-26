---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 08
subsystem: domain
tags: [comparability, clave-prod-serv, settings, overrides, undo, zustand, big.js]

requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: "settings v4 with priceOverrides and pruneDanglingOverrides (05-02), usePricesView.allPurchases and comparePrices (05-01, 05-07)"
provides:
  - "comparable.ts: classifyClave (fuel / service / product by ClaveProdServ), defaultComparable, defaultsByProduct over the unfiltered purchases, comparabilityOf with overrides"
  - "compare.ts summarizeSavings(rows); comparePrices keeps its shape"
  - "usePricesView.comparability (per row, byUser and defaultComparable) and hiddenCount; summary counts comparable rows only"
  - "settings/prices.ts setPriceOverride / restorePriceOverride (differences from the default only, previous entry for Deshacer)"
  - "ProductSnapshot.override; deleteProduct and moveProductMember drop the override with the product, restoreProduct and undoMemberChange bring it back"
  - "Store actions setPriceOverride / restorePriceOverride; product-removing actions write products and priceOverrides in one set"
affects: [05-09 (row menu, checkbox and notices on this data path), 05-10, 05-11, 05-12]

actuals:
  tokens: 12300
  tasks: 2
  commits: 3
plan_head_before: 0bde1ecf7ca8140c0da218816d1d2223fb1bbaff
plan_head_after: 3c5d61975349607e86a7fcd822b5f64e7445706e

tech-stack:
  added: []
  patterns:
    - "Classification reads string prefixes only; Map lookups and entry lists, never records keyed by product id or key"
    - "Override reducers return the very same settings object on no-op or refusal, so the store writes nothing"
    - "A single helper (withProductRemoved) removes a product and its override in one value, shared by deleteProduct and the move of a last member"

key-files:
  created:
    - src/domain/prices/comparable.ts
    - src/domain/prices/comparable.test.ts
    - src/domain/prices/comparable.realdata.test.ts
    - src/domain/settings/prices.ts
    - src/domain/settings/prices.test.ts
    - src/features/prices/usePricesView.test.tsx
  modified:
    - src/domain/prices/compare.ts
    - src/features/prices/usePricesView.ts
    - src/domain/settings/products.ts
    - src/domain/settings/products.test.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts

key-decisions:
  - "Fuel is a ClaveProdServ starting with 1510 or 151115, a service is a first-two-digit segment 70 to 94, anything else (including empty or malformed keys) is a product so a damaged key never hides a product"
  - "The default is computed from allPurchases (every filter ignored), so a date filter never changes it (D-31)"
  - "When restoring a deleted product its override is re-added only if the list has room and holds no entry for the id; otherwise the product is still restored without the mark"

patterns-established:
  - "Comparability is attached per row id in the view (Map), with rows still holding every product that has purchases within the filters; the table filter arrives in 05-09"

requirements-completed: [PREC-03, PREC-05]

coverage:
  - id: D1
    description: "Default fuel/service/product classification by ClaveProdServ and the all-services-or-fuel rule for products"
    requirement: PREC-03
    verification:
      - kind: unit
        ref: "src/domain/prices/comparable.test.ts#classifyClave (D-16, D-27)"
        status: pass
      - kind: unit
        ref: "src/domain/prices/comparable.test.ts#defaultComparable (D-17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The default never changes with filters and the savings card counts comparable products only, with hiddenCount of the hidden rows within the filters"
    requirement: PREC-05
    verification:
      - kind: unit
        ref: "src/features/prices/usePricesView.test.tsx#usePricesView comparability (D-16, D-17, D-18, D-22, D-31)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real 2025 sample: every LTR line is fuel, services exist, products are the majority (counts only)"
    requirement: PREC-03
    verification:
      - kind: unit
        ref: "src/domain/prices/comparable.realdata.test.ts (run with FACTURAS_DIR; skipped where the sample is absent)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Override reducers store only differences from the default and report the previous entry for Deshacer"
    requirement: PREC-03
    verification:
      - kind: unit
        ref: "src/domain/settings/prices.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Deleting, removing the last member of or moving the last member of a product drops its override in the same write; undo brings it back; the stored value still validates"
    requirement: PREC-03
    verification:
      - kind: unit
        ref: "src/domain/settings/products.test.ts#the «no comparable» mark follows its product"
        status: pass
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore «no comparable» overrides (D-18, D-19)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-10-26
status: complete
---

# Phase 5 Plan 08: Default «no comparable» and override data path Summary

**ClaveProdServ-based default exclusion of services and fuel from the price comparison (computed over unfiltered purchases), the savings card over comparable products only, and per-product «no comparable» overrides with undo that stay consistent with product deletion.**

## Performance

- **Duration:** about 22 min
- **Started:** 2026-10-26T17:59:00Z
- **Completed:** 2026-10-26T18:21:00Z
- **Tasks:** 2
- **Files modified:** 12 (6 created, 6 modified)

## Accomplishments
- `comparable.ts` classifies a line as fuel (1510 / 151115), service (70 to 94) or product; a product is hidden by default only when every purchase is service or fuel. Gasoline and Google Ads grouped as products are out by default, «BLUEBERRIES» with one food-keyed purchase stays in.
- `usePricesView` now exposes `comparability` and `hiddenCount`; `summary` is `summarizeSavings` over the comparable rows only, and the default is derived from `allPurchases` so no filter can change it.
- `settings/prices.ts` stores only differences from the default, reports the previous entry for «Deshacer», and the store actions write `priceOverrides` once.
- A product's override is dropped in the same write when the product goes (delete, last member removed or moved) and `ProductSnapshot.override` brings it back on undo.

## Task Commits

1. **Task 1 RED: failing tests for classification and view** - `62f3e16` (test)
2. **Task 1 GREEN: classification, summarizeSavings and view comparability** - `e45123e` (feat)
3. **Task 2: override reducers, deletion consistency and store actions** - `3c5d619` (feat; tests written with the code in the same commit)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `src/domain/prices/comparable.ts` - classification, defaults and effective comparability
- `src/domain/prices/compare.ts` - `summarizeSavings` extracted from `comparePrices`
- `src/features/prices/usePricesView.ts` - comparability per row, `hiddenCount`, summary over comparable rows
- `src/domain/settings/prices.ts` - `setPriceOverride`, `restorePriceOverride`
- `src/domain/settings/products.ts` - `ProductSnapshot.override`, `withProductRemoved`, restore with override
- `src/stores/settingsStore.ts` - override actions; product-removing actions set `priceOverrides` too
- Tests: `comparable.test.ts`, `comparable.realdata.test.ts`, `usePricesView.test.tsx`, `prices.test.ts`, and additions to `products.test.ts` and `settingsStore.test.ts`

## Decisions Made
- Malformed, empty or short ClaveProdServ is a product (nothing hidden by accident), as flagged in the plan.
- If the override list is full when a deleted product is restored, the product still comes back without its mark rather than refusing the whole restore (the mark is a preference, the product is data).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moving the last member did not go through deleteProduct**
- **Found during:** Task 2
- **Issue:** The plan states that `removeProductMember` and `moveProductMember` already go through `deleteProduct`. That holds for removal, but `moveProductMember` builds the result itself when the source loses its last member, so the source's override would have been left dangling (and the undo snapshot would not carry it).
- **Fix:** Added a shared `withProductRemoved` helper used by `deleteProduct` and by the last-member branch of `moveProductMember`, and recorded `override` in that snapshot.
- **Files modified:** `src/domain/settings/products.ts` (test in `products.test.ts` and `settingsStore.test.ts`)
- **Verification:** `products.test.ts` "moving the last member away drops the mark of the source and undo brings it back" and the store equivalent pass; stored value validates against the v4 schema.
- **Committed in:** `3c5d619`

**2. [Rule 2 - Missing critical] Added `usePricesView.test.tsx`**
- **Found during:** Task 1
- **Issue:** The behavior block requires view-level checks (hiddenCount, D-31, summary over comparable rows) but the plan's file list had no test file for the hook.
- **Fix:** New hook test using the real session and settings stores.
- **Committed in:** `62f3e16`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical test coverage)
**Impact on plan:** Both necessary for correctness of the stated truths; no scope creep.

## Issues Encountered
- Task 2 tests were written alongside the implementation instead of strictly before it, so there is a single feat commit without a separate RED commit for that task.
- `pnpm lint` reports one pre-existing warning (unused eslint-disable in `src/lib/client/navigation.ts`), unrelated to this plan and left untouched.

## Known Stubs

None. `hiddenCount` and `comparability` are real data; the UI consumers arrive in Plan 05-09.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 05-09 can build the row menu, the «Mostrar los no comparables» checkbox and the notices on `comparability`, `hiddenCount` and the store actions `setPriceOverride` / `restorePriceOverride` (the caller passes `defaultComparable` from `comparability.get(id).defaultComparable`).
- `rows` still holds every product with purchases; filtering rows in the table is left to 05-09.

## Self-Check: PASSED

- Files exist: comparable.ts, comparable.test.ts, comparable.realdata.test.ts, prices.ts, prices.test.ts, usePricesView.test.tsx
- Commits `62f3e16`, `e45123e`, `3c5d619` are ancestors of HEAD
- `pnpm verify` (lint, typecheck, full vitest, next build) exits 0; real-data test passes with FACTURAS_DIR

---
*Phase: 05-comparaci-n-de-precios-entre-tiendas*
*Completed: 2026-10-26*
