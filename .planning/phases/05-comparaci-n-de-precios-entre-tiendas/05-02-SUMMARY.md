---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 02
subsystem: settings-persistence
tags: [zod, zustand, localStorage, migration, settings-file, big.js]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "Settings version 3 (products, «No agrupar» marks) and settings file version 2"
provides:
  - "Settings model version 4: contentCorrections and priceOverrides (D-15, D-19)"
  - "Frozen settingsDataSchemaV3, priceIntegrityIssues, contentAmountIssue, pruneDanglingOverrides"
  - "Total migration of stored version 3 (and 1, 2) into version 4"
  - "Settings file version 3 (backupFile3Schema, fromBackupFile3); versions 1 and 2 still load"
  - "Persisted store, useCategorySettings hook and BackupControls carrying the eight fields"
  - "Golden file ajustes-archivo-3.json and storeSettingsV3 test helper"
affects: [05-08, 05-09, 05-10, 05-11]

actuals:
  tokens: 26800
  tasks: 3
  commits: 2
plan_head_before: f11249fd9b76c9b02957446dc009b44af08a502f
plan_head_after: 92738bc36f9aec1774dfc73bfc3dbeb573537ff3

tech-stack:
  added: []
  patterns:
    - "Copy-then-edit of frozen contract pieces: SettingsDataV3 and settingsDataSchemaV3 frozen, new version-4 pieces declared next to them"
    - "Lenient referential rule: a dangling override is dropped on read (pruneDanglingOverrides) instead of making the value or the file unreadable"
    - "Bounded decimal text validated before parsing (regex then Big), never Number"

key-files:
  created:
    - tests/fixtures/settings/ajustes-archivo-3.json
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
    - src/lib/copy/messages.test.ts

key-decisions:
  - "Task 1 decision resolved by the user: option-a, «Typed form plus lenient overrides». Correction = { rfc, key, description, supplierName, packs (integer 1..999), amount (decimal text, greater than 0, at most 6 decimals, at most 1,000,000), unit (g, kg, ml, l, piezas) }; override = { productId, comparable }. An override whose product id is not among the stored products is dropped on read and never makes the stored value or the file unreadable. Caps stay at 2,000 corrections and 2,000 overrides."
  - "productIntegrityIssues now takes SettingsDataV3 (it only reads the Phase 4 fields), so the version-2 and version-3 file schemas can call it without carrying the new fields; its behavior is unchanged."
  - "Corrections follow the member (RFC plus key) and have no referential rule: they survive the deletion of their product."

patterns-established:
  - "Dangling references that are cheap to repair are pruned on read, never refused"
  - "Every published contract keeps its own frozen schema and converter; new versions add pieces, never edit old ones"

requirements-completed: [PREC-03]

coverage:
  - id: D1
    description: "A browser with stored settings version 3 keeps every category, assignment, rule, product, member and mark, gets two empty lists and is rewritten as version 4; versions 1 and 2 still migrate"
    requirement: "PREC-03"
    verification:
      - kind: unit
        ref: "src/domain/settings/settings.test.ts#resolvePersisted from version 3 (D-15, D-19)"
        status: pass
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore stored version 3 (the Phase 4 value, D-15, D-19)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Broken stored version-4 values (repeated correction, bad packs, bad amount, bad unit, repeated override, caps) fall back to the defaults without throwing; dangling overrides are dropped"
    requirement: "PREC-03"
    verification:
      - kind: unit
        ref: "src/domain/settings/settings.test.ts#resolvePersisted version 4 corrections and overrides (D-15, D-19)"
        status: pass
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore stored version 4: corrections and «no comparable» overrides (D-15, D-19)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Settings file version 3 written with the eight fields picked one by one; golden files 1, 2 and 3 load; a damaged version-3 file is refused whole; version 4 is «newer»; summary counts corrections and overrides"
    requirement: "PREC-03"
    verification:
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#golden settings file of version 3 (published contract, D-15, D-19)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#parseBackupText: version-3 files that break a rule are damaged"
        status: pass
      - kind: unit
        ref: "src/features/categories/BackupControls.test.tsx#BackupControls: download (D-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A value at every cap (2,000 corrections and 2,000 overrides included) serializes under the 4 MB gate"
    verification:
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#parseBackupText: version-2 limits (D-13, T-04-22)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-10-26
status: complete
---

# Phase 5 Plan 02: Settings version 4 and settings file version 3 Summary

**Settings version 4 with typed content corrections and lenient «no comparable» overrides, a total migration from versions 1 to 3, settings file version 3 that still reads versions 1 and 2, and the store, hook and backup controls carrying the eight fields.**

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-10-26
- **Tasks:** 3 (Task 1 was a decision checkpoint resolved by the user: option-a)
- **Files modified:** 16 (15 modified, 1 created)

## Accomplishments

- Settings model version 4: `ContentUnit`, `ContentCorrection`, `PriceOverride`, frozen `SettingsDataV3`, `SettingsData` with `contentCorrections` and `priceOverrides`, `LIMITS` for corrections (2,000), overrides (2,000) and packs (999).
- `settingsDataSchemaV3` frozen copy; `settingsDataSchema` extended; `contentAmountIssue` (bounded regex plus exact Big comparison, never Number), `priceIntegrityIssues` (unique RFC plus key, unique product id) and `pruneDanglingOverrides`.
- `resolvePersisted` migrates stored version 3 with `safeParse` only and appends the two empty lists in the version 1, 2 and 3 branches; the current-version result passes through `pruneDanglingOverrides`.
- Settings file version 3: `backupFile3Schema` declared on its own, `fromBackupFile3` (prunes dangling overrides), `buildBackupText` picking the eight fields one by one, `BackupSummary.corrections` and `BackupSummary.overrides`. `fromBackupFile2` keeps its body and only declares `SettingsDataV3` as its return type; no line of the version-1 and version-2 schemas was removed or changed.
- Golden file `tests/fixtures/settings/ajustes-archivo-3.json` (synthetic data, two corrections, one override); golden files 1 and 2 untouched and still loading.
- Store, `useCategorySettings` and `BackupControls` carry the eight fields; `storeSettingsV3` helper added.

## Task Commits

1. **Task 1: Confirm the stored shape (decision checkpoint)** - no commit; resolved by the user as option-a, caps 2,000 / 2,000.
2. **Task 2: Settings version 4 and settings file version 3** - `a365ac2` (feat)
3. **Task 3: Store, hook and backup controls carry the eight fields** - `92738bc` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `src/domain/settings/types.ts` - version 4 model, frozen V3, new LIMITS
- `src/domain/settings/schema.ts` - frozen V3 schema, version-4 schema, price integrity, amount rule, prune
- `src/domain/settings/migrate.ts` - total migration of versions 1, 2, 3 into 4
- `src/domain/settings/backup.ts` - file contract version 3
- `src/domain/settings/settings.test.ts`, `src/domain/settings/backup.test.ts` - migration, breaches, caps, golden files, 4 MB worst case, contract-key and prohibition tests
- `tests/fixtures/settings/ajustes-archivo-3.json` - golden settings file version 3
- `src/stores/settingsStore.ts` (+ test) - eight fields in `dataOf`, `partialize`, `replaceAll`; persist version 4
- `src/features/categories/useCategorySettings.ts`, `BackupControls.tsx` (+ test) - eight fields
- `tests/support/settingsStorage.ts` - `storeSettingsV3`
- `src/features/categories/CategoriesTab.test.tsx`, `src/features/dashboard/DashboardTab.test.tsx`, `src/lib/copy/messages.test.ts` - expectations updated (see deviations)

## Decisions Made

- Option-a of the Task 1 decision (user): typed form plus lenient overrides, caps 2,000 and 2,000 unchanged. A dangling override is dropped on read (stored value and file), never a reason to refuse.
- `productIntegrityIssues` parameter type widened to `SettingsDataV3` (behavior unchanged) so the older file schemas still type-check.
- No referential rule for corrections: they follow the member and survive product deletion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests outside the plan's file list hard-coded stored version 3 and the old summary shape**
- **Found during:** Task 3 (full `pnpm verify`)
- **Issue:** `src/features/categories/CategoriesTab.test.tsx` and `src/features/dashboard/DashboardTab.test.tsx` assert the stored envelope with `version: 3`, and `src/lib/copy/messages.test.ts` builds `BackupSummary` objects without the new `corrections` and `overrides` fields (tsc error). The planning probe added fields only to `SettingsData`, so it did not see the `BackupSummary` change.
- **Fix:** Stored-version expectations changed to 4 (and one test title), and `corrections: 0, overrides: 0` added to the four `replaceSummaryText` calls. The sentence that shows the new counts stays for Plan 05-09.
- **Files modified:** src/features/categories/CategoriesTab.test.tsx, src/features/dashboard/DashboardTab.test.tsx, src/lib/copy/messages.test.ts
- **Verification:** `pnpm verify` passes (lint, typecheck, 2975 tests, build)
- **Committed in:** 92738bc

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test-only expectation updates forced by the version bump; no scope creep. Plan 05-09 will touch `messages.test.ts` again for the new sentence.

## Issues Encountered

None beyond the deviation above. `e2e/helpers.ts` still has a stale comment saying «version 3»; it uses `SETTINGS_VERSION` so behavior is correct (not touched, outside the plan).

## Known Stubs

None. The correction and override lists have no writing actions yet by design: the override actions arrive in Plan 05-08 and the correction actions in Plan 05-10.

## Threat Flags

None. No new network endpoint, auth path or file access; the new persisted lists hold no invoice amount, price, date, folio or UUID (tested by key-set assertions on the stored envelope and on the file).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 05-08 and 05-10 can write `priceOverrides` and `contentCorrections` through the existing `replaceAll` and add their own actions; `contentAmountIssue` is ready for the correction reducer and editor.
- Plan 05-09 can show `BackupSummary.corrections` and `BackupSummary.overrides` in the replace-settings sentence.
- `pnpm verify` is green on this branch (lint has one pre-existing warning in `src/lib/client/navigation.ts`).

## Self-Check: PASSED

- Created file present: `tests/fixtures/settings/ajustes-archivo-3.json`
- Commits present on this branch: `a365ac2`, `92738bc`
- Acceptance criteria of Tasks 2 and 3 re-run: all pass; `pnpm verify` exits 0.

---
*Phase: 05-comparaci-n-de-precios-entre-tiendas*
*Completed: 2026-10-26*
