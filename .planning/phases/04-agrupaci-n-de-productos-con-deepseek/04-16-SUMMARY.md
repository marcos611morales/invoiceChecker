---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 16
subsystem: llm-product-grouping
tags: [review-queue, merge, split, undo, zustand, vitest, cmdk, base-ui]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "ProductPicker with groups (04-07), queue reducers dropMember/removeSuggestion (04-13), Agregar a cards with member checkboxes (04-14), PendingQueue and pendingQueueSchema (04-11)"
provides:
  - "QueueUndo, mergeSuggestions, turnIntoAddCard, splitSuggestion, undoQueueChange: pure, schema-safe reducers with exact undo"
  - "Store actions mergeSuggestions, turnIntoAddCard, splitSuggestion (new id sug_ + uuid) and undoQueueChange, each persisted"
  - "Review cards: Unir con... (picker with Otras sugerencias and Productos que ya tienes), Separar en producto nuevo, member checkboxes on cards with several members, count caption"
  - "messages: memberCountCaption, mergeAria, splitAria, mergedToast, splitToast; es.products.queue merge/split/otherSuggestions/ownProducts/merged"
affects: [04-17 and later review-queue plans (bulk bar, filters, Mostrar mas), 04-21 live check]

plan_head_before: 2282721f9ac833b916b82c9e546d58f499c5c582
plan_head_after: 30c135103d9bf2460e3245b1451f0562ad15d409

actuals:
  tokens: 13400
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A join, a turn into Agregar a and a split all return a QueueUndo (cards as they were, with indexes, plus the id of the card created); one undoQueueChange reverses any of them"
    - "Undo never loses a pending suggestion: members that a later batch added to a card of the change are kept, members now pending elsewhere are left out, and an undo with no card of the change left in the queue is a no-op"
    - "Focus after a join or split is requested through a ref and applied in an effect on the cards prop, because the target element only exists after the render"

key-files:
  created: []
  modified:
    - src/domain/llm/suggestions.ts
    - src/domain/llm/suggestions.test.ts
    - src/stores/suggestionsStore.ts
    - src/stores/suggestionsStore.test.ts
    - src/features/products/ReviewQueue.tsx
    - src/features/products/ReviewQueue.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "The new card of a split is named with cutText(first checked description, LLM_LIMITS.productName), as the plan says; a description over 60 characters therefore ends in an ellipsis, like the names sent as DeepSeek context"
  - "Members of the new card keep the order the original card had (not the order of the keys); the first checked member in that order names it"
  - "undoQueueChange returns the same queue when no card of the change is left (the merged card was accepted or rejected meanwhile), so a late Deshacer cannot resurrect cards whose members now belong to a product"
  - "Unir con... is offered only on cards of a new product; Agregar a cards keep Aceptar, Rechazar and Separar (UI-SPEC line 263)"
  - "Separar is aria-disabled (still focusable), not disabled, and its handler re-checks the rule"

patterns-established:
  - "Regular cards track the checked members in a per-card set (default unchecked); Agregar a cards keep the unchecked set (default checked); isChecked(card, key) hides the difference"

requirements-completed: [LLM-04]

coverage:
  - id: D1
    description: "Merge and split reducers (mergeSuggestions, turnIntoAddCard, splitSuggestion, undoQueueChange) are pure, never mutate their input, always produce a queue pendingQueueSchema accepts, and undo restores the original queue exactly"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#mergeSuggestions, turnIntoAddCard, splitSuggestion and undoQueueChange (D-19)"
        status: pass
      - kind: unit
        ref: "src/stores/suggestionsStore.test.ts#join, turn into «Agregar a» and split in the queue store (D-19)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unir con... opens a searchable picker with Otras sugerencias and Productos que ya tienes; a card pick moves the members and removes the card, a product pick turns the card into an Agregar a card; nothing reaches the settings; toast Sugerencias unidas with Deshacer for 6 s"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#«Unir con…» (D-19, D-21)"
        status: pass
    human_judgment: true
    rationale: "Popover width (320px, trigger width under 640px), list height (288px) and the look of the footer buttons wrapping at 44px are CSS that jsdom cannot assert; the visual check is left to the phase UAT"
  - id: D3
    description: "Member checkboxes (unchecked, labelled Elegir «...»), Separar en producto nuevo enabled only while some but not all members are checked, new card right below named after the first checked description with focus on its name, toast Se separo ... with Deshacer; one-member cards have no checkbox, count or Separar"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#«Separar en producto nuevo» and the member checkboxes (D-19, E4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-card accessible names (Unir la sugerencia «X» con..., Separar en producto nuevo desde «X») and the count caption copy"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#names the card in «Unir con…» and «Separar en producto nuevo»"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 16: Unir con... and Separar en producto nuevo Summary

**Pure merge, turn-into-Agregar-a and split reducers with exact undo (late-arriving members preserved), wired to «Unir con…» (ProductPicker with two groups) and «Separar en producto nuevo» (member checkboxes, focus on the new name) on the review cards.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-21T23:04:00Z
- **Completed:** 2026-10-21T23:26:15Z
- **Tasks:** 2 (Task 1 as RED then GREEN)
- **Files modified:** 9 (0 created)

## Accomplishments

- `mergeSuggestions`, `turnIntoAddCard`, `splitSuggestion`, `undoQueueChange` and `QueueUndo` in `suggestions.ts`; every result passes `pendingQueueSchema`, frozen inputs are never mutated, undo values share nothing with the queue.
- Store actions persist each change (one write) and return the `QueueUndo`; a refused change returns null and writes nothing.
- Cards with several members get a checkbox per row (unchecked) and a «{n} descripciones» caption; «Unir con…» and «Separar en producto nuevo» join the footer; singletons show none of them (E4).
- «Agregar a» cards can now be split too (their checked members become a new product card; the original keeps its target).
- Toasts «Sugerencias unidas» and «Se separó «{nombre}» en un producto nuevo» stay 6000 ms with «Deshacer»; per-card aria-labels name the card.

## Task Commits

1. **Task 1 RED: failing reducer and store tests** - `62bcd38` (test)
2. **Task 1 GREEN: reducers, store actions** - `306c479` (feat)
3. **Task 2: UI, copy and UI tests** - `30c1351` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Gate Compliance

- **RED:** `62bcd38` adds 25 tests plus signature stubs returning null / the same queue. RED evidence was validated with `gsd-tools check tdd-red-evidence` on a `tap-flat` report of the single target test `suggestions.test.ts > mergeSuggestions, turnIntoAddCard, splitSuggestion and undoQueueChange (D-19) > mergeSuggestions > appends the members of A to B in order, removes A, and keeps B's id, name and target`: verdict `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the target ran and failed at `expected a merge` because the stub returns null, i.e. for the planned reason (behavior absent), not for a syntax, import or fixture fault. 20 tests failed in the full run, all new ones. (A whole-file TAP run was rejected by the classifier as `invalid_record` because multi-line assertion diffs are non-TAP data; the single-test rerun is the record used.)
- **GREEN:** `306c479` makes them pass (363 tests in `src/domain/llm` and `src/stores`).
- **REFACTOR:** none needed.

## Files Created/Modified

- `src/domain/llm/suggestions.ts` - the four reducers and `QueueUndo`
- `src/stores/suggestionsStore.ts` - four actions (split generates `sug_` + `crypto.randomUUID()`)
- `src/features/products/ReviewQueue.tsx` - checkboxes, count caption, `Unir con…` (ProductPicker), `Separar`, focus effect, undo toasts
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - new copy and message functions
- `*.test.ts(x)` - reducer, store, copy and UI tests
- `src/features/products/ProductPicker.tsx` is listed in the plan but needed no change: it already takes several groups, shows the empty text and has the 320px / 288px sizing.

## Decisions Made

See `key-decisions`. In short: names cut with `cutText` (ellipsis over 60), card order wins over key order, a late undo with nothing of the change left is a no-op, and «Unir con…» is not offered on «Agregar a» cards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Undo keeps members that a later batch added**
- **Found during:** Task 1 (designing `undoQueueChange`)
- **Issue:** Runs are multi-batch (D-33): `appendSuggestionMembers` can add a member to a card while the 6 s «Deshacer» is open. Replacing that card by its saved copy would silently delete a pending suggestion (T-04-34 class: loss of pending work).
- **Fix:** members of the current cards of the change that are not in any saved card stay (with the card of the same id, or with the first restored card when they sat in the created card). Covered by a test.
- **Files modified:** src/domain/llm/suggestions.ts, src/domain/llm/suggestions.test.ts
- **Committed in:** 306c479

**2. [Rule 2 - Missing critical functionality] A late Deshacer is refused when nothing of the change is left**
- **Found during:** Task 1
- **Issue:** merge A into B, accept B, press «Deshacer» would put A and B back with members already in a product (the accept would then fail with «members-taken»).
- **Fix:** `undoQueueChange` returns the same queue when no card of the change is in the queue. Covered by a test.
- **Files modified:** src/domain/llm/suggestions.ts, src/domain/llm/suggestions.test.ts
- **Committed in:** 306c479

**3. [Rule 2 - Missing critical functionality] Typed name stored before a join or split**
- **Found during:** Task 2
- **Issue:** a name typed but not yet committed (no Enter, no blur) would be lost by «Deshacer» of a join.
- **Fix:** `commitName` runs first in `mergeWith` and `splitOff`, as accept and reject already do. Covered by tests.
- **Files modified:** src/features/products/ReviewQueue.tsx
- **Committed in:** 30c1351

---

**Total deviations:** 3 auto-fixed (3 missing critical)
**Impact on plan:** all three protect pending work from silent loss; no scope creep.

## Items that need a decision

These are choices the plan and UI-SPEC do not fix. I took the smallest one and list them so the user can overrule (CLAUDE.md section 1):

1. **Name of a split card over 60 characters.** The plan says `cutText` to 60, which ends in «…»; UI-SPEC says «cut to 60». If a plain cut without the ellipsis is wanted, it is one line in `splitSuggestion`.
2. **A pending card with an empty name in the «Unir con…» list** is shown by its first description (a blank row would be unusable). New visible behavior not in the UI-SPEC.
3. **No polite announcement after a join or split** (only the toast and the focus move). The UI-SPEC lists announcements for accept and reject only; adding one needs new copy.
4. **«Separar» is hidden on an «Agregar a» card with one member** (it could never be enabled), consistent with E4.
5. **Button labels use the stored card name**, so a name typed but not yet committed is not in the aria-label until Enter or blur (same as «Aceptar» and «Rechazar»).

## Issues Encountered

None blocking. The pre-existing eslint warning in `src/lib/client/navigation.ts` (unused disable directive) is out of scope and untouched. `pnpm verify` (lint, typecheck, vitest, build) passes: 2494 tests passed, 75 skipped (pre-existing), build succeeded.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The signature stubs of the RED commit were replaced in the GREEN commit.

## Threat Flags

None. No new endpoint, auth path or file access; the reducers rewrite the locally stored queue and keep `pendingQueueSchema` valid (T-04-34 mitigated by tests that parse every result). Nothing was installed (T-04-SC).

## Next Phase Readiness

- The card actions of LLM-04 (aceptar, renombrar, separar, unir, rechazar) are complete; bulk bar, filters and «Mostrar más» can build on `ReviewQueue`. The focus effect looks the target up in the rendered cards, so pagination must keep a split-off card (placed right below its origin) within the shown cards or the focus request is dropped.
- Visual check pending for the picker size and the footer wrapping at 44px (D2 above).

## Self-Check: PASSED

- Files exist: all nine modified files and this SUMMARY; commits `62bcd38`, `306c479`, `30c1351` are ancestors of HEAD.
- Acceptance: `grep -c "export function splitSuggestion"` and `"export function undoQueueChange"` in suggestions.ts print 1; `grep -c "Separar en producto nuevo"` and `"Otras sugerencias"` in es.ts print 1; `grep -c mergeSuggestions` in ReviewQueue.tsx prints 1; `pnpm verify` exits 0.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*
