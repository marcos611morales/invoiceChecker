# Phase 3: Categorías propias y exportación a Excel - Research

**Researched:** 2026-10-16
**Domain:** Client-side settings persistence (zustand `persist` migration + versioned backup file), category split inside the pure accounting layer (big.js), and `.xlsx` export with `write-excel-file` 4.1.1 (`/universal`)
**Confidence:** HIGH for the Excel library behaviour (executed for real, including in Chrome under the project's CSP), for the zustand persist mechanics (source read) and for the codebase integration points (source read). MEDIUM for the Base UI Select inside AlertDialog and the TanStack v9 default multi-sort (not exercised). The "opens correctly in Excel" check is still pending (Excel is installed on this machine, see Environment Availability).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Las decisiones de la Fase 2 (02-CONTEXT.md D-01..D-48) siguen vigentes y no se repiten aquí. Las más relevantes: pestañas (D-01), barra de filtros (D-11, D-14), variación con colores y "Sin datos" (D-20), tabla de facturas con fila desplegable (D-24), monto por concepto según el modo IVA (D-25/D-38), filas "No suma" (D-27), proveedor por RFC (D-43) y store de ajustes `invoicechecker:settings` v1 (D-06).

#### Gestión de categorías
- **D-01:** Una pestaña nueva **"Categorías"** se suma a Dashboard / Calidad de datos / Importación. Tiene dos secciones: la lista de categorías (crear, renombrar, borrar) y una tabla de proveedores con un selector de categoría por defecto en cada fila.
- **D-02:** La primera vez existen **9 categorías sugeridas, editables y borrables**: Insumos de cafetería · Abarrotes y despensa · Limpieza e higiene · Servicios (luz, agua, internet, teléfono) · Software y suscripciones · Comisiones bancarias · Mantenimiento y reparaciones · Papelería y oficina · Otros. "Sin categoría" no es una categoría del usuario: es el valor implícito y no se puede borrar ni renombrar.
- **D-03:** La tabla de proveedores muestra los proveedores de las **facturas cargadas y también los que tienen una categoría guardada** aunque hoy no estén cargados. Estos últimos se marcan "sin facturas cargadas" y se les puede quitar la asignación. Por eso el ajuste guarda el **nombre del proveedor junto al RFC**. — **Reversibility:** costly — forma parte del esquema persistido y del archivo de respaldo.
- **D-04:** Los nombres de categoría **no se repiten**: la comparación ignora mayúsculas y recorta espacios en los extremos. Hay un error en línea al crear o renombrar, y "Sin categoría" es un nombre reservado. Cada categoría tiene un id interno estable; las asignaciones apuntan al id, no al nombre, así que renombrar no rompe nada.
- **D-05:** Borrar una categoría **con asignaciones** abre un diálogo: "Borrar '{nombre}': la usan N proveedores y M conceptos. Pasarlos a: [Sin categoría ▾]" con el botón Borrar. Sin asignaciones, solo se pide confirmar. Después aparece el aviso "Categoría borrada · Deshacer", como D-29 de la Fase 2.

#### Persistencia y respaldo (AJUS-01/02)
- **D-06:** Categorías, asignaciones de proveedor, ajustes de concepto y modo IVA viven en el store de ajustes persistido. El contrato `invoicechecker:settings` v1 (`{ ivaMode }`) **se migra** a una versión nueva con `migrate` y conserva el modo IVA. La lectura se valida con zod; si falla, se usan los valores por defecto. — **Reversibility:** one-way — es el esquema de localStorage de los usuarios y la base del archivo de respaldo; un cambio posterior exige otra migración.
- **D-07:** Los botones **"Descargar ajustes"** y **"Subir ajustes"** están en la pestaña Categorías. El archivo es JSON, se llama `invoicechecker-ajustes-AAAA-MM-DD.json` y contiene **todo**: categorías, asignaciones de proveedor (con nombre), ajustes de concepto y modo IVA, con un campo de versión. En la Fase 4 se le agregan los productos agrupados. — **Reversibility:** one-way — un archivo descargado es un contrato publicado: las versiones futuras deben poder leer los archivos v1 que el usuario ya guardó.
- **D-08:** Subir un archivo válido **reemplaza** los ajustes actuales tras confirmar. El diálogo resume el contenido ("9 categorías, 24 proveedores, 7 conceptos ajustados") y el botón dice "Reemplazar mis ajustes". Un archivo inválido se rechaza con un mensaje y **no toca** los ajustes actuales (criterio 2).

#### Asignación por concepto
- **D-09:** Ajustar la categoría de un concepto guarda una **regla por RFC del proveedor + descripción normalizada**. Aplica a esa línea y a todas las líneas iguales de ese proveedor, en las facturas cargadas hoy y en cargas futuras. Las otras líneas de la misma factura no se tocan si su descripción es distinta (criterio 1). Al aplicar, el control dice cuántas líneas abarca ("Aplica a 12 líneas de Nueva Wal-Mart de México"). — **Reversibility:** costly — la clave de la regla forma parte del esquema persistido y del respaldo.
- **D-10:** Normalización de la descripción: se ignoran mayúsculas, espacios repetidos o en los extremos y **acentos**. Números y palabras sí cuentan: "Café  Molido 1kg" = "CAFE MOLIDO 1KG", pero "CAFE 1KG" ≠ "CAFE 500G".
- **D-11:** La categoría de un concepto se cambia **en la fila desplegable de la tabla de facturas del Dashboard** (D-24 de la Fase 2). Cada concepto muestra un selector pequeño. Si la categoría viene del proveedor, se ve en gris ("Limpieza e higiene · del proveedor"); si fue ajustada, se ve normal y con la opción "Quitar ajuste". No hay lista masiva de conceptos en la pestaña Categorías (eso es para la Fase 4).
- **D-12:** Una **nota de crédito** se clasifica con la misma regla que cualquier factura (ajuste del concepto > proveedor) y **resta de esa categoría**. No se hereda la categoría de la factura relacionada.

#### Montos por categoría y filtro
- **D-13:** El monto de una factura **se reparte por concepto**: cada concepto suma a su categoría con su monto según el modo IVA (D-25/D-38 de la Fase 2). Si la suma de conceptos no da el monto de la factura (diferencia de redondeo, D-09 de la Fase 2), **la diferencia va a la categoría del proveedor**. Así la suma de todas las categorías siempre cuadra con el gasto total del Dashboard y del Excel.
- **D-14:** Con el filtro de categoría activo, **KPIs, tendencia y ranking de proveedores suman solo la parte de esas categorías**. La tabla muestra las facturas con al menos un concepto de esas categorías, con el monto de esa parte y debajo "de {total} total". Al abrir la fila, los conceptos de otras categorías se ven atenuados. El número de facturas cuenta las que tienen alguna línea de las categorías elegidas, y el ticket promedio = gasto parcial ÷ ese número.
- **D-15:** El filtro de categoría sigue el patrón de D-14 de la Fase 2: multiselección con casillas y buscador. Cada opción muestra el **número de facturas** con al menos una línea de esa categoría ("Limpieza e higiene (14)"), y **"Sin categoría" es una opción más**. Vive en el store de sesión y no se persiste.

#### Vistas en el Dashboard (DASH-03/05/07/08)
- **D-16:** Un bloque **"Gasto por categoría"** se agrega **junto al ranking de proveedores**. Tiene barras horizontales de **todas** las categorías con gasto (monto y %) y, por categoría, el **promedio mensual** (mismo divisor que D-06/D-12 de la Fase 2) y la **variación % mes contra mes**. "Sin categoría" aparece siempre que tenga gasto.
- **D-17:** La variación % mes contra mes compara el **último mes del rango con el mes calendario anterior, aunque quede fuera del rango**, con los mismos filtros salvo la fecha (como D-20 de la Fase 2). Si ese mes no tiene gasto en la categoría o no hay facturas cargadas de ese mes, se muestra en gris "Sin dato del mes anterior"; nunca se calcula un % contra $0. Los colores siguen D-20.
- **D-18:** Hacer clic en una categoría (bloque D-16) o en un proveedor (ranking) **agrega ese valor como filtro** (etiqueta que se puede quitar) y lleva la vista a la tabla. No hay diálogo ni pantalla de detalle aparte (DASH-08).

#### Excel (XLS-01/02/03)
- **D-19:** El botón **"Exportar a Excel"** está en la **barra superior**, junto a "Agregar facturas" (el lugar reservado en D-06 de la Fase 1), y solo aparece con facturas cargadas. El archivo se llama `gastos-AAAA-MM_AAAA-MM-{con|sin}-iva.xlsx`, con el rango y el modo (p. ej. `gastos-2025-01_2025-12-con-iva.xlsx`).
- **D-20:** Las hojas Facturas y Conceptos incluyen **todas las facturas del filtro, también las que no suman** (igual que la tabla, D-27/D-28 de la Fase 2). Una columna "Estado" dice "Suma" o el motivo por el que no suma (Pago, $0, Excluida, Sustituida, Datos inválidos, etc.), y en esas filas el monto que cuenta queda en 0 o vacío. La suma de la columna de monto cuadra con el Dashboard.
- **D-21:** Con el filtro de categoría activo, la hoja Conceptos lleva **solo las líneas de esas categorías**. La hoja Facturas lleva el monto de esa parte más una columna con el total de la factura (coherente con D-14).
- **D-22:** Columnas de monto: una columna **"Monto (con IVA)" o "Monto (sin IVA)" según el modo**, que es la que cuadra con el Dashboard, más el **desglose del XML** como referencia (Subtotal, Descuento, IVA, IEPS, Total). Conceptos lleva además cantidad, unidad, precio unitario, ClaveProdServ, Categoría y si la categoría viene del proveedor o fue ajustada.
- **D-23:** Las hojas de resumen repiten las cifras del Dashboard, cada una con una fila de total. **Por categoría:** monto, %, promedio mensual y variación % del último mes. **Por proveedor:** RFC, nombre, monto, %, número de facturas y ticket promedio. **Por mes:** una fila por mes del rango (incluidos los de $0) con el monto y el número de facturas. La hoja Parámetros lista los filtros activos y el modo IVA (XLS-01).
- XLS-03 aplica tal cual: montos como números con formato MXN, fechas como fechas y RFC, UUID, folio y ClaveProdServ como texto.

### Claude's Discretion
- Textos exactos de diálogos, avisos y etiquetas, más allá de los citados.
- Orden de la lista de categorías y de la tabla de proveedores (sugerido: categorías en orden alfabético con "Otros" al final; proveedores por gasto o por nombre).
- Distribución visual fina del bloque "Gasto por categoría" junto al ranking (D-16) y su comportamiento en móvil; el UI-SPEC de la fase puede afinarla.
- Formato exacto del JSON de respaldo y del esquema persistido, dentro de D-06/D-07 (id estable por categoría, versión explícita, validación zod).
- Orden y nombres exactos de las columnas del Excel, dentro de D-20..D-23.
- **Inferido, confirmar en planeación si hay duda:** la pestaña Categorías se ve solo con facturas cargadas, como las demás pestañas de D-01 (la pantalla vacía no cambia); la posición de la pestaña Categorías (sugerido: después de Dashboard); si las filas "No suma" llevan categoría en la tabla y el Excel (sugerido: sí, como informativa).

### Deferred Ideas (OUT OF SCOPE)
- Lista masiva de descripciones de conceptos por proveedor para clasificar en bloque: se descartó para esta fase; la Fase 4 (productos agrupados por el LLM) cubre esa necesidad.
- Ajuste de una sola línea exacta (por UUID + número de concepto) además de la regla por descripción: se descartó; se usa solo la regla por descripción (D-09).
- Combinar un archivo de ajustes con los actuales (en vez de reemplazar): se descartó; solo se reemplaza (D-08).

### Locked by 03-UI-SPEC.md (approved 2026-10-16, "User decisions" Q1-Q10, do not re-open)
Q1 layout (trend full width, then 50/50 categorías | proveedores) · Q2 tab order Dashboard, Categorías, Calidad de datos, Importación, shown only with loaded invoices · Q3 category block shows only chosen categories while the filter is active · Q4 "Sin categoría" selectable per concept = explicit adjustment; deleting a category turns its concept adjustments into explicit "Sin categoría" · Q5 concept change applies at once with "Deshacer" toast · Q6 selector editable on non-summing rows, Excel fills category on them · Q7a foreign-currency breakdown in MXN plus Moneda and Tipo de cambio columns · Q7b "Diferencia de redondeo" line per invoice in Conceptos · Q8 storage failures reported (toast on unreadable read, Alert on failed write) · Q9 top-bar labels may collapse under 1024px · Q10 labels «Conservar categoría» / «Borrar categoría» / «Cancelar cambio de nombre».
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Crear, renombrar y borrar categorías propias | Pure reducers in `src/domain/settings`, stable ids, name rules D-04; delete with reassign + undo snapshot (Patterns 2, 3) |
| CAT-02 | Categoría por defecto a cada proveedor | `supplierCategories: [{rfc, name, categoryId}]` array (not a record keyed by RFC), Pitfall 8 |
| CAT-03 | Cambiar la categoría de un concepto individual | `conceptRules: [{rfc, key, categoryId \| null}]`, normalization (Pattern 3, Open Question 2), line-count index |
| CAT-05 | Al borrar, asignaciones pasan a "Sin categoría" u otra | `deleteCategory(settings, id, target)` reducer + snapshot for undo (Q4 semantics) |
| AJUS-01 | Ajustes en localStorage con versión y validación | zustand `persist` v1 to v2 `migrate` + `merge`, zod, never-throwing migration (Pattern 2, Pitfalls 4-7) |
| AJUS-02 | Descargar y subir ajustes | Versioned backup file with frozen v1 schema, size cap, reasons mapping (Pattern 4) |
| DASH-03 | Ranking de gasto por categoría | `categoryBreakdown` selector over `splitEntry` parts (Pattern 5) |
| DASH-05 | Promedio mensual por categoría | net / `kpis(...).months`, same divisor as the KPI |
| DASH-07 | Variación % mes contra mes por categoría | Month-pair filters + `deltaFraction` (null on previous <= 0) (Pattern 5) |
| DASH-08 | Clic en categoría o proveedor ve sus facturas y conceptos | Click adds to `filters.categories` / `filters.suppliers` (UI-SPEC D-18) |
| FILT-03 | Filtrar por una o varias categorías | `Filters.categories` + `scopeToCategories` stage after `applyFilters` (Pattern 5) |
| XLS-01 | Excel con 6 hojas y Parámetros | Sheet builders as pure functions with an internal cell model (Pattern 6) |
| XLS-02 | Respeta filtros y modo IVA | One shared `selectView` function used by Dashboard and Export (Pattern 1) |
| XLS-03 | Números MXN, fechas, RFC/UUID/folio texto, totales cuadran | Cell mapper rules; `Date.UTC`; rounded-difference rule (Pitfalls 2, 3, 10) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Root `./CLAUDE.md` and `./.claude/CLAUDE.md` read this session. Actionable directives the plans must honor (same authority as locked decisions):

- **Siempre preguntar, nunca inferir.** Anything ambiguous and not settled by CONTEXT.md or UI-SPEC.md must go to the user; do not choose silently. See Open Questions (Q-A..Q-F) and the `[ASSUMED]` rows in the Assumptions Log.
- **TypeScript strict** with `strict: true` and `noUncheckedIndexedAccess: true`. No `any`, no `@ts-ignore`/`@ts-nocheck` (only `@ts-expect-error` with a reason), no non-null `!`, no `as` to force unverified types. External data (backup JSON, `localStorage`) is validated with zod before typing.
- **Verification before "done":** `pnpm tsc --noEmit`, `pnpm eslint .`, `pnpm vitest run` must pass.
- Package manager pnpm; ESLint mandatory; processing in the browser, no database; Vercel deploy.
- `./.claude/CLAUDE.md` stack decisions locked by the user: `write-excel-file` from `write-excel-file/universal`, pure sheet builders, `Number` cells with `"$#,##0.00"`, `Date` cells with `"dd/mm/yyyy"`, text with `format: "@"`, download via `URL.createObjectURL`; zustand `persist` with `version`/`migrate`/`partialize`/`skipHydration` and zod validation; big.js for money.
- **AGENTS.md:** "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before Next-specific code (this phase touches only `next.config.ts` headers, nothing else Next-specific).
- **ESLint domain boundary** [VERIFIED: eslint.config.mjs:9-27]: files in `src/domain/**` may not import `react`, `next`, `zustand`, `@/components/*`, `@/stores/*`, `@/features/*`, `@/lib/*`. Consequences: the settings schemas/reducers, `splitEntry` and category selectors live in `src/domain/...`; the sheet builders need Spanish copy (`@/lib/copy`) so they live in `src/features/export/` (or `src/lib/export/`), not in `src/domain`; the description normalizer must be re-implemented in the domain (cannot import `normalizeSearch` from `@/lib/format`).
- No project skills directory exists (`.claude/skills`, `.agents/skills` absent).
- Real invoices in `Facturas/2025/*.xml` contain personal data: nothing from them is copied here (only aggregate counts were measured).

## Summary

The phase is three mostly independent pieces. (1) A settings layer: the single persisted store `invoicechecker:settings` goes from v1 `{ ivaMode }` to a v2 that holds categories (stable ids), supplier assignments (RFC + name) and concept rules (RFC + normalized description), plus a versioned backup file whose v1 schema is a published, never-changing contract. (2) A pure accounting extension: a per-entry split by concept into category parts (the rounding difference goes to the supplier's category), a category filter implemented as a *scoping transform* that rewrites each entry's amounts to the chosen categories' part so that every existing selector (`kpis`, `monthlySeries`, `supplierRanking`) keeps working unchanged, and new selectors for the category block. (3) An export pipeline: pure sheet builders over the same filtered view as the Dashboard, a thin writer using `write-excel-file/universal`, and a download helper.

The most important finding is a **production blocker for the export that the compile-time verification could not see**: `write-excel-file/universal` `toBlob()` compresses with fflate's async `zip()`, which, for any single zipped part of 160,000 bytes or more (uncompressed), spawns a Web Worker from a `blob:` URL. The project's CSP (`script-src 'self' 'unsafe-inline'`, no `worker-src`) forbids that. I reproduced it in the installed Chrome: with the exact project CSP a 330-row x 18-column sheet makes `toBlob()` never settle (promise stays pending, console shows the CSP violation); adding `worker-src 'self' blob:` fixes it. The real Conceptos sheet (362 concept lines + 27 rounding-difference lines in the sample, 18 columns) is above the threshold, so the export button would hang on "Exportando…" in production while every Vitest test passes (Node uses `worker_threads`). The fix is a one-line CSP change that needs the user's approval (Open Question Q-A), plus a defensive timeout around `toBlob()`.

Other verified facts that shape the plans: dates must be built with `Date.UTC` (a local `new Date(y, m, d)` yields fractional serials and an off-by-one day outside UTC-6); `NaN`/`Infinity`/invalid `Date` are written verbatim into the XML and corrupt the file, so the cell mapper must guard them; string cells are shared strings and never evaluate formulas (formula injection is already neutralized by `type: String`); the existing `safeStorage.getItem` validates the envelope against the *current* state schema, which would silently discard v1 data and break the `ivaMode` preservation, so the envelope must carry `state: z.unknown()` and validation must move into `migrate`/`merge`; zustand swallows exceptions thrown by `migrate`, and calling `set` from inside `storage.setItem` would loop.

**Primary recommendation:** Build `src/domain/settings` (schemas, migration, reducers, backup file, normalizer) and `src/domain/accounting/categories.ts` (split, scope, breakdown) first with tests, add `worker-src 'self' blob:` to the CSP after the user approves it, install `write-excel-file@4.1.1 --save-exact` behind the usual package-approval step, and write the sheet builders against an internal cell model so tests never need to unzip an `.xlsx`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Category / assignment / rule persistence | Browser (localStorage via zustand) | — | No database by project constraint; `invoicechecker:settings` is the only persisted store |
| Backup file download / upload / validation | Browser | — | JSON built and parsed client-side; nothing is sent to the server |
| Category resolution (rule > supplier > none) and amount split | Browser, pure domain (`src/domain`) | — | Pure functions over `LedgerEntry` + settings; mode-independent like the ledger |
| Category filter, breakdown, variation | Browser, pure domain | UI (React) for rendering | Same selectors feed Dashboard and Excel (FILT-05) |
| Excel sheet content | Browser, pure builders (`src/features/export`) | Domain selectors | Needs Spanish copy, so not in `src/domain` |
| `.xlsx` zip/serialize | Browser (library, fflate) | — | `toBlob()`; subject to the page CSP (worker-src) |
| File download | Browser (`<a download>` + object URL) | — | `blob:` navigation for download is not restricted by the project CSP (verified in Chrome) |
| CSP header | Frontend server (`next.config.ts` headers) | — | Needs `worker-src` for the fflate worker path |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| write-excel-file | 4.1.1 (exact pin) | Multi-sheet `.xlsx` as a `Blob` | Locked by `.claude/CLAUDE.md` and 03-UI-SPEC. Registry: latest 4.1.1, modified 2026-06-08, dependency only `fflate ^0.8.2`, MIT, no postinstall, ~1.4M downloads/week [VERIFIED: npm registry, `gsd-tools package-legitimacy check` = OK] |
| zustand | 5.0.15 (already installed) | `persist` with `migrate`/`merge` | Existing store pattern [VERIFIED: package.json] |
| zod | 4.6.7 (already installed) | Validate localStorage and backup file | Existing pattern; behaviours probed this session (strip unknown keys, `discriminatedUnion` gives `invalid_union` for an unknown version) |
| big.js | 7.0.1 strict (already installed) | All money arithmetic | `Big.strict = true` in `decimal.ts` [VERIFIED: decimal.ts:11]; never feed numbers |
| @tanstack/react-table | 9.3.1 (already installed) | Supplier table (sorting + pagination) | Same feature set as `InvoiceTable.tsx`; nothing new needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fflate | 0.8.3 (transitive of write-excel-file) | Unzip the produced `.xlsx` in a Vitest smoke test | Only if the user approves it as a direct devDependency (Open Question Q-E). Otherwise test builders only plus a `PK` magic-bytes smoke test |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSP `worker-src 'self' blob:` | Avoid the async path | Not possible with the public API: `toBlob()` of `/universal` always calls `zip()` (async); the sync variant is not exported (package `exports` map hides it). Reducing sheet size under 160 KB is not controllable (Conceptos is ~290 KB) |
| write-excel-file | ExcelJS / SheetJS | Rejected by the user in `.claude/CLAUDE.md`; not reopened |
| `read-excel-file` (same author) to read back files in tests | — | Heavier deps (`worker-f`, `unzipper-esm`); used only in my sandbox to confirm round-trips; not recommended for the project |

**Installation (needs the package-approval step; do not run during research):**
```bash
pnpm add write-excel-file@4.1.1 --save-exact
```
Import only `write-excel-file/universal`, and load it lazily inside the click handler (`await import("write-excel-file/universal")`) so it stays out of the initial bundle. Never import the package root or `/browser`.

**Version verification:** `npm view write-excel-file version` returned 4.1.1 (latest, published 2026-06-08T04:57:35Z); `fflate` installed as 0.8.3 [VERIFIED: npm registry, sandbox install this session].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| write-excel-file | npm | since 2021-06-17 (~5 yrs) | 1,422,427 / week | gitlab.com/catamphetamine/write-excel-file | OK | Approved. Locked by the user in `.claude/CLAUDE.md`; planner still places the usual package-approval step before the first plan that installs it |
| fflate | npm | multi-year | 99,318,677 / week | github.com/101arrowz/fflate | OK | Approved as a transitive dependency; a direct devDependency only if Q-E is approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
`npm view write-excel-file scripts.postinstall` is empty (no postinstall). `read-excel-file` was installed only inside the throwaway sandbox and is not recommended for the project.

## Architecture Patterns

### System Architecture Diagram

```
 localStorage "invoicechecker:settings" (envelope {state, version})
        │ getItem: parse JSON + envelope {state: unknown, version}
        ▼
 migrate(v1) / merge ── zod ──► SettingsData v2 { ivaMode, categories[], supplierCategories[], conceptRules[] }
        │ fallback to seeds on failure ──► readFailed flag ──► one toast (Q8)
        ▼
 useSettingsStore (persisted) ◄────── actions = pure reducers (src/domain/settings)
        │                                   ▲  Categorías tab, concept Select, delete dialog (+undo snapshot)
        │                                   │  upload: file ≤1 MB → JSON.parse → header check → zod → confirm → replaceAll
        │
        ▼ resolver = makeResolver(settings)   (Map-based: rule(rfc,key) > supplier(rfc) > SIN_CATEGORIA)
 ┌───────────────────────────────────────────────────────────────────────────────────┐
 │ session invoices ─► buildLedger (unchanged) ─► LedgerEntry[]                       │
 │      applyFilters(range, suppliers, formas)  ─► visible                            │
 │      scopeToCategories(visible, filters.categories, resolver) ─► ScopedEntry[]     │
 │          (amounts := sum of chosen categories' parts; drops entries with no part;  │
 │           keeps fullConIva/fullSinIva)                                             │
 └───────────────────────────────────────────────────────────────────────────────────┘
        │  one function: selectView(ledger, filters, span, resolver)  (Dashboard AND export)
        ├──► kpis / monthlySeries / supplierRanking / categoryBreakdown / monthlyCounts
        │         ──► DashboardTab (KpiRow, TrendChart, CategorySpend, SupplierRanking, InvoiceTable)
        └──► sheet builders (Facturas, Conceptos, 3 resúmenes, Parámetros) ─► internal cell model
                  ─► toLibrarySheet() ─► await import("write-excel-file/universal")
                  ─► writeExcelFile(sheets).toBlob()  [fflate async zip; Worker if a part ≥160 KB ⇒ needs CSP worker-src blob:]
                  ─► downloadBlob(blob, "gastos-AAAA-MM_AAAA-MM-con|sin-iva.xlsx") ─► toast
```

### Recommended Project Structure
```
src/
├── domain/
│   ├── settings/
│   │   ├── types.ts            # SettingsData, Category, SupplierAssignment, ConceptRule, SIN_CATEGORIA_KEY, seeds
│   │   ├── schema.ts           # zod: settingsV2Schema (+ superRefine integrity), v1 schema, caps
│   │   ├── migrate.ts          # resolvePersisted(raw, version) -> { data, status }
│   │   ├── normalize.ts        # normalizeDescription (D-10), ruleKey(rfc, desc)
│   │   ├── categories.ts       # addCategory/renameCategory/deleteCategory/restore (pure reducers)
│   │   ├── resolver.ts         # makeResolver(settings): resolve(rfc, descripcion), supplierCategory(rfc)
│   │   ├── backup.ts           # buildBackup(settings, ...), parseBackup(text): Result (frozen v1)
│   │   └── *.test.ts           # incl. golden v1 file fixture and v1 localStorage fixture
│   └── accounting/
│       ├── categories.ts       # splitEntry, scopeToCategories, categoryBreakdown, categoryOptions, monthlyCounts
│       ├── filters.ts          # Filters gains `categories`; isDefaultFilters/previousFilters updated
│       └── status.ts           # entryStatus(entry) extracted from columns.ts stateOf (shared by table + Excel)
├── stores/
│   ├── settingsStore.ts        # v2, envelope with state: unknown, migrate/merge, actions delegate to reducers
│   ├── storageStatusStore.ts   # NOT persisted: { readFailed, writeFailed }
│   └── sessionStore.ts         # filters.categories, setCategories, AppTab += "categorias"
├── features/
│   ├── categories/             # CategoriesTab, CategoryList, SupplierCategoryTable, DeleteCategoryDialog, BackupControls
│   ├── dashboard/              # CategorySpend.tsx (new), useDashboardView.ts (shared hook), FilterBar + category trigger
│   ├── invoices/               # ConceptCategorySelect inside ConceptsPanel; Categoría column
│   ├── export/                 # sheets/*.ts builders, cellModel.ts, toLibrarySheet.ts, exportWorkbook.ts, downloadBlob.ts, ExportButton.tsx
│   └── shell/                  # AppShell TABS + isAppTab, TopBar actions
└── lib/copy/                   # es.ts + messages.ts additions (Spanish strings from the UI-SPEC contract)
next.config.ts                  # CSP: + "worker-src 'self' blob:" (after approval)
```

### Pattern 1: One shared view-selection function (FILT-05 for export)
**What:** A pure `selectView(ledger, filters, span, resolver)` returning `{ visible: ScopedEntry[], range, previous... }` used by `DashboardTab` and by the export. The top-bar export button lives outside `DashboardTab` (in `AppShell`), so wrap it in a hook (`useDashboardView`) that both call; recomputation cost is negligible (143 invoices).
**When to use:** always; never let the export re-implement filtering.

### Pattern 2: Settings v1 to v2 with zustand `persist`
**What:** keep `skipHydration: true`, `version: 2`, a custom `PersistStorage<unknown>` whose envelope is `{ state: z.unknown(), version: z.number().optional() }`, `migrate` delegating to a pure never-throwing `resolvePersisted`, and `merge` that also validates (needed for the "no stored value" and "same version" paths). Verified mechanics from `node_modules/zustand/esm/middleware.mjs` (read this session):
- `hydrate()` calls `migrate(state, storedVersion)` only when the stored `version` is a number different from `options.version`; if `migrate` is absent it only logs an error.
- After a migration, `setItem()` is called, rewriting storage in the new version.
- Any exception from `migrate` or `merge` is caught and swallowed (`postRehydrationCallback(void 0, e)`), leaving the in-memory defaults: a throwing migration silently loses the user's `ivaMode`.
- `merge` result is applied with `set(stateFromStorage, true)` (replace), so `merge` must return the full state including actions (`{ ...current, ... }`), as the current store already does.
- `api.setState` is wrapped, so `useSettingsStore.setState(...)` also persists; "replace all settings" from an upload is one `setState` = one write.
**Example:** see Code Examples (store skeleton compiled under strict TS 6.0.3).

### Pattern 3: Categories, rules and the resolver as pure reducers over arrays
**What:** persisted shape uses arrays of entries (not records keyed by RFC); in memory build `Map`s. Resolution precedence for this phase: concept rule (`categoryId: string | null`, `null` = explicit "Sin categoría" per UI-SPEC Q4) > supplier assignment > implicit "Sin categoría". `SIN_CATEGORIA_KEY` is a reserved string used in `filters.categories` and in parts; category ids must never equal it (validated on import). Seed categories get fixed ids (for example `seed:otros`) so "Otros" is identifiable by id (UI-SPEC sorts "Otros" last by seed id); user-created ids use `crypto.randomUUID()` with a prefix.
Reducers return new `SettingsData` and are unit tested: `addCategory` (trim, 60 max, duplicate ignoring case, reserved name), `renameCategory` (excludes itself from the duplicate check), `deleteCategory(settings, id, target: string | null)` returning `{ next, snapshot }` where the snapshot records the removed category, its index and the exact supplier/rule keys that pointed to it (undo must restore only those, not blanket-revert later edits), `restoreCategory(settings, snapshot)`, `setSupplierCategory`, `removeSupplierAssignment`, `setConceptRule`, `removeConceptRule`, `replaceAll`.
Usage counts in the UI ("N proveedores · M conceptos") are the number of supplier assignments and concept rules pointing at the category (including suppliers not currently loaded). "Aplica a N líneas" is computed from the unfiltered ledger with an index `Map<ruleKeyString, number>`.

### Pattern 4: Versioned backup file (one-way door)
**What:** the file payload schema is **frozen separately** from the store schema (store v2 and file v1 will diverge when Phase 4 adds grouped products). Suggested envelope: `{ app: "invoicechecker-settings", version: 1, settings: { ivaMode, categories, supplierCategories, conceptRules } }`. Reading order (maps to the four UI-SPEC reasons): size > 1 MB check on `file.size` before `file.text()` (reason "es demasiado grande"); `JSON.parse` in try/catch; header `z.object({ app: z.literal(...), version: z.number().int().min(1) })` (failure = "no es un archivo de ajustes de InvoiceChecker"); `version` greater than the app's current file version = "es de una versión más nueva de la app" (check this **before** the full parse, because `z.discriminatedUnion("version", ...)` reports an unknown version as a generic `invalid_union`, verified this session); full parse with the frozen v1 schema + referential integrity `superRefine` (unique ids and names, no reserved name, assignments and rules point to existing ids or `null`, no duplicate keys, id not equal to `SIN_CATEGORIA_KEY`); any failure = "está dañado o incompleto". Zod objects strip unknown keys by default, which is what you want for forward compatibility within a version. Keep a **golden fixture** of a v1 file in the repo and a test that must keep passing forever; add `fromBackupV1()` and later `fromBackupV2()` converters so old files keep loading.
The file name uses the local date `AAAA-MM-DD` (the only local-date use per UI-SPEC); upload resets the `<input type="file">` value after every attempt.

### Pattern 5: Category split and scope inside the pure accounting layer
**What:** keep `buildLedger` and the ledger untouched (it is mode-independent and settings-independent). Add `src/domain/accounting/categories.ts`:
- `splitEntry(entry, resolver): EntryPart[]` returns one part per concept (`{category, concept: index, con, sin}`, amounts from the existing `conceptAmounts`, signed like the invoice, an unusable concept amount counts as zero) plus one part for the **exact** difference `entry.conIva - Σconcept` / `entry.sinIva - Σconcept` assigned to the supplier's category (D-13), emitted when either mode's difference is non-zero. Because the difference is exact big.js arithmetic, Σparts equals the invoice amount exactly in both modes, so Σ of all categories equals `totalSpend` exactly (testable identity). Both modes are computed at once so the IVA toggle never recomputes anything (same philosophy as D-37).
- `scopeToCategories(entries, selected, resolver): ScopedEntry[]` where `ScopedEntry = LedgerEntry & { fullConIva, fullSinIva }`. With an empty selection it returns entries with `full* = conIva/sinIva`. With a selection it keeps an entry when at least one of its lines (or its difference part, see Q-D) falls in the selection, replaces `conIva/sinIva` with the sum of the selected parts and keeps the full amounts. Membership of **non-counted** entries (Pago, $0, Excluida, Sustituida) is decided by the categories of their lines, not by amounts (their amounts may be null), because D-14 and Q6 keep them visible. Because the result is a `LedgerEntry`-compatible shape, `kpis`, `monthlySeries`, `supplierRanking` and `totalSpend` work unchanged and satisfy D-14 (count of invoices = entries kept; ticket = partial spend / that count).
- `categoryBreakdown(scoped, mode, resolver, ...)` returns rows `{category, net, pct, promedio, variation}` sorted like `supplierRanking` (net desc, negative last, Spanish-collated name tie-break) and includes "Sin categoría" whenever it has spend.
- Variation (D-17): build filters with `range: { from: previousMonth, to: lastMonthOfRange }` and every other filter intact; compute the per-category sums for both months from the same split, then `deltaFraction(current, previous)` (already returns `null` when previous is missing or `<= 0`, which is exactly "Sin dato del mes anterior").
- `categoryOptions(ledger, resolver)` for the filter: per category (and "Sin categoría") the number of entries with at least one line of it, over all loaded invoices regardless of other filters (D-15); sorted by count desc then Spanish-collated name via the existing `compareOptions`.
- `monthlyCounts(scoped, range)` for the "Resumen por mes" Facturas column (not available today; `monthlySeries` returns amounts only).
`Filters` (in `filters.ts`) gains `categories: ReadonlySet<string>`; `EMPTY_FILTERS`, `isDefaultFilters`, `previousFilters` (carry `categories`), `sessionStore` (`setCategories`, `clearFilters`, `clearAll`) and their tests change. Files that reference these today [VERIFIED: grep this session]: `aggregate.test.ts`, `filters.test.ts`, `filters.ts`, `ledger.test.ts`, `DashboardTab.tsx`, `FilterBar.test.tsx`, `FilterBar.tsx`, `sessionStore.test.ts`, `sessionStore.ts`.

### Pattern 6: Sheet builders over an internal cell model, thin library writer
**What:** each builder returns `SheetModel = { name, columns: {width}[], header: XCell[], rows: XCell[][], totalRow?: XCell[] }` with `XCell = text | number(value: string, format) | date(Date | null) | empty`, where `number.value` is the exact 2 dp (or 6 dp) string from `toMoneyString`. A single `toLibrarySheet()` maps to `write-excel-file` cells (`{ value, type, format }`, header style `fontWeight: "bold"`, `backgroundColor: "#E5E5E5"`, `wrap: true`, `stickyRowsCount: 1`). This removes the library's `String`/`Number` wrapper-type awkwardness from the tests (the library types model `Value = String | Date | Number | Boolean` with wrapper types; narrowing them is clumsy) and keeps the writer swappable. Verified to compile under strict TS 6.0.3 + `noUncheckedIndexedAccess` + `moduleResolution: bundler` (see Code Examples).
Sheet builders read the same selectors (Pattern 1). Estado comes from a shared `entryStatus(entry)` extracted from `stateOf` in `features/invoices/columns.ts` (precedence there: `noSuma` first, then manual exclusion, then substitution) so table and Excel cannot disagree.

### Pattern 7: Download helper and export flow
`downloadBlob(blob, name)`: temporary `<a href=URL.createObjectURL(blob) download=name>` appended to the body, `click()`, remove, revoke the URL after a short delay (not synchronously; revoking in the same tick is known to cancel the download in some browsers [ASSUMED]; it worked in Chrome in my probe). Wrap `toBlob()` in a timeout race (for example 30 s) that rejects, so a blocked worker can never leave the button stuck on "Exportando…"; on timeout or error show the failure toast of the UI-SPEC.

### Anti-Patterns to Avoid
- **Baking categories into `buildLedger`:** it would couple the ledger to settings and force a rebuild on every category edit; keep the split in a separate pure layer.
- **Records keyed by RFC in persisted JSON or the backup file:** the codebase already treats XML-derived keys with Map/Set (D-43); use arrays of entries.
- **`new Date(y, m, d)` for Excel dates**, or `new Date(fecha)` for anything (REGLA-05).
- **Validating the envelope `state` against the current schema inside `getItem`:** breaks migration (Pitfall 4).
- **Calling `set` of the persisted store from `storage.setItem`:** infinite loop (Pitfall 6).
- **Writing the export in `src/domain`:** the builders need `@/lib/copy`, forbidden there by ESLint.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Writing `.xlsx` (zip + SpreadsheetML + styles) | Own zip/XML writer | `write-excel-file/universal` | styles.xml/numFmt/shared-string/frozen-pane details; verified well-formed output |
| Dates in Excel | Own serial-number math | `Date` cell with `Date.UTC(y, m-1, d)` | Library converts `getTime()/day + 25569`; UTC midnight gives an exact integer serial |
| Storage envelope/migrations | Own versioning scheme | zustand `persist` `version` + `migrate` + `merge` | Already in the project; handles hydration timing |
| JSON validation | Manual shape checks | zod schemas + `superRefine` | Project rule: validate external data, never `as` |
| Money rounding/summing | Floats | big.js (`toMoneyString`, `sum`, `ZERO`) | Strict mode already rejects numbers; the Excel writer converts at the last step only |
| Multi-select with search and counts | New component | `MultiSelectFilter` unchanged (`widthClass="w-[320px]"`) | UI-SPEC locks reuse |
| Sort headers / truncated text / pagination text | New helpers | `SortHeaderButton`, `ariaSort`, `TruncatedText`, `paginationRangeText` | Already in repo |
| Delta line | Copy of KpiRow code | Extract `DeltaLine` from `KpiRow.tsx` into a shared component | UI-SPEC says extract and reuse |
| Zip reading in tests | Hand-written zip parser | Test builders only, or `fflate.unzipSync` if Q-E is approved | Avoid reimplementing DEFLATE/ZIP |

**Key insight:** every trap in this phase is at a boundary the compiler cannot see (CSP vs library worker, local-time vs UTC, localStorage version drift, JSON from disk). Each boundary gets one tested adapter; business logic stays pure.

## Runtime State Inventory

Not a rename/refactor phase, but it migrates a persisted contract, so the equivalent questions are answered:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `localStorage["invoicechecker:settings"]` holds `{ state: { ivaMode }, version: 1 }` for every Phase 2 user [VERIFIED: settingsStore.ts:12,10] | Data migration via `migrate` (v1 to v2, keep `ivaMode`, seed categories, see Q-B). Golden v1 fixture test |
| Live service config | None. The app has no server-side settings store | None |
| OS-registered state | None | None |
| Secrets/env vars | None touched. `SESSION_SECRET`, `APP_PASSWORD` unaffected | None |
| Build artifacts | None. New dependency `write-excel-file` changes `pnpm-lock.yaml` (planner-approved) | `pnpm install` after approval |

## Common Pitfalls

### Pitfall 1: `toBlob()` hangs in production because the CSP blocks fflate's Worker (VERIFIED, blocker)
**What goes wrong:** `/universal` `toBlob()` -> `zipToArrayBuffer` -> fflate `zip()`. For any part with `size < 160000` it deflates synchronously; otherwise `deflate()` async creates `new Worker(URL.createObjectURL(new Blob([...])))` [VERIFIED: fflate esm/browser.js `wk`, `zip` source]. With the project's CSP the worker is refused and the promise never settles.
**Evidence (this session, Chrome via Playwright, project CSP copied verbatim):** 100 rows x 18 cols: ok (13,951 bytes). 330 rows: `pending` + console "Creating a worker from 'blob:…' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline'". Note that 'worker-src' was not explicitly set, so 'script-src' is used as a fallback." 450 rows with `worker-src 'self' blob:` added: ok (53,441 bytes); 2,000 rows with the fix: ok (226,149 bytes). Real data: 362 concept lines + up to 27 rounding-difference lines x 18 columns, well past the threshold.
**Why it passes tests:** Vitest runs in Node, where fflate uses `worker_threads` (no CSP), and compile-time checks cannot see it.
**How to avoid:** add `"worker-src 'self' blob:"` to the CSP array in `next.config.ts` (after user approval, Q-A); race `toBlob()` against a timeout; add a Playwright (installed Chrome, `channel: "chrome"`) or manual production-mode check that exports a >160 KB sheet under the real header.
**Warning signs:** "Exportando…" never ends; CSP violation in the console.

### Pitfall 2: Excel dates off by a day or fractional (VERIFIED)
`write-excel-file` computes the serial as `date.getTime() / 86400000 + 25569`. Built with `Date.UTC(2025, 4, 28)` the serial was exactly `45805` under `TZ=America/Mexico_City`, `Asia/Tokyo` and `UTC`. Built with local `new Date(2025, 4, 28)` it was `45805.25` (Mexico City), `45804.625` (Tokyo: displays the previous day), `45805` (UTC). Read back with `read-excel-file`: UTC-built = `2025-05-28T00:00:00.000Z`, local-built = `2025-05-28T06:00:00.000Z`. **Rule:** parse the literal `Fecha` with a regex (as `months.ts` does, never `new Date(fecha)`), build `new Date(Date.UTC(y, m-1, d))`; guard `y >= 1900` (Excel has no earlier serial) and an invalid result returns an empty cell. The "Exportado el" timestamp in Parámetros is an instant in local time: write it as a **text** cell formatted with `Intl` (a `Date` cell would display UTC wall time).

### Pitfall 3: `NaN`, `Infinity`, invalid `Date` corrupt the file (VERIFIED)
The library does not reject them: they are written as literal `<v>NaN</v>`, `<v>Infinity</v>` (and an invalid Date as `NaN`), which Excel reports as unreadable content. The cell mapper must convert `Number(value)` and replace non-finite results with an empty cell (and the unit tests assert no non-finite value ever reaches the writer). Also: a `String` cell given a JS number throws ("Expected a string"); a `Date` cell without `format` and no sheet `dateFormat` throws; sheet names over 31 chars or containing `[]/\:*?` throw (all UI-SPEC names are ≤ 21 chars). Control characters in strings are silently stripped (`"a\u0001b\u0000c"` became `abc`), harmless.

### Pitfall 4: Envelope validated against the new schema loses v1 data (reading `settingsStore.ts`)
Today `getItem` parses `envelopeSchema = z.object({ state: persistedSchema, version: ... })` [VERIFIED: settingsStore.ts:19-22 region]. After the change a stored v1 `{ ivaMode }` would fail the v2 `state` schema, `getItem` would return `null`, `migrate` would never run and the user's mode would reset. **Fix:** envelope `state: z.unknown()`; validate inside `migrate`/`merge`.

### Pitfall 5: A throwing `migrate`/`merge` silently resets everything (VERIFIED in zustand source)
Exceptions are swallowed in `hydrate()`'s `.catch`. `resolvePersisted` must use `safeParse` everywhere and always return valid data (seeds on failure).

### Pitfall 6: `set` inside `storage.setItem` loops (VERIFIED in zustand source)
`persist` calls `storage.setItem` after every `set`; setting persisted state from there re-enters. Keep the "write failed / read failed" flags in a separate, non-persisted store (`storageStatusStore`) and set them from the adapter and from `resolvePersisted`'s status.

### Pitfall 7: Re-seeding after the user deleted every category
Seed only when there is no usable stored value (absent, unreadable, or v1 migration). A stored `categories: []` is a valid state and must not be re-seeded on reload.

### Pitfall 8: Prototype-pollution-shaped keys
RFC and descriptions come from XML. Persist arrays; build `Map`s. Probe: `JSON.parse('{"rfc":"__proto__","__proto__":{"x":1}}')` through a zod object parses to `{"rfc":"__proto__"}` safely, but a plain-object record keyed by RFC would not be safe. Use `rfc + "\u0000" + key` (or nested Maps) for composite Map keys.

### Pitfall 9: big.js strict mode
`Number(big)` / `toNumber()` throw in strict mode when imprecise; never pass numbers into `Big`. For the writer use `Number(toMoneyString(value))` (a string-to-double at the last step). Sorting Big values uses `cmp`, never `<`.

### Pitfall 10: Two different "rounding difference" invariants
(a) Dashboard/category sums are exact: the difference part is `invoiceAmount - Σ concept` in exact arithmetic so Σ categories = total exactly. (b) Excel cells are rounded to 2 dp: for the Conceptos "Diferencia de redondeo" line use the already existing `roundingDifference(entry, mode)` semantics (`round2(invoice) - round2(Σ concept)`) and round each concept cell, so `SUM` of the Conceptos Monto column equals the rounded invoice amounts. Measured on the real sample: concept amounts and invoice amounts differ by at most 0.01 (27 of 143 invoices in Con IVA, 26 in Sin IVA), no invoice has a larger gap, so (a) and (b) agree to the cent there; foreign-currency invoices (TipoCambio with decimals) are where they could diverge. Per-category `SUM` over the Conceptos sheet can differ from the Dashboard category figure by cents (documented, not a defect).

### Pitfall 11: Base UI Select values and sentinels
Base UI `Select` takes string values (or `null`); pass `items` so `Select.Value` renders the label. For the concept Select use ids plus two reserved sentinels (explicit "Sin categoría" and "Quitar ajuste") that cannot collide with category ids. Nested portal behaviour of a Select inside an AlertDialog (the delete dialog's "Pasarlos a") is not documented by Base UI [CITED: base-ui.com/react/components/select]; plan a component test plus a manual check that the popup renders above the dialog and closes without closing the dialog.

### Pitfall 12: Existing tests and helpers pinned to v1
`settingsStore.test.ts` asserts the exact v1 envelope write; `tests/support/settingsStorage.ts` writes `{ state: { ivaMode }, version: 1 }` through the typed adapter. Update the helper's types (it will legitimately exercise the v1 to v2 migration) and rewrite the "writes `{ state: { ivaMode }, version: 1 }`" test to the v2 shape.

### Pitfall 13: Cross-tab and downgrade
Two tabs editing settings: last write wins (no `storage` event handling) [ASSUMED acceptable for a single-user tool]. If a later deploy writes version 3 and the app is rolled back, `migrate` runs on a newer version and rewrites storage in v2 (data loss for v3 fields); acceptable for forward-only deploys, mention if rollback matters.

## Code Examples

### CSP change (after approval)
```ts
// next.config.ts — add one entry to the contentSecurityPolicy array
// [VERIFIED: next.config.ts:10-19 current entries; reproduction in Chrome this session]
  "connect-src 'self'",
  "worker-src 'self' blob:",   // write-excel-file/fflate compresses large sheets in a blob: Worker
  "object-src 'none'",
```

### Cell model, writer mapper and guards (compiled under strict TS 6.0.3, noUncheckedIndexedAccess, moduleResolution bundler)
```ts
import type { Cell, Sheet, SheetData } from "write-excel-file/universal";

// Source: UI-SPEC 03-UI-SPEC.md:386 — formats quoted verbatim: "$#,##0.00", "$#,##0.00####",
// "#,##0.######", "0.0000", "0.0%", "#,##0", "dd/mm/yyyy", "@"
export type NumberFormat =
  | "$#,##0.00" | "$#,##0.00####" | "#,##0.######" | "0.0000" | "0.0%" | "#,##0";

export type XCell =
  | { kind: "text"; value: string }                       // String + format "@" (RFC, UUID, folio, ClaveProdServ, all user text)
  | { kind: "number"; value: string; format: NumberFormat } // exact decimal string; converted at the very end
  | { kind: "date"; value: Date | null }                  // built with Date.UTC only
  | { kind: "empty" };

const FECHA_DAY = /^(\d{4})-(\d{2})-(\d{2})T/;
/** Literal CFDI Fecha -> UTC-midnight Date; null when unusable. Never goes through new Date(string). */
export function excelDateOfFecha(fecha: string): Date | null {
  const m = FECHA_DAY.exec(fecha);
  const [, y, mo, d] = m ?? [];
  if (y === undefined || mo === undefined || d === undefined) return null;
  if (Number(y) < 1900) return null;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toCell(c: XCell): Cell {
  switch (c.kind) {
    case "text":
      return c.value === "" ? null : { value: c.value, type: String, format: "@" };
    case "number": {
      const n = Number(c.value);
      return Number.isFinite(n) ? { value: n, type: Number, format: c.format } : null; // NaN/Infinity corrupt the file
    }
    case "date":
      return c.value === null ? null : { value: c.value, type: Date, format: "dd/mm/yyyy" };
    case "empty":
      return null;
  }
}

export function toSheet(model: { name: string; widths: number[]; header: string[]; rows: XCell[][] }): Sheet<Blob> {
  const header: Cell[] = model.header.map((value) => ({
    value, type: String, fontWeight: "bold", backgroundColor: "#E5E5E5", wrap: true,
  }));
  const data: SheetData = [header, ...model.rows.map((row) => row.map(toCell))];
  return { sheet: model.name, data, stickyRowsCount: 1, columns: model.widths.map((width) => ({ width })) };
}
```
Writer (lazy import, timeout race, no Worker assumptions):
```ts
export async function buildXlsx(sheets: Sheet<Blob>[]): Promise<Blob> {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("export timeout")), 30_000));
  return await Promise.race([writeExcelFile(sheets).toBlob(), timeout]);
}
```

### Probe results that justify the mapper (sandbox output, abbreviated)
```
TZ=Asia/Tokyo           A2 (Date.UTC)  = 45805      A3 (new Date(y,m,d)) = 45804.625
TZ=America/Mexico_City  A2 (Date.UTC)  = 45805      A3 (local)           = 45805.25
TZ=UTC                  A2 (Date.UTC)  = 45805      A3 (local)           = 45805
<c r="A1"><v>NaN</v></c><c r="B1"><v>Infinity</v></c>             <- unguarded numbers
sharedStrings: <si><t>=1+1</t></si>   (cell has t="s": text, never evaluated)
styles: <numFmt numFmtId="101" formatCode="@"/> ... frozen pane: <pane ySplit="1" ... state="frozen"/>
only the first sheet has tabSelected="1"; all 12 package parts parse as well-formed XML; zip testzip() = None
```

### zustand store skeleton for v2 (compiled with the installed zustand/zod under strict TS 6.0.3)
```ts
const envelopeSchema = z.object({ state: z.unknown(), version: z.number().optional() });

function resolvePersisted(raw: unknown, version: number | undefined): SettingsData {
  if (version === 1) {                                   // Phase 2 users: keep ivaMode, give them the seeds (Q-B)
    const v1 = v1Schema.safeParse(raw);
    return v1.success ? { ...DEFAULTS, ivaMode: v1.data.ivaMode } : DEFAULTS;
  }
  const parsed = settingsSchema.safeParse(raw);          // current version or "nothing stored": never throws
  return parsed.success ? parsed.data : DEFAULTS;
}

const storage: PersistStorage<unknown> = {
  getItem: (name) => {
    try {
      const raw = window.localStorage.getItem(name);
      if (raw === null) return null;                     // first visit: no toast
      const parsed = envelopeSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;        // record "unreadable" in the status store here
    } catch { return null; }                             // ...and here
  },
  setItem: (name, value) => {
    try { window.localStorage.setItem(name, JSON.stringify(value)); }
    catch { /* flag writeFailed in storageStatusStore (a separate, non-persisted store) */ }
  },
  removeItem: (name) => { try { window.localStorage.removeItem(name); } catch { /* nothing */ } },
};

// persist(..., { name, version: 2, skipHydration: true, storage,
//   partialize: (s): SettingsData => ({ ivaMode: s.ivaMode, categories: s.categories, supplierCategories: ..., conceptRules: ... }),
//   migrate: (persisted, version) => resolvePersisted(persisted, version),
//   merge: (persisted, current) => ({ ...current, ...resolvePersisted(persisted, 2) }) })   // full state: set(..., true) replaces
```

### Split of one entry (domain, big.js strict-safe)
```ts
import { conceptAmounts } from "./amounts";
import { ZERO } from "./decimal";

export interface EntryPart { category: string; concept: number | null; con: Big; sin: Big }

export function splitEntry(entry: LedgerEntry, resolver: Resolver): EntryPart[] {
  const { conIva, sinIva } = entry;
  if (conIva === null || sinIva === null) return [];          // not summable: no amount to split
  const parts: EntryPart[] = [];
  let sumCon = ZERO;
  let sumSin = ZERO;
  entry.invoice.conceptos.forEach((concepto, index) => {
    const a = conceptAmounts(concepto, entry.invoice);        // signed like the invoice, MXN
    const con = a.conIva ?? ZERO;
    const sin = a.sinIva ?? ZERO;
    sumCon = sumCon.plus(con);
    sumSin = sumSin.plus(sin);
    parts.push({ category: resolver.resolve(entry.supplierRfc, concepto.descripcion), concept: index, con, sin });
  });
  const dCon = conIva.minus(sumCon);                          // exact difference => parts sum to the invoice amount exactly
  const dSin = sinIva.minus(sumSin);
  if (!dCon.eq(ZERO) || !dSin.eq(ZERO)) {
    parts.push({ category: resolver.supplierCategory(entry.supplierRfc), concept: null, con: dCon, sin: dSin });
  }
  return parts;
}
```
Property tests: for every counted entry and both modes, Σparts equals `entryAmount`; with a category filter containing **all** categories plus "Sin categoría" every selector result equals the unfiltered one; on the real sample (`*.realdata.test.ts` pattern, skipped when `Facturas/` is absent) Σ category amounts equals `totalSpend`.

### Description normalizer (domain-local; Open Question Q-C on `ñ`)
```ts
export function normalizeDescription(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
// D-10 examples to freeze in tests: "Café  Molido 1kg" and "CAFE MOLIDO 1KG" collide; "CAFE 1KG" and "CAFE 500G" do not.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `write-excel-file` 3.x `schema`, `fileName` options | 4.x: array of `{ sheet, data, columns, stickyRowsCount }`, result object with `toBlob()` | 4.0 | Use the 4.x multi-sheet signature `writeExcelFile(sheets)`; `toFile()` exists only in `/browser` and `/node` |
| Bold header by default | No default style in 4.x | 4.0 | Style the header cells explicitly |
| `span` | `columnSpan` | 4.0 | Not used here (no merged cells) |

**Deprecated/outdated:** the claim in `.claude/CLAUDE.md` that the `/universal` entry avoids Web Workers is not accurate for sheets above 160 KB: it avoids a worker *file* in the bundle, but fflate's async zip still creates a `blob:` worker at runtime. The `/browser` entry was not tested; it shares the same zip module family [ASSUMED], so it does not help.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | After Turbopack bundling the fflate worker path behaves exactly as in the native-ESM Chrome probe (same library code resolved through its `browser` field) | Pitfall 1 | Low; planner adds a production-build check under the real CSP anyway |
| A2 | Revoking the object URL synchronously after `click()` can cancel the download in some browsers (Safari/Firefox); delay the revoke | Pattern 7 | Low; Chrome worked in the probe |
| A3 | TanStack v9 applies a two-entry initial `sorting` state (facturas desc, then name) with `enableMultiSort: false` (that flag affects user toggling); the safe route is to pre-sort the data by name and sort by facturas only, relying on the sort's stability | Supplier table | Low; covered by a component test |
| A4 | Base UI Select inside AlertDialog renders its popup above the dialog and does not close it | Pitfall 11 | Medium for UX; component test + manual check |
| A5 | SAT `c_Impuesto` 002 = IVA (IEPS = 003 is verified in `amounts.ts`) for the Excel "IVA" breakdown column | Sheet Facturas | Low; would put wrong numbers in a reference column |
| A6 | Caps for the backup file arrays (for example 200 categories, 5,000 supplier assignments, 20,000 rules, name 60, RFC 50, key 1,000) | Pattern 4 | Low; user can adjust (Q-F) |
| A7 | An unusable concept amount (null) counts as zero in the split and its value flows into the supplier-category difference part | Pattern 5 | Low; sample has 0 such cases; behaviour is internally consistent |
| A8 | Rule keys with an empty normalized description are allowed (they match every empty-description line of that supplier) | Pattern 3 | Low |
| A9 | Cross-tab last-write-wins and downgrade data loss are acceptable for this single-team tool | Pitfall 13 | Low |
| A10 | Duplicate name check ignores case and edge spaces only (not accents), exactly as D-04 words it | Pattern 3 | Low; "Cafe" and "Café" would be two categories |

## Open Questions (RESOLVED)

The first (Q-A) blocks a correct export; Q-B..Q-D change persisted or visible behaviour; Q-E and Q-F are minor. All six were answered by the user on 2026-10-16 during /gsd-plan-phase and are recorded as locked decisions D-24..D-30 in 03-CONTEXT.md (a follow-up question on the filter option count produced D-28).

1. **Q-A (blocker): allow `worker-src 'self' blob:` in the CSP?** — RESOLVED (user, 2026-10-16): yes. Add `"worker-src 'self' blob:"` to the CSP in `next.config.ts` (`script-src` unchanged) and race `toBlob()` against a timeout that ends in the export-failure toast. Locked as D-24.
   - What we know: reproduced; without it `toBlob()` never settles for sheets whose uncompressed XML is ≥160,000 bytes, which the Conceptos sheet will be; with it the export works; `script-src` stays unchanged and `blob:` is limited to workers.
   - What's unclear: the user's security preference.
   - Recommendation: approve the one-line CSP change in `next.config.ts` and keep the timeout/failure toast as a second line of defence. Alternative (not recommended): drop the Conceptos sheet or cap rows; there is no supported synchronous path in the library's public API.

2. **Q-B: do users coming from v1 (Phase 2, only `ivaMode` stored) get the 9 seed categories on migration?** — RESOLVED (user, 2026-10-16): yes, the v1 → v2 migration seeds the 9 categories of D-02 and keeps `ivaMode`. Locked as D-25.
   - What we know: UI-SPEC seeds "the first time (no stored settings, or unreadable settings)"; D-02 says "La primera vez existen 9 categorías". A v1 user has stored settings but has never had categories.
   - Recommendation: yes, seed them (they have never seen categories), keeping `ivaMode`.

3. **Q-C: is `ñ` an accent for the rule key (D-10)?** — RESOLVED (user, 2026-10-16): no. The rule-key normalizer strips accent marks but keeps `ñ` distinct from `n` ("PEÑA" ≠ "PENA"; "Ñ" = "ñ" because case is ignored), unlike `normalizeSearch`; frozen with tests. Locked as D-26.
   - What we know: the existing `normalizeSearch` removes every combining mark, so `ñ` becomes `n`; Spanish treats `ñ` as a distinct letter, and "PEÑA"/"PENA" or "AÑO"/"ANO" would collide. In the sample 2 of 362 concept descriptions contain `ñ` and there are zero collisions either way. The key is written into localStorage and the backup file, so changing it later means a migration (D-09 reversibility: costly).
   - Recommendation: keep `ñ` distinct (strip only accent marks, not the tilde of `ñ`), documented and frozen with tests. Either choice is acceptable; it needs a decision before execution.

4. **Q-D: under a category filter, is an invoice kept when only its rounding-difference part (at most one cent in the sample) falls in the chosen categories?** — RESOLVED (user, 2026-10-16): yes. An invoice belongs to the selection when any part (a line or the rounding difference) falls in it, so selecting every category reproduces the unfiltered totals exactly; this applies to KPIs, trend, ranking, table, invoice count, ticket and the Excel. Locked as D-27. Follow-up answered the same day: the per-option count of the category filter uses the same membership rule (locked as D-28).
   - What we know: D-14 says "facturas con al menos un concepto de esas categorías". If only lines count, choosing every category would still lose those cents versus the unfiltered total.
   - Recommendation: keep the entry if any part (line or rounding difference) is in the selection so that selecting all categories reproduces the unfiltered totals exactly; the visible effect is limited to the invoice count in a rare edge case.

5. **Q-E: add `fflate` as a direct devDependency to unzip the produced `.xlsx` in a Vitest smoke test?** — RESOLVED (user, 2026-10-16): no. Sheet-builder unit tests plus a `PK` magic-bytes smoke test; the "opens in Excel" check stays manual. Locked as D-29.
   - Without it: builder unit tests (no dependency) plus a smoke test that `toBlob()` resolves in the Node environment and the bytes start with `PK`; the "opens in Excel, dates right, text preserved" check stays manual (UI-SPEC already requires it).
   - Recommendation: do not add it; manual Excel verification covers what unzipping would.

6. **Q-F: caps for the backup file and the persisted arrays (assumption A6).** Recommendation: use the suggested caps and keep the 1 MB file limit from the UI-SPEC. — RESOLVED (user, 2026-10-16): yes, at most 200 categories, 5,000 supplier assignments, 20,000 concept rules, 60-character category names and a 1 MB file. Locked as D-30.

Planner-discretion items (no user decision needed): include the original `description` text in each concept rule (the normalized key is unreadable in the JSON); exact JSON field names; ids as `cat_<uuid>` and seed ids as `seed:<slug>`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, Vitest | ✓ | 24.14.0 | — |
| pnpm | install | ✓ | 11.5.2 | — |
| `write-excel-file` | Excel export | ✗ not installed in the project (installed only in the sandbox) | 4.1.1 on registry | none; needs package approval |
| Google Chrome | Playwright e2e (`channel: "chrome"`), CSP reproduction | ✓ | installed (`/Applications/Google Chrome.app`) | — |
| Microsoft Excel | manual XLS-03 verification (UI-SPEC) | ✓ | `/Applications/Microsoft Excel.app` | LibreOffice not installed |
| LibreOffice / Numbers | optional extra check | ✗ | — | Excel |
| `Facturas/2025` real sample | `*.realdata.test.ts` identities | ✓ locally (gitignored, 286 files = 143 XML), absent on CI/Vercel | — | tests are `skipIf` |

**Missing dependencies with no fallback:** none blocking research. The CSP decision (Q-A) blocks a shipping export.
**Missing dependencies with fallback:** none.
Probe workbook available for opening in Excel now: `/private/tmp/claude-501/-Users-marcosmorales-Documents-Atzomx-InvoiceChecker/c1231129-8884-4bb2-b746-95bb7bd415b6/scratchpad/research-sandbox/out-America_Mexico_City.xlsx` (3 sheets; frozen header; text cell `0123456789` and `=SUM(A1:A2)`; money, date and percent formats).

## Security Domain

`workflow.security_enforcement` is enabled (ASVS level 1, block on high). Validation Architecture is intentionally omitted: `workflow.nyquist_validation` is `false` in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing shared-password gate |
| V3 Session Management | no (unchanged) | Existing signed cookie |
| V4 Access Control | no | No new route; export and settings are client-only |
| V5 Input Validation | yes | zod on localStorage, on the backup file (size cap before reading, header check, integrity `superRefine`, array/length caps), rendering names as React text only |
| V6 Cryptography | no | None added |
| V8 Data Protection / V14 Config | yes | CSP change limited to `worker-src 'self' blob:`; no data leaves the browser (`connect-src 'self'` stays) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious or corrupted backup JSON (oversized, wrong shape, `__proto__` keys, dangling ids) | Tampering / DoS | 1 MB cap before `file.text()`, `JSON.parse` in try/catch, zod with caps and integrity checks, arrays + Maps, nothing applied unless fully valid (atomic replace) |
| Formula injection through descriptions/names written to Excel | Tampering | Every user string is a `String` cell (shared string, `t="s"`): verified `"=1+1"` is stored as text; also `format: "@"` |
| XSS through category or supplier names | Tampering | React text nodes only; no `dangerouslySetInnerHTML`; names bounded to 60 chars |
| CSP loosening | Elevation | Only `worker-src 'self' blob:`; `script-src` untouched; no `unsafe-eval` in production |
| Sensitive data in the Excel file | Info disclosure | The file contains RFC/UUID/amounts by design and stays on the user's machine; Parámetros sheet records filters; document that the file is not protected |
| localStorage tampering | Tampering | Treated as untrusted: zod validation and defaults on failure |

## Sources

### Primary (HIGH confidence)
- Executed this session in a throwaway sandbox (`.../scratchpad/research-sandbox`): write-excel-file 4.1.1 `/universal` output inspected at XML level (sheet, styles, sharedStrings, workbook) under three time zones; guards probes; read-back with `read-excel-file`; TypeScript compile check of the cell model; Chrome (Playwright, `channel: "chrome"`) reproduction of the CSP/worker failure and of the download under the project's CSP.
- Library source in the installed tarballs: `write-excel-file/modules/export/writeXlsxFileUniversal.js`, `modules/zip/zipToArrayBuffer.js`, `modules/xlsx/helpers/convertDateToSerialNumber.js`, `modules/xlsx/files/sheet.xml/cell.js`; `fflate/esm/browser.js` (`wk`, `zip`, 160000 threshold); README of write-excel-file 4.1.1 (cell types, formats, sticky rows, "Universal" section).
- Project source read this session: `src/stores/settingsStore.ts`, `sessionStore.ts`, `src/domain/accounting/{ledger,aggregate,filters,amounts,decimal,months}.ts`, `src/features/{dashboard,invoices,shell}/*`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `vitest.config.mts`, `tests/support/*`.
- `node_modules/zustand/esm/middleware.mjs` (persist: migrate/merge/hydrate semantics).
- npm registry (`npm view`), `gsd-tools query package-legitimacy check` (OK for write-excel-file and fflate).
- Measurements on the real sample via a scratch Vitest config (aggregates only): 143 invoices, 362 concepts, 54 multi-concept invoices, 39 suppliers, 227 distinct descriptions, 0 null concept amounts, max |concept sum - invoice| = 0.01 (27 invoices Con IVA, 26 Sin IVA), 2 descriptions with `ñ`.

### Secondary (MEDIUM confidence)
- https://base-ui.com/react/components/select (Select `items`, `null` value, `onValueChange` signature; says nothing about Dialog stacking).

### Tertiary (LOW confidence)
- None used as a basis for a recommendation; unverified points are in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, library executed and read at source level; versions from the registry.
- Architecture: HIGH for the pure accounting design (invariants testable and checked against sample statistics), MEDIUM for UI composition details already fixed by the UI-SPEC.
- Pitfalls: HIGH for the six verified ones (CSP worker, UTC dates, non-finite numbers, envelope validation, swallowed migrate errors, setItem re-entrancy); MEDIUM for Select-in-AlertDialog and TanStack multi-sort.

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 (write-excel-file and fflate publish frequently; re-check `npm view write-excel-file version` before installing)
