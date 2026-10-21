---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 07
subsystem: products
tags: [zustand, tanstack-table-v9, cmdk, popover, sonner, a11y, vitest, settings]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-03)
    provides: settings version 3 (Product, ProductMember, LIMITS, productIntegrityIssues)
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-05)
    provides: validateProductName, acceptProduct, productMemberKeys, ProductsTab accept flow
provides:
  - "Pure reducers renameProduct, deleteProduct, restoreProduct, removeProductMember, moveProductMember, undoMemberChange with undo snapshots (src/domain/settings/products.ts)"
  - "Six matching settingsStore actions, each setting only products in one set"
  - "«Mis productos» table (ProductList) with members sub-table (ProductMembers), sorting, pagination, inline rename, delete with Deshacer"
  - "ProductPicker (Popover + Command), reusable by «Unir con…» in Plan 04-16"
  - "Empty state of the Productos tab"
affects: [04-08 product category column, 04-16 Unir con, 04-21 held-out UI-state check, delete-category ripple]

actuals:
  tokens: 38000
  tasks: 2
  commits: 4
plan_head_before: 7c457097da5b3533ac13baf6a2c232d5632c8597
plan_head_after: 8d2387270b6b708c6cad1b33cd3a54dbb4279d91

tech-stack:
  added: []
  patterns:
    - "Every undoable product reducer returns the same settings object when the undo no longer fits (id, name or member taken again, product gone, limit), so the store writes nothing"
    - "Focus is placed before a change removes the focused button; the list reports an emptied list to the parent through onEmptied because the list unmounts with its last product"
    - "Tooltip around Popover trigger by nesting render props (TooltipTrigger render={PopoverTrigger render={Button}})"

key-files:
  created:
    - src/features/products/ProductList.tsx
    - src/features/products/ProductMembers.tsx
    - src/features/products/ProductPicker.tsx
    - src/features/products/IconAction.tsx
    - src/features/products/ProductList.test.tsx
  modified:
    - src/domain/settings/products.ts
    - src/domain/settings/products.test.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/features/products/ProductsTab.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "Removing or moving the last member deletes the product too; undo of that kind removes the member from the target first (moves) and then restores the snapshot at the same index"
  - "renameProduct with an unknown id or an unchanged name returns the same settings object (no write)"
  - "restoreProduct refuses when the id or name is taken, a member is in another product or a «No agrupar» mark, or a limit would break; a category that no longer exists comes back as null"
  - "After Quitar/Mover focus returns to the product's expander; when the product went too it goes to the «Mis productos» heading, or to the tab heading «Productos» when no product is left"

patterns-established:
  - "Local IconAction (icon-only ghost button with Tooltip equal to its aria-label) inside features/products, mirroring the Phase 3 one"

requirements-completed: [LLM-04]

coverage:
  - id: D1
    description: "Mis productos table: heading and singular/plural counts, default es-collator order, click sort, 50 per page with the footer texts, 880px min width, suppliers cell with +k"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#«Mis productos» heading and counts (E6 zero-one-many)"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#order and sorting"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#pagination (E6 overflow)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Members sub-table with several rows open at once, loaded-line counts and the «Sin líneas cargadas» badge; vendor text stays plain text"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#members sub-table (D-14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty state appears with no product, pending card or mark and disappears with the first accepted product; the entry button stays"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#the tab's empty state (E6 empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Inline rename refuses empty, repeated, reserved and over-60 names under the input with aria-invalid/aria-describedby; Enter saves, Esc cancels, focus returns to the pencil"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#inline rename (E6 error, D-14)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/products.test.ts#renameProduct (D-14)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Borrar producto applies at once with the toast, its description line and Deshacer for 6 s that restores the same id, position, name, category and members; focus goes to the section heading"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#Borrar producto (D-14, D-15)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/products.test.ts#deleteProduct and restoreProduct (D-14)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Quitar and Mover a… apply at once with Deshacer; freed descriptions are counted free again; the last member deletes the product with the OQ5 toast"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#Quitar a member (D-15, OQ5)"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductList.test.tsx#Mover a otro producto (D-15, OQ5)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/products.test.ts#removeProductMember and undoMemberChange (D-15)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Reducers refuse anything that would fail the version-3 schema on the next load and never mutate their input; the store writes only valid values and nothing on a refusal"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/settings/products.test.ts#no reducer mutates its input"
        status: pass
      - kind: integration
        ref: "src/stores/settingsStore.test.ts#settingsStore product actions (D-14, D-15)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Layout of the table, 56px rows, the two-line product name with Tooltip, the 320px picker, touch targets and the 60-character name check"
    verification: []
    human_judgment: true
    rationale: "jsdom does not lay out CSS; E6 long-text is the plan's backstop, checked in the held-out UI-state check of Plan 04-21"

duration: 38min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 07: Mis productos list with rename, delete and member moves Summary

**Accepted products now show in a sortable, paginated «Mis productos» table with an expandable members sub-table, and can be renamed inline, deleted, or have a member taken out or moved, each with a 6-second «Deshacer» backed by pure reducers that refuse any change the next load would reject.**

## Performance

- **Duration:** about 38 min
- **Started:** 2026-10-21T20:43:00Z (approx.)
- **Completed:** 2026-10-21T21:22:00Z
- **Tasks:** 2 (Task 1 auto; Task 2 TDD: RED, GREEN, then store and UI)
- **Files modified:** 13 (5 created, 8 modified)

## Accomplishments

- `ProductList`: TanStack v9 table (Producto, Miembros, Proveedores, actions) with module-scope features, es-collator name sort by default, sortable Producto and Miembros, 50 rows per page with the Phase 2 footer texts, `min-w-[880px]` inside the table container's `overflow-x-auto`. Names wrap to two lines then truncate with a Tooltip holding the full name; suppliers show the first two then «+k» through `TruncatedText`.
- `ProductMembers`: Descripción, Proveedor and Líneas from `collectItems` over the unfiltered ledger; 0 lines shows the outline Badge «Sin líneas cargadas». Several rows can be open at once.
- The Productos tab shows the `Empty` state («Todavía no hay productos agrupados») only when there is no product, no pending card and no «No agrupar» mark, and the list under the queue otherwise. The entry button stays in both cases.
- Reducers `renameProduct`, `deleteProduct`/`restoreProduct`, `removeProductMember`, `moveProductMember`, `undoMemberChange` plus `ProductSnapshot` and `MemberUndo`. Removing or moving the last member also deletes the product (OQ5); every undo that no longer fits returns the very same settings object.
- Inline rename with the queue's error texts, Borrar producto with the toast, the «Sus {n} descripciones vuelven a quedar libres.» line and «Deshacer» for 6000 ms, Quitar and Mover a… with their toasts. «Mover a…» uses the new `ProductPicker` (Popover + Command, search «Buscar producto», empty text «Ningún producto coincide con «{texto}».»).
- A removed member counts as free again in the «Agrupar productos» caption and goes into the next run (tested), and returns to taken on «Deshacer».

## Task Commits

1. **Task 1: Mis productos table, members, empty state** - `2b729a8` (feat)
2. **Task 2 RED: failing tests for the reducers** - `b6f771d` (test)
3. **Task 2 GREEN: reducers implemented** - `c49d08b` (feat)
4. **Task 2: store actions, rename, delete, quitar, mover, picker, copy** - `8d23872` (feat)

**Plan metadata:** docs commit with this SUMMARY (see git log).

## TDD Gate Compliance

- **RED (`b6f771d`):** `src/domain/settings/products.test.ts` against inert skeleton reducers (so imports resolve), as Plan 04-05 did. 22 of 45 tests failed, on the planned assertions (`expected { ok: false, reason: 'empty' } to deeply equal { ok: false, reason: 'duplicate' }`, `expected null not to be null`, `expected false to be true`) or on the fixture guards that throw "expected a deletion / a removal / a move" because the reducer under test returned nothing. None failed on syntax, import or collection errors; the remaining 23 (including all `null`/same-object refusal cases) pass against the skeleton by construction. `semanticAssessment`: the target tests executed and failed because the behavior was absent. `gsd_run check tdd-red-evidence` was not run (the `gsd_run` verb is not available in this worktree shell and `workflow.tdd_mode` is not enabled).
- **GREEN (`c49d08b`):** all 45 tests of `products.test.ts` and 223 of `src/domain/settings` pass.
- **REFACTOR:** none needed.

## Files Created/Modified

- `src/domain/settings/products.ts` - the six reducers, `ProductSnapshot`, `MemberUndo`
- `src/domain/settings/products.test.ts` - 22 new reducer tests (rename, delete/restore, remove/move/undo, limits, immutability)
- `src/stores/settingsStore.ts` / `.test.ts` - six actions and 5 tests (single write, no write on refusal, reload round trip)
- `src/features/products/ProductList.tsx` - the table, inline rename, delete, focus handling
- `src/features/products/ProductMembers.tsx` - sub-table with Quitar and Mover a…
- `src/features/products/ProductPicker.tsx` - searchable product picker (`ProductPicker`, `PickerGroup`, `PickerOption`)
- `src/features/products/IconAction.tsx` - icon button whose Tooltip equals its aria-label (new, not in the plan's file list)
- `src/features/products/ProductsTab.tsx` - Empty state, list, `onEmptied` focus
- `src/features/products/ProductList.test.tsx` - 43 jsdom tests
- `src/lib/copy/es.ts`, `messages.ts`, `messages.test.ts` - copy and helpers (`productsHeading`, `membersCount`, `suppliersCell`, `expandMembersAria`, `renameProductAria`, `deleteProductAria`, `renameProductInputAria`, `productDeletedToast`, `productFreedText`, `productEmptiedToast`, `moveMemberAria`, `removeMemberAria`, `memberRemovedToast`, `memberMovedToast`, `noProductMatches`)

## Decisions Made

- Undo of a "last member" change restores the snapshot at its old index; for a move it first takes the member out of the target, and refuses (same object) if the target is gone, no longer holds the member, or would be left empty.
- `renameProduct` treats an unknown id and an unchanged name as no change (same object, no write).
- Toast text for names follows the existing 40-character cut; the OQ5 toast also cuts the name at 40 (the UI-SPEC gives no limit for that line).

## Deviations from Plan

### Auto-fixed Issues

None - the plan executed as written. Two additions outside the plan's file list, both inside `src/features/products` or tests of changed files:

- `src/features/products/IconAction.tsx` (new): the Phase 3 `IconAction` is private to `CategoryList.tsx`; a local copy avoids editing Phase 3 code and importing across features.
- `src/lib/copy/messages.test.ts`: tests for the new copy helpers (`pnpm exec vitest run src/lib` is part of the plan's verify).

**Total deviations:** 0 auto-fixed.

## Items that need a decision

1. **Singular of the freed-descriptions line.** The plan gives only «Sus {n} descripciones vuelven a quedar libres.». For a product with one member I wrote «Su descripción vuelve a quedar libre.». Confirm or give the exact text.
2. **Heading of the «Mover a…» picker group.** The UI-SPEC gives the search placeholder and the empty text but no group heading; I used «Productos» (`es.products.picker.groupHeading`). Confirm or give another.
3. **Focus after Quitar/Mover and when the list empties.** Not specified beyond "heading after Borrar". I return focus to the product's expander after a member change, to the «Mis productos» heading when the product went too, and to the tab heading «Productos» when the last product of all was deleted (the list unmounts, same reason as the accept flow in 04-05). Confirm or choose otherwise.
4. **OQ5 toast name length.** «Producto «{nombre}» borrado porque se quedó sin descripciones» cuts the name at 40 characters like the other product toasts; the UI-SPEC line shows no limit.
5. **Category column is not here.** The UI-SPEC table lists a «Categoría» column and Select; the plan assigns them to Plan 04-08, so the table has Producto, Miembros, Proveedores and actions only.
6. **Delete-category ripple (open since 04-03/04-05).** Still not handled: `deleteCategory` does not move or clear `products[].categoryId`. Products still cannot take a category until Plan 04-08, so it cannot break yet; whichever plan adds the category Select must handle it (`restoreProduct` already brings back a vanished category as null).
7. **A deleted product that was expanded re-expands on Deshacer** (the open state is kept by product id). Harmless; say if you want it collapsed.

## Issues Encountered

- A pre-existing lint warning in `src/lib/client/navigation.ts` (unused eslint-disable directive) is unchanged and out of scope (already in `deferred-items.md`).
- cmdk labels its input through `aria-labelledby` from the `Command` `label` prop, so the accessible name «Buscar producto» is set there, not with `aria-label` on the input.

## Known Stubs

None.

## Threat Flags

None. T-04-18 (a rename, move or undo producing settings the schema rejects) is mitigated: every reducer refuses anything that would break the integrity rules or `LIMITS` by returning the same object, tests assert validity with `settingsDataSchema` after each operation, and a store test writes then reloads. T-04-19 (stored XSS through names or descriptions) is mitigated: React text only, tested with hostile text, and the acceptance grep for raw-HTML injection finds nothing. T-04-SC: nothing installed.

## Verification

- `pnpm exec vitest run src/domain/settings src/stores src/features/products src/lib`: passed
- `pnpm verify` (lint 0 errors and 1 pre-existing warning, typecheck, 2041 tests passed with 75 skipped, build): exit 0
- Acceptance greps: `useTable` 2 and `min-w-[880px]` 1 in ProductList.tsx; «Todavía no hay productos agrupados» 1 in es.ts; no raw-HTML injection in `src/features/products`; `export function moveProductMember` 1 and `export function undoMemberChange` 1 in products.ts; `6000` in ProductList.tsx and ProductMembers.tsx

## Next Phase Readiness

Plan 04-08 can add the Categoría column and Select to the same table (`ProductRow` and `columns` are module-level and easy to extend) and should close the delete-category ripple. Plan 04-16 can reuse `ProductPicker` for «Unir con…» (it takes any trigger element, optional tooltip, groups and an `onPick(id)`). Plan 04-21 owns the visual check of the two-line names, 880px width and touch sizes.

## Self-Check: PASSED

- Created files exist: `ProductList.tsx`, `ProductMembers.tsx`, `ProductPicker.tsx`, `IconAction.tsx`, `ProductList.test.tsx`.
- Commits `2b729a8`, `b6f771d`, `c49d08b`, `8d23872` exist on this branch (`git rev-list --count 7c45709..HEAD` = 4 before the docs commit).

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*
