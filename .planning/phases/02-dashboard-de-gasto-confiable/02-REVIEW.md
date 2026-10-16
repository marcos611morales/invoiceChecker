---
phase: 02-dashboard-de-gasto-confiable
reviewed: 2026-10-15T00:00:00Z
depth: standard
files_reviewed: 93
files_reviewed_list:
  - e2e/smoke.spec.ts
  - package.json
  - pnpm-lock.yaml
  - src/app/globals.css
  - src/components/SortHeaderButton.test.tsx
  - src/components/SortHeaderButton.tsx
  - src/components/TruncatedText.test.tsx
  - src/components/TruncatedText.tsx
  - src/components/ui/chart.tsx
  - src/components/ui/checkbox.tsx
  - src/components/ui/collapsible.tsx
  - src/components/ui/command.tsx
  - src/components/ui/dialog.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/components/ui/popover.tsx
  - src/components/ui/select.tsx
  - src/components/ui/tabs.tsx
  - src/components/ui/toggle-group.tsx
  - src/components/ui/toggle.tsx
  - src/domain/accounting/aggregate.test.ts
  - src/domain/accounting/aggregate.ts
  - src/domain/accounting/amounts.test.ts
  - src/domain/accounting/amounts.ts
  - src/domain/accounting/decimal.test.ts
  - src/domain/accounting/decimal.ts
  - src/domain/accounting/filters.test.ts
  - src/domain/accounting/filters.ts
  - src/domain/accounting/ledger.anon.test.ts
  - src/domain/accounting/ledger.realdata.test.ts
  - src/domain/accounting/ledger.test.ts
  - src/domain/accounting/ledger.ts
  - src/domain/accounting/months.test.ts
  - src/domain/accounting/months.ts
  - src/domain/accounting/quality.test.ts
  - src/domain/accounting/quality.ts
  - src/domain/cfdi/catalogs.test.ts
  - src/domain/cfdi/catalogs.ts
  - src/domain/cfdi/parseCfdi.anon.test.ts
  - src/domain/cfdi/parseCfdi.test.ts
  - src/domain/cfdi/parseCfdi.ts
  - src/domain/cfdi/types.ts
  - src/domain/import/import.test.ts
  - src/features/dashboard/DashboardTab.test.tsx
  - src/features/dashboard/DashboardTab.tsx
  - src/features/dashboard/DateRangeFilter.test.tsx
  - src/features/dashboard/DateRangeFilter.tsx
  - src/features/dashboard/FilterBar.test.tsx
  - src/features/dashboard/FilterBar.tsx
  - src/features/dashboard/KpiRow.test.tsx
  - src/features/dashboard/KpiRow.tsx
  - src/features/dashboard/MultiSelectFilter.test.tsx
  - src/features/dashboard/MultiSelectFilter.tsx
  - src/features/dashboard/SupplierDialog.tsx
  - src/features/dashboard/SupplierRanking.test.tsx
  - src/features/dashboard/SupplierRanking.tsx
  - src/features/dashboard/TrendChart.test.tsx
  - src/features/dashboard/TrendChart.tsx
  - src/features/dashboard/trendData.test.ts
  - src/features/dashboard/trendData.ts
  - src/features/dashboard/useLedger.ts
  - src/features/invoices/InvoiceTable.test.tsx
  - src/features/invoices/InvoiceTable.tsx
  - src/features/invoices/columns.test.ts
  - src/features/invoices/columns.ts
  - src/features/quality/QualityAccordions.tsx
  - src/features/quality/QualityCards.tsx
  - src/features/quality/QualityTab.test.tsx
  - src/features/quality/QualityTab.tsx
  - src/features/report/ImportReport.test.tsx
  - src/features/report/ReportAccordions.tsx
  - src/features/shell/AppShell.test.tsx
  - src/features/shell/AppShell.tsx
  - src/features/shell/IvaToggle.test.tsx
  - src/features/shell/IvaToggle.tsx
  - src/features/shell/LogoutButton.tsx
  - src/features/shell/TopBar.tsx
  - src/features/shell/guards.test.tsx
  - src/features/upload/useImport.test.tsx
  - src/features/upload/useImport.ts
  - src/lib/copy/es.ts
  - src/lib/copy/messages.test.ts
  - src/lib/copy/messages.ts
  - src/lib/format.test.ts
  - src/lib/format.ts
  - src/stores/sessionStore.test.ts
  - src/stores/sessionStore.ts
  - src/stores/settingsStore.test.ts
  - src/stores/settingsStore.ts
  - tests/fixtures/cfdi/anon/anon-ingreso-ieps.xml
  - tests/support/cfdiVariants.ts
  - tests/support/domPolyfills.ts
  - tests/support/ledgerFactory.ts
  - tests/support/settingsStorage.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-15
**Depth:** standard
**Files Reviewed:** 93
**Status:** issues_found

## Summary

I read every non-test source file in scope in full: the accounting domain (decimal, amounts, months, filters, aggregate, ledger, quality), the CFDI parser, the stores, the formatters and copy, the dashboard, invoice, quality, report and shell features, and the vendored UI components. I only skimmed and grepped the large test files (DashboardTab, InvoiceTable, quality, ledger), so test-reliability findings are not exhaustive.

The money path is sound. All sums go through big.js in strict mode, rounding happens only at display, and `Map`/`Set` are used for every XML-keyed grouping. The parser rejects DTDs and oversized input. Nothing writes invoice data to storage or the network, and the only persisted store holds `ivaMode`. The `dangerouslySetInnerHTML` in the vendored `chart.tsx` is fed only by the static `trendChartConfig`. The dependency pins (big.js 7.0.1, @types/big.js 7.0.0, cmdk 1.1.1, react-is 19.3.0, recharts 3.8.0) are exact in `package.json` and `pnpm-lock.yaml`. The e2e test checks that no XML leaves the browser. The `Facturas/` folder is gitignored and the committed fixture is anonymised.

No blocker was found. The four warnings are one money-adjacent state bug (the undo-exclude path can later double-count a substituted invoice), one project-rule violation in the money formatter, one unbounded-input robustness gap, and one duplicate React key.

## Warnings

### WR-01: Undo or re-include of a normal exclusion writes to `restored`, so a later substitute double-counts the original

**File:** `src/features/invoices/InvoiceTable.tsx:323-339` and `src/stores/sessionStore.ts:117-126`
**Issue:** `exclude()` shows an undo toast whose action calls `reincludeInvoice(uuid)`. That call removes the uuid from `excluded` and adds it to `restored`. `restored` is the D-28 override meaning "the user brought back an invoice the system substituted". It is intended only for entries with `substitutedBy !== null`.

Trace:
1. Invoice X is counted and not substituted.
2. The user excludes X, then clicks "Deshacer". X is now in `restored`, although the user never restored a substituted invoice.
3. A later batch loads invoice Y with a TipoRelacion 04 relation that names X.
4. `buildLedger` sets `substitutedBy` for X, but `overrides.restored.has(X)` is true (ledger.ts, the `else if (substitutedBy !== null && !overrides.restored.has(...))` branch).
5. Both X and its replacement Y are counted. Gasto, ticket and the previous-period deltas are overstated, and no quality incident flags it as amount-changing, because the substitution row reads "reincluida".

The same pollution happens with the row menu's "Volver a incluir" on a manually excluded invoice that was never substituted (`RowMenu`, `reinclude`).

**Fix:** Make re-include set `restored` only when the entry is currently auto-excluded by substitution. Undoing a manual exclusion should only remove the uuid from `excluded`.
```ts
// sessionStore.ts
reincludeInvoice: (uuid, opts: { overrideSubstitution: boolean }) =>
  set((c) => ({
    excluded: withoutUuid(c.excluded, uuid),
    restored: opts.overrideSubstitution ? withUuid(c.restored, uuid) : c.restored,
  })),
```
Callers pass `entry.substitutedBy !== null`. The undo action passes `false`. Alternatively, have the undo restore a snapshot of the previous `excluded` and `restored` sets.

### WR-02: `formatTotal` converts an XML amount with `Number()` (project rule: money via big.js only)

**File:** `src/lib/format.ts:48-63`
**Issue:** `formatTotal` runs `Number(total)` and passes the float to `Intl.NumberFormat`. CLAUDE.md and REGLA-04 forbid a float on any money path, and the file header states "Nothing here adds amounts together". Everything else in `format.ts` (`formatMoney`, `formatUnitPrice`, `formatPercent`) hands Intl a decimal string.

The float path can round differently from the exact path. For example `"0.145"` is stored as 0.14499999999999999, so Intl prints 0.14, while half-up on the exact decimal gives 0.15. It is called from `QualityAccordions.tsx:85,91` for rounding differences, and for the invoice Total of foreign-currency rows. The two formatters can therefore disagree on the same value.

**Fix:** Reuse the string-literal path that `formatMoney` already has.
```ts
export function formatTotal(total: string, moneda: string): string {
  const currency = moneda.trim().toUpperCase();
  if (currency === "XXX") return MISSING_VALUE;
  const decimal = parseDecimal(total)?.toFixed();
  if (decimal === undefined || !isNumericLiteral(decimal)) return `${total} ${moneda}`.trim();
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(decimal);
  } catch {
    return `${total} ${moneda}`.trim();
  }
}
```

### WR-03: One damaged or typo'd `Fecha` can blow up the month span (unbounded month list and chart)

**File:** `src/domain/accounting/months.ts:23-38,56-64`, `src/domain/accounting/filters.ts:47-58`, `src/features/dashboard/DateRangeFilter.tsx:97`, `src/domain/accounting/aggregate.ts:127-146`
**Issue:** `monthOfFecha` accepts any 4-digit year. `loadedSpan` takes the min and max month over all entries, including excluded and not-summing ones (D-12, D-41). A single XML with `Fecha="0001-03-01T..."` or `"2205-..."` makes the default range span thousands of months, or about 120,000 for the extreme years.

That range then feeds:
- `monthsInRange`, which loops over every month.
- `monthlySeries`, which builds a zero-filled point per month.
- The `TrendChart` bars and its `sr-only` table, one row per month.
- Two `MonthSelect` lists in `DateRangeFilter`, one `SelectItem` per month.
- The "Promedio mensual" divisor, which is silently diluted.

The tab would freeze, and the average would be wrong with no warning. Dates in years before 1 AD also make `monthFromIndex` emit keys like `-001-12` from `previousPeriod`.

**Fix:** Decide a plausible-year window, or compute the span from counted entries only. Because this is a business decision, ask the user before implementing. Options:
- Treat a Fecha outside a configured window as `datos-invalidos` (field "Fecha") so it is reported and does not widen the span.
- Cap `monthlySeries` and the selects, and show a notice.

### WR-04: Duplicate React keys in the payments list of the concepts panel

**File:** `src/features/invoices/InvoiceTable.tsx:176`
**Issue:** The key is `${payment.fechaPago}-${payment.formaDePagoP}`. `buildPaymentIndex` pushes one `PaymentInfo` per Pago docto. An invoice paid in two instalments on the same date with the same forma (two Pago complements, or two doctos) produces two identical keys. React then warns and can drop or duplicate rows when the list changes.

**Fix:** Include the index, for example `key={`${payment.fechaPago}-${payment.formaDePagoP}-${index}`}`, using `payments.map((payment, index) => ...)`. The same applies to the keys built in `ReportAccordions.tsx`, which already include the index.

## Info

### IN-01: Substitution cycles remove both invoices from the totals

**File:** `src/domain/accounting/ledger.ts:77-94,257-263`
**Issue:** If invoice A lists B in a TipoRelacion 04 group and B lists A, both get `substitutedBy` set and both become "sustituida", so neither counts. Replacing the original is intended (D-42), but a cycle is invalid data that silently zeroes two invoices. The user is alerted through the "sustituciones/excluida" incident, but the cause is not explained.
**Fix:** Detect mutual substitution in `indexSubstitutions` and leave the later-dated invoice counted, or report it as its own incident.

### IN-02: Vendored `chart.tsx` has unjustified `as` assertions (CLAUDE.md section 2)

**File:** `src/components/ui/chart.tsx:102,237,351,359`
**Issue:** The shadcn-generated file contains `theme as keyof ...`, `as React.CSSProperties` and `as string` casts with no justifying comment, unlike `toggle-group.tsx:43`, which has one. The project rule allows an exception only with a comment on the same or the previous line. `chart.tsx` also imports `cn` from the `cn` package while the rest of the app uses `@/lib/utils`, so there are two class-merging helpers.
**Fix:** Add one-line justification comments, or narrow the values with type guards. Pick one `cn` source.

### IN-03: `aria-controls` points at a panel that is not in the DOM when the row is collapsed

**File:** `src/features/invoices/InvoiceTable.tsx:465`
**Issue:** The expand button always sets `aria-controls={panelId}`, but the panel only renders when `isOpen`. The reference is dangling while collapsed, which some validators and assistive technologies flag.
**Fix:** Set `aria-controls` only when `isOpen`.

### IN-04: `settingsStore.merge` overwrites the current `ivaMode` when nothing is stored

**File:** `src/stores/settingsStore.ts:74-81`
**Issue:** On `rehydrate()` with an empty store, zustand calls `merge(undefined, current)`. The code then forces `ivaMode: "con"`, discarding whatever the user had selected. This is harmless today because the shell rehydrates once on mount, before the toggle is visible. It would become a bug if `rehydrate()` were called again.
**Fix:** `ivaMode: parsed.success ? parsed.data.ivaMode : current.ivaMode`.

### IN-05: Ranking bar scale includes negative suppliers

**File:** `src/features/dashboard/SupplierRanking.tsx:78-81`
**Issue:** `maxAbs` is the largest absolute net among the top rows, including negative ones. A large credit-note-dominated supplier shrinks every positive bar, even though that supplier only gets a 2 px tick. The doc comment says this is "abs(net) over the largest abs(net)", so it may be intended. Scaling positives by the largest positive net is the more usual reading of a spend ranking.
**Fix:** Confirm the intent. If unintended, compute the scale from positive nets only.

### IN-06: Negative Total, SubTotal or Importe are accepted without any incident

**File:** `src/domain/accounting/decimal.ts:19`, `src/domain/accounting/amounts.ts:83-114`
**Issue:** `DECIMAL_RE` allows a leading minus. An Ingreso with `Total="-100.00"` is counted as negative spend, and an Egreso with a negative Total would flip to positive. SAT does not allow negative totals, so this is rare damaged data. Today it is neither flagged as "datos-invalidos" nor excluded.
**Fix:** For Total, SubTotal and Descuento, reject negatives in `invoiceAmounts` (return `invalido` with the field), or add a quality incident.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
