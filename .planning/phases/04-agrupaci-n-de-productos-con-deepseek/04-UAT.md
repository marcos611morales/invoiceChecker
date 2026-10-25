---
status: complete
phase: 04-agrupaci-n-de-productos-con-deepseek
source: [04-VERIFICATION.md]
started: 2026-10-25T14:35:40Z
updated: 2026-10-25T16:43:29.663Z
---

## Current Test

[testing complete]

## Tests

### 1. «Sugerir categorías» with the real key
expected: Dialog lists only supplier names, product names with member descriptions and the user's category names; every supplier/product returns an existing category or a «Nueva: ...» one; at least 80% plausible; accepted rows change «Gasto por categoría».
result: pass

### 2. Live cancel («Detener lotes») and reload
expected: No card of the canceled batch appears later; cards that had arrived before are still there after reload.
result: pass

### 3. D-32 pair JAMON ZWAN / JAMON ZWAN VIRGINIA (plus manchego and deslactosada) on the real sample
expected: They land in one card or in an «Agregar a» card now that cross-batch carry (Plan 04-15) exists.
result: pass

### 4. Tabs between 640 and 767 px, light and dark themes
expected: Five tabs with counters do not wrap and scroll inside the list if needed; truncation/tooltips look right. Known: at exactly 640 px the tab list overflows by about 17 px.
result: pass

### 5. README and in-app footer privacy text
expected: Only descriptions and supplier names go to DeepSeek, only when asked, never RFC, UUID or amounts; no country or retention period named.
result: pass

### 6. IN-02: «Nueva: X» stays selectable on a category row
expected: After switching a category-suggestion row to an existing category, the menu still offers the model's «Nueva: X» option and choosing it switches the row back.
result: pass

### 7. IN-03: left-out cards line in the run result
expected: When the pending queue is full, smaller cards that still fit are added and the run result shows «{N} sugerencias no cupieron en la cola; revisa la cola y vuelve a intentarlo.»
result: pass

### 8. WR-04: sensitive category name blocks «Sugerir categorías»
expected: With an RFC in a category name, the dialog shows the red «No se puede enviar: la categoría «…» …» sentence under the summary and «Enviar a DeepSeek» is disabled.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
