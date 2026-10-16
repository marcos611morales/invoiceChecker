---
phase: 02-dashboard-de-gasto-confiable
verified: 2026-10-16T21:00:00Z
status: passed
score: 7/7 must-haves verified
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
  - .planning/phases/02-dashboard-de-gasto-confiable/02-16-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-16-SUMMARY.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-17-PLAN.md
  - .planning/phases/02-dashboard-de-gasto-confiable/02-17-SUMMARY.md
  - src/domain/accounting/aggregate.ts
  - src/domain/accounting/amounts.ts
  - src/domain/accounting/decimal.ts
  - src/domain/accounting/filters.ts
  - src/domain/accounting/ledger.ts
  - src/domain/accounting/months.ts
  - src/domain/accounting/quality.ts
  - src/features/dashboard/DashboardTab.tsx
  - src/features/dashboard/useLedger.ts
  - src/features/invoices/InvoiceTable.tsx
  - src/features/quality/QualityAccordions.tsx
  - src/features/quality/QualityTab.tsx
  - src/features/shell/AppShell.tsx
  - src/lib/format.ts
  - src/stores/sessionStore.ts
  - src/stores/settingsStore.ts
covered_digest: "v3:sha256:79b47768204783275784e1b083d79931cf78f2ca6ae6ddd65020caea1104afed"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "G-02-10 (UAT test 10, review WR-01): undo of a plain exclusion / 'Volver a incluir' no longer writes `restored` (plan 02-16)"
    - "G-02-11 (UAT test 11, review WR-03): Fecha year outside 2000..currentYear+1 is datos-invalidos, does not sum, does not widen the span (plan 02-17, D-48)"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "REGLA-03 tail and FILT-05 'export' part: the Con/Sin IVA mode and the active filters apply to the Excel export"
    addressed_in: "Phase 3"
    evidence: "Phase 3 SC4: 'descarga un Excel ... que respeta los filtros activos y el modo con/sin IVA'"
advisory:
  - finding: "Stale 'Deshacer exclusion' toast token can write `restored` after clearAll (02-REVIEW.md WR-01, new): ExclusionUndo carries no session generation, so undoExclusion after a logout/reset re-adds a uuid to `restored` of the fresh session"
    category: other
    reason: "Reachable only if the user (1) re-included a substituted original, (2) excluded it, (3) cleared the session, (4) clicked the old toast and (5) re-imported the same XML plus a substitute. No roadmap truth fails. Small fix (add `generation` to the token, ignore on mismatch) proposed in 02-REVIEW.md; the user must choose fix now / defer / accept (CLAUDE.md rule 1)."
    evidence_status: "code read: src/stores/sessionStore.ts:142-154, no generation check in undoExclusion; no test covers it"
  - finding: "IN-01 (useLedger year snapshot per hook instance), IN-02 (wrong browser clock yields 'Fecha invalida' with no hint; NaN currentYear opens the upper bound)"
    category: other
    reason: "Info items of the fresh review; the window is by design clock-dependent (D-48)."
    evidence_status: "code read"
  - finding: "Older open review items WR-02 (formatTotal uses Number() before Intl, display-only in Calidad rounding rows) and WR-04 (duplicate React key for identical payments at InvoiceTable.tsx:176), IN-03..IN-06"
    category: other
    reason: "Carried from the previous review; none changes a counted amount or a roadmap truth. WR-02 is a display-only deviation from the spirit of REGLA-04 (confirmed still present at src/lib/format.ts:51)."
    evidence_status: "code read"
---

# Phase 2: Dashboard de gasto confiable Verification Report

**Phase Goal:** El usuario ve en que se gasta y cuanto en promedio (KPIs, tendencia mensual, ranking de proveedores y tabla de facturas) con montos que respetan las reglas acordadas (I/E/P, con/sin IVA, facturas en $0 y excluidas), filtros consistentes y un panel de calidad de datos.
**Verified:** 2026-10-16T21:00:00Z
**Status:** passed
**Re-verification:** Yes. The previous report (2026-10-15, `human_needed`) was stale: covered sources changed after it ran (gap-closure plans 02-16 and 02-17). This report regenerates the verdict for the whole phase (17 plans) and recomputes the covered-input fingerprint.

## Independent gate run (this verification)

| Gate | Result |
| ---- | ------ |
| `pnpm tsc --noEmit` | exit 0, 0 errors |
| `pnpm eslint .` | exit 0, 0 errors, 1 warning (unused eslint-disable in `src/lib/client/navigation.ts`, pre-existing Phase 1) |
| `pnpm vitest run` (once, output saved) | 44 files, 904 tests passed, includes the real-data tests (`Facturas/2025` holds 286 files locally: 143 XML + 143 PDF) |
| Targeted run of the gap-closure tests (`-t "WR-0[13]"` over 6 files) | 33 passed, 0 failed |
| `Facturas/` out of git | `.gitignore:1: Facturas/`; `git ls-files Facturas` returns 0 files |
| `next build` | not re-run by this verifier; orchestrator observed OK |
| Debt markers / `any` / `@ts-ignore` / non-null `!` | none in the 12 phase-modified source files scanned |

## Goal Achievement

### Observable Truths

Roadmap Success Criteria (contract) plus the two UAT gap-closure truths.

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: with 2025 loaded, es-MX Gasto total, Facturas, Ticket promedio, Promedio mensual; credit notes subtract in the month of their related invoice (own date with notice if not loaded); Pago and $0 invoices neither sum nor count | VERIFIED | `ledger.ts` `kindOf`/`amountsOf` (`noSuma` "tipo" for P/T/N, "cero" when converted Total is 0, `counted = noSuma === null && exclusion === null`); `imputationOf` (ledger.ts:216-238) moves a nota-credito to the oldest loaded related invoice's month with a usable Fecha, else own month; `kpis()` consumes only counted entries; `ledger.anon.test.ts` imputation tests pass; `nc-sin-relacionada` incident plus Dashboard notice. |
| 2 | SC2: Con IVA (Total) / Sin IVA (Subtotal - Descuento + IEPS) toggle changes KPIs, zero-filled trend, ranking with ticket promedio and sortable table together; active mode always visible | VERIFIED | `amounts.ts` exact `Big` arithmetic, mode only selects the stored amount; one `ivaMode` from the settings store feeds `kpis`, `monthlySeries`, `supplierRanking`, `InvoiceTable` in `DashboardTab`; IvaToggle plus mode caption; UAT tests 1-2 passed by the user in a real browser against the 143 real XML. |
| 3 | SC3: filters by range/month, supplier(s) and SAT-named forma de pago (PPD shows the Pago's real form); KPIs, charts and tables reflect the same filter; Promedio mensual states it divides by calendar months | VERIFIED | Single `applyFilters` output `visible` feeds all four views; `indexPaymentForms`/`formasOf` replace PPD "99" by the loaded Pago's FormaDePagoP, else "Por definir (sin complemento de pago)"; `kpis().promedio = gasto / monthsInRange(range).length` and `monthsSubLabel`; UAT test 3 passed. |
| 4 | SC4: manual "Excluida" stops counting everywhere; Calidad de datos lists duplicates, error files, $0, rounding, substitutions (04), credit notes without related invoice | VERIFIED | `sessionStore.excludeInvoice` -> `useLedger` -> `buildLedger` (`exclusion: "manual"`, `counted=false`); `quality.ts` incident types; duplicates/error files via the ImportReport tab linked from Quality; UAT tests 4-5 passed. Exclusion/undo semantic is now exact (truth 6). |
| 5 | SC5: Vitest over anonymised XML (descuentos, IEPS, near-month-change dates, TipoCambio, exact big.js) passes; `Facturas/` outside git | VERIFIED | 904/904 pass; fixtures `tests/fixtures/cfdi/anon/{anon-egreso,anon-ingreso-descuento,anon-ingreso-ieps,anon-pago}.xml` present; `.gitignore` + `git ls-files Facturas` = 0. |
| 6 | G-02-10: "Deshacer exclusion" returns excluded/restored to exactly the prior state of that uuid; "Volver a incluir" writes `restored` only when `entry.substitutedBy !== null`; excluding X, undoing/re-including it, then loading a TipoRelacion-04 substitute Y leaves X "Sustituida" (Gasto $116.00, not $232.00); manual-and-substituted re-include overrides (user decision) | VERIFIED (behavioral) | Code: `sessionStore.ts:142-159` `excludeInvoice` returns `{uuid, wasRestored}`; `undoExclusion` re-adds to `restored` only when `wasRestored`; `reincludeInvoice(uuid, {overrideSubstitution})` with a required option; callers `InvoiceTable.tsx:325-340` and `QualityAccordions.tsx:178` pass `entry.substitutedBy !== null`; no other production writer of `restored`. Tests run and passed: sessionStore (7 WR-01 tests), InvoiceTable (toast undo plain, toast undo of re-included substituted original, substitute arriving while toast open, row-menu plain, row-menu manual+substituted), QualityTab (plain "Excluidas" re-include, manual+substituted override). 02-06-PLAN truth line corrected (grep-confirmed). |
| 7 | G-02-11 / D-48: Fecha year outside 2000..(currentYear+1), both ends inclusive, gets no month at the single `monthOfFecha` point; Ingreso/Egreso -> datos-invalidos (field Fecha) "Fecha invalida: no se suma", not counted, amount-change alert raised; span/month list/average divisor stay bounded; Pago/Traslado/Nomina stay "tipo", no incident; credit-note falls back; year injected from the browser in `useLedger`, domain reads no clock | VERIFIED (behavioral) | `months.ts:45-61` `monthOfFecha(fecha, context)` rejects `year < MIN_FECHA_YEAR(2000) || year > currentYear + 1` after calendar checks; `ledger.ts:305` (own month) and `:232` (imputation) both pass `context`; `buildLedger` takes a required `FechaContext` (ledger.ts:290-294); `useLedger.ts` reads `new Date().getFullYear()` once via lazy `useState` and passes `{ currentYear }`; `grep "new Date\|Date.now" src/domain` finds only test code; `loadedSpan` skips null months. Tests run and passed: months.test.ts window tests (5, boundaries 1999/2000/cy+1/cy+2, 0000/0001/9999), ledger.test.ts "Fecha year window" (8: precedence over invalid Total, Pago stays tipo, credit-note fallback, injected-year follow, bounded span/KPIs/series/incidents), DashboardTab (4, injected via `vi.setSystemTime`, both inclusive ends, Pago no notice), QualityTab (lists only out-of-window). D-48 recorded in `02-CONTEXT.md:80` and D-41 line points to it. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

Behavior-dependent truths (6, 7: state transitions of the exclusion/restored sets and the year-window effect on span) were upgraded from presence to VERIFIED only through the named passing tests above, not through symbol presence.

### Deferred Items

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | Con/Sin IVA mode and active filters applied to the Excel export (REGLA-03 tail, FILT-05 "export") | Phase 3 | Phase 3 SC4: "descarga un Excel ... que respeta los filtros activos y el modo con/sin IVA"; the shared `applyFilters` + `entryAmount` seam is already in place. |

### Advisory (open review items, not blocking)

| # | Finding | Category | Why Advisory |
| - | ------- | -------- | ------------ |
| 1 | WR-01 (new): stale undo token can write `restored` after `clearAll` (`sessionStore.ts:150-154`; no generation in `ExclusionUndo`) | state | Five-step precondition chain; no roadmap truth or amount shown on screen is wrong in normal use. Fix is small and specified in 02-REVIEW.md. User decision pending (disposition `open`). |
| 2 | IN-01 per-instance year snapshot; IN-02 wrong browser clock / NaN year | design | Info; by design clock-dependent (D-48). |
| 3 | WR-02 `formatTotal` uses `Number()`; WR-04 duplicate React key (`InvoiceTable.tsx:176`); IN-03..IN-06 | hygiene | Display-only or cosmetic; none changes a counted amount. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/domain/accounting/decimal.ts`, `amounts.ts` | exact big.js Con/Sin IVA, IEPS, TipoCambio | VERIFIED | Substantive, used by ledger |
| `src/domain/accounting/months.ts` | literal-date months with year window | VERIFIED | `MIN_FECHA_YEAR`, `FechaContext`, windowed `monthOfFecha`; no `Date` |
| `src/domain/accounting/ledger.ts` | mode-independent ledger with required `FechaContext` | VERIFIED | WIRED via `useLedger` |
| `src/domain/accounting/aggregate.ts`, `filters.ts`, `quality.ts` | KPIs/series/ranking, single `applyFilters`, incidents | VERIFIED | WIRED in Dashboard and Quality |
| `src/features/dashboard/useLedger.ts` | injects browser year | VERIFIED | Only production caller of `buildLedger` |
| `src/stores/sessionStore.ts` | `ExclusionUndo`, `undoExclusion`, `ReincludeOptions` | VERIFIED | No persist middleware; all callers updated |
| `src/features/invoices/InvoiceTable.tsx`, `src/features/quality/QualityAccordions.tsx` | callers compute `overrideSubstitution` | VERIFIED | Pattern `overrideSubstitution: entry.substitutedBy !== null` present in both |
| `src/stores/settingsStore.ts`, `src/features/shell/AppShell.tsx`, `src/features/dashboard/DashboardTab.tsx`, `src/features/quality/QualityTab.tsx`, `src/lib/format.ts` | settings persistence, shell, views, formatting | VERIFIED | Unchanged in substance since previous report; tests green |
| `tests/fixtures/cfdi/anon/*.xml`, `tests/support/ledgerFactory.ts` (`TEST_FECHA_CONTEXT`) | anonymised proof, injected test year | VERIFIED | 4 fixtures present |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `useLedger` | `buildLedger` | `buildLedger(invoices, {excluded, restored}, { currentYear })` | WIRED |
| `buildLedger` | `monthOfFecha` | own month (ledger.ts:305) and credit-note imputation (ledger.ts:232) share `context` | WIRED |
| `ledger` ownMonth null | `quality.ts` datos-invalidos | `invalidField: "Fecha"` in `amountsOf` | WIRED (Quality test lists only out-of-window) |
| `InvoiceTable` toast | `undoExclusion(undo)` | token from `excludeInvoice` | WIRED |
| `InvoiceTable.reinclude` / `QualityAccordions` button | `reincludeInvoice` | `overrideSubstitution: entry.substitutedBy !== null` | WIRED |
| `sessionStore.restored` | ledger "sustituida" branch | `substitutedBy !== null && !overrides.restored.has` | WIRED |
| `applyFilters` `visible` | KPIs, trend, ranking, table | `DashboardTab` | WIRED |
| settings store | `localStorage` key `invoicechecker:settings` | only `ivaMode` partialized | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `KpiRow` / `TrendChart` / `SupplierRanking` / `InvoiceTable` | `visible` | `applyFilters(useLedger(), ...)` over parsed XML | Yes (real-data test over 143 XML passes) | FLOWING |
| `QualityTab` | incidents | `qualityIncidents(ledger)` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole suite | `pnpm vitest run` (once) | 904 passed / 44 files | PASS |
| Gap-closure behaviors | `vitest run <6 files> -t "WR-0[13]\|Fecha year window\|plausible year"` | 33 passed | PASS |
| Types / lint | `pnpm tsc --noEmit`, `pnpm eslint .` | exit 0 / 0 errors, 1 pre-existing warning | PASS |
| Next build | not run | orchestrator: OK | SKIP |

### Probe Execution

Step 7c: SKIPPED (no probe scripts are declared by the phase and none exist under `scripts/*/tests/`).

### Requirements Coverage

Union of `requirements:` across the 17 PLAN frontmatters covers all 21 IDs of the ROADMAP Phase 2 entry. REQUIREMENTS.md maps exactly these 21 IDs to Phase 2 (21 rows `| Phase 2 |`); no orphans. Note: the traceability table still shows many as `Pending` / unchecked (only REGLA-05, REGLA-08, DASH-02, DASH-06, FILT-01, CAL-01 are Complete); the orchestrator should update it.

| Requirement | Source Plans | Status | Evidence |
| ----------- | ------------ | ------ | -------- |
| REGLA-01 | 02-01, 02-04 | SATISFIED | `kindOf`, sign factor in `invoiceAmounts`, `noSuma:"tipo"` for P |
| REGLA-02 | 02-04 | SATISFIED | `imputationOf`; `nc-sin-relacionada` notice; D-48 fallback to own month when related Fecha is out of window |
| REGLA-03 | 02-02, 02-03, 02-06, 02-07 | SATISFIED (Excel tail deferred to Phase 3) | `IvaToggle`, mode caption, selectors |
| REGLA-04 | 02-01, 02-03 | SATISFIED (WR-02 display caveat advisory) | strict `Big`, 400-invoice BigInt reference test |
| REGLA-05 | 02-03, 02-17 | SATISFIED | literal-Fecha months, boundary tests, year window |
| REGLA-06 | 02-04, 02-13, 02-14 | SATISFIED | `noSuma:"cero"`, `cero` incident |
| REGLA-07 | 02-03, 02-13 | SATISFIED | `exchangeRate`; `moneda-sin-tc` never invents a rate |
| REGLA-08 | 02-04, 02-06, 02-07, 02-13, 02-15, 02-16 | SATISFIED | exclusion + exact undo/re-include (truth 6) |
| REGLA-09 | 02-04 | SATISFIED | `indexPaymentForms`, `formasOf` |
| DASH-01 | 02-01, 02-05, 02-10 | SATISFIED | `kpis`, `KpiRow` |
| DASH-02 | 02-05, 02-11, 02-12, 02-17 | SATISFIED | `monthlySeries` zero-filled, span bounded by D-48 |
| DASH-04 | 02-05, 02-12 | SATISFIED | `supplierRanking` |
| DASH-06 | 02-05, 02-10, 02-11, 02-17 | SATISFIED | `monthsInRange`, `monthsSubLabel`, divisor bounded |
| DASH-09 | 02-13 | SATISFIED | `InvoiceTable` sortable, concepts panel |
| DASH-10 | 02-01, 02-07..02-14 | SATISFIED | es-MX copy and `Intl` |
| FILT-01 | 02-05, 02-08, 02-17 | SATISFIED | `DateRangeFilter`; month lists bounded |
| FILT-02 | 02-05, 02-09 | SATISFIED | `MultiSelectFilter` by RFC |
| FILT-04 | 02-05, 02-08, 02-09 | SATISFIED | `catalogs.ts`; wording confirmed by user in UAT test 9 |
| FILT-05 | 02-05, 02-06, 02-09, 02-15 | SATISFIED for views; export is Phase 3 | single `applyFilters` |
| CAL-01 | 02-14, 02-15, 02-16, 02-17 | SATISFIED | `quality.ts`, `QualityTab`; out-of-window Fecha listed |
| DEV-03 | 02-03, 02-04, 02-15 | SATISFIED | anon fixtures, `Facturas/` gitignored and untracked |

### Anti-Patterns Found

No TBD/FIXME/XXX, `any`, `@ts-ignore`, `@ts-nocheck` or non-null `!` in the 12 phase source files scanned (sessionStore, months, ledger, useLedger, InvoiceTable, QualityAccordions, aggregate, filters, quality, amounts, decimal, DashboardTab). No `Date`/`Date.now` in `src/domain` non-test code. Remaining items are the advisory list above; none is a blocker.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/stores/sessionStore.ts` | 150-154 | Undo token without session generation (review WR-01) | Warning (advisory) | Narrow stale-toast path; no roadmap truth fails |
| `src/lib/format.ts` | 51 | `Number(total)` before `Intl` (review WR-02) | Warning (advisory) | Display-only, Calidad rounding rows |
| `src/features/invoices/InvoiceTable.tsx` | 176 | Possible duplicate React key (review WR-04) | Warning (advisory) | Cosmetic |

### Human Verification

The end-of-phase human checklist of the previous report (8 browser scenarios and the SAT catalog wording, 9 items) was executed by the user in `02-UAT.md`: tests 1-9 `pass`. UAT tests 10 and 11 were business decisions that produced gaps G-02-10 and G-02-11; both are now implemented and covered by the deterministic component- and domain-level tests listed in truths 6 and 7 (the component tests drive the real store, ledger and rendered table/Quality tab, with the year pinned through `vi.setSystemTime`). No present-but-behavior-unverified truth remains, so no new human item is required.

Recommended (optional, not gating): in `/gsd-verify-work` re-test UAT 10 and 11 by hand in the browser (undo an exclusion then drop a substitute; load an XML with a 2205 Fecha) to close the two UAT gaps formally.

### Gaps Summary

No gaps. All five roadmap Success Criteria and the two UAT gap-closure truths are implemented, wired and backed by passing tests; independent tsc, eslint and the full vitest suite agree with the orchestrator (904/904). The only open items are non-blocking review findings. The one that needs a user decision (CLAUDE.md rule 1: ask, do not infer) is WR-01 of the fresh review (stale undo token after clearAll): fix now (add `generation` to `ExclusionUndo`), defer, or accept.

Housekeeping for the orchestrator: ROADMAP.md still reads "17/17 plans executed (2 gap closure plans from UAT pending)" and the REQUIREMENTS.md traceability still lists 15 of the 21 Phase 2 IDs as Pending.

---

_Verified: 2026-10-16T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
