---
status: testing
phase: 04-agrupaci-n-de-productos-con-deepseek
source: [04-VERIFICATION.md]
started: 2026-10-25T14:35:40Z
updated: 2026-10-25T14:35:40Z
---

## Current Test

number: 1
name: «Sugerir categorías» with the real key
expected: |
  Dialog lists only supplier names, product names with member descriptions and the user's category names; every supplier/product returns an existing category or a «Nueva: ...» one; at least 80% plausible; accepted rows change «Gasto por categoría».
awaiting: user response

## Tests

### 1. «Sugerir categorías» with the real key
expected: Dialog lists only supplier names, product names with member descriptions and the user's category names; every supplier/product returns an existing category or a «Nueva: ...» one; at least 80% plausible; accepted rows change «Gasto por categoría».
result: [pending]

### 2. Live cancel («Detener lotes») and reload
expected: No card of the canceled batch appears later; cards that had arrived before are still there after reload.
result: [pending]

### 3. D-32 pair JAMON ZWAN / JAMON ZWAN VIRGINIA (plus manchego and deslactosada) on the real sample
expected: They land in one card or in an «Agregar a» card now that cross-batch carry (Plan 04-15) exists.
result: [pending]

### 4. Tabs between 640 and 767 px, light and dark themes
expected: Five tabs with counters do not wrap and scroll inside the list if needed; truncation/tooltips look right. Known: at exactly 640 px the tab list overflows by about 17 px.
result: [pending]

### 5. README and in-app footer privacy text
expected: Only descriptions and supplier names go to DeepSeek, only when asked, never RFC, UUID or amounts; no country or retention period named.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
