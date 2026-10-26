---
status: testing
phase: 05-comparaci-n-de-precios-entre-tiendas
source: [05-VERIFICATION.md]
started: 2026-10-26T23:13:52Z
updated: 2026-10-26T23:13:52Z
---

## Current Test

number: 1
name: Responsive layout of Precios at 360, 640, 767, 768 and 1024 px
expected: |
  The page never scrolls sideways; below 768 px the tab list scrolls inside its own container and the active «Precios» trigger stays in view.
awaiting: user response

## Tests

### 1. Responsive layout of Precios at 360, 640, 767, 768 and 1024 px
expected: The page never scrolls sideways; below 768 px the tab list scrolls inside its own container and the active «Precios» trigger stays in view.
result: [pending]

### 2. E4 long text in the products table (60-character product name, long supplier names, at 1024 and 360 px; see test-results/phase5-ui-states/e4-*.png)
expected: Names wrap to two lines and then truncate; the full text shows on hover and on keyboard focus.
result: [pending]

### 3. E7 price history in light and dark mode (e7-light-chart.png, e7-dark-chart.png, e7-light-tooltip-series3.png)
expected: Series 3 to 5 are identifiable by shape, legend and tooltip in light mode; overlapping markers stay distinguishable. Known and accepted (2026-10-26): two markers at exactly the same date and price hide each other.
result: [pending]

### 4. E8 long text in the content table (120-character description, e8-1024-contenido.png; Tab to its edit button)
expected: The description wraps in the table; the edit button's accessible name stops at 60 characters.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
