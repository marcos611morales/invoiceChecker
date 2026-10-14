---
phase: 02-dashboard-de-gasto-confiable
plan: 03
subsystem: accounting
tags: [big.js, decimal, ieps, tipo-cambio, sat-catalogs, months, cfdi, vitest, tdd]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "Plan 02-01 decimal layer (parseDecimal, sum, toMoneyString) and invoiceAmounts contract; Plan 02-02 invoice.impuestos (invoice-level Traslados and Retenciones)"
provides:
  - "FORMA_PAGO (22) and TIPO_RELACION (7) SAT catalogs with prototype-safe formaPagoName and tipoRelacionName"
  - "Month helpers from the literal Fecha: MonthKey, monthOfFecha, monthsInRange, previousPeriod, compareMonths (no Date)"
  - "invoiceAmounts finished: Sin IVA with IEPS, TipoCambio conversion, typed failures by XML field"
  - "iepsOf, conceptAmounts and ConceptAmounts (Con IVA, Sin IVA, unit price per concept)"
  - "Anonymized IEPS Ingreso fixture and nine new cfdiVariants helpers"
affects: [02-04, 02-05, 02-07, 02-08, 02-14, 02-15]

plan_head_before: 7f8bd232989c07013ba5b9c31f911959d89fe3bf
plan_head_after: c90aaa2f8e805610e45ce0b3dae224a4c8dd90a1

actuals:
  tokens: 21000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Exchange rate resolved once (MXN is one and never reads TipoCambio; other currencies need a decimal rate > 0, else moneda-sin-tc); amounts multiplied by rate*sign without rounding"
    - "Catalog lookups through Object.hasOwn so XML codes cannot reach Object.prototype"
    - "Month keys sliced from the literal Fecha with a validating regex and integer arithmetic (year*12+month)"
    - "Typed failures name the damaged XML attribute (closed list Total, SubTotal, Descuento, Importe)"

key-files:
  created:
    - src/domain/cfdi/catalogs.ts
    - src/domain/cfdi/catalogs.test.ts
    - src/domain/accounting/months.ts
    - src/domain/accounting/months.test.ts
    - src/domain/accounting/decimal.test.ts
    - src/domain/accounting/amounts.test.ts
    - tests/fixtures/cfdi/anon/anon-ingreso-ieps.xml
  modified:
    - src/domain/accounting/amounts.ts
    - tests/support/cfdiVariants.ts
    - src/domain/cfdi/parseCfdi.anon.test.ts

key-decisions:
  - "A concept whose importe is not a decimal (or whose invoice has no usable rate) is unusable: all three ConceptAmounts fields are null; a damaged ValorUnitario only nulls precioUnitario, a damaged descuento or tax only the amounts that depend on it"
  - "monthOfFecha also checks days-in-month (including leap years), so 2025-02-30 gives no month"
  - "withDescuento helper added to cfdiVariants (needed to test the Descuento failure; same replaceAttr style)"

patterns-established:
  - "Egreso amounts negative via rate.neg(); totalMxn stays unsigned for the $0 rule"
  - "RED stubs with the final signatures so TDD tests fail on assertions, not on missing modules"

requirements-completed: [REGLA-03, REGLA-04, REGLA-05, REGLA-07, DEV-03]

coverage:
  - id: D1
    description: "Con IVA is the invoice Total and Sin IVA is SubTotal - Descuento + IEPS, signed and exact; SubTotal - Descuento + IEPS + IVA equals Total on the anonymized IEPS invoice"
    requirement: "REGLA-03"
    verification:
      - kind: unit
        ref: "src/domain/accounting/amounts.test.ts#Sin IVA adds the invoice-level IEPS, and the identity with IVA reaches Total"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/amounts.test.ts#the same document typed as Egreso is negative, totalMxn stays unsigned"
        status: pass
    human_judgment: false
  - id: D2
    description: "Foreign currency converts with the invoice's own TipoCambio exactly; MXN ignores it; a non-MXN invoice without a valid rate returns moneda-sin-tc and no rate is invented"
    requirement: "REGLA-07"
    verification:
      - kind: unit
        ref: "src/domain/accounting/amounts.test.ts#invoiceAmounts: foreign currency (REGLA-07, D-10, T-02-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Damaged Total, SubTotal, Descuento or IEPS Importe returns invalido with the XML field name instead of throwing"
    requirement: "REGLA-04"
    verification:
      - kind: unit
        ref: "src/domain/accounting/amounts.test.ts#invoiceAmounts: damaged data is reported by field (D-35)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Month of an invoice is the literal Fecha sliced as YYYY-MM, identical under TZ=UTC and TZ=Asia/Tokyo; malformed Fecha gives no month"
    requirement: "REGLA-05"
    verification:
      - kind: unit
        ref: "src/domain/accounting/months.test.ts#monthOfFecha"
        status: pass
      - kind: other
        ref: "TZ=Asia/Tokyo pnpm exec vitest run src/domain/accounting/months.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Decimal boundaries (18 integer digits, 12 decimals, no exponent) and precision (0.1+0.2, 400-invoice sum vs BigInt cents, half-up only at display, no -0.00)"
    requirement: "REGLA-04"
    verification:
      - kind: unit
        ref: "src/domain/accounting/decimal.test.ts"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/amounts.test.ts#exact ledger sums (REGLA-04, precision)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Concept amounts: Con IVA = importe - descuento + traslados - retenciones, Sin IVA = importe - descuento + own IEPS, converted and signed like the invoice"
    verification:
      - kind: unit
        ref: "src/domain/accounting/amounts.test.ts#conceptAmounts (D-25, D-38)"
        status: pass
    human_judgment: false
  - id: D7
    description: "c_FormaPago (22 codes) and c_TipoRelacion (7 codes) catalogs resolve codes safely; the labels are accepted as written (D-45) and are not verified against the official catCFDI"
    verification:
      - kind: unit
        ref: "src/domain/cfdi/catalogs.test.ts"
        status: pass
    human_judgment: true
    rationale: "Labels come from the research mirror of the SAT catalog and the UI-SPEC and are accepted as written per D-45; confirming them against the official catCFDI is a human check"
  - id: D8
    description: "Anonymized IEPS fixture drives the amount tests and passes the privacy guard (no real Rfc, Nombre, UUID or certificate)"
    requirement: "DEV-03"
    verification:
      - kind: unit
        ref: "tests/fixtures.guard.test.ts (run with FACTURAS_DIR pointing at the main checkout sample) and src/domain/cfdi/parseCfdi.anon.test.ts"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 03: Amount rules Summary

**Exact MXN amount rules: IEPS-aware Sin IVA, TipoCambio conversion that never invents a rate, per-concept amounts, literal-Fecha month helpers and the SAT catalogs, proven over an anonymized IEPS fixture**

## Performance

- **Duration:** about 30 min
- **Started:** 2026-10-14T21:02:00Z (approximate)
- **Completed:** 2026-10-14T21:32:30Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 10 (7 created, 3 modified)

## Accomplishments

- `invoiceAmounts` now validates Total, SubTotal, Descuento and the IEPS Importe in that order, then resolves the currency: MXN never reads TipoCambio, any other currency needs a decimal rate greater than zero or the invoice returns `moneda-sin-tc`. Con IVA = Total, Sin IVA = SubTotal - Descuento + IEPS, both times rate and sign, with no rounding.
- `iepsOf` reads the invoice-level Traslados with Impuesto 003 (the data captured by Plan 02-02) and `conceptAmounts` computes per-concept Con IVA, Sin IVA and unit price, converted and signed like the invoice.
- `catalogs.ts` (22 formas de pago, 7 tipos de relación) and `months.ts` (month key from the literal Fecha, ranges, previous period) are pure and tested, the months also under `TZ=Asia/Tokyo`.
- `decimal.test.ts` proves the 18/12 digit boundaries, exact sums and display-only rounding; a new anonymized IEPS Ingreso fixture (SubTotal 2126.14, Descuento 167.59, IEPS 40.59, IVA 319.87, Total 2319.01) satisfies the identity SubTotal - Descuento + IEPS + IVA = Total.

## Task Commits

1. **Task 1: catalogs, months, decimal bounds** - `bb3b3fe` (test, RED), `8a8a69a` (feat, GREEN)
2. **Task 2: IEPS, TipoCambio, concept amounts, fixture** - `b5f8095` (test, RED), `c90aaa2` (feat, GREEN)

No REFACTOR commits were needed.

**Plan metadata:** committed separately (docs: complete plan).

## TDD Gate Compliance

- **RED (Task 1):** `bb3b3fe` added catalog, month and decimal tests with signature-only stubs for `catalogs.ts` and `months.ts`. Run result: 12 tests failed on assertions for the planned behavior (empty catalogs, null month, empty ranges), 16 passed. Semantic assessment: the target tests executed and failed on the planned assertions, not on load, syntax or fixture errors. `decimal.test.ts` passed at RED because it characterizes the Plan 02-01 decimal layer that already existed (plan says it "exercises Plan 02-01's decimal.ts"); this is expected, not an unexpected green.
- **RED (Task 2):** `b5f8095` added `amounts.test.ts` with stubs for `iepsOf` and `conceptAmounts`. 14 tests failed on assertions (IEPS term, conversion, invalid-field names, concept amounts); the cases already satisfied by Plan 02-01 (MXN, Egreso sign, `moneda-sin-tc` for USD) passed as characterization.
- **GREEN:** `8a8a69a` and `c90aaa2`, all tests pass. `gsd_run check tdd-red-evidence` was not run (vitest default reporter output was inspected directly).

## Files Created/Modified

- `src/domain/cfdi/catalogs.ts` - FORMA_PAGO, TIPO_RELACION and Object.hasOwn lookups
- `src/domain/accounting/months.ts` - monthOfFecha, monthsInRange, previousPeriod, compareMonths
- `src/domain/accounting/amounts.ts` - iepsOf, finished invoiceAmounts, conceptAmounts, ConceptAmounts
- `src/domain/cfdi/catalogs.test.ts`, `src/domain/accounting/months.test.ts`, `src/domain/accounting/decimal.test.ts`, `src/domain/accounting/amounts.test.ts` - tests
- `tests/support/cfdiVariants.ts` - withFecha, withMoneda, withTipoCambio, withTotal, withSubTotal, withDescuento, withMetodoPago, withFormaPago, withTipoRelacion
- `tests/fixtures/cfdi/anon/anon-ingreso-ieps.xml` - anonymized MXN Ingreso with invoice-level IEPS
- `src/domain/cfdi/parseCfdi.anon.test.ts` - new fixture added to FILES (UUID and RFC guards) plus a parse test

## Decisions Made

- A concept with a non-decimal importe, or on an invoice without a usable rate, is unusable (all three fields null); other damaged values null only the fields that depend on them. This follows the plan's behavior line "importe z gives all three fields null".
- `monthOfFecha` also validates the day against the month length (leap years included) in addition to the digit ranges the plan lists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BigInt literals rejected by tsconfig target**
- **Found during:** Task 1 (decimal.test.ts)
- **Issue:** `100n` literals fail `tsc` (TS2737) because the target is ES2017
- **Fix:** `BigInt(100)` calls in decimal.test.ts (amounts.test.ts used `BigInt()` from the start)
- **Files modified:** src/domain/accounting/decimal.test.ts
- **Committed in:** 8a8a69a

**2. [Rule 2 - Missing critical] Added `withDescuento` helper**
- **Found during:** Task 2
- **Issue:** The behavior list requires a damaged root Descuento case, but the helper list has no `withDescuento`
- **Fix:** Added it in the same `replaceAttr` style (root-anchored, throws when missing); `grep -c "export function with"` prints 17 (at least 14 required)
- **Files modified:** tests/support/cfdiVariants.ts
- **Committed in:** b5f8095

**3. [Plan precondition note] `Facturas/2025` is not inside the worktree**
- **Found during:** Task 2 precondition
- **Issue:** `Facturas/` is gitignored, so the worktree does not contain it; the plan's relative path does not resolve here
- **Resolution:** Verified read-only that the main checkout holds the 143-file sample, and used it only as the input of `scripts/anonymize-fixture.mjs` (which prints no values) and as `FACTURAS_DIR` for `tests/fixtures.guard.test.ts`. Nothing under the main checkout was modified. The selected source was a MXN Ingreso with a root-level IEPS Traslado chosen by a structural scan that printed only amounts.

---

**Total deviations:** 3 (1 blocking, 1 missing helper, 1 environment note)
**Impact on plan:** None on scope or behavior.

## Issues Encountered

- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive); out of scope, untouched.
- `tests/fixtures.guard.test.ts` skips itself when `Facturas/` is absent; in this worktree it only ran for real with `FACTURAS_DIR` pointing at the main checkout sample, where it passed with the new fixture.

## Known Stubs

None. The RED-phase stubs were replaced in the GREEN commits.

## Threat Flags

None. No new endpoints, auth paths or trust boundaries; mitigations T-02-03 (parseDecimal bounds proven at both sides), T-02-04 (whitelist anonymizer, new fixture in the UUID and RFC guards, `Facturas/` still ignored and not tracked) and T-02-05 (rate accepted only if a decimal greater than zero, MXN never reads it) are implemented and tested.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 02-04 and later can import `iepsOf`, `conceptAmounts`, the month helpers and the catalogs as specified in the plan interfaces.
- Plan 02-04 must still turn a malformed Fecha (`monthOfFecha` returns null) into an invalid-data ledger entry; this plan only supplies the helper.
- The catalog labels are accepted as written (D-45) and can be confirmed later against the official catCFDI.
- Requirement IDs REGLA-03, REGLA-04, REGLA-05, REGLA-07 and DEV-03 are recorded here only; REQUIREMENTS.md is left to the orchestrator because sibling plans of this phase also declare them.

## Self-Check: PASSED

- Files exist: catalogs.ts, months.ts, amounts.ts, the four test files and anon-ingreso-ieps.xml (verified present, tests run green).
- Commits exist on this branch: bb3b3fe, 8a8a69a, b5f8095, c90aaa2.
- `pnpm verify` (lint, typecheck, 295 tests, build) exits 0; `TZ=Asia/Tokyo` months run passes; acceptance greps pass (no Date/Intl in months.ts, no Number/parseFloat/toFixed/new Big( in amounts.ts, 2 hasOwn lines, 29 catalog codes, 17 `export function with`, `Facturas/` ignored and untracked).

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-14*
