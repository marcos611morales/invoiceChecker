---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 10
subsystem: settings
tags: [zod, backup-contract, settings-file, products, copy, localStorage-free]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-03)
    provides: settings model version 3 (products, marks), productIntegrityIssues, frozen backup file version 1
  - phase: 04-agrupaci-n-de-productos-con-deepseek (plan 04-09)
    provides: product-aware usage counts and the delete dialog copy
provides:
  - "Settings file contract version 2 (six fields: IVA mode, categories, supplier assignments, concept rules, products, «No agrupar» marks) next to the frozen version 1"
  - "backupFile2Schema (internal), BackupFile2, fromBackupFile2, writer at version 2 by explicit field picks"
  - "BackupSummary with products and members; five-part replaceSummaryText"
  - "LIMITS.backupBytes 4194304 and «máx. 4 MB» copy (D-31)"
  - "Golden file tests/fixtures/settings/ajustes-archivo-2.json"
affects: [04-11 pending suggestions queue (own storage key, not in the file), 04-12 and later phases that read settings files]

actuals:
  tokens: 19000
  tasks: 2
  commits: 3
plan_head_before: 75bc0613674954a3a9fdccb3ae84b6e1c8fdb2ab
plan_head_after: d91245b360917b2734da289f298cd0bb4b345ef3

tech-stack:
  added: []
  patterns:
    - "One schema and one converter per published file version, declared in backup.ts, never edited after publication; parseBackupText branches on the header version"
    - "Summary counts computed from the converted settings by one helper (summaryOf), so both file versions report the same five numbers"

key-files:
  created:
    - tests/fixtures/settings/ajustes-archivo-2.json
  modified:
    - src/domain/settings/types.ts
    - src/domain/settings/backup.ts
    - src/domain/settings/backup.test.ts
    - src/domain/settings/settings.test.ts
    - src/features/categories/BackupControls.tsx
    - src/features/categories/BackupControls.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "Download writes file version 2 for every user, including those with no products (the file then carries empty products and marks lists); an older build refuses it as newer, which is the published version-1 contract"
  - "Version 2 requires the products and ungroupedConcepts fields: a version-2 file without them is damaged, not read as empty"
  - "BackupSummary.members is the sum of the members of all products (descriptions grouped), not the marks"
  - "The 4 MB size test covers the product limits only (2,000 products, 5,000 members, 5,000 marks, 9 categories, 39 assignments); a value that also fills the 20,000 concept-rule cap is not covered by the plan's bound"

patterns-established:
  - "Pending suggestions are never written: buildBackupText picks fields one by one, and a test with noisy objects asserts extra fields never reach the file (T-04-24)"

requirements-completed: [LLM-04]

coverage:
  - id: D1
    description: "«Descargar ajustes» writes {app, version: 2, settings} with the six fields; reading the file back gives equal settings including products, members and marks"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#buildBackupText and parseBackupText round trip"
        status: pass
      - kind: integration
        ref: "src/features/categories/BackupControls.test.tsx#writes file version 2 with the six fields, products and marks included, when the store holds products (D-13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uploading a version-2 file replaces products and marks in the store after confirmation, and the dialog counts them"
    requirement: LLM-04
    verification:
      - kind: integration
        ref: "src/features/categories/BackupControls.test.tsx#loads a version-2 file with its products and marks and counts them in the dialog (D-13)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Version-1 files, including the golden ajustes-archivo-1.json, still load with no products and no marks; version 3 and higher is refused as newer"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#golden settings file of version 1 (published contract, D-07)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#parseBackupText: newer version"
        status: pass
    human_judgment: false
  - id: D4
    description: "A version-2 file that breaks a product rule or a limit is refused as damaged and changes nothing"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#parseBackupText: version-2 files that break a rule are damaged"
        status: pass
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#parseBackupText: version-2 limits (D-13, T-04-22)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Files up to 4,194,304 bytes are read, larger ones are refused unread with «es demasiado grande (máx. 4 MB)», and a value at the product limits serializes under that size"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#checkBackupSize (T-03-16)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#a settings value at the product limits with sample-sized texts fits under the 4 MB gate (D-31)"
        status: pass
      - kind: integration
        ref: "src/features/categories/BackupControls.test.tsx#refuses a file above 4 MB (4,194,305 bytes) without reading it (D-31)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The replace dialog always lists five parts («… 5 productos (14 descripciones)», «0 productos (0 descripciones)» for a version-1 file) and says the productos agrupados are replaced too"
    requirement: LLM-04
    verification:
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#lists the five parts of the summary, plurals included (UI-SPEC 346)"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#builds the replace body from the UI-SPEC sentence, products included (UI-SPEC 347)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 10: Settings file version 2 with products and marks Summary

**Settings file version 2 (accepted products and «No agrupar» marks) written by explicit field picks and read next to the frozen version 1, with the 4 MB gate and a replace dialog that counts «N productos (M descripciones)».**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-21T21:49:00Z (approx.)
- **Completed:** 2026-10-21T21:55:43Z
- **Tasks:** 2
- **Files modified:** 10 (9 modified, 1 created)

## Accomplishments

- `buildBackupText` writes `{ app, version: 2, settings }` with six fields; products carry id, name, categoryId and members (rfc, key, description, supplierName); marks carry the same four text fields. Nothing else of the objects reaches the file (round-trip test with noisy objects).
- `backupFile2Schema` is declared beside the untouched version-1 schema with the `LIMITS` caps and `settingsIntegrityIssues` plus `productIntegrityIssues`; `parseBackupText` keeps its order (JSON, header, newer, body) and branches on header version 1 or 2. Version 3 and up is «newer».
- Both golden files load: `ajustes-archivo-1.json` (byte-identical to before) with no products and `ajustes-archivo-2.json` (new, public RFCs only, synthetic names) with two products, three members and one mark.
- `LIMITS.backupBytes` is 4,194,304. A settings value with 2,000 products, 5,000 members, 5,000 marks, 9 categories and 39 assignments with sample-sized texts serializes under it and parses back.
- Copy: `tooLarge` reads «es demasiado grande (máx. 4 MB)»; `replaceSummaryText` always lists five parts; `replaceSettingsBody` mentions «los productos agrupados» (UI-SPEC 346-347).

## Task Commits

1. **Task 1 RED: failing tests for version 2, golden file and 4 MB limit** - `c7f2424` (test)
2. **Task 1 GREEN: settings file version 2 with products and marks, 4 MB limit** - `c36f1ae` (feat)
3. **Task 2: «máx. 4 MB» and a replace dialog that counts products** - `d91245b` (feat)

**Plan metadata:** docs commit with this SUMMARY (see git log).

## TDD Gate Compliance

- **RED (`c7f2424`):** `backup.test.ts` ran with 29 of 58 tests failing, each on the planned assertion: file version `1` instead of `2`, summary missing `products`/`members`, a version-2 file answered `newer`, `LIMITS.backupBytes` `1048576` instead of `4194304`, products missing from the written settings. No syntax, import, fixture or zero-test failure. The `gsd_run check tdd-red-evidence` verb is not available in this shell, so the semantic assessment was done by reading the vitest output (same as Plan 04-03).
- **GREEN (`c36f1ae`):** all 278 tests of `src/domain/settings` plus the fixtures guard pass.
- **REFACTOR:** none needed.
- Task 2 is not marked `tdd="true"` in the plan; its tests were updated together with its code in one commit.

## Files Created/Modified

- `src/domain/settings/backup.ts` - file version 2: header comment, writer, `backupFile2Schema`, `BackupFile2`, `fromBackupFile2`, `summaryOf`, branch in `parseBackupText`
- `src/domain/settings/types.ts` - `LIMITS.backupBytes` 4194304
- `tests/fixtures/settings/ajustes-archivo-2.json` - golden file of version 2
- `src/domain/settings/backup.test.ts`, `settings.test.ts` - version 2 behavior; the limits constant expectation
- `src/features/categories/BackupControls.tsx` - comment only; the size check before reading and the summary line already flowed through `parseBackupText` and `replaceSummaryText`
- `src/features/categories/BackupControls.test.tsx` - 4 MB refusal, exact-4-MB read, version-2 and version-1 dialogs, version-3 refusal, written file at version 2
- `src/lib/copy/es.ts`, `messages.ts`, `messages.test.ts` - 4 MB reason, five-part summary, updated body

## Decisions Made

- The writer always emits version 2, so a user with no products also downloads a version-2 file (empty lists). This follows the plan ("«Descargar ajustes» writes version 2"); the visible consequence is that an older build of the app refuses these files as «de una versión más nueva».
- A version-2 file must carry both `products` and `ungroupedConcepts`; a missing one is «damaged» rather than treated as empty.
- `BackupSummary.members` counts descriptions grouped in products (sum of product members), matching «5 productos (14 descripciones)».

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing test asserting the old limit, outside the plan's file list**
- **Found during:** Task 1 (GREEN run of `src/domain/settings`)
- **Issue:** `src/domain/settings/settings.test.ts` asserts `LIMITS.backupBytes` is 1048576; the plan raises it to 4194304.
- **Fix:** changed the expected value to 4194304.
- **Files modified:** `src/domain/settings/settings.test.ts`
- **Verification:** `pnpm exec vitest run src/domain/settings` passed
- **Committed in:** `c36f1ae`

**2. [Rule 3 - Blocking] `BackupSummary` literals in `messages.test.ts` failed `pnpm typecheck` after Task 1**
- **Found during:** Task 1 (`pnpm typecheck`, required by the task's verify)
- **Issue:** three `replaceSummaryText({ categories, suppliers, concepts })` calls lacked the new `products` and `members` fields.
- **Fix:** added `products: 0, members: 0` to those literals in the Task 1 commit (the text assertions were rewritten in Task 2).
- **Files modified:** `src/lib/copy/messages.test.ts`
- **Verification:** `pnpm typecheck` clean
- **Committed in:** `c36f1ae`

---

**Total deviations:** 2 auto-fixed (2 blocking, both test-only knock-ons)
**Impact on plan:** none on behavior.

## Issues Encountered

- Between the Task 1 GREEN commit and the Task 2 commit, three `BackupControls.test.tsx` tests failed (a version-2 file no longer reads as «newer», the 1 MB limit), as expected: Task 2 owns those tests. `pnpm verify` passes after Task 2.
- Pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive) left alone, as in Plan 04-03.

## Items for the user to know (no decision blocks the plan)

- A file written by this build is refused by builds that only know version 1 («es de una versión más nueva de la app»). That is the contract chosen in Phase 3; no action needed unless two deployed versions must exchange files.
- The 4 MB bound was verified for the product limits only. A settings value that also fills the 20,000 concept-rule cap would be larger than the plan's reference value; the plan did not set that case.

## Known Stubs

None.

## Threat Flags

None. T-04-22 (size gate before reading, `backupFile2Schema` with `LIMITS` caps and both integrity rule sets, nothing applied before confirmation) and T-04-24 (explicit picks, round-trip assertion that the settings object has exactly the six fields) are implemented and tested. T-04-23 accepted as planned; T-04-SC: nothing installed (`pnpm install --frozen-lockfile` only).

## Verification

- `pnpm exec vitest run src/domain/settings tests/fixtures.guard.test.ts`: passed
- `pnpm exec vitest run src/features/categories src/lib`: 12 files, 344 tests passed
- `pnpm verify` (lint 0 errors and 1 pre-existing warning, typecheck, 81 test files with 2142 tests, build): passed
- Acceptance greps: `BACKUP_FILE_VERSION = 2;` present, `backupBytes: 4194304` present, `ajustes-archivo-1.json` unchanged against the base commit, `"version": 2` in the new golden file, `máx. 4 MB` in `es.ts`, no `máx. 1 MB` in `src`, `productos agrupados` in `messages.ts`

## Next Phase Readiness

Accepted products and marks travel between browsers. Plan 04-11 keeps pending suggestions under their own storage key; they are not in the settings file.

## Self-Check: PASSED

- Files: `src/domain/settings/backup.ts`, `tests/fixtures/settings/ajustes-archivo-2.json`, this SUMMARY found on disk
- Commits `c7f2424`, `c36f1ae`, `d91245b` are ancestors of HEAD

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-21*
