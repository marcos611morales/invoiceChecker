# Phase 5: Comparación de precios entre tiendas - Pattern Map

**Mapped:** 2026-10-25
**Files analyzed:** 24 (new/modified)
**Analogs found:** 23 / 24 (all analog paths verified git-tracked via `git ls-files src`)

Paths are relative to `/Users/marcosmorales/Documents/Atzomx/InvoiceChecker`. Algorithm code (size reader, units, content, median) is already specified in 05-RESEARCH.md Patterns 2-4; this file only supplies the repo conventions to wrap it in.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/domain/prices/units.ts` | utility | transform | `src/domain/settings/normalize.ts` (+ Map-table style) | role-match |
| `src/domain/prices/sizeReader.ts` | utility | transform | RESEARCH Pattern 3 code; style `src/domain/settings/normalize.ts` | role-match |
| `src/domain/prices/content.ts` | service (pure) | transform | `src/domain/accounting/amounts.ts` | role-match |
| `src/domain/prices/comparable.ts` | utility | transform | `src/domain/settings/normalize.ts` | partial |
| `src/domain/prices/purchases.ts` | service (pure) | transform | `src/domain/accounting/categories.ts` (`splitEntry`/`scopeToCategories`) | exact |
| `src/domain/prices/compare.ts` | service (pure) | batch/transform | `src/domain/accounting/categories.ts` (Map grouping, Collator, Big) | role-match |
| `src/domain/prices/history.ts` | utility | transform | `src/features/dashboard/trendData.ts` | role-match |
| `src/domain/prices/*.test.ts`, `*.anon.test.ts`, `*.realdata.test.ts` | test | - | `src/domain/accounting/ledger.realdata.test.ts`, `src/domain/settings/products.test.ts` | exact |
| `src/domain/settings/types.ts` (modify) | model | - | itself (V2 frozen pattern) | exact |
| `src/domain/settings/schema.ts` (modify) | model | validation | itself (`settingsDataSchemaV2`, `productIntegrityIssues`) | exact |
| `src/domain/settings/migrate.ts` (modify) | utility | transform | itself (version 2 branch) | exact |
| `src/domain/settings/backup.ts` (modify) | model/contract | file-I/O | itself (`backupFile2Schema`, `fromBackupFile2`) | exact |
| `src/domain/settings/products.ts` (modify: delete/restore override) | service | CRUD | itself (`deleteProduct`/`restoreProduct`) | exact |
| `src/domain/settings/prices.ts` (new reducers: set/remove correction, set/clear override) | service | CRUD | `src/domain/settings/products.ts` (`markUngrouped`/`unmarkUngrouped`) | exact |
| `src/stores/settingsStore.ts` (modify) | store | CRUD | itself | exact |
| `src/stores/sessionStore.ts` (modify `AppTab`) | store | - | itself line 20 | exact |
| `src/features/shell/AppShell.tsx` (modify TABS) | component | - | itself | exact |
| `src/lib/copy/es.ts`, `messages.ts` (modify) | config | - | `es.tabs`, `es.products.list` | exact |
| `src/features/prices/usePricesView.ts` | hook | transform | `src/features/dashboard/useDashboardView.ts` | exact |
| `src/features/prices/PreciosTab.tsx` | component | request-response | `src/features/products/ProductsTab.tsx` | role-match |
| `src/features/prices/PricesTable.tsx` | component | CRUD (expandable table) | `src/features/products/ProductList.tsx` | exact |
| `src/features/prices/ProductDetail.tsx`, `StoreTable.tsx`, `PurchasesList.tsx` | component | transform | `ProductList.tsx` expanded panel (~line 567) + `ProductMembers.tsx` | role-match |
| `src/features/prices/HistoryChart.tsx` | component | transform | `src/features/dashboard/TrendChart.tsx` | role-match |
| `src/features/prices/ContentEditor.tsx` | component | CRUD | `RenameEditor` in `ProductList.tsx` | role-match |
| `tests/fixtures/settings/ajustes-archivo-3.json` | fixture | - | `ajustes-archivo-2.json` | exact |

## Pattern Assignments

### `src/domain/prices/purchases.ts` (pure service, transform)

**Analog:** `src/domain/accounting/categories.ts` and RESEARCH Pattern 1.

Domain imports use relative paths and `import type Big` (categories.ts 15-24):
```typescript
import type Big from "big.js";
import { normalizeDescription, ruleMapKey } from "../settings/normalize";
import type { Resolver } from "../settings/resolver";
import { ZERO, fromInteger, sum } from "./decimal";   // in prices/: "../accounting/decimal"
import type { LedgerEntry } from "./ledger";
```
Part iteration (categories.ts 47-63, 112-116): `ScopedEntry.parts` with `part.concept: number | null`; skip `null` (rounding difference); read `entry.invoice.conceptos[part.concept]` (index access may be `undefined` under `noUncheckedIndexedAccess`, check explicitly). Amount from `conceptAmounts(concepto, entry.invoice).conIva | .sinIva` (`src/domain/accounting/amounts.ts` 25-57), never `precioUnitario`. Keep only `entry.counted && entry.kind === "ingreso"` (counted is true for credit notes). Member key: `ruleMapKey(entry.supplierRfc, normalizeDescription(concepto.descripcion))`.
Grouping: `Map`, never objects keyed by RFC/description. Collator (categories.ts 27): `new Intl.Collator("es", { sensitivity: "base" })`.

### `src/domain/prices/content.ts`, `compare.ts`, `units.ts`, `sizeReader.ts`

**Analog:** `src/domain/accounting/decimal.ts` for Big rules. Do not set `Big.strict` again; import via `../accounting/decimal` so the config is loaded, then use `new Big("...")` from strings only:
```typescript
Big.strict = true; Big.DP = 20; Big.RM = Big.roundHalfUp; Big.PE = 1000; Big.NE = -1000;
const DECIMAL_RE = /^-?\d{1,18}(\.\d{1,12})?$/;
export function parseDecimal(raw: string | null): Big | null { ... }   // use for cantidad
export function toMoneyString(value: Big): string                      // rounding only at display
```
Unit table: `Map<string, UnitRule>` with decimal-string factors (RESEARCH Pattern 2). Plot numbers via `Number(toMoneyString(x))` precedent in TrendChart.tsx 46.

### `src/domain/prices/history.ts`

**Analog:** `src/features/dashboard/trendData.ts` (a `toTrendData` + type-guard `isTrendDatum` pair; datum carries a precomputed `amountText`). Copy: pure shaper plus a runtime type guard instead of casting Recharts `payload`.

### Tests (`src/domain/prices/*.test.ts`)

**Analog:** `src/domain/settings/products.test.ts` (plain vitest, `import { describe, expect, it } from "vitest"`, synthetic RFCs like `"AAA010101AAA"`), `src/domain/accounting/ledger.realdata.test.ts`:
```typescript
// @vitest-environment jsdom
const facturasRoot = process.env.FACTURAS_DIR ?? resolve(process.cwd(), "Facturas");
const sampleDir = join(facturasRoot, "2025");
const hasSample = existsSync(sampleDir);   // describe.skipIf(!hasSample)
```
Assert counts/identities only, never RFC/amount/folio literals. Builders: `tests/support/ledgerFactory` (`loaded`, `TEST_FECHA_CONTEXT`); `ledger.anon.test.ts` for anonymized fixtures. The size reader table in RESEARCH Pattern 3 is the unit-test table.

### Settings v3 to v4 (`types.ts`, `schema.ts`, `migrate.ts`)

**types.ts** (lines 77-95): frozen-shape pattern. Rename current `SettingsData` body into `SettingsDataV3` (comment "never add a field here"), then:
```typescript
export interface SettingsDataV2 { ivaMode; categories; supplierCategories; conceptRules }   // frozen
export interface SettingsData extends SettingsDataV2 { products; ungroupedConcepts }       // becomes V3 copy
export const SETTINGS_VERSION = 3;   // -> 4
export const LIMITS = { ..., products: 2000, productMembers: 5000, ungroupedConcepts: 5000, backupBytes: 4194304 } as const;
```
Add `contentCorrections`, `priceOverrides` caps to `LIMITS` and to `defaultSettings()` (returns new arrays each call, lines 133-141).

**schema.ts** (lines 163-199): copy `settingsDataSchema` to `settingsDataSchemaV3: z.ZodType<SettingsDataV3>` first (FROZEN doc comment like lines 163-167), then extend. Integrity via a new `priceIntegrityIssues(data)` exporting `IntegrityIssue[]` like `productIntegrityIssues` (114-161): composite key `` `${rfc}${KEY_SEPARATOR}${key}` `` in a `Set`, override unique by `productId`, no `__proto__` records:
```typescript
.superRefine((data, ctx) => {
  for (const issue of [...settingsIntegrityIssues(data), ...productIntegrityIssues(data)]) {
    ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
  }
});
```
Decimal strings in corrections: validate with a regex like `DECIMAL_RE` (decimal.ts 19), not `z.number()`.

**migrate.ts** (lines 17-38): add `if (version === 3)` branch with `settingsDataSchemaV3.safeParse(raw)`, returning `{ ...previous.data, contentCorrections: [], priceOverrides: [] }, status: "migrated"`; update the version 2 branch (line 33) to also append the two lists. Only `safeParse`, never throw.

### `src/domain/settings/backup.ts` (published contract v2 to v3)

Never edit `backupFile1Schema`, `backupFile2Schema`, `fromBackupFile1/2`. Add next to them (lines 27-124 pattern):
```typescript
export const BACKUP_FILE_VERSION = 2;   // -> 3
const backupFile3Schema = z.object({ settings: z.object({ ...same six fields, contentCorrections, priceOverrides }).superRefine(...) });
export type BackupFile3 = z.infer<typeof backupFile3Schema>;
export function fromBackupFile3(file: BackupFile3): SettingsData { /* field-by-field map */ }
```
`fromBackupFile2` return type becomes `SettingsDataV3` (or spread `contentCorrections: []`, `priceOverrides: []` in `parseBackupText`, lines 155-169). `parseBackupText` branch: version 1 (lines 155-165) and 2 add the empty lists; version 3 uses `backupFile3Schema`. `buildBackupText` (55-90) picks fields one by one; add the two new lists the same way. Extend `BackupSummary` and `summaryOf` (126-134). Update header doc comment. Golden file `tests/fixtures/settings/ajustes-archivo-3.json` next to `-1`/`-2` (tracked), loaded in `backup.test.ts` with `resolve(process.cwd(), "tests/fixtures/settings/ajustes-archivo-N.json")` (lines 451, 501). Extend the D-31 4 MB worst-case test to include corrections/overrides at caps.

### `src/domain/settings/prices.ts` (new reducers) and `products.ts` (modify)

**Analog:** `src/domain/settings/products.ts` reducers: pure functions `(settings: SettingsData, ...) => result`, return same object on no-op/refusal (store checks `next === current`), `ok/reason` unions, snapshot types for undo (lines 188-250):
```typescript
export interface ProductSnapshot { product: Product; index: number; }   // add: override: PriceOverride | null
export function deleteProduct(settings, id): { next: SettingsData; snapshot: ProductSnapshot } | null
export function restoreProduct(settings, snapshot): SettingsData   // returns `settings` itself when refused
```
Modify: `deleteProduct` also drops the product's override in the same `next`; `restoreProduct` puts it back (Pitfall 11). `withProducts(settings, ...)` helper uses spread, so new fields carry over. New reducers for corrections follow `markUngrouped`/`unmarkUngrouped` (limit refusal, remove returns the removed entry for Deshacer). Corrections are keyed by `ruleMapKey` composite and follow the member (not deleted with a product).

### `src/stores/settingsStore.ts`

Edits (lines 200-211, 372-381, 383-398): extend `dataOf`, `replaceAll`, `partialize`, the doc comment (`version: 4`), the `SettingsState` interface and new actions in the existing shape:
```typescript
unmarkUngrouped: (key) => {
  const result = unmarkUngrouped(dataOf(get()), key);
  if (result === null) return null;
  set({ ungroupedConcepts: result.next.ungroupedConcepts });
  return result.removed;
},
restoreProduct: (snapshot) => {
  const current = dataOf(get());
  const next = restoreProduct(current, snapshot);
  if (next === current) return;
  set({ products: next.products, priceOverrides: next.priceOverrides });   // now both
},
```
`deleteProduct` action must `set` both `products` and `priceOverrides`. Keep `persist` options (`skipHydration: true`, `storage: safeStorage`, `migrate`/`merge` via `resolveAndReport`). Update `src/stores/settingsStore.test.ts`.

### `src/stores/sessionStore.ts` and `src/features/shell/AppShell.tsx`

sessionStore line 20: `export type AppTab = "dashboard" | "categorias" | "productos" | "calidad" | "importacion";` add `"precios"`. AppShell: add `value === "precios"` to `isAppTab` (56-64), a `TABS` entry after productos (73-79): `{ value: "precios", label: es.tabs.prices, Panel: PreciosTab }`. The generic trigger branch (145-149) covers it. Add `prices: "Precios"` to `es.tabs` (es.ts 149-156). Check `AppShell.test.tsx` and `sessionStore.test.ts` tab lists.

### `src/features/prices/usePricesView.ts`

**Analog:** `src/features/dashboard/useDashboardView.ts` (fully quoted above). Copy shape: `"use client"`, `useLedger()`, `useSessionStore((s) => s.filters)`, `useCategorySettings()` for `resolver`, `useSettingsStore((s) => s.ivaMode)` for mode, plus selectors for `products`, `contentCorrections`, `priceOverrides`; one `useMemo` per stage, returning a typed state interface. Reuse `applyFilters` and `effectiveSelection` (`src/domain/accounting/filters.ts`, `view.ts`) then `scopeToCategories`; compute unfiltered purchases separately for D-31 default comparability and chart slots.

### `src/features/prices/PricesTable.tsx` (expandable TanStack v9 table)

**Analog:** `src/features/products/ProductList.tsx`. Copy exactly:
- Imports (lines 12-21, 25): `constructSortFn, createColumnHelper, createPaginatedRowModel, createSortedRowModel, rowPaginationFeature, rowSortingFeature, tableFeatures, useTable` and `SortHeaderButton, ariaSort` from `@/components/SortHeaderButton`.
- Module-scope features/sort fns (105-124): `const features = tableFeatures({ rowSortingFeature, rowPaginationFeature, sortedRowModel: createSortedRowModel(), paginatedRowModel: createPaginatedRowModel(), sortFns: { es: sortFn_es, count: sortFn_count } });` plus `createColumnHelper<typeof features, Row>()`, `helper.accessor(..., { id, header, sortFn, sortUndefined: "last" })`. Add a Big-aware numeric sort fn for savings (rows without savings last, via `sortUndefined: "last"`); default `SortingState` = `[{ id: "ahorro", desc: true }]` (cf. DEFAULT_SORTING line 41).
- Expansion (296, 448-460, 567): `useState<ReadonlySet<string>>`, `Fragment` per row, expander `Button` with `aria-expanded`/`aria-controls`, panel `TableCell colSpan={...} className="bg-secondary p-4 whitespace-normal"`.
- Header rendering (`renderHeader`, 380-415) with `ariaSort(header.column.getIsSorted())`.
- Undo toast (332-344):
```typescript
toast(productDeletedToast(row.name), {
  duration: TOAST_DURATION_MS,   // 6000
  action: { label: es.products.list.undo, onClick: () => { restoreProduct(snapshot); } },
});
```
Use for "Marcar como no comparable" / "Volver a comparar" (store action returns previous override; undo restores). Text via `es` and `messages.ts` helpers; money via `@/lib/format` `formatMoney`.
- Icon actions: `src/features/products/IconAction.tsx`. A "⋯" menu: check `src/components/ui` for an existing dropdown-menu before adding (no new packages).

### `src/features/prices/HistoryChart.tsx`

**Analog:** `src/features/dashboard/TrendChart.tsx`. Copy: static `ChartConfig` (lines 24-26, never from invoice data, T-02-19; keys `tienda1..tienda6`, `otras`), `ChartContainer config=... className="aspect-auto h-72 w-full"`, `CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5}`, `XAxis/YAxis axisLine={false} tickLine={false}`, `ChartTooltip content={<ChartTooltipContent labelFormatter formatter />}` with type-guarded `item.payload` (no casts), `isAnimationActive={false}`, wrapper `role="img" aria-label=...`, and the `sr-only` `<table>` fallback (130-145). Differences: `LineChart`/`Line` with per-series `data`, custom SVG `dot` component for 7 marker shapes (Recharts has no inverted triangle or pentagon), numeric X axis from `Date.UTC` day numbers (REGLA-05).

### `src/features/prices/ContentEditor.tsx`

**Analog:** `RenameEditor` in `ProductList.tsx` (lines 69-110): mounted only while editing, `useState` value, `useId` for error id, `useEffect` focus/select, Enter saves / Escape cancels, `onSave` returns an error reason or null, error text from `es`. Inputs from `@/components/ui/input`, unit via `@/components/ui/select`.

### `src/features/prices/PreciosTab.tsx`

**Analog:** `src/features/products/ProductsTab.tsx` (empty-state when no products at lines ~243, 285; reads `useSettingsStore` selectors at 62-65). Copy: section card classes `flex min-w-0 flex-col gap-4 rounded-lg border bg-background p-6`, heading with `aria-labelledby`. Savings card style: `src/features/dashboard/KpiRow.tsx`.

## Shared Patterns

### Strict TS and untrusted text
Source: `src/domain/settings/normalize.ts` (`ruleMapKey` joins with NUL), `schema.ts` (`KEY_SEPARATOR`). Apply to all prices code: `Map`/`Set` keyed by `ruleMapKey`, no records keyed by RFC/text, type guards instead of `as`, no `!`.

### Persisted contract change
Source: `migrate.ts`, `schema.ts` V2 frozen schema, `backup.ts` v2 branch. Copy-then-edit, `safeParse` only, golden files 1/2/3 keep loading.

### Undo
Source: `ProductList.tsx` 332-344 and `InvoiceTable.tsx` 399-406; domain returns a snapshot, store `restore*` writes only when `next !== current`.

### Copy
Source: `src/lib/copy/es.ts` (static strings, `es.tabs` at 149-156) and `messages.ts` (interpolated, aria labels, toasts). Money/dates only through `src/lib/format.ts`.

### Display rounding
Source: `decimal.ts` `toMoneyString`; round only at display; exact `Big` everywhere before.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Multi-series line chart with custom markers (`HistoryChart` series wiring) | component | transform | Only a single-series bar chart exists (TrendChart); use RESEARCH Pattern 7 |
| "⋯" row menu (if `dropdown-menu` not in `src/components/ui`) | component | - | Verify in `src/components/ui`; `IconAction.tsx` is the nearest |

## Metadata

**Analog search scope:** `src/domain/{accounting,settings}`, `src/stores`, `src/features/{products,dashboard,invoices,shell}`, `src/lib/copy`, `tests/fixtures/settings`
**Files scanned:** about 25 read (targeted ranges); `git ls-files src` used to confirm all analogs are tracked (no mirror paths)
**Pattern extraction date:** 2026-10-25
