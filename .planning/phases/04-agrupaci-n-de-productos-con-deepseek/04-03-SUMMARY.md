---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 03
subsystem: settings
tags: [zustand, persist, zod, migration, localStorage, products, backup-contract]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: settings store version 2, frozen backup file contract version 1, total resolvePersisted
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-01)
    provides: Productos tab tracer that will read accepted products
provides:
  - "Settings model version 3: Product, ProductMember, UngroupedConcept, SettingsDataV2 (frozen Phase 3 shape), SettingsData with products and ungroupedConcepts"
  - "SETTINGS_VERSION 3 and LIMITS products 2000, productMembers 5000, ungroupedConcepts 5000, productName 60"
  - "comparableName exported, productIntegrityIssues, frozen settingsDataSchemaV2, six-field settingsDataSchema"
  - "Total version-2 to version-3 migration in resolvePersisted"
  - "Store, useCategorySettings and BackupControls carrying the six fields; test helpers storeSettings (current version) and storeSettingsV2"
affects: [04-05 accept slice, 04-10 backup file version 2, resolver product level, delete-category ripple]

actuals:
  tokens: 12000
  tasks: 2
  commits: 3
plan_head_before: 58ffdf7db81ebdd732c722107afa49d98c718262
plan_head_after: 2e4c762b8801e701764f4e2fec29cfa5e982f7b4

tech-stack:
  added: []
  patterns:
    - "Frozen schema per stored version (settingsDataSchemaV2) read by a safeParse-only migration branch"
    - "Member and mark identity as NUL-joined composite strings in Sets, never objects keyed by RFC"

key-files:
  created: []
  modified:
    - src/domain/settings/types.ts
    - src/domain/settings/schema.ts
    - src/domain/settings/migrate.ts
    - src/domain/settings/backup.ts
    - src/domain/settings/settings.test.ts
    - src/domain/settings/backup.test.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/features/categories/useCategorySettings.ts
    - src/features/categories/BackupControls.tsx
    - src/features/categories/BackupControls.test.tsx
    - tests/support/settingsStorage.ts
    - src/features/categories/CategoriesTab.test.tsx
    - src/features/dashboard/DashboardTab.test.tsx

key-decisions:
  - "Marks («No agrupar») must also be unique by rfc plus key, besides being disjoint from every member (RESEARCH integrity list; the plan truths named only the disjoint rule)"
  - "A product needs at least one member and each member (rfc plus key) is unique across all products, including repeated inside one product"
  - "buildBackupText keeps taking the six-field SettingsData and writes only the four Phase 3 fields at file version 1"
  - "A confirmed upload of a version-1 settings file replaces products and marks with empty lists (the file never carried them); file version 2 is Plan 04-10"

patterns-established:
  - "Stored-version ladder: version 1 branch, version 2 branch (frozen V2 schema, adds empty lists), current schema last"

requirements-completed: [LLM-04]

coverage:
  - id: D1
    description: "A stored version-2 value migrates to version 3 keeping every category, assignment, rule and the IVA mode, with no products and no marks, and the store rewrites it as version 3"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/settings/settings.test.ts#resolvePersisted from version 2 (D-13)"
        status: pass
      - kind: integration
        ref: "src/stores/settingsStore.test.ts#settingsStore stored version 2 (the Phase 3 value, D-13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every integrity breach and limit of a stored version-3 value falls back to the suggestions without throwing; a valid value with products and marks (including rfc __proto__) round-trips unchanged"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/settings/settings.test.ts#resolvePersisted version 3"
        status: pass
      - kind: integration
        ref: "src/stores/settingsStore.test.ts#settingsStore stored version 3"
        status: pass
    human_judgment: false
  - id: D3
    description: "Version-1 settings files still load (now with no products) and Descargar ajustes still writes file version 1 with the four Phase 3 fields"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#golden settings file of version 1 (published contract, D-07)"
        status: pass
      - kind: integration
        ref: "src/features/categories/BackupControls.test.tsx#keeps the file at version 1 with the four Phase 3 fields when the store holds products"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 03: Settings version 3 with products and «No agrupar» marks Summary

**Persisted settings grow to version 3 (products and «No agrupar» marks) with a total, safeParse-only migration from version 2, product integrity rules and limits, and the store, hook and backup controls carrying six fields while the backup file stays at version 1.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-20T00:55:54Z
- **Completed:** 2026-10-20T01:04:18Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- The stored contract is now `invoicechecker:settings` version 3: `Product` (stable id, unique name, optional category, members), `ProductMember` (rfc, key, description, supplierName) and `UngroupedConcept` marks. Version 2 values keep every Phase 3 field and gain empty lists; a malformed version-2 value gives the suggestions and never throws.
- `productIntegrityIssues` enforces: unique product ids that are never `sin-categoria`, names unique ignoring case and edge spaces and never «Sin categoría», a category that is null or existing, no product without members, a member in at most one product, at most 5,000 members in total, and marks that are unique and never a member. Caps: 2,000 products, 5,000 marks, 60-character names.
- The Phase 3 shape is frozen as `SettingsDataV2` / `settingsDataSchemaV2` (read by the version-2 migration branch); the published backup file version 1 is untouched: the golden file still loads (now with empty products), and `buildBackupText` still writes only the four Phase 3 fields.
- The store (`dataOf`, `partialize`, `replaceAll`), `useCategorySettings` and `BackupControls` carry the six fields; `tests/support/settingsStorage.ts` writes the current version with `storeSettings` and version 2 with `storeSettingsV2`.

## Task Commits

TDD task 1 produced RED and GREEN commits (no refactor needed):

1. **Task 1 RED: failing tests for migration, integrity and limits** - `6f6d48b` (test)
2. **Task 1 GREEN: settings version 3, integrity rules, total migration, backup types** - `1594e9b` (feat)
3. **Task 2: store, hook, backup controls and test helpers carry six fields** - `2e4c762` (feat)

**Plan metadata:** docs commit with this SUMMARY (see git log).

## TDD Gate Compliance

- **RED:** `src/domain/settings/settings.test.ts` (migration, 14 integrity breaches, limits) and `backup.test.ts` (golden file has no products). Run before implementation: 26 tests failed, each on the planned assertion (`status` "ok" instead of "unreadable", `productIntegrityIssues is not a function`, missing `products` field), none on syntax, import or fixture errors. The repository's `check tdd-red-evidence` classifier was not run (the `gsd_run` verb is not available in this worktree shell); the semantic assessment was done by reading the vitest output.
- **GREEN:** `1594e9b`, all 178 tests of `src/domain/settings` pass.
- **REFACTOR:** none needed.

## Files Created/Modified

- `src/domain/settings/types.ts` - ProductMember, Product, UngroupedConcept, SettingsDataV2, SettingsData (six fields), SETTINGS_VERSION 3, new LIMITS, defaultSettings with two empty lists
- `src/domain/settings/schema.ts` - exported comparableName, productIntegrityIssues, frozen settingsDataSchemaV2, six-field settingsDataSchema, settingsIntegrityIssues typed for SettingsDataV2
- `src/domain/settings/migrate.ts` - version 2 branch (safeParse of the frozen schema, adds empty lists, status migrated)
- `src/domain/settings/backup.ts` - types only: fromBackupFile1 returns SettingsDataV2, parseBackupText adds empty lists, writer unchanged at file version 1
- `src/stores/settingsStore.ts` - six fields in dataOf, partialize, replaceAll; header documents version 3
- `src/features/categories/useCategorySettings.ts` - products and ungroupedConcepts selectors in the memo
- `src/features/categories/BackupControls.tsx` - passes the six-field state to buildBackupText
- `tests/support/settingsStorage.ts` - storeSettings writes SETTINGS_VERSION, new storeSettingsV2
- Tests: `settings.test.ts`, `backup.test.ts`, `settingsStore.test.ts`, `BackupControls.test.tsx`
- Outside the plan's file list (see Deviations): `src/features/categories/CategoriesTab.test.tsx`, `src/features/dashboard/DashboardTab.test.tsx`

## Decisions Made

- «No agrupar» marks are also required to be unique by rfc plus key (the RESEARCH integrity list says so; the plan truths named only "marks a description that is a member").
- `buildBackupText` keeps accepting the six-field `SettingsData` (as the plan says BackupControls passes the full state) and writes only the four Phase 3 fields; products and marks are not in the file until file version 2 (Plan 04-10). A consequence the user may want to know: a confirmed upload of a version-1 file empties the accepted products and marks, because that file cannot carry them.
- Product names reuse the category rule exactly (`trim`, 1 to 60 characters, unique by `comparableName`, not «Sin categoría»).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Version expectation in two tests outside the plan's file list**
- **Found during:** Task 2 (full `vitest run`)
- **Issue:** `CategoriesTab.test.tsx` (2 assertions) and `DashboardTab.test.tsx` (3 assertions) assert the stored envelope with `version: 2`; the store now writes version 3, so 5 tests failed. The plan expected only `SettingsData` literal errors outside its files, but this is the same kind of knock-on.
- **Fix:** changed the five expected values from `version: 2` to `version: 3` (and one test title); what the tests assert is otherwise unchanged.
- **Files modified:** `src/features/categories/CategoriesTab.test.tsx`, `src/features/dashboard/DashboardTab.test.tsx`
- **Verification:** `pnpm exec vitest run` 71 files passed
- **Committed in:** `2e4c762`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** test expectations only; no behavior beyond the plan.

## Issues Encountered

- `pnpm eslint` reports one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive); it is not in this plan's files and was left alone.
- `tsc --noEmit` alone reports `LayoutProps` not found in `src/app/layout.tsx` until `next typegen` runs; `pnpm typecheck` (typegen plus tsc) is clean.

## Hand-off for later plans

- Deleting a category does not yet move or clear `products[].categoryId` (the RESEARCH "Delete-category ripple": `deleteCategory`, `DeleteSnapshot`, `restoreCategory`, usage counts). No product can exist before Plan 04-05 writes the first one, but that plan or the CAT-05 ripple must handle it, otherwise the "category exists" integrity rule fails on the next load.
- `AppShell.test.tsx` still writes `{ version: 2, state: defaultSettings() }` in two tests; they pass through the version-2 branch (extra keys stripped) and still assert what they meant to.

## Known Stubs

None.

## Threat Flags

None. Mitigations T-04-13 (integrity rules and caps, tests for every breach), T-04-14 (safeParse only in the version-2 branch, malformed version-2 tests) and T-04-15 (lists of entries and Set lookups, `__proto__` round-trip tests in domain and store) are implemented and tested.

## Verification

- `pnpm exec vitest run src/domain/settings src/stores src/features/categories`: passed
- `pnpm exec vitest run` (full): 71 files passed, 5 skipped, 1770 tests passed
- `pnpm typecheck`, `pnpm lint` (0 errors, 1 pre-existing warning), `pnpm verify` (lint, typecheck, test, build): passed
- Acceptance greps: `SETTINGS_VERSION = 3;` present, `settingsDataSchemaV2` in migrate.ts, `productIntegrityIssues` 3 times in schema.ts, `products: 2000` and `productMembers: 5000` in types.ts, golden file untouched, no `@/(lib|stores|features|components)` import in `src/domain/settings`, `ungroupedConcepts` 5 times in the store, `storeSettingsV2` present, `ungroupedConcepts` 3 times in the hook

## Next Phase Readiness

Plan 04-05 can write the first accepted product against a proven version-3 contract. Plan 04-10 adds backup file version 2 beside `fromBackupFile1`.

## Self-Check: PASSED

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-20*
