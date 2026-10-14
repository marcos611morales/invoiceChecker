# Phase 2: Dashboard de gasto confiable - Research

**Researched:** 2026-10-14
**Domain:** Client-side accounting rules engine (CFDI 4.0, exact decimals) + dashboard UI (shadcn base-nova, Recharts 3, TanStack Table v9, zustand)
**Confidence:** HIGH for the rules engine, data profile and codebase integration (measured on the real 143-file sample and read from source); MEDIUM for SAT catalog labels and TipoRelacion semantics (third-party mirror and blogs, the official SAT host was unreachable); MEDIUM for UI library behavior that was read from types/registry but not run in a browser.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Las reglas de montos de PROJECT.md (Key Decisions) son definitivas y no se repiten aquí: "sin IVA" = Subtotal − Descuento + IEPS; notas de crédito restan en el mes de la factura relacionada (o en su propia fecha con aviso); facturas $0 fuera de conteos/promedios; promedio mensual sobre meses del calendario del rango; "Excluir" manual sin SAT; TipoCambio de la propia factura; big.js.

### Organización de la pantalla
- **D-01:** Con facturas cargadas, la pantalla usa pestañas: **Dashboard**, **Calidad de datos** e **Importación** (el reporte de la Fase 1). Al terminar una carga se abre Dashboard. Fases 3–5 agregan pestañas.
- **D-02:** La tabla "Facturas cargadas" de la Fase 1 (montos tal cual del XML) **se elimina**; la reemplaza la tabla del Dashboard (D-24). La pestaña Importación conserva solo el reporte (tarjetas + acordeones). La pantalla vacía (sin facturas) sigue igual que en la Fase 1.
- **D-03:** Distribución de la pestaña Dashboard, de arriba abajo: barra de filtros (D-11) → fila de 4 KPIs → tendencia mensual (ancha) con el ranking de proveedores al lado (apilados en móvil) → tabla de facturas.
- **D-04:** La pestaña Calidad de datos muestra un contador de incidencias ("Calidad de datos · 5"). Si alguna incidencia **cambia montos** (nota de crédito sin factura relacionada, sustitución aplicada, moneda sin TipoCambio), arriba del Dashboard aparece un aviso breve con enlace a la pestaña.
- **D-05:** Selector de IVA: interruptor de dos botones **"Con IVA | Sin IVA"** en el centro de la barra superior (hueco `topbar-center` reservado en la Fase 1); en móvil "c/IVA | s/IVA". El modo activo siempre se ve resaltado.
- **D-06:** El modo IVA arranca en **Con IVA** la primera vez y **se recuerda en localStorage** (primer ajuste persistido del proyecto: store de ajustes zustand `persist` con `version`, validación zod y `skipHydration`, según `.claude/CLAUDE.md` §State). — **Reversibility:** costly — la clave/versión de localStorage se vuelve un contrato que la Fase 3 (AJUS-01/02) debe migrar.
- **D-07:** Si los filtros no dejan ninguna factura, KPIs y gráficas se sustituyen por "Ninguna factura coincide con los filtros" y un botón "Quitar filtros".

### Reglas adicionales acordadas
- **D-08:** **Sustitución (TipoRelación 04):** si están cargadas la factura que sustituye y la original, la original se excluye sola con estado "Sustituida", se lista en Calidad de datos y el usuario puede "Volver a incluir". Si la original no está cargada, solo se lista en Calidad.
- **D-09:** **Diferencia de redondeo:** se lista en Calidad la factura cuyo Total del XML difiere más de $0.01 de Subtotal − Descuento + traslados − retenciones, o cuya suma de conceptos difiere más de $0.01 del Subtotal. Solo se informa; el monto que se usa es siempre el del XML.
- **D-10:** **Moneda extranjera sin TipoCambio:** la factura no suma al gasto y se avisa en Calidad ("USD sin tipo de cambio: no se suma"); no se inventa ni se pide un tipo de cambio. Las convertidas muestran el monto en MXN y debajo una línea chica con el original ("USD 100.00 · TC 18.20").

### Filtros
- **D-11:** Barra de filtros arriba de los KPIs: Fechas, Proveedor, Forma de pago y "Quitar filtros". Los filtros activos se ven como etiquetas que se pueden quitar. En móvil se pliega en un botón "Filtros". Aplican a KPIs, tendencia, ranking y tabla (FILT-05); viven en el store de sesión (no se persisten).
- **D-12:** Rango por defecto: **del primer al último mes con facturas cargadas** (en la muestra, ene–dic 2025 → el promedio mensual divide entre 12).
- **D-13:** El rango se elige **por meses** ("Desde mes / Hasta mes"), no por días, con atajos: "Todo", "Este año", "Últimos 3 meses" y elegir un solo mes. Así nunca hay meses parciales en el promedio.
- **D-14:** Proveedor y Forma de pago son multiselección con casillas y buscador. Cada opción muestra el número de facturas ("Nueva Wal-Mart de México (39)"). Formas de pago con el nombre del catálogo SAT c_FormaPago, nunca el código.
- **D-15:** Una nota de crédito entra al filtro de fechas por su **mes de imputación** (el de la factura relacionada), para que KPIs, tendencia y tabla cuadren. En la tabla muestra su fecha real y la etiqueta "aplica a jun 2025".
- **D-16:** Una factura PPD sin complemento de Pago cargado aparece en el filtro como **"Por definir (sin complemento de pago)"** y en Calidad como "PPD sin complemento".
- **D-17:** Si los complementos de Pago de una PPD traen varias formas de pago, la factura toma **todas** (aparece al filtrar cualquiera; en la tabla "Transferencia, Tarjeta"). El monto no se reparte entre formas.

### KPIs, tendencia y ranking
- **D-18:** "Número de facturas" cuenta solo las de **Ingreso con monto > $0**, no excluidas ni sustituidas. Debajo, un texto chico "+N notas de crédito" si hay alguna en el rango.
- **D-19:** Ticket promedio = **gasto neto (ya restadas las notas de crédito) ÷ número de facturas** (D-18).
- **D-20:** Los 4 KPIs muestran la **variación % contra el periodo anterior de igual duración** (p. ej. rango jul–dic → se compara con ene–jun). Si el periodo anterior no tiene facturas cargadas, se muestra en gris "Sin datos del periodo anterior"; nunca se calcula un % contra $0. En gasto, subir se muestra neutro o rojo y bajar en verde.
- **D-21:** Tendencia mensual en **barras**, una por mes del rango (los meses sin gasto en $0), con el monto en un tooltip y una línea punteada con el promedio mensual.
- **D-22:** Ranking de proveedores: **barras horizontales con el top 10** (monto, % del total y ticket promedio) y un botón "Ver todos" que abre la lista completa ordenable. Los demás no se agrupan en "Otros".
- **D-23:** El ranking usa el **gasto neto** de cada proveedor (sus notas de crédito restan en el mismo periodo). Un proveedor con neto negativo aparece al final con su monto negativo.

### Tabla y Excluir
- **D-24:** La tabla del Dashboard es de **facturas con fila desplegable de conceptos**. Fila: fecha, proveedor, folio, forma de pago y monto según el modo IVA. Al abrirla se ven sus conceptos (descripción, cantidad, unidad, precio unitario, monto). Se ordena por columna y se pagina de 50 en 50 (TanStack Table v9, igual que la Fase 1).
- **D-25:** Monto por concepto **según el modo IVA, con la misma regla de la factura**: sin IVA = importe − descuento + IEPS del concepto; con IVA = lo anterior + IVA trasladado del concepto. Si la suma de conceptos no da el monto de la factura, **manda la factura** y en la fila desplegable se ve una línea chica "Diferencia de redondeo: $0.01" (además de listarse en Calidad, D-09).
- **D-26:** Las notas de crédito se ven con **monto negativo** ("−$1,000.00"), la insignia "Nota de crédito" y "aplica a <mes>" o "sin factura relacionada".
- **D-27:** Los Pagos, Traslado/Nómina y facturas en $0 **sí aparecen en la tabla**, atenuados y con la etiqueta "No suma".
- **D-28:** "Excluir" está en un menú "⋯" de cada fila. La factura excluida sigue en la tabla, atenuada y con la etiqueta "Excluida", y se puede "Volver a incluir" desde el mismo menú. Calidad de datos tiene una lista de excluidas.
- **D-29:** Excluir **no pide confirmación ni motivo**: se aplica al instante y aparece un aviso "Factura excluida · Deshacer".
- **D-30:** La exclusión **dura solo la sesión** (store en memoria). Al recargar y volver a soltar los XML hay que excluir de nuevo. **No** se guarda el UUID en localStorage. (Esto difiere de la sugerencia de `.planning/research/PITFALLS.md` §Cancelaciones; manda la decisión del usuario.)

### Calidad de datos
- **D-31:** La pestaña Calidad de datos sigue el patrón del reporte de importación (D-19 de la Fase 1): tarjetas de resumen por tipo de incidencia con su conteo y, debajo, secciones plegables con la lista. Se abren solas las que afectan montos.
- **D-32:** Tipos de incidencia: notas de crédito sin factura relacionada, sustituciones (04), facturas en $0, diferencias de redondeo, PPD sin complemento, moneda sin TipoCambio, excluidas y sustituidas. Duplicados y archivos con error **no se repiten**: se muestra su conteo con un enlace "Ver en Importación".
- **D-33:** Cada incidencia tiene "Ver factura" (lleva al Dashboard y abre esa fila) y las acciones propias del caso ("Volver a incluir" en excluidas y sustituidas). El resto solo informa.

### Claude's Discretion
- Columnas exactas de la tabla y orden por defecto (sugerido: fecha, de la más reciente a la más antigua).
- Qué hacer en "Ver factura" si los filtros activos ocultan esa fila (p. ej. quitar filtros o avisar).
- Colores exactos de la variación (neutro o rojo al subir) y la distribución visual fina; el UI-SPEC de la fase puede afinarlas.
- Textos exactos de avisos y etiquetas, más allá de los citados.
- **Inferido, confirmar en planeación si hay duda:** al agregar facturas, el rango por defecto (D-12) se recalcula si el usuario no tocó el filtro de fechas; el periodo anterior (D-20) aplica los mismos filtros de proveedor y forma de pago; las filas "No suma" (D-27) respetan los filtros; el detalle de una PPD puede mostrar "pagada el <fecha> con <forma>" a partir de su complemento.
- Estructura del motor de reglas (capa contable pura separada del parser) y de los selectores filtrados compartidos.

### Deferred Ideas (OUT OF SCOPE)
- Recordar exclusiones entre sesiones (por UUID en localStorage) — el usuario lo descartó por ahora; se podría reconsiderar junto con el respaldo de ajustes (Fase 3, AJUS-02).
- Capturar a mano un tipo de cambio para facturas en moneda extranjera sin TipoCambio — descartado; por ahora no suman y se avisa.

**Note on the UI contract:** `02-UI-SPEC.md` is approved (2026-10-14) and supersedes the "Claude's Discretion" items above (default sort Fecha descending; "Ver factura" hidden-by-filters shows an Alert and changes nothing; delta up = neutral, down = `--positive` green; every finished batch that adds invoices resets the date range to the full span). Its 11 user decisions are not to be re-asked.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REGLA-01 | I suma, E resta, P no suma | `LedgerEntry.kind` + sign rule; sample profile (133 I / 3 E / 7 P) in "Sample data profile"; Pattern 1 |
| REGLA-02 | NC resta en el mes de la factura relacionada, o en su propia fecha con aviso | Pattern 3 (imputation month); sample finding: all 3 E relate to a loaded I **in the same month**, so synthetic cross-month fixtures are mandatory; Open Question 1 (several related) |
| REGLA-03 | Con IVA = Total; Sin IVA = Subtotal − Descuento + IEPS; modo siempre visible | Pattern 2 (amount formulas, IEPS from invoice-level taxes), Pitfall 12 (concept vs invoice IVA drift); settings store spec |
| REGLA-04 | big.js, redondeo solo al mostrar | Standard Stack (big.js 7.0.1), Code Examples `decimal.ts`, Pitfalls 1-3 (strict mode, negative zero, hostile numerics) |
| REGLA-05 | Mes por fecha literal | Code Examples `months.ts`; Pitfall 11; sample has 8 invoices within 6 h of a month change |
| REGLA-06 | Facturas en $0 fuera de conteos y promedios, listadas en Calidad | Status model (`no-suma: cero`), counting definition, 12 zero invoices in sample |
| REGLA-07 | Moneda ≠ MXN convertida con TipoCambio propio | Pattern 2 conversion rules; sample has NO foreign invoice → synthetic fixtures; D-10 handling |
| REGLA-08 | Excluir manual | sessionStore `excluded` + `restored`; undo toast; Pitfall list for exclusion edge cases |
| REGLA-09 | Forma de pago real de PPD desde el complemento | Pattern 4 (PPD → Pago join by `doctos[].idDocumento`); c_FormaPago catalog (22 codes, verified against mirror) |
| DASH-01 | KPIs | Pattern 5 (aggregate functions) |
| DASH-02 | Tendencia con meses en $0 | Pattern 5 `monthlySeries`; Recharts 3.8.0 notes (`activeBar`, `Cell` deprecated) |
| DASH-04 | Ranking de proveedores con ticket promedio | Pattern 5 `supplierRanking` keyed by RFC (39 RFCs, 0 name conflicts in sample) |
| DASH-06 | Promedio mensual entre meses del calendario del rango, indicado | `monthsInRange` helper; UI-SPEC sub-label |
| DASH-09 | Tabla ordenable de facturas/conceptos | Table pattern (TanStack v9 sorting + pagination as in Phase 1; expansion kept in app state); Pitfall 1 (sorting with strict Big) |
| DASH-10 | UI en español con formato es-MX | Money/percent/compact formatting verified in Node 24 / ICU 78.2; Pitfalls 2 and 10 |
| FILT-01 | Filtro por rango de fechas o mes | Filters model (months, auto-reset on batch); Select needs `items` (Pitfall 8) |
| FILT-02 | Filtro por proveedor(es) | Supplier key = RFC; cmdk with `shouldFilter={false}` (Pitfall 7) |
| FILT-04 | Filtro por forma de pago con nombres SAT | `catalogs.ts` (22 labels); sentinel for PPD without complemento |
| FILT-05 | Filtros consistentes en KPIs, gráficas, tablas | One `applyFilters` over one ledger; same filtered entries feed every view (Pattern 5) |
| CAL-01 | Panel de calidad de datos | Pattern 6 (incident derivation per type, thresholds, counter) |
| DEV-03 | Pruebas Vitest del parser y reglas sobre XML anonimizados; Facturas/ fuera de git | Testing approach section (fixtures to build, anonymizer script, privacy guard); `.gitignore` line 1 already `Facturas/` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted from `./CLAUDE.md` and `./.claude/CLAUDE.md`. These carry the same authority as locked decisions.

- **Rule 1, ask, never infer.** Every ambiguous business rule not settled by CONTEXT.md or UI-SPEC.md is listed under *Open Questions* with options and a recommendation; the planner must not pick silently.
- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess: true`): no `any`, no `@ts-ignore`/`@ts-nocheck` (use `@ts-expect-error` with a reason), no non-null `!`, no `as` to force unverified types. External data (XML values, `localStorage`) must be validated (zod) before being typed. Exceptions need a justifying comment on the same or previous line.
- **Verification before "done":** `pnpm tsc --noEmit`, `pnpm eslint .`, `pnpm vitest run` must pass (repo scripts: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm verify`).
- Stack is fixed: Next 16.4.0 App Router, React 19.3.0, shadcn base-nova (Base UI), Recharts via shadcn `chart`, TanStack Table v9, zustand 5 `persist` with `skipHydration` + zod, date-fns `es` allowed but UI-SPEC says **no date library is added** (static month arrays + string slicing), `Intl.NumberFormat("es-MX")`.
- `.claude/CLAUDE.md` money advice (integer centavos) is **superseded** by big.js (PROJECT.md / REGLA-04).
- GSD workflow enforcement: file edits go through a GSD command (the executor handles this, not research).
- Privacy: no network calls with invoice data; CSP `connect-src 'self'` stays; `Facturas/` stays out of git and out of `tests/`/`e2e/` (guard test exists).
- No project skills found (`.claude/skills/`, `.agents/skills/` absent).

## Summary

Phase 1 already parses everything Phase 2 needs: `ParsedInvoice` carries `moneda`, `tipoCambio`, `descuento`, `totalImpuestosTrasladados/Retenidos`, per-concept `traslados`/`retenciones`, `relacionados[].tipoRelacion/uuids`, and `pagos[].formaDePagoP` with `doctos[].idDocumento`. **No new parser field is strictly required.** Two parser hardenings are recommended (Open Questions 2 and 3): reject non-numeric money/`Fecha` attributes as `malformed` (otherwise `new Big("abc")` throws during render and white-screens the whole dashboard), and capture the invoice-level `Impuestos/Traslados` breakdown so IEPS comes from the same layer as `Total` (concept-level IVA sums drift from invoice-level by up to $0.0048 in 38 of 136 sample invoices).

The work splits into (a) a pure accounting layer in `src/domain/accounting/` that turns `LoadedInvoice[]` plus session overrides into a mode-independent `LedgerEntry[]` (kind, status, imputation month, both amounts in MXN as `Big`, payment forms, incident reasons), with pure selectors for filters, KPIs, trend, ranking, previous period and quality incidents; and (b) the UI on top (tabs, IVA toggle, filter bar, KPI cards, Recharts bar chart, HTML ranking, TanStack table with app-managed row expansion, Calidad tab). Everything computes in the browser in milliseconds (143 files, 362 concepts). The dominant risks are not UI: they are `Big.strict` semantics (numbers and `valueOf` throw, which breaks naive sorting), negative-zero money strings, zustand v5 selector identity loops, the sample data not exercising REGLA-02/07/08 (all 3 credit notes relate to a loaded invoice in the same month; no foreign currency), and persisting only `ivaMode` (never invoice data).

**Primary recommendation:** Build `src/domain/accounting/*` first, test-first against anonymized plus synthetic fixtures (DEV-03), expose one `buildLedger` + `applyFilters` pipeline that every view consumes, then layer the UI; install `big.js`, `@types/big.js`, `recharts@3.8.0` (via `shadcn add chart`), `cmdk` (via `shadcn add command`) behind the usual package-approval checkpoint, and pin `react-is` explicitly because the auto-installed peer resolves to a version published today.

## Architectural Responsibility Map

All computation is client-side by project constraint; the server only serves the static shell and the Phase 1 auth routes. No Phase 2 capability touches an API route.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Amount rules (I/E/P, con/sin IVA, $0, FX, substitution, PPD forma) | Browser / Client (`src/domain/accounting`, pure TS) | — | Invoices never leave the browser (CARGA-02, CSP `connect-src 'self'`) |
| Filters, KPIs, trend, ranking, quality incidents | Browser / Client (pure selectors) | — | Same filtered dataset must feed charts, tables and later Excel (FILT-05) |
| Session state: filters, exclusions, restored substitutes, active tab | Browser / Client (`sessionStore`, memory only) | — | D-11, D-30: not persisted |
| IVA mode persistence | Browser / Client (`settingsStore` + `localStorage`) | — | D-06; only this value persists |
| Charts, tables, tabs, popovers | Browser / Client (React client components) | — | shadcn base-nova + Recharts + TanStack |
| Page gate / shell | Frontend Server (Next, existing Phase 1 `proxy.ts`) | — | Unchanged |
| Catalog labels (c_FormaPago, tipo de relación) | Browser / Client (static constants in `src/domain/cfdi/catalogs.ts`) | — | Static SAT data, no fetch |

## Standard Stack

### Core (new in this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| big.js | 7.0.1 (published 2025-04-21) | Exact decimal arithmetic (REGLA-04) | Locked by PROJECT.md; 6 KB, MIT, 34M weekly downloads [VERIFIED: gsd package-legitimacy check; npm view big.js version = 7.0.1] |
| @types/big.js | 7.0.0 (devDependency) | Types for big.js | DefinitelyTyped; compiled clean under TS 6.0.3 strict in a scratch project [VERIFIED: tsc run] |
| recharts | 3.8.0 (pinned by the shadcn `chart` registry item) | Monthly trend bar chart | `shadcn view @shadcn/chart` returns `chart ["cn","recharts@3.8.0"] ["card"]` [VERIFIED: shadcn registry output]; UI-SPEC locks it |
| cmdk | 1.1.1 | Searchable list in the Proveedor / Forma de pago popovers | `shadcn view @shadcn/command` depends on `cmdk` [VERIFIED: registry output]; UI-SPEC locks Command + Checkbox |
| react-is | pin `19.3.0` explicitly (see audit) | Required peer of recharts 3.8.0 (`react-is ^16.8 ... || ^19.0.0`) | pnpm `auto-install-peers` would resolve `^19` to 19.3.1 published 2026-10-14 (SUS "too-new") [VERIFIED: npm view react-is time; recharts peerDependencies] |

### Already installed (reuse, do not re-add)
| Library | Version | Use in this phase |
|---------|---------|-------------------|
| zustand | 5.0.15 | `sessionStore` (filters, exclusions) + new `settingsStore` with `persist` |
| zod | 4.6.7 | Validate persisted `ivaMode`; optionally Phase 1 parser hardening |
| @tanstack/react-table | 9.3.1 | Facturas table (sorting + pagination, same `tableFeatures` pattern) and "Ver todos" supplier table |
| @base-ui/react | ^1.9.0 | Tabs, ToggleGroup, Select, Popover, Menu, Dialog, Collapsible (via shadcn wrappers) |
| sonner | ^2.0.8 | "Factura excluida · Deshacer exclusión" toast |
| lucide-react | ^1.56.0 | Icons (verify names after install, UI-SPEC) |

### shadcn components to add (UI-SPEC command)
`pnpm dlx shadcn@4.21.4 add tabs chart popover command checkbox dropdown-menu toggle-group select dialog collapsible`. Registry facts [VERIFIED: `node_modules/.bin/shadcn view @shadcn/<name>` run 2026-10-14]:
- `command` registry dependencies: `dialog`, `input-group` (both already installed). The CLI may offer to overwrite them: answer **no**, and run `git diff --stat src/components/ui` afterwards; only additions are expected.
- `chart` has no `cssVars`, so `--chart-1` and `--positive` must be added by hand to `src/app/globals.css` (both themes plus `@theme inline` mappings), as UI-SPEC specifies. `globals.css` has no `--chart-*` token today.
- `toggle-group` imports `@base-ui/react/toggle-group`; `tabs` → `@base-ui/react/tabs`; `select` → `@base-ui/react/select`; `dropdown-menu` → `@base-ui/react/menu`; `popover`, `collapsible` likewise.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk (`Command`) | Base UI `Combobox` (installed in `@base-ui/react`, no extra package) | UI-SPEC is approved with Command; `cmdk` pulls `@radix-ui/react-dialog`, `react-id`, `react-primitive`, `react-compose-refs` into a Base UI project. Keep Command (locked); mention Combobox only as fallback if cmdk misbehaves with React 19.3 [VERIFIED: npm view cmdk dependencies] |
| TanStack `rowExpandingFeature` | App-owned `Set<string>` of expanded invoice ids | `rowExpandingFeature` and `createExpandedRowModel` exist in table-core 9.3.1 [VERIFIED: dist/index.d.ts exports], but the panel is not a sub-row and open state must survive sort/page/filter; a controlled `Set` keyed by UUID is simpler and fully typed. Recommended. |

**Installation:**
```bash
pnpm add big.js@7.0.1 react-is@19.3.0
pnpm add -D @types/big.js@7.0.0
pnpm dlx shadcn@4.21.4 add tabs chart popover command checkbox dropdown-menu toggle-group select dialog collapsible
```
Note: `package.json` currently has `zod` and `zustand` pinned exactly and shadcn-added packages with `^`; STATE.md records that the lockfile pins versions. Prefer exact pins for `big.js`/`recharts` (UI-SPEC: "keep that one version").

**Version verification (2026-10-14):** `npm view big.js version` → 7.0.1 (modified 2025-06-19); `npm view @types/big.js version` → 7.0.0; `npm view recharts@3.8.0` → 3.8.0 (MIT); `npm view cmdk version` → 1.1.1; `npm view react-is version` → 19.3.1 (published 2026-10-14; 19.3.0 published 2026-09-09).

## Package Legitimacy Audit

Run with `gsd-tools query package-legitimacy check --ecosystem npm ...` on 2026-10-14.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| big.js | npm | years (latest 2025-04-21) | 33.9M/wk | github.com/MikeMcl/big.js | OK | Approved (user-locked in PROJECT.md) |
| @types/big.js | npm | latest 2026-05-21 | 1.9M/wk | github.com/DefinitelyTyped/DefinitelyTyped | OK | Approved |
| recharts | npm | latest 2026-07-25 (3.8.0 modified 2026-10-13) | 54.9M/wk | github.com/recharts/recharts | OK | Approved (pulled by shadcn `chart`) |
| cmdk | npm | latest 2025-03-14 | 41.0M/wk | github.com/pacocoursey/cmdk | OK | Approved (pulled by shadcn `command`); brings 4 `@radix-ui/*` transitive deps |
| react-is | npm | latest version published 2026-10-14 | 367.8M/wk | github.com/react/react | **SUS** ("too-new") | Flagged: peer of recharts; the package itself is the official React one, but pnpm would auto-resolve to 19.3.1 published the same day. Planner adds a `checkpoint:human-verify` before install and pins `react-is@19.3.0` (published 2026-09-09) explicitly. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `react-is` [WARNING: flagged as suspicious ("too-new") — verify before using.] No `postinstall` script on any package (seam signal `postinstall: null` for all five).

All five names come from locked CONTEXT/UI-SPEC decisions and the shadcn registry (an authoritative source), not from WebSearch. Transitive packages of recharts (`@reduxjs/toolkit`, `react-redux`, `immer`, `reselect`, `es-toolkit`, `victory-vendor`, `decimal.js-light`, `eventemitter3`, `tiny-invariant`, `clsx`) were not individually audited; they are recharts' published dependency list [VERIFIED: npm view recharts@3.8.0 dependencies].

## Architecture Patterns

### System Architecture Diagram

```
 sessionStore (memory)                                   settingsStore (localStorage)
 ┌──────────────────────────────┐                        ┌──────────────────────┐
 │ invoices: LoadedInvoice[]    │                        │ ivaMode: "con"|"sin" │
 │ excluded: Set<uuid>          │                        │ key invoicechecker:  │
 │ restored: Set<uuid> (04)     │                        │ settings, version 1  │
 │ filters {range|null,         │                        └──────────┬───────────┘
 │   suppliers:Set, formas:Set} │                                   │ mode
 │ rejected/duplicates/ignored  │                                   │
 └───────┬──────────────────────┘                                   │
         │ useMemo([invoices, excluded, restored])                  │
         ▼                                                          │
 buildLedger()  ──►  LedgerEntry[]   (kind, status, month, conIva, sinIva, formas, reasons)
         │                 │
         │                 ├──► qualityIncidents(ledger, import counts)  ─► Calidad tab, tab counter, D-04 alert  (NOT filtered)
         │                 │
         │      useMemo([ledger, filters])
         │                 ▼
         │          applyFilters() ─► visible[]  ──┬─► kpis(visible, prevVisible, range, mode) ─► 4 KPI cards (+ deltas)
         │                 │                       ├─► monthlySeries(visible, range, mode)     ─► Recharts BarChart + average line
         │      prevPeriod(range) + same           ├─► supplierRanking(visible, mode)          ─► top-10 HTML list + "Ver todos" dialog
         │      supplier/forma filters             └─► invoiceRows(visible, mode)              ─► TanStack table (+ expand panel)
         │                 ▼
         │          applyFilters(prev range) ─► prevVisible[]
         ▼
 Filter option lists (counts over ALL loaded invoices, independent of other filters)

 Actions: exclude(uuid) / reinclude(uuid) ─► sessionStore ─► ledger recomputes ─► every view updates in one render
 Tab / "Ver factura" requests: small UI state (active tab, pending focus uuid) read by Dashboard table
```

### Recommended Project Structure
```
src/
├── domain/
│   ├── cfdi/catalogs.ts            # c_FormaPago (22 codes), c_TipoRelacion labels (static)
│   └── accounting/
│       ├── decimal.ts              # Big config (strict, DP, RM), parseDecimal, sum, toMoneyString
│       ├── months.ts               # MonthKey helpers, range, previous period, static month names
│       ├── amounts.ts              # invoiceAmounts(), conceptAmounts() (con/sin IVA, FX)
│       ├── ledger.ts               # buildLedger(invoices, overrides) -> LedgerEntry[]
│       ├── filters.ts              # Filters type, applyFilters, defaultRange, option counts
│       ├── aggregate.ts            # kpis, monthlySeries, supplierRanking, deltaPct
│       ├── quality.ts              # qualityIncidents()
│       └── *.test.ts               # next to the code (Phase 1 convention)
├── stores/
│   ├── sessionStore.ts             # + filters, excluded, restored (extend, do not fork)
│   └── settingsStore.ts            # persist: { ivaMode }
├── features/
│   ├── shell/                      # AppShell -> Tabs; TopBar IVA ToggleGroup in data-slot="topbar-center"
│   ├── dashboard/                  # FilterBar, KpiRow, TrendChart, SupplierRanking, SupplierDialog
│   ├── invoices/                   # replace InvoiceTable/columns with the new table (delete old one)
│   └── quality/                    # QualityTab (reuse SummaryCards/Accordion patterns)
└── lib/format.ts + lib/copy/*      # money/percent/month formatting, Spanish strings (UI layer only)
tests/fixtures/cfdi/anon/           # new anonymized + synthetic fixtures
```
ESLint boundary: `src/domain/**` may not import `react`, `next`, `zustand`, `@/components/*`, `@/stores/*`, `@/features/*`, `@/lib/*` [VERIFIED: eslint.config.mjs:15-27]. Therefore catalogs live in `src/domain/cfdi/catalogs.ts` (data, not UI copy) and the domain returns `Big`/strings; `src/lib/format.ts` formats them. `big.js` itself is allowed in domain.

### Verified in-repo facts (read this session)

| Fact | Evidence (verbatim) |
|------|---------------------|
| Tipo union | `export type TipoComprobante = "I" \| "E" \| "P" \| "T" \| "N";` (src/domain/cfdi/types.ts:1) |
| Invoice money/FX fields exist | `moneda: string;` `tipoCambio: string \| null;` `descuento: string \| null;` `totalImpuestosTrasladados: string \| null;` `totalImpuestosRetenidos: string \| null;` (types.ts:72-80) |
| Relations and payments exist | `relacionados: CfdiRelacionados[];` `pagos: Pago[];` (types.ts:84-85); `tipoRelacion: string;` `uuids: string[];` (types.ts:40-41); `formaDePagoP: string;` (types.ts:54); `idDocumento: string;` (types.ts:46) |
| Concept taxes at concept level only | `traslados: Impuesto[];` `retenciones: Impuesto[];` (types.ts:34-35); `importe: string \| null;` (types.ts:16) |
| Parser does not validate Fecha format or numeric money | `const fecha = root.getAttribute("Fecha");` (parseCfdi.ts:132); `if (fecha === null) return malformed("Fecha");` (parseCfdi.ts:145); no numeric check on `SubTotal`/`Total` (parseCfdi.ts:134-135, 147-148) |
| IVA slot reserved | `<div data-slot="topbar-center" className="flex-1" />` (src/features/shell/TopBar.tsx:13) |
| Session store has `generation` | `generation: number;` (sessionStore.ts:16); store is `create<SessionState>()((set, get) => ...)` with no middleware (sessionStore.ts:29) |
| Table pattern to keep | `getRowId: (row) => row.id,` (InvoiceTable.tsx:135); `autoResetPageIndex: false,` (:139); `sortDescFirst: false,` (:142) |
| Domain import boundary | `"@/lib/*",` inside `no-restricted-imports` patterns (eslint.config.mjs:26) |
| CSP allows inline styles (shadcn `ChartStyle` is safe) | `"style-src 'self' 'unsafe-inline'",` (next.config.ts:12); `"connect-src 'self'",` (:15) |
| cacheComponents on | `cacheComponents: true,` (next.config.ts:24) |
| `Facturas/` ignored | `Facturas/` (.gitignore:1); `git ls-files Facturas` returns 0 files |
| Vitest default env is node | `environment: "node",` (vitest.config.mts:8); per-file opt-in `// @vitest-environment jsdom` (parseCfdi tests) |
| Not installed yet | `recharts`, `big.js`, `cmdk` absent from package.json (grep) |

### Sample data profile (counts only, no identifiers)
[VERIFIED: local scripts over `Facturas/2025/*.xml`, 2026-10-14; use as test expectations for the optional real-data test]

| Fact | Value |
|------|-------|
| CFDI | 143 = 133 I + 3 E + 7 P; 0 non-MXN (7 P use `XXX`); `TipoCambio` ≠ "1" on 0 invoices |
| Total = 0 | 12 invoices, all type I |
| Counting invoices (I with Total > 0) | 121 (133 − 12); credit notes 3 |
| IEPS | 9 invoices (Impuesto `003`, TipoFactor Tasa); concept-level IEPS sum equals invoice-level IEPS in all 9; `SubTotal − Descuento + IEPS + IVA == Total` holds in all 9 |
| Total identity | `SubTotal − Descuento + traslados − retenciones` equals `Total` exactly in 136/136 non-P; 0 retenciones; 0 Exento |
| Concept vs invoice drift | `Σ Importe ≠ SubTotal` exactly in 26 (max 0.004828); `Σ concept IVA ≠ invoice IVA` in 38 (max 0.004832); no invoice differs by ≥ $0.005, so D-09 (> $0.01) yields **zero** rounding incidents on the sample |
| PPD | 8 invoices (FormaPago `99`); 7 have a loaded Pago complement (all `FormaDePagoP` = `04`), 1 has none; 0 PPD with several distinct forms |
| FormaPago on non-PPD | `28`:62, `03`:41, `04`:16, `31`:5, `01`:1 (I); `30`:3 (E) |
| TipoRelacion | `07`: 3 E (all targets loaded, type I, **same calendar month as the E**) + 3 I (targets loaded); `04`: 1 I whose target is **not** loaded |
| Boundary dates | 8 type-I invoices within 6 h of a month boundary (day 1 before 06:00 or last day from 18:00) |
| I per month | ene 1, feb 1, mar 1, abr 1, may 9, jun 24, jul 12, ago 22, sep 14, oct 17, nov 18, dic 13 |
| Suppliers | 39 distinct emisor RFC; 0 RFC with several names; 0 names with several RFC; 0 emisor without Nombre |

Key consequences: (1) REGLA-02 cross-month attribution is **not exercised by the sample** because each E and its related I share a month; (2) REGLA-07 and REGLA-08 have no real data either; (3) sub-cent drift between layers is real, so the rounding threshold and the "Diferencia de redondeo" display rule need care (Pitfall 12).

### Pattern 1: Ledger = one mode-independent entry per invoice

**What:** `buildLedger(invoices, { excluded, restored })` returns a `LedgerEntry` for every loaded invoice (including P/T/N, zeros, excluded). Entries hold **both** amounts so the IVA toggle only changes an accessor, never recomputes the ledger.

**Status model** (single source of truth for table badges, KPIs, Calidad):

| Field | Values | Rule |
|-------|--------|------|
| `kind` | `ingreso` / `nota-credito` / `pago` / `traslado` / `nomina` | from `tipo` I/E/P/T/N [REGLA-01] |
| `noSuma` | `null` / `"tipo"` / `"cero"` / `"moneda-sin-tc"` | `tipo` for P/T/N; `cero` when the converted Total is exactly 0; `moneda-sin-tc` when `moneda ≠ "MXN"` and `tipoCambio` is missing/invalid/≤ 0 |
| `exclusion` | `null` / `"manual"` / `"sustituida"` | manual ∈ `excluded`; sustituida = original of a loaded 04 substitute and not in `restored` |
| `counted` | boolean | `noSuma === null && exclusion === null` |
| `month` | `YYYY-MM` | imputation month (Pattern 3) |
| `ownMonth` | `YYYY-MM` | `Fecha` slice |
| `formas` | `string[]` | codes, or sentinel `"PPD_SIN_COMPLEMENTO"` (Pattern 4) |
| `conIva`, `sinIva` | `Big \| null` | MXN, signed (E negative); `null` when not convertible; **computed even when not counted** so excluded rows can show a struck-through amount |

Counting rules (D-18, D-19): `facturas` = counted entries of kind `ingreso`; `notas` = counted entries of kind `nota-credito`; spend = Σ amount over all counted entries (I positive, E negative).

### Pattern 2: Amount formulas (all exact `Big`, MXN)

For an invoice with `Total`, `SubTotal`, `Descuento` (null → 0), `fx` = 1 for MXN or `TipoCambio` otherwise:

- `conIva = Total × fx`, negated for E. [REGLA-03]
- `sinIva = (SubTotal − Descuento + IEPS) × fx`, negated for E. [REGLA-03] `IEPS` = Σ `importe` of **invoice-level** traslados with `impuesto === "003"` (treat `null` importe as 0). Recommended parser addition: capture `Impuestos/Traslados/Traslado` and `Impuestos/Retenciones/Retencion` of the Comprobante (additive field on `ParsedInvoice`, e.g. `impuestos: { traslados: Impuesto[]; retenciones: Impuesto[] }`). Fallback if the user declines (Open Question 3): Σ concept-level `003` importes (equal in all 9 sample IEPS invoices, but not guaranteed in general).
- Foreign currency (REGLA-07, D-10): if `moneda === "MXN"` ignore `tipoCambio` (65 sample MXN invoices carry `TipoCambio="1"`; presence is not a foreign signal). Else require a valid `tipoCambio > 0`; otherwise `noSuma = "moneda-sin-tc"` and amounts are `null`. Do not round after multiplying (REGLA-04: rounding only at display).
- Per concept (D-25): `sinIva = importe − descuento + Σ concept traslados(003)`; `conIva = importe − descuento + Σ concept traslados(002 and 003)` (see Open Question 8 for retenciones), then × fx and sign. The invoice amount governs; show "Diferencia de redondeo" in the expanded panel only when `round2(Σ concept amounts) ≠ round2(invoice amount)` (otherwise the line would read "$0.00").
- Zero rule (REGLA-06): decide "$0" on the **converted `Total` only** (mode-independent), so toggling con/sin IVA never changes the invoice count (Open Question 4).

### Pattern 3: Imputation month (REGLA-02, REGLA-05, D-15)

```
ownMonth = monthOfFecha(invoice.fecha)            // string slice, never Date
if kind === "nota-credito":
    related = loaded invoices whose uuid ∈ relacionados[*].uuids   // any tipoRelacion
    month   = related.length > 0 ? monthOf(chosen related) : ownMonth
    flag    = related.length === 0                 // "sin factura relacionada" incident
else month = ownMonth
```
`chosen related` when several are loaded in different months is **Open Question 1** (recommended: earliest `fecha`). P/T/N and zero invoices use their own month. The date range filter, trend, KPIs and ranking all use `month`; the table shows the real `fecha` (sort key is the literal ISO string) and the caption "aplica a {mes}" [D-15, D-26].

### Pattern 4: PPD payment form from the Pago complement (REGLA-09, D-16, D-17)

Build once: `Map<uuid, Set<formaDePagoP>>` from every loaded `tipo === "P"` invoice: for each `pago` of `pagos`, for each `docto` of `pago.doctos`, add `pago.formaDePagoP` under `docto.idDocumento` (already trimmed/uppercased by the parser). For an invoice with `metodoPago === "PPD"` or `formaPago === "99"`: `formas` = the set (sorted by catalog order) if non-empty, else `["PPD_SIN_COMPLEMENTO"]` (label "Por definir (sin complemento de pago)"; also an incident). Other invoices: `formas = formaPago === null ? [] : [formaPago]`. Labels come from `catalogs.ts`; unknown code renders `Forma de pago {código}` (UI-SPEC). Sample: 7 PPD resolve to `04` (Tarjeta de crédito), 1 stays unresolved.

### Pattern 5: Pure selectors shared by every view (FILT-05)

```
applyFilters(entries, { from, to, suppliers, formas })  // month ∈ [from,to]; supplier empty=all; formas: entry.formas ∩ selected ≠ ∅
kpis(visible, prevVisible, range, mode) -> { gasto, facturas, notas, ticket|null, promedio, months, deltas }
monthlySeries(visible, range, mode)     -> one point per calendar month of range, zero-filled
supplierRanking(visible, mode)          -> per RFC: net, facturas, ticket|null, pct|null; sorted net desc, ties by es collation
invoiceRows(visible, mode)              -> every visible entry (counted or not) with display-ready fields
```
- Supplier identity = emisor RFC; display name = most frequent `nombre` among that RFC's invoices, else RFC (sample: 39 RFCs, no conflicts). Group with `Map` (never object keys: supplier-controlled strings such as `__proto__`).
- Previous period (D-20): same length in months immediately before `from`, same supplier/forma filters (CONTEXT discretion, UI-SPEC). Delta is `null` when the prior value is ≤ 0 or has no counted invoices ("Sin datos del periodo anterior"); otherwise `(cur − prev) / prev` as `Big`.
- `promedio = gasto / monthsInRange(from,to).length` (DASH-06). `ticket = gasto / facturas`, `null` when `facturas === 0`.
- Filter option counts (D-14, UI-SPEC default) are over **all loaded invoices**, independent of the other filters and of exclusions.
- Quality incidents are computed over the **unfiltered** ledger (UI-SPEC: tab counter = rows across the 8 types).
- Default range (D-12, UI-SPEC decision 11): `range === null` means "first to last loaded month"; `applyBatch` that adds invoices sets it back to `null`; explicit ranges equal to the span normalize to `null`. Span = min/max `month` over **all loaded entries** (Open Question 7).

### Pattern 6: Quality incidents (CAL-01, D-31, D-32)

| Type | Derivation | Changes amounts (D-04 alert) |
|------|-----------|------------------------------|
| NC sin factura relacionada | kind `nota-credito` with no loaded related invoice | yes |
| Sustituciones | invoice with a `relacionados` group `tipoRelacion === "04"`; text depends on whether each target is loaded | yes only when an original is loaded (applied) |
| Facturas en $0 | `noSuma === "cero"` for kinds I/E | no |
| Diferencias de redondeo | kinds I/E: `|Total − (SubTotal − Descuento + TotalImpuestosTrasladados − TotalImpuestosRetenidos)| > 0.01` **or** `|Σ concepto.importe − SubTotal| > 0.01` (strictly greater, in the invoice's own currency) | no |
| PPD sin complemento | `formas = [PPD_SIN_COMPLEMENTO]` | no |
| Moneda sin tipo de cambio | `noSuma === "moneda-sin-tc"` | yes |
| Excluidas | `exclusion === "manual"` | no |
| Sustituidas | `exclusion === "sustituida"` | (covered by Sustituciones) |
| Duplicados / Archivos con error | counts from `state.duplicates.length` / `state.rejected.length`, link only | n/a |

Tab counter = Σ rows of the 8 types (UI-SPEC default). A substitution pair therefore adds two rows (one in *Sustituciones*, one in *Sustituidas*).

**TipoRelacion semantics (research flag):** in CFDI 4.0 the node `CfdiRelacionados` lives in the **document being issued** and points back at earlier CFDI(s) ("la relación que existe entre esta Factura que se está generando y el o los CFDI previos"). For `04` (Sustitución de los CFDI previos) the new CFDI lists the UUID of the one it replaces, which is cancelled; hence the *original* is the one to auto-exclude, matching D-08 [CITED: facturama.mx/blog/formas-de-uso-de-los-cfdi-relacionados, MEDIUM, third-party]. For `07` (CFDI por aplicación de anticipo) the final Ingreso and the Egreso both reference the anticipo flow; one source says the Egreso references the anticipo CFDI but notes "algunas interpretaciones" reference the full-operation CFDI [CITED: siemprealdia.co/mexico/fiscal/emision-de-cfdi-de-ingreso-y-egreso-en-las-operaciones-con-anticipo, LOW-MEDIUM]. **In the real sample the E's reference a loaded Ingreso in the same month as the E**, i.e. the second interpretation or a same-month anticipo; either way REGLA-02 is a no-op on the sample. The official Anexo 20 guía de llenado could not be retrieved (SAT host refused the connection in this environment), so these semantics are not verified against the primary source.

### Pattern 7: Settings store with `persist` (D-06)

`src/stores/settingsStore.ts`: `create<SettingsState>()(persist(..., { name: "invoicechecker:settings", version: 1, partialize: (s) => ({ ivaMode: s.ivaMode }), skipHydration: true, storage, merge }))`. Facts verified in `node_modules/zustand/esm/middleware.mjs` (5.0.15):
- `setItem` runs **synchronously inside every `set`** (`set(...args); return setItem();`) so a storage that throws (quota, Safari private mode) throws out of the setter. Provide a custom `PersistStorage` that wraps `getItem`/`setItem`/`removeItem` in `try/catch`.
- `createJSONStorage(() => window.localStorage)` returns `undefined` if `window.localStorage` access throws or on the server; persist then only logs a warning on `set`. It is fine on the server, but the `merge`/storage must not assume it exists.
- When the stored `version` equals the current one, the stored state goes straight into `merge` **without migration** and the default merge is a shallow spread (no validation). Provide `merge: (persisted, current) => ({ ...current, ivaMode: parseIvaMode(persisted) })` with zod `safeParse` and fallback `"con"`.
- A corrupt JSON in `getItem` is caught by `toThenable(...).catch` and ends in `onRehydrateStorage`'s callback with the error; state stays at the default.
- Call `useSettingsStore.persist.rehydrate()` once from a component mounted from the start (e.g. `AppShell` effect), not from the IVA control itself, so the value is restored before the control ever paints.
- Add a test asserting that after excluding invoices and changing filters the only key written to `localStorage` is `invoicechecker:settings` and its `state` has exactly `ivaMode` (D-30, privacy).

### Pattern 8: App-owned UI state for tabs and "Ver factura"

Active tab, and a one-shot "focus this invoice" request (`{ uuid, nonce }`), are small pieces of cross-component state (Calidad rows, D-04 alert, Importación links all switch tabs). Keep them in a tiny store (e.g. `uiStore`, memory) or in `sessionStore`; reset in `clearAll`. The Dashboard table consumes the request in an effect after render: compute the invoice's index in the **sorted, filtered** row model, set `pageIndex = floor(index / 50)`, open its expansion, `scrollIntoView({ block: "center" })`, focus the chevron. If the uuid is not in the filtered rows, show the UI-SPEC Alert and change nothing. After a batch finishes (`useImport` after `applyBatch`): `added > 0` → reset range to `null`; active tab → Dashboard if the session now has ≥ 1 invoice, else Importación (UI-SPEC; Open Question 11 for the "batch added nothing but session non-empty" case).

### Testing approach (DEV-03; Validation Architecture section omitted because `workflow.nyquist_validation` is `false`)

- **Pure unit tests** next to the code, default `node` environment (no jsdom needed for the accounting layer: it consumes `ParsedInvoice`, not XML). A small helper builds `ParsedInvoice` objects; **plus** a thin integration layer that runs `parseCfdi` (jsdom) on fixtures and feeds `buildLedger`, which is what DEV-03 literally asks ("reglas de montos usando XML anonimizados").
- **Fixtures to create** (privacy guard `tests/fixtures.guard.test.ts` forbids real Rfc/Nombre/UUID/IdDocumento/certificates in `tests/` and `e2e/`; it is skipped where `Facturas/` is absent):
  - Real-structure, anonymized with `node scripts/anonymize-fixture.mjs <in.xml> <out.xml>` (whitelist-based, deterministic UUID mapping so cross references between files survive): one IEPS invoice (Telmex-style or high-calorie), one PPD invoice + its Pago complement (join by `IdDocumento`), one E + the related I, one `04` invoice. Existing anon fixtures cover descuento, E (07) and P only; no existing fixture has IEPS, PPD, `04`, a boundary hour, or a foreign currency [VERIFIED: grep of `tests/fixtures`].
  - Synthetic via `tests/support/cfdiVariants.ts` helpers (`withTipo`, `withUuid`, `withVersion`, ...) extended with `withFecha`, `withMoneda`, `withTipoCambio`: boundary hour (`2025-08-31T21:20:35` must land in `2025-08`), USD with `TipoCambio="18.2"` and USD without it, E dated in a month different from its related I, PPD without complemento, Total 0.
  - Run boundary tests under `TZ=UTC` and a Mexico City / far-east offset (a `Date`-free implementation is TZ-independent; assert it).
- **Exactness test:** `0.1 + 0.2` sums, a 400-invoice synthetic sum compared with a `BigInt`-cents reference, and "toggle mode never changes counts".
- **Optional real-data test** (`describe.skipIf(!hasSample)`, like `parseCfdi.realdata.test.ts`): assert **identities and counts**, never hard-coded amounts (financial data), e.g. `Σ counted (con IVA) == Σ I.Total(Total>0) − Σ E.Total` computed independently with a naive loop; 121 counting invoices; 0 rounding incidents; 8 PPD of which 7 resolved.
- **Components:** jsdom opt-in per file. Do **not** render Recharts in jsdom (`ResponsiveContainer` measures 0×0): unit-test `monthlySeries` and a small adapter; cover the chart visually in UAT/Playwright. Keep component tests to filters, the IVA toggle, exclusion + undo, expand, "Ver factura" and the Calidad counters.

### Anti-Patterns to Avoid
- **Recomputing amounts per mode in the UI:** compute both in the ledger; the toggle selects an accessor.
- **Selecting derived arrays/objects inside a zustand selector** (Pitfall 4): derive with `useMemo` from primitives/stable references.
- **`new Date(fecha)` anywhere in `src/domain/accounting` or the formatters** (Pitfall 11). Consider a lint rule (`no-restricted-globals`/`no-restricted-syntax` for `Date`) scoped to that folder.
- **Summing concept amounts to get invoice totals:** the invoice governs; concepts only explain.
- **Keying anything by supplier name** or using plain objects keyed by RFC/UUID/name: use `Map`/`Set`.
- **Persisting anything except `ivaMode`.**
- **Building a custom multi-select, chart, toast or focus-trap:** use the approved primitives.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal money math | `Number` arithmetic, cents-as-int with `Math.round` | big.js 7.0.1 with `Big.strict = true`, `Big.RM = Big.roundHalfUp` | Float drift; concept amounts have up to 6 decimals; strict mode makes accidental float use throw |
| Money/percent display | Per-call `toFixed`/`toLocaleString` | One `formatMoney(Big)` in `src/lib/format.ts` using `Intl.NumberFormat("es-MX")` fed with `toMoneyString()` output (decimal **string**) | Intl accepts exact decimal strings; handles negative-zero, U+2212 minus, grouping |
| Bar chart + tooltip + a11y | SVG/canvas by hand | Recharts 3.8.0 via shadcn `ChartContainer` (`accessibilityLayer` defaults to `true`) | Keyboard/screen-reader layer comes free |
| Table sort/pagination | Own sorting/paging | TanStack Table v9 `rowSortingFeature` + `rowPaginationFeature` (pattern already in `InvoiceTable`) | Existing, tested pattern |
| Searchable multi-select | Own listbox | shadcn `Command` (cmdk) + `Checkbox` inside `Popover`, `ScrollArea` | Keyboard model, focus, ARIA |
| Segmented control | Two buttons with manual state | Base UI `ToggleGroup` (shadcn `toggle-group`) | `aria-pressed`, roving focus |
| Toast with undo | Own toast | Sonner `toast(..., { action })` | Already installed and mounted |
| Persisted store validation | Hand `JSON.parse` in effects | zustand `persist` + custom storage + zod `merge` | Versioning/migration hook already designed (D-06) |
| UUID normalization | New regex | Reuse the parser output (already trim+uppercase) | `relacionados[].uuids`, `doctos[].idDocumento` are normalized |
| Spanish month names | `Intl.DateTimeFormat`/date-fns | Static arrays (`ene..dic`, `enero..diciembre`) | UI-SPEC: no date library, no ICU drift, no timezone path |
| SAT catalogs | Network fetch | Static constants `catalogs.ts` (22 formas de pago) | Offline, deterministic |

**Key insight:** the hard part of this phase is not the libraries but keeping one definition of "counts" and "amount" in one pure layer, so the KPIs, trend, ranking, table, Calidad panel and (Phase 3) Excel can never disagree.

## Common Pitfalls

### Pitfall 1: `Big.strict` rejects numbers, `0`, `valueOf`, comparison operators and default sort
**What goes wrong:** with `Big.strict = true`, `new Big(0)` and `new Big(0.1)` throw `[big.js] Invalid value`; `Number(big)`, `big < other`, `+big` and TanStack's `sortFn_basic` throw `[big.js] valueOf disallowed`. A table column whose accessor returns a `Big` crashes on first sort.
**Why:** strict mode is exactly the guard we want against accidental float use. [VERIFIED: ran big.js 7.0.1 on Node 24.14.0: `new Big(0.1)` → "Invalid value"; `Number(new Big('1'))` → "valueOf disallowed"]
**How to avoid:** construct only from strings (`new Big("0")`, module constant `ZERO`); compare with `.cmp/.eq/.gt/.lt`; give TanStack a custom `sortFn` built with `constructSortFn` that uses `.cmp`, or sort rows by a pre-extracted display string/number; use `.toString()`/`.toFixed()` for output. Keep the `Big.strict = true` side effect in `decimal.ts` only.
**Warning signs:** "valueOf disallowed" in the console on sort; "Invalid value" at module init.

### Pitfall 2: Negative zero prints as `-$0.00`
**What goes wrong:** a net of `-0.001` or the string `"-0.00"` formats as `-$0.00` in es-MX. [VERIFIED: `Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format("-0.00")` → `-$0.00`; `new Big("-0.001").toFixed(2)` → `-0.00`]
**How to avoid:** the single money formatter first rounds with `Big.round(2, Big.roundHalfUp)` and maps any zero to `"0.00"`, then applies the U+2212 minus replacement UI-SPEC requires (`Intl` emits a hyphen-minus).

### Pitfall 3: Hostile or damaged numeric attributes crash the dashboard
**What goes wrong:** the parser stores `SubTotal`, `Total`, `TipoCambio`, `Descuento`, concept `Importe`, ... as raw strings with no numeric check. `new Big("abc")` or `"1e999999"` throws inside a render and unmounts the whole React tree (single bad file = white screen). `Fecha` is also unvalidated (parseCfdi.ts:132, 145), so `slice(0,7)` of garbage becomes a bogus month key.
**How to avoid:** (preferred) harden `parseCfdi` to reject invalid money/`Fecha` as `malformed` with `detail: "invalid:<Attr>"` so it lands in "Archivos con error"; and always read decimals through `parseDecimal` (regex `^-?\d{1,18}(\.\d{1,12})?$`, no exponents) that returns `null` instead of throwing. Open Question 2.

### Pitfall 4: zustand v5 selectors that return new references loop forever
**What goes wrong:** `useSessionStore((s) => buildLedger(s.invoices))` or `useStore((s) => ({ a: s.a, b: s.b }))` returns a new value each call → "getSnapshot should be cached"/infinite re-render in zustand 5.
**How to avoid:** select primitives or stable slices (`s.invoices`, `s.excluded`, `s.filters`) and derive with `useMemo`; for object slices use `useShallow`. Treat `excluded`/`restored`/filter sets as immutable (replace, never mutate).

### Pitfall 5: `persist` footguns (see Pattern 7)
Throwing `setItem`, unvalidated same-version merge, `window.localStorage` access at import on the server, forgetting `rehydrate()`. Also: the rehydrate must run before the control shows, but the control only renders after invoices load, so call it from `AppShell` at mount.

### Pitfall 6: Base UI `ToggleGroup` can end up empty
`ToggleGroup` is array-valued (`value?: readonly Value[]`, `onValueChange?: (groupValue: Value[], ...)`) and pressing the active item yields `[]` [VERIFIED: node_modules/@base-ui/react/toggle-group/ToggleGroup.d.ts]. The IVA group must ignore empty arrays (UI-SPEC: "cannot be left with none selected") and map `["con"]`/`["sin"]` to the mode.

### Pitfall 7: cmdk reorders and filters on its own
cmdk's built-in filter scores and re-sorts items while typing, which breaks UI-SPEC ("sorted by count descending then name; checked rows do not jump"). Use `shouldFilter={false}` and filter yourself with accent-insensitive matching (`normalize("NFD")` + strip combining marks, lowercase), keep order from the data, and close over the item key in `onSelect` instead of trusting the `value` argument. [ASSUMED: cmdk 1.1.1 behavior from training knowledge; not run in this session.]

### Pitfall 8: Base UI `Select` shows the raw value without `items`
`Select.Root` accepts `items` (`Record<string, ReactNode>` or `ReadonlyArray<{ value, label }>`) so the trigger can render the selected label before the popup mounts [VERIFIED: select/root/SelectRoot.d.ts:101-114]. Pass `items` for the Desde/Hasta month selects (labels "ene 2025"), otherwise the trigger may display `2025-01`.

### Pitfall 9: shadcn `chart` specifics
- `ChartTooltipContent` renders numbers with `item.value.toLocaleString()` (browser locale, not MXN) [VERIFIED: registry source]. Pass a `formatter` (or build the tooltip content) that uses the shared es-MX formatter and the UI-SPEC title "mayo 2025".
- `ChartContainer` defaults to `aspect-video`; UI-SPEC needs `aspect-auto h-72`.
- `ChartStyle` injects an inline `<style>` via `dangerouslySetInnerHTML`; allowed by CSP (`style-src 'unsafe-inline'`) and safe only because the config is static. **Never build `ChartConfig` keys or colors from XML data.**
- `Cell` is deprecated and slated for removal in Recharts 4.0 [VERIFIED: recharts 3.8.0 types/component/Cell.d.ts:15]; use `<Bar activeBar={{ fill: "var(--primary)" }} />` for the hover/focus highlight [VERIFIED: types/cartesian/Bar.d.ts:140-145], and `isAnimationActive={false}` (type `boolean | 'auto'`).
- `accessibilityLayer` defaults to `true` in v3 [VERIFIED: types/util/types.d.ts:1196-1198] (UI-SPEC's explicit "on" is satisfied; passing it is harmless).
- Recharts needs `react-is` as a peer (see audit).

### Pitfall 10: Intl percent and compact output differ from the UI-SPEC examples
`Intl.NumberFormat("es-MX", { style: "percent", min/maxFractionDigits: 1 })` prints `12.4%` (no space) and compact prints `1.2 M` [VERIFIED: Node 24.14.0, ICU 78.2, CLDR 48.0]. UI-SPEC writes "12.4 %" and describes it as coming from `Intl`. Browser ICU may differ from Node. Compose the percent text yourself (`{decimal} %` with the decimal from `Intl`) so the copy contract holds regardless of ICU (Open Question 6). Use only `Intl` for the number part; keep `tabular-nums`.

### Pitfall 11: Month/date logic must not touch `Date`
`Fecha` is local wall-clock without zone (8 sample invoices fall within 6 h of a month change). Month key = `fecha.slice(0,7)` after a format check; month arithmetic on `year*12 + (month-1)`; labels from static arrays; shortcuts anchor on the last loaded month, not "today". Besides correctness, `new Date()`/`Date.now()` during prerender is restricted under `cacheComponents: true`; the dashboard renders only after files are dropped, but keeping `Date` out removes the class of problem. [VERIFIED: ran the helper in Code Examples: `2025-08-31T21:20:35` → `2025-08`; previous period of 2025-07..2025-12 → 2025-01..2025-06]

### Pitfall 12: Sub-cent drift between layers
Concept-level amounts carry up to 6 decimals; invoice-level are rounded to 2. Measured: IVA concept-vs-invoice mismatch in 38 invoices (max 0.004832), `Σ Importe vs SubTotal` in 26 (max 0.004828). Consequences: (a) compute IEPS and `Total` from invoice-level data; (b) D-09's "> $0.01" produces no sample incidents, which is correct; (c) the in-panel "Diferencia de redondeo" must compare **rounded** values or it will print "$0.00" lines; (d) category/product sums in Phase 3 will need the same convention.

### Pitfall 13: The sample cannot prove REGLA-02, -07 or -08
All three E's relate to a loaded I in the same month, there is no foreign currency, no retenciones, no Exento, and exclusion is purely UI. Plans must include synthetic fixtures and explicit tests; a green real-data run says nothing about these rules.

### Pitfall 14: Exclusion edge cases to decide explicitly
Excluding a prepaid I while its E stays counted yields a negative month (by design: manual). Excluding the substituting invoice leaves the substituted original auto-excluded unless the user clicks "Volver a incluir" (literal D-08; Open Question 9). A row can be both manually excluded and substituted: define one action "Volver a incluir" that clears the manual flag and adds the uuid to `restored`.

### Pitfall 15: Ranking percentage and bar guards
`% del total` with `total ≤ 0` and `abs(net)/max(abs(net))` with `max = 0` divide by zero; `Big.div` throws `[big.js] Division by zero`. Guard both and render "—".

### Pitfall 16: shadcn `add` may touch existing files
`command` depends on `dialog` and `input-group`, already installed. Review `git diff --stat src/components/ui` after the add; revert anything that is not an addition. Verify lucide icon names after install (UI-SPEC note).

### Pitfall 17: React-hooks lint rules in eslint-config-next 16.4
`react-hooks` 7.x rules (e.g. synchronous `setState` in effects) can flag the "Ver factura" pagination jump. Use the derived-state-during-render pattern already used in `InvoiceTable` (conditional `setPagination` during render, InvoiceTable.tsx:127-129), event handlers for user actions, and effects only for DOM work (scroll/focus).

## Code Examples

All snippets compile under the project's strict settings (`strict`, `noUncheckedIndexedAccess`, TS 6.0.3) — `decimal.ts`/`months.ts` were compiled and executed in a scratch project; the rest is illustrative.

### `src/domain/accounting/decimal.ts`
```typescript
// Source: big.js 7.0.1 behavior verified by running it (Node 24.14.0)
import Big from "big.js";

Big.strict = true; // numbers/valueOf throw: no accidental float math
Big.DP = 20; // division precision (only averages and percentages divide)
Big.RM = Big.roundHalfUp;

const DECIMAL_RE = /^-?\d{1,18}(\.\d{1,12})?$/; // no exponents, bounded length
export const ZERO = new Big("0");

/** Exact XML decimal -> Big. null for null/empty/junk; never throws. */
export function parseDecimal(raw: string | null): Big | null {
  if (raw === null) return null;
  const text = raw.trim();
  return DECIMAL_RE.test(text) ? new Big(text) : null;
}

export function sum(values: Iterable<Big>): Big {
  let total = ZERO;
  for (const value of values) total = total.plus(value);
  return total;
}

/** Display string "1234.50": half-up, 2 dp, never "-0.00". Feed this string to Intl. */
export function toMoneyString(value: Big): string {
  const rounded = value.round(2, Big.roundHalfUp);
  return rounded.eq(ZERO) ? "0.00" : rounded.toFixed(2);
}
```

### `src/domain/accounting/months.ts` (no `Date`)
```typescript
export type MonthKey = string; // "YYYY-MM"
const FECHA_RE = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}T/;

export function monthOfFecha(fecha: string): MonthKey | null {
  const match = FECHA_RE.exec(fecha);
  if (match === null) return null;
  const [, year, month] = match;
  return year === undefined || month === undefined ? null : `${year}-${month}`;
}
function monthIndex(key: MonthKey): number {
  const [y, m] = key.split("-");
  return Number(y) * 12 + (Number(m) - 1);
}
function monthFromIndex(i: number): MonthKey {
  return `${String(Math.floor(i / 12)).padStart(4, "0")}-${String((i % 12) + 1).padStart(2, "0")}`;
}
export function monthsInRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let i = monthIndex(from); i <= monthIndex(to); i += 1) out.push(monthFromIndex(i));
  return out;
}
/** Same number of months immediately before `from` (D-20). */
export function previousPeriod(from: MonthKey, to: MonthKey): { from: MonthKey; to: MonthKey } {
  const n = monthIndex(to) - monthIndex(from) + 1;
  return { from: monthFromIndex(monthIndex(from) - n), to: monthFromIndex(monthIndex(from) - 1) };
}
```

### Invoice amounts (illustrative)
```typescript
import type { ParsedInvoice } from "../cfdi/types";
import { ZERO, parseDecimal } from "./decimal";
import type Big from "big.js";

export interface InvoiceAmounts { conIva: Big; sinIva: Big }
export type AmountResult =
  | { ok: true; amounts: InvoiceAmounts }
  | { ok: false; reason: "moneda-sin-tc" | "invalido" };

export function invoiceAmounts(inv: ParsedInvoice, ieps: Big): AmountResult {
  const total = parseDecimal(inv.total);
  const subTotal = parseDecimal(inv.subTotal);
  if (total === null || subTotal === null) return { ok: false, reason: "invalido" };
  const descuento = parseDecimal(inv.descuento) ?? ZERO;
  let fx = parseDecimal("1");
  if (inv.moneda !== "MXN") {
    const tc = parseDecimal(inv.tipoCambio);
    if (tc === null || tc.lte(ZERO)) return { ok: false, reason: "moneda-sin-tc" };
    fx = tc;
  }
  const sign = inv.tipo === "E" ? parseDecimal("-1") : parseDecimal("1");
  if (fx === null || sign === null) return { ok: false, reason: "invalido" };
  const factor = fx.times(sign);
  return {
    ok: true,
    amounts: {
      conIva: total.times(factor),
      sinIva: subTotal.minus(descuento).plus(ieps).times(factor),
    },
  };
}
```

### Persisted settings store (illustrative)
```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { z } from "zod";

const IvaMode = z.enum(["con", "sin"]);
export type IvaMode = z.infer<typeof IvaMode>;
interface SettingsState { ivaMode: IvaMode; setIvaMode: (m: IvaMode) => void }
type Persisted = { ivaMode: IvaMode };

const safeStorage: PersistStorage<Persisted> = {
  getItem: (name) => {
    try {
      const raw = window.localStorage.getItem(name);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      return parsed as StorageValue<Persisted>; // shape re-validated in `merge`
    } catch { return null; }
  },
  setItem: (name, value) => { try { window.localStorage.setItem(name, JSON.stringify(value)); } catch { /* quota / blocked */ } },
  removeItem: (name) => { try { window.localStorage.removeItem(name); } catch { /* blocked */ } },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({ ivaMode: "con", setIvaMode: (ivaMode) => set({ ivaMode }) }),
    {
      name: "invoicechecker:settings",
      version: 1,
      skipHydration: true,
      storage: safeStorage,
      partialize: (s): Persisted => ({ ivaMode: s.ivaMode }),
      merge: (persisted, current) => {
        const parsed = z.object({ ivaMode: IvaMode }).safeParse(persisted);
        return { ...current, ivaMode: parsed.success ? parsed.data.ivaMode : "con" };
      },
    },
  ),
);
```
(The single `as` above is justified: it is immediately re-validated by zod in `merge`; per CLAUDE.md rule 2 it needs the justifying comment on the same/previous line — the comment is present. If the planner prefers zero `as`, type `getItem` to return `unknown`-parsed data via a zod schema for `StorageValue` instead.)

### c_FormaPago catalog (static, `src/domain/cfdi/catalogs.ts`)
```typescript
// Source: phpcfdi/resources-sat-catalogs database/data/cfdi_40_formas_pago.sql (22 rows), mirror of the SAT catCFDI
export const FORMA_PAGO: Readonly<Record<string, string>> = {
  "01": "Efectivo", "02": "Cheque nominativo", "03": "Transferencia electrónica de fondos",
  "04": "Tarjeta de crédito", "05": "Monedero electrónico", "06": "Dinero electrónico",
  "08": "Vales de despensa", "12": "Dación en pago", "13": "Pago por subrogación",
  "14": "Pago por consignación", "15": "Condonación", "17": "Compensación", "23": "Novación",
  "24": "Confusión", "25": "Remisión de deuda", "26": "Prescripción o caducidad",
  "27": "A satisfacción del acreedor", "28": "Tarjeta de débito", "29": "Tarjeta de servicios",
  "30": "Aplicación de anticipos", "31": "Intermediario pagos", "99": "Por definir",
};
```
Look up with `Object.hasOwn(FORMA_PAGO, code)` (codes come from XML) and fall back to `Forma de pago ${code}`.

### Shared tooltip money formatter for shadcn chart
```typescript
<ChartTooltip
  content={
    <ChartTooltipContent
      labelFormatter={(_label, payload) => monthLongLabel(payload[0]?.payload?.month)}
      formatter={(value) => <span className="font-medium tabular-nums">{formatMoneyFromString(String(value))}</span>}
    />
  }
/>
```
Feed the chart numeric points only for **plotting**; keep the exact `Big`/string in the datum for the tooltip text (`value` for plotting may be `Number(toMoneyString(x))`, which is the one place a float is acceptable: chart geometry, not accounting).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts `Cell` per-bar styling | `Bar activeBar`/`shape` | Recharts 3.x (`Cell` deprecated, removal in 4.0) | Use `activeBar` for the hover/focus highlight |
| Recharts `accessibilityLayer` opt-in | on by default | Recharts 3 | No extra prop needed |
| `Intl.NumberFormat` numbers only | accepts exact decimal strings (NumberFormat v3) | ES2023; works in Node 24 | Format `Big` output without converting to float |
| zustand `persist` auto-hydrate | `skipHydration` + manual `rehydrate()` for SSR | zustand 4/5 | Required for the Next App Router shell |
| shadcn Radix style | Base UI default `base-nova` | shadcn 4.x (2026-07) | Components are `@base-ui/react` wrappers (Tabs, Menu, ToggleGroup) |
| Integer centavos (STACK.md) | big.js strings | PROJECT.md key decision | `.claude/CLAUDE.md` advice is superseded |

**Deprecated/outdated:** `recharts` `Cell`; `.claude/CLAUDE.md` "integer centavos"; `PITFALLS.md` advice to persist exclusions by UUID (user decided session-only, D-30); `PITFALLS.md` statement "26 of 136 concept sums differ from SubTotal" is true only at exact equality (max drift 0.0048), `ARCHITECTURE.md` "143/143 equal" is true at cent precision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | cmdk 1.1.1 re-sorts/filters internally unless `shouldFilter={false}` and `onSelect`'s `value` argument should not be relied on | Pitfall 7 | Filter popover order flickers or selection maps to the wrong supplier; caught by the 60+ supplier backstop test |
| A2 | Browser ICU (Chrome/Safari/Firefox) formats `es-MX` percent without a space like Node 24 ICU 78.2 | Pitfall 10 | Cosmetic; mitigated by composing the percent text manually |
| A3 | `react-is@19.3.0` is a safe pin (published 2026-09-09, 5 weeks before 19.3.1) | Standard Stack | If 19.3.0 were bad, recharts could break; low risk, human-verify checkpoint covers it |
| A4 | Concept-level IEPS sums may differ from invoice-level in data outside the sample (the sample matches in all 9) | Pattern 2 | If wrong, concept-level fallback would be fine; if right and parser is not extended, "sin IVA" could be off by sub-cent |
| A5 | Recharts rounds bar `radius` correctly for negative bars (sample has no negative month) | UI notes | Cosmetic corner on a negative bar; verify in UAT with a synthetic negative month |
| A6 | `Big.strict` + `Intl.NumberFormat.format(string)` behave the same in Safari/Firefox as in Node | Code Examples | A browser without NumberFormat v3 string support would round via float for huge amounts; all current evergreen browsers support it, not verified in this session |
| A7 | TipoRelacion `04`: the substituting CFDI lists the cancelled original (cancellation motive 01) | Pattern 6 | If reversed, D-08 would exclude the wrong invoice; sample's single `04` has an unloaded target so cannot disprove it. Sources are third-party (LOW-MEDIUM) |
| A8 | The official SAT catalog labels equal the phpcfdi mirror (fetched through a summarizing tool) | Code Examples | A label typo would show in filters; the 7 codes present in the sample match UI-SPEC wording |

## Open Questions (RESOLVED)

**Resolved 2026-10-14 by the user** in 02-CONTEXT.md: 1→D-34 (refined by D-46), 2→D-35 (load but do not sum; refined by D-47), 3→D-36, 4→D-37, 5→D-39, 6→D-40, 7→D-41, 8→D-38, 9→D-42, 10→D-43, 11→D-44, 12→D-45. Where a decision differs from the recommendation below (item 2), CONTEXT governs.

Per CLAUDE.md rule 1, none of these was decided in this research; each had a recommendation. Items 1-4 and 8 can change numbers; the rest are presentation or edge cases.

1. **RESOLVED (D-34): Credit note with several loaded related invoices in different months: which month?**
   - Known: REGLA-02 says "mes de la factura relacionada"; every sample E has exactly 1 relation and it shares the E's month.
   - Options: (a) earliest `fecha` among loaded related invoices; (b) first listed UUID; (c) split proportionally (rejected: complex).
   - Recommendation: (a), deterministic and documented in the Calidad row text.
2. **RESOLVED (D-35): Reject invoices whose money attributes or `Fecha` are not valid decimals/ISO at parse time?**
   - Known: parser keeps raw strings (Pitfall 3); `big.js` would throw in render.
   - Options: (a) harden `parseCfdi` → `malformed` with `detail: "invalid:<Attr>"`, reported in "Archivos con error" (touches Phase 1 code and its tests); (b) accounting layer treats them as `noSuma: "invalido"` and adds a new incident type (not in D-32).
   - Recommendation: (a).
3. **RESOLVED (D-36): Capture invoice-level `Impuestos/Traslados` and `Retenciones` in `ParsedInvoice`?**
   - Known: only `totalImpuestosTrasladados/Retenidos` and concept-level lists exist; concept vs invoice IVA drifts in 38 invoices.
   - Options: (a) add an additive field (no Phase 1 behavior change) and take IEPS from it; (b) sum concept-level `003`.
   - Recommendation: (a); (b) as documented fallback.
4. **RESOLVED (D-37): Definition of "$0" (REGLA-06, D-18):** by converted `Total` only (mode-independent) vs "the amount of the active mode". Recommendation: `Total` only, so the Facturas count never changes with the toggle.
5. **RESOLVED (D-39): Ticket promedio when there are no counted invoices (only credit notes or empty):** show `—` (recommended) or `$0.00` muted (UI-SPEC says zero values render muted).
6. **RESOLVED (D-40): Percent text:** UI-SPEC shows "12.4 %" with a space, `Intl` prints "12.4%". Recommendation: follow the UI-SPEC text by composing `"{n} %"`.
7. **RESOLVED (D-41): Default date span source:** min/max imputation month over **all loaded entries** (includes P/T/N, $0 and excluded) vs only counted ones. Recommendation: all loaded (matches D-12 "facturas cargadas", is stable under exclusions).
8. **RESOLVED (D-38): Concept "con IVA" with retenciones (D-25 says "+ IVA trasladado"):** literal (importe − descuento + IEPS + IVA) vs tie-to-Total (importe − descuento + Σ traslados − Σ retenciones). No retenciones in the sample, so no visible difference today. Recommendation: tie-to-Total, so concept sums reconcile with the invoice `Total` identity.
9. **RESOLVED (D-42): Substituting invoice excluded or itself $0:** keep the original "Sustituida" (literal D-08, recommended) vs release it. Needs a decision only if the user expects automatic release.
10. **RESOLVED (D-43): Supplier identity:** RFC (recommended; 39 RFCs, no name conflicts in the sample) vs displayed name.
11. **RESOLVED (D-44): Batch that adds nothing but the session already has invoices (all duplicates):** open Dashboard (recommended: any finished batch → Dashboard unless the session has zero invoices) vs stay on the current tab.
12. **RESOLVED (D-45): Official verification of SAT catalogs and TipoRelacion semantics:** the SAT host (`omawww.sat.gob.mx`) refused the connection, so labels and semantics rest on a mirror and blogs. Recommendation: accept for v1; if the owner or accountant wants primary-source confirmation, check the `catCFDI` workbook and the Anexo 20 guía de llenado once from a networked machine.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | ✓ | v24.14.0 | — |
| pnpm | install | ✓ | 11.5.2 (matches `packageManager`) | — |
| npm registry | new packages | ✓ | `npm view` works | — |
| shadcn CLI (local) | add components | ✓ | 4.21.4 (`node_modules/.bin/shadcn`; `view @shadcn/<name>` fetched the registry) | — |
| Real sample `Facturas/2025/` | optional real-data test, fixture anonymization | ✓ locally (143 XML), absent on Vercel/CI | — | Tests `skipIf(!hasSample)` |
| Python 3 (analysis only) | not required by the project | ✓ | — | Node scripts |
| Playwright Chrome | optional e2e/UAT of chart rendering | present from Phase 1 (`e2e/smoke.spec.ts`) | 1.64.0 | Manual UAT |
| SAT host `omawww.sat.gob.mx` | primary-source catalog check | ✗ | ECONNREFUSED | phpcfdi mirror (used), blogs |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** SAT official catalog host (see Open Question 12).

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high). Phase 2 adds no endpoint, no secret and no network call; the surface is untrusted XML values reaching the UI and one `localStorage` key.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged Phase 1 gate) | — |
| V3 Session Management | no (unchanged) | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes** | `parseDecimal` regex guard / parser hardening for XML numerics and `Fecha`; zod `safeParse` for the persisted `ivaMode`; React text rendering for all XML strings |
| V6 Cryptography | no | — |
| V8 Data Protection | **yes** | Only `ivaMode` persisted; exclusions and filters memory-only (D-30); test asserts `localStorage` contents |
| V14 Configuration | yes (unchanged) | CSP `connect-src 'self'` and `frame-ancestors 'none'` stay (next.config.ts:12-15); no new origins (Recharts/shadcn are bundled, no CDN) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Damaged/hostile XML numeric attribute makes `new Big()` throw during render (UI denial of service) | Denial of service | Reject at parse time or `parseDecimal` returning `null`; never call `new Big(raw)` on XML strings |
| Pathological digit strings or exponent notation (`1e999999`) consuming CPU/memory | Denial of service | Regex bounds (18 integer digits, 12 decimals, no exponent); existing 2 MB per-file cap |
| Supplier name/RFC used as an object key (`__proto__`, `constructor`) | Tampering | `Map`/`Set` for grouping and state; `Object.hasOwn` for catalog lookups (Phase 1 already does this for UUIDs) |
| Stored XSS via `Nombre`, `Descripcion`, `Folio` in tooltips/popovers/table | Tampering / Information disclosure | React text nodes only; no `dangerouslySetInnerHTML` except shadcn `ChartStyle` with a static config (never data-driven keys) |
| Tampered `localStorage` value for `ivaMode` | Tampering | zod validation in `merge`, fallback `"con"`; storage errors swallowed |
| Invoice data leaking to storage or network via new code | Information disclosure | No persistence beyond `ivaMode`; CSP `connect-src 'self'`; Phase 1 e2e that asserts zero XML in network requests still applies |
| Dependency supply chain (new packages) | Tampering | Legitimacy audit above; exact pins; human-verify for `react-is`; lockfile review |

## Sources

### Primary (HIGH confidence)
- Local source files read this session: `src/domain/cfdi/types.ts`, `parseCfdi.ts`, `src/domain/import/*`, `src/stores/sessionStore.ts`, `src/features/shell/*`, `src/features/invoices/*`, `src/features/report/*`, `src/lib/format.ts`, `src/lib/copy/*`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `package.json`, `tests/support/cfdiVariants.ts`, `tests/fixtures.guard.test.ts`, `scripts/anonymize-fixture.mjs`.
- Local analysis of `Facturas/2025/*.xml` (Python/ElementTree and Node; counts only, nothing identifying recorded).
- `node_modules/zustand/esm/middleware.mjs` and `middleware/persist.d.ts` (zustand 5.0.15): persist hydration, `setItem`, `merge`, `migrate` behavior.
- `node_modules/@base-ui/react` 1.9.0 type declarations: ToggleGroup, Select, Tabs.
- `node_modules/@tanstack/table-core@9.3.1` exports (`rowExpandingFeature`, `createExpandedRowModel`, `constructSortFn`, ...).
- shadcn registry via `node_modules/.bin/shadcn view @shadcn/{command,chart,toggle-group,tabs,select,dropdown-menu,popover,collapsible}` (base-nova sources, dependencies).
- `npm view` for big.js, @types/big.js, recharts@3.8.0, cmdk, react-is; recharts 3.8.0 tarball types (`Bar.d.ts`, `Cell.d.ts`, `types.d.ts`).
- Runtime experiments in a scratch project: big.js 7.0.1 strict/rounding behavior, `Intl.NumberFormat("es-MX")` outputs, TS 6.0.3 strict compile of the Code Examples helpers.
- `gsd-tools query package-legitimacy check` output (big.js, @types/big.js, recharts, cmdk OK; react-is SUS too-new).

### Secondary (MEDIUM confidence)
- c_FormaPago (22 rows) and c_TipoRelacion (7 rows) from `github.com/phpcfdi/resources-sat-catalogs` (`database/data/cfdi_40_formas_pago.sql`, `cfdi_40_tipos_relaciones.sql`), a mirror of the SAT catCFDI, fetched through a summarizing tool.
- Facturama, "Formas de uso de los CFDI relacionados": node semantics and TipoRelacion 04.
- Siempre al Día, "Emisión de CFDI de ingreso y egreso en las operaciones con anticipo": TipoRelacion 07 flow and the interpretation caveat.

### Tertiary (LOW confidence)
- cmdk filtering/`onSelect` behavior from training knowledge (A1); browser ICU percent formatting (A2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, packages verified in the registry and legitimacy seam; UI libraries are locked by UI-SPEC and read from registry sources.
- Architecture / rules engine: HIGH, the data model fits the existing parser output and every formula was checked against the sample (identities, IEPS, drift).
- Pitfalls: HIGH for big.js/Intl/zustand/Recharts items (executed or read in source); MEDIUM for cmdk/browser-ICU items (assumed).
- SAT semantics (TipoRelacion 04/07, official labels): MEDIUM-LOW, secondary sources only; sample data is consistent with the labels used in UI-SPEC.

**Research date:** 2026-10-14
**Valid until:** 2026-11-13 (stack pinned; revisit package versions if installation is delayed, and `react-is` once its brand-new release has aged)
