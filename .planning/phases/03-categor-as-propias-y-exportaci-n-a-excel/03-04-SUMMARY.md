---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 04
subsystem: concept-rules-ui
tags: [zustand, reducers, base-ui-select, concept-rules, normalization, tdd]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "Plan 03-01 settings v2 store, Resolver, splitEntry; Plan 03-02 orderedCategories, useCategorySettings; Plan 03-03 category reducers (concept rules already moved and restored on delete)"
provides:
  - "normalizeDescription (D-10, D-26: ñ kept distinct from n) and ruleMapKey (rfc + NUL + key)"
  - "setConceptRule reducer (RuleResult) with previous rule, explicit null, 20,000 limit and unknown-category refusal"
  - "Resolver.explain and CategorySource: concept rule over supplier category over Sin categoría, with the source of each value"
  - "Store action setConceptRule applying only ok results in one set call"
  - "ConceptRow.category / source / ruleKey and conceptRows(entry, mode, resolver)"
  - "ConceptCategorySelect in a new Categoría column of the expanded invoice panel, on every row with concepts"
affects: [03-05, 03-09, 03-10, 03-11, 03-12, 03-13]

actuals:
  tokens: 19000
  tasks: 2
  commits: 3
plan_head_before: 92201fc1efa4cf3a74705b968a20fbf3cba55a7d
plan_head_after: ffca72c11ab5e579f3ba63b5e6c6aebae1f5cd9b

tech-stack:
  added: []
  patterns:
    - "Rule lookup by a Map keyed with ruleMapKey(rfc, normalizeDescription(descripcion)); a stored null is kept so an explicit Sin categoría beats the supplier"
    - "Base UI Select controlled with value null unless the line has its own rule, so any pick (even the supplier's own category) fires a change; trigger content rendered directly through SelectValue children"
    - "Select values encoded as category:<id> and none, so no category id can collide with the action value"

key-files:
  created:
    - src/domain/settings/normalize.ts
    - src/domain/settings/normalize.test.ts
    - src/domain/settings/rules.test.ts
    - src/features/invoices/ConceptCategorySelect.tsx
  modified:
    - src/domain/settings/assignments.ts
    - src/domain/settings/resolver.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/features/invoices/columns.ts
    - src/features/invoices/columns.test.ts
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "normalizeDescription composes to NFC and lowercases, splits on ñ, strips combining marks (NFD, \\p{M}) from each segment, joins with ñ, collapses whitespace and trims; it does not import normalizeSearch (the domain may not import the lib layer, and normalizeSearch turns ñ into n)."
  - "The aria-label cut keeps the description at 60 characters in total: a longer text shows 59 characters plus «…» (code points, so an emoji is never split). The plan said 'cut to 60 characters with …' and did not say whether the ellipsis counts; this reading makes the cap a hard 60."
  - "ConceptCategorySelectProps keeps supplierName and ruleKey as the interfaces block requires, but this plan does not read them; Plan 03-05 uses them for the «Aplica a N líneas de proveedor» caption and «Quitar ajuste»."
  - "setConceptRule refreshes the stored readable description to the text just chosen when it replaces an existing rule."

patterns-established:
  - "Tests that pick a Select item more than once wait for the popup to unmount before the next pick (otherwise two popups expose the same option name)"
  - "jsdom renders the Select chevron as a text glyph in the trigger, so tests read the trigger text through the select-value slot"

requirements-completed: [CAT-03]

coverage:
  - id: D1
    description: "Changing CLORO 1L in the expanded panel moves only that line's amount to Limpieza e higiene in Gasto por categoría; the other lines of the invoice stay in the supplier's category (ROADMAP criterion 1)"
    requirement: "CAT-03"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#CAT-03 criterion 1: changing CLORO 1L moves only that line in «Gasto por categoría»"
        status: pass
      - kind: unit
        ref: "src/domain/settings/rules.test.ts#splitEntry with concept rules (D-12)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The change is a rule for supplier RFC plus normalized description: it applies to every equal line of that supplier (also loaded later) and not to the same text from another supplier"
    requirement: "CAT-03"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#applies the rule to an equal line of the same supplier in another invoice, also when loaded later, and not to another supplier"
        status: pass
      - kind: unit
        ref: "src/domain/settings/rules.test.ts#Resolver.explain (D-09, UI-SPEC Q4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rule key ignores case, repeated or edge spaces and accents but keeps ñ distinct from n (CAFE 1KG vs CAFE 500G, PEÑA vs PENA, Ñ vs ñ, decomposed ñ)"
    requirement: "CAT-03"
    verification:
      - kind: unit
        ref: "src/domain/settings/normalize.test.ts#normalizeDescription (D-10, D-26)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Precedence rule over supplier over Sin categoría; an explicit Sin categoría and the supplier's own category both store a rule; credit-note lines use the same rule and subtract from that category; the selector works on No suma and Excluida rows"
    requirement: "CAT-03"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#choosing «Sin categoría» on a supplier line stores an explicit adjustment shown in the foreground color"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#classifies a credit-note line by the same rule and it subtracts from that category (D-12)"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#works on a «No suma» Pago row and on an «Excluida» row (UI-SPEC Q6)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Trigger states: supplier-derived «{nombre} · del proveedor» muted with a 12px shrink-0 suffix, adjusted in the foreground, implicit «Sin categoría» muted; long names truncate while the suffix stays; aria-label capped at 60 characters; markup-like text stays text"
    requirement: "CAT-03"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#reads «{nombre} · del proveedor» for a supplier-derived value"
        status: pass
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#E7 long-text: the trigger truncates a long category name and keeps the suffix visible"
        status: pass
    human_judgment: false
  - id: D6
    description: "The 20,001st adjusted line is refused with the toast «Llegaste al máximo de 20,000 conceptos ajustados.» and nothing is stored"
    requirement: "CAT-03"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#refuses the 20,001st adjusted line with a toast and stores nothing"
        status: pass
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore setConceptRule (CAT-03)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Real-browser look of the selector: popup at most 288 px and wrapping items, 44 px touch target under 640 px, horizontal scroll of the concept table inside its container on narrow screens"
    verification:
      - kind: integration
        ref: "src/features/invoices/InvoiceTable.test.tsx#E7 overflow: the popup is at most 288 px tall, its items wrap and the touch target grows under 640 px"
        status: pass
    human_judgment: true
    rationale: "Class names are asserted in jsdom; the real popup height, wrapping and the narrow-screen scrolling need a human look in a real browser"

duration: 11min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 04: Per-concept category selector Summary

**Concept rules keyed by supplier RFC plus an ñ-preserving normalized description, resolved rule-first behind the existing Resolver and edited from a new Categoría Select in each line of the expanded invoice row, so changing one line moves only its amount in Gasto por categoría**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-17T14:49:57Z
- **Completed:** 2026-10-17T14:59:46Z
- **Tasks:** 2 of 2
- **Files:** 4 created, 11 modified
- **Commits:** 3 production commits

## Accomplishments

- Task 1 (TDD): `normalizeDescription` (NFC, lowercase, ñ protected, other marks stripped, whitespace collapsed), `ruleMapKey`, the `setConceptRule` reducer (replace in place with `previous`, explicit null, `unknown-category`, `limit` at 20,000, frozen-input test, schema-valid output for an rfc `__proto__`), `Resolver.explain` / `CategorySource` with the `resolve` signature unchanged, and the store action applying only ok results in one `set`. `splitEntry` needed no change: it already calls `resolver.resolve` per concept, so a rule on one of three lines puts that line in the rule's category and the rest plus the rounding difference in the supplier's, and a credit-note line goes negative in the rule's category.
- Task 2: `conceptRows(entry, mode, resolver)` adds `category`, `source` and `ruleKey`; `ConceptCategorySelect` (Select value null unless the line has its own rule, values encoded `category:<id>` / `none`, trigger rendered directly with the `· del proveedor` suffix shrink-0 and 12px muted, popup `max-h-[min(18rem,var(--available-height))]`, wrapping items, `min-w-[240px]`, 44 px under 640 px, `limit` toast); `InvoiceTable` gets a Categoría header after Monto and one selector per line on every row; copy keys and `conceptCategoryAria`.
- End-to-end test with a `DashboardTab` render: a supplier assigned to «Abarrotes y despensa» with CLORO 1L ($116.00) and Jabón ($232.00); picking «Limpieza e higiene» for CLORO 1L shows $116.00 there and $232.00 left in «Abarrotes y despensa».

## Task Commits

1. **Task 1 RED:** `9a53feb` (test) - 29 failing target tests against neutral stubs, including the store-action tests
2. **Task 1 GREEN:** `bb8df2d` (feat) - normalizer, reducer and rule-first resolver
3. **Task 2:** `ffca72c` (feat) - selector, column, conceptRows, copy and tests

**Plan metadata:** the SUMMARY commit that follows (`docs(03-04): complete concept category selector plan`).

## TDD Gate Compliance

- Task 1: RED commit `9a53feb` precedes GREEN `bb8df2d`. Semantic assessment of the RED evidence: the stubs returned neutral values (`normalizeDescription` returned its input, `setConceptRule` returned `limit`, `explain` returned only the supplier category, the store action called the stub), so the 29 target tests failed on assertions for the planned behavior (for example `expected 'PEÑA' to be 'peña'`), not on imports or syntax. Some tests that already hold with neutral values (refusing the 20,001st rule, immutability) passed in RED; they guard the final behavior and do not authorize anything.
- Store action: the `setConceptRule` store action and its tests went into the RED commit (the action delegates to the stub reducer), so the action was a thin delegate whose behavior flipped to green with the reducer.
- Task 2 (UI): the component tests were written after the component, in the same commit; no RED commit exists for them, as in Plans 03-02 and 03-03.
- `gsd_run check tdd-red-evidence` was not run: `workflow.tdd_mode` is not enabled in `.planning/config.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan file list] `roundingDifference` stops using `conceptRows`**
- **Found during:** Task 2
- **Issue:** `conceptRows` now needs a resolver, but `roundingDifference` only needs the active-mode amounts.
- **Fix:** it reads `conceptAmounts` directly for each concepto, with the same null and empty-list behavior as before (existing `roundingDifference` tests unchanged and passing).
- **Files modified:** `src/features/invoices/columns.ts`
- **Commit:** `ffca72c`

**2. [Test environment] jsdom renders the Select chevron as text and keeps a closing popup mounted**
- **Found during:** Task 2
- **Issue:** the first test run read `Sin categoría▼` from the trigger and found two «Limpieza e higiene» options when a second pick started before the first popup unmounted.
- **Fix:** tests read the trigger through the `select-value` slot and wait for the popup to unmount after each pick. No production change.
- **Files modified:** `src/features/invoices/InvoiceTable.test.tsx`

---

**Total deviations:** 2 (1 internal refactor required by the new signature, 1 test-environment adjustment)
**Impact on plan:** none on behavior or scope.

## Issues Encountered

- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), untouched by this plan and out of scope, as in Plans 03-01 to 03-03.
- Editor diagnostics suggest canonical Tailwind class names (`max-w-105` and others) for pre-existing classes in `InvoiceTable.tsx`; existing tests assert the current names (for example `min-w-[960px]`), so they were left alone.

## Verification

- `pnpm verify`: lint 0 errors (1 pre-existing warning), `next typegen && tsc --noEmit` clean, `vitest run` 1133 passed / 8 skipped (3 files skipped), `next build` succeeded.
- Acceptance criteria re-run: normalize test output lists the «PEÑA» and «CAFE 500G» cases; `u0000` x1 in `normalize.ts`; no `@/lib` import in `normalize.ts`; `explain` x4 in `resolver.ts`; `export function setConceptRule` x1; `ConceptCategorySelect` x2 in `InvoiceTable.tsx`; `"category:"` and `setConceptRule` present in the selector; `· del proveedor` x1 and the limit sentence x1 in `es.ts`; no raw-HTML injection in `src/features/invoices`.
- CLAUDE.md rules: no `any`, `@ts-ignore`, non-null `!` or unverified `as` in the new code or tests.

## Known Stubs

None. `ConceptCategorySelect` receives `supplierName` and `ruleKey` without using them, as the plan's interfaces block requires; Plan 03-05 consumes them (caption, «Quitar ajuste», «Deshacer» toast). That is a documented hand-off, not a stub of this plan's goal.

## Threat Flags

None beyond the plan's threat model. T-03-09 (descriptions, category names and RFCs rendered only as React text and attribute values; hostile-text test and the raw-HTML grep), T-03-10 (`ruleMapKey` composite string in a Map, stored rules as a list; `__proto__` covered in reducer, resolver and schema tests) and T-03-11 (`setConceptRule` refuses at 20,000 and the UI toasts; covered in reducer, store and component tests) are mitigated and tested.

## Next Phase Readiness

Ready for Plan 03-05. `ConceptCategorySelect` already carries `supplierName` and `ruleKey` for the «Aplica a N líneas de proveedor» caption and «Quitar ajuste», and `RuleResult.previous` is what the «Deshacer» toast needs to restore the earlier rule. The panel's Categoría column is the cell Plan 03-09 dims under a category filter.

## Self-Check: PASSED

- Created files present on disk: `normalize.ts`, `normalize.test.ts`, `rules.test.ts`, `ConceptCategorySelect.tsx`.
- Commits `9a53feb`, `bb8df2d` and `ffca72c` are ancestors of HEAD.
