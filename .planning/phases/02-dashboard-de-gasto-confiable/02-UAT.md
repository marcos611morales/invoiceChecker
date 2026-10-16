---
status: diagnosed
phase: 02-dashboard-de-gasto-confiable
source: [02-VERIFICATION.md]
started: 2026-10-16T01:20:33Z
updated: 2026-10-16T19:26:40Z
---

## Current Test

[testing complete]

## Tests

### 1. Production build with the 143 real XML of Facturas/2025: Dashboard opens; Gasto total, Facturas (121), Ticket promedio and Promedio mensual (entre 12 meses) show; deltas read 'Sin datos del periodo anterior'; trend shows 12 bars with a dashed average line; ranking and table (143 rows, Pagos and $0 attenuated and labelled 'No suma').
expected: Figures match the ledger; layout is as described.
result: pass

### 2. Toggle Con IVA / Sin IVA in the top bar: KPIs, chart, ranking and table change at once, the caption names the mode; reload, re-drop the files, confirm the mode was remembered.
expected: All views switch together; only invoicechecker:settings persists.
result: pass

### 3. Filter by one supplier, by a forma de pago (names, never codes; 'Por definir (sin complemento de pago)' for PPD without complement) and by a one-month range; chips appear, 'Quitar filtros' resets, a month without invoices shows the empty state.
expected: Consistent filtering across KPIs, chart, ranking and table.
result: pass

### 4. Exclude an invoice from its menu: totals drop, toast offers 'Deshacer exclusion'; reload and confirm nothing was remembered; re-include from Calidad de datos.
expected: Exclusion applies everywhere and is session-only.
result: pass

### 5. In Calidad de datos check the counter, the cards, and that 'Ver factura' reaches a row on another page, centres it and focuses its chevron; with a filter that hides it, check the Alert (Info icon) and that 'Quitar filtros' reveals it.
expected: Navigation and focus work as specified.
result: pass

### 6. At 1200 px and 360 px: a 13-character amount ($12,345,678.90) is never truncated in a KPI card; under 640 px the 'c/IVA | s/IVA' sub-bar is sticky; 640-767 px shows icon-only 'Agregar facturas' and 'Cerrar sesion'.
expected: Responsive behaviour per UI-SPEC.
result: pass

### 7. Light and dark themes: chart bar contrast, decrease colour, focus rings; 36-month range keeps ticks legible; a negative month draws below the baseline with a correct corner.
expected: Legible and correct in both themes.
result: pass

### 8. On a touch device/emulation, tap a truncated supplier name and confirm the full text opens in a Popover.
expected: Popover shows full text.
result: pass

### 9. Compare the 22 c_FormaPago and 7 c_TipoRelacion labels in src/domain/cfdi/catalogs.ts with the official SAT catalogs (02-03 D7: accepted as written, D-45).
expected: Names match the SAT catalog wording the user wants to see (FILT-04).
result: pass

### 10. DECISION on WR-01 (see Anti-Patterns): fix 'Deshacer exclusion' / 'Volver a incluir' so they only touch `restored` for entries actually substituted by a TipoRelacion-04 invoice, or accept the current literal plan behaviour.
expected: User chooses fix-now, defer to Phase 3, or accept.
result: issue
reported: "Decision: fix now. Undo exclusion / Volver a incluir must only write `restored` for entries actually substituted by a TipoRelacion-04 invoice; otherwise a later substitute double-counts the original."
severity: major

### 11. DECISION on WR-03: what to do with an implausible Fecha year (0001 or 2205) that stretches the loaded month span (D-12/D-41).
expected: User defines a plausible-year window or another rule.
result: issue
reported: "Decision: a Fecha whose year is outside 2000..(current year + 1) is reported as datos-invalidos (field Fecha) in Calidad de datos, does not sum, and does not widen the loaded month span."
severity: major

## Summary

total: 11
passed: 9
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-02-10
  truth: "Undo exclusion ('Deshacer exclusion') and 'Volver a incluir' only touch `restored` for entries actually substituted by a TipoRelacion-04 invoice; a normal exclusion undone never makes a later substitute double-count the original."
  status: failed
  reason: "User reported: Decision on WR-01 — fix now (02-REVIEW.md WR-01: undo/re-include of a normal exclusion writes to `restored`, so a later substitute double-counts the original)."
  severity: major
  test: 10
  root_cause: "reincludeInvoice (src/stores/sessionStore.ts:122-126) unconditionally adds the uuid to `restored` (D-28 'user overrode a TipoRelacion-04 substitution'), even when it only undoes a plain manual exclusion; callers pass only the uuid. A later batch with a TipoRelacion-04 substitute then hits ledger.ts:305 (`substitutedBy !== null && !restored.has`) and both invoices count (repro: Gasto 232.00 instead of 116.00), labelled 'reincluida' with amountChanging=false, so nothing alerts. Origin: 02-06-PLAN.md:25,103 conflated undo-exclusion with override-substitution; 3 tests lock the behaviour in."
  artifacts:
    - path: "src/stores/sessionStore.ts:117-126"
      issue: "reincludeInvoice always writes `restored`; excludeInvoice drops the uuid from `restored` without remembering it, so an exact undo cannot rebuild it"
    - path: "src/features/invoices/InvoiceTable.tsx:323-334"
      issue: "undo toast closure keeps only the uuid and calls reincludeInvoice"
    - path: "src/features/invoices/InvoiceTable.tsx:116-149,336-339"
      issue: "row menu 'Volver a incluir' uses one callback for manual and sustituida rows"
    - path: "src/features/quality/QualityAccordions.tsx:121-185,292"
      issue: "'Volver a incluir' on excluidas and sustituidas rows calls the same action"
    - path: "src/stores/sessionStore.test.ts:153-174,300-313; src/features/invoices/InvoiceTable.test.tsx:548-563; src/features/quality/QualityTab.test.tsx:503-512"
      issue: "tests assert the buggy `restored` write for never-substituted invoices"
    - path: ".planning/phases/02-dashboard-de-gasto-confiable/02-06-PLAN.md:25,103"
      issue: "plan truth wording that conflates the two meanings"
  missing:
    - "Split the meaning: plain re-include/undo of a manual exclusion only removes from `excluded`; override (add to `restored`) only when the entry has substitutedBy !== null at click time (callers have entry: row.entry, incident.entry, byUuid)"
    - "Exact undo: the exclusion toast captures wasRestored = restored.has(uuid) at exclude time; undo removes from `excluded` and re-adds to `restored` only if wasRestored (do not re-read substitutedBy at undo time; do not snapshot whole sets)"
    - "USER DECISION: 'Volver a incluir' on a row that is both manually excluded AND has substitutedBy !== null overrides the substitution too (writes `restored`; X and Y both count, X shows 'reincluida')"
    - "Regression tests per path (toast undo, row-menu manual re-include, Calidad 'excluidas'): exclude normal X, undo/re-include, load substitute Y later -> X sustituida, Gasto 116.00, `restored` lacks X, amount-change notice shows; neighbours: undo after excluding a re-included substituted original restores 232.00; Y arriving while toast open; Calidad 'sustituidas' still writes `restored`"
    - "Update the tests that lock the bug and the clearAll setup; correct the 02-06-PLAN truth line"
  debug_session: ".planning/debug/wr01-restored-pollution.md"

- gap_id: G-02-11
  truth: "A Fecha whose year is outside the window 2000..(current year + 1) is reported as datos-invalidos (field Fecha) in Calidad de datos, does not sum, and does not widen the loaded month span (D-12/D-41), so the month list, chart and Promedio mensual stay bounded."
  status: failed
  reason: "User reported: Decision on WR-03 — fixed window 2000 to current year + 1; out-of-window Fecha becomes datos-invalidos (02-REVIEW.md WR-03: one damaged Fecha can blow up the month span)."
  severity: major
  test: 11
  root_cause: "monthOfFecha (src/domain/accounting/months.ts:12-38), the single Fecha->month point, validates shape/month/day but never the year (FECHA_RE accepts 0000-9999). buildLedger (ledger.ts:297) and credit-note imputation (ledger.ts:230) trust it; amountsOf flags invalido/Fecha only when month is null (ledger.ts:271-273). So an out-of-window Fecha is COUNTED (adds to Gasto), creates no datos-invalidos incident, and widens loadedSpan (repro: 26,447 months, Promedio mensual 0.0175 vs 116, credit note imputed to 2205-01, previousPeriod key '-2203--8'). Second condition: the domain has no current-year input (buildLedger(invoices, overrides) takes none; useLedger passes none)."
  artifacts:
    - path: "src/domain/accounting/months.ts:12-38"
      issue: "no year bound in FECHA_RE / monthOfFecha (root)"
    - path: "src/domain/accounting/ledger.ts:230,252-286,297"
      issue: "both call sites trust monthOfFecha; buildLedger has no currentYear parameter"
    - path: "src/features/dashboard/useLedger.ts:14-22"
      issue: "only production caller of buildLedger; natural place to read the year once"
  missing:
    - "Reject the year at the single Fecha->month point: return null for years outside 2000..currentYear+1, BOTH ENDS INCLUSIVE, shared by ledger.ts:230 and :297 so they cannot drift; this reuses the existing null-month path (invalido/Fecha incident, not counted, span bounded, credit-note fallback)"
    - "Inject the year: required { currentYear: number } on buildLedger (domain stays pure); read once in useLedger via new Date().getFullYear() (USER DECISION: browser local year), e.g. lazy useState initializer; never Date.now() in render (react-hooks/purity) and never parse Fecha via new Date"
    - "USER DECISION: Pago/Traslado/Nomina with out-of-window Fecha stay noSuma 'tipo' with no new incident; they only stop widening the span (keep ledger.test.ts:155)"
    - "USER DECISION: reuse existing copy 'Fecha invalida: no se suma' (es.ts:214-222); no new wording"
    - "USER DECISION: record this as an exception/amendment to D-41 in 02-CONTEXT.md"
    - "Tests with injected year (never the real clock): months.test.ts boundaries (1999-12-31 rejected, 2000-01-01 accepted, (cy+1)-12-31 accepted, (cy+2)-01-01 rejected, 0000/0001/9999); ledger.test.ts invalido/Fecha + precedence vs invalid Total + credit note whose related invoice is out of window falls back to own month; span/aggregate/quality via buildLedger; DashboardTab/QualityTab component level; update the 11 buildLedger( calls in 7 test files"
  debug_session: ".planning/debug/wr03-fecha-year-window.md"
