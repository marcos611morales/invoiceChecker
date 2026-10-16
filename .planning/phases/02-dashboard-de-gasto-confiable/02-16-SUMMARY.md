---
phase: 02-dashboard-de-gasto-confiable
plan: 16
subsystem: ui
tags: [zustand, session-store, exclusions, tipo-relacion-04, gap-closure, vitest]
gap_closure: true
gap_ids: [G-02-10]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "02-06 session store (excluded/restored), 02-13 invoice table, 02-14 Calidad tab, 02-15 useLedger and Dashboard amount-changing alert"
provides:
  - "ExclusionUndo token returned by excludeInvoice and an undoExclusion action that returns exactly one uuid to its previous state"
  - "reincludeInvoice(uuid, { overrideSubstitution }) with a required options argument; restored is written only for a real TipoRelacion-04 override"
  - "Row menu and Calidad 'Volver a incluir' compute overrideSubstitution from entry.substitutedBy at click time"
  - "Regression tests per re-include path (toast, row menu, Calidad) that load the substitute afterwards"
affects: [phase-02-verification, 02-17]

actuals:
  tokens: 7003
  tasks: 3
  commits: 5

plan_head_before: fc03f0f6f5775dd55f05890159d56747bde1cd0f
plan_head_after: dadde9476bd328cc8dd95ab58693a469f826b87f
commits: 5

tech-stack:
  added: []
  patterns:
    - "Undo token instead of snapshot: an action returns what it replaced so its undo touches only that uuid"
    - "Required options argument forces every caller to decide a business meaning (overrideSubstitution)"
    - "The store never reads the ledger; callers decide from the entry they rendered"

key-files:
  created: []
  modified:
    - src/stores/sessionStore.ts
    - src/stores/sessionStore.test.ts
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/features/quality/QualityAccordions.tsx
    - src/features/quality/QualityTab.test.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - .planning/phases/02-dashboard-de-gasto-confiable/02-06-PLAN.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "USER DECISION (locked in the plan, not reopened): 'Volver a incluir' on a row that is both manually excluded and substituted overrides the substitution too; implemented by passing overrideSubstitution: entry.substitutedBy !== null"
  - "excludeInvoice returns { uuid, wasRestored } and undoExclusion re-adds to restored only when wasRestored, so an undo never re-reads substitutedBy nor restores whole-set snapshots"
  - "When overrideSubstitution is false the restored Set instance is kept as is (same reference) so memo inputs of useLedger stay stable"
  - "src/domain was not touched; the ledger rule was correct and only its restored input was polluted"

patterns-established:
  - "restored means exactly one thing: the user overrode a TipoRelacion-04 substitution (D-28, D-42)"

requirements-completed: [REGLA-08, CAL-01]

coverage:
  - id: D1
    description: "'Deshacer exclusión' returns excluded and restored to exactly what they were for that uuid; an undone plain exclusion never shields a substitute loaded later (Gasto stays $116.00, X 'Sustituida', alert flag true)"
    requirement: "REGLA-08"
    verification:
      - kind: unit
        ref: "src/stores/sessionStore.test.ts#undoExclusion of a plain exclusion removes it from excluded and keeps the restored instance (WR-01)"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#WR-01: undoing a plain exclusion from the toast does not shield a substitute loaded later"
        status: pass
    human_judgment: false
  - id: D2
    description: "Undoing the exclusion of a re-included substituted original brings the override back; a substitute that arrives while the toast is open leaves the original 'Sustituida' after the undo"
    requirement: "REGLA-08"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#WR-01: undoing the exclusion of a re-included substituted original brings the override back"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#WR-01: a substitute that arrives while the undo toast is open still leaves the original substituted after the undo"
        status: pass
    human_judgment: false
  - id: D3
    description: "'Volver a incluir' only writes restored when the entry has a loaded TipoRelacion-04 substitute: row menu plain re-include and Calidad Excluidas plain re-include do not shield a later substitute; Calidad Sustituidas still writes restored"
    requirement: "CAL-01"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#WR-01: a plain Volver a incluir from the row menu does not shield a substitute loaded later"
        status: pass
      - kind: integration
        ref: "src/features/quality/QualityTab.test.tsx#WR-01: a plain Volver a incluir on Excluidas does not shield a substitute loaded later"
        status: pass
      - kind: integration
        ref: "src/features/quality/QualityTab.test.tsx#Volver a incluir on Sustituidas removes the row and updates the substitution"
        status: pass
    human_judgment: false
  - id: D4
    description: "User decision: Volver a incluir on a row both excluded and substituted overrides the substitution (X and Y both count $232.00; 'La original se volvió a incluir.')"
    requirement: "REGLA-08"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#WR-01: Volver a incluir on a row both excluded by hand and substituted overrides the substitution too (user decision)"
        status: pass
      - kind: integration
        ref: "src/features/quality/QualityTab.test.tsx#WR-01: Volver a incluir on an Excluidas row that is also substituted overrides the substitution too (user decision)"
        status: pass
    human_judgment: false
  - id: D5
    description: "02-06-PLAN no longer describes the polluting behavior as intended (truth and behavior lines corrected)"
    verification:
      - kind: other
        ref: "grep -c G-02-10 .planning/phases/02-dashboard-de-gasto-confiable/02-06-PLAN.md prints 2"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 16: Close G-02-10 / WR-01 (restored pollution) Summary

**Session store split into an exact-undo token (`ExclusionUndo` / `undoExclusion`) and a required `overrideSubstitution` option on `reincludeInvoice`, so undoing or re-including a plain manual exclusion never writes `restored` and a later TipoRelacion-04 substitute can no longer double-count the original ($232.00 instead of $116.00 with no alert).**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-16T19:52:00Z (approximate, from first tool call)
- **Completed:** 2026-10-16T20:06:00Z
- **Tasks:** 3 (1 tracer + 2 auto, all `tdd="true"` or follow-up tests)
- **Files modified:** 9 (7 source/test files, 02-06-PLAN.md, REQUIREMENTS.md)

## Accomplishments

- `excludeInvoice` now returns `{ uuid, wasRestored }` and the new `undoExclusion` returns only that uuid to its previous state (never reads the ledger, never restores whole-set snapshots). The table toast "Deshacer exclusión" uses it.
- `reincludeInvoice(uuid, { overrideSubstitution })` takes a REQUIRED options argument; `restored` is written only when it is true and the Set instance is kept otherwise. The row menu (`InvoiceTable`) and Calidad (`QualityAccordions`) pass `entry.substitutedBy !== null`, which also implements the locked user decision for rows that are both excluded and substituted.
- Bug-locking tests inverted (toast undo, Calidad Excluidas re-include) and regression tests added for every path that brings an excluded invoice back, each loading the substitute afterwards: toast, row menu, Calidad Excluidas, the two user-decision cases and the "substitute arrives while the toast is open" neighbour.
- 02-06-PLAN truth and first behavior bullet corrected so the historical plan no longer documents the bug as intended.

## Task Commits

1. **Task 1 (tracer) RED:** `ae55bd8` (test) - failing store and table tests for exact undo
2. **Task 1 (tracer) GREEN:** `088f298` (feat) - ExclusionUndo token, undoExclusion, toast rewired
3. **Task 2 RED:** `cf80133` (test) - failing/updated tests for the overrideSubstitution option
4. **Task 2 GREEN:** `1ada812` (feat) - ReincludeOptions, row menu and Calidad callers
5. **Task 3:** `dadde94` (test) - regression tests per path, user-decision cases, 02-06-PLAN correction

**Plan metadata:** committed together with this SUMMARY (docs commit, includes REQUIREMENTS.md).

## TDD Gate Compliance

RED and GREEN commits are present and in order for Tasks 1 and 2 (`test(02-16)` precedes `feat(02-16)` each time). No REFACTOR commit was needed. Task 3 is test/doc only.

- **RED, Task 1 (`ae55bd8`):** `pnpm exec vitest run src/stores/sessionStore.test.ts src/features/invoices/InvoiceTable.test.tsx` exited non-zero with 8 failed tests, all the targets: 5 store tests (`excludeInvoice` returned `undefined` instead of the token; `undoExclusion is not a function`), the flipped "undoes the exclusion from the toast action" (`expected true to be false`: the old undo wrote `restored`) and the two table WR-01 cases that expect "Sustituida" (it was missing because `restored` had been polluted). Semantic assessment: each target executed and failed on the planned assertion for the intended reason (the bug), not on import, syntax or fixture faults. The WR-01 neighbour test "re-included substituted original" passed already on the old code (the old undo happened to re-add `restored`); it is kept as a guard of the LEGIT path and is not a RED target. The `gsd_run check tdd-red-evidence` classifier was not run because the runner here is Vitest's default console reporter, not TAP/JUnit; the evidence is the console output reviewed above.
- **RED, Task 2 (`cf80133`):** 2 failures after updating the tests to the new API: "reincludeInvoice without an override ..." (old store ignored the option and added to `restored`) and "Volver a incluir on Excluidas ..." (old code wrote `restored` for the never-substituted EXC-1). Same assessment: planned assertions, intended reason.
- **GREEN:** the same commands then passed (Task 1: 70 tests; Task 2: 328 tests across stores, invoices, quality and dashboard).
- Tracer feedback gate (`human_verify_mode: end-of-phase`, automated-only `<verify>`): Task 1's verify was re-run end to end (vitest, tsc, eslint) and passed, logged "Tracer verified end-to-end, expanding".

## Files Created/Modified

- `src/stores/sessionStore.ts` - `ExclusionUndo`, `ReincludeOptions`, `excludeInvoice` returning the token, `undoExclusion`, `reincludeInvoice` with required options; updated `restored` doc comment
- `src/stores/sessionStore.test.ts` - token, undo (own uuid only, same restored instance) and option cases; clearAll precondition
- `src/features/invoices/InvoiceTable.tsx` - toast undo through `undoExclusion(undo)`; `RowMenu.onReinclude` receives the `LedgerEntry`; `reinclude` passes `overrideSubstitution: entry.substitutedBy !== null`
- `src/features/invoices/InvoiceTable.test.tsx` - `amount-changing` probe in the Harness (same flag as the Dashboard alert), `lastExclusionUndo` helper, 5 WR-01 tests
- `src/features/quality/QualityAccordions.tsx` - Calidad "Volver a incluir" passes `overrideSubstitution: entry.substitutedBy !== null`
- `src/features/quality/QualityTab.test.tsx` - 2 WR-01 tests, flipped assertion, restored assertion for Sustituidas
- `src/features/dashboard/DashboardTab.test.tsx` - three re-includes now state `overrideSubstitution`
- `.planning/phases/02-dashboard-de-gasto-confiable/02-06-PLAN.md` - truth line and first behavior bullet corrected
- `.planning/REQUIREMENTS.md` - REGLA-08 marked complete (see Requirements below)

## Decisions Made

See `key-decisions` in the frontmatter. The only product decision involved (excluded-and-substituted row overrides the substitution) was locked by the user in the plan and implemented as written.

## Deviations from Plan

None - plan executed exactly as written. No UI text was added or changed (only existing strings are asserted), so there is nothing new for the user to confirm.

## Issues Encountered

- `pnpm tsc --noEmit` initially failed in the fresh worktree with `Cannot find name 'LayoutProps'` in `src/app/layout.tsx`. This is not a code issue: Next's generated route types live in a gitignored folder that the worktree did not have. Running `pnpm exec next typegen` generated them (nothing to commit) and `tsc` then passed. The orchestrator's main checkout already has them.
- `pnpm eslint .` reports the one allowed pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), 0 errors.

## Verification

- `pnpm tsc --noEmit`: exit 0
- `pnpm eslint .`: 0 errors, 1 pre-existing warning (navigation.ts)
- `pnpm vitest run`: 41 files passed, 3 skipped (pre-existing opt-in/real-data suites), 877 tests passed, 8 skipped
- Acceptance greps all satisfied (ExclusionUndo 1, wasRestored 6, `undoExclusion(undo)` 1, WR-01 in InvoiceTable.test 5 and QualityTab.test 2, "La original se volvió a incluir." 3, G-02-10 in 02-06-PLAN 2, `overrideSubstitution: entry.substitutedBy !== null` once in each caller, `overrideSubstitution: true` in sessionStore.test 3)
- Playwright e2e was not run: this plan has no e2e spec and the changes are covered by jsdom component tests; the real 143-file sample was not needed.

## Requirements

`requirements.ready-ids` returned `ready: [REGLA-08]`, `blocked: [CAL-01]` (a sibling plan in this phase, presumably 02-17, still declares CAL-01 without a SUMMARY). REGLA-08 was marked complete in `.planning/REQUIREMENTS.md` (committed with this SUMMARY). CAL-01 was NOT marked; it is recorded in `requirements-completed` above and the orchestrator marks it when the last declaring plan finishes.

## Human Judgment (end-of-phase UAT)

- Try the G-02-10 repro in the browser: exclude an invoice, press "Deshacer exclusión", then load a second batch that contains a TipoRelacion-04 substitute for it. Expect "Sustituida", Gasto not doubled, and the Dashboard alert shown.
- Confirm the locked rule feels right on screen: "Volver a incluir" on an invoice that is both excluded and substituted makes both count and Calidad reads "La original se volvió a incluir."

## Threat Flags

None. No new endpoint, auth path, storage or schema surface. T-02-33, T-02-34 and T-02-35 are mitigated as planned (the session store still has no persist middleware; the existing storage test keeps running in the full suite).

## Known Stubs

None.

## Next Phase Readiness

Plan 02-17 (G-02-11) can proceed; it edits the same three test files, which are now stable at the new `reincludeInvoice(uuid, options)` API.

## Self-Check: PASSED

- All 8 modified source/test/plan files exist and are committed (verified with `git status`, clean before this SUMMARY).
- Commits `ae55bd8`, `088f298`, `cf80133`, `1ada812`, `dadde94` are ancestors of HEAD (`git rev-list --count fc03f0f..HEAD` = 5).

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-16*
