---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 21
subsystem: testing
tags: [playwright, e2e, deepseek-mock, route-mocking, ui-states, phase-gates]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: Productos tab, send dialogs, run store, review queue, category rows, LLM routes, stored contracts (plans 04-01 to 04-20)
provides:
  - "e2e/products.spec.ts: end-to-end flow of the phase on a production build with both LLM routes mocked at the network layer"
  - "e2e helpers mockLlm (hold/release, recorded bodies) and seedStorage; expectNoXmlLeavesTheBrowser gains allowLlmBodies"
  - "Web server runs with an empty DEEPSEEK_API_KEY in Playwright"
  - "UI-state screenshots under test-results/phase4-ui-states/ (not committed)"
  - "Phase gate results and the end-of-phase human check list"
affects: [phase-04-verification, 04-UAT]

actuals:
  tokens: 8000
  tasks: 2
  commits: 1
plan_head_before: f3c128813ba15d50ab45cad7f3d0a105038dae6e
plan_head_after: a930345

tech-stack:
  added: []
  patterns:
    - "Network-layer LLM mock that validates every recorded body against the strict zod request contract and answers from the ids of the request"
    - "Held answers (hold/release) to test tab switching and cancel while a batch is in flight"
    - "Known gap kept alive with test.fail so a later fix shows up as an unexpected pass"

key-files:
  created:
    - e2e/products.spec.ts
  modified:
    - e2e/helpers.ts
    - playwright.config.ts
    - .planning/phases/04-agrupaci-n-de-productos-con-deepseek/deferred-items.md

key-decisions:
  - "pickFolder waits for network idle before setting the folder: the drop screen is server-rendered and a folder set before hydration is silently lost (this made the new specs fail consistently)"
  - "Reload steps wait for the new document's load event before touching the page"
  - "The 640 px tab-list check is a test.fail (known gap, logged) instead of a changed AppShell, which is outside this plan"

patterns-established:
  - "expectNoXmlLeavesTheBrowser(requests, { allowLlmBodies: true }) for specs that send through mocked LLM routes; the default stays strict"

requirements-completed: [ACC-03, ACC-04, LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, CAT-04]

coverage:
  - id: D1
    description: "Main flow on a production build with mocked routes: «No enviar» sends nothing, send, switch to Dashboard while the answer waits, «Revisar» returns to the cards, accept one into «Mis productos», reload keeps the product and the remaining card"
    requirement: LLM-01
    verification:
      - kind: e2e
        ref: "e2e/products.spec.ts#agrupar: «No enviar» no manda nada; enviar, cambiar de pestaña, volver, aceptar una sugerencia y recargar conserva el producto y las tarjetas"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every LLM request carries only the strict contract keys, no RFC, UUID or XML; only invoicechecker:settings and invoicechecker:suggestions exist in storage"
    requirement: LLM-03
    verification:
      - kind: e2e
        ref: "e2e/products.spec.ts (expectOnlyContractBodies + expectNoXmlLeavesTheBrowser in every test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "«Detener lotes» during a held batch ends in the canceled Alert and the late answer adds no card"
    requirement: LLM-05
    verification:
      - kind: e2e
        ref: "e2e/products.spec.ts#«Detener lotes» durante un lote lento termina en el aviso de cancelado y ninguna tarjeta de ese lote aparece después"
        status: pass
    human_judgment: false
  - id: D4
    description: "«Sugerir categorías» with a mocked answer lands a supplier row; accepting it changes «Gasto por categoría»"
    requirement: LLM-02
    verification:
      - kind: e2e
        ref: "e2e/products.spec.ts#«Sugerir categorías» con una respuesta simulada trae una fila de proveedor; aceptarla cambia «Gasto por categoría»"
        status: pass
    human_judgment: false
  - id: D5
    description: "No end-to-end test can reach DeepSeek: empty key on the web server, unmocked call answers 500 server_not_configured"
    requirement: ACC-04
    verification:
      - kind: e2e
        ref: "e2e/products.spec.ts#sin la clave de DeepSeek en el servidor, una llamada sin simular termina en server_not_configured"
        status: pass
    human_judgment: false
  - id: D6
    description: "Held-out UI states (120 «No agrupar» marks, 60-character product name with five 45-character suppliers, long category row) captured at 360 and 1280 px; page never scrolls sideways; «No agrupar» box at most 288 px and scrolling inside"
    verification:
      - kind: e2e
        ref: "e2e/products.spec.ts#estados de interfaz: ... a 360 y 1280 px"
        status: pass
    human_judgment: true
    rationale: "Whether the truncation, wrapping and Tooltips look right is a visual judgment of the screenshots; the test only proves the geometry"
  - id: D7
    description: "Tab list with counters at 700 and 767 px fits or scrolls inside itself without wrapping; at 640 px it overflows its list (known gap)"
    verification:
      - kind: e2e
        ref: "e2e/products.spec.ts#a 700 y 767 px las cinco pestañas ..."
        status: pass
      - kind: e2e
        ref: "e2e/products.spec.ts#a 640 px la lista de pestañas con contadores se desplaza dentro de sí misma (test.fail)"
        status: fail
    human_judgment: true
    rationale: "The 640 px case fails by design until AppShell scrolls the list at sm; the decision to fix it is the user's (see Items that need a decision)"
  - id: D8
    description: "End-of-phase check with the real key: category quality, live cancel, screenshots, tab bar and themes, footer/README privacy text"
    requirement: LLM-02
    verification: []
    human_judgment: true
    rationale: "Needs the user's DeepSeek key and a person's judgment; not attempted by the executor"

duration: 55min
completed: 2026-10-22
status: complete
---

# Phase 4 Plan 21: Phase closing end-to-end and gates Summary

**Playwright end-to-end of the whole phase on a production build with both LLM routes mocked at the network layer (send, tab switch, accept, reload, cancel, «Sugerir categorías», held-out UI states), an empty DeepSeek key on the test server, and every phase gate run.**

## Performance

- **Duration:** about 55 min
- **Completed:** 2026-10-22
- **Tasks:** 2
- **Files modified:** 4 (1 created)

## Accomplishments

- `mockLlm(page, { group, categorize, delayMs })` mocks `/api/llm/group` and `/api/llm/categorize`, records each raw body, validates it against the strict zod request schema (a broken body gets a 400), builds the answer from the request ids so the browser's coverage re-check holds, and can `hold()`/`release()` answers. `seedStorage` writes the stored settings (v3) and pending queue (v1) before load without overwriting keys the app has written.
- `e2e/products.spec.ts` has seven tests: main flow (ROADMAP criteria 1 to 3), cancel (LLM-05), «Sugerir categorías» plus «Gasto por categoría» (LLM-02, CAT-04), UI states at 360 and 1280 px, tab list at 700 and 767 px, the 640 px known gap, and the unmocked-call safety net. Every test calls `expectNoXmlLeavesTheBrowser` (with `allowLlmBodies` where it sends).
- `playwright.config.ts` sets `DEEPSEEK_API_KEY: ""` on the web server (T-04-42).
- Five screenshots (synthetic data only) written to `test-results/phase4-ui-states/` (git-ignored): `360-productos.png`, `360-select-abierto.png`, `1280-productos.png`, `1280-select-abierto.png`, `700-pestanas.png`.

## Task Commits

1. **Task 1: Browser end-to-end with mocked LLM routes, cancel, categories and UI-state screenshots** - `a930345` (test)
2. **Task 2: Phase gates and the end-of-phase human check** - no code change; results below (the two findings are logged in `deferred-items.md`, committed with this summary)

**Plan metadata:** this SUMMARY commit (docs).

## Gate results (Task 2)

| Gate | Result |
|------|--------|
| `pnpm verify` (lint, typecheck, vitest, build) | exit 0. Vitest: 93 files passed, 6 skipped; 2816 tests passed, 75 skipped. ESLint: 0 errors, 1 pre-existing warning (unused disable directive in `src/lib/client/navigation.ts`, already in deferred-items.md) |
| `node scripts/check-bundle-secrets.mjs` | `check-bundle-secrets: OK (50 files scanned)` (includes the DeepSeek sentinel scan) |
| `pnpm smoke:auth` | `smoke-auth: OK (20 checks)` (both LLM routes) |
| `pnpm test:e2e` (all four specs) | 14 passed, 1 skipped (real sample, local only); the 640 px `test.fail` counts as passed |
| No `fetch(` in `src/domain`, `src/stores`, `src/features` | pass (no match) |
| Browser storage only in the shared adapter and the theme | pass (0 files) |
| No raw-HTML injection in `src/features`, `src/components` | **FAIL as written**: `src/components/ui/chart.tsx:94` (vendored shadcn `ChartStyle`, Plan 02-11). Benign: it only writes CSS variables from the constant `trendChartConfig`, no XML or LLM text reaches it. Not changed (outside this plan); see Items that need a decision |
| No `"openai"` in `package.json` | pass |
| `connect-src 'self'` in `next.config.ts` | pass (2 matches) |
| `Facturas/` ignored and untracked | pass (`git check-ignore` exit 0, 0 tracked files) |
| `tests/llm.live.test.ts` without `LLM_LIVE` | 10 tests skipped, no DeepSeek call |

## Files Created/Modified

- `e2e/products.spec.ts` - the phase end-to-end flow and UI-state checks
- `e2e/helpers.ts` - `mockLlm`, `seedStorage`, `allowLlmBodies` option, hydration wait in `pickFolder`
- `playwright.config.ts` - empty `DEEPSEEK_API_KEY` for the test server
- `.planning/phases/04-agrupaci-n-de-productos-con-deepseek/deferred-items.md` - two open items

## Decisions Made

- The hydration wait in `pickFolder` (`waitForLoadState("networkidle")`) and the `load` wait on reloads are the fix for a real race: setting a folder before React hydrates the server-rendered drop screen, or while the page unloads, loses the files. It made the new specs hang or fail consistently; the older specs had only been lucky.
- The mock answers a body that breaks the strict contract with a 400, so a privacy regression shows up as a missing card plus an explicit contract assertion.
- Cancel is tested with a single batch (the synthetic folder has about 9 descriptions). The multi-batch case (earlier batch kept, later batch dropped) is covered by unit tests of the run store, not here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Folder pick lost before hydration / during unload**
- **Found during:** Task 1
- **Issue:** `setInputFiles` on the server-rendered drop screen before hydration, or right after `location.reload()`, never produced the import; tests hung until timeout.
- **Fix:** `pickFolder` waits for network idle; the spec waits for the `load` event after reload.
- **Files modified:** `e2e/helpers.ts`, `e2e/products.spec.ts`
- **Verification:** three consecutive green runs of a probe spec, then the full suite twice.
- **Committed in:** `a930345`

**2. [Plan shape] 640 px tab-list check kept as `test.fail`**
- **Found during:** Task 1 (check requested by UI-SPEC "Shell and tabs")
- **Issue:** at exactly 640 px with a «Productos · n» counter the tab list (592 px) is overflowed by its tabs (609 px) with `overflow-x: visible`; `AppShell.tsx` scrolls the list only below 640 px (`max-sm:`). The page does not scroll sideways, and 700 and 767 px pass.
- **Fix:** none in the app (file outside this plan, the plan says to stop and report); the check runs as `test.fail` so a later fix surfaces as an unexpected pass. Logged in `deferred-items.md`.

---

**Total deviations:** 1 auto-fixed (Rule 3), 1 reported finding. **Impact:** no scope creep; no app code touched.

## Issues Encountered

- Two gate findings, both outside this plan's files and both logged in `deferred-items.md`: the 640 px tab list, and the `dangerouslySetInnerHTML` grep hit in the vendored `chart.tsx`.

## Items that need a decision

1. **Tab list at 640 to about 657 px** (and with larger counters, wider): make `TabsList` scroll from `sm` up (`overflow-x-auto` and the scrollbar hiding without `max-sm:` in `src/features/shell/AppShell.tsx` line 117). Recommended: yes, it is what the UI-SPEC asks; then remove the `test.fail` marker in `e2e/products.spec.ts`. Alternative: accept the 17 px overflow at exactly 640 px.
2. **Raw-HTML gate vs `src/components/ui/chart.tsx`**: allow-list that vendored file in the gate (recommended, no user text reaches it) or replace `ChartStyle`'s injected `<style>` with a style object.

## Human verification (end-of-phase, real key; for the user, not run by the executor)

Not attempted. To be harvested into `04-UAT.md`:

1. With `DEEPSEEK_API_KEY` in `.env.local`, `pnpm dev`, load `Facturas/2025`, accept a few products in Productos, press «Sugerir categorías»: the dialog lists only supplier names, product names with their member descriptions and your category names; every supplier and product returns an existing category or a «Nueva: …» one; at least 80% plausible (for example the phone company under «Servicios (luz, agua, internet, teléfono)»). Accept two rows and check «Gasto por categoría» (RESEARCH criterion 6). Status: pending.
2. Press «Agrupar productos» after loading a new invoice or removing a product, then «Detener lotes» while the batch runs: no card of that batch appears later; reload: every card that had arrived before is still there (criterion 7). Also re-test the open D-32 pair «JAMON ZWAN» (Walmart) and «JAMON ZWAN VIRGINIA» (Productos de Consumo Z) now that cross-batch carry exists: they should land in one card or an «Agregar a» card. Status: pending.
3. Open `test-results/phase4-ui-states/` (run `pnpm test:e2e` first; the folder is rebuilt each run): the 60-character product name wraps to two lines then truncates with its Tooltip, long supplier names truncate, the «No agrupar» list scrolls inside its box, the category row's long name truncates in the cell and shows in full in the open Select (backstops E5, E6, E7). Executor's look at `1280-productos.png` and `360-productos.png`: layout holds, no sideways page scroll (full-page captures show the sticky header mid-page, a capture artifact). Status: pending the user's judgment.
4. Between 640 and 767 px the five tabs with counters do not wrap (they scroll inside the list if needed); note the 640 px finding above. In light and dark themes check the run card, the queue cards, the bulk bar and the focus rings. Status: pending.
5. The footer and the README say that descriptions and supplier names go to DeepSeek only when you ask, never RFC, UUID or amounts, and name no country or retention period. Status: pending (the in-app footer text was seen in the screenshots: "Solo si lo pides, se envían a DeepSeek descripciones de conceptos y nombres de proveedor (nunca RFC, UUID ni montos)"; the README was not reviewed).

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. T-04-42 (missed mock reaching DeepSeek) is mitigated by the empty key plus the network-layer mocks, and proven by the `server_not_configured` test; T-04-43 by synthetic folder and seeds, with `test-results/` git-ignored; T-04-SC: nothing installed.

## Known Stubs

None.

## Next Phase Readiness

Phase 4 plans are all executed. Open before closing the phase: the two decisions above and the human check with the real key.

## Self-Check: PASSED

- `e2e/products.spec.ts`, `e2e/helpers.ts`, `playwright.config.ts` exist and are committed in `a930345` (an ancestor of HEAD).
- Task 1 acceptance: `page.route` in `e2e/helpers.ts` (2), `DEEPSEEK_API_KEY: ""` in `playwright.config.ts` (1), 5 PNGs in `test-results/phase4-ui-states/` after the run, `pnpm exec playwright test e2e/products.spec.ts e2e/smoke.spec.ts` exit 0. (The first acceptance line greps `page.route` in either file; the second file has none, the first has two.)
- Task 2 acceptance: all met except the raw-HTML grep, reported above.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-22*
