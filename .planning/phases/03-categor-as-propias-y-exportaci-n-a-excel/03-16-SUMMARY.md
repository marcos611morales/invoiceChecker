---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 16
subsystem: export
status: complete
tags: [excel, identity-tests, real-data, playwright, csp, worker]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "selectView/DashboardView (03-08), buildWorkbook with six sheets (03-12 to 03-15), ExportButton and the CSP worker-src entry (03-13), setSupplierCategory/setConceptRule reducers (03-04)"
provides:
  - "workbook.anon.test.ts: workbook-versus-Dashboard identities over anonymized fixtures, both IVA modes, four category selections, with and without assignments and rules"
  - "workbook.realdata.test.ts and categories.realdata.test.ts: the same identities and the sum of categories over the local real sample (skipped without Facturas/)"
  - "e2e/helpers.ts: shared login, folder pick and request recording"
  - "e2e/export.spec.ts: production-build export of a 480-line Conceptos sheet under the real CSP"
  - "tests/support/workbookReader.ts and tests/support/realSample.ts: SheetModel reader and real-sample loader with derived settings scenarios"
affects: [03-17]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 1bfba56e5e8398554f04b84da9ded0ada9f7c58a
plan_head_after: c4aebc56661785672289d11e684c57a3041f3a59

tech-stack:
  added: []
  patterns:
    - "Workbook identities read cells from the SheetModel (no unzipping) and compare with the Dashboard figures of the same selectView result"
    - "Real-data assertions reduce every comparison to a boolean, so a failure message can never carry an RFC, name, UUID or amount"
    - "e2e folder generated at runtime from an anonymized fixture with synthetic UUIDs and removed in afterAll"

key-files:
  created:
    - src/features/export/workbook.anon.test.ts
    - src/features/export/workbook.realdata.test.ts
    - src/domain/accounting/categories.realdata.test.ts
    - tests/support/workbookReader.ts
    - tests/support/realSample.ts
    - e2e/helpers.ts
    - e2e/export.spec.ts
  modified:
    - e2e/smoke.spec.ts

key-decisions:
  - "No production code changed: every identity held on the first run, so the builders and selectors of 03-08 to 03-15 needed no fix"
  - "The own-origin blob: URL that Chrome reports for the compression Worker is set aside in export.spec.ts before the same-origin request check; e2e/helpers.ts stays byte-for-byte what the smoke spec had"

requirements-completed: [XLS-01, XLS-02, XLS-03, DASH-03]

duration: 25 min
completed: 2026-10-18
---

# Phase 3 Plan 16: Export proof Summary

**Identity tests prove that every Total row of the six-sheet workbook equals the Dashboard figure, that the categories add up to Gasto total (anonymized data everywhere, the real 2025 sample locally), and a production build downloads a 480-line workbook under the real CSP.**

## Accomplishments

- **Anonymized identities** (`workbook.anon.test.ts`, 123 tests): two datasets (MXN with cent-level rounding gaps, a credit note imputed to an earlier month, a Pago and a manually excluded invoice; and a mix that adds a half-cent Total, a USD invoice with a three-decimal rate and a USD invoice without rate) x settings without and with supplier assignments and concept rules (including an explicit «Sin categoría» rule) x Con/Sin IVA x four category selections (none, one, «Sin categoría» only, every category plus «Sin categoría»). Per case: every Total row of Resumen por categoría, por proveedor, por mes and Parámetros equals the Dashboard figure to the cent; the exact category nets add up to `view.current.gasto`; for every invoice the Monto cells of Conceptos add up to its Monto in Facturas; for the MXN dataset the Monto column of Facturas adds up to Gasto total. A separate block proves that choosing every category plus «Sin categoría» gives the same workbook totals as no filter (D-27), an explicit range with empty months keeps the identities, and the datasets really exercise rounding rows, a credit note, a Pago, an exclusion and a non-summing foreign invoice.
- **Real sample** (`workbook.realdata.test.ts`, `categories.realdata.test.ts`, 57 tests): four settings scenarios built from the sample itself (empty; every supplier assigned to «Otros»; three concept rules derived from the sample's first descriptions, one of them an explicit «Sin categoría»; both together) x both modes. The sum of categoryBreakdown nets equals totalSpend, the workbook Total rows equal the Dashboard, each Conceptos invoice reconciles with Facturas, the Facturas Monto column adds up (exactly when every amount is exact to the cent, otherwise within half a cent per invoice) and «all categories + Sin categoría» keeps the totals. Both files use `describe.skipIf(!hasSample)` with lazy loading and `FACTURAS_DIR`; assertions are booleans only.
- **e2e helpers** moved unchanged into `e2e/helpers.ts`; `smoke.spec.ts` imports them and behaves as before (its four tests pass, the real-sample test is skipped as before).
- **Production export check** (`e2e/export.spec.ts`): 80 copies of the 6-concept fixture with synthetic UUIDs (480 Conceptos lines, far above the 160,000-byte part size at which fflate compresses in a blob: Worker) are picked as a folder; clicking «Exportar a Excel» downloads `gastos-2025-02_2025-02-con-iva.xlsx` (name matched against the D-19 pattern), the file starts with `PK` and is above 20,000 bytes, the toast «Excel descargado: …» shows, the button leaves its busy state, the console holds no Content Security Policy message, the page's CSP contains `worker-src 'self' blob:` and `connect-src 'self'`, and no request carries invoice data.

## Task Commits

1. Task 1: `d2e9c31` test(03-16): workbook totals and category sums equal the Dashboard
2. Task 2: `c4aebc5` test(03-16): production-build export check under the real CSP

## TDD Gate Compliance

Task 1 is marked `tdd="true"` but the plan forbids production code changes (the tests prove identities of code written in 03-08 to 03-15), so there is no RED/GREEN pair: a RED commit would require a failing identity, and none failed. Every test passed on its first run. To confirm the tests can fail, two temporary mutations were run and reverted without being committed: adding a cent to the Total row of Resumen por mes and disabling the «Diferencia de redondeo» line of Conceptos. Together they broke 52 tests of `workbook.anon.test.ts`. No `test(03-16)` commit precedes a `feat(03-16)` commit, so a strict gate check for this plan would flag the missing GREEN commit; it is intentional here.

## Deviations from Plan

None in behaviour. Notes:

- Two support files were added beyond `files_modified`: `tests/support/workbookReader.ts` (SheetModel reading and the identity assertions shared by the anonymized and real workbook tests) and `tests/support/realSample.ts` (sample loading and the derived settings scenarios shared by the two real-data tests). They are test-only and avoid duplicating the loader and the assertions. `ledger.realdata.test.ts` keeps its own copy of `loadSample`; it was not touched.
- In `export.spec.ts` the recorded requests are filtered for URLs starting with `blob:http://localhost:3210/` before the shared same-origin check. Chrome reports exactly one such URL for this export (the compression Worker's script). This is a read from the page's own memory, not a network request. It is also indirect evidence that the Worker path ran for this sheet.
- `page.setDefaultTimeout(60_000)` plus `page.waitForEvent("download")` replace the `{ timeout: 60_000 }` option so the acceptance grep for `waitForEvent("download")` matches; the effect (60 s wait) is the same.
- Negative control not run: removing `worker-src 'self' blob:` from `next.config.ts` to watch the export hang was blocked by the environment's permission classifier, so it was not retried. The spec still asserts the header and the absence of CSP console messages.

## Verification

Run in this worktree (`pnpm install --frozen-lockfile`, then `pnpm typecheck` first so `next typegen` exists):

- `pnpm tsc --noEmit` via `pnpm typecheck`: clean.
- `pnpm eslint .` via `pnpm lint`: 0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), not touched.
- `pnpm vitest run` with `FACTURAS_DIR` pointing at the real sample: 75 files, 1757 tests passed, 0 skipped. The real-data tests RAN (57 of them in the two new files).
- `pnpm vitest run` without the sample: 70 files passed and 5 skipped, 1692 tests passed and 65 skipped (all skips are `skipIf` real-data suites).
- `pnpm exec vitest run tests/fixtures.guard.test.ts` (inside the run with the real sample, which activates the guard): passed.
- `pnpm exec playwright test e2e/export.spec.ts e2e/smoke.spec.ts`: 4 passed, 1 skipped (smoke «muestra real (local)», because `E2E_FACTURAS_DIR` is not set; same as before), against a production build with installed Chrome. The Playwright run happened in this environment; it did not need a workaround.
- `pnpm verify` (lint, typecheck, test, build): completed, build succeeded.
- Acceptance greps: `waitForEvent("download")` 1, `Content Security Policy` 1 in export.spec.ts, `from "./helpers"` 1 in smoke.spec.ts, `skipIf` 2 in each real-data file.
- Not verified by a machine: that the downloaded file opens in Excel, Numbers or LibreOffice (see 03-13 coverage D5).

## Known Stubs

None.

## Threat Flags

None. T-03-30 (real-data output) is mitigated: assertions compare in code and print only booleans, both real-data suites are `skipIf` without the sample, and the fixtures guard test passes. T-03-40 is mitigated: the export folder is generated at runtime from the anonymized fixture with synthetic UUIDs and removed in `afterAll`.

## Self-Check: PASSED

- Created files exist: workbook.anon.test.ts, workbook.realdata.test.ts, categories.realdata.test.ts, workbookReader.ts, realSample.ts, helpers.ts, export.spec.ts.
- Commits d2e9c31 and c4aebc5 are ancestors of HEAD.
