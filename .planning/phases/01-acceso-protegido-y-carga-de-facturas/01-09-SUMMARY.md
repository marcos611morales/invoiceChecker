---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 09
subsystem: auth
tags: [jwt, jose, open-redirect, vitest, login-ux, shadcn-spinner, accessibility]

requires:
  - phase: 01-acceso-protegido-y-carga-de-facturas
    provides: "Plan 01-01 session.ts/safeNext.ts/logout.ts; Plan 01-06 LoginForm card with show/hide"
provides:
  - "Unit tests locking session token behavior (round-trip, rotation, tampering, alg none, missing env)"
  - "Table-driven open-redirect tests for safeNextPath"
  - "hardNavigate navigation seam (mockable) used by LoginForm and logout"
  - "LoginForm pending, error (a11y + refocus) and safe-redirect states"
  - "shadcn Spinner (reused by Plan 01-12)"
affects: [01-12, login, logout]

actuals:
  tokens: 6500
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "hardNavigate seam: all full-page navigations go through src/lib/client/navigation.ts so tests can mock it"
    - "Login error handling: focus + select the field, aria-invalid/aria-describedby, clear on typing"

key-files:
  created:
    - src/lib/server/session.test.ts
    - src/lib/safeNext.test.ts
    - src/lib/client/navigation.ts
    - src/components/ui/spinner.tsx
  modified:
    - src/app/login/LoginForm.tsx
    - src/app/login/LoginForm.test.tsx
    - src/lib/client/logout.ts

key-decisions:
  - "Spinner inside the submit button is aria-hidden; the visible text 'Entrando…' carries the semantics (the shadcn Spinner defaults to an English aria-label 'Loading')"
  - "On a successful login the form stays in the pending state until the hard navigation completes (no re-enable flash)"
  - "Logout tests live in LoginForm.test.tsx to stay inside the plan's files_modified"

patterns-established:
  - "Mock '@/lib/client/navigation' with vi.mock to assert redirects, since jsdom location cannot be spied on"

requirements-completed: [ACC-01, ACC-02]

coverage:
  - id: D1
    description: "Session token verifies under same env; fails after APP_PASSWORD/SESSION_SECRET change, tampered payload, alg none, missing env (fail closed)"
    requirement: "ACC-02"
    verification:
      - kind: unit
        ref: "src/lib/server/session.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "safeNextPath rejects all open-redirect vectors and keeps safe internal paths"
    requirement: "ACC-01"
    verification:
      - kind: unit
        ref: "src/lib/safeNext.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Login pending state: disabled button, spinner, 'Entrando…', single request"
    requirement: "ACC-01"
    verification:
      - kind: unit
        ref: "src/app/login/LoginForm.test.tsx#LoginForm pending state (D-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Login errors (wrong password, not configured, network) accessible, refocused with content selected, cleared on typing"
    requirement: "ACC-01"
    verification:
      - kind: unit
        ref: "src/app/login/LoginForm.test.tsx#LoginForm error states (D-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Post-login navigation honors only internal ?next= paths; logout navigates through the seam"
    requirement: "ACC-01"
    verification:
      - kind: unit
        ref: "src/app/login/LoginForm.test.tsx#LoginForm redirect after login (D-05, T-01-22)"
        status: pass
      - kind: integration
        ref: "pnpm smoke:auth (smoke-auth: OK (14 checks))"
        status: pass
    human_judgment: false
  - id: D6
    description: "Focus, selection and ~1 s pending timing feel in a real browser"
    verification: []
    human_judgment: true
    rationale: "Focus/selection/timing feel is best confirmed by a person in a real browser (plan human-check)"

duration: 12min
completed: 2026-10-14
status: complete
commits: 3
plan_head_before: 2846a177522b5522d492a5c29eea01cbb6647403
plan_head_after: 39efe3f943783c3d0dc2d56de7e1d4bfdfb87b3a
---

# Phase 1 Plan 09: Gate tests and login states Summary

**The password gate is now locked by unit tests (JWT rotation, tampering, alg none, 13 open-redirect vectors), and the login form shows a spinner while pending, accessible refocused errors, and lands on a validated `?next=` through a mockable `hardNavigate` seam.**

## Performance

- **Duration:** about 12 min
- **Tasks:** 2 of 2
- **Files:** 4 created, 3 modified

## Accomplishments

- `session.test.ts` (node env, `vi.stubEnv`): round-trip, rotation by `APP_PASSWORD` and by `SESSION_SECRET`, one-character payload tamper, hand-built `alg: none` token, empty/short env failing closed, `passwordMatches` for different lengths.
- `safeNext.test.ts`: `it.each` over every vector in the plan (`//evil.com`, `/\evil.com`, `/.//evil.com`, `/a/../..//evil.com`, `/login`, `/api/auth/logout`, control chars, tab); keeps `/`, `/foo?x=1#h` and literal `/%5Cevil.com`. All passed against Plan 01-01 code with no changes to `session.ts` or `safeNext.ts`.
- `navigation.ts` (`hardNavigate`) created; `logout.ts` now navigates through it.
- `LoginForm`: Spinner + "Entrando…" while pending and no double submit; on any error the input is re-focused with its content selected, `aria-invalid` and `aria-describedby` point at the `role=alert` message, and typing clears it; success calls `hardNavigate(safeNextPath(next))`, reading the query at submit time (no `useSearchParams`).
- TDD: RED commit `4a0c2da` (module `@/lib/client/navigation` missing, suite failed to load) then GREEN `39efe3f`.

## Task Commits

1. Task 1 (tests against existing code, passed immediately): `42d07fc` test(01-09)
2. Task 2 RED: `4a0c2da` test(01-09)
3. Task 2 GREEN: `39efe3f` feat(01-09)

## Verification

- `pnpm exec vitest run src/lib/safeNext.test.ts src/lib/server/session.test.ts`: 2 files, 27 tests passed.
- `pnpm exec vitest run src/app/login src/lib`: 5 files, 59 tests passed.
- `pnpm verify` (lint, typecheck, test, build): passed (93 tests passed, 3 skipped belonging to other suites).
- `pnpm smoke:auth`: `smoke-auth: OK (14 checks)`.
- package.json and pnpm-lock.yaml untouched by this plan (shadcn CLI created only `spinner.tsx`).
- Pending human check (not run, no browser available): with `pnpm build && pnpm start`, open `/foo?x=1` signed out, enter a wrong then the right password.

## Deviations from Plan

None - plan executed exactly as written. Minor notes:
- The shadcn `Spinner` ships `role="status"` and an English `aria-label="Loading"`; inside the button it is rendered `aria-hidden="true"` so the Spanish button text is the only announced label (CLAUDE.md copy is es-MX).
- The empty-password submit also re-focuses and selects the field (same a11y behavior as server errors).

## Known Stubs

None.

## Threat Flags

None. T-01-22, T-01-41 and T-01-SC mitigations are in place (tests plus no new dependency).

## Self-Check: PASSED

- Files exist: session.test.ts, safeNext.test.ts, navigation.ts, spinner.tsx, LoginForm.tsx, LoginForm.test.tsx, logout.ts.
- Commits `42d07fc`, `4a0c2da`, `39efe3f` are on HEAD.
