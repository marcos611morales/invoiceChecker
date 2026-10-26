---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 01
subsystem: prices
tags: [prices, tracer, tanstack-table, big.js, tabs]
status: complete
requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: accepted products with members keyed by RFC plus normalized description
  - phase: 02-dashboard-y-filtros
    provides: useDashboardView filtered, category-scoped entries (FILT-05)
provides:
  - src/domain/prices (units, content, purchases, compare): pure price domain
  - usePricesView, PreciosTab, PricesTable: the sixth tab «Precios»
  - AppTab "precios" and the six-tab list that scrolls below 768 px
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12]
tech-stack:
  added: []
  patterns:
    - "Prices as Big built from strings; rounding only at display"
    - "Purchases extracted from view.visible so the tab obeys the same filters as the Dashboard"
key-files:
  created:
    - src/domain/prices/units.ts
    - src/domain/prices/content.ts
    - src/domain/prices/purchases.ts
    - src/domain/prices/compare.ts
    - src/features/prices/usePricesView.ts
    - src/features/prices/PreciosTab.tsx
    - src/features/prices/PricesTable.tsx
    - src/features/prices/PreciosTab.test.tsx
  modified:
    - src/stores/sessionStore.ts
    - src/features/shell/AppShell.tsx
    - src/features/shell/AppShell.test.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/lib/copy/es.ts
    - e2e/smoke.spec.ts
key-decisions:
  - "Only counted invoices of kind ingreso become purchases; counted alone also admits credit notes (D-06)"
  - "Net amount comes from conceptAmounts conIva or sinIva by mode, never from ValorUnitario (it ignores the discount)"
  - "compare.ts already implements the full D-12 tie rule (more purchases, then more distinct stores, then kg > L > pieza) and the D-20/D-30 store tie rule; Plan 05-03 pins them with the rule test table"
  - "Content is checked before the amount, so an unknown unit or bad quantity wins over a bad amount as the reason"
requirements-completed: [PREC-01, PREC-02, PREC-04, PREC-05]
duration: 25 min
completed: 2026-10-26
commits: 2
plan_head_before: f11249fd9b76c9b02957446dc009b44af08a502f
plan_head_after: d640cd8
actuals:
  tokens: 12200
  tasks: 2
  commits: 2
coverage:
  - deliverable: "Precios tab shows cheapest store, price per kg, store count and estimated saving for a grouped product"
    verification:
      - kind: test
        ref: "src/features/prices/PreciosTab.test.tsx#shows the cheapest store, the price per kg, the store count and the estimated saving of a grouped product"
        status: pass
    human_judgment: false
  - deliverable: "Savings card labeled «estimado» with the D-22 note"
    verification:
      - kind: test
        ref: "src/features/prices/PreciosTab.test.tsx#labels the card total as estimated and explains how it is computed (D-22)"
        status: pass
    human_judgment: false
  - deliverable: "Credit notes never move price or saving"
    verification:
      - kind: test
        ref: "src/features/prices/PreciosTab.test.tsx#does not let a credit note of the same supplier and concept move the price or the saving (D-06)"
        status: pass
    human_judgment: false
  - deliverable: "Supplier filter reduces the comparison like the Dashboard"
    verification:
      - kind: test
        ref: "src/features/prices/PreciosTab.test.tsx#follows the supplier filter like the Dashboard: one store left means no saving and a $0.00 total (D-02, D-03)"
        status: pass
    human_judgment: false
  - deliverable: "Six-tab list in order and scrolling below 768 px"
    verification:
      - kind: test
        ref: "src/features/shell/AppShell.test.tsx#keeps the list on one line, scrolling horizontally below 768 px (UI-SPEC Shell and tab)"
        status: pass
      - kind: command
        ref: "pnpm verify"
        status: pass
    human_judgment: false
---

# Phase 5 Plan 01: Precios tracer Summary

**One wired path from loaded invoices to a sixth «Precios» tab: pure Big-based price domain (SAT unit table, purchases of accepted products, per-store median, cheapest store, estimated saving), a hook over the Dashboard's filtered view, a sortable TanStack v9 products table and a labeled savings card.**

## Accomplishments

- Price domain under `src/domain/prices`: `units.ts` (ClaveUnidad table with decimal-string factors in a module-scope Map, D-32 piece codes), `content.ts` (`resolveContent`), `purchases.ts` (`productIndex`, `extractPurchases`), `compare.ts` (`median`, `compareProduct`, `comparePrices`). No imports from lib, stores, features or components.
- `usePricesView` reads `useDashboardView()` and feeds `view.visible` to the domain, so date, supplier and category filters change the Precios rows exactly like the Dashboard figures.
- `PreciosTab` (heading, intro, savings card with outline badge «estimado», 28/600 tabular total and the D-22 note) and `PricesTable` (Producto, Tienda más barata, Precio as «{precio} / kg|L|pieza», Tiendas, Ahorro estimado; default sort by saving descending, rows without saving last, ties by Producto).
- Shell: `AppTab` gains `"precios"`, `TABS` gets the entry after Productos, and the list scroll modifiers move from `max-sm:` to `max-md:` (44 px trigger height stays `max-sm:`). Tab-order tests (AppShell, DashboardTab) and the e2e smoke order now expect the six tabs.
- Tracer feedback gate: the `<verify>` of Task 1 (vitest on prices, shell, dashboard, typecheck, lint) passed end-to-end before Task 2; expansion continued.

## Task Commits

1. Task 1 (tracer): `0d6b6e3` feat(05-01): Precios tab tracer from loaded invoices to cheapest store, price per kg and estimated saving
2. Task 2: `d640cd8` feat(05-01): six-tab list scrolls below 768 px and the smoke test expects Precios

## Deviations from Plan

None - plan executed exactly as written.

Notes (not deviations): the tab renders the table only when at least one product has purchases, and the empty states, filter bar, tools row and the cell variants «Solo en {tienda}» and «mediana · n compras» of the UI-SPEC are left to the later plans, as the plan's task list does not include them. One small addition of copy: `es.prices.notNormalized` («No normalizado») for a product whose purchases cannot be normalized, so the Precio cell is never empty.

## Verification

- `pnpm exec vitest run src/features/prices src/features/shell src/features/dashboard`: 13 files, 328 tests pass.
- `pnpm verify` (lint, typecheck, vitest 2951 passed / 10 skipped, next build): pass. ESLint reports one pre-existing warning in `src/lib/client/navigation.ts` (unused disable directive), untouched by this plan.
- Acceptance greps: `"precios"` in sessionStore and AppShell, `kind === "ingreso"` and `conceptAmounts` in purchases.ts, XKI/KT/SET and `new Map` in units.ts, no `@/lib|stores|features|components` import in `src/domain/prices`, no `fetch(|XMLHttpRequest|sendBeacon` in the price files, `"Precios"` in both tab-order tests, `max-md:overflow-x-auto` in AppShell and its test (no `max-sm:overflow-x-auto`), `"Precios",` in the e2e smoke file. All pass.
- The e2e smoke runs against the production build in Plan 05-12; here it only type-checks and lints.

## Known Stubs

None. The unsized-piece branch of `resolveContent` deliberately returns `sized: false` with source `unsized`; Plan 05-05 (size reader) and 05-10 (user correction) extend it as the plan's interfaces state.

## Threat Flags

None. No network call, endpoint or storage was added (T-05-02 mitigated by the negative grep); vendor text renders as React text only (T-05-03); Big from strings and the ingreso-only filter mitigate T-05-04.

## Self-Check: PASSED

- Created files exist: units.ts, content.ts, purchases.ts, compare.ts, usePricesView.ts, PreciosTab.tsx, PricesTable.tsx, PreciosTab.test.tsx.
- Commits `0d6b6e3` and `d640cd8` are on the branch.
