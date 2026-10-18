---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 13
subsystem: export
tags: [excel, write-excel-file, csp, worker, timeout, top-bar, tooltip, vitest]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "XCell/SheetModel, buildWorkbook, exportFileName, es.export (03-12); useDashboardView (03-10); downloadBlob (03-07); package approval (03-01)"
provides:
  - "write-excel-file 4.1.1 installed and pinned exactly (fflate transitive only)"
  - "CSP worker-src 'self' blob: so the library's compression worker can run; script-src and connect-src unchanged"
  - "toCell / toLibrarySheet: model to library cells with the NaN, Infinity and invalid-date guards"
  - "writeWorkbook: lazy universal import, toBlob raced against a 30 s timeout, loader test seam"
  - "ExportButton in the top bar with pending, disabled and result states, mounted before Agregar facturas"
  - "excelDownloadedToast, exportedAtText and es.export.button/pending/disabledReason/failed"
affects: [03-14, 03-15]

actuals:
  tokens: 9300
  tasks: 2
  commits: 5
plan_head_before: a0118230cef9b4f652b4ca08144e9ddeba89de78
plan_head_after: 1d7109f7862f666b3c2a7cdd4b632de4fd5dd05e

tech-stack:
  added:
    - "write-excel-file 4.1.1 (exact pin; user-approved in 03-01 Task 1); fflate 0.8.3 as its transitive dependency only"
  patterns:
    - "Library loaded by dynamic import inside the writer function, universal entry only, never at module scope"
    - "Writer seam: optional loader parameter lets tests inject a never-settling stub instead of module mocking"
    - "aria-disabled (not disabled) plus Tooltip for an unavailable action; aria-busy plus a ref guard for a pending one"
    - "Two labels in one grid cell (one invisible) so a button keeps its width between states"

key-files:
  created:
    - src/features/export/toLibrarySheet.ts
    - src/features/export/toLibrarySheet.test.ts
    - src/features/export/writeWorkbook.ts
    - src/features/export/writeWorkbook.test.ts
    - src/features/export/ExportButton.tsx
    - src/features/export/ExportButton.test.tsx
    - tests/nextConfig.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - next.config.ts
    - src/features/shell/AppShell.tsx
    - src/features/shell/AppShell.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "Styled-but-empty Total row cells are written as a style-only cell object (bold, #E5E5E5) so the Total row is filled across its whole width; verified the library accepts it"
  - "exportedAtText lives in messages.ts (plan names messages.ts) as a local-clock dd/mm/aaaa hh:mm formatter"
  - "Success and failure use plain toast(...) as the plan states, matching the sonner mock used by the other shell tests"

patterns-established:
  - "A writer function that must never hang: async IIFE for the work (so a synchronous throw becomes a rejection), Promise.race against a timer, timer cleared in finally"

requirements-completed: [XLS-01, XLS-02, XLS-03]

coverage:
  - id: D1
    description: "Model cells map to library cells: String with @ format, finite Number only, valid Date only, bold #E5E5E5 wrapped frozen header, filled Total row, column widths"
    requirement: XLS-03
    verification:
      - kind: unit
        ref: "src/features/export/toLibrarySheet.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "writeWorkbook produces a real .xlsx Blob and rejects instead of hanging (never-settling stub, load failure, write failure)"
    requirement: XLS-01
    verification:
      - kind: unit
        ref: "src/features/export/writeWorkbook.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "CSP adds exactly worker-src 'self' blob:; connect-src 'self' and script-src (no blob:) unchanged"
    verification:
      - kind: unit
        ref: "tests/nextConfig.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Exportar a Excel button: D-19 file name and toast, Exportando state, double activation ignored, failure toast, aria-disabled with Tooltip when no invoice, no network or storage use"
    requirement: XLS-02
    verification:
      - kind: unit
        ref: "src/features/export/ExportButton.test.tsx"
        status: pass
      - kind: integration
        ref: "src/features/shell/AppShell.test.tsx#AppShell export button"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real download in a production build under the real CSP, for a sheet large enough to need the compression worker, and the file opening in Excel/Numbers/LibreOffice"
    requirement: XLS-01
    verification: []
    human_judgment: true
    rationale: "Vitest runs in Node (worker_threads, no CSP) and cannot see a CSP block or the real browser Worker; the layout at 768-1023 px and the look of the icon-only button also need a human in a real browser"

duration: 12min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 13: Export path end to end Summary

**write-excel-file 4.1.1 (exact pin) behind a lazy universal-entry writer raced against a 30 s timeout, a CSP that allows only its blob: compression worker, and an «Exportar a Excel» top-bar button that downloads the Resumen por mes workbook for the Dashboard's filters and IVA mode.**

## Performance

- **Duration:** 12 min
- **Tasks:** 2 (both TDD)
- **Files:** 7 created, 8 modified
- **Commits:** 5 production commits (listed below); the docs commit follows this file

## Accomplishments

- Installed `write-excel-file@4.1.1 --save-exact`. The diff is one line in `package.json` and the lockfile entries for the library and `fflate@0.8.3` (transitive); nothing else changed. The user approved this package in Plan 03-01 Task 1 (see its SUMMARY), so no checkpoint was needed.
- `next.config.ts`: added `worker-src 'self' blob:` after `connect-src`. `tests/nextConfig.test.ts` asserts the new directive, that `connect-src` is exactly `'self'`, and that `script-src` has no `blob:` (T-03-23).
- `toLibrarySheet.ts`: `toCell` and `toLibrarySheet`. Text is a String cell with format `@` (so `=1+1` stays text); numbers go through `Number()` and become an empty cell when not finite or blank; dates become an empty cell when null or invalid; header is bold on `#E5E5E5` with wrapping and the first row is frozen; wrapping columns wrap their body cells; the Total row is bold and filled, including its empty cells (T-03-25).
- `writeWorkbook.ts`: `EXPORT_TIMEOUT_MS = 30000`; the library comes from `await import("write-excel-file/universal")` inside the default loader (never module scope), and `toBlob()` is raced against a timer that rejects with `export timeout`; the timer is cleared in `finally`. A synchronous throw from the library also becomes a rejection (T-03-24).
- `ExportButton.tsx`: reads `useDashboardView()`, builds the `WorkbookContext` at click time (supplier, category and forma labels of the current filters through `selectedNames`, local-clock `exportedAtText`), calls `writeWorkbook(buildWorkbook(view, ctx))`, `downloadBlob(blob, exportFileName(view.range, mode))` and the toast «Excel descargado: {nombre}». Pending shows a Spinner in the icon slot and «Exportando…» in the same grid cell as the normal label (no width change), `aria-busy`, and a ref guard so a second activation starts nothing. With no invoice under the filters it is `aria-disabled` (not `disabled`) with the Tooltip «No hay facturas con los filtros actuales». Any error shows «No se pudo generar el Excel. Inténtalo de nuevo.» and `finally` frees the button. Below 1024 px it is icon-only (`max-lg:size-9`, `max-sm:size-11`) with its `aria-label` and Tooltip.
- `AppShell.tsx`: `actions` is now `ExportButton` then `AddInvoicesButton`, still only when `reportVisible`.
- Copy: `es.export.button/pending/disabledReason/failed`, `excelDownloadedToast`, `exportedAtText`.
- Out-of-band check of a real file: unzipped the output of `writeWorkbook(buildWorkbook(...))` and confirmed the sheet XML has the frozen pane (`ySplit="1" state="frozen"`), the column widths and no non-finite values.

## Task Commits

1. Dependency: `89bbd3c` chore (write-excel-file 4.1.1, exact pin)
2. Task 1 RED: `f340052` test (mapper, writer timeout, CSP)
3. Task 1 GREEN: `6207a4a` feat (mapper, writer, CSP)
4. Task 2 RED: `f0e2828` test (button, shell, copy)
5. Task 2 GREEN: `1d7109f` feat (button, AppShell, copy)

## TDD Gate Compliance

- RED 1 (`f340052`): with skeleton stubs, 19 of the new tests failed on assertions (for example `expected null to deeply equal { value: 'AAA010101AAA', ... }`, `expected undefined to be "worker-src 'self' blob:"`); no load, syntax or zero-test errors. The tests that expect an empty cell or a rejection passed against the stubs by construction; the targets that matter (mapping, header, Total row, PK bytes, CSP directive, rejection message `export timeout`) failed. Semantic assessment: each target ran and failed on the planned value.
- GREEN 1 (`6207a4a`): 52 passed across `tests/nextConfig.test.ts` and `src/features/export`.
- RED 2 (`f0e2828`): 17 target tests failed (13 ExportButton, 2 AppShell, 2 messages) on «Unable to find an accessible element with the role "button" and name "Exportar a Excel"» and on the expected message strings; the rest of the 126 tests in those files stayed green.
- GREEN 2 (`1d7109f`): 299 passed across `src/features/export src/features/shell src/lib`; `pnpm verify` green.
- Not run: the `gsd_run check tdd-red-evidence` classifier (gsd-tools is not installed in this environment); RED evidence was inspected by hand from the vitest output, as in 03-12. No REFACTOR commit was needed.

## Deviations from Plan

None to code - plan executed as written. Notes:

**1. [Structural] Separate dependency commit**
- The plan's Task 1 is one task; the install was committed on its own (`89bbd3c`) before the RED commit so the type imports in the skeleton resolve and the lockfile change is isolated for review.

**2. [Structural] Tests added outside `files_modified`**
- `AppShell.test.tsx` gained a describe block for the shell placement (every tab, empty screen, order). The plan lists `AppShell.tsx` but not its test file.

**Total deviations:** 0 auto-fixed, 2 structural notes. **Impact:** none on behavior.

## Decisions needing no user input but worth recording

- The Total row's empty cells are style-only objects so the fill runs across the row; the plan only said «a bold, filled Total row».
- The two button labels share one grid cell (inactive one `invisible` and `aria-hidden`), which is how «its size does not change» is met without a hard-coded width.

## Verification

- `pnpm exec vitest run src/features/export tests/nextConfig.test.ts`: 7 files, passed.
- `pnpm exec vitest run src/features/export src/features/shell src/lib`: 16 files, 299 tests passed.
- `pnpm verify` (eslint, `next typegen && tsc --noEmit`, `vitest run`, `next build`): exit 0; 62 files passed, 3 skipped, 1501 tests passed, 8 skipped; build succeeded. Default workers, no timeout rerun needed.
- `pnpm eslint`: 0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive; untouched by this plan, out of scope).
- Task 1 acceptance: `package.json` has `write-excel-file` `4.1.1` and no direct `fflate` (exit 0); `grep -rhoE "write-excel-file[/a-z]*" src | sort -u` prints only `write-excel-file/universal`; `worker-src 'self' blob:` count 1; `connect-src 'self'"` count 1; `await import(` count 1 in `writeWorkbook.ts`.
- Task 2 acceptance: `aria-busy` 2, `aria-disabled` 2, `ExportButton` in `AppShell.tsx` 2, `useDashboardView` in `ExportButton.tsx` 3; the forbidden-API grep over `src/features/export` finds nothing.

## Known Stubs

None. The RED-step skeletons were replaced in the GREEN commits.

## Threat Flags

None beyond the plan's register. T-03-23 (only `worker-src` added, three CSP assertions), T-03-24 (30 s race, `finally`, never-settling stub test), T-03-25 (finite-only numbers, valid-only dates, tests) and T-03-SC (approved exact pin, lockfile committed, fflate transitive, no install script) are implemented. T-03-26 accepted: the acceptance grep and a runtime test (no `fetch` spy call, no `Storage.setItem` call during an export) back it.

## Issues Encountered

None blocking. Items for a human, because Vitest runs in Node and cannot see them:

- Export a sheet large enough to need the compression worker (over about 160 KB) from a production build under the real CSP, and open the downloaded file in Excel, Numbers or LibreOffice (RESEARCH Pitfall 1 and the Open Questions in the project stack notes).
- Check 768-1023 px in a real browser: the IVA control stays centered and the bar does not wrap. UI-SPEC Q9 allows collapsing «Agregar facturas» and «Cerrar sesión» under 1024 px only if the bar overflows; this plan did not change them.

## Next Phase Readiness

Ready for 03-14 and 03-15: the remaining sheets only need `buildWorkbook` to return more `SheetModel`s; the mapper, writer, timeout and button need no change.

## Self-Check: PASSED

- Created files exist on disk: `toLibrarySheet.ts`, `toLibrarySheet.test.ts`, `writeWorkbook.ts`, `writeWorkbook.test.ts`, `ExportButton.tsx`, `ExportButton.test.tsx`, `tests/nextConfig.test.ts`.
- Commits `89bbd3c`, `f340052`, `6207a4a`, `f0e2828`, `1d7109f` are ancestors of HEAD; `git rev-list --count a011823..HEAD` is 5 at SUMMARY time.
- `pnpm verify` is green.
