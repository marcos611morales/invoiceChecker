---
phase: 02-dashboard-de-gasto-confiable
plan: 07
subsystem: ui-shell
tags: [react, base-ui, toggle-group, zustand, tabs, responsive, tdd]
status: complete

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "sessionStore activeTab/setActiveTab/excluded/restored/applyBatch and useSettingsStore ivaMode/persist.rehydrate (02-06); buildLedger/totalSpend/IvaMode (02-03/02-05); AppShell, TopBar, useImport tracer (02-01)"
provides:
  - "IvaToggle({ variant: 'bar' | 'subbar' }): segmented Con IVA / Sin IVA control that cannot be left empty"
  - "TopBar prop showIva: bar variant in the centre slot, sticky 52 px sub-bar under 640 px"
  - "es.iva copy keys (group label, labels, short labels, tooltips, captions)"
  - "AppShell tabs controlled by sessionStore.activeTab with a TABS module-scope array; settings store rehydrated once from a mount effect"
  - "useImport D-44 rule: a finished batch opens Dashboard (or Importacion when the session holds no invoice)"
  - "DashboardTab Gasto total in the stored IVA mode and with manual exclusions/restorations"
  - "shadcn toggle-group and toggle copy-ins"
  - "tests/support/settingsStorage.ts: store-adapter helpers for persisted-mode tests"
affects: [02-08, 02-09, 02-10, 02-11, 02-12, 02-13, 02-14, 02-15]

plan_head_before: a1e328b71f6b4048c64774fc36eb08c150fd5e5a
plan_head_after: 6719d5b90f73f263bdde5be73a2db76cfb7b889d
commits: 5
actuals:
  tokens: 22000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Base UI ToggleGroup is array-valued: the handler maps the first valid mode and ignores any array without one, so the group never ends empty"
    - "Responsive variants hide themselves with CSS (max-sm:hidden / sm:hidden) so only one copy is in the accessibility tree; tests scope queries by test id because jsdom applies no Tailwind"
    - "Tabs are controlled by the store; onValueChange takes unknown and narrows with a type guard instead of a cast"
    - "Persisted-store tests go through useSettingsStore.persist.getOptions().storage, never the browser storage object"

key-files:
  created:
    - src/components/ui/toggle-group.tsx
    - src/components/ui/toggle.tsx
    - src/features/shell/IvaToggle.tsx
    - src/features/shell/IvaToggle.test.tsx
    - tests/support/settingsStorage.ts
  modified:
    - src/features/shell/TopBar.tsx
    - src/features/shell/LogoutButton.tsx
    - src/features/shell/AppShell.tsx
    - src/features/upload/useImport.ts
    - src/features/upload/useImport.test.tsx
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/lib/copy/es.ts

key-decisions:
  - "IvaToggle wraps the ToggleGroup in a div that carries the test id and the visibility class, so the role=group element is a descendant and a variant hides as a whole"
  - "The active item overrides the library's aria-pressed:bg-muted with aria-pressed:bg-background to get the surface/border/foreground look (decision 7), not an accent fill"
  - "The 44 px touch height uses max-sm:group-data-horizontal/tabs:h-11; the built CSS orders the max-sm rule after the 40 px rule, so it wins"
  - "TABS is a module-scope array of { value, label, Panel } so Plan 02-15 adds the Calidad entry without touching the Tabs structure"

requirements-completed: [REGLA-03, REGLA-08, DASH-10]
# Shared with sibling plans (REGLA-03, REGLA-08, DASH-10); the orchestrator owns REQUIREMENTS.md.

coverage:
  - id: D1
    description: "Con IVA / Sin IVA control in bar and sub-bar variants with the exact copy, aria-pressed, check icon on the active item, tooltips, and no way to end with an empty selection"
    requirement: "REGLA-03"
    verification:
      - kind: unit
        ref: "src/features/shell/IvaToggle.test.tsx#IvaToggle"
        status: pass
    human_judgment: false
  - id: D2
    description: "TopBar centre slot, sticky 52 px sub-bar below 640 px, icon-only Cerrar sesion / Agregar facturas below 768 px with aria-label kept"
    requirement: "REGLA-03"
    verification:
      - kind: unit
        ref: "src/features/shell/IvaToggle.test.tsx#TopBar with the IVA control; src/features/dashboard/DashboardTab.test.tsx#collapses 'Agregar facturas' to icon-only"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gasto total follows the stored IVA mode (Con 345.98, Sin 428.74) and the manual exclusions, and the stored Sin IVA mode shows after a reload"
    requirement: "REGLA-03, REGLA-08, DASH-10"
    verification:
      - kind: unit
        ref: "src/features/dashboard/DashboardTab.test.tsx#Gasto total follows the IVA mode / follows the exclusions"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tabs controlled by the store, settings rehydrated once on mount, finished batch opens Dashboard or Importacion while a manual tab choice is respected during the batch"
    requirement: "DASH-10"
    verification:
      - kind: unit
        ref: "src/features/upload/useImport.test.tsx#tab after a finished batch; src/features/dashboard/DashboardTab.test.tsx#AppShell: shell wiring"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual result of the control and the responsive bars at 360, 640, 768 and desktop widths in both themes (spacing, contrast, sticky stacking of bar and sub-bar)"
    verification: []
    human_judgment: true
    rationale: "jsdom applies no Tailwind CSS, so the breakpoint behavior, sticky stacking and look are verified only by class assertions and the built CSS ordering, not by rendering"

duration: 22 min
completed: 2026-10-14
---

# Phase 2 Plan 07: IVA Toggle, Responsive Top Bar and Store-Controlled Tabs Summary

**Con IVA / Sin IVA segmented control (bar and sticky sub-bar variants) on a responsive top bar, store-controlled tabs with one-time settings rehydration, the D-44 "finished batch opens Dashboard" rule, and a Gasto total that follows the stored IVA mode and the manual exclusions.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-14T21:24:00Z
- **Completed:** 2026-10-14T21:32:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 13 (5 created, 8 modified)

## Accomplishments

- `IvaToggle` renders "Con IVA | Sin IVA" (bar) or "c/IVA | s/IVA" (sub-bar) with full accessible names, `aria-pressed`, a check icon on the active item, UI-SPEC tooltips, and a handler that ignores the empty array Base UI emits when the active item is pressed (Pitfall 6).
- `TopBar` takes `showIva`: bar variant centred from 640 px, sticky `top-14` 52 px strip under 640 px; `LogoutButton` and `AddInvoicesButton` are icon-only below 768 px (36 px, 44 px under 640 px) with the `aria-label` kept.
- `AppShell` tabs are driven by `sessionStore.activeTab` through a type-guarded `onValueChange`, styled per UI-SPEC (40 px list, 44 px touch, 16 px padding, 2 px primary underline, muted inactive). `useSettingsStore.persist.rehydrate()` runs once from an empty-deps effect.
- `useImport` sets the tab only after a finished, non-stale batch: Dashboard when the session holds any invoice (even if the batch added none), otherwise Importación. A tab picked while parsing stays until the batch ends.
- `DashboardTab` builds the ledger with `excluded` and `restored` and reads `totalSpend` in the stored mode: $345.98 Con IVA, $428.74 Sin IVA (BigInt-derived in the test), exclusion/reinclusion and reload covered.

## TDD

- **RED 1 (`4ab2819`):** 13 of 15 `IvaToggle.test.tsx` tests failed on missing `group`/`button` roles, missing short labels and missing `iva-toggle-*` / `iva-subbar` nodes; the 2 passing tests are regression guards (no `showIva` renders nothing, app name and sign-out stay). The `IvaToggle` skeleton and the `showIva` prop signature were committed with the tests so the failures are behavioral, not import faults. Semantic assessment: every failure maps to a planned behavior, no setup, import or syntax faults.
- **GREEN 1 (`6a9b13b`):** `IvaToggle`, `TopBar` sub-bar, `LogoutButton` collapse.
- **RED 2 (`5c31547`):** 4 `useImport` tests (tab rule) and 11 `DashboardTab`/AppShell tests failed on assertions (`expected 'importacion' to be 'dashboard'`, `rehydrate called 0 times`, missing `iva-toggle-bar`, missing `max-md:size-9`). Semantic assessment: same, all planned behavior.
- **GREEN 2 (`6719d5b`):** `AppShell`, `useImport`, `DashboardTab` plus the `tests/support/settingsStorage.ts` helper.
- **REFACTOR:** not needed.
- The `gsd_run check tdd-red-evidence` classifier was not run (no `gsd_run` in this worktree); RED evidence is the tap-flat vitest output reviewed manually.

## Task Commits

1. **Toggle-group copy-in** - `e8aaeaf` (chore)
2. **Task 1 RED** - `4ab2819` (test), **GREEN** - `6a9b13b` (feat)
3. **Task 2 RED** - `5c31547` (test), **GREEN** - `6719d5b` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `src/components/ui/toggle-group.tsx`, `toggle.tsx` - shadcn 4.21.4 copy-ins (Base UI); one justification comment added above the existing `as React.CSSProperties`
- `src/features/shell/IvaToggle.tsx` - the control and its two variants
- `src/features/shell/TopBar.tsx` - `showIva`, centre slot, sticky sub-bar strip (`data-slot="iva-subbar"`)
- `src/features/shell/LogoutButton.tsx` - `max-md` icon-only collapse
- `src/features/shell/AppShell.tsx` - controlled tabs, `TABS` array, rehydrate effect, `showIva`
- `src/features/upload/useImport.ts` - D-44 tab rule
- `src/features/dashboard/DashboardTab.tsx` - mode- and exclusion-aware total
- `src/lib/copy/es.ts` - `es.iva`
- tests: `IvaToggle.test.tsx`, `useImport.test.tsx`, `DashboardTab.test.tsx`, `tests/support/settingsStorage.ts`

## Decisions Made

See `key-decisions` above. Additionally, the tests read and seed the persisted mode through the store's own storage adapter so `grep -rn "local[S]torage" src/features` stays empty, as the plan's acceptance requires.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - CLAUDE.md compliance] Justification comment on the vendored `as React.CSSProperties`**
- **Found during:** toggle-group copy-in
- **Issue:** The shadcn-generated `toggle-group.tsx` contains `as React.CSSProperties` (for the `--gap` custom property). CLAUDE.md allows an `as` only with a justifying comment on the same or previous line.
- **Fix:** Added a one-line comment above it. No logic change.
- **Files modified:** src/components/ui/toggle-group.tsx
- **Commit:** `e8aaeaf`

**2. [Rule 3 - Blocking acceptance criterion] Persisted-mode tests use a store-adapter helper, not the browser storage object**
- **Found during:** Task 2 acceptance (`! grep -rn "local[S]torage" src/features`)
- **Issue:** The first version of the new tests called `window.localStorage` directly, which would make the grep criterion fail.
- **Fix:** Added `tests/support/settingsStorage.ts` (uses `useSettingsStore.persist.getOptions().storage`), and the tests use it. The behavior covered is unchanged.
- **Files modified:** tests/support/settingsStorage.ts, DashboardTab.test.tsx, IvaToggle.test.tsx
- **Commit:** `6719d5b`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3). **Impact:** none on the contract.

## Issues Encountered

- The worktree sandbox refused writes to the git-dir, so the per-plan HEAD ledger file could not be created; the base `a1e328b` (given in the dispatch) was used for the measured `commits:` count instead.
- `pnpm lint` still shows the pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive); out of scope (noted in the 02-06 summary).

## Known Stubs

None. (The Calidad tab is intentionally absent until Plan 02-15, as the plan states.)

## Threat Flags

None. T-02-SC is mitigated: `git diff --stat -- package.json pnpm-lock.yaml` is empty; the toggle-group copy-in came from the pinned shadcn 4.21.4 registry. The control reads its mode only from the zod-validated settings store (T-02-12).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-09 can read `ivaMode` for the mode caption (`es.iva.captionCon` / `captionSin` are in place).
- Plan 02-15 adds the Calidad tab by appending one entry to `TABS` in `AppShell.tsx`.
- Manual check worth doing in UAT: the look and sticky stacking of the bar and the 52 px sub-bar at 360, 640 and 768 px in both themes (D5).

## Self-Check: PASSED

- Created files exist: IvaToggle.tsx, IvaToggle.test.tsx, toggle-group.tsx, toggle.tsx, tests/support/settingsStorage.ts.
- Commits `e8aaeaf`, `4ab2819`, `6a9b13b`, `5c31547`, `6719d5b` are on the branch.
- Acceptance: `grep -cE "iva-toggle-(bar|subbar)" IvaToggle.tsx` prints 2; LogoutButton has `max-md:` and 0 `max-sm:sr-only`; `git diff --stat -- package.json pnpm-lock.yaml` empty; `grep -c defaultValue AppShell.tsx` prints 0; no `localStorage` match in `src/features`.
- `pnpm verify` (lint, typecheck, 472 tests passed / 8 skipped, build) passes.

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-14*
