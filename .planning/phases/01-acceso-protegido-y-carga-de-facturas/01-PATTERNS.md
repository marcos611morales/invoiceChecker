# Phase 1: Acceso protegido y carga de facturas - Pattern Map

**Mapped:** 2026-10-13
**Files analyzed:** 38 (all new)
**Analogs found:** 0 / 38 (greenfield: `git ls-files` outside `.claude/` and `.planning/` returns only `.gitignore`)

No in-repo analogs exist. Per orchestrator instruction none are invented. The reference source for every file is the verified spike code in `01-RESEARCH.md` (RESEARCH below). Scaffold facts come from `create-next-app@16.4.0`.

## File Classification

| New/Modified File | Role | Data Flow | Analog | Reference (RESEARCH) |
|---|---|---|---|---|
| `.gitignore` (modify: merge) | config | n/a | existing 4 lines | Pattern 1 (merge, never overwrite; keep `!.env.example`) |
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `vitest.setup.ts`, `playwright.config.ts` | config | n/a | none | Pattern 1, Pattern 2, Installation block, Pitfalls 1-4 |
| `.env.example`, `.vercelignore`, `README.md` | config/docs | n/a | none | Walking skeleton item 5, Pitfall 4, D-26 |
| `src/lib/server/session.ts` | service | request-response | none | Pattern 3 |
| `src/lib/safeNext.ts` (client-importable, split out from session) | utility | transform | none | Pattern 3 (`safeNextPath`), Pitfalls 7-8 |
| `src/proxy.ts` | middleware | request-response | none | Pattern 3 |
| `src/app/api/auth/login/route.ts`, `logout/route.ts` | route | request-response | none | Pattern 3, Pitfall 14 |
| `src/app/layout.tsx`, `globals.css`, `page.tsx` | component/config | request-response | scaffold | Pattern 8, Pitfalls 5-6 |
| `src/app/login/{page.tsx,LoginForm.tsx}` | component | request-response | none | Pattern 3, Pitfall 6 (read `?next=` at submit via `URLSearchParams`) |
| `src/domain/cfdi/parseCfdi.ts` (+ test) | utility (pure) | transform | none | Pattern 4, Pitfall 11 |
| `src/domain/import/{classifyFile,dedupe,report}.ts` (+ tests) | utility (pure) | transform | none | Pattern 5, 6 |
| `src/lib/client/{ingest,theme,format}.ts` | utility | file-I/O, batch | none | Pattern 5, 8 |
| `src/stores/sessionStore.ts` | store | event-driven | none | Pattern 6, Pitfall 12 |
| `src/features/upload/*` | component | file-I/O | none | Pattern 5, Pitfall 10 |
| `src/features/report/*` | component | transform | none | Pattern 6 |
| `src/features/invoices/*` (InvoiceTable) | component | CRUD (read) | none | Pattern 7, Pitfall 9 |
| `src/components/ui/*` | component | n/a | shadcn copy-in | Installation block, Pitfall 5 |
| `tests/fixtures/*.xml`, `e2e/*.spec.ts` | test | n/a | none | Pitfall 13; anonymized/synthetic fixtures only |

## Pattern Assignments

Each entry: copy the verified RESEARCH section; do not look for in-repo code.

- **Scaffold:** RESEARCH Pattern 1 (scaffold in temp dir, rsync, merge `.gitignore`; `name`, `engines.node = 24.x`; delete `public/*.svg`).
- **Scripts:** RESEARCH Pattern 2 (`typecheck` = `next typegen && tsc --noEmit`).
- **Auth (`session.ts`, `proxy.ts`, login/logout routes):** RESEARCH Pattern 3 (lines 324-441). Key excerpts: `readAuthEnv()` fails closed; `passwordMatches` uses `timingSafeEqual` over SHA-256 digests; JWT carries keyed `pwd` claim (D-02); `safeNextPath` re-checks after URL normalization. Proxy matcher excludes only `_next/static`, `_next/image`, `favicon.ico`; public allowlist `/login` and `/api/auth/*` inside the function; pages redirect to `/login?next=`, `/api/*` returns 401 JSON.
- **Parser:** RESEARCH Pattern 4 (lines 442-496): DOMParser, strip BOM, `parsererror` check, namespace-URI child lookups, DTD pre-reject, uppercase UUID.
- **Ingest:** RESEARCH Pattern 5 (chunks of 25, await a macrotask between chunks, progress callback, hidden files dropped, pdf/zip/other to ignored).
- **Store:** RESEARCH Pattern 6 (plain zustand `create`, NO `persist`; first-wins dedupe; selectors for receptor más frecuente).
- **Table:** RESEARCH Pattern 7 (v9 API; set numeric columns to sort asc-first, 50/page, ISO string sort).
- **Theme / headers:** RESEARCH Patterns 8 and 9 (CSP `connect-src 'self'`, nosniff, Referrer-Policy, noindex).
- **Dropzone:** Pitfall 10 (react-dropzone root = window, `noClick`, separate `webkitdirectory` input).

## Shared Patterns

- **Domain boundary:** `src/domain/**` must not import react, next, zustand, `@/lib`, `@/components` (ESLint rule in `eslint.config.mjs`; RESEARCH project structure). `src/lib/server/*` imports `server-only` (Pitfall 13: stub it under Vitest).
- **Fail closed auth:** every route goes through `proxy.ts`; `/api/*` handlers should also call a shared session check (defense in depth, per CLAUDE.md).
- **Money/dates:** no summing in Phase 1 (D-22); show amounts as XML text with `Intl.NumberFormat("es-MX")`; dates sliced from the ISO string, never `new Date()` for bucketing.
- **Strings:** Spanish es-MX in a single module; no i18n framework.
- **Tests:** parser tests start with `// @vitest-environment jsdom`; `resolve.tsconfigPaths: true`; no `vite-tsconfig-paths`.
- **Privacy:** no network call carrying XML content; no telemetry (Pitfall 15).

## No Analog Found

All 38 files. Planner should use the RESEARCH sections cited above (Patterns 1-9, Code Examples at line 654, Pitfalls 1-15).

## Metadata

**Analog search scope:** repo root via `git ls-files` (only `.gitignore` tracked outside `.claude/`, `.planning/`).
**Tracked-source gate:** no analog paths named, so no mirror-path risk.
**Pattern extraction date:** 2026-10-13
