---
phase: 02-dashboard-de-gasto-confiable
plan: 17
subsystem: domain
tags: [cfdi, fecha, year-window, ledger, gap-closure, vitest, react-hooks]
gap_closure: true
gap_ids: [G-02-11]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "02-15 useLedger and Dashboard amount-changing alert, 02-16 exclusion-undo split, ledger null-month path (D-35, D-47)"
provides:
  - "MIN_FECHA_YEAR (2000), FechaContext and a year window inside monthOfFecha: a Fecha year outside 2000..(currentYear + 1), both ends inclusive, has no month (D-48)"
  - "buildLedger(invoices, overrides, context) with a REQUIRED FechaContext passed to both Fecha-to-month conversions (own month and credit-note imputation)"
  - "useLedger reads the browser's local year once on mount through a lazy useState initializer and injects it; src/domain still reads no clock"
  - "TEST_FECHA_CONTEXT (currentYear 2026) shared by every domain test"
  - "D-48 recorded in 02-CONTEXT.md as an exception to D-41"
affects: [phase-02-verification]

actuals:
  tokens: 9200
  tasks: 3
  commits: 4

plan_head_before: 5b6986874c6ef2527716e3340cc1ec357cbe1e54
plan_head_after: 2ac1e0c452a29938b67928c508277c3c6b1a3b95
commits: 4

tech-stack:
  added: []
  patterns:
    - "Clock injected into a pure domain as a required parameter; the one clock read lives in a lazy useState initializer (passes react-hooks/purity)"
    - "Reject at the single conversion point (monthOfFecha) so the existing null-month path does the rest"
    - "Component tests pin the year with vi.setSystemTime (Date only, no fake timers) and restore with vi.useRealTimers()"

key-files:
  created: []
  modified:
    - src/domain/accounting/months.ts
    - src/domain/accounting/ledger.ts
    - src/features/dashboard/useLedger.ts
    - tests/support/ledgerFactory.ts
    - src/domain/accounting/months.test.ts
    - src/domain/accounting/ledger.test.ts
    - src/domain/accounting/ledger.anon.test.ts
    - src/domain/accounting/ledger.realdata.test.ts
    - src/domain/accounting/quality.test.ts
    - src/features/invoices/columns.test.ts
    - src/features/dashboard/FilterBar.test.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/features/quality/QualityTab.test.tsx
    - .planning/phases/02-dashboard-de-gasto-confiable/02-CONTEXT.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "USER DECISION (locked in the plan, not reopened): the window is 2000..(current year + 1), both ends inclusive; the year is the browser's local year; the context is a required parameter; the rule is recorded as D-48 amending D-41"
  - "Rejection happens only in monthOfFecha; amountsOf and its precedence are untouched, so an out-of-window Ingreso/Egreso becomes invalido/Fecha through the existing ownMonth-null branch and Pago/Traslado/Nomina stay tipo"
  - "The existing copy 'Fecha inválida: no se suma' is reused; src/lib/copy is untouched"

patterns-established:
  - "The domain never reads a clock; any date-dependent rule takes a context object from the caller"

requirements-completed: [REGLA-05, DASH-02, DASH-06, FILT-01, CAL-01]

coverage:
  - id: D1
    description: "A Fecha whose year is outside 2000..(current year + 1), both ends inclusive, gets no month at monthOfFecha, shared by the own month and the credit-note imputation"
    requirement: "REGLA-05"
    verification:
      - kind: unit
        ref: "src/domain/accounting/months.test.ts#monthOfFecha: plausible year window (WR-03, D-48)"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/ledger.test.ts#buildLedger: Fecha year window (WR-03, D-48)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An out-of-window Ingreso/Egreso is reported under Datos inválidos with the existing text, does not sum and raises the Dashboard amount-change notice; Pago/Traslado/Nomina stay tipo with no incident"
    requirement: "CAL-01"
    verification:
      - kind: automated_ui
        ref: "src/features/quality/QualityTab.test.tsx#WR-03: lists Fecha years outside 2000..current year + 1 under Datos inválidos, and only those"
        status: pass
      - kind: automated_ui
        ref: "src/features/dashboard/DashboardTab.test.tsx#WR-03: an Ingreso dated 2205 is reported, does not sum and does not stretch the month span"
        status: pass
    human_judgment: false
  - id: D3
    description: "No out-of-window entry widens the loaded span: month list, trend and Promedio mensual divisor stay bounded"
    requirement: "DASH-06"
    verification:
      - kind: unit
        ref: "src/domain/accounting/ledger.test.ts#keeps the span, the KPIs, the series and the incidents bounded by the in-window invoices"
        status: pass
      - kind: automated_ui
        ref: "src/features/dashboard/DashboardTab.test.tsx#WR-03: both ends are inclusive (Entre 36 meses del calendario)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The window follows the browser's local year read once per mount in useLedger, with no clock read in src/domain"
    requirement: "DASH-02"
    verification:
      - kind: automated_ui
        ref: "src/features/dashboard/DashboardTab.test.tsx#WR-03: with the browser in June 2027 / June 2026 (Entre 37 meses / Entre 1 mes)"
        status: pass
      - kind: other
        ref: "grep -rnE 'getFullYear|Date[.]now|new Date[(]' src/domain prints nothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-48 recorded in 02-CONTEXT.md as an exception to D-41"
    verification: []
    human_judgment: true
    rationale: "Wording of a decision record in Spanish; the user should read the D-48 line once to confirm it says what was decided"

duration: 12min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 17: Fecha year window (G-02-11, WR-03) Summary

**monthOfFecha now rejects CFDI Fecha years outside 2000..(browser year + 1) through an injected, required FechaContext, so a damaged year (0001, 2205, 9999) lands in Datos inválidos instead of being summed and stretching the month span to thousands of months.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-16T20:03:00Z (approximate)
- **Completed:** 2026-10-16T20:15:00Z
- **Tasks:** 3 (Task 1 is the tracer, TDD)
- **Files modified:** 16

## Accomplishments

- One rule at the single Fecha-to-month point: the own month and the credit-note imputation share it, so they cannot drift. The existing null-month path then yields invalido/Fecha (Ingreso/Egreso), keeps tipo for Pago/Traslado/Nomina, drops the entry from `loadedSpan`, and the credit note falls back to the next valid related invoice or its own month.
- The browser year enters the pure domain as a required parameter; `useLedger` reads it once per mount via `useState(currentCalendarYear)` (lint-clean under react-hooks/purity). `src/domain` reads no clock and no Fecha becomes a Date (REGLA-05).
- Tests pin boundaries (1999-12-31 null, 2000-01-01 accepted, currentYear + 1 accepted, +2 rejected), the Total-over-Fecha precedence, per-kind outcomes, credit-note fallback, a bounded span/KPIs/series/incidents selector scenario, and Calidad and Dashboard component evidence with a pinned system time.
- D-48 added to 02-CONTEXT.md and the D-41 line points to it.

## Task Commits

1. **Task 1 (tracer, TDD): year window from the browser clock through useLedger and buildLedger to monthOfFecha**
   - RED: `3d8470a` (test) - Dashboard test "WR-03: an Ingreso dated 2205 ..." failed on the planned assertion: Gasto read `$348.00`, expected `$232.00`
   - GREEN: `1cf04d7` (feat) - window, required context, useLedger injection, TEST_FECHA_CONTEXT and all 11 buildLedger plus monthOfFecha test call sites
2. **Task 2: pin the window rules in the domain and record D-48** - `7e0ec3e` (test)
3. **Task 3: component evidence in Calidad de datos and the Dashboard** - `2ac1e0c` (test)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `src/domain/accounting/months.ts` - MIN_FECHA_YEAR, FechaContext, year window in monthOfFecha
- `src/domain/accounting/ledger.ts` - required `context` on buildLedger and imputationOf
- `src/features/dashboard/useLedger.ts` - browser year via lazy useState, passed as `{ currentYear }`
- `tests/support/ledgerFactory.ts` - TEST_FECHA_CONTEXT (2026)
- Nine test files - mechanical context argument; new domain and component describes tagged "WR-03"
- `.planning/phases/02-dashboard-de-gasto-confiable/02-CONTEXT.md` - D-48 and the D-41 pointer
- `.planning/REQUIREMENTS.md` - REGLA-05, DASH-02, DASH-06, FILT-01, CAL-01 marked complete (see below)

## Decisions Made

Followed the plan's locked decisions without reopening them (window 2000..(current year + 1) inclusive, required injected local year, D-48 amending D-41). Existing copy reused; no UI text invented.

## Deviations from Plan

None - plan executed exactly as written.

Notes that are not deviations:
- Task 1's tracer verify (scoped vitest, `pnpm tsc --noEmit`, `pnpm eslint .`) was re-run end to end after the GREEN commit and passed before the expansion tasks started ("Tracer verified end-to-end - expanding"). `human_verify_mode` is end-of-phase and the verify is automated-only, so no checkpoint was raised.
- The Task 2 and Task 3 tests passed at once, as the plan expects, because Task 1 already delivered the behavior.
- The RED evidence was inspected by hand (target test ran, failed on the planned Gasto assertion, no syntax or setup fault); the `tdd-red-evidence` classifier was not run because the plan is `type: execute`, not `type: tdd`.

## Issues Encountered

None. The one ESLint warning (unused eslint-disable directive in `src/lib/client/navigation.ts`) is pre-existing and allowed by the plan.

## Verification

- `pnpm tsc --noEmit`: exit 0
- `pnpm eslint .`: 0 errors, 1 pre-existing warning
- `pnpm vitest run`: 41 files passed, 3 skipped (896 passed, 8 skipped) without sample data
- With `FACTURAS_DIR` and `E2E_FACTURAS_DIR` pointing at the read-only 143-file sample: all 44 files and 904 tests passed, including `ledger.realdata.test.ts` (5 tests ran, not skipped)
- Acceptance greps all met (MIN_FECHA_YEAR, `context.currentYear + 1` once, both `monthOfFecha(..., context)` call sites, `useState(currentCalendarYear)`, one `getFullYear`, no clock in `src/domain`, `Entre 37` and `Entre 36` once each, `git diff -- src/lib/copy` empty, D-48 count 2, "Excepción a D-41" count 1)
- Playwright e2e was not run (out of scope for this plan; no e2e file changed)

## Requirements

`requirements.ready-ids` reported 5/5 ready (no later sibling plan declares them), so REGLA-05, DASH-02, DASH-06, FILT-01 and CAL-01 were marked complete in REQUIREMENTS.md.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema; T-02-36 and T-02-37 are mitigated, T-02-39 mitigated (grep proves the domain reads no clock), T-02-38 accepted as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This is the last plan of Phase 2. Phase verification and UAT can proceed; the orchestrator owns STATE.md and ROADMAP.md.

## Self-Check: PASSED

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-16*
