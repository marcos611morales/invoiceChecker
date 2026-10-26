---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 06
subsystem: ui
tags: [react, prices, expanded-panel, per-store-table, purchases-list, es-MX]

requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: "05-03 ProductComparison/ComparedPurchase; 05-04 PricesTable and unitPriceText"
provides:
  - "Expander column in PricesTable (several rows open, aria-expanded/aria-controls, not persisted)"
  - "ProductDetail panel: mixed-families and none-comparable notes, cheapest-store summary with the estimated saving explained, family line"
  - "StoreTable: minimum, median, last (with short date) and purchases per store, cheapest row lifted and badged"
  - "PurchasesList: every purchase with content, unit price or the reason it is not normalized"
  - "format.ts formatContent and shortDateLabel; messages.ts panel sentences and notNormalizedReasonText"
affects: [05-07, 05-09, 05-11]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Summary sentences with 600-weight pieces are returned as parts (cheapestSummaryParts) and joined by cheapestSummary"
    - "Reason codes from the domain become sentences only in messages.ts (notNormalizedReasonText)"
    - "Nested tables in tests are told apart by the region (section aria-labelledby) that contains them"

key-files:
  created:
    - src/features/prices/ProductDetail.tsx
    - src/features/prices/StoreTable.tsx
    - src/features/prices/PurchasesList.tsx
    - src/features/prices/ProductDetail.test.tsx
    - src/features/prices/PurchasesList.test.tsx
  modified:
    - src/features/prices/PricesTable.tsx
    - src/features/prices/PricesTable.test.tsx
    - src/features/prices/PreciosTab.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - src/lib/format.ts
    - src/lib/format.test.ts

key-decisions:
  - "notNormalizedReasonText takes the compared family as a second argument: the other-family sentence names the product's family, which a purchase alone does not carry. PurchasesList derives it from the first compared purchase."
  - "Both informational alerts (mixed families, none comparable) use role=status; the Alert component defaults to role=alert, which would interrupt screen readers on a user-opened panel."
  - "shortDateLabel builds the date with Date.UTC from the literal parts and formats it with Intl timeZone UTC (verified es-MX gives three-letter months for all 12 months)."

patterns-established:
  - "Panel sections are <section aria-labelledby> with an h3 (14/600), so tests and assistive tech find them as named regions"

requirements-completed: [PREC-01, PREC-02, PREC-04, PREC-05]

coverage:
  - id: D1
    description: "Expander on each row: aria-expanded, label Ver/Ocultar precios de {producto}, several rows open at once, 48 px first column, panel with secondary background and 16/24 px padding"
    requirement: "PREC-05"
    verification:
      - kind: unit
        ref: "src/features/prices/ProductDetail.test.tsx#expander (D-07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Summary with cheapest store, median price and Ahorro estimado plus calculation note; one-store sentence; family line; per-piece caption"
    requirement: "PREC-05"
    verification:
      - kind: unit
        ref: "src/features/prices/ProductDetail.test.tsx#summary (D-02, D-11, D-21)"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mixed-families Info alert (role status), none-comparable alert that replaces the per-store table, tie note and single-purchase caution"
    requirement: "PREC-02"
    verification:
      - kind: unit
        ref: "src/features/prices/ProductDetail.test.tsx#alerts (D-12) / notes under the table (D-10, D-20)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-store table Tienda, Minimo, Mediana, Ultimo (with short date), Compras; cheapest row lifted with Mas barata badge, check in --positive and 600 median; 640 px minimum; no RFC"
    requirement: "PREC-01, PREC-04"
    verification:
      - kind: unit
        ref: "src/features/prices/ProductDetail.test.tsx#per-store table (PREC-01, PREC-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Purchases list: columns, Fecha descending as received, XML description unchanged in TruncatedText, content and unit price, dash for missing folio, 20 first with Mostrar n mas, 880 px minimum, no RFC or UUID"
    requirement: "PREC-02"
    verification:
      - kind: unit
        ref: "src/features/prices/PurchasesList.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "The six not-normalized reason sentences, with other-family in every family pair"
    requirement: "PREC-02"
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#writes the sentence of every reason / names both families"
        status: pass
      - kind: unit
        ref: "src/features/prices/PurchasesList.test.tsx#not-normalized purchases"
        status: pass
    human_judgment: false
  - id: D7
    description: "Visual result in a browser: panel spacing at 360/640/768 px, 2-line clamp of descriptions, horizontal scroll of the 640 and 880 px tables, lifted-row contrast in light and dark"
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout engine; widths, clamping and contrast need a browser check at the phase verification run"

duration: 22min
completed: 2026-10-26
status: complete
plan_head_before: e3caa1bc068502ebd9658b3a179d3aa29bbfdd4f
plan_head_after: 2caaee96758cfa4c7dd6f860623932caecb30689
commits: 2
---

# Phase 5 Plan 06: Expanded product panel Summary

**Each Precios row opens into a panel that explains its price: the cheapest store with the estimated saving and how it is calculated, a per-store table (minimum, median, last, purchases) with the cheapest highlighted by text, icon and weight, and a purchases list showing each purchase's content and unit price or the exact reason it was left out.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-26T17:18:00Z
- **Completed:** 2026-10-26T17:40:00Z
- **Tasks:** 2
- **Files modified:** 13 (5 created)

## Accomplishments

- `PricesTable` gets a 48 px expander column first (sr-only header «Detalle»), an expanded-id set in component state, a Fragment per row and a panel row spanning every column with `bg-secondary p-4 sm:p-6 whitespace-normal`. Labels read «Ver precios de {producto}» / «Ocultar precios de {producto}»; open state is session-only.
- `ProductDetail` renders, in order and skipping empty sections with 24 px gaps: the mixed-families Info alert (role status; one or two other families), the none-comparable alert (replaces the per-store table, keeps the purchases), the summary (store and price in 600, the «Ahorro estimado» sentence, the 12px calculation note, or the single-store sentence), the family line, «Precios por tienda» and «Compras».
- `StoreTable`: one row per compared store sorted as the domain leaves it (median ascending), money through `formatMoney`, «Último» with a 12px short date, «Compras» as «1 compra» / «{n} compras», the cheapest row `bg-background` with a 600 median and an outline «Más barata» badge whose Check icon is the only use of `text-positive`; tie note, single-purchase caution and per-piece caption under the table; `min-w-[640px]` inside the Table's `overflow-x-auto`.
- `PurchasesList`: Fecha · Tienda · Folio · Descripción (exact XML text in `TruncatedText`, 2-line clamp) · Cantidad (XML) · Contenido · Precio unitario; not-normalized rows stay in date order in muted text with the reason as a 12px caption and «—» as price; 20 rows then «Mostrar {n} más»; `min-w-[880px]`. Only store name and folio are shown, never RFC or UUID.
- `format.ts`: `formatContent` (up to three decimals, trailing zeros trimmed, «pieza»/«piezas») and `shortDateLabel` («28 may 2025», UTC, independent of the machine's time zone). `messages.ts`: `expandPricesAria`, `cheapestSummary(Parts)`, `savingCalculationNote`, `singleStoreSummary`, `familyLine`, `mixedFamiliesNote`, `purchasesCount`, `showMore`, `notNormalizedReasonText`.

## Task Commits

1. **Task 1: Expander, panel summary and alerts, per-store table** - `0734c72` (feat)
2. **Task 2: Purchases list and reason sentences** - `2caaee9` (feat)

## Verification

- `pnpm exec vitest run src/features/prices src/lib src/features/shell`: 466 passed.
- `pnpm verify` (lint, typecheck, full vitest 3307 passed / 10 skipped, next build): exit 0. Lint shows the one pre-existing warning in `src/lib/client/navigation.ts`, out of scope.
- Acceptance greps: `aria-expanded` 1 and `ProductDetail` 2 in PricesTable.tsx; `text-positive` 1 and `min-w-[640px]` 1 in StoreTable.tsx; `role="status"` 1 in ProductDetail.tsx; `timeZone` 1 in format.ts; `min-w-[880px]` 1 and `TruncatedText` 2 in PurchasesList.tsx; `PurchasesList` 2 in ProductDetail.tsx; `no tiene equivalencia`, `La línea no tiene importe`, `notNormalizedReasonText` 1 each in messages.ts; no `dangerouslySetInnerHTML` in `src/features/prices`.

## Decisions Made

- `notNormalizedReasonText(purchase, comparedFamily)` has a second argument (the plan's interface listed one). The «other-family» sentence names the product's compared family, which is not a field of the purchase; `PurchasesList` takes it from the first compared purchase (always present when a purchase is «other-family»).
- Both informational alerts carry `role="status"`. The shadcn `Alert` defaults to `role="alert"` (assertive), wrong for a note shown after the user opens a panel; the plan only required it for the mixed-families note.
- Two left-out families (not drawn in the UI-SPEC, planner assumption) read «Este producto se compró en kilogramos, en litros y en piezas. … las 1 compra en litros y 3 compras en piezas quedan como no normalizadas.» One left-out purchase reads «la 1 compra en litros queda como no normalizada.»
- The tasks were marked `tdd="true"` but the plan is `type: execute`; tests were written together with the code and committed once per task (no separate RED commit), as the plan's per-task commit rule states.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests assumed no expander column**
- **Found during:** Task 1
- **Issue:** The new first column shifted cell positions and added the «Detalle» column header, breaking `PricesTable.test.tsx` (cell indexes, first-cell product name helper) and `PreciosTab.test.tsx` (expected header list).
- **Fix:** Updated the indexes and the expected header list (`Detalle` first). No behavior of the table changed.
- **Files modified:** `src/features/prices/PricesTable.test.tsx`, `src/features/prices/PreciosTab.test.tsx` (not in the plan's `files_modified`)
- **Commit:** 0734c72

**2. [Rule 1 - Plan interface] Second parameter of `notNormalizedReasonText`**
- **Found during:** Task 2
- **Issue:** The interface block gives `notNormalizedReasonText(purchase)`, but the other-family sentence needs the compared family.
- **Fix:** Added `comparedFamily: UnitFamily | null` (see Decisions Made).
- **Files modified:** `src/lib/copy/messages.ts`
- **Commit:** 2caaee9

**Total deviations:** 2 (1 blocking test update, 1 interface adjustment). **Impact:** none on scope.

## Issues Encountered

None.

## Known Stubs

None. The history chart (Plan 05-07) and the content editor (Plan 05-11) have no placeholder in the panel; they slot between the per-store table and «Compras».

## Threat Flags

None. T-05-15 (vendor text as React text only; asserted with `<b>` in a store name and in a description, plus grep) and T-05-16 (no RFC or UUID in the panel or the list; asserted by tests) are mitigated. No new endpoints, storage or installs.

## Flagged for review

- Edge-probe assumption «unclassified» for PREC-01, PREC-02, PREC-04, PREC-05 is unchanged: behavior is pinned by the panel states above.
- Two-families mixed note and the D-26 copy («El monto de la línea no es válido.», «La línea no tiene importe (descuento total o monto cero).») are planner assumptions implemented as written.
- Visual checks (coverage D7) remain for the phase verification run.

## Next Phase Readiness

Ready for 05-07 (chart slots between «Precios por tienda» and «Compras» in `ProductDetail`, reusing `unitPriceText`, `shortDateLabel` and `formatContent`) and 05-11 (content section in the same place).

## Self-Check: PASSED

- Files exist: `ProductDetail.tsx`, `StoreTable.tsx`, `PurchasesList.tsx`, `ProductDetail.test.tsx`, `PurchasesList.test.tsx` under `src/features/prices/`.
- Commits exist: 0734c72, 2caaee9.
