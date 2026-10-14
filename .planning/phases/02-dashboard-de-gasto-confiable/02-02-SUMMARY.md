---
phase: 02-dashboard-de-gasto-confiable
plan: 02
subsystem: cfdi-parser
tags: [cfdi, parser, impuestos, ieps, tdd, vitest]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "Plan 02-01 ledger and decimal layer (not touched by this plan)"
provides:
  - "InvoiceImpuestos type and the required `impuestos` field on ParsedInvoice (invoice-level Traslados and Retenciones)"
  - "parseCfdi fills `impuestos` from the root-level Impuestos element, namespace-URI matched"
affects: [02-03]

requirements-completed: [REGLA-03]
requirements_note: "REGLA-03 is shared with Plan 02-03 (the Sin IVA formula); not marked complete in REQUIREMENTS.md here, left to the orchestrator."

actuals:
  tokens: 3000
  tasks: 1
  commits: 2
plan_head_before: 6e505e75a868309feee20010af27a20e53651caf
plan_head_after: d9a3efed593ab7b1ef90dd3a9eeda54ee7089fd5
commits: 2

tech-stack:
  added: []
  patterns:
    - "Additive parser field: exact XML strings kept, never converted to numbers in the parser"

key-files:
  created: []
  modified:
    - src/domain/cfdi/types.ts
    - src/domain/cfdi/parseCfdi.ts
    - src/domain/cfdi/parseCfdi.test.ts
    - src/domain/import/import.test.ts
    - src/stores/sessionStore.test.ts
    - src/features/invoices/InvoiceTable.test.tsx
    - src/features/shell/guards.test.tsx
    - src/features/report/ImportReport.test.tsx

key-decisions:
  - "Reused impuestosOf and kids over the root Impuestos element already looked up for the two Total attributes; no new helper"

coverage:
  - id: D1
    description: "ParsedInvoice exposes the invoice-level Traslados and Retenciones with exact strings and null for absent optional attributes; empty arrays when the root has no Impuestos; children matched by namespace URI, not prefix (D-36)"
    requirement: "REGLA-03"
    verification:
      - kind: unit
        ref: "src/domain/cfdi/parseCfdi.test.ts#parseCfdi invoice-level impuestos (D-36)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase 1 parser behavior unchanged: every existing assertion passes without modification and the whole repository type-checks"
    requirement: "REGLA-03"
    verification:
      - kind: command
        ref: "pnpm verify"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 02: Invoice-level impuestos in the parser Summary

**ParsedInvoice gains an additive `impuestos` field (root-level Traslados and Retenciones as exact XML strings), so Plan 02-03 can read the IEPS (Impuesto 003) from `invoice.impuestos.traslados`.**

## Accomplishments
- `InvoiceImpuestos { traslados: Impuesto[]; retenciones: Impuesto[] }` and the required field `impuestos` placed after `totalImpuestosRetenidos` in `src/domain/cfdi/types.ts`.
- `parseCfdi` fills it by reusing `impuestosOf` over the Traslados and Retenciones children of the root-level Impuestos element; no Impuestos element gives `{ traslados: [], retenciones: [] }`.
- Four new parser tests: the anonymized Ingreso with two root IVA traslados, the no-taxes fixture, an inline root with a Retencion and an IEPS Traslado (null for absent optional attributes), and a prefix-renamed copy of the multi-concept fixture giving the identical result.
- The ParsedInvoice literal of the five other test files carries `impuestos: { traslados: [], retenciones: [] }`.

## TDD Gate Compliance
- **RED:** `test(02-02)` commit `4b01f17`. Command `pnpm exec vitest run src/domain/cfdi/parseCfdi.test.ts` exited 1: 4 failed, 17 passed. Each of the four new tests failed on the planned behavior (`invoice.impuestos` was `undefined`: TypeError on `.traslados`/`.retenciones`, and `expected undefined to deeply equal { traslados: [], retenciones: [] }`). Semantic assessment: the target tests executed, no import/setup/syntax fault, the failure is exactly the missing field. The `gsd_run check tdd-red-evidence` classifier was not run (no record file built); the evidence is the vitest console output above.
- **GREEN:** `feat(02-02)` commit `d9a3efe`. The parser file run passes 21/21; `pnpm verify` green (lint with 0 errors, typecheck, 229 tests passed and 3 skipped, production build).
- **REFACTOR:** none needed, no commit.

## Task Commits
1. **Task 1 RED** - `4b01f17` (test)
2. **Task 1 GREEN** - `d9a3efe` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `pnpm lint` still reports the one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive). Not touched by this plan; out of scope, as recorded in the 02-01 SUMMARY.
- The plan ledger file for `commits:` could not be created (the sandbox refuses a compound `git rev-parse` redirect); the base SHA given in the dispatch (`6e505e7`) was used for `git rev-list --count` instead, giving 2.

## Authentication Gates
None.

## Known Stubs
None.

## Threat Flags
None. Attributes are copied as exact strings and never converted in the parser (T-02-31, accepted); no package installed (T-02-SC).

## Next Phase Readiness
- Plan 02-03 can read the IEPS from `invoice.impuestos.traslados` (entries with `impuesto === "003"`) and must validate amounts through `parseDecimal`.

## Self-Check: PASSED
- Modified files exist; commits `4b01f17` and `d9a3efe` are ancestors of HEAD.
- Acceptance criteria re-run: `InvoiceImpuestos` appears 2 times in types.ts; `grep -L` over the five test files prints nothing; parser tests list the new cases; `pnpm typecheck`, `pnpm lint` (0 errors) and `pnpm verify` exit 0.

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-14*
