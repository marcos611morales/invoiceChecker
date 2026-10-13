# Stack Research

**Domain:** Client-side Mexican CFDI 4.0 (XML invoice) expense-analytics dashboard (Next.js on Vercel, no DB, LLM via server route)
**Researched:** 2026-10-13
**Confidence:** HIGH overall (every version below was resolved from the npm registry on 2026-10-13, and the core combination was installed, linted, type-checked, unit-tested and `next build`-ed in a scratch project). Per-item confidence is given inline.

## Headline Decisions (read this first)

1. **Pin TypeScript to `~6.0.3`, NOT 7.x.** `typescript@latest` is 7.0.2 (native Go compiler), but it has no stable programmatic API and `typescript-eslint@8.71.2` declares `typescript >=4.8.4 <6.1.0`. Installing TS 7 next to the ESLint stack that `eslint-config-next` requires fails (ERESOLVE) or breaks linting. The TS 7.1 API is "several months out". ESLint is a hard user requirement, so TS 6.0.x it is. Revisit when typescript-eslint supports 7.x. (HIGH, verified by registry peer ranges plus install.)
2. **Excel export: `write-excel-file` 4.x, NOT SheetJS and NOT ExcelJS.** MIT, npm-installable (no CDN tarball), supports bold headers, number formats, column widths and frozen rows, multi-sheet, about 1.8 MB unpacked with a single dependency (`fflate`). See "Excel" below. (HIGH for fit, MEDIUM for longevity: a one-maintainer project.)
3. **`middleware.ts` is now `proxy.ts` in Next 16** (Node.js runtime by default). Do the password gate there, and re-verify the cookie inside the LLM route handler (Next docs explicitly say not to rely on Proxy alone). (HIGH, from official docs.)
4. **XML parsing: native `DOMParser` with namespace-aware lookups (`getElementsByTagNameNS`), not fast-xml-parser.** Zero bytes of dependency, correct for CFDI's namespaced/prefix-variable XML, and verified in Vitest+jsdom against a BOM-prefixed document that uses a non-`cfdi:` prefix. (HIGH)
5. **DeepSeek model name is now `deepseek-flash`** (V4.1 Flash, 1M context). The old `deepseek-chat` / `deepseek-reasoner` names were scheduled for discontinuation on 2026-07-24. Thinking mode is ON by default, so disable it explicitly for the grouping job. Make the model an env var. (HIGH, from DeepSeek docs, 2026-09-10 changelog.)
6. **ESLint: stay on 9.39.x** (what `create-next-app` 16.4 installs). ESLint 10.12 exists and `eslint-config-next` supports it, but some bundled plugins (eslint-plugin-react) do not list it in peers yet, which produces peer warnings and can fail under strict peer settings. No benefit to this project from 10. (HIGH)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | 24.x (Vercel default; local 24.14 tested) | Runtime / build | Vitest 5 requires `^22.12 \|\| ^24 \|\| >=26`; Next 16 needs >=20.9. 24 satisfies all. Set `engines.node` and Vercel project Node version to 24.x. | HIGH |
| pnpm | 11.5.2 tested (12.x exists); pin via `packageManager` | Package manager | User-fixed. Vercel auto-detects pnpm from `pnpm-lock.yaml` and honors the `packageManager` field. pnpm 11 uses `allowBuilds` in `pnpm-workspace.yaml` for postinstall scripts (create-next-app writes it). | HIGH |
| Next.js | 16.4.0 (App Router only) | Framework | Current `latest`. App Router is the only router to use for a greenfield project. Turbopack is default for dev and build. `next lint` is removed (use ESLint CLI). `middleware` is renamed `proxy`. | HIGH |
| React / React DOM | 19.3.0 | UI | Required pair for Next 16.4. | HIGH |
| TypeScript | `~6.0.3` (strict) | Language | See Headline #1. Keep `strict: true`, and add `noUncheckedIndexedAccess: true` (the XML-extraction code is full of "might be undefined" lookups; this flag catches them). | HIGH |
| ESLint | `^9.39.5` | Lint (user requirement) | See Headline #6. Flat config only. | HIGH |
| eslint-config-next | 16.4.0 (pin same as `next`) | Lint rules | Ships `core-web-vitals` + `typescript` flat configs (bundles typescript-eslint ^8.56, react-hooks 7.x, jsx-a11y, import). Do NOT also install eslint-plugin-react / typescript-eslint separately. | HIGH |
| Tailwind CSS | 4.3.3 (+ `@tailwindcss/turbopack` as scaffolded) | Styling | `create-next-app` 16.4 scaffolds it; shadcn/ui targets it. CSS-first config (no `tailwind.config.js`). | HIGH |

**`next.config.ts` caveat:** `create-next-app@16.4.0` scaffolds `cacheComponents: true` and `partialPrefetching: true`. Both built clean with a client-heavy page plus a route handler that exports `maxDuration`. This app is almost entirely client-rendered (`"use client"` dashboard), so keep the scaffold defaults unless a specific problem appears. If `cacheComponents` causes friction with `cookies()` in server code, remove it; the app gains nothing from it. (MEDIUM: only tested with toy pages.)

### Client-Side Data Pipeline

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Native `DOMParser` | built-in (browser) | Parse CFDI XML in the browser | See "XML parsing" below. | HIGH |
| zod | 4.6.7 | Runtime validation | Three untrusted boundaries: (1) LLM JSON output, (2) `localStorage` payloads on load (schema drift/corruption), (3) request bodies on the server routes. Also gives inferred TS types. | HIGH |
| date-fns | 4.4.0 | Date grouping / es-MX formatting | `format(d, "LLLL yyyy", { locale: es })` for month labels. CFDI `Fecha` is a zoned-less local timestamp (`2025-05-28T17:38:18`); slice the string for `YYYY-MM` keys and never round-trip through `new Date(...)` for bucketing. | HIGH |
| `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })` | built-in | Money display | No library needed. | HIGH |
| zustand | 5.0.15 | App state + localStorage persistence | See "State" below. | HIGH |

### Database

None, by requirement. Parsed invoices live in memory only (zustand store, not persisted). Only user settings (categories, supplier-to-category map, per-concept overrides, LLM product groups) go to `localStorage`.

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vercel (Hobby is enough) | n/a | Hosting | Fluid compute is default: functions default to 300 s max on all plans, so an LLM grouping call will not time out at the old 10 s limit. Still set `export const maxDuration = 60` in the LLM route. | HIGH |
| Env vars (Vercel) | n/a | Secrets | `DEEPSEEK_API_KEY`, `APP_PASSWORD`, `SESSION_SECRET` (>= 32 random bytes), optional `DEEPSEEK_MODEL`. Never `NEXT_PUBLIC_*`. | HIGH |

Vercel's built-in Password Protection is NOT available on Hobby and costs $20/project/month on Pro, and it would not tie the LLM route to the env-var password the user asked for. Build the gate in-app.

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| shadcn/ui (CLI `shadcn@4.21.4`) | copy-in components | UI components (Button, Select, Popover, Calendar, Card, Table, Chart, Tabs, Dialog, Input) | Default UI kit. Since 2026-07-03 `shadcn init` defaults to **Base UI** (`@base-ui/react` 1.9.0, style `base-nova`); Radix is still supported with `-b radix`. Take the Base UI default for a greenfield app. Verified: `init -d` + `add chart table select button popover calendar card` produced a project that type-checks, lints and builds. It uses the new `cn` package (published by shadcn; replaces clsx + tailwind-merge) and `lucide-react` 1.55. | HIGH |
| recharts | 3.10.1 (shadcn's `chart` component currently resolves `^3.8.0`; either is fine, keep ONE version) | Charts (bar: spend by category/supplier; line: monthly trend; horizontal bar: unit price by store) | React 19 compatible, MIT, SVG, composable; shadcn's `ChartContainer`/`ChartTooltip` wrap it, giving theming and a11y for free. Dataset is tiny (about 150 invoices, about 150 line items), so SVG performance is a non-issue. | HIGH |
| @tanstack/react-table | 9.3.1 (stable `latest`) | Filterable/sortable tables (invoices, concepts) | Headless; pairs with shadcn `Table`. **v9 API differs from v8** (`useTable` + `tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns })`, atom-based state, no `onStateChange`). Verified a v9 sorting table compiles under strict TS 6. Training data and most blog posts are v8, so tell implementers to read the docs/skills shipped inside the installed package (v9 ships TanStack Intent skills). Keep the global filters (date range, supplier, category, payment method) in zustand and feed already-filtered rows to the table; use the table only for sort/pagination/column UI. That also keeps charts, tables and Excel export on one shared filtered dataset. Fallback if v9 friction is high: `8.21.3`. | MEDIUM |
| react-day-picker | 10.0.2 (installed by shadcn `calendar`) | Date-range filter | Pass `locale={es}` from `date-fns/locale`. | MEDIUM |
| react-dropzone | 20.1.3 | Drag-and-drop XML upload, including dropped folders | Handles directory traversal and `accept` filtering; saves hand-rolling `webkitGetAsEntry`. Alternative is a plain `<input type="file" multiple accept=".xml">` plus drag events, which is also fine for a few hundred files. | MEDIUM |
| openai (SDK) | 7.32.0 | DeepSeek client (OpenAI-compatible) | `new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" })`. Node >=22. Server-only import. See "DeepSeek" below. | HIGH |
| jose | 6.2.12 | Sign/verify the session cookie (HS256 JWT) | Web-Crypto based, runs in Proxy and route handlers, tiny. Alternative is hand-rolled HMAC with `crypto.subtle`; jose is less error-prone. | HIGH |
| write-excel-file | 4.1.1 | `.xlsx` export, multi-sheet | See "Excel" below. Import from `write-excel-file/universal`. | HIGH |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vitest | 5.0.4 | Unit tests (parsing, tax/type rules, aggregation, filters, export builders) | Requires Vite 8 (installed transitively; no config needed). Needs `@types/node@^24` (Next template ships `^20`, which triggers a peer warning, so bump it). |
| @vitejs/plugin-react | 6.1.2 | JSX transform for component tests | Peer `vite ^8`. |
| jsdom | 30.1.2 | DOM for `DOMParser` + component tests | Opt in per file with `// @vitest-environment jsdom`; default env stays `node` so pure-logic tests run fast. |
| @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1 | as listed | Component tests | Needed for the few interactive pieces (filters, category editor). |
| @vitest/eslint-plugin | 1.6.27 | Lint test files | Optional; add to the flat config only for `**/*.test.ts`. |
| prettier 3.9.10 + eslint-config-prettier | latest | Formatting | Optional; Next docs show `import prettier from "eslint-config-prettier/flat"` placed last in the flat array. |
| @playwright/test | 1.64.0 | E2E (login gate, upload, export download) | Defer until after the core flow works; Next supports it as an optional peer. |

## Specific Guidance By Area

### ESLint flat config with Next 16 (verified working)

`eslint.config.mjs` (this is exactly what `create-next-app` 16.4 generates; lint ran clean on the scratch project):

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

Scripts: `"lint": "eslint"`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`. There is no `next lint`. Make CI/Vercel run `pnpm lint && pnpm typecheck && pnpm test` before `next build` (or a single `verify` script). Do NOT add the `eslint` key to `next.config.ts` (removed in Next 16).

### XML parsing: DOMParser vs fast-xml-parser

Recommendation: **`DOMParser` + `getElementsByTagNameNS(CFDI_NS, "Concepto")`**, with `CFDI_NS = "http://www.sat.gob.mx/cfd/4"`; the Timbre is in `http://www.sat.gob.mx/TimbreFiscalDigital`.

Why, grounded in the 143 sample files (inspected structurally; no RFCs recorded here):
- **All 143 are UTF-8, and 142 start with a BOM** (`EF BB BF`). Strip with `text.replace(/^\uFEFF/, "")` before parsing; do this unconditionally.
- Namespace prefix is `cfdi:` in every sample but the SAT spec only fixes the namespace URI, not the prefix. Namespace-URI lookups are correct regardless of prefix; string/prefix matching is not. Verified in Vitest+jsdom that a document with prefix `x:` plus a BOM parses correctly.
- Attribute order varies between issuers. Irrelevant with `getAttribute`; also irrelevant with fast-xml-parser, but...
- Complement namespaces vary widely (`pago20`, `ine`, `iedu`, `implocal`, `cce20`, `tfd`, plus unknown vendor ones). With DOM you simply never look at them (except `tfd:TimbreFiscalDigital` for the UUID, and `pago20` only to identify Pago type, which `TipoDeComprobante="P"` already tells you). fast-xml-parser's `removeNSPrefix` flattens everything into one tree where same-local-name elements from different namespaces can collide.
- fast-xml-parser footguns that you would have to disable: it coerces attribute values (`"01"` to `1`, long numeric IDs to floats) unless `parseAttributeValue: false`; a single child vs many yields object vs array unless `isArray` is configured (a one-line CFDI has a single `Concepto`, which is the classic bug). The DOM has neither problem.
- DOMParser is native, so it adds no bundle weight and no supply-chain surface, and it does not resolve external entities.
- Failure detection: check `doc.getElementsByTagName("parsererror").length > 0` (XML mode does not throw) and validate the root is `Comprobante` in the CFDI namespace with `Version === "4.0"`; reject (and report per file) anything else, including CFDI 3.3.

Constraints and mitigations:
- `DOMParser` is unavailable in Web Workers. For about 150 files of about 10 KB each, main-thread parsing takes milliseconds; read files with `file.text()` and parse in batches, yielding with `await` between batches. Only if inputs reach thousands of files, move to a worker with fast-xml-parser (5.11.2, configured with `parseAttributeValue: false`, `removeNSPrefix: false`, explicit `isArray`) as the fallback.
- Parse money with `Number()` from the attribute string, then store invoice-level amounts as **integer centavos** (`Math.round(x * 100)`), and keep `ValorUnitario` (up to 6 decimals in CFDI) as a plain number. This keeps totals reconcilable for the accountant without a decimal library.
- Structure the parser as a pure function `parseCfdi(xmlText: string): ParsedInvoice` so it is trivially unit-testable (jsdom env) against real fixture files copied into `tests/fixtures/` (strip personal data first).
- Tipo de comprobante rules (I adds, E subtracts, P excluded) belong in a separate pure "accounting" layer, not the parser.

### Excel export: SheetJS vs ExcelJS vs write-excel-file

| Criterion | SheetJS CE `xlsx` | ExcelJS 4.4.0 | **write-excel-file 4.1.1** |
|-----------|-------------------|---------------|-----------------------------|
| Install | `xlsx@0.18.5` on npm is **stale** (known registry bug, has published CVEs: prototype pollution, ReDoS). Current 0.20.3 is only on `cdn.sheetjs.com` as a tarball URL. | `pnpm add exceljs` | `pnpm add write-excel-file` |
| pnpm/Vercel caveat | Must use `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (or vendor a `file:` tarball). Lockfile pins it, but every fresh build depends on a third-party CDN; Dependabot/audit tooling mis-reports it. | none | none |
| Cell styling (bold header, fills) | **Not in Community Edition** (Pro only). Number formats and column widths work. | Yes | Yes (`fontWeight`, `backgroundColor`, `align`, `wrap`, `format`, `stickyRowsCount`, column `width`) |
| Multi-sheet | Yes | Yes | Yes (`writeExcelFile([{ sheet, data, columns, stickyRowsCount }, ...])`) |
| Weight | about 1 MB | 21.8 MB unpacked; deps include archiver, unzipper, jszip, fast-csv, tmp (Node-heavy); last published release 4.4.0 (Oct 2023), last registry touch Dec 2024 | 1.8 MB unpacked, single dep `fflate` |
| License | Apache-2.0 | MIT | MIT |

Use `write-excel-file`:
- Import from **`write-excel-file/universal`** (writes to a `Blob`, no Web Worker). The `/browser` entry in v4 spawns Web Workers, which adds bundler risk with Turbopack for no benefit at this data size. Verified: a client component using `universal` with two sheets, bold header, frozen row and a `$#,##0.00` format compiles and builds under Next 16.4 / Turbopack.
- Trigger download with `URL.createObjectURL(blob)` and a temporary `<a download="facturas-YYYY-MM-DD.xlsx">`.
- Build each sheet with a **pure function** `(filteredData) => SheetData` (facturas, conceptos, resumen por categoria, por proveedor, por mes) and unit-test those; the writer itself is a thin call. Because the same filtered selectors feed charts and tables, "respect active filters" falls out for free.
- Use real numeric cells (`type: Number`) with an MXN format such as `"$#,##0.00"` and `Date` cells with format `"dd/mm/yyyy"`, not preformatted strings; the accountant will sum and pivot these. Write RFC/folio/UUID/ClaveProdServ as `String` cells with `format: "@"` so Excel does not mangle them.
- Gap to accept: no autofilter dropdown or formulas-as-first-class; sticky header row is available. Acceptable for this scope.
- Why not ExcelJS: heavier, Node-oriented dependencies, effectively unmaintained; its only edge (richer styling, formulas, images) is not needed. Why not SheetJS: the CDN install is exactly the pnpm/Vercel footgun to avoid, and CE cannot style headers.

### Charting: Recharts 3

Choose Recharts through shadcn's `chart` primitives. Rejected: Tremor (`@tremor/react` 3.18.7, last published Jan 2025, peers React 18 only), Nivo (0.99, May 2025, slower cadence), Chart.js/`react-chartjs-2` (canvas, imperative, worse a11y and theming), ECharts 6 (powerful but large; overkill for about 150 rows), visx (low level, more code). Recharts 3.10.1 was published today and supports React 19. Gotcha: always render charts inside a client component and give `ResponsiveContainer` an explicit height, or it collapses to 0.

### Table/filter: TanStack Table v9 + app-level filters

See supporting-libraries row. Row counts are tiny (about 150 invoices; max 9 line items per invoice in the sample), so **no virtualization** (skip `@tanstack/react-virtual`) and client-side pagination of 25 to 50 rows is enough.

### UI component library: shadcn/ui (Base UI flavor) + Tailwind 4

Why: copy-in code you own (no runtime dependency lock-in), accessible primitives, first-class `chart` and `table` recipes, and the project's `.claude` skills already reference it. Spanish UI: write all copy in Spanish at the component level (centralize strings in one `es-MX` messages module; do not add an i18n framework for a single-locale app). Set `<html lang="es-MX">`.

### State management: zustand 5 with `persist`

- One small store for settings (persisted) and one for session data (parsed invoices, filters; not persisted).
- `persist` with `name: "invoicechecker:settings"`, an explicit `version` and `migrate`, `partialize` to include only settings, and **`skipHydration: true`** with a `rehydrate()` call in a `useEffect` (or a `useHydrated` hook). Otherwise the server-rendered HTML and first client render disagree and React logs hydration errors.
- Validate rehydrated JSON with zod and fall back to defaults on failure. `localStorage` is about 5 MB per origin; settings are small, so this is not a concern (do not persist invoices there).
- Why not Redux Toolkit / Jotai / Context: more ceremony with no gain for two stores; Context alone re-renders the whole dashboard on every filter change.

### DeepSeek client (server route only)

- Package: `openai` 7.32.0 pointed at DeepSeek. Do not use the Vercel AI SDK; there is no chat UI or streaming requirement and it adds a layer.
- Config: `baseURL: "https://api.deepseek.com"`, `model: process.env.DEEPSEEK_MODEL ?? "deepseek-flash"`, `response_format: { type: "json_object" }`, `temperature: 0`.
- **Disable thinking**: it is on by default (effort `high`) and ignores `temperature`; for clustering/classification it only adds latency and cost. Pass `thinking: { type: "disabled" }`. The OpenAI TS types do not know this field, so add a `// @ts-expect-error DeepSeek-specific parameter` on that line (the SDK sends extra params as-is; type-check verified under strict TS 6).
- JSON mode caveats from DeepSeek docs: the prompt must contain the word "json" and an example output shape; set `max_tokens` high enough to avoid truncated JSON; **empty content can occasionally be returned**, so handle it with a retry. Always parse with a zod schema; no strict schema enforcement exists, so validate and re-ask on failure.
- Privacy by construction (project constraint): the request body accepts only `{ id, description }[]` for line items; the route strips anything else with zod `.strict()` before calling DeepSeek. Never send RFC, names or amounts.
- Batching: Vercel functions cap request bodies at about 4.5 MB and the model has a 1M context, but quality drops with giant prompts. Send unique descriptions (dedupe + normalize first) in batches of roughly 100 to 200 and merge groups client-side. Cost is negligible (Flash about $0.15 per 1M input tokens cache-miss, $0.60 per 1M output at off-peak).
- Route: `app/api/llm/group/route.ts`, `export const maxDuration = 60`, `POST` only, verify session cookie first, return 401 otherwise.

### Password gate (Proxy + signed cookie)

- `POST /api/login` (route handler): compare submitted password to `APP_PASSWORD` using `crypto.timingSafeEqual` on SHA-256 digests of both strings (constant-time, equal-length). On success, set cookie `session` = JWT (HS256, signed with `SESSION_SECRET` via `jose`, `exp` about 30 days), attributes `HttpOnly; Secure; SameSite=Lax; Path=/`.
- `proxy.ts` (project root or `src/`): verify the cookie with `jwtVerify`; redirect to `/login` for pages, return JSON 401 for `/api/*` (except `/api/login`). Matcher excludes `login`, `api/login`, `_next/static`, `_next/image`, `favicon.ico`. Verified this compiles/builds on Next 16.4 and registers as `Proxy (Middleware)`.
- **Defense in depth:** also call a shared `requireSession()` inside `/api/llm/*` handlers. Next's docs warn that Proxy matcher changes can silently drop coverage.
- Brute-force reality check: with no DB there is no durable counter. Use a modest artificial delay on failures, a long random password, and (optionally) Vercel's WAF rate-limit rule on `/api/login`. Rotating `SESSION_SECRET` logs everyone out; changing `APP_PASSWORD` should ideally also invalidate sessions (include a hash of the password in the JWT claims and compare in the proxy, or just rotate the secret together with the password).
- Because it is a single shared password, the session identifies no one; do not claim per-user auditing.

### Testing (Vitest)

`vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },   // Vite 8 native; replaces vite-tsconfig-paths
  test: { environment: "node", setupFiles: [] },
});
```

- **Do not install `vite-tsconfig-paths`** (Next's docs still list it): Vite 8 prints "plugin detected, use `resolve.tsconfigPaths`", and the plugin's `tsconfck` peer wants TypeScript ^5 (peer warning under TS 6).
- Parser tests: put `// @vitest-environment jsdom` at the top of the file. Verified green with BOM + custom prefix input.
- Highest-value tests: CFDI extraction against real fixtures (I, E, P types; Descuento; ObjetoImp 01/02; multi-concept), type-based sign rules, IVA vs subtotal selector, unit-price normalization, filter composition, Excel sheet builders, zod schemas for LLM output, localStorage migration.
- Next's docs note Vitest cannot test `async` Server Components; irrelevant here because the UI is client components. Use Playwright E2E later for login + upload + export.

## Installation

```bash
# Scaffold (matches what was verified)
pnpm create next-app@16.4.0 invoicechecker --ts --eslint --tailwind --app --src-dir --import-alias "@/*" --use-pnpm
cd invoicechecker

# Pin the compiler below 6.1 (typescript-eslint peer range) and fix @types/node for Vitest 5
pnpm add -D typescript@~6.0.3 @types/node@^24

# Runtime
pnpm add zustand zod date-fns recharts @tanstack/react-table write-excel-file openai jose react-dropzone

# UI kit (writes components into src/components/ui; Base UI is the default style)
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card chart table select popover calendar tabs dialog input checkbox badge

# Tests
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom

# Optional
pnpm add -D prettier eslint-config-prettier @vitest/eslint-plugin
pnpm add -D @playwright/test   # later phase
```

Also set in `package.json`: `"packageManager": "pnpm@<exact version you develop with>"`, `"engines": { "node": ">=24" }`, and in `tsconfig.json` add `"noUncheckedIndexedAccess": true`.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `DOMParser` | fast-xml-parser 5.11.2 | If parsing must move to a Web Worker (thousands of files), or if you need to run the same parser in Node scripts/server. Configure `parseAttributeValue: false` and `isArray` for `Concepto`/`Traslado`/`Retencion`. |
| write-excel-file | SheetJS CE 0.20.3 (CDN tarball) | If you also need to **read** `.xlsx`/`.csv` (import budgets) or need legacy `.xls`. Accept the CDN-install caveat and no styling. |
| write-excel-file | ExcelJS 4.4.0 | If you need formulas, conditional formatting, images or charts inside the workbook. Accept the weight and low maintenance. |
| Recharts (via shadcn chart) | Tremor, Nivo, ECharts | Tremor only if you want pre-styled KPI cards (it is stale and React 18-only); ECharts for heavy/large datasets or maps. |
| TanStack Table 9.3.1 | TanStack Table 8.21.3 | If implementers hit v9 friction or want abundant v8 examples. Both are headless; swapping is contained to the table components. |
| Base UI shadcn style | Radix style (`shadcn init -b radix`) | If a specific shadcn recipe or snippet you want is only documented for Radix. Mixing both in one app is allowed but pointless. |
| zustand `persist` | `useSyncExternalStore` + hand-rolled `localStorage` | If you want zero state dependencies; more code to get hydration right. |
| jose JWT cookie | Opaque random token in a cookie | Not viable without server storage; signed stateless tokens are the right fit for "no DB". |
| `openai` SDK | `@ai-sdk/deepseek` (Vercel AI SDK) | If a streaming chat UI or tool-calling agent is added later. |
| ESLint 9.39.5 | ESLint 10.12.0 | After `eslint-plugin-react` and friends declare ESLint 10 peers. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `typescript@7.x` (native) | typescript-eslint cannot run on it (no stable API until 7.1); peer range `<6.1.0` makes installs fail | `typescript@~6.0.3` |
| `xlsx` from the npm registry (0.18.5) | Outdated copy with known CVEs; the maintained build is CDN-only | `write-excel-file` (or the CDN tarball if reading is required) |
| `exceljs` | 22 MB, Node-oriented deps (archiver, unzipper), stale | `write-excel-file` |
| `write-excel-file/browser` entry | Spawns Web Workers; unnecessary bundler risk | `write-excel-file/universal` + `toBlob()` |
| `middleware.ts` | Deprecated and renamed in Next 16 | `proxy.ts` (`export function proxy`) |
| `next lint` / `eslint` key in `next.config` | Removed in Next 16 | `eslint` CLI + `eslint.config.mjs` |
| `.eslintrc*` / `FlatCompat` | Legacy config; `eslint-config-next` now ships flat configs | `defineConfig([...nextVitals, ...nextTs])` |
| Pages Router | Legacy for greenfield | App Router |
| `deepseek-chat` / `deepseek-reasoner` model names | Scheduled discontinuation 2026-07-24 | `deepseek-flash` (env-configurable) |
| DeepSeek calls from the browser | Leaks the API key | Server route behind the session gate |
| `NEXT_PUBLIC_` prefix on any secret | Inlined into the client bundle | Plain server env vars |
| Vercel Password Protection | Not on Hobby; $20/project/month on Pro; does not gate by env-var password or tie to LLM route | Proxy + signed cookie |
| `vite-tsconfig-paths` | Redundant on Vite 8; TS5-only peer | `resolve.tsconfigPaths: true` |
| `fast-xml-parser` with default options for CFDI | Coerces attribute values, single/array ambiguity, prefix collisions | `DOMParser` with namespace-aware lookups |
| Floats for summing money | Rounding drift versus invoice `Total` | Integer centavos at invoice level |
| `redux`, `swr`, `react-query` | No server data to cache; only the LLM call | zustand + plain `fetch` in a mutation helper |
| `@tanstack/react-virtual`, server pagination | About 150 rows | Client-side pagination |
| Tremor | React 18 peer only, last release Jan 2025 | shadcn chart + Recharts |
| i18n frameworks (next-intl, react-i18next) | Single-locale UI | One `es-MX` strings module + `Intl` / date-fns `es` |

## Stack Patterns by Variant

**If the user later wants invoices to survive a refresh:**
- Persist parsed invoices in IndexedDB (via `idb-keyval`), not `localStorage` (5 MB cap, sync API). This stays within "no server storage".

**If the user later wants the LLM to see amounts or supplier names:**
- Keep the same strict zod request schema and widen it explicitly; the privacy rule is enforced in one place.

**If more than a few thousand XML files are expected:**
- Move parsing to a Web Worker with fast-xml-parser and send normalized records back with `postMessage`.

**If a stronger gate than a shared password is needed:**
- Swap the login route for an OAuth provider (Auth.js) behind the same `requireSession()` seam; do not restructure the API.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.4.0 | react@19.3.0, react-dom@19.3.0, node >=20.9 | `eslint-config-next` must be the same version as `next`. |
| eslint-config-next@16.4.0 | eslint ^9 (and 10), typescript-eslint ^8.56 (bundled) | Bundled typescript-eslint 8.71.x requires `typescript <6.1.0`. |
| typescript@6.0.3 | typescript-eslint 8.71.x, Next 16.4 type-check, Vitest 5 | Verified: `tsc --noEmit`, `eslint`, `vitest run`, `next build` all green. |
| vitest@5.0.4 | vite ^8 (auto), node ^22.12 \|\| ^24, @types/node ^22 \|\| >=24 | Template's `@types/node@^20` gives a peer warning; bump to ^24. |
| @vitejs/plugin-react@6.1.2 | vite ^8 | v6 dropped older Vite. |
| shadcn chart | recharts ^3.8 | shadcn's CLI rewrote the dependency to `^3.8.0`; lockfile still held 3.10.1 earlier, 3.8.0 afterwards. Pin one version deliberately and run the charts after any bump. |
| @tanstack/react-table@9.3.1 | react >=18 | Depends on `@tanstack/react-store`; atom-based state. |
| openai@7.32.0 | node >=22, zod ^3.25 \|\| ^4 (optional peer) | `baseURL` override works for DeepSeek; extra params need `@ts-expect-error`. |
| jose@6.2.12 | Node, Edge, browsers | Works inside Next Proxy (Node runtime default). |
| write-excel-file@4.1.1 | fflate ^0.8.2 | `universal` entry for Blob output. |
| pnpm 11.x | postinstall scripts blocked by default | `pnpm-workspace.yaml` `allowBuilds` (scaffolded: `sharp: false`, `unrs-resolver: false`). Add entries only if a package genuinely needs a build script. |

## Open Questions / Gaps

- **TanStack Table v9 ergonomics** were only compile-checked on a sorting example. Filtering/pagination features in v9 were not exercised; the app-level-filter design deliberately minimizes exposure. Phase planning should include a short spike. (MEDIUM)
- **shadcn `calendar` (react-day-picker 10) es-MX locale and range-selection behavior** not exercised visually. (MEDIUM)
- **write-excel-file `universal` runtime behavior** (Blob generation in a real browser, opening in Excel/Numbers/LibreOffice) was only build-verified, not run. Validate the produced file once, on the real dataset. (MEDIUM)
- **DeepSeek runtime behavior** (quality of Spanish product clustering with `deepseek-flash`, JSON-mode empty-content frequency, rate limits) is documented but untested. Needs a prompt/eval spike with the real descriptions; likely a deeper-research phase. (MEDIUM)
- **`cacheComponents: true` scaffold default** may constrain server-side `cookies()` usage in route handlers/pages; untested with the real login flow. (LOW to MEDIUM)
- pnpm: 11.5.2 was the version exercised; 12.x is published. Pick one and pin it in `packageManager`.

## Sources

- Next.js docs, ESLint plugin page (v16.4.0, updated 2026-10-05): https://nextjs.org/docs/app/api-reference/config/eslint (HIGH): flat config, `next lint` removal, ESLint 9/10 note.
- Next.js docs, Proxy file convention (v16.4.0): https://nextjs.org/docs/app/api-reference/file-conventions/proxy (HIGH)
- Next.js docs, Vitest guide: https://nextjs.org/docs/app/guides/testing/vitest (HIGH)
- Vercel docs, function duration: https://vercel.com/docs/functions/configuring-functions/duration (HIGH): 300 s default on Hobby with Fluid compute.
- Vercel docs, Password Protection pricing: https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/password-protection (HIGH)
- DeepSeek API docs: https://api-docs.deepseek.com/ , /quick_start/pricing , /guides/json_mode , /guides/thinking_mode , /updates (HIGH, official): model names, thinking toggle, JSON mode caveats, deprecation dates, pricing.
- SheetJS installation docs: https://docs.sheetjs.com/docs/getting-started/installation/nodejs (HIGH): npm registry copy is 0.18.5 and out of date; current 0.20.3 from CDN; pnpm install command.
- write-excel-file package README (npm tarball 4.1.1) (MEDIUM-HIGH): multi-sheet, styles, formats, `universal` entry.
- TanStack Table v9 docs: https://tanstack.com/table/latest/docs/framework/react/guide/table-state (MEDIUM): feature-based API, atom state.
- npm registry (`npm view`, 2026-10-13): all versions, peer ranges, engines, licenses, modification dates (HIGH).
- WebSearch on TypeScript 7 / typescript-eslint incompatibility (third-party summaries, MEDIUM) corroborated by the registry peer range `typescript >=4.8.4 <6.1.0` (HIGH).
- Scratch-project verification (create-next-app 16.4.0 + pnpm 11.5.2 + the packages above): `tsc --noEmit`, `eslint`, `vitest run` (jsdom, BOM + prefix XML), and `next build` all passed, including a Proxy with `jose`, a route handler with `maxDuration`, a TanStack v9 table, a `write-excel-file/universal` multi-sheet client component, and shadcn base-nova components (HIGH for "builds", not for runtime behavior).
- Sample data: `/Users/marcosmorales/Documents/Atzomx/InvoiceChecker/Facturas/2025/*.xml` inspected structurally (143 CFDI 4.0, 142 with UTF-8 BOM, `cfdi:` prefix everywhere, 7 Pago complements, up to 9 conceptos per invoice, assorted complement namespaces).

---
*Stack research for: client-side CFDI 4.0 expense analytics (Next.js / Vercel)*
*Researched: 2026-10-13*
