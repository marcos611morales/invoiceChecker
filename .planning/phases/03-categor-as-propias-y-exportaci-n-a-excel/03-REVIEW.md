---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
reviewed: 2026-10-18T12:00:00Z
depth: standard
files_reviewed: 62
files_reviewed_list:
  - e2e/categories.spec.ts
  - e2e/export.spec.ts
  - e2e/helpers.ts
  - e2e/smoke.spec.ts
  - next.config.ts
  - package.json
  - src/domain/accounting/aggregate.ts
  - src/domain/accounting/amounts.ts
  - src/domain/accounting/breakdown.ts
  - src/domain/accounting/categories.ts
  - src/domain/accounting/filters.ts
  - src/domain/accounting/status.ts
  - src/domain/accounting/view.ts
  - src/domain/settings/assignments.ts
  - src/domain/settings/backup.ts
  - src/domain/settings/categories.ts
  - src/domain/settings/migrate.ts
  - src/domain/settings/normalize.ts
  - src/domain/settings/resolver.ts
  - src/domain/settings/schema.ts
  - src/domain/settings/types.ts
  - src/features/categories/BackupControls.tsx
  - src/features/categories/CategoriesTab.tsx
  - src/features/categories/CategoryList.tsx
  - src/features/categories/DeleteCategoryDialog.tsx
  - src/features/categories/SupplierCategoryTable.tsx
  - src/features/categories/useCategorySettings.ts
  - src/features/dashboard/CategorySpend.tsx
  - src/features/dashboard/DashboardTab.tsx
  - src/features/dashboard/DeltaLine.tsx
  - src/features/dashboard/FilterBar.tsx
  - src/features/dashboard/KpiRow.tsx
  - src/features/dashboard/SupplierRanking.tsx
  - src/features/dashboard/useDashboardView.ts
  - src/features/export/ExportButton.tsx
  - src/features/export/cellModel.ts
  - src/features/export/fileName.ts
  - src/features/export/sheets/conceptos.ts
  - src/features/export/sheets/facturas.ts
  - src/features/export/sheets/parametros.ts
  - src/features/export/sheets/resumenCategoria.ts
  - src/features/export/sheets/resumenMes.ts
  - src/features/export/sheets/resumenProveedor.ts
  - src/features/export/toLibrarySheet.ts
  - src/features/export/workbook.ts
  - src/features/export/writeWorkbook.ts
  - src/features/invoices/ConceptCategorySelect.tsx
  - src/features/invoices/InvoiceTable.tsx
  - src/features/invoices/columns.ts
  - src/features/shell/AppShell.tsx
  - src/features/shell/LogoutButton.tsx
  - src/features/shell/TopBar.tsx
  - src/lib/client/download.ts
  - src/lib/copy/es.ts
  - src/lib/copy/messages.ts
  - src/stores/sessionStore.ts
  - src/stores/settingsStore.ts
  - src/stores/storageStatusStore.ts
  - tests/support/exportFactory.ts
  - tests/support/realSample.ts
  - tests/support/settingsStorage.ts
  - tests/support/workbookReader.ts
  - tests/nextConfig.test.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-18
**Depth:** standard
**Files Reviewed:** 62 production and support files (plus the co-located tests that were read for claims versus assertions)
**Status:** issues_found

## Summary

The phase is in good shape. I tried to break the five focus areas and mostly failed:

- **Money:** every amount goes through big.js in strict mode. The parts of an entry add up exactly to the invoice amount (the exact difference goes to the supplier category), and the category breakdown, KPIs, ranking and series all read the same scoped entries. No float is summed anywhere. The conversion to a JS `number` happens only in `toLibrarySheet.toCell`, one value per cell, after rounding to cents. The Conceptos "Diferencia de redondeo" row makes the Monto cells of each invoice add up exactly to its Facturas row, as designed.
- **Untrusted input:** localStorage and the uploaded settings file are validated with zod (shape, D-30 limits, referential integrity) and the file size is checked on `file.size` before reading. All groupings keyed by RFC or description use `Map` and `Set`. Excel text cells are `String` cells; I read the installed `write-excel-file@4.1.1` source and strings are written as shared strings (`t="s"`), never as formulas, so `=1+1` in a description or supplier name cannot execute. The date serial uses `getTime()`, so the UTC-midnight dates of `cellModel` are time-zone safe.
- **Privacy:** no `fetch`, XHR or beacon in any phase-3 file. The only network calls in `src` are the login and logout routes. CSP `connect-src 'self'` is kept, `script-src` is unchanged, and `worker-src 'self' blob:` is tested.
- **Strict TypeScript:** no `any`, `@ts-*`, non-null `!` or `as` cast in production, support or test files (grep-verified). `tsc --noEmit` is clean, `eslint` reports 0 errors (1 pre-existing unused-directive warning in `src/lib/client/navigation.ts`, out of scope), and `vitest run` passes (75 files, 1758 tests).
- **React/state:** the derived-state pagination reset, the reveal/focus effects and the rehydrate flow are sound.

Nothing rises to BLOCKER. The three warnings are a filter-state inconsistency that leaks into the exported file, a documented-but-unmet reconciliation promise (D-20), and a test that does not assert what its title claims. The info items are small drift and robustness points.

## Warnings

### WR-01: Stale category ids survive «Subir ajustes» and show up in the filter chip and in the exported «Parámetros» sheet

**File:** `src/features/export/ExportButton.tsx:51-54` (also `src/features/dashboard/FilterBar.tsx:192-196`, `src/features/categories/BackupControls.tsx:166`)
**Issue:** `replaceAll(pending.settings)` swaps the category list but never touches `useSessionStore.filters.categories`. Only the delete dialog calls `dropCategoryFromFilter`. The Dashboard figures are right, because `selectView` runs `effectiveSelection` and ignores unknown ids. But two places read the raw filter set instead of the effective one:

1. `FilterBar` builds the chip with `selectedNames(categories, filters.categories)`. `selectedNames` prints a selected key that is not among the options as the key itself, so after a restore the chip reads «Categoría: cat_3f9c…» (a raw UUID id) while no category filter is actually applied.
2. `ExportButton` passes `filters.categories` to `selectedNames` for `categoryLabels`, so the «Categorías» row of the Parámetros sheet in the downloaded file lists the raw id, while the Facturas and Conceptos sheets are unfiltered. The file then lies about how it was produced. This is exactly the sheet that exists so the accountant can reproduce the file (XLS-01).

Reproduce: filter by a category, open Categorías, upload a settings file whose categories have other ids, confirm, go back to the Dashboard, and export.

**Fix:** Prune the session selection whenever the settings are replaced, and read the effective set in the two readers.
```ts
// BackupControls.tsx, in the confirm handler
replaceAll(pending.settings);
useSessionStore.getState().setCategories(
  new Set(
    [...useSessionStore.getState().filters.categories].filter(
      (id) => id === SIN_CATEGORIA || pending.settings.categories.some((c) => c.id === id),
    ),
  ),
);

// ExportButton.tsx and FilterBar.tsx: use view.selected (already effective) instead of filters.categories
categoryLabels: selectedNames(categoryOptions(ledger, resolver, settings.categories, nameOf), view.selected),
```
Add a test that replaces the settings with a different category set while a category filter is active and asserts the chip and `buildParametros` output.

### WR-02: The Monto columns of «Facturas»/«Conceptos» can differ from the Dashboard total by cents, and the file does not say so (D-20 promises they match)

**File:** `src/features/export/sheets/facturas.ts:158-164`, `src/features/export/cellModel.ts:54-56`
**Issue:** D-20 says "La suma de la columna de monto cuadra con el Dashboard". Each Facturas row is rounded to cents with `moneyCell(monto)`, while the Dashboard, and the Total rows of the summary sheets, round the exact sum once. When an amount has more than 2 decimals (foreign-currency invoices converted at a 6-decimal TipoCambio, Sin IVA with IEPS/Descuento at more than 2 decimals, or a partial amount under a category filter), the sum of the column drifts by up to half a cent per invoice. `workbook.realdata.test.ts:97-104` and `workbook.anon.test.ts` explicitly accept this drift (`exactToTheCent(...)` else-branch with a half-cent-per-invoice bound), and the comments in `resumenMes.ts` and `conceptos.ts` acknowledge it. But nothing in the delivered workbook tells the accountant. Facturas and Conceptos have no Total row, so someone who sums the column in Excel and compares it with the «Resumen» Total or the Parámetros «Gasto total» sees a mismatch with no explanation. This is a reconciliation promise made to the accountant that is only conditionally true.

**Fix:** Pick one and record it in D-20:
- Disclose it. Add a row to Parámetros such as «Nota: cada monto está redondeado a centavos; la suma de las columnas puede diferir en centavos del Total de los resúmenes, que redondea la suma exacta», and say so in the Parámetros note text (`es.export.params.noteText`).
- Or make the column exact by writing each row at the precision it actually has (a `0.00####` format with the unrounded value) so the Excel sum equals the exact total. This changes the display and needs a decision.

Do not leave the current state, where the spec says "cuadra" and the code only guarantees "within half a cent per invoice".

### WR-03: `writeWorkbook` tests claim behavior they never assert

**File:** `src/features/export/writeWorkbook.test.ts:33-66`
**Issue:** Two tests have titles that promise more than they check:
- «writes several sheets» only asserts `blob.size > 0`. It would pass if only one sheet (or none) were written.
- «writes every kind of cell, including an empty Total cell and a date» feeds a `=1+1` text, a `NaN` number, a null date and an empty Total cell, then asserts only that the first two bytes are `PK`. The injection and corruption guards (`=1+1` stays a string, `NaN` never reaches the file) are therefore verified only one level up in `toLibrarySheet.test.ts`, not on what is actually written. D-29 deliberately forbids a direct `fflate` dependency and an unzip test, so this is a known limit. But the titles should not claim more than the code checks, and the `loader` seam already allows a stronger assertion without unzipping.

**Fix:** Use the injected `loader` to capture the `Sheet[]` the library receives and assert on it (sheet count and names, `type: String` and `format: "@"` for the `=1+1` cell, `null` for the `NaN` cell), or rename the tests to what they check («does not throw for every kind of cell and returns a zip»).
```ts
let received: Sheet<Blob>[] = [];
const spy: WriterModule = {
  default: (sheets) => { received = sheets; return { toBlob: () => Promise.resolve(new Blob(["PK"])) }; },
};
await writeWorkbook([MODEL, second], 1000, () => Promise.resolve(spy));
expect(received.map((s) => s.sheet)).toEqual(["Resumen por mes", "Otra"]);
```

## Info

### IN-01: Undo toasts can do nothing without telling the user

**File:** `src/domain/settings/categories.ts:209-217`, `src/domain/settings/assignments.ts:154-163,252-257`, `src/stores/settingsStore.ts:195-201,226-236,247-253`
**Issue:** `restoreCategory`, `restoreConceptRule` and `restoreSupplierAssignment` refuse silently (same object returned) when the name or id is taken again, the target category was deleted in the meantime, or a limit is reached. The store then returns without a trace, so the «Deshacer» action on the six-second toast closes and nothing changes. Reaching these paths in six seconds is unlikely, but a no-op that looks like a success is a trust problem for the one action meant to recover data.
**Fix:** Make the store actions return a boolean (`next !== current`) and show `toast(es.categories.undoFailed)` from the three call sites when it is false.

### IN-02: Hard-coded `60` instead of `LIMITS.categoryName`

**File:** `src/features/categories/CategoryList.tsx:127,244`
**Issue:** Both inputs use `maxLength={60}` while `LIMITS.categoryName` is the contract (D-30) that the schema, the backup schema and `validateCategoryName` use. If the limit ever changes, the inputs would silently disagree with validation.
**Fix:** `maxLength={LIMITS.categoryName}`.

### IN-03: Duplicated helpers and constants

**File:** `src/features/dashboard/CategorySpend.tsx:25-28` and `src/features/dashboard/SupplierRanking.tsx:25-28` (identical `fillPercent`); `src/domain/settings/schema.ts:34-38` and `src/domain/settings/categories.ts:41-45` (`comparableName` and `RESERVED_NAME`); `src/domain/accounting/amounts.ts:46` and `src/domain/accounting/breakdown.ts:16` (`IEPS_IMPUESTO`); `src/domain/settings/schema.ts:41` and `src/domain/settings/normalize.ts:33-35` (the NUL separator in two forms); `WRAPPING_TEXT` and `TOAST_DURATION_MS` in four feature files.
**Issue:** The duplicated name comparison is the riskiest: the stored-settings check and the UI check must stay identical or a name the UI accepts would make the stored settings unreadable on the next load, which resets everything to defaults. The IEPS code `"003"` is a SAT literal that should have one definition.
**Fix:** Export `comparableName` and `RESERVED_NAME` from one module (for example `settings/types.ts` or a `names.ts`) and import them in both places; move `fillPercent` to a shared dashboard helper.

### IN-04: `rateCell` shows 4 decimals while amounts are converted with the full TipoCambio

**File:** `src/features/export/cellModel.ts:79-86`
**Issue:** CFDI allows up to 6 decimals in TipoCambio, and `breakdown.ts` converts every figure with the exact rate, but the «Tipo de cambio» cell is rounded to 4 decimals. A reader who recomputes Importe times the displayed rate will not reproduce the converted figures for a rate such as 17.123456.
**Fix:** Use `trimmedDecimal(value, 6)` with format `0.0000##` (or `#,##0.00####`), or keep 4 and say so in the header.

### IN-05: `cn` imported from two different places

**File:** `src/features/export/ExportButton.tsx:4`
**Issue:** `import { cn } from "cn"` while every other phase-3 file uses `import { cn } from "@/lib/utils"`. Both work today, but the app helper is the project convention and the direct package import bypasses it.
**Fix:** `import { cn } from "@/lib/utils";`

### IN-06: Round trip of a very large settings file is not guaranteed by the limits

**File:** `src/domain/settings/types.ts:52-58`
**Issue:** D-30 allows 20,000 concept rules and also caps the uploaded file at 1 MB. A rule is about 130 bytes in the pretty-printed file (RFC, key, description, category id, indentation), so more than about 7,500 rules produce a download that the app itself then refuses with «es demasiado grande». This is far above the expected real use (about 30 suppliers, a few hundred descriptions), but the two limits contradict each other at the top end.
**Fix:** Write the file without indentation (`JSON.stringify(file)`, about 40 % smaller), or document the effective ceiling next to `LIMITS` and lower `conceptRules` to what 1 MB can carry.

---

_Reviewed: 2026-10-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
