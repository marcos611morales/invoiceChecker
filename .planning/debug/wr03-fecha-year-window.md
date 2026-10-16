---
status: diagnosed
trigger: "UAT gap G-02-11 (Test 11, WR-03): A Fecha whose year is outside the window 2000..(current year + 1) is reported as datos-invalidos (field Fecha) in Calidad de datos, does not sum, and does not widen the loaded month span (D-12/D-41)."
created: 2026-10-16T00:00:00Z
updated: 2026-10-16T00:00:00Z
goal: find_root_cause_only
---

## Current Focus

bug_class: Bohrbug (deterministic: same XML -> same blown span)
status_note: DIAGNOSED (goal find_root_cause_only). No code changed, nothing committed.
hypothesis: CONFIRMED. monthOfFecha (months.ts:23-38) validates shape/month/day but never the year, so a 0001/2205 Fecha yields a non-null ownMonth; buildLedger marks it as a valid, SUMMING entry (no datos-invalidos), the credit-note imputation can adopt that month, and loadedSpan widens to it. The existing "ownMonth === null -> invalido/Fecha" path in ledger.ts:271-273 already produces the behaviour the user wants and is never reached for out-of-window years. There is also no "current year" input anywhere in the domain.
next_action: hand diagnosis to plan-phase --gaps (G-02-11); planner must ask the user the open questions listed in Resolution before implementing

reasoning_checkpoint:
  hypothesis: "An out-of-window Fecha is counted and stretches the span because monthOfFecha returns a month for any 4-digit year, and nothing in buildLedger knows the current year to reject it."
  confirming_evidence:
    - "Repro: monthOfFecha('0001-03-01T10:00:00') = '0001-03', ('2205-01-01T10:00:00') = '2205-01'; the entries are counted=true, noSuma=null; loadedSpan 0001-03..2205-01 = 26,447 months; datos-invalidos = []."
    - "Differential: the same invoices with malformed Fecha (monthOfFecha -> null) become invalido/Fecha, not counted, month null; span 2 months; all four in datos-invalidos."
  falsification_test: "If any layer (parser, import, ledger, quality) already rejected or flagged out-of-window years, the repro would show noSuma 'invalido' or a datos-invalidos incident for the 0001/2205 invoices. It showed neither."
  fix_rationale: "Make the Fecha->month conversion return null for years outside 2000..(currentYear + 1), with currentYear injected into buildLedger and read once at the client edge. This reuses the existing null-month path, so 'reported as datos-invalidos/Fecha', 'does not sum' and 'does not widen the span' follow from one change at the root, for both call sites (own month and credit-note imputation)."
  blind_spots: "Pago/Traslado/Nomina reporting (tipo precedence); time zone of 'current year'; copy for the row; UI-level tests of the alert and the month selects were not run with an out-of-window file (only the domain pipeline was exercised)."
  candidate_causes:
    - "code: missing year bound in monthOfFecha (months.ts:12-38), trusted at ledger.ts:230 and :297"
    - "config/data-model: missing 'current year' input to buildLedger/useLedger (no clock in the domain by design)"
    - "design: D-41 span over all entries (amplifier, intended; out-of-window is a new, user-approved exception)"
  and_gate: "yes. The symptom needs the unbounded year in monthOfFecha AND the absence of any current-year input; fixing only the lower bound (2000 is a constant) would leave future years such as 2205 open. D-41 amplifies but is not a defect."

## Symptoms

expected: Fecha year outside 2000..(current year + 1) -> datos-invalidos incident (field Fecha) in Calidad de datos; entry does not sum; entry does not widen loadedSpan, so month list, chart and Promedio mensual stay bounded.
actual: monthOfFecha accepts any 4-digit year; loadedSpan takes min/max over all entries (including excluded / not-summing ones). One damaged Fecha (0001 or 2205) blows up the month span.
errors: none reported
reproduction: UAT Test 11 (.planning/phases/02-dashboard-de-gasto-confiable/02-UAT.md); 02-REVIEW.md WR-03.
started: discovered during code review; rule decided during UAT.

## Eliminated

## Evidence

- timestamp: 2026-10-16T00:05:00Z
  checked: .planning/debug/knowledge-base.md (Phase 0)
  found: no knowledge base exists in this repo; MemPalace not queried (not available to this agent)
  implication: no known-pattern candidate; investigate from scratch

- timestamp: 2026-10-16T00:06:00Z
  checked: src/domain/cfdi/parseCfdi.ts:132,145,167
  found: parser only requires the Fecha attribute to be present (malformed("Fecha") when null); the raw string is copied into ParsedInvoice.fecha with no shape or year check
  implication: Fecha validation happens only in the accounting layer (monthOfFecha); the parser is not the place where datos-invalidos is produced

- timestamp: 2026-10-16T00:07:00Z
  checked: src/domain/accounting/months.ts:12-38 (FECHA_RE, monthOfFecha)
  found: FECHA_RE /^(\d{4})-.../ accepts any 4-digit year (0000..9999); monthOfFecha checks month 1..12 and day vs month length/leap year, never the year range
  implication: "0001-03-01T10:00:00" and "2205-01-01T10:00:00" both return a non-null MonthKey

- timestamp: 2026-10-16T00:08:00Z
  checked: src/domain/accounting/ledger.ts:246-281 (amountsOf), 297-299, 310-329
  found: ownMonth = monthOfFecha(invoice.fecha); amountsOf returns { noSuma: "invalido", invalidField: "Fecha" } ONLY when ownMonth === null (line 271-273), after the tipo check (pago/traslado/nomina -> "tipo" first) and the invalid-amount check. counted = noSuma === null && exclusion === null. month = ownMonth except credit notes imputed to a related invoice (imputationOf, lines 215-237, which also calls monthOfFecha on the related invoice's Fecha at line 230)
  implication: the desired behaviour (datos-invalidos/Fecha, does not sum, month null) already exists for malformed Fecha; it is not triggered by out-of-window years because monthOfFecha returns a month. Credit-note imputation would also adopt an out-of-window month from a related invoice.

- timestamp: 2026-10-16T00:09:00Z
  checked: src/domain/accounting/quality.ts:215-220, 57-58, 95-106; src/lib/copy/es.ts:214-222; src/lib/copy/messages.ts:317-323
  found: a datos-invalidos incident is created for every entry with noSuma === "invalido", with field = asInvalidField(entry.invalidField); "Fecha" is already in the closed InvalidFieldName union and has the copy "Fecha inválida" ("Fecha inválida: no se suma" row). datos-invalidos is in AMOUNT_CHANGING_TYPES, so it raises the Dashboard alert.
  implication: no new incident type, field name, or copy is strictly required; the incident model already supports field "Fecha"

- timestamp: 2026-10-16T00:10:00Z
  checked: src/domain/accounting/filters.ts:43-58 (loadedSpan), 71-76 (inRange); aggregate.ts:58-83 (kpis), 127-146 (monthlySeries); DateRangeFilter.tsx:97 (months = monthsInRange(span.from, span.to)); DashboardTab.tsx:50-70
  found: loadedSpan takes min/max of entry.month over ALL entries (counted or not, excluded or not, per D-12/D-41), skipping only month === null. kpis divides gasto by monthsInRange(range).length; monthlySeries zero-fills one point per month; DateRangeFilter renders one SelectItem per month in two selects. inRange keeps month === null entries visible under any date filter (they never sum).
  implication: the ONLY way an entry is kept out of the span today is month === null. Making an out-of-window Fecha produce month === null (and ownMonth === null) gives all three required effects at once: datos-invalidos/Fecha, not counted, span not widened.

- timestamp: 2026-10-16T00:11:00Z
  checked: grep for new Date / Date.now / getFullYear / clock across src and tests
  found: no code reads the wall clock for business logic; DateRangeFilter.thisYearRange is explicitly "anchored on the span end, never on today's date" (UI-SPEC decision 1) and has a test "anchors on the last loaded month, not on today". The only clock use is performance.now() in src/lib/client/ingest.ts (stubbed in tests with vi.spyOn). buildLedger is called only from src/features/dashboard/useLedger.ts (plus tests in InvoiceTable.test.tsx, columns.test.ts, FilterBar.test.tsx, ledger*.test.ts). src/domain is lint-restricted to stay pure (eslint.config.mjs no-restricted-imports).
  implication: "current year" is a new input; it must be injected (domain stays pure and testable) and read once at the client edge (useLedger). Reading the clock's year is NOT a Fecha round-trip through new Date, so REGLA-05 is not violated as long as the Fecha year is still compared as the literal 4-digit text/number.

- timestamp: 2026-10-16T00:12:00Z
  checked: eslint-config-next 16.4.0 dist/index.js rules; eslint-plugin-react-hooks 7.1.1 production build
  found: eslint-config-next spreads react-hooks configs.recommended.rules, which includes react-hooks/purity (severity Error, preset Recommended) flagging known-impure calls (Date.now, performance.now, Math.random) during render
  implication: calling Date.now() in the body of useLedger (or inside its useMemo) is likely to fail `pnpm eslint .`; the year must be read outside render (module-level helper called from a lazy useState initializer or similar) or provided by an injectable clock

- timestamp: 2026-10-16T00:13:00Z
  checked: existing tests touching Fecha/month (ledger.test.ts:118-160, 244-255; months.test.ts; quality.test.ts:350-370, 614; QualityTab.test.tsx:55,462; filters.test.ts:38-60,110; DashboardTab.test.tsx:850; tests/support/ledgerFactory.ts:22 default fecha 2025-01-15)
  found: every fixture Fecha that goes through monthOfFecha is 2019..2026 (inside the window for 2026: 2000..2027). Out-of-window years appear only as direct LedgerEntry.month values (filters.test.ts:110 "2030-01") or store ranges (DashboardTab.test.tsx:850 "1999-01"), which bypass monthOfFecha. ledger.test.ts:155 pins "keeps a Pago with a malformed Fecha as tipo" (invalidField null, no datos-invalidos).
  implication: a window applied in monthOfFecha/buildLedger does not break existing fixtures; but the Pago/Traslado/Nomina case is an open product question (see Resolution)

- timestamp: 2026-10-16T00:20:00Z
  checked: REPRO (scratch vitest against the real worktree modules, config in scratchpad, node_modules symlinked): buildLedger over [2025-06 Ingreso, 0001-03 Ingreso, 2205-01 Ingreso, 1999-12 Ingreso, 2028-01 Ingreso, 2205-01 Pago, 2025-07 Nota de credito related (TipoRelacion 01) to the 2205 invoice], then loadedSpan, qualityIncidents, applyFilters, kpis, monthlySeries, previousPeriod
  found: monthOfFecha returns "0000-03", "0001-03", "1999-12", "2028-01", "2205-01", "9999-12" (all non-null). Every out-of-window Ingreso is noSuma null, invalidField null, counted TRUE (they add to Gasto total: gasto 464 = 5 x 116 - 116). The Pago keeps month "2205-01" (noSuma "tipo"). The credit note dated 2025-07 is imputed to month "2205-01" through its related invoice. loadedSpan = { from "0001-03", to "2205-01" } = 26,447 months; kpis.months 26,447; promedio 0.0175 (baseline with only the 2025 invoice: 1 month, promedio 116); monthlySeries length 26,447; datos-invalidos incidents: [] (none); previousPeriod(span) = { from "-2203--8", to "0001-02" } (malformed key from monthFromIndex on a negative index)
  implication: CONFIRMED. The gap is worse than WR-03 described: out-of-window entries are not just stretching the span, they are COUNTED in the totals, and a valid credit note can be dragged to the bad month through imputation.

- timestamp: 2026-10-16T00:22:00Z
  checked: DIFFERENTIAL: same set, with each bad-year Fecha replaced by a malformed string (forcing monthOfFecha -> null)
  found: each Ingreso becomes noSuma "invalido", invalidField "Fecha", counted false, ownMonth null, month null; datos-invalidos incidents list all four; loadedSpan = 2025-06..2025-07 (2 months); seriesLength 2; previousPeriod 2025-04..2025-05; the credit note falls back to its own month 2025-07; the Pago is noSuma "tipo", month null, and gets NO datos-invalidos incident
  implication: the existing null-month path delivers all three required effects (reported as datos-invalidos/Fecha, does not sum, does not widen the span) for Ingreso and Egreso, at both monthOfFecha call sites. For Pago/Traslado/Nomina it only gives "does not widen the span"; reporting them needs an explicit decision because ledger.test.ts:155 pins tipo-before-Fecha precedence.

- timestamp: 2026-10-16T00:25:00Z
  checked: lint probe (throwaway src/zz-scratch-wr03/probe.tsx, deleted afterwards; git status clean) with five hooks: useMemo(() => Date.now()), new Date().getFullYear() in body, useMemo(() => new Date().getFullYear()), useState(currentCalendarYear) lazy initializer, helper call in body
  found: only `useMemo(() => Date.now(), [])` fails (react-hooks/purity: "Cannot call impure function during render"); the four `new Date().getFullYear()` variants pass `eslint`
  implication: reading the year with Date.now() inside useLedger would break `pnpm eslint .`; a lazy useState initializer (or an injected clock) is lint-clean and also stable across re-renders

## Resolution

root_cause: |
  Two conditions together (AND-gate fired):
  (1) CODE, missing validation: monthOfFecha (src/domain/accounting/months.ts:12-38) is the single point where a CFDI Fecha becomes a month, and it validates shape, month and day but never the year (FECHA_RE accepts 0000..9999). Because buildLedger (ledger.ts:297) and the credit-note imputation (ledger.ts:230) both trust its result, a Fecha such as 0001-.. or 2205-.. gets a real ownMonth/month. amountsOf only emits noSuma "invalido"/invalidField "Fecha" when ownMonth === null (ledger.ts:271-273), so the invoice is COUNTED, no datos-invalidos incident is produced (quality.ts:215-220 keys off noSuma === "invalido"), and loadedSpan (filters.ts:47-58, which by D-12/D-41 deliberately includes every entry with a non-null month) stretches to it. kpis (aggregate.ts:73,79), monthlySeries (aggregate.ts:142) and DateRangeFilter (DateRangeFilter.tsx:97) then iterate every month of that span.
  (2) MISSING INPUT: the domain has no notion of "current year". No code reads the clock for business logic (thisYearRange is explicitly anchored on the span, never on today), buildLedger(invoices, overrides) has no parameter for it, and useLedger (src/features/dashboard/useLedger.ts:14-22) passes none. So the user's window 2000..(current year + 1) cannot be expressed without a new, injected input.
  Amplifier (intended, not a bug): D-41 makes loadedSpan include Pago, $0 and excluded entries, so even a non-summing Pago with a bad year widens the span.
fix: (not applied — goal find_root_cause_only)
verification: (not applied)
files_changed: []
open_questions_for_user:
  - "Pago / Traslado / Nomina with an out-of-window Fecha: today tipo wins over Fecha (ledger.test.ts:155, 'keeps a Pago with a malformed Fecha as tipo'), so with the window they would stop widening the span but would NOT appear in Datos invalidos. Should they also be reported as datos-invalidos (field Fecha), or only kept out of the span?"
  - "Copy: reuse the existing row 'Fecha inválida: no se suma', or a specific text for out-of-window years (for example naming the allowed range)?"
  - "Which 'current year': the browser's local year (new Date().getFullYear()) or the year in America/Mexico_City? They differ only for a few hours around New Year."
  - "Both ends inclusive (2000-01-01 valid, (current year + 1)-12-31 valid)? The UAT wording '2000..(current year + 1)' suggests yes."
  - "D-41 says the default range uses all loaded invoices; this decision adds an exception (out-of-window Fecha does not count for the span). Record it as an amendment to D-41 in 02-CONTEXT.md?"
