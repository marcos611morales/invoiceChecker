---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 14
subsystem: llm-product-grouping
tags: [deepseek, zustand, react, vitest, context-names, review-queue]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "buildGroupRun with existing/targets (04-01), server mapping of e (04-02), pending queue and undoable reducers (04-11, 04-13), send dialog and run (04-06, 04-12)"
provides:
  - "Accepted-product names sent as context p1..pK on every grouping request (first 400 by name, es collator)"
  - "ContextTarget type and GroupBatch.targets as Map<string, ContextTarget>"
  - "toProductSuggestions resolves a product target to the card target and merges same-product groups"
  - "addMembersToProduct reducer (domain) and store action"
  - "Send dialog context line and the Productos existentes group, read from the request bodies"
  - "Agregar a card with checked-by-default member checkboxes, Aceptar/Rechazar and its refusals"
affects: [04-15 context names of earlier batches (adds the pending ContextTarget kind), 04-16 and later review-queue plans (Separar, Unir con)]

plan_head_before: 5bd88834eae11b0c8faf0d69d4256c6441a18bd0
plan_head_after: 021b54f8c8719b0b68dbbcd14ee910e433993c5e

actuals:
  tokens: 17600
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Type-only import cycle candidates.ts <-> suggestions.ts (import type both ways), no runtime cycle"
    - "Dialog context rows rendered from batch.body.existing, the same objects the client serializes"
    - "Per-card refusals kept in a separate Map (addErrors) so the product-limit text is not reused for the member limit"

key-files:
  created: []
  modified:
    - src/domain/llm/candidates.ts
    - src/domain/llm/suggestions.ts
    - src/domain/settings/products.ts
    - src/stores/settingsStore.ts
    - src/features/products/ProductsTab.tsx
    - src/features/products/SendDialog.tsx
    - src/features/products/ReviewQueue.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts

key-decisions:
  - "Context names are the accepted products only (D-33): ProductsTab maps settings.products and never reads the pending queue"
  - "A group placed with an accepted product merges with other groups of the same answer that point at the same product, at the position of the first, keeping the first group's name"
  - "addMembersToProduct refuses a member already in the target product itself as members-taken (adding it would break the stored validation)"
  - "Dialog counts context names from the distinct names in the bodies, so the line and the list can never differ from what is sent"

patterns-established:
  - "Agregar a card: card.target !== null renders the variant; the title is the stored name of the product, falling back to the proposed name when the product is gone"
  - "Unchecked members are tracked (all start checked, a late member is checked too); Aceptar drops the added members one by one with the existing dropMember, so the card leaves when none is left"

requirements-completed: [LLM-01, LLM-04, LLM-06]

coverage:
  - id: D1
    description: "Every Agrupar productos request carries the accepted product names as p1..pK, at most 400, first by name with the es collator, and never an internal product id"
    requirement: LLM-01
    verification:
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#buildGroupRun context: the accepted products (D-04, D-21, D-33)"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#sends the accepted names on the request, the very ones the dialog lists, and never an id"
        status: pass
    human_judgment: false
  - id: D2
    description: "Names of cards still pending from earlier runs are never sent as context and those cards are unchanged after a new run"
    requirement: LLM-01
    verification:
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#never sends the name of a card that is still pending from an earlier run, and leaves that card as it was"
        status: pass
      - kind: integration
        ref: "src/features/products/ReviewQueue.test.tsx#never lists the name of a card that is still pending"
        status: pass
    human_judgment: false
  - id: D3
    description: "Send dialog adds the context line and the Productos existentes group from the same bodies that are sent, singular included, absent with no accepted product"
    requirement: LLM-06
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#Context names and Agregar a copy (Plan 04-14, UI-SPEC 198-203, 262, 269)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#the send dialog lists the accepted product names as context (D-04, D-33, LLM-06)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A group DeepSeek places with an accepted product becomes an Agregar a card (title, category caption, note, checked members); two groups of one answer for the same product become one card"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#toProductSuggestions: Agregar a cards (D-21)"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#turns a group that DeepSeek places with an accepted product into an Agregar a card and adds it on Aceptar"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#merges two groups of one answer that point at the same product into one card"
        status: pass
    human_judgment: false
  - id: D5
    description: "Aceptar on an Agregar a card adds the checked members without touching the product's other members or category, keeps unchecked members in the card, and toasts the count"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/settings/products.test.ts#addMembersToProduct (D-21)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#adds the checked members, keeps the other members and the category, and keeps the unchecked one in the card"
        status: pass
    human_judgment: false
  - id: D6
    description: "Refusals of an Agregar a card: product deleted before accepting (card can still be rejected), members taken by another product, nothing chosen"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#explains that the product is gone, changes nothing, and still lets the card be rejected"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/ReviewQueue.test.tsx#refuses members that are already in another product and keeps the card whole"
        status: pass
    human_judgment: false
  - id: D7
    description: "Visual and keyboard feel of the Agregar a card (checkbox hit areas, spacing, focus order, screen-reader reading of the title, note and caption)"
    verification: []
    human_judgment: true
    rationale: "jsdom tests assert roles, names, state and focus target but not layout, touch target size or spoken order; the UI-SPEC accessibility floor needs a person to confirm"

duration: not recorded
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 14: Accepted-product context and the Agregar a card Summary

**Accepted product names travel as p1..pK context on every DeepSeek grouping request, and groups DeepSeek places with an accepted product become «Agregar a «X»» cards whose checked members join that product through a pure `addMembersToProduct` reducer.**

## Performance

- **Duration:** not recorded (the start time was not captured at spawn)
- **Completed:** 2026-10-21T23:00:23Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN; Task 2 auto)
- **Files modified:** 16 (9 source, 7 test)

## Accomplishments

- `buildGroupRun` now sorts the accepted products with the es collator, keeps the first 400 (`LLM_LIMITS.contextNames`) and puts them on every batch body as `p1..pK`, mapped in the browser to `{ kind: "product", productId }` targets. Product ids never appear in a body.
- `toProductSuggestions` turns a product target into the card `target` and merges the groups of one answer that point at the same product into one card (first group's position, members in answer order, none repeated).
- `addMembersToProduct(settings, productId, members)` appends members at the end and keeps id, name, category and the other members. Refusals: `gone`, `no-members`, `members-taken` (any product or a «No agrupar» mark), `limit` (5,000). The result passes `settingsDataSchema`. The store action sets only `products`.
- Send dialog: `contextNamesLine(n)` under the summary and the group «Productos existentes, solo como contexto ({n})», both built from `batch.body.existing`.
- Review queue: a card with a target renders as «Agregar a «{producto}»» with «Categoría: …» or «Sin categoría», the note of UI-SPEC line 262, one row per new member with a checkbox («Elegir «…»», starts checked), «Aceptar» (adds the checked ones, leaves the unchecked in the card, card leaves when none is left, toast «Se agregaron {n} descripciones a «{nombre}»») and «Rechazar».

## Task Commits

1. **Task 1 RED:** `6c4fd9f` (test) - failing tests for context, Agregar a mapping and `addMembersToProduct`
2. **Task 1 GREEN:** `b65c515` (feat) - context on the bodies, target map, merge, reducer and store action
3. **Task 2:** `021b54f` (feat) - dialog lines, Agregar a card, copy and the tests that drive them

**Plan metadata:** the docs commit that adds this SUMMARY (below the task commits in `git log`).

## TDD Gate Compliance (Task 1)

- **RED** (`6c4fd9f`): 15 tests failed on the intended assertions. In `candidates.test.ts` the context order was input order (`Zanahoria` before `Ámbar`, `Producto 449` before `Producto 000`) and the targets were bare ids; in `suggestions.test.ts` the target was not resolved to a product id and groups were not merged; in `products.test.ts` `addMembersToProduct is not a function`. The other 156 tests of the three files passed, so no unrelated or load failure. Semantic assessment: each failing test executed and failed on the planned behavior, not on syntax, import or fixture faults. The machine classifier `check tdd-red-evidence` was not run (the plan is `type: execute`, not `type: tdd`, so plan-level gate enforcement does not apply).
- **GREEN** (`b65c515`): all 402 tests of `src/domain/llm` and `src/domain/settings` pass, 610 with `src/stores`.
- **REFACTOR:** none needed.

## Files Created/Modified

- `src/domain/llm/candidates.ts` - `ContextTarget`, sorted and capped context, product targets
- `src/domain/llm/suggestions.ts` - `toProductSuggestions` resolves and merges product targets
- `src/domain/settings/products.ts` - `addMembersToProduct`, `AddMembersError`
- `src/stores/settingsStore.ts` - `addMembersToProduct` action
- `src/features/products/ProductsTab.tsx` - passes accepted products to `buildGroupRun`
- `src/features/products/SendDialog.tsx` - context line and group
- `src/features/products/ReviewQueue.tsx` - Agregar a variant, checkboxes, `acceptAddTo`
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - the six planned messages plus `membersAddedAnnouncement`, `addMembersErrorText` and the static note and refusals
- Tests: `candidates.test.ts`, `suggestions.test.ts`, `products.test.ts`, `settingsStore.test.ts`, `messages.test.ts`, `ReviewQueue.test.tsx`, `ProductsTab.test.tsx`

## Decisions Made

See `key-decisions` above. The system prompt in `src/lib/server/deepseek.ts` already describes `existing` and `e` (rule 6), so it was not touched; rule 2 and the golden-set exclusion are unchanged. The 120-item batch limit is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in an existing test] Send-dialog test counted the new context row as a description**
- **Found during:** Task 2
- **Issue:** `ReviewQueue.test.tsx` "keeps the product after a reload..." read every list item of the opened dialog; with an accepted product the new context row «Leche entera» is now one more item, as required by the plan.
- **Fix:** the test now reads the rows under each heading (`sectionRows`) and also asserts the context group.
- **Files modified:** `src/features/products/ReviewQueue.test.tsx`
- **Committed in:** `021b54f`

**2. [Rule 3 - Blocking, scope of files] Tests also added in files the plan did not list**
- **Issue:** the round-trip tests (request bodies carry the names, a canned answer with `e` set, the pending-card rule) need the real route harness that only exists in `ProductsTab.test.tsx`; the store action and the new copy needed `settingsStore.test.ts` and `messages.test.ts`.
- **Fix:** tests were added there; no production file outside `files_modified` changed.
- **Files modified:** `src/features/products/ProductsTab.test.tsx`, `src/stores/settingsStore.test.ts`, `src/lib/copy/messages.test.ts`
- **Committed in:** `b65c515`, `021b54f`

---

**Total deviations:** 2 auto-fixed (1 bug in an existing assertion, 1 test-file scope). **Impact:** none on behavior; no scope creep.

## Items that need a decision

CLAUDE.md section 1 asks to confirm anything the plan or UI-SPEC does not define. None of these blocks the plan; each was resolved with the most conservative option and is easy to change.

1. **Copy not in the UI-SPEC** (in `es.ts` under `products.queue.addToErrors`): «Alcanzaste el límite de 5,000 descripciones en tus productos. Quita alguna para agregar más.» (member limit), «Elige al menos una descripción para agregar.» (Aceptar with nothing checked), and the singular forms «Se agregó 1 descripción a «…»» for the toast and the polite announcement. The «gone» text is the plan's own.
2. **«Separar en producto nuevo» is not on the Agregar a card.** UI-SPEC line 410 lists it for this card, but this plan only specifies Aceptar and Rechazar, so it waits for the plan that builds Separar and Unir con.
3. **The `Ban` («No agrupar esta descripción») button stays on the member rows of an Agregar a card** (UI-SPEC says member rows have it). Say so if it should be hidden there.
4. **Title when the product is gone:** the card falls back to the name DeepSeek proposed («Agregar a «Leche»»), because the product name is no longer known. The refusal text is shown on Aceptar, as the plan says, not on render.
5. **Aceptar and Rechazar `aria-label`s** use the product name («Aceptar la sugerencia «Leche entera»»), as the UI-SPEC pattern says. A new-product card pending with the same proposed name would give two buttons with the same name.
6. **A member already in the target product itself** is refused as `members-taken` (same text as another product), since adding it again would fail the stored validation.

## Known Stubs

None. Nothing in the files of this plan is a hardcoded empty value flowing to the UI or a placeholder.

## Issues Encountered

- `pnpm lint` reports one warning, pre-existing and unrelated: `src/lib/client/navigation.ts:6` has an unused eslint-disable directive. Left alone (out of scope); not logged to a deferred file because it is a warning, not an error.
- Worktree shell policy blocked heredocs and compound `git` commands, so files were edited with the Edit tool and git commands were run one at a time.

## Verification

- `pnpm verify` (lint, typecheck, vitest, next build): exit 0. Vitest: 86 files passed, 6 skipped (the existing live and e2e files); 2417 tests passed, 75 skipped.
- `pnpm eslint .`: 0 errors, 1 pre-existing warning.
- Task 1 acceptance: `grep -c ContextTarget src/domain/llm/candidates.ts` = 3; `grep -c "export function addMembersToProduct" src/domain/settings/products.ts` = 1; vitest on `src/domain/llm` and `src/domain/settings/products.test.ts` exits 0.
- Task 2 acceptance: `grep -c "solo como contexto"` is 1 in `messages.ts` (0 in `es.ts`, allowed by "one of the files"); `grep -c addMembersToProduct src/features/products/ReviewQueue.tsx` = 1; `pnpm verify` exits 0.
- DeepSeek was never called; the route tests stub the upstream. No `.env*` file was read.

## Threat Flags

None. T-04-32 is mitigated (names come from the body the dialog renders, only accepted names are sent, the test compares the listed names with `lastBody().existing`); T-04-33 is mitigated (an unknown `e` is dropped on the server, «Agregar a» still needs «Aceptar», `addMembersToProduct` refuses gone and taken); T-04-SC: nothing was installed beyond `pnpm install --frozen-lockfile`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-15 can add the `{ kind: "pending"; suggestionId }` member to `ContextTarget`; the `switch (target.kind)` in `targetProductId` (`suggestions.ts`) is exhaustive, so TypeScript will point at the place to extend.
- The send dialog derives the context list from the bodies, so names added to later batches only need to be on those bodies.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*

## Self-Check: PASSED
