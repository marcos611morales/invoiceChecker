---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
verified: 2026-10-18T18:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-01-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-01-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-02-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-02-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-03-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-03-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-04-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-04-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-05-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-05-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-06-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-06-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-07-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-07-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-08-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-08-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-09-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-09-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-10-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-10-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-11-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-11-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-12-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-12-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-13-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-13-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-14-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-14-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-15-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-15-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-16-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-16-SUMMARY.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-17-PLAN.md"
  - ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-17-SUMMARY.md"
  - "e2e/categories.spec.ts"
  - "e2e/export.spec.ts"
  - "src/domain/accounting/categories.ts"
  - "src/domain/accounting/view.ts"
  - "src/domain/settings/assignments.ts"
  - "src/domain/settings/backup.ts"
  - "src/domain/settings/categories.ts"
  - "src/domain/settings/migrate.ts"
  - "src/domain/settings/normalize.ts"
  - "src/domain/settings/resolver.ts"
  - "src/domain/settings/schema.ts"
  - "src/domain/settings/types.ts"
  - "src/features/categories/BackupControls.tsx"
  - "src/features/categories/CategoriesTab.tsx"
  - "src/features/categories/CategoryList.tsx"
  - "src/features/categories/DeleteCategoryDialog.tsx"
  - "src/features/categories/SupplierCategoryTable.tsx"
  - "src/features/categories/useCategorySettings.ts"
  - "src/features/dashboard/CategorySpend.tsx"
  - "src/features/dashboard/useDashboardView.ts"
  - "src/features/export/cellModel.ts"
  - "src/features/export/fileName.ts"
  - "src/features/export/sheets/conceptos.ts"
  - "src/features/export/sheets/facturas.ts"
  - "src/features/export/sheets/parametros.ts"
  - "src/features/export/sheets/resumenCategoria.ts"
  - "src/features/export/sheets/resumenMes.ts"
  - "src/features/export/sheets/resumenProveedor.ts"
  - "src/features/export/toLibrarySheet.ts"
  - "src/features/export/workbook.ts"
  - "src/features/export/writeWorkbook.ts"
  - "src/stores/sessionStore.ts"
  - "src/stores/settingsStore.ts"
covered_digest: "v3:sha256:6da8ace816771feec92a7b208418ca0e08f9271332ceb967b41f22e8862f0dbb"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items: []
human_verification:
  - test: "Plan 03-17 human-check 1 — Classification on the production build with the 143 real XML: assign suppliers in Categorías (e.g. Walmart to «Abarrotes y despensa»), change one Walmart line from the Dashboard table, confirm the rest of that ticket stays in the supplier's category and «Gasto por categoría» adds up to Gasto total in both IVA modes."
    expected: "Only the changed line moves; the category rows add up to Gasto total in Con IVA and Sin IVA."
    why_human: "Visual flow on the real sample in a real browser; the unit/real-data suites prove the arithmetic, not the on-screen experience."
  - test: "Plan 03-17 human-check 2 — Create, rename and delete categories (one with assignments: once moving them to another category, once to «Sin categoría»); use «Deshacer»; in the delete dialog open «Pasarlos a»."
    expected: "The «Pasarlos a» popup shows above the dialog and closing it keeps the dialog open; Deshacer restores the category and its assignments."
    why_human: "Popup stacking/focus over an AlertDialog (Base UI) is a visual and interaction behavior no jsdom test sees."
  - test: "Plan 03-17 human-check 3 — Reload, drop the files again, download the settings file, open the app in another browser (Safari or another Chrome profile), load the XML, upload the file; try an invalid file and a file above 1 MB."
    expected: "Same classification in the second browser; invalid and oversized files are refused with a clear message and the current settings are untouched."
    why_human: "Only a Chromium context pair was exercised (e2e); Safari/WebKit and the 1 MB real-file path were not."
  - test: "Plan 03-17 human-check 4 — Filter by one and by several categories; check the caption, the «de {total} total» lines, the dimmed lines and that choosing every category gives the unfiltered totals; click a category row and a supplier row."
    expected: "Chip, scroll and focus land on «Facturas»; figures are consistent."
    why_human: "Scroll position, focus ring and dimmed-line legibility are visual."
  - test: "Plan 03-17 human-check 5 — Export in Con IVA and Sin IVA, with and without a category filter, and open each file in Microsoft Excel (and Numbers/LibreOffice)."
    expected: "Six sheets in order, header frozen, Fecha shows the right day, RFC/UUID/folio are text without scientific notation, ClaveProdServ keeps leading zeros, Conceptos has «Diferencia de redondeo» lines, SUM of the Monto column of Facturas equals Gasto total (see WR-02: it may differ by cents for non-exact amounts), Parámetros lists filters and mode."
    why_human: "The verifier inspected the .xlsx XML structure (sheet names, number formats, string/date/number cell types, no formulas) but no spreadsheet application opened the file."
  - test: "Plan 03-17 human-check 6 — At 360 px, 768-1023 px and 1280 px, in light and dark themes."
    expected: "Tabs scroll on phones, top bar does not wrap, «Exportar a Excel» is icon-only below 1024 px with its Tooltip; category bars, green decrease color, dimmed lines and focus rings are legible in both themes."
    why_human: "Only 360 px and 768-1023 px horizontal overflow were measured automatically; theme contrast and 1280 px layout were not looked at by anyone."
  - test: "Triage the open code-review warnings WR-01, WR-02 and WR-03 (03-REVIEW-DISPOSITION.md lists all 9 findings as «open — awaiting user triage»)."
    expected: "A decision per finding: fix now, defer, or accept. WR-01 was independently confirmed as a real defect (see Anti-Patterns)."
    why_human: "Project rule «siempre preguntar, nunca inferir»: whether the Parámetros/chip fix and the D-20 cents disclosure are done now is the user's call."
---

# Phase 3: Categorías propias y exportación a Excel — Verification Report

**Phase Goal:** El usuario organiza el gasto en sus propias categorías (por proveedor y por concepto), que persisten en el navegador y se pueden respaldar, ve "en qué gastamos más" por categoría y se lleva el análisis filtrado a un Excel de varias hojas.
**Verified:** 2026-10-18
**Status:** human_needed
**Re-verification:** No — initial verification
**Mode:** mvp (phase goal is not in the "As a ..., I want ..., so that ..." form; verified against the roadmap Success Criteria, which are the contract)

## Verdict

Every roadmap Success Criterion is backed by real, wired, data-flowing code and by independently re-run evidence. No truth failed. The status is `human_needed`, not `passed`, for two reasons: (1) the Plan 03-17 human check (real Excel/Numbers/LibreOffice, second browser, both themes, three widths) was never performed and cannot be marked as passed; (2) one reproducible edge-case defect (WR-01) and one documented-but-unmet reconciliation nuance (WR-02) are open and need the user's triage.

## Independent Evidence (re-run by the verifier, not taken from SUMMARY.md)

| Check | Result |
| ----- | ------ |
| `pnpm tsc --noEmit` | exit 0, no output |
| `pnpm eslint .` | 0 errors, 1 pre-existing warning (`src/lib/client/navigation.ts`, unused directive, not a phase 3 file) |
| `pnpm vitest run` (once) | 75 files, 1758/1758 passed. The `*.realdata.test.ts` suites ran (the `Facturas/2025` sample is present, so `describe.skipIf(!hasSample)` did not skip) |
| `pnpm exec playwright test` (production build + `next start`) | 7 passed, 1 skipped (`muestra real`, needs `E2E_FACTURAS_DIR`) |
| Actual `.xlsx` written from the real sample (throwaway test, deleted afterwards; repo left clean) | Unzipped and inspected: 6 sheets named Facturas, Conceptos, Resumen por categoría, Resumen por proveedor, Resumen por mes, Parámetros; styles declare `$#,##0.00`, `dd/mm/yyyy`, `@`, `0.0%`, `#,##0`, `#,##0.######`, `$#,##0.00####`; money cells are numeric (`t="n"` with MXN style), text columns are shared strings (`t="s"`, style `@`), date column is numeric with `dd/mm/yyyy`; **0 formulas** in all 6 sheets |
| Acceptance gates of 03-17 | no `fetch(`/XHR/sendBeacon in `src/domain`, `src/stores`, `src/features`; 0 files outside `settingsStore`/theme touching `localStorage`/`sessionStorage`; only `write-excel-file/universal` imported; `Facturas/` git-ignored and untracked; `worker-src 'self' blob:` present once in `next.config.ts`; `dangerouslySetInnerHTML` only in vendored `src/components/ui/chart.tsx` (user-accepted exclusion) |
| Debt markers (`TBD`/`FIXME`/`XXX`) in phase files | None (the only `XXX` hits are the SAT Pago currency code `"XXX"` in `columns.ts` and tests) |

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | User creates, renames, deletes categories from the page, assigns a default category per supplier, changes one concept's category without affecting the rest of that invoice; on delete chooses where assignments go or «Sin categoría» | ✓ VERIFIED | `src/domain/settings/categories.ts` (`addCategory`, `renameCategory`, `deleteCategory(settings, id, target)` re-points or drops supplier assignments and concept rules, returns a `DeleteSnapshot`; `restoreCategory` for Deshacer); `assignments.ts` (`setSupplierCategory`, `setConceptRule`, `removeConceptRule`). Wired: `CategoriesTab` renders `CategoryList` (+`DeleteCategoryDialog`), `SupplierCategoryTable`, `BackupControls`; `InvoiceTable` renders `ConceptCategorySelect` per concept row. Concept override is a rule keyed RFC + normalized description, resolved per line by `resolver.resolve(rfc, descripcion)` in `splitEntry`, so other lines of the same invoice keep the supplier category (the rule intentionally also applies to identical descriptions of the same supplier, announced as «Aplica a N líneas»). e2e `categories.spec.ts` drives supplier assignment through the UI on a production build. |
| 2 | After reload + re-drop, categories/assignments persist; settings file downloads and loads in another browser giving the same classification; an invalid file is rejected without erasing current settings | ✓ VERIFIED | `settingsStore` persists `{ivaMode, categories, supplierCategories, conceptRules}` via zustand `persist` (version 2, `skipHydration`, `migrate`/`merge` through the never-throwing `resolvePersisted`; rehydrate called from `AppShell.tsx:144`). `backup.ts`: published contract v1, `checkBackupSize` on `file.size` before reading, `parseBackupText` never throws and applies nothing; `replaceAll` is only called in the confirm handler of `BackupControls`. e2e: reload + re-drop keeps the assignment; `localStorage` holds only `invoicechecker:settings`; download → fresh second browser context → upload → confirm → same assignment; invalid file («no es json») refused, no dialog, settings unchanged; no settings/XML request leaves the browser. Second-browser check was Chromium only (see human item 3). |
| 3 | User sees spend ranking per category, monthly average per category, MoM % per category; filters by one or several categories; clicking a category or supplier shows its invoices and concepts | ✓ VERIFIED | `categories.ts` (`splitEntry`: per-concept parts + exact rounding difference to the supplier category; `scopeToCategories`; `categoryOptions`; `categoryMonthTotals`; `categoryBreakdown` → `CategoryRow{net,pct,promedio,variation}`). `CategorySpend.tsx` renders net, bar, `pct · Promedio mensual`, and `DeltaLine` variation; negative-net tick + sorted last. `DashboardTab` passes `view.*` into it; `selectView` (`view.ts`) feeds KPIs, trend, rankings and category block from the same scoped entries. Filter: `FilterBar` category multi-select + `effectiveSelection` ignores unknown ids. Click-through: `CategorySpend`/`SupplierRanking` call `revealCategory`/reveal in `sessionStore`, `InvoiceTable` reacts to `revealRequest`. Real-data suite asserts categories add up to Gasto total. |
| 4 | User downloads an Excel with sheets Facturas, Conceptos, Resumen por categoría, Resumen por proveedor, Resumen por mes, Parámetros (filters and IVA mode used), respecting active filters and the IVA mode | ✓ VERIFIED (with warning WR-01) | `ExportButton` (mounted in `AppShell`) calls `useDashboardView()` → the same `view` the Dashboard shows → `buildWorkbook(view, ctx)` → `writeWorkbook` (`write-excel-file/universal`, lazy import, 30 s timeout) → `downloadBlob`. Verified on a real written file: six sheets in the required order and names. `ctx.mode` drives the «Monto (con/sin IVA)» header and amounts; the filtered `view` drives rows. Parámetros lists filters and mode. **Caveat:** after «Subir ajustes» while a category filter is active, the Parámetros «Categorías» row and the filter chip show a raw category id (WR-01, confirmed independently). |
| 5 | In the Excel, amounts are numbers with MXN format, dates are dates, RFC/UUID/folio are text, and totals match the dashboard for the same filter and mode | ✓ VERIFIED (with warning WR-02) | Real file: amounts `t="n"` + `$#,##0.00` style; date column numeric + `dd/mm/yyyy`; text columns shared strings with `@` format; no formulas (so `=1+1` text cannot execute). `workbook.realdata.test.ts` and `workbook.anon.test.ts` assert every Total row equals the Dashboard figure in both modes over 4 real scenarios, categories add up to Gasto total, Conceptos rows (plus «Diferencia de redondeo») reconcile with the Facturas row, and choosing every category equals the unfiltered totals. **Caveat:** the Facturas/Conceptos Monto columns are rounded per row, so their raw SUM can differ from the exactly-rounded Total by up to half a cent per invoice for non-cent-exact amounts, and the file does not say so (WR-02). |

**Score:** 5/5 truths verified, 0 present-but-behavior-unverified

### Required Artifacts (spot check of level 1-3, plus level 4 below)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/domain/settings/{types,schema,migrate,resolver,categories,assignments,backup,normalize}.ts` | Settings model, validation, migration, CRUD, backup contract | ✓ VERIFIED | Substantive (31-266 lines each), imported by stores/features |
| `src/stores/settingsStore.ts` | Persisted v2 store | ✓ VERIFIED | `persist` + `partialize` + `migrate`/`merge` delegating to `resolvePersisted`; rehydrated from `AppShell` |
| `src/domain/accounting/{categories,view}.ts` | Split, scope, breakdown, `selectView` | ✓ VERIFIED | Used by `DashboardTab`, `useDashboardView`, export |
| `src/features/categories/*` (Tab, List, DeleteDialog, SupplierTable, BackupControls) | Categories UI | ✓ VERIFIED | All reachable from `CategoriesTab`, which is a registered tab in `AppShell` |
| `src/features/dashboard/CategorySpend.tsx`, `DeltaLine.tsx` | «Gasto por categoría» | ✓ VERIFIED | Rendered by `DashboardTab` |
| `src/features/invoices/ConceptCategorySelect.tsx` | Per-concept category | ✓ VERIFIED | Rendered per concept row in `InvoiceTable` |
| `src/features/export/*` (6 sheet builders, workbook, toLibrarySheet, writeWorkbook, ExportButton) | Excel export | ✓ VERIFIED | Button mounted in `AppShell`; end-to-end output inspected |
| `e2e/categories.spec.ts`, `e2e/export.spec.ts` | Production-build checks | ✓ VERIFIED | Re-run green |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `settingsStore` | `migrate.resolvePersisted` | `migrate`/`merge` | WIRED |
| `DashboardTab` / `ExportButton` | `selectView` | single hook `useDashboardView` | WIRED (one source for screen and file) |
| `selectView` | `splitEntry`/`scopeToCategories`/`categoryBreakdown` | shared scoped entries | WIRED |
| `CategorySpend` / `SupplierRanking` row click | `InvoiceTable` | `sessionStore.revealRequest` | WIRED |
| `BackupControls` confirm | `settingsStore.replaceAll` | only after a valid parse and explicit confirmation | WIRED (does not prune session category filter — WR-01) |
| `buildWorkbook` | `toLibrarySheet` → `write-excel-file/universal` | `writeWorkbook` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Real data | Status |
| -------- | ------------- | ------ | --------- | ------ |
| `CategorySpend` | `rows` (`CategoryRow[]`) | `categoryBreakdown` over ledger entries parsed from dropped XML + resolver from persisted settings | Yes (real-data suite sums to Gasto total) | ✓ FLOWING |
| `ExportButton` | `view` | same `selectView` result as the Dashboard | Yes (real file written from real sample) | ✓ FLOWING |
| `ConceptCategorySelect` | `category`, `lineCount` | resolver + rule counts | Yes | ✓ FLOWING |
| `CategoryList` / `SupplierCategoryTable` | categories, assignments | `settingsStore` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole unit/real-data suite | `pnpm vitest run` | 1758/1758 | ✓ PASS |
| Production-build flows | `pnpm exec playwright test` | 7 passed, 1 skipped | ✓ PASS |
| Real xlsx structure | unzip + inspect `xl/workbook.xml`, `styles.xml`, sheets | 6 sheets, correct types/formats, 0 formulas | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED (no probes declared by the phase plans; no `scripts/*/tests/probe-*.sh`).

### Requirements Coverage

All 14 phase requirement IDs appear in at least one PLAN `requirements:` frontmatter and in `.planning/REQUIREMENTS.md`; none orphaned. REQUIREMENTS.md maps each to Phase 3. CAT-04 is correctly Phase 4 and not claimed here.

| Requirement | Source plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| CAT-01 | 03-03, 03-17 | Create, rename, delete own categories | ✓ SATISFIED | `categories.ts` CRUD, `CategoryList`, `DeleteCategoryDialog`; unit tests + e2e |
| CAT-02 | 03-02, 03-06, 03-17 | Default category per supplier | ✓ SATISFIED | `SupplierCategoryTable`, `setSupplierCategory`; e2e assigns via UI |
| CAT-03 | 03-04, 03-05, 03-17 | Category of an individual concept | ✓ SATISFIED | `ConceptCategorySelect`, `setConceptRule`/`removeConceptRule`; resolver precedence concept rule > supplier |
| CAT-05 | 03-03 | Deleting a category: reassign or «Sin categoría» | ✓ SATISFIED | `deleteCategory(…, target)`, «Pasarlos a», Deshacer |
| AJUS-01 | 03-01, 03-06, 03-17 | Persist in localStorage with version and validation | ✓ SATISFIED | persist v2 + zod + `resolvePersisted`; storage-failure notices (03-06) |
| AJUS-02 | 03-07, 03-17 | Download/upload settings across browsers | ✓ SATISFIED | `backup.ts` contract v1 + `BackupControls`; e2e two contexts (Chromium only) |
| DASH-03 | 03-01, 03-10, 03-16 | Ranking by category | ✓ SATISFIED | `CategorySpend` |
| DASH-05 | 03-01, 03-10 | Monthly average per category | ✓ SATISFIED | `CategoryRow.promedio`, caption |
| DASH-07 | 03-10 | MoM % variation per category | ✓ SATISFIED | `CategoryRow.variation`, `DeltaLine`, `categoryMonthTotals` |
| DASH-08 | 03-11 | Click category/supplier → invoices and concepts | ✓ SATISFIED | `revealCategory`/supplier reveal → `InvoiceTable` |
| FILT-03 | 03-08, 03-09 | Filter by one or several categories | ✓ SATISFIED | `FilterBar` + `scopeToCategories`; stale-id edge case is WR-01 |
| XLS-01 | 03-12..03-16 | Excel with six sheets | ✓ SATISFIED | Verified on a real file |
| XLS-02 | 03-12..03-16 | Respects filters and IVA mode | ✓ SATISFIED | Same `view`/`mode` as Dashboard (stale-id edge case is WR-01) |
| XLS-03 | 03-12..03-17 | Number/date/text typing; totals match dashboard | ✓ SATISFIED | Real file + identity tests (cent drift of raw column sums is WR-02) |

Bookkeeping note: `.planning/REQUIREMENTS.md` still shows these 14 as `[ ]` / `Pending` and ROADMAP shows the Phase 3 checkbox unchecked. That is tracking, not code; it should be updated by the orchestrator once the phase is accepted.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/features/categories/BackupControls.tsx` (+ `ExportButton.tsx:51-54`, `FilterBar.tsx:192-196`) | 166 / 51 / 192 | **WR-01 (confirmed by the verifier by reading the code path):** `replaceAll` replaces categories but never prunes `useSessionStore.filters.categories`; only `DeleteCategoryDialog` calls `dropCategoryFromFilter`. `selectedNames` prints an unknown selected key as itself. | ⚠️ Warning | After «Subir ajustes» with a category filter active, the filter chip reads «Categoría: <raw id>» while no category filter is really applied (`effectiveSelection` ignores the unknown id, so the figures are right), and the exported Parámetros «Categorías» row lists the raw id although Facturas/Conceptos are unfiltered. The Parámetros sheet exists so the file can be reproduced (XLS-01), so it misstates how the file was produced in this sequence. Narrow trigger (needs an active category filter at upload time) and small fix (prune the selection in the confirm handler; read `view.selected` in the chip and export). |
| `src/features/export/sheets/facturas.ts`, `cellModel.ts` | 158-164 / 54-56 | **WR-02:** per-row cent rounding vs. exactly-rounded totals; D-20 promises the Monto column «cuadra», code guarantees only within half a cent per invoice, and the workbook does not disclose it | ⚠️ Warning | An accountant summing the column can see a cents difference against the «Resumen» Total / Parámetros «Gasto total» for foreign-currency, IEPS/Descuento or category-filtered partial amounts, with no explanation in the file. Needs a user decision: disclose in Parámetros, or write unrounded values. |
| `src/features/export/writeWorkbook.test.ts` | 33-66 | **WR-03:** two tests assert less than their titles claim (`blob.size > 0`, `PK` header) | ⚠️ Warning | Test-quality only; the underlying guards are covered in `toLibrarySheet.test.ts`. The verifier's own unzip of a real file fills the gap for this verification. |
| IN-01..IN-06 (03-REVIEW.md) | — | Silent no-op undo, hard-coded `60`, duplicated helpers, `rateCell` 4 decimals, `cn` import path, 1 MB vs 20 000-rule limit | ℹ️ Info | Maintainability/robustness; none blocks a success criterion. All still `open` in 03-REVIEW-DISPOSITION.md. |

No stub, empty-handler, hardcoded-empty-prop or console-only implementation was found in the phase files. TypeScript strictness gates (no `any`, `@ts-ignore`, `!`) hold in the files inspected and `tsc`/`eslint` are clean.

### Honored User Decisions (not treated as defects)

Settings format option-a; AlertDialogs dismiss with Esc only; text caps include «…»; non-decimal Cantidad written as text; `aria-describedby` on reveal row buttons; Conceptos rounding line targets the Facturas Monto (partial under a category filter); app name sr-only below 400 px; the `dangerouslySetInnerHTML` gate excludes vendored `src/components/ui/chart.tsx`.

### Human Verification Required

See the `human_verification` list in the frontmatter (7 items): the six steps of the never-performed Plan 03-17 `<human-check>` plus the open review triage. They are reported as pending; none is claimed as passed.

### Gaps Summary

No roadmap truth failed, so there are no structured `gaps`. The phase goal is achieved in the code that was exercised: categories are created/renamed/deleted/assigned per supplier and per concept, persisted and backed up, the category ranking/average/variation/filter/click-through exist and are fed from real data, and the Excel is a real six-sheet workbook with correctly typed cells and totals that reconcile with the Dashboard. What remains is (a) the human pass on real spreadsheet applications, a second browser engine, both themes and the 1280 px layout, and (b) the user's triage of WR-01 (a real but narrow defect in the Parámetros sheet and filter chip after restoring settings) and WR-02 (cent-level disclosure). If the user wants WR-01 fixed before accepting the phase, it is a small closure plan; it was not escalated to a blocker because the figures stay correct and the trigger sequence is narrow.

---

_Verified: 2026-10-18_
_Verifier: Claude (gsd-verifier)_
