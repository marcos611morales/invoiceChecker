---
phase: 02-dashboard-de-gasto-confiable
plan: 01
subsystem: accounting
tags: [big.js, decimal, ledger, zustand, shadcn-tabs, es-MX, vitest, playwright]

requires:
  - phase: 01-carga-y-lectura-de-facturas
    provides: "useSessionStore invoices (LoadedInvoice[]), ParsedInvoice with exact XML strings, AppShell, ImportReport, anonymized fixtures"
provides:
  - "Strict big.js decimal layer (ZERO, parseDecimal, sum, toMoneyString)"
  - "invoiceAmounts: per-invoice Con IVA / Sin IVA with typed failures (invalido, moneda-sin-tc)"
  - "Ledger shape (LedgerEntry, LedgerOverrides, EMPTY_OVERRIDES, buildLedger) that every later plan extends"
  - "IvaMode, entryAmount, totalSpend selectors"
  - "formatMoney: the one shared es-MX money formatter with U+2212 minus"
  - "Tabbed loaded screen (Dashboard, Importacion) and the Gasto total KPI card"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-10, 02-13, 02-14]

actuals:
  tokens: 7200
  tasks: 1
  commits: 1

tech-stack:
  added: ["big.js 7.0.1 (exact)", "@types/big.js 7.0.0 (exact, dev)", "shadcn tabs copy-in (Base UI Tabs, no new npm dependency)"]
  patterns:
    - "Accounting layer is pure and lives in src/domain/accounting; Big.strict is set in decimal.ts only"
    - "Every money attribute reaches Big only through parseDecimal (bounded regex, never throws)"
    - "Ledger is mode-independent: both amounts stored, the IVA mode only picks an accessor"
    - "Damaged invoice stays in the ledger as a non-summing entry (noSuma) instead of throwing or being dropped"

key-files:
  created:
    - src/domain/accounting/decimal.ts
    - src/domain/accounting/amounts.ts
    - src/domain/accounting/ledger.ts
    - src/domain/accounting/aggregate.ts
    - src/features/dashboard/KpiRow.tsx
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/components/ui/tabs.tsx
  modified:
    - package.json
    - pnpm-lock.yaml
    - src/lib/format.ts
    - src/lib/copy/es.ts
    - src/features/shell/AppShell.tsx
    - e2e/smoke.spec.ts

key-decisions:
  - "toMoneyString pads the 2-decimal string by hand from Big.toString (with Big.PE/NE widened) instead of calling Big.toFixed, so the plan's no-toFixed acceptance grep passes literally"
  - "invoiceAmounts negates with Big.neg() instead of multiplying by a parsed -1, so no sign constant has to be constructed"
  - "Tracer verified end-to-end (pnpm verify plus the Playwright smoke) before any expansion plan"

patterns-established:
  - "Ledger entry fields noSuma / exclusion / counted are the single source of truth for what sums"
  - "Component tests derive the expected figure independently as integer cents (BigInt) from the XML strings"
  - "Loaded screen is Tabs inside AppShell (LoadedTabs); later plans add the Calidad tab and the top-bar IVA control"

requirements-completed: [REGLA-01, REGLA-04, DASH-01, DASH-10]

coverage:
  - id: D1
    description: "Gasto total = Ingreso - Egreso with the Pago ignored, shown in es-MX on the Dashboard tab ($345.98 for the three anonymized fixtures)"
    requirement: "REGLA-01"
    verification:
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#selects the Dashboard tab and sums Ingreso minus Egreso, ignoring the Pago"
        status: pass
    human_judgment: false
  - id: D2
    description: "All sums go through strict big.js over the exact XML strings; damaged or hostile Total (abc, exponent, 40 digits) never throws and never sums, the invoice stays loaded (D-35)"
    requirement: "REGLA-04"
    verification:
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#does not throw and does not sum an invoice whose Total is not a decimal (D-35)"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#does not throw on hostile numeric attributes (exponent, overlong digits)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Money formatter shows negatives with the true minus sign U+2212 and never prints -$0.00 (D-26)"
    requirement: "DASH-10"
    verification:
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#shows the Egreso alone as a negative amount with the true minus sign U+2212"
        status: pass
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#shows $0.00 (never -$0.00) when the Egreso cancels the Ingreso"
        status: pass
    human_judgment: false
  - id: D4
    description: "Loaded screen has Dashboard and Importacion tabs; the Phase 1 report is unchanged inside Importacion and the Phase 1 invoices table is no longer rendered by the shell (D-01, D-02)"
    requirement: "DASH-01"
    verification:
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#keeps the Phase 1 import report in the Importacion tab"
        status: pass
      - kind: e2e
        ref: "e2e/smoke.spec.ts#carpeta sintetica (pnpm test:e2e)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual fit of the tab list and the Gasto total card against the UI-SPEC (40px list, 2px underline, spacing, dark theme)"
    verification: []
    human_judgment: true
    rationale: "Tab styling was written from the UI-SPEC text over the shadcn line variant; no automated test or screenshot asserts the look."

duration: 12min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 01: Tracer slice - exact decimal ledger and Gasto total on the tabbed Dashboard Summary

**Strict big.js ledger (Ingreso suma, Egreso resta, Pago no suma) feeding a "Gasto total" KPI in es-MX with the true minus sign, inside a new Dashboard / Importacion tabbed shell**

## Performance

- **Duration:** 12 min (Task 2; Task 1 was the user approval, resolved before this dispatch)
- **Started:** 2026-10-14T21:07:00Z
- **Completed:** 2026-10-14T21:20:00Z
- **Tasks:** 2 of 2 (Task 1 approval-only, Task 2 tracer)
- **Files modified:** 14

## Accomplishments
- With the anonymized Ingreso (1345.98), Egreso (1000) and Pago (0) loaded, the Dashboard tab shows "Gasto total" $345.98; the Egreso alone shows -$1,000.00 with U+2212; the Pago adds nothing.
- Pure accounting layer in `src/domain/accounting` with `Big.strict = true` in one file only; a damaged Total ("abc", "1e999999", 40 digits) becomes a ledger entry with `noSuma: "invalido"` and never throws or sums.
- Ledger shape (`LedgerEntry`, `LedgerOverrides`, `buildLedger`) fixed as the tracer contract for Plans 02-02 to 02-15.
- Loaded screen is now Tabs (Dashboard default, Importacion with the unchanged report); the Phase 1 invoices table is out of the shell.
- Tracer verified end to end: `pnpm verify` (lint, typecheck, 225 tests, production build) and the Playwright smoke (3 passed, 1 local-sample test skipped by design).

## Task Commits

1. **Task 1: Approve the pinned package list for the whole phase** - no commit (approval-only checkpoint, `gate="blocking-human"`). Resolved by the user replying "approved" on 2026-10-14 with the exact list unchanged: big.js 7.0.1, @types/big.js 7.0.0 (dev), cmdk 1.1.1 (Plan 02-09), react-is 19.3.0 (Plan 02-11), recharts 3.8.0 (Plan 02-11), plus shadcn copy-ins with no new npm dependency. `node_modules/big.js` was absent when the checkpoint was presented.
2. **Task 2: End-to-end slice (tracer)** - `04e0b91` (feat)

**Plan metadata:** committed separately as `docs(02-01): complete ...` (SUMMARY.md and REQUIREMENTS.md only; STATE.md and ROADMAP.md are owned by the orchestrator).

## Files Created/Modified
- `src/domain/accounting/decimal.ts` - strict big.js config, `ZERO`, `parseDecimal`, `sum`, `toMoneyString`
- `src/domain/accounting/amounts.ts` - `invoiceAmounts` with `AmountResult` typed failures
- `src/domain/accounting/ledger.ts` - `buildLedger`, `LedgerEntry`, `EMPTY_OVERRIDES`
- `src/domain/accounting/aggregate.ts` - `IvaMode`, `entryAmount`, `totalSpend`
- `src/lib/format.ts` - `formatMoney` (Intl es-MX over a decimal string, U+2212 minus)
- `src/lib/copy/es.ts` - `tabs.*` and `dashboard.kpis.gasto` keys (header comment updated: Phase 2 extends, never renames)
- `src/features/dashboard/KpiRow.tsx`, `DashboardTab.tsx` - Gasto total card and the panel wiring the store to the ledger
- `src/features/dashboard/DashboardTab.test.tsx` - end-to-end component test (9 tests)
- `src/features/shell/AppShell.tsx` - `LoadedTabs`; `InvoiceTable` no longer imported
- `src/components/ui/tabs.tsx` - shadcn copy-in (Base UI Tabs)
- `e2e/smoke.spec.ts` - tab-aware `pickFolder`, Dashboard `kpi-gasto` assertion, return to Importacion
- `package.json`, `pnpm-lock.yaml` - only the two big.js entries

## Decisions Made
- `toMoneyString` builds the 2-decimal string from `Big.toString()` (with `Big.PE`/`Big.NE` widened to 1000 so it never switches to exponent notation) and pads by hand. See Deviation 1.
- Negative amounts use `Big.neg()`, so no signed constant is built.
- Dashboard defaults to the "dashboard" tab through `defaultValue`; the "finished batch switches tab" and "no valid invoice opens Importacion" rules from the UI-SPEC are left to the plans that own the shell behavior (the plan specified `defaultValue "dashboard"`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RESEARCH snippet and acceptance grep contradict each other on `toFixed(`**
- **Found during:** Task 2 (acceptance criteria check)
- **Issue:** The plan says to write `decimal.ts` exactly as the RESEARCH snippet, which ends `rounded.toFixed(2)`. The acceptance criterion `! grep -nE "Number[(]|parseFloat|parseInt|toFixed[(]"` over the four accounting files then fails. (`Big.prototype.toFixed` is exact decimal formatting, not the float method, so the snippet is safe; the grep is just literal.)
- **Fix:** `toMoneyString` rounds half-up to 2 dp, returns "0.00" for any zero, then takes `rounded.toString()` (plain notation via `Big.PE = 1000`, `Big.NE = -1000`) and pads the fraction to 2 digits. Same output as the snippet for every input; checked by the tests (345.98, -1,000.00, 0.00).
- **Files modified:** `src/domain/accounting/decimal.ts`
- **Verification:** the grep exits 1 (no match), `pnpm verify` green.
- **Committed in:** `04e0b91`

**2. [Rule 3 - Blocking] BigInt literals not allowed by the tsconfig target**
- **Found during:** Task 2 (`pnpm typecheck`)
- **Issue:** `100n` style literals in the test failed with TS2737 (target below ES2020).
- **Fix:** used `BigInt(100)` calls; tsconfig left untouched.
- **Files modified:** `src/features/dashboard/DashboardTab.test.tsx`
- **Committed in:** `04e0b91`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** No scope change. Both keep the plan's acceptance criteria literally true.

## Issues Encountered
- `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive). The file is not touched by this plan; out of scope, left as is.
- Worktree had no `node_modules`; ran `pnpm install --frozen-lockfile` once before the first check.

## Authentication Gates
None. The package-legitimacy approval (Task 1) was a planned human gate, resolved before dispatch.

## Known Stubs
None. The Dashboard shows only the Gasto total card on purpose (tracer); the IVA mode is fixed to Con IVA until the settings store of Plan 02-07, as the plan specifies. Not a stub that blocks this plan's goal.

## Threat Flags
None. The accounting layer and dashboard components add no network, storage or auth surface (acceptance grep for fetch / XMLHttpRequest / sendBeacon / web storage / IndexedDB over `src/domain/accounting` and `src/features/dashboard` returns nothing, and the e2e "no XML leaves the browser" assertions still pass).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The ledger, selectors, formatter and tabs are in place; Plans 02-02 onward deepen derivations without changing callers.
- `cmdk`, `react-is` and `recharts` are approved but not installed; Plans 02-09 and 02-11 install them with the exact pins.
- No blockers.

## Self-Check: PASSED

- Created files exist: decimal.ts, amounts.ts, ledger.ts, aggregate.ts, KpiRow.tsx, DashboardTab.tsx, DashboardTab.test.tsx, tabs.tsx (verified on disk).
- Task commit `04e0b91` is an ancestor of HEAD.
- Acceptance criteria re-run: package pins, single `Big.strict` file, no float path, no network/storage APIs, no `dangerouslySetInnerHTML`, test header line, no `InvoiceTable` in AppShell, `pnpm verify` exit 0, `pnpm test:e2e` 3 passed.

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-14*
