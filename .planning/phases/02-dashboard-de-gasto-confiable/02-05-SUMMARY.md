---
phase: 02-dashboard-de-gasto-confiable
plan: 05
subsystem: accounting-domain
tags: [big.js, selectors, filters, kpi, vitest, tdd]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "LedgerEntry/buildLedger (02-03, 02-04), months helpers and decimal helpers (02-01 to 02-02), ledgerFactory test support"
provides:
  - "filters.ts: Filters model, EMPTY_FILTERS, applyFilters (single filter pipeline), loadedSpan, resolveRange, normalizeRange, supplierOptions, formaOptions, previousFilters, isDefaultFilters"
  - "aggregate.ts: kpis, deltaFraction, kpiDeltas, monthlySeries, supplierRanking (plus existing entryAmount, totalSpend)"
  - "decimal.ts: fromInteger"
affects: [02-06, 02-07, 02-08, 02-09, 02-10, 02-11, 02-12, 02-13, 02-14, 02-15, phase-03-export]

actuals:
  tokens: 9600
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "One applyFilters feeds every aggregate; aggregates take only the visible set (FILT-05)"
    - "Every Big division guarded before it runs; fractions (0.124 = 12.4 %) stay exact Big values"
    - "Map/Set for all RFC and forma groupings; one module-scope Intl.Collator('es') per module"
    - "RED via a stub module that exports the surface with no behavior, so tests fail on assertions rather than on a missing import"

key-files:
  created:
    - src/domain/accounting/filters.ts
    - src/domain/accounting/filters.test.ts
    - src/domain/accounting/aggregate.test.ts
  modified:
    - src/domain/accounting/aggregate.ts
    - src/domain/accounting/decimal.ts
    - src/domain/accounting/decimal.test.ts

key-decisions:
  - "SupplierRow.pct is a fraction (0.25 = 25 %), like the KPI deltas, so the UI can feed it to Intl percent style directly"
  - "Option and ranking sorts add the RFC/key as a final deterministic tiebreak after count/net and the Spanish-collated label"
  - "formaOptions counts an entry once per distinct form it carries (a Set over entry.formas)"
  - "kpiDeltas returns all four null when the previous KPI has hasData false; otherwise each delta is independent"

patterns-established:
  - "Selectors are pure, take readonly arrays, return new arrays and never mutate"
  - "Date filter reads LedgerEntry.month (imputation month); an entry with month null always passes it"

requirements-completed: [DASH-01, DASH-02, DASH-04, DASH-06, FILT-01, FILT-02, FILT-04, FILT-05]

coverage:
  - id: D1
    description: "applyFilters: inclusive imputation-month range, RFC set, forma intersection, AND composition, no mutation, order kept"
    requirement: "FILT-01, FILT-02, FILT-04, FILT-05"
    verification:
      - kind: unit
        ref: "src/domain/accounting/filters.test.ts#applyFilters"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loaded span, resolveRange/normalizeRange, option lists with counts and Spanish ordering, previousFilters"
    requirement: "FILT-01, FILT-02, FILT-04"
    verification:
      - kind: unit
        ref: "src/domain/accounting/filters.test.ts#loadedSpan"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/filters.test.ts#supplierOptions"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/filters.test.ts#previousFilters"
        status: pass
    human_judgment: false
  - id: D3
    description: "KPIs (gasto, facturas, notas, ticket, promedio), guarded deltas and zero-filled monthly series"
    requirement: "DASH-01, DASH-02, DASH-06"
    verification:
      - kind: unit
        ref: "src/domain/accounting/aggregate.test.ts#kpis"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/aggregate.test.ts#deltaFraction"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/aggregate.test.ts#monthlySeries"
        status: pass
    human_judgment: false
  - id: D4
    description: "Supplier ranking per RFC with net, facturas, ticket and share, negative nets last"
    requirement: "DASH-04"
    verification:
      - kind: unit
        ref: "src/domain/accounting/aggregate.test.ts#supplierRanking"
        status: pass
    human_judgment: false
  - id: D5
    description: "KPI, series and ranking totals agree over the same visible set"
    requirement: "FILT-05"
    verification:
      - kind: unit
        ref: "src/domain/accounting/aggregate.test.ts#one visible set feeds every aggregate"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-10-14
status: complete
plan_head_before: fd010cc1291d691623df93a895a8a36fb0096a30
plan_head_after: 0d53df8f61ca9f12fe2f16630cfa055551234eb4
commits: 4
---

# Phase 2 Plan 05: Filters and Aggregates Summary

**Pure, guarded selectors for the dashboard: a single `applyFilters` (imputation-month range, RFC set, forma intersection) plus Big-exact KPIs, previous-period deltas, a zero-filled monthly series and a per-RFC supplier ranking.**

## Performance

- **Duration:** about 4 min
- **Started:** 2026-10-15T03:14:19Z
- **Completed:** 2026-10-15T03:18:05Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- `filters.ts` gives the one filter pipeline: `applyFilters` keeps entries by the imputation month (credit notes follow their related invoice, D-15), by supplier RFC, and by forma intersection, with an entry whose month is null never hidden by the date filter. Also `loadedSpan` over every loaded entry (D-12, D-41), `normalizeRange` (range equal to span becomes null), option lists with counts independent of other filters and exclusions (D-14), and `previousFilters` (D-20).
- `aggregate.ts` keeps `entryAmount`/`totalSpend` and adds `kpis`, `deltaFraction`, `kpiDeltas`, `monthlySeries` and `supplierRanking`. Facturas counts counted Ingreso only; notas apart; ticket and promedio guarded; a percentage change is null against zero, a non-positive base or a period with no counted entry.
- `decimal.ts` gets `fromInteger` for counts under strict Big.
- 28 filter tests, 30 aggregate tests and 2 decimal tests; the shared-visible-set test proves the KPI, the series and the ranking give the same total in both IVA modes.

## Task Commits

1. **Task 1: filters** - RED `4694908` (test), GREEN `16c18de` (feat)
2. **Task 2: aggregates + fromInteger** - RED `4e2d795` (test), GREEN `0d53df8` (feat)

**Plan metadata:** committed separately as the docs(02-05) SUMMARY commit.

## TDD Gate Compliance

- **RED (both tasks):** each RED commit contains the test file plus a stub module that exports the planned surface with no behavior, so the targeted tests fail on their planned assertions instead of on a missing import. Task 1: 25 of 28 tests failed on assertions (the other 3 pass incidentally on empty results, e.g. "no forms never matches"). Task 2: 30 failures across `aggregate.test.ts` and `decimal.test.ts` on value assertions (`expected -1 to be 2`, `expected [] to deeply equal [...]`, etc.). The `gsd_run check tdd-red-evidence` classifier was not run: the reports were read from the default Vitest reporter, which is not one of the classifier's supported formats, so the semantic assessment was done by reading the failing assertion text. Semantic assessment: the target tests executed and failed on the planned behavior, not on setup, import or syntax errors.
- **GREEN:** both feat commits follow their test commits and the full suites pass.
- **REFACTOR:** none needed.

## Files Created/Modified
- `src/domain/accounting/filters.ts` - filters model, applyFilters, span, option lists, previous-period filters
- `src/domain/accounting/filters.test.ts` - 28 tests
- `src/domain/accounting/aggregate.ts` - added KPI, delta, series and ranking selectors
- `src/domain/accounting/aggregate.test.ts` - 30 tests including the shared-visible-set check
- `src/domain/accounting/decimal.ts` - `fromInteger`
- `src/domain/accounting/decimal.test.ts` - `fromInteger` cases

## Decisions Made
- `SupplierRow.pct` is a fraction (0.25 for 25 %), the same convention as the KPI deltas, because the UI-SPEC formats percentages with `Intl` percent style which takes a fraction. The plan interface did not state the scale; Plans 02-06 to 02-15 should treat it as a fraction.
- Sort tiebreaks end on the RFC/key so the order is deterministic.
- `formaOptions` dedupes forms within one entry before counting.

## Deviations from Plan

None - plan executed exactly as written. (The stub-module RED approach is an execution detail, not a plan deviation; it satisfies "tests first, fail on assertions".)

**Total deviations:** 0.

## Issues Encountered
- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive). It is outside this plan's files and was left alone (0 errors).

## Known Stubs

None. The RED stubs were replaced by real implementations in the GREEN commits.

## Threat Flags

None. No new endpoint, auth path or file access; mitigations T-02-09 (guarded divisions with tests for months 0, facturas 0, previous at or below zero and total at or below zero), T-02-10 (Map/Set only, `__proto__` tests) and T-02-11 (one `applyFilters`, shared-visible-set test) are implemented.

## User Setup Required

None - no external service configuration required.

## Verification
- `pnpm exec vitest run src/domain/accounting` - 172 passed, 5 skipped (gated real-sample tests)
- `pnpm verify` (lint, typecheck, test, build) - exit 0; 409 tests passed, 8 skipped
- Acceptance greps: no `new Date|Date.now|Record<string` in `filters.ts`; no `Number(|parseFloat|toFixed(|new Date|Record<string` in `aggregate.ts`; 5 `new Map/Set` and 1 `Intl.Collator` in `filters.ts`; 7 exported functions in `aggregate.ts`.

## Next Phase Readiness
Plan 02-06 (store) can hold `Filters`, call `normalizeRange` on range edits and reset to `null` on a widening batch. Rendering plans consume `applyFilters` output only. Shared requirement IDs were not marked complete in REQUIREMENTS.md (recorded in the frontmatter above, per the parallel-execution rules).

## Self-Check: PASSED

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-14*
