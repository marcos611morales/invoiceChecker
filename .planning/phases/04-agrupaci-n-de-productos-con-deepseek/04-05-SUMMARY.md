---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 05
subsystem: products
tags: [zustand, react, vitest, a11y, settings, accept-flow]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-02)
    provides: ReviewQueue card markup, suggestionsStore queue, pendingMemberKeys
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-03)
    provides: settings version 3 (Product, ProductMember, LIMITS, comparableName, productIntegrityIssues)
provides:
  - "Pure product reducers: validateProductName, acceptProduct, productMemberKeys (src/domain/settings/products.ts)"
  - "settingsStore.acceptProduct and suggestionsStore.removeProduct"
  - "«Aceptar» on every suggestion card with its refusals, toast, announcement and focus move"
  - "Accepted descriptions leave the free count and the next DeepSeek request"
affects: [04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12, delete-category ripple]

actuals:
  tokens: 21000
  tasks: 2
  commits: 3
plan_head_before: 81be1988ce1d06f33c4ea795becc040dcf66d326
plan_head_after: 92b0ea84a0c815f0b0ba6157106b5234eab47b24

tech-stack:
  added: []
  patterns:
    - "Announcement and final focus targets live in the always-mounted parent, because the queue component unmounts when it empties; focus moves before the card is removed, while every target still exists"
    - "Reducer refusals return no settings at all, so a refused accept can never reach the store"

key-files:
  created:
    - src/domain/settings/products.test.ts
    - src/features/products/ReviewQueue.test.tsx
  modified:
    - src/domain/settings/products.ts
    - src/stores/settingsStore.ts
    - src/stores/suggestionsStore.ts
    - src/features/products/ReviewQueue.tsx
    - src/features/products/ProductsTab.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts

key-decisions:
  - "Accept checks in this order: name (empty, too-long, reserved, duplicate), no-members, members-taken (including «No agrupar» marks), limit, then id collision; a repeated member in the input is kept once"
  - "productMemberKeys takes Pick<SettingsData, 'products'> so the tab can call it with only the products slice; a full SettingsData still fits"
  - "When the queue empties, focus goes to the tab heading «Productos» (the queue section is not rendered when empty); while cards remain and the accepted one was the last of the list, it goes to the queue heading"
  - "Announcement grammar: «Queda 1 sugerencia.» for one and «No quedan sugerencias.» for none; the plan only gave «Quedan {n} sugerencias.»"

patterns-established:
  - "Error text under a card's buttons with an id referenced by the button's aria-describedby (no role=alert), cleared on a successful retry"

requirements-completed: [LLM-04]

coverage:
  - id: D1
    description: "Nothing in the settings changes until «Aceptar» is pressed on a card; accepting stores a product with a prod_ id, the card name, no category and the four member fields, and removes the card"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ReviewQueue.test.tsx#«Aceptar» creates the product (LLM-04, D-06, D-09)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/products.test.ts#acceptProduct (D-06, D-09, D-10, D-12)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The toast «Producto «{nombre}» creado» (name cut at 40) and the polite announcement with the remaining count appear after an accept"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ReviewQueue.test.tsx#shows the toast «Producto «{nombre}» creado» with the name cut at 40 characters"
        status: pass
      - kind: integration
        ref: "src/features/products/ReviewQueue.test.tsx#announces the creation and how many suggestions remain"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each refusal (duplicate, reserved, empty, too long, limit, members taken or marked) keeps the card, changes nothing and shows its text linked with aria-describedby"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ReviewQueue.test.tsx#E4: a refused accept keeps the card and says why"
        status: pass
    human_judgment: false
  - id: D4
    description: "After an accept focus lands on the next card name, the queue heading, or the tab heading when the queue empties"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ReviewQueue.test.tsx#focus after an accept (UI-SPEC accessibility)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The accepted product survives a reload and its descriptions stay out of the caption count and of the next request"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/products/ReviewQueue.test.tsx#keeps the product after a reload, and its descriptions stay out of the caption and of what is sent"
        status: pass
    human_judgment: false
  - id: D6
    description: "The visual layout of the Aceptar button and the error line under a card (36px, 44px under 640px, 12px text)"
    verification: []
    human_judgment: true
    rationale: "jsdom does not lay out CSS; tests prove behavior and accessibility wiring, not how the footer looks"

duration: 12min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 05: Accept a suggestion into a saved product Summary

**«Aceptar» on a card now turns it into a persisted product through a pure reducer (no category, one member per description, every taken name, member or limit refused), with the refusal text under the buttons, the toast, a polite announcement and a focus move; accepted descriptions leave the free count and the next DeepSeek request.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-20T15:00:00Z (approx.)
- **Completed:** 2026-10-20T15:12:00Z
- **Tasks:** 2 (Task 1 TDD: RED then GREEN; Task 2 auto)
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `acceptProduct(settings, { name, members }, id)` is a pure reducer: trims the name, keeps the first of any repeated member, copies exactly the four member fields, sets `categoryId: null` (D-06), and refuses with one of `empty | too-long | reserved | duplicate | no-members | members-taken | limit` without returning any settings. `members-taken` covers members of another product and «No agrupar» marks. Every ok result passes `settingsDataSchema` (tested, including an RFC of `__proto__`).
- `settingsStore.acceptProduct` generates the `prod_` id and sets only `products` on ok, so persist writes once and a refusal writes nothing.
- The cards show «Aceptar» (outline, 36px, 44px under 640px, `aria-label` «Aceptar la sugerencia «{nombre}»»). A refusal keeps the card and shows the UI-SPEC text under the buttons, linked by `aria-describedby`; a success removes the card, toasts, announces and moves focus.
- `ProductsTab` now treats a description as taken when it is pending or in an accepted product (`productMemberKeys`), so after a reload accepted descriptions stay out of the caption count and out of what «Agrupar productos» sends (verified in the send dialog list).

## Task Commits

1. **Task 1 RED:** failing tests for the accept reducer (17 failing on the planned assertions) - `58b5730` (test)
2. **Task 1 GREEN:** reducer and store action - `d741e35` (feat)
3. **Task 2:** accept on the cards, copy, queue store, tab wiring, UI tests - `92b0ea8` (feat)

**Plan metadata:** docs commit with this SUMMARY (see git log).

## TDD Gate Compliance

- **RED (`58b5730`):** `src/domain/settings/products.test.ts` against a skeleton `products.ts` with inert return values (so imports resolve). 17 of 17 tests failed, each on the planned assertion (for example `expected { ok: true, name: '  Leche entera  ' } to deeply equal { ok: true, name: 'Leche entera' }`, `expected { ok: false, reason: 'empty' } to deeply equal { ok: false, reason: 'members-taken' }`); none on syntax, import or fixture errors. `semanticAssessment`: the target tests executed and failed on the intended behavior. `gsd_run check tdd-red-evidence` was not run (the verb is not available in this worktree shell and `workflow.tdd_mode` is not enabled).
- **GREEN (`d741e35`):** all 17 pass; `src/domain/settings` and `src/stores` 315 tests pass; typecheck and lint clean.
- **REFACTOR:** none needed.

## Files Created/Modified

- `src/domain/settings/products.ts` - `ProductNameError`, `validateProductName`, `AcceptProductError`, `acceptProduct`, `productMemberKeys`
- `src/domain/settings/products.test.ts` - 17 reducer tests (new)
- `src/stores/settingsStore.ts` - `acceptProduct` action (fresh `prod_` id, sets only `products`)
- `src/stores/suggestionsStore.ts` - `removeProduct(id)` returns the removed card or null
- `src/features/products/ReviewQueue.tsx` - «Aceptar», per-card refusal text, toast, announce and focus callbacks
- `src/features/products/ProductsTab.tsx` - taken = pending united with accepted product keys; sr-only polite region; focusable tab and queue headings
- `src/features/products/ReviewQueue.test.tsx` - 20 jsdom tests (new)
- `src/lib/copy/es.ts` (`es.products.queue`), `src/lib/copy/messages.ts` (`acceptSuggestionAria`, `productCreatedToast`, `productCreatedAnnouncement`, `acceptErrorText`)

## Decisions Made

- Check order and the id-collision refusal (`duplicate`, as `addCategory` does) are mine; the plan listed the refusals but not their precedence.
- The announcement and the final focus target live in `ProductsTab`, not in `ReviewQueue`: the queue section is not rendered when empty, so the component would unmount before a live region or heading inside it could do anything. Focus moves before the card is removed.
- `productMemberKeys` accepts `Pick<SettingsData, "products">` (a widening; a full `SettingsData` still fits).

## Deviations from Plan

### Auto-fixed Issues

None - the plan executed as written. Two plan sentences could not hold literally; they are resolved below and reported for a decision.

**Total deviations:** 0 auto-fixed.

## Items that need a decision

1. **Focus when the queue empties (UI-SPEC and plan say "queue heading").** That heading is in a section that is not rendered when the queue is empty, so it cannot take focus. I focus the tab heading «Productos» (now `tabIndex` -1) in that case, and the queue heading while other cards remain and the accepted card was the last of the list. Alternative: keep an empty queue section briefly rendered. Please confirm or choose.
2. **Announcement wording for one or zero remaining.** The plan gives «Quedan {n} sugerencias.» only. I used «Queda 1 sugerencia.» and «No quedan sugerencias.». Confirm or give the exact text.
3. **"The caption count drops" (plan truth 3) is not literal.** A pending card's members are already excluded from the free count, so pressing «Aceptar» leaves the count unchanged (tested). What changes is after a reload: the queue is in memory (persistence is Plan 04-11), so without the stored product those descriptions would be free again; with it they stay out (tested: 5 free without the product, 3 with it).
4. **Delete-category ripple (hand-off from 04-03) is not yet reachable and not covered here.** Accept always stores `categoryId: null` (D-06), so no product can point at a category in this plan and the "category exists" integrity rule cannot fail yet. Whichever plan lets a product take a category (or the CAT-05 ripple) must also move or clear `products[].categoryId` in `deleteCategory`, `DeleteSnapshot`, `restoreCategory` and the usage counts. Still deferred.
5. **«Agregar a» cards (`target` non-null).** The 04-01 context is always empty, so no such card exists today; if one did, «Aceptar» would create a new product from it. The D-21 add-to-existing path is for a later plan; flagging it so it is not forgotten.

## Issues Encountered

- A pre-existing lint warning in `src/lib/client/navigation.ts` (unused eslint-disable directive) is unchanged and out of scope (already in `deferred-items.md`).
- jsdom's accessible-name computation collapses a blank card name, so the blank-name refusal test finds the button as the first «Aceptar la sugerencia» button instead of by exact name.

## Known Stubs

None added. The queue is still in memory (Plan 04-11 persists it) and cards other than «Aceptar» (Rechazar, Unir, Separar, No agrupar) belong to later plans.

## Threat Flags

None. T-04-48 (a card applied without review, or with taken members) is mitigated and tested: settings change only from the «Aceptar» handler and the reducer returns no change on any refusal. T-04-SC: nothing installed.

## Verification

- `pnpm exec vitest run src/domain/settings/products.test.ts src/features/products` passes (17 + 48 tests in those files).
- `pnpm verify` (lint 0 errors / 1 pre-existing warning, typecheck, 1882 tests passed with 65 skipped, build) exits 0; `pnpm exec tsc --noEmit` and `pnpm exec eslint .` clean apart from that warning.
- Acceptance greps: `acceptProduct` in ReviewQueue.tsx (1), `productMemberKeys` in ProductsTab.tsx (2), `aria-describedby` in ReviewQueue.tsx (1), no `dangerouslySetInnerHTML` in `src/features/products`, no `@/(lib|stores|features|components)` import under `src/domain/settings`.

## Next Phase Readiness

The accept path is ready for the other card actions (reject, merge, split, no-agrupar) and for 04-11 to persist the queue. Open decisions above (focus fallback, announcement wording, category-delete ripple) need an answer before verification.

## Self-Check: PASSED

- Created files exist: `src/domain/settings/products.test.ts`, `src/features/products/ReviewQueue.test.tsx`.
- Commits `58b5730`, `d741e35`, `92b0ea8` exist on this branch (`git rev-list --count 81be198..HEAD` = 3 before the docs commit).

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-20*
