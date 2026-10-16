---
status: testing
phase: 02-dashboard-de-gasto-confiable
source: [02-VERIFICATION.md]
started: 2026-10-16T01:20:33Z
updated: 2026-10-16T19:13:23Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 11
name: DECISION on WR-03: what to do with an implausible Fecha year (0001 or 2205) that stretches the loaded month span (D-12/D-41).
expected: |
  User defines a plausible-year window or another rule.
awaiting: user response

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
result: [pending]

## Summary

total: 11
passed: 9
issues: 1
pending: 1
skipped: 0
blocked: 0

## Gaps

- gap_id: G-02-10
  truth: "Undo exclusion ('Deshacer exclusion') and 'Volver a incluir' only touch `restored` for entries actually substituted by a TipoRelacion-04 invoice; a normal exclusion undone never makes a later substitute double-count the original."
  status: failed
  reason: "User reported: Decision on WR-01 — fix now (02-REVIEW.md WR-01: undo/re-include of a normal exclusion writes to `restored`, so a later substitute double-counts the original)."
  severity: major
  test: 10
  artifacts: []
  missing: []
