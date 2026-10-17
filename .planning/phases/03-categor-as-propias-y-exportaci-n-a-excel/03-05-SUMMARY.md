---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 05
subsystem: concept-rules-ui
tags: [zustand, reducers, undo, base-ui-select, sonner, concept-rules, tdd]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "Plan 03-04 setConceptRule with RuleResult.previous, normalizeDescription and ruleMapKey, Resolver.explain, ConceptCategorySelect with supplierName and ruleKey props; Plan 03-03 es.categories.undo"
provides:
  - "removeConceptRule(settings, rfc, key) returning the removed rule as previous"
  - "restoreConceptRule(settings, rfc, key, previous) putting back exactly the previous rule or removing the one the change created, refusing silently on a missing category or the 20,000 limit"
  - "ruleLineCounts(entries): Map keyed by ruleMapKey counting every concept line of every entry, summing or not (D-09)"
  - "Store actions removeConceptRule (returns the removed rule) and restoreConceptRule"
  - "ConceptCategorySelect: lineCount prop, «Aplica a {n} líneas de {proveedor}» caption, «Quitar ajuste» item after a separator, change toast with «Deshacer» (6 s)"
  - "Copy: es.invoices.adjustmentRemoved, es.invoices.removeAdjustment, messages categoryChangedToast and appliesToLinesText"
affects: [03-09, 03-10, 03-11, 03-12, 03-13]

actuals:
  tokens: 11900
  tasks: 2
  commits: 4
plan_head_before: e6499070cdaa09d6bf6b9f0af8484722775be3fa
plan_head_after: 733c0c8b51399dae6e29c7fb76ef51285b09d310

tech-stack:
  added: []
  patterns:
    - "Undo data travels with the change: setConceptRule returns previous, the toast closure keeps it, restoreConceptRule puts back exactly that rule (replace in place, so list order is kept) or removes the rule when there was none"
    - "One shared capCodePoints rule in messages.ts for every capped text: max - 1 code points plus «…», so the cap includes the ellipsis and an emoji is never split (aria-label 60, toast 40)"
    - "Caption width does not feed the cell width: w-0 min-w-full on the caption row, so a long supplier name truncates inside TruncatedText instead of stretching the selector cell"

key-files:
  created: []
  modified:
    - src/domain/settings/assignments.ts
    - src/domain/settings/rules.test.ts
    - src/domain/accounting/categories.ts
    - src/domain/accounting/categories.test.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/features/invoices/ConceptCategorySelect.tsx
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "The toast description cap is 40 code points in total including «…» (39 + «…»), the same rule as the 60-point aria-label, extracted into one private capCodePoints helper (user decision 2026-10-17)."
  - "The «Aplica a N líneas» caption counts over the whole ledger (not the visible rows), so it says how far the rule reaches regardless of the active filters (D-09)."
  - "«Quitar ajuste» toasts «Ajuste quitado» only when a rule was actually removed, so a stale click on an already removed rule stays silent; the toast has no action, as the UI-SPEC specifies none."
  - "restoreConceptRule replaces the current rule of the same rfc and key in place; a rule that was removed and is restored is appended at the end. Rule order has no meaning to the resolver, so this is not a behavior difference."

patterns-established:
  - "Tests that read the toast take it from the mocked sonner calls (message + options.action.onClick) and run the undo inside act()"

requirements-completed: [CAT-03]

coverage:
  - id: D1
    description: "Every concept change shows «Categoría de «{descripción, 40 máx. con …}» cambiada a {categoría}» with «Deshacer» for 6 s; Deshacer removes the rule the change created, or puts back exactly the previous rule (also an explicit «Sin categoría»)"
    requirement: "CAT-03"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#Q5: a change shows the toast with Deshacer for 6 s, and the caption counts the lines the rule reaches"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#T-03-36: Deshacer on an already adjusted line puts back exactly the previous rule"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#Q5: Deshacer removes the rule it created and the caption disappears"
        status: pass
      - kind: unit
        ref: "src/domain/settings/rules.test.ts#restoreConceptRule (CAT-03, Q5, T-03-36)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An adjusted line shows «Aplica a {n} líneas de {proveedor}» («1 línea» in the singular) counting every loaded line of that supplier with the same normalized description, including Pago and excluded invoices and lines loaded later"
    requirement: "CAT-03"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#E7 zero-one-many: the caption reads «1 línea» with one matching line and counts loaded lines of later loads"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#D-09: the count includes the lines of a Pago and of an excluded invoice"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/categories.test.ts#ruleLineCounts (D-09)"
        status: pass
    human_judgment: false
  - id: D3
    description: "«Quitar ajuste» appears last after a separator only on adjusted lines, removes the rule and shows «Ajuste quitado»; supplier-derived and implicit lines have neither the item nor the caption"
    requirement: "CAT-03"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#Q5: «Quitar ajuste» comes last after a separator on an adjusted line and removes the rule"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#E7 populated: a supplier-derived or implicit line has no caption and no «Quitar ajuste» item"
        status: pass
    human_judgment: false
  - id: D4
    description: "Long text and untrusted text: the supplier name in the caption truncates through TruncatedText with the full name accessible; markup-like descriptions and supplier names stay text in the caption and the toast"
    requirement: "CAT-03"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#E7 long-text: the caption cuts a long supplier name with TruncatedText and keeps the full name accessible"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#T-03-35: markup-like supplier and description text stays text in the caption and the toast"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#Concept change toast and reach caption (UI-SPEC E7, Q5)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real-browser look of the caption under the selector (12px muted line, truncation of a long supplier name without widening the cell) and the sonner toast with its Deshacer button for 6 s"
    verification: []
    human_judgment: true
    rationale: "jsdom asserts class names and the mocked toast call; the real layout of the w-0 min-w-full caption and the rendered sonner toast need a human look in a browser"

duration: 11min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 05: Undo and reach of concept adjustments Summary

**Concept rule changes now explain and reverse themselves: a «Aplica a N líneas de {proveedor}» caption, «Quitar ajuste» after a separator, and a 6-second «Deshacer» toast that restores exactly the previous rule, backed by pure remove/restore reducers and per-rule-key line counts**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-17T15:02Z
- **Completed:** 2026-10-17T15:13Z
- **Tasks:** 2 of 2
- **Files:** 12 modified, none created
- **Commits:** 4 production commits (RED and GREEN for each task)

## Accomplishments

- Task 1 (TDD): `removeConceptRule` (returns the removed rule as `previous`, same object when absent), `restoreConceptRule` (`previous` null removes the rule, a rule is put back exactly and in place, a missing category or the 20,000 limit leaves the same settings object), `ruleLineCounts` over every concept line of every entry (Pago and excluded included) keyed by `ruleMapKey(supplierRfc, normalizeDescription(descripcion))`, and the two store actions (remove returns the removed rule and writes only when it removed something; restore writes only when something changed). Round-trip tests prove `setConceptRule` then `restoreConceptRule(previous)` is deep-equal to the settings before, with and without an earlier rule, for an explicit «Sin categoría», and for a rule in the middle of the list.
- Task 2 (TDD): `ConceptCategorySelect` takes `lineCount`, shows the 12px muted caption `appliesToLinesText(n)` plus the supplier name in `TruncatedText` on adjusted lines, ends the popup with a separator and «Quitar ajuste» (RotateCcw) only on adjusted lines, toasts «Ajuste quitado» on removal, and after every successful change toasts `categoryChangedToast(...)` for 6 s with a «Deshacer» action bound to `restoreConceptRule(rfc, ruleKey, previous)`. `InvoiceTable` memoizes `ruleLineCounts(ledger)` over the whole ledger and passes the count per line.
- Copy: `adjustmentRemoved`, `removeAdjustment`, `categoryChangedToast` (description cut to 40 code points including «…»), `appliesToLinesText`; `conceptCategoryAria` now shares the same `capCodePoints` helper (behavior unchanged, its existing tests pass).

## Task Commits

1. **Task 1 RED:** `c635800` (test) - 17 failing target tests against neutral stubs, store tests included
2. **Task 1 GREEN:** `cddb98f` (feat) - remove/restore reducers and line counts
3. **Task 2 RED:** `1520c30` (test) - 16 failing target tests (copy and component) against neutral message stubs and the old component
4. **Task 2 GREEN:** `733c0c8` (feat) - caption, «Quitar ajuste», toast with «Deshacer»

**Plan metadata:** the SUMMARY commit that follows (`docs(03-05): complete concept adjustment undo plan`).

## TDD Gate Compliance

- Task 1: RED `c635800` precedes GREEN `cddb98f`. Semantic assessment of the RED evidence: the stubs returned neutral values (`removeConceptRule` returned `previous` null and the unchanged settings, `restoreConceptRule` returned the unchanged settings, `ruleLineCounts` returned an empty Map), so the 17 target tests failed on assertions for the planned behavior (for example the restored settings were not deep-equal to the settings before the change, and `get(...)` returned `undefined` instead of 2), not on imports or syntax. Guard tests that already hold with neutral values (a missing category refused, the same object returned when there is nothing to do, immutability) passed in RED by design.
- Task 2: RED `1520c30` precedes GREEN `733c0c8`. The 16 failing tests are the new copy tests (stubs returned a concatenation) and the component tests (no caption, no «Quitar ajuste», no change toast existed yet); each fails on an assertion about the planned text or element. The test «E7 populated … no «Quitar ajuste» item» passed in RED because the old component never offered the item; it guards the final behavior.
- `gsd_run check tdd-red-evidence` was not run: `workflow.tdd_mode` is not enabled in `.planning/config.json`.

## Deviations from Plan

### Auto-fixed Issues

None needed fixing. Three small interpretation points, none of which changes behavior or scope:

**1. [Interpretation] Truncation helper extracted instead of duplicated**
- **Found during:** Task 2
- **Issue:** the project rule says the toast cap reuses Plan 03-04's `conceptCategoryAria` truncation rule.
- **Fix:** the code-point cut moved into a private `capCodePoints(text, max)` in `messages.ts`, used by both `conceptCategoryAria` (60) and `categoryChangedToast` (40). The existing aria-label tests pass unchanged.
- **Files modified:** `src/lib/copy/messages.ts`
- **Commit:** `733c0c8`

**2. [Interpretation] Silent «Quitar ajuste» on a rule that is already gone**
- **Found during:** Task 2
- **Issue:** the plan says «Quitar ajuste» "removes the rule and shows «Ajuste quitado»" without covering a click whose rule no longer exists (store action returned null).
- **Fix:** the toast is shown only when `removeConceptRule` returned a rule. In the UI the item exists only on adjusted lines, so this is a defensive branch.
- **Files modified:** `src/features/invoices/ConceptCategorySelect.tsx`
- **Commit:** `733c0c8`

**3. [Interpretation] Caption count over the whole ledger**
- **Found during:** Task 2
- **Issue:** `InvoiceTable` receives both the visible `rows` and the whole `ledger`; the plan says "every loaded line" (D-09).
- **Fix:** `ruleLineCounts(ledger)` over the whole ledger, so the count does not change with filters.
- **Files modified:** `src/features/invoices/InvoiceTable.tsx`
- **Commit:** `733c0c8`

---

**Total deviations:** 0 auto-fixed, 3 interpretation points documented above
**Impact on plan:** none.

## Issues Encountered

- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), untouched by this plan and out of scope, as in Plans 03-01 to 03-04.
- Editor diagnostics suggest canonical Tailwind class names (`max-w-105` and others) for pre-existing classes in `InvoiceTable.tsx`; existing tests assert the current names (for example `min-w-[960px]`), so they were left alone.

## Verification

- `pnpm verify`: lint 0 errors (1 pre-existing warning), `next typegen && tsc --noEmit` clean, `vitest run` 1176 passed / 8 skipped (3 files skipped), `next build` succeeded.
- Plan-level `pnpm exec vitest run src/domain/settings/rules.test.ts src/domain/accounting/categories.test.ts src/features/invoices`: covered by the full run above (undo round trip, line counts, every remaining E7 row).
- Acceptance criteria re-run: `export function removeConceptRule` x1, `export function restoreConceptRule` x1, `export function ruleLineCounts` x1, `restoreConceptRule` x4 in `settingsStore.ts`; `ruleLineCounts` x2 in `InvoiceTable.tsx`; `restoreConceptRule` x2 in `ConceptCategorySelect.tsx`; «Quitar ajuste» x1 and «Ajuste quitado» x1 in `es.ts`; no raw-HTML injection in `src/features/invoices` (grep exit 1).
- CLAUDE.md rules: no `any`, `@ts-ignore`, non-null `!` or unverified `as` in the new code or tests.

## Known Stubs

None. The RED-step stubs (`categoryChangedToast`, `appliesToLinesText`, the reducers) were replaced by the real implementations in the GREEN commits.

## Threat Flags

None beyond the plan's threat model. T-03-35 (descriptions and supplier names reach the toast as a sonner string and the caption as React text through `TruncatedText`; hostile-text test and the raw-HTML grep) and T-03-36 (`restoreConceptRule` puts back exactly the `previous` returned by `setConceptRule`; round-trip tests in `rules.test.ts`, `settingsStore.test.ts` and `InvoiceTable.test.tsx`) are mitigated and tested.

## Next Phase Readiness

CAT-03 is complete with the remaining E7 rows (populated, zero-one-many, the toast part of long-text). The Categoría column of the expanded panel, which Plan 03-09 dims under a category filter, now also carries the caption under adjusted lines, so a dimmed row keeps its selector and caption.

## Self-Check: PASSED

- Modified files present on disk (all 12 listed under key-files).
- Commits `c635800`, `cddb98f`, `1520c30` and `733c0c8` are ancestors of HEAD.
