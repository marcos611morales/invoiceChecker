---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 16
subsystem: infra
tags: [security-headers, csp, playwright, vercel, corepack, pnpm, deploy]
requires:
  - phase: 01-15
    provides: Paginated invoice table, final import report UI used by the smoke spec
  - phase: 01-05
    provides: Password gate (proxy, session cookie, /api/llm/group guard)
provides:
  - Security headers on every route (CSP with connect-src 'self' and frame-ancestors 'none', nosniff, same-origin referrer, noindex)
  - scripts/check-bundle-secrets.mjs (build with sentinels and scan of .next/static)
  - .env.example, .vercelignore and a Spanish README with "Despliegue en Vercel" and "Pruebas de punta a punta (local)"
  - Local Chrome Playwright smoke (gate, folder pick, zero XML in requests, reload warning and reset, logout)
  - Deployment confirmed by the user on https://invoice-checker-ysob.vercel.app/ (D-26, D-27, D-28)
affects: [phase-02, phase-verification]
actuals:
  tokens: 15000
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Security headers via async headers() in next.config.ts, with 'unsafe-eval' only outside production"
    - "Bundle secret scan: real next build with random sentinel secrets, then grep of .next/static for sentinels and variable names"
    - "E2E synthetic folder generated at runtime in the OS temp dir from fixtures plus withUuid, never committed"
key-files:
  created:
    - scripts/check-bundle-secrets.mjs
    - .env.example
    - .vercelignore
    - playwright.config.ts
    - e2e/smoke.spec.ts
  modified:
    - next.config.ts
    - README.md
key-decisions:
  - "Real URL of the Vercel project: https://invoice-checker-ysob.vercel.app/ (default *.vercel.app domain, D-27)"
  - "Vercel installs with pnpm 11.5.2 through ENABLE_EXPERIMENTAL_COREPACK=1; the pnpm 10 fallback was not needed (assumption A2 / D-28 proven)"
  - "No package.json or lockfile change in this plan (T-01-SC holds)"
requirements-completed: [DEV-04, ACC-01, ACC-02, CARGA-02, CARGA-06]
coverage:
  - id: D1
    description: "Every response carries CSP (connect-src 'self', frame-ancestors 'none'), nosniff, Referrer-Policy same-origin and X-Robots-Tag noindex, nofollow; confirmed on the live URL"
    requirement: ACC-01
    verification:
      - kind: e2e
        ref: "e2e/smoke.spec.ts#la puerta de acceso redirige a /login, protege la API y envía las cabeceras de seguridad"
        status: pass
      - kind: other
        ref: "curl -sI https://invoice-checker-ysob.vercel.app/login"
        status: pass
    human_judgment: false
  - id: D2
    description: "Client bundle free of APP_PASSWORD and SESSION_SECRET (values and names)"
    requirement: ACC-02
    verification:
      - kind: other
        ref: "node scripts/check-bundle-secrets.mjs (OK, 27 files scanned)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deploy documentation (.env.example, .vercelignore, README Despliegue en Vercel) sufficient to deploy from scratch"
    requirement: DEV-04
    verification:
      - kind: manual_procedural
        ref: "User deployed to Vercel following the README and confirmed"
        status: pass
    human_judgment: true
    rationale: "Clarity of the instructions is judged by the person following them; the user did and confirmed"
  - id: D4
    description: "Zero XML in any request, folder import counts and reload reset proven in Chrome on synthetic data and on Facturas/2025"
    requirement: CARGA-02
    verification:
      - kind: e2e
        ref: "pnpm test:e2e (3 passed, 1 skipped)"
        status: pass
      - kind: e2e
        ref: "E2E_FACTURAS_DIR=<abs>/Facturas/2025 pnpm test:e2e --grep 'muestra real' (133/3/7, 143 ignored)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Password gate, session persistence, folder import and logout confirmed on the real Vercel URL"
    requirement: CARGA-06
    verification:
      - kind: other
        ref: "curl: / 307 to /login; /cualquier-cosa 307 to /login?next=%2Fcualquier-cosa; POST /api/llm/group 401"
        status: pass
      - kind: manual_procedural
        ref: "User reply: desplegado y confirmado (Task 3 steps 5-9)"
        status: pass
    human_judgment: true
    rationale: "ROADMAP criterion 1 on the real URL is the D-28 phase gate and requires the user's own confirmation"
duration: 90min
completed: 2026-10-14
status: complete
commits: 3
plan_head_before: 8ed3279813de56e723446316f5de321298a56eb6
plan_head_after: 7d4d3dfd9338c22eb073e65b08c8331bc5ab55ba
---

# Phase 1 Plan 16: Phase hardening and Vercel deploy Summary

**Strict security headers (CSP with connect-src 'self'), a sentinel-based bundle secret scan, a Spanish deploy README, a local Chrome Playwright smoke proving zero XML over the network, and a live Vercel deployment at https://invoice-checker-ysob.vercel.app/ confirmed by the user.**

## Performance

- **Duration:** about 90 min across the executor, the human deploy checkpoint and this continuation
- **Completed:** 2026-10-14
- **Tasks:** 3 (2 automated, 1 human-action checkpoint)
- **Files modified:** 7 (429 insertions, 21 deletions across Tasks 1-2)

## Accomplishments

- `next.config.ts` serves CSP (default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'), X-Content-Type-Options nosniff, Referrer-Policy same-origin and X-Robots-Tag noindex, nofollow on every route.
- `scripts/check-bundle-secrets.mjs` builds with random sentinel secrets and scans `.next/static`; result "check-bundle-secrets: OK (27 files scanned)".
- `.env.example`, `.vercelignore` (Facturas/ and .env*) and README sections "Despliegue en Vercel" and "Pruebas de punta a punta (local)".
- `playwright.config.ts` (channel chrome, `pnpm build && pnpm start -p 3210`) and `e2e/smoke.spec.ts` with a synthetic folder built at runtime from fixtures.
- Vercel deployment confirmed by the user; build used pnpm 11.5.2 through `ENABLE_EXPERIMENTAL_COREPACK=1` without error (assumption A2 and D-28 proven).

## Task Commits

1. **Task 1: Security headers, bundle secret scan, audit, deploy docs** - `9a0701b` (feat)
2. **Task 2: Local Playwright smoke in Chrome** - `7d4d3df` (test)
3. **Task 3: Deploy to Vercel and confirm on the real URL** - no commit (human action by the user)

**Plan metadata:** the docs commit that adds this SUMMARY (`docs(01-16): complete phase hardening and deploy plan summary`).

## Files Created/Modified

- `next.config.ts` - security headers via async `headers()`
- `scripts/check-bundle-secrets.mjs` - build-and-scan proof that secrets stay out of the client bundle
- `.env.example` - APP_PASSWORD, SESSION_SECRET and ENABLE_EXPERIMENTAL_COREPACK documented with empty values
- `.vercelignore` - keeps Facturas/ and local env files out of CLI uploads
- `README.md` - rewritten in Spanish with local run, Vercel deploy and E2E sections
- `playwright.config.ts` - Chrome channel, webServer on port 3210, test-only env defaults
- `e2e/smoke.spec.ts` - gate, folder pick, zero XML bodies, reload warning and reset, logout, real sample (opt-in)

## Task 3: deployment record (checkpoint:human-action)

**URL:** https://invoice-checker-ysob.vercel.app/

**User confirmation (verbatim):** "https://invoice-checker-ysob.vercel.app/ desplegado y confirmado". The user ran every manual step: gate redirect from `/` and other paths, wrong password message, right password entry, session persisting across reload and full browser restart, `Facturas/2025` import (Ingreso 133, Egreso 3, Pago 7, Ignorados 143) with no XML in network requests, and logout with confirmation back to `/login`.

**Orchestrator curl checks against the live URL:**

| Check | Result |
|-------|--------|
| `GET /` | 307 to `https://invoice-checker-ysob.vercel.app/login` |
| `GET /cualquier-cosa` | 307 to `/login?next=%2Fcualquier-cosa` |
| `POST /api/llm/group` | 401 |
| `GET /login` | 200 with `content-security-policy` (default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'), `referrer-policy: same-origin`, `strict-transport-security: max-age=63072000; includeSubDomains; preload`, `x-content-type-options: nosniff`, `x-robots-tag: noindex, nofollow` |

The Vercel-added `strict-transport-security` header is a bonus beyond the plan.

## Verification

- `pnpm verify`: green (219 vitest tests with `FACTURAS_DIR`).
- `node scripts/check-bundle-secrets.mjs`: OK (27 files scanned).
- `pnpm audit --prod --audit-level high`: no high or critical advisories.
- `pnpm smoke:auth`: OK (14 checks).
- `pnpm test:e2e`: 3 passed, 1 skipped (real sample skipped without `E2E_FACTURAS_DIR`).
- Real-sample E2E (`muestra real`) with `Facturas/2025`: passed (133 Ingreso, 3 Egreso, 7 Pago, 143 ignored, zero XML bodies).
- Post-merge gate on main: typecheck, eslint (0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts`), vitest 219, build all green.
- T-01-SC: no `package.json` or `pnpm-lock.yaml` change in this plan.

## Decisions Made

- Keep `'unsafe-inline'` for scripts and styles (T-01-35 accepted): needed by Next's inline bootstrap and the theme script; no XSS sinks exist.
- Prefer a Git import on Vercel over CLI upload so `Facturas/` stays out via `.gitignore`; `.vercelignore` is defense in depth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Login locator uses getByRole textbox**
- **Found during:** Task 2
- **Issue:** The plan describes the field as the one labelled "Contraseña"; a plain label locator was not the one that worked against the login form.
- **Fix:** The spec locates the field with `getByRole("textbox", { name: "Contraseña" })`.
- **Files modified:** `e2e/smoke.spec.ts`
- **Committed in:** `7d4d3df`

**2. [Rule 3 - Blocking] Real-sample E2E run with an absolute E2E_FACTURAS_DIR from the worktree**
- **Found during:** Task 2 verification
- **Issue:** `Facturas/` is git-ignored and absent inside the executor worktree, so the relative `Facturas/2025` path did not resolve.
- **Fix:** Ran the `muestra real` test with an absolute `E2E_FACTURAS_DIR` pointing at the main checkout's `Facturas/2025`. No code change.
- **Verification:** Test passed with 133/3/7 and 143 ignored.

**3. [Process] Per-plan head ledger blocked by sandbox**
- **Issue:** The `gsd-plan-head-before-01-16` ledger file could not be written in the sandbox.
- **Fix:** `commits:` is derived from git history instead: `plan_head_before` is `8ed3279` (the base before this plan) and the plan commits are `9a0701b`, `7d4d3df` and the docs commit with this SUMMARY (3 total). `plan_head_after` records the last code commit `7d4d3df`; the docs commit sits on top of it.

---

**Total deviations:** 3 (2 blocking environment issues, 1 process note)
**Impact on plan:** None on scope or outputs; all acceptance criteria met.

## Issues Encountered

None beyond the deviations above.

## Known Stubs

None.

## Threat Flags

None. T-01-30 to T-01-34 mitigated and verified (CSP plus zero-XML E2E, headers, bundle scan, audit, `.vercelignore`); T-01-35 accepted; T-01-SC holds.

## User Setup Required

Done by the user: Vercel project created, Node.js 24.x, environment variables `APP_PASSWORD`, `SESSION_SECRET` and `ENABLE_EXPERIMENTAL_COREPACK=1` set for Production and Preview. No further external configuration.

## Next Phase Readiness

- All sixteen plans of Phase 1 have summaries; ROADMAP criteria 1, 2 and 4 are demonstrated (criterion 1 on the real URL per D-28), criterion 5 holds.
- Pending outside this plan: end-of-phase human checks harvested from Plans 01-03 to 01-15 belong to the phase UAT, and the orchestrator owns STATE.md and ROADMAP.md updates.

---
*Phase: 01-acceso-protegido-y-carga-de-facturas*
*Completed: 2026-10-14*

## Self-Check: PASSED

- Files present: next.config.ts, scripts/check-bundle-secrets.mjs, .env.example, .vercelignore, README.md, playwright.config.ts, e2e/smoke.spec.ts.
- Commits present: 9a0701b, 7d4d3df.
