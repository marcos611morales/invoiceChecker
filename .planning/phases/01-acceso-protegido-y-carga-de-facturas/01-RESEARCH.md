# Phase 1: Acceso protegido y carga de facturas - Research

**Researched:** 2026-10-13
**Domain:** Next.js 16.4 App Router greenfield scaffold + shared-password gate (`proxy.ts` + signed JWT cookie) + browser-only CFDI 4.0 XML ingestion (DOMParser) + import report UI
**Confidence:** HIGH for everything exercised in the scratch spike (auth gate, parser, folder/file ingestion in real Chrome, TanStack v9 table, shadcn base-nova, lint/typecheck/build). MEDIUM for Vercel deployment (pnpm 11 is not officially supported by Vercel; see Pitfall 4 and Open Question 1). LOW for non-Chromium browsers (not exercised).

> **How this research was done.** A throwaway project was scaffolded in the session scratchpad (`create-next-app@16.4.0` + the pinned stack from `.claude/CLAUDE.md`) and the Phase 1 risk areas were built and exercised: proxy + jose cookie (curl against `next start`), `parseCfdi` with DOMParser against the 143 real XML (Vitest+jsdom and real Chrome via Playwright), folder pick and real folder drop (CDP `Input.dispatchDragEvent`), network capture, `beforeunload`, XML entity expansion, CSP, shadcn init/add, TanStack Table v9 sorting+pagination, ESLint rules. Nothing from the scratch project was written into the repo. Real RFCs, names and amounts are deliberately not reproduced here.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Login y sesión**
- **D-01:** La sesión dura 30 días (JWT HS256 con `jose`, cookie `session` HttpOnly; Secure; SameSite=Lax; Path=/).
- **D-02:** Cambiar `APP_PASSWORD` invalida automáticamente todas las sesiones: el JWT incluye un hash derivado de la contraseña actual y el proxy lo compara en cada verificación.
- **D-03:** Con contraseña incorrecta se muestra "Contraseña incorrecta" tras una espera artificial de ~1 s. No hay bloqueo por intentos (no hay DB).
- **D-04:** La pantalla de login es una tarjeta centrada simple: nombre de la app, un campo de contraseña con botón para mostrarla/ocultarla y el botón "Entrar". Sin logo.
- **D-05:** Después del login, el usuario vuelve a la ruta que intentaba abrir mediante `?next=`. Solo se aceptan rutas internas (deben empezar con `/` y no con `//`), para evitar un open redirect. Si no hay ruta o no es válida, va a `/`.
- **D-06:** Una barra superior fija muestra el nombre de la app a la izquierda y "Cerrar sesión" a la derecha. Es el lugar donde después irán el selector de IVA y la exportación.
- **D-07:** Se avisa de la pérdida de facturas en dos casos: (a) un diálogo propio de la app al pulsar "Cerrar sesión" si hay facturas cargadas ("Se borrarán las facturas cargadas"), y (b) el aviso nativo `beforeunload` al recargar o cerrar la pestaña mientras haya facturas cargadas. Sin facturas cargadas, no se avisa.

**Zona de carga**
- **D-08:** Los lotes se suman: soltar más archivos agrega a lo ya cargado y los UUID repetidos se reportan como duplicados. Hay un botón "Quitar todas" para empezar de cero.
- **D-09:** Estado vacío: una tarjeta grande centrada, con borde punteado, el texto "Arrastra tus XML o la carpeta aquí" y los botones "Seleccionar archivos" y "Seleccionar carpeta".
- **D-10:** Con facturas cargadas, la tarjeta grande desaparece. Un botón "Agregar facturas" en la barra abre el selector y se pueden soltar archivos en cualquier parte de la ventana (un recuadro aparece al arrastrar).
- **D-11:** Una barra de progreso muestra "Procesando N de M" mientras se parsea (en lotes, cediendo el hilo entre lotes).
- **D-12:** Los archivos que no son XML ni PDF se ignoran y se listan en "Ignorados" junto con los PDF. Los archivos ocultos del sistema (`.DS_Store`, `Thumbs.db`, los que empiezan con `.`) se descartan sin listarse.
- **D-13:** Los `.zip` no se abren en esta fase. Se listan como ignorados con el aviso "Descomprime el ZIP y suelta la carpeta".

**Reglas del parser (aceptación/rechazo)**
- **D-14:** Un CFDI 3.3, un XML que no es CFDI o un XML dañado se rechaza, y se muestra el nombre del archivo con el motivo en español (p. ej. "Es CFDI 3.3; solo se acepta 4.0", "No es un CFDI", "XML dañado").
- **D-15:** Un CFDI 4.0 sin `TimbreFiscalDigital`/UUID se rechaza con el aviso "Sin timbre fiscal (no es válido ante el SAT)".
- **D-16:** Si el receptor es distinto, la factura se acepta con aviso. El RFC del café no se fija en el código: se toma el receptor más frecuente entre lo cargado. Las facturas con otro RFC receptor se marcan en el reporte con "Receptor distinto: <RFC>".
- **D-17:** Los tipos Traslado (T) y Nómina (N) se cargan y se reportan aparte ("Traslado: n, Nómina: n"). No cuentan como gasto (la Fase 2 los excluye, igual que los Pagos).
- **D-18:** Si hay duplicados, se conserva la primera factura cargada. El reporte dice con qué archivo choca cada duplicado ("copia.xml es la misma factura que <original> (UUID abreviado)").

**Reporte de importación**
- **D-19:** Arriba hay tarjetas de resumen con Ingreso, Egreso, Pago, Traslado/Nómina (solo si hay), Duplicados, Rechazados e Ignorados. Debajo, cada grupo tiene una sección desplegable con su lista de archivos. La sección de rechazados se abre sola si hay alguno.
- **D-20:** El reporte acumula todos los lotes de la sesión. Al terminar cada lote, un aviso breve resume ese lote ("Se agregaron 20, 3 duplicadas").

**Pantalla después de cargar**
- **D-21:** Debajo del reporte hay una tabla "Facturas cargadas" con las columnas Fecha, Proveedor (nombre del emisor), Tipo, Folio, Total (tal como viene en el XML, formato es-MX con la moneda del XML) y n.º de conceptos.
- **D-22:** La tabla lleva la nota "Montos tal como vienen en cada XML; el cálculo de gasto llega después" y no tiene fila de total ni ninguna suma.
- **D-23:** La tabla se puede ordenar por columna y se pagina de 50 en 50, con TanStack Table (la misma base que la tabla de la Fase 2; así la API v9 se prueba temprano). Para ordenar fechas se usa la cadena ISO literal.
- **D-24:** Al recargar se muestra la zona de carga vacía con la nota "Por privacidad, las facturas no se guardan; vuelve a soltarlas para analizarlas".
- **D-25:** Una línea fija de privacidad en la zona de carga dice: "Tus facturas se procesan en este navegador y no se suben a ningún servidor".

**Despliegue y verificación**
- **D-26:** El proyecto de Vercel lo crea el usuario después. La fase entrega el código listo para desplegar, `.env.example` (`APP_PASSWORD`, `SESSION_SECRET`) e instrucciones de despliegue (Node 24.x y variables de entorno).
- **D-27:** Se usa el dominio por defecto `*.vercel.app`.
- **D-28:** **La fase no se cierra hasta que el usuario despliegue en Vercel y confirme** el criterio de éxito 1 en la URL real. La verificación incluye un checkpoint humano bloqueante para eso.

### Claude's Discretion
- Textos exactos de los mensajes de error y del reporte, más allá de los ejemplos citados.
- Cómo mostrar en la tabla el Total de los complementos de Pago (moneda `XXX`, total 0), por ejemplo "—".
- Componentes shadcn concretos (Card, Dialog, Progress, Sonner/toast, Table) y la distribución visual dentro de los lineamientos anteriores.
- Implementación de la carga de carpetas (react-dropzone o `<input webkitdirectory>`), siempre que funcionen tanto soltar carpetas como los botones "Seleccionar archivos/carpeta".

### Deferred Ideas (OUT OF SCOPE)
- Abrir archivos `.zip` en el navegador (p. ej. la descarga masiva del SAT) — posible mejora futura; en esta fase se ignoran con un aviso.
- Dominio propio — se puede agregar después en Vercel.

**Out of this phase (CONTEXT domain):** reglas de montos (I/E/P, con/sin IVA, $0, TipoCambio), KPIs, filtros, categorías, Excel, LLM. La tabla de esta fase NO calcula gasto.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEV-01 | Proyecto Next.js + TypeScript en modo strict, administrado con pnpm | Scaffold procedure (Pitfall 1: create-next-app refuses the non-empty repo root), exact pins, `strict` already on in scaffolded `tsconfig.json`, add `noUncheckedIndexedAccess`. |
| DEV-02 | `pnpm lint` y `pnpm typecheck` pasan sin errores | Scripts block incl. `next typegen && tsc --noEmit` (verified necessary on a clean checkout), ESLint flat config incl. domain-boundary rule, react-hooks 7 rules to avoid (`set-state-in-effect`). |
| DEV-04 | Desplegable en Vercel con variables de entorno documentadas (`.env.example`) | `.env.example` content, Node 24.x via `engines`, Vercel pnpm-11 caveat + `ENABLE_EXPERIMENTAL_COREPACK=1`, `.vercelignore`, headers; D-28 human checkpoint script. |
| ACC-01 | Contraseña compartida antes de ver cualquier página | `proxy.ts` fail-closed matcher + `session.ts` (verified with curl on `next start`), login/logout routes, `safeNextPath`. |
| ACC-02 | Sesión persiste vía cookie firmada HttpOnly; se puede cerrar sesión | jose HS256 JWT 30 d, cookie attributes verified in `Set-Cookie`, password-hash claim (D-02) verified, logout route clears cookie. |
| CARGA-01 | Arrastrar/soltar o seleccionar varios XML (y carpetas); PDF ignorados y reportados | react-dropzone 20.1.3 + separate `webkitdirectory` input; real folder drop, folder pick and multi-file pick verified in Chrome (143 XML + 143 PDF, `.DS_Store` handled). |
| CARGA-02 | Parseo en el navegador (DOMParser, BOM, cualquier prefijo) sin enviar a servidor | `parseCfdi` verified on 143 real files in jsdom and Chrome; CSP `connect-src 'self'` + Playwright zero-request assertion. |
| CARGA-03 | Solo CFDI 4.0; 3.3 y otros XML rechazados con mensaje por archivo | Reject taxonomy + Spanish copy mapping; synthetic fixtures for 3.3 / non-CFDI / malformed / DTD / no-timbre. |
| CARGA-04 | Duplicados (mismo UUID) se cargan una vez y se reportan | UUID uppercase normalization (26/143 real files carry lowercase letters), first-wins deterministic dedupe, report entry shape. |
| CARGA-05 | Reporte de importación: totales por tipo, duplicados, errores, ignorados | Store/report model, derived selectors (receptor más frecuente, counts), UI mapping to shadcn Accordion (`multiple`) etc. |
| CARGA-06 | Facturas solo en memoria; al recargar hay que volver a cargarlas | Module-level zustand store with no `persist`; `beforeunload` verified in Chrome; reload-clears E2E recipe. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Source: `/Users/marcosmorales/Documents/Atzomx/InvoiceChecker/.claude/CLAUDE.md` (read this session). Treated with the same authority as locked decisions.

- **Stack is fixed:** Next.js 16.4 App Router only, TypeScript `strict: true` (plus `noUncheckedIndexedAccess: true`), pnpm, ESLint 9 flat config via `eslint-config-next` 16.4.0 (do NOT also install eslint-plugin-react / typescript-eslint), Tailwind 4, shadcn/ui Base UI flavor (`base-nova`), zod 4, zustand 5, jose 6, react-dropzone 20, Vitest 5 + jsdom, `@types/node` ^24.
- **TypeScript:** pin `typescript` to the 6.0.x line (typescript-eslint peer `<6.1.0`). Never `typescript@7`.
- **Forbidden:** `middleware.ts` (use `proxy.ts`), `next lint` / `eslint` key in `next.config`, `.eslintrc*`/`FlatCompat`, Pages Router, `vite-tsconfig-paths`, `fast-xml-parser` default options for CFDI, floats for summing money, Redux/SWR/react-query, i18n frameworks, Vercel Password Protection, `NEXT_PUBLIC_` prefix on secrets.
- **Parsing:** native `DOMParser`, namespace-URI lookups (never prefix/string matching), strip BOM unconditionally, detect failure with `parsererror`, validate root is `Comprobante` in the CFDI namespace with `Version="4.0"`, parser is a pure function `parseCfdi(xmlText)`, Tipo rules (I adds, E subtracts, P excluded) belong in a separate accounting layer (Phase 2), not the parser.
- **State:** zustand; session store (invoices, not persisted) separate from settings store (persisted, Phase 3).
- **Auth:** `proxy.ts` + signed cookie via `jose`; env vars `APP_PASSWORD`, `SESSION_SECRET` (>= 32 random bytes), never `NEXT_PUBLIC_*`; `crypto.timingSafeEqual` over SHA-256 digests; defense in depth via a shared `requireSession()` for `/api/llm/*` (Phase 4).
- **Process:** ask the user before inferring ambiguous decisions (see Open Questions); `Facturas/` stays out of git; test fixtures must be anonymized; GSD workflow enforcement (changes go through GSD commands).
- **Language:** UI strings in Spanish (es-MX); single locale module, no i18n framework.

## Summary

Phase 1 is a greenfield vertical slice: scaffold the Next.js 16.4 project, gate every route behind a shared password, and let the user drop `Facturas/2025/` (or pick files/a folder) to get a trustworthy import report entirely in the browser. Everything the plan needs was exercised in a scratch project and works as the locked stack describes, with a handful of concrete corrections the planner must carry (listed under Pitfalls): `create-next-app` refuses to run in the non-empty repo root, `pnpm typecheck` must run `next typegen` first, `shadcn init` emits a self-referencing `--font-sans`, shadcn's `sonner` drags in `next-themes`, the open-redirect guard needs a second check after URL normalization (`/.//evil.com`), TanStack v9 numeric columns sort descending first unless told otherwise, and `useSearchParams`/`searchParams` break the build under the scaffold's `cacheComponents: true`.

The auth gate (proxy + jose JWT with a keyed password-hash claim) was verified end to end with curl against a production build: unauthenticated pages redirect to `/login?next=...`, unauthenticated `/api/*` returns JSON 401, tampered and `alg:none` tokens are rejected, changing `APP_PASSWORD` invalidates old cookies (D-02), missing env vars fail closed and surface as `server_not_configured`, and a wrong password takes about 1.0 s (D-03). The parser (DOMParser, namespace-URI child lookups, BOM strip, DTD pre-reject) parses all 143 real files in about 80 ms under jsdom and 25 ms in Chrome, reproducing the ROADMAP numbers exactly (133 I, 3 E, 7 P, 143 unique UUIDs, 362 conceptos). In real Chrome, picking a folder (`webkitdirectory`), picking multiple files, and dropping a real folder all yielded 143 XML + 143 PDF with zero network requests carrying any body; `beforeunload` fires on reload when invoices are loaded; Chrome's DOMParser stops entity-expansion bombs (parsererror) and does not load external entities.

The one real deployment risk is outside the code: **Vercel's docs list pnpm 6-10 only, and `pnpm@11.5.2` (what the scaffold pins) is honored only when Corepack is enabled with `ENABLE_EXPERIMENTAL_COREPACK=1`** (community-reported workaround, not an official Vercel statement). Because D-28 makes a real Vercel deploy the phase gate, the deployment instructions must include that variable (or the user must choose pnpm 10). This is Open Question 1.

**Primary recommendation:** Build the first plan as a walking skeleton (scaffold + `proxy.ts`/login/logout + a plain file/folder input that runs the real `parseCfdi` and prints I/E/P counts + `.env.example` + green `lint`/`typecheck`/`test`/`build`), then layer the domain pipeline, the shadcn UI from UI-SPEC, and the hardening/E2E/deploy checkpoint on top, reusing the verified code in this document.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Password gate for every page | Frontend Server (Proxy, Node runtime) | API / Backend (login/logout route handlers) | `proxy.ts` runs before render; fail-closed matcher; route handlers own credential check and cookie issuance. |
| Password check, JWT sign/verify, `APP_PASSWORD` rotation invalidation | API / Backend (`src/lib/server/session.ts`) | Frontend Server (proxy imports `verifySessionToken`) | Secrets (`APP_PASSWORD`, `SESSION_SECRET`) are server-only; the same module is used by proxy and handlers. |
| `?next=` open-redirect guard | Browser / Client (final navigation) | Frontend Server (proxy builds `next`) | Navigation happens client-side after login; guard is a pure function tested in Vitest. |
| File intake (drop, pick files, pick folder) | Browser / Client | — | The File/DataTransfer APIs exist only in the browser; nothing is uploaded. |
| XML parsing and CFDI validation (`parseCfdi`) | Browser / Client (domain layer, DOMParser) | — | Hard requirement: XML never leaves the browser; DOMParser is browser-only (jsdom in tests). |
| Dedupe by UUID, receptor-más-frecuente, import report model | Browser / Client (pure domain + zustand session store) | — | Derived from in-memory parsed invoices; not persisted (CARGA-06). |
| Invoice table sort/pagination | Browser / Client (TanStack Table v9) | — | Display-only over the in-memory store (D-22/D-23). |
| Theme (light/dark) | Browser / Client (`localStorage` + pre-hydration inline script) | Frontend Server (root layout emits the script) | UI preference, persisted per browser, no server involvement. |
| Security headers (CSP, nosniff, noindex) | CDN / Static + Frontend Server (`next.config.ts` `headers()`) | — | Applied by Next/Vercel to every response; `connect-src 'self'` structurally blocks third-party exfiltration of XML content. |
| Unload warning (`beforeunload`), "Cerrar sesión" dialog | Browser / Client | — | Pure client behavior tied to store state (D-07). |
| Secrets/env documentation, deploy config | Build / config (`.env.example`, README, Vercel project settings) | — | No runtime component; D-26/D-28. |

## Standard Stack

### Core (all pinned by `.claude/CLAUDE.md`; versions re-verified against the npm registry on 2026-10-13)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.0 (exact; `latest` dist-tag) | Framework (App Router, Proxy) | [VERIFIED: npm registry `npm view next version` → 16.4.0] Locked by CLAUDE.md. |
| react / react-dom | 19.3.0 | UI | [VERIFIED: npm registry] Pair required by Next 16.4. |
| typescript | 6.0.3 (exact) | Language | [VERIFIED: npm registry versions 6.0.2, 6.0.3, 7.0.2] `typescript-eslint@8.71.2` peer is `>=4.8.4 <6.1.0` [VERIFIED: `npm view typescript-eslint@8 peerDependencies`]. Use `pnpm add -D --save-exact typescript@6.0.3` (Pitfall 3). |
| eslint | ^9 (9.39.5) | Lint | [VERIFIED: scaffold output] `eslint@9.39.5` prints a "no longer supported" deprecation WARN on install; expected, not an error (CLAUDE.md pins 9 for plugin peers). |
| eslint-config-next | 16.4.0 | Rules (bundles typescript-eslint, react-hooks 7, jsx-a11y) | [VERIFIED: `npm view eslint-config-next@16.4.0 dependencies`] |
| tailwindcss + @tailwindcss/turbopack | 4.3.3 / ^4 | Styling | [VERIFIED: scaffold output] Scaffold wires the Turbopack loader in `next.config.ts`. |
| zod | 4.6.7 | Body/env validation | [VERIFIED: npm registry] |
| zustand | 5.0.15 | Session store (not persisted) | [VERIFIED: npm registry; seam OK] |
| jose | 6.2.12 | HS256 JWT sign/verify | [VERIFIED: npm registry; seam OK] Works inside `proxy.ts` (Node runtime) — verified. |
| react-dropzone | 20.1.3 | Drop zone (files + folders), `isDragGlobal`, `isProcessing` | [VERIFIED: npm registry + source read] |
| @tanstack/react-table | 9.3.1 | Sortable/paginated table (D-23) | [VERIFIED: npm registry + RTL test] v9 API; ships skills under `node_modules/@tanstack/react-table/skills/`. |
| @base-ui/react, class-variance-authority, cn, lucide-react, tw-animate-css, sonner | as installed by `shadcn init/add` (1.9.0 / ^0.7.1 / ^0.4.0 / ^1.55.0 / ^1.4.0 / ^2.0.8) | shadcn base-nova runtime deps | [VERIFIED: scratch `package.json` lines 13-25] |
| server-only | ^0.0.1 | Marks `src/lib/server/*` server-only | [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md:595 `pnpm add server-only`] Seam flag SUS is `no-repository` (a React-team placeholder package); optional but recommended. |

### Supporting / Dev

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn (CLI) | 4.21.4, **as devDependency** (exact) | `init`/`add` + `shadcn/tailwind.css` import | Moving it to `devDependencies` makes `pnpm audit --prod` clean (`braces` high advisory arrives only via `shadcn>ts-morph>...`); build still works. [VERIFIED: scratch run] Vercel installs devDependencies for the build [CITED: vercel.com/docs/builds/configure-a-build "Install Command … including devDependencies"]. |
| vitest | 5.0.4 | Unit/component tests | `resolve.tsconfigPaths: true` resolves `@/` (verified). |
| jsdom | 30.1.2 | `DOMParser` + RTL | Opt in per file: `// @vitest-environment jsdom`. |
| @vitejs/plugin-react | 6.1.2 | JSX in tests | |
| @testing-library/react 16.3.3, /dom 10.4.2, /jest-dom 7.0.1 | | Component tests (table) | |
| @types/node | ^24 (24.19.2) | Vitest 5 peer | Scaffold ships ^20; bump it. |
| @playwright/test | 1.64.0 | E2E smoke (login gate, folder pick, no-network, reload clears) | Use `channel: "chrome"` locally (see Environment Availability). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-dropzone for folder drops | Hand-rolled `webkitGetAsEntry` | Don't: react-dropzone/file-selector already does directory traversal (incl. File System Access handles) and drops `.DS_Store`/`Thumbs.db`. |
| `useSearchParams` for `?next=` | `new URLSearchParams(window.location.search)` at submit | `useSearchParams`/`searchParams` fail the build without `<Suspense>` (verified both with and without `cacheComponents`); reading at submit time needs no framework API. |
| `cacheComponents: true` (scaffold default) | remove `cacheComponents`/`partialPrefetching` | Both build and run (verified). Keep the defaults; removal is a one-line fallback if a later phase hits friction. |
| pnpm 11.5.2 | pnpm 10.x | pnpm 10 is officially supported on Vercel; pnpm 11 needs Corepack env var. See Open Question 1. |

**Installation (after scaffolding, from the repo root):**
```bash
# scaffold happens in a temp dir and is copied in (Pitfall 1); then at repo root:
pnpm add --save-exact jose@6.2.12 zod@4.6.7 zustand@5.0.15 react-dropzone@20.1.3 @tanstack/react-table@9.3.1 server-only
pnpm add -D --save-exact typescript@6.0.3 vitest@5.0.4 jsdom@30.1.2 @vitejs/plugin-react@6.1.2 \
  @testing-library/react@16.3.3 @testing-library/dom@10.4.2 @testing-library/jest-dom@7.0.1 @playwright/test@1.64.0
pnpm add -D @types/node@^24
pnpm dlx shadcn@4.21.4 init -d -y          # base-nova defaults
pnpm dlx shadcn@4.21.4 add button card input input-group field label alert-dialog progress sonner table accordion badge alert spinner scroll-area empty tooltip separator -y
pnpm remove next-themes                    # pulled in by the sonner component; UI-SPEC forbids it
pnpm remove shadcn && pnpm add -D --save-exact shadcn@4.21.4   # keep it out of --prod audit
```
**Version verification:** every version above was confirmed with `npm view <pkg> version` on 2026-10-13; scaffold output in this session printed `next 16.4.0`, `react 19.3.0`, `@tailwindcss/turbopack 4.3.3`, `eslint 9.39.5`, and "using pnpm v11.5.2".

## Package Legitimacy Audit

`gsd-tools query package-legitimacy check --ecosystem npm …` was run for every package. **No package returned SLOP.** The `SUS` verdicts come from two mechanical signals, not from name or provenance problems: `too-new` (the *latest version* was published within the last few days — e.g. `next` 16.4.0 on 2026-10-06, `zod` 4.6.7 on 2026-10-12) and `unknown-downloads` (the downloads lookup returned 0 for old, ubiquitous packages like `clsx`, `@types/react`). Every flagged package has a public GitHub repo, no `postinstall` script (`npm view <pkg> scripts.postinstall` empty for next, react-dropzone, @tanstack/react-table, shadcn, @base-ui/react, jose, zod, zustand, lucide-react, cn, vitest, jsdom, server-only, @playwright/test, @tailwindcss/turbopack), and is named in `.claude/CLAUDE.md` (user-locked, previously build-verified).

| Package | Registry | Latest published | Weekly downloads | Source repo | Verdict | Disposition |
|---------|----------|------------------|------------------|-------------|---------|-------------|
| react, react-dom, typescript, zustand, jose, tailwindcss, @tailwindcss/postcss, @tailwindcss/turbopack, sonner, file-selector | npm | 2026-07 … 2026-09 | 0.8M – 188M | yes (github) | OK | Approved |
| next, eslint, eslint-config-next, zod, react-dropzone, @tanstack/react-table, vitest, jsdom, shadcn, lucide-react, @vitejs/plugin-react, @playwright/test, attr-accept | npm | 2026-10-02 … 2026-10-13 | 14M – 346M | yes (github) | SUS (`too-new`) | Approved with ONE consolidated `checkpoint:human-verify` (see below) |
| @testing-library/react, /dom, /jest-dom, @types/node, @types/react, @types/react-dom, @base-ui/react, cn, date-fns*, tw-animate-css, class-variance-authority, clsx, tailwind-merge | npm | various | 0 (lookup gap) | yes (github / DefinitelyTyped / mui / shadcn-ui) | SUS (`unknown-downloads`, some also `too-new`) | Same consolidated checkpoint |
| server-only | npm | 2022-09 | 22M | none (`no-repository`) | SUS | Keep; documented in Next's own docs (see above) |
| typescript@6.0.3 (spec form) | npm | — | — | — | SLOP only because the seam was given `name@version`; bare `typescript` is OK and `6.0.3` exists | No action |

\* `date-fns` is not needed in Phase 1 (dates are sliced from the literal ISO string); do not install it yet.

**Packages removed due to SLOP:** none.
**Packages flagged SUS:** the groups above. Per protocol, the planner adds `checkpoint:human-verify` before installs. To avoid ~30 per-package checkpoints for top-100 npm packages, **use one checkpoint in the scaffold task** that shows the user the exact pinned list (this document's Installation block) and the committed `pnpm-lock.yaml` diff, with `pnpm audit --prod` output, and proceeds on approval. Mitigations already in place: exact pins, lockfile committed, no postinstall scripts, `allowBuilds` leaves build scripts blocked for `sharp`/`unrs-resolver`.

## Architecture Patterns

### System Architecture Diagram

```
                           BROWSER (nothing from the XML ever leaves here)
 ┌───────────────────────────────────────────────────────────────────────────────────┐
 │  /login  (client form) ──POST {password}──────────────┐                            │
 │       ▲  window.location.assign(safeNextPath(next))   │                            │
 │       │                                                │                            │
 │  /  AppShell (client)                                  │                            │
 │   ├─ TopBar: Agregar facturas · ThemeToggle · Cerrar sesión ──POST /api/auth/logout │
 │   ├─ Dropzone (react-dropzone root = whole window, noClick) ◄── drop / pick files   │
 │   │     + hidden <input webkitdirectory> ◄── "Seleccionar carpeta"                  │
 │   │                         │ File[]                                                │
 │   │                         ▼                                                       │
 │   │   ingest(files)  ── classify by name (hidden→drop, pdf/zip/other→ignored,      │
 │   │        │             xml→queue) ── chunks of 25: file.text() ── parseCfdi() ──┐ │
 │   │        │ onProgress(N,M) → Progress    (await macrotask between chunks)       │ │
 │   │        ▼                                                                       │ │
 │   │   BatchResult[{file, ok|reject|ignored}] ──applyBatch (file order, first wins)─┘ │
 │   │        ▼                                                                         │
 │   │   zustand sessionStore (NOT persisted): invoices[], rejected[], duplicates[],    │
 │   │        ignored[]  ──selectors──► counts · receptor más frecuente · mismatches    │
 │   └─ ImportReport (cards + Accordion) · InvoiceTable (TanStack v9: sort, 50/page)   │
 │   beforeunload registered only while invoices.length > 0                            │
 └──────────────────┬───────────────────────────────────────────────────────────────────┘
                    │ HTTPS; only {password} (login) and an empty POST (logout) are sent
 ┌──────────────────▼───────────── VERCEL (Node runtime) ──────────────────────────────┐
 │ proxy.ts (matcher: everything except _next/static, _next/image, favicon.ico)        │
 │   public: /login, /api/auth/*   else verifySessionToken(cookie "session")           │
 │   fail → pages: 307 /login?next=<path>  ·  /api/*: 401 JSON                          │
 │ app/api/auth/login/route.ts  (zod body, timingSafeEqual, 1 s delay on failure,       │
 │                               Set-Cookie session=JWT(HS256, pwd-claim, 30 d))        │
 │ app/api/auth/logout/route.ts (Set-Cookie session=; Max-Age=0)                        │
 │ lib/server/session.ts  env: APP_PASSWORD, SESSION_SECRET                             │
 │ next.config.ts headers(): CSP (connect-src 'self'), nosniff, Referrer-Policy, noindex│
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
.
├── .env.example                     # APP_PASSWORD, SESSION_SECRET (documented, empty values)
├── .vercelignore                    # Facturas/  (defense: real invoices must never be uploaded)
├── AGENTS.md                        # emitted by create-next-app; keep and commit
├── README.md                        # replace scaffold text with run + deploy instructions (D-26)
├── next.config.ts                   # keep cacheComponents/partialPrefetching + headers()
├── eslint.config.mjs                # next vitals + ts + src/domain import boundary
├── vitest.config.mts · vitest.setup.ts
├── playwright.config.ts · e2e/*.spec.ts
├── tests/fixtures/                  # ANONYMIZED/synthetic XML only
└── src/
    ├── proxy.ts
    ├── app/
    │   ├── layout.tsx               # lang="es-MX", suppressHydrationWarning, theme script, Toaster, TooltipProvider
    │   ├── globals.css              # UI-SPEC tokens (+ fixes from Pitfall 5)
    │   ├── page.tsx                 # server shell -> <AppShell/> (client)
    │   ├── login/{page.tsx,LoginForm.tsx}
    │   └── api/auth/{login,logout}/route.ts
    ├── domain/                      # PURE (DOMParser global only). ESLint: no react/next/zustand/@/lib/@/components
    │   └── cfdi/{parseCfdi.ts, parseCfdi.test.ts}
    │   └── import/{classifyFile.ts, report.ts, dedupe.ts}  (+ tests)
    ├── lib/
    │   ├── server/session.ts        # import "server-only"
    │   └── client/{ingest.ts, theme.ts, format.ts}
    ├── stores/sessionStore.ts       # zustand, no persist
    ├── features/{upload,report,invoices}/…
    └── components/ui/               # shadcn copy-in (edited per Pitfall 5)
```
`domain/` must stay free of React/Next/stores so it runs in Vitest and can move to a worker later; `lib/client/ingest.ts` is the adapter that touches `File`.

### Walking skeleton (WALKING_SKELETON=true): the thinnest real slice

Plan 01 should deliver, and verify with `pnpm lint && pnpm typecheck && pnpm test && pnpm build`:

1. **Scaffold** (Pitfall 1 procedure), exact pins, scripts (below), tsconfig `noUncheckedIndexedAccess`, ESLint domain rule, Vitest config + setup, `.env.example`, `.vercelignore`, `.gitignore` merge.
2. **Auth, real:** `session.ts`, `proxy.ts`, `/api/auth/login`, `/api/auth/logout`, a minimal but functioning `/login` page (password input, Entrar, error text, hard navigation to `safeNextPath(next)`), plus unit tests for `safeNextPath` and token round-trip/rotation.
3. **One real upload→parse→report interaction:** `/` renders a plain `<input type="file" multiple>` and `<input type="file" webkitdirectory>` and, on change, runs the real `parseCfdi` over the XMLs and prints "N XML: I x, E y, P z · PDF ignorados: n" (no zustand/shadcn needed yet).
4. A "Cerrar sesión" button that POSTs logout and navigates to `/login`.
5. The README "Despliegue" section and `.env.example` (D-26), so the later Vercel checkpoint has everything it needs.

This slice is deployable and already proves criteria 1, 2 (counts), 3 (rejections via fixtures) and 5. Later plans replace the plain inputs with the UI-SPEC components and the zustand-backed report/table.

### Suggested plan slicing (planner decides)

| Plan | Content | Depends on |
|------|---------|-----------|
| 01 Walking skeleton | Scaffold, gate, plain upload→parse→counts, scripts, `.env.example`, README deploy section | — |
| 02 Domain + store | Full `parseCfdi` (all fields), `classifyFile`, ingest pipeline, dedupe, report selectors, zustand store, anonymized fixtures + tests | 01 |
| 03 UI | shadcn init/add + token fixes, layout/theme/TopBar, login UI per UI-SPEC, dropzone/overlay/progress, report cards + accordions, toasts, dialogs, TanStack table | 02 |
| 04 Hardening + verification | CSP/headers, Playwright smoke (login gate, folder pick, zero-request, reload clears, beforeunload), security review items, **blocking human checkpoint: deploy to Vercel and confirm criterion 1 (D-28)** | 03 |

### Pattern 1: Scaffold into a non-empty repo root (verified)

`create-next-app` refuses to run in the repo root (`.planning/` and `Facturas/` "could conflict"). [VERIFIED: scratch run, message "The directory proj2 contains files that could conflict: .planning/ Facturas/"]. Procedure:

```bash
SCAFFOLD="$(mktemp -d)"            # outside the repo
pnpm dlx create-next-app@16.4.0 "$SCAFFOLD/invoicechecker" --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm --skip-install --disable-git --yes
# copy everything except .gitignore (merge by hand), then install at the repo root
rsync -a --exclude node_modules --exclude .next --exclude .gitignore "$SCAFFOLD/invoicechecker/" ./
# merge .gitignore: keep the repo's existing 4 lines AND add the scaffold's /node_modules, /.next/, *.tsbuildinfo, next-env.d.ts, .vercel, /coverage …
pnpm install
```
Then: set `"name": "invoicechecker"`, add `"engines": {"node": "24.x"}`, delete `public/*.svg` scaffold assets (proxy gates `public/` files; the login page uses none), replace `README.md`.

Scaffold output facts [VERIFIED: scratch scaffold files]: `next.config.ts` lines 18-19 are `cacheComponents: true,` and `partialPrefetching: true,`; `pnpm-workspace.yaml` is `allowBuilds:` / `  sharp: false` / `  unrs-resolver: false`; `package.json` line 47 is `"packageManager": "pnpm@11.5.2"`; the scaffold `.gitignore` has `.env*` **without** `!.env.example` while the repo `.gitignore` (read this session, lines 1-4) is `Facturas/`, `.env*`, `!.env.example`, `.DS_Store` — merge, never overwrite, or `.env.example` becomes ignored.

### Pattern 2: package.json scripts (names the verifier will call)

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "next typegen && tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
}
```
`pnpm lint` (`eslint` with no args) lints the whole project in ESLint 9 flat config [VERIFIED: it reported errors in `src/domain/bad.ts`]. `typecheck` needs `next typegen` because `LayoutProps`/`PageProps` are generated globals: with `.next` removed, plain `tsc --noEmit` fails with `TS2304: Cannot find name 'LayoutProps'`; after `next typegen` it passes [VERIFIED].

### Pattern 3: Session module, proxy, routes (verified with curl on `next start`)

```ts
// src/lib/server/session.ts
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // D-01

const EnvSchema = z.object({ APP_PASSWORD: z.string().min(1), SESSION_SECRET: z.string().min(32) });
export type AuthEnv = z.infer<typeof EnvSchema>;

/** null = server not configured ("El servidor no está configurado…"); callers fail closed. */
export function readAuthEnv(): AuthEnv | null {
  const p = EnvSchema.safeParse({ APP_PASSWORD: process.env.APP_PASSWORD, SESSION_SECRET: process.env.SESSION_SECRET });
  return p.success ? p.data : null;
}

/** D-02: keyed hash of the current password. Keyed with SESSION_SECRET so the (readable) JWT payload
 *  cannot be used to brute-force the password offline. */
function passwordClaim(env: AuthEnv): string {
  return createHmac("sha256", env.SESSION_SECRET).update(`pwd-v1:${env.APP_PASSWORD}`).digest("hex");
}

export function passwordMatches(submitted: string, env: AuthEnv): boolean {
  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(env.APP_PASSWORD).digest();
  return timingSafeEqual(a, b); // equal length by construction
}

export async function createSessionToken(env: AuthEnv): Promise<string> {
  const key = new TextEncoder().encode(env.SESSION_SECRET);
  return new SignJWT({ pwd: passwordClaim(env) })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_MAX_AGE_S}s`).sign(key);
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const env = readAuthEnv();
  if (!env) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SESSION_SECRET), { algorithms: ["HS256"] });
    const a = Buffer.from(typeof payload.pwd === "string" ? payload.pwd : "");
    const b = Buffer.from(passwordClaim(env));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

/** D-05. Re-checks AFTER URL normalization: "/.//evil.com" normalizes to "//evil.com" (found in the spike). */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return "/";
  try {
    const base = "http://internal.invalid";
    const u = new URL(raw, base);
    if (u.origin !== base) return "/";
    const path = u.pathname + u.search + u.hash;
    if (!path.startsWith("/") || path.startsWith("//")) return "/";
    if (path === "/login" || path.startsWith("/login?") || path.startsWith("/api/")) return "/";
    return path;
  } catch { return "/"; }
}
```
`safeNextPath` is a pure function: put it in a **client-importable** file (e.g. `src/lib/safeNext.ts`, no `node:crypto`/`server-only`) because `LoginForm` (client) must call it before navigating; the snippet above groups it with `session.ts` only to keep the verified test file together. Test vectors verified green: `/`, `/foo?x=1#h`, null, `""`, `foo`, `//evil.com`, `/\evil.com`, `https://evil.com`, `/login`, `/api/auth/logout`, `"/a\r\nb"`, `"/\t/evil.com"`, `/.//evil.com`, `/a/../..//evil.com` (all → `/` except the first two); `/%5Cevil.com` stays literal.

```ts
// src/proxy.ts  — fail closed: matcher excludes only Next's static assets; the public allowlist is inside
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL("/login", request.url);
  const clean = new URLSearchParams(search);
  clean.delete("_rsc"); // Next adds ?_rsc= to RSC/prefetch requests; never leak it into ?next=
  const qs = clean.toString();
  const target = pathname + (qs ? `?${qs}` : "");
  if (target !== "/") url.searchParams.set("next", target);
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```
```ts
// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, createSessionToken, passwordMatches, readAuthEnv } from "@/lib/server/session";

const Body = z.object({ password: z.string().min(1).max(512) }).strict();

export async function POST(request: Request) {
  const env = readAuthEnv();
  if (!env) return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!passwordMatches(parsed.data.password, env)) {
    await new Promise((r) => setTimeout(r, 1000)); // D-03
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(env), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
// logout/route.ts: POST -> new NextResponse(null,{status:204}) + res.cookies.set(SESSION_COOKIE,"",{…same attrs…, maxAge:0})
```
**Verified results (production build, `next start`, curl):** unauth `/` → `307 location: /login`; unauth `/foo?x=1` → `/login?next=%2Ffoo%3Fx%3D1`; unauth `/api/llm/group` POST → `401 {"error":"unauthorized"}`; `/login` → 200; wrong password → `{"error":"invalid_password"} 401` in `1.025s`; right password → `Set-Cookie: session=<jwt>; Path=/; Expires=…; Max-Age=2592000; Secure; HttpOnly; SameSite=lax`; with cookie `/` → 200; tampered token and `alg:none` token → 307; logout → `204` + `Max-Age=0`; static-asset path not redirected; restart with a **changed `APP_PASSWORD`** → old cookie 307 (D-02); restart with **no env vars** → login `{"error":"server_not_configured"} 500` and old cookie 307 (fail closed).

### Pattern 4: `parseCfdi` (DOMParser, namespace-URI child lookups) — verified on the 143 real files

Keep money and rates as the exact XML strings (Phase 2 owns the numeric type; see Open Question 8). Direct-child lookups by `(namespaceURI, localName)` avoid the double-count/`Impuestos`-at-two-levels trap and any prefix dependence.

```ts
// src/domain/cfdi/parseCfdi.ts (verified: 143 files → I 133, E 3, P 7; 362 conceptos; 340 with concept taxes;
// 7 pagos / 7 doctos; 7 relacionados; 10 without Folio; 65 TipoCambio; 68 Descuento; 143 unique UUIDs)
export const NS_CFDI4 = "http://www.sat.gob.mx/cfd/4";
export const NS_CFDI3 = "http://www.sat.gob.mx/cfd/3";
export const NS_TFD = "http://www.sat.gob.mx/TimbreFiscalDigital";
export const NS_PAGO20 = "http://www.sat.gob.mx/Pagos20";
export const TIPOS = ["I", "E", "P", "T", "N"] as const;
export type TipoComprobante = (typeof TIPOS)[number];
export type RejectReason = "cfdi-3x" | "not-cfdi" | "malformed" | "no-timbre" | "too-large";
export type ParseResult = { ok: true; invoice: ParsedInvoice } | { ok: false; reason: RejectReason; detail?: string };
// ParsedInvoice: uuid, version "4.0", fecha, tipo, serie|null, folio|null, moneda, tipoCambio|null, formaPago|null,
// metodoPago|null, subTotal, descuento|null, total, totalImpuestosTrasladados|null, totalImpuestosRetenidos|null,
// emisor{rfc,nombre}, receptor{rfc,nombre|null}, relacionados[{tipoRelacion,uuids[]}],
// conceptos[{claveProdServ,noIdentificacion,cantidad,claveUnidad,unidad,descripcion,valorUnitario,importe,descuento,
//            objetoImp,traslados[],retenciones[]}], pagos[{fechaPago,formaDePagoP,monedaP,monto,doctos[{idDocumento,monedaDR,impPagado}]}]
// (all money/rates as strings; add sourceFile at ingest time, not in the parser)

const MAX_XML_CHARS = 2_000_000;
const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
function kids(parent: Element | undefined, ns: string, local: string): Element[] {
  return parent ? Array.from(parent.children).filter((c) => c.namespaceURI === ns && c.localName === local) : [];
}

export function parseCfdi(xmlText: string): ParseResult {
  const text = xmlText.replace(/^\uFEFF/, "");                                  // BOM: unconditional
  if (text.length > MAX_XML_CHARS) return { ok: false, reason: "too-large" };
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return { ok: false, reason: "malformed", detail: "dtd" }; // CFDI never has a DTD
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return { ok: false, reason: "malformed" };
  const root = doc.documentElement;
  if (root.localName !== "Comprobante") return { ok: false, reason: "not-cfdi" };
  if (root.namespaceURI === NS_CFDI3)
    return { ok: false, reason: "cfdi-3x", detail: root.getAttribute("Version") ?? root.getAttribute("version") ?? "3.x" };
  if (root.namespaceURI !== NS_CFDI4) return { ok: false, reason: "not-cfdi" };
  const version = root.getAttribute("Version");
  if (version !== "4.0") return { ok: false, reason: "cfdi-3x", detail: version ?? "" };
  const tipo = root.getAttribute("TipoDeComprobante") as TipoComprobante | null;
  if (!tipo || !TIPOS.includes(tipo)) return { ok: false, reason: "not-cfdi" };
  const complemento = kids(root, NS_CFDI4, "Complemento");
  const tfd = complemento.flatMap((c) => kids(c, NS_TFD, "TimbreFiscalDigital"))[0];
  const uuid = tfd?.getAttribute("UUID")?.trim().toUpperCase() ?? "";            // 26/143 real files have lowercase letters
  if (!UUID_RE.test(uuid)) return { ok: false, reason: "no-timbre" };
  /* …then build ParsedInvoice from root attributes, kids(root, NS_CFDI4, "Emisor"|"Receptor"|"Impuestos"|"Conceptos"|
     "CfdiRelacionados"), concept-level Impuestos/Traslados/Traslado, and Complemento/pago20:Pagos/Pago/DoctoRelacionado … */
}
```
Reject-reason → Spanish copy (UI-SPEC "Rejected reasons"): `cfdi-3x` → "Es CFDI {detail}; solo se acepta 4.0" (UI-SPEC literal is "Es CFDI 3.3…"; interpolating the real version keeps it true for 3.2); `not-cfdi` → "No es un CFDI"; `malformed` → "XML dañado"; `no-timbre` → "Sin timbre fiscal (no es válido ante el SAT)"; read failure (`file.text()` throws) → "No se pudo leer el archivo"; `too-large` is **new** (Open Question 4).

Structural facts about the real data (measured, no personal data): 143 files, 830,746 bytes total, max 10,081; root `Comprobante` in `http://www.sat.gob.mx/cfd/4` with prefix `cfdi` in all 143; `Version` 4.0 in all; `TimbreFiscalDigital` (ns `http://www.sat.gob.mx/TimbreFiscalDigital`) is always a direct child of `Complemento`; the only other complement is `Pagos20` (7); 142 files start with a BOM, 1 has neither BOM nor `<?xml` declaration; 0 contain `<!DOCTYPE`/`<!ENTITY`; 1 distinct receptor RFC; `Folio` missing in 10, `Serie` in 18; `Moneda` MXN 136 / XXX 7; Conceptos per invoice 1-13; the folder also contains one hidden `.DS_Store`.

### Pattern 5: Ingest pipeline (verified in Chrome: 143 XML parsed in ~25 ms)

```ts
// src/lib/client/ingest.ts (sketch of the verified loop)
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));
export type FileKind = "hidden" | "xml" | "pdf" | "zip" | "other";
export function classifyFile(name: string): FileKind {
  if (name.startsWith(".") || name.toLowerCase() === "thumbs.db") return "hidden";   // D-12 (covers "._x.xml" AppleDouble too)
  const n = name.toLowerCase();
  return n.endsWith(".xml") ? "xml" : n.endsWith(".pdf") ? "pdf" : n.endsWith(".zip") ? "zip" : "other";
}
// 1) classify everything up front (hidden dropped silently; pdf/zip/other → ignored entries, no read)
// 2) M = number of XML files; for i in chunks of 25: Promise.all(batch.map(async f => parseCfdi(await f.text())))
//    (Promise.all preserves order); report progress (≤ every 100 ms); await yieldToMain()
// 3) applyBatch(results) sequentially IN FILE ORDER: first UUID wins, later → duplicates[{file, originalFile, uuid}]
```
`file.text()` rejection → rejected entry `unreadable`. Use `file.name` for the list label and `(file as FileWithPath).path ?? file.webkitRelativePath` as tooltip/path (formats observed: folder drop `/2025/<name>`, folder input `2025/<name>`, file picker/drop `./<name>`).

### Pattern 6: Session store and derived report (zustand, not persisted)

Module-level `create()` store with `invoices: Array<{file, invoice}>`, `seenUuids` map (uuid → first file), `rejected`, `duplicates`, `ignored`, `generation`. Actions: `applyBatch(result, generation)` (ignored if generation changed), `clearAll()` (increments generation; used by "Quitar todas" and logout so an in-flight ingest cannot write afterwards). **No `persist` middleware** — CARGA-06. Never call actions during render (the module also loads on the server during prerender; nothing is ever put there). Derived (pure, in `domain/import/report.ts`): counts per tipo; `receptorMasFrecuente` (highest count, ties → first seen); `receptorDistinto` list (D-16); `Traslado: n, Nómina: n` (D-17); batch toast text (UI-SPEC format). Register `beforeunload` in an effect keyed on `invoices.length > 0` (verified: Chrome raised the dialog on reload).

### Pattern 7: TanStack Table v9 (verified: RTL test passes under TS 6 strict + ESLint)

```tsx
// module scope (stable): features, columns
const collator = new Intl.Collator("es", { sensitivity: "base" });
const sortFn_es: SortFn<TableFeatures, Row> = (a, b, id) => collator.compare(String(a.getValue(id) ?? ""), String(b.getValue(id) ?? ""));
const features = tableFeatures({
  rowSortingFeature, rowPaginationFeature,
  sortedRowModel: createSortedRowModel(), paginatedRowModel: createPaginatedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text, es: sortFn_es },
});
const helper = createColumnHelper<typeof features, Row>();
const columns = helper.columns([
  helper.accessor("fecha", { id: "fecha", header: "Fecha", sortFn: "text" }),          // literal ISO string (D-23)
  helper.accessor("proveedor", { id: "proveedor", header: "Proveedor", sortFn: "es" }),
  helper.accessor("tipo", { id: "tipo", header: "Tipo", sortFn: "es" }),
  helper.accessor("folio", { id: "folio", header: "Folio", sortFn: "text", sortUndefined: "last" }), // missing folio = undefined, not null
  helper.accessor((r) => Number(r.total), { id: "total", header: "Total", sortFn: "basic" }),
  helper.accessor("conceptos", { id: "conceptos", header: "Conceptos", sortFn: "basic" }),
]);
// component: controlled state
const [sorting, setSorting] = useState<SortingState>([{ id: "fecha", desc: true }]);   // default Fecha desc (UI-SPEC)
const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
const table = useTable({ features, columns, data, state: { sorting, pagination },
  onSortingChange: setSorting, onPaginationChange: setPagination,
  autoResetPageIndex: false,      // UI-SPEC: keep the page if it still exists (clamp manually when it no longer does)
  enableMultiSort: false,
  sortDescFirst: false });        // numeric columns otherwise go DESC first; UI-SPEC wants asc → desc → unsorted
```
Render with `table.FlexRender`, header `<button onClick={column.getToggleSortingHandler()}>`, `aria-sort` from `column.getIsSorted()`, page count `table.getPageCount()`, `table.nextPage()/previousPage()`, `getCanNextPage()`. Verified behaviors: 120 rows → 3 pages of 50; default `aria-sort="descending"` on Fecha; Total click cycles asc → desc → none; Siguiente moves to page 2. The `sortFn` registry keys must be registered in `sortFns` (only `sortFn_basic`, `sortFn_text`, `sortFn_alphanumeric`, `sortFn_datetime`, … exist; there is no `"basic"` built in without registering it). Read `node_modules/@tanstack/react-table/skills/*/SKILL.md` first; most online examples are v8.

### Pattern 8: Theme (UI-SPEC "Theme implementation"), verified pieces

- Pre-hydration inline script in `<head>` of `layout.tsx` (server component) + `<html lang="es-MX" suppressHydrationWarning>`. Verified in production and `next dev` (no console warnings): with OS dark and empty storage the `dark` class is present at `DOMContentLoaded`; with `localStorage["invoicechecker:theme"]="light"` and OS dark → no `dark` class.
- Hook with `useSyncExternalStore` + `MutationObserver` + `matchMedia` listener; **do not** use `useEffect(() => setMounted(true))`: `react-hooks/set-state-in-effect` is an ESLint **error** under `eslint-config-next` 16.4 [VERIFIED]. Use `useSyncExternalStore(noopSubscribe, () => true, () => false)` for a `useMounted()` hook. A typechecked/linted implementation is `src/lib/client/theme.ts` in the scratch project (`useActiveTheme`, `useMounted`, `toggleTheme`) — reproduce from UI-SPEC with these primitives.

### Pattern 9: next.config.ts headers (verified in Chrome: app unaffected, third-party fetch blocked)

```ts
const isDev = process.env.NODE_ENV !== "production";
const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");
// headers(): source "/:path*" → Content-Security-Policy, X-Content-Type-Options: nosniff, Referrer-Policy: same-origin, X-Robots-Tag: noindex, nofollow
```
`'unsafe-inline'` is required (Next's own inline bootstrap scripts + the theme script; a static shell cannot carry per-request nonces). `next/font/google` self-hosts at build, so `font-src 'self'` suffices. Result observed: folder pick still produced 143/133/3/7 with no console errors, and `fetch("https://example.com/collect")` failed with "violates … connect-src 'self'". CSP cannot stop a same-origin POST, so the Playwright assertion below remains the proof for criterion 2.

### Anti-Patterns to Avoid

- **Gating pages with an include-list matcher** (`matcher: ["/dashboard/:path*"]`): silently drops coverage. Keep the exclude-list matcher + in-function public allowlist.
- **`useSearchParams()` / `searchParams` prop for `?next=`** in `/login`: fails `next build` (Pitfall 6).
- **Soft navigation after login/logout** (`router.push`): use `window.location.assign(...)`. Logout must reset module memory and the client router cache; with `cacheComponents` Next keeps hidden routes alive (`<Activity>`), so a hard navigation is the reliable reset. [CITED: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md "Navigation with Activity"]
- **Redirecting authenticated users away from `/login`:** breaks the UI-SPEC logout-failure path (cookie may survive, app navigates to `/login`, user would bounce back into the app). Leave `/login` reachable.
- **Persisting invoices anywhere** (`persist`, localStorage, IndexedDB): CARGA-06.
- **Parsing in a worker / `fast-xml-parser`:** locked out by CLAUDE.md; measured need is nil (25 ms for 143 files).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folder drag-and-drop traversal | `webkitGetAsEntry` recursion | `react-dropzone` (file-selector 5) | Handles directories, File System Access handles, `.DS_Store`/`Thumbs.db`, sets `file.path`; verified with a real folder drop. |
| JWT signing/verification | manual HMAC + base64url | `jose` (`SignJWT`/`jwtVerify`, `algorithms: ["HS256"]`) | Alg pinning, expiry; verified rejects tampered and `alg:none`. |
| Constant-time compare | `===` / early-exit loops | `crypto.timingSafeEqual` over SHA-256 digests | Equal-length requirement is satisfied by hashing. |
| XML parsing | regex / string slicing | native `DOMParser` + namespace-URI child lookup | Prefix-agnostic, BOM/entity-safe in Chrome (verified). |
| Sorting/pagination state | custom table logic | TanStack Table v9 (D-23) | Locked decision; also exercises v9 early. |
| Dialogs, accordions, progress, toasts, tooltips | custom ARIA widgets | shadcn base-nova components (Base UI) | UI-SPEC registry; accessibility for free. |
| Accessible theme state | `useEffect`+`setState` mount flag | `useSyncExternalStore` | Lint rule forbids the former; no hydration mismatch. |
| Open-redirect guard | `startsWith("/")` only | `safeNextPath` (normalize with `URL`, re-check) | `/.//evil.com` and `/\evil.com` bypass naive checks. |

**Key insight:** every deceptively simple piece here (redirect safety, BOM/namespace parsing, folder traversal, v9 sort cycles) has a failure mode that only appeared when it was run against real data or a real browser; reuse the verified snippets and tests rather than re-deriving them.

## Common Pitfalls

### Pitfall 1: `create-next-app` refuses the non-empty repo root
**What goes wrong:** running it in the repo root aborts ("could conflict: .planning/ Facturas/"). Naively copying the scaffold also overwrites `.gitignore`, losing `Facturas/` and `!.env.example`.
**How to avoid:** scaffold into a temp dir (Pattern 1), copy without `.gitignore`, merge it by hand. Verify with `git check-ignore -v Facturas/2025/x.xml .env.example` (first ignored, second NOT ignored).
**Warning signs:** `.env.example` missing from `git status`; `Facturas/` appearing as untracked.

### Pitfall 2: `pnpm typecheck` fails on a clean checkout
**What goes wrong:** `LayoutProps`/`PageProps` are generated by Next; bare `tsc --noEmit` reports `TS2304` when `.next/types` is absent (fresh clone, CI, DEV-02 verifier). **How to avoid:** `"typecheck": "next typegen && tsc --noEmit"` [VERIFIED].

### Pitfall 3: pnpm rewrites `~6.0.3` and TypeScript range
**What goes wrong:** `pnpm add -D typescript@~6.0.3` wrote `"typescript": "^6.0.3"` [VERIFIED]. Today only 6.0.2/6.0.3/7.0.2 exist, so the lock holds 6.0.3, but a future 6.1 would violate typescript-eslint's `<6.1.0` peer. **How to avoid:** `pnpm add -D --save-exact typescript@6.0.3`. Also bump `@types/node` to ^24 (scaffold ships ^20).

### Pitfall 4: Vercel does not officially support pnpm 11
**What goes wrong:** Vercel docs list pnpm 6-10 only; `lockfileVersion '9.0'` (what pnpm 11 writes [VERIFIED: scratch `pnpm-lock.yaml` line 1]) maps to pnpm 9 or 10; the `packageManager` field is honored only with Corepack enabled. [CITED: vercel.com/docs/package-managers; vercel.com/docs/builds/configure-a-build "Corepack": "You can enable Corepack by adding an environment variable with name `ENABLE_EXPERIMENTAL_COREPACK` and value `1`"]. Community thread (no Vercel staff reply): older projects fail on pnpm 11, and `ENABLE_EXPERIMENTAL_COREPACK=1` fixed it for two users [CITED: community.vercel.com/t/pnpm-v11-support/41674, 2026-05/06]; one user still hit `ERR_PNPM_UNSUPPORTED_ENGINE` in a monorepo with a sub-package pin.
**How to avoid:** put `ENABLE_EXPERIMENTAL_COREPACK=1` in the deploy instructions next to `APP_PASSWORD`/`SESSION_SECRET`, keep a single root `package.json` (no monorepo), and let the D-28 checkpoint prove it. Decision belongs to the user (Open Question 1). `[ASSUMED]` that Node 24's bundled Corepack (local: 0.34.6) is also present in the Vercel build image.
**Warning signs:** Vercel build log says "Running install: npm" or "pnpm@9.x/10.x", or `ERR_PNPM_UNSUPPORTED_ENGINE`.

### Pitfall 5: shadcn init/add side effects (all verified in the scratch project)
- **Self-referencing font variable:** after `shadcn init`, `globals.css` has `--font-sans: var(--font-sans);` (line 10) while the scaffold layout defines `--font-geist-sans`; result: no font. Fix: `Geist({ variable: "--font-sans", … })` in `layout.tsx` (keep `--font-geist-mono` for mono, which init maps correctly: `--font-mono: var(--font-geist-mono)`), or point the CSS at `--font-geist-sans`.
- **Dark variant:** init emits `@custom-variant dark (&:is(.dark *));` (line 5); UI-SPEC requires `(&:where(.dark, .dark *))` so `<html class="dark">` itself matches. Edit it.
- **`sonner.tsx` imports `next-themes`** (`useTheme`): remove the import and hook, accept `theme` via props (`<Toaster theme={useActiveTheme()} />`), then `pnpm remove next-themes`.
- **Progress track is `h-1` (4 px)**; UI-SPEC wants 8 px → set `h-2` on `ProgressTrack`.
- **Base UI API differences (Radix habits fail):** composition is via the `render` prop, not `asChild` [VERIFIED: `alert-dialog.tsx:168` `render={<Button variant={variant} size={size} />}`]; Accordion uses `multiple` (boolean, default false) with `value`/`defaultValue` arrays, not `type="multiple"` [VERIFIED: `AccordionRoot.d.ts` `multiple?: boolean`, `@default false`]; `AlertDialog` popup supports `initialFocus` (UI-SPEC: focus the dismiss button) [VERIFIED: `DialogPopup.d.ts` `initialFocus`]; Tooltip needs `<TooltipProvider>` in the layout.
- **Tokens:** shadcn's neutral defaults differ from UI-SPEC (muted-foreground light `#525252` override, dark secondary `#171717`, dark border `#262626`, ring = accent). Apply UI-SPEC values in `:root`/`.dark`.
- **`shadcn` and audit:** it lands in `dependencies`; move to devDependencies (Installation block).
- **`pnpm audit`:** after the move, `pnpm audit --prod` reports no known vulnerabilities; plain `pnpm audit` still lists 1 high (`braces` via shadcn's CLI tree), dev-only.

### Pitfall 6: `useSearchParams()` / `searchParams` break the build under `cacheComponents`
**Verified errors:** `Route "/login": Next.js encountered URL data useSearchParams() in a Client Component outside of <Suspense>`; and for the page prop: `encountered uncached or runtime data during prerendering … searchParams … outside of <Suspense>`. Without `cacheComponents` the hook still errors (`useSearchParams() should be wrapped in a suspense boundary`). **How to avoid:** read `new URLSearchParams(window.location.search).get("next")` inside the submit handler (build passes with and without `cacheComponents`). Also avoid route-segment exports `dynamic`/`revalidate`/`fetchCache` (removed with Cache Components); `maxDuration` remains valid for Phase 4.

### Pitfall 7: Open redirect survives a naive guard
`/.//evil.com` normalizes to `//evil.com` after `new URL(...)`; returning `u.pathname + …` without a second `startsWith("//")` check would hand `//evil.com` to `location.assign` [found by a failing Vitest case]. Backslash and control characters are blocked by the regex and by the origin check. Keep the vectors in a table test.

### Pitfall 8: `?_rsc=` leaks into `next`
Next adds `_rsc` to RSC/prefetch requests; an unauthenticated one would store `/?_rsc=abc` in `next`, and after login the browser would land on a raw RSC payload. The proxy strips it [VERIFIED with `curl -H 'RSC: 1'`].

### Pitfall 9: TanStack v9 defaults fight the UI-SPEC
Numeric columns sort **descending first** by default (a test failed until `sortDescFirst: false`); `autoResetPageIndex` defaults to resetting the page on sort/data change (UI-SPEC says keep the page if it still exists); sort-fn names must be registered in `sortFns`; use `undefined` (not `null`) for missing folio with `sortUndefined: "last"`; keep `features`/`columns` at module scope and avoid inline `data ?? []` fallbacks (unstable inputs re-run row models).

### Pitfall 10: react-dropzone details
- Only `.DS_Store` and `Thumbs.db` are auto-ignored [VERIFIED: `file-selector` source `FILES_TO_IGNORE`]; also drop every dot-prefixed file (D-12) — `._foo.xml` AppleDouble files would otherwise be "XML dañado".
- `useFsAccessApi` defaults to `false` (keep): `open()` uses a hidden `<input type="file">`.
- "Seleccionar carpeta" needs its **own** `<input type="file" multiple webkitdirectory>` (not part of `getInputProps()`); `webkitdirectory` is not in React's typings → spread a cast object; reset `e.target.value = ""` after reading so the same folder can be re-picked.
- Neither picker may set `accept` (PDFs/ZIPs must reach the "ignored" list).
- `isDragGlobal` (drag anywhere in the window) drives the D-10 overlay; `isProcessing` is true while files are being read (use it for "Leyendo archivos…"); `disabled: true` still `preventDefault()`s document drops (so a drop during processing does not make Chrome open the XML in the tab) [VERIFIED: `onDocumentDrop` source comment, issue #1362].
- Make the dropzone **root** the whole app wrapper (`min-h-screen`, `noClick`, `noKeyboard`) so "drop anywhere" works without custom window listeners.
- Chrome will show its own "upload N files to this site?" confirmation for a directory picker; the files are not uploaded. `[ASSUMED]` (not observable headless).

### Pitfall 11: Lowercase UUIDs, missing folio/serie, `XXX` currency
26 of 143 real files carry lowercase letters in the UUID attribute; dedupe on the uppercased, trimmed value or the same invoice is counted twice. `Folio` is absent on 10 invoices → "—". `Intl.NumberFormat("es-MX",{style:"currency",currency:"XXX"})` formats but UI-SPEC wants "—" for Pago/XXX; wrap formatting in `try/catch` and fall back to the raw string for an unknown/invalid currency code.

### Pitfall 12: In-flight ingest vs "Cerrar sesión"/"Quitar todas"
"Quitar todas" is disabled while processing, but logout is not; without a generation/abort check a finishing batch would repopulate the store after logout. Use the `generation` counter (Pattern 6) or an `AbortController` checked between chunks.

### Pitfall 13: `server-only` under Vitest
`import "server-only"` throws outside the react-server condition. Put `vi.mock("server-only", () => ({}))` in `vitest.setup.ts` (verified working). Alternatively skip `server-only` in Phase 1.

### Pitfall 14: Cookie `Secure` and local development
`secure: process.env.NODE_ENV === "production"` keeps Safari working on `http://localhost` in dev (Safari drops Secure cookies over http, `[ASSUMED]`); in production the attribute is set (verified in `Set-Cookie`). E2E must run against `next build && next start`, not `next dev`, to exercise it.

### Pitfall 15: Don't add telemetry
`@vercel/analytics`/`speed-insights` or any third-party script contradicts the privacy line (D-25) and CSP `connect-src 'self'`.

## Code Examples

### Playwright smoke spec — login gate, folder pick, zero-request assertion, reload clears, `beforeunload` (verified as an ad-hoc script; convert to `e2e/ingest.spec.ts`)

```ts
import { test, expect } from "@playwright/test";
const FOLDER = process.env.E2E_FACTURAS_DIR ?? "tests/fixtures/e2e-folder"; // real data only locally

test("folder pick: counts, no request carries XML, beforeunload on reload", async ({ page, context }) => {
  const reqs: { method: string; url: string; body: string | null }[] = [];
  page.on("request", (r) => reqs.push({ method: r.method(), url: r.url(), body: r.postData() }));
  await page.goto("/");                                   // unauthenticated → /login
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Contraseña").fill(process.env.APP_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Seleccionar carpeta" })).toBeVisible();

  const before = reqs.length;
  await page.locator('input[type="file"][webkitdirectory]').setInputFiles(FOLDER);   // Playwright accepts a directory path
  await expect(page.getByText("Reporte de importación")).toBeVisible();
  const after = reqs.slice(before);
  expect(after.filter((r) => r.body)).toHaveLength(0);    // verified: 0 requests after the pick, 0 bodies in the whole session
  expect(reqs.some((r) => r.body?.includes("Comprobante") || r.body?.includes("<?xml"))).toBe(false);

  let dialog: string | null = null;
  page.on("dialog", async (d) => { dialog = d.type(); await d.dismiss(); });
  await page.evaluate(() => location.reload());
  await expect.poll(() => dialog).toBe("beforeunload");   // verified in Chrome
});
```
Real folder **drop** (not just pick) was also verified using CDP: `const cdp = await context.newCDPSession(page); await cdp.send("Input.dispatchDragEvent", { type: "dragEnter"|"dragOver"|"drop", x:600, y:500, data: { items: [], files: [DIR], dragOperationsMask: 1 } })` → 143 XML + 143 PDF, 133/3/7, `.DS_Store` filtered by file-selector, `isDragGlobal` true during the drag. `playwright.config.ts`: `use: { channel: "chrome" }` locally (installed Chrome; the cached Playwright Chromium builds 1228/1248 do not match 1.64), `webServer: { command: "pnpm build && pnpm start", env: { APP_PASSWORD, SESSION_SECRET } }`. Add stable `data-testid`s for the two file inputs only if locators by attribute become brittle.

### Vitest config and setup (verified)

```ts
// vitest.config.mts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },                 // resolves "@/…" (verified); do NOT install vite-tsconfig-paths
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"], setupFiles: ["./vitest.setup.ts"] },
});
// vitest.setup.ts:  import { vi } from "vitest"; vi.mock("server-only", () => ({}));
// parser/table tests start with:  // @vitest-environment jsdom
```

### ESLint domain-boundary rule (verified: `import { useState } from "react"` in `src/domain/` fails lint)

```js
{ files: ["src/domain/**/*.{ts,tsx}"],
  rules: { "no-restricted-imports": ["error", { patterns: ["react","react-dom","react/*","next","next/*","zustand","zustand/*","@/components/*","@/stores/*","@/features/*","@/lib/*"] }] } }
```

### `.env.example` (D-26) — Vercel: set for Production and Preview

```bash
# Contraseña compartida (mínimo 12 caracteres, aleatoria)
APP_PASSWORD=
# Secreto para firmar la cookie de sesión (>= 32 bytes aleatorios): openssl rand -base64 48
SESSION_SECRET=
# Solo en Vercel (pnpm 11 no está en la lista oficial): ENABLE_EXPERIMENTAL_COREPACK=1
```
Rotating `APP_PASSWORD` or `SESSION_SECRET` logs everyone out (D-02 verified for the password). Never prefix with `NEXT_PUBLIC_`. Node: `engines.node = "24.x"` (Vercel default is 24.x and 22.x is the only other option [CITED: vercel.com/docs/functions/runtimes/node-js/node-js-versions]).

### Fixtures: anonymized/synthetic only (DEV-03 is Phase 2, but Phase 1 tests need them)

- Build **synthetic templates** in `tests/fixtures/` (minimal Comprobante with the fields under test) and, for realism, **at most 4-5 derived files** produced by a script `scripts/anonymize-fixture.mjs` that replaces `Rfc`, `Nombre`, `UUID`, `Sello`, `Certificado`, `NoCertificado`, `SelloCFD`, `SelloSAT`, `NoCertificadoSAT`, `RfcProvCertif`, `LugarExpedicion`, `DomicilioFiscalReceptor` and `Descripcion` with neutral values; never commit raw files.
- Cover (selected by structure, not name): BOM + `<?xml` declaration; the one file with **no BOM and no declaration**; single-concepto I; multi-concepto (>= 5) I with `Descuento` and a 6-decimal `ValorUnitario`; I without `Impuestos`; E with `CfdiRelacionados`; P with `pago20:Pagos`; lowercase-UUID file; missing `Folio`.
- Add synthetic rejects: CFDI 3.3 (`cfd/3`), non-CFDI XML (`<foo/>`), truncated XML, `<!DOCTYPE … <!ENTITY …>`, 4.0 without `TimbreFiscalDigital`, custom prefix `x:` with BOM.
- Guard test: if `Facturas/` exists locally, collect every `Rfc="…"` value from it and assert none appears in `tests/fixtures/**` (skipped when the folder is absent, e.g. on Vercel/CI).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts`, `export function proxy`, Node runtime by default | Next 16 | Spike built and registered as "Proxy (Middleware)"; `runtime` export throws in proxy. [CITED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md] |
| `next lint` | `eslint` CLI + flat config | Next 16 | `"lint": "eslint"` works with no args. |
| Radix-style shadcn (`asChild`, `type="multiple"`) | Base UI (`render` prop, `multiple`) | shadcn 2026-07 default `base-nova` | Executor must not paste Radix snippets. |
| TanStack Table v8 `useReactTable` + `getSortedRowModel` | v9 `useTable` + `tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() })`, atom state | v9 | Read the package's bundled skills, not blog posts. |
| `useEffect`+`setState` mounted flags | `useSyncExternalStore` | react-hooks 7 lint rules (`set-state-in-effect` is an error) | Affects theme toggle and any "after mount" label. |
| Vercel pnpm auto-detection by lockfile | Corepack opt-in for pinned/newer pnpm | ongoing | pnpm 11 needs `ENABLE_EXPERIMENTAL_COREPACK=1`. |

**Deprecated/outdated:** `eslint@9.39.5` shows an install-time deprecation warning (expected with the locked stack); ARCHITECTURE.md's "Anti-Pattern 1 (DOM-based parsing)" and its `fast-xml-parser` recommendation are superseded by the locked decision (PROJECT.md Key Decisions: "write-excel-file, DOMParser nativo, big.js"; CLAUDE.md "XML parsing"). ARCHITECTURE.md route names `/api/auth/login|logout` are used here; CLAUDE.md's prose mentions `/api/login` (cosmetic, Open Question 7).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Folder drop / `webkitdirectory` behave the same in Firefox and Safari as verified in Chrome | Pitfall 10, Pattern 5 | Accountant on Safari could not load folders; mitigated by "Seleccionar archivos" always working. Needs a manual check on the user's browsers. |
| A2 | `ENABLE_EXPERIMENTAL_COREPACK=1` + `packageManager: pnpm@11.5.2` yields a working pnpm 11 install on Vercel with Node 24 (only community-reported; Node's bundled Corepack present in the build image) | Pitfall 4, Open Question 1 | Deploy fails at install; D-28 checkpoint catches it; fallback pnpm 10. |
| A3 | Vercel CLI `vercel deploy` honors `.vercelignore`/`.gitignore` so `Facturas/` is never uploaded | Structure, Security | If wrong and the user deploys via CLI, real invoices could be uploaded; keep `Facturas/` out of the repo dir tree used for CLI deploys or deploy via Git. |
| A4 | Vercel serves `*.vercel.app` over HTTPS with HSTS by default (so `Secure` cookies work and no extra header is needed) | Security | Low: `Secure` cookies work over HTTPS regardless; HSTS is hardening only. |
| A5 | Vercel WAF rate-limit rule is available on the Hobby plan for `/api/auth/login` | Security (T1) | Brute-force mitigation falls back to the long random password + 1 s delay (D-03 accepts no lockout). |
| A6 | Chrome shows its own "upload N files" confirmation for directory pickers | Pitfall 10 | None functionally; affects only the UX wording in docs. |
| A7 | Safari drops `Secure` cookies on `http://localhost` (reason for `secure` only in production) | Pitfall 14 | If wrong, the conditional is harmless. |
| A8 | The behavior verified with `next start` locally (Node runtime proxy using `node:crypto` + jose) is identical on Vercel's runtime | Pattern 3 | Auth gate failure on deploy; covered by D-28 checkpoint (criterion 1). |
| A9 | Users' file names rarely collide across folders, so showing `file.name` (path in tooltip) is enough | Pattern 5 | Ambiguous report rows; switch to relative path labels. |

## Open Questions

Per the project rule (ask before inferring), each item lists a recommended option; items 1, 8 and 10 are the ones worth asking the user.

1. **pnpm version and Vercel compatibility** (STATE.md already lists "versión de pnpm" as pending)
   - What we know: pnpm 11.5.2 is what `create-next-app` pins and what CLAUDE.md exercised; Vercel docs list pnpm 6-10; pnpm 11 reportedly works only with `ENABLE_EXPERIMENTAL_COREPACK=1`; D-28 makes a real Vercel deploy the phase gate.
   - What's unclear: whether the user prefers one extra Vercel env var (pnpm 11) or zero-config (pnpm 10).
   - Recommendation: keep pnpm 11.5.2, document `ENABLE_EXPERIMENTAL_COREPACK=1`, and let the D-28 checkpoint prove it; if it fails, switch `packageManager` to `pnpm@10.x` and regenerate the lockfile (`allowBuilds` in `pnpm-workspace.yaml` is pnpm-11 syntax and would need the pnpm-10 equivalent).
2. **Should an authenticated visit to `/login` redirect to `/`?** Recommend **no** (keeps the UI-SPEC logout-failure behavior coherent).
3. **Progress denominator for "Procesando N de M".** Recommend M = number of XML files (PDFs/others are classified instantly and never read).
4. **Size cap.** Recommend a 2 MB per-file cap (real max 10 KB) rejected with a new reason, suggested copy "Archivo demasiado grande (máx. 2 MB)" (the UI-SPEC reason list is closed; this is a discretion addition).
5. **Edge rejects not in the copy list:** invalid `TipoDeComprobante` or malformed UUID. Recommend mapping them to "No es un CFDI" and "Sin timbre fiscal (no es válido ante el SAT)" respectively (done in the verified parser).
6. **Extract `pagos[]` (Pago complement) in the Phase 1 parser?** Recommend yes: already implemented and verified (7/7 on the sample), Phase 2 REGLA-09 needs it, cost is nil.
7. **Auth route names.** Recommend `/api/auth/login` and `/api/auth/logout` (ARCHITECTURE.md) over `/api/login` (CLAUDE.md prose); purely cosmetic.
8. **Money representation conflict.** CLAUDE.md says "integer centavos"; REQUIREMENTS REGLA-04 and PROJECT.md Key Decisions say big.js exact decimals (Phase 2). Recommend the Phase 1 parser keeps **exact XML strings** (no numeric type decision now); the table sorts on `Number(total)` and displays with `Intl.NumberFormat`, with no sums (D-22). Phase 2 plans the numeric type (follow PROJECT.md/REGLA-04).
9. **Security headers/CSP and `.vercelignore`** go beyond the locked decisions but not against them; recommend including (Pattern 9). `'unsafe-inline'` scripts are a known limit.
10. **Playwright in Phase 1?** CLAUDE.md says E2E is deferred; success criteria 2 (no network content) and 4 (reload clears) are only demonstrable in a browser. Recommend one smoke spec in Plan 04 (runs locally against `build && start`; not part of `verify`).
11. **Report path labels:** `file.name` with the relative path in a tooltip (recommended) vs always the relative path.
12. **Keep `AGENTS.md`** emitted by `create-next-app` ("read node_modules/next/dist/docs before coding")? Recommend yes; `next dev` re-adds it anyway.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | yes | v24.14.0 | — |
| pnpm | package manager | yes | global 12.10.1; inside a project with `packageManager: pnpm@11.5.2` commands ran as 11.5.2 | `pnpm dlx` / Corepack |
| npm registry access | installs, `npm view` | yes | npm 11.9.0 | — |
| Corepack | pin pnpm on Vercel / locally | yes | 0.34.6 | — |
| Google Chrome (system) | Playwright `channel: "chrome"`, manual verification | yes | installed in /Applications | `pnpm exec playwright install chromium` (~150 MB; cached 1228/1248 builds do not match 1.64) |
| git | commits | yes | repo on branch `main` | — |
| git remote / GitHub CLI (`gh`) | Vercel Git import (D-26) | **no remote configured, `gh` not installed** | — | User creates the repo and pushes, or deploys with the Vercel CLI (`vercel` not installed either) |
| Vercel CLI | optional deploy | no | — | Git import from the Vercel dashboard |
| Vercel account/project | D-26/D-28 | user-owned | — | Blocking human checkpoint |

**Missing dependencies with no fallback:** none for coding. **Deploy path** needs the user to create the remote/Vercel project (D-26), which is why D-28 is a blocking human checkpoint. The deploy instructions must cover both "push to GitHub and import" and the CLI route, and warn that `Facturas/` must never be in the deployed tree.

## Test Strategy

`workflow.nyquist_validation` is `false` in `.planning/config.json`, so the formal Validation Architecture section is skipped; this is the working test plan.

| Req | Behavior | Test type | Command | Notes |
|-----|----------|-----------|---------|-------|
| ACC-01/02 | token round-trip, password rotation invalidates, tampered/`alg:none` rejected, missing env fails closed | unit (node) | `pnpm test` | `session.test.ts`; env via `vi.stubEnv` (verified) |
| D-05 | `safeNextPath` vectors | unit | `pnpm test` | table test (Pattern 3 list) |
| ACC-01 | unauth redirect/401, cookie attrs | integration (curl script or Playwright `request`) | `pnpm test:e2e` | verified manually with curl |
| CARGA-02/03 | `parseCfdi` accept/reject taxonomy | unit (`jsdom`) | `pnpm test` | synthetic + anonymized fixtures |
| CARGA-04 | dedupe incl. lowercase UUID, first-wins, order | unit | `pnpm test` | pure `applyBatch` |
| CARGA-05 | counts, receptor más frecuente, batch toast text, singular/plural | unit | `pnpm test` | pure report selectors |
| D-23 | table sort cycle, 50/page, keep page | component (RTL) | `pnpm test` | pattern 7 test is verified |
| CARGA-01/06, crit. 2/4 | folder pick/drop → counts; zero request bodies; reload clears; `beforeunload` | E2E (Chrome) | `pnpm test:e2e` | against `build && start` |
| DEV-02 | lint + types | static | `pnpm lint && pnpm typecheck` | |
| DEV-04 | production build with env | build | `pnpm build` | |
| crit. 2 (real data) | 143 XML = 133 I / 3 E / 7 P, 143 PDF ignored | manual UAT + optional local-only test | `E2E_FACTURAS_DIR=Facturas/2025 pnpm test:e2e` | folder is not in git |
| crit. 1 | Vercel gate works on the real URL | **blocking human checkpoint (D-28)** | — | steps: set `APP_PASSWORD`, `SESSION_SECRET` (+ `ENABLE_EXPERIMENTAL_COREPACK=1` if pnpm 11), Node 24.x, deploy, open URL signed-out → login, enter, reload, wait/return, Cerrar sesión |

Sampling: per task `pnpm test` (< 5 s observed for the spike suite); per wave `pnpm verify`; phase gate = `pnpm verify` green + E2E smoke + D-28.

## Security Domain

`security_enforcement` is true, ASVS level 1, block on "high".

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (single shared password) | `timingSafeEqual` over SHA-256 digests; 1 s failure delay (D-03); long random password (>= 12 chars); no lockout is an accepted residual risk (no DB) |
| V3 Session Management | yes | HS256 JWT via `jose`, `algorithms` pinned, `exp` 30 d, cookie `HttpOnly; Secure; SameSite=Lax; Path=/`, password-hash claim for rotation (D-02); stateless logout cannot revoke a stolen cookie until expiry/rotation (documented limit) |
| V4 Access Control | yes | fail-closed `proxy.ts`; `/api/*` JSON 401; per-handler `requireSession()` arrives with the Phase 4 LLM routes |
| V5 Input Validation | yes | zod `.strict()` login body; `Content-Type` check; XML: size cap, DTD/entity pre-reject, DOMParser (Chrome stops entity bombs and does not load external entities — verified); React text nodes only for all XML-derived strings |
| V6 Cryptography | yes | `jose` + `node:crypto` HMAC/hash; never hand-roll; `SESSION_SECRET` >= 32 chars enforced by zod |
| V7 Error handling/logging | yes | generic `invalid_password`; never log password/JWT/XML |
| V8/V9 Data protection & comms | yes | XML never leaves the browser (CSP `connect-src 'self'` + E2E assertion); HTTPS via Vercel |
| V14 Config | yes | CSP, nosniff, Referrer-Policy, `X-Robots-Tag`, no `NEXT_PUBLIC_` secrets, `.env*` ignored, `pnpm audit --prod` clean |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation | Severity if unmitigated |
|---------|--------|---------------------|------------------------|
| Password brute force (no lockout) | Spoofing | 1 s delay, long random password, optional Vercel WAF rate limit (A5); accepted by D-03 | medium (accepted) |
| Timing side-channel on password compare | Info disclosure | SHA-256 digests + `timingSafeEqual` | low |
| JWT forgery / `alg:none` / alg confusion | Spoofing/Tampering | `algorithms: ["HS256"]`, secret >= 32 chars (verified rejections) | high |
| Stale sessions after password change | Elevation | `pwd` claim keyed HMAC compared on every verify (verified) | medium |
| Open redirect via `?next=` | Tampering/Phishing | `safeNextPath` with post-normalization re-check + tests | high (phishing vector on a login page) |
| Gate bypass by matcher drift or `x-middleware-subrequest`-class bugs | Elevation | exclude-list matcher + in-function allowlist; Next 16.4.0 (patched line); handler-level checks in Phase 4 | high |
| XML entity expansion / external entity | DoS/Info disclosure | DOCTYPE/ENTITY pre-reject, 2 MB cap, Chrome limits (verified depth 6 → parsererror, external entity empty) | medium |
| Exfiltration of XML content | Info disclosure | no network code in ingest, CSP `connect-src 'self'`, no analytics, Playwright zero-body assertion | high |
| XSS from XML strings (names, descriptions, file names) | Tampering | React escaping; never `dangerouslySetInnerHTML` except the constant theme script | high |
| Secret leakage into the client bundle | Info disclosure | server-only env, no `NEXT_PUBLIC_`; grep `.next/static` for the secret values in the verification step | high |
| Real invoices committed or deployed | Info disclosure | `Facturas/` in `.gitignore` + `.vercelignore`; anonymized fixtures; fixture guard test | high |
| Clickjacking / indexing | Tampering | `frame-ancestors 'none'`, `X-Robots-Tag` + `metadata.robots` | low |
| Login CSRF | Tampering | `SameSite=Lax`, JSON-only content-type; shared password means no per-user impact | low |
| Supply chain | Tampering | exact pins, lockfile, no postinstall scripts, `pnpm audit --prod`, consolidated human check | medium |

## Sources

### Primary (HIGH confidence)
- Scratch-project experiments run this session (create-next-app 16.4.0, pnpm 11.5.2, Node 24.14.0, Google Chrome via Playwright 1.64.0): auth gate with curl, parser against `Facturas/2025`, folder pick/drop, network capture, `beforeunload`, entity expansion, CSP, shadcn 4.21.4 init/add, TanStack Table 9.3.1 RTL test, lint/typecheck/build, `pnpm audit`.
- Installed Next.js 16.4.0 docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, `…/05-config/01-next-config-js/cacheComponents.md`, `…/02-route-segment-config/index.md`, `maxDuration.md`, `01-getting-started/05-server-and-client-components.md` (server-only).
- Installed package skills/sources: `@tanstack/react-table@9.3.1/skills/*`, `@tanstack/table-core@9.3.1/skills/table-features/references/{sorting,pagination}.md`, `react-dropzone@20.1.3` types + `src/index.tsx`, `file-selector@5.0.1/src/file-selector.ts`, `@base-ui/react@1.9.0` type declarations.
- npm registry (`npm view`) versions and peer ranges, 2026-10-13; `gsd-tools query package-legitimacy check`.
- Project files read: `01-CONTEXT.md`, `01-UI-SPEC.md`, `REQUIREMENTS.md`, `STATE.md`, `PROJECT.md`, `.claude/CLAUDE.md`, `.planning/research/ARCHITECTURE.md`, `PITFALLS.md`, `.planning/config.json`, `.gitignore`.

### Secondary (MEDIUM confidence)
- Vercel docs: https://vercel.com/docs/functions/runtimes/node-js/node-js-versions (Node 24.x default, `engines`), https://vercel.com/docs/package-managers (pnpm 6-10, lockfile mapping, Corepack), https://vercel.com/docs/builds/configure-a-build (Corepack env var, devDependencies installed).
- Community thread (no official Vercel reply): https://community.vercel.com/t/pnpm-v11-support/41674 (pnpm 11 failures; `ENABLE_EXPERIMENTAL_COREPACK=1` workaround).

### Tertiary (LOW confidence)
- Behavior in Firefox/Safari, Vercel WAF plan availability, Vercel HSTS default: not verified (see Assumptions A1, A4, A5).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions re-verified; combination built, linted, typechecked and tested in a scratch project.
- Architecture: HIGH — auth, parser, ingestion, table, theme script, CSP all exercised; only non-Chromium and Vercel runtime are unverified.
- Pitfalls: HIGH for the 12 reproduced ones (each has the observed error or output); MEDIUM for Vercel/pnpm 11 (community evidence).

**Research date:** 2026-10-13
**Valid until:** 2026-10-20 for the Vercel/pnpm 11 finding (fast-moving; re-check docs before the deploy checkpoint); 2026-11-12 for the rest.
