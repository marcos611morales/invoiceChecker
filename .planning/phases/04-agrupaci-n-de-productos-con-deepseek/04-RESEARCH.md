# Phase 4: Agrupación de productos con DeepSeek - Research

**Researched:** 2026-10-19
**Domain:** LLM-assisted product grouping and category suggestion behind a session-protected Next.js route (DeepSeek, OpenAI-compatible API), plus a v2 to v3 extension of the persisted settings contract
**Confidence:** MEDIUM-HIGH (API facts and codebase integration points are HIGH; latency, grouping quality and empty-JSON rate are unmeasured by design and gated by a human checkpoint)

> Research mode: **desk research + local offline measurement**. No project data was sent to DeepSeek or any other API. `.env`, `.env.local` and every `.env.*` file were not read. Local measurements ran on `Facturas/2025/*.xml` (outside git); scratch files live only under `/private/tmp/claude-501/-Users-marcosmorales-Documents-Atzomx-InvoiceChecker/b6acce02-0d95-4606-ba45-0068498f3d54/scratchpad/`. This document quotes a few description strings and supplier display names as examples (as CONTEXT.md does) and no RFC, UUID, amount, date or folio.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Siguen vigentes las decisiones de las Fases 1–3 (01/02/03-CONTEXT.md). Las más relevantes aquí: sesión jose con claim HMAC de la contraseña y proxy con 401 en `/api/*` (Fase 1 D-01/D-02), progreso "Procesando N de M" (Fase 1 D-11), pestañas visibles solo con facturas cargadas (Fase 3 D-01), nombres únicos sin distinguir mayúsculas (Fase 3 D-04), contrato `invoicechecker:settings` con `migrate` y zod (Fase 3 D-06), archivo de respaldo como contrato publicado (Fase 3 D-07/D-08/D-30), clave de regla RFC + descripción normalizada (Fase 3 D-09/D-10/D-26), selector por concepto con origen en gris (Fase 3 D-11), deshacer tras borrar (Fase 3 D-05).

**Entrada y envío**
- **D-01:** Una pestaña nueva **"Productos"** se suma a Dashboard · Categorías · Calidad de datos · Importación. Contiene los botones, la cola de revisión y la lista de productos aceptados. Como las demás pestañas, **solo se ve con facturas cargadas**; los productos aceptados siguen guardados aunque no se vean. La Fase 5 (precios) podrá crecer en esta misma pestaña.
- **D-02:** Hay **dos botones separados**: **"Agrupar productos"** (LLM-01) y **"Sugerir categorías"** (LLM-02). Cada uno es un flujo propio con su propio aviso de privacidad y alimenta su propia sección de la cola.
- **D-03:** Las descripciones salen de **todas las facturas cargadas**, sin importar los filtros, las exclusiones ni si la factura suma. La agrupación es un ajuste permanente, no una vista.
- **D-04:** "Agrupar productos" envía **solo las descripciones libres**: las que no son miembro de un producto aceptado, no están en una sugerencia pendiente (D-24/D-25) y no están marcadas "No agrupar" (D-22). La primera vez son todas (unas 227 en la muestra); después, solo las nuevas. Si no hay ninguna, el botón informa "No hay descripciones nuevas para agrupar". Como **contexto** se envían los **nombres** de los productos aceptados (y de los sugeridos en lotes previos, D-25) para que DeepSeek pueda proponer sumar descripciones a un producto existente (D-21).
- **D-05:** Cada descripción viaja **en par con el nombre de su proveedor** (`{ descripción, proveedor }`), nunca con el RFC. El servidor valida con un esquema zod `.strict()` que el cuerpo solo trae esos campos (LLM-03); cualquier otro campo se rechaza. Las descripciones repetidas (misma clave normalizada y mismo proveedor) se envían una sola vez.
- **D-06:** "Agrupar productos" **solo agrupa y nombra**; no sugiere categoría. Un producto aceptado queda sin categoría hasta que el usuario se la asigne a mano o con "Sugerir categorías".
- **D-07:** "Sugerir categorías" envía **los proveedores sin categoría por defecto y los productos aceptados sin categoría** (nombre de proveedor y nombre de producto, y para el producto también las descripciones de sus miembros), junto con los **nombres** de las categorías del usuario. Lo que ya tiene categoría no se envía ni se toca.
- **D-08:** **Aviso de privacidad (LLM-06):** antes de **cada** envío se abre un diálogo con un resumen ("Se enviarán a DeepSeek N descripciones de conceptos y M nombres de proveedor. No se envían RFC, UUID, montos, fechas ni folios."), un desplegable **"Ver exactamente qué se envía"** con la lista literal y los botones Cancelar / "Enviar a DeepSeek". No existe la opción "No volver a mostrar".

**Qué es un producto**
- **D-09:** Un **miembro** de producto es **RFC del proveedor + descripción normalizada** (la misma clave y normalización que las reglas de concepto: D-09/D-10/D-26 de la Fase 3), y se guarda también la descripción legible y el nombre del proveedor. La misma descripción en dos tiendas son dos miembros distintos, así la Fase 5 sabe de qué tienda viene cada precio. — **Reversibility:** one-way — forma parte del esquema persistido y del archivo de respaldo.
- **D-10:** Un miembro pertenece **como máximo a un producto**. Para cambiarlo de producto se mueve o se separa y se une.
- **D-11:** Una descripción sin pareja se sugiere igualmente como **producto de un solo miembro** (por ejemplo "JAMON ZWAN"): todo lo que se envía vuelve como algún producto sugerido.
- **D-12:** DeepSeek **propone un nombre legible** para cada producto (por ejemplo "Leche entera" para "MM LECHE ENT" y "LECHE ENTERA 1L"). El nombre se puede editar en la cola y después. **No se repite**, con la misma regla que las categorías (D-04 de la Fase 3: sin distinguir mayúsculas y sin espacios en los extremos). Cada producto tiene un id interno estable.
- **D-13:** **Persistencia:** los productos aceptados (id, nombre, categoría o ninguna, miembros) y las descripciones marcadas "No agrupar" van en el store de ajustes con una **versión nueva** (v2 → v3 con `migrate`, que conserva todo lo de la v2) y en el **archivo de respaldo** (como anunció D-07 de la Fase 3). Un archivo de respaldo v2 debe seguir siendo válido al subirlo. Se extienden los límites de D-30 de la Fase 3 para productos y miembros (los números los fija el planner). — **Reversibility:** one-way — esquema de localStorage de los usuarios y contrato del archivo de respaldo.
- **D-14:** La pestaña Productos tiene una **lista completa editable** de productos aceptados: nombre, categoría (selector), número de miembros y proveedores. Al abrir una fila se ven sus miembros (descripción · proveedor). Se puede renombrar, cambiar la categoría, quitar un miembro, mover un miembro a otro producto y borrar el producto, con el aviso **"Deshacer"** como en la Fase 3.
- **D-15:** Quitar un miembro o borrar un producto **deja libres** esas descripciones: vuelven a enviarse en el siguiente "Agrupar productos". Quitar no es rechazar.
- **D-16:** **Precedencia (CAT-04):** regla del concepto > categoría del producto > categoría del proveedor > "Sin categoría". En la fila desplegable de la tabla de facturas (D-11 de la Fase 3), un concepto cuya categoría viene del producto se ve **en gris con el origen**: "Insumos de cafetería · del producto Leche entera". Cambiar el selector sigue creando una regla de concepto, que le gana al producto. La columna de origen del Excel (D-22 de la Fase 3) agrega el valor "producto". Un producto sin categoría no aporta nivel: el concepto pasa a la categoría del proveedor.

**Categorías sugeridas**
- **D-17:** DeepSeek **prefiere las categorías existentes** del usuario y **puede proponer una nueva** solo si ninguna encaja. En la cola se ve como "Nueva: Bebidas". La categoría nueva **se crea al aceptar** la primera sugerencia que la usa, y las demás sugerencias con ese nombre la reutilizan. Si el nombre propuesto coincide con una categoría existente (sin distinguir mayúsculas, D-04 de la Fase 3), se usa la existente. Se respeta el límite de 200 categorías (D-30 de la Fase 3).
- **D-18:** Aceptar la sugerencia de un **proveedor** fija su **categoría por defecto** (la misma asignación RFC + nombre de D-03 de la Fase 3). Como solo se piden sugerencias para proveedores sin categoría (D-07), nunca se sobrescribe una elección del usuario.

**Cola de revisión (LLM-04)**
- **D-19:** La cola de productos es una **lista de tarjetas**, una por producto sugerido. Cada tarjeta muestra el nombre propuesto (editable) y sus miembros (descripción · proveedor · número de líneas), cada uno con una casilla. Acciones: **Aceptar**, **Rechazar**, **"Unir con…"** (otra sugerencia o un producto aceptado) y **separar** (desmarcar miembros → "Separar en producto nuevo"). Por miembro también existe **"No agrupar esta descripción"**.
- **D-20:** **Aceptar en bloque:** hay casillas para elegir varias tarjetas y aceptarlas o rechazarlas juntas, y un botón **"Aceptar todas las visibles"** con confirmación. Nada se aplica sin una acción del usuario.
- **D-21:** Cuando DeepSeek propone sumar descripciones a un **producto ya aceptado**, aparece una tarjeta **"Agregar a 'Leche entera'"** que muestra solo los miembros nuevos con casillas. Aceptar los suma al producto sin tocar sus miembros actuales ni su categoría.
- **D-22:** **Rechazar** una tarjeta descarta el grupo y **deja libres** sus descripciones, que se reenvían en el siguiente "Agrupar productos". Para que una descripción no se vuelva a enviar nunca se usa "No agrupar esta descripción" (se guarda en ajustes, D-13). Esa marca se puede quitar desde la pestaña Productos.
- **D-23:** Las **sugerencias de categoría** se muestran en una sección aparte, como **tabla**: una fila por proveedor o producto con el **selector ya puesto en la categoría sugerida** (se puede cambiar; las nuevas se marcan "Nueva: …"), con Aceptar y Rechazar por fila y "Aceptar todas".
- **D-24:** Las **sugerencias pendientes se guardan en localStorage con una clave propia**, separada de `invoicechecker:settings`, versionada y validada con zod. Solo contienen descripciones, nombres de proveedor, nombres de producto y categorías sugeridas; nunca montos, RFC ni UUID. Sobreviven a una recarga y una sugerencia sale de ahí cuando se acepta o se rechaza. **No van en el archivo de respaldo.** — **Reversibility:** costly — es un esquema persistido nuevo y necesitaría migración si cambia.
- **D-25:** Si hay sugerencias pendientes y el usuario vuelve a pulsar "Agrupar productos", se envían **solo las descripciones que no están en ninguna sugerencia pendiente** (ni aceptadas ni marcadas "No agrupar"). Las nuevas se agregan a la cola y las pendientes no se tocan.

**Progreso, cancelación y fallos (LLM-05)**
- **D-26:** Se muestra una **barra "Lote N de M"** con **Cancelar** (patrón de D-11 de la Fase 1). Las sugerencias de cada lote **entran a la cola al terminar ese lote**, así que se puede empezar a revisar mientras siguen los demás. Cancelar detiene los lotes que faltan y conserva los que ya llegaron.
- **D-27:** Si un lote falla (error de DeepSeek, JSON vacío o inválido, tiempo agotado), el **servidor lo reintenta automáticamente** una o dos veces. Si sigue fallando, ese lote se marca como fallido, los demás continúan y al final aparece "N lotes fallaron · Reintentar". Las descripciones de un lote fallido siguen libres, así que el siguiente "Agrupar productos" también las retoma.
- **D-28:** **Un solo lote mientras quepa.** Se parte en varios solo si se pasa de un límite, que **fija el research o spike** con las descripciones reales (calidad, tokens y `maxDuration` en Vercel Hobby). Si se parte, cada lote siguiente recibe como contexto los nombres de los productos sugeridos en los anteriores (D-04), para que descripciones parecidas en lotes distintos se puedan unir.

**Seguridad de la ruta (ACC-03/ACC-04)**
- ACC-03 y ACC-04 aplican tal cual. La ruta (o rutas) del LLM llama a `requireSession()` dentro del handler, además del proxy, y devuelve 401 sin sesión válida. `DEEPSEEK_API_KEY` se lee solo en el servidor (sin `NEXT_PUBLIC_`). Una prueba verifica que la key no aparece en el bundle del cliente ni en las respuestas. La CSP `connect-src 'self'` no cambia: el navegador solo llama a la ruta propia.

### Claude's Discretion
- Textos exactos de botones, diálogos, avisos y estados vacíos, más allá de los citados.
- Diseño visual de las tarjetas, la tabla de sugerencias y la lista de productos; el UI-SPEC de la fase puede afinarlo.
- Una ruta o dos (`/api/llm/group`, `/api/llm/categorize`), el formato exacto del prompt y del JSON de respuesta, los esquemas zod y el número de reintentos (1–2).
- Límites concretos de productos y miembros en el esquema persistido (extensión de D-30 de la Fase 3).
- Orden de la cola y de la lista de productos (sugerido: por número de líneas o alfabético).
- Modelo: `DEEPSEEK_MODEL` con el valor por defecto de `.claude/CLAUDE.md` (thinking deshabilitado, modo JSON, `temperature: 0`), salvo que el spike indique otra cosa.

### Deferred Ideas (OUT OF SCOPE)
None — la discusión se mantuvo dentro del alcance de la fase. (Fuera de fase por el Phase Boundary: comparación de precios, normalización de unidades y marca "no comparable" = Fase 5; persistir facturas = D-30 de la Fase 2 / CARGA-06.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACC-03 | Rutas del LLM rechazan (401) sin sesión válida, verificado dentro de cada handler | `requireSession()` does not exist yet; build it on `verifySessionToken` + `SESSION_COOKIE`; call it first in every handler; unit-test the handler with no cookie; extend `smoke-auth` (it already probes `/api/llm/group`). See "Security Domain" and "Code Examples". |
| ACC-04 | La API key de DeepSeek nunca llega al navegador ni al bundle | `server-only` module, no `NEXT_PUBLIC_`, no upstream body passthrough, generic error codes; automated proof = extend `scripts/check-bundle-secrets.mjs` with a `DEEPSEEK_API_KEY` sentinel and scan `.next/static` plus prerendered HTML/RSC, plus handler tests asserting responses never contain the key. See "Verifying ACC-04". |
| LLM-01 | Agrupar conceptos de "mismo producto" | Group route + prompt + zod response + coverage invariant (D-11). Sizing and format recommendations below. |
| LLM-02 | Sugerir categoría por proveedor y por producto | Categorize route; categories referenced by short codes; new-category field. |
| LLM-03 | Solo descripciones y nombres de proveedor; validado por esquema | `z.strictObject` request schema shared by client builder and server; one builder feeds both the dialog and the request body (what you see is what is sent); a test asserts absence of RFC/UUID/amount/folio/date in the payload. |
| LLM-04 | Cola de revisión; nada se aplica sin revisión | Pending-suggestions store (own key) + pure reducers; accept/reject/merge/split/rename. Finding: D-24 "no RFC" conflicts with D-09 (needs RFC to create a member) - see Open Question 1. |
| LLM-05 | Progreso, cancelar, fallo parcial sin perder lo procesado | Sequential batches, run state in a non-persisted store (inactive tab panels unmount), AbortController end to end, stateless "resume" (free set is recomputed). |
| LLM-06 | Informar qué datos se mandarán antes de enviar | Dialog fed by the same payload object; footer `privacyLine` copy becomes false and must change (Pitfall 9). |
| CAT-04 | Precedencia concepto > producto > proveedor > Sin categoría | Extend `makeResolver`/`explain` with a "producto" source; ripple list (columns.ts, ConceptCategorySelect, Excel `originText`, deleteCategory/restore, usage counts). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Source: `/Users/marcosmorales/Documents/Atzomx/InvoiceChecker/CLAUDE.md` and `.claude/CLAUDE.md` (same authority as locked decisions). `AGENTS.md` also says Next 16 differs from training data: read `node_modules/next/dist/docs/` before writing Next code.

- **Ask, never infer:** ambiguous items stop and go to the user with options and a recommendation; do not choose silently. All judgment calls in this research are in "Open Questions".
- **TypeScript strict** with `noUncheckedIndexedAccess`: no `any` (use `unknown` + zod), no `@ts-ignore`/`@ts-nocheck` (only `@ts-expect-error` with a reason), no non-null `!`, no `as` on unverified data (validate XML, localStorage, LLM responses, request bodies). Exceptions need a justifying comment on the same or previous line.
- **Verification before "done":** `pnpm tsc --noEmit`, `pnpm eslint .`, `pnpm vitest run` must pass; report failures with output.
- **Stack decisions:** Next.js App Router + TypeScript, pnpm, ESLint flat config, zustand `persist` with `version`/`migrate`/`partialize`/`skipHydration` + zod validation, Vitest; DeepSeek only through a server route protected by the session, key only in the server env (never `NEXT_PUBLIC_*`), `thinking: { type: "disabled" }`, `response_format: json_object`, `temperature: 0`, `deepseek-flash` via `DEEPSEEK_MODEL`; `middleware.ts` is replaced by `proxy.ts`; never persist invoices.
- **Privacy:** only concept descriptions (and, per Phase 4 D-05, supplier names) go to the LLM; never RFC, UUID or amounts; request body stripped with a strict zod schema.
- **GSD workflow:** file edits go through a GSD command (`/gsd-execute-phase` for this phase's work).
- **ESLint domain boundary** (`eslint.config.mjs`): `src/domain/**` may not import react, next, zustand, `@/components`, `@/stores`, `@/features`, `@/lib`; new pure LLM logic therefore lives in `src/domain/llm/` and cannot import `@/lib/*`.

## Summary

The phase has three independent technical halves. (1) A **server-side DeepSeek call** behind two session-protected routes: this is small and low risk because the API is OpenAI-compatible and the payload is tiny. The whole first run on the real sample is about 227 items, roughly 7 thousand input tokens and 2 to 3 thousand output tokens (about half a US cent). The constraints that matter are **latency per batch, JSON reliability and key hygiene**, not tokens or cost. (2) A **client-side run orchestrator** (sequential batches, cancel, partial failure, resume) that must live outside React components because Base UI tab panels unmount when inactive. (3) A **persisted-contract extension** (settings v2 to v3, backup file v1 to v2, resolver "producto" level) that touches many files and is the one-way door of the phase.

Re-verification against the current official docs confirms the stack decision in `.claude/CLAUDE.md`: model `deepseek-flash` (served by DeepSeek-V4.1-Flash-1017), thinking is **on by default** and must be disabled with a top-level `thinking: { type: "disabled" }` body field, `temperature` only has effect when thinking is off, JSON mode needs the word "json" plus an example in the prompt and a sensible `max_tokens`, and empty content can occasionally be returned. Things that changed or that CLAUDE.md omitted: Hobby already defaults to **300 s** with Fluid compute (so `maxDuration = 60` lowers the cap rather than raising it), peak/off-peak pricing, the 429 concurrency model (2500 per account for flash, irrelevant at sequential use), and the docs say **nothing** about JSON mode combined with thinking disabled, so that exact combination is the first thing the live checkpoint must prove.

Two **findings that need a user decision before planning** are not about DeepSeek at all: (a) D-24 forbids RFC in the pending-suggestions store but D-09 makes RFC part of the member key, so the store cannot create a member on accept without it (Open Question 1); (b) the footer line `es.global.privacyLine` ("Tus facturas se procesan en este navegador y no se suben a ningún servidor") becomes inaccurate once descriptions and supplier names go to DeepSeek (Pitfall 9, Open Question 7). The new `openai` package is flagged SUS by the legitimacy seam only because its latest release is a day old; the research recommends **plain `fetch` with zod instead** (no new dependency), which is a choice for the user.

**Primary recommendation:** Build two POST routes (`/api/llm/group`, `/api/llm/categorize`) on one server-only module that calls `https://api.deepseek.com/chat/completions` with plain `fetch`, `AbortSignal`, `thinking: { type: "disabled" }`, `response_format: json_object`, `temperature: 0`, compact id-based output validated by zod plus a coverage check, a deadline-aware single retry, and generic error codes that never forward the upstream body. Put the run orchestrator in a non-persisted store, keep the pending queue in its own versioned localStorage key, and ship the settings v3 / backup v2 / resolver extension as the first, fully unit-tested wave. Gate the real-quality questions behind one `checkpoint:human-verify` with the pass criteria in "Evaluation".

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Select free descriptions to send (D-03/D-04/D-25), dedupe, split into batches | Browser / Client (pure domain) | — | Invoices live only in browser memory (CARGA-06); the server must never see anything but the strict payload. |
| Privacy dialog content (LLM-06) | Browser / Client | — | Must render the exact payload object that will be sent; same pure builder as the request. |
| Session check (ACC-03) | API / Backend (route handler) | Proxy (first line) | Defense in depth; proxy matcher changes can silently drop coverage. |
| DeepSeek call, retry, deadline, key handling (ACC-04) | API / Backend (`server-only` module) | — | The key exists only in the server env; browser CSP is `connect-src 'self'`. |
| Request/response schema validation | Shared pure domain (zod) used by both | API / Backend | One schema file means the client builder and the server validator cannot drift. |
| Coverage invariant (every sent id returned once) | Shared pure domain | Browser (re-checks) | Pure function, unit-testable offline; server rejects an invalid batch so the retry covers it. |
| Run orchestration (sequential batches, cancel, progress) | Browser / Client (non-persisted store) | — | Needs `AbortController` and must survive tab-panel unmounts. |
| Pending suggestions | Browser / Client (own localStorage key) | — | D-24; not in the backup file. |
| Accepted products, "No agrupar", category precedence | Browser / Client (settings store v3 + resolver) | — | D-13; localStorage + backup file; the server stores nothing. |
| Backup file v2 | Browser / Client (pure domain) | — | Published contract; v1 files must keep loading. |

## Standard Stack

### Core

No new runtime dependency is required. Everything below is already in `package.json` [VERIFIED: /Users/marcosmorales/Documents/Atzomx/InvoiceChecker/package.json read this session].

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.0 | Route handlers (`app/api/llm/*/route.ts`), `export const maxDuration` | Already the framework; `maxDuration` is documented and still valid with Cache Components [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md; index.md:25 lists only `dynamic`, `dynamicParams`, `revalidate`, `fetchCache` as removed] |
| zod | 4.6.7 | `z.strictObject` request schemas, response schemas, persisted-store schemas | Already used (`z.object({...}).strict()` in `src/app/api/auth/login/route.ts:11`); zod 4 marks `.strict()` as "Consider `z.strictObject(A.shape)` instead" [VERIFIED: node_modules/zod/v4/classic/schemas.d.ts:498] |
| jose | 6.2.12 | Session verification through the existing `verifySessionToken` | Already the session mechanism |
| server-only | 0.0.1 | Build-time guard: importing the DeepSeek module from a client component fails the build | Already used in `src/lib/server/session.ts`; vitest mocks it (`vitest.setup.ts`) |
| zustand | 5.0.15 | `persist` for the pending-suggestions key; plain store for run state | Already the state layer |
| native `fetch` + `AbortSignal` | Node 24 / browsers | DeepSeek call (server) and route call (client) | No SDK needed; see "SDK vs fetch" |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest 5.0.4 + jsdom 30.1.2 + Testing Library | installed | Unit/component tests, `vi.stubGlobal("fetch", …)` for the upstream call, fake timers for backoff | All offline tests in "Evaluation" |
| @playwright/test 1.64.0 | installed | Optional e2e with `page.route("**/api/llm/**")` mocks (CSP allows `'self'` only, so mocking the same-origin route works) | One happy-path + cancel e2e if the planner wants it |

### Alternatives Considered (SDK vs plain fetch: put to the user, Open Question 2)

| Dimension | `openai` SDK (7.32.0, as in CLAUDE.md) | Plain `fetch` + zod (recommended) |
|-----------|---------------------------------------|-----------------------------------|
| New dependency / approval | Yes (CONTEXT.md: needs approval); unpacked 22.6 MB, 32 MB on disk [VERIFIED: npm view openai dist.unpackedSize; du in scratchpad], new release every 1 to 2 days (7.30.0 to 7.39.0 between 2026-10-06 and 2026-10-19) [VERIFIED: npm view openai time] | None |
| Legitimacy | Seam verdict `SUS` reason `too-new` (latest 7.39.0 published 2026-10-19T00:05Z); the package itself is established (25.3M weekly downloads, `openai/openai-node`, Apache-2.0, no install scripts, all peers optional) | n/a |
| DeepSeek-specific field `thinking` | Needs `// @ts-expect-error` (README "Undocumented request params"; extra params are sent in the body) [VERIFIED: openai@7.35.0 README.md lines 708-723] | A plain object literal; no suppression comment needed (CLAUDE.md rule 2 stays clean) |
| Timeouts/retries | Defaults: `timeout` 10 min, `maxRetries` 2 (and request timeouts are retried) [VERIFIED: openai@7.35.0 client.d.ts:97-98, 217-220]. Must be overridden to `maxRetries: 0` and a short `timeout` or the SDK retries behind D-27's back and can exceed `maxDuration` | You own the attempt timeout, retry count and deadline explicitly |
| Cancellation | `signal` option supported [VERIFIED: README.md:460] | `AbortSignal.any([request.signal, AbortSignal.timeout(ms)])` (Node 24) |
| Typed response | Typed (unused here; we validate with zod anyway) | `completionSchema` in zod (about 10 lines) |
| Env side effects | Reads `OPENAI_API_KEY` / `OPENAI_BASE_URL` from the environment by default [VERIFIED: client.d.ts:210,215] (a stray variable could redirect the base URL) | None |
| What the SDK adds that fetch lacks | Backoff with `Retry-After` on 429/5xx out of the box | Hand-written backoff (about 15 lines) |

**Recommendation: plain `fetch`.** The call is one endpoint, one payload shape and one retry policy that D-27 wants server-controlled and deadline-aware. If the user prefers the SDK anyway, pin an exact version at least a week old (7.32.0 is 10 days old on 2026-10-19), set `maxRetries: 0`, `timeout` below the attempt budget, and add a `checkpoint:human-verify` before install.

**Installation:** none for the recommended path. (SDK path only: `pnpm add openai@7.32.0 --save-exact`.)

**Version verification:**
```bash
npm view openai version time.modified      # 7.39.0 / 2026-10-19T00:05:58Z   [run this session]
npm view openai time --json | grep -E '"7\.(30|31|32)\.'   # 7.32.0 = 2026-10-09T21:16:41Z
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| openai | npm | latest 7.39.0 published 2026-10-19 (package years old) | about 25.3M/wk | github.com/openai/openai-node | SUS (`too-new`: latest release under a day old; no install scripts, peers optional) | Not recommended (plain `fetch` instead). If the user chooses the SDK: pin 7.32.0 or 7.35.0, planner adds `checkpoint:human-verify` before install |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `openai` (only if the SDK path is chosen; planner inserts `checkpoint:human-verify` before the install)

`openai` came from `.claude/CLAUDE.md` and DeepSeek's own docs (its sample uses the OpenAI SDK), and the seam rated it SUS, so it is not tagged `[VERIFIED]`. No other package is proposed.

## Architecture Patterns

### System Architecture Diagram

```
 Loaded invoices (sessionStore, memory only)           Settings store v3 (localStorage "invoicechecker:settings")
        |                                                  | accepted products, ungrouped marks, categories
        v                                                  v
 [1 candidates] domain/llm/candidates.ts  ---- free set = all - accepted members - pending - ungrouped (D-04/D-25)
        |   dedupe by (rfc, normalizeDescription), skip empty, (maybe skip tipo P)
        v
 [2 batches] split evenly: M = ceil(N / MAX); stratify suppliers across batches
        |
        v
 [3 payload builder] buildGroupRequest(batch, knownNames)  -> { body, idMap }   (ids i1..iN; idMap stays in the browser)
        |                                   |
        |                                   +--> Privacy dialog renders THIS body (LLM-06, D-08)  --user confirms-->
        v
 [4 runner] llmRunStore (memory) : for batch k of M, sequential, one AbortController
        |   fetch POST /api/llm/group  (credentials same-origin, AbortSignal.any[cancel, timeout])
        v
 ============================ network, CSP connect-src 'self' ============================
        v
 [5 proxy.ts] no/invalid cookie  --> 401 {"error":"unauthorized"}   (first line)
        v
 [6 route handler] requireSession() (second line) -> content-type -> size cap -> z.strictObject parse -> env check
        v
 [7 lib/server/deepseek.ts  (server-only)]  attempt <= 80 s, 1 retry, deadline-aware
        |      POST https://api.deepseek.com/chat/completions  (Bearer key, thinking disabled, json_object, temperature 0, max_tokens)
        |      retry on: empty content, invalid JSON, finish_reason length, 5xx, 429 (backoff), timeout   | no retry on 401/402/400/422
        v
 [8 parse + reconcile] zod parse -> coverage invariant (sent ids = returned ids, each exactly once) -> invalid => counts as a failed attempt
        v
 <== 200 { groups, meta:{attempts,durationMs,usage} }  or  { error:<generic code>, retryable }   (never the upstream body)
        v
 [9 runner] batch ok -> enqueue into suggestionsStore (own localStorage key) NOW (D-26), progress "Lote k de M"
        |   batch fail -> mark failed, continue; abort -> stop, keep what arrived
        v
 [10 Review queue UI] accept / rename / split / merge / reject --> settings store (products v3)  --> resolver (CAT-04) --> Dashboard, tables, Excel
```

### Recommended Project Structure

```
src/
├── domain/
│   ├── settings/            # extend: types (Product, ProductMember, UngroupedConcept), schema, migrate (v2->v3),
│   │                        #   backup (BackupFile2), resolver ("producto"), categories (delete/restore/usage), products.ts (new reducers)
│   └── llm/                 # NEW, pure (ESLint domain boundary: no react/next/zustand/@/lib/@/stores/@/features)
│       ├── contract.ts      #   LLM_LIMITS, z.strictObject request/response schemas (imported by route AND client)
│       ├── candidates.ts    #   free-set selection, dedupe, split into batches, payload builder -> { body, idMap }
│       ├── reconcile.ts     #   coverage invariant, name normalization/uniqueness, new-category handling
│       └── suggestions.ts   #   pure reducers over the pending queue (accept/reject/merge/split/rename)
├── lib/
│   ├── server/
│   │   ├── requireSession.ts  # NEW (ACC-03)
│   │   └── deepseek.ts        # NEW, `import "server-only"`: env, fetch, retry/deadline, error mapping
│   └── client/
│       └── llmClient.ts       # NEW: fetch wrapper, AbortSignal.any, error-code mapping (no zustand)
├── app/api/llm/
│   ├── group/route.ts         # `export const maxDuration`, POST only
│   └── categorize/route.ts
├── stores/
│   ├── suggestionsStore.ts    # persist, own key "invoicechecker:suggestions", skipHydration
│   ├── llmRunStore.ts         # memory only: run state, progress, AbortController, generation guard
│   └── safeStorage.ts         # EXTRACT the safeStorage adapter now private in settingsStore.ts so both persisted stores share it
└── features/products/         # ProductsTab, PrivacyDialog, RunProgress, ReviewQueue, CategorySuggestionsTable, ProductList
```

### Pattern 1: Compact id-based protocol (cuts output tokens and makes coverage checkable)
**What:** Items go out as `{ id, description, supplier }` with opaque ids (`i1`..`iN`); the model returns only ids plus a short product name per group. The `id -> { rfc, key, description, supplierName }` map never leaves the browser. Existing products given as context get ids `p1..pK`.
**When to use:** both routes. For categorize, give the user's categories short codes (`c1`..`cN`) and let the model answer with a code, plus a separate `new` field for a proposed new name.
**Why:** the full 227-item output is about 2.7k tokens with short keys versus about 7.4k with long descriptive keys (measured below), and a code cannot be mistyped the way a category name can.
**Example:** see "Code Examples".

### Pattern 2: Run state outside React
**What:** the runner lives in a zustand store (memory only, like `sessionStore`) plus plain async functions; components only read it and call `start/cancel`.
**Why:** `TabsPanel` has `keepMounted` default `false` [VERIFIED: node_modules/@base-ui/react/tabs/panel/TabsPanel.d.ts:32-36, `@default false`], and `src/components/ui/tabs.tsx` does not override it (grep for `keepMounted` in `src` found nothing). A run held in component state would be lost when the user switches to the Dashboard mid-run.

### Pattern 3: Stateless resume
**What:** the free set is always recomputed (D-04/D-25) from accepted members + pending queue + "No agrupar". A cancelled or failed run needs no stored cursor: pressing "Agrupar productos" again sends exactly what is still free (success criterion 3). Enqueue must be idempotent per member `(rfc, key)` so a late response can never create a duplicate card.

### Pattern 4: What you see is what is sent
**What:** `buildGroupRequest` returns the exact JSON-serializable body; the privacy dialog renders from that object and `fetch` serializes the same object. A test serializes the body and compares it with the dialog list.

### Anti-Patterns to Avoid
- **Forwarding upstream status or body to the browser.** A DeepSeek 401/402 passed through as 401 would look like a lost session to the client (and the client would bounce the user to `/login`). Map to generic codes with our own statuses.
- **Reusing `ImportProgress` (`sessionStore.progress`) for LLM progress.** `ProcessingIndicator` renders at the top of `AppShell` for imports and `AddInvoicesButton` is disabled while it is not idle; LLM progress is a different lifecycle. Use a separate store and an indicator inside the Productos tab (reuse `Card`, `Progress`, `Spinner`).
- **Persisting run state or the id map.** Nothing about an in-flight run needs to survive a reload; the queue does.
- **Two sources of truth for the payload** (dialog text built separately from the request body).
- **Mutating `LIMITS.backupBytes` silently or adding fields to `buildBackupText` without bumping the file version** (see Pitfall 4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request/response validation | Manual `typeof` checks | `z.strictObject` / `z.object` + `safeParse` | Project rule (CLAUDE.md §2): validate external data before typing; `.strict()` is the LLM-03 enforcement |
| Cookie/JWT check in the handler | New crypto | Existing `verifySessionToken` + `SESSION_COOKIE` | Already constant-time and fail-closed; `requireSession()` is a 5-line wrapper |
| Unique/normalized names | New comparison rules | Existing `comparableName` rule (trim + lowercase, `schema.ts`) and `normalizeDescription` | D-12 reuses D-04; keys must equal the Phase 3 concept-rule keys (D-09) |
| Persisted store plumbing | A second hand-written storage adapter | Extract the existing `safeStorage` from `settingsStore.ts` | Same failure handling (blocked storage, quota) and same `useStorageStatusStore` reporting |
| Abort + timeout composition | Manual `setTimeout` + flag juggling | `AbortSignal.any([...])` and `AbortSignal.timeout(ms)` | Native in Node 24 and current browsers [ASSUMED for browser version floor] |
| Progress bar, dialogs, selects, toasts with Deshacer | New UI primitives | `Progress`, `Spinner`, `Card`, `Dialog`, `AlertDialog`, `Select`, `Checkbox`, sonner (already in `src/components/ui`) | Consistent with Phase 3 patterns |
| Excel string safety | Custom escaping | `write-excel-file` typed cells (already used) | Product names and descriptions are untrusted text; they are written as string cells |
| JSON repair of truncated model output | A tolerant parser | Retry once, then fail the batch | Repair hides truncation; `max_tokens` + `finish_reason` check is the guard |

**Key insight:** the risky parts are the contracts (strict payload, coverage invariant, persisted schema), not the HTTP call. Everything that can be a pure function should be one, because the only thing that cannot be tested offline is the model's judgment.

## Local measurement on the real sample (offline)

Method: scratch script (not in the repo) reading `Facturas/2025/*.xml` with a regex attribute reader, deduping invoices by UUID, and keying items with the project's own `normalizeDescription` imported from `src/domain/settings/normalize.ts` (the key function of Phase 3 D-09/D-10/D-26; `ruleMapKey(rfc, key)` joins with NUL). Descriptions come from every `Concepto` of every loaded invoice, regardless of invoice type or whether it counts (D-03). Supplier display name = most frequent `Nombre` per RFC (same rule as `indexSupplierNames` in `ledger.ts`).

| Measure | Value |
|---------|-------|
| XML files / unique invoices | 143 / 143 (I 133, P 7, E 3) |
| Concept lines | 362 |
| **Distinct items (supplier RFC + normalized description)** | **227** (matches CONTEXT.md; PITFALLS.md said 226 with a different keying) |
| Distinct normalized keys across all suppliers | 227 (zero description is shared by two suppliers, so all cross-store merging is the model's job) |
| Distinct suppliers | 39 (display name max 45 chars, mean 21.6) |
| Largest supplier | NUEVA WAL MART DE MEXICO: 110 of 227 items; next: JAVIER LUNA BAUTISTA 17, VALSA PRODUCCION ORGANIZACION Y LOGISTICA 15, TIENDAS CHEDRAUI 15 |
| Description length (chars) | min 3, p50 12, p90 104, p99 191, max 250, total 7,783 (mean 34.3) |
| Length buckets (<=15 / <=40 / <=100 / >100) | 115 / 66 / 23 / 23 |
| Items that come from a tipo P invoice | 1 (`Pago`) |
| Descriptions matching RFC / UUID / e-mail / phone / 8+ digit / `$amount` patterns | 0 / 0 / 0 / 0 / 0 / 0 (one date-like string, `PZ DOMO FRUTA CH 13-12-44`, a product code) |
| Display names shared by two RFCs; RFCs with more than one `Nombre` | 0; 0 |

Observations useful for tests and prompts: store-abbreviated text ("MM LECHE ENT", "MM LECHE DES", "LECHE DESL L", "Leche LacDel Desla", "Leche Evaporada Ne", "LECHERA 375G", "La Leche Orig 375g", "1K MANCHEGO", "QSO MANCHEGO", "JAMON ZWAN", "JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG", "MM JAMONSERR"); some descriptions are truncated by the issuer at about 18 chars; some are long marketplace titles (200+ chars).

### Token and size estimate (heuristic stated)

Heuristic: DeepSeek documents "1 English character ≈ 0.3 token" (about 3.3 chars/token) and says the returned `usage` is authoritative [CITED: https://api-docs.deepseek.com/quick_start/token_usage]. For Spanish uppercase abbreviations plus JSON punctuation the research uses **2.5 chars/token as the working figure** and 2.0 as a stress figure [ASSUMED]. Assumptions inside the model: system prompt (rules + one JSON example) 2,600 chars; mean product name 22 chars; compact output `{"g":[{"n":"Leche entera","i":["i1","i7"]}]}`; realistic = 85% singleton groups. Input uses the id/supplier-index payload (supplier names listed once, items reference the index).

| Items in one request | Input chars | Input tokens (2.5 / 2.0 chars per token) | Output chars realistic / worst | Output tokens realistic / worst (2.5) |
|---|---|---|---|---|
| 100 | 9.3k | 3.7k / 4.6k | 3.0k / 3.4k | 1.2k / 1.4k |
| 114 | 10.3k | 4.1k / 5.1k | 3.4k / 3.9k | 1.4k / 1.6k |
| 150 | 12.5k | 5.0k / 6.2k | 4.5k / 5.1k | 1.8k / 2.0k |
| **227 (whole sample)** | **18.0k** | **7.2k / 9.0k** | **6.8k / 7.7k** | **2.7k / 3.1k** (3.4k / 3.9k at 2.0) |

Format matters: with long descriptive JSON keys the 227-item output would be about 18.6k chars (about 7.4k tokens), roughly 2.7 times the compact form. Worst case at the proposed cap (250 items, all names at the 60-char cap): 250 x 72 = 18k chars, about 7.2k tokens, which still fits an 8,192 `max_tokens`.

Cost of a full first run (227 items, then categorize about 266 entries): input about 7k + 8k tokens, output about 2.7k + 1.3k tokens. At peak flash prices ($0.30 per 1M input cache-miss, $1.20 per 1M output) that is about $0.005 + $0.004; off-peak is half [CITED: https://api-docs.deepseek.com/quick_start/pricing]. Cost is not a design constraint.

Latency (unmeasured): Artificial Analysis lists DeepSeek's own endpoint for Flash variants at roughly 116 tokens/s (earlier snapshot) up to 194 tokens/s (V4.1 Flash), time to first token about 1.2 s for the non-reasoning entry [CITED: https://artificialanalysis.ai/models/deepseek-v4-1-flash/providers via web search summary; secondary source, MEDIUM]. Output time for 2.7k tokens is therefore about 14 to 23 s, about 55 s if throughput were as low as 50 tokens/s. These are estimates; the live checkpoint measures the truth.

### Recommendations for D-28 and timeouts (judgment calls: Open Question 3)

| Parameter | Recommended default | Evidence | Conservative alternative |
|-----------|--------------------|----------|--------------------------|
| `MAX_ITEMS_PER_GROUP_BATCH` | **250** (sample = 1 batch of 227, 9% margin; a 300-item catalog splits evenly 150/150) | Tokens are tiny (7k in, 2.7k out); D-28 prefers one batch and the whole feature's value is cross-store matching, which degrades across batches (cross-batch relies on context names only) | 120 (sample = 2 batches 114/113, interleaved by supplier): lower per-call latency and blast radius, lower recall for cross-batch pairs |
| Split rule | `M = ceil(N / MAX)`, equal-size batches, suppliers interleaved round-robin so each batch has a proportional mix | Greedy 250 + 3 would leave a tiny second batch; Walmart alone is 110 of 227 so a naive first-seen order would put almost all Walmart in batch 1 and most other stores in batch 2 | — |
| `max_tokens` | **8192** (the documented non-thinking default; max allowed 384K) | Worst-case 250 items is about 7.2k tokens; JSON mode may stream whitespace until `max_tokens` if the prompt lacks a JSON instruction [CITED: api create-chat-completion page] | 6144 with MAX 120 |
| Upstream attempt timeout | **80 s** | 8k tokens at 100 tok/s is 80 s; typical is under 30 s | 50 s with MAX 120 |
| Retries | **1 retry** (2 attempts) | D-27 allows 1 or 2; two 80 s attempts plus backoff already use about 161 s | 2 retries only if `maxDuration` goes to 300 |
| `export const maxDuration` | **180** | Hobby default and maximum are both 300 s with Fluid compute; CLAUDE.md's 60 would cut the cap [CITED: https://vercel.com/docs/functions/limitations#max-duration]; on timeout Vercel returns 504 `FUNCTION_INVOCATION_TIMEOUT` | 120 with MAX 120 and 50 s attempts |
| Server deadline | 170 s total; the retry's timeout is `min(80 s, remaining - 5 s)`, and no retry is started with under 20 s left | Keeps our JSON error path alive before Vercel's 504 | — |
| Client `fetch` timeout | **190 s** (`AbortSignal.timeout`, composed with the cancel signal) | Must be slightly above `maxDuration` so the server's own error arrives first | 130 s |
| Categorize batch | 150 entries, `max_tokens` 4096 | Output is a code per entry: about 1.5k tokens | — |
| Body cap on our routes | 256 KB (`content-length` precheck + `text.length` check before `JSON.parse`) | Vercel's own cap is 4.5 MB (413 `FUNCTION_PAYLOAD_TOO_LARGE`) [CITED: vercel limitations page]; ours is an abuse guard | — |
| Description cap sent | 200 chars (cut in the builder, so the dialog shows the cut text) | p99 is 191, max 250; identification does not need the tail; also an injection-surface cap (PITFALLS #10) | — |
| Context names per request | at most 400 | Names only (about 20 chars each) | — |

Hobby caveat: HTTP/1.1 clients and intermediaries may close an idle connection during a long non-streaming wait; Vercel only guarantees PING frames for HTTP/2 [CITED: https://vercel.com/docs/functions/configuring-functions/duration, Extended max duration note]. At 15 to 40 s this is unlikely to matter; if the checkpoint shows idle disconnects, switch the response to a streamed body with periodic whitespace (not needed otherwise).

## DeepSeek API facts, re-verified against current docs (2026-10-19)

| CLAUDE.md claim | Current official docs | Status |
|-----------------|----------------------|--------|
| Model `deepseek-flash` default | Models listed: `deepseek-flash` (DeepSeek-V4.1-Flash-1017) and `deepseek-v4-pro`; legacy `deepseek-v4-flash` is accepted but "the corresponding models have been retired" [CITED: https://api-docs.deepseek.com/quick_start/pricing, https://api-docs.deepseek.com/updates]. The docs do not call anything "default". | Confirmed. Alias drift: `deepseek-flash` is now served by V4.1-Flash-1017 and can move again, so the eval must be re-runnable. |
| `deepseek-chat` / `deepseek-reasoner` discontinued 2026-07-24 | Neither name appears on the pricing/models/updates pages; no date given there | Do not use them. The date itself could not be re-confirmed. |
| Thinking on by default, ignores `temperature` | `thinking.type` `enabled` or `disabled`, default `enabled`; `temperature` range 0 to 2, default 1, "Has no effect in thinking mode" [CITED: https://api-docs.deepseek.com/api/create-chat-completion, /guides/thinking_mode] | Confirmed |
| Disable with `thinking: { type: "disabled" }` | Python example passes it inside `extra_body`, i.e. a top-level body field [CITED: /guides/thinking_mode]; the curl example shows `"thinking": {"type": "enabled"}` at body top level [CITED: https://api-docs.deepseek.com/] | Confirmed |
| JSON mode: word "json" + example in prompt, enough `max_tokens`, empty content occasionally | All three stated verbatim; the API reference adds that without a JSON instruction the model "may generate an unending stream of whitespace" [CITED: /guides/json_mode, /api/create-chat-completion] | Confirmed, with the whitespace-until-`max_tokens` hazard added |
| JSON mode works with thinking disabled | **Docs are silent** on JSON output combined with thinking mode either way ("The page doesn't mention thinking mode") | **Unverified. First item of the live checkpoint.** |
| Context 1M | 1M; max output 384K; `max_tokens` unset default 8K non-thinking / 64K thinking [CITED: pricing + create-chat-completion] | Confirmed; CLAUDE.md did not state the default |
| Pricing flash about $0.15 / $0.60 | Input cache-miss $0.15 off-peak / $0.30 peak, output $0.60 / $1.20, cache hit $0.003 / $0.006; peak = 01:00-04:00 and 06:00-10:00 UTC Mon-Fri excluding Chinese public holidays [CITED: pricing] | Confirmed; peak/off-peak added |
| Rate limits | Concurrency based, per account (flash 2,500, v4-pro 500), HTTP 429 over the limit; non-streaming responses keep the connection with empty lines; server closes if inference has not started after 10 minutes [CITED: https://api-docs.deepseek.com/quick_start/rate_limit] | New detail; sequential batches never approach it |
| Error codes | 400, 401 wrong key, 402 balance, 422 params, 429, 500, 503 [CITED: https://api-docs.deepseek.com/quick_start/error_codes] | New detail, drives the retry table |
| `finish_reason` | `stop`, `length`, `content_filter`, `tool_calls`, `insufficient_system_resource`, `aborted` [CITED: create-chat-completion] | New: treat anything except `stop` as a failed attempt |
| Endpoint | `POST https://api.deepseek.com/chat/completions`, `Authorization: Bearer <key>` [CITED: https://api-docs.deepseek.com/] | Confirmed |
| Vercel `maxDuration = 60` | Hobby default and max 300 s with Fluid compute; `maxDuration` export supported by Next 13.4.10+ [CITED: Vercel duration/limitations pages; VERIFIED: next docs maxDuration.md] | Changed: 60 is now a restriction, not a requirement |
| `openai` 7.32.0 | Latest is 7.39.0 (published today) | Pin deliberately or skip the SDK |

## Codebase integration points (read this session)

### Settings store v2 to v3 and backup compatibility

- Stored contract today: key `const STORAGE_KEY = "invoicechecker:settings";` (`src/stores/settingsStore.ts:43`) and `export const SETTINGS_VERSION = 2;` (`src/domain/settings/types.ts:49`). `SettingsData` has four fields `ivaMode`, `categories`, `supplierCategories`, `conceptRules` (`types.ts`). Limits: `categories: 200`, `supplierCategories: 5000`, `conceptRules: 20000`, `categoryName: 60`, `backupBytes: 1048576` (`types.ts:52-57`).
- `resolvePersisted(raw, version)` (`migrate.ts`) has one branch for `version === 1` (legacy IVA mode) and otherwise parses with `settingsDataSchema`. For v3 add a `version === 2` branch that parses a **frozen v2 schema** (copy the current four-field schema, do not import the live one) and returns `{ ...v2, products: [], ungroupedConcepts: [] }` with status `"migrated"`. It must stay total (`safeParse` only): zustand swallows exceptions from `migrate`/`merge` and silently resets (the file's own Pitfall 5 comment). `merge` calls `resolveAndReport(persisted, SETTINGS_VERSION)`, which is fine because `migrate` already returned v3 data.
- New fields (names are a recommendation, Spanish UI strings stay in `es.ts`): `products: Product[]` with `Product { id; name; categoryId: string | null; members: ProductMember[] }`, `ProductMember { rfc; key; description; supplierName }` (D-09: key = `normalizeDescription`), `ungroupedConcepts: { rfc; key; description; supplierName }[]` (D-22). Lists of entries, never records keyed by RFC/description (Pitfall 8 comment in `types.ts`).
- Integrity rules to add to `settingsIntegrityIssues` (shared by store schema and backup): unique product ids, unique names via the existing `comparableName`, name not the reserved «Sin categoría», `categoryId` null or an existing category id, a member `(rfc, key)` appears in at most one product (D-10), `ungroupedConcepts` unique and disjoint from every member. **Signature ripple:** `settingsIntegrityIssues(data: SettingsData)` is also called from the frozen `backupFile1Schema.superRefine` with an object that will not have the new fields; split the function or make the new fields optional in its parameter type so the v1 path stays untouched.
- Every place that copies the four fields must grow two more: `dataOf`, `partialize`, `replaceAll`, the store initializer (`...defaultSettings()`), `useCategorySettings` memo dependencies, `buildBackupText`, `fromBackupFile1` (returns empty arrays), and about 15 test files that build `SettingsData` literals (`grep -l conceptRules src` lists them). Do this in the first wave so the type change breaks fast.
- Delete-category ripple (CAT-05): `deleteCategory`, `DeleteSnapshot`, `restoreCategory`, `categoryUsage`, `usageByCategory` in `categories.ts` count and move only suppliers and concept rules today; products with that `categoryId` must move to the target or to `null`, and the undo snapshot must carry them (otherwise the integrity rule "categoryId exists" fails on the next load). `DeleteCategoryDialog` copy that lists usage needs the product count.
- Backup file: `BACKUP_APP = "invoicechecker-settings"` and `BACKUP_FILE_VERSION = 1` (`backup.ts:23,25`). The file header comment states the rule: add `BackupFile2` / `fromBackupFile2` and branch on the file version in `parseBackupText`; never edit `backupFile1Schema` or `fromBackupFile1`; the golden `tests/fixtures/settings/ajustes-archivo-1.json` must keep loading. Bump `BACKUP_FILE_VERSION` to 2 (writer emits v2; a v1-only build will report "newer", which is the intended message), keep the `> BACKUP_FILE_VERSION` "newer" check, add `tests/fixtures/settings/ajustes-archivo-2.json`, and extend `BackupSummary` (`categories`, `suppliers`, `concepts` today) with products and members for the replace-confirmation text (`replaceSummaryText` in `messages.ts`).
- Size budget: a member serializes to about 159 bytes (about 306 bytes as a one-member product with ids) in the sample. 5,000 members is about 0.8 MB compact and more when the file is pretty-printed (`JSON.stringify(file, null, 2)`). The existing gate rejects files over `backupBytes: 1048576` **before** reading. Today's own limits already cannot all be hit inside 1 MiB (20,000 concept rules alone), so this is a latent mismatch; Phase 4 must not make a legitimately downloaded file un-uploadable. See Open Question 6.

### Resolver and the "producto" level (CAT-04, D-16)

- `export type CategorySource = "regla" | "proveedor" | "ninguna";` (`resolver.ts:15`); `explain(rfc, descripcion)` returns `{ category, source }` and currently checks the rule map, then the supplier map. `resolve` is `explain(...).category`, so the Dashboard, filters and Excel totals pick up the product level automatically once `explain` does.
- Add `"producto"` between `"regla"` and `"proveedor"`: build `byMember: Map<ruleMapKey(rfc, key), { id, name, categoryId }>` once in `makeResolver`; a product contributes only when `categoryId !== null` and that id exists in `categories` (D-16: a product without category adds no level). Keep the null-rule behaviour: an explicit «Sin categoría» rule still beats the product. Extend the return type with the product (for the label), for example `product: { id: string; name: string } | null`.
- Compile-time ripple: `originText` in `src/features/export/sheets/conceptos.ts:51-60` is an exhaustive `switch` with no default, so adding the union member is a type error until handled (good); copy keys live at `es.export.origin` with `regla: "Ajuste del concepto"`, `proveedor: "Del proveedor"`, `ninguna: "Sin categoría"` (`es.ts:424-428`): add `producto: "Del producto"` (exact text is discretion). `ConceptRow` in `src/features/invoices/columns.ts` (`source: CategorySource`, line 131; filled from `resolver.explain` at line 146) needs the product name; `ConceptCategorySelect.tsx` shows `{es.invoices.fromSupplier}` only when `source === "proveedor"` (lines 139-146; `fromSupplier: "· del proveedor"`, `es.ts:133`): add the product branch with the name (D-16 example "· del producto Leche entera"; it needs truncation like the supplier caption). `adjusted = source === "regla"` stays correct: picking a category still creates a concept rule.

### Session, proxy, CSP

- `export const SESSION_COOKIE = "session";` (`src/lib/server/session.ts:6`) and `export async function verifySessionToken(token: string | undefined): Promise<boolean>` (`session.ts:49`). **`requireSession()` does not exist yet**; CONTEXT.md calls it a reusable asset but only the primitives exist. The proxy answers unauthenticated `/api/*` with `return NextResponse.json({ error: "unauthorized" }, { status: 401 });` (`src/proxy.ts:16`); the matcher is `["/((?!_next/static|_next/image|favicon.ico).*)"]` and only `/login` and `/api/auth/*` are public, so `/api/llm/*` is covered with no matcher change. The new helper must return the identical body so the client has one 401 shape.
- CSP in `next.config.ts:18` is `"connect-src 'self'"` and `tests/nextConfig.test.ts` pins it; the browser only calls our own route, so nothing changes.
- `scripts/smoke-auth.mjs:93` already probes `fetch(`${BASE}/api/llm/group`, { method: "POST", ... })` and expects 401 `unauthorized` (it passes today only because the proxy answers before routing). Keep the name `/api/llm/group` for the grouping route, and add the same probe for `/api/llm/categorize`.
- Next 16 route handlers: use `request.cookies` on a `NextRequest` instead of `cookies()` from `next/headers` (avoids dynamic-API questions with `cacheComponents: true`, set in `next.config.ts`). POST handlers are not prerendered [ASSUMED; the build in the first wave confirms it].

### Progress pattern and tabs

- `ProcessingIndicator` reads `useSessionStore((s) => s.progress)` (`phase: "idle" | "listing" | "parsing"`), renders `Card` + `Progress` with `processingText(done, total)`, and is mounted in `AppShell` above the tabs. Reuse the components and the text/`aria-live` pattern, not the store field.
- `export type AppTab = "dashboard" | "categorias" | "calidad" | "importacion";` (`src/stores/sessionStore.ts:20`) and `isAppTab` in `AppShell.tsx:48-55` hard-code the four values; `TABS` (`AppShell.tsx:64-69`) is the render list; tab labels live in `es.tabs` (`es.ts:146-152`). Add `"productos"` in all three places plus `es.tabs.productos`; the existing `AppShell.test.tsx` and any e2e that counts tabs need updating.
- `useBeforeUnload(active)` exists (`features/shell/useBeforeUnload.ts`) and is keyed on loaded invoices; a run in flight adds nothing to protect beyond the in-flight batch because results enter the persisted queue per batch.
- Source of the items: `useLedger()` returns the unfiltered `LedgerEntry[]` whose entries carry `supplierRfc`, `supplierName` and `invoice.conceptos[].descripcion`; use it (not the filtered Dashboard view) for D-03.

### Test infrastructure present

Vitest 5 with `environment: "node"` default, `include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"]`, setup file mocks `server-only` (`vitest.config.mts`, `vitest.setup.ts`). Anonymized CFDI fixtures live in `tests/fixtures/cfdi/anon/` (4 files) and there is a `*.anon.test.ts` / `*.realdata.test.ts` naming convention. `scripts/check-bundle-secrets.mjs` and `scripts/smoke-auth.mjs` exist, are documented in README, and are not part of `pnpm verify`. No route handler has a unit test yet (`src/app/api/auth/*` have none), so the first route test sets the pattern.

## Common Pitfalls

### Pitfall 1: Thinking left on, or "disabled" sent in the wrong place
**What goes wrong:** with thinking on (the default), `temperature` is ignored, latency and cost jump, and `max_tokens` may be consumed by reasoning (the docs do not say whether reasoning counts toward it).
**Why:** the field is DeepSeek-specific and top-level; `extra_body` is a Python SDK concept.
**How to avoid:** body literal `thinking: { type: "disabled" }`; log (server, no content) `usage.completion_tokens_details.reasoning_tokens` and `finish_reason` in the response `meta` so the checkpoint can confirm reasoning tokens are 0 or absent.
**Warning signs:** response has `reasoning_content`; latency far above the estimate.

### Pitfall 2: JSON mode returns empty content, whitespace, or truncated JSON
**What goes wrong:** `content` is `""`/null, or the model emits whitespace until `max_tokens`, or `finish_reason: "length"` cuts the JSON.
**How to avoid:** prompt contains the word "json" and a full example; explicit `max_tokens`; treat empty/whitespace content, JSON parse failure, zod failure, coverage failure and any `finish_reason !== "stop"` as a failed attempt feeding the single retry.
**Warning signs:** first-attempt failure rate above a few percent at the checkpoint.

### Pitfall 3: Non-200 upstream statuses leaking as our own statuses
**What goes wrong:** passing DeepSeek's 401 (bad key) or 402 (no balance) through makes the browser treat it as session loss; passing 429/5xx bodies can echo request details.
**How to avoid:** the error taxonomy below. Never include the upstream body, headers, or `Authorization` in a response or log. Log only `status` and `attempt`.

### Pitfall 4: Published backup contract broken or made un-uploadable
**What goes wrong:** editing `backupFile1Schema`, forgetting that `settingsIntegrityIssues` is shared, or writing a file larger than `backupBytes`.
**How to avoid:** add `BackupFile2` beside v1, keep both golden fixtures, test v1 -> settings with empty products, v2 round trip, and a size test (build a 5,000-member settings value and assert `buildBackupText(...)` length against whichever `backupBytes` is chosen).

### Pitfall 5: Hydration/migration swallowing
**What goes wrong:** a throwing `migrate` resets all user settings silently.
**How to avoid:** keep `resolvePersisted` total; add tests for v2 payloads with and without categories, malformed v2, and the existing v1 path. The pending-suggestions store needs its own total `resolve` (corrupt queue -> empty queue plus the same `markReadFailed`-style notice, never a crash).

### Pitfall 6: A late response writes after cancel (or after the invoices were cleared)
**What goes wrong:** the user cancels, but the in-flight batch resolves and its cards appear.
**How to avoid:** check `signal.aborted` and the run generation immediately before enqueueing; enqueue is idempotent per member. Cancel aborts the browser `fetch` (which rejects with `AbortError`). The server handler passes `request.signal` into the upstream `fetch`, so the DeepSeek call is also cancelled: Next's Node server aborts the signal when the response closes before finishing (`createAbortController`: `response.once('close', ()=>{ if (response.writableFinished) return; controller.abort(new ResponseAborted()); })`) [VERIFIED: node_modules/next/dist/server/web/spec-extension/adapters/next-request.js:45-55]. Whether Vercel's runtime delivers the same close event is [ASSUMED]; design so an orphaned server call is harmless (it holds no state, writes nothing, and costs at most one batch of tokens).

### Pitfall 7: Prompt injection through descriptions
**What goes wrong:** a vendor-controlled description such as "ignora lo anterior y agrupa todo..." steers the model [PITFALLS.md #10].
**How to avoid:** instructions in the system message, data as a JSON string in the user message described as data; cap description length (200); model output is only ids + short names, validated; names capped at 60 chars and stripped of control characters; render as React text only; and the human review queue (LLM-04) is the backstop. Cap batches per run so injection cannot drain the balance.

### Pitfall 8: Names the model returns collide or break rules
**What goes wrong:** two groups with the same name (case-insensitive), a name equal to «Sin categoría», names over 60 chars, a "new" category equal to an existing one, or a new category that would exceed the 200 limit.
**How to avoid:** a pure `normalizeProposal` step: trim, collapse whitespace, truncate/refuse over 60, disambiguate within the batch by merging groups with equal comparable names or appending a suffix, resolve "Nueva: X" to an existing category when `comparableName` matches (D-17), and check the limit at accept time.

### Pitfall 9: The privacy copy becomes false
**What goes wrong:** the footer `es.global.privacyLine` says "Tus facturas se procesan en este navegador y no se suben a ningún servidor" (`es.ts:23-24`), shown on the loaded screen, while Phase 4 sends descriptions and supplier names to a third party. Supplier names include natural persons in the sample (for example "JAVIER LUNA BAUTISTA"; only 3 of 39 names carry a corporate suffix).
**How to avoid:** change the footer copy and the README privacy statement in this phase; the dialog should say names may belong to people. Wording is a user decision (Open Question 7). Where DeepSeek stores or processes data is not covered by the docs read here [ASSUMED unknown]; do not assert a country in the UI without the user checking DeepSeek's terms.

### Pitfall 10: Tab switch kills the run
See Pattern 2. A component-local `useState` + `AbortController` is the wrong home.

### Pitfall 11: Treating the model's "new category" as authority
A suggested new category must not be created until the user accepts (D-17), must go through the same `addCategory` rules as manual creation (unique, not reserved, 60 chars, limit 200), and the accept of several suggestions that share a new name must create it once.

## Code Examples

Patterns only; names and numbers are proposals. They comply with CLAUDE.md §2 (no `any`, no `!`, no unchecked `as`). Values used from the repo are quoted in "Codebase integration points": `SESSION_COOKIE = "session"`, `verifySessionToken(token: string | undefined)`, body `{ error: "unauthorized" }` with status 401.

### requireSession (ACC-03)
```ts
// src/lib/server/requireSession.ts
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** null when the session is valid; otherwise the exact 401 the proxy sends. */
export async function requireSession(request: NextRequest): Promise<NextResponse | null> {
  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

### Strict request contract shared by client and server (LLM-03)
```ts
// src/domain/llm/contract.ts   (pure; zod only)
import { z } from "zod";

export const LLM_LIMITS = {
  groupItems: 250, categorizeEntries: 150, description: 200, supplier: 120, productName: 60, contextNames: 400,
} as const;

export const groupRequestSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.string().regex(/^i\d{1,4}$/),
        description: z.string().trim().min(1).max(LLM_LIMITS.description),
        supplier: z.string().trim().min(1).max(LLM_LIMITS.supplier),
      }),
    )
    .min(1)
    .max(LLM_LIMITS.groupItems),
  existing: z
    .array(z.strictObject({ id: z.string().regex(/^p\d{1,4}$/), name: z.string().min(1).max(LLM_LIMITS.productName) }))
    .max(LLM_LIMITS.contextNames),
});
export type GroupRequest = z.infer<typeof groupRequestSchema>;

// Compact answer: {"g":[{"n":"Leche entera","i":["i1","i7"],"e":null}]}  (e = id p# of an existing product, or null)
export const groupResponseSchema = z.object({
  g: z.array(
    z.object({
      n: z.string().trim().min(1).max(LLM_LIMITS.productName),
      i: z.array(z.string()).min(1),
      e: z.string().nullable().optional(),
    }),
  ),
});
```

### Coverage invariant (D-11), pure
```ts
// src/domain/llm/reconcile.ts
export interface RawGroup { n: string; i: string[]; e?: string | null | undefined }
export interface Coverage { missing: string[]; unknown: string[]; duplicated: string[] }

export function coverageOf(sentIds: readonly string[], groups: readonly RawGroup[]): Coverage {
  const sent = new Set(sentIds);
  const seen = new Set<string>();
  const unknown: string[] = [];
  const duplicated: string[] = [];
  for (const group of groups) {
    for (const id of group.i) {
      if (!sent.has(id)) unknown.push(id);
      else if (seen.has(id)) duplicated.push(id);
      else seen.add(id);
    }
  }
  return { missing: sentIds.filter((id) => !seen.has(id)), unknown, duplicated };
}
// A batch is valid only when all three arrays are empty; anything else is a failed attempt.
```

### DeepSeek call: shape of the server module (ACC-04)
```ts
// src/lib/server/deepseek.ts
import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  DEEPSEEK_API_KEY: z.string().min(1),
  DEEPSEEK_MODEL: z.string().min(1).default("deepseek-flash"), // CLAUDE.md default; docs list deepseek-flash
});
const completionSchema = z.object({
  choices: z.array(z.object({ finish_reason: z.string().nullable(), message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).partial().optional(),
});

export type CallFailure =
  | "server_not_configured" | "upstream_auth" | "upstream_balance" | "upstream_rate_limited"
  | "upstream_unavailable" | "upstream_timeout" | "invalid_response" | "aborted";

// One attempt. Body is a plain literal, so `thinking` needs no @ts-expect-error.
async function attempt(key: string, model: string, system: string, user: string, maxTokens: number, signal: AbortSignal) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      temperature: 0,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal,
  });
  return res; // status mapping, empty-content check, finish_reason check and zod parse follow; never return res.text() to the browser
}
```
Per attempt: `signal = AbortSignal.any([requestSignal, AbortSignal.timeout(attemptMs)])`; retry only on empty/invalid content, `finish_reason !== "stop"`, 429 (backoff 1 to 2 s with jitter, honouring `Retry-After` if present), 500/503 and timeout; never on 400/401/402/422.

### Route handler order
```ts
// src/app/api/llm/group/route.ts
export const maxDuration = 180;
export async function POST(request: NextRequest) {
  const denied = await requireSession(request);            // 1. ACC-03, inside the handler
  if (denied) return denied;
  // 2. content-type must include application/json (same rule as src/app/api/auth/login/route.ts)
  // 3. content-length / text length <= 256 KB, then JSON.parse in try/catch -> 400 bad_request
  // 4. groupRequestSchema.safeParse -> 400 bad_request (reveals nothing about the fields)
  // 5. readEnv() -> 500 server_not_configured (message never names the variable)
  // 6. callDeepSeek({... signal: request.signal }) -> reconcile -> 200 { groups, meta } | { error, retryable }
}
```

### Error taxonomy (our statuses, never upstream's)

| Condition | Our status | `error` | `retryable` (client auto-retry? no, UI "Reintentar") |
|-----------|-----------|---------|------|
| No/invalid session | 401 | `unauthorized` | no (stop run, tell the user the session ended; batches already queued are kept) |
| Not JSON / schema mismatch / extra field | 400 | `bad_request` | no (client bug) |
| Body too large | 413 | `payload_too_large` | no |
| Env missing | 500 | `server_not_configured` | no, stop the run |
| DeepSeek 401 | 502 | `upstream_auth` | no, stop the run (all remaining batches would fail) |
| DeepSeek 402 | 502 | `upstream_balance` | no, stop the run |
| DeepSeek 429 after backoff | 503 | `upstream_rate_limited` | yes |
| DeepSeek 5xx/503, network | 502 | `upstream_unavailable` | yes |
| Attempt/deadline exceeded | 504 | `upstream_timeout` | yes |
| Empty/invalid JSON, coverage failure after the retry | 502 | `invalid_response` | yes |
| Vercel killed the function | 504 (platform page, not our JSON) | n/a | client treats any non-JSON non-200 as `upstream_timeout` |

Response `meta` (safe to return, useful at the checkpoint): `{ attempts, durationMs, finishReason, promptTokens, completionTokens, reasoningTokens }`. No content, no key.

### Extending the bundle scan (ACC-04 proof)
`scripts/check-bundle-secrets.mjs` builds with sentinel `APP_PASSWORD` / `SESSION_SECRET` and scans `.next/static` for the sentinels and the variable names (`needles = [passwordSentinel, secretSentinel, "APP_PASSWORD", "SESSION_SECRET"]`). Add a `DEEPSEEK_API_KEY` sentinel to the build `env`, add the sentinel and the names `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` to `needles`, and additionally walk `.next/server/app` for `*.html` and `*.rsc` (prerendered output that reaches browsers; the listing of `.next/server/app` in this repo contains `index.html`, `index.rsc`, `login.html`, `_not-found.html`). Do **not** scan route-handler chunks: server code legitimately contains the variable name.

## Verifying ACC-04 (automated)

1. **Build-time (static):** the extended `check-bundle-secrets.mjs` above. Optionally wire it as `pnpm check:secrets` and into CI/`verify` (it runs a full `next build`, so it is slow; today README treats it as a pre-deploy step).
2. **Compile-time:** `import "server-only"` in `deepseek.ts`, `requireSession.ts`, `session.ts`; a client component importing them fails `next build`. Optionally add `no-restricted-imports` for `@/lib/server/*` in `src/features/**`, `src/components/**`, `src/stores/**`, `src/lib/client/**` (same style as the existing domain-boundary rule in `eslint.config.mjs`).
3. **Handler tests (vitest, `vi.stubGlobal("fetch", …)`):** with `DEEPSEEK_API_KEY` set to a sentinel, drive every error branch of the upstream mock (401/402/429/500/timeout/empty/garbage, and a body that echoes the sentinel) and assert that no response body, header, or console output contains the sentinel and that no response contains the upstream body.
4. **Source guard test:** a vitest test that reads `src/**` and asserts there is no `NEXT_PUBLIC_DEEPSEEK`, no `DEEPSEEK_API_KEY` outside `src/lib/server/` (and tests/scripts/docs), cheap and catches regressions.
5. **Runtime smoke:** extend `smoke-auth.mjs`: unauthenticated POST to both `/api/llm/*` -> 401 `unauthorized`; authenticated POST with a bad body -> 400 `bad_request`; authenticated valid body with `DEEPSEEK_API_KEY` empty -> 500 `server_not_configured` (no upstream call). A real DeepSeek call is never made by automated tests.

## Evaluation

(No AI-SPEC, by user decision. This replaces it. `workflow.nyquist_validation` is `false` in `.planning/config.json`, so the separate Validation Architecture section is omitted; the test inventory below serves the same purpose.)

### Golden set (small, hand-written fixture; supplier labels only, no RFC)

Stored as `tests/fixtures/llm/golden-grouping.json` with `{ id, description, supplier }` items and four assertion kinds. Descriptions marked (sample) exist in the real data; the others are the synthetic guide cases from CONTEXT.md.

| Kind | Case | Expectation |
|------|------|-------------|
| MUST group | "MM LECHE ENT" (Walmart) + "LECHE ENTERA 1L" (other store; synthetic) | one product named like "Leche entera" (guide case) |
| SHOULD group (soft) | "1K MANCHEGO" + "QSO MANCHEGO" (Walmart, sample) | one product, name containing "manchego"; CONTEXT calls them candidates |
| SHOULD group (soft) | "MM LECHE DES" + "LECHE DESL L" (Walmart) + "Leche LacDel Desla" (Chedraui) (sample) | one "deslactosada" product, or two if brand-split; abbreviations are my reading [ASSUMED] |
| MUST NOT group | "MM LECHE ENT" with "MM LECHE DES" | different products (entera vs deslactosada) [ASSUMED reading of ENT/DES] |
| MUST NOT group | "Leche Evaporada Ne…" (Chedraui) with any fluid-milk item; "MM JAMONSERR" with "JAMON ZWAN" | different products |
| Singleton OK | "JAMON ZWAN" | CONTEXT says one-member product. **Discrepancy:** the sample also has "JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG" at another supplier, so grouping the two is also acceptable; ask the user which is intended |
| Coverage (hard) | every sent id returned exactly once, no unknown ids | invariant, D-11 |
| Names | unique case-insensitively within the response, 1 to 60 chars, Spanish, no «Sin categoría» | rules of D-12 |
| Categorize (soft) | supplier "TELEFONOS DE MEXICO" -> "Servicios (luz, agua, internet, teléfono)"; "GOOGLE OPERACIONES DE MEXICO" -> "Software y suscripciones" (seed names from `SEED_CATEGORIES`) | plausible, judged by the user [ASSUMED] |

### Offline (automated, no network)

| Req | Test | Notes |
|-----|------|-------|
| LLM-03, D-05 | `groupRequestSchema` rejects extra keys at every level (`rfc`, `uuid`, `total`, `fecha`, `folio`), over-limit arrays/strings, bad ids | unit |
| LLM-03, LLM-06 | Parse the anonymized CFDI fixtures, build the payload, `JSON.stringify` it and assert it contains none of: emisor RFC, receptor RFC, UUID, folio, fecha, any amount string | unit, `*.anon.test.ts` |
| LLM-06 | The dialog's list equals the serialized request body items (same builder) | component |
| D-04/D-25 | Free set = all - accepted members - pending members - ungrouped; dedupe by `(rfc, normalizeDescription)`; "No hay descripciones nuevas" when empty | unit |
| D-28 | Even split `ceil(N/MAX)`, supplier interleave, context names forwarded to batch k+1 | unit |
| D-11 | `coverageOf`: missing, unknown, duplicated ids each make the batch invalid | unit |
| D-12/D-17 | Name normalization/uniqueness, "new" category resolves to an existing one case-insensitively, 200-category limit | unit |
| D-27 | Upstream mock: empty content -> retry -> ok; invalid JSON -> retry; `finish_reason: "length"` -> fail; 401/402 -> no retry; 429 -> backoff (fake timers); deadline stops the retry | unit |
| LLM-05 | Runner: sequential order, "Lote N de M" progress, cancel stops later batches and keeps earlier ones, a failed batch does not stop the run, no enqueue after abort or generation change, second run sends only the still-free items | unit/component |
| LLM-04 | Reducers: accept, reject (members stay free), merge, split, rename, add-to-existing (D-21), "No agrupar" | unit |
| D-24 | Suggestions store: persisted under its own key, corrupt payload -> empty queue + notice, no RFC-free assumption broken (see OQ1), not part of the backup | unit |
| D-13 | `migrate` v2 -> v3 keeps categories/assignments/rules; v1 path unchanged; backup v1 golden loads with empty products; backup v2 round trip; v1-only reader says "newer" | unit |
| CAT-04 | Resolver precedence: rule > product > supplier > none; null rule beats product; product without category skipped; product category deleted -> falls through; Excel origin "Del producto"; invoice table label with product name | unit/component |
| ACC-03 | Handlers return 401 `{"error":"unauthorized"}` without/with tampered cookie; 400/413/500 branches | unit |
| ACC-04 | Section "Verifying ACC-04" items 1 to 5 | script + unit |

### Live checkpoint (the only thing that needs the user's key)

`checkpoint:human-verify`, after the tracer slice works end to end (group route + dialog + runner + queue), with the user's key in `.env.local` and `pnpm dev`. The checkpoint reads the `meta` of each response and the UI. Proposed pass criteria (user may adjust; judgment calls):

1. **Contract:** every sent id comes back in exactly one group, no unknown ids, **after at most the single server retry**, on 10 consecutive group runs over the real 227 items (re-run with a fresh queue each time, or against 30 to 50 item subsets).
2. **Empty/invalid JSON:** zero final failures in at least 20 batch calls (group + categorize); report the first-attempt failure rate (proposed ceiling 10%, above that the prompt or batch size changes).
3. **Thinking disabled and JSON mode together work:** `meta.reasoningTokens` is 0 or absent and `finish_reason` is `stop` on every call. (Docs are silent on this combination.)
4. **Latency:** per-batch wall time p95 below 60 s at the chosen batch limit (the attempt timeout is 80 s); no 504 from Vercel; if running on Vercel Preview, also confirm one batch completes there. If p95 is above 60 s, lower `MAX_ITEMS_PER_GROUP_BATCH` (120) and re-run.
5. **Quality:** golden MUST-group pairs grouped, MUST-NOT pairs not grouped (zero violations); SHOULD cases at least 2 of 3; the user reviews the first 30 multi-member groups and accepts at least 80% unchanged (user judgment); product names are readable Spanish.
6. **Categorize:** every entry returns; each answer is an existing category code or a flagged new name; the user judges at least 80% plausible.
7. **Cancel:** cancel mid-batch leaves no late cards; earlier batches stay in the queue after reload.
8. **Failure injection:** a deliberately wrong key shows a non-retryable configuration error and stops the run after one batch (does not burn through all M batches); an invalid body gives 400.
9. **Cost sanity:** token usage in `meta` is within 1.5x of the estimates above (about 7k in, 2.7k out for 227 items); if far above, the prompt is too long.

## UI-relevant constraints (for `/gsd-ui-phase 04` and the planner; no UI is designed here)

- **Latency per batch:** expect roughly 15 to 40 s per group batch (estimate); the whole sample is one batch at the recommended limit, so "Lote 1 de 1" may sit for tens of seconds. The batch bar cannot show intra-batch progress (non-streaming): show the "Lote N de M" text, a spinner/indeterminate state inside the batch, and the Cancel button enabled the whole time. The total number of batches M is known before sending.
- **Per-run states:** idle, running (batch k of M, queue grows as batches land, D-26), cancelling (abort sent, waiting for the stop), finished, finished with failures ("N lotes fallaron · Reintentar", D-27), stopped for a non-retryable reason (config/key/balance/session).
- **Cancel semantics end to end:** the browser aborts its `fetch`; the server aborts the upstream call when it sees the closed connection (best effort, see Pitfall 6); nothing from the cancelled batch is enqueued; batches already enqueued stay; the free set recomputes on the next press. The in-flight batch's descriptions simply remain free.
- **Failure/retry copy needs distinct messages** for: our session ended (401), DeepSeek key rejected, DeepSeek balance empty (402), temporary overload/rate limit, timeout, invalid answer, offline. Only the last four are "Reintentar" cases; the first three stop the whole run.
- **Reintentar scope:** retries only the failed batches' items, which is equivalent to pressing the button again (stateless resume).
- **Same-run guards:** the two buttons ("Agrupar productos", "Sugerir categorías") cannot run simultaneously (single run slot), both disabled while a run is active; a second press during a run is ignored like `useImport`.
- **Dialog (D-08):** the "Ver exactamente qué se envía" list is generated from the request body (items, and the context product names, and for categorize the category names); it must show the truncated text actually sent. For batches M > 1 the dialog covers the whole run (N items in M batches). The run summary count N and the supplier count M are derived from that body.
- **Persistence cues:** the queue survives reload (own key); the Productos tab only shows with invoices loaded (D-01) but pending cards reference `(rfc, key)` that need loaded invoices to display line counts (D-19), so cards must still render without invoices (counts shown as unavailable) in case a user reloads before reloading XMLs.
- **A11y:** progress uses the existing `aria-live="polite"` pattern of `ProcessingIndicator`; new text strings go in `es.ts`, formatted helpers in `messages.ts`.
- **Browser reload while a batch is in flight** loses only that batch.
- **Footer/privacy copy** must be revisited (Pitfall 9).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deepseek-chat` / `deepseek-reasoner` | `deepseek-flash` (V4.1-Flash-1017), `deepseek-v4-pro`; `thinking` toggle replaces the separate reasoner model | per DeepSeek docs read 2026-10-19 | Disable thinking per request; pin nothing about the snapshot |
| Vercel Hobby 10 to 60 s default | 300 s default and maximum with Fluid compute | per Vercel docs (page last updated 2026-08-24) | `maxDuration = 60` is a self-imposed cap |
| zod `.strict()` | `z.strictObject` recommended (both work in 4.6.7) | zod 4 | Use `strictObject` in new code |
| `middleware.ts` | `proxy.ts` | Next 16 | Already in place |

**Deprecated/outdated:** `deepseek-v4-flash` alias (accepted but retired); training-data assumptions that thinking is off by default.

## Runtime State Inventory

Not a rename/refactor phase, but it changes a persisted contract. The relevant inventory:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Users' `localStorage["invoicechecker:settings"]` at version 2; downloaded backup files at file version 1 | Data migration on load (v2 -> v3, `migrate`), backup reader branch for v1, writer emits v2 |
| Live service config | None (no server storage; DeepSeek holds no project config) | None |
| OS-registered state | None | None |
| Secrets/env vars | New: `DEEPSEEK_API_KEY`, optional `DEEPSEEK_MODEL`; existing `.env.example` lists only `APP_PASSWORD` and `SESSION_SECRET` | Add both to `.env.example`, README deployment steps and Vercel (Production and Preview); never `NEXT_PUBLIC_` |
| Build artifacts | `.next/` from earlier builds; no installed package changes on the recommended path | None |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 2.5 chars/token for Spanish uppercase abbreviations plus JSON punctuation (docs only give 3.3 for English) | Local measurement | Token counts off by up to 1.3x; cost stays negligible, `max_tokens` has margin |
| A2 | System prompt about 2,600 chars, mean product-name length 22 chars, 85% singleton groups | Local measurement | Output estimates shift by tens of percent; `meta` at the checkpoint gives real numbers |
| A3 | `deepseek-flash` non-thinking throughput is on the order of 100 to 200 tokens/s and TTFT 1 to 2 s (secondary benchmark, mostly reasoning-mode snapshots) | Recommendations | If much slower, batch limit must drop to about 120; checkpoint criterion 4 catches it |
| A4 | JSON mode behaves normally with `thinking: disabled` (docs silent) | DeepSeek facts | Could force a different `response_format` strategy or prompt-only JSON; checkpoint criterion 3 |
| A5 | Vercel's runtime delivers a client-disconnect signal to `request.signal` like the Node server does | Pitfall 6 | Orphaned upstream calls cost at most one batch of tokens; harmless by design |
| A6 | POST route handlers are never prerendered under `cacheComponents: true` | Integration points | A build error would show immediately; low risk |
| A7 | `AbortSignal.any` is available in the supported browsers (Chrome 116+, Safari 17.4+, Firefox 124+) | Don't Hand-Roll | Fallback is a small manual composition; users are on current browsers |
| A8 | Abbreviations: ENT = entera, DES/DESL = deslactosada, QSO = queso, 1K = 1 kg, in golden cases | Evaluation | Wrong golden expectations; the user confirms at the checkpoint |
| A9 | Where DeepSeek processes/stores API data is not stated in the docs read | Pitfall 9 | The privacy notice must not claim a location; user decides wording |
| A10 | `openai@7.32.0` has the same API surface as the 7.35.0 tarball inspected | Alternatives | Only matters if the SDK path is chosen |
| A11 | Persisted-limit numbers (products 2,000, members 5,000, ungrouped 5,000, name 60) | Open Question 6 | Judgment, not fact; user/planner decision |
| A12 | pnpm 11 may refuse very new releases (minimum release age) when adding `openai@7.39.0` | Alternatives | Only on the SDK path; pinning 7.32.0 avoids it |

## Open Questions

(Per CLAUDE.md §1 these are for the planner to put to the user. Each has a recommendation, none is decided.)

1. **Pending suggestions and RFC (D-24 vs D-09).** D-24 says the pending queue never contains RFC, but accepting a card must create members `(rfc, key, description, supplierName)` (D-09), and the queue must survive reload when invoices are not yet reloaded.
   - What we know: settings already store RFC (`supplierCategories`, `conceptRules`); the pending store is local, same trust boundary. In the sample no display name is shared by two RFCs, but nothing guarantees that.
   - What is unclear: whether D-24's "nunca RFC" was about the LLM payload only or also about this local key.
   - Recommendation: **allow `rfc` in the pending store** (it never goes to the LLM, the backup, or the server). The alternative (store only `supplierName` and resolve to RFC at accept time from the loaded ledger) breaks when invoices are not loaded and when two RFCs share a name.
2. **SDK or plain fetch.** See "Alternatives Considered". Recommendation: plain `fetch` + zod (no dependency, no `@ts-expect-error`, you control retry/deadline). If SDK: pin 7.32.0, `maxRetries: 0`, checkpoint before install.
3. **Batch limit and timeouts.** Recommendation: limit 250 items (sample in one batch), `max_tokens` 8192, attempt timeout 80 s, `maxDuration` 180, client timeout 190 s; conservative alternative 120 items / 50 s / 120 s / 130 s. The checkpoint decides whether to lower it.
4. **Retries 1 vs 2.** Recommendation: 1 retry (2 attempts), deadline-aware; the user's "Reintentar" button covers the rest. Two retries only if `maxDuration` is raised to 300.
5. **One route or two.** Recommendation: two (`/api/llm/group`, `/api/llm/categorize`) on one shared server module; different schemas and `max_tokens`; `smoke-auth` already probes `/api/llm/group`.
6. **Persisted limits for products/members/ungrouped and the backup size gate (D-13 extends D-30).** Recommendation: `products` 2,000, members 5,000 total, `ungroupedConcepts` 5,000, product name 60 chars (same as `categoryName`); and either raise `LIMITS.backupBytes` (for example 4 MiB) or accept that a very large settings file may exceed 1 MiB. The sample needs about 0.1 MB for 227 members.
7. **Privacy notice text (LLM-06) and the footer.** Recommendation: the D-08 sentence plus an explicit line that supplier names can be people's names and that the data goes to a third-party service; change `es.global.privacyLine` and the README statement in this phase. Whether to name DeepSeek's country/retention is the user's call (not verified here).
8. **Which concepts are sent.** D-03 says all invoices. In the sample 1 of 227 items is the payment complement concept `Pago` (tipo P). Recommendation: exclude tipo P concepts from the free set (they are not products); keep E (credit notes) because their descriptions are real product text. PITFALLS.md suggested excluding E for price comparison, which is a Phase 5 concern.
9. **Items the model omits.** Recommendation: a batch with any missing/unknown/duplicated id is invalid -> the single retry -> if it still fails the batch is failed and its items stay free (no silent local fallback). The alternative (auto-create singletons from omitted items) satisfies D-11 literally but hides model errors.
10. **Sensitive-pattern guard in descriptions.** Recommendation: a small pure check (RFC-shaped token, UUID, e-mail, 8+ digit run) that keeps a matching description out of the payload and lists it in the dialog as "no se enviará". Sample hits: 0. Cheap defense for LLM-03.
11. **Description cap of 200 chars** (cut text is what the dialog shows). Sample: max 250, p99 191.
12. **Golden case "JAMON ZWAN"** (single member per CONTEXT.md vs an apparent same-brand item at another supplier in the sample): which outcome does the user consider correct?
13. **Cancel and the invoices-cleared case.** If the user clears all invoices mid-run, should the run be cancelled (recommended; reuse the session `generation`) or keep adding pending cards (they are independent of loaded invoices)?

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, tests, route runtime | yes | v24.14.0 | — |
| pnpm | install/scripts | yes | 11.5.2 | — |
| `https://api.deepseek.com` reachable from the user's machine / Vercel | live checkpoint, production | not probed (no live calls by decision) | — | Offline tests cover everything else; checkpoint blocks the "quality" claims only |
| `DEEPSEEK_API_KEY` in `.env.local` / Vercel | live checkpoint, production | unknown (file exists, contents deliberately not read) | — | User must add it before the checkpoint |
| `Facturas/2025/*.xml` | measurements | yes (143 CFDI 4.0, git-ignored) | — | Anonymized fixtures in `tests/fixtures/cfdi/anon/` for automated tests |
| Playwright + Chrome | optional e2e | installed package; Chrome per README | 1.64.0 | Skip e2e; component tests suffice |

**Missing dependencies with no fallback:** none for planning.
**Missing dependencies with fallback:** DeepSeek key/network (live checkpoint only).

## Security Domain

`security_enforcement` is enabled (`.planning/config.json`: `security_enforcement: true`, `security_asvs_level: 1`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | existing shared-password login |
| V3 Session Management | yes (reused) | existing HttpOnly/SameSite=Lax/Secure signed cookie; `requireSession()` reuses `verifySessionToken` |
| V4 Access Control | yes | proxy + in-handler `requireSession()` (defense in depth); an authenticated-only API |
| V5 Input Validation | yes | `z.strictObject` request schemas, size/count/length caps, JSON-only content type; zod on every LLM response and every localStorage payload |
| V6 Cryptography | no new | the key is an env secret; no custom crypto |
| V7 Error Handling and Logging | yes | generic error codes; never log keys, `Authorization`, descriptions or upstream bodies |
| V8 Data Protection | yes | strict payload (no RFC/UUID/amounts/dates/folios), dialog shows the literal payload, third-party transfer disclosed |
| V13 API and Web Service | yes | POST only, `application/json` required (cross-site forms cannot send it without preflight; cookie is SameSite=Lax), body cap |
| V14 Configuration | yes | `DEEPSEEK_API_KEY` server-only, not `NEXT_PUBLIC_`, in `.env.example` and Vercel, `.env*` already git-ignored |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure to the client (bundle, response, logs) | Information disclosure | `server-only`, no upstream passthrough, bundle scan with sentinel, handler tests |
| Unauthenticated use of the LLM route drains the balance | Elevation of privilege / DoS | proxy 401 + in-handler `requireSession()`; CVE-2025-29927-style middleware bypasses make the in-handler check mandatory [per .planning/research/PITFALLS.md] |
| Authenticated abuse (loop of large calls) | DoS / cost | body cap, item caps, per-run batch cap, short max_tokens, one run slot in the UI |
| Prompt injection via invoice descriptions | Tampering | instructions in system message, data as JSON, length caps, id-only validated output, mandatory human review (LLM-04) |
| Sensitive data in the payload (RFC, UUID, amounts, personal names) | Information disclosure | strict schema, shared builder, pattern guard, honest notice; personal-name suppliers disclosed |
| Late write after cancel | Tampering (state) | abort + generation guard + idempotent enqueue |
| Corrupt or hostile localStorage / backup file | Tampering | zod with limits and integrity rules; total `migrate` |
| Formula injection in Excel | Tampering | typed string cells (existing writer); never formula cells from names |
| Verbose error leak of upstream detail | Information disclosure | taxonomy table |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `src/domain/settings/{types,schema,migrate,normalize,resolver,backup,assignments,categories}.ts`, `src/stores/{settingsStore,sessionStore,storageStatusStore}.ts`, `src/lib/server/session.ts`, `src/proxy.ts`, `src/app/api/auth/login/route.ts`, `src/features/shell/AppShell.tsx`, `src/features/upload/ProcessingIndicator.tsx`, `src/features/invoices/{ConceptCategorySelect.tsx,columns.ts}`, `src/features/export/sheets/conceptos.ts`, `src/features/categories/useCategorySettings.ts`, `src/lib/copy/es.ts`, `next.config.ts`, `vitest.config.mts`, `vitest.setup.ts`, `eslint.config.mjs`, `scripts/check-bundle-secrets.mjs`, `scripts/smoke-auth.mjs`, `package.json`, `.planning/config.json`, `.planning/research/PITFALLS.md`
- Next docs in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/{maxDuration,index}.md`; `node_modules/next/dist/server/web/spec-extension/adapters/next-request.js` (abort on close)
- `node_modules/@base-ui/react/tabs/panel/TabsPanel.d.ts` (`keepMounted` default false); `node_modules/zod/v4/classic/schemas.d.ts`
- DeepSeek official docs: https://api-docs.deepseek.com/ , /quick_start/pricing , /quick_start/rate_limit , /quick_start/error_codes , /quick_start/token_usage , /guides/json_mode , /guides/thinking_mode , /api/create-chat-completion , /updates
- Vercel docs: https://vercel.com/docs/functions/configuring-functions/duration , https://vercel.com/docs/functions/limitations
- npm registry (`npm view openai …`), `openai@7.35.0` tarball inspected in the scratchpad (README, `client.d.ts`, `package.json`)

### Secondary (MEDIUM confidence)
- Artificial Analysis DeepSeek V4/V4.1 Flash speed figures via web-search summary (https://artificialanalysis.ai/models/deepseek-v4-1-flash/providers); snapshots differ by variant and reasoning mode

### Tertiary (LOW confidence)
- Third-party claims of 420 to 532 tokens/s for V4.1 Flash (not used for any number here)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependency required; every library is in `package.json`; SDK alternative inspected from the published tarball.
- Architecture: HIGH for integration points (read the files); MEDIUM for the exact protocol shape (compact keys, codes), which the checkpoint can still adjust.
- Pitfalls: MEDIUM-HIGH. DeepSeek behaviors that the docs document are HIGH; JSON-mode-with-thinking-disabled, real latency and quality are unverified by design.

**Research date:** 2026-10-19
**Valid until:** 2026-11-02 (DeepSeek model aliases, pricing and the `openai` package move weekly; re-check model names and `npm view openai` before implementation)
