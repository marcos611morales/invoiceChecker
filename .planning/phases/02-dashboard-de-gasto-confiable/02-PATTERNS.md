# Phase 2: Dashboard de gasto confiable - Pattern Map

**Mapped:** 2026-10-14
**Files analyzed:** 36 (new/modified/deleted)
**Analogs found:** 31 / 36 (all analog paths verified git-tracked via `git ls-files`)

Strict TS rules (CLAUDE.md): no `any`, no `!`, no unverified `as`, no `@ts-ignore`. ESLint boundary (eslint.config.mjs:8-30): `src/domain/**` cannot import react, next, zustand, `@/components/*`, `@/stores/*`, `@/features/*`, `@/lib/*`. `big.js` is allowed in domain.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/domain/cfdi/types.ts` (modify: add invoice-level Traslados/Retenciones, D-36) | model | transform | itself (`Impuesto`, `Concepto`) | exact |
| `src/domain/cfdi/parseCfdi.ts` (modify: fill new field) | utility | transform | itself (`impuestosOf`, lines 43-51, 152) | exact |
| `src/domain/cfdi/catalogs.ts` (new: c_FormaPago, TipoRelacion) | config | static | `src/lib/copy/es.ts` (static data) + RESEARCH L638 | role-match |
| `src/domain/accounting/decimal.ts` | utility | transform | RESEARCH L497 snippet (no code analog) | no analog |
| `src/domain/accounting/months.ts` | utility | transform | `formatFechaIso` in `src/lib/format.ts:11-23` (literal date slicing) | partial |
| `src/domain/accounting/amounts.ts` | utility | transform | `src/domain/import/report.ts` (pure fn over ImportState) | role-match |
| `src/domain/accounting/ledger.ts` | service | transform/batch | `src/domain/import/applyBatch.ts` | role-match |
| `src/domain/accounting/filters.ts` | utility | transform | `src/domain/import/report.ts` | role-match |
| `src/domain/accounting/aggregate.ts` | utility | transform | `src/domain/import/report.ts` `reportCounts` | role-match |
| `src/domain/accounting/quality.ts` | utility | transform | `receptorDistinto` in `report.ts` | role-match |
| `src/domain/accounting/*.test.ts` | test | transform | `src/domain/import/import.test.ts`, `parseCfdi.anon.test.ts` | exact |
| `src/domain/accounting/ledger.realdata.test.ts` (optional) | test | file-I/O | `src/domain/cfdi/parseCfdi.realdata.test.ts` | exact |
| `tests/support/cfdiVariants.ts` (modify: withFecha/withMoneda/withTipoCambio) | test util | transform | itself (`replaceAttr`, `withTipo`) | exact |
| `tests/fixtures/cfdi/anon/*.xml` (new) | fixture | - | `tests/fixtures/cfdi/anon/anon-egreso.xml` | exact |
| `src/stores/sessionStore.ts` (modify: filters, excluded, tab, focus) | store | event-driven | itself | exact |
| `src/stores/settingsStore.ts` (new, persist) | store | CRUD (localStorage) | `sessionStore.ts` for shape; persist per RESEARCH Pattern 7 | partial |
| `src/stores/settingsStore.test.ts` | test | - | `src/stores/sessionStore.test.ts` | exact |
| `src/features/shell/AppShell.tsx` (modify: tabs) | component | request-response | itself | exact |
| `src/features/shell/TopBar.tsx` (modify: IVA slot) | component | - | itself | exact |
| `src/features/shell/IvaToggle.tsx` (new) | component | event-driven | `ThemeToggle.tsx` / `AddInvoicesButton` | partial |
| `src/features/dashboard/FilterBar.tsx` (+ popovers) | component | event-driven | `ReportAccordions.tsx` (controlled multi-select state) | partial |
| `src/features/dashboard/KpiRow.tsx` | component | transform | `src/features/report/SummaryCards.tsx` | exact |
| `src/features/dashboard/TrendChart.tsx` | component | transform | none in repo (RESEARCH recharts notes L465) | no analog |
| `src/features/dashboard/SupplierRanking.tsx` / `SupplierDialog.tsx` | component | transform | `InvoiceTable.tsx` (sortable Table) + `SummaryCards` | partial |
| `src/features/dashboard/DashboardTab.tsx` | component | composition | `ImportReport.tsx` | role-match |
| `src/features/invoices/InvoiceTable.tsx` (replace) | component | transform | itself (lines 112-269) | exact |
| `src/features/invoices/columns.ts` (replace) | config | transform | itself | exact |
| `src/features/quality/QualityTab.tsx` (+ cards/accordions) | component | transform | `SummaryCards.tsx` + `ReportAccordions.tsx` | exact |
| `src/features/report/ImportReport.tsx` (modify: drop table) | component | - | itself | exact |
| `src/features/upload/useImport.ts` (modify: open Dashboard after batch, D-44) | hook | event-driven | itself | exact |
| `src/lib/format.ts` (modify: formatMoney(Big), percent D-40, month label) | utility | transform | itself | exact |
| `src/lib/copy/es.ts`, `messages.ts` (modify) | config | static | themselves | exact |
| `src/app/globals.css` (add `--chart-1`, `--positive`) | config | - | itself | exact |
| `*.test.tsx` for features | test | - | `InvoiceTable.test.tsx`, `ImportReport.test.tsx` | exact |

## Pattern Assignments

### `src/domain/accounting/*` (pure rules engine; utility/service, transform)

**Analog:** `src/domain/import/report.ts` (pure functions over `ImportState`, no React) and `src/domain/import/applyBatch.ts`.

**Pure-function style** (`report.ts:1-45`): typed interface of counts, loop over `state.invoices`, `switch (invoice.tipo)` with exhaustive cases, no throw:
```typescript
import type { FileRef, ImportState, LoadedInvoice } from "./types";
export function reportCounts(state: ImportState): ReportCounts {
  const counts: ReportCounts = { ingreso: 0, /* ... */ };
  for (const { invoice } of state.invoices) {
    switch (invoice.tipo) {
      case "I": counts.ingreso += 1; break;
      case "E": counts.egreso += 1; break;
```
Domain input type is `LoadedInvoice` (`{ file, invoice: ParsedInvoice }`, `import/types.ts`). Imports inside domain are relative (`./types`) or `@/domain/...`; never `@/lib`.

**decimal.ts:** no code analog; copy RESEARCH.md L497-525 verbatim (`Big.strict = true`, `DECIMAL_RE`, `parseDecimal` returning `null` never throwing, `toMoneyString`). Keep `Big.strict` side effect only here. Build `Big` only from strings; compare with `.cmp/.eq/.gt/.lt`. This enforces D-35 (invalid amounts: entry loads but does not sum, never throw in render).

**months.ts:** same literal-slice idea as `format.ts:11-23`; never `new Date(fecha)`:
```typescript
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const match = ISO_DATE_PREFIX.exec(iso);
if (match === null) return iso;   // malformed -> handled, not thrown
```
Copy the RESEARCH L529 `months.ts` snippet for MonthKey helpers; malformed Fecha yields an "invalid" result feeding the D-35 "Datos inválidos" incident.

**Immutable state function** (`applyBatch.ts`/`sessionStore.ts:34-40`): domain returns new data, store only `set`s it. `buildLedger(invoices, overrides) -> LedgerEntry[]` should follow that: no store access in domain; overrides (excluded Set) are passed as arguments.

**Dedup/maps of payment forms:** RESEARCH L341 (`Map<uuid, Set<formaDePagoP>>` from `tipo === "P"` pagos/doctos).

**Tests (DEV-03):** co-located `*.test.ts`; model on `src/domain/import/import.test.ts`. Test factory pattern from `sessionStore.test.ts:5-30` (`makeInvoice(uuid)` returning a complete `ParsedInvoice` literal; adding the D-36 field requires updating every such factory: `sessionStore.test.ts`, `InvoiceTable.test.tsx`, others — grep `relacionados: []`).

**Real-data test** (`parseCfdi.realdata.test.ts:1-20`): copy gating and counts-only assertions:
```typescript
// @vitest-environment jsdom
const facturasRoot = process.env.FACTURAS_DIR ?? resolve(process.cwd(), "Facturas");
const hasSample = existsSync(sampleDir);
describe.skipIf(!hasSample)("...", () => { /* identities and counts, never amounts */ });
```
Parse real files with `parseCfdi(readFileSync(...))` then run `buildLedger`; assert `Σ counted == Σ I.Total − Σ E.Total` computed by a naive loop.

### `src/domain/cfdi/types.ts` + `parseCfdi.ts` (modify, D-36)

**Analog:** same files. Add an additive field to `ParsedInvoice` (after `totalImpuestosRetenidos`, types.ts ~L80), e.g. `impuestos: { traslados: Impuesto[]; retenciones: Impuesto[] }`. Fill in `parseCfdi.ts` next to existing code (lines 152, 178-179) reusing `impuestosOf`:
```typescript
function impuestosOf(container: Element | undefined, local: string): Impuesto[] {
  return kids(container, NS_CFDI4, local).map((el) => ({
    base: attr(el, "Base"), impuesto: req(el, "Impuesto"),
    tipoFactor: attr(el, "TipoFactor"), tasaOCuota: attr(el, "TasaOCuota"),
    importe: attr(el, "Importe"),
  }));
}
const impuestos = kids(root, NS_CFDI4, "Impuestos")[0];   // L152 (root-level Impuestos)
```
Invoice-level `Traslados` is a child of that `impuestos` element: `impuestosOf(kids(impuestos, NS_CFDI4, "Traslados")[0], "Traslado")`. Update all test factories and add a parser test in `parseCfdi.test.ts`.

### `src/domain/cfdi/catalogs.ts` (config, static)
**Analog:** `src/lib/copy/es.ts` style of static `as const` data, but placed in domain (domain cannot import `@/lib`). Use RESEARCH L638 (22 formas de pago, TipoRelacion labels). Unknown code renders `Forma de pago {código}` in UI layer.

### `src/stores/sessionStore.ts` (modify)

**Analog:** itself. Extend `SessionState` (L14-26) and reuse the no-middleware `create<SessionState>()((set, get) => ...)` shape (L29). `clearAll` (L42-48) must also reset filters, excluded set, active tab and focus request (and bump `generation`):
```typescript
clearAll: () =>
  set((current) => ({
    ...emptyImportState(),
    progress: { phase: "idle" },
    lastSummary: null,
    generation: current.generation + 1,
  })),
```
Keep the "In-memory only: no middleware" comment true (exclusions never persisted, D-30). Selectors: select primitives or stable references; avoid returning fresh objects/arrays from a zustand v5 selector (infinite-loop pitfall, RESEARCH); compute derived data with `useMemo` in components, as `InvoiceTable.tsx:115` does (`useMemo(() => toInvoiceRows(invoices), [invoices])`).

### `src/stores/settingsStore.ts` (new; first persisted store)

**Analog:** `sessionStore.ts` shape; the persist config follows RESEARCH Pattern 7 (name `invoicechecker:settings`, `version: 1`, `partialize` to `{ ivaMode }`, `skipHydration: true`, try/catch `PersistStorage`, `merge` that zod-`safeParse`s with fallback `"con"`). zod is allowed outside domain; `parseIvaMode(persisted: unknown)` avoids `as`. Call `useSettingsStore.persist.rehydrate()` once from `AppShell` effect. Test (modeled on `sessionStore.test.ts` `afterEach` reset pattern) asserts only key `invoicechecker:settings` with only `ivaMode` is written after exclusions/filter changes.

### `src/features/shell/AppShell.tsx` (modify to tabs) and `TopBar.tsx`

**Analog:** itself. Keep `UploadRoot`/`TopBar`/`ProcessingIndicator`/footer structure (AppShell L39-53); replace L44-45 (`reportVisible ? <ImportReport/> : <EmptyDropzone/>` + `<InvoiceTable/>`) with `Tabs` (Dashboard / Calidad de datos · N / Importación) when `reportVisible`; empty screen unchanged (D-02). Keep `useBeforeUnload(hasInvoices)`. TopBar: render IVA control inside the existing slot (TopBar L12-13):
```tsx
<div data-slot="topbar-center" className="flex-1" />
```
Put `<IvaToggle />` inside that div (centered). `TopBar` already takes `actions` prop; follow `AddInvoicesButton` (AppShell L17-31) for mobile sizing classes (`max-sm:size-11`, 44px touch targets).

IVA ToggleGroup: base-ui `ToggleGroup` is array-valued; ignore empty arrays and map `["con"]`/`["sin"]` (RESEARCH L453).

### `src/features/dashboard/KpiRow.tsx` (component, transform)

**Analog:** `src/features/report/SummaryCards.tsx:67-102`. Same spec-array to cards approach (`CardSpec`, `buildCards`), `tabular-nums`, muted when zero, `data-testid` per card:
```tsx
<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
  {buildCards(counts).map((card) => (
    <div key={card.testId} className="flex flex-col gap-1 rounded-lg border bg-secondary p-4">
      <div className="text-sm font-semibold">{card.label}</div>
      <div data-testid={card.testId} className={cn("text-[28px] leading-[1.2] font-semibold tabular-nums", ...)}>
```
Money via `formatMoney(Big)`; D-39 "—" for ticket without invoices; D-20 "Sin datos del periodo anterior".

### `src/features/quality/QualityTab.tsx` (+ QualityCards / QualityAccordions)

**Analog:** `SummaryCards.tsx` (cards) and `ReportAccordions.tsx` (accordions). Copy from ReportAccordions:
- Section model `{ id, label, rows, rejected? }`, filter `sections.filter((s) => s.rows.length > 0)` (L131-132).
- Controlled `Accordion multiple value onValueChange` with ids narrowed without `as` (L142-147):
```tsx
function onValueChange(next: readonly unknown[]) {
  const ids = next.filter((item): item is string => typeof item === "string");
```
- Auto-open sections that change amounts (like `rejectedOpen` derived during render, L117-123: derived state, no effect).
- Trigger/content classes (L158-180): `AccordionTrigger className="h-10 items-center rounded-none px-4 py-0 font-semibold hover:bg-secondary hover:no-underline"`, `ScrollArea` with `[&_[data-slot=scroll-area-viewport]]:max-h-80`, `<ul>`/`<li>` rows like `FileRow` (L55-79, Tooltip truncation).
Add per-row actions ("Ver factura", "Volver a incluir") as `Button`s; destructive icon `CircleAlert` as in FileRow.

### `src/features/invoices/InvoiceTable.tsx` + `columns.ts` (replace with invoice table + expandable concepts)

**Analog:** the existing files. Keep these (do not re-derive):
- Module-scope stable features/collator (`columns.ts:50-66`): `tableFeatures({ rowSortingFeature, rowPaginationFeature, sortedRowModel: createSortedRowModel(), paginatedRowModel: createPaginatedRowModel(), sortFns: { basic: sortFn_basic, text: sortFn_text, es: sortFn_es } })` and `constructSortFn` for text.
- `createColumnHelper<typeof features, Row>()` + `helper.accessor(..., { id, header, sortFn })`.
- Table options (InvoiceTable L131-144): `getRowId: (row) => row.id`, `autoResetPageIndex: false`, `sortDescFirst: false`, `enableMultiSort: false`, controlled `sorting`/`pagination` state, default `[{ id: "fecha", desc: true }]`, page size 50.
- Derived page clamp during render (L125-129), not an effect.
- Sortable header button + `aria-sort` (L70-76, 162-184), `SortIcon`, right-aligned numeric columns with `tabular-nums`.
- Pagination footer (L235-266) with `paginationRangeText`/`paginationPageText`.
- Tooltip-truncated supplier cell (L84-93).
Changes: rows come from the filtered ledger (not raw `session.invoices`); money column sorts on a pre-extracted number/`Big.cmp`, never `Number(string)` of unvalidated data and never `Big` in `basic` sort (Big.strict throws on `valueOf`; use custom `constructSortFn` with `.cmp` or a precomputed sort key); expansion is an app-owned `Set<string>` of UUIDs (RESEARCH L168) rendering an extra `TableRow` below the row; dimmed rows ("No suma", "Excluida") via `cn(...)`; row "⋯" `DropdownMenu` calls `exclude/reinclude` and `toast` (Sonner, see `useImport.ts` for `toast` usage) with Deshacer action. "Ver factura" consumes the focus request in an effect only for DOM work (scroll/focus); page jump uses the derived-state-during-render pattern.
Delete the old Phase 1 "montos tal cual" alert note (L195-200) and update `InvoiceTable.test.tsx` accordingly (its factory `makeInvoice` L22+ and `afterEach` store reset are the template).

### `src/features/dashboard/TrendChart.tsx`, `SupplierRanking.tsx`, `FilterBar.tsx`

**No code analog for chart/popover/command.** Use RESEARCH notes: Recharts via shadcn `chart` (`ChartContainer`, `Bar activeBar`, `isAnimationActive={false}`, no `Cell`), `Select items` for Desde/Hasta (L459), Popover+Command+Checkbox for multi-select with counts (D-14). Supplier "Ver todos" list: reuse the table header/sort pattern from InvoiceTable. Active-filter chips and "Quitar filtros" use `Button`/`Badge` (`@/components/ui`). Empty state D-07 uses `Empty` exactly as `InvoiceTable.tsx:151-158`:
```tsx
<Empty className="border"><EmptyHeader>
  <EmptyTitle className="text-base">{...}</EmptyTitle>
  <EmptyDescription>{...}</EmptyDescription></EmptyHeader></Empty>
```

### `src/features/upload/useImport.ts` (modify, D-44)
**Analog:** itself (L14-40): after `applyBatch` returns a non-null summary (`useSessionStore.getState().applyBatch(batch, generation)`), set active tab to Dashboard if session has invoices, else Importación; if `added > 0` reset the untouched date range to default (D-12 recalculation). Use `useSessionStore.getState()` (not hooks) inside the callback, guarded by `isCurrent()`.

### `src/lib/format.ts` and copy (modify)
**Analog:** itself. Add `formatMoney(value: Big)`: feed `toMoneyString()` output (decimal string) to `Intl.NumberFormat("es-MX", { style: "currency", currency })` inside the same `try/catch` fallback shape as `formatTotal` (L30-45). Percent with space "12.4 %" (D-40) via custom formatting, not Intl percent. The file header says "nothing here adds amounts"; update that comment. `format.ts` lives in `@/lib`, so it may import `Big` types but domain must never import it. Spanish strings go to `es.ts` (static) and `messages.ts` (interpolated functions such as `facturasCargadasHeading`, `paginationRangeText`); header says "Later plans read this module and do not edit it": Phase 2 extends it, add new keys (`es.dashboard`, `es.quality`, `es.filters`) rather than renaming existing ones. Existing `messages.test.ts` is the test model.

## Shared Patterns

### Domain purity
**Source:** `eslint.config.mjs:8-30`. Apply to everything in `src/domain/accounting` and `catalogs.ts`: no react/zustand/`@/lib`; return `Big`/strings, format in `@/lib/format.ts`.

### Never throw on hostile data
**Source:** `format.ts:30-45` (`Number.isFinite` check plus try/catch returning raw text) and `ImportReport`/`parseCfdi` malformed handling. Apply: `parseDecimal` returns `null`; ledger marks entry `invalid` (D-35) instead of throwing; render code must not call `new Big(...)` on raw strings.

### Selectors and memoization
**Source:** `InvoiceTable.tsx:113-115`. Subscribe to primitive/stable slices (`useSessionStore((s) => s.invoices)`), derive with `useMemo`. Module-scope constants for tables, collators and empty arrays (Pitfall 9).

### Derived state during render, effects only for DOM
**Source:** `InvoiceTable.tsx:121-129` and `ReportAccordions.tsx:117-123`. react-hooks 7 flags synchronous setState in effects.

### Spanish copy and a11y
**Source:** `src/lib/copy/es.ts`, `messages.ts`; touch targets `max-sm:h-11 max-sm:min-w-11` (InvoiceTable L249); `aria-sort`, `role="note"` for static Alerts (InvoiceTable L195-197); cells render React text only.

### Tests
**Source:** `InvoiceTable.test.tsx` (`// @vitest-environment jsdom`, `@testing-library/react`, `afterEach` store reset via `clearAll()`), `tests/support/cfdiVariants.ts` helpers (`readFixture`, `withTipo` via `replaceAttr` that throws if attribute missing; add `withFecha`, `withMoneda`, `withTipoCambio` in the same style). Fixtures must pass `tests/fixtures.guard.test.ts` (no real Rfc/Nombre/UUID); copy from `tests/fixtures/cfdi/anon/*`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/domain/accounting/decimal.ts` | utility | transform | No big.js usage yet; use RESEARCH L497 snippet |
| `src/features/dashboard/TrendChart.tsx` | component | transform | No Recharts/chart yet; use RESEARCH L465 notes and shadcn `chart` |
| Filter popovers (Popover+Command+Checkbox) | component | event-driven | None installed; shadcn add, then RESEARCH/UI-SPEC |
| `settingsStore.ts` persist config | store | localStorage | First persisted store; RESEARCH Pattern 7 |
| Tabs / ToggleGroup / DropdownMenu / Dialog / Collapsible usage | component | - | To be installed (UI-SPEC Component Inventory); `git diff --stat src/components/ui` after `shadcn add` and decline overwrites |

## Metadata

**Analog search scope:** `src/domain`, `src/stores`, `src/features`, `src/lib`, `tests`, `eslint.config.mjs`
**Files scanned:** ~75 tracked files under src/tests; read in full or by range: sessionStore, AppShell, TopBar, format, columns, InvoiceTable, SummaryCards, ReportAccordions, report.ts, types.ts, parseCfdi.ts (excerpts), cfdiVariants, realdata test header, useImport
**Pattern extraction date:** 2026-10-14
