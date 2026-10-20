---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 01
subsystem: llm
tags: [deepseek, next-route-handler, zod, zustand, base-ui, vitest]

requires:
  - phase: 03-categorias-y-ajustes
    provides: normalizeDescription and ruleMapKey member keys, the unfiltered ledger, the section shell and dialog patterns
provides:
  - Strict zod contracts and limits shared by the browser and the LLM routes (src/domain/llm/contract.ts)
  - Payload builder that is the single source of both the send dialog and the request bodies (src/domain/llm/candidates.ts)
  - Idempotent per-member suggestion queue model (src/domain/llm/suggestions.ts)
  - POST /api/llm/group with the DeepSeek call (fetch + zod, thinking disabled, JSON mode, key only in server code)
  - Browser client, in-memory run store outside the panel, in-memory suggestions store
  - Productos tab (fifth tab) with the entry button, send dialog, run line, stopped Alert and suggestion cards
affects: [04-02, 04-03, 04-04, 04-05, 04-11, 04-12, 04-14, 04-15, 04-18, 04-20]

actuals:
  tokens: 20200
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "What you see is what is sent: SendDialog renders batch.body.items, the same objects postGroup serializes"
    - "Run state outside React: zustand llmRunStore survives tab panel unmounts, generation guard drops late answers"
    - "Route returns only our own error codes and statuses; the upstream status, body and key never leave the server"
    - "Opaque ids i1..iK / p1..pK on the wire, the id-to-member map stays in the browser"

key-files:
  created:
    - src/domain/llm/contract.ts
    - src/domain/llm/candidates.ts
    - src/domain/llm/suggestions.ts
    - src/app/api/llm/group/route.ts
    - src/lib/client/llmClient.ts
    - src/stores/llmRunStore.ts
    - src/stores/suggestionsStore.ts
    - src/features/products/ProductsTab.tsx
    - src/features/products/SendDialog.tsx
    - src/features/products/ProductsTab.test.tsx
  modified:
    - src/stores/sessionStore.ts
    - src/features/shell/AppShell.tsx
    - src/features/shell/AppShell.test.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts

key-decisions:
  - "Plain fetch + zod for DeepSeek (D-29): no openai package, thinking {type: disabled} in a normal object, no suppression comment"
  - "maxDuration 180 and an 80 s attempt timeout (D-28), client deadline 190 s"
  - "A supplier whose only name is its RFC is left out of collectItems so an RFC can never travel as a supplier name"
  - "Stopped Alert text is the failure message (which ends in its own period) plus the fixed sentence about kept suggestions, one space between"
  - "A non-200 JSON answer that is not ours and not a 401 is invalid_response; a non-JSON non-200 (platform page) is upstream_timeout"

patterns-established:
  - "Route-backed fetch stub in jsdom tests: the real POST handler answers /api/llm/group, only the DeepSeek URL is faked"
  - "Dialog content is kept in state after closing so it does not vanish during the fade-out"

requirements-completed: [LLM-01, LLM-03, LLM-06, ACC-04]

coverage:
  - id: D1
    description: "Productos is the third tab of five (Dashboard, Categorías, Productos, Calidad de datos, Importación); the empty screen has no tab"
    requirement: "LLM-01"
    verification:
      - kind: unit
        ref: "src/features/shell/AppShell.test.tsx#lists Dashboard, Categorías, Productos, Calidad de datos and Importación in that order"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#lists Dashboard, Categorías, Productos, Calidad de datos (with the credit note without related as 1 incident) and Importación"
        status: pass
    human_judgment: false
  - id: D2
    description: "Free count caption, none-free state and run-active state of «Agrupar productos» (aria-disabled, ignored presses)"
    requirement: "LLM-01"
    verification:
      - kind: unit
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: the free count (D-03, D-04, D-05, OQ2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Send dialog before every send: summary with singular forms, people line, closed disclosure whose rows are the serialized request body, «No enviar» with initial focus"
    requirement: "LLM-06"
    verification:
      - kind: unit
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: the send dialog (D-03, D-08, LLM-06)"
        status: pass
      - kind: unit
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: the send summary (D-08, OQ1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Only description and supplier name travel (strict body, no RFC, UUID, folio, date or amount); the server-side key is used only in the DeepSeek call and never appears in a response"
    requirement: "LLM-03"
    verification:
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#sends a body with only items and existing, and none of the identifiers of the invoices"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#calls DeepSeek with the documented request and the server-side key"
        status: pass
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#stops the run with upstream_auth on a DeepSeek 401, adds no card and never shows the key"
        status: pass
    human_judgment: false
  - id: D5
    description: "Grouping round trip through the real route into suggestion cards, idempotent per member, invented ids ignored, only free items on a second press, run survives a tab unmount"
    requirement: "LLM-01"
    verification:
      - kind: integration
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: the round trip through the real route (LLM-01, LLM-03, ACC-04, D-29)"
        status: pass
      - kind: unit
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: the queue (D-19)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Stopped run shows our own message, closes with «Cerrar aviso», and a session-ended 401 adds the «Iniciar sesión» link"
    requirement: "LLM-01"
    verification:
      - kind: unit
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: a stopped run (UI-SPEC run failures)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Footer states that descriptions and supplier names go to DeepSeek only on request"
    requirement: "LLM-06"
    verification:
      - kind: unit
        ref: "src/features/shell/AppShell.test.tsx#states in the footer that descriptions and supplier names go to DeepSeek only on request (OQ1)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Visual layout of the five-tab list at 640 to 767 px, the send dialog scroll area (max 288 px) and focus movement, the live DeepSeek behavior with a real key"
    verification: []
    human_judgment: true
    rationale: "Layout, scrolling and the real upstream behavior cannot be asserted in jsdom with a stubbed DeepSeek; the live check belongs to Plan 04-06 and the 640-767 px check is a UI-SPEC verification item"

duration: 26min
completed: 2026-10-20
status: complete
plan_head_before: bfba0cf554af2f230f6f000931d16fa089f91a1c
plan_head_after: 20ecf4f0bf073d6300092a95d05335c40c17ea29
commits: 3
---

# Phase 4 Plan 01: Agrupar productos tracer Summary

**End-to-end «Agrupar productos»: loaded invoices to a strict payload and send dialog, through POST /api/llm/group and a fetch-based DeepSeek call (thinking disabled, JSON mode, key only on the server), back into per-member idempotent suggestion cards in a new Productos tab.**

## Performance

- **Duration:** about 26 min
- **Started:** 2026-10-20T00:25:00Z (approximate; the start time was not captured at launch)
- **Completed:** 2026-10-20T00:51:00Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 16 (10 created, 6 modified)

## Accomplishments

- One real path through every layer the phase adds: `collectItems` over all concepts of all invoices, `buildGroupRun` bodies, `SendDialog` rendered from `batch.body.items`, `useLlmRunStore.startGroupRun`, `postGroup`, the route, DeepSeek, `toProductSuggestions` and `enqueueProductSuggestions`, then the cards.
- Privacy by construction: `z.strictObject` at every level, opaque ids, the id map stays in the browser, and a test serializes the request and asserts no RFC, UUID, folio, date or amount appears (also not in the upstream request text).
- Route answers only with our own codes and statuses (401 session, 400, 413, 500, 502, 503, 504); a DeepSeek 401 becomes 502 `upstream_auth` and the stubbed key never appears in any response.
- Productos is the third of five tabs, with the free count, the none-free and run-active states, summary and people line, run line in an `aria-live` region, stopped Alert with the session-ended link, per-member line captions and the corrected footer.
- Verification: `pnpm eslint .` (0 errors; 1 pre-existing warning), `pnpm typecheck`, `pnpm test` (1728 passed, 65 skipped) and `pnpm build` all pass.

## Task Commits

1. **Task 1: tracer, button to dialog to route to DeepSeek to cards** - `4b4a220` (feat)
2. **Task 2 RED: failing tests for tab list, counts, summary, run line, stopped Alert** - `a1bb09b` (test)
3. **Task 2 GREEN: Productos in the tab list with the surrounding states** - `20ecf4f` (feat)

**Plan metadata:** committed separately with this SUMMARY (docs).

## TDD Gate Compliance

Task 2 (`tdd="true"`):

- **RED (`a1bb09b`):** 15 tests added or updated; the run showed 15 failures on the planned assertions (missing tab «Productos», missing captions, summary, queue heading, footer sentence, `role="alert"`), and the 132 tests that already passed (Task 1 slice and untouched cases) kept passing. No failure was a syntax, import or fixture error. Semantic assessment: each failure was the targeted expectation of its own behavior line.
- **GREEN (`20ecf4f`):** all tests pass, `pnpm verify` equivalent green.
- **REFACTOR:** none needed.

Task 1 is `type="tracer"`; its test and implementation were committed together as the tracer slice (the test was written against the full path and passed on first run). The tracer feedback gate (`end-of-phase` mode, automated-only verify) was satisfied by re-running the verify: Tracer verified end-to-end, expanding.

## Files Created/Modified

- `src/domain/llm/contract.ts` - limits, error codes, `isRetryable`, strict request schema, model output and response schemas
- `src/domain/llm/candidates.ts` - `collectItems`, `freeItems`, `cutText`, `buildGroupRun` (batches, opaque ids, id maps)
- `src/domain/llm/suggestions.ts` - suggestion model, `toProductSuggestions`, idempotent `enqueueProductSuggestions`, `pendingMemberKeys`
- `src/app/api/llm/group/route.ts` - POST handler (checks in order) and the self-contained DeepSeek section at the end of the file
- `src/lib/client/llmClient.ts` - `postGroup` with cancel/timeout and error-code mapping
- `src/stores/llmRunStore.ts` - sequential batch runner, single slot, generation guard
- `src/stores/suggestionsStore.ts` - in-memory pending queue
- `src/features/products/ProductsTab.tsx` - entry button, captions, run line, stopped Alert, queue and cards
- `src/features/products/SendDialog.tsx` - privacy dialog rendered from the request bodies
- `src/features/products/ProductsTab.test.tsx` - 23 tests through the real route handler, only the DeepSeek URL stubbed
- `src/stores/sessionStore.ts`, `src/features/shell/AppShell.tsx` - `productos` tab
- `src/features/shell/AppShell.test.tsx`, `src/features/dashboard/DashboardTab.test.tsx` - five-tab order, Productos panel, footer
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - Phase 4 copy and message helpers

## Decisions Made

- Followed D-29 and D-28 as planned (plain fetch + zod, `maxDuration = 180`, 80 s attempt, 190 s client deadline).
- `stoppedText` joins the failure message and the fixed sentence with a single space because every message already ends in a period; this yields exactly the text of the plan truth.
- `runLine` accepts both `"group"` and `"categorize"` (both strings are final UI-SPEC copy).
- `llmClient`: a non-200 JSON body that is not ours and not a 401 gives `invalid_response` (the plan only specified the 401 and non-JSON cases).
- Route: a model group whose name is empty and whose first id was never sent is dropped (it cannot be named).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] An RFC could travel as a supplier name**
- **Found during:** Task 1 (building `collectItems`)
- **Issue:** `LedgerEntry.supplierName` falls back to the emisor RFC when an invoice has no `Nombre`. The plan builds `supplier` from `supplierName`, so such a supplier would have sent its RFC to DeepSeek, violating the plan's own prohibition and threat T-04-03.
- **Fix:** `collectItems` skips every concept of a supplier whose name is empty or equal to its RFC (case-insensitive). Those descriptions are neither counted nor sent. Covered by a test («never sends the RFC of a supplier that has no name other than its RFC»).
- **Files modified:** `src/domain/llm/candidates.ts`, `src/features/products/ProductsTab.test.tsx`
- **Committed in:** `4b4a220`
- **Needs a user decision:** CFDI 4.0 requires `Emisor@Nombre`, so this should be rare, but what the user should see for such a supplier (a «withheld» notice, a placeholder name) is a design choice I did not make. Plan 04-20's «No se enviarán» group is the natural place; until then these descriptions are silently left out.

**2. [Rule 1 - Test consistency] Task 1 assertion on the supplier line**
- **Found during:** Task 2 (GREEN)
- **Issue:** the Task 1 test asserted the card member line text `Tienda Uno`; Task 2 specifies that the caption «{proveedor} · {n} líneas» takes the place of the supplier name, so the exact-text assertion became wrong.
- **Fix:** the assertions use a prefix match (`/^Tienda Uno/`), keeping the check that the supplier is shown.
- **Files modified:** `src/features/products/ProductsTab.test.tsx`
- **Committed in:** `20ecf4f`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 test consistency)
**Impact on plan:** The first is a correctness and privacy requirement; the second follows directly from the plan's own Task 2 copy. No scope creep.

## Issues Encountered

None blocking. Items the orchestrator or user may want to decide (CLAUDE.md §1: I could not ask, and none changes this plan's acceptance):

- The failure messages for retryable errors (UI-SPEC) say «Pulsa «Reintentar»», but no «Reintentar» button exists until Plans 04-04 and 04-12. In this plan any first failure stops the run and the Alert shows the message; pressing «Agrupar productos» again is the equivalent action (UI-SPEC says Reintentar behaves like the entry button).
- The «Iniciar sesión» link is a plain anchor to `/login`, as the UI-SPEC states. That is a full page load, so the invoices held in memory are lost. Opening it in a new tab, or client-side navigation, would keep them; Plan 04-12 («expired session mid-run») is where this should be decided.
- `es.products.intro2` is used verbatim from the UI-SPEC and says pending suggestions are saved in the browser; that becomes true only with Plan 04-11 (persistence).
- `es.global.privacyLine` is also rendered by the empty dropzone screen, so the new sentence shows there as well.
- A pre-existing lint warning in `src/lib/client/navigation.ts` was left alone (logged in `deferred-items.md`).

## User Setup Required

External service configuration is needed only for the live checks and production: `DEEPSEEK_API_KEY` (required) and `DEEPSEEK_MODEL` (optional, default `deepseek-flash`) as server environment variables (`.env.local` locally, Vercel Production and Preview). Every automated test stubs the upstream call, so no key is needed to run the suite. `.env.example` and the README entry arrive with Plan 04-02.

## Known Stubs

- `buildGroupRun(free, [])`: the `existing` context list is always empty and `ProductSuggestion.target` is always null in this plan. Intentional: accepted products do not exist yet; Plans 04-14 and 04-15 fill them.
- `useSuggestionsStore` is in memory only; persistence is Plan 04-11. The queue is lost on reload for now.
- No accept, reject, rename, merge or split actions on the cards yet (Plans 04-03, 04-05, 04-13 to 04-17).

## Threat Flags

None beyond the plan's threat model. The new endpoint `/api/llm/group` and the outbound call to `api.deepseek.com` are the ones registered as T-04-01 to T-04-07. The in-handler session check (T-04-01 second layer) is Plan 04-02; until then the unchanged fail-closed proxy answers 401 before the handler runs.

## Next Phase Readiness

- Plan 04-02 can move the DeepSeek section of `route.ts` verbatim into `src/lib/server/deepseek.ts` (names and signatures match the interfaces block), add `requireSession`, the coverage invariant and the name normalization, and move `SuggestionCards` into `ReviewQueue.tsx` with its `{ cards, lines }` signature.
- The tab, copy keys, `AppTab` value and message helpers are in place for the later plans.

## Self-Check: PASSED

- Created files exist on disk (10 of 10 found).
- Commits `4b4a220`, `a1bb09b`, `20ecf4f` exist in this branch's history.
- Acceptance greps for both tasks pass; `pnpm eslint .`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass in the worktree.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-20*
