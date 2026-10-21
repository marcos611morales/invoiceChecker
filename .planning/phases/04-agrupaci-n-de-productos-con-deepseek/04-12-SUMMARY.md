---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 12
subsystem: llm
tags: [zustand, abort-controller, batches, round-robin, sonner, base-ui, vitest]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "Tracer run store with startGroupRun, postGroup/LlmFailure client, isRetryable, coverageOf/isComplete, toProductSuggestions, persisted pending queue, LLM_LIMITS.groupItems = 120 (plans 04-01 to 04-11)"
provides:
  - "buildGroupRun deals the sorted free items round-robin into M = ceil(N / limit) batches (supplier-balanced)"
  - "llmRunStore: RunKind, full RunStatus machine, generic RunBatch, groupBatches, startRun / cancel / dismissResult, failure policy and generation guard"
  - "RunProgress (run card with Detener lotes), RunResult (canceled, partial with Reintentar, stopped Alerts), RunWatcher (end-of-run toast from any tab)"
  - "Send dialog line «Se enviarán en {M} lotes.» and focus handoff to Detener lotes"
affects: [04-18 Sugerir categorías (reuses startRun, RunBatch, RunResult onRetry(kind)), 04-21 end-of-phase live check]

plan_head_before: 3dd1c1472192d18036839fb7f7d21fb820aac697
plan_head_after: b548c7f74a59e08d8c056d3316d8177dcc7444db
commits: 3

actuals:
  tokens: 17200
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Run slot in a non-persisted zustand store; a batch is {send, apply} so the runner alone decides whether a received answer is written (abort and generation checked right before apply)"
    - "Module-scope WeakSet of announced statuses so a remounted watcher never repeats a toast"
    - "Dialog finalFocus function that hands focus to a data-attribute target when the user confirmed"

key-files:
  created:
    - src/features/products/RunProgress.tsx
    - src/features/products/RunResult.tsx
    - src/features/products/RunWatcher.tsx
    - src/features/products/RunProgress.test.tsx
    - src/features/products/focusTargets.ts
    - src/stores/llmRunStore.test.ts
  modified:
    - src/domain/llm/candidates.ts
    - src/domain/llm/candidates.test.ts
    - src/stores/llmRunStore.ts
    - src/stores/suggestionsStore.test.ts
    - src/features/products/ProductsTab.tsx
    - src/features/products/ProductsTab.test.tsx
    - src/features/products/SendDialog.tsx
    - src/features/shell/AppShell.tsx
    - src/features/shell/AppShell.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "Failure policy exactly as the plan's interface block: unauthorized, server_not_configured, upstream_auth, upstream_balance, upstream_rejected, bad_request and payload_too_large stop the run after that batch; every other code, plus «offline», is a failed batch and the run continues. incomplete_response is therefore now a retryable failed batch, no longer a stop (the tracer stopped on it)"
  - "A finished run keeps status «finished» in the store (nothing renders it; the toast is the signal) instead of going back to idle; a new run may start from any ended state, only running and cancelling are single-slot"
  - "«Reintentar» and the entry button share one handler (openGroupDialog): free items are recomputed and the send dialog opens first, so nothing is sent without confirmation (D-27 stateless resume)"
  - "The result of an ended run is dismissed when the invoices are cleared, so an old Alert or its «Reintentar» never outlives the invoices it ran on"

patterns-established:
  - "startRun(kind, RunBatch[]): Plan 04-18 only has to build RunBatch objects for «Sugerir categorías» and pass its own onRetry(kind) branch to RunResult"

requirements-completed: [LLM-05, LLM-06]

coverage:
  - id: D1
    description: "A run that needs several batches deals the sorted free descriptions round-robin into M = ceil(N / limit) near-equal batches (500 items with one supplier of 220 give 250 and 250 with 110 each) and sends them one after another"
    requirement: LLM-05
    verification:
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#buildGroupRun (D-28, LLM-03)"
        status: pass
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#startRun order and success (D-26)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cancel (Detener lotes) aborts the request in flight, applies nothing of it, sends no further batch, keeps the batches received and ends canceled; a session clear aborts the run and applies nothing"
    requirement: LLM-05
    verification:
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#cancel (LLM-05, D-26, Pitfall 6)"
        status: pass
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#session generation (Pitfall 6, T-04-28)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/RunProgress.test.tsx#«Detener lotes» (LLM-05, D-26) and «Quitar todas» during a run"
        status: pass
    human_judgment: false
  - id: D3
    description: "A batch with a retryable failure does not stop the run (ends partial with the count and the last reason); a refusal a retry cannot fix stops it after that batch; the browser never retries on its own"
    requirement: LLM-05
    verification:
      - kind: unit
        ref: "src/stores/llmRunStore.test.ts#failure policy (D-27, T-04-29)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/RunProgress.test.tsx#Failures that do not stop the run (D-27) and A refusal that a retry cannot fix"
        status: pass
    human_judgment: false
  - id: D4
    description: "Run card: Lote k de M in a polite atomic live region, 8px bar over completed batches, waiting and received captions, Detener lotes enabled throughout and then Deteniendo… (aria-busy), focus on Detener lotes after confirming the dialog"
    requirement: LLM-05
    verification:
      - kind: automated_ui
        ref: "src/features/products/RunProgress.test.tsx#Run card across two batches (E3 loading, E4 loading, D-26)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Result Alerts: canceled Info (role status, Cerrar aviso), partial «{n} lotes fallaron · Reintentar» with the last reason, stopped with Iniciar sesión only for an ended session; «Reintentar» opens the send dialog for the still-free descriptions"
    requirement: LLM-05
    verification:
      - kind: automated_ui
        ref: "src/features/products/RunProgress.test.tsx#Failures that do not stop the run (D-27)"
        status: pass
    human_judgment: false
  - id: D6
    description: "End-of-run toast «DeepSeek terminó: {n} sugerencias de productos por revisar» from any tab, with «Revisar» (switches to Productos and focuses the queue heading) only when Productos is not active; mounted in AppShell"
    requirement: LLM-05
    verification:
      - kind: automated_ui
        ref: "src/features/shell/AppShell.test.tsx#AppShell end-of-run toast (RunWatcher, UI-SPEC finished toast)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/RunProgress.test.tsx#The end-of-run toast from any tab"
        status: pass
    human_judgment: false
  - id: D7
    description: "Send dialog says «Se enviarán en {M} lotes.» for more than one batch and still lists every item of every batch; the extra sentence is absent for one batch"
    requirement: LLM-06
    verification:
      - kind: automated_ui
        ref: "src/features/products/RunProgress.test.tsx#says in the dialog that the run goes out in 2 batches and still lists every item of both"
        status: pass
    human_judgment: false
  - id: D8
    description: "Layout and behavior in a real browser: the card wrapping the stop button under 640px, focus return after the dialog closes, the Alert layouts, the toast action and the keyboard path"
    requirement: LLM-05
    verification: []
    human_judgment: true
    rationale: "Only jsdom ran; wrapping, real focus return of the dialog and toast stacking need a browser (UI-SPEC asks to verify 640 to 767px)"

duration: 15min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 12: Batches, cancel, failure policy and run result Summary

**Supplier-balanced round-robin batches run through a generic `startRun` store with «Detener lotes» (aborts and keeps what arrived), a failure policy that only stops on refusals a retry cannot fix, a run card, canceled/partial/stopped Alerts with «Reintentar», and an end-of-run toast with «Revisar» from any tab.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-21T22:13Z (base commit time; the exact start was not recorded)
- **Completed:** 2026-10-21T22:29Z
- **Tasks:** 2 (Task 1 TDD)
- **Files:** 6 created, 12 modified (18 files in the diff, +1827 / -142 lines)

## Accomplishments

- `buildGroupRun` sorts the free items by supplier then description and deals item j to batch j mod M, so one big supplier is spread over all batches (500 items with 220 of one supplier give 250 and 250 holding 110 each; 251 give 126 and 125). Batch sizes and ids are unchanged in form.
- `llmRunStore` is now the generic runner: `startRun(kind, RunBatch[])`, `cancel`, `dismissResult`, the seven-state `RunStatus`, `groupBatches` (post, coverage re-check, mapping; `apply` enqueues and returns the cards added) and `startGroupRun` as a thin wrapper. A cancel or a session generation change aborts the request in flight, and `apply` is only called when the signal is not aborted and the generation is unchanged (T-04-28).
- Failures follow the plan's list: retryable ones and «offline» count as failed batches and the run goes on (ends `partial` with `failed` and `lastError`); the seven non-retryable codes stop the run after that batch (`stopped`, no more requests, T-04-29). The browser never retries by itself.
- `RunProgress`, `RunResult` and `RunWatcher` implement the UI-SPEC run contract; `ProductsTab` lost its tracer status line and stopped Alert, and `AppShell` mounts `RunWatcher` inside the loaded tabs.
- The send dialog adds «Se enviarán en {M} lotes.» above one batch and, after «Enviar a DeepSeek», returns focus to «Detener lotes» through `finalFocus`.

## Task Commits

1. **Task 1 RED: failing tests for round-robin batches and the run state machine** - `059640d` (test)
2. **Task 1 GREEN: round-robin batches, runner with cancel, failure policy and generation guard** - `7cb27fb` (feat)
3. **Task 2: run card, result Alerts, end-of-run toast, batches line** - `b548c7f` (feat)

**Plan metadata:** committed after this file (docs: complete plan).

`commits: 3` is `git rev-list --count 3dd1c14..HEAD` measured before this SUMMARY commit. The per-plan ledger file could not be written in the shared git directory from this worktree, so the base is the spawn-time SHA from the branch check, recorded in `plan_head_before`.

## TDD Gate Compliance

Task 1 was `tdd="true"` in an `execute` plan.

- **RED:** `059640d` `test(04-12)`. Run: 33 failed, 33 passed in the two target files. Semantic assessment: the three `candidates.test.ts` failures are assertion failures on the planned behavior (`[220, 0]` instead of `[110, 110]`, order of `['g','h','i','j']` instead of round-robin, unsorted input order). The 59 `llmRunStore.test.ts` failures are `TypeError: ... is not a function` for the symbols that did not exist yet (`startRun`, `cancel`, `groupBatches`), which is a missing-symbol failure and not an assertion on behavior; `check tdd-red-evidence` was not run, so this RED is weaker than the reference asks for (same limitation as plan 04-11).
- **GREEN:** `7cb27fb` `feat(04-12)`: 380 tests across `src/domain/llm`, `src/stores` and `src/features/products` pass.
- **REFACTOR:** none.

## Files Created/Modified

- `src/domain/llm/candidates.ts` - `compareItems` shared by `collectItems` and `buildGroupRun`; round-robin split
- `src/stores/llmRunStore.ts` - `RunKind`, `RunStatus`, `RunBatch`, `groupBatches`, `startRun`, `cancel`, `dismissResult`, result dismissal on session clear
- `src/features/products/RunProgress.tsx` - run card
- `src/features/products/RunResult.tsx` - canceled, partial and stopped Alerts (`onRetry(kind)`)
- `src/features/products/RunWatcher.tsx` - always-mounted end-of-run toast
- `src/features/products/focusTargets.ts` - ids and selector for the headings and the stop button
- `src/features/products/ProductsTab.tsx`, `SendDialog.tsx`, `src/features/shell/AppShell.tsx` - wiring
- `src/lib/copy/es.ts`, `messages.ts` - `es.products.run.*`, `batchesLine`, `canceledText`, `failedBatchesText`, `runFinishedToast`, `runCaptionWaiting`, `runCaptionReceived`
- Tests: `candidates.test.ts`, `llmRunStore.test.ts` (new), `RunProgress.test.tsx` (new), `AppShell.test.tsx`, `messages.test.ts`, plus `ProductsTab.test.tsx` and `suggestionsStore.test.ts` adjusted to the new states

## Decisions Made

See `key-decisions`. The first one changes tracer behavior on purpose: an answer that omits, repeats or invents an id used to stop the run; it is now a retryable failed batch (the plan's list), shown as «1 lote falló · Reintentar» with the «Pulsa «Reintentar»» reason.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Behavior change] Tracer tests followed the new run states**
- **Found during:** Task 1 (full `src/features` run after the store change)
- **Issue:** six `ProductsTab.test.tsx` cases and one `suggestionsStore.test.ts` case asserted the tracer states (`idle` after success, `stopped` for `incomplete_response` and for `upstream_unavailable`, no `received` field).
- **Fix:** they now assert `finished`, `partial` (with the Alert in Task 2) and the `received` field. No assertion about what is sent or enqueued changed.
- **Files modified:** `src/features/products/ProductsTab.test.tsx`, `src/stores/suggestionsStore.test.ts`
- **Committed in:** `7cb27fb`, `b548c7f`

**2. [Rule 2 - Missing critical] A send that throws is a failed batch**
- **Found during:** Task 1
- **Issue:** a rejected `send` would leave `startRun` rejecting through `void startRun(...)` as an unhandled rejection.
- **Fix:** the runner catches it and counts a failed batch with `invalid_response`; the slot is always freed in `finally`. Covered by a test.
- **Files modified:** `src/stores/llmRunStore.ts`, `src/stores/llmRunStore.test.ts`
- **Committed in:** `7cb27fb`

**3. [Rule 2 - Missing critical] An ended run's result is dismissed when the invoices are cleared**
- **Found during:** Task 2 (the store keeps `finished`, `partial`, `stopped` and `canceled` after the run)
- **Issue:** after «Quitar todas» and a new load, an old Alert (and its «Reintentar») would still show for invoices that no longer exist, and a stale `finished` would re-toast when the watcher remounted.
- **Fix:** a module-scope `useSessionStore.subscribe` returns an ended status to idle on a generation change; `RunWatcher` also keeps a module-scope `WeakSet` of announced statuses. Both tested.
- **Files modified:** `src/stores/llmRunStore.ts`, `src/features/products/RunWatcher.tsx`
- **Committed in:** `b548c7f`

**4. [Rule 3 - Blocking, small addition] `focusTargets.ts`**
- The toast (outside the tab) and the dialog need to find the headings and the stop button; a tiny constants module avoids exporting constants from a component file. It is not in the plan's file list.

---

**Total deviations:** 4 (1 behavior-following test update, 2 missing-critical additions, 1 small blocking helper). **Impact on plan:** none on the specified behavior; the additions close edge cases the plan's truths imply.

## Authentication Gates

None.

## Issues Encountered

- `pnpm lint` reports one warning, pre-existing and untouched: `src/lib/client/navigation.ts` line 6, "Unused eslint-disable directive".
- The shared git directory refused the plan-commit ledger file (see Task Commits), as in plan 04-11.

## Verification

- `pnpm verify` (eslint, `next typegen && tsc --noEmit`, `vitest run`, `next build`): exit 0. Vitest: 86 files passed, 6 skipped; 2300 tests passed, 75 skipped.
- Task 1 acceptance: `useSessionStore.subscribe` 1 match (2 with the result dismissal added later), `"cancelling"` 4 matches, `"partial"` 2 matches in `llmRunStore.ts`; `vitest run src/stores/llmRunStore.test.ts` exit 0.
- Task 2 acceptance: `Detener lotes` 1 match and `Deteniendo…` 1 match in `es.ts`; `RunWatcher` 2 matches in `AppShell.tsx`; `aria-busy` 1 match in `RunProgress.tsx`; `pnpm verify` exit 0.
- Mutation check: removing `finalFocus` from the send dialog makes the focus test fail, so that test does depend on the handoff.
- CLAUDE.md: no `any`, `@ts-ignore`, `@ts-nocheck`, non-null `!` or unverified `as` in the new code.
- Not run: Playwright e2e and any real-browser check (wrapping of the stop button under 640px, the real focus return of the dialog, toast stacking). Nothing called DeepSeek.

## Known Stubs

None.

## Threat Flags

None. T-04-28 (late write after cancel or clear) is mitigated by abort plus the generation check before `apply`, tested at store and UI level; T-04-29 (a broken key burning every batch) by stopping after one batch on the non-retryable codes, tested per code; T-04-SC: nothing installed.

## Items that need a decision

1. **«Iniciar sesión» link (open item b from plan 04-01).** The plan does not decide it, so it stays a plain `<a href="/login">` (moved to `RunResult`). A full page load to `/login` loses the invoices held in memory. Options: (A) keep it and warn in the copy; (B) navigate client-side so the in-memory invoices survive until the login page; (C) open `/login` in a new tab so this tab keeps its invoices, and the user presses «Agrupar productos» again afterwards (the free set is recomputed, so nothing else is needed). My recommendation is C. Note that a stopped run for an ended session offers no «Reintentar» by the UI-SPEC.
2. **«Reintentar» open item (a) is resolved:** the partial Alert has the button, and it is the only place the retryable messages («Pulsa «Reintentar»») appear, because retryable failures never stop a run now.
3. **Copy for 0 and 1 that the UI-SPEC does not give.** Canceled with one: «Llegó 1 sugerencia nueva y está en la cola; …»; canceled with none: «No llegó ninguna sugerencia nueva; …» (instead of «Llegaron 0 sugerencias … en la cola»); caption with one: «1 sugerencia nueva en la cola. Ya puedes empezar a revisarla.» Please confirm or give the wording you want.
4. **Close button on the partial Alert.** The UI-SPEC lists one only for the canceled Alert; I added «Cerrar aviso» to the partial one too (the stopped Alert already had it) so the Alert can be cleared without retrying.
5. **Toast when nothing arrived.** If every batch fails the end-of-run toast reads «DeepSeek terminó: 0 sugerencias de productos por revisar» next to the failure Alert. The plan says to toast on `partial`; it may be better to skip the toast when `received` is 0.
6. **Caption after a batch that added nothing.** The «{n} sugerencias nuevas» caption shows only when `received` is above 0; a batch that lands but adds no card keeps the waiting caption.
7. **Carry-over from 04-11:** `ProductsTab` still builds the run with `buildGroupRun(free, [])`, so no accepted-product names travel as context (D-04) and the dialog has no «Como contexto también…» line. Not touched here.

## Next Phase Readiness

- Plan 04-18 can build its own `RunBatch[]` and call `startRun("categorize", …)`; `RunProgress`, `RunResult` (pass the categorize handler through `onRetry(kind)`) and `RunWatcher` already read `kind`.
- `startGroupRun` is still the tracer wrapper used by `ProductsTab`; it can be inlined when 04-18 touches the same call.
- The live check on the real 227-description sample (plan 04-06 pending items, now with supplier-balanced 120-item batches) is still the user's to run.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*

## Self-Check: PASSED

Created files found on disk (6 of 6): `RunProgress.tsx`, `RunResult.tsx`, `RunWatcher.tsx`, `RunProgress.test.tsx`, `focusTargets.ts`, `llmRunStore.test.ts`. Commits are ancestors of HEAD: `059640d`, `7cb27fb`, `b548c7f`. Acceptance greps of both tasks and `pnpm verify` re-run green.
