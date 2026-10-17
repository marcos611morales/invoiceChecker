---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 06
subsystem: ui
tags: [react, tanstack-table-v9, zustand, localStorage, sonner, tdd]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "setSupplierCategory reducer, settingsStore with persist, plain SupplierCategoryTable, resolvePersisted status (plans 03-01, 03-02, 03-05)"
provides:
  - "supplierTableRows, removeSupplierAssignment and restoreSupplierAssignment pure reducers plus the matching store actions"
  - "Sortable, 50-row paged Categoria por proveedor table on TanStack v9, with saved-only suppliers, Quitar asignacion and the Deshacer toast"
  - "useStorageStatusStore (in-memory read/write failure flags), the once-per-page-load read-failure toast and the write-failure Alert in Categorias"
affects: [03-07, 03-08, backup-and-restore, excel-export]

actuals:
  tokens: 15800
  tasks: 2
  commits: 7
plan_head_before: 24cb6e60110901e50e4410272b65212484931197
plan_head_after: ae6e18253b1289b319d2bd9c41d1ebd8de85a007

tech-stack:
  added: []
  patterns:
    - "Status flags of a persisted store live in a separate non-persisted store that the storage adapter and migrate/merge write to (never the persisted store: Pitfall 6)"
    - "Notice-once guard: the flag is set before the toast so StrictMode and repeated rehydrates do not repeat it"

key-files:
  created:
    - src/domain/settings/assignments.test.ts
    - src/stores/storageStatusStore.ts
    - src/features/categories/SupplierCategoryTable.test.tsx
  modified:
    - src/domain/settings/assignments.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/features/categories/SupplierCategoryTable.tsx
    - src/features/categories/CategoriesTab.tsx
    - src/features/categories/CategoriesTab.test.tsx
    - src/features/shell/AppShell.tsx
    - src/features/shell/AppShell.test.tsx
    - src/lib/copy/es.ts
    - tests/support/settingsStorage.ts

key-decisions:
  - "Unsorted state of the supplier table is the data order (by name), not Facturas descending: Facturas descending is only the initial sort, and its header cycles descending, unsorted, ascending, exactly like the Facturas table"
  - "resetSettingsStore (test support) also resets the status flags so no test leaks a read/write failure"

patterns-established:
  - "Supplier table columns and features at module scope; data pre-sorted by name with the es collator so TanStack's stable sort keeps names in order inside equal counts"

requirements-completed: [CAT-02, AJUS-01]

coverage:
  - id: D1
    description: "Supplier table lists loaded suppliers plus saved-only suppliers (Sin facturas cargadas badge, Quitar asignacion with undo toast)"
    requirement: CAT-02
    verification:
      - kind: unit
        ref: "src/domain/settings/assignments.test.ts and src/features/categories/SupplierCategoryTable.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Table sorts by Proveedor, Facturas and Categoria por defecto with aria-sort, pages by 50 with the footer only above 50 rows, 5,001st supplier refused with a toast"
    requirement: CAT-02
    verification:
      - kind: unit
        ref: "src/features/categories/SupplierCategoryTable.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unreadable stored settings give one toast per page load; a failed write shows a non-dismissible Alert in Categorias that disappears after a later successful write"
    requirement: AJUS-01
    verification:
      - kind: unit
        ref: "src/stores/settingsStore.test.ts, src/features/shell/AppShell.test.tsx, src/features/categories/CategoriesTab.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual layout at 900 px min width, 296 px Select trigger, wrapping popup items, touch targets below 640 px"
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout engine; only the classes are asserted, so the real rendering needs a look in a browser"

duration: 10min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 06: Supplier table finish and storage failure reporting Summary

**Categoria por proveedor now sorts and pages on TanStack v9, lists suppliers that only exist in the saved settings with Quitar asignacion plus Deshacer, and Q8 storage failures are reported through a non-persisted status store (read-failure toast once per page load, write-failure Alert in Categorias).**

## Performance

- **Duration:** about 10 min
- **Tasks:** 2 (both TDD)
- **Files modified:** 13 (3 created, 10 modified)

## Accomplishments

- `supplierTableRows`, `removeSupplierAssignment`, `restoreSupplierAssignment` in `src/domain/settings/assignments.ts`, pure and immutable. Restore replaces an assignment of the same RFC made meanwhile, and refuses silently (same object) when the category is gone or appending would pass 5,000.
- Store actions `removeSupplierAssignment` / `restoreSupplierAssignment` as thin delegates that write only on an effective change.
- `SupplierCategoryTable` rewritten like `InvoiceTable`: sortable headers with `SortHeaderButton` and `aria-sort` (RFC not sortable), `sortUndefined: "last"` for unassigned categories, 50-row pages with `Mostrando a-b de n` and `Pagina p de P` only above 50 rows, `min-w-[900px]` inside the horizontally scrolling table container, row height 56 px, an unassigned Select in the muted color, the limit toast for the 5,001st supplier.
- Saved-only rows: outline Badge «Sin facturas cargadas» in the Facturas cell and a ghost «Quitar asignación» button; it removes at once and shows «Asignación quitada» for 6 s with «Deshacer».
- `useStorageStatusStore` (no middleware). The adapter's `getItem` marks a read failure when a stored value exists but is not JSON or has the wrong envelope; `migrate`/`merge` mark it when `resolvePersisted` says `unreadable`; `setItem` sets/clears `writeFailed`. A throwing `getItem` does not mark a read failure.
- `AppShell` shows the read-failure toast once (the `readNoticeShown` flag is set before the toast). `CategoriesTab` shows the non-dismissible Info Alert while `writeFailed`.

## TDD Gate Compliance

| Slice | RED commit | GREEN commit |
|-------|-----------|--------------|
| Domain reducers | 35b6535 (9 tests failed: `is not a function`) | 6445306 |
| Supplier table | 00761a6 (9 of 15 failed on the planned assertions: row order, badge, Quitar asignacion, limit toast, paging) | 937bb4f |
| Storage failure reporting | 5d7cd86 (9 failed on the planned assertions: flags false, Alert null, toast not called) | ae6e182 |

RED evidence was inspected semantically (assertion failures on the planned behavior, not import or syntax errors); `gsd_run check tdd-red-evidence` was not run because it needs a TAP/JUnit report and the project runs Vitest's default reporter. `storageStatusStore.ts` and the `resetSettingsStore` change were committed (4d561fd) before the storage RED tests so those tests fail on behavior, not on a missing module. No REFACTOR commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test support resets the status store**
- **Found during:** Task 2
- **Issue:** The status store is not persisted, so `resetSettingsStore()` (used by every settings test) would leave a read or write failure flag set for the next test.
- **Fix:** `resetSettingsStore` in `tests/support/settingsStorage.ts` also resets the three flags (the plan said "reset the status store in afterEach"; this does it in the shared helper).
- **Files modified:** tests/support/settingsStorage.ts
- **Commit:** 4d561fd

**2. [Plan-vs-test adjustment] Expected unsorted order**
- **Found during:** Task 1 verification
- **Issue:** The first draft of the sort tests assumed that clicking a header back to "unsorted" restores Facturas descending, and that the first click on Facturas (already descending) gives ascending. TanStack's cycle with `sortDescFirst: false` goes descending, unsorted, ascending, and unsorted is the data order (by name), the same behavior as the Facturas table.
- **Fix:** Tests corrected to the real cycle; implementation unchanged (matches the plan's "again unsorted"). Recorded as a key decision.
- **Commit:** 937bb4f

**Total deviations:** 2 (1 blocking-support fix, 1 test expectation corrected). **Impact:** none on the plan's behavior.

## Issues Encountered

None blocking. `pnpm verify` passes (lint, typecheck, 1215 tests, build). `pnpm lint` reports one pre-existing warning (unused eslint-disable in `src/lib/client/navigation.ts`, untouched by this plan). 8 tests in 3 files are skipped, as before this plan.

## Known Stubs

None.

## Threat Flags

None. T-03-12 (silent loss) mitigated by the flags, the once-per-load toast and the Alert; T-03-13 (loop) mitigated because the adapter and migrate/merge only touch the status store, and a test asserts one `setItem` call per change; T-03-14 (stored XSS) mitigated, supplier names render as React text only and a hostile name test is included. No new network or auth surface.

## Next Phase Readiness

The Alert text points the user to downloading the settings; the backup download itself belongs to a later plan of this phase. Ready for the next plan.

## Self-Check: PASSED

Files created exist (assignments.test.ts, storageStatusStore.ts, SupplierCategoryTable.test.tsx); commits 35b6535, 6445306, 00761a6, 937bb4f, 4d561fd, 5d7cd86, ae6e182 are ancestors of HEAD; `pnpm verify` exits 0; acceptance criteria greps pass (useTable and SortHeaderButton present, `min-w-[900px]` once, copy strings once each, no `zustand/middleware` in the status store).
