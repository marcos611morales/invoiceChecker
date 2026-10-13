# Project Research Summary

**Project:** InvoiceChecker (Análisis de gastos del Coworking Café)
**Domain:** Browser-only analytics over received Mexican CFDI 4.0 XML invoices (Next.js on Vercel, no database, DeepSeek for product grouping)
**Researched:** 2026-10-13
**Confidence:** MEDIUM-HIGH — data/parsing facts measured on the 143 sample XMLs (HIGH); library versions registry-checked and build-verified in a scratch project; DeepSeek quality and Vercel limits documented but untested.

## Executive Summary

InvoiceChecker is an expense dashboard, not a bookkeeping product: four people (owner, partners, accountant) drop CFDI 4.0 XML files into a browser page, everything is parsed, aggregated and exported client-side, and the only server code is a shared-password gate plus one protected LLM proxy that holds the DeepSeek key. Research converges on a "pure core, thin shell" design: parsing, money rules, analytics and export shaping live in DOM-free TypeScript with unit tests, while the UI only renders selectors over one shared, filtered fact table — keeping charts, tables, averages and Excel export consistent.

Recommended stack: Next.js 16.4 (App Router; `proxy.ts` replaces `middleware.ts`), React 19.3, TypeScript pinned to 6.0.x (TS 7 breaks typescript-eslint required by eslint-config-next), ESLint 9 flat config, Tailwind 4 + shadcn/ui, Recharts 3, TanStack Table v9, zustand 5 with `persist` for settings only, zod at every untrusted boundary, the `openai` SDK pointed at DeepSeek (`deepseek-flash`, model from env), and jose for the signed session cookie. Invoices stay in memory; only user decisions (categories, supplier defaults, overrides, accepted LLM groups) go to localStorage, versioned and validated.

The domain traps matter more than the tech. "Sin IVA" must be `SubTotal − Descuento` (+ IEPS), not `SubTotal` (68/143 invoices carry discounts; IEPS is real on telecom and snack lines). Taxes must be read only from direct-child `Impuestos` nodes or IEPS/IVA double count. P (payment complement) invoices add zero spend but should stay in the model to resolve the real payment method of 8 PPD invoices. E (credit notes) are not plain refunds: the three in the sample are advance-payment applications (TipoRelacion 07). `Fecha` has no timezone and must be bucketed by string slicing, never `Date`. The LLM receives descriptions only, through a strict schema, and its output is a reviewable suggestion, never auto-applied.

## Key Findings

### Recommended Stack (STACK.md)
- **Next.js 16.4 + React 19.3, App Router**, Node 24; `proxy.ts` (Node runtime) for the gate.
- **TypeScript ~6.0.3 strict + `noUncheckedIndexedAccess`** — not TS 7 (typescript-eslint peer `<6.1.0`).
- **ESLint 9.39.x flat config via `eslint-config-next`** (no `next lint`, no `.eslintrc`).
- **zod 4, zustand 5 (`persist`, `skipHydration`), date-fns 4 (`es`), `Intl` es-MX currency.**
- **Parser:** native `DOMParser` (STACK) vs fast-xml-parser (ARCHITECTURE) — **conflict, see below**.
- **Excel:** write-excel-file 4.1.1 (`/universal`) (STACK) vs SheetJS CDN tarball (PITFALLS) — **conflict, see below**.
- **shadcn/ui (Base UI flavor), Tailwind 4, Recharts 3 (via shadcn chart), TanStack Table v9** (v9 API differs from v8).
- **openai SDK 7, baseURL `https://api.deepseek.com`**, JSON mode, `thinking: {type: "disabled"}`.
- **jose 6, HS256 session JWT, HttpOnly/Secure/SameSite=Lax**; gate in `proxy.ts`, re-verified inside each `/api/llm/*` handler.
- **Vitest 5 + jsdom (per file) + Testing Library**; Playwright later.
- **pnpm pinned via `packageManager`; Vercel Hobby (300 s Fluid default).**
- Do NOT use: `xlsx` from npm registry (0.18.5, CVEs); `deepseek-chat`/`deepseek-reasoner` (discontinued 2026-07-24); any `NEXT_PUBLIC_` secret; Vercel Password Protection (Pro-only).

### Expected Features (FEATURES.md)
**Table stakes (v1):**
- Multi-file XML drag-and-drop with per-file errors and import report (sample: 143 XML = 133 I + 3 E + 7 P).
- Robust CFDI 4.0 parsing (header, Emisor, Receptor, concepts, taxes at both levels, Descuento, relations, TFD UUID).
- Dedup by UUID (not filename, not Serie+Folio — 12 invoices from one issuer share Serie/Folio).
- Type rules: I adds, E subtracts, P excluded from money but visible. Zero-total invoices (12 bank "servicios de facturación" at Total 0) need an explicit rule.
- Con IVA / sin IVA toggle applied everywhere (charts, tables, averages, export).
- KPIs, monthly trend, averages (monthly, per invoice, per category-month, ticket per supplier), rankings by category and supplier.
- Global filters: month/range, supplier, category, payment form (SAT labels).
- Editable categories with stable ids; supplier default + per-line override.
- Multi-sheet Excel export honoring filters and IVA mode; real numeric/date cells.
- localStorage settings + config JSON export/import.
- Shared password gate on pages and LLM route.
- LLM product grouping + category suggestions with a review queue.
- Unit-price comparison across stores using net unit price `(Importe − Descuento)/Cantidad` and tiered unit normalization.
- Data-quality panel; empty/loading/error states.

**Differentiators (v1.x):** PPD payment-form resolution via P complement; 04-substitution flag and 07-anticipo grouping; manual "excluir/cancelada" toggle; drill-down; month-over-month per category; price history; savings estimate.

**Defer / out of scope:** server storage, accounts, PDF/OCR, SAT descarga masiva, accounting outputs (IVA acreditable, DIOT), multi-currency conversion, full ClaveProdServ catalog (~52k rows), budgets. SAT cancellation lookup is not browser-callable (no CORS) and would send RFCs/totals through the server.

### Architecture (ARCHITECTURE.md)
1. `domain/cfdi` — `parseCfdi(xmlText) → ParseResult` (never throws).
2. `domain/normalize` + `domain/facts` — money, description keys, net/gross per line, category resolution, `buildFacts()` → `LineFact[]` (the only table analytics read; P yields zero facts).
3. `domain/analytics` + `domain/export/buildExportModel` — filters, totals, averages, rankings, price comparison, sheet models; library-agnostic.
4. `domain/grouping` + `domain/settings` — shared zod LLM protocol; settings schema v1 + ordered migrations.
5. `lib/client` — ingest (chunked, UUID dedup), llmClient (sequential resumable batches, retry), excel (lazy import).
6. `stores` — `invoiceStore` (ephemeral), `settingsStore` (persisted, versioned, backup on corruption).
7. Server — `proxy.ts`, `app/api/auth/*`, `app/api/llm/{group,categorize}`; only server reads `process.env`.

ESLint `no-restricted-imports` keeps `src/domain/**` free of React/Next/DOM. LLM output is data (`source: 'llm'`) and never overwrites `source: 'user'`. Persist user decisions keyed by stable identities (RFC, `uuid#index`, description key).

### Critical Pitfalls (PITFALLS.md)
1. **Wrong "sin IVA" / double-counted taxes** — net = `SubTotal − Descuento`; read taxes only from direct-child `Impuestos`; test large-discount and IEPS fixtures.
2. **Misreading E, P and anticipos** — E here is TipoRelacion 07 / FormaPago 30; P has Total 0 and Moneda XXX; exclude E lines from grouping/price comparison.
3. **BOM / namespace / array coercion** — 142/143 files start with BOM, 1 has no XML declaration; select by namespace URI + local name; single `Concepto` must still be an array.
4. **Timezone month-boundary errors** — 8 invoices within 6 h of a month boundary; bucket with `fecha.slice(0,7)`.
5. **LLM nonsense, injection, key/gate leaks** — send only `{id, text}` with `.strict()`; every id returned exactly once; output rendered as text; `/api/llm/*` checks the cookie itself; key only in server env.

## Implications for Roadmap

Suggested dependency chain (9 provisional phases; roadmapper should collapse per `granularity: coarse`):

1. **Foundation + access gate** — scaffold (strict TS, ESLint, Vitest, pinned pnpm/Node), `proxy.ts` gate + login/logout, zod env, `.gitignore` for `.env*` and `Facturas/`, `lang="es-MX"`.
2. **CFDI ingestion + import report** — pure parser, BOM strip, namespace lookups, 4.0 check, UUID dedup, drop zone, import report, anonymized fixtures.
3. **Money/tax/type rules + facts layer** — net/gross semantics, IEPS, I/E/P switch, zero-total rule, date helpers, `buildFacts()`, filter selectors. **Needs user-decision gate.**
4. **Dashboard v1** — KPIs, monthly trend, rankings, averages with explicit denominators, filter bar, IVA toggle, es-MX formatting, data-quality panel.
5. **Categories + persisted settings** — CRUD, supplier default, line override, versioned localStorage, config export/import.
6. **LLM grouping + category suggestions** — protected routes, strict schemas, batching, review queue, privacy notice. **Research/spike flag.**
7. **Unit normalization + price comparison** — tiered normalization, comparison per (group, unit family), non-comparable flag. **Research flag.**
8. **Excel export** — `buildExportModel`, multi-sheet, numeric/date cells, totals tie-out test.
9. **Hardening + QA** — auth curl tests, key not in bundle, payload whitelist test, timezone tests, E2E, `pnpm audit`.

Ordering rationale: gate before any API route (money is spent there); deterministic dashboard before LLM (baseline to judge the LLM); settings schema before LLM; grouping before price comparison; export last as a pure view of stable facts.

## Conflicts Between Research Files (user decisions needed)

**Conflict 1 — XML parser.** STACK: native `DOMParser` + `getElementsByTagNameNS` (no dependency, any prefix, no coercion; needs jsdom in tests, absent in Workers). ARCHITECTURE: `fast-xml-parser` (portable to Node/Worker; must disable coercion and force arrays). At this data size both are milliseconds.

**Conflict 2 — Excel writer.** STACK: write-excel-file 4.1.1 (MIT, small, header styling, formats, frozen rows; single maintainer). PITFALLS: SheetJS 0.20.3 CDN tarball (established; no styling in CE; non-registry install). ExcelJS: richest but ~22 MB and stale.

**Conflict 3 — Money arithmetic.** STACK/ARCHITECTURE: integer centavos at invoice level, floats for unit prices. PITFALLS: decimal library (`big.js`/`decimal.js`) in the domain, round at presentation.

**Conflict 4 — Minor parameters (planner may resolve):** LLM batch size 75 vs 100–200; route `maxDuration` 60 vs 120 s; session token jose JWT vs hand-rolled HMAC (proposed: jose).

## Decisions Needed from User

Project rule: ask before inferring.

**Blocking (stack):**
1. XML parser: DOMParser or fast-xml-parser?
2. Excel writer: write-excel-file, SheetJS CDN, or ExcelJS?
3. Money: integer centavos or decimal library?

**Rules (Phase 3):**
4. Credit note (E) month: its own `Fecha`, or month of the related I when loaded?
5. Zero-total invoices: exclude from counts/averages and list in data-quality panel?
6. "Sin IVA": keep IEPS in (`SubTotal − Descuento + IEPS`) or exclude all taxes? Toggle wording.
7. Sub-cent rounding: keep header totals authoritative and disclose drift?
8. CFDI 3.3 files: reject with clear message, or support?
9. Non-MXN invoices: warn/exclude, or convert with `TipoCambio`? (none in sample)
10. Average denominators: months with data, or calendar months in range?

**Settings (Phase 5):**
11. Category precedence: line override → product-group → supplier default → "Sin categoría"?
12. Parsed invoices: re-drop each session, or persist in IndexedDB?
13. Substituted (04) / cancelled invoices: auto-exclude, flag only, manual toggle?

**LLM (Phase 6):**
14. Send supplier name (not RFC) for category suggestions, or descriptions only?
15. Batch size and privacy notice wording.

**Price comparison (Phase 7):**
16. Which ClaveProdServ families/units are non-comparable by default (services E48/ACT, fuel, utilities)?
17. Savings estimate in v1 or v1.x?

**Lower priority:** route `maxDuration`; TanStack v9 vs v8; pnpm 11 vs 12.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (versions) / MEDIUM (longevity) | Registry-verified and build-tested; parser and Excel writer open |
| Features | MEDIUM-HIGH | Amount semantics from sample data; competitor positioning LOW |
| Architecture | MEDIUM-HIGH | Data model grounded in measured facts; Worker/Turbopack claims LOW |
| Pitfalls | HIGH (CFDI data) / MEDIUM (DeepSeek, Vercel, SheetJS) | |

**Overall: MEDIUM-HIGH.**

### Gaps to Address
- **Sample-data discrepancy — RESOLVED by orchestrator re-check (2026-10-13):** of the 136 non-P invoices, `SubTotal` equals Σ concept `Importe` exactly in 110 and differs by < $0.005 (sub-cent rounding of 6-decimal concept amounts) in 26; none differ by ≥ half a cent. Header totals are authoritative; concept sums tie after rounding.
- SAT catalog labels must be verified against official `catCFDI`.
- TipoRelacion 07/04 semantics: check SAT Anexo 20 guía de llenado.
- DeepSeek runtime behavior (Spanish grouping quality, empty JSON rate, thinking-disabled + JSON, latency) unmeasured — spike before LLM phase.
- Vercel/Next limits, write-excel-file runtime, TanStack v9, shadcn calendar es-MX only build/compile-checked.
- Privacy of fixtures: real XMLs contain RFCs; use anonymized fixtures; `Facturas/` gitignored.

## Sources

**Primary (HIGH):** 143 sample CFDI 4.0 XMLs in `Facturas/2025/`; npm registry (2026-10-13); Next.js docs (ESLint, Proxy, Vitest); Vercel docs (function limits, Password Protection pricing); DeepSeek API docs; scratch-project build verification; `.planning/PROJECT.md`.

**Secondary (MEDIUM):** write-excel-file README; SheetJS install docs and CVE-2023-30533; TanStack Table v9 docs; CFDI TipoRelacion articles; SAT ConsultaCFDIService (CORS absence observed 2026-10-13).

**Tertiary (LOW):** competitor landscape; Turbopack Worker regressions; CVE-2025-29927 versions.

---
*Research completed: 2026-10-13*
*Ready for roadmap: after blocking decisions are answered.*
