---
phase: 02-dashboard-de-gasto-confiable
reviewed: 2026-10-16T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/domain/accounting/ledger.anon.test.ts
  - src/domain/accounting/ledger.realdata.test.ts
  - src/domain/accounting/ledger.test.ts
  - src/domain/accounting/ledger.ts
  - src/domain/accounting/months.test.ts
  - src/domain/accounting/months.ts
  - src/domain/accounting/quality.test.ts
  - src/features/dashboard/DashboardTab.test.tsx
  - src/features/dashboard/FilterBar.test.tsx
  - src/features/dashboard/useLedger.ts
  - src/features/invoices/InvoiceTable.test.tsx
  - src/features/invoices/InvoiceTable.tsx
  - src/features/invoices/columns.test.ts
  - src/features/quality/QualityAccordions.tsx
  - src/features/quality/QualityTab.test.tsx
  - src/stores/sessionStore.test.ts
  - src/stores/sessionStore.ts
  - tests/support/ledgerFactory.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This is an incremental review of two gap-closure plans, read against `git diff 0c1067cc HEAD`:

- **02-16 (prior WR-01, "restored pollution"): resolved.** `reincludeInvoice` now requires `{ overrideSubstitution }`, and the callers (`InvoiceTable.reinclude`, `QualityAccordions.IncidentRow`) derive it from the rendered `entry.substitutedBy`. `excludeInvoice` returns an `ExclusionUndo` token and `undoExclusion` touches only that uuid. I traced these combinations through the store and the ledger, and each ends in the right state:
  - plain exclude then undo
  - exclude of a restored substituted original then undo
  - plain re-include followed by a later substitute
  - manual-and-substituted re-include (user decision G-02-10)

  A plain re-include or undo can no longer put a uuid into `restored`. No path left in the code writes to `restored` without a loaded substitute at click time, except the stale-token case in WR-01 below.
- **02-17 (prior WR-03, Fecha years outside the window): resolved.** `monthOfFecha` rejects years outside `MIN_FECHA_YEAR..currentYear+1` (both ends inclusive) after the calendar-validity checks. `buildLedger` requires `FechaContext` and passes it to both the own-month and the credit-note imputation conversions. `loadedSpan` skips null months, so a damaged year no longer stretches the span. The sort-by-literal-Fecha in `imputationOf` is safe, because an out-of-window related invoice is skipped by the `candidateMonth !== null` loop. The only production caller of `monthOfFecha` and `buildLedger` is `useLedger`, and it supplies the context.

Verification run: `pnpm tsc --noEmit` is clean, `pnpm eslint src tests` has 0 errors, and `pnpm vitest run` passes 904/904. The only ESLint warning is an unused `eslint-disable` in `src/lib/client/navigation.ts`, which is outside this review's scope. No `any`, `!`, `@ts-ignore` or unchecked `as` appears in the diff. The new tests pin the fixed Fecha context rather than the real clock, and the component tests mock only `Date` through `vi.setSystemTime` and restore it in `afterEach`.

No blockers. One warning (a stale undo token is not tied to the session generation) and two info items.

## Warnings

### WR-01: A stale "Deshacer exclusión" token can write to `restored` after `clearAll`

**File:** `src/stores/sessionStore.ts:150-154` (token built at `:142-148`, consumed at `src/features/invoices/InvoiceTable.tsx:325-333`)
**Issue:** `ExclusionUndo` carries only `{ uuid, wasRestored }`. The toast stays alive for `TOAST_DURATION_MS` and nothing dismisses it on `clearAll` (the logout button, `ImportReport` reset, and any other caller that wipes the session). If the user clicks "Deshacer" after the session was cleared, `undoExclusion` runs against the fresh, empty state. When `wasRestored` is true, it adds the uuid to `restored` in a session that no longer has that invoice. If the same XML is imported again, the original is silently treated as an overridden substitution (counted even though a substitute lists it). That is the same class of pollution WR-01 was meant to close, now reachable only through the stale token. The store already guards the equivalent async hazard for `applyBatch` with `generation` (Pitfall 12), but the undo path does not use it. The same shape allows a second stale effect: a token from a double call of `excludeInvoice` on an already-excluded uuid would un-exclude it.
**Fix:** Put the generation in the token and ignore a token from an earlier session.
```ts
export interface ExclusionUndo {
  uuid: string;
  wasRestored: boolean;
  generation: number;
}

excludeInvoice: (uuid) => {
  const { restored, generation } = get();
  const wasRestored = restored.has(uuid);
  set((current) => ({
    excluded: withUuid(current.excluded, uuid),
    restored: withoutUuid(current.restored, uuid),
  }));
  return { uuid, wasRestored, generation };
},
undoExclusion: ({ uuid, wasRestored, generation }) =>
  set((current) => {
    if (generation !== current.generation) return current;
    return {
      excluded: withoutUuid(current.excluded, uuid),
      restored: wasRestored ? withUuid(current.restored, uuid) : current.restored,
    };
  }),
```
Add a store test: `excludeInvoice` on a restored uuid, then `clearAll()`, then `undoExclusion(token)`. Expect `restored` to stay empty.

## Info

### IN-01: The window year is snapshotted per hook instance, but the doc comment says the views "can never disagree"

**File:** `src/features/dashboard/useLedger.ts:23-30`
**Issue:** `useLedger` is called from the Dashboard, the Calidad de datos tab and the shell counter, and each call gets its own `useState(currentCalendarYear)`. If instances mount on opposite sides of New Year midnight, the window upper end differs between them. An invoice dated in the year after next could then count in one view and be an incident in another, which is the disagreement the REGLA-08 comment rules out. A tab left open across New Year also keeps the old year. Both cases are very narrow, so I rate this Info.
**Fix:** Read the year once for the whole app, for example a module-level lazy constant (`let cached: number | null`) or a field set in the session store at creation and reset by `clearAll`. Alternatively, soften the comment so it does not promise full agreement.

### IN-02: A wrong browser clock turns valid invoices into "Fecha inválida" with no hint of the cause

**File:** `src/domain/accounting/months.ts:58` (surfaced through `ledger.ts` `amountsOf`, copy at `src/lib/copy/es.ts:220`)
**Issue:** The upper bound depends on the user's clock by design (D-48). If a device has its date set wrong (a year or more behind), every legitimately dated invoice beyond `currentYear+1` is silently classified `invalido/Fecha`, does not sum, and appears in Datos inválidos as "Fecha inválida: no se suma". Nothing tells the user that the browser's year is the cause. `FechaContext.currentYear` is also an unvalidated `number`. This cannot happen with `Date.getFullYear()` today, but a NaN would silently open the upper end because `year > NaN + 1` is false.
**Fix:** Optional. Either word the incident for the out-of-window case so it mentions the plausible range (needs a user decision on the copy, per CLAUDE.md rule 1), or at minimum guard in `monthOfFecha` with `Number.isInteger(context.currentYear)` and reject when it is false.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
