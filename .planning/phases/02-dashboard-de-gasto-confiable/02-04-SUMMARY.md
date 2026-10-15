---
phase: 02-dashboard-de-gasto-confiable
plan: 04
subsystem: accounting
tags: [ledger, big.js, cfdi, tipo-relacion, ppd, vitest, tdd]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "Plan 02-01 tracer ledger (buildLedger, LedgerEntry, LedgerOverrides); Plan 02-03 invoiceAmounts with totalMxn, monthOfFecha, catalogs and the cfdiVariants helpers"
provides:
  - "Complete buildLedger: kinds and signs, noSuma reasons (tipo, invalido, moneda-sin-tc, cero), manual exclusion, TipoRelacion 04 substitution, imputation month of credit notes, PPD payment forms, supplier identity by RFC"
  - "LedgerEntry fields ownMonth, month, relatedLoaded, relatedCount, formas, substitutedBy, substitutes and the PPD_SIN_COMPLEMENTO sentinel (final shape for Plans 02-05 to 02-15)"
  - "tests/support/ledgerFactory.ts: makeInvoice, loaded, makeEntry"
  - "Anonymized-XML ledger tests and a gated real-sample identity test"
affects: [02-05, 02-06, 02-07, 02-08, 02-09, 02-10, 02-11, 02-12, 02-13, 02-14, 02-15]

plan_head_before: c573f06907c5b3d013b8994d311e61e6d0d7a004
plan_head_after: 8c8debb8b8668bc32ce9790a9b37269d43362b9b

actuals:
  tokens: 22000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Single-pass indexes built with Map and Set (substitution, payment forms, supplier names, uuid lookup); no plain-object records keyed by RFC, UUID or name"
    - "noSuma precedence encoded in one function: tipo, invalid amount, invalid Fecha, moneda-sin-tc, cero (converted Total only)"
    - "Real-sample test reduces every amount comparison to a boolean and asserts counts and identities only"

key-files:
  created:
    - tests/support/ledgerFactory.ts
    - src/domain/accounting/ledger.test.ts
    - src/domain/accounting/ledger.anon.test.ts
    - src/domain/accounting/ledger.realdata.test.ts
  modified:
    - src/domain/accounting/ledger.ts

key-decisions:
  - "relatedCount counts distinct UUIDs other than the entry's own across all relacionados groups, for every kind; relatedLoaded is filled only for credit notes"
  - "Imputation uses the related invoice's literal Fecha for ordering and its own month (not its imputation month), as flagged in the plan"
  - "A supplier Nombre that is blank counts as absent; the most frequent name wins and the first seen breaks ties"
  - "An entry with a malformed Fecha but valid amounts keeps its conIva and sinIva for display while staying not counted"

requirements-completed: [REGLA-01, REGLA-02, REGLA-06, REGLA-08, REGLA-09, DEV-03]

coverage:
  - id: D1
    description: "Every loaded invoice yields one entry; Ingreso positive, Egreso negative, Pago/Traslado/Nomina never sum and have no amount"
    requirement: "REGLA-01"
    verification:
      - kind: unit
        ref: "src/domain/accounting/ledger.test.ts#buildLedger: kinds and signs (REGLA-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A credit note is imputed to the month of its oldest loaded related invoice; with none loaded it keeps its own month; covered across months over anonymized XML because the real sample cannot exercise it"
    requirement: "REGLA-02"
    verification:
      - kind: unit
        ref: "src/domain/accounting/ledger.test.ts#buildLedger: imputation month of credit notes (REGLA-02, D-34)"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/ledger.anon.test.ts#imputes a credit note dated 2025-09 to the 2025-06 month of its loaded Ingreso"
        status: pass
    human_judgment: false
  - id: D3
    description: "$0 is decided on the converted Total only; a non-zero Total with a zero Sin IVA amount still counts"
    requirement: "REGLA-06"
    verification:
      - kind: unit
        ref: "src/domain/accounting/ledger.test.ts#buildLedger: $0 and invalid data (REGLA-06, D-35, D-37)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Manual exclusion and TipoRelacion 04 substitution are reversible through excluded and restored; the substituting invoice's state is never consulted (domain half; the UI action is Plan 02-13)"
    requirement: "REGLA-08"
    verification:
      - kind: unit
        ref: "src/domain/accounting/ledger.test.ts#buildLedger: TipoRelacion 04 substitution (D-08, D-42)"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/ledger.anon.test.ts#TipoRelacion 04 substitution (D-08, D-42)"
        status: pass
    human_judgment: false
  - id: D5
    description: "PPD invoices take the forms of every loaded Pago complement that references them, or the PPD_SIN_COMPLEMENTO sentinel; on the real sample 8 PPD resolve 7"
    requirement: "REGLA-09"
    verification:
      - kind: unit
        ref: "src/domain/accounting/ledger.test.ts#buildLedger: forms of payment (REGLA-09, D-16, D-17)"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/ledger.realdata.test.ts#has 8 PPD invoices and 7 of them resolve to a form of payment"
        status: pass
    human_judgment: false
  - id: D6
    description: "Damaged amounts or Fecha load, do not sum and name the offending field; the ledger never throws; supplier grouping is prototype-safe"
    requirement: "DEV-03"
    verification:
      - kind: unit
        ref: "src/domain/accounting/ledger.test.ts#buildLedger: supplier identity (D-43, T-02-06)"
        status: pass
    human_judgment: false
  - id: D7
    description: "On the real 2025 sample the counted net with Con IVA equals an independent integer loop and the counted Ingreso count matches (identities and counts only)"
    requirement: "DEV-03"
    verification:
      - kind: unit
        ref: "src/domain/accounting/ledger.realdata.test.ts (run with FACTURAS_DIR pointing at the main checkout sample)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-15
status: complete
---

# Phase 2 Plan 04: Complete ledger Summary

**Complete mode-independent ledger: signed kinds, $0 by converted Total, damaged-data flags, credit-note imputation month, reversible 04 substitution, PPD payment forms from Pago complements and Map-based supplier identity, proven by unit tests, anonymized XML and the real sample**

## Performance

- **Duration:** about 15 min
- **Completed:** 2026-10-15
- **Tasks:** 2 (Task 1 full TDD; Task 2 is test-only)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- `buildLedger` keeps its `(invoices, overrides)` signature and every Plan 02-01 field, so `DashboardTab` and `totalSpend` needed no change. It adds `ownMonth`, `month`, `relatedLoaded`, `relatedCount`, `formas`, `substitutedBy`, `substitutes` and exports `PPD_SIN_COMPLEMENTO`.
- `noSuma` follows the agreed precedence (tipo, invalid amount, invalid Fecha, moneda-sin-tc, cero). "cero" reads only the converted Total from `invoiceAmounts`, so the IVA mode can never change which entries count (D-37). A malformed Fecha becomes `invalido` with `invalidField "Fecha"` and a null month, exactly as Plan 02-03 asked.
- Exclusion is `manual` (uuid in `excluded`) else `sustituida` (a loaded invoice lists it in a TipoRelacion 04 group and it is not in `restored`); the state of the substituting invoice is never consulted (D-42). `substitutedBy` survives a restore.
- Credit notes are imputed to the month of the loaded related invoice with the oldest literal Fecha (any TipoRelacion, itself ignored); with none loaded they keep their own month and `relatedLoaded` is empty.
- PPD invoices (MetodoPago PPD or FormaPago 99) take the sorted, de-duplicated FormaDePagoP of every loaded Pago that references them, else `[PPD_SIN_COMPLEMENTO]`.
- All indexes use `Map`/`Set`; a test with RFC `__proto__` and uuid `constructor` passes. The file has no `Date`, `Number(`, `parseFloat` or `Record<string` (acceptance grep clean).
- On the real 2025 sample (gated) the counted net equals an independent BigInt loop, the counted Ingreso count matches, and 8 PPD invoices exist of which 7 resolve to a form of payment.

## Task Commits

1. **Task 1: complete ledger rules** - `1e3a2f3` (test, RED), `7efaf20` (feat, GREEN)
2. **Task 2: anonymized-XML and real-sample tests** - `8c8debb` (test)

No REFACTOR commit was needed.

**Plan metadata:** committed separately (docs: complete plan).

## TDD Gate Compliance

- **RED (Task 1):** `1e3a2f3` added `ledger.test.ts` (45 tests), `tests/support/ledgerFactory.ts` and signature-only stubs in `ledger.ts` (the new fields with neutral values, the sentinel exported). The full file run failed 28 of 45 tests, all on assertions for the planned behavior (null months, empty forms, missing exclusion, first-name supplier). `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the target "imputes a credit note to the month of its loaded related invoice" (rerun with `-t` and the `tap-flat` reporter, because vitest's TAP output for multi-line diffs is rejected as malformed TAP). Semantic assessment: the target executed and failed on its first planned assertion (`ownMonth` was the stub `null` instead of `2025-09`), not on a load, syntax or fixture error. The 17 passing tests are characterization of the Plan 02-01 behavior (kinds, signs, tipo, moneda-sin-tc, manual exclusion, purity).
- **GREEN:** `7efaf20`, 45 of 45 pass.
- **Task 2:** the plan marks it `tdd="true"` but it adds integration tests over the Task 1 implementation, so there is no RED for it; the new tests passed on first run, which is expected (they cover behavior GREEN already delivered). Recorded here rather than hidden.

## Files Created/Modified

- `src/domain/accounting/ledger.ts` - complete ledger rules and the final `LedgerEntry` shape
- `src/domain/accounting/ledger.test.ts` - 45 unit tests
- `tests/support/ledgerFactory.ts` - `makeInvoice`, `loaded`, `makeEntry`
- `src/domain/accounting/ledger.anon.test.ts` - parseCfdi to buildLedger over anonymized fixtures plus synthetic variants
- `src/domain/accounting/ledger.realdata.test.ts` - gated real-sample identities and counts

## Decisions Made

- `relatedCount` is the number of distinct listed UUIDs other than the entry's own, over all relacionados groups, for every kind (the plan's "loaded or not" wording; a self-listing UUID is ignored consistently).
- A blank supplier Nombre counts as no name.
- The real-sample test compares the net as a boolean so a failure prints no amount (T-02-08); it uses `BigInt()` calls because tsconfig targets ES2017.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BigInt literals rejected by tsconfig target**
- **Found during:** Task 2 (`pnpm verify`, typecheck)
- **Issue:** `0n`/`1_000_000n` in `ledger.realdata.test.ts` fail `tsc` (TS2737) under target ES2017
- **Fix:** `BigInt(0)` and `BigInt(1000000)` constants
- **Files modified:** src/domain/accounting/ledger.realdata.test.ts
- **Committed in:** 8c8debb

**2. [Rule 1 - Bug] `describe.skipIf` still runs its body at collection**
- **Found during:** Task 2 (before the first run)
- **Issue:** loading the sample directly in the describe body would throw where `Facturas/` is absent
- **Fix:** the sample is loaded lazily inside the tests
- **Files modified:** src/domain/accounting/ledger.realdata.test.ts
- **Committed in:** 8c8debb

**3. [Plan precondition note] `Facturas/` is not inside the worktree**
- **Resolution:** as in Plan 02-03, the real-data and privacy-guard tests ran with `FACTURAS_DIR` pointing at the read-only main checkout sample; nothing was copied, modified or committed, and nothing from it was printed. Without that variable the real-data suite is skipped, as designed.

---

**Total deviations:** 3 (1 blocking, 1 bug, 1 environment note)
**Impact on plan:** None on scope or behavior.

## Issues Encountered

- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive); out of scope, untouched.

## Known Stubs

None. The RED-phase stubs in `ledger.ts` were replaced in the GREEN commit.

## Threat Flags

None. No new endpoints, auth paths or trust boundaries. Mitigations: T-02-06 (Map/Set only, `__proto__`/`constructor` test, grep forbids `Record<string`), T-02-07 (only the loaded original of a TipoRelacion 04 relation is auto-excluded, always reversible through `restored`; semantics accepted as written per D-45), T-02-08 (real-sample test asserts counts and booleans only; `tests/fixtures.guard.test.ts` passes in `pnpm verify` and with the real sample).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `LedgerEntry` shape is final for Plans 02-05 to 02-15; Plan 02-14 can derive the D-46 type from `relatedLoaded`, each related entry's `ownMonth` and the credit note's `month`.
- Plan 02-13 owns the UI action "Volver a incluir", which must remove the uuid from `excluded` and add it to `restored`.
- REQUIREMENTS.md is not touched: REGLA-01, REGLA-02, REGLA-06, REGLA-08, REGLA-09 and DEV-03 are recorded here only because sibling plans of this phase also declare some of them.

## Self-Check: PASSED

- Files exist: ledger.ts, ledger.test.ts, ledger.anon.test.ts, ledger.realdata.test.ts, tests/support/ledgerFactory.ts.
- Commits exist on this branch: 1e3a2f3, 7efaf20, 8c8debb.
- `pnpm verify` (lint, typecheck, 348 tests, build) exits 0; `FACTURAS_DIR=<main checkout sample>` run of `src/domain/accounting` (116 tests) and `tests/fixtures.guard.test.ts` passes; acceptance greps pass (3 `PPD_SIN_COMPLEMENTO`, 7 `new Map`, no forbidden tokens, `export function makeEntry` present, both new test files start with `// @vitest-environment jsdom`, 2 `skipIf` lines).

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-15*
