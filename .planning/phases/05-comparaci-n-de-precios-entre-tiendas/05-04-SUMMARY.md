---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 04
subsystem: ui
tags: [react, tanstack-table-v9, prices, savings-card, search, pagination, es-MX]

requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: "05-01 tracer tab and usePricesView; 05-03 comparison rules and pricesFactory test builders"
provides:
  - "Complete Precios tab composition: filters, IVA caption, savings card, search with count line, two empty states"
  - "PricesTable with sorting, 50-row pagination, per-piece / not-normalized badges and every cell state"
  - "format.ts unitPriceText(price, family), reused by Plans 05-06 and 05-07"
affects: [05-06, 05-07, 05-09]

actuals:
  tokens: 13380
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Tab panels stay mounted: component tests scope queries with getByRole('tabpanel', { name })"
    - "Default-sorted table without an unsorted state (enableSortingRemoval: false)"

key-files:
  created:
    - src/features/prices/PricesTable.test.tsx
  modified:
    - src/features/prices/PreciosTab.tsx
    - src/features/prices/PreciosTab.test.tsx
    - src/features/prices/PricesTable.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - src/lib/format.ts
    - src/lib/format.test.ts

key-decisions:
  - "Savings sub-label is replaced by the zero-state sentence when no product has 2 or more stores"
  - "Table-level enableSortingRemoval false: headers toggle ascending/descending so Ahorro estimado flips to ascending on the first click, as the plan's behavior states"
  - "Tiendas shows a muted dash when a product has no normalized purchase (planner choice, kept)"

patterns-established:
  - "Interpolated Precios sentences live in messages.ts with singular/plural pinned in messages.test.ts"

requirements-completed: [PREC-01, PREC-02, PREC-04, PREC-05]

coverage:
  - id: D1
    description: "Precios tab shows FilterBar, IVA mode caption and the unit-price sentence; empty states for no products («Ir a Productos» focuses the Productos heading) and for filters with no purchase («Quitar filtros» restores rows)"
    requirement: "PREC-01"
    verification:
      - kind: unit
        ref: "src/features/prices/PreciosTab.test.tsx#Precios tab composition"
        status: pass
    human_judgment: false
  - id: D2
    description: "Complete Ahorro estimado card: muted zero state with sentence, product count singular/plural, per-piece sentence only when counted products are per piece"
    requirement: "PREC-04"
    verification:
      - kind: unit
        ref: "src/features/prices/PreciosTab.test.tsx#reads zero in muted color / counts the compared products / adds the per-piece sentence"
        status: pass
    human_judgment: false
  - id: D3
    description: "Search by product name ignoring case and accents with polite count line and no-match sentence; card unchanged by the search"
    requirement: "PREC-05"
    verification:
      - kind: unit
        ref: "src/features/prices/PreciosTab.test.tsx#narrows the rows by name / says nothing matches the search"
        status: pass
    human_judgment: false
  - id: D4
    description: "Products table: sortable headers with aria-sort, default Ahorro descending with no-saving rows last, 50-row pagination, badges, Solo en, No normalizado, price caption, no RFC shown"
    requirement: "PREC-02"
    verification:
      - kind: unit
        ref: "src/features/prices/PricesTable.test.tsx"
        status: pass
      - kind: unit
        ref: "src/lib/format.test.ts#unitPriceText"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual layout (card width, 2-line name clamp, no page-level horizontal scroll at 360/640/767/768/1024 px)"
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout engine; the responsive widths and line clamping need a browser check at the phase verification run"

duration: 25min
completed: 2026-10-26
status: complete
plan_head_before: 9e411fdf6391817d6aa6ed86e23f33ce15b65c4c
plan_head_after: 40c728526f4a2670b61b9e4f69774105cf04eef8
commits: 2
---

# Phase 5 Plan 04: Tab composition and products table Summary

**Precios tab expanded from the tracer to the full UI-SPEC: shared FilterBar with IVA and unit-price captions, complete «Ahorro estimado» card, accent-insensitive product search, two recoverable empty states, and a TanStack v9 products table with saving-first sorting, pagination, per-piece and not-normalized badges.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-26T16:57:00Z
- **Completed:** 2026-10-26T17:22:00Z
- **Tasks:** 2
- **Files modified:** 9 (1 created)

## Accomplishments

- `PreciosTab` renders, in UI-SPEC order, the heading, `FilterBar` bound to the session filters, the mode caption (`data-testid="mode-caption"`) plus the D-04 sentence, the savings card, the tools row and the products block.
- Empty state 1 (no accepted products) shows only the heading; «Ir a Productos» switches tabs and focuses the Productos heading with a local 10-frame `requestAnimationFrame` retry (RunWatcher untouched). Empty state 2 keeps the filter bar and «Quitar filtros» calls `clearFilters`.
- The savings card keeps the «estimado» badge, shows `$0.00` muted with the zero-state sentence when no product has 2+ stores, the `{n} productos con 2 o más tiendas` sub-label, and the D-23 per-piece sentence only when `summary.perPieceProducts > 0`.
- Search filters rows by `normalizeSearch` on both sides; the count line has `aria-live="polite"`; no match shows `Ningún producto coincide con «{texto}». Revisa la búsqueda.`; the card is unaffected.
- `PricesTable`: Producto, Tienda más barata, Tiendas and Ahorro estimado sort through `SortHeaderButton` with `aria-sort`; Precio is plain text. Default order is Ahorro descending with rows without saving last in both directions and ties by name; 50-row pagination reuses `paginationRangeText` / `paginationPageText`; `min-w-[880px]` inside the Table's `overflow-x-auto` container.
- Cells: name via `TruncatedText` clamped to 2 lines with outline badges below, `Solo en {tienda}` (muted), `{precio} / {kg|L|pieza}` with `mediana · {n} compras`, `No normalizado`, muted dashes, saving right-aligned in foreground color. Only supplier names are rendered, never RFCs.
- `unitPriceText(price, family)` added to `format.ts` and used by the table.

## Task Commits

1. **Task 1: Tab composition** - `a07543c` (feat)
2. **Task 2: Products table** - `40c7285` (feat)

## Verification

- `pnpm exec vitest run src/features/prices src/lib`: 341 passed.
- `pnpm verify` (lint, typecheck, full vitest 3159 passed / 10 skipped, next build): exit 0. Lint reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable), out of scope.
- Acceptance greps: FilterBar 2, PRODUCTS_TITLE_ID 2, aria-live 1, SortHeaderButton 3, ariaSort 2, createPaginatedRowModel 2, `min-w-[880px]` 1, TruncatedText 4, unitPriceText in format.ts 1 and PricesTable.tsx 2, no `dangerouslySetInnerHTML` in `src/features/prices`.

## Decisions Made

- When no product has 2+ stores, the zero-state sentence replaces the product-count sub-label (the count would read «0 productos con 2 o más tiendas», redundant with the sentence).
- `enableSortingRemoval: false` is set at table level: TanStack v9 exposes it only there. With removal on, the default descending Ahorro would go to unsorted on the first click, contradicting the plan's «clicking Ahorro estimado flips to ascending». Consequence: no header returns to an unsorted state in this table (unlike Productos).
- The D-23 sentence is its own paragraph after the D-22 note so the note text stays exact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Component tests must scope to the Precios tab panel**
- **Found during:** Task 1 (tests)
- **Issue:** inactive tabs stay mounted, so `mode-caption` and `table` queries matched the Dashboard too.
- **Fix:** test helper `panel()` uses `getByRole("tabpanel", { name: "Precios" })`.
- **Files modified:** `src/features/prices/PreciosTab.test.tsx`
- **Commit:** a07543c

**2. [Rule 1 - Bug avoided] Sort cycle**
- **Found during:** Task 2
- **Issue:** the tracer's inherited cycle (ascending, descending, unsorted) made the first click on the default-descending Ahorro column clear the sort instead of flipping it.
- **Fix:** `enableSortingRemoval: false` (see Decisions).
- **Files modified:** `src/features/prices/PricesTable.tsx`
- **Commit:** 40c7285

**Total deviations:** 2 (1 blocking test-scoping fix, 1 sort-cycle adjustment). **Impact:** none on scope.

## Issues Encountered

None.

## Known Stubs

None. The expander and actions columns are intentionally not rendered yet (Plans 05-06 and 05-09), as the plan states.

## Threat Flags

None. T-05-10 (React text only; no raw HTML injection, asserted by a test with `<b>` in a product name and by grep) and T-05-11 (no RFC in the table, asserted by a test) are mitigated. No new endpoints or storage.

## Flagged for review

- Tiendas column shows «—» for a product with no normalized purchase (planner assumption in the plan).
- Visual checks of responsive widths remain for the phase verification run (coverage D5).

## Next Phase Readiness

Ready for 05-06 (expander column; `PriceRow` and the column helper leave room) and 05-07 (reuses `unitPriceText`).

## Self-Check: PASSED

- Files exist: `src/features/prices/PricesTable.test.tsx`, `PricesTable.tsx`, `PreciosTab.tsx`.
- Commits exist: a07543c, 40c7285.
