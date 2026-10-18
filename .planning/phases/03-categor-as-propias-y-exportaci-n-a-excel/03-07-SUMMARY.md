---
phase: 03-categor-as-propias-y-exportaci-n-a-excel
plan: 07
subsystem: settings-backup
tags: [zod, zustand, json-contract, alertdialog, blob-download, tdd]

requires:
  - phase: 03-categor-as-propias-y-exportaci-n-a-excel
    provides: "settingsDataSchema, LIMITS, settings store v2, storage status store, CategoriesTab (plans 03-01 to 03-06)"
provides:
  - "Settings file contract version 1 (backup.ts) with the four rejection reasons and a golden fixture"
  - "settingsIntegrityIssues shared by the stored schema and the file schema"
  - "Store action replaceAll (one write)"
  - "downloadBlob helper (reused by the Excel export in Plan 03-13)"
  - "BackupControls and BackupErrorAlert in the Categorias title row"
affects: [03-13, phase-04-grouped-products]

actuals:
  tokens: 22000
  tasks: 2
  commits: 4
plan_head_before: 9f912dee7165311dc55cdfe3f88649bb83b5de14
plan_head_after: 29f42fe0944658dc0e42e206a93ec3ee571a2442

tech-stack:
  added: []
  patterns:
    - "Published file contract: header check, then newer-version check, then frozen version-N schema plus fromBackupFileN converter"
    - "Hidden file input reset right after taking the file; size checked on file.size before file.text()"
    - "Dialog keeps its pending data in separate state from the open flag so it keeps its text while fading out"

key-files:
  created:
    - src/domain/settings/backup.ts
    - src/domain/settings/backup.test.ts
    - tests/fixtures/settings/ajustes-archivo-1.json
    - src/lib/client/download.ts
    - src/lib/client/download.test.ts
    - src/features/categories/BackupControls.tsx
    - src/features/categories/BackupControls.test.tsx
  modified:
    - src/domain/settings/schema.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/features/categories/CategoriesTab.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "File envelope written exactly as recorded in 03-01-SUMMARY (option-a): { app: invoicechecker-settings, version: 1, settings: { ivaMode, categories:[{id,name}], supplierCategories:[{rfc,name,categoryId}], conceptRules:[{rfc,key,description,categoryId|null}] } }"
  - "A file that cannot be read by file.text() is reported as «está dañado o incompleto» (plan left the mapping of read failures to discretion)"
  - "JSON that fails to parse is «dañado» when the raw text contains the app marker, otherwise «no es un archivo de ajustes de InvoiceChecker»"
  - "fromBackupFile1 and the BackupFile1 type are exported so a future fromBackupFile2 sits beside them"
  - "AlertDialog dismisses with Esc and the dismiss button only (Base UI behavior kept, user decision 2026-10-17)"

patterns-established:
  - "Settings file schema declared separately from settingsDataSchema; only the pure integrity function is shared"

requirements-completed: [AJUS-02]

coverage:
  - id: D1
    description: "Descargar ajustes downloads invoicechecker-ajustes-AAAA-MM-DD.json (local date) with the version-1 envelope and shows «Ajustes descargados: {nombre}»"
    requirement: AJUS-02
    verification:
      - kind: unit
        ref: "src/features/categories/BackupControls.test.tsx#BackupControls: download (D-07)"
        status: pass
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#buildBackupText and parseBackupText round trip"
        status: pass
    human_judgment: false
  - id: D2
    description: "A valid file opens the replace dialog (summary, focus on Conservar los mios); confirming replaces all settings in one write and updates the IVA control; dismissing or Esc changes nothing; focus returns to Subir ajustes"
    requirement: AJUS-02
    verification:
      - kind: integration
        ref: "src/features/categories/BackupControls.test.tsx#BackupControls: upload of a valid file (D-08)"
        status: pass
      - kind: integration
        ref: "src/features/categories/BackupControls.test.tsx#Categorías tab with the backup controls (AJUS-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Invalid files (too large, not InvoiceChecker, newer, damaged) show the Alert with the right reason and never open the dialog or touch the settings; oversize is refused before file.text()"
    requirement: AJUS-02
    verification:
      - kind: unit
        ref: "src/domain/settings/backup.test.ts and src/features/categories/BackupControls.test.tsx#BackupControls: invalid files (D-08, D-30)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Golden version-1 file keeps loading in every later build"
    verification:
      - kind: unit
        ref: "src/domain/settings/backup.test.ts#golden settings file of version 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "Title row layout, 44 px touch targets below 640 px, destructive-colored icon in the Alert, wrapping of long names"
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout engine; only classes are asserted. The real rendering (including the icon color against the Alert's svg rule) needs a look in a browser, and a real file pick/download in a browser was not exercised"

duration: 55min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 07: Settings backup and restore Summary

**Versioned settings file (version 1, golden fixture, four rejection reasons) with atomic `replaceAll`, plus «Descargar ajustes» / «Subir ajustes» in Categorías with the replace confirmation and the invalid-file Alert.**

## Performance

- **Duration:** about 55 min, including a pause for an API session limit before the coordinator resumed the run
- **Tasks:** 2 (both TDD)
- **Files:** 7 created, 7 modified

## Accomplishments

- `src/domain/settings/backup.ts`: `buildBackupText`, `backupFileName`, `checkBackupSize` and `parseBackupText`. Reading order: JSON, header (`app` + integer `version >= 1`), newer-version check, then the frozen version-1 schema (D-30 limits plus integrity) and `fromBackupFile1`. Every failure maps to `not-invoicechecker`, `damaged`, `newer` or `too-large`. Header comment states that the file is a published contract.
- `settingsIntegrityIssues(data)` extracted from `settingsDataSchema`'s `superRefine`; both schemas use it. `settingsDataSchema` behavior is unchanged and its existing tests pass.
- Golden fixture `tests/fixtures/settings/ajustes-archivo-1.json`, written by hand with only the public SAT RFCs and invented names.
- Store `replaceAll(data)`: one `set`, one write; the stored envelope equals `{ state: data, version: 2 }`.
- `downloadBlob` (temporary anchor, URL revoked after 1,000 ms).
- `BackupControls`: download builds the Blob from the store and today's local date; upload checks `file.size` before `file.text()`, resets the input at once, opens the replace `AlertDialog` (initial focus on «Conservar los míos», final focus on «Subir ajustes») and applies `replaceAll` only after «Reemplazar mis ajustes». `BackupErrorAlert` shows the four reasons with a destructive `CircleAlert` icon, foreground text, `break-words` and the «Cerrar aviso» button. Both are wired into `CategoriesTab` (buttons in the title row, Alert right below it).
- Copy: `es.categories.backup.*` and messages `settingsDownloadedToast`, `backupReasonText`, `invalidFileText`, `replaceSummaryText` (always three parts, singular forms, «0 …»), `replaceSettingsBody`.

## Task Commits

1. **Task 1 RED:** `b7ab337` (test) - file contract, replaceAll and golden fixture tests with a skeleton
2. **Task 1 GREEN:** `df21ea3` (feat) - backup.ts, shared integrity function, `replaceAll`
3. **Task 2 RED:** `5817622` (test) - download, messages and BackupControls tests with skeletons and copy
4. **Task 2 GREEN:** `29f42fe` (feat) - `downloadBlob`, messages, `BackupControls`, tab wiring

**Plan metadata:** the docs commit that adds this file.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | b7ab337: 24 tests failed on the planned assertions (empty text, wrong reason, store unchanged) against the skeleton | df21ea3 |
| 2 | 5817622: 32 tests failed on the planned assertions (missing buttons, empty strings, no download) against the skeletons | 29f42fe |

RED evidence was inspected semantically: failures were assertion failures on the planned behavior, not syntax or import errors. `gsd_run check tdd-red-evidence` was not run because it needs a TAP or JUnit report and the project uses Vitest's default reporter (same as plan 03-06). No REFACTOR commits.

## Decisions Made

See `key-decisions`. No new door was opened beyond the format the user chose in 03-01 Task 2.

## Deviations from Plan

None - plan executed exactly as written. Two points the plan left to discretion were settled as listed under key-decisions (read failure of `file.text()` and JSON parse failures). A test-only correction: the shell has its own XML file inputs, so the BackupControls tests select the settings input by its `accept` value.

## Issues Encountered

None blocking. `pnpm verify` passes (lint, typecheck, 1285 tests passed and 8 skipped, build). `pnpm lint` reports one pre-existing warning (unused eslint-disable in `src/lib/client/navigation.ts`, untouched here). The run was interrupted once by an API session limit and resumed by the coordinator; the worktree state was intact.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-03-15 (hostile file): header, newer check, frozen schema with limits and integrity, list entries, nothing applied before confirm, tests per reason and a `__proto__` case. T-03-16 (oversize): `checkBackupSize` before `file.text()`, with a test that `text()` is not called. T-03-17 (accidental replace): dialog with summary, default focus on the dismiss button, destructive confirm last. T-03-18 (leak): `buildBackupText` writes only the contract fields (key-set tests); no request API appears in the settings code (grep clean) and tests assert `fetch` is never called.

## Next Phase Readiness

`downloadBlob` is ready for the Excel export (Plan 03-13). Version 2 of the file should add `fromBackupFile2` beside `fromBackupFile1` and keep reading version 1. A real-browser check of the file picker, the downloaded file and the Alert icon color is still pending (D5).

## Self-Check: PASSED

- Created files exist: backup.ts, backup.test.ts, ajustes-archivo-1.json, download.ts, download.test.ts, BackupControls.tsx, BackupControls.test.tsx.
- Commits b7ab337, df21ea3, 5817622, 29f42fe are ancestors of HEAD.
- Acceptance greps: `accept=".json,application/json"` x1, `checkBackupSize` x2, `revokeObjectURL` x1, «Reemplazar mis ajustes» x1 and «es de una versión más nueva de la app» x1 in es.ts, `fromBackupFile1` x3, `replaceAll` x2 in the store, no `fetch(`/XMLHttpRequest/sendBeacon in the settings code; `pnpm verify` exits 0.
