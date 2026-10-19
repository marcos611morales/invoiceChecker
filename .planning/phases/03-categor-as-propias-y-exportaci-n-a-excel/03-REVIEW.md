---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
reviewed: 2026-10-19T12:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/domain/accounting/view.ts
  - src/features/categories/BackupControls.test.tsx
  - src/features/categories/BackupControls.tsx
  - src/features/dashboard/FilterBar.test.tsx
  - src/features/dashboard/FilterBar.tsx
  - src/features/export/ExportButton.test.tsx
  - src/features/export/ExportButton.tsx
  - src/features/export/sheets/parametros.test.ts
  - src/features/export/sheets/parametros.ts
  - src/features/export/writeWorkbook.test.ts
  - src/lib/copy/es.ts
  - src/stores/sessionStore.test.ts
  - src/stores/sessionStore.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 3: Code Review Report (re-review after gap-closure plans 03-18..03-20)

**Reviewed:** 2026-10-19
**Depth:** standard
**Files Reviewed:** 13 (the diff since `932b2c0`, read in full context)
**Status:** issues_found (3 Info only; no Critical, no Warning)

## Summary

This is an incremental re-review of the three gap-closure plans that targeted WR-01..WR-03 of the prior review (2026-10-18). I read the diff and the surrounding code of each touched file, followed the call chains (`BackupControls` -> `settingsStore.replaceAll` + `sessionStore.pruneCategoryFilter` -> `effectiveSelection`; `useDashboardView` -> `selectView` -> `ExportButton` -> `buildWorkbook`), and ran the checks required by CLAUDE.md. `pnpm tsc --noEmit` is clean. `eslint` over `src/domain/accounting/view.ts`, `src/features`, `src/stores` and `src/lib/copy` reports nothing. `vitest run` over `src/features`, `src/stores` and `src/domain/accounting` passes (51 files, 1327 tests). I did not re-run the full suite or the e2e specs.

### Resolution of the prior warnings

| ID | Status | Evidence |
|----|--------|----------|
| WR-01 (stale category ids after «Subir ajustes» leak into the chip and the Parámetros sheet) | RESOLVED | The fix works at three levels. (1) `BackupControls.tsx:168-171` prunes the session filter right after `replaceAll`, with the new settings' ids. (2) `pruneCategoryFilter` (`sessionStore.ts:175-179`) reuses `effectiveSelection`, now exported from `view.ts:78`, so the store, `selectView`, the chip and the export share one rule. It skips the `set` call when nothing is dropped, so subscribers are not woken. (3) As defense in depth, `FilterBar.tsx:132-144` derives an effective set for chip, count, reset button and trigger, and `ExportButton.tsx:51-55` now reads `view.selected` instead of the raw `filters.categories`. I checked the other readers of `filters.categories` (`DashboardTab` uses `view.selected`; nothing else reads the raw set). The first toggle in the picker now starts from the effective set, so a stale id is dropped on the next change. Tests cover the store (new Set, same object when unchanged, empty when only unknown ids), the bar, the export context, and the end-to-end path through `AppShell` including the «Conservar los míos» no-op (D-08). |
| WR-02 (Monto columns can differ by cents from the Dashboard total; the file did not say so) | RESOLVED (by disclosure) | `es.export.params.noteText` (`es.ts:417-418`) now states that each amount is rounded to cents and that a column sum can differ by cents from the Gasto total and from the Total row of the summaries, which round the exact sum. I verified the claim against the code: `resumenMes`, `resumenCategoria` and `resumenProveedor` build their Total row from `view.current` (exact sum rounded once), while Facturas/Conceptos round per row. The text is therefore accurate. The test pins the exact copy for both IVA modes. The user decision (option-a) is recorded in the test comment. See IN-03 for a small remaining gap. |
| WR-03 (`writeWorkbook` tests promised more than they asserted) | RESOLVED | `capturingLoader` records the `Sheet[]` the library receives and still delegates to the real library. The "several sheets" test now asserts the call count, sheet count, names in order and `stickyRowsCount`. The "every kind of cell" test asserts the `Date` cell, that `=1+1` stays `type: String` with `format: "@"`, that `NaN` becomes an empty cell, the empty/null cells, and the styled Total row, and still checks the `PK` magic bytes. The formula-injection guard is now verified at the boundary of the writer, not only one layer up. |

No new Critical or Warning defects were found in the diff. Behavior I specifically tried to break and could not:

- `pruneCategoryFilter` size comparison: `effective` is always a subset of the current selection, so `effective.size === categories.size` means nothing was dropped. The early return is sound.
- Ordering in the confirm handler: React batches the two store updates inside the click handler, and even a render between them is safe because every reader applies `effectiveSelection`.
- `SIN_CATEGORIA` is always kept by `effectiveSelection`, and `categoryOptions` always emits it, so `selectedNames` never prints a raw key for the effective set.
- `FilterBar` memoization: `effectiveCategories` and `filters` change identity only when the session set or the known ids change, so `MultiSelectFilter` is not re-rendered needlessly.
- `view.ts` does not import any store, so the new `sessionStore` -> `view` import creates no cycle.

## Info

### IN-01: Formatting drift in two edited blocks

**File:** `src/features/dashboard/FilterBar.tsx:177-183` and `src/features/categories/BackupControls.tsx:168-171`
**Issue:** The second `<FilterTriggers ...>` inside `CollapsibleContent` was edited with the wrong indentation (props at the indent of the parent instead of two levels deeper, closing `/>` misaligned), which is inconsistent with the first usage a few lines above. In `BackupControls.tsx` the new comment is a single line of about 150 characters and the `pruneCategoryFilter(new Set(...))` call is a long line that a formatter would wrap. Neither affects behavior; `eslint` does not flag them because no formatter rule is enabled.
**Fix:** Re-indent the block and wrap the long lines.
```tsx
<FilterTriggers
  span={span}
  suppliers={suppliers}
  categories={categories}
  formas={formas}
  selectedCategories={effectiveCategories}
/>
```
```ts
// A restored file can drop categories selected in the Dashboard filter; they must
// not stay selected (WR-01, like T-03-38 on delete).
useSessionStore
  .getState()
  .pruneCategoryFilter(new Set(pending.settings.categories.map((category) => category.id)));
```

### IN-02: The "known category ids" set is derived in three places, and the shared rule lives in the view module

**File:** `src/features/dashboard/FilterBar.tsx:132-135`, `src/features/dashboard/useDashboardView.ts:36-39`, `src/features/categories/BackupControls.tsx:170`
**Issue:** `new Set(settings.categories.map((c) => c.id))` is now written in `useDashboardView`, in `FilterBar` and in `BackupControls`. The three copies are equivalent today, but they are the thing that must stay identical for screen, figures and file to agree (the point of WR-01). Also, `effectiveSelection` is a small pure helper about the category filter, yet it lives in `view.ts`, so `sessionStore.ts` and `FilterBar.tsx` now import the whole view module (aggregate, categories, big.js) for one function. `FilterBar` could receive the effective set from `useDashboardView().view.selected` instead of recomputing it (its parent `DashboardTab` already holds `view`).
**Fix:** Move `effectiveSelection` (and optionally a `knownCategoryIds(categories)` helper) next to `FilterOption`/`Filters` in `src/domain/accounting/filters.ts` or into `categories.ts`, re-export or import it from there in `view.ts`, and pass `view.selected` down to `FilterBar` as a prop. Low priority; no behavior change.

### IN-03: The rounding disclosure appears only in the Parámetros sheet

**File:** `src/features/export/sheets/parametros.ts:60`, `src/lib/copy/es.ts:417-418`
**Issue:** The accountant who sums the Monto column of Facturas or Conceptos and compares it with the Resumen Total sees the explanation only if they open Parámetros. This is acceptable for the scope the user confirmed (option-a), but Facturas and Conceptos still have no Total row or per-sheet hint. Also, the note is a single wrapped cell of about 290 characters in a 60-wide column; Excel normally auto-fits the row height of a wrapped cell on open, but LibreOffice/Numbers may clip it. I did not open the generated file in those apps.
**Fix:** Optional. Open one generated workbook in Excel and LibreOffice to confirm the Nota row is fully readable. If it is clipped, split the Nota into two rows (excluded invoices, rounding).

---

_Reviewed: 2026-10-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
