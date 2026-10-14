---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 12
subsystem: ui
tags: [sonner, toast, progress, zustand, import, nextjs]
requires:
  - phase: 01-11
    provides: ImportCountsPanel, sessionStore generation/progress/applyBatch, batchToastText/processingText
  - phase: 01-09
    provides: shadcn Spinner and Card
provides:
  - AppToaster (Sonner bound to the app theme) rendered once in the root layout
  - useImport hook (generation-checked ingest into the store, progress, batch toast, error toast)
  - ProcessingIndicator (reading spinner, "Procesando N de M" with 8 px progress bar)
  - shadcn sonner (theme via prop) and progress (h-2 track)
affects: [01-13]
tech-stack:
  added: [sonner ^2.0.8]
  patterns: [theme passed by prop instead of next-themes, import logic extracted into a hook]
key-files:
  created:
    - src/components/ui/sonner.tsx
    - src/components/AppToaster.tsx
    - src/components/ui/progress.tsx
    - src/features/upload/ProcessingIndicator.tsx
    - src/features/upload/useImport.ts
    - src/features/upload/useImport.test.tsx
  modified:
    - src/app/layout.tsx
    - src/features/upload/ImportCountsPanel.tsx
    - package.json
    - pnpm-lock.yaml
key-decisions:
  - "Toaster style typed as CSSProperties & Record<`--${string}`, string> to avoid the cast that shadcn generates"
  - "Stale-generation batches show no toast (neither success nor error)"
patterns-established:
  - "useImport().run(files) is the single entry point for imports; Plan 01-13 reuses it"
requirements-completed: [CARGA-05]
duration: 15min
completed: 2026-10-14
status: complete
commits: 2
plan_head_before: e559928554ff1151ee0718496a0c19a76dc5aca6
plan_head_after: ec11a75abb5e4600afc1e17ff9b674fc24ba883f
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
---

# Phase 1 Plan 12: Progreso de importación y toasts Summary

**Sonner toasts themed by the app's own theme engine (no next-themes), plus a `useImport` hook and a reading/processing indicator with an 8 px progress bar.**

## Tasks

1. **Task 1 - Themed toasts (c81b9dc).** `shadcn add sonner`, removed the `next-themes` import and the package; `Toaster` takes `theme: "light" | "dark"`. `AppToaster` uses `useActiveTheme`, bottom-right, 6000 ms, close button; rendered once in `layout.tsx`.
2. **Task 2 - Indicator, hook, panel (ec11a75).** `shadcn add progress` with the track set to `h-2`. `useImport` ignores calls while progress is not idle, captures the generation, sets `listing`, forwards `onProgress` as `parsing`, applies the batch and fires `toast(batchToastText(summary))`; on a thrown error it fires `toast.error(es.errors.importFailed)`; progress always returns to idle (guarded by the generation). `ProcessingIndicator` shows Spinner + "Leyendo archivos…" or "Procesando N de M" (aria-live polite, aria-atomic) above the Progress (`aria-label` "Progreso de importación"). `ImportCountsPanel` uses both and no longer shows the inline summary line.

## Verification

- `pnpm verify` (eslint, typecheck, vitest 164 passed, build): OK.
- `pnpm smoke:auth`: "smoke-auth: OK (14 checks)".
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `grep next-themes` in `package.json` and `src`: no matches.
- Pending manual check (needs a real browser): toast appearance in light/dark and progress timing with Facturas/2025.

## Deviations from Plan

### Auto-added

**1. [Rule 2 - Missing critical functionality] Tests for useImport**
- **Found during:** Task 2
- **Issue:** The plan listed no tests for the hook, but it carries the Pitfall 12 stale-generation and busy-guard behavior.
- **Fix:** Added `src/features/upload/useImport.test.tsx` (batch toast, error toast, busy guard, stale generation).
- **Files modified:** src/features/upload/useImport.test.tsx
- **Commit:** ec11a75

**2. [Note] sonner was not yet in package.json**
- The plan says sonner was approved at the Plan 01-01 gate, but it was not installed; it was added now by `shadcn add sonner` (version `^2.0.8`, as pre-approved by the user in the dispatch message).

None of the other plan content changed.

## Known Stubs

None. `ImportCountsPanel` remains the interim panel that Plan 01-13 replaces (as planned).

## Threat Flags

None.

## Self-Check: PASSED

- All created files exist; commits c81b9dc and ec11a75 are ancestors of HEAD.
