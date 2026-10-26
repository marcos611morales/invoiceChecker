---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 03
subsystem: prices
tags: [prices, tests, big.js, vitest, test-builders]
status: complete
requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: Plan 05-01 price domain (units, content, purchases, compare)
provides:
  - tests/support/pricesFactory.ts (makeConcepto, purchaseInvoice, makeProduct) for Plans 05-04, 05-05 and 05-12
  - Test tables that pin the SAT unit table, content reasons, purchase extraction, comparison rules, cheapest-store ties, saving and savings summary
affects: [05-04, 05-05, 05-06, 05-12]
tech-stack:
  added: []
  patterns:
    - "Purchase tests build entries with the real ledger (buildLedger + scopeToCategories with an empty selection), compare tests build Purchase values directly"
    - "Invoice totals in test builders are derived with big.js from the concept strings"
key-files:
  created:
    - tests/support/pricesFactory.ts
    - src/domain/prices/units.test.ts
    - src/domain/prices/content.test.ts
    - src/domain/prices/purchases.test.ts
    - src/domain/prices/compare.test.ts
  modified: []
key-decisions:
  - "No domain code changed: every rule of the plan was already implemented by the Plan 05-01 tracer, so this plan is characterization tests plus the shared builders"
  - "An unsized piece never competes with a sized family: D-10 drops it as unsized-with-sized-siblings before the D-12 family choice, so the kg > L > pieza tie is only reachable between sized families today"
requirements-completed: [PREC-01, PREC-02, PREC-04, PREC-05]
duration: 20 min
completed: 2026-10-26
commits: 2
plan_head_before: 4996a4394a55b0de2e5dd33949715cfba2678d27
plan_head_after: 697848e4574006b23d678bb363def979cd834b99
actuals:
  tokens: 9100
  tasks: 2
  commits: 2
coverage:
  - deliverable: "SAT unit table: weight, volume and piece codes, case and edge spaces, unknown units and the __proto__ lookup"
    verification:
      - kind: test
        ref: "src/domain/prices/units.test.ts"
        status: pass
    human_judgment: false
  - deliverable: "Content reasons: bad-quantity, unit-unknown, XML quantity for weight whatever the description says, unsized pieces"
    verification:
      - kind: test
        ref: "src/domain/prices/content.test.ts"
        status: pass
    human_judgment: false
  - deliverable: "Purchases: only counted Ingreso lines of accepted products; credit notes, Pagos, excluded, substituted and $0 invoices never; Con IVA and Sin IVA amounts; one store per RFC"
    verification:
      - kind: test
        ref: "src/domain/prices/purchases.test.ts"
        status: pass
    human_judgment: false
  - deliverable: "Comparison rules D-10, D-12, D-20, D-21, D-23, D-26, D-29, D-30 with exact big.js results"
    verification:
      - kind: test
        ref: "src/domain/prices/compare.test.ts"
        status: pass
      - kind: command
        ref: "pnpm exec vitest run src/domain/prices src/features/prices && pnpm typecheck && pnpm lint"
        status: pass
    human_judgment: false
---

# Phase 5 Plan 03: Comparison rules pinned by test tables Summary

**The Plan 05-01 price domain is now pinned rule by rule: 81 tests over the SAT unit table, content reasons, purchase extraction in both IVA modes, per-piece and mixed-family decisions, store ties, estimated saving and savings summary, plus the shared builders `makeConcepto`, `purchaseInvoice` and `makeProduct` for the later plans.**

## Accomplishments

- `tests/support/pricesFactory.ts`: `makeConcepto` (H87, cantidad "1", importe "100.00", no taxes), `purchaseInvoice` (SubTotal, Descuento, Total and tax totals derived exactly with big.js from the concepts, invoice-level traslados are the concept traslados, `tipo` I or E) and `makeProduct` (member key through `normalizeDescription`).
- `units.test.ts`: KGM/GRM/LTR/MLT factors, case and edge-space lookup, all 17 piece codes, MTR and "" give null, `__proto__`, `constructor` and `toString` give null and leave `Object.prototype` untouched (T-05-01).
- `content.test.ts`: bad-quantity for "0", "-1", "abc", "", "1e3", "0.000"; KGM "0.27" is mass 0.27 from the XML whatever the description says; GRM and MLT convert exactly; H87 is pieces, `sized: false`, source `unsized`; MTR is unit-unknown.
- `purchases.test.ts`: purchases built through the real ledger (`buildLedger` + `scopeToCategories` with an empty selection). A tipo "E" line (kind nota-credito, counted) is not a purchase; manual exclusion, substituted, $0 and Pago entries are not purchases; a concept whose member belongs to no product (or to another RFC) is dropped; the rounding-difference part (concept null) is ignored; Con IVA reads 116 and Sin IVA 100 for a 16 % IVA line, IEPS and discount apply as REGLA-04 says; three invoices of one RFC with two branch names give one `storeRfc` and `storeName` equals the entry `supplierName`; `fecha` is the literal one and `memberKey` equals `ruleMapKey(rfc, normalizeDescription(descripcion))`.
- `compare.test.ts` (33 tests): the 50 vs 60 per kg example (cheapest A, saving 10, summary 10, products 1) and the single-store case (no cheapest, no saving, total 0); D-10 per piece and `unsized-with-sized-siblings`; D-12/D-29 family choice by purchases, then distinct stores, then kg > L > pieza, with `otherFamilies` and `other-family`; D-26 reasons (`zero-amount`, `bad-amount`, `bad-quantity`, `unit-unknown`) and their exclusion from min, median, last, count and saving; even-count median 25 exactly, last price by largest literal fecha out of input order; D-20/D-30 ties (`decidedByCount`, the es collator «Abarrotes Ñandú» before «Zapata», a lone purchase can be the cheapest, sub-centavo medians still decide); D-21 saving (cheapest store adds nothing, cheaper purchases add nothing, 0.005 × 2 = 0.01 unrounded); D-23 summary (`perPieceProducts`, single-store products add nothing, rows in product order).
- Mutation check: removing the cheapest-store exclusion in the saving, the purchase-count tie-break, and the negative-amount check each makes a compare test fail (the first version of the count test did not discriminate because the larger store was also first alphabetically; it was reworked).

## Task Commits

1. Task 1: `a8c7755` test(05-03): pin SAT unit table, content reasons and purchase extraction in both IVA modes
2. Task 2: `697848e` test(05-03): pin comparison rules: reasons, family ties, per-piece, cheapest-store ties, saving and summary

## Deviations from Plan

None - plan executed exactly as written.

Notes (not deviations): the tasks are marked `tdd="true"`, but the Plan 05-01 tracer had already implemented every rule (its SUMMARY says Plan 05-03 "pins them"), so the RED step could not fail on a missing behavior and the plan itself allows changing domain code "only where a pinned case fails". The test files were written first and run green on the first pass, except for one wrong expectation of mine (an unsized piece cannot tie with a sized family because D-10 removes it first), which was a test error and not a domain defect. Domain files (`units.ts`, `content.ts`, `purchases.ts`, `compare.ts`) are untouched. Each task is therefore one `test(05-03)` commit instead of a RED/GREEN pair; the plan is `type: execute`, so the plan-level TDD gate does not apply.

## Verification

- `pnpm exec vitest run src/domain/prices src/features/prices`: 5 files, 85 tests pass (domain: 81).
- `pnpm typecheck`: pass. `pnpm lint`: 0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts` (unused disable directive), untouched.
- Acceptance greps: `purchaseInvoice` and `makeProduct` exported from the factory; `__proto__` in units.test.ts; `nota-credito` in purchases.test.ts; `decidedByCount` (3), `otherFamilies` (3), `zero-amount` (1), `unsized-with-sized-siblings` (1), `resolveContent` (2) in compare.ts; no `@/lib|stores|features|components` import in `src/domain/prices`. All pass.
- `pnpm verify` runs at the end of Plan 05-04, as the plan states.

## Known Stubs

None.

## Threat Flags

None. No network, storage or endpoint was added. T-05-01 is covered by the `__proto__` test (module-scope Map in units.ts, Map/Set groupings in compare.ts); T-05-27 by the exclusion tests of every reason code.

## Self-Check: PASSED

- Created files exist: pricesFactory.ts, units.test.ts, content.test.ts, purchases.test.ts, compare.test.ts.
- Commits `a8c7755` and `697848e` are on the branch.
