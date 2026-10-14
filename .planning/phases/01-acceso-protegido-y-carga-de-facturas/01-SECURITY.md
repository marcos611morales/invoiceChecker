---
phase: "01"
slug: "acceso-protegido-y-carga-de-facturas"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-14"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser to Proxy/route handlers | Untrusted requests reach `src/proxy.ts` and `/api/auth/*` | Cookies, query strings, JSON password (secret) |
| Login form to `?next=` navigation | Attacker-controlled `next` decides the post-login destination | URL path (untrusted) |
| User-selected files to the parser | Arbitrary, possibly hostile XML enters DOMParser in the browser | CFDI XML (confidential financial data) |
| Parsed strings and file names to the DOM | Issuer names, RFCs, folios and file names are rendered | XML-derived text (untrusted) |
| Browser tab to any network origin | XML content must never leave the browser | Invoice content (confidential) |
| Inline script in the root layout | Runs before hydration on every page | Theme value from localStorage (untrusted) |
| In-memory store to the next user of the browser | Shared office computers; logout must leave nothing behind | Parsed invoices (confidential) |
| Build output to the public CDN | `.next/static` is downloadable by anyone | Bundled code (must hold no secrets) |
| Repo/deploy tree to git and Vercel | Real invoices and env files sit next to the code | `Facturas/`, `.env*` (confidential) |
| npm registry / shadcn registry to the project | Installed and copied-in code runs in build and browser | Third-party code |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Spoofing | `verifySessionToken` | high | mitigate | `jwtVerify` with `algorithms: ["HS256"]`; `SESSION_SECRET` min 32 via zod (`src/lib/server/session.ts`); tampered and alg-none tests in `session.test.ts` | closed |
| T-01-02 | Spoofing | `POST /api/auth/login` brute force | medium | mitigate | 1000 ms delay on failure (`src/app/api/auth/login/route.ts`, D-03) | closed |
| T-01-03 | Information disclosure | `passwordMatches` timing | low | mitigate | `timingSafeEqual` over SHA-256 digests (`session.ts`) | closed |
| T-01-04 | Elevation of privilege | Sessions after password change | medium | mitigate | keyed HMAC `pwd` claim checked on every verify; rotation tests in `session.test.ts` | closed |
| T-01-05 | Tampering | `?next=` open redirect | high | mitigate | `safeNextPath` with post-normalization `//` check and `/login`, `/api/` rejection (`src/lib/safeNext.ts`); `safeNext.test.ts` | closed |
| T-01-06 | Elevation of privilege | Proxy coverage drift | high | mitigate | matcher excludes only `_next/static`, `_next/image`, `favicon.ico`; in-function allowlist (`src/proxy.ts`) | closed |
| T-01-07 | Information disclosure | Missing env fails open | high | mitigate | `readAuthEnv` returns null; login returns 500, verify returns false; tests in `session.test.ts` | closed |
| T-01-08 | Information disclosure | Real invoices committed | high | mitigate | `.gitignore` covers `Facturas/` (`git check-ignore` confirmed) | closed |
| T-01-09 | Information disclosure | Secrets in client bundle | high | mitigate | `import "server-only"` in `session.ts`; no `NEXT_PUBLIC` in `src` | closed |
| T-01-10 | Tampering | Login CSRF | low | accept | SameSite=Lax, JSON-only content type; see Accepted Risks | closed |
| T-01-11 | Denial of service | XML entity expansion | medium | mitigate | DOCTYPE/ENTITY pre-reject and 2,000,000-char cap before DOMParser (`parseCfdi.ts`) | closed |
| T-01-12 | Denial of service | `parseCfdi` huge or entity input | medium | mitigate | same pre-checks plus `parsererror` check before root access (`parseCfdi.ts`) | closed |
| T-01-13 | Information disclosure | Fixtures derived from real invoices | high | mitigate | whitelist anonymizer `scripts/anonymize-fixture.mjs`; `tests/fixtures.guard.test.ts` walks `tests/` and `e2e/` against real identifiers | closed |
| T-01-14 | Tampering | `ImportCountsPanel` rendering XML strings | high | mitigate | React text nodes only; no raw-HTML API in `src/features` | closed |
| T-01-15 | Information disclosure | Local regression test reading `Facturas/` | low | accept | counts-only assertions, skipped when folder absent; see Accepted Risks | closed |
| T-01-16 | Information disclosure | XML leaving the browser via ingest/store/domain | high | mitigate | no network or storage APIs in `src/stores`, `src/domain`, `ingest.ts`, `src/features/upload` (grep) | closed |
| T-01-17 | Information disclosure | `sessionStore` persisting invoices | high | mitigate | zustand without `persist`; fresh-module-empty test in `sessionStore.test.ts` | closed |
| T-01-18 | Tampering | Stale batch after clear | medium | mitigate | generation compared in `applyBatch` (`sessionStore.ts`) | closed |
| T-01-19 | Tampering | Duplicate UUID case variants | medium | mitigate | parser uppercases UUIDs; first-wins dedupe in `applyBatch.ts` | closed |
| T-01-20 | Denial of service | Very large folders freezing the tab | low | accept | chunked ingest and per-file cap; see Accepted Risks | closed |
| T-01-21 | Tampering | `themeInitScript` | high | mitigate | constant string, accepts only "light"/"dark" (`themeScript.ts`); the only `dangerouslySetInnerHTML` in `src` is `layout.tsx:33` | closed |
| T-01-22 | Tampering | `LoginForm` post-login navigation | high | mitigate | `hardNavigate(safeNextPath(next))` (`LoginForm.tsx:63`); `LoginForm.test.tsx` | closed |
| T-01-23 | Information disclosure | Show/hide password toggle | low | accept | user-initiated, local only; see Accepted Risks | closed |
| T-01-24 | Elevation of privilege | Failed logout leaves cookie | low | accept | user-confirmed UI-SPEC behavior; see Accepted Risks | closed |
| T-01-25 | Tampering | Clickjacking of login page | low | transfer | transferred to Plan 01-16: `frame-ancestors 'none'` in CSP (`next.config.ts`) | closed |
| T-01-26 | Tampering | Report rows and tooltips | high | mitigate | React text nodes only; no raw-HTML API in `src/features` | closed |
| T-01-27 | Information disclosure | Logout leaving invoices in memory | medium | mitigate | `clearAll()` before `logout()` (`LogoutButton.tsx:33-34`); order asserted in `guards.test.tsx` | closed |
| T-01-28 | Tampering | Browser opening dropped XML during processing | low | mitigate | dropzone at window root, still prevents default when disabled (`UploadRoot.tsx`) | closed |
| T-01-29 | Denial of service | Accidental loss of loaded invoices | low | mitigate | `beforeunload` (`useBeforeUnload.ts`) and logout confirmation | closed |
| T-01-30 | Information disclosure | XML exfiltration from the browser | high | mitigate | CSP `connect-src 'self'` (`next.config.ts`); `e2e/smoke.spec.ts` asserts no XML bodies and same-origin requests | closed |
| T-01-31 | Tampering | Clickjacking and search indexing | low | mitigate | `frame-ancestors 'none'`, `X-Robots-Tag: noindex, nofollow` (`next.config.ts`) | closed |
| T-01-32 | Information disclosure | Secrets in the client bundle | high | mitigate | `scripts/check-bundle-secrets.mjs` scans `.next/static` for sentinel values | closed |
| T-01-33 | Tampering | Vulnerable production dependencies | medium | mitigate | committed `pnpm-lock.yaml`; `pnpm audit --prod --audit-level high` clean on 2026-10-14 (see Notes) | closed |
| T-01-34 | Information disclosure | CLI deploy uploading `Facturas/` or env files | high | mitigate | `.vercelignore` lists `Facturas/` and `.env*` | closed |
| T-01-35 | Tampering | `'unsafe-inline'` in CSP | medium | accept | needed by Next's inline bootstrap and theme script; see Accepted Risks | closed |
| T-01-36 | Tampering | XSS through table cells | high | mitigate | React text nodes only; no raw-HTML API in `src/features` or `src/components` | closed |
| T-01-37 | Information disclosure | Synthetic fixtures and test helpers | high | mitigate | SAT test RFCs and synthetic UUIDs; `tests/fixtures.guard.test.ts` | closed |
| T-01-38 | Denial of service | Long concept or payment lists | low | accept | bounded by 2,000,000-char cap; see Accepted Risks | closed |
| T-01-39 | Tampering | `sonner.tsx` pulling a theme library | medium | mitigate | no `next-themes` in `sonner.tsx` or `pnpm-lock.yaml` | closed |
| T-01-40 | Denial of service | Rendering all invoices at once | low | mitigate | 50-row pages with clamped index (`InvoiceTable.tsx`) | closed |
| T-01-41 | Elevation of privilege | Regressions in token or redirect handling | high | mitigate | `session.test.ts` and `safeNext.test.ts` run in `pnpm test` and `pnpm verify` | closed |
| T-01-42 | Denial of service | Accidental "Quitar todas" | low | mitigate | AlertDialog with `initialFocus` on dismiss; trigger disabled while busy (`ImportReport.tsx`) | closed |
| T-01-SC | Tampering | npm/pnpm installs and shadcn copies | high | mitigate | committed lockfile; `allowBuilds` blocks build scripts (`pnpm-workspace.yaml`); no postinstall scripts; audit clean (see Notes) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Notes

- T-01-SC / T-01-33: the plans call for "exact pins". The packages the shadcn CLI added (`@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `sonner`, `tw-animate-css`) and some dev tooling still use `^` ranges in `package.json`. The committed `pnpm-lock.yaml` fixes the installed versions, so installs are reproducible. `pnpm audit` runs as a step in the plan verification, not inside the `pnpm verify` script.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-10 | SameSite=Lax cookie and JSON-only body; a shared password gives an attacker nothing per-user | plan 01-01 threat model | 2026-10-14 |
| AR-01-02 | T-01-15 | Local-only regression test asserts counts, never values; skipped where `Facturas/` is absent | plan 01-05 threat model | 2026-10-14 |
| AR-01-03 | T-01-20 | Chunks of 25 with macrotask yield and 2 MB per-file cap keep the UI responsive | plan 01-10 threat model | 2026-10-14 |
| AR-01-04 | T-01-23 | Password reveal is user-initiated, local screen only, hidden by default | plan 01-06 threat model | 2026-10-14 |
| AR-01-05 | T-01-24 | User-confirmed UI-SPEC behavior; session expires or rotates per D-02 | plan 01-07 threat model | 2026-10-14 |
| AR-01-06 | T-01-35 | Required by Next's inline bootstrap on a static shell; no XSS sinks exist | plan 01-16 threat model | 2026-10-14 |
| AR-01-07 | T-01-38 | Work per file bounded by the 2,000,000-char cap; extraction is linear | plan 01-02 threat model | 2026-10-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-14 | 43 | 43 | 0 | /gsd-secure-phase (L1 grep evidence, auditor skipped by short-circuit rule) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-14
