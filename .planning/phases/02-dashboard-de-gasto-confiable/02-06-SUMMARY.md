---
phase: 02-dashboard-de-gasto-confiable
plan: 06
subsystem: state-stores
tags: [zustand, persist, zod, vitest, tdd]
status: complete

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "Filters/EMPTY_FILTERS/DateRange (02-05), IvaMode (aggregate.ts), sessionStore applyBatch/clearAll (02-01)"
provides:
  - "sessionStore: filters, excluded, restored, activeTab, focusRequest, importFocus and their actions; exports AppTab, FocusRequest, ImportFocus"
  - "settingsStore: useSettingsStore, the only persisted store (key invoicechecker:settings, { state: { ivaMode }, version: 1 })"
affects: [02-07, 02-08, 02-09, 02-10, 02-11, 02-12, 02-13, 02-14, 02-15, phase-03]

plan_head_before: 07d7f16a7eb0796d50547083add8bb1bcd6513bf
commits: 2
actuals:
  tokens: 9000
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Session state is a plain zustand store with no middleware; every Set-valued field is replaced, never mutated, so selectors stay stable"
    - "Persisted store uses a custom PersistStorage whose getItem validates the whole envelope with zod inside try/catch, so no type assertion is needed"
    - "One-shot UI requests (focusRequest) carry a module-level growing nonce so repeating the same uuid is observable"

key-files:
  created:
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
  modified:
    - src/stores/sessionStore.ts
    - src/stores/sessionStore.test.ts

key-decisions:
  - "Editing the range, suppliers or formas clears a pending focusRequest; clearFilters keeps it (A-5, confirm in UAT)"
  - "A batch with added above 0 resets only filters.range to null; suppliers and formas selections are kept"
  - "Rehydrating from a missing, unreadable or invalid storage value resets the mode to con (merge falls back), which is the same fallback the plan asks for"
  - "excludeInvoice also removes the uuid from restored so the two sets stay disjoint"

requirements-completed: [REGLA-03, REGLA-08, FILT-05]
# REGLA-03, REGLA-08, FILT-05 may be shared with sibling plans; the orchestrator owns REQUIREMENTS.md.

coverage:
  - id: D1
    description: "sessionStore holds filters, exclusions, restorations, tabs and focus requests in memory; clearAll resets them with a generation bump"
    requirement: "REGLA-08, FILT-05"
    verification:
      - kind: unit
        ref: "src/stores/sessionStore.test.ts#filters, exclusions and focus (Plan 02-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Finished batch resetting the range, stale-generation guard, focus clearing rules"
    requirement: "FILT-05"
    verification:
      - kind: unit
        ref: "src/stores/sessionStore.test.ts#a batch that adds invoices resets the range to null and keeps suppliers and formas"
        status: pass
    human_judgment: false
  - id: D3
    description: "settingsStore persists only ivaMode, validates storage with zod, survives blocked or tampered storage and a missing window"
    requirement: "REGLA-03"
    verification:
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore"
        status: pass
    human_judgment: false

duration: 8 min
completed: 2026-10-14
---

# Phase 2 Plan 06: Session and Settings Stores Summary

**Session store extended with filters, manual exclusions, restorations, active tab and focus requests (memory only), plus the app's first persisted store holding only the Con/Sin IVA mode with zod-validated, failure-tolerant localStorage.**

## Accomplishments

- `sessionStore` now carries `filters`, `excluded`, `restored`, `activeTab`, `focusRequest` and `importFocus`, with the actions `setRange`, `setSuppliers`, `setFormas`, `clearFilters`, `excludeInvoice`, `reincludeInvoice`, `setActiveTab`, `requestFocus`, `clearFocusRequest`, `requestImportFocus` and `clearImportFocus`. `clearAll` resets all of it and still bumps `generation`.
- `applyBatch` resets `filters.range` to null when the batch adds at least one invoice, keeps it when nothing was added, and still ignores stale generations.
- `settingsStore` persists `{ state: { ivaMode }, version: 1 }` under `invoicechecker:settings` with `skipHydration: true` and `partialize`. The storage validates the entire envelope with zod in `getItem`, `merge` re-validates, and every storage call is in try/catch.
- Tests cover invalid JSON, wrong shapes, tampered mode, version mismatch, throwing `getItem` and `setItem`, the only-key-written privacy check, and import with no `window`.

## TDD

- RED (`db98cdb`): 26 target tests failing on assertions or missing actions (`TypeError: ... is not a function`, `expected undefined to deeply equal ...`). A non-persisting `settingsStore` skeleton was committed with the tests so they failed on behavior rather than on a missing import. Semantic assessment: every failure maps to a planned behavior, no setup or import faults.
- GREEN (`cdfac7e`): implementation of both stores; one test expectation was corrected (see Deviations).
- REFACTOR: not needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in own test] Server-import test expected the mode to survive rehydrate**
- **Found during:** Task 1 GREEN
- **Issue:** The test asserted `sin` after `persist.rehydrate()` with no window. zustand calls `merge` with `undefined` when nothing is stored, and the plan's required fallback turns that into `con`.
- **Fix:** Test now asserts the setter does not throw, that memory updates, and that rehydrating with no readable storage falls back to `con`.
- **Files modified:** src/stores/settingsStore.test.ts
- **Commit:** cdfac7e

**Total deviations:** 1 auto-fixed (1 test expectation). **Impact:** none on the contract.

## Known Stubs

None.

## Threat Flags

None. T-02-12, T-02-13 and T-02-14 are mitigated and covered by tests; `package.json` and `pnpm-lock.yaml` are untouched (T-02-SC).

## Notes for next plans

- Call `useSettingsStore.persist.rehydrate()` once from an effect in the app shell (Plan 02-07); the store is created with `skipHydration: true`.
- `pnpm lint` shows one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive); out of scope.

## Self-Check: PASSED

- src/stores/sessionStore.ts, src/stores/settingsStore.ts and both test files exist.
- Commits db98cdb and cdfac7e are on the branch.
- `pnpm verify` (lint, typecheck, 437 tests, build) passes.
