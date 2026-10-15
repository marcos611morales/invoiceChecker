---
phase: 02-dashboard-de-gasto-confiable
plan: 10
subsystem: ui
tags: [kpi, formatting, big.js, tailwind, zustand, vitest]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "kpis, kpiDeltas, previousPeriod, previousFilters, applyFilters, resolveRange, formatMoney, month label helpers and the filtered Dashboard (Plans 02-05, 02-08, 02-09)"
provides:
  - "formatPercent, formatDelta, periodLabel, formatCount in src/lib/format.ts"
  - "notasSubLabel, monthsSubLabel, deltaLine in src/lib/copy/messages.ts and es.dashboard.kpis.* copy keys"
  - "--chart-1 and --positive tokens (both themes) with --color-chart-1 and --color-positive mappings"
  - "KpiRow with four cards, sub-labels and previous-period delta lines (props current, deltas, previousLabel, mode)"
  - "DashboardTab computing current and previous-period KPIs under the same supplier and forma filters"
affects: [02-11, 02-12, 02-13, 02-14, 02-15]

actuals:
  tokens: 22000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Percent text composed by the app (no Intl percent style): half-up to one decimal at display, space before %, U+2212 minus, never negative zero"
    - "Delta direction is derived from the rounded value so +0.0 / -0.0 never appear"
    - "Card test ids come from a literal testId field per card; delta element id is {testId}-delta"

key-files:
  created:
    - src/features/dashboard/KpiRow.test.tsx
  modified:
    - src/lib/format.ts
    - src/lib/format.test.ts
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - src/app/globals.css
    - src/features/dashboard/KpiRow.tsx
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx

key-decisions:
  - "A decrease uses the --positive token with a down arrow; an increase is neutral foreground with an up arrow; the destructive token is not used in the KPI row (UI-SPEC decision 2, D-20)"
  - "A delta shows both a sign and an arrow, plus a screen-reader word (subió/bajó) placed before the text; a flat delta shows no arrow and no word"
  - "The mode prop of KpiRow is exposed as data-iva-mode on the grid; the figures themselves are already computed in that mode by the caller"
  - "Previous-period comparison keeps the supplier and forma filters and shifts only the range (previousFilters), per D-20"

patterns-established:
  - "formatPercent/formatDelta/periodLabel are the only places percent and period text are composed"
  - "KPI figures flow DashboardTab -> kpis()/kpiDeltas() -> KpiResult/KpiDeltas -> KpiRow; KpiRow does no arithmetic"

requirements-completed: [DASH-01, DASH-06, DASH-10]

coverage:
  - id: D1
    description: "Percent, delta and period text follow the UI-SPEC (12.4 %, +12.4 %, 8.0 % with U+2212, ene-jun 2025) and never show a negative zero"
    requirement: "DASH-10"
    verification:
      - kind: unit
        ref: "src/lib/format.test.ts#formatPercent (D-40, REGLA-04)"
        status: pass
      - kind: unit
        ref: "src/lib/format.test.ts#formatDelta (D-20)"
        status: pass
      - kind: unit
        ref: "src/lib/format.test.ts#periodLabel (D-20)"
        status: pass
    human_judgment: false
  - id: D2
    description: "KPI sub-labels (credit notes in singular/plural, stated calendar-month divisor) and the delta sentence"
    requirement: "DASH-06"
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#KPI sub-labels and delta line (D-18, D-20, DASH-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "--chart-1 and --positive color tokens exist in both themes and are mapped in @theme inline"
    verification:
      - kind: other
        ref: "grep -c '--positive' src/app/globals.css (3) and grep -c '--chart-1' src/app/globals.css (3)"
        status: pass
    human_judgment: true
    rationale: "Token values are asserted by grep only; contrast on real surfaces in both themes needs a visual check"
  - id: D4
    description: "Four KPI cards (Gasto total, Facturas, Ticket promedio, Promedio mensual) with muted zeros, dash for a null ticket, delta direction styling and no destructive color"
    requirement: "DASH-01"
    verification:
      - kind: unit
        ref: "src/features/dashboard/KpiRow.test.tsx#KpiRow: cards, sub-labels and previous-period deltas"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dashboard wiring: previous period of equal length under the same supplier and forma filters; Sin datos del periodo anterior for the 2025 sample; +12.4 % case; credit notes apart; Sin IVA changes money but not the count"
    requirement: "DASH-01"
    verification:
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#Dashboard tab: KPI row (DASH-01, DASH-06, D-18, D-19, D-20, D-39)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A 13-character MXN amount ($12,345,678.90) fits each KPI card without truncation at 1200 px and at 360 px"
    verification:
      - kind: unit
        ref: "src/features/dashboard/KpiRow.test.tsx#renders a 13-character amount in full (class assertions only)"
        status: pass
    human_judgment: true
    rationale: "Plan marks this as a backstop: jsdom cannot measure layout, so the real fit at 1200 px and 360 px needs a human look"

duration: 25min
completed: 2026-10-15
status: complete
plan_head_before: d3457b7ad74b1983284b325d48a05017366fd266
plan_head_after: 380483597b0f595d4b7fa957138198dfbf31bf13
commits: 4
---

# Phase 2 Plan 10: Full KPI row with previous-period deltas Summary

**Four KPI cards (Gasto total, Facturas, Ticket promedio, Promedio mensual) with stated divisor, credit-note sub-label and honest previous-period deltas, built on app-composed percent text ("12.4 %", true minus, half-up at display) and the new --chart-1 and --positive tokens.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-15T19:48:00Z
- **Completed:** 2026-10-15T20:14:00Z
- **Tasks:** 2 (both TDD, RED and GREEN commits each)
- **Files modified:** 10

## Accomplishments
- `formatPercent`, `formatDelta`, `periodLabel`, `formatCount` in `format.ts`: percent composed by hand (Intl percent style writes no space), rounded half-up to one decimal only at display, U+2212 for negatives, "0.0 %" for anything that rounds to zero, direction derived from the rounded value.
- Copy keys `es.dashboard.kpis.*` and message functions `notasSubLabel`, `monthsSubLabel`, `deltaLine`.
- `--chart-1` (#737373 / #A3A3A3) and `--positive` (#166534 / #4ADE80) in both themes, mapped as `--color-chart-1` and `--color-positive`.
- `KpiRow` rewritten for the four cards: 1/2/4 column grid (sm and min-[1200px]), 28/600 tabular no-wrap values, muted zeros and "—" ticket, "+N notas de crédito" and "Entre N meses del calendario" sub-labels, delta lines (up neutral with arrow, down in --positive with arrow, flat neutral, null "Sin datos del periodo anterior" muted with no arrow and no percent).
- `DashboardTab` computes `kpis` for the visible set and for the previous period (same supplier and forma filters via `previousFilters`), feeds `kpiDeltas`, and passes `periodLabel` of the previous range.

## TDD Gate Compliance

| Task | RED commit | GREEN commit | REFACTOR |
|------|-----------|--------------|----------|
| 1 | `0c2ca42` test(02-10) | `1195d2c` feat(02-10) | none needed |
| 2 | `8fc3022` test(02-10) | `3804835` feat(02-10) | none needed |

RED evidence (semantic assessment): Task 1 tests failed with "formatPercent/notasSubLabel/... is not a function" on the planned assertions (15 failures, the pre-existing 48 tests still passing). Task 2 tests failed because the planned elements did not exist (`Unable to find an element by [data-testid="kpi-facturas"]`, `kpi-gasto-delta`, "Entre 12 meses del calendario"), 24 failures, and the old KpiRow props. No syntax, import or fixture faults. The `gsd_run check tdd-red-evidence` classifier was not run (no JSON record written; Vitest console output inspected directly).

## Task Commits

1. **Task 1 RED: percent/delta/period tests** - `0c2ca42` (test)
2. **Task 1 GREEN: formatting, copy, tokens** - `1195d2c` (feat)
3. **Task 2 RED: KpiRow and DashboardTab KPI tests** - `8fc3022` (test)
4. **Task 2 GREEN: KpiRow and DashboardTab wiring** - `3804835` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `src/lib/format.ts` - formatPercent, formatDelta, periodLabel, formatCount
- `src/lib/format.test.ts`, `src/lib/copy/messages.test.ts` - tests for the above
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - KPI copy keys and sub-label/delta-line functions
- `src/app/globals.css` - --chart-1 and --positive tokens and mappings
- `src/features/dashboard/KpiRow.tsx` - the full four-card row
- `src/features/dashboard/KpiRow.test.tsx` - new component tests
- `src/features/dashboard/DashboardTab.tsx` - current and previous-period KPIs
- `src/features/dashboard/DashboardTab.test.tsx` - KPI row integration tests

## Decisions Made
- Delta lines carry sign, arrow and sentence (the UI-SPEC example shows only the arrow glyph; this follows the plan's flagged assumption).
- The screen-reader word precedes the delta text so it reads "subió +12.4 % vs. ene–jun 2025".
- `mode` is surfaced as `data-iva-mode` on the grid because KpiRow does no arithmetic; the values arrive already computed in that mode.
- Where the range is null (nothing loaded with a usable month) the previous visible set is empty and the label is an empty string; this branch only exists when `ledger.length > 0` but no entry has a month, in which case all deltas are null.

## Deviations from Plan

None - plan executed exactly as written.

(Minor self-correction during Task 2: a code comment containing the word "truncated" matched the acceptance grep for truncation classes, so the comment was reworded before the GREEN commit.)

## Issues Encountered
- `pnpm lint` reports one pre-existing warning (unused eslint-disable directive in `src/lib/client/navigation.ts`); out of scope, not changed.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths or trust-boundary schema changes.

## Verification
- `pnpm exec vitest run src/lib src/features/dashboard`: pass.
- `pnpm verify` (lint, typecheck, test: 601 passed / 8 skipped, build): exit 0.
- Acceptance greps: `--positive` 3, `--chart-1` 3, no `style: "percent"` or `new Date` in format.ts, no `(text|bg|border)-destructive` in KpiRow.tsx, no truncation classes, `kpi-promedio` present.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 02-11 onward can use `--chart-1` and `--positive`, `formatPercent` and `periodLabel`; `SupplierRow.pct` fractions go through `formatPercent`.
- Human backstop pending: check the 13-character amount at 1200 px and 360 px, and token contrast in both themes.
- Shared requirement IDs DASH-01, DASH-06, DASH-10 are listed here only; REQUIREMENTS.md was not modified because sibling plans declare them too.

## Self-Check: PASSED

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-15*
