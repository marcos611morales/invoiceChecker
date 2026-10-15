---
phase: 02-dashboard-de-gasto-confiable
plan: 09
subsystem: ui
tags: [filters, cmdk, shadcn, base-ui, popover, chips, es-MX, tdd]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "applyFilters, supplierOptions, formaOptions, isDefaultFilters (filters.ts); session store filter actions; DateRangeFilter, formaPagoLabel, normalizeSearch, es.filters, es.dashboard, message functions (Plan 02-08); es.iva captions (Plan 02-07)"
provides:
  - "MultiSelectFilter: searchable checkbox popover, selectedNames helper"
  - "FilterBar: Fechas, Proveedor, Forma de pago triggers, chips, reset, mobile fold"
  - "DashboardTab: one visible set via applyFilters, mode caption, filtered and no-invoice empty states"
  - "shadcn copy-ins command, checkbox, collapsible, dialog; cmdk 1.1.1 exact"
  - "tests/support/domPolyfills.ts (ResizeObserver, scrollIntoView for cmdk under jsdom)"
affects: [02-10, 02-11, 02-12, 02-13, 02-14, 02-15]

actuals:
  tokens: 28000
  tasks: 2
  commits: 5

tech-stack:
  added: ["cmdk 1.1.1 (exact pin)"]
  patterns:
    - "Multi-select popover: cmdk Command with shouldFilter false, own accent-insensitive filter keeping the data order, handlers close over option keys"
    - "Options expose aria-checked and the listbox aria-multiselectable; the visual Checkbox is aria-hidden"
    - "Desktop trigger row and mobile fold are both rendered and swapped with max-sm:hidden / sm:hidden; tests scope by data-testid"
    - "Everything below the filter bar reads one applyFilters result"

key-files:
  created:
    - src/features/dashboard/MultiSelectFilter.tsx
    - src/features/dashboard/MultiSelectFilter.test.tsx
    - src/features/dashboard/FilterBar.tsx
    - src/features/dashboard/FilterBar.test.tsx
    - src/components/ui/command.tsx
    - src/components/ui/checkbox.tsx
    - src/components/ui/collapsible.tsx
    - src/components/ui/dialog.tsx
    - tests/support/domPolyfills.ts
  modified:
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "The 288 px list cap is max-h-72 on the cmdk list (native scroll), not on a ScrollArea: a Base UI ScrollArea root with only a max-height does not constrain its size-full viewport"
  - "Options carry aria-checked (ARIA 1.2 supports it on option) and the Checkbox is decorative, so the accessible name of a row is not duplicated"
  - "Trigger shows only its label when nothing is selected (flagged assumption), 'Label:' plus a muted summary when something is"
  - "Search is not reset by selection, only when the popover closes"

patterns-established:
  - "Jsdom tests of cmdk import tests/support/domPolyfills first"
  - "Chip text built with chipText over selectedNames(options, selected); suppliers show 2 names, formas 1"

requirements-completed: []
requirements-delivered-shared: [FILT-02, FILT-04, FILT-05, DASH-10]

coverage:
  - id: D1
    description: "Searchable Proveedor and Forma de pago multi-select with '{nombre} ({n})' rows, accent-insensitive search in data order, no-match copy and per-filter clear"
    requirement: "FILT-02"
    verification:
      - kind: unit
        ref: "src/features/dashboard/MultiSelectFilter.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Filter bar with chips, reset, mobile fold and catalog names / PPD sentinel in forma options"
    requirement: "FILT-04"
    verification:
      - kind: unit
        ref: "src/features/dashboard/FilterBar.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dashboard computes one visible set with applyFilters, shows the mode caption and the filtered empty state"
    requirement: "FILT-05"
    verification:
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#Dashboard tab: filters"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real-browser behavior: 288 px scrolling region with 60+ suppliers, 200 px truncation with Tooltip, popover positioning, mobile fold layout"
    verification: []
    human_judgment: true
    rationale: "Layout, scrolling and tooltip hover cannot be asserted under jsdom; these are the two backstop statements of the plan"

plan_head_before: e3d97f62e527d4d0eee6f9fac35646a12c78a9fd
plan_head_after: e6023e02eb599627849e72b8a6b09882a6979693
commits: 5

duration: 25min
completed: 2026-10-15
status: complete
---

# Phase 2 Plan 09: Proveedor and Forma de pago filters and the filtered Dashboard Summary

**Searchable cmdk multi-select popovers for Proveedor and Forma de pago, a filter bar with aria-live chips, reset and mobile "Filtros · n" fold, and a Dashboard that feeds one applyFilters result to everything below the bar, with the mode caption and the "no invoice matches" state.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-10-15T19:42:00Z (approx.)
- **Completed:** 2026-10-15T20:08:00Z (approx.)
- **Tasks:** 2 (both TDD)
- **Files modified:** 13 (9 created, 4 modified)

## Accomplishments
- `MultiSelectFilter`: cmdk with its own filtering and sorting off, accent-insensitive search that keeps the data order, rows "{nombre} ({n})", whole-row toggle (also Enter), checked rows that do not move, per-filter clear footer, muted trigger summary truncated at 200 px with a Tooltip.
- `FilterBar`: three triggers (Fechas only when a span exists), one chip per active dimension ("Proveedor: n1, n2 +k", "Forma de pago: n1 +k", "Fechas: rango") with a "Quitar filtro {dimensión}" button inside an aria-live polite group, "Quitar filtros" only off-default, below 640 px a single 44 px "Filtros · n" button over a Collapsible while chips stay visible.
- `DashboardTab`: `applyFilters(ledger, filters, span)` memoized, order D-03 (bar, caption, content), "Ninguna factura coincide con los filtros" with a reset button replacing the content while the bar stays, "Ninguna factura válida" with no bar when the ledger is empty.
- Suppliers are keyed by RFC (two suppliers with one name stay apart), formas always show the SAT name, "Forma de pago {código}" for unknown codes and "Por definir (sin complemento de pago)" for the PPD sentinel.

## Task Commits

1. **Task 1 setup: cmdk 1.1.1 exact + command/checkbox/collapsible/dialog copy-ins** - `33c2cc6` (chore)
2. **Task 1 RED: MultiSelectFilter tests plus placeholder skeleton** - `d5fbfec` (test)
3. **Task 1 GREEN: MultiSelectFilter** - `7f5bd3a` (feat)
4. **Task 2 RED: FilterBar and Dashboard filter tests plus null skeleton** - `c192d5f` (test)
5. **Task 2 GREEN: FilterBar and filtered DashboardTab** - `e6023e0` (feat)

**Plan metadata:** the SUMMARY commit follows this file (docs).

## TDD Gate Compliance

- **RED (Task 1):** 19 of 20 tests failed (only the "label only" trigger test passed against the skeleton) with `Unable to find ... role "option" / placeholder text` and wrong trigger assertions, i.e. the planned behaviors do not exist yet; not syntax, import or fixture faults. The formal `check tdd-red-evidence` classifier was not run; the evidence is the vitest console output.
- **RED (Task 2):** 29 tests failed on the same kind of missing-element assertions against a null-rendering `FilterBar` and the unchanged `DashboardTab`; pre-existing tests kept passing.
- **GREEN:** Task 1 20/20, Task 2 91/91 in `src/features/dashboard`, full suite 561 passed (8 pre-existing skips). One test was adjusted in the Task 1 GREEN commit (checked state asserted through `aria-checked` on options after the decision to make the Checkbox decorative) and one in the Task 2 GREEN commit (see Deviations).
- **REFACTOR:** none needed.

## Files Created/Modified
- `src/features/dashboard/MultiSelectFilter.tsx` - searchable checkbox popover and `selectedNames`
- `src/features/dashboard/FilterBar.tsx` - triggers, chips, reset, mobile fold
- `src/features/dashboard/DashboardTab.tsx` - visible set, caption, empty states
- `src/features/dashboard/*.test.tsx` - 20 + 21 + 8 new tests
- `src/components/ui/command.tsx`, `checkbox.tsx`, `collapsible.tsx`, `dialog.tsx` - shadcn 4.21.4 copy-ins (dialog is a dependency of command; Plan 02-12 skips its own add)
- `tests/support/domPolyfills.ts` - ResizeObserver and scrollIntoView stubs for cmdk under jsdom
- `package.json`, `pnpm-lock.yaml` - cmdk 1.1.1 exact plus its radix and react-remove-scroll transitive packages

## Decisions Made
See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ScrollArea replaced by the cmdk list's own max-h-72**
- **Found during:** Task 1 (MultiSelectFilter)
- **Issue:** The plan asks for "a ScrollArea list capped at 288 px". A Base UI ScrollArea root with only a max-height does not bound its `size-full` viewport, so it would grow instead of scrolling; cmdk also scrolls the highlighted row into view only inside its own list element.
- **Fix:** `CommandList` with `max-h-72` (288 px) and its native `overflow-y-auto`; the acceptance test asserts the `max-h-72` class.
- **Files modified:** src/features/dashboard/MultiSelectFilter.tsx
- **Committed in:** 7f5bd3a

**2. [Rule 3 - Blocking] shadcn CLI overwrite prompt and caret pin**
- **Found during:** Task 1 setup
- **Issue:** `shadcn add ... -y` still stops at "button.tsx already exists" without a TTY and exits before writing `command.tsx`; `pnpm add cmdk@1.1.1 --save-exact` left `^1.1.1` in package.json because cmdk was already added by the CLI.
- **Fix:** Re-ran the CLI answering "no" to every overwrite prompt (only additions: command, dialog; checkbox and collapsible were written by the first run); edited package.json to `"cmdk": "1.1.1"` and re-ran `pnpm install` so the lockfile specifier is `1.1.1`. `git diff --name-only -- src/components/ui` is empty (no pre-existing component modified).
- **Committed in:** 33c2cc6

**3. [Rule 3 - Blocking] Acceptance grep on browser storage covers test files**
- **Found during:** Task 2
- **Issue:** The acceptance criterion `! grep -rnE "localStorage|sessionStorage" src/features/dashboard` also scans tests, and my first "memory only" test used `window.localStorage` (which CLAUDE.md-era conventions also forbid: settings are read through `tests/support/settingsStorage.ts`).
- **Fix:** The test now reads the persisted settings through `readStoredSettings` and asserts they hold only `ivaMode`.
- **Committed in:** e6023e0

---

**Total deviations:** 3 auto-fixed (3 blocking). **Impact on plan:** no scope change; deviation 1 changes the scroll container element only.

## Issues Encountered
- cmdk needs `ResizeObserver` and `scrollIntoView` in jsdom; supplied by `tests/support/domPolyfills.ts`.
- Out of scope, pre-existing: `pnpm lint` warns about one unused eslint-disable directive in `src/lib/client/navigation.ts`; not touched.
- Space does not toggle a row while the search box has focus (it types a space); Enter and click do. UI-SPEC says "Space/Enter toggle"; this is a cmdk behavior left as is.

## Known Stubs
None.

## Threat Flags
None. T-02-15: option labels, chips and summaries are React text nodes; hostile names are tested in MultiSelectFilter and FilterBar; no raw-HTML injection in `src/features`. T-02-SC: cmdk pinned at 1.1.1, lockfile adds only cmdk and its radix / react-remove-scroll / aria-hidden transitive packages, no postinstall scripts, recharts and react-is not installed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Plan 02-10 onwards can add blocks inside the non-empty branch of `DashboardTab` (replace the `KpiRow`-only content); they all read `visible`. `FilterBar` takes the unfiltered ledger so option counts stay independent of the other filters. The two backstop statements (288 px scrolling with 60+ suppliers, 200 px truncation with Tooltip) need a real-browser check in the phase UAT.

## Self-Check: PASSED
- Created files exist on disk; commits 33c2cc6, d5fbfec, 7f5bd3a, c192d5f, e6023e0 are in the branch history.
- `pnpm verify` exit 0 (561 tests passed, 8 skipped; lint 0 errors; typecheck and build clean); acceptance greps pass (shouldFilter false, applyFilters, aria-live, no raw-HTML injection, no browser-storage access in src/features/dashboard, no recharts in package.json, cmdk 1.1.1 exact).

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-15*
