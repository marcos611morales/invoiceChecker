---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 13
subsystem: ui
tags: [react-dropzone, alert-dialog, beforeunload, zustand, nextjs]
requires:
  - phase: 01-12
    provides: useImport, ProcessingIndicator, sessionStore generation/progress/clearAll
  - phase: 01-10
    provides: ImportReport, hasReport
  - phase: 01-07
    provides: TopBar, LogoutButton, logout()
provides:
  - UploadRoot (react-dropzone root over the whole app, folder input, window overlay) and useUpload()
  - EmptyDropzone (empty-screen card with both pickers, privacy line and reload note)
  - AppShell() recomposed (Agregar facturas in the top bar, footer caption, beforeunload guard)
  - LogoutButton with "¿Cerrar sesión?" confirmation that clears memory before logout
  - useBeforeUnload (native prompt only while invoices are loaded)
affects: [01-14]
tech-stack:
  added: []
  patterns:
    - "Hidden folder input held in state through a callback ref (react-hooks/refs forbids reading a ref object while building context)"
    - "Dropzone root is the min-h-dvh app wrapper; window-wide drop works without custom listeners"
key-files:
  created:
    - src/features/upload/UploadRoot.tsx
    - src/features/upload/EmptyDropzone.tsx
    - src/features/upload/UploadRoot.test.tsx
    - src/features/shell/useBeforeUnload.ts
    - src/features/shell/guards.test.tsx
  modified:
    - src/features/shell/AppShell.tsx
    - src/features/shell/LogoutButton.tsx
    - src/app/page.tsx
  deleted:
    - src/features/upload/ImportCountsPanel.tsx
key-decisions:
  - "Empty screen vs loaded screen keys on hasReport; dialogs and unload guard key on invoices.length > 0 (as D-07 says)"
  - "Neither picker nor the dropzone sets any file-type filter, so PDFs and ZIPs reach the ignored list"
patterns-established:
  - "useUpload() context is the way buttons open the pickers; AppShell.AddInvoicesButton and EmptyDropzone use it"
requirements-completed: [CARGA-01, CARGA-06, ACC-02]
duration: 25min
completed: 2026-10-14
status: complete
commits: 3
plan_head_before: 8a01c3f12b594688d135d5926ce864fced2cb28a
plan_head_after: df497d92fa49e9ee8c922531c0a40c8953af989a
actuals:
  tokens: 14000
  tasks: 2
  commits: 3
---

# Phase 1 Plan 13: Upload root, empty dropzone and loss guards Summary

Drop files or folders anywhere in the window (react-dropzone root, no type filter), the approved empty-screen dropzone card, "Agregar facturas" plus window overlay once loaded, a logout confirmation that wipes memory before leaving, and a beforeunload prompt only while invoices are loaded.

## Tasks

| Task | Name | Commit | Notes |
| ---- | ---- | ------ | ----- |
| 1 | Drop anywhere, folder picker, window overlay, empty dropzone card | 36bd6dd | UploadRoot, EmptyDropzone, AppShell(), page.tsx; ImportCountsPanel deleted |
| 2 (RED) | Failing guard tests | 4cf63fe | guards.test.tsx plus a no-op useBeforeUnload stub |
| 2 (GREEN) | Logout confirmation and beforeunload guard | df497d9 | LogoutButton, useBeforeUnload, AppShell wiring |

## Verification

- `pnpm verify` (lint, typecheck, vitest, build): passes. Lint prints one pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), not touched by this plan.
- `pnpm smoke:auth`: `smoke-auth: OK (14 checks)`.
- `pnpm exec vitest run src/features/shell`: 9 tests pass. `src/features/upload`: 10 tests pass.
- Acceptance greps: ImportCountsPanel gone, `noClick: true` and `webkitdirectory` present, no `accept` in UploadRoot, no `dangerouslySetInnerHTML` in `src/features`, no (01-13) commit touches package.json or pnpm-lock.yaml.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Folder input stored in state instead of a ref object**
- **Found during:** Task 1 lint
- **Issue:** `react-hooks/refs` rejected the context value built with `useRef` + `.current` inside `useMemo` ("Cannot access refs during render").
- **Fix:** `useState` with a callback ref (`ref={setFolderInput}`); `openFolder` clicks the stored element.
- **Files modified:** src/features/upload/UploadRoot.tsx
- **Commit:** 36bd6dd

### Additions outside files_modified

**2. [Rule 2 - Missing critical] Added `src/features/upload/UploadRoot.test.tsx`**
- Plan listed tests only for the guards. Added a small jsdom suite for the folder picker (files passed to `run`, input reset), no `accept` on either input, disabled buttons while processing, and the overlay rules (shown on the loaded screen, not on the empty screen, not while processing). Commit 36bd6dd.

**3. [Plan reading] `AppShell` no longer takes `children`/`topBarActions`**
- Plan interface says `AppShell(): JSX.Element`; `page.tsx` renders it alone. The "Agregar facturas" button lives in `AppShell.tsx` as a small private component because it needs `useUpload()` from inside `UploadRoot`.

## Known Stubs

None. (`useBeforeUnload` was a deliberate no-op only in the RED commit 4cf63fe.)

## Notes for follow-up

- "Leyendo archivos…" is set by `useImport.run` (phase `listing`) as soon as `onDrop` fires. react-dropzone traverses dropped folders before calling `onDrop`, so that traversal time itself is not shown; for 143 files it is milliseconds. Not worth a store change here; revisit if big folders feel unresponsive.
- react-dropzone's default `noPaste: false` means pasting files into a focused dropzone child would also import them. Left at the default (not specified by the plan); say if you want it off.
- Human checks that remain (cannot be run by unit tests): real Finder folder drag-and-drop, overlay covering the viewport while scrolled, Chrome directory-picker confirmation (assumptions A1/A6), and the backstop truth about the full-viewport overlay when scrolled (overlay is `fixed inset-0`, `pointer-events-none`).

## Threat Flags

None. T-01-27 (clearAll before logout, order asserted in guards.test.tsx), T-01-28 (disabled dropzone still prevents default on document drops), T-01-29 (confirmation plus beforeunload) are mitigated as planned; T-01-SC holds (no installs).

## Self-Check: PASSED

- Files exist: UploadRoot.tsx, EmptyDropzone.tsx, UploadRoot.test.tsx, useBeforeUnload.ts, guards.test.tsx; ImportCountsPanel.tsx absent.
- Commits 36bd6dd, 4cf63fe, df497d9 are ancestors of HEAD.
