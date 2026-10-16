---
phase: 02-dashboard-de-gasto-confiable
verified: 2026-10-15T20:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/02-dashboard-de-gasto-confiable/02-01-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-01-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-02-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-02-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-03-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-03-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-04-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-04-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-05-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-05-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-06-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-06-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-07-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-07-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-08-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-08-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-09-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-09-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-10-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-10-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-11-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-11-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-12-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-12-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-13-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-13-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-14-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-14-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-15-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-15-SUMMARY.md
  - src/domain/accounting/aggregate.ts
  - src/domain/accounting/amounts.ts
  - src/domain/accounting/decimal.ts
  - src/domain/accounting/filters.ts
  - src/domain/accounting/ledger.ts
  - src/domain/accounting/months.ts
  - src/domain/accounting/quality.ts
  - src/features/dashboard/DashboardTab.tsx
  - src/features/invoices/InvoiceTable.tsx
  - src/features/quality/QualityTab.tsx
  - src/features/shell/AppShell.tsx
  - src/lib/format.ts
  - src/stores/sessionStore.ts
  - src/stores/settingsStore.ts
covered_digest: "v3:sha256:86a7e9eb694f04c815c5e772fc1101ddb97752e8d24302078a49623a7f1c8044"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "REGLA-03 tail: the Con/Sin IVA mode applies to the Excel export"
    addressed_in: "Phase 3"
    evidence: "Phase 3 SC4: 'descarga un Excel ... que respeta los filtros activos y el modo con/sin IVA'; FILT-05 'export' part is covered by the same SC"
human_verification:
  - test: "Production build with the 143 real XML of Facturas/2025: Dashboard opens; Gasto total, Facturas (121), Ticket promedio and Promedio mensual (entre 12 meses) show; deltas read 'Sin datos del periodo anterior'; trend shows 12 bars with a dashed average line; ranking and table (143 rows, Pagos and $0 attenuated and labelled 'No suma')."
    expected: "Figures match the ledger; layout is as described."
    why_human: "Real browser rendering and the real private sample."
  - test: "Toggle Con IVA / Sin IVA in the top bar: KPIs, chart, ranking and table change at once, the caption names the mode; reload, re-drop the files, confirm the mode was remembered."
    expected: "All views switch together; only invoicechecker:settings persists."
    why_human: "Cross-component visual change and real localStorage rehydration."
  - test: "Filter by one supplier, by a forma de pago (names, never codes; 'Por definir (sin complemento de pago)' for PPD without complement) and by a one-month range; chips appear, 'Quitar filtros' resets, a month without invoices shows the empty state."
    expected: "Consistent filtering across KPIs, chart, ranking and table."
    why_human: "Popover/dialog behaviour and layout in a real browser."
  - test: "Exclude an invoice from its menu: totals drop, toast offers 'Deshacer exclusion'; reload and confirm nothing was remembered; re-include from Calidad de datos."
    expected: "Exclusion applies everywhere and is session-only."
    why_human: "Toast, menu and reload behaviour."
  - test: "In Calidad de datos check the counter, the cards, and that 'Ver factura' reaches a row on another page, centres it and focuses its chevron; with a filter that hides it, check the Alert (Info icon) and that 'Quitar filtros' reveals it."
    expected: "Navigation and focus work as specified."
    why_human: "Scroll, focus ring and Alert layout."
  - test: "At 1200 px and 360 px: a 13-character amount ($12,345,678.90) is never truncated in a KPI card; under 640 px the 'c/IVA | s/IVA' sub-bar is sticky; 640-767 px shows icon-only 'Agregar facturas' and 'Cerrar sesion'."
    expected: "Responsive behaviour per UI-SPEC."
    why_human: "Visual/responsive."
  - test: "Light and dark themes: chart bar contrast, decrease colour, focus rings; 36-month range keeps ticks legible; a negative month draws below the baseline with a correct corner."
    expected: "Legible and correct in both themes."
    why_human: "Chart rendering and theme contrast."
  - test: "On a touch device/emulation, tap a truncated supplier name and confirm the full text opens in a Popover."
    expected: "Popover shows full text."
    why_human: "Touch interaction."
  - test: "Compare the 22 c_FormaPago and 7 c_TipoRelacion labels in src/domain/cfdi/catalogs.ts with the official SAT catalogs (02-03 D7: accepted as written, D-45)."
    expected: "Names match the SAT catalog wording the user wants to see (FILT-04)."
    why_human: "Labels were never checked against the official catCFDI."
  - test: "DECISION on WR-01 (see Anti-Patterns): fix 'Deshacer exclusion' / 'Volver a incluir' so they only touch `restored` for entries actually substituted by a TipoRelacion-04 invoice, or accept the current literal plan behaviour."
    expected: "User chooses fix-now, defer to Phase 3, or accept."
    why_human: "Business decision; the user previously accepted the literal plan behaviour without this consequence being stated."
  - test: "DECISION on WR-03: what to do with an implausible Fecha year (0001 or 2205) that stretches the loaded month span (D-12/D-41)."
    expected: "User defines a plausible-year window or another rule."
    why_human: "Business decision, not inferable."
---

# Phase 2: Dashboard de gasto confiable Verification Report

**Phase Goal:** El usuario ve en que se gasta y cuanto en promedio (KPIs, tendencia mensual, ranking de proveedores y tabla de facturas) con montos que respetan las reglas acordadas (I/E/P, con/sin IVA, facturas en $0 y excluidas), filtros consistentes y un panel de calidad de datos.
**Verified:** 2026-10-15T20:00:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

All five roadmap Success Criteria are backed by code that exists, is substantive, is wired end to end and is exercised by passing tests. No truth failed. Status is `human_needed` because the phase ships a large UI surface (responsive layout, themes, charts, popovers) that only a real browser can confirm, and because two review warnings need a user decision.

## Independent gate run (this verification)

| Gate | Result |
| ---- | ------ |
| `pnpm tsc --noEmit` | exit 0, 0 errors |
| `pnpm eslint .` | exit 0, 0 errors, 1 warning (unused eslint-disable in `src/lib/client/navigation.ts`, pre-existing, Phase 1) |
| `pnpm vitest run` | 44 files, 872 tests passed (includes `ledger.realdata.test.ts` and `parseCfdi.realdata.test.ts`, which ran because `Facturas/2025` exists locally) |
| `Facturas/` out of git | `.gitignore:1: Facturas/`; `git ls-files Facturas` empty; no non-fixture `.xml` is tracked |

The full suite was run once and its saved output was read; `next build` was not re-run by this verifier (orchestrator reports OK).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | With 2025 loaded the user sees es-MX Gasto total, number of invoices, Ticket promedio and Promedio mensual; credit notes subtract in the month of their related invoice (own date, with notice, if not loaded); Pago complements and $0 invoices neither sum nor count in averages | VERIFIED | `aggregate.ts` `kpis()` counts only `entry.counted`; `ledger.ts` `kindOf`/`amountsOf` give `noSuma:"tipo"` to P/T/N and `"cero"` when converted Total equals 0; `imputationOf` moves a nota-credito to the oldest loaded related invoice month, else own month; `DashboardTab` renders `KpiRow` from `kpis(visible,...)`; `ledger.anon.test.ts` "imputes a credit note dated 2025-09 to the 2025-06 month of its loaded Ingreso" and "keeps the own month when loaded alone"; the notice for unrelated notes is the `nc-sin-relacionada` incident plus the Dashboard `incidentsNotice` Alert. `formatMoney` passes a decimal string to `Intl.NumberFormat("es-MX", MXN)` (no float). |
| 2 | User toggles Con IVA (Total) / Sin IVA (Subtotal - Descuento + IEPS); KPIs, monthly trend (zero-filled months), ranking with ticket promedio and sortable invoice/concept table change together; active mode always visible | VERIFIED | `amounts.ts` `invoiceAmounts`: `conIva = Total*rate`, `sinIva = (SubTotal - Descuento + IEPS)*rate` using exact Big; mode only selects the stored amount (`entryAmount`), the ledger is not rebuilt (`DashboardTab` reads `ivaMode` from settings store and passes it to `kpis`, `monthlySeries`, `supplierRanking`, `InvoiceTable`); `monthlySeries` zero-fills via `monthsInRange`; `supplierRanking` returns net, facturas, ticket, pct; `InvoiceTable` is a TanStack table with sortable headers (`SortHeaderButton`, `aria-sort`), 50/page, expandable concepts panel (`conceptRows(entry, mode)`); mode is always shown by `IvaToggle` in the TopBar/sub-bar plus `data-testid="mode-caption"` under the filter bar. |
| 3 | User filters by date range/month, by one or several suppliers and by SAT-named forma de pago (PPD "99 Por definir" shows the real form from its Pago); KPIs, charts and tables always reflect the same filter; Promedio mensual says it divides by calendar months | VERIFIED | One `applyFilters(ledger, filters, span)` produces `visible`, the only input to `kpis`, `monthlySeries`, `supplierRanking` and `InvoiceTable` in `DashboardTab.tsx` (FILT-05); `ledger.ts` `indexPaymentForms` + `formasOf` replace PPD/"99" with the FormaDePagoP of loaded Pago complements, else `PPD_SIN_COMPLEMENTO` labelled "Por definir (sin complemento de pago)" (`format.ts:222`); `catalogs.ts` maps codes to Spanish SAT names; `kpis().promedio = gasto / monthsInRange(range).length` and `KpiRow` shows `monthsSubLabel(current.months)`; `ledger.anon.test.ts` covers PPD with and without the Pago loaded. |
| 4 | User marks an invoice "Excluida" and it stops counting everywhere; the data-quality panel lists duplicates, files with error, $0 invoices, rounding differences, substitutions (TipoRelacion 04) and credit notes without a related invoice | VERIFIED (with WR-01 warning) | `sessionStore.excludeInvoice` -> `useLedger` -> `buildLedger` sets `exclusion:"manual"`, `counted=false`; every selector skips `!entry.counted`; `InvoiceTable.RowMenu` calls it with a 6 s undo toast. `quality.ts` yields ten incident types (nc-sin-relacionada, nc-varias-relacionadas, sustituciones, moneda-sin-tc, datos-invalidos, cero, redondeo with 0.01 tolerance, ppd-sin-complemento, excluidas, sustituidas); duplicates and error files are listed by the Phase-1 `ImportReport` tab that is part of the same shell (`TABS`: dashboard / calidad / importacion) and linked from Quality; `AppShell` shows the incident counter on the tab. |
| 5 | `pnpm test` passes Vitest tests of parser and amount rules over anonymised XML (descuentos, IEPS, near-month-change dates assigned to literal month, TipoCambio, exact big.js arithmetic) and `Facturas/` is outside git | VERIFIED | 872 tests pass. Fixtures `tests/fixtures/cfdi/anon/{anon-ingreso-descuento,anon-ingreso-ieps,anon-egreso,anon-pago}.xml`; `amounts.test.ts` (IEPS identity, TipoCambio exact product, "400 synthetic Ingreso invoices equal an independent BigInt-cents reference"); `ledger.anon.test.ts` ("keeps 2025-08-31T21:20:35 in 2025-08", "puts 2025-09-01T00:00:05 in 2025-09"); `decimal.ts` sets `Big.strict = true`, parseDecimal is string-only; `tests/fixtures.guard.test.ts` blocks real identifiers; `Facturas/` gitignored and untracked. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

Behavior-dependent truths (exclusion/undo state transitions, imputation ordering) were checked against named tests rather than symbol presence: `sessionStore.test.ts` (exclude/reinclude set transitions), `ledger.anon.test.ts` ("marks the loaded original as sustituida", "counts the original again once its uuid is in restored"), `ledger.anon.test.ts` boundary-date tests. The WR-01 defect is a gap in what these tests cover, not a failing test (see below).

### Deferred Items

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | REGLA-03 "applies to ... Excel" and FILT-05 "export" parts | Phase 3 | Phase 3 SC4: "descarga un Excel ... que respeta los filtros activos y el modo con/sin IVA"; the shared `applyFilters` + `entryAmount` seam that Excel will consume is already in place. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/domain/accounting/decimal.ts` | big.js strict arithmetic | VERIFIED | Substantive, imported by every accounting module, `Big.strict = true`, string-only parse |
| `src/domain/accounting/amounts.ts` | Con/Sin IVA, IEPS, TipoCambio | VERIFIED | WIRED to `ledger.ts` |
| `src/domain/accounting/months.ts` | Literal-date months | VERIFIED | No `Date` anywhere; WIRED to ledger/filters/aggregate |
| `src/domain/accounting/ledger.ts` | Mode-independent ledger | VERIFIED | WIRED via `useLedger` to Dashboard, Quality tab and shell counter |
| `src/domain/accounting/aggregate.ts` | KPIs, series, ranking, deltas | VERIFIED | WIRED in `DashboardTab` |
| `src/domain/accounting/filters.ts` | Single `applyFilters` | VERIFIED | WIRED in `DashboardTab`; previous-period filters for deltas |
| `src/domain/accounting/quality.ts` | Ten incident types | VERIFIED | WIRED to `QualityTab` and Dashboard notice |
| `src/stores/sessionStore.ts` | In-memory filters/exclusions/tabs/focus | VERIFIED | No persist middleware |
| `src/stores/settingsStore.ts` | Only persisted key (`ivaMode`) | VERIFIED | zod-validated rehydration, `skipHydration`, rehydrated in `AppShell` effect |
| `src/features/dashboard/{KpiRow,TrendChart,SupplierRanking,FilterBar,DateRangeFilter,MultiSelectFilter,SupplierDialog}.tsx` | Dashboard UI | VERIFIED | All imported and rendered from `DashboardTab` |
| `src/features/invoices/{InvoiceTable,columns}.tsx` | Sortable table, concepts, exclude | VERIFIED | Rendered by `DashboardTab` |
| `src/features/quality/*` | Quality panel | VERIFIED | Third tab in `AppShell` |
| `src/features/shell/{AppShell,TopBar,IvaToggle}.tsx` | Shell, controlled tabs, IVA control | VERIFIED | |
| `tests/fixtures/cfdi/anon/*.xml` + `ledger.anon`/`amounts`/`months` tests | Anonymised proof | VERIFIED | 872 tests green |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `useSessionStore.invoices/excluded/restored` | `buildLedger` | `useLedger` (memoised) | WIRED | Single ledger source for Dashboard, Quality, shell |
| `applyFilters` result | KPIs, trend, ranking, table | `visible` in `DashboardTab` | WIRED | Same array feeds all four views |
| `useSettingsStore.ivaMode` | `kpis`/`monthlySeries`/`supplierRanking`/`InvoiceTable` | prop/arg | WIRED | Mode picks `conIva`/`sinIva`, never rebuilds ledger |
| `InvoiceTable` menu | `excludeInvoice`/`reincludeInvoice` | store actions + sonner toast | WIRED | |
| Quality "Ver factura" | table row | `requestFocus` -> `focusRequest` -> `InvoiceTable` derived state | WIRED | Hidden-by-filter Alert wired in `DashboardTab` |
| Settings store | `localStorage` | custom storage, key `invoicechecker:settings` | WIRED | Only `ivaMode` partialized |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `KpiRow` | `current`, `deltas` | `kpis(visible,...)` over ledger from parsed XML | Yes | FLOWING |
| `TrendChart` | `series`, `promedio` | `monthlySeries(visible, range, mode)` | Yes | FLOWING |
| `SupplierRanking` | `ranking` | `supplierRanking(visible, mode)` | Yes | FLOWING |
| `InvoiceTable` | `rows` | `toInvoiceRows(visible, mode)` | Yes | FLOWING |
| `QualityTab` | incidents | `qualityIncidents(ledger)` | Yes | FLOWING |

No hardcoded-empty props at call sites.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole accounting + UI suite | `pnpm vitest run` (once) | 872 passed / 44 files | PASS |
| Types | `pnpm tsc --noEmit` | exit 0 | PASS |
| Lint | `pnpm eslint .` | exit 0, 1 warning | PASS |
| Next build / e2e | not run by verifier | orchestrator reports build OK; e2e needs local password env | SKIP (e2e routed to human items) |

### Probe Execution

Step 7c: SKIPPED (no probe scripts are declared by the phase and none exist under `scripts/*/tests/`).

### Requirements Coverage

All 21 IDs declared in the Phase 2 ROADMAP entry appear in at least one PLAN `requirements:` field (union checked across the 15 plans), and REQUIREMENTS.md maps no additional ID to Phase 2 (no orphans). REQUIREMENTS.md still lists them as `Pending` / unchecked: the orchestrator will update traceability.

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| REGLA-01 | 02-01, 02-04 | I adds, E subtracts, P does not sum | SATISFIED | `kindOf`, `amountsOf`, sign factor in `invoiceAmounts` |
| REGLA-02 | 02-04 | Credit note in related invoice's month, else own date with notice | SATISFIED | `imputationOf`; `nc-sin-relacionada` incident + Dashboard notice |
| REGLA-03 | 02-02, 02-03, 02-06, 02-07 | Global con/sin IVA, mode always visible | SATISFIED (Excel tail deferred to Phase 3) | `IvaToggle`, mode caption, selectors |
| REGLA-04 | 02-01, 02-03 | Exact big.js, round only on display | SATISFIED (see WR-02 display caveat) | `decimal.ts` strict Big; 400-invoice BigInt reference test |
| REGLA-05 | 02-03 | Months by literal Fecha | SATISFIED | `months.ts`, boundary tests |
| REGLA-06 | 02-04, 02-13, 02-14 | $0 excluded from counts/averages and listed in quality | SATISFIED | `noSuma:"cero"`, `cero` incident |
| REGLA-07 | 02-03, 02-13 | Foreign currency via invoice TipoCambio | SATISFIED | `exchangeRate`; `moneda-sin-tc` never invents a rate |
| REGLA-08 | 02-04, 02-06, 02-07, 02-13, 02-15 | Manual exclusion | SATISFIED (WR-01 warning) | store + ledger + row menu |
| REGLA-09 | 02-04 | PPD real form from Pago | SATISFIED | `indexPaymentForms`, `formasOf` |
| DASH-01 | 02-01, 02-05, 02-10 | KPIs | SATISFIED | `kpis`, `KpiRow` |
| DASH-02 | 02-05, 02-11, 02-12 | Monthly trend incl. zero months | SATISFIED | `monthlySeries`, `TrendChart` |
| DASH-04 | 02-05, 02-12 | Supplier ranking with ticket promedio | SATISFIED | `supplierRanking`, `SupplierRanking` |
| DASH-06 | 02-05, 02-10, 02-11 | Average divides by calendar months, stated on screen | SATISFIED | `monthsInRange`, `monthsSubLabel` |
| DASH-09 | 02-13 | Sortable invoice/concept table | SATISFIED | `InvoiceTable` |
| DASH-10 | 02-01, 02-07..02-14 | Spanish es-MX UI | SATISFIED | `es.ts` copy, `Intl` es-MX |
| FILT-01 | 02-05, 02-08 | Date range / month filter | SATISFIED | `DateRangeFilter`, `filters.range` |
| FILT-02 | 02-05, 02-09 | Multi-supplier filter | SATISFIED | `MultiSelectFilter`, supplier set by RFC |
| FILT-04 | 02-05, 02-08, 02-09 | Forma de pago with SAT names | SATISFIED (catalog wording is a human item) | `catalogs.ts`, `formaOptions` |
| FILT-05 | 02-05, 02-06, 02-09, 02-15 | Filters consistent across views/export | SATISFIED for views; export is Phase 3 | single `applyFilters` |
| CAL-01 | 02-14, 02-15 | Quality panel | SATISFIED | `quality.ts`, `QualityTab` |
| DEV-03 | 02-03, 02-04, 02-15 | Vitest on anon XML; `Facturas/` out of git | SATISFIED | tests above; `.gitignore` |

### Anti-Patterns Found

No TBD/FIXME/XXX debt markers in phase files (a grep for `any`, `@ts-ignore`, `@ts-nocheck` over `src` found none; no non-null `!` usages found in non-test code). `Number()` appears in non-test code only for integer month parts, a boolean count, and chart/bar geometry derived from already-rounded strings (display layer), plus the one flagged below.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/stores/sessionStore.ts` / `src/features/invoices/InvoiceTable.tsx` | 122-126 / 323-339 | WR-01: `reincludeInvoice` always adds to `restored`, also when undoing a plain manual exclusion | Warning | Confirmed by reading `ledger.ts:303-308`: if X is excluded then undone (so `restored` has X) and a later batch loads Y with a TipoRelacion-04 naming X, X stays counted together with Y; spend, ticket and deltas are overstated and the substitution row reads "reincluida", so no amount-changing alert fires. Does not break SC4 (manual exclusion works), but is a latent double-count. The user accepted the "literal plan behaviour" (`sessionStore.test.ts:153` asserts it) without this consequence. Small fix: only add to `restored` when `entry.substitutedBy !== null`. |
| `src/lib/format.ts` | 48-63 | WR-02: `formatTotal` uses `Number(total)` before `Intl` | Warning | Display-only, never feeds a sum; can mis-round half-cent values (e.g. `0.145`) in Quality rounding rows and foreign-currency totals, and disagrees with `formatMoney`. Violates the spirit of REGLA-04 ("rounding only on display, exact") and the CLAUDE.md money rule. |
| `src/domain/accounting/months.ts`, `filters.ts` | 23-38, 47-58 | WR-03: any 4-digit year accepted; `loadedSpan` spans all entries | Warning | One typo'd Fecha year widens the default range to thousands of months (trend, selects, average divisor diluted). Realistic only with damaged data; the 2025 sample is unaffected. Business decision required. |
| `src/features/invoices/InvoiceTable.tsx` | 176 | WR-04: duplicate React key for two identical payments | Warning | React key warning / possible row glitch; cosmetic. |
| IN-01..IN-06 (see `02-REVIEW.md`) | | substitution cycles, `as` casts in vendored `chart.tsx`, dangling `aria-controls`, settings merge default, ranking scale, negative amounts accepted | Info | None undermines a truth; IN-06 (negative Total accepted silently) is worth a Phase 3 hardening look. |

None of the four warnings makes a roadmap truth FALSE, so none is classed as a BLOCKER. WR-01 is the one that can silently produce a wrong total and should be resolved (fix or explicit acceptance) before the milestone closes.

### Human Verification Required

See the `human_verification` list in the frontmatter (items 1-8 are the end-of-phase checklist of `02-15-PLAN.md` Task 3; item 9 is the unverified SAT catalog wording from 02-03 D7; items 10-11 are the WR-01 and WR-03 decisions). Per-plan `human_judgment` items (tab/card visual fit 02-01, bar sticky stacking 02-07, Fechas popover 02-08, 288 px scroll region 02-09, `--chart-1`/`--positive` tokens and KPI width 02-10, chart rendering 02-11, ranking proportions and dialog sizing 02-12, table overflow backstops 02-13, quality identity-line truncation 02-14, tab list at 360 px 02-15) are all covered by those eight scenarios. The Playwright smoke (`e2e/smoke.spec.ts`, `pnpm test:e2e`) needs the local password environment and was not run by this verifier.

### Gaps Summary

No goal-blocking gaps. Every roadmap Success Criterion is implemented, wired and tested, and an independent run of tsc, eslint and vitest agrees with the orchestrator. The remaining work is human: confirm the UI in a real browser, confirm the SAT catalog wording, and take two decisions (WR-01 undo semantics, WR-03 plausible-year rule). The review's other warnings (WR-02, WR-04) are small hygiene fixes that can ride with whichever fix pass the user chooses.

---

_Verified: 2026-10-15T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
