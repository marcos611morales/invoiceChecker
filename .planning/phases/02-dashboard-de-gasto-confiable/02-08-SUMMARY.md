---
phase: 02-dashboard-de-gasto-confiable
plan: 08
subsystem: ui
tags: [filters, date-range, base-ui, shadcn, es-MX, tdd]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "Filters, DateRange, normalizeRange (filters.ts), monthsInRange/compareMonths (months.ts), formaPagoName (catalogs.ts), PPD_SIN_COMPLEMENTO (ledger.ts), es.iva copy (Plan 02-07)"
provides:
  - "format.ts: monthShortLabel, monthYearLabel, monthLongLabel, rangeText, formaPagoLabel, normalizeSearch"
  - "messages.ts: noSupplierMatch, noFormaMatch, optionLabel, chipText, removeChipAria, filtersButtonText"
  - "es.filters.* and es.dashboard.* empty-state copy"
  - "DateRangeFilter, thisYearRange, lastMonthsRange"
  - "shadcn copy-ins popover and select"
affects: [02-09, 02-10, 02-11, 02-12, 02-13, 02-14, 02-15]

actuals:
  tokens: 22000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Month labels from static Spanish arrays and string slicing, no Date object (REGLA-05)"
    - "Base UI Select with the items prop so the trigger shows the label before the popup mounts"
    - "Range produced by a picker goes through normalizeRange before onChange (span-equal range is null)"

key-files:
  created:
    - src/features/dashboard/DateRangeFilter.tsx
    - src/features/dashboard/DateRangeFilter.test.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/select.tsx
  modified:
    - src/lib/format.ts
    - src/lib/format.test.ts
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "Shortcuts clip to the loaded span and anchor on span.to, never on today (UI-SPEC decision 1)"
  - "The 'Todo' shortcut calls onChange(null) directly; Este año and Últimos 3 meses go through normalizeRange"
  - "Desde/Hasta labels are real <label htmlFor> elements so the Select triggers expose the accessible names Desde and Hasta"

patterns-established:
  - "Jsdom tests of Base UI Select options: fireEvent.pointerDown then click on the option (a bare click is ignored as an invalid mouse click)"
  - "Select trigger textContent includes the chevron glyph, so assert by inclusion"

requirements-completed: [FILT-01, FILT-04, DASH-10]

coverage:
  - id: D1
    description: "Month, range, forma de pago and search helpers with the exact UI-SPEC filter copy"
    requirement: "FILT-04"
    verification:
      - kind: unit
        ref: "src/lib/format.test.ts#month labels / rangeText / formaPagoLabel / normalizeSearch"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#filter messages"
        status: pass
    human_judgment: false
  - id: D2
    description: "Month-range popover with Desde/Hasta auto-adjust, shortcuts anchored on the last loaded month, span-equal range stored as null"
    requirement: "FILT-01"
    verification:
      - kind: unit
        ref: "src/features/dashboard/DateRangeFilter.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Visual appearance and open/close behavior of the Fechas popover in a real browser (320 px width, select popups, mobile layout)"
    verification: []
    human_judgment: true
    rationale: "Layout and popup positioning cannot be asserted under jsdom; left to the backstop UAT as the plan allows"

plan_head_before: 222ca0a26d8d44c62c4a4deaf5b6dbf478d94ba9
plan_head_after: 444632f034ced0f4ade2e85c05f552920728de84
commits: 4

duration: 35min
completed: 2026-10-15
status: complete
---

# Phase 2 Plan 08: Month range filter and filter label helpers Summary

**Static-array Spanish month/range/forma-de-pago/search helpers, the filter copy contract, and a Desde/Hasta month-range popover (`DateRangeFilter`) with auto-adjust and span-anchored shortcuts, built on newly copied shadcn popover and select.**

## Performance

- **Duration:** about 35 min (interrupted once by an API auth error and resumed)
- **Tasks:** 2 (both TDD)
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments
- `format.ts` gained `monthShortLabel`, `monthYearLabel`, `monthLongLabel`, `rangeText`, `formaPagoLabel` and `normalizeSearch` without any Date object, date library or Intl date formatting; malformed month keys and hostile codes such as `__proto__` come back as plain strings.
- `es.filters`, `es.dashboard` empty-state keys and the six filter message functions carry the exact UI-SPEC texts.
- `DateRangeFilter` lists only the loaded months oldest first, never produces an invalid range, and stores a span-equal range as `null`; `thisYearRange` and `lastMonthsRange` are exported pure helpers.
- popover and select copy-ins added with no change to `package.json` or `pnpm-lock.yaml` and no pre-existing component modified.

## Task Commits

1. **Task 1 RED: filter helper tests** - `bc6c266` (test)
2. **Task 1 GREEN: helpers and copy** - `7c2db5e` (feat)
3. **Task 2 RED: DateRangeFilter tests plus wrong-on-purpose skeleton exports** - `80acebb` (test)
4. **Task 2 GREEN: DateRangeFilter, popover, select** - `444632f` (feat)

**Plan metadata:** the SUMMARY commit follows this file (docs).

## TDD Gate Compliance

- **RED (Task 1):** the target tests failed with `TypeError: <helper> is not a function` for the missing exports (20 failing tests, 28 pre-existing passing). Semantic assessment: the failures are the planned behaviors not yet existing, not syntax or fixture faults. The formal `check tdd-red-evidence` classifier was not run; the evidence is the vitest console output.
- **RED (Task 2):** a skeleton with deliberately wrong exports was committed with the tests so the 17 failing tests fail on assertions (wrong range values, button not found) instead of on a module-not-found load error.
- **GREEN:** both tasks pass; **REFACTOR:** none needed.

## Files Created/Modified
- `src/lib/format.ts` - month, range, forma and search helpers; header comment updated
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - filter and dashboard empty-state copy and message functions
- `src/features/dashboard/DateRangeFilter.tsx` - month-range popover and range helpers
- `src/components/ui/popover.tsx`, `src/components/ui/select.tsx` - shadcn 4.21.4 copy-ins
- tests: `format.test.ts`, `messages.test.ts`, `DateRangeFilter.test.tsx`

## Decisions Made
See `key-decisions` in the frontmatter. No decision outside the plan was made.

## Deviations from Plan

None - plan executed exactly as written. (The "wrong-on-purpose skeleton" in the Task 2 RED commit is a TDD technique, not a plan change; the skeleton was replaced in the GREEN commit.)

## Issues Encountered
- The first jsdom run of the option-selection tests did nothing: Base UI ignores a bare `click` on an option unless a `pointerdown` reached the item. The test helper now fires `pointerDown` then `click`.
- The Select trigger `textContent` includes the chevron glyph, so the trigger value tests assert by inclusion.
- Out of scope, pre-existing: `pnpm lint` reports one warning (unused eslint-disable directive in `src/lib/client/navigation.ts`); not touched.

## Known Stubs
None.

## Threat Flags
None. T-02-32: `formaPagoLabel("__proto__")` and malformed month keys are covered by tests; no raw-HTML injection in `src/features`. T-02-SC: package.json and pnpm-lock.yaml unchanged, only popover.tsx and select.tsx added.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Plan 02-09 can build the searchable Proveedor and Forma de pago filters, chips, the filter bar and the filtered Dashboard on these helpers and copy. The trigger value truncation Tooltip (UI-SPEC E3 long-text, backstop) is not added here; the truncation is a CSS `max-w-[200px] truncate` only.

## Self-Check: PASSED
- Created files exist on disk; commits bc6c266, 7c2db5e, 80acebb, 444632f verified in the branch history.
- `pnpm verify` exit 0 (511 tests passed, 8 skipped, lint 0 errors, typecheck and build clean).

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-15*
