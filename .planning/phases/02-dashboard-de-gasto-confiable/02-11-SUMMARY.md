---
phase: 02-dashboard-de-gasto-confiable
plan: 11
subsystem: ui
tags: [recharts, shadcn-chart, react-is, bar-chart, tailwind, vitest]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "MonthPoint / monthlySeries, formatMoney and month label helpers, DateRange, --chart-1 token, filtered Dashboard and KPI row (Plans 02-05, 02-09, 02-10)"
provides:
  - "recharts 3.8.0 and react-is 19.3.0 as exact pins, plus the shadcn chart component (src/components/ui/chart.tsx)"
  - "TrendChart: monthly spend bars, dashed average line, zero baseline, HTML legend, sr-only data table"
  - "trendData adapter: toTrendData, tickLabel, isTrendDatum, TrendDatum"
  - "es.charts trend copy keys and trendAriaLabel / averageLegend message functions"
affects: [02-12, 02-13, 02-14, 02-15]

plan_head_before: aecc4fb01dee17209a3b39873974de3b75e10495
plan_head_after: 2a223ee9826574dbc74d92a5ed7c75f4277f4d78

actuals:
  tokens: 30000
  tasks: 1
  commits: 3

tech-stack:
  added: [recharts@3.8.0, react-is@19.3.0]
  patterns:
    - "Chart plotting number derived from toMoneyString output (geometry only); every displayed text comes from formatMoney via the datum's amountText"
    - "ChartConfig is a module-scope constant (satisfies ChartConfig); nothing from invoice data reaches the shadcn style block"
    - "Tooltip payloads are narrowed with a type guard (isTrendDatum), never cast"
    - "role=img wraps only the chart; the sr-only table is a sibling so it stays reachable"

key-files:
  created:
    - src/components/ui/chart.tsx
    - src/features/dashboard/trendData.ts
    - src/features/dashboard/trendData.test.ts
    - src/features/dashboard/TrendChart.tsx
    - src/features/dashboard/TrendChart.test.tsx
  modified:
    - package.json
    - pnpm-lock.yaml
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "TrendChart is not yet mounted in DashboardTab; Plan 02-12 composes it with the supplier ranking, as the plan states"
  - "Y axis uses Intl.NumberFormat('es-MX', { notation: 'compact' }) exactly as the plan specifies (no currency symbol on ticks)"
  - "Average ReferenceLine uses ifOverflow='extendDomain' so the dashed line is never clipped when it lies outside the bar range"

patterns-established:
  - "Pure chart adapter (trendData.ts) separate from the React chart so geometry numbers and exact text are unit-testable under jsdom, where recharts renders no SVG"

requirements-completed: [DASH-02, DASH-06, DASH-10]

coverage:
  - id: D1
    description: "Monthly adapter keeps zero-spend months as zero bars and credit-note months negative, with exact es-MX text (U+2212 for negatives) and ene / ene 25 ticks"
    requirement: "DASH-02"
    verification:
      - kind: unit
        ref: "src/features/dashboard/trendData.test.ts#toTrendData (DASH-02)"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/trendData.test.ts#tickLabel (D-21)"
        status: pass
    human_judgment: false
  - id: D2
    description: "TrendChart renders heading, range caption, accessible name, HTML legend with the average amount and an sr-only month/amount table for 1, 3 and 36 months"
    requirement: "DASH-06"
    verification:
      - kind: unit
        ref: "src/features/dashboard/TrendChart.test.tsx#TrendChart: copy and accessible name (D-21, E5)"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/TrendChart.test.tsx#TrendChart: accessible data table"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#trend chart texts (D-21)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ChartConfig is static: the injected style block contains only the --color-gasto token"
    requirement: "DASH-10"
    verification:
      - kind: unit
        ref: "src/features/dashboard/TrendChart.test.tsx#TrendChart: static chart config (T-02-19)"
        status: pass
    human_judgment: false
  - id: D4
    description: "recharts 3.8.0 and react-is 19.3.0 are exact pins, react-is resolves to 19.3.0 for recharts, and only chart.tsx was added under src/components/ui"
    verification:
      - kind: other
        ref: "pnpm ls recharts react-is; node package.json pin check; git diff --name-only -- src/components/ui (empty)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual rendering: bar colors, rounded corner of a negative bar (A5), dashed average line, tooltip, and legible X ticks beyond 12 months (preserveStartEnd, minTickGap 8)"
    verification: []
    human_judgment: true
    rationale: "Recharts renders no SVG under jsdom (ResponsiveContainer measures 0 by 0), so geometry and tick thinning cannot be asserted in unit tests; the plan defers the visual check to the final human check in Plan 02-15"

duration: 14min
completed: 2026-10-15
status: complete
---

# Phase 2 Plan 11: Monthly Trend Chart Summary

**Monthly spend bar chart (Recharts 3.8.0 via shadcn chart) with zero-filled months, negative bars, dashed average line, es-MX tooltip text and an sr-only data table, built on a pure numeric/text adapter**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-15T20:06:00Z
- **Completed:** 2026-10-15T20:20:05Z
- **Tasks:** 1 (TDD: install, RED, GREEN)
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments
- Installed react-is 19.3.0 first, then the shadcn `chart` component and recharts 3.8.0, both as exact pins; the lockfile resolves react-is to 19.3.0 for recharts and no existing shadcn component was overwritten (`card.tsx` skipped).
- `trendData.ts`: pure adapter. The plotting number comes from the 2-dp money string (never a negative zero); the tooltip, table and legend texts come from `formatMoney`; ticks read "ene" in one year and "ene 25" across years.
- `TrendChart.tsx`: bars in `--chart-1`, `primary` active bar, animations off, 4 px top radius, horizontal grid at 50 % border, compact Y axis with 4 ticks, zero baseline, dashed average `ReferenceLine`, `preserveStartEnd` with `minTickGap` 8 beyond 12 months, es-MX tooltip (long month title, "Gasto" row with exact amount), HTML legend, `role="img"` named "Gasto por mes de {mes aaaa} a {mes aaaa}" and an sr-only table sibling.
- Static module-scope `trendChartConfig` (T-02-19) verified by a test that reads the injected style block.

## Task Commits

1. **Task 1: Install the chart stack and build the monthly trend chart** (TDD)
   - install: `9e31c66` (chore)
   - RED: `6fb29e9` (test)
   - GREEN: `2a223ee` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Gate Compliance

- **RED:** `6fb29e9` adds trendData, TrendChart and message tests with compile-only stubs. The run showed 18 failing tests, every one an assertion on the planned behavior (for example `expected '2025-01' to be 'ene'`, `Unable to find an accessible element with the role "table"`); no import or syntax failures, no zero-test discovery. Semantic assessment: the target tests executed and failed for the intended reason. The RED evidence was not run through `check tdd-red-evidence` because this is a `type: execute` plan with a `tdd="true"` task, not a `type: tdd` plan.
- **GREEN:** `2a223ee`; the full dashboard and lib suites pass (253 tests), then `pnpm verify` passes (lint, typecheck, 621 tests, build).
- **REFACTOR:** none needed.

## Files Created/Modified
- `src/components/ui/chart.tsx` - shadcn chart primitives (ChartContainer, ChartTooltip, ChartTooltipContent), unmodified registry output
- `src/features/dashboard/trendData.ts` - TrendDatum, toTrendData, tickLabel, isTrendDatum
- `src/features/dashboard/TrendChart.tsx` - the monthly trend block
- `src/features/dashboard/trendData.test.ts`, `TrendChart.test.tsx` - adapter and component tests
- `src/lib/copy/es.ts` - `es.charts` trend keys (trendHeading, trendLegendBars, trendTooltipRow, trendTableMonth)
- `src/lib/copy/messages.ts`, `messages.test.ts` - `trendAriaLabel`, `averageLegend` and their tests
- `package.json`, `pnpm-lock.yaml` - react-is 19.3.0, recharts 3.8.0 (exact)

## Decisions Made
- `TrendChart` stays unmounted until Plan 02-12 composes it with the ranking, as the plan says.
- The `isTrendDatum` type guard is exported from `trendData.ts` (not in the plan's export list) so tooltip callbacks narrow recharts' untyped payload without `as` (CLAUDE.md).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the `trendTableMonth` copy key ("Mes") for the sr-only table header**
- **Found during:** Task 1 (GREEN)
- **Issue:** The accessible table needs a column header for the month column, and UI-SPEC gives no text for it. The plan's `es.charts` interface lists only three keys.
- **Fix:** Added `es.charts.trendTableMonth: "Mes"`; the amount column reuses `trendTooltipRow` ("Gasto"). The text is an inference by the executor and is flagged here for the user to confirm or change (CLAUDE.md rule 1).
- **Files modified:** src/lib/copy/es.ts, src/features/dashboard/TrendChart.tsx
- **Verification:** TrendChart table tests pass
- **Committed in:** 2a223ee

**2. [Rule 3 - Blocking] Compile-only stubs in the RED commit**
- **Found during:** Task 1 (RED)
- **Issue:** Tests importing non-existent modules fail as load errors (INVALID_RED), which does not authorize GREEN.
- **Fix:** Committed minimal stubs of `trendData.ts` and `TrendChart.tsx` with the final signatures so the tests fail on assertions.
- **Files modified:** src/features/dashboard/trendData.ts, src/features/dashboard/TrendChart.tsx
- **Committed in:** 6fb29e9

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** No scope creep. One user-facing string ("Mes") needs the user's confirmation.

## Issues Encountered
- `pnpm lint` reports one pre-existing warning (unused eslint-disable directive at `6:3`, file not touched by this plan); 0 errors. Out of scope.
- The shadcn CLI had already written `recharts` as an exact `3.8.0` entry, so the final `pnpm add recharts@3.8.0 --save-exact` was a no-op; the version was confirmed with `pnpm ls`.
- The `tick-thinning` backstop (more than 12 months uses `preserveStartEnd`, minTickGap 8) cannot be asserted under jsdom; the code path is in place and the visual check is deferred to Plan 02-15 as planned.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. `TrendChart` is intentionally not yet rendered in `DashboardTab`; Plan 02-12 wires it.

## Next Phase Readiness
- Plan 02-12 can import `TrendChart` (props `series`, `promedio`, `range`) and add the ranking keys to the same `es.charts` object.
- Open for the human check: negative-bar rounded corner (A5), tooltip appearance, and tick legibility for ranges beyond 12 months.

## Self-Check: PASSED

- Files exist: `src/components/ui/chart.tsx`, `trendData.ts`, `trendData.test.ts`, `TrendChart.tsx`, `TrendChart.test.tsx` (verified present).
- Commits `9e31c66`, `6fb29e9`, `2a223ee` are on the branch.
- Acceptance criteria: pin check exits 0; `git diff --name-only -- src/components/ui` empty; no `Cell` in TrendChart; `isAnimationActive={false}` and `preserveStartEnd` present; one module-scope config constant; no `dangerouslySetInnerHTML` under `src/features`; `pnpm typecheck`, `pnpm lint` (0 errors) and `pnpm verify` pass.

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-15*
