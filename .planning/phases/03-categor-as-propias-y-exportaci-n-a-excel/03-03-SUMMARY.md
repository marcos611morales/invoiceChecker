---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 03
subsystem: categories-ui
tags: [zustand, reducers, alert-dialog, base-ui-select, categories, undo, tdd]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "Plan 03-01 settings v2 store and schema; Plan 03-02 orderedCategories, Categorías tab, useCategorySettings"
provides:
  - "Pure reducers: validateCategoryName, addCategory, renameCategory, categoryUsage, usageByCategory, deleteCategory (with DeleteSnapshot), restoreCategory"
  - "Store actions addCategory, renameCategory, deleteCategory, restoreCategory (one set call each, refused results write nothing)"
  - "CategoryList: the «Mis categorías» card (add form, sorted list with usage, inline rename, locked row, empty state, live announcements)"
  - "DeleteCategoryDialog: «Pasarlos a» target, Q4 semantics, 6 s «Deshacer» toast, focus to the heading"
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10, 03-11, 03-12, 03-13]

actuals:
  tokens: 36000
  tasks: 3
  commits: 5
plan_head_before: 1b59b27ec916f3d981ad15c1b3793d5c0f2897fa
plan_head_after: 87605793caefe7401d1dad9733be9991e40371bd

tech-stack:
  added: []
  patterns:
    - "Reducers return a result union; the store applies only ok results; an unchanged result is the same object so the store skips the write"
    - "Dialog body mounted only while open, with the usage and the target list read once, so the text does not change while the dialog fades out after a delete"
    - "AlertDialogContent finalFocus as a function: the heading after a delete, the default (trigger) after a dismissal"

key-files:
  created:
    - src/domain/settings/categories.test.ts
    - src/features/categories/CategoryList.tsx
    - src/features/categories/CategoryList.test.tsx
    - src/features/categories/DeleteCategoryDialog.tsx
  modified:
    - src/domain/settings/categories.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/features/categories/CategoriesTab.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "restoreCategory also refuses (returns the same settings object) when the deleted category's name is now taken by another category, besides the plan's taken id and exceeded limits, so an undo can never store a duplicate name that the schema would reject on the next load (T-03-08)."
  - "Undo restores supplier assignments that the delete removed by appending them, so their position in the stored list can differ from before; the order carries no meaning (Maps in memory). The store test compares the exact stored envelope for a move target and set-equality for the Sin categoría target."
  - "usageByCategory (one pass over assignments and rules) was added next to categoryUsage because the list shows every row at once."
  - "The delete dialog follows the existing AlertDialog pattern of the app (LogoutButton): Base UI forces pointer dismissal off for alert dialogs, so Esc and the Conservar categoría button dismiss, and an overlay click does not (see Deviations)."

requirements-completed: [CAT-01, CAT-05]

coverage:
  - id: D1
    description: "Adding a category: trimmed name in its Spanish sorted place, input cleared and focused, polite announcement, persisted; empty, duplicate, reserved and 201st refused under the input with aria-invalid and aria-describedby"
    requirement: "CAT-01"
    verification:
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#CategoryList: adding"
        status: pass
      - kind: unit
        ref: "src/domain/settings/categories.test.ts#addCategory"
        status: pass
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore category actions (CAT-01, CAT-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Inline rename: input with the current name selected, Enter saves, Esc and X cancel, blur does nothing, one row at a time, same name in another case allowed, announcement, focus back to the pencil, assignments kept"
    requirement: "CAT-01"
    verification:
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#CategoryList: inline rename"
        status: pass
      - kind: unit
        ref: "src/domain/settings/categories.test.ts#renameCategory"
        status: pass
    human_judgment: false
  - id: D3
    description: "List states: nine suggestions alphabetical with Otros last, locked Sin categoría row, usage captions with zero parts omitted and Sin uso, counts singular, empty state with the form kept, hostile names as text"
    requirement: "CAT-01"
    verification:
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#CategoryList: the list"
        status: pass
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#CategoryList: empty state"
        status: pass
    human_judgment: false
  - id: D4
    description: "Delete dialog: unused body, used body with plurals, Pasarlos a Select starting on Sin categoría and listing the others in list order, choosing an option keeps the dialog open, focus on Conservar categoría"
    requirement: "CAT-05"
    verification:
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#CategoryList: delete dialog"
        status: pass
    human_judgment: false
  - id: D5
    description: "Confirming moves assignments and adjustments to the chosen category or, for Sin categoría, removes assignments and makes adjustments explicit nulls; toast Categoría borrada with Deshacer (6 s); Deshacer restores the exact data; focus moves to the heading"
    requirement: "CAT-05"
    verification:
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#moves the assignments and the adjustments to the chosen category"
        status: pass
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#restores the category in its place with its assignments and adjustments on Deshacer"
        status: pass
      - kind: unit
        ref: "src/domain/settings/categories.test.ts#restoreCategory"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual layout of the card (720 px, form stacking under 640 px, 44 px touch targets, Select popup above the dialog at most 288 px tall) and overlay-click dismissal of the dialog"
    verification:
      - kind: integration
        ref: "src/features/categories/CategoryList.test.tsx#is a 720 px card that grows with the page"
        status: pass
    human_judgment: true
    rationale: "Class names are asserted in jsdom; the real responsive layout, the Select popup stacking above the dialog and the overlay-click behavior need a human look in a real browser"

duration: 18min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 03: Own categories (add, rename, delete with undo) Summary

**Pure, limit-aware category reducers (name rules, 200 limit, delete with a reassign target, exact undo snapshot) behind the persisted store, driving a «Mis categorías» card with inline rename and a delete dialog whose «Pasarlos a» Select moves assignments and offers a 6 s «Deshacer»**

## Performance

- **Duration:** about 18 min
- **Tasks:** 3 of 3
- **Files:** 4 created, 7 modified
- **Commits:** 5 production commits

## Accomplishments

- Task 1 (TDD): `validateCategoryName` (trim, empty, 60 max, reserved «Sin categoría» in any case, duplicate ignoring case but not accents, `exceptId`), `addCategory` (200 limit, refuses the reserved key or an existing id), `renameCategory` (keeps id and position, same object for an unknown id), `categoryUsage`, `deleteCategory` (null target removes assignments and nulls rules; id target moves both; null for self or unknown target) returning an exact snapshot, `restoreCategory`. Store actions generate `cat_` plus a random UUID outside the pure domain and write once per successful action.
- Task 2: `CategoryList` card (`max-w-[720px]`, 24 px padding) with count, add form (visible label, `maxLength` 60, placeholder, error under the input with `aria-invalid` and `aria-describedby`, clears on typing), alphabetical list with usage captions, Pencil and Trash2 icon buttons with Tooltips, inline rename editor, locked «Sin categoría» row, `Empty` state, polite live region. The tab now shows title row, card and supplier section 32 px apart. Copy and message helpers with singular cases.
- Task 3: `DeleteCategoryDialog` with default focus on «Conservar categoría», body for unused or used categories, the «Pasarlos a» Select (Sin categoría first, then the others in list order, popup at most 288 px), destructive «Borrar categoría», the «Categoría borrada» toast with «Deshacer» (6 s) restoring the snapshot, and focus to the «Mis categorías» heading through `finalFocus`.

## Task Commits

1. **Task 1 RED:** `b202f82` (test) - failing reducer tests against neutral stubs (25 of 39 failing on assertions)
2. **Task 1 GREEN:** `898c667` (feat) - reducers
3. **Task 1 store:** `5cff213` (feat) - store actions and store tests
4. **Task 2:** `ab8b423` (feat) - «Mis categorías» card, copy, `usageByCategory`
5. **Task 3:** `8760579` (feat) - delete dialog, undo toast, focus return

## TDD Gate Compliance

- Reducers: RED commit `b202f82` precedes GREEN `898c667`. The RED used neutral stubs, so the failures were on assertions for the planned behavior.
- Store actions: the new store tests were run before the actions existed (11 failed with "is not a function", a missing-method failure, not an assertion on behavior) and were committed together with the actions in `5cff213`, with no separate RED commit.
- Tasks 2 and 3 (UI): the component tests were written after the components in the same commit; no RED commit exists for them. The tests exercise the behavior lines of the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] restoreCategory refuses a name that is taken again**
- **Found during:** Task 1
- **Issue:** The plan lists a taken id and exceeded limits as reasons to return the settings unchanged. If the user renames another category to the deleted category's name before pressing «Deshacer», restoring would store two categories with the same name, which the stored-settings schema rejects on the next load and resets everything (T-03-08).
- **Fix:** `restoreCategory` also returns the same settings object when another category has the same comparable name. Covered by a unit test.
- **Files modified:** `src/domain/settings/categories.ts`, `src/domain/settings/categories.test.ts`
- **Commit:** `898c667`

**2. [Plan file list] `usageByCategory` added**
- One pass over assignments and rules, used by the list; avoids up to 200 x 25,000 comparisons per render. Tested against `categoryUsage`. Files: `src/domain/settings/categories.ts`, `.test.ts`. Commit `ab8b423`.

**3. [Plan file list] Store tests in the existing store test file**
- The cases the plan asks for (stored envelope, delete then restore deep-equal, refused add writes nothing) live in `src/stores/settingsStore.test.ts` as listed; additional store cases (id uniqueness, 201st, reload) were added there too.

### Open point for the user (not decided silently)

**Overlay click does not dismiss the delete dialog.** The plan and UI-SPEC Q10 say Esc and an overlay click dismiss without changes. The app's `AlertDialog` is Base UI's alert dialog, which forces pointer dismissal off (`disablePointerDismissal = isAlertDialog || prop`), the same as the existing «Cerrar sesión» and «Quitar todas» dialogs. Esc and «Conservar categoría» dismiss; an overlay click does nothing. Making the overlay dismiss would need either a plain `Dialog` instead of `AlertDialog` (loses alert semantics) or a click handler on the shared overlay for all dialogs; neither was chosen without asking. No test asserts overlay dismissal.

**Total deviations:** 3 documented (1 missing-critical fix, 2 file-list additions) plus 1 open point.
**Impact on plan:** none on scope; behavior matches the plan except the overlay click.

## Issues Encountered

- Base UI dialog focus and close are asynchronous in jsdom, so the dialog tests use `waitFor` for the initial focus, the close and the heading focus.
- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), untouched by this plan.

## Verification

- `pnpm verify`: lint 0 errors (1 pre-existing warning), `next typegen && tsc --noEmit` clean, `vitest run` 1072 passed / 8 skipped (3 files skipped), `next build` succeeded.
- Acceptance criteria re-run: `export function deleteCategory` x1 and `restoreCategory` x1; `crypto.randomUUID` x1 in the store and `randomUUID` x0 in the domain file; test names include reserved, duplicate, limit and restore; first line of `CategoryList.test.tsx` is `// @vitest-environment jsdom`; `aria-live="polite"` x1, `maxLength={60}` x2, `max-w-[720px]` x1 in `CategoryList.tsx`; «Cancelar cambio de nombre» x1, «Sin uso» x1, «Conservar categoría» x1, «Pasarlos a» x1 in `es.ts`; `initialFocus` x1, `variant="destructive"` x1, `restoreCategory` x2 in the dialog; no raw-HTML injection in `src/features/categories`.
- CLAUDE.md rules: no `any`, `@ts-ignore`, non-null `!` or unverified `as` in new code or tests.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-03-06 (names only as React text, 60-character bound, hostile-name tests in the list and in the dialog title), T-03-07 (confirmation with default focus on «Conservar categoría», explicit target, exact undo) and T-03-08 (add and rename refuse duplicates, the reserved name and the limit; restore refuses a taken id or name and any list over its limit; refused actions write nothing) are mitigated and tested.

## Next Phase Readiness

Ready for the next plans. The Categorías tab composition leaves the title row free for the backup buttons. Concept rules (`conceptRules`) are already moved and restored by delete and undo, so Plan 03-04 can write them without changing these reducers.

## Self-Check: PASSED

- Created files present on disk: `categories.test.ts`, `CategoryList.tsx`, `CategoryList.test.tsx`, `DeleteCategoryDialog.tsx`.
- Commits `b202f82`, `898c667`, `5cff213`, `ab8b423` and `8760579` are ancestors of HEAD.
