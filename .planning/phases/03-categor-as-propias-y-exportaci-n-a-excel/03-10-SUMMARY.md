---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 10
subsystem: dashboard-category-variation
status: complete
tags: [category-variation, dashboard, big.js, delta-line, tdd]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "selectView / ScopedEntry / categoryBreakdown / useDashboardView (03-08), category filter and scoped ledger (03-09)"
provides:
  - "categories.ts: CategoryRow.variation, categoryMonthTotals, VariationTotals and the variation argument of categoryBreakdown"
  - "view.ts: DashboardView.variationMonths and the month pair read under every filter except the date"
  - "DeltaLine.tsx: shared delta line for the KPI cards and the category rows"
  - "CategorySpend: sub-caption, variation per row and the nothing-classified hint with «Ir a Categorías»"
  - "Copy: es.charts.noPreviousMonth, categoryHint, goToCategories and categorySubCaption"
affects: [03-11, 03-12, 03-13, 03-14, 03-15]

actuals:
  tokens: 26000
  tasks: 2
  commits: 4
plan_head_before: 24c9896ee4325b668b6a51be123430825d4b2038
plan_head_after: 8053a04b4b603935e0592944f5e02f934586f426

tech-stack:
  added: []
  patterns:
    - "A per-category comparison month pair is read with its own range (applyFilters with {from: previous, to: last}) so the date filter never limits the previous month, while supplier, forma and category filters still apply"
    - "deltaFraction is the only place that turns two totals into a percentage; it returns null for a missing or non-positive base, so a percentage against $0 cannot be rendered"

key-files:
  created:
    - src/features/dashboard/DeltaLine.tsx
    - src/features/dashboard/CategorySpend.test.tsx
  modified:
    - src/domain/accounting/categories.ts
    - src/domain/accounting/categories.test.ts
    - src/domain/accounting/view.ts
    - src/domain/accounting/view.test.ts
    - src/features/dashboard/KpiRow.tsx
    - src/features/dashboard/CategorySpend.tsx
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "The variation argument of categoryBreakdown defaults to null instead of being a required fifth parameter, so the 20+ existing call sites keep compiling; a null pair gives every row a null variation"
  - "categorySubCaption takes nullable month labels; with no variation pair it renders only the average part, and CategorySpend hides the sub-caption when the range has 0 months"
  - "The variation is shown on every row, including a negative-net row (its caption is the negative-net sentence, the DeltaLine still sits on the right)"

patterns-established:
  - "DeltaLine({ testId, delta, comparisonLabel, missingText }) renders data-testid {testId}-delta; category rows use category-delta-{index}"

requirements-completed: [DASH-03, DASH-05, DASH-07]

coverage:
  - id: D1
    description: "Each category row shows the variation of the last month of the range against the previous calendar month (even outside the range) under all filters except the date, with arrow, sign, color and the sr-only «subió»/«bajó»; «Sin dato del mes anterior» when nothing is comparable, never a percentage against $0"
    requirement: DASH-07
    verification:
      - kind: unit
        ref: "src/domain/accounting/categories.test.ts#categoryMonthTotals and the variation per category (D-17)"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/view.test.ts#selectView month-over-month variation per category (D-17)"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/CategorySpend.test.tsx#CategorySpend: variation per row (DASH-07, D-17)"
        status: pass
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#compares the last month with the previous calendar month for each category (DASH-07, D-17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The block header states the calendar months of the divisor and the variation pair («Promedio mensual entre {n} meses del calendario · Variación: {mes} vs. {mes}», singular for one month)"
    requirement: DASH-05
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#category block sub-caption (D-16, D-17)"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/CategorySpend.test.tsx#CategorySpend: sub-caption (DASH-05, D-16)"
        status: pass
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#explains the divisor and the pair of months of the variation in the block header (D-16, D-17)"
        status: pass
    human_judgment: false
  - id: D3
    description: "E6 empty: the Info Alert «Todavía no clasificaste…» with «Ir a Categorías» (opens the Categorías tab) shows above the rows while no supplier and no concept rule exist, and disappears after one assignment"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "src/features/dashboard/CategorySpend.test.tsx#CategorySpend: nothing classified yet (E6 empty)"
        status: pass
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#shows the hint while nothing is classified and leaves it once a supplier is assigned (E6 empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "E6 populated, partial and overflow: every category with spend is listed (20 rows, no «Ver todas»), a zero net has no fill, a negative net has the tick and its caption; KPI cards render as before with the extracted DeltaLine"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "src/features/dashboard/CategorySpend.test.tsx#CategorySpend: rows (E6 populated, partial, overflow)"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/KpiRow.test.tsx#KpiRow: previous-period deltas (D-20, UI-SPEC decision 2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual look of the third line (caption left, variation right, wrapping below on narrow widths) and the hint Alert in both themes"
    requirement: DASH-07
    verification: []
    human_judgment: true
    rationale: "Layout and contrast are asserted by classes only in jsdom; a browser check in light and dark and at phone width is the verifier's call"

duration: 20 min
completed: 2026-10-17
---

# Phase 3 Plan 10: Category variation, explained divisor and hint Summary

**«Gasto por categoría» now shows each category's change of the last month against the previous calendar month (read outside the date range, under every other filter, null instead of a percentage against $0), the sub-caption that explains the monthly-average divisor and the compared months, and the «Todavía no clasificaste…» hint with «Ir a Categorías»; the delta line is a shared component.**

## Performance

- **Duration:** about 20 min
- **Tasks:** 2 (TDD, 4 commits)
- **Files modified:** 13 (2 new)

## Accomplishments

- `categoryMonthTotals(scoped, month, mode)` sums the parts of counted entries of one month per category. `categoryBreakdown` takes a `VariationTotals | null` pair and sets `CategoryRow.variation = deltaFraction(last ?? 0, previous ?? null)`, so a category absent from the previous month, or with a previous total of zero or below, is null (T-03-21).
- `selectView` computes `variationMonths = { last: range.to, previous: previousPeriod(range.to, range.to).from }` and reads that pair with `applyFilters(ledger, { ...filters, range: pair }, span)` plus `scopeToCategories`: supplier, forma and category apply, the date filter does not restrict the previous month. It is null without a range.
- `DeltaLine` extracted from `KpiRow` with identical markup and classes; `KpiRow` passes `es.dashboard.kpis.noPrevious`, and its tests are unchanged.
- `CategorySpend` gets `months`, `variationMonths`, `showHint` and `onGoToCategories`: the sub-caption, the third line as a flex-wrap row (caption left, `DeltaLine` right with `category-delta-{index}`), and the hint Alert above the list. `DashboardTab` shows the hint while `supplierCategories` and `conceptRules` are both empty and switches to the Categorías tab on click.

## Task Commits

1. Task 1 RED: `0191fbf` test(03-10) failing tests for the month-over-month variation per category
2. Task 1 GREEN: `9f83eba` feat(03-10) month-over-month variation per category in the pure view
3. Task 2 RED: `12662e0` test(03-10) failing tests for the category variation line, sub-caption and hint
4. Task 2 GREEN: `8053a04` feat(03-10) category variation, sub-caption and nothing-classified hint in Gasto por categoria

## TDD Gate Compliance

RED commits precede GREEN commits for both tasks; no REFACTOR commit was needed. RED evidence is the vitest console output (semantic assessment; `gsd_run check tdd-red-evidence` was not run because no TAP/JUnit report was captured). Task 1 RED: 13 tests failed, `categoryMonthTotals is not a function` for the month-total tests and `undefined` instead of `null`/the expected fraction for `variation` and `variationMonths`; the existing 43 tests kept passing. Task 2 RED: 19 tests failed on the planned behavior (missing `categorySubCaption`, no `category-delta-*` line, no sub-caption, no hint Alert, no `Ir a Categorías` button); 4 regression tests of already-existing behavior (20 rows without «Ver todas», zero net without fill, negative tick, text-not-markup) passed on purpose. One RED helper bug (`Big.div(number)` is invalid in big.js 7) was fixed before the RED commit.

## Verification

- `pnpm verify` (lint, typecheck, `vitest run` default settings, build): exit 0. Vitest: 55 test files passed, 3 skipped; 1388 tests passed, 8 skipped (pre-existing skips). No timeout under default settings, so the `--maxWorkers=3 --testTimeout=30000` rerun was not needed.
- `pnpm exec eslint .`: 0 errors, 1 pre-existing warning (see Deferred Issues). `pnpm typecheck`: 0 errors.
- Acceptance greps: `variationMonths` in view.ts 8; `export function categoryMonthTotals` 1; `export function DeltaLine` in DeltaLine.tsx 1 and `function DeltaLine` in KpiRow.tsx 0; «Sin dato del mes anterior» in es.ts 1; «Ir a Categorías» in es.ts 1.

## Deviations from Plan

### Auto-fixed Issues

None for rules 1-3. One judgment call recorded here instead:

**Minor: `variation` argument defaults to `null`.** The plan's interface block gives `categoryBreakdown(scoped, mode, months, nameOf, variation: {...} | null)`. A defaulted parameter of the same type keeps the many existing 4-argument calls in tests valid; every production call (`selectView`) passes the pair explicitly. Behavior and typing for callers that pass the argument are exactly as planned.

**Total deviations:** 0 auto-fixed, 1 minor signature choice. **Impact:** none on scope.

## Decisions Needing Attention (not blocking)

- **Variation on negative-net rows.** The plan's three-line row lists the variation for every row; a negative-net row therefore shows the negative-net sentence on the left and its variation (or «Sin dato…») on the right. Say if a negative row should hide the variation.
- **Previous month is the calendar month before `range.to`, not the previous month with data.** A gap month (no invoices loaded) gives «Sin dato del mes anterior» for every category, as D-17 specifies.
- **Hint rule.** The hint shows only when there are no supplier assignments and no concept rules at all (plan rule); it stays hidden once any rule exists even if every visible row is still «Sin categoría».

## Deferred Issues

- `src/lib/client/navigation.ts:6`: ESLint warning «Unused eslint-disable directive» (pre-existing, outside this plan's files; same one noted in 03-09).

## Known Stubs

None.

## Threat Flags

None. No new endpoint, storage or trust boundary. T-03-21 (division by a zero or negative previous month) is mitigated by `deltaFraction` returning null, with tests for zero, negative and missing previous months in categories.test.ts and CategorySpend.test.tsx.

## Self-Check: PASSED

- Files exist: all 13 listed files and this SUMMARY.
- Commits exist in this branch: 0191fbf, 9f83eba, 12662e0, 8053a04.
