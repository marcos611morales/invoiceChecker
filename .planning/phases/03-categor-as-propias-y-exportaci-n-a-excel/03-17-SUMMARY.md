---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 17
subsystem: e2e-and-shell
status: awaiting-human-check
tags: [playwright, production-build, responsive, backup, privacy-gates]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "e2e/helpers.ts and export.spec.ts (03-16), top bar with ExportButton (03-13), settings backup (03-07)"
provides:
  - "e2e/categories.spec.ts: classification, persistence across a reload, backup round trip between two browser contexts, responsive shell checks"
  - "e2e/smoke.spec.ts: the four tabs in order"
  - "UI-SPEC Q9 applied: Agregar facturas and Cerrar sesion go icon-only below 1024 px"
affects: []

requirements-completed: [CAT-01, CAT-02, CAT-03, AJUS-01, AJUS-02, XLS-03]

actuals:
  tokens: 16000
  tasks: 2
  commits: 3
plan_head_before: d02dec7a7bc5081bb8075a35e9c5b67ddfb2ece8
plan_head_after: 8e2d8ad0c660a5f701c67b3c00e5044db587fc50

tech-stack:
  added: []
  patterns:
    - "A second browser context (browser.newContext with baseURL) stands for another browser profile"
    - "Layout measures are polled with expect.poll so a resize is read after the layout settles"

key-files:
  created:
    - e2e/categories.spec.ts
  modified:
    - e2e/smoke.spec.ts
    - src/features/shell/AppShell.tsx
    - src/features/shell/LogoutButton.tsx
    - src/features/shell/AppShell.test.tsx
    - src/features/dashboard/DashboardTab.test.tsx

key-decisions:
  - "Q9 fallback was needed and applied: without it the IVA control sat 104 px off-centre at 768 px; with it the offset is 19 to 21 px from 768 to 1023 px"
  - "Two points are NOT decided and are returned to the user: the 360 px top-bar overflow and the dangerouslySetInnerHTML gate (see Open decisions)"

duration: 35 min
completed: 2026-10-18
---

# Phase 3 Plan 17: End-to-end closure Summary

**A production-build Playwright spec proves classification, persistence across a reload and the settings round trip between two browser contexts without any invoice or settings data leaving the browser; the Q9 top-bar fallback was needed and applied. Two findings and the human check remain open, so the plan is NOT complete.**

## Accomplishments

- **Classification, persistence, backup** (`e2e/categories.spec.ts`, test 1): log in, pick a synthetic folder (four anonymized fixtures copied to a temp dir and removed afterwards), choose «Limpieza e higiene» in the supplier Select of the first row, see it in «Gasto por categoría», reload accepting the beforeunload prompt, drop the folder again and find the Select still on «Limpieza e higiene»; storage keys are exactly `["invoicechecker:settings"]` and session storage is empty. «Descargar ajustes» saves a file named `invoicechecker-ajustes-AAAA-MM-DD.json` containing the marker; a second context (`browser.newContext({ baseURL })`) logs in, starts without the assignment, uploads the file, confirms «Reemplazar mis ajustes», sees «Ajustes reemplazados» and the same Select value; a text file «no es json» shows the Alert «no es un archivo de ajustes de InvoiceChecker», opens no dialog and keeps the value. In both contexts no request carries XML (`expectNoXmlLeavesTheBrowser`) or the string `invoicechecker-settings`.
- **Smoke spec**: asserts the four tabs in order (Dashboard, Categorías, Calidad de datos, Importación); the storage-key assertion is unchanged.
- **Responsive shell** (test 2): at 360 x 800 the tab list scrolls inside itself (scrollWidth > clientWidth) and, after clicking «Importación», that trigger lies inside the list's visible box. At 768, 900 and 1023 px the header does not overflow and the IVA control centre is within 24 px of the header centre.
- **Q9 fallback applied** (`AppShell.tsx`, `LogoutButton.tsx`): the header check failed at 768 px (IVA centre 104 px off) with the Phase 2 rule `max-md`; changing only the label span and size classes of «Agregar facturas» and «Cerrar sesión» to `max-lg` brings the offset to 19-21 px at 768, 900 and 1023 px. Confirmed both ways: reverting the four class changes makes the e2e test fail again, restoring them makes it pass. `AppShell.test.tsx` gained a test for the new classes; `DashboardTab.test.tsx` (which asserted `max-md` for «Agregar facturas») follows the new breakpoint.

## Task Commits

1. Task 1: `5bc312d` test(03-17): classification, persistence and settings round trip on a production build
2. Task 2 (automated part): `42a27aa` fix(03-17): collapse labels below 1024 px (Q9); `8e2d8ad` test(03-17): responsive shell checks

## Open decisions (need the user)

1. **Top bar overflows at 360 px (plan truth: «the page itself never scrolls sideways»).** Measured on the production build: at 360 px `document.documentElement.scrollWidth` is 389 (29 px over) on all four tabs; at 390 px it fits. The header holds the name «InvoiceChecker» (149 px) plus four 44 px buttons (Exportar, Agregar, tema, Cerrar sesión; the right group is 192 px) plus 16 px gap and 2 x 16 px padding. The plan and UI-SPEC give no layout for this width, and the fix is a visual choice outside `files_modified` (TopBar.tsx). Options: (a) show the name as a short mark («IC») or hide it under about 400 px; (b) let the name truncate with an ellipsis (`min-w-0 truncate`) and keep 44 px targets; (c) reduce the 44 px touch targets to 40 px and the gaps under 400 px. Recommendation: (b) is the smallest change but cuts the name to about 100 px; (a) keeps targets and readability. The check is already written in `e2e/categories.spec.ts` as `test.fixme("a 360 px la página no se desplaza de lado")`; remove `fixme` once the fix is in.
2. **Acceptance gate `! grep -rn "dangerouslySetInner[H]TML" src/features src/components` fails.** It matches `src/components/ui/chart.tsx:94`, the vendored shadcn `ChartStyle`, installed in Phase 2 (commit `9e31c66`, plan 02-11). Its content is built only from the `config` of `ChartContainer`, which has a single caller (`TrendChart.tsx`) with a module-scope constant, so no XML or settings text reaches it. Earlier plans scoped this grep to `src/features`, which is clean. Options: (a) accept the vendored file and scope the gate to `src/features` plus `src/components` excluding `ui/chart.tsx`; (b) rewrite `ChartStyle` to render the CSS as a `<style>` child (changes a vendored file and needs a visual check of the chart colours). Recommendation: (a). Nothing was changed.

## Phase gates

- `pnpm verify` (lint, typecheck, test, build): passes. Lint: 0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts`. Vitest without the sample: 70 files passed, 5 skipped (real-data suites); 1693 passed, 65 skipped.
- `FACTURAS_DIR=<real sample> pnpm exec vitest run`: 75 files, 1758 tests passed, 0 skipped (includes `tests/fixtures.guard.test.ts`).
- `pnpm exec playwright test e2e/categories.spec.ts e2e/export.spec.ts e2e/smoke.spec.ts`: 6 passed, 2 skipped (the 360 px page-width test marked `fixme`, and smoke «muestra real (local)», which needs E2E_FACTURAS_DIR as before).
- Closing greps: no `fetch(`/`XMLHttpRequest`/`sendBeacon` under `src/domain`, `src/stores`, `src/features` (PASS); files using browser storage outside the settings store, tests and theme code: 0 (PASS); `write-excel-file` imports: only `write-excel-file/universal` (PASS); `Facturas/2025/x.xml` is gitignored and `git ls-files Facturas` is empty (PASS); `worker-src 'self' blob:` appears once in `next.config.ts` (PASS); `dangerouslySetInnerHTML` under `src/features src/components`: FAIL, see Open decisions 2.

## Human check (PENDING, not performed)

The agent cannot open Microsoft Excel, a second browser, or look at light/dark themes. None of the six steps below has been done; nothing is claimed as passed.

1. Production build (`pnpm build && pnpm start`) with the 143 real XML of Facturas/2025: assign several suppliers in Categorías (e.g. Walmart to «Abarrotes y despensa»), change one Walmart line («CLORO 1L» or similar) to «Limpieza e higiene» from the Dashboard table; the rest of that ticket stays in the supplier's category and «Gasto por categoría» adds up to Gasto total in both IVA modes. PENDING.
2. Create, rename and delete categories (one with assignments, moving them to another category and once to «Sin categoría»); use «Deshacer»; in the delete dialog open «Pasarlos a»: its popup shows above the dialog and closing it keeps the dialog open. PENDING.
3. Reload, drop the files again, everything is kept; download the settings file, open the app in another browser (Safari or another Chrome profile), load the XML, upload the file, same classification; try an invalid file and a file above 1 MB. PENDING.
4. Filter by one and by several categories; check the caption, the «de {total} total» lines, the dimmed lines, and that choosing every category gives the unfiltered totals; click a category row and a supplier row: chip, scroll and focus on «Facturas». PENDING.
5. Export in Con IVA and Sin IVA, with and without a category filter, and open each file in Microsoft Excel: six sheets in order, header frozen, Fecha shows the right day, RFC/UUID/folio as text without scientific notation, ClaveProdServ keeps leading zeros, Conceptos has «Diferencia de redondeo» lines, SUM of the Monto column of Facturas equals Gasto total of the Dashboard for the same filters and mode; Parámetros lists the filters and the mode. PENDING.
6. At 360 px, 768 to 1023 px and 1280 px: tabs scroll on phones, the top bar does not wrap, «Exportar a Excel» is icon-only below 1024 px with its Tooltip; in light and dark themes check the category bars, the green decrease color, the dimmed concept lines and the focus rings. PENDING (note: at 360 px the page scrolls sideways today, Open decision 1; at 1280 px the IVA control is about 160 px left of the centre, outside the 768-1023 px range the plan checks).

## Deviations from Plan

- **[Rule 3 - Blocking] `DashboardTab.test.tsx` updated.** Found during Task 2: it asserted the old `max-md` classes of «Agregar facturas». Updated to `max-lg` with the Q9 change (commit `42a27aa`). The file is outside `files_modified`.
- **[Plan check adjusted] Centre check polled.** The first read after `setViewportSize` gave a transient 25.6 px offset; the final spec polls until the layout settles (still the plan's 24 px).
- **Not done / open:** Open decisions 1 and 2 above; they need the user because the project rule is to ask rather than choose a visual design or change a gate silently.

**Total deviations:** 1 auto-fixed (Rule 3), 1 check adjustment, 2 open decisions.

## Known Stubs

None. (One Playwright test is skipped with `fixme` on purpose, see Open decisions 1.)

## Threat Flags

None. T-03-32 is mitigated in e2e: storage keys asserted in both contexts, and no request body carries XML or `invoicechecker-settings`. T-03-SC: no package installed.

## Self-Check: PASSED (automated part only)

- `e2e/categories.spec.ts` exists; commits `5bc312d`, `42a27aa`, `8e2d8ad` are ancestors of HEAD.
- The plan is not complete: the human check and the two open decisions are pending.

## Orchestrator follow-up (2026-10-18, user decisions on the checkpoint)

- **360 px overflow — resolved.** User chose to hide the app name below 400 px. `TopBar.tsx` adds `max-[399px]:sr-only` to «InvoiceChecker» (still read by screen readers); the buttons keep their 44 px targets. `test.fixme` was removed from `e2e/categories.spec.ts`; «a 360 px la página no se desplaza de lado» now passes on the production build (Playwright: 7 passed, 1 skipped — smoke «muestra real», needs `E2E_FACTURAS_DIR`).
- **`dangerouslySetInnerHTML` gate — resolved by scope.** User chose to exclude the vendored shadcn `src/components/ui/chart.tsx` (`ChartStyle`, constant config, no user data). The gate is `grep -rn "dangerouslySetInner[H]TML" src/features src/components --exclude=chart.tsx` and it is clean.
- **Human check:** still PENDING; it is persisted for `/gsd-verify-work 03`.
