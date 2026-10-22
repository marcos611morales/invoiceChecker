---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 17
subsystem: llm-product-grouping
tags: [review-queue, bulk-actions, filters, search, pagination, zustand, vitest, base-ui]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "Card actions and queue reducers (04-13, 04-14, 04-16), acceptProduct / addMembersToProduct (04-05, 04-14), SendDialog AlertDialog pattern (04-09)"
provides:
  - "queueView.ts: QueueFilter, orderQueue, stableOrder, filterQueue, filterCounts, BulkAcceptResult, acceptMany (pure)"
  - "suggestionsStore.rejectMany / restoreMany (one write, exact indexes on undo); settingsStore.acceptMany (one write of products)"
  - "QueueToolbar (search, single-choice filter toggles with counts, bulk bar), BulkAcceptDialog, selection, 50-per-page «Mostrar más» in ReviewQueue"
  - "messages: filterToggleLabel, selectedCount, showMoreLabel, selectSuggestionAria, noMatchText, bulkAcceptTitle, bulkAcceptBody, bulkAcceptConfirm, bulkAcceptedToast, bulkRejectedToast"
affects: [04-18 category suggestions (reuses the same confirmation pattern), 04-21 live check]

plan_head_before: 645e6efea2af0f5a40e1dc3961efca57a077d0b7
plan_head_after: 91dc306cd344eda59f1b946c05d6bd94001ae446

actuals:
  tokens: 62000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "The list order is a frozen id list in component state: cards that land are appended below the last one (state adjusted while rendering), ids of departed cards stay so an undo returns a card to its place, and only a filter, search or «Mostrar más» change sorts again"
    - "Cards that must stay on the page beyond the 50 shown (target of a join, card split off the 50th) are pinned until the next re-sort"
    - "«Aceptar todas las visibles» fixes the card ids when the dialog opens, so the count the user read is the set that is applied even if a batch lands meanwhile"
    - "Bulk accept follows the single-card rules per card: an «Agregar a» card only adds its still-checked members and keeps the unchecked ones"

key-files:
  created:
    - src/domain/llm/queueView.ts
    - src/domain/llm/queueView.test.ts
    - src/features/products/QueueToolbar.tsx
    - src/features/products/BulkAcceptDialog.tsx
    - src/features/products/QueueBulk.test.tsx
  modified:
    - src/stores/suggestionsStore.ts
    - src/stores/suggestionsStore.test.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/features/products/ReviewQueue.tsx
    - src/features/products/ReviewQueue.test.tsx
    - src/features/products/ProductsTab.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - tests/support/reviewQueue.ts

key-decisions:
  - "«Seleccionar visibles» selects every card that matches the filter and the search, shown or not, the same set «Aceptar todas las visibles» counts (UI-SPEC defines «visibles» once)"
  - "An «Agregar a» card in a bulk accept adds only its checked members, as a single accept does; the plan's interface said «all their members», which would have added descriptions the user unchecked"
  - "filterQueue takes an optional fourth argument (the name a card is shown with) so an «Agregar a» card is found by its product's name"
  - "Accepted cards leave the queue through rejectMany (the same one-write removal); no extra store action"

patterns-established:
  - "Toolbar components hold no state and apply nothing; every effect on the queue or the settings is an explicit handler in ReviewQueue"

requirements-completed: [LLM-04]

coverage:
  - id: D1
    description: "Pure queue order (Agregar a, groups by members and lines, singletons by lines and name), stable insertion, filters, search and counts"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/llm/queueView.test.ts#orderQueue, stableOrder, filterQueue and filterCounts"
        status: pass
    human_judgment: false
  - id: D2
    description: "acceptMany applies cards in order, each against the settings the previous one left; a refused card (duplicate name, reserved, empty, limit, members taken, product gone) changes nothing; one write"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/llm/queueView.test.ts#acceptMany (D-20, D-35)"
        status: pass
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore acceptMany (D-20, D-35)"
        status: pass
    human_judgment: false
  - id: D3
    description: "rejectMany / restoreMany: one write and exact positions on undo"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/stores/suggestionsStore.test.ts#rejectMany and restoreMany in the queue store (D-20)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Search, filter toggles with counts, empty texts, 50 per page with «Mostrar más», split-off card kept on the page, selection (mixed select-all), Aceptar/Rechazar seleccionadas with toasts and Deshacer, «Aceptar todas las visibles» dialog with the exact count of every matching card, initial focus on «Volver a revisar»"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/QueueBulk.test.tsx"
        status: pass
    human_judgment: true
    rationale: "Toolbar wrapping on narrow widths, the 44px targets, the look of the mixed checkbox (a check mark with the primary fill, not a dash) and the dialog width are CSS that jsdom cannot assert; left to the phase UAT"
  - id: D5
    description: "Copy for the toolbar, dialog and toasts"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#Search, filters and bulk actions copy (Plan 04-17)"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-10-22
status: complete
---

# Phase 4 Plan 17: Queue order, filters, «Mostrar más» and bulk accept or reject Summary

**A 200-card queue is now reviewable: a stable order, search, four filters with counts, 50 cards per page, selection, «Aceptar/Rechazar seleccionadas» and a confirmed «Aceptar todas las visibles» that states the exact count, all pure-function backed and never applying anything without an explicit press.**

## Performance

- **Duration:** about 70 min of work across two sessions (a provider rate limit interrupted the first)
- **Started:** 2026-10-21
- **Completed:** 2026-10-22T17:45:59Z
- **Tasks:** 2 (Task 1 as RED then GREEN)
- **Files modified:** 16 (5 created, 11 modified)

## Accomplishments

- `queueView.ts` (pure, relative imports only): `orderQueue`, `stableOrder`, `filterQueue`, `filterCounts`, `acceptMany`; every refusal reason of the single-card rules is reported and leaves the settings untouched.
- Stores: `rejectMany` / `restoreMany` (one write each, cards return to their old index) and `settingsStore.acceptMany` (one write of `products`).
- `QueueToolbar`: search (sr-only label, placeholder), single-choice `ToggleGroup` «Filtrar sugerencias» (pressing the pressed item is ignored), bulk bar with the mixed «Seleccionar visibles» checkbox (`aria-checked="mixed"`), `aria-disabled` bulk buttons.
- `BulkAcceptDialog`: «¿Aceptar {n} sugerencias?», body with the new-product and add-to-product parts (a zero part omitted), «Volver a revisar» with the initial focus, accent confirm.
- `ReviewQueue`: frozen order with cards that land appended below, 50 per page, pinned cards (join target, split-off card) so 04-16's focus request is never dropped, selection pruned on filter or search change, empty texts, names typed but not blurred are stored before a bulk action.

## Task Commits

1. **Task 1 RED: failing tests for order, filters and bulk accept** - `c145709` (test)
2. **Task 1 GREEN: pure queue view and store actions** - `2c692a0` (feat)
3. **Task 2: toolbar, dialog, pagination, selection and bulk actions** - `91dc306` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Gate Compliance

- **RED:** `c145709` adds 33 domain tests, 4 queue-store tests and 3 settings-store tests plus signature stubs that return empty values (39 tests failed, all new). RED evidence was validated with `gsd-tools check tdd-red-evidence` on a `tap-flat` report of the single target test `queueView.test.ts > stableOrder (cards that land during a run) > keeps [B, A] when A and B were shown, and appends a new card C after them even if C sorts first`: verdict `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the target ran and failed at `expected '' to be 'B,A,C'` because the stub returns `[]`, i.e. for the planned reason (behavior absent), not a syntax, import or fixture fault. The first attempt used a multi-line array diff, which the classifier rejected as `invalid_record` (non-TAP data); the assertion was rewritten to compare a joined string so the report is single-line.
- **GREEN:** `2c692a0` makes all of them pass (404 tests in `src/domain/llm` and `src/stores`). One expectation of my own RED test (the order after restoring a card past a card that landed meanwhile) was wrong and was corrected in the GREEN commit.
- **REFACTOR:** none needed.

## Decisions Made

See `key-decisions`. In short: «visibles» is one set (filter and search, shown or not) for the select-all checkbox and for the dialog; bulk accept respects unchecked members of «Agregar a» cards; the search also covers the shown name of an «Agregar a» card.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Bulk accept respects unchecked members of «Agregar a» cards**
- **Found during:** Task 2 (wiring `acceptMany`)
- **Issue:** The plan's interface sends «Agregar a» cards through `addMembersToProduct` «with all their members». A card whose member the user unchecked would then add that description to the product, applying something the user excluded (LLM-04: nothing applies without the user's selection).
- **Fix:** `ReviewQueue` passes `acceptMany` the card with only its checked members (the single-card rule) and, after success, drops those members from the card (a partly accepted card stays with the unchecked ones; a card with nothing checked is refused with «Elige al menos una descripción»). The pure `acceptMany` itself is unchanged.
- **Files modified:** src/features/products/ReviewQueue.tsx
- **Committed in:** 91dc306

**2. [Rule 2 - Missing critical functionality] The dialog applies the cards counted when it opened**
- **Found during:** Task 2
- **Issue:** A batch landing while the dialog is open would change the visible set, so the confirm could apply more cards than the title stated.
- **Fix:** the ids are fixed when the dialog opens; cards that land afterwards are not accepted (tested).
- **Files modified:** src/features/products/ReviewQueue.tsx
- **Committed in:** 91dc306

**3. [Rule 3 - Blocking] Existing tests assumed arrival order and counted every checkbox**
- **Found during:** Task 2
- **Issue:** the new order (singletons by lines, then name) and the new card checkbox broke 19 existing tests in ReviewQueue.test.tsx and ProductsTab.test.tsx.
- **Fix:** the fixture gives the coffee a second loaded line so it still sorts before the sugar; the refusal tests use a two-member first card; a `memberCheckboxes` helper counts only «Elegir «…»» checkboxes. No assertion about behavior was weakened.
- **Files modified:** src/features/products/ReviewQueue.test.tsx, src/features/products/ProductsTab.test.tsx, tests/support/reviewQueue.ts
- **Committed in:** 91dc306

**4. [Plan addition] `filterQueue` has an optional fourth parameter** (the name a card is shown with), see key-decisions. Compatible with the plan's signature.

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking) and 1 additive signature parameter
**Impact on plan:** no scope creep; the first two protect against applying something the user did not choose. The new tests live in `QueueBulk.test.tsx` instead of `ReviewQueue.test.tsx` to keep that 1,500-line file from growing; `ReviewQueue.test.tsx` was still modified for the fixture.

## Items that need a decision

Choices the plan and UI-SPEC do not fix. I took the smallest one; the user can overrule (CLAUDE.md section 1):

1. **«Seleccionar visibles» selects cards that are not shown yet.** With 200 cards and 50 shown it selects all 200 (the count says «200 seleccionadas»), and «Aceptar seleccionadas» then applies them without a dialog. The alternative is to select only the rendered cards, which makes the checkbox differ from «Aceptar todas las visibles». Recommendation: keep it, since the count is always shown and «visibles» is defined once in the UI-SPEC.
2. **Toast when cards added descriptions to existing products.** D-35 only fixes «{n} productos creados» and «; {k} quedaron en la cola». I wrote «Descripciones sumadas a {q} productos» (joined with «y» when products were also created) and «0 productos creados» when nothing was accepted. Singular forms («1 producto creado», «1 quedó en la cola») are my grammatical variants.
3. **«q» in the dialog body counts cards, not distinct products.** Two «Agregar a» cards for the same product count twice (as the plan says «computed from the visible cards»).
4. **«k quedaron en la cola» counts refused cards only**, not an «Agregar a» card that was partly accepted and keeps its unchecked members.
5. **No polite announcement for the bulk actions** (the UI-SPEC lists announcements for single accept and reject only); the toast is the feedback. Adding one needs new copy.
6. **Order inside «Agregar a» cards** is arrival order (the UI-SPEC does not sort them).
7. **The mixed state of «Seleccionar visibles» reuses the shared Checkbox**, which draws a check mark; ARIA reports `mixed`, but a dash would need a change to `components/ui/checkbox.tsx`.

## Issues Encountered

- `pnpm verify` runs lint, typecheck, vitest and then `next build`. Lint, typecheck (`pnpm typecheck`, `pnpm eslint .`) and `pnpm vitest run` pass (2583 passed, 75 skipped, pre-existing). The `next build` step now stops with Next.js's own «SecurityFatalError: your version of Next.js is affected by a known security vulnerability» and a request to run `next upgrade`. This is a check against the npm advisory registry, unrelated to this plan's changes (build succeeded at 04-16 on 2026-10-21); I did not upgrade anything. It needs a separate decision on upgrading Next.js.
- The pre-existing eslint warning in `src/lib/client/navigation.ts` (unused disable directive) is out of scope and untouched.
- The coordinator's resume message arrived after a provider rate limit; Task 2 work that was uncommitted at that point was kept as is and completed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The signature stubs of the RED commit were replaced in the GREEN commit.

## Threat Flags

None. No new endpoint, auth path or file access. T-04-35 is mitigated: `acceptMany` runs every card through the single-card reducers against the running result, and tests assert the result keeps unique names and members and that refused cards stay in a queue `pendingQueueSchema` accepts. Nothing was installed (T-04-SC).

## Next Phase Readiness

- The product queue is complete for LLM-04: card actions, order, filters, pagination, bulk accept and reject. The category table (04-18) can reuse `BulkAcceptDialog`'s pattern (title with the exact count, dismiss with the initial focus).
- Visual check pending for the toolbar wrap, 44px targets and the mixed checkbox look (D4).

## Self-Check: PASSED

- Files exist: `queueView.ts`, `queueView.test.ts`, `QueueToolbar.tsx`, `BulkAcceptDialog.tsx`, `QueueBulk.test.tsx` and this SUMMARY; commits `c145709`, `2c692a0`, `91dc306` are ancestors of HEAD.
- Acceptance: `grep -c "export function acceptMany"` and `"export function stableOrder"` in queueView.ts print 1; no `from "@/` in queueView.ts; `grep -c "Aceptar todas las visibles"` and `"Volver a revisar"` in es.ts print 2 and 1; `grep -c "aria-checked"` in QueueToolbar.tsx prints 1 (a comment; the attribute itself is rendered by Base UI and asserted as `mixed` in QueueBulk.test.tsx); `pnpm exec vitest run src/domain/llm/queueView.test.ts` exits 0.
- `pnpm typecheck`, `pnpm eslint .` (0 errors, 1 pre-existing warning) and `pnpm vitest run` pass; `pnpm verify` fails only at the `next build` security check described above.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-22*
