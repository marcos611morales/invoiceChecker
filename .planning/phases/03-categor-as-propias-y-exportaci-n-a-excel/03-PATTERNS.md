# Phase 3: Categorías propias y exportación a Excel - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 38 (new/modified)
**Analogs found:** 33 / 38 (all analog paths verified git-tracked under `src/`, `next.config.ts`, `eslint.config.mjs`)

Hard rule for every file: `src/domain/**` must not import `react`, `next`, `zustand`, `@/components/*`, `@/stores/*`, `@/features/*`, `@/lib/*` (`eslint.config.mjs` lines 9-27). Strict TS: no `any`, no `!`, no unverified `as`. Money is big.js (`@/domain/accounting/decimal`), never numbers.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/domain/settings/types.ts` | model | transform | `src/domain/accounting/filters.ts` (types block) | role-match |
| `src/domain/settings/schema.ts` | model (zod) | transform | `src/stores/settingsStore.ts` (zod schemas) | role-match |
| `src/domain/settings/migrate.ts` | utility | transform | `src/stores/settingsStore.ts` `merge` | role-match |
| `src/domain/settings/normalize.ts` | utility | transform | `src/lib/format.ts` `normalizeSearch` (lines 226-233) | exact (re-implement, cannot import) |
| `src/domain/settings/categories.ts` (reducers) | service (pure) | CRUD | `src/stores/sessionStore.ts` `withUuid/withoutUuid` + undo token | role-match |
| `src/domain/settings/resolver.ts` | utility | transform | `src/domain/accounting/filters.ts` Map-based grouping | role-match |
| `src/domain/settings/backup.ts` | utility | file-I/O (parse) | `src/domain/cfdi/parseCfdi.ts` (Result-style validation) | partial |
| `src/domain/accounting/categories.ts` | service (pure) | transform | `src/domain/accounting/aggregate.ts` | exact |
| `src/domain/accounting/status.ts` | utility | transform | `src/features/invoices/columns.ts` `stateOf` (62-67) | exact (extract) |
| `src/domain/accounting/filters.ts` (mod) | utility | transform | itself | exact |
| `src/stores/settingsStore.ts` (mod, v2) | store | CRUD + persistence | itself | exact |
| `src/stores/storageStatusStore.ts` | store | event-driven | `src/stores/sessionStore.ts` | role-match |
| `src/stores/sessionStore.ts` (mod) | store | CRUD | itself (`setSuppliers`, `AppTab`) | exact |
| `src/features/dashboard/useDashboardView.ts` | hook | transform | `src/features/dashboard/useLedger.ts` | exact |
| `src/features/dashboard/DashboardTab.tsx` (mod) | component | request-response | itself | exact |
| `src/features/dashboard/CategorySpend.tsx` | component | transform | `src/features/dashboard/SupplierRanking.tsx` | exact |
| `src/features/dashboard/FilterBar.tsx` (mod) + category trigger | component | event-driven | `MultiSelectFilter.tsx` | exact |
| `src/features/dashboard/SupplierRanking.tsx` (mod: click adds filter) | component | event-driven | itself | exact |
| `src/features/invoices/ConceptCategorySelect.tsx` | component | CRUD | `ConceptsPanel` in `InvoiceTable.tsx` + `select.tsx` | role-match |
| `src/features/invoices/InvoiceTable.tsx` / `columns.ts` (mod) | component | CRUD | itself | exact |
| `src/features/categories/CategoriesTab.tsx` | component | CRUD | `src/features/quality/QualityTab.tsx` | role-match |
| `src/features/categories/CategoryList.tsx` | component | CRUD | `InvoiceTable.tsx` (inline actions, toast+undo) | role-match |
| `src/features/categories/SupplierCategoryTable.tsx` | component | CRUD | `InvoiceTable.tsx` (TanStack v9 sort+page) | exact |
| `src/features/categories/DeleteCategoryDialog.tsx` | component | request-response | `src/features/shell/LogoutButton.tsx` | exact |
| `src/features/categories/BackupControls.tsx` | component | file-I/O | `src/features/upload/UploadRoot.tsx` / `lib/client/ingest.ts` (file input) | role-match |
| `src/features/export/sheets/*.ts` (6 builders) | utility (pure) | transform | `src/features/invoices/columns.ts` (`toInvoiceRows`, `conceptRows`) | role-match |
| `src/features/export/cellModel.ts`, `toLibrarySheet.ts` | utility | transform | none | no analog |
| `src/features/export/exportWorkbook.ts`, `downloadBlob.ts` | service | file-I/O | none | no analog |
| `src/features/export/ExportButton.tsx` | component | event-driven | `AddInvoicesButton` in `AppShell.tsx` (24-38) | exact |
| `src/features/shell/AppShell.tsx` (mod) | component | request-response | itself | exact |
| `src/lib/copy/es.ts`, `messages.ts` (mod) | config | transform | themselves | exact |
| `next.config.ts` (mod CSP) | config | request-response | itself (lines 7-21) | exact |
| `*.test.ts(x)` for each | test | - | `src/stores/settingsStore.test.ts`, `src/domain/accounting/filters.test.ts` | exact |

## Pattern Assignments

### `src/stores/settingsStore.ts` (store, persistence, v1 -> v2)

**Analog:** itself (`src/stores/settingsStore.ts`, 83 lines).

Keep: `STORAGE_KEY = "invoicechecker:settings"` (line 12), `skipHydration: true` (71), `partialize` (73), merge returning `{ ...current, ... }` (74-80), try/catch around every storage call (34-59), rehydrate from an effect in `AppShell` (121-123).

Change (RESEARCH Pattern 2): `safeStorage.getItem` currently validates the envelope against the CURRENT state schema (lines 19-22, 39), which would discard v1 `{ ivaMode }` data. Replace with:
```typescript
const envelopeSchema = z.object({ state: z.unknown(), version: z.number().optional() });
// PersistStorage<unknown>; version: 2; migrate -> resolvePersisted(raw, version) never throws;
// merge validates again (covers "no stored value" and same-version paths) and returns { ...current, ...data }
```
Zustand swallows exceptions from `migrate`/`merge`, so both must be total functions. Never call `set` from inside `storage.setItem` (loop). Failure signalling goes to `storageStatusStore` (readFailed toast, writeFailed Alert), set from the catch blocks that already exist at lines 41-43 and 48-50.

Core pattern to keep (lines 61-66):
```typescript
export const useSettingsStore = create<SettingsState>()(
  persist((set) => ({ ivaMode: "con", setIvaMode: (ivaMode) => set({ ivaMode }) }), { name: STORAGE_KEY, version: 1, ... }),
);
```
Actions become thin delegates to pure reducers from `@/domain/settings/*` (`set((s) => addCategory(s, name))`). The store may import domain; domain may not import the store.

**Test analog:** `src/stores/settingsStore.test.ts` lines 1-40: `// @vitest-environment jsdom`, `window.localStorage.setItem(KEY, JSON.stringify({ state: {...}, version: 1 }))`, `await useSettingsStore.persist.rehydrate()`, reset in `beforeEach/afterEach`. Add a golden v1 localStorage fixture test (`{ ivaMode: "sin" }`, version 1 -> ivaMode kept, 9 seeds present).

---

### `src/domain/settings/*` (pure model/reducers)

**Analogs:** `src/stores/settingsStore.ts` lines 14-22 for zod style (`z.enum`, `z.object`, `z.infer`); `src/domain/accounting/filters.ts` lines 34-41, 105-128 for Map/Set + `Intl.Collator("es", { sensitivity: "base" })`.

`normalize.ts` copy from `src/lib/format.ts` lines 226-233 (re-implement; `@/lib/*` is forbidden in domain), then add inner-space collapse (D-10):
```typescript
export function normalizeDescription(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}
```
Group maps with `Map`, never plain objects keyed by RFC (filters.ts header comment lines 6-8). Persisted shape uses arrays (`supplierCategories: [{rfc, name, categoryId}]`, `conceptRules: [{rfc, key, categoryId | null}]`), Maps built in memory in `resolver.ts`.

Undo token pattern (`src/stores/sessionStore.ts` lines 37-45, 142-154): the action returns a token and a separate action consumes it touching only the token's keys. Use the same for `deleteCategory(...) -> { next, snapshot }` and `restoreCategory(settings, snapshot)`.

Backup (`backup.ts`): no in-repo file-parsing analog beyond zod; follow RESEARCH Pattern 4 order (size, JSON.parse try/catch, header, newer-version check, frozen v1 schema + superRefine). Return a discriminated Result, never throw.

---

### `src/domain/accounting/categories.ts` (service, transform)

**Analog:** `src/domain/accounting/aggregate.ts`.

Header/import style (lines 1-18): doc comment stating invariants, `import type Big from "big.js"`, `import { ZERO, fromInteger, sum } from "./decimal"`, relative imports for siblings (domain uses relative, not `@/`), `Intl.Collator` constant.

Guarded division and deltas to reuse for DASH-05/07 (lines 91-97):
```typescript
export function deltaFraction(current: Big, previous: Big | null): Big | null {
  if (previous === null || previous.lte(ZERO)) return null;
  return current.minus(previous).div(previous);
}
```
Per-group accumulation to copy for `categoryBreakdown` (aggregate.ts 171-209): `Map<string, Acc>` keyed by id, skip `!entry.counted`, `entryAmount(entry, mode)` null check, `sum(amounts)`, `pct = total.gt(ZERO) ? net.div(total) : null`, sort by net desc then COLLATOR then key.

Scope transform: `scopeToCategories(visible, categories, resolver)` rewrites `conIva/sinIva` of a `LedgerEntry` copy to the chosen categories' part (spread `{ ...entry, conIva, sinIva }`) so `kpis`, `monthlySeries`, `supplierRanking` (aggregate.ts) work unchanged. Concept amounts come from `conceptAmounts(concepto, invoice)` in `src/domain/accounting/amounts.ts` (line 124; returns `{precioUnitario, conIva, sinIva}`, null when unusable). Rounding difference goes to the supplier category (D-13). Add a test file mirroring `aggregate.test.ts` including "sum of categories == totalSpend".

Month pair for D-17: use `previousFilters`-style helper (filters.ts 151-158) but with the one-month previous range via `months.ts`, not `previousPeriod` of equal length.

---

### `src/domain/accounting/filters.ts` (modify)

Add `categories: ReadonlySet<string>` to `Filters` (lines 19-26) and `EMPTY_FILTERS` (34-38); extend `previousFilters` (152-158) to carry it, and `isDefaultFilters` (160-164). `applyFilters` stays as is (category scoping is a separate stage after it, so FILT-05 still has one path). Add `categoryOptions(entries, resolver)` next to `supplierOptions` (113-128) reusing `FilterOption` + `compareOptions`. Update `filters.test.ts` fixtures that build `Filters` literals.

---

### `src/domain/accounting/status.ts` (utility, extract)

Extract `stateOf` from `src/features/invoices/columns.ts` lines 62-67 verbatim:
```typescript
function stateOf(entry: LedgerEntry): RowState {
  if (entry.noSuma !== null) return "no-suma";
  if (entry.exclusion === "manual") return "excluida";
  if (entry.exclusion === "sustituida") return "sustituida";
  return "normal";
}
```
`columns.ts` then imports it; Excel "Estado" column maps it (and `noSuma` reason) to Spanish via `@/lib/copy`.

---

### `src/stores/sessionStore.ts` (modify)

Analog: itself. Add `categories` to filters via a setter copying lines 131-135:
```typescript
setSuppliers: (suppliers) =>
  set((current) => ({ filters: { ...current.filters, suppliers }, focusRequest: null })),
```
Extend `AppTab` (line 19) with `"categorias"`; `isAppTab` in `AppShell.tsx` (44-46) and `TABS` (55-59) must change together (order: dashboard, categorias, calidad, importacion). Click-to-filter (D-18): new action that adds one key to the set (copy `withUuid`, lines 97-101) and sets `activeTab: "dashboard"`. Not persisted: keep "no middleware" comment (line 103).

`storageStatusStore.ts`: plain `create<...>()((set) => ({...}))` exactly like sessionStore, no `persist`.

---

### `src/features/dashboard/useDashboardView.ts` (hook)

**Analog:** `src/features/dashboard/useLedger.ts` (31 lines): `"use client"`, primitive store selectors, `useMemo` on them, doc comment naming the single-source-of-truth reason. Lift the memo chain from `DashboardTab.tsx` lines 39-70 (`span`, `applyFilters`, `range`, `kpis`, `previousVisible`, `series`, `ranking`) into it, add resolver (`useMemo(() => makeResolver(settings), [...])`) and `scopeToCategories`. `DashboardTab` and `ExportButton` (top bar, outside DashboardTab) both call it (XLS-02).

---

### `src/features/dashboard/CategorySpend.tsx` (component)

**Analog:** `src/features/dashboard/SupplierRanking.tsx` (108 lines).

Copy: section shell `className="flex flex-col gap-4 rounded-lg border bg-background p-6"` (83), header h2 + muted sub (84-88), `<ol aria-label=...>` list (100-104), `fillPercent` guard (25-28), track/fill bars with `bg-chart-1` and `data-testid` (43-57), `TruncatedText` for names (37), `formatMoney/formatPercent` from `@/lib/format`, `MISSING = "—"`, copy through `es.*` and `messages.ts`. Row becomes a button that calls the "add filter and go to table" action (D-18). Variation colors: reuse the D-20 delta presentation from `KpiRow.tsx`. Layout in `DashboardTab.tsx` lines 155-163 changes to trend full width then a 50/50 grid (UI-SPEC Q1).

---

### Category filter in `FilterBar.tsx`

**Analog:** `src/features/dashboard/MultiSelectFilter.tsx` (use as is). Props (lines 44-53): `label, options, selected, onChange, searchPlaceholder, clearLabel, noMatch, widthClass`. Options are `FilterOption {key,label,count}` and "Sin categoría" is just one more option with the reserved key. Mirror how `FilterBar` wires the supplier filter to `setSuppliers`; add `setCategories` the same way. Update `FilterBar.test.tsx`.

---

### `src/features/invoices/ConceptCategorySelect.tsx` and `ConceptsPanel` edits

**Analog:** `ConceptsPanel` in `src/features/invoices/InvoiceTable.tsx` lines 152-241 (concepts table via `conceptRows(entry, mode)`; rows keyed by `concept.key`; all text as React text nodes). Add a column after Monto using `src/components/ui/select.tsx` (Base UI; Select inside AlertDialog is MEDIUM risk per research). Toast + undo for D-11/Q5, copy from lines 326-336:
```typescript
toast(es.invoices.excludedToast, {
  duration: TOAST_DURATION_MS,
  action: { label: es.invoices.undo, onClick: () => { undoExclusion(undo); } },
});
```
`ConceptRow` (columns.ts 91-103) gains `categoryId`, `source: "regla" | "proveedor" | "ninguna"`, `dimmed`; extend `conceptRows(entry, mode)` (105-121) with a resolver parameter. Dim rows with the existing muted text pattern used for "no suma" rows (D-27).

---

### `src/features/categories/DeleteCategoryDialog.tsx`

**Analog:** `src/features/shell/LogoutButton.tsx` lines 5-14, 29-30, 55-80: `AlertDialog`/`AlertDialogContent initialFocus={dismissRef}`, `AlertDialogCancel ref={dismissRef}` (focus the safe button), `AlertDialogAction variant="destructive"` closing the dialog before the action, copy keys under `es.dialogs.*`. Add the reassign Select (default "Sin categoría") and the post-delete toast with "Deshacer" (snapshot token).

### `src/features/categories/CategoriesTab.tsx`, `CategoryList.tsx`

**Analog:** `src/features/quality/QualityTab.tsx` (tab panel with `Empty`/sections) and `DashboardTab.tsx` lines 87-96 for the empty state. Inline name error follows `src/components/ui/field.tsx`/`input.tsx`. Panels are registered in `TABS` (AppShell 55-59) as `ComponentType` with no props.

### `src/features/categories/SupplierCategoryTable.tsx`

**Analog:** `src/features/invoices/InvoiceTable.tsx` (TanStack Table v9: `useTable({ features, columns, ... })`, `SortingState`, `PaginationState`, `PAGE_SIZE`, `renderHeader` with `aria-sort`, `SortHeaderButton`). Same feature set, nothing new. Rows = loaded suppliers (`supplierOptions(ledger)`) union stored assignments (marked "sin facturas cargadas").

### `src/features/categories/BackupControls.tsx`

No exact analog for download/upload; for hidden file input and reset-after-use see `src/features/upload/UploadRoot.tsx` (`openFiles`). Confirm dialog = AlertDialog pattern above. Reset `input.value = ""` after every attempt.

### `src/features/export/ExportButton.tsx`

**Analog:** `AddInvoicesButton`, `src/features/shell/AppShell.tsx` lines 24-38:
```typescript
<Button type="button" disabled={processing} onClick={openFiles}
  className="h-9 max-md:size-9 max-md:px-0 max-sm:size-11" aria-label={es.global.addInvoices}>
  <Upload className="size-4" aria-hidden="true" />
  <span className="max-md:sr-only">{es.global.addInvoices}</span>
</Button>
```
Mount in the `actions` prop at AppShell line 128 next to it (fragment), only when `reportVisible`. Load the library lazily inside the click handler: `const { default: writeExcelFile } = await import("write-excel-file/universal")`; wrap `toBlob()` in a timeout; toast on success/failure with `sonner` as in InvoiceTable. Only import `write-excel-file/universal`.

### `src/features/export/sheets/*.ts`

Pure builders `(view, settings, mode, copy) => CellModel rows`. Live in `src/features/export` (needs `@/lib/copy`), never `src/domain`. Analog for row mapping: `toInvoiceRows` / `conceptRows` / `roundingDifference` in `src/features/invoices/columns.ts` (70-88, 105-121, 128+). Money via Big `.toNumber()` only at the cell boundary, `Date.UTC` for dates, guard NaN/Infinity (RESEARCH Pitfalls 2, 3, 10). Test builders on the cell model, not unzipped xlsx.

### `next.config.ts` (CSP)

Analog: itself, `contentSecurityPolicy` array lines 11-22. After user approval (Open Question Q-A) add one entry: `"worker-src 'self' blob:"`. Note the existing comment style explaining each directive.

### `src/lib/copy/es.ts` / `messages.ts`

Static strings go in `es` (new keys only, never rename: header comment lines 1-8); interpolated sentences go in `messages.ts` as functions (e.g. `hiddenInvoiceNotice`, `rankingCaption`, `qualityTabLabel`). Update `messages.test.ts` for new functions.

## Shared Patterns

### Domain purity
**Source:** `eslint.config.mjs` lines 9-27. Applies to everything under `src/domain/**`; use relative imports between domain files (`./decimal`, `./ledger`).

### Strict validation of external data
**Source:** `src/stores/settingsStore.ts` lines 14-22, 74-80 (`safeParse` then use `parsed.data`; no `as`). Applies to localStorage, backup file, and any JSON.

### Map/Set for externally keyed groups
**Source:** `src/domain/accounting/filters.ts` header (lines 6-8) and `aggregate.ts` 175-188. Applies to RFCs, descriptions, category ids.

### Money and guarded division
**Source:** `src/domain/accounting/aggregate.ts` lines 91-97, `decimal.ts` (`ZERO`, `fromInteger`, `sum`; `Big.strict = true`). Never feed numbers to Big; never divide by zero (Big throws).

### Toast with undo (6 s)
**Source:** `src/features/invoices/InvoiceTable.tsx` lines 325-342 (`toast(msg, { duration: TOAST_DURATION_MS, action: { label, onClick } })`, `TOAST_DURATION_MS` defined near line 86).

### Confirm dialog
**Source:** `src/features/shell/LogoutButton.tsx` lines 55-80.

### Single filtered view for UI and export
**Source:** `DashboardTab.tsx` lines 51-70 -> move to `useDashboardView`; `applyFilters` doc in `filters.ts` lines 1-9 states the FILT-05 contract.

### Store hydration
**Source:** `AppShell.tsx` lines 121-123 (`void useSettingsStore.persist.rehydrate()` in an effect).

### Copy
**Source:** `src/lib/copy/es.ts` + `messages.ts`; UI components never inline Spanish strings.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/features/export/cellModel.ts` | utility | transform | No spreadsheet code exists; use RESEARCH Pattern 6 / Code Examples |
| `src/features/export/toLibrarySheet.ts` | utility | transform | Wraps `write-excel-file/universal` types; follow `.claude/CLAUDE.md` Excel section |
| `src/features/export/exportWorkbook.ts` | service | file-I/O | No blob generation in the repo |
| `src/features/export/downloadBlob.ts` | utility | file-I/O | No download helper in the repo (`URL.createObjectURL` + temporary `<a download>`, revoke after) |
| `src/domain/settings/backup.ts` (versioned file contract) | utility | file-I/O | Closest is zod style only; use RESEARCH Pattern 4 |

## Metadata

**Analog search scope:** `src/domain`, `src/stores`, `src/features`, `src/lib`, `src/components/ui`, `next.config.ts`, `eslint.config.mjs`
**Files scanned:** about 20 read in full or in part (listed 150+ tracked files)
**Pattern extraction date:** 2026-10-16
