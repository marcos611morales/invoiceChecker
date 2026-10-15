---
phase: 02-dashboard-de-gasto-confiable
plan: 14
subsystem: ui
tags: [data-quality, ledger, big.js, react, base-ui-accordion, zustand, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: "LedgerEntry/buildLedger (02-04), session store with excluded/restored/requestFocus/requestImportFocus (02-06), TruncatedText (02-12), invoiceRef/shortUuid and the invoice table (02-13)"
provides:
  - "qualityIncidents / qualitySummary: pure derivation of ten incident types and the amount-changing flag over the unfiltered ledger"
  - "QualityTab: Calidad de datos panel (heading, intro, mode caption, twelve cards, accordions, empty state)"
  - "es.quality copy keys and the row sentence builders in messages.ts (incl. D-46 and gendered D-47 texts)"
affects: [02-15 shell wiring (tab, counter, Dashboard alert, Ver factura flow)]

# Actuals (#2632) - same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 21000
  tasks: 2
  commits: 4
plan_head_before: f909566a9324b920719b59f51bd2f2da17f1ef49
plan_head_after: 172429f01d31964f40da1991586edaee5432c7bd

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure incident derivation: one pass, Map buckets, parseDecimal + Big comparisons, a failed parse skips only that check"
    - "Accordion open rule as per-type dismissed-at counts reconciled during render (no effect)"
    - "Gendered copy through a [field, label] table read via a module-scope Map"

key-files:
  created:
    - src/domain/accounting/quality.ts
    - src/domain/accounting/quality.test.ts
    - src/features/quality/QualityTab.tsx
    - src/features/quality/QualityCards.tsx
    - src/features/quality/QualityAccordions.tsx
    - src/features/quality/QualityTab.test.tsx
  modified:
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "nc-varias-relacionadas is informational: absent from AMOUNT_CHANGING_TYPES, closed by default, counted in the total, never raises amountChanging (D-46, D-04)"
  - "Rounding is strict greater-than 0.01 on the absolute difference, computed on exact decimals in the invoice's own currency; reported amounts are always the XML amounts"
  - "A substitution row reads 'excluida' when the loaded original has any exclusion (substituted or by hand), 'reincluida' when it has none"
  - "Open state of accordions is derived: amount-changing types open while rows exceed the dismissed-at mark (initial 0); other types start at their first-seen count"

patterns-established:
  - "Incident.key is `${type}:${uuid}` (plus `:${targetUuid}` for substitutions) and doubles as the row test id `quality-row-{key}`"
  - "Card test ids `quality-{type}`, trigger test ids `quality-trigger-{type}`, link buttons `quality-link-{duplicados|rechazados}`"

requirements-completed: [CAL-01, DASH-10, REGLA-06]

coverage:
  - id: D1
    description: "qualityIncidents derives the ten incident types in the fixed order from the unfiltered ledger, with exact thresholds, details and the incident counter"
    requirement: CAL-01
    verification:
      - kind: unit
        ref: "src/domain/accounting/quality.test.ts#qualityIncidents: order"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/quality.test.ts#qualitySummary"
        status: pass
    human_judgment: false
  - id: D2
    description: "Diferencias de redondeo uses a strict greater-than-0.01 threshold (0.01 is not an incident, 0.011 is), skips invalid decimals without error and reports XML amounts"
    requirement: REGLA-06
    verification:
      - kind: unit
        ref: "src/domain/accounting/quality.test.ts#redondeo (D-09, REGLA-04 boundary)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Notas de crédito con varias relacionadas is informational (D-46): one row with the imputation month and loaded count, never amount-changing, counted in the total"
    requirement: CAL-01
    verification:
      - kind: unit
        ref: "src/domain/accounting/quality.test.ts#nc-varias-relacionadas (D-34, D-46)"
        status: pass
      - kind: automated_ui
        ref: "src/features/quality/QualityTab.test.tsx#QualityTab accordions > opens only the four amount-changing types by themselves"
        status: pass
    human_judgment: false
  - id: D4
    description: "Calidad de datos tab: heading, intro, mode caption, twelve cards (muted zeros, Phase 1 grid breakpoints), accordions only for types with rows in the fixed order, empty state"
    requirement: DASH-10
    verification:
      - kind: automated_ui
        ref: "src/features/quality/QualityTab.test.tsx#QualityTab cards"
        status: pass
      - kind: automated_ui
        ref: "src/features/quality/QualityTab.test.tsx#QualityTab header and empty state"
        status: pass
    human_judgment: false
  - id: D5
    description: "Open/closed rules: four amount-changing types open by themselves, the other six closed, a type re-opens when it gains rows after being closed, each panel capped at 320 px"
    requirement: DASH-10
    verification:
      - kind: automated_ui
        ref: "src/features/quality/QualityTab.test.tsx#QualityTab accordions"
        status: pass
    human_judgment: false
  - id: D6
    description: "Row sentences of the ten types, with the gendered Datos inválidos text from a per-field label table (D-47) and the D-46 text"
    requirement: CAL-01
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#datosInvalidosRow (D-35, D-47)"
        status: pass
      - kind: automated_ui
        ref: "src/features/quality/QualityTab.test.tsx#QualityTab rows"
        status: pass
    human_judgment: false
  - id: D7
    description: "Ver factura on every row, Volver a incluir only on Excluidas and Sustituidas (removes the row), Ver en Importación on the link-only cards"
    requirement: CAL-01
    verification:
      - kind: automated_ui
        ref: "src/features/quality/QualityTab.test.tsx#QualityTab row actions"
        status: pass
      - kind: automated_ui
        ref: "src/features/quality/QualityTab.test.tsx#QualityTab cards > opens Importación at the matching section from the link-only cards"
        status: pass
    human_judgment: false
  - id: D8
    description: "Identity line truncates the supplier (Tooltip / tap Popover) while explanation sentences wrap, tested with a 90-character supplier; markup in supplier names renders as text"
    verification:
      - kind: automated_ui
        ref: "src/features/quality/QualityTab.test.tsx#QualityTab long and hostile text"
        status: pass
    human_judgment: true
    rationale: "Truncation, wrapping and the look of the 320 px scroll panel and responsive card grid need a visual check in a real browser; jsdom only proves the classes and accessible names"

# Metrics
duration: 17min
completed: 2026-10-15
status: complete
---

# Phase 2 Plan 14: Calidad de datos Summary

**Pure ten-type data-quality derivation over the unfiltered ledger (strict 0.01 rounding threshold on exact decimals, informational D-46 type) plus the Calidad de datos tab with cards, auto-opening accordions, gendered D-47 sentences and Ver factura / Volver a incluir actions**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-15T20:44:00Z
- **Completed:** 2026-10-15T21:01:00Z
- **Tasks:** 2 (TDD: 4 commits)
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- `qualityIncidents` / `qualitySummary` list nc-sin-relacionada, nc-varias-relacionadas, sustituciones, moneda-sin-tc, datos-invalidos, cero, redondeo, ppd-sin-complemento, excluidas and sustituidas in that fixed order. An invoice can appear in several types; the counter counts rows; `amountChanging` is true only for NC sin relacionada, a substitution whose original is excluded, moneda sin TC and datos inválidos.
- Rounding differences use `parseDecimal` and Big comparisons only: exactly 0.01 is not an incident, 0.011 is; an invalid Total, TotalImpuestos or concept importe skips that one check without error.
- `QualityTab` shows the heading, intro, mode caption, twelve cards (ten types plus the link-only Duplicados and Archivos con error with "Ver en Importación"), and accordions only for types with rows. Amount-changing types open by themselves, the other six (D-46 included) start closed, and a type re-opens when it gains rows after being closed.
- All row sentences from the plan, including the D-46 text "Aplica a may 2025: la relacionada más antigua de 2" and the gendered "Fecha inválida" / "Total inválido: no se suma" via the `es.quality.invalidFields` table (Map lookup, neutral "Dato inválido" fallback).
- Plan 02-15 only has to mount `QualityTab` in the shell, feed the tab counter from `qualitySummary(...).total` and the Dashboard alert from `.amountChanging`.

## TDD Gate Compliance

- **RED (domain):** `test(02-14)` b727086, 60 tests against a typed stub of `quality.ts`; 41 failed on assertions (for example `expected [] to deeply equal [ 'redondeo' ]`). `gsd check tdd-red-evidence` on a JUnit report: `RED_EVIDENCE_OK` for the target "redondeo > is an incident at 0.011 and keeps the exact difference". Semantic assessment: the target ran and failed on the planned assertion for the intended reason (stub returns no incidents), not on import or fixture faults.
- **GREEN (domain):** `feat(02-14)` 2f191b2, 60/60 pass.
- **RED (UI and copy):** `test(02-14)` cb24427, 31 QualityTab tests and 9 messages tests failed on assertions (stub component renders nothing, stub builders return ""). `RED_EVIDENCE_OK` for "QualityTab header and empty state > shows the heading..." and "datosInvalidosRow (D-35, D-47) > writes the five full sentences". The `es.quality` copy keys were committed in this RED commit as static data the tests read.
- **GREEN (UI and copy):** `feat(02-14)` 172429f, 77/77 pass; `pnpm verify` (lint, typecheck, 817 tests, build) exits 0.
- No REFACTOR commit was needed.
- Evidence note: the TAP reporter of Vitest emits multi-line YAML values that the classifier rejects as malformed TAP, so the evidence was captured with the JUnit reporter.

## Task Commits

1. **Task 1 RED: failing tests for the incident derivation** - `b727086` (test)
2. **Task 1 GREEN: ten incident types** - `2f191b2` (feat)
3. **Task 2 RED: failing tests for the tab and row sentences** - `cb24427` (test)
4. **Task 2 GREEN: Calidad de datos tab** - `172429f` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `src/domain/accounting/quality.ts` - incident types, order, amount-changing set, details, `qualityIncidents`, `qualitySummary`
- `src/domain/accounting/quality.test.ts` - 60 tests (order, each type, rounding boundary, summary flag, real-ledger D-46 case)
- `src/features/quality/QualityTab.tsx` - panel composition; builds the ledger from the session store like DashboardTab
- `src/features/quality/QualityCards.tsx` - ten incident cards and two link-only cards
- `src/features/quality/QualityAccordions.tsx` - ordered accordions, open rule, rows and actions
- `src/features/quality/QualityTab.test.tsx` - 31 jsdom tests
- `src/lib/copy/es.ts` - `es.quality`
- `src/lib/copy/messages.ts` - `incidentTitle` and the eleven row sentence builders
- `src/lib/copy/messages.test.ts` - tests for the new builders

## Decisions Made

- `Incident.key` is `${type}:${uuid}` (substitutions add `:${targetUuid}`) and is also the row test id.
- `byType` in `QualitySummary` always holds all ten keys (empty arrays) so cards and accordions never test for missing keys.
- Accordion open marks live in component state and are reconciled during render (conditional `setState`, accepted by the project's lint rules), not in an effect, per the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Substitution state for a manually excluded original**
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan words the state as "excluida when the original is currently sustituida, reincluida when loaded and not sustituida". An original excluded by hand (`exclusion: "manual"`, which wins over "sustituida" in the ledger) would then read "La original se volvió a incluir", which is false, and would not raise the amount-changing flag although the original really is excluded.
- **Fix:** The state is "excluida" when the loaded original has any exclusion, "reincluida" when it has none (this is what `restored` produces), "no-cargada" when not loaded. Covered by a test.
- **Files modified:** src/domain/accounting/quality.ts, src/domain/accounting/quality.test.ts
- **Committed in:** 2f191b2

**2. [Rule 3 - Blocking] Test regex for the destructive color**
- **Found during:** Task 2 (GREEN)
- **Issue:** The shared `Button` base class carries `aria-invalid:border-destructive` on every button, so a plain `destructive` search of the tab HTML always matched.
- **Fix:** The test now matches only unprefixed `text|bg|border-destructive` classes. The plan's acceptance grep over the three component sources is unaffected and prints 0.
- **Files modified:** src/features/quality/QualityTab.test.tsx
- **Committed in:** 172429f

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both necessary for correctness of the report and of the test; no scope change.

### Interpretation choices inside the plan (not deviations)

- `month` in the `nc-sin-relacionada` and `nc-varias-relacionadas` details is `MonthKey | null` (the plan says `MonthKey`); null renders "—". It cannot be null for counted entries built by `buildLedger`, but the type stays honest for hand-built entries.
- Rounding differences are stored as absolute values; a concept sum is only compared when the invoice has concepts; only Ingreso and Nota de crédito entries are checked (Pago, Traslado and Nómina never).
- Rounding amounts are formatted with the invoice's own currency (`formatTotal`), so a USD invoice does not show an MXN symbol.
- Non-amount accordions record their first-seen count (including 0) so a type that gains rows in a later batch opens; an amount-changing type that shrinks lowers its mark so later growth counts as gained rows.

## Issues Encountered

- `pnpm lint` prints one warning in `src/lib/client/navigation.ts` (unused eslint-disable directive). It predates this plan and is out of scope; not fixed.
- Vitest's TAP output is rejected by the RED evidence classifier (see TDD Gate Compliance); JUnit used instead.

## Known Stubs

None. The RED-phase stubs were all replaced in the GREEN commits.

## Threat Flags

None. No new network endpoint, auth path or storage; the new surface is rendering of XML text as React text nodes (T-02-25, covered by the acceptance greps and the hostile-name test), the single derivation (T-02-26) and parse-guarded decimals (T-02-27, covered by tests).

## UI text for the user to confirm

Every visible string comes from the plan, UI-SPEC or CONTEXT; no text was invented. Items the plan already marks for UAT and that still stand:

- **A-3:** substitution row "La original se volvió a incluir." (UI-SPEC only has the excluded and not-loaded variants). With deviation 1, a manually excluded original reads "La original quedó excluida."
- **A-8:** the D-46 type sits right after "Notas de crédito sin factura relacionada" in cards and accordions and starts closed; changing it is a change of `INCIDENT_ORDER` only.
- **A-9:** in "Aplica a {mes}: la relacionada más antigua de {n}", {mes} is the short label ("may 2025") and {n} the number of loaded related invoices.
- The identity line shows the folio, or the first 8 UUID characters when there is none, and "—" when the entry has no amount in the active IVA mode.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-15: mount `QualityTab` in `AppShell` (`TABS` entry for `calidad`), read `qualitySummary(ledger).total` and `.amountChanging` for the tab counter and the Dashboard alert, and replace the inline ledger build with `useLedger` when it exists.
- `requestImportFocus` is set by "Ver en Importación" but the Importación tab does not consume `importFocus` yet (02-15 or later).

## Self-Check: PASSED

- Created files exist: quality.ts, quality.test.ts, QualityTab.tsx, QualityCards.tsx, QualityAccordions.tsx, QualityTab.test.tsx.
- Commits b727086, 2f191b2, cb24427, 172429f are on the branch.
- `pnpm verify` (eslint, next typegen + tsc, vitest 817 passed, next build) exits 0.

---
*Phase: 02-dashboard-de-gasto-confiable*
*Completed: 2026-10-15*
