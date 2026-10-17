---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 01
subsystem: settings-and-dashboard
tags: [zustand, zod, persist, migration, big.js, categories, dashboard]

requires:
  - phase: 02-dashboard-de-gasto-confiable
    provides: LedgerEntry, conceptAmounts, supplier ranking pattern, settings store v1 (D-06)
provides:
  - Settings data model (version 2) with the nine suggested categories and stable ids
  - Never-throwing resolvePersisted with the Phase 2 to Phase 3 migration
  - Resolver (supplier category, SIN_CATEGORIA) behind the final resolve signature
  - splitEntry and categoryBreakdown (per-concept split, exact rounding difference to the supplier category)
  - Persisted settings store at version 2
  - "Gasto por categoría" block next to the supplier ranking (UI-SPEC Q1 layout)
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10, 03-11, 03-12, 03-13]

actuals:
  tokens: 17000
  tasks: 1
  commits: 1
plan_head_before: b6d6488211568244ee941614654489b1f32fd918
plan_head_after: 9afabaefb17d98ab314718ec79213e6339cdb363

tech-stack:
  added: []
  patterns:
    - "Stored settings as lists of entries, Map lookups in memory (RFC text is data, Pitfall 8)"
    - "Envelope-only getItem validation (state: z.unknown()), full validation in total resolvePersisted used by migrate and merge"
    - "Per-concept split with the exact big.js difference sent to the supplier category, so categories add up to totalSpend"

key-files:
  created:
    - src/domain/settings/types.ts
    - src/domain/settings/schema.ts
    - src/domain/settings/migrate.ts
    - src/domain/settings/resolver.ts
    - src/domain/accounting/categories.ts
    - src/domain/accounting/categories.test.ts
    - src/features/dashboard/CategorySpend.tsx
  modified:
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - tests/support/settingsStorage.ts
    - src/features/dashboard/DashboardTab.tsx
    - src/features/dashboard/DashboardTab.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts

key-decisions:
  - "Task 1 (package gate) approved by the user: write-excel-file 4.1.1 pinned exactly, installed in Plan 03-13 only; fflate ^0.8.2 only as its transitive dependency (D-29); no shadcn copy-in component. This plan installed nothing."
  - "Task 2 (one-way format) resolved by the user as option-a: lists of entries with the readable description kept."
  - "Stored state = { ivaMode, categories: [{ id, name }], supplierCategories: [{ rfc, name, categoryId }], conceptRules: [{ rfc, key, description, categoryId | null }] }; ids seed:insumos-cafeteria ... seed:otros for the nine suggestions, cat_ + random UUID for new ones."
  - "Backup file envelope (Plan 03-07 must write exactly this): { \"app\": \"invoicechecker-settings\", \"version\": 1, \"settings\": { the same four fields } }. The file version is independent of the store version."
  - "Stored value with version 1 and a valid mode migrates (status migrated); any other version is parsed with settingsDataSchema; a valid stored state with zero categories is never re-seeded."

patterns-established:
  - "resolvePersisted(raw, version) is the single total entry for migrate and merge; it never throws and returns defaultSettings() on any failure"
  - "tests/support/settingsStorage.ts: storeIvaMode writes the Phase 2 envelope (version 1, exercises migration), storeSettings writes version 2, resetSettingsStore resets memory and clears the key"

requirements-completed: [DASH-03, DASH-05, AJUS-01]

coverage:
  - id: D1
    description: "A supplier assigned to a category shows its net spend under that category in Gasto por categoría, other suppliers under Sin categoría, and the rows add up to Gasto total in both IVA modes"
    requirement: "DASH-03"
    verification:
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#Dashboard tab: Gasto por categoría"
        status: pass
      - kind: unit
        ref: "src/domain/accounting/categories.test.ts#categoryBreakdown"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each category row shows pct of total and Promedio mensual on the same months divisor as the KPI; negative net shows the tick and the negative caption and sorts last"
    requirement: "DASH-05"
    verification:
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#shows the share of the total and the monthly average"
        status: pass
    human_judgment: false
  - id: D3
    description: "Version-2 settings persist, the Phase 2 contract migrates keeping Sin IVA, and unusable stored values fall back to the suggestions without throwing"
    requirement: "AJUS-01"
    verification:
      - kind: unit
        ref: "src/stores/settingsStore.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dashboard layout: trend full width, then categories and suppliers in two equal columns from 1024 px"
    verification:
      - kind: integration
        ref: "src/features/dashboard/DashboardTab.test.tsx#shows the trend full width, then categories and suppliers in two equal columns"
        status: pass
    human_judgment: true
    rationale: "Class names are asserted in jsdom; the visual two-column result at 1024 px and the stacked mobile order need a human look in a real browser"

duration: 25min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 01: Category settings tracer Summary

**Version-2 persisted settings (migrated from the Phase 2 contract) feeding a resolver and a per-concept split with exact rounding difference into a "Gasto por categoría" Dashboard block whose rows add up to Gasto total**

## Performance

- **Duration:** about 25 min
- **Tasks:** 3 of 3 (Tasks 1 and 2 were blocking checkpoints resolved by the user before dispatch; Task 3 executed here)
- **Files:** 7 created, 7 modified
- **Commits:** 1 production commit (`9afabae`)

## Accomplishments

- Task 1 (package legitimacy gate, `blocking-human`): user replied "approved". write-excel-file 4.1.1 pinned exactly, installed in Plan 03-13 only, imported from its universal entry; fflate ^0.8.2 arrives only as its transitive dependency (never a direct dependency, D-29); no shadcn component added. Orchestrator registry check at presentation: write-excel-file 4.1.1 MIT, maintainer catamphetamine, gitlab.com/catamphetamine/write-excel-file, single dependency fflate ^0.8.2, no install script; fflate 0.8.3 MIT, github.com/101arrowz/fflate. This plan installed nothing (only `pnpm install --frozen-lockfile` of the existing lockfile in the fresh worktree).
- Task 2 (one-way format, D-06 and D-07): user chose **option-a**. Recorded exactly so Plan 03-07 writes the same file envelope:
  - Stored state under `invoicechecker:settings`, `version: 2`: `{ ivaMode, categories: [{ id, name }], supplierCategories: [{ rfc, name, categoryId }], conceptRules: [{ rfc, key, description, categoryId | null }] }`.
  - Ids: `seed:insumos-cafeteria`, `seed:abarrotes-despensa`, `seed:limpieza-higiene`, `seed:servicios`, `seed:software-suscripciones`, `seed:comisiones-bancarias`, `seed:mantenimiento-reparaciones`, `seed:papeleria-oficina`, `seed:otros` for the nine suggestions; `cat_` plus a random UUID for new categories.
  - Backup file: `{ "app": "invoicechecker-settings", "version": 1, "settings": { ivaMode, categories, supplierCategories, conceptRules } }` (file version independent of the store version).
- Task 3 (tracer): settings model, schema with D-30 limits and integrity rules, total `resolvePersisted`, resolver, `splitEntry`/`categoryBreakdown`, version-2 store, `CategorySpend` block and the Q1 layout, with store, domain and end-to-end Dashboard tests.

## Task Commits

1. **Task 3: category settings v2 store, resolver, per-concept split and Gasto por categoría block** - `9afabae` (feat)

Tasks 1 and 2 are checkpoints with no commit.

## Deviations from Plan

None - plan executed exactly as written. The `pnpm install --frozen-lockfile` run was needed only because the fresh worktree had no `node_modules`; it changed no dependency.

## Issues Encountered

None blocking. `pnpm lint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive); the file is untouched by this plan, so it is out of scope.

## Verification

- `pnpm verify` equivalent: `pnpm lint` (0 errors, 1 pre-existing warning), `pnpm typecheck` (next typegen + tsc --noEmit) clean, `pnpm test` 938 passed / 8 skipped (3 files skipped), `pnpm build` succeeded.
- All task acceptance criteria re-run and passing: 9 distinct seed ids; `z.unknown()` x1, `resolvePersisted` x5, `SETTINGS_VERSION` x3 in the store; `category-supplier-row` x1, `lg:grid-cols-2` x1, `categoryBreakdown` x2, `makeResolver` x2 in DashboardTab; `conceptAmounts` x3 in categories.ts; no forbidden imports, no `Number(`/`parseFloat`/`toFixed(` in the new domain files, no raw-HTML injection in `src/features`.
- `git status --short` shows no file under Facturas/.
- Tracer gate: the tracer `<verify>` is automated-only, so it was re-run end to end after the commit scope was complete and passed; expansion plans can proceed.

## Known Stubs

None. `Resolver.resolve(rfc, descripcion)` intentionally returns the supplier category in this plan; Plan 03-04 adds the concept-rule lookup behind the same signature (documented in the interface and in `resolver.ts`).

## Threat Flags

None beyond the plan's threat model. Mitigations T-03-01 to T-03-05 are implemented and tested: envelope-only getItem plus total `resolvePersisted` (breach tests for 201 categories, 61-char name, reserved and duplicate names, missing ids, repeated rfc and rfc plus key, reserved id), no throwing migrate or merge (null, string, number states), Maps and list entries (rfc `__proto__` round-trip), `partialize` limited to the four fields with a single-key storage test, category names rendered as React text (test with an `<img>` payload name).

## Next Phase Readiness

Ready for Plan 03-02 (Categorías tab). It extracts the `settings`, `resolver` and `nameOf` memos in `DashboardTab.tsx` into a shared `useCategorySettings` hook when the tab becomes their second consumer. Plan 03-07 must use the backup envelope recorded above.

## Self-Check: PASSED

- Created files verified present on disk: types.ts, schema.ts, migrate.ts, resolver.ts, categories.ts, categories.test.ts, CategorySpend.tsx.
- Commit `9afabae` is an ancestor of HEAD.
