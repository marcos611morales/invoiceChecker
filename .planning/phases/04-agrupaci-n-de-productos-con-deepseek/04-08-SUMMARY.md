---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 08
subsystem: settings
tags: [resolver, zustand, tanstack-table-v9, select, excel, vitest, settings]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-03)
    provides: settings version 3 (Product with categoryId, productIntegrityIssues)
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-07)
    provides: ProductList table, product reducers and store actions
provides:
  - "Resolver level «producto» between the concept rule and the supplier (CAT-04, D-16), with explain().product"
  - "setProductCategory reducer and store action"
  - "Categoría column with a Select per row in «Mis productos»"
  - "«Del producto» origin value in the Conceptos sheet of the Excel"
  - "deleteCategory, restoreCategory, categoryUsage and usageByCategory aware of products (no stored product points at a deleted category)"
affects: [04-09 concept panel label and delete-dialog texts, 04-16 Unir con, 04-21 held-out UI-state check]

actuals:
  tokens: 52000
  tasks: 2
  commits: 4
plan_head_before: 2e42c1114266443d018a9306a1eb23746e0febda
plan_head_after: 4b5f1f416e91b0807dc1918c0ed589e4c872f33e

tech-stack:
  added: []
  patterns:
    - "Resolver precedence is a chain of Maps keyed by ruleMapKey(rfc, key): rule, then product member, then supplier; a product adds a level only with a category that exists"
    - "Every category delete/restore sets categories, supplierCategories, conceptRules and products in one store set, so persist writes once and the stored value always loads"

key-files:
  created:
    - src/domain/settings/resolver.test.ts
  modified:
    - src/domain/settings/resolver.ts
    - src/domain/settings/products.ts
    - src/domain/settings/products.test.ts
    - src/domain/settings/categories.ts
    - src/domain/settings/categories.test.ts
    - src/domain/settings/rules.test.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/features/products/ProductList.tsx
    - src/features/products/ProductList.test.tsx
    - src/features/categories/CategoryList.test.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/features/export/sheets/conceptos.ts
    - src/features/export/sheets/conceptos.test.ts
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts

key-decisions:
  - "setProductCategory refuses an unknown category id (the reserved «Sin categoría» key included) as unknown-category; an unknown product or an unchanged category returns the very same settings object so the store writes nothing"
  - "A product whose category no longer exists is read as unset by both the resolver and the table row, so a stale id can never change an amount or show a phantom name"
  - "DeleteSnapshot.products holds full deep copies of the products that had the category; restoreCategory only uses id and categoryId, and gives the category back to each product that still exists, replacing whatever it has now (same semantics as the supplier assignments and the rules)"
  - "A category used only by products is deleted by the existing dialog with no target picker (used is still computed from suppliers and concepts), which moves its products to «Sin categoría»; the products-aware dialog is Plan 04-09"

patterns-established:
  - "CategoryUsage interface exported from categories.ts: { suppliers, concepts, products }"

requirements-completed: [CAT-04]

coverage:
  - id: D1
    description: "Category of a concept line resolves as concept rule (explicit «Sin categoría» included) > accepted product category > supplier category > «Sin categoría»; a product without category or with a vanished category adds no level; a member of another supplier does not inherit the product"
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "src/domain/settings/resolver.test.ts#makeResolver precedence (CAT-04, D-16)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/rules.test.ts#Resolver.explain (D-09, UI-SPEC Q4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "setProductCategory sets, changes and clears a product's category, refuses an unknown category, returns the same object when nothing changes and never mutates its input; the store writes once and nothing on a refusal"
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "src/domain/settings/products.test.ts#setProductCategory (CAT-04, D-16)"
        status: pass
      - kind: integration
        ref: "src/stores/settingsStore.test.ts#settingsStore product actions (D-14, D-15)"
        status: pass
    human_judgment: false
  - id: D3
    description: "«Mis productos» has a Categoría column after Producto with a 240px Select per row labelled «Categoría del producto {nombre}», unset reads «Sin categoría» muted, a change applies at once with no toast, «Sin categoría» removes the level, and the column sorts by category name with unassigned last in both directions"
    requirement: CAT-04
    verification:
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#Categoría del producto (E6 populated and partial, D-14, D-16)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Giving a product a category moves its members' lines (without a concept rule) in «Gasto por categoría», and the rows add up to «Gasto total» in both IVA modes; a concept rule line stays under its rule and the other lines under their supplier"
    requirement: CAT-04
    verification:
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#product level (CAT-04, D-16)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Conceptos sheet writes «Del producto» in the origin column for a product-sourced line"
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "src/features/export/sheets/conceptos.test.ts#writes «Del producto» for a line that takes its category from a product"
        status: pass
    human_judgment: false
  - id: D6
    description: "Deleting a category used by products moves them to the chosen category or to «Sin categoría»; «Deshacer» puts their category back; no stored product points at a deleted category, also after a reload; usage counts products"
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "src/domain/settings/categories.test.ts#deleteCategory with products (CAT-05 ripple, D-13)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/categories.test.ts#restoreCategory with products (CAT-05 ripple, D-13)"
        status: pass
      - kind: integration
        ref: "src/stores/settingsStore.test.ts#settingsStore deleteCategory and restoreCategory carry the products (CAT-05, D-13)"
        status: pass
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#deletes a category that only products use, moving them to Sin categoría"
        status: pass
    human_judgment: false
  - id: D7
    description: "Layout of the Categoría column (240px Select next to the 2-line name, 880px table width, full-width Select under 640px) and how the Select reads in a real browser"
    verification: []
    human_judgment: true
    rationale: "jsdom does not lay out CSS; the held-out UI-state check of Plan 04-21 is the backstop"

duration: 35min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 08: Product category drives the Dashboard and the Excel Summary

**Products now carry a category that wins over the supplier's and loses to a concept adjustment, from a Select in «Mis productos» through the resolver to the Dashboard, the category filter and the Excel («Del producto»), and deleting a category moves and restores its products so the stored settings always load.**

## Performance

- **Duration:** about 35 min
- **Started:** 2026-10-21T21:36:00Z (approx.)
- **Completed:** 2026-10-21T22:11:00Z (approx.)
- **Tasks:** 2 (both TDD: RED then GREEN each)
- **Files modified:** 17 (1 created, 16 modified)

## Accomplishments

- `makeResolver` has the new level: a Map keyed by `ruleMapKey(rfc, key)` for the members of products whose `categoryId` is non-null and exists, checked after the concept-rule Map (so an explicit «Sin categoría» rule still wins) and before the supplier Map. `explain` returns `{ category, source, product }` with `product` set only for source `"producto"`. The RFC is part of the key, so another supplier's identical description does not inherit the product.
- `setProductCategory` (domain and store). The `ProductList` row gets a Categoría column after Producto: Select 240px (full width under 640px), `aria-label` «Categoría del producto {nombre}», «Sin categoría» (muted) first and then `orderedCategories`; a change is applied and persisted at once with no toast; sortable by category name with unassigned last in both directions.
- Dashboard, category filter and Excel follow with no further code: they read the one resolver. A Dashboard test stores a product with members of two suppliers in «Insumos de cafetería», one member with a concept rule to «Otros», and proves in both IVA modes (cents computed independently from the XML strings) that product lines move, the rule line stays under its rule, the rest stay under the supplier, and the rows add up to «Gasto total».
- The Conceptos sheet writes «Del producto» through the exhaustive `originText` switch (`es.export.origin.producto`).
- `deleteCategory` clears or moves `products[].categoryId` in the same pass as suppliers and rules; `DeleteSnapshot.products` holds copies; `restoreCategory` gives the category back to each product that still exists and leaves a deleted product deleted; `categoryUsage`/`usageByCategory` return `{ suppliers, concepts, products }`; the store sets `products` in the same `set`. A store test deletes a category used by products, reloads from the written value and checks it loads unchanged (T-04-20).

## Task Commits

1. **Task 1 RED: failing tests for the product level** - `a12dd25` (test)
2. **Task 1 GREEN: product category in Mis productos drives the Dashboard and the Excel** - `e0ae503` (feat)
3. **Task 2 RED: failing tests for products carried by category delete, restore and usage** - `12bf25b` (test)
4. **Task 2 GREEN: category delete, restore and usage carry the products** - `4b5f1f4` (feat)

**Plan metadata:** docs commit with this SUMMARY (see git log).

## TDD Gate Compliance

- **Task 1 RED (`a12dd25`):** 16 of 77 tests in `resolver.test.ts`, `products.test.ts` and `conceptos.test.ts` failed, plus 9 `ProductList` and 4 `DashboardTab` tests, all on the planned assertions (`expected { category, source } to deeply equal { …, product: null }`, `expected null to be 'seed:insumos-cafeteria'`, `expected 'Del proveedor' to equal 'Del producto'`, `no category row «Insumos de cafetería»`, no combobox «Categoría del producto …»). An inert `setProductCategory` skeleton (returns the same settings) was committed with the tests so the imports resolve, as Plan 04-05 and 04-07 did; its refusal cases fail on the assertion and its same-object cases pass by construction. One Dashboard test and the `ProductList` category tests call the missing store action or Select and so fail with a missing-function or missing-element error rather than a value assertion. None failed on syntax, import or collection errors. `semanticAssessment`: the target tests executed and failed because the behavior was absent. The RED commit does not pass `pnpm typecheck` (tests use `explain().product`, `setProductCategory` on the store, `"producto"`); GREEN does. `gsd_run check tdd-red-evidence` was not run (the `gsd_run` verb is not available in this worktree shell and `workflow.tdd_mode` is not enabled).
- **Task 1 GREEN (`e0ae503`):** all tests of `src/domain`, `src/stores`, `src/features` and `src/lib` pass.
- **Task 2 RED (`12bf25b`):** 13 tests in `categories.test.ts` failed (usage without `products`, snapshot without `products`, null/move targets leaving products on the deleted category, schema rejecting the result) and 3 store tests failed on the planned assertions; the one that reloads the written value saw `products: []`, which is exactly the silent reset T-04-20 describes. The restore-with-products cases pass before the change by construction, because an unchanged delete leaves nothing to restore.
- **Task 2 GREEN (`4b5f1f4`):** all pass; `pnpm verify` exits 0.
- **REFACTOR:** none needed.

## Files Created/Modified

- `src/domain/settings/resolver.ts` - the product level and the full precedence header comment
- `src/domain/settings/resolver.test.ts` - new: 12 precedence tests
- `src/domain/settings/products.ts` / `.test.ts` - `setProductCategory` and its 6 tests
- `src/domain/settings/categories.ts` / `.test.ts` - products-aware usage, delete, restore, snapshot; 20 new or adjusted tests
- `src/domain/settings/rules.test.ts` - the seven existing `explain` expectations gain `product: null`
- `src/stores/settingsStore.ts` / `.test.ts` - `setProductCategory` action; `deleteCategory` and `restoreCategory` also set `products`; 5 new tests
- `src/features/products/ProductList.tsx` / `.test.tsx` - Categoría column and Select; 9 new tests; the `openMove` helper now asks for the «Buscar producto» combobox because each row now has a category combobox too
- `src/features/categories/CategoryList.test.tsx` - delete a category used only by products and undo it
- `src/features/dashboard/DashboardTab.test.tsx` - 4 product-level tests
- `src/features/export/sheets/conceptos.ts` / `.test.ts` - `case "producto"` and its test
- `src/lib/copy/es.ts`, `messages.ts` - `export.origin.producto`, `products.list.columns.category`, `productCategoryAria`

## Decisions Made

- `setProductCategory` returns the same settings object for an unknown product and for an unchanged category, so the store writes nothing (same convention as `renameProduct`).
- The table row and the resolver both treat a product whose category id is not in `categories` as unset.
- `restoreCategory` replaces a product's current category with the snapshot one, as it does for supplier assignments and rules. See item 2 under "Items that need a decision".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests broke because of the changed contract**
- **Found during:** Task 1 (GREEN)
- **Issue:** `rules.test.ts` compared `explain()` results with `toEqual({ category, source })`; with `product: null` in the new return value seven of them failed. The `openMove` helper of `ProductList.test.tsx` used `findByRole("combobox")`, which is now ambiguous because every row has a category Select.
- **Fix:** added `product: null` to the seven expectations; `openMove` asks for the combobox named «Buscar producto». No behavior of those tests changed.
- **Files modified:** `src/domain/settings/rules.test.ts`, `src/features/products/ProductList.test.tsx`
- **Committed in:** `e0ae503`

### Additions outside the plan's file list (all tests of changed code)

- `src/stores/settingsStore.test.ts`: tests for the store action and for the delete/restore ripple, including the reload round trip that proves T-04-20.
- `src/features/categories/CategoryList.test.tsx`: one end-to-end test through the real delete dialog and the Deshacer toast.
- `src/domain/settings/rules.test.ts`: see above.

**Total deviations:** 1 auto-fixed (Rule 3), 3 test files outside the listed set.
**Impact on plan:** none on behavior; the tests had to follow the changed return shape.

## Issues Encountered

- A pre-existing lint warning in `src/lib/client/navigation.ts` (unused eslint-disable directive) is unchanged and already in `deferred-items.md`.
- The IDE suggests canonical Tailwind class names (`w-60` for `w-[240px]`); the file keeps the arbitrary-value style used across the project and the tests assert it.

## Items that need a decision

1. **Concept selector for a product-sourced line.** `ConceptCategorySelect` treats only `source === "regla"` as adjusted and only `"proveedor"` as showing «· del proveedor». A line whose category now comes from a product therefore shows the category name in muted color with no suffix and no mention of the product. The plan assigns that label to Plan 04-09 («{categoría} del producto {nombre}»); confirm it is fine for it to read like this until then.
2. **«Deshacer» of a category delete overwrites a category changed meanwhile.** If the user deletes «Servicios» (its products move to «Otros»), then gives one of those products another category, and then presses «Deshacer», that product goes back to «Servicios». This is the same behavior the supplier assignments and concept rules already have, and it keeps «Deshacer» exact, but it can undo a later, unrelated edit. Alternative: restore a product's category only if it still has the category the delete gave it. Say if you want that.
3. **Delete dialog for a category used only by products.** The dialog keeps its wording and shows no «Pasarlos a» picker when only products use the category (its `used` test still counts suppliers and concepts), so those products always go to «Sin categoría». The plan accepts this until 04-09; flagging it because the user cannot choose the target for products alone in the meantime.
4. **No toast when a product's category changes.** Per the plan; there is also no «Deshacer» for it, unlike a concept adjustment. Confirm that is wanted.
5. **Category sort ties.** Products with the same category (or none) keep their stored order under the Categoría sort, not their name order. The supplier table does the same.

## Known Stubs

None.

## Threat Flags

None. T-04-20 (a product pointing at a deleted category making the stored settings unreadable) is mitigated: `deleteCategory` moves or clears the products in the same pass, the store sets them in the same `set`, `restoreCategory` puts them back, and domain and store tests (including a write-then-reload) prove no stored product points at a deleted category. T-04-21 (formula-looking product names in the Excel) is mitigated by construction: the origin column holds the fixed copy «Del producto» and product names are not written to any cell; existing text cells stay typed text. T-04-SC: nothing installed.

## Verification

- `pnpm exec vitest run src/domain src/stores src/features src/lib`: passed
- `pnpm verify` (lint 0 errors and 1 pre-existing warning, typecheck, 2094 tests passed with 75 skipped, build): exit 0
- `pnpm exec eslint .`: 0 errors, 1 pre-existing warning
- Acceptance greps: `"producto"` in resolver.ts 3; `setProductCategory` in ProductList.tsx 2; `producto: "Del producto"` in es.ts 1; `case "producto"` in conceptos.ts 1; `products` in categories.ts 16

## Next Phase Readiness

Plan 04-09 can add the product label to the concept selector (`explain(...).product` is ready) and the product counts to the delete dialog and usage captions (`CategoryUsage.products` and `DeleteSnapshot.products` are ready). Plan 04-21 owns the visual check of the Categoría column width and the narrow-screen Select.

## Self-Check: PASSED

- Created file exists: `src/domain/settings/resolver.test.ts`.
- Commits `a12dd25`, `e0ae503`, `12bf25b`, `4b5f1f4` exist on this branch (`git rev-list --count 2e42c11..HEAD` = 4 before the docs commit).

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*
