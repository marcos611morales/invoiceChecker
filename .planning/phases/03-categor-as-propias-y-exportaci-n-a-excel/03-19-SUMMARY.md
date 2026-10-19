---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 19
subsystem: export
tags: [excel, write-excel-file, parametros, rounding, gap-closure, uat]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "03-17: Parámetros sheet with the «Nota» row (es.export.params.noteText) and the cellModel moneyCell/textCell"
provides:
  - "The «Nota» row of the Parámetros sheet discloses, in the user-confirmed words, that each amount is rounded to cents and that a column sum can differ by cents from the Gasto total and the summary Total rows"
  - "A test that pins the full Nota text in both IVA modes (WR-02)"
  - "D-20 in 03-CONTEXT.md records the disclosure decision and the 03-UI-SPEC.md Parámetros row matches the sheet"
affects: [03-verification, 03-uat, xlsx-export]

actuals:
  tokens: 2300
  tasks: 2
  commits: 3
plan_head_before: 0e80f16b8962f0847bbdc03c0b3f154a7ffd4dc9
plan_head_after: 3788e2fef34c69d7699326ae4f98323721bec2cd

tech-stack:
  added: []
  patterns:
    - "Fixed UI copy lives in es.export.params and is pinned in tests with a string literal (not read from es.ts), so a copy change must be deliberate"

key-files:
  created: []
  modified:
    - src/lib/copy/es.ts
    - src/features/export/sheets/parametros.ts
    - src/features/export/sheets/parametros.test.ts
    - .planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-CONTEXT.md
    - .planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-UI-SPEC.md

key-decisions:
  - "Disclosure, not unrounded values (user triage 2026-10-18, option-a): one «Nota» row; the rounding sentence is appended to the excluded-invoices sentence, which stays unchanged"
  - "No amount cell changes: cellModel.ts, facturas.ts and conceptos.ts are untouched; every Monto is still written rounded to cents through moneyCell"

patterns-established:
  - "Rounding caveats are stated in the workbook itself (Parámetros Nota) and recorded in the matching D-xx decision, so the accountant sees why a column sum may differ by cents"

requirements-completed: [XLS-01, XLS-03]

coverage:
  - id: D1
    description: "The Parámetros «Nota» row ends with the confirmed rounding sentence (excluded-invoices sentence, one space, rounding sentence), one text cell, ten rows in the same order, in Con IVA and Sin IVA"
    requirement: XLS-01
    verification:
      - kind: unit
        ref: "src/features/export/sheets/parametros.test.ts#explains excluded invoices and the rounding to cents (D-20, WR-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-20 records the disclosure decision and the UI-SPEC workbook contract Parámetros row carries the full Nota text"
    requirement: XLS-03
    verification:
      - kind: other
        ref: "sed -n 52p 03-CONTEXT.md | grep -c WR-02; sed -n 400p 03-UI-SPEC.md | grep -c WR-02; git diff --numstat shows 1/1 per file"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Nota row reads correctly, wrapped and fully visible, when the real export is opened in Microsoft Excel"
    requirement: XLS-01
    verification: []
    human_judgment: true
    rationale: "Visual rendering in Excel cannot be asserted by a unit test; the user verified it during the tracer feedback gate and approved"

duration: 6min active (plus the wait for the user's tracer approval)
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 19: Rounding disclosure in the Parámetros Nota Summary

**The exported workbook now tells the accountant, in the user's confirmed words, that each amount is rounded to cents and a column sum can differ by cents from the Gasto total and the summary Total rows; D-20 records that disclosure (not unrounded values) was the decision.**

## Performance

- **Duration:** about 6 min of active work (plus the wait for the user's tracer approval)
- **Started:** 2026-10-19T03:56:00Z (RED commit at 21:56 local, 2026-10-18)
- **Completed:** 2026-10-19T16:26:00Z
- **Tasks:** 2 (Task 1 tracer with TDD, Task 2 docs)
- **Files modified:** 5

## Accomplishments

- UAT gap G-03-7-WR02 (03-REVIEW.md WR-02) closed: `es.export.params.noteText` is now the excluded-invoices sentence, one space, then the user-confirmed rounding sentence (option-a of 2026-10-18), verbatim:
  «Cada monto está redondeado a centavos, por lo que la suma de una columna de montos puede diferir en unos centavos del Gasto total y de la fila Total de los resúmenes, que redondean la suma exacta.»
- The test "explains excluded invoices and the rounding to cents (D-20, WR-02)" pins the full Nota value, written as a string literal, in Con IVA and Sin IVA, and asserts the cell is `kind: "text"` with two cells per row.
- D-20 in 03-CONTEXT.md now carries the Precisión note (disclosure in Parámetros, no unrounded amounts) and the Parámetros row of the 03-UI-SPEC.md workbook contract has the full Nota text plus `[D-20, WR-02]`.
- Tracer human-check: the user opened the «Nota» row of the Parámetros sheet in Excel and responded "approved".

## Task Commits

1. **Task 1: Tracer, the confirmed rounding note through buildParametros into the Parámetros sheet** (TDD)
   - RED: `c156c9a` (test) — failing test pinning the confirmed Nota
   - GREEN: `4f1dde7` (feat) — confirmed rounding sentence in es.ts, header comment in parametros.ts
2. **Task 2: Record the disclosure decision in D-20 and align the UI-SPEC workbook contract** - `3788e2f` (docs)

**Plan metadata:** committed separately with this SUMMARY (docs: complete plan).

## Files Created/Modified

- `src/lib/copy/es.ts` - `es.export.params.noteText` with the confirmed rounding sentence appended
- `src/features/export/sheets/parametros.ts` - header comment notes the Nota also discloses rounding (D-20, WR-02); no row changed
- `src/features/export/sheets/parametros.test.ts` - renamed test pinning the full Nota in both IVA modes
- `.planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-CONTEXT.md` - D-20 line extended with the Precisión record
- `.planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-UI-SPEC.md` - Parámetros row of the workbook contract

## Decisions Made

- Followed the user's triage decision (2026-10-18, option-a): one «Nota» row, rounding sentence appended after the unchanged excluded-invoices sentence. Rejected: a separate «Redondeo» row (option-b) and other wording (option-c).
- Unrounded values were explicitly not chosen; `cellModel.ts`, `facturas.ts` and `conceptos.ts` are unmodified.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

RED `test(03-19)` commit `c156c9a` precedes GREEN `feat(03-19)` commit `4f1dde7`. RED: the renamed Nota test failed on the planned assertion (the Nota value lacked the rounding sentence) before the copy was changed. GREEN: after the copy change the test passes. No refactor commit was needed.

## Verification Results

- `pnpm vitest run`: 70 files passed, 5 skipped; 1693 tests passed, 65 skipped.
- `pnpm tsc --noEmit`: exit 0.
- `pnpm eslint .`: 0 errors, 1 warning (the pre-existing unused-directive warning in `src/lib/client/navigation.ts`, unrelated and allowed by the plan).
- Task 1 acceptance: confirmed sentence verbatim in es.ts (1) and in the test (1); `redondeado a centavos` in es.ts (1); `WR-02` in parametros.ts (1) and parametros.test.ts (1); excluded-invoices sentence in es.ts (1); `git diff --exit-code` on cellModel.ts, facturas.ts, conceptos.ts exits 0.
- Task 2 acceptance: `WR-02` on CONTEXT line 52 (1), `no escribir montos sin redondear` on line 52 (1), `WR-02` on UI-SPEC line 400 (1), `git diff --numstat` shows `1 1` for each file.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. T-03-45 (repudiation, unexplained cent differences) mitigated by the Nota and D-20; T-03-46 (note cell evaluated as a formula) mitigated because the note is a constant from es.ts written with `textCell` and the test asserts `kind: "text"`.

## Next Phase Readiness

- G-03-7-WR02 is closed; the remaining gap closure plan for this phase (WR-01, WR-03) is independent of this change.
- The Parámetros labels column is unchanged, so readers that look rows up by label (workbookReader `parameterRow`, ExportButton test) are unaffected.

## Self-Check: PASSED

- Modified files present: src/lib/copy/es.ts, src/features/export/sheets/parametros.ts, src/features/export/sheets/parametros.test.ts, 03-CONTEXT.md, 03-UI-SPEC.md.
- Commits `c156c9a`, `4f1dde7`, `3788e2f` are ancestors of HEAD.
- All task acceptance criteria and the plan-level verification re-run and pass.

---
*Phase: 03-categor-as-propias-y-exportaci-n-a-excel*
*Completed: 2026-10-19*
