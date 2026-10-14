# Walking Skeleton — InvoiceChecker

**Phase:** 1
**Generated:** 2026-10-13
**Delivered by:** `01-01-PLAN.md` (tracer task). Plans 01-02 to 01-16 add vertical slices on top of it without changing the decisions below.

## Capability Proven End-to-End

A partner who knows the shared password opens the app, is sent to `/login`, enters, picks the `Facturas/2025/` folder (or several XML files) in the browser, and sees the I/E/P counts that the in-browser parser wrote into the in-memory session store, with no XML content leaving the browser; "Cerrar sesión" returns them to `/login`.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.4.0, App Router only, `src/` directory, TypeScript 6.0.3 `strict` + `noUncheckedIndexedAccess`, React 19.3 | Locked by the user (CLAUDE.md). Turbopack default; `next lint` removed, so lint is the `eslint` CLI with a flat config. |
| Package manager | pnpm 11.5.2 pinned in `packageManager`; `allowBuilds` in `pnpm-workspace.yaml` | User decision (RESEARCH Open Question 1, resolved 2026-10-13). Vercel needs `ENABLE_EXPERIMENTAL_COREPACK=1`; fallback to pnpm 10 only if the D-28 deploy fails. |
| Data layer | **No database.** Invoices live only in a module-level zustand store (`src/stores/sessionStore.ts`), never persisted; reload or logout clears them. The skeleton's "real write" is `parseCfdi` results going into that store; the "real read" is the page rendering counts from it. | CARGA-06 and the "sin base de datos" constraint. Settings persistence (`localStorage`, zod-validated) arrives in Phase 3; the theme preference is the only Phase 1 browser storage. |
| Parsing | Native `DOMParser` in the browser, pure function `parseCfdi(xmlText): ParseResult` in `src/domain/cfdi/`, namespace-URI child lookups, BOM stripped, DTD pre-rejected, 2 MB cap, money/rates kept as exact XML strings | CLAUDE.md "XML parsing"; user decision Q8 (no numeric type in Phase 1; Phase 2 adopts big.js per REGLA-04). |
| Auth | `src/proxy.ts` (Next 16 Proxy, fail-closed exclude-list matcher) + `jose` HS256 JWT in cookie `session` (HttpOnly, Secure in production, SameSite=Lax, Path=/, 30 days), keyed `pwd` claim so changing `APP_PASSWORD` invalidates every session; login/logout route handlers under `/api/auth/*` | D-01, D-02, D-03, D-05; RESEARCH Pattern 3 (verified with curl on `next start`). Phase 4 adds a per-handler `requireSession()` on the LLM routes. |
| Deployment target | Vercel Hobby, default `*.vercel.app` domain, Node 24.x (`engines.node`), env vars `APP_PASSWORD`, `SESSION_SECRET` (>= 32 chars), `ENABLE_EXPERIMENTAL_COREPACK=1`; the user creates the project | D-26, D-27, D-28 (blocking human deploy checkpoint in Plan 16). |
| UI kit | shadcn/ui `base-nova` (Base UI) + Tailwind 4 CSS-first tokens, Geist Sans/Mono, light/dark via class `.dark` + pre-hydration script; `shadcn init` once (Plan 01-03), then each slice runs `shadcn add` for the components it first uses (the union is the UI-SPEC inventory) | UI-SPEC (approved). Base UI uses the `render` prop and `multiple` accordions, not Radix habits. |
| Tables | TanStack Table 9.3.1 (v9 API: `useTable` + `tableFeatures`) | D-23; exercises v9 before Phase 2 builds on it. |
| Directory layout | `src/domain/**` pure (ESLint forbids react/next/zustand/`@/lib`/`@/components`/`@/stores`/`@/features` imports), `src/lib/server/**` (`import "server-only"`), `src/lib/client/**` (browser adapters), `src/lib/copy/es.ts` (static es-MX strings), `src/lib/copy/messages.ts` (interpolated Spanish sentences), `src/lib/format.ts` (value formatting: dates, money, folios), `src/stores/**`, `src/features/{shell,upload,report,invoices}/**`, `src/components/ui/**` (shadcn copy-in), `tests/fixtures/cfdi/**` (hand-written and anonymized XML), `tests/support/cfdiVariants.ts` (mechanical variants derived from the fixtures, shared by Vitest and Playwright) | Keeps the parser and import rules testable in Vitest and movable to a worker later; one source per fixture, never copied into a second folder. |
| Tests | Vitest 5 (`node` env by default, `// @vitest-environment jsdom` per file), `resolve.tsconfigPaths: true`; one local Playwright smoke spec (Chrome channel) against `build && start`, outside `pnpm verify` | User decision Q10; CLAUDE.md "Testing". |
| Quality gate | `pnpm verify` = `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; `typecheck` = `next typegen && tsc --noEmit`; `pnpm smoke:auth` exercises the gate on a production build | DEV-02; RESEARCH Pattern 2 and Pitfall 2. |

## Stack Touched in Phase 1

- [x] Project scaffold (framework, build, lint, test runner) — `create-next-app@16.4.0` copied in from a temp dir, ESLint flat config, Vitest
- [x] Routing — `/login`, `/`, `POST /api/auth/login`, `POST /api/auth/logout`, Proxy on every other path
- [x] Data layer (no DB by design) — one real write (parsed files → zustand session store) and one real read (counts rendered from the store)
- [x] UI — file and folder pickers wired to the in-browser parser; login form wired to the login route; "Cerrar sesión" wired to the logout route
- [x] Deployment — documented local full-stack run (`pnpm build && pnpm start`, `pnpm smoke:auth`) and Vercel deploy instructions; real deploy confirmed by the user at the end of the phase (D-28)

## Out of Scope (Deferred to Later Slices)

- Amount rules (I adds / E subtracts / P excluded, con/sin IVA, $0, TipoCambio), KPIs, filters, categories, Excel, DeepSeek (Phases 2-5).
- Any sum or total of money in Phase 1 (D-22).
- Opening `.zip` files in the browser and a custom domain (CONTEXT Deferred Ideas).
- Persisting invoices in the browser (v2 requirement V2-02) and CFDI 3.3 support (V2-04).
- Per-user accounts, lockout counters, or any server-side storage.

## Subsequent Slice Plan

Within Phase 1 (each plan is a vertical slice on top of the skeleton):

- 01-02: full CFDI field extraction (conceptos and their taxes, CfdiRelacionados, Pagos), prefix/BOM variants.
- 01-03: shadcn base-nova kit, UI-SPEC tokens, theme that follows the OS, es-MX copy module.
- 01-04: every rejection reason proven, Spanish reasons per file in the page.
- 01-05: real-sample regression, anonymized fixtures, leak guard.
- 01-06: login card per UI-SPEC with show/hide password.
- 01-07: theme toggle and sticky top bar with "Cerrar sesión".
- 01-08: first-wins duplicates, ignored files, in-memory store with generation.
- 01-09: gate unit tests and login states (pending, errors, safe next).
- 01-10: chunked ingest with progress, batch summary, duplicate/ignored/receptor lists.
- 01-11: report cards, accordions and "Quitar todas".
- 01-12: progress bar and per-batch toasts.
- 01-13: drop anywhere, empty dropzone, logout confirmation and reload warning.
- 01-14: "Facturas cargadas" table with formatting and sorting.
- 01-15: table pagination, type badge, note and empty state.
- 01-16: security headers, deploy docs, Playwright smoke, Vercel deploy confirmation (D-28).

Later phases:

- Phase 2: reliable spend dashboard (amount rules with big.js, KPIs, monthly trend, suppliers, filters, data quality).
- Phase 3: own categories (persisted, exportable) and multi-sheet Excel export.
- Phase 4: DeepSeek product grouping behind the session gate (`requireSession()` in each LLM handler).
- Phase 5: price comparison between stores.
