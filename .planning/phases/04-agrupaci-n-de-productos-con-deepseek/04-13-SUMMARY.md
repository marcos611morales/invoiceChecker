---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 13
subsystem: ui
tags: [zustand, zod, reducers, undo, base-ui, collapsible, vitest, testing-library]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "Persisted pending queue (04-11), run store and batches (04-12), ReviewQueue card with Aceptar, accepted products and the version-3 settings with ungroupedConcepts (04-04 to 04-10)"
provides:
  - "Pure undoable queue reducers: renameSuggestion, removeSuggestion/restoreSuggestion, dropMember/restoreMember"
  - "Pure «No agrupar» reducers: markUngrouped, unmarkUngrouped, ungroupedKeys"
  - "Matching actions on suggestionsStore and settingsStore (each writes only its own field)"
  - "Editable name Input per card, «Rechazar», member Ban button, UngroupedList collapsible"
affects: [04-14 Unir, 04-16 Separar, 04-17 bulk actions, 04-18 category suggestions, 04-21 end-of-phase UI check]

plan_head_before: 946fdc5a05ab7fb296ef68fbd40cce1426a0b7d9
plan_head_after: 31c912d44dae3398696e5ddc90d678141aa19f82
commits: 3

actuals:
  tokens: 21000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Review reducer returns the very same queue object for a refused or useless change, so the store writes nothing"
    - "Undo value (RemovedSuggestion, DroppedMember) is a copy that never aliases the queue"
    - "Name commit reads the DOM value of the Input, so a click on a button right after typing never sees a stale draft"

key-files:
  created:
    - src/features/products/UngroupedList.tsx
    - tests/support/reviewQueue.ts
  modified:
    - src/domain/llm/suggestions.ts
    - src/domain/llm/suggestions.test.ts
    - src/domain/settings/products.ts
    - src/domain/settings/products.test.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/stores/suggestionsStore.ts
    - src/stores/suggestionsStore.test.ts
    - src/features/products/ReviewQueue.tsx
    - src/features/products/ReviewQueue.test.tsx
    - src/features/products/ProductsTab.tsx
    - src/features/products/ProductsTab.test.tsx
    - src/features/products/IconAction.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "The name heading of a card is replaced by an Input (no h3 remains); Enter or blur stores the name cut to 60 in the pending queue (an empty name is stored too, as the stored schema allows)"
  - "Name errors (empty, duplicate, reserved) show under the Input with aria-invalid and aria-describedby, and Aceptar's aria-describedby points at that same text; limit and members-taken errors stay under the buttons"
  - "A Ban press on a description that already belongs to an accepted product (reason «taken») shows the existing members-taken text on the card instead of marking"
  - "restoreSuggestion and restoreMember refuse (same object) when the card id exists, a limit would break, the card is gone or the member is pending elsewhere, so Deshacer can never produce a queue the schema rejects"

patterns-established:
  - "Rejecting and marking both: focus first (next card Input, queue heading, or tab heading), then mutate, then toast with Deshacer for 6000 ms"
  - "tests/support/reviewQueue.ts: nameInput/nameInputs/findNameInput/cardOf to find cards by the value of their name Input"

requirements-completed: [LLM-04]

coverage:
  - id: D1
    description: "The proposed name is an editable Input (aria-label «Nombre del producto sugerido», maxLength 60); Enter or blur stores it in the pending queue and in storage, and it survives a reload"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#the proposed name is an editable Input (D-12, D-19)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#renameSuggestion (D-12, D-19)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty, duplicate (ignoring case and edge spaces) and «Sin categoría» names show their error under the Input with aria-invalid and aria-describedby, clear when the user types, and Aceptar refuses with the same text"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#shows an empty name under the Input and refuses «Aceptar» with the same text; typing clears it"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#refuses the name of an accepted product ignoring case and edge spaces"
        status: pass
    human_judgment: false
  - id: D3
    description: "«Rechazar» removes the card, leaves its descriptions free, toasts «Sugerencia «{nombre}» rechazada» with «Deshacer» for 6 s (restores the card at its place), announces the remaining count and moves focus to the next card, the queue heading or the tab heading"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#«Rechazar» (D-22)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#removeSuggestion and restoreSuggestion (D-22)"
        status: pass
    human_judgment: false
  - id: D4
    description: "«No agrupar esta descripción» removes a member (the card with its only member), stores the mark in the settings, toasts with «Deshacer» that unmarks and restores the member, refuses beyond 5,000 with a toast, and the marked description is never counted as free or sent"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#«No agrupar esta descripción» on a member (D-19, D-22, D-13)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/products.test.ts#«No agrupar» marks (D-13, D-22)"
        status: pass
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore «No agrupar» actions (D-13, D-22)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Descripciones marcadas «No agrupar» ({n}) Collapsible below «Mis productos»: closed by default, not rendered with zero marks, rows with description and supplier, «Quitar marca» removes the row with the announcement «Marca quitada…» and no toast; long descriptions wrap and the aria-label is cut at 60"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#Descripciones marcadas «No agrupar» (E7, D-22)"
        status: pass
    human_judgment: false
  - id: D6
    description: "With 100 or more marks the list scrolls inside a ScrollArea of at most 288px and the page does not grow; wrapping of long descriptions and the 640px layout of the Ban button and the footer buttons"
    requirement: LLM-04
    verification: []
    human_judgment: true
    rationale: "Only jsdom ran; the test asserts the max-h-72 class, but real scrolling and wrapping need a browser (backstop item for the held-out UI-state check of Plan 04-21)"

duration: about 40min (start time not recorded)
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 13: Rename, reject and «No agrupar» Summary

**Each pending card now has an editable name Input, a «Rechazar» button and a Ban button per description that excludes it for good, all undoable for 6 s through pure queue/settings reducers, plus a collapsible list to take the «No agrupar» marks back.**

## Performance

- **Duration:** about 40 min (the start time was not recorded)
- **Completed:** 2026-10-21T22:45Z
- **Tasks:** 2 (Task 1 TDD)
- **Files:** 2 created, 16 modified (18 files in the diff, +1824 / -91 lines)

## Accomplishments

- Five pure reducers over the pending queue (`renameSuggestion`, `removeSuggestion`, `restoreSuggestion`, `dropMember`, `restoreMember`) and three over the settings (`markUngrouped`, `unmarkUngrouped`, `ungroupedKeys`). None mutates its input (frozen-input tests), every result passes `pendingQueueSchema` or the version-3 settings schema, and a refused or useless change returns the same object so the stores write nothing.
- Store actions with the same names; `suggestionsStore` sets only `products`, `settingsStore` only `ungroupedConcepts`.
- `ReviewQueue`: the name heading is now an Input (36px, 44px under 640px). Enter or blur stores the name; the error under the Input is linked with `aria-invalid`/`aria-describedby` and cleared on typing. «Rechazar» (ghost, named after the card) and the member Ban `IconAction` (tooltip, `aria-describedby` pointing at that member's description) apply at once and toast with «Deshacer» for 6000 ms. Focus goes to the next card's Input, the queue heading, or the tab heading.
- `UngroupedList`: Collapsible closed by default, rendered only with marks, intro line, ScrollArea `max-h-72`, «Quitar marca» per row with the live announcement and no toast.
- `ProductsTab`: `taken` now includes `ungroupedKeys(marks)`, so marked descriptions leave the caption count and the send dialog; the list sits after «Mis productos».

## Task Commits

1. **Task 1 RED: failing tests for rename, reject, member drop and marks** - `ddb6ce9` (test)
2. **Task 1 GREEN: undoable queue reducers and «No agrupar» marks** - `4f2f980` (feat)
3. **Task 2: editable names, Rechazar, Ban button and the «No agrupar» list** - `31c912d` (feat)

**Plan metadata:** committed after this file (docs: complete plan).

`commits: 3` is `git rev-list --count 946fdc5..HEAD` measured before this SUMMARY commit. As in plans 04-11 and 04-12, the per-plan ledger file in the shared git directory was not written from this worktree, so the base is the spawn-time SHA from the branch check.

## TDD Gate Compliance

Task 1 was `tdd="true"` in an `execute` plan.

- **RED:** `ddb6ce9` `test(04-13)`. Run: 38 failed, 204 passed in the four target files. Semantic assessment: every failure is `TypeError: ... is not a function` for the ten symbols that did not exist yet, a missing-symbol failure and not an assertion on behavior. `tdd_mode` was not enabled and `check tdd-red-evidence` was not run, so this RED is weaker than the reference asks for (same limitation as plans 04-11 and 04-12).
- **GREEN:** `4f2f980` `feat(04-13)`: 592 tests in `src/domain/llm`, `src/domain/settings` and `src/stores` pass; typecheck and lint clean.
- **REFACTOR:** none.
- Task 2 is `type="auto"` (not TDD); its tests were written with the code and committed in `31c912d`.

## Files Created/Modified

- `src/domain/llm/suggestions.ts` - review reducers, `RemovedSuggestion`, `DroppedMember`
- `src/domain/settings/products.ts` - `markUngrouped`, `unmarkUngrouped`, `ungroupedKeys`
- `src/stores/suggestionsStore.ts`, `src/stores/settingsStore.ts` - matching actions
- `src/features/products/ReviewQueue.tsx` - name Input, Rechazar, Ban button, focus and undo handling
- `src/features/products/UngroupedList.tsx` - new «No agrupar» section
- `src/features/products/ProductsTab.tsx` - marks in `taken`, list placement
- `src/features/products/IconAction.tsx` - optional `describedBy`
- `src/lib/copy/es.ts`, `messages.ts` - `queue.nameAria/reject/ungroup/undo/ungroupLimit`, `ungrouped.*`, `rejectedToast`, `rejectedAnnouncement`, `rejectSuggestionAria`, `ungroupedToast`, `ungroupedTrigger`, `unmarkAria`
- `tests/support/reviewQueue.ts` - helpers to find cards by the value of their name Input
- Tests: `suggestions.test.ts`, `products.test.ts`, `suggestionsStore.test.ts`, `settingsStore.test.ts`, `ReviewQueue.test.tsx`, `messages.test.ts`; `ProductsTab.test.tsx` adjusted to the Input

## Decisions Made

See `key-decisions`. Beyond them: the commit of a name validates against the accepted products at once (blur included), so a duplicate or reserved name is flagged without waiting for «Aceptar»; and «Rechazar» stores the typed name first so the toast and the undo carry the name the user saw.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Behavior change] Existing tests followed the heading-to-Input replacement**
- **Found during:** Task 2 (full `src/features` run)
- **Issue:** 15 existing assertions looked for the card name as an `h3` (`heading level 3`). The plan replaces the heading with an Input, so none exists any more. One E4 case seeded a 61-character name and expected a "too long" refusal; now the commit cuts it to 60 first, so such a card is accepted with 60 characters (a 61-character name cannot occur through the UI: `maxLength` is 60, the contract and the stored schema cap it at 60).
- **Fix:** the `ProductsTab` and `ReviewQueue` tests find cards through `tests/support/reviewQueue.ts` (value of the name Input); the 61-character case became "never accepts a product with more than 60 characters". No assertion about what is sent, stored or accepted was weakened.
- **Files modified:** `src/features/products/ProductsTab.test.tsx`, `src/features/products/ReviewQueue.test.tsx`
- **Committed in:** `31c912d`

**2. [Rule 3 - Blocking, small addition] `IconAction` `describedBy` and `tests/support/reviewQueue.ts`**
- The plan asks for `aria-describedby` on the Ban button; `IconAction` had no such prop. The test helper file is new and not in the plan's file list.
- **Committed in:** `31c912d`

---

**Total deviations:** 2 (1 behavior-following test update, 1 small blocking addition). **Impact on plan:** none on the specified behavior.

## Authentication Gates

None.

## Issues Encountered

- `pnpm lint` reports one warning, pre-existing and untouched: `src/lib/client/navigation.ts` line 6, "Unused eslint-disable directive".
- The plan-commit ledger file could not be written in the shared git directory (see Task Commits).

## Verification

- `pnpm verify` (eslint, `next typegen && tsc --noEmit`, `vitest run`, `next build`): exit 0. Vitest: 86 files passed, 6 skipped; 2377 tests passed, 75 skipped.
- Task 1 acceptance: `export function restoreMember` 1 match in `suggestions.ts`, `export function markUngrouped` 1 match in `products.ts`; `vitest run` of both test files exit 0.
- Task 2 acceptance: `No agrupar esta descripción` 1 match and `Quitar marca` 1 match in `es.ts`, `ungroupedKeys` 2 matches in `ProductsTab.tsx`, `maxLength={60}` 1 match in `ReviewQueue.tsx`, `dangerouslySetInnerHTML` 0 matches in `src/features/products`; `pnpm verify` exit 0.
- Mutation check: removing `ungroupedKeys` from `taken` in `ProductsTab` makes 3 tests fail, so the tests depend on it.
- CLAUDE.md: no `any`, `@ts-ignore`, `@ts-nocheck`, non-null `!` or unverified `as` in the new code (toast options in tests are parsed with zod).
- Not run: Playwright e2e and any real-browser check (wrapping of long descriptions, the 100+ marks scroll, 640px layout, real focus after a click). Nothing called DeepSeek.

## Known Stubs

None.

## Threat Flags

None. T-04-30 (a mark or restore that breaks the stored schemas) is mitigated: every reducer refuses with the same object instead of producing an invalid value, the 5,001st mark is refused with a toast, and tests parse every result with the schemas. T-04-31 (stored XSS): names and descriptions are rendered as React text only; no `dangerouslySetInnerHTML` in `src/features/products`. T-04-SC: nothing installed.

## Items that need a decision

1. **Ban on a description that already belongs to an accepted product.** The plan does not say what happens when `markUngrouped` answers «taken». I show the existing members-taken text («Algunas descripciones de esta sugerencia ya están en otro producto. Revisa «Mis productos».») on the card and change nothing. Alternatives: (A) keep this; (B) remove the stale member from the card without a mark; (C) a dedicated message. I recommend A.
2. **Validation on blur.** Leaving a name field validates it at once, so a duplicate or reserved name is flagged on blur. In a real browser the new error line shifts the buttons down between mouse down and mouse up on «Aceptar», so that first click may be lost (the second shows the same error). Alternative: validate only on Enter and on «Aceptar», storing on blur silently. I kept the plan's text («on commit and on Aceptar»); say if you prefer the quiet blur.
3. **Empty names are stored.** Clearing the field and pressing Enter stores an empty name in the pending queue (the stored schema allows it for editing) together with the error. It survives a reload as an empty Input with the error gone until the next commit or «Aceptar». Alternative: do not store an empty name and revert the field.
4. **Identical live announcements.** «Marca quitada. La descripción se enviará…» is the same text every time, so a screen reader announces the second removal in a row only if the live region text changes in between. Fixing it needs a small toggling trick in the shared announcement region; not done.
5. **Ban has no live announcement.** The plan lists none for «No agrupar»; the toast (sonner live region) carries it. Say if you want a polite announcement like Rechazar's.
6. **Focus after «Quitar marca».** The plan does not specify it: focus goes to the next row's «Quitar marca» (or the previous one), and to the tab heading when the last mark is gone.
7. **Carry-over from 04-11 and 04-12:** `ProductsTab` still builds the run with `buildGroupRun(free, [])`, so accepted-product names do not travel as context (D-04). Not touched here. The «Iniciar sesión» link decision from 04-12 is also still open.

## Next Phase Readiness

- Plans 04-14 (Unir) and 04-16 (Separar) can reuse `removeSuggestion`/`restoreSuggestion`/`dropMember`/`restoreMember` and the focus/toast pattern of `ReviewQueue`; 04-17 (bulk reject) can call `rejectSuggestion` per card.
- The human-judgment item D6 (scroll area with 100+ marks, wrapping, 640px layout) goes to the held-out UI-state check of Plan 04-21.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*

## Self-Check: PASSED

Created files exist (2 of 2): `src/features/products/UngroupedList.tsx`, `tests/support/reviewQueue.ts`. Commits are ancestors of HEAD: `ddb6ce9`, `4f2f980`, `31c912d`. Acceptance greps of both tasks and `pnpm verify` re-run green (see Verification).
