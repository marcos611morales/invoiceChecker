---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 20
subsystem: testing
tags: [vitest, write-excel-file, xlsx, gap-closure, injection-guard]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "writeWorkbook loader seam and toLibrarySheet guards (plans 03-12, 03-17)"
provides:
  - "writeWorkbook tests that assert the Sheet[] the writer library receives (count, names, order, guarded cells)"
affects: [phase-03-verification]

actuals:
  tokens: 2500
  tasks: 2
  commits: 2
plan_head_before: 0e80f16b8962f0847bbdc03c0b3f154a7ffd4dc9
plan_head_after: 65a631157bc255cf94d3a96026f6f0cd91d56a91

tech-stack:
  added: []
  patterns:
    - "Capturing loader: a WriterModule that records the sheets and delegates to the real library"

key-files:
  created: []
  modified:
    - src/features/export/writeWorkbook.test.ts

key-decisions:
  - "No zip library and no unzip (D-29): assertions run on the Sheet[] captured through the loader seam, and the PK smoke check keeps running against the real library"

requirements-completed: [XLS-01, XLS-03]

coverage:
  - id: D1
    description: "Multi-sheet test asserts exactly two sheets named Resumen por mes and Otra, in order, stickyRowsCount 1, on what the library receives (G-03-7-WR03)"
    requirement: XLS-01
    verification:
      - kind: unit
        ref: "src/features/export/writeWorkbook.test.ts#writes several sheets, in order (WR-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cell test asserts =1+1 is a String cell with format @, NaN and empty cells are null, the date is a dd/mm/yyyy Date cell, and the empty Total cell keeps only the Total style (G-03-7-WR03)"
    requirement: XLS-03
    verification:
      - kind: unit
        ref: "src/features/export/writeWorkbook.test.ts#writes every kind of cell, including an empty Total cell and a date (WR-03)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 20: writeWorkbook tests with real assertions Summary

**Capturing loader over the real write-excel-file writer, so the multi-sheet and every-kind-of-cell tests assert the Sheet[] the library receives (names, order, "=1+1" as String/"@", NaN as null) instead of only blob.size and the PK bytes.**

## Performance

- **Duration:** about 8 min
- **Completed:** 2026-10-19T03:59Z
- **Tasks:** 2
- **Files modified:** 1 (test only)

## Accomplishments
- `capturingLoader()` helper: a `WriterModule` that records each `Sheet<Blob>[]` and delegates to the real `write-excel-file/universal`, typed with no cast.
- «writes several sheets, in order (WR-03)»: one library call, two sheets named `["Resumen por mes", "Otra"]`, `stickyRowsCount` `[1, 1]`, file starts with «PK». The old `blob.size` check is gone.
- «writes every kind of cell… (WR-03)»: 4 rows; Date cell with `dd/mm/yyyy`; `"=1+1"` as `String` + `@` + `wrap`; NaN as `null`; row 2 equals `[null, null, null]`; Total row styled; the empty Total cell is strictly only the two style keys; file starts with «PK».
- Production files, `package.json` and `pnpm-lock.yaml` are byte-identical to HEAD (D-29, T-03-48).

## Task Commits

1. **Task 1: Tracer, capturing loader and multi-sheet assertions** - `0043fe9` (test)
2. **Task 2: guarded-cell assertions plus mutation checks** - `65a6311` (test)

## Mutation checks (Task 2, T-03-47)

Both mutations were temporary and reverted; `git diff --exit-code` on the production files, `package.json` and the lockfile is clean.

1. `toLibrarySheet.ts` text cell without `format: TEXT_FORMAT`: only «writes every kind of cell… (WR-03)» fails (`expected { value: '=1+1', …(2) } to deeply equal { value: '=1+1', …(3) }`). The other six tests stay green, so this regression was invisible before.
2. `writeWorkbook.ts` mapping only the first sheet (`sheets.slice(0, 1).map(toLibrarySheet)`): only «writes several sheets, in order (WR-03)» fails (`expected [ { sheet: 'Resumen por mes', …(3) } ] to have a length of 2 but got 1`).

The plan said to change `TEXT_FORMAT` to "another value". Trying `"General"` also fails, but because the real library itself throws (`The only supported format for a cell of type String is "@"`), so the three library-backed tests fail and the run does not prove the new assertions. Dropping the format key was used instead, since the library accepts it.

## Decisions Made
None beyond the plan.

## Deviations from Plan

**1. [Rule 3 - Blocking] Mutation 1 used removal of the format instead of changing its value**
- **Found during:** Task 2
- **Issue:** the library rejects any String format other than "@", so a changed value fails at the library, not at the new assertions.
- **Fix:** removed `format: TEXT_FORMAT` from the text cell for the check; reverted afterwards.
- **Files modified:** none permanently.

**Total deviations:** 1 (check variant only). **Impact:** none on deliverables.

## Issues Encountered
- The fresh worktree had no `node_modules`; ran `pnpm install --frozen-lockfile --offline` (lockfile and `package.json` unchanged) and `pnpm exec next typegen` (gitignored generated types) because `pnpm tsc --noEmit` otherwise reported `Cannot find name 'LayoutProps'` in `src/app/layout.tsx`. Both are environment setup, not code changes.
- The existing ESLint warning in `src/lib/client/navigation.ts` (unused directive) is pre-existing and unrelated.

## Verification
- `pnpm tsc --noEmit`: exit 0
- `pnpm eslint .`: 0 errors, 1 pre-existing warning
- `pnpm vitest run`: 70 files passed, 5 skipped; 1693 tests passed, 65 skipped

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
G-03-7-WR03 closed; ready for the remaining gap-closure plans and re-verification.

## Self-Check: PASSED
- `src/features/export/writeWorkbook.test.ts` exists and is the only modified source file.
- Commits `0043fe9` and `65a6311` are on the branch (2 commits since base `0e80f16`).

---
*Phase: 03-categor-as-propias-y-exportaci-n-a-excel*
*Completed: 2026-10-18*
