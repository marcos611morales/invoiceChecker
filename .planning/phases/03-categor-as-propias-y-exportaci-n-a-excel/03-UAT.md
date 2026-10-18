---
status: testing
phase: 03-categor-as-propias-y-exportaci-n-a-excel
source: [03-VERIFICATION.md]
started: 2026-10-18T17:16:29Z
updated: 2026-10-18T17:16:29Z
---

## Current Test

number: 1
name: Plan 03-17 human-check 1 — Classification on the production build with the 143 real XML: assign suppliers in Categorías (e.g. Walmart to «Abarrotes y despensa»), change one Walmart line from the Dashboard table, confirm the rest of that ticket stays in the supplier's category and «Gasto por categoría» adds up to Gasto total in both IVA modes.
expected: |
  Only the changed line moves; the category rows add up to Gasto total in Con IVA and Sin IVA.
awaiting: user response

## Tests

### 1. Plan 03-17 human-check 1 — Classification on the production build with the 143 real XML: assign suppliers in Categorías (e.g. Walmart to «Abarrotes y despensa»), change one Walmart line from the Dashboard table, confirm the rest of that ticket stays in the supplier's category and «Gasto por categoría» adds up to Gasto total in both IVA modes.
expected: Only the changed line moves; the category rows add up to Gasto total in Con IVA and Sin IVA.
result: [pending]

### 2. Plan 03-17 human-check 2 — Create, rename and delete categories (one with assignments: once moving them to another category, once to «Sin categoría»); use «Deshacer»; in the delete dialog open «Pasarlos a».
expected: The «Pasarlos a» popup shows above the dialog and closing it keeps the dialog open; Deshacer restores the category and its assignments.
result: [pending]

### 3. Plan 03-17 human-check 3 — Reload, drop the files again, download the settings file, open the app in another browser (Safari or another Chrome profile), load the XML, upload the file; try an invalid file and a file above 1 MB.
expected: Same classification in the second browser; invalid and oversized files are refused with a clear message and the current settings are untouched.
result: [pending]

### 4. Plan 03-17 human-check 4 — Filter by one and by several categories; check the caption, the «de {total} total» lines, the dimmed lines and that choosing every category gives the unfiltered totals; click a category row and a supplier row.
expected: Chip, scroll and focus land on «Facturas»; figures are consistent.
result: [pending]

### 5. Plan 03-17 human-check 5 — Export in Con IVA and Sin IVA, with and without a category filter, and open each file in Microsoft Excel (and Numbers/LibreOffice).
expected: Six sheets in order, header frozen, Fecha shows the right day, RFC/UUID/folio are text without scientific notation, ClaveProdServ keeps leading zeros, Conceptos has «Diferencia de redondeo» lines, SUM of the Monto column of Facturas equals Gasto total (see WR-02: it may differ by cents for non-exact amounts), Parámetros lists filters and mode.
result: [pending]

### 6. Plan 03-17 human-check 6 — At 360 px, 768-1023 px and 1280 px, in light and dark themes.
expected: Tabs scroll on phones, top bar does not wrap, «Exportar a Excel» is icon-only below 1024 px with its Tooltip; category bars, green decrease color, dimmed lines and focus rings are legible in both themes.
result: [pending]

### 7. Triage the open code-review warnings WR-01, WR-02 and WR-03 (03-REVIEW-DISPOSITION.md lists all 9 findings as «open — awaiting user triage»).
expected: A decision per finding: fix now, defer, or accept. WR-01 was independently confirmed as a real defect (see Anti-Patterns).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
