---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 15
subsystem: llm-product-grouping
tags: [deepseek, zustand, vitest, multi-batch, context-names, review-queue]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "ContextTarget, accepted names p1..pK, Agregar a cards (04-14); RunBatch, groupBatches, startRun, batchesLine (04-12); pending queue with enqueueProducts (04-11)"
provides:
  - "ContextTarget pending kind: a context id that stands for a card an earlier batch of the same run enqueued"
  - "groupBatches composes batch k's request with the names of the cards batches 1..k-1 enqueued, after the accepted names, capped at 400 in all"
  - "resolveProductAnswer / RunContext: apply-time resolution of a pending target (still pending: append; accepted: Agregar a card; rejected: own card)"
  - "appendSuggestionMembers (domain) and appendMembers (store action), idempotent per member"
  - "es.products.dialog.earlierNamesLine, shown right after the batches line when there is more than one batch"
affects: [04-16 and later review-queue plans, 04-21 live check of the real-data D-32 case]

plan_head_before: fa952f3328d2e9a612e490e8c809b6dffd8b0209
plan_head_after: 47dea4f9bec4cb042ba5b3d915905bf3d5fb199f

actuals:
  tokens: 20500
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "The answer of a batch is mapped at apply time (not at send time) against the live queue and settings, because the user can accept or reject a card while a long run is in flight"
    - "The per-run list of cards lives only in the closure of groupBatches(run); the request body is composed per batch and the bodies the dialog lists are not touched"

key-files:
  created: []
  modified:
    - src/domain/llm/candidates.ts
    - src/domain/llm/suggestions.ts
    - src/domain/llm/suggestions.test.ts
    - src/stores/llmRunStore.ts
    - src/stores/llmRunStore.test.ts
    - src/stores/suggestionsStore.ts
    - src/features/products/SendDialog.tsx
    - src/features/products/RunProgress.test.tsx
    - src/lib/copy/es.ts

key-decisions:
  - "D-33 resolution is apply-time: send() only checks coverage; apply() builds the cards and appends from the groups against the queue and settings as they are then"
  - "Names sent for earlier batches are the ones DeepSeek proposed when the card entered the queue (not later user edits), one entry per card, in batch order"
  - "An Agregar a card of an earlier batch is not offered as context: its product is already in the accepted names"
  - "toProductSuggestions keeps its 4-argument form and array result; the 5-argument form with a run context is the new resolveProductAnswer returning { cards, appends }"

patterns-established:
  - "RunContext = { queue, productIdOfMember, runCards }: everything a pure reducer needs to resolve a pending target without touching a store"

requirements-completed: [LLM-01, LLM-06]

coverage:
  - id: D1
    description: "Batch k of a multi-batch run carries, after the accepted names, the names of the cards batches 1..k-1 enqueued (ids continue after the accepted ones, total capped at 400); a run of one batch sends only the accepted names"
    requirement: LLM-01
    verification:
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#groupBatches: earlier-batch names on later batches (D-28, D-33) > adds to batch 2 the names of the cards batch 1 enqueued, after the accepted ones"
        status: pass
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#groupBatches: earlier-batch names on later batches (D-28, D-33) > caps the context at 400 names in all, accepted first"
        status: pass
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#groupBatches: earlier-batch names on later batches (D-28, D-33) > sends only the accepted names in a run of one batch"
        status: pass
    human_judgment: false
  - id: D2
    description: "A description placed with a card of an earlier batch joins it while pending, becomes an Agregar a card for the accepted product, or keeps its own card with the group's name after a reject"
    requirement: LLM-01
    verification:
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#resolveProductAnswer: pending targets of one run (D-28, D-33)"
        status: pass
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#groupBatches: earlier-batch names on later batches (D-28, D-33) > puts a description of batch 2 into the card of batch 1 while that card is pending"
        status: pass
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#groupBatches: earlier-batch names on later batches (D-28, D-33) > makes an «Agregar a» card for the product the user accepted from the batch-1 card in the meantime"
        status: pass
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#groupBatches: earlier-batch names on later batches (D-28, D-33) > keeps its own card with the group's name when the user rejected the batch-1 card"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cards pending from earlier runs are never sent as context and never modified, also in a multi-batch run"
    requirement: LLM-01
    verification:
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#groupBatches: earlier-batch names on later batches (D-28, D-33) > never sends, nor changes, a card that was pending from an earlier run"
        status: pass
    human_judgment: false
  - id: D4
    description: "appendMembers adds members to a pending card idempotently per member, within the members limit, and every result passes pendingQueueSchema"
    requirement: LLM-01
    verification:
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#appendSuggestionMembers (D-33)"
        status: pass
    human_judgment: false
  - id: D5
    description: "E2 partial: the send dialog adds the sentence about earlier names right after the batches line with more than one batch, never with one; the second recorded request carries the first batch's card names after the accepted ones"
    requirement: LLM-06
    verification:
      - kind: automated_ui
        ref: "src/features/products/RunProgress.test.tsx#Earlier-batch names (D-28, D-33, LLM-06)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cross-batch joining on the real 227-description sample, notably the D-32 case JAMON ZWAN vs JAMON ZWAN VIRGINIA (different suppliers) ending in one card"
    verification: []
    human_judgment: true
    rationale: "Depends on DeepSeek's real answers; no test may call DeepSeek. To be re-checked live in Plan 04-21"

duration: not recorded
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 15: Earlier-batch names on later batches Summary

**Each later batch of a long grouping run now also carries the names DeepSeek proposed in the earlier batches, and a group placed with one of those cards joins it while pending, becomes an «Agregar a» card once the user accepted it, or keeps its own card once rejected, with the dialog disclosing the extra names.**

## Performance

- **Completed:** 2026-10-21
- **Tasks:** 2 (Task 1 TDD: RED + GREEN; Task 2 auto)
- **Files modified:** 9 (6 source and copy, 3 test)

## Accomplishments

- `ContextTarget` gains `{ kind: "pending"; suggestionId }`. `groupBatches(run)` keeps, in the closure of that run only, the cards each applied batch enqueued (`suggestionId`, proposed name, member keys). Before sending batch k it appends their names to batch k's request as `p(K+1)..` after the accepted `p1..pK`, never more than `LLM_LIMITS.contextNames` (400) in all. The bodies the dialog lists are untouched; with one batch, or with no earlier card, the request is exactly the built body.
- The answer is mapped at apply time. `resolveProductAnswer(groups, idMap, targets, newId, context)` with `context = { queue, productIdOfMember, runCards }` returns `{ cards, appends }`: a pending target whose card is still in the queue appends the members to it (no new card); one whose card the user accepted becomes an «Agregar a» card for the product that holds one of the card's member keys (merged with other groups pointing at the same product); one the user rejected, whose product is gone, or that is unknown keeps its own card with the group's name. `toProductSuggestions` keeps its 4-argument form (pending target without context = new card).
- `appendSuggestionMembers` (pure) and `useSuggestionsStore.appendMembers` add members at the end of a pending card, skip any member already pending in any card, stop at `PENDING_LIMITS.members`, and return the very same queue when nothing changes.
- Cards pending from earlier runs are never named in a request and never modified: only cards created by this run (by id) are ever candidates.
- Send dialog: when the run has more than one batch, `es.products.dialog.earlierNamesLine` («Cada lote lleva también los nombres que DeepSeek propuso en los anteriores.») follows the batches line; with one batch it is absent. Spanish copy, no new UI-SPEC pattern beyond that sentence.

## Task Commits

1. **Task 1 RED:** `b581316` (test) - failing tests for `resolveProductAnswer`, `appendSuggestionMembers` and the composed later-batch requests
2. **Task 1 GREEN:** `527ace1` (feat) - pending kind, composed requests, apply-time resolution, `appendMembers`
3. **Task 2:** `47dea4f` (feat) - dialog sentence, copy and the RunProgress tests

**Plan metadata:** the docs commit that adds this SUMMARY (below the task commits in `git log`).

## TDD Gate Compliance (Task 1)

- **RED** (`b581316`): 18 tests failed. In `suggestions.test.ts`, `resolveProductAnswer` / `appendSuggestionMembers` were not exported (`... is not a function`). In `llmRunStore.test.ts` the failures were assertion failures on the planned behavior: batch 2 sent `[p1 Leche]` instead of accepted plus earlier names; 399 instead of 400 names; a group placed with a batch-1 card produced 2 cards instead of 1; an accepted card did not become `Agregar a`. The regression guards (one batch, earlier-run card untouched, rejected card keeps its own card) already passed. Semantic assessment: each failing test executed and failed on the planned assertion, not on syntax, import or fixture faults. The machine classifier `check tdd-red-evidence` was not run (the plan is `type: execute`).
- **GREEN** (`527ace1`): `pnpm exec vitest run src/domain/llm src/stores` passes (336 tests); full run 2438 passed.
- **REFACTOR:** none needed.

## Files Created/Modified

- `src/domain/llm/candidates.ts` - `ContextTarget` pending kind
- `src/domain/llm/suggestions.ts` - `RunContext`, `MemberAppend`, `ProductAnswer`, `resolveProductAnswer`, `appendSuggestionMembers`; `toProductSuggestions` delegates
- `src/stores/llmRunStore.ts` - per-run `RunCard` list, `composeRequest`, apply-time resolution
- `src/stores/suggestionsStore.ts` - `appendMembers` action
- `src/features/products/SendDialog.tsx`, `src/lib/copy/es.ts` - the disclosure sentence
- Tests: `suggestions.test.ts`, `llmRunStore.test.ts`, `RunProgress.test.tsx`

## Decisions Made

See `key-decisions`. The system prompt in `src/lib/server/deepseek.ts` was not touched (rule 2 unchanged, no golden-set example): it already tells the model to use `existing` ids, and the earlier-batch names are just more `existing` entries. The 120-item batch limit is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, interface shape] `toProductSuggestions` with a context returns two things, so it became two functions**
- **Found during:** Task 1
- **Issue:** the plan's interface block puts `context` on `toProductSuggestions`, but a pending card that is still in the queue needs the members appended (`appendMembers`), which a `ProductSuggestion[]` result cannot express, and changing its return type would break the Plan 04-14 callers.
- **Fix:** `resolveProductAnswer(..., context)` returns `{ cards, appends }`; `toProductSuggestions(groups, idMap, targets, newId)` is unchanged for existing callers and delegates to it without a context.
- **Files modified:** `src/domain/llm/suggestions.ts`
- **Committed in:** `527ace1`

**2. [Rule 3 - Blocking, where the mapping runs] The answer is mapped in `apply`, not in `send`**
- **Found during:** Task 1
- **Issue:** the plan says pending targets resolve at apply time against the current queue and settings; the old code mapped the cards in `send`, before the runner decides the batch counts.
- **Fix:** `send` keeps the request, the coverage check and the groups; `apply` builds the cards and appends from them. Behavior of the existing tests is unchanged (they still pass).
- **Files modified:** `src/stores/llmRunStore.ts`
- **Committed in:** `527ace1`

---

**Total deviations:** 2 auto-fixed (both Rule 3, interface shape). **Impact:** none on the plan's behavior; no scope creep and no production file outside `files_modified`.

## Items that need a decision

CLAUDE.md section 1: none of these blocks the plan; each was resolved with the most conservative option and is easy to change.

1. **An «Agregar a» card of an earlier batch is not sent as context.** Its name would only repeat an accepted product name already in the context. Say so if every enqueued card should be named, whatever its target.
2. **The name sent for a card is the one DeepSeek proposed when the card entered the queue**, not a name the user typed afterwards, so the extra names stay DeepSeek's own output (as the disclosure sentence says).
3. **Two cards with the same proposed name are two entries** (two ids). It is not deduplicated, because each id must map to exactly one card.
4. **Real-data re-check (D-32).** The plan's objective says the 227 real descriptions fit in one batch; since Plan 04-06 the limit is 120, so they go in 2 batches (04-12 deals items round-robin). In the live check of 04-06 «JAMON ZWAN» and «JAMON ZWAN VIRGINIA…» (different suppliers) landed in separate cards in both samples, very likely because they fell in different batches. This plan's carry is the fix; the case must be re-checked live in Plan 04-21. No test here can show it (DeepSeek is never called).

## Known Stubs

None.

## Issues Encountered

- `pnpm lint` reports one warning, pre-existing and unrelated: `src/lib/client/navigation.ts:6` has an unused eslint-disable directive. Left alone.
- The worktree shell policy refused compound `git` commands and writes to the shared `.git` directory, so the commit ledger file for `plan_head_before` was not written; the base `fa952f3` is the HEAD recorded at spawn and `git rev-list --count fa952f3..47dea4f` is 3.

## Verification

- `pnpm verify` (lint, typecheck, vitest, next build): exit 0. Vitest: 86 files passed, 6 skipped; 2442 tests passed, 75 skipped.
- `pnpm exec vitest run src/domain/llm src/stores` and `pnpm exec vitest run src/features/products src/lib`: exit 0.
- Task 1 acceptance: `"pending"` appears in `candidates.ts` (1), `llmRunStore.ts` (1) and `suggestions.ts` (4); `appendMembers` appears twice in `suggestionsStore.ts`.
- Task 2 acceptance: the sentence appears once in `es.ts`; `earlierNamesLine` appears once in `SendDialog.tsx`; `pnpm verify` exits 0.
- DeepSeek was never called (the client is mocked or the fetch stubbed); no `.env*` file was read; nothing was installed beyond `pnpm install --frozen-lockfile`.

## Threat Flags

None. T-04-50 is mitigated (the sentence is shown for every multi-batch run; the extra names are DeepSeek's own output, never user data; capped at 400 per request). T-04-51 is mitigated (pending targets exist only for cards of this run, resolved at apply time against the current queue and settings; `appendMembers` is idempotent; tests for pending, accepted and rejected). T-04-SC: nothing installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later review-queue plans can rely on `appendMembers` and on `RunContext`; the `Agregar a` card produced after an accept is the same shape as Plan 04-14's.
- Plan 04-21 must run the live check of the D-32 case on the real sample.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*

## Self-Check: PASSED
