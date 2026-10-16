---
phase: 02-dashboard-de-gasto-confiable
plan: 15
subsystem: ui
tags: [shell, tabs, zustand, react, alert, focus-management, playwright, vitest, tdd]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "QualityTab and qualitySummary (02-14), InvoiceTable with data-row-id and expand-{uuid} (02-13), session store focusRequest/importFocus (02-06), AppShell TABS (02-07)"
provides:
  - "useLedger: the single ledger builder shared by Dashboard, Calidad de datos and the shell counter"
  - "Three-tab AppShell (Dashboard, Calidad de datos, Importacion) with the ' · n' incident counter and singular/plural accessible name"
  - "Dashboard Alert for amount-changing incidents and the hidden-by-filters Alert with Quitar filtros"
  - "Ver factura flow in InvoiceTable (page jump, panel, centred scroll, chevron focus, request cleared) and Ver en Importacion flow in ReportAccordions"
  - "Phase 2 closing checks: extended smoke, DEV-03 traceability greps, privacy guard"
affects: [phase-03 export and LLM grouping (shell and tabs are final), verify-work UAT of phase 2]

actuals:
  tokens: 21000
  tasks: 3
  commits: 5
plan_head_before: e2a8a02259b1bd3cf28429df79e1e0c8754b275e
plan_head_after: ab84cf8fbb6fb6e666c9933816b26959a4d90de6

tech-stack:
  added: []
  patterns:
    - "One-shot UI request (focusRequest, importFocus) resolved with derived state during render guarded by a handled marker, DOM side effects and request clearing in an effect"
    - "Shell reads the same qualitySummary(ledger) as the Dashboard: total feeds the tab counter, amountChanging feeds the notice"

key-files:
  created:
    - src/features/dashboard/useLedger.ts
    - src/features/shell/AppShell.test.tsx
  modified:
    - src/features/shell/AppShell.tsx
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/features/quality/QualityTab.tsx
    - src/features/invoices/InvoiceTable.tsx
    - src/features/invoices/InvoiceTable.test.tsx
    - src/features/report/ReportAccordions.tsx
    - src/features/report/ImportReport.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - e2e/smoke.spec.ts

key-decisions:
  - "Hidden-by-filters Alert uses the Info icon (muted) and the existing es.filters.reset text 'Quitar filtros'; the plan fixes only the sentence and the button label"
  - "A request for a uuid that is not loaded is cleared both by InvoiceTable (standalone) and by DashboardTab (covers the case where the filters leave no table mounted)"
  - "Muted icons inside Alert use the important modifier (text-muted-foreground!) because the Alert base class forces svg text-current"
  - "Smooth scrolling is used only when matchMedia exists and reduced motion does not match; otherwise behavior auto"

patterns-established:
  - "Tab trigger text and accessible name come from qualityTabLabel / qualityTabAria; the TABS array stays at module scope"
  - "Dashboard notices live at the top of the Dashboard column, in this order: incidents notice, hidden-invoice notice, filter bar"

requirements-completed: [CAL-01, FILT-05, REGLA-08, DEV-03]

coverage:
  - id: D1
    description: "Tab list Dashboard, Calidad de datos, Importacion; counter ' · n' only above zero including the informational D-46 type; accessible name with '1 incidencia' / '{n} incidencias'"
    requirement: CAL-01
    verification:
      - kind: automated_ui
        ref: "src/features/shell/AppShell.test.tsx#AppShell tabs (D-01, D-04)"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#Calidad de datos tab texts (D-04, A-7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dashboard Alert 'Hay incidencias que cambian los montos.' with 'Ver Calidad de datos' only while an amount-changing incident exists; default variant, muted icon, not dismissible, never raised by D-46, $0, rounding, PPD or exclusions"
    requirement: CAL-01
    verification:
      - kind: automated_ui
        ref: "src/features/dashboard/DashboardTab.test.tsx#Dashboard tab: amount-changing incidents notice (D-04, D-35, D-46)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ver factura reaches a row on another page of the current sort, opens it, centres it (no smooth scroll under reduced motion), focuses its chevron, clears the request and does not repeat on re-sort"
    requirement: FILT-05
    verification:
      - kind: automated_ui
        ref: "src/features/invoices/InvoiceTable.test.tsx#InvoiceTable focus request (D-33, Pitfall 17)"
        status: pass
    human_judgment: false
  - id: D4
    description: "When filters hide the requested invoice nothing changes silently: Alert 'La factura {folio} no se ve porque los filtros la ocultan.' with Quitar filtros, which reveals the row; editing a filter clears the request; unknown uuid is cleared silently"
    requirement: FILT-05
    verification:
      - kind: automated_ui
        ref: "src/features/dashboard/DashboardTab.test.tsx#Dashboard tab: Ver factura flow and the hidden-by-filters Alert (FILT-05, D-33)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ver en Importacion opens the Duplicados or Rechazados section of the report and clears the request, leaving other sections as the user left them"
    requirement: CAL-01
    verification:
      - kind: automated_ui
        ref: "src/features/report/ImportReport.test.tsx#ImportReport import focus (D-32)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Volver a incluir in Excluidas and Sustituidas recomputes figures, chips, counter and alerts in the same render (single useLedger)"
    requirement: REGLA-08
    verification:
      - kind: automated_ui
        ref: "src/features/dashboard/DashboardTab.test.tsx#shows for an applied substitution and goes away when the original is re-included"
        status: pass
      - kind: automated_ui
        ref: "src/features/shell/AppShell.test.tsx#updates the counter when an exclusion adds an incident row"
        status: pass
    human_judgment: false
  - id: D7
    description: "Production-build flow: Dashboard active after load, Sin IVA changes Gasto total, Calidad reachable, only invoicechecker:settings in localStorage and nothing in sessionStorage, no request carries XML; real 143-file sample still loads"
    requirement: DEV-03
    verification:
      - kind: e2e
        ref: "e2e/smoke.spec.ts#carpeta sintetica (4 passed with E2E_FACTURAS_DIR set, including muestra real)"
        status: pass
    human_judgment: false
  - id: D8
    description: "DEV-03 traceability: anon-ingreso-ieps, anon-ingreso-descuento, withTipoCambio and the 2025-08-31T21:20:35 boundary appear in domain tests; Facturas/ is git-ignored and untracked; no fetch/XHR/beacon in domain, stores, dashboard, invoices, quality; no storage API outside settingsStore and the theme code"
    requirement: DEV-03
    verification:
      - kind: other
        ref: "acceptance greps of Task 3 plus FACTURAS_DIR=<sample> vitest run tests/fixtures.guard.test.ts"
        status: pass
    human_judgment: false
  - id: D9
    description: "Visual and responsive behavior no unit test sees: tab list at 360 px with 'Calidad de datos · 99', Alert layout and wrapping, centred scroll feel, focus ring on the chevron, the full end-of-phase human check list of Task 3 (items 1 to 8)"
    verification: []
    human_judgment: true
    rationale: "jsdom proves classes, DOM order, focus and call arguments, not pixels; widths, sticky bars, chart contrast and touch popovers need a real browser pass"

duration: 45min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 15: Shell wiring, Ver factura flows and closing checks Summary

**Third Calidad de datos tab with an incident counter, a Dashboard Alert for amount-changing incidents, the Ver factura jump (page, panel, centred scroll, chevron focus) with a hidden-by-filters Alert, Ver en Importacion section focus, and the Phase 2 end-to-end and DEV-03 closing gates.**

## Performance

- **Duration:** about 45 min wall clock, including an interruption by an API usage limit between Task 1 and Task 2
- **Started:** 2026-10-16T00:16:00Z (approximate, recorded after the first reads)
- **Completed:** 2026-10-16T00:57:00Z
- **Tasks:** 3 (Tasks 1 and 2 TDD)
- **Files modified:** 14 (2 created, 12 modified, 0 deleted)

## Accomplishments

- `useLedger` replaces three copies of `buildLedger(...)` (Dashboard, Quality tab, and the new shell counter); `buildLedger` is no longer called from any feature component.
- The tab list reads Dashboard, Calidad de datos, Importacion. The Calidad trigger shows ` · n` only above zero and is named "Calidad de datos, 1 incidencia" / "{n} incidencias"; n is `qualitySummary(ledger).total`, so the informational D-46 type counts but never raises the Dashboard notice (`amountChanging`).
- "Ver factura" is resolved in `InvoiceTable` with derived state during render (index read from `getPrePaginatedRowModel()`, page = floor(index / 50), panel added to the open set, nonce recorded) and an effect that only touches the DOM: `scrollIntoView({ block: "center" })`, chevron focus, `clearFocusRequest`. A uuid that is not loaded is cleared at once.
- If the filters hide the invoice the Dashboard shows the Alert with "Quitar filtros" (`clearFilters` only); filters stay untouched until pressed, after which the table consumes the still-pending request.
- `ReportAccordions` opens Duplicados or Rechazados from `importFocus` (derived state guarded by the last request seen, cleared from an effect).
- Smoke test extended; real-sample test passes locally (see Verification).

## Task Commits

1. **Task 1 RED: failing tests for the tab counter and notice** - `5946d94` (test)
2. **Task 1 GREEN: tab, counter, useLedger, incidents notice** - `2ed1b45` (feat)
3. **Task 2 RED: failing tests for Ver factura and Ver en Importacion** - `535c658` (test)
4. **Task 2 GREEN: row jump, hidden-by-filters Alert, import focus** - `c3e8574` (feat)
5. **Task 3: smoke flow, storage key check** - `ab84cf8` (test)

**Plan metadata:** committed with this SUMMARY (docs).

## TDD Gate Compliance

- **RED 1:** `5946d94`, 22 tests failed on assertions (for example `expected '' to be 'Calidad de datos'` against the typed stubs of `qualityTabLabel`/`useLedger`, `Unable to find an accessible element with the role "tab"`, `expected [ 'Dashboard', 'Importación' ] to deeply equal [...]`). Semantic assessment: the targets ran and failed on the planned assertions, not on import, syntax or fixture faults. `workflow.tdd_mode` is not enabled and the plan is `type: execute`, so `gsd check tdd-red-evidence` was not run.
- **GREEN 1:** `2ed1b45`, 842 tests pass; one older test ("lists Dashboard and Importacion for now") was updated to the three-tab list.
- **RED 2:** `535c658`, 20 tests failed on assertions (`expected null not to be null`, `expected "scrollIntoView" to be called 1 times, but got 0 times`, `expected { uuid: 'NOT-LOADED', nonce: 7 } to be null`, `toHaveAttribute("aria-expanded", "true")`); three guard tests (filters untouched, row filtered out keeps the request) passed already by design.
- **GREEN 2:** `c3e8574`, 864 tests pass.
- No REFACTOR commit was needed.

## Files Created/Modified

- `src/features/dashboard/useLedger.ts` - memoized ledger from invoices, excluded, restored
- `src/features/shell/AppShell.tsx` - Calidad entry in module-scope `TABS`, counter and accessible name
- `src/features/dashboard/DashboardTab.tsx` - incidents notice, hidden-by-filters Alert, unknown-request cleanup
- `src/features/quality/QualityTab.tsx` - uses `useLedger`
- `src/features/invoices/InvoiceTable.tsx` - focus request resolution, scroll, chevron focus
- `src/features/report/ReportAccordions.tsx` - `importFocus` consumption
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - `es.dashboard.incidentsNotice`, `es.dashboard.seeQuality`, `qualityTabLabel`, `qualityTabAria`, `hiddenInvoiceNotice`
- `e2e/smoke.spec.ts` - Phase 2 flow and storage key assertions
- tests: `AppShell.test.tsx` (new), `DashboardTab.test.tsx`, `InvoiceTable.test.tsx`, `ImportReport.test.tsx`, `messages.test.ts`

## Decisions Made

See frontmatter `key-decisions`. In short: Info icon and the existing "Quitar filtros" text for the hidden-invoice Alert; double cleanup of unknown requests; `!` modifier for muted icons in Alert; smooth scroll only when reduced motion is explicitly not requested.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dashboard test asserted the Phase 2 tab list before Calidad existed**
- **Found during:** Task 1 (GREEN)
- **Issue:** "lists Dashboard and Importacion for now (Calidad arrives in Plan 02-15)" fails once the third tab exists.
- **Fix:** The test now expects `["Dashboard", "Calidad de datos · 1", "Importación"]` (the Egreso without related is one incident).
- **Files modified:** src/features/dashboard/DashboardTab.test.tsx
- **Committed in:** 2ed1b45

**2. [Rule 2 - Missing critical] Unknown focus request cleared also from DashboardTab**
- **Found during:** Task 2 (GREEN)
- **Issue:** The plan clears a request for a uuid that is not loaded in `InvoiceTable`, but when the filters leave no row the table is not mounted, so the request would linger and could jump to an invoice loaded later (T-02-29).
- **Fix:** `DashboardTab` clears it in an effect as well.
- **Files modified:** src/features/dashboard/DashboardTab.tsx
- **Committed in:** c3e8574

---

**Total deviations:** 2 auto-fixed (1 bug in a test, 1 missing critical)
**Impact on plan:** none on scope.

## Issues Encountered

- `pnpm lint` still prints one warning in `src/lib/client/navigation.ts` (unused eslint-disable directive). It predates this plan and is out of scope; not fixed.
- A single Bash call with `git` chained to other commands, or with `cat >> file <<EOF`, was refused by the worktree sandbox; commands were split or run through short scripts. No effect on the result.

## Verification

- `pnpm verify` (eslint, next typegen + tsc, vitest 864 passed / 8 skipped, next build) exits 0.
- Playwright (`pnpm exec playwright test`, test-only defaults from the config): 3 passed, 1 skipped. With `E2E_FACTURAS_DIR` pointing at the real sample (read-only, nothing copied or printed): 4 passed, including "muestra real (local)".
- `FACTURAS_DIR=<real sample> pnpm exec vitest run tests/fixtures.guard.test.ts`: 1 passed (it is skipped in the worktree without that variable).
- Acceptance greps: `useLedger` in DashboardTab (2), QualityTab (2), AppShell (2); `buildLedger` in DashboardTab and QualityTab 0; destructive color classes in DashboardTab 0; `clearFocusRequest` 4 and `scrollIntoView` 1 in InvoiceTable; `importFocus` 7 in ReportAccordions; `setRange/setSuppliers/setFormas(` in DashboardTab 0; `invoicechecker:settings` 1 and `Montos con o sin IVA` 1 in the smoke; `anon-ingreso-ieps`, `anon-ingreso-descuento`, `withTipoCambio` and `2025-08-31T21:20:35` each found in domain tests; `Facturas/` ignored and `git ls-files Facturas` empty; no fetch/XHR/beacon in the listed folders; storage API outside settingsStore, tests and theme: 0 files; no raw-HTML injection in `src/features`.

## Known Stubs

None. The RED-phase stubs (`useLedger`, message builders) were replaced in the GREEN commit.

## Threat Flags

None. No new endpoint, auth path or storage. T-02-28 (folio only as React text, hostile-folio test), T-02-29 (request cleared when handled or unknown, re-sort test), T-02-30 (greps and e2e storage key list), T-02-SC (no package changed) all hold.

## UI text and choices for the user to confirm

- The hidden-by-filters Alert uses the `Info` icon (the plan fixes only the sentence and the button label "Quitar filtros"); the incidents notice uses `TriangleAlert` as UI-SPEC says. Both icons are muted.
- Layout of the two Alerts (description on one row, link-style button on the second row under the text) is mine; the plan does not specify it.
- A-7 stands for UAT: "1 incidencia" for one row and "{n} incidencias" otherwise.
- The smoke asserts that Sin IVA changes `kpi-gasto`; it does not assert a specific amount.

## Human judgment (end-of-phase UAT)

All eight items of the Task 3 human check remain for a person: the 143-file real-sample pass (figures, filters, exclusion, Calidad flows), the 360 px width and sticky sub-bar, light/dark chart contrast, and touch popovers. One point deserves attention: UI-SPEC E1 says the three tabs fit 360 px with 16 px padding and 8 px gap. A rough estimate (14 px semibold, about 7 px per character, about 400 px for "Dashboard", "Calidad de datos · 99", "Importación" plus padding and gaps, against about 312 px of content width) suggests the list may overflow at 360 px when the counter is two digits. The tab triggers are `flex-none` and `whitespace-nowrap`, so they will not wrap; check this at 360 px and, if it overflows, decide between a smaller padding, shorter labels or a scrolling list (not changed here because the plan fixes padding and no-wrap).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 is functionally complete: KPIs and rules, mode switch, filters, exclusion plus the Calidad panel, and the Vitest/anonymized-XML gate are reachable and covered.
- Requirement IDs CAL-01, FILT-05, REGLA-08 and DEV-03 are recorded in the frontmatter; `.planning/REQUIREMENTS.md`, STATE.md and ROADMAP.md were not touched (the orchestrator owns them).

## Self-Check: PASSED

- Created files exist: `useLedger.ts`, `AppShell.test.tsx`.
- Commits `5946d94`, `2ed1b45`, `535c658`, `c3e8574`, `ab84cf8` are on the branch and descend from `e2a8a02`.
- `pnpm verify` exits 0; no file deleted in any task commit.

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-16*
