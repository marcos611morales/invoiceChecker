---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 09
subsystem: ui
tags: [select, tooltip, base-ui, delete-dialog, copy, vitest, categories]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-08)
    provides: resolver level «producto» with explain().product, CategoryUsage { suppliers, products, concepts }, products carried by category delete and restore
provides:
  - "ConceptRow.productName and the product branch of ConceptCategorySelect: «{categoría} · del producto {nombre}» (D-16)"
  - "conceptCategoryProductAria, es.invoices.fromProduct and es.invoices.productOrigin"
  - "Three-part deleteCategoryBody and usageCaption (suppliers, products, concepts)"
  - "Delete dialog offers «Pasarlos a» for a category used only by products"
affects: [04-21 held-out UI-state check of the concept Select and the Categorías tab]

actuals:
  tokens: 9600
  tasks: 2
  commits: 3
plan_head_before: a5fb557b95b876d3dc62749bdc909b447632430c
plan_head_after: ad8f791425960e1ee07a9387f21bb8e87abcc8fc

tech-stack:
  added: []
  patterns:
    - "A Tooltip is merged into a Base UI Select trigger through TooltipTrigger's render prop (SelectTrigger as the rendered element, the trigger content as TooltipTrigger children), so no button nests inside the trigger"
    - "Usage text of a category is built by one private usageParts helper shared by the caption (join with ·) and the delete body (join with commas and a final «y»)"

key-files:
  created: []
  modified:
    - src/features/invoices/columns.ts
    - src/features/invoices/columns.test.ts
    - src/features/invoices/ConceptCategorySelect.tsx
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/features/categories/DeleteCategoryDialog.tsx
    - src/features/categories/CategoryList.tsx
    - src/features/categories/CategoryList.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "The «del producto {nombre}» line is shown as the first, non-selectable line of the open popup on every device, not only on touch: it needs no touch detection and is harmless with a pointer (the plan leaves the touch form to the executor)"
  - "A new copy key es.invoices.productOrigin («del producto») is used for that popup line, so the suffix «· del producto» is not string-edited at render time"
  - "The unused body («No está asignada a ningún proveedor ni concepto.») is kept as the plan says; it does not name products"

patterns-established:
  - "Product origin in the concept Select: category (muted, truncates) + «· del producto» (12px muted, shrink-0) + product name (12px muted, truncate, max-w-[120px])"

requirements-completed: [CAT-04]

coverage:
  - id: D1
    description: "A concept line whose category comes from its product reads «{categoría} · del producto {nombre}» (category muted, suffix 12px muted not shrinking, product name 12px muted capped at 120px); ConceptRow.productName is set only for product-sourced lines"
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "src/features/invoices/columns.test.ts#conceptRows categories (D-09, D-10, D-11) D-16"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#category from the product (CAT-04, D-16, E8) E8 populated"
        status: pass
    human_judgment: false
  - id: D2
    description: "The accessible name of that Select is «Categoría del concepto «{descripción, 60}», {categoría} del producto {nombre}» with the full product name; a Tooltip with the full name opens on focus; the open popup starts with a non-selectable «del producto {nombre}» line; a long name never widens the trigger"
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#Concept category Select copy (UI-SPEC E7) D-16"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#category from the product (CAT-04, D-16, E8) E8 long-text"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#category from the product (CAT-04, D-16, E8) E8 touch form"
        status: pass
    human_judgment: false
  - id: D3
    description: "Picking a category on a product-sourced line stores a concept rule that beats the product (the product is untouched), «Quitar ajuste» returns the line to «· del producto», an explicit «Sin categoría» rule still beats the product, a product without category or with a deleted category falls to «· del proveedor» or «Sin categoría», and another supplier's equal description does not inherit the product"
    requirement: CAT-04
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#category from the product (CAT-04, D-16, E8) picking a category creates a concept rule"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#category from the product (CAT-04, D-16, E8) E8 partial"
        status: pass
    human_judgment: false
  - id: D4
    description: "The delete dialog says «La usan {n} proveedores, {p} productos y {m} conceptos.» (zero parts omitted) and offers «Pasarlos a» for a category used only by products; the products go to the chosen category and «Deshacer» restores them; the «Mis categorías» caption reads «{n} proveedores · {p} productos · {m} conceptos», «Sin uso» when all are zero"
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#Delete category dialog copy (D-05) D-13"
        status: pass
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#CategoryList: delete dialog D-13"
        status: pass
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#CategoryList: the list D-13 counts the products of a category in its caption"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual result in a real browser: the 120px product-name block and the muted colors inside the 240px trigger, the Tooltip placement, and the first popup line on a touch screen"
    verification: []
    human_judgment: true
    rationale: "jsdom does not lay out CSS or emulate a touch device; the held-out UI-state check of Plan 04-21 is the backstop"

duration: 6min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 09: Product origin in the concept panel and product counts in the Categorías texts

**A concept whose category comes from its product now reads «{categoría} · del producto {nombre}» in the Facturas table (name capped at 120px, full name in the accessible name, a Tooltip and the open popup), and the Categorías caption and delete dialog count products and let the user choose where they go.**

## Performance

- **Duration:** about 6 min of wall clock (a plan of two small tasks)
- **Started:** 2026-10-21T21:40:50Z
- **Completed:** 2026-10-21T21:46:00Z
- **Tasks:** 2 (Task 2 TDD: RED then GREEN)
- **Files modified:** 11 (0 created)

## Accomplishments

- `ConceptRow.productName` comes from `resolver.explain(...).product` and is set only when the source is `"producto"`. `InvoiceTable` passes it to `ConceptCategorySelect`.
- `ConceptCategorySelect` with a product source: category name (muted, truncates), `· del producto` (12px muted, `shrink-0`), product name (12px muted, `truncate`, `max-w-[120px]`). The trigger's `aria-label` is `conceptCategoryProductAria(descripcion, categoría, producto)`. A `Tooltip` with the full product name is merged into the trigger through `TooltipTrigger`'s `render` prop, so there is no button inside the trigger. The open popup starts with a `select-none` 12px muted line «del producto {nombre}» that is not an option. `adjusted` is unchanged (only a concept rule), so picking a category still stores a rule, the «Aplica a {n} líneas» caption appears and «Quitar ajuste» brings the line back to the product.
- `usageCaption` and `deleteCategoryBody` take `(suppliers, products, concepts)`; both read their parts from one `usageParts` helper. The caption joins with « · »; the body joins two parts with «y» and three as «a, b y c». `DeleteCategoryDialog` counts `usage.products` in `used`, so a category used only by products now gets the «Pasarlos a» Select; `CategoryList` passes the three counts.
- 25 new or changed tests: columns (4), Select states (13), copy (6 changed or new), CategoryList (3).

## Task Commits

1. **Task 1: product origin in the concept category Select** - `b184ae2` (feat)
2. **Task 2 RED: failing tests for products in the delete dialog and usage caption** - `4bd9323` (test)
3. **Task 2 GREEN: count products in the delete dialog and the usage caption** - `ad8f791` (feat)

**Plan metadata:** docs commit with this SUMMARY (see git log).

## Files Created/Modified

- `src/features/invoices/columns.ts` / `.test.ts` - `ConceptRow.productName` and its tests
- `src/features/invoices/ConceptCategorySelect.tsx` - product branch of the trigger, Tooltip and popup line
- `src/features/invoices/InvoiceTable.tsx` / `.test.tsx` - passes `productName`; 13 tests for the E8 states
- `src/features/categories/DeleteCategoryDialog.tsx`, `CategoryList.tsx` / `.test.tsx` - product counts, «Pasarlos a» for product-only categories, 3 new tests
- `src/lib/copy/es.ts` - `invoices.fromProduct`, `invoices.productOrigin`
- `src/lib/copy/messages.ts` / `.test.ts` - `conceptCategoryProductAria`, three-part `deleteCategoryBody` and `usageCaption`

## Decisions Made

- The «del producto {nombre}» popup line is shown on every device, not only on touch (no touch detection needed; the plan leaves the touch form to the executor). See item 1 under "Items that need a decision".
- A new key `es.invoices.productOrigin` (`del producto`) feeds that line.
- The unused-category body keeps its Phase 3 wording, as the plan says.

## TDD Gate Compliance

- **Task 2 RED (`4bd9323`):** 8 tests failed on the planned assertions: `expected '1 proveedor' to be '1 proveedor · 1 concepto'`, `expected '1 proveedor · 2 conceptos' to be '1 proveedor · 2 productos'`, `expected 'La usan 2 proveedores y 1 concepto.' to be 'La usan 2 proveedores, 1 producto y 3…'`, plus the three `CategoryList` tests (no caption text with «productos», no body text with «producto», no combobox «Pasarlos a» for a product-only category). The target tests executed; none failed on syntax, import or collection errors. `semanticAssessment`: they failed because the product counts and the picker were absent. The tests call the three-argument signatures, so the RED commit does not pass `pnpm typecheck` (the calls have one argument too many); GREEN does. `gsd_run check tdd-red-evidence` was not run (the verb is not available in this shell and `workflow.tdd_mode` is not enabled).
- **Task 2 GREEN (`ad8f791`):** all 342 tests of `src/features/categories` and `src/lib` pass; `pnpm verify` exits 0.
- **REFACTOR:** none needed.
- Task 1 is not marked `tdd="true"` in the plan; its tests were written with the code and committed together.

## Deviations from Plan

None - plan executed exactly as written. Two additions inside the plan's files, noted for transparency: the new copy key `es.invoices.productOrigin`, and the popup line shown on every device instead of only on touch (a choice the plan delegates).

## Issues Encountered

- A pre-existing lint warning in `src/lib/client/navigation.ts` (unused eslint-disable directive) is unchanged and already in `deferred-items.md`.

## Items that need a decision

1. **Popup line on pointer devices too.** The first popup line «del producto {nombre}» appears for every device because the code has no touch detection in this component, so a mouse user sees it besides the Tooltip. Alternative: show it only on touch (needs exporting `useIsTouchDevice` from `TruncatedText.tsx`, outside this plan's file list). Say if you want that.
2. **Unused-category body.** «No está asignada a ningún proveedor ni concepto.» does not mention products. It is only shown when all three counts are zero, so it is not wrong, but the wording could say «ningún proveedor, producto ni concepto». The plan keeps the old wording; say if you want it changed.

## Known Stubs

None.

## Threat Flags

None. T-04-49 (stored XSS through product names in the concept Select, Tooltip or accessible name) is mitigated: the name is rendered as React text and an attribute value only, and a test with `<img src=x onerror=alert(1)>` checks the trigger text, the accessible name and the Tooltip and finds no `img` element. T-04-SC: nothing installed.

## Verification

- `pnpm exec vitest run src/features/invoices src/lib`: 378 passed
- `pnpm exec vitest run src/features/categories src/lib`: 342 passed
- `pnpm verify` (lint 0 errors and 1 pre-existing warning, typecheck, 2118 tests passed with 75 skipped, build): exit 0
- Acceptance greps: `max-w-\[120px\]` in ConceptCategorySelect.tsx 1; `fromProduct` in es.ts 1; `conceptCategoryProductAria` in ConceptCategorySelect.tsx 2; `usage.products` in DeleteCategoryDialog.tsx 2

## Next Phase Readiness

The concept panel and the Categorías tab now speak about products. Plan 04-21 owns the visual check of the 120px block, the Tooltip and the popup line in a real browser.

## Self-Check: PASSED

- Modified files exist; commits `b184ae2`, `4bd9323`, `ad8f791` exist on this branch (`git rev-list --count a5fb557..HEAD` = 3 before the docs commit).

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*
