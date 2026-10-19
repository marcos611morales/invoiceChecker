---
status: testing
phase: 03-categor-as-propias-y-exportaci-n-a-excel
source: [03-VERIFICATION.md]
started: 2026-10-18T17:16:29Z
updated: 2026-10-19T16:36:02Z
---

## Current Test

number: 8
name: WR-01 fix with real data — restoring settings never leaves a raw category id in the chip or in Parámetros
expected: |
  In the production build with the real XML, with a «Limpieza e higiene» + «Otros» category filter active, «Subir ajustes» a settings file and confirm. The FilterBar chip reads «Categoría: Otros» (never a seed:… or cat_… id), and the exported Parámetros «Categorías» row reads «Otros».
awaiting: user response

## Tests

### 1. Plan 03-17 human-check 1 — Classification on the production build with the 143 real XML: assign suppliers in Categorías (e.g. Walmart to «Abarrotes y despensa»), change one Walmart line from the Dashboard table, confirm the rest of that ticket stays in the supplier's category and «Gasto por categoría» adds up to Gasto total in both IVA modes.
expected: Only the changed line moves; the category rows add up to Gasto total in Con IVA and Sin IVA.
result: pass

### 2. Plan 03-17 human-check 2 — Create, rename and delete categories (one with assignments: once moving them to another category, once to «Sin categoría»); use «Deshacer»; in the delete dialog open «Pasarlos a».
expected: The «Pasarlos a» popup shows above the dialog and closing it keeps the dialog open; Deshacer restores the category and its assignments.
result: pass

### 3. Plan 03-17 human-check 3 — Reload, drop the files again, download the settings file, open the app in another browser (Safari or another Chrome profile), load the XML, upload the file; try an invalid file and a file above 1 MB.
expected: Same classification in the second browser; invalid and oversized files are refused with a clear message and the current settings are untouched.
result: pass

### 4. Plan 03-17 human-check 4 — Filter by one and by several categories; check the caption, the «de {total} total» lines, the dimmed lines and that choosing every category gives the unfiltered totals; click a category row and a supplier row.
expected: Chip, scroll and focus land on «Facturas»; figures are consistent.
result: pass

### 5. Plan 03-17 human-check 5 — Export in Con IVA and Sin IVA, with and without a category filter, and open each file in Microsoft Excel (and Numbers/LibreOffice).
expected: Six sheets in order, header frozen, Fecha shows the right day, RFC/UUID/folio are text without scientific notation, ClaveProdServ keeps leading zeros, Conceptos has «Diferencia de redondeo» lines, SUM of the Monto column of Facturas equals Gasto total (see WR-02: it may differ by cents for non-exact amounts), Parámetros lists filters and mode.
result: pass

### 6. Plan 03-17 human-check 6 — At 360 px, 768-1023 px and 1280 px, in light and dark themes.
expected: Tabs scroll on phones, top bar does not wrap, «Exportar a Excel» is icon-only below 1024 px with its Tooltip; category bars, green decrease color, dimmed lines and focus rings are legible in both themes.
result: pass

### 7. Triage the open code-review warnings WR-01, WR-02 and WR-03 (03-REVIEW-DISPOSITION.md lists all 9 findings as «open — awaiting user triage»).
expected: A decision per finding: fix now, defer, or accept. WR-01 was independently confirmed as a real defect (see Anti-Patterns).
result: issue
reported: "pass — triage decisions: WR-01 fix now; WR-02 fix by adding a rounding note to Parámetros; WR-03 fix with real assertions via the injected loader"
severity: major

### 8. WR-01 fix with real data — restoring settings never leaves a raw category id in the chip or in Parámetros (re-verification after gap closure 03-18).
expected: In the production build with the real XML, with a «Limpieza e higiene» + «Otros» category filter active, «Subir ajustes» a settings file and confirm. The FilterBar chip reads «Categoría: Otros» (never a seed:… or cat_… id), and the exported Parámetros «Categorías» row reads «Otros».
result: [pending]

## Summary

total: 8
passed: 6
issues: 1
pending: 1
skipped: 0
blocked: 0

## Gaps

- gap_id: G-03-7-WR01
  truth: "After «Subir ajustes» replaces the categories, the filter chip and the exported «Parámetros» sheet show only categories that actually exist and are applied (never a raw id)"
  status: failed
  reason: "User triage of code review WR-01: fix now"
  severity: major
  test: 7
  root_cause: "replaceAll(pending.settings) swaps the category list but never prunes useSessionStore.filters.categories; FilterBar and ExportButton read the raw filters.categories via selectedNames, which prints unknown keys verbatim, instead of the effective selection (view.selected)"
  artifacts:
    - path: "src/features/categories/BackupControls.tsx"
      issue: "confirm handler does not prune the session category selection after replaceAll"
    - path: "src/features/dashboard/FilterBar.tsx"
      issue: "chip built from raw filters.categories (lines ~192-196)"
    - path: "src/features/export/ExportButton.tsx"
      issue: "categoryLabels built from raw filters.categories (lines ~51-54)"
  missing:
    - "Prune filters.categories to ids present in the new settings (keep SIN_CATEGORIA) when settings are replaced"
    - "FilterBar chip and ExportButton categoryLabels read the effective selection (view.selected)"
    - "Test: replace settings with a different category set while a category filter is active; assert chip text and buildParametros output"
  debug_session: ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-REVIEW.md#wr-01"

- gap_id: G-03-7-WR02
  truth: "The exported workbook tells the accountant that each Monto is rounded to cents, so the column sums of Facturas/Conceptos may differ by cents from the summary Totals / Gasto total"
  status: failed
  reason: "User triage of code review WR-02: fix by disclosing it with a note in Parámetros (not by writing unrounded values)"
  severity: minor
  test: 7
  root_cause: "Facturas/Conceptos rows are each rounded with moneyCell while Dashboard and summary Totals round the exact sum once; the workbook does not disclose the resulting per-invoice half-cent drift, contradicting D-20's «cuadra» promise"
  artifacts:
    - path: "src/features/export/sheets/facturas.ts"
      issue: "per-row rounding (lines ~158-164), no disclosure"
    - path: "src/features/export/cellModel.ts"
      issue: "moneyCell rounds to cents (lines ~54-56)"
  missing:
    - "Add a row/note to the Parámetros sheet (and es.export.params.noteText) explaining per-amount rounding and possible cent differences vs the Totals"
    - "Record the decision in D-20 (disclosure, not exact values)"
    - "Test asserting the note is present in buildParametros output"
  debug_session: ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-REVIEW.md#wr-02"

- gap_id: G-03-7-WR03
  truth: "writeWorkbook tests assert what their titles claim: sheet count/names, «=1+1» written as a String cell with format «@», NaN written as null"
  status: failed
  reason: "User triage of code review WR-03: fix with real assertions via the injected loader"
  severity: minor
  test: 7
  root_cause: "«writes several sheets» only checks blob.size > 0 and «writes every kind of cell…» only checks the PK signature; the loader seam is not used to inspect the Sheet[] passed to the library"
  artifacts:
    - path: "src/features/export/writeWorkbook.test.ts"
      issue: "weak assertions (lines ~33-66)"
  missing:
    - "Capture the Sheet[] through the injected loader spy and assert sheet names/count, String + format «@» for the =1+1 cell, null for the NaN cell (no fflate/unzip, per D-29)"
  debug_session: ".planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-REVIEW.md#wr-03"
