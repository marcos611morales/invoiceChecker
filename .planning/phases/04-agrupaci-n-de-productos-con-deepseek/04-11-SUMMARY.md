---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 11
subsystem: persistence
tags: [zustand, persist, zod, localStorage, storage-notices, tabs]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "In-memory suggestions store with ProductSuggestion and enqueueProductSuggestions (04-01, 04-05); settings store with products (04-04..04-10)"
provides:
  - "createSafeStorage: the shared never-throwing persist adapter with a failure reporter"
  - "createStorageStatusStore, useStorageStatusStore (settings) and useSuggestionsStatusStore (queue)"
  - "Stored pending queue contract: key invoicechecker:suggestions, version 1, strict zod schema with caps and integrity, total resolvePendingQueue"
  - "Persisted useSuggestionsStore (products and categories), rehydrated by AppShell"
  - "Tab counter «Productos · {n}» with accessible name, the queue read-failure toast, the two non-dismissible write-failure Alerts in the Productos tab"
affects: [04-18 category suggestions, 04-12, 04-13, phase 4 verification]

actuals:
  tokens: 22300
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One status store per persisted store (factory), so the settings and queue notices never mix"
    - "Persisted store adapter takes a lazy reporter getter, so a store can be created before its status store is read"
    - "Strict zod schemas for a stored queue: a field the queue never stores makes the whole value unreadable instead of being kept"

key-files:
  created:
    - src/stores/safeStorage.ts
    - src/stores/safeStorage.test.ts
    - src/domain/llm/suggestions.test.ts
    - src/stores/suggestionsStore.test.ts
    - tests/support/suggestionsStorage.ts
  modified:
    - src/stores/storageStatusStore.ts
    - src/stores/settingsStore.ts
    - src/stores/suggestionsStore.ts
    - src/domain/llm/suggestions.ts
    - src/features/shell/AppShell.tsx
    - src/features/shell/AppShell.test.tsx
    - src/features/products/ProductsTab.tsx
    - src/features/products/ProductsTab.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "The queue schemas are z.strictObject at every level, so an amount, UUID, folio or date added to a stored value makes the queue unreadable (empty queue plus the toast) instead of being silently kept or stripped"
  - "Card and category-row ids are unique within their own list, not across both lists"
  - "enqueueProductSuggestions stops (break) at the first card that would pass a cap; the descriptions of the cards left out stay free and can be asked again"
  - "A value with no stored version is read as version 1, like the settings envelope; any other number is unreadable (no older queue contract exists)"
  - "The queue is rehydrated after the settings in the same mount effect, and its read-failure toast is independent of the settings one (two toasts when both are unreadable)"

patterns-established:
  - "createSafeStorage(reporter) for every persisted store; settings and queue share the code, not the status"
  - "Counted tab trigger: label function plus aria function in messages.ts (Calidad de datos, Productos)"

requirements-completed: [LLM-04, LLM-05]

coverage:
  - id: D1
    description: "Pending suggestion cards survive a reload under invoicechecker:suggestions (own key, own version 1) and leave storage when accepted or rejected"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/stores/suggestionsStore.test.ts#suggestionsStore persistence (D-24, D-30, ROADMAP criterion 2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The stored queue holds only ids, names, targets and per member rfc, key, description and supplier name; never an amount, UUID, folio, date or receptor"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/stores/suggestionsStore.test.ts#what the stored queue holds (D-24 amended by D-30, T-04-26)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/suggestions.test.ts#resolvePendingQueue (strict fields)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each batch that lands is stored as it lands, so a later failed batch loses only itself"
    requirement: LLM-05
    verification:
      - kind: integration
        ref: "src/stores/suggestionsStore.test.ts#keeps the batches that arrived when a later batch fails (LLM-05, D-26)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An unusable stored queue never throws: the queue starts empty and the unreadable toast shows once per page load"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/stores/suggestionsStore.test.ts#suggestionsStore with an unusable stored queue (T-04-25, T-04-27)"
        status: pass
      - kind: automated_ui
        ref: "src/features/shell/AppShell.test.tsx#AppShell pending-queue read-failure toast (Q8 pattern)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Productos tab shows the non-dismissible Alerts when the queue or the settings cannot be written"
    requirement: LLM-05
    verification:
      - kind: automated_ui
        ref: "src/features/products/ProductsTab.test.tsx#Storage notices of the Productos tab (Q8 pattern)"
        status: pass
    human_judgment: false
  - id: D6
    description: "After a reload with only some invoices loaded, members of suppliers without loaded lines show «Sin líneas cargadas» and the card can still be accepted keeping the RFC (E4 partial)"
    requirement: LLM-04
    verification:
      - kind: automated_ui
        ref: "src/features/products/ProductsTab.test.tsx#Pending suggestions after a reload (D-24, D-30, E4 partial)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Tab label «Productos · {n}» and accessible name «Productos, {n} sugerencias por revisar» (singular for 1), n = cards plus category rows"
    verification:
      - kind: automated_ui
        ref: "src/features/shell/AppShell.test.tsx#AppShell Productos tab counter (UI-SPEC Shell and tab)"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#Productos tab texts (UI-SPEC Shell and tab)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The settings store keeps its storage behavior with the shared adapter"
    verification:
      - kind: unit
        ref: "src/stores/settingsStore.test.ts (85 tests, unchanged)"
        status: pass
      - kind: unit
        ref: "src/stores/safeStorage.test.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-21
status: complete
plan_head_before: c0e3c507974ce21b3181fcbc16a2435ba6c1ac15
plan_head_after: 524ec669b31117f99da129a9360ad7a752988420
commits: 3
---

# Phase 4 Plan 11: Persisted pending queue Summary

**The review queue now survives reloads: `useSuggestionsStore` persists under `invoicechecker:suggestions` (version 1) through a shared never-throwing storage adapter, a strict zod schema and a total `resolvePendingQueue`, with a once-per-load unreadable toast, two non-dismissible write-failure Alerts and a «Productos · {n}» tab counter.**

## Performance

- **Duration:** about 25 min (start time was not recorded; estimated from the first test run at 16:03 and the last commit)
- **Started:** not recorded
- **Completed:** 2026-10-21T22:11:18Z (last commit; the clock of this run is UTC)
- **Tasks:** 2
- **Files modified:** 16 (5 created, 11 modified)

## Accomplishments

- Extracted the adapter of the settings store into `createSafeStorage(reporter)` (same envelope check, try/catch on every access, never sets any persisted store) and gave each persisted store its own status store through `createStorageStatusStore`. `settingsStore.test.ts` (85 tests) passes unchanged.
- Defined the stored queue contract in `src/domain/llm/suggestions.ts`: `SUGGESTIONS_VERSION = 1`, `PENDING_LIMITS`, `CategoryChoice`, `CategorySuggestion`, `PendingQueue`, a strict `pendingQueueSchema` (caps, unique ids, a member in at most one card, no card without members, a category row targets a supplier or a product, never both) and `resolvePendingQueue` that uses `safeParse` only. The category-row shape is stored now so Plan 04-18 does not change the contract.
- `useSuggestionsStore` is persisted (`skipHydration`, `partialize` of `products` and `categories`, `migrate` and `merge` through `resolvePendingQueue`); every `set` writes, so each batch is stored as it lands (LLM-05, D-26). `enqueueProductSuggestions` stops adding once a `PENDING_LIMITS` cap would be passed.
- AppShell rehydrates the queue after the settings and toasts `es.products.queueReadFailedToast` once per page load (StrictMode safe). The Productos trigger shows «Productos · {n}» with the accessible name «Productos, {n} sugerencias por revisar» (n = cards plus category rows). ProductsTab shows the settings write-failure Alert and the new queue write-failure Alert (both `Info`, not dismissible, settings first).
- Cards restored after a reload with only some suppliers loaded keep working: the member of a supplier without loaded lines shows «Sin líneas cargadas» and the card can be accepted, the product holding the stored RFC (E4 partial, D-30). This needed no change in `ReviewQueue`, which already handled zero lines.

## TDD Gate Compliance

Task 1 was `tdd="true"`.

- **RED:** `ccc6939` `test(04-11)`: added `suggestions.test.ts`, `suggestionsStore.test.ts`, `safeStorage.test.ts` and the `tests/support/suggestionsStorage.ts` helper. Run: 67 tests failed, 165 passed (the pre-existing files). The failures were `TypeError: Cannot read properties of undefined` on `PENDING_LIMITS`, `resolvePendingQueue`, `pendingQueueSchema` and `useSuggestionsStatusStore`, and an unresolvable `./safeStorage` import. Semantic assessment: the target tests ran and failed because the units under test did not exist, which is a missing-symbol failure rather than an assertion on behavior; `tdd_mode` was not enabled for this plan and `check tdd-red-evidence` was not run, so this RED is weaker than the reference asks for.
- **GREEN:** `80edcda` `feat(04-11)`: 241 tests in `src/stores` and `src/domain/llm` pass; `settingsStore.test.ts` unchanged and green.
- **REFACTOR:** none.
- Task 2 is not TDD (`type="auto"`); its tests were written together with the code and committed in `524ec66`.

## Task Commits

1. **Task 1 RED: failing tests for the persisted queue** - `ccc6939` (test)
2. **Task 1 GREEN: persisted queue, shared adapter, total resolution** - `80edcda` (feat)
3. **Task 2: rehydrate on load, storage notices, tab counter, cards without loaded lines** - `524ec66` (feat)

**Plan metadata:** committed after this file (docs: complete plan).

## Files Created/Modified

- `src/stores/safeStorage.ts` - `StorageReporter`, `createSafeStorage`
- `src/stores/storageStatusStore.ts` - `createStorageStatusStore`, `useStorageStatusStore`, `useSuggestionsStatusStore`
- `src/stores/settingsStore.ts` - adapter replaced by `createSafeStorage(() => useStorageStatusStore.getState())`
- `src/domain/llm/suggestions.ts` - queue types, caps, strict schema, `resolvePendingQueue`, `emptyQueue`, capped `enqueueProductSuggestions`
- `src/stores/suggestionsStore.ts` - persisted store with `products` and `categories`
- `src/features/shell/AppShell.tsx` - queue rehydrate, once-per-load toast, counted Productos trigger
- `src/features/products/ProductsTab.tsx` - the two storage Alerts
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - `queueReadFailedToast`, `queueWriteFailedAlert`, `productsTabLabel`, `productsTabAria`
- Tests: `suggestions.test.ts`, `suggestionsStore.test.ts`, `safeStorage.test.ts` (new); `AppShell.test.tsx`, `ProductsTab.test.tsx`, `messages.test.ts` (extended); `tests/support/suggestionsStorage.ts` (`storeQueue`, `readStoredQueue`, `clearStoredQueue`, `resetSuggestionsStore`)

## Decisions Made

See `key-decisions` above. The ones a reviewer may want to overrule: strict schemas (an extra field makes the whole queue unreadable), ids unique per list only, and `break` rather than `continue` at a cap.

## Deviations from Plan

### Auto-fixed Issues

None needed fixing during execution. Additions beyond the plan's file list, all additive:

**1. [Scope addition] `src/stores/safeStorage.test.ts` and `src/lib/copy/messages.test.ts` cases**
- **Found during:** Tasks 1 and 2
- **Issue:** the plan lists tests for the store and the shell but the new shared adapter and the two new message functions had no direct test.
- **Fix:** a small adapter test file (envelope, getItem throwing, quota, circular value, no window, lazy reporter) and a `describe` for `productsTabLabel` and `productsTabAria`.
- **Commits:** `ccc6939`, `524ec66`

**2. [Test hygiene] ProductsTab.test.tsx reset**
- The existing `afterEach` called `useSuggestionsStore.setState({ products: [] })`; with persistence that writes to storage, so it now calls `resetSuggestionsStore()` and `resetSettingsStore()` and clears storage, in `beforeEach` as well. No assertion of the existing tests changed.

**Total deviations:** 0 auto-fixed, 2 additive notes. **Impact:** none on the plan's behavior.

## Authentication Gates

None.

## Issues Encountered

- The plan-commit ledger file (`gsd-plan-head-before-04-11` in the shared git directory) could not be written: writes into the shared `.git/worktrees/...` path are refused for a worktree-isolated agent. `commits: 3` was measured against the spawn-time base SHA `c0e3c507974ce21b3181fcbc16a2435ba6c1ac15` (recorded in `plan_head_before`) with `git rev-list --count`.
- `pnpm lint` reports one warning, pre-existing and untouched: `src/lib/client/navigation.ts` line 6, "Unused eslint-disable directive". Out of scope; not fixed.

## Verification

- `pnpm verify` (lint, typecheck, `vitest run`, `next build`): exit 0. Vitest: 84 files passed, 6 skipped; 2238 tests passed, 75 skipped (skips are the existing ones).
- Task 1 acceptance: `invoicechecker:suggestions` 2 matches and `skipHydration: true` 1 match in `suggestionsStore.ts`; `createSafeStorage` 2 matches in `settingsStore.ts` and 2 in `suggestionsStore.ts`; `safeParse` 3 matches in `suggestions.ts`; `vitest run src/stores/settingsStore.test.ts` exit 0.
- Task 2 acceptance: `useSuggestionsStore.persist.rehydrate` 1 match and `productsTabAria` 2 matches in `AppShell.tsx`; the direct-storage-access scan prints `0`.
- Not run: Playwright e2e, and no real browser check of the Alert layout or the tab counter wrapping (jsdom only). The DeepSeek route was exercised only through the existing stubbed upstream; nothing called DeepSeek.

## Known Stubs

`categories` in `useSuggestionsStore` is always empty and nothing in the UI reads category rows yet except the tab counter. This is intentional and stated in the plan: Plan 04-18 fills them. No UI renders an empty or mock placeholder from it.

## Threat Flags

None beyond the plan's register. T-04-25 (strict envelope-only `getItem`, capped and integrity-checked schema, total resolution), T-04-26 (no amount, UUID, folio or date field; test reads the stored JSON of a queue built from `makeInvoice` inputs and finds none, nor the receptor) and T-04-27 (`safeParse` only; broken values in tests) are mitigated and tested. T-04-SC: nothing installed.

## Items that need a decision

1. **Strict stored shape.** Any extra field in a stored card, member or row makes the whole queue unreadable (empty queue plus toast). The alternative (strip unknown fields and keep the queue) is more forgiving after a future same-version field addition but would silently accept tampered values. I chose strict because the point of T-04-26 is that nothing foreign is ever kept; a later field means a version bump and a `migrate`.
2. **Caps are silent.** When a cap would be passed, the remaining incoming cards are dropped without a notice; their descriptions stay free and the user can press «Agrupar productos» again. The caps (20,000 cards and members) are far above the real sample (about 227 descriptions), so no copy was added. If you want a notice, it needs a new string.
3. **Category rows are not deduplicated by target** (two rows for the same supplier RFC, or the same `productId`, are accepted) and a card `target` is not checked against the accepted products. Both belong to how Plan 04-18 and the accept action use them; the schema only enforces the shapes and unique ids you listed.

## Next Phase Readiness

Ready for the remaining Phase 4 plans: the stored contract already carries the category-suggestion rows (`CategoryChoice`, `CategorySuggestion`), so 04-18 can fill `categories` without a version bump. Observation outside this plan: `ProductsTab` still builds the run with `buildGroupRun(free, [])`, so no accepted-product names travel as context and `target` stays `null` for new batches; D-04 and D-21 describe sending them. I did not touch it.

## Self-Check: PASSED

- Created files exist: `src/stores/safeStorage.ts`, `src/stores/safeStorage.test.ts`, `src/domain/llm/suggestions.test.ts`, `src/stores/suggestionsStore.test.ts`, `tests/support/suggestionsStorage.ts`.
- Commits are ancestors of HEAD: `ccc6939`, `80edcda`, `524ec66`.
- Acceptance criteria of both tasks and `pnpm verify` re-run green (see Verification).

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*
