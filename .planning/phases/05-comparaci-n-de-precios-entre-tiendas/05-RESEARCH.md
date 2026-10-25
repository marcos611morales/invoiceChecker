# Phase 5: Comparación de precios entre tiendas - Research

**Researched:** 2026-10-25
**Domain:** Pure-domain unit normalization and price statistics over CFDI 4.0 concept lines (TypeScript, big.js), settings schema v3 to v4 plus backup file v3, one new tab (TanStack Table v9 + Recharts 3)
**Confidence:** HIGH for the unit and key tables and the in-repo integration points (read this session, measured on the real sample); MEDIUM for the size-reader coverage on future data and for the Recharts multi-series wiring (types read, not rendered)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Siguen vigentes las decisiones de las Fases 1–4 (01..04-CONTEXT.md). Las más relevantes aquí:
- Pestañas visibles solo con facturas cargadas (Fase 3 D-01, Fase 4 D-01).
- Monto por concepto según el modo IVA (Fase 2 D-25/D-38).
- Filas que «no suman» (Fase 2 D-27) y proveedor identificado por RFC (Fase 2 D-43).
- Tabla con fila desplegable, TanStack v9 (Fase 2 D-24).
- Aviso «Deshacer» (Fase 2 D-29, Fase 3 D-05).
- Store persistido versionado con `migrate` y zod, y archivo de respaldo como contrato publicado (Fase 3 D-06/D-07/D-30, Fase 4 D-13/D-31).
- Miembro de producto = RFC + descripción normalizada (Fase 4 D-09); un miembro pertenece a un solo producto (Fase 4 D-10).

#### Dónde y qué se compara
- **D-01:** Hay una **pestaña nueva «Precios»**, aparte de Productos. Productos sigue sirviendo para agrupar y revisar; Precios es para analizar. Como las demás pestañas, **solo se ve con facturas cargadas**.
- **D-02:** Aparecen **todos los productos aceptados que tengan compras** en el conjunto filtrado, aunque solo se hayan comprado en una tienda; así se ven su mínimo, mediana, último e historial. «Tienda más barata» y ahorro solo aplican con **2 o más tiendas**.
- **D-03:** **Todos los filtros globales aplican** (fechas, proveedor, forma de pago y categoría), como en el resto de la app (FILT-05). Filtrar por proveedor reduce las tiendas comparadas.
- **D-04:** El precio unitario **sigue el selector con IVA / sin IVA**: es el monto del concepto según el modo (Fase 2 D-25/D-38: importe − descuento, más impuestos en modo con IVA) dividido entre el contenido comprado (D-09). Es neto de descuento (PREC-01).
- **D-05:** Una **tienda es el proveedor (RFC)**: todas las sucursales de Walmart cuentan como una sola tienda. Se muestra el nombre del proveedor.
- **D-06:** Solo cuentan como compras las líneas de **facturas que suman** (Ingreso, sin excluir, sin sustituir, sin $0, sin Pagos ni las demás causas de «No suma»). Las **notas de crédito no cambian el precio unitario**.
- **D-07:** La vista principal es una **tabla de productos con fila desplegable**, con el mismo patrón que la tabla de facturas.
  - Fila: producto, tienda más barata, su precio normalizado, número de tiendas y ahorro estimado.
  - Al abrir la fila: una tabla por tienda (mínimo, mediana, último y número de compras, con la más barata resaltada), el historial (D-21) y la lista de compras (D-08).
  - Orden por defecto: **ahorro estimado de mayor a menor**, con los productos sin ahorro (una sola tienda) al final. Las columnas se ordenan con un clic.
  - Herramientas propias: un **buscador por nombre de producto** y una casilla **«Mostrar los no comparables»** (D-17). No hay casilla «Solo con 2+ tiendas».
- **D-08:** El detalle incluye la **lista de compras** de cada tienda: fecha, folio, descripción tal cual, cantidad del XML, contenido normalizado y precio unitario normalizado. Sirve para revisar un precio raro.

#### Unidades y presentaciones (PREC-02)
- **D-09:** El **contenido de cada compra** se obtiene así, en este orden de precedencia:
  1. **Corrección del usuario** para ese miembro (D-12).
  2. Si la **unidad SAT** (`ClaveUnidad`) es de peso o volumen (KGM, LTR y equivalentes que fije el research), se usa la **cantidad del XML**.
  3. Si la unidad es de pieza (H87, XUN, XPK, E48…), se usa la **cantidad × el tamaño leído de la descripción**. Ejemplos: «2KG», «375G», «1.730K», «5L»; los paquetes como «12/1L» y «12/355CC» se leen como 12 × 1 L y 12 × 355 mL.
  4. Si nada de lo anterior funciona, el contenido queda **sin tamaño**.

  Los patrones exactos de lectura los fija el research con las descripciones reales.
- **D-10:** Si **todas** las compras de un producto son piezas sin tamaño (p. ej. «HUEVO BLANCO» en dos tiendas), se compara **por pieza** con la etiqueta **«por pieza, sin tamaño verificado»**. Si alguna compra del producto sí tiene tamaño, las que no lo tienen quedan **«no normalizado»** y no entran en la comparación.
- **D-11:** El precio normalizado se muestra **por la unidad base de su familia**: **$/kg, $/L o $/pieza**. Gramos y mililitros se convierten a kg y L.
- **D-12:** **Familias mezcladas:** si las compras de un producto caen en familias distintas (kg y L, por ejemplo), se compara la **familia con más compras**. Las demás se marcan «no normalizado» en el detalle, **con su motivo**.
- **D-13:** El usuario **corrige o captura el contenido en el detalle del producto, en Precios**. Cada miembro (descripción · tienda) muestra su contenido detectado, en gris con «detectado», y se puede editar. Los miembros «no normalizado» piden el dato ahí mismo. La pestaña Productos no cambia.
- **D-14:** **Formato de captura:** contenido **por pieza** = número + unidad (g, kg, ml, L o piezas), con paquetes como «12 × 1 L». El contenido de cada compra es la cantidad del XML × el contenido por pieza. La captura **solo aplica a miembros cuya unidad SAT es de pieza**; los de KGM/LTR usan la cantidad del XML. Se puede quitar la corrección para volver a lo detectado.
- **D-15:** Las correcciones de contenido se guardan **por miembro** (RFC + descripción normalizada, Fase 4 D-09) en el **store de ajustes con una versión nueva** (v3 → v4 con `migrate`, que conserva todo lo de la v3) y en el **archivo de respaldo**. Los respaldos de versiones anteriores siguen siendo válidos al subirlos. Los límites de D-30 (Fase 3) se extienden; los números los fija el planner. — **Reversibility:** one-way — es el esquema de localStorage de los usuarios y el contrato publicado del archivo de respaldo.

#### Marca «no comparable» (PREC-03)
- **D-16:** El valor **por defecto** sale de la **clave SAT (`ClaveProdServ`)**. Se marcan no comparables los **combustibles (1510xxxx)** y los **segmentos de servicios del catálogo (70–94)**: telecomunicaciones, servicios financieros y comisiones, publicidad, mantenimiento, transporte, etc. El research afina la lista exacta con las claves reales (p. ej. 84111506 = comisiones/anuncios, 15101514 = gasolina). No depende de las categorías del usuario.
- **D-17:** Si los miembros de un producto tienen claves mixtas, por defecto el producto es **comparable si alguna de sus compras tiene clave de producto**. Solo es no comparable por defecto si **todas** sus compras tienen clave de servicio o combustible.
- **D-18:** El usuario cambia la marca **en Precios, por producto**, con un menú «⋯» en la fila: **«Marcar como no comparable»** y **«Volver a comparar»**, con aviso «Deshacer». Los no comparables están ocultos por defecto. Con la casilla «Mostrar los no comparables» aparecen atenuados y se les puede quitar la marca.
- **D-19:** Solo se guarda **lo que el usuario cambió respecto al valor por defecto**, por **id de producto**, en los ajustes v4 y en el archivo de respaldo (mismo cambio de versión que D-15). — **Reversibility:** one-way — forma parte del mismo esquema persistido y contrato de respaldo que D-15.

#### Ahorro estimado e historial (PREC-04, PREC-05, PREC-06)
- **D-20:** La **tienda más barata** es la de **menor mediana** de precio normalizado. Si hay empate, gana la de más compras. Una tienda con **una sola compra puede ser la más barata**; el número de compras siempre se ve junto al precio.
- **D-21:** **Ahorro estimado por producto:** por cada compra en otra tienda se calcula (precio normalizado pagado − **mediana de la tienda más barata**) × contenido comprado. Se suman **solo las diferencias positivas**. Siempre se etiqueta «estimado».
- **D-22:** Hay una **tarjeta «Ahorro estimado» arriba de la tabla** con el total, la etiqueta «estimado» y una nota que explica el cálculo. Suma solo productos comparables con 2 o más tiendas, dentro de los filtros.
- **D-23:** Los productos comparados **«por pieza, sin tamaño verificado»** (D-10) **sí entran** en el ahorro de su fila y en el total, con su aviso. La nota del total dice que incluye comparaciones por pieza.
- **D-24:** **Historial (PREC-06):** dentro del detalle del producto hay una **gráfica de puntos y líneas por tienda**. El eje X es la fecha y el eje Y el precio normalizado, con una serie de color por tienda y un punto por compra. Debajo va la lista de compras (D-08).

### Claude's Discretion
- Textos exactos de la pestaña, columnas, avisos, etiquetas («detectado», «no normalizado», «por pieza, sin tamaño verificado») y estados vacíos, más allá de los citados. El UI-SPEC de la fase puede afinarlos.
- El estado vacío de Precios cuando no hay productos agrupados (sugerido: invitar a ir a Productos → «Agrupar productos»).
- La posición de la pestaña Precios (sugerido: después de Productos).
- El cálculo de la mediana con un número par de compras y el redondeo, que solo se aplica al mostrar (big.js, REGLA-04).
- La lista exacta de `ClaveUnidad` por familia y los patrones de lectura de tamaño, según el research.
- El formato exacto del esquema v4 y del archivo de respaldo, dentro de D-15/D-19.
- Qué pasa con las correcciones de contenido de un miembro que se quita de un producto o cuyo producto se borra (sugerido: la corrección sigue al miembro, porque está guardada por RFC + clave). Las marcas «no comparable» de productos borrados se descartan.

### Deferred Ideas (OUT OF SCOPE)
- Agregar la comparación de precios al Excel. La anotó Claude y no se discutió con el usuario: XLS-01 no la incluye, así que sería una hoja nueva en otra fase si el usuario la pide.
- Reviewed todo (not folded): `.planning/todos/pending/auto-accept-product-suggestions.md` («Auto-aceptar las sugerencias de producto de DeepSeek»): cambia la cola de revisión de la Fase 4, no la comparación de precios; queda para una tarea rápida aparte (`/gsd-quick`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PREC-01 | Precio unitario neto por producto y tienda: mínimo, mediana, último, nº de compras | `conceptAmounts` already returns `importe − descuento (+ taxes)` per mode (section "Purchase extraction"); content resolution (units table + size reader); Big median algorithm; counted-Ingreso filter that excludes credit notes |
| PREC-02 | Comparar solo dentro de la misma familia; «no normalizado» si no se puede | ClaveUnidad family table (verified against the SAT catalog), size reader with measured coverage (37 of 178 piece-unit members), D-10 then D-12 precedence, reason list |
| PREC-03 | Servicios, gasolina, comisiones fuera por defecto; el usuario cambia la marca | Exact default prefix rule (`1510`, `151115`, segments 70–94) measured on the sample (61 service lines + 3 fuel lines of 352 Ingreso lines), D-17 product rule, v4 override list |
| PREC-04 | Tienda más barata por producto | Median per store, tie-break by purchases, deterministic final tie-break |
| PREC-05 | Ahorro estimado etiquetado como estimado | D-21 formula in Big, positive differences only, other stores only; per-piece inclusion flag for the card note |
| PREC-06 | Historial de precio en el tiempo | Chart wiring notes (custom markers needed, per-series data, literal date axis), purchases list as table view |
</phase_requirements>

## Summary

This phase is almost entirely a pure-domain problem on top of data the app already has. Every price input exists today: `conceptAmounts(concepto, invoice)` returns the net concept amount for both IVA modes (importe − descuento, plus taxes in `conIva`, plus IEPS in `sinIva`), the ledger already tells which invoices count, `scopeToCategories(...).parts` already tells which concept lines survive the category filter, and `Map`-based product membership is keyed by `ruleMapKey(rfc, normalizeDescription(descripcion))`. The new work is (1) a unit table and a conservative size reader, (2) the comparison statistics, (3) a one-way persistence change (settings v3 to v4 and backup file v2 to v3), and (4) the tab UI already specified in 05-UI-SPEC.md. No new package is needed.

The real data changes how much weight each decision carries. Of 178 distinct piece-unit product descriptions in the sample (270 Ingreso lines), the reader finds a verifiable size in only **37 members (56 lines, 21%)**. Walmart, the dominant supplier, reads only 17 of 103 members because its descriptions are truncated abbreviations ("JAMON ZWAN", "YOPLAIT"). So the D-10 rule («si alguna compra tiene tamaño, las demás quedan no normalizado») and the D-13 content editor are not edge features: they decide whether most cross-store comparisons work at all. The reader must also be conservative, because the real data contains traps the naive reading gets wrong by factors of 1000 («SHIBUMI TARO 1.700 GR» is 1.7 kg, not 1.7 g) or 24 («470 ML ... PACK 24 TARROS»).

The default "no comparable" rule by `ClaveProdServ` works on the sample (61 of 352 Ingreso lines are services, 3 are fuel), with one important caveat: Walmart tags a few physical products (BLUEBERRIES, FRESA, "5L JABON") with 84111506 ("Servicios de facturación"), which the D-17 product-level rule absorbs when the product has any other product-keyed purchase.

**Primary recommendation:** Build `src/domain/prices/*` as pure, Map-based, big.js code (units table, size reader, content resolution, comparison, savings, history series), extend settings to v4 and the backup file to v3 using the same frozen-copy pattern Phase 4 used (never edit `settingsDataSchemaV3` or `backupFile2Schema` after copying), and read the 8 open questions at the end to the user before locking the plan rows they affect.

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` and `./.claude/CLAUDE.md` (same authority as locked decisions):

- **Ask, never infer:** ambiguity means stop and ask; present options with a recommendation; never choose silently. (The "Open Questions for the user" section below exists for this.)
- **TypeScript strict** with `strict: true` and `noUncheckedIndexedAccess: true`. No `any` (explicit or implicit), no `@ts-ignore`/`@ts-nocheck` (only `@ts-expect-error` with a reason), no non-null `!`, no `as` that forces an unverified type. Validate external data (XML, `localStorage`, backup file, request bodies) with zod before typing it.
- **Verification before "done":** `pnpm tsc --noEmit`, `pnpm eslint .`, `pnpm vitest run` must pass; report failures with their output.
- **Stack lock:** Next.js 16 App Router, pnpm, ESLint flat config, Vitest, zustand + `persist` with `version`/`migrate`/zod, Recharts 3 via the shadcn `chart`, TanStack Table v9, big.js. Do not add packages for this phase.
- **Privacy:** parsing and analysis run in the browser; nothing about invoices is persisted or sent anywhere. This phase makes **no LLM call** and sends nothing to DeepSeek.
- **UI language:** Spanish es-MX; static strings in `src/lib/copy/es.ts`, interpolated in `messages.ts`, money and dates in `src/lib/format.ts`.
- **GSD workflow enforcement:** edits go through a GSD command (execute via `/gsd-execute-phase`).
- **Real sample data:** `Facturas/` is gitignored; never copy RFC, UUID, amounts, dates or folios into the repo or planning files. Tests on real data use the `describe.skipIf(!hasSample)` pattern with `FACTURAS_DIR`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Purchase extraction, unit table, size reader, statistics, savings, history series | Browser / Client (pure `src/domain/prices/*`) | — | Parsing and analysis run in the browser by project constraint; no server involvement and no DB. |
| Content corrections and "no comparable" overrides | Browser / Client (zustand `persist`, localStorage) | Backup file (download/upload) | Settings live in `invoicechecker:settings`; the file is a user-held contract. |
| Settings v4 schema, migration, backup v3 parse | Browser / Client (zod, pure `src/domain/settings/*`) | — | Same total, `safeParse`-only pattern as v1 to v3. |
| Prices tab, table, detail panel, editor, chart | Browser / Client (React client components) | — | All client components, same as the other tabs. |
| Password gate, LLM routes | API / Backend (existing, untouched) | — | Not touched by this phase. |
| Static assets | CDN / Static | — | No new assets. |

## Standard Stack

### Core

No new packages. Versions read from `node_modules/*/package.json` this session:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| big.js | 7.0.1 [VERIFIED: node_modules/big.js/package.json] | Exact decimal arithmetic for prices, medians, savings, content | REGLA-04; `Big.strict = true`, `Big.DP = 20`, `Big.RM = Big.roundHalfUp` set in `decimal.ts` |
| zod | 4.6.7 [VERIFIED: node_modules] | Settings v4 and backup v3 schemas | Phase 3/4 pattern |
| zustand | 5.0.15 [VERIFIED: node_modules] | `useSettingsStore` (persist v4) and session filters | Existing |
| @tanstack/react-table | 9.3.1 [VERIFIED: node_modules] | Products table (sort, pagination, expander) | D-07, Phase 2 D-24 |
| recharts | 3.8.0 [VERIFIED: node_modules] | History chart through shadcn `chart` | CLAUDE.md, D-24 |
| vitest | 5.0.4 [VERIFIED: node_modules] | Unit tests next to the code | Existing |
| typescript | 6.0.3 [VERIFIED: node_modules] | strict | Existing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written size reader | An NLP/LLM unit extractor | Rejected: privacy (descriptions only is allowed, but this phase has no LLM call), cost, nondeterminism. The reader is ~70 lines and deterministic. |
| Recharts `LineChart` | `ScatterChart` with `line` | Both support per-series data; UI-SPEC says LineChart. Either way, custom marker shapes are needed (see Pitfall 9). |

**Installation:** none. **Version verification:** `node -e` against the installed packages (done); no registry call is needed because nothing is installed.

## Package Legitimacy Audit

No external package is installed or added by this phase, so the legitimacy gate (`package-legitimacy check`) does not apply. Recharts, TanStack Table, zod, big.js and zustand are already in the lockfile from earlier phases.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 session invoices ──► buildLedger ──► LedgerEntry[]
                                           │ applyFilters (date, supplier, forma)
                                           ▼
                                  scopeToCategories(selected, resolver)  ──► ScopedEntry[] with parts[]
                                           │   keep: entry.counted && entry.kind === "ingreso"
                                           ▼
        purchases.ts: one Purchase per kept concept part (part.concept !== null)
           amount = conceptAmounts(concepto, invoice).conIva | .sinIva  (by IVA mode)
           member key = ruleMapKey(entry.supplierRfc, normalizeDescription(descripcion))
                                           │ join: Map<memberKey, Product>   (unmatched lines are dropped)
                                           ▼
        content.ts per purchase, precedence:  user correction  >  XML qty (mass/volume unit)
                                              >  qty × sizeReader(desc) (piece unit)  >  unsized piece
                                           │
                                           ▼
        compare.ts per product:  drop unsized when any sized exists (D-10)  ──►  pick family by purchases (D-12)
              per store: min / median / last / count  ──► cheapest = lowest median, tie: more purchases (D-20)
              savings = Σ max(0, price − cheapestMedian) × content over OTHER stores' purchases (D-21)
                                           │
              settings (v4): contentCorrections, priceOverrides ─┤ default non-comparable from ClaveProdServ (D-16/17)
                                           ▼
        PricesView { rows[], totalSavings, hiddenCount }  ──►  PreciosTab (card, tools row, table, detail panel)
                                                                   └─► history series (slots from UNFILTERED purchases)
```

### Recommended Project Structure

```
src/domain/prices/
├── units.ts            # ClaveUnidad -> {family, factor} table (Big strings), isPieceUnit()
├── sizeReader.ts       # readSize(description): SizeReading (pure, no settings)
├── content.ts          # resolveContent(purchase, correction | null): Content | NotNormalized(reason)
├── comparable.ts       # defaultNonComparable(claves[]) and effective state with overrides
├── purchases.ts        # extractPurchases(scopedEntries, mode, productIndex)
├── compare.ts          # per-product stats, family choice, cheapest, savings (Big)
├── history.ts          # chart series, store slot assignment from unfiltered purchases
└── *.test.ts, *.anon.test.ts, *.realdata.test.ts   # pattern of Phase 2-4
src/domain/settings/    # extend: types.ts, schema.ts, migrate.ts, backup.ts (+ frozen V3 copies)
src/features/prices/    # PreciosTab, PricesTable, ProductDetail, StoreTable, HistoryChart, ContentEditor, PurchasesList, usePricesView
src/lib/copy/           # es.ts / messages.ts additions
```

### Pattern 1: Purchase extraction (reuses Phase 2/3 code)

**What:** Build purchases from the same filtered, category-scoped entries the Dashboard uses, so FILT-05 holds without new filter code.
**When to use:** always; never re-implement filtering.
**Key facts (read this session):**

```typescript
// src/domain/accounting/ledger.ts:33
export type NoSuma = null | "tipo" | "cero" | "moneda-sin-tc" | "invalido";
// src/domain/accounting/ledger.ts:325
      counted: noSuma === null && exclusion === null,
// src/domain/accounting/ledger.ts:25-30
export type EntryKind =
  | "ingreso"
  | "nota-credito"
  | "pago"
  | "traslado"
  | "nomina";
// src/domain/accounting/amounts.ts:37-44
export interface ConceptAmounts {
  /** ValorUnitario in MXN, unsigned. */
  precioUnitario: Big | null;
  /** importe - descuento + traslados - retenciones, signed like the invoice. */
  conIva: Big | null;
  /** importe - descuento + the concept's IEPS, signed like the invoice. */
  sinIva: Big | null;
}
// src/domain/accounting/categories.ts:29-38
export interface EntryPart {
  /** Category id, or the reserved SIN_CATEGORIA key. */
  category: string;
  /** Index of the concepto in XML order; null for the rounding difference part. */
  concept: number | null;
  /** Amount in Con IVA, signed like the invoice. */
  con: Big;
  /** Amount in Sin IVA, signed like the invoice. */
  sin: Big;
}
// src/domain/accounting/categories.ts:112-116
export type ScopedEntry = LedgerEntry & {
  fullConIva: Big | null;
  fullSinIva: Big | null;
  parts: EntryPart[];
};
```

Rules that follow from these quotes:

1. **`counted` is true for credit notes too** (`noSuma` is `null` for `E`). D-06 therefore requires an explicit `entry.kind === "ingreso"` in addition to `entry.counted`. Forgetting it lets a credit note enter with a negative amount [VERIFIED: ledger.ts:259-282, 325].
2. Use `conceptAmounts(...).conIva` or `.sinIva` for the net amount (it is already `importe − descuento`). **Do not use `precioUnitario` (ValorUnitario)**: it ignores the discount, which on the sample is large for Walmart lines (e.g. a line with discount 34.91 on 173.91).
3. Iterate `scoped.parts.filter((p) => p.concept !== null)` and read `entry.invoice.conceptos[p.concept]`; this honors the category filter (D-03) exactly like the Dashboard. A `null` concept part is the rounding difference and is not a purchase.
4. The date for the chart and "Último" is the literal `invoice.fecha` (`YYYY-MM-DDTHH:mm:ss`); compare as strings, never through `new Date()` (REGLA-05).
5. `cantidad` is a string: `parseDecimal(concepto.cantidad)` must be `> 0`, else the purchase is not normalizable ("La cantidad de la factura no es válida.").
6. Foreign-currency invoices are already converted by `conceptAmounts`; an invoice without a usable TipoCambio is `noSuma: "moneda-sin-tc"` and never reaches the stage.

### Pattern 2: ClaveUnidad family table (D-09 step 2/3)

Names below are verbatim from the SAT `c_ClaveUnidad` catalog data (`cfdi_40_claves_unidades`, 2,418 rows) [CITED: github.com/phpcfdi/resources-sat-catalogs, database/data/cfdi_40_claves_unidades.sql, fetched 2026-10-25; a third-party mirror of the SAT catalog]. Units seen in the sample: `H87 (253), E48 (50), KGM (18), ACT (16), XUN (15), XPK (6), LTR (3), X4G (1)` [CITED: 05-CONTEXT.md canonical_refs].

| Family | ClaveUnidad (catalog name) | Factor to base | Base |
|--------|----------------------------|----------------|------|
| mass | `KGM` Kilogramo | 1 | kg |
| mass | `GRM` Gramo | 0.001 | kg |
| mass | `MGM` Miligramo | 0.000001 | kg |
| mass | `TNE` Tonelada (tonelada métrica) | 1000 | kg |
| mass | `LBR` Libra | 0.45359237 | kg |
| mass | `ONZ` Onza (avoirdupois) | 0.028349523125 | kg |
| volume | `LTR` Litro | 1 | L |
| volume | `MLT` Mililitro | 0.001 | L |
| volume | `CMQ` Centímetro cúbico | 0.001 | L |
| volume | `CLT` Centilitro | 0.01 | L |
| volume | `DLT` Decilitro | 0.1 | L |
| volume | `MTQ` Metro cúbico | 1000 | L |
| volume | `GLL` Galón (EUA) | 3.785411784 | L |
| piece | `H87` Pieza, `XUN` Unidad, `XPK` Paquete, `E48` Unidad de servicio (all four named in D-09) | 1 | pieza |
| piece (recommended extras, see Q6) | `EA` Elemento, `ACT` Actividad, `XBX` Caja, `X4G` Caja de cartón, `XBJ` Cubeta, `XBO` Botella no-protegida y cilíndrica, `XBG` Bolso, `XCT` Cartón, `XCS` Estuche, `XPA` Cajetilla, `SET` Conjunto, `KT` Kit, `XKI` Kit (Conjunto de piezas) | 1 | pieza |
| not recognized | every other code (e.g. `MTR`, `HUR`, `DAY`, `MON`, `KWH`) | — | reason «La unidad «{clave}» no tiene equivalencia.» |

The exact physical constants (pound, ounce, US gallon) are definitions, not measurements, but their values here come from training knowledge, not from a fetched source [ASSUMED]. They are rare for a Mexican café; the table can drop `LBR`, `ONZ`, `GLL`, `MTQ` without affecting the sample if the planner wants a smaller test surface.

Implementation: store factors as **decimal strings** and multiply with `Big` (strict mode rejects numbers). Use a `Map<string, UnitRule>`, never an object keyed by the XML value (`"__proto__"` hygiene, as the rest of the domain). The free-text `Unidad` attribute is inconsistent in the real data (`PIEZAS`, `Pieza`, `UN`, `pz`, `Unidad de Servicio`, `kg`, `KILO`, `lts`, `junior`, empty) and must **not** be used for classification.

### Pattern 3: Size reader (D-09 step 3), verified implementation

The reader below was executed with Node 24 type stripping against the guide cases, a false-positive list and the whole sample (coverage numbers in "Measured results"). It follows project TS rules (no `any`, no `!`, no unchecked `as`). Port it to `src/domain/prices/sizeReader.ts` changing the import to `import Big from "big.js"` (and drop the local `Big.strict` line: `decimal.ts` sets it).

```typescript
import Big from "big.js";

export type SizeFamily = "mass" | "volume";

/** Result of reading a presentation size from a description (D-09 step 3). Totals in kg or L. */
export type SizeReading =
  | { kind: "size"; family: SizeFamily; total: Big; text: string }
  | { kind: "ambiguous"; reason: "conflict" | "pack-token"; texts: string[] }
  | { kind: "none" };

type UnitRule = { family: SizeFamily; factor: string; thousandsDot: boolean };

const KG: UnitRule = { family: "mass", factor: "1", thousandsDot: false };
const G: UnitRule = { family: "mass", factor: "0.001", thousandsDot: true };
const L: UnitRule = { family: "volume", factor: "1", thousandsDot: false };
const ML: UnitRule = { family: "volume", factor: "0.001", thousandsDot: true };

const UNIT_RULES = new Map<string, UnitRule>([
  ["KILOGRAMOS", KG], ["KILOGRAMO", KG], ["KILOS", KG], ["KILO", KG], ["KGS", KG], ["KGR", KG], ["KG", KG], ["K", KG],
  ["GRAMOS", G], ["GRAMO", G], ["GRS", G], ["GR", G], ["G", G],
  ["LITROS", L], ["LITRO", L], ["LTS", L], ["LT", L], ["L", L],
  ["MILILITROS", ML], ["MILILITRO", ML], ["MLS", ML], ["ML", ML], ["CC", ML],
]);

const UNIT_ALT = "KILOGRAMOS?|KILOS?|KGS?|KGR|GRAMOS?|GRS?|MILILITROS?|MLS?|CC|LITROS?|LTS?|LT|K|G|L";
const NUM = "(\\d+(?:[.,]\\d+)?)";
// [1] pack count (1-2 digits), [2] number, [3] unit. The number must not continue a longer number.
const PLAIN = new RegExp(`(?<![\\d.,])(?:(\\d{1,2})\\s*[/X]\\s*)?${NUM}\\s?(${UNIT_ALT})(?![A-Z0-9])`, "g");
// «12/355CCSAB»: only CC and ML may carry glued letters, and only right after the number.
const GLUED = new RegExp(`(?<![\\d.,])(?:(\\d{1,2})\\s*[/X]\\s*)?${NUM}(CC|ML)(?=[A-Z])`, "g");
const PACK_TOKEN = /\b(PACK|PAQ|PQ|CJ|CAJA|FAJILLAS?|DOCENA)\b|\b\d+\s*(PZ|PZA|PZAS|PIEZAS|PK|P)\b|\dPK\b/;

function stripText(description: string): string {
  return description.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
}

/** "1.700" with a gram/millilitre unit is a thousands dot (1,700 g); "1.730" with K or L is a decimal. */
function numberText(raw: string, rule: UnitRule): string {
  if (rule.thousandsDot && /^\d{1,3}\.\d{3}$/.test(raw)) return raw.replace(".", "");
  return raw.replace(",", ".");
}

export function readSize(description: string): SizeReading {
  const text = stripText(description);
  const found: { family: SizeFamily; total: Big; text: string; explicitPack: boolean }[] = [];
  for (const re of [PLAIN, GLUED]) {
    for (const match of text.matchAll(re)) {
      const [whole, packText, numText, unitText] = match;
      if (numText === undefined || unitText === undefined) continue;
      const rule = UNIT_RULES.get(unitText);
      if (rule === undefined) continue;
      const size = new Big(numberText(numText, rule)).times(rule.factor);
      const pack = packText === undefined ? null : new Big(packText);
      const total = pack === null ? size : size.times(pack);
      if (size.lte("0") || (pack !== null && pack.lte("0")) || total.gt("1000")) continue;
      found.push({ family: rule.family, total, text: whole.trim(), explicitPack: pack !== null });
    }
  }
  const first = found[0];
  if (first === undefined) return { kind: "none" };
  const distinct = new Set(found.map((f) => `${f.family}:${f.total.toString()}`));
  if (distinct.size > 1) return { kind: "ambiguous", reason: "conflict", texts: found.map((f) => f.text) };
  if (!found.some((f) => f.explicitPack) && PACK_TOKEN.test(text)) {
    return { kind: "ambiguous", reason: "pack-token", texts: [first.text] };
  }
  return { kind: "size", family: first.family, total: first.total, text: first.text };
}
```

Behavior contract (use as unit-test table; every row was run):

| Description | Reading |
|-------------|---------|
| «12/1L ALPURA» | volume 12 L |
| «2KG MANGO MM» | mass 2 kg |
| «LECHERA 375G» | mass 0.375 kg |
| «1.730K MAYON» | mass 1.73 kg |
| «12/355CCSAB» | volume 4.26 L (12 × 355 mL; needs the glued-suffix rule) |
| «May Mccorm 1730 G» | mass 1.73 kg (same product as «1.730K MAYON» at another store) |
| «SHIBUMI TARO 1.700 GR» | mass 1.7 kg (thousands-dot rule; naive reading gives 1.7 g, wrong by 1000×) |
| «Mac Delineador ... Lip Pencil 1.45g» | mass 0.00145 kg (two decimals: a real decimal) |
| «ACIDO MURIATICO SULTAN LIMON 15/900 ML» | volume 13.5 L |
| «SALSA CHAMOY CHILERITO 12/1LT (5) SALS0002» | volume 12 L (see Pitfall 5) |
| «JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG» | mass 1 kg (two matches, same value). With unit KGM this text is ignored (D-09 step 2). |
| «24 TARROS MASON JAR ... 470 ML - PACK 24 TARROS» | ambiguous (pack-token): no size |
| «Leche LacDel Desla», «SPR SA 355», «SPRITE 600», «CLORALEX3.75», «FRESA 454» | none (bare numbers without a unit are never read) |
| «MINI UPS ... 5000 MAHX2», «Cable USB-C ... 2 Metros», «MPQ MALLAS ... 90 2X2M», «SOPORTE G45», «195/65 R15 89V», «Apple Watch ... 42mm», «COLORES 2 GRANDES», «BOLSA 40X60 KG» | none (false-positive guards) |

Hardening to keep: cap the description at roughly 300 characters before running the regexes (descriptions are untrusted XML text); keep every quantifier bounded or linear (the patterns above have no nested quantifiers); build `Big` values from strings only.

### Pattern 4: Content resolution and comparison (D-09 to D-12, D-20, D-21)

Per purchase, produce a `Content`:

```typescript
type Content =
  | { family: "mass" | "volume"; amount: Big; source: "xml" | "description" | "user" } // amount in kg or L
  | { family: "piece"; amount: Big; sized: boolean; source: "xml" | "user" | "unsized" } // pieces
  | { notNormalized: "unit-unknown" | "bad-quantity" | "bad-amount" | "no-price" | "unsized-with-sized-siblings" | "other-family" };
```

Order of evaluation (resolves an ordering the CONTEXT leaves implicit):

1. Per purchase: parse quantity (> 0) and the net amount (not null). Failure gives `bad-quantity` / `bad-amount`.
2. Per purchase: correction of the member applies **only if the purchase's ClaveUnidad is a piece unit** (D-14); a member that appears with a KGM line and an H87 line is corrected only on the H87 lines. Content = `qty × packs × per × unitFactor` (unit `piezas` gives family piece with a user-given count).
3. Weight/volume unit: content = `qty × factor` (D-09 step 2). Description text is ignored.
4. Piece unit: `qty × readSize(desc).total` when the reading is `size`; otherwise unsized piece (`amount = qty`, `sized: false`).
5. **Per product, D-10 first:** if any purchase has a size (mass, volume, or a user-entered piece count), unsized piece purchases become `unsized-with-sized-siblings`. If every purchase is an unsized piece, compare per piece with the label «por pieza, sin tamaño verificado».
6. **Then D-12:** among the remaining normalized purchases, compare the family with the most purchases; the others become `other-family`. Tie-break is not decided by CONTEXT (see Q5).
7. Price = `net / content.amount` (`Big`, DP 20); never go through a float.

Statistics per store (RFC): min, median, last (latest literal `fecha`), count. Median of an even count is `(a + b) / 2` in Big (discretion, exact for finite decimals). Cheapest = lowest median compared with `Big.cmp`/`eq` on **unrounded** values; tie gives more purchases; if still tied, break deterministically by `Intl.Collator("es")` on the store name so the table never flickers (discretion). Savings (D-21) = Σ over purchases of **stores other than the cheapest** of `max(0, price − cheapestMedian) × content`, in Big, label "estimado". Products with fewer than two stores *after* normalization have no cheapest and no saving (D-02).

### Pattern 5: Default "no comparable" (D-16, D-17)

Prefix rule on the 8-digit `ClaveProdServ` (string, never `Number`):

- Fuel: starts with `1510` (as D-16 locks) and, recommended, `151115` (gaseous fuels such as `15111510 Gas licuado de petróleo`) — see Q3.
- Services: first two digits in `70`..`94`.

Evidence from the SAT product catalog data (`cfdi_40_productos_servicios`, 52,513 rows) [CITED: github.com/phpcfdi/resources-sat-catalogs, database/data/cfdi_40_productos_servicios.sql, fetched 2026-10-25]:

- The catalog has only segments `70–86` and `90–95` in the 70s–90s range (none of `87–89`), and the first names in each are services (examples verbatim: `70` «Explotaciones pesqueras», `78` «Transporte de carga aérea», `80` «Servicios de consultoría de negocios y administración corporativa», `81` «Ingeniería civil», `82` «Publicidad impresa», `83` «Servicios de acueducto y alcantarillado», `84` «Asistencia de desarrollo», `85` «Servicios hospitalarios de emergencia o quirúrgicos», `90` «Establecimientos para comer y beber», `91` «Facilidades de spa y ejercicios y rejuvenecimiento», `92` «Servicios de policía», `93` «Cuerpos políticos», `94` «Asociaciones de negocios»). Segment `95` is land and buildings («Lotes residenciales») and segment `64` has one row («Contratos de seguros de salud»); neither appears in the sample and both are outside D-16's 70–94.
- Keys named in D-16: `84111506` = «Servicios de facturación» (the mislabel source, see below), `15101514` = «Gasolina regular menor a 91 octanos».
- `1510xxxx` also contains «Combustibles sólidos o gelificados» (`15101600`), a physical product a café may buy (chafing gel). D-16 locks the `1510` prefix; the user can flip a product with the "⋯" menu.

Measured on the 352 Ingreso lines of the sample [VERIFIED: local measurement over `Facturas/2025`]: 3 fuel lines (`15101514`, unit LTR, 3 suppliers), 61 service lines, 288 product lines. The 61 service lines are: `84121500` ×12, `90101603` ×15, `81161700` ×7, `78181703` ×8, `84111506` ×10 (6 with unit ACT, 4 with H87), `82101603` ×2, `82121500` ×1, `93161700` ×1, `81112106` ×1, `83111504` ×1, `81111819` ×1 (H87), `80141605` ×2 (H87, «Mercancía promocional»: «REN IND PLUS», «MEMBRESIAS»).

**Walmart mislabels (important for D-17).** The same supplier tags the physical products «BLUEBERRIES», «FRESA» and «5L JABON» with `84111506` («Servicios de facturación») on some invoices, and with proper food keys (`50302700`, `50301800`) on others. D-17 (comparable if **any** purchase has a product key) keeps BLUEBERRIES and FRESA comparable; «5L JABON» appears only once and only with the service key, so if the user groups it alone it is hidden by default and needs «Volver a comparar». That is acceptable, and the UI-SPEC reason caption already says why. Two non-service lines the rule does not catch: `14111822` «Formatos o libros de entregas» («E DOMICILIO», delivery fee, amount `0.000001`) and `43232600` «Software específico para la industria» (billing folios). The user handles these with the "⋯" menu.

**Where the rule is evaluated (not stated in CONTEXT, see Q7):** recommend evaluating "any purchase with a product key" over **all counted Ingreso purchases of the product's members, ignoring the date/supplier/forma/category filters**, so a product does not flip between comparable and hidden when the user changes a filter. The "Mostrar los no comparables ({n})" count then counts products that are hidden *and* have purchases inside the current filters.

### Pattern 6: Persistence v3 to v4 and backup file v2 to v3 (one-way contract)

Phase 4 established the exact pattern; repeat it. Verified current values:

```typescript
// src/domain/settings/types.ts:95
export const SETTINGS_VERSION = 3;
// src/domain/settings/backup.ts:30
export const BACKUP_FILE_VERSION = 2;
// src/domain/settings/types.ts:104-114
export const LIMITS = {
  categories: 200,
  supplierCategories: 5000,
  conceptRules: 20000,
  categoryName: 60,
  products: 2000,
  productMembers: 5000,
  ungroupedConcepts: 5000,
  productName: 60,
  backupBytes: 4194304,
} as const;
// src/stores/sessionStore.ts:20
export type AppTab = "dashboard" | "categorias" | "productos" | "calidad" | "importacion";
```

Change list (every explicit field-pick in the repo that must learn the two new fields; spreads such as `{ ...settings, products }` in `products.ts` carry new fields automatically):

| File | Change |
|------|--------|
| `src/domain/settings/types.ts` | Copy the current `SettingsData` shape to a frozen `SettingsDataV3` (comment "never add a field here", as `SettingsDataV2`); add `contentCorrections` and `priceOverrides` to `SettingsData`; `SETTINGS_VERSION = 4`; add caps to `LIMITS`; extend `defaultSettings()`. |
| `src/domain/settings/schema.ts` | Copy the current `settingsDataSchema` to a frozen `settingsDataSchemaV3` **before** editing; extend `settingsDataSchema`; add integrity rules (unique `rfc+key` per correction; `priceOverrides` unique by productId). |
| `src/domain/settings/migrate.ts` | New `version === 3` branch using `settingsDataSchemaV3.safeParse`, appending `contentCorrections: []` and `priceOverrides: []`; the v1 and v2 branches must also append the two empty lists. `safeParse` only (total; zustand swallows exceptions). |
| `src/domain/settings/backup.ts` | `BACKUP_FILE_VERSION = 3`; add `backupFile3Schema` + `fromBackupFile3`; never edit `backupFile1Schema`/`backupFile2Schema`/their converters; v1 and v2 branches add the empty lists; extend `buildBackupText`, `BackupSummary` and `summaryOf`. |
| `src/stores/settingsStore.ts` | Extend `dataOf`, `replaceAll`, `partialize`; new actions (set/remove correction, set/clear override, with undo-friendly returns like the existing ones). `deleteProduct` must drop the product's override in the same `set`, and its snapshot/`restoreProduct` must restore it (D-19 "se descartan", with Deshacer). |
| `tests/fixtures/settings/` | Add `ajustes-archivo-3.json` golden file; `ajustes-archivo-1.json` and `-2.json` must keep loading. |
| `src/domain/settings/backup.test.ts` | The test "a settings value at the product limits ... fits under the 4 MB gate (D-31)" builds a worst case **without** the new lists. Extend it so the worst case includes corrections and overrides at their caps and still stays under `4194304` bytes. |

Recommended shape (discretion; lists of entries, no records keyed by text; numbers as decimal **strings** validated by the same `DECIMAL_RE` idea as `decimal.ts`):

```typescript
interface ContentCorrection { rfc: string; key: string; description: string; supplierName: string;
  packs: number /* int 1..999 */; amount: string /* decimal > 0, <= 6 decimals, <= 1,000,000 */;
  unit: "g" | "kg" | "ml" | "l" | "piezas" }
interface PriceOverride { productId: string; comparable: boolean } // only when different from the default (D-19)
```

Suggested caps (planner fixes the final numbers, D-15): `contentCorrections: 2000`, `priceOverrides: 2000` (matches `products`). 2,000 corrections stay well below the worst-case size already budgeted. `AppTab` gains `"precios"`; update `isAppTab`, `TABS`, trigger map and `TabsContent` list in `AppShell.tsx` and `es.tabs.prices`.

### Pattern 7: History chart (D-24) facts that affect wiring

- Recharts 3.8.0's built-in marker set is `'circle' | 'cross' | 'diamond' | 'square' | 'star' | 'triangle' | 'wye'` [VERIFIED: node_modules/recharts/types/util/types.d.ts:76]. The UI-SPEC needs circle, square, diamond, triangle, **inverted triangle, pentagon** and plus. Two of the seven are not built in, so the markers must be a small custom SVG `dot` component (Recharts allows `dot` to be a custom React component returning an SVG element [CITED: node_modules/recharts/types/util/types.d.ts DotType comment]).
- Per-series data: graphical items accept their own `data` prop (`data?: ChartData<DataPointType>` in the shared cartesian item props, types.d.ts:1143) [CITED: node_modules types]. With one `data` array per store, `connectNulls` can stay off as the UI-SPEC says. If the planner instead builds one wide dataset with keys `tienda1..tienda6`, other stores' rows are `null` for each series and `connectNulls` must be **on** or no lines render. Choose per-series `data`; validate with a render test (this is MEDIUM: not rendered in this session).
- X axis: use a numeric axis of day numbers built with `Date.UTC(y, m - 1, d)` from the literal date parts (no local time zone) and format ticks with `Intl.DateTimeFormat("es-MX", { timeZone: "UTC" })`.
- Chart config must stay static (`tienda1..tienda6`, `otras`): store names never become config keys (T-02-19 precedent in `TrendChart.tsx`).
- Y values are plain numbers for plotting only (`Number(price.round(...).toString())` precedent in `TrendChart.tsx`), while every figure shown as text comes from the exact `Big`.

### Anti-Patterns to Avoid

- **Reading the size from the description when the unit is KGM/LTR.** Eight of the 16 KGM members in the sample carry a text size that must be ignored («QUESO CREMA ILSA 5KG (-0)» sold as 0.5 KGM, «CHIPS H-125 7000 ALPEZ 10KG ...» as 0.25 KGM, «KG 40X60 NEGRA BD BTO 25 KG» as 1 KGM). The XML quantity wins (D-09 step 2).
- **Using `precioUnitario` (ValorUnitario) as the price.** It ignores the line discount.
- **Treating `entry.counted` as "is an Ingreso".** It is also true for credit notes.
- **Float arithmetic or `Number(...)` on money/content.** `Big.strict = true` throws on numbers; build from strings.
- **Plain objects keyed by RFC/description/product text** (`"__proto__"`); use `Map`/`Set` and `ruleMapKey`.
- **Editing frozen schemas** (`settingsDataSchemaV2`, `backupFile1Schema`, `backupFile2Schema`, and the new V3 copies after they are copied).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-line net amount in both IVA modes | A new discount/tax calculation | `conceptAmounts` (`amounts.ts:124`) | Already handles discount, IEPS, taxes, currency, sign, and damaged values |
| Which invoices count and the filter pipeline | Re-filtering invoices | `buildLedger` + `applyFilters` + `scopeToCategories` | FILT-05 consistency for free; `parts[].concept` gives the surviving lines |
| Member identity | New key format | `ruleMapKey(rfc, normalizeDescription(descripcion))` | Same identity as product members (P4 D-09) |
| Decimal math | `Number`/floats, `toFixed` | big.js via `decimal.ts` helpers (`parseDecimal`, `sum`, `toMoneyString`) | REGLA-04 |
| Settings validation / migration | Ad-hoc JSON checks | zod `safeParse` + `resolvePersisted` branch + frozen schema copies | Total functions; zustand swallows exceptions |
| Table sort/pagination/expander | Custom table state | TanStack v9 pattern from `InvoiceTable.tsx` / `ProductList.tsx`, `SortHeaderButton` | Already approved UI pattern |
| Chart theming/tooltip shell | Raw Recharts styling | shadcn `ChartContainer`/`ChartTooltip` as in `TrendChart.tsx` | Existing approved pattern |
| SAT unit/key catalogs at runtime | Importing the 2,418/52,513-row catalogs | The small hard-coded tables above | The app uses labels of what it has seen; full catalog is Out of Scope in REQUIREMENTS.md |
| Unit extraction from descriptions with an LLM | DeepSeek call | The deterministic reader | Privacy constraint, determinism, no new route |

**Key insight:** the only genuinely new algorithms are the size reader and the family/median/savings logic; everything else is wiring of existing, tested pieces.

## Runtime State Inventory

Not a rename/refactor phase. The only "state" concern is the **persisted settings schema**, handled in Pattern 6: stored data in `localStorage` key `invoicechecker:settings` (v3 to v4 via `migrate`), and the downloadable settings file (v2 to v3). Live service config, OS-registered state, secrets/env vars and build artifacts: None, verified by the fact that this phase adds no route, no env var, no job and no package.

## Common Pitfalls

### Pitfall 1: Credit notes leak into prices
**What goes wrong:** An Egreso line enters with a negative amount and drags the minimum/median.
**Why it happens:** `LedgerEntry.counted` is `noSuma === null && exclusion === null`, true for credit notes.
**How to avoid:** filter `entry.counted && entry.kind === "ingreso"` (D-06).
**Warning signs:** negative prices, or purchase counts that include `tipo "E"` fixtures.

### Pitfall 2: Thousands dot in gram quantities
**What goes wrong:** «SHIBUMI TARO 1.700 GR» read as 1.7 g, price per kg 1000× too high.
**Why it happens:** "." is a decimal in «1.730K» (kg) but a thousands separator in «1.700 GR» (g). Same supplier-written format, different unit.
**How to avoid:** for gram and millilitre units, a number matching `^\d{1,3}\.\d{3}$` removes the dot; for K/KG/L it stays a decimal. Covered in the reader and the test table.
**Warning signs:** a $/kg far outside the other stores' range for the same product.

### Pitfall 3: Text size overriding the XML quantity
**What goes wrong:** KGM line «CHIPS ... 10KG» with quantity 0.25 becomes 2.5 kg.
**How to avoid:** D-09 precedence is strict; run the reader only for piece-family units.

### Pitfall 4: Pack text without a multiplier
**What goes wrong:** «24 TARROS ... 470 ML - PACK 24 TARROS» read as 0.47 L, 24× too small a content, 24× too high a price per L.
**How to avoid:** the `pack-token` rule makes a single size plus a pack word ambiguous, which falls back to "sin tamaño". It errs toward "no normalizado" (safe), never toward a wrong price. Conflicting readings are also ambiguous.

### Pitfall 5: «N/size» can be a case spec, not the quantity sold
**What goes wrong:** «SALSA CHAMOY CHILERITO 12/1LT (5)» sold as quantity 1.0000 at 45.00: read per D-09 as 12 L, the price per L ($3.75) is implausible next to the one-bottle price; the supplier likely sells single 1 L bottles and prints the case format in the name.
**Why it happens:** the same notation means "12 bottles in this sale" for Walmart («12/1L ALPURA» at 309.97) and "12 per case" for this distributor.
**How to avoid:** nothing in the text distinguishes them, so D-09 stays as locked; the purchases list (D-08) shows content and price next to the description precisely so the user can spot it, and the editor (D-13) fixes it. Mention this in the plan as a known limit, not a bug.

### Pitfall 6: Zero or near-zero net amounts become the "cheapest"
**What goes wrong:** a 100%-discounted or free line (price 0) becomes the minimum and inflates the saving; the sample has `E DOMICILIO` at `0.000001` (product key `14111822`) and service lines with total discount.
**How to avoid:** treat net amount `<= 0` as not priced (Q2). Tiny positive amounts cannot be filtered generically; the user excludes such a product with the "⋯" menu.

### Pitfall 7: Walmart abbreviations mean most Walmart purchases are unsized
**What goes wrong:** with D-10, a product bought sized at store A and unsized at Walmart leaves Walmart as "no normalizado", so the product shows one store and no saving until the user captures the content.
**Why it happens:** only 17 of 103 Walmart members carry a size; e.g. the same milk is «12/1L ALPURA» (12 L) at Walmart, but «Leche LacDel Desla» × 6 (XUN, no size) at the distributor.
**How to avoid:** this is expected, not a bug. Plan the editor (D-13) and the "Falta el contenido de {n} descripciones" notice as core, early features, and make saving a correction recompute the whole row immediately.

### Pitfall 8: Filter-dependent defaults and chart colors
**What goes wrong:** a product flips between hidden and shown, or a store changes chart color, when the user changes a date filter.
**How to avoid:** compute the default comparable state and the series slots from the **unfiltered** counted purchases (UI-SPEC already requires this for slots; Q7 asks the user about the default state).

### Pitfall 9: Recharts marker set and wide-data lines
**What goes wrong:** the planner assumes seven built-in marker shapes; two do not exist. Or a wide dataset with `connectNulls={false}` draws no lines.
**How to avoid:** custom SVG `dot` for all seven (consistent drawing), per-series `data`, and a render test with 7 stores (6 slots + "Otras tiendas").

### Pitfall 10: Persistence contract edits break old files
**What goes wrong:** editing a frozen schema or forgetting the empty lists in the v1/v2 branches makes old settings or files unreadable (silent reset by zustand when `migrate` throws).
**How to avoid:** copy-then-edit; golden files 1, 2 and the new 3 in tests; `safeParse` only.

### Pitfall 11: Product deletion leaves a dangling override
**What goes wrong:** the integrity rule "override points to an existing product" fails after `deleteProduct`, making the whole stored state unreadable on the next load.
**How to avoid:** delete the override in the same `set` as the product, extend `ProductSnapshot` so `restoreProduct` (Deshacer) puts it back, and prune on read as a second layer.

### Pitfall 12: `describe.skipIf` real-data tests asserting literals
**What goes wrong:** committing real RFCs, amounts or folios through assertions.
**How to avoid:** follow `ledger.realdata.test.ts`: assertions are counts and identities only; descriptions are the only text allowed in examples.

## Code Examples

### Default non-comparable classification (D-16, D-17)

```typescript
// Source: this research (prefix rule measured on the sample; SAT catalog segments checked)
export type KeyClass = "product" | "service" | "fuel";

export function classifyClave(claveProdServ: string): KeyClass {
  if (claveProdServ.startsWith("1510") || claveProdServ.startsWith("151115")) return "fuel";
  const segment = Number.parseInt(claveProdServ.slice(0, 2), 10);
  if (Number.isInteger(segment) && segment >= 70 && segment <= 94) return "service";
  return "product";
}

/** D-17: non comparable by default only when EVERY purchase is service or fuel. */
export function defaultNonComparable(claves: readonly string[]): boolean {
  return claves.length > 0 && claves.every((clave) => classifyClave(clave) !== "product");
}
```

### Median and savings in Big (D-20, D-21)

```typescript
// Source: this research; Big strict mode, DP 20 as configured in decimal.ts
import type Big from "big.js";
import { ZERO } from "@/domain/accounting/decimal";

export function median(sorted: readonly Big[]): Big | null {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  const hi = sorted[mid];
  const lo = sorted[mid - 1];
  if (hi === undefined) return null;
  if (n % 2 === 1) return hi;
  if (lo === undefined) return null;
  return lo.plus(hi).div("2");
}

export interface PricedPurchase { storeRfc: string; price: Big; content: Big }

/** D-21: only OTHER stores' purchases, only positive differences, exact. */
export function estimatedSaving(
  purchases: readonly PricedPurchase[],
  cheapestRfc: string,
  cheapestMedian: Big,
): Big {
  let total = ZERO;
  for (const p of purchases) {
    if (p.storeRfc === cheapestRfc) continue;
    const diff = p.price.minus(cheapestMedian);
    if (diff.gt(ZERO)) total = total.plus(diff.times(p.content));
  }
  return total;
}
```

### Test fixtures to add (descriptions only; no RFC/amount/UUID)

- `tests/fixtures/cfdi/anon/`: anonymized invoice with three concept lines: H87 «12/1L ALPURA», KGM «JAMON ... 1X1KG» qty 0.27, XUN «Leche ...» qty 6; an Egreso with a matching line; a line with `Descuento` equal to `Importe`.
- `sizeReader.test.ts`: the behavior-contract table above, plus the false-positive list.
- `settings` golden file `ajustes-archivo-3.json` and a v3-stored-state fixture for `resolvePersisted`.
- `prices.realdata.test.ts` with `describe.skipIf(!hasSample)`: asserts counts only (e.g. "service+fuel lines classified" and "piece-unit members with a read size") using thresholds, never literals.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Table v8 `useReactTable` | v9 `useTable` + `tableFeatures` | v9 stable (`@tanstack/react-table` 9.3.1 installed) | Copy the existing `InvoiceTable.tsx` setup, not blog snippets |
| `middleware.ts` | `proxy.ts` | Next 16 | Not touched here |
| Recharts 2 `Line` data on the chart only | Recharts 3 per-item `data` | Recharts 3.x | Per-series data for the history lines (verify with a render test) |

**Deprecated/outdated:** none relevant; no library is changed.

## Measured results on the real sample

Measured locally on `Facturas/2025/*.xml` (143 CFDI 4.0 files, 362 concept rows: 352 Ingreso, 7 Pago, 3 Egreso). Scratch scripts live in `/private/tmp/claude-501/-Users-marcosmorales-Documents-Atzomx-InvoiceChecker/86ae7388-edc7-4118-961b-3af1fc886863/scratchpad/` (`extract.cjs`, `reader.cjs`, `ref/sizeReader.ts`). No RFC, UUID, amount or folio is recorded here.

| Measure | Result |
|---------|--------|
| Ingreso lines by key class | 288 product, 61 service, 3 fuel |
| Product-key Ingreso lines by ClaveUnidad | H87 246, KGM 18, XUN 15, XPK 6, E48 2, X4G 1 (LTR appears only on the 3 fuel lines) |
| Distinct piece-unit product members (supplier + description) | 178 (270 lines) |
| Reader result on those members | 37 size (56 lines, 21%), 1 ambiguous, 140 none |
| By supplier (suppliers with at least 5 lines) | Walmart 17 of 103 members read; distributor of syrups/teas 6 of 6; cup/packaging supplier 0 of 11 (all pack counts in PZ); the rest 1–3 each |
| Unread descriptions that contain a real weight/volume without a unit | 4 («SPR SA 355», «SPRITE 600», «FRESA 454», «CLORALEX3.75») |
| Unread descriptions that carry only piece counts (PZ, PK, P, PAQ, CJ) | about 20 (e.g. «50PZ / CJ 20PQ», «100 pz», «BONAFO18PK», «MM AGUA 40P») |
| KGM members whose text carries a different size that must be ignored | 8 of 16 |
| Lines with net amount `<= 0.01` among product lines | 1 («E DOMICILIO», `0.000001`) |
| Same normalized description at more than one supplier | 0 (cross-store matching depends entirely on the user's product groups) |

Guide cases from CONTEXT `<specifics>` all pass (table in Pattern 3).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact conversion constants for `LBR`, `ONZ`, `GLL` (and that `MTQ`/`CMQ`/`CLT`/`DLT` factors are as listed) | Pattern 2 | A wrong constant skews a rare unit; low impact, tests pin the values |
| A2 | Extra packaging units (`EA`, `ACT`, `XBX`, `X4G`, `XBJ`, `XBO`, `XBG`, `XCT`, `XCS`, `XPA`, `SET`, `KT`, `XKI`) belong to the piece family | Pattern 2 | A unit treated as piece that the user thinks is something else; Q6 asks |
| A3 | «K», «1K», «2K», «9K» in Walmart abbreviations mean kilograms (supported by price plausibility only) | Pattern 3 | If «K» meant something else, those members get a wrong $/kg; D-13 lets the user correct |
| A4 | «1.700 GR» means 1,700 g (dot as thousands separator) and not 1.7 g | Pitfall 2 | Rare format; supported by a taro-powder bag price (a 1.7 g bag is implausible) |
| A5 | Recharts 3.8.0 positions multiple `Line`s with different per-item `data` on one numeric X axis | Pattern 7 | Chart lines misplaced; needs a render test before building the UI on it |
| A6 | pnpm commands behave as documented (pnpm itself was not on the agent shell PATH) | Environment | Verification commands differ; the executor environment has pnpm via `~/Library/pnpm` |
| A7 | A sub-300-character cap before running the reader regexes is enough to avoid regex cost | Security | Pathological long descriptions slow the tab; the regexes have no nested quantifiers so risk is low |

## Open Questions (for the user: ask, never infer)

Each has options and a recommendation. The planner must not lock the plan rows they touch until the user answers.

1. **Q1. Piece counts in descriptions («50PZ», «100 pz», «4PK», «40P», «300 Piezas»).** About 20 sample members carry them and several are multi-level («CJ 20 PAQ/50 PZ» means 20 packs of 50 or 50 per pack?).
   - A) Do not read piece counts; weight/volume only (**recommended**: unsized pieces fall to «por pieza, sin tamaño verificado» or «no normalizado», never a wrong price; the user can capture counts with the editor, which supports «piezas»).
   - B) Read only an unambiguous single «N PZ/PZA/PIEZAS».
   - C) Also read PK and P.
2. **Q2. Lines with a net amount of 0 or less** (100% discount, free items, symbolic amounts such as `0.000001`). Options: A) treat as not priced and show them in the purchases list as «no normalizado» with a new reason (**recommended**); B) keep them as price 0 (distorts minimum and saving). Needs final copy, suggestion: «La línea no tiene importe (descuento total o monto cero).»
3. **Q3. Exact default lists.** CONTEXT locks `1510xxxx` and segments 70–94. Recommended additions: gaseous fuels `151115xx` (e.g. `15111510` Gas licuado de petróleo, relevant for a café). Segment 95 (land/buildings) and `64` are not proposed. Confirm the addition, or keep strictly `1510` and `70–94`.
4. **Q4. Piece counts typed by the user and D-10.** If the user captures «6 piezas» for one purchase and another purchase of the same product has no size, is the second «no normalizado» (as D-10 does for kg/L) or compared as 1 piece? Recommended: a user-entered piece count counts as a size (the unsized one becomes «no normalizado»); only a product where nothing has any size is compared «por pieza, sin tamaño verificado».
5. **Q5. Tie-break when two families have the same number of purchases (D-12).** Recommended: the family with more distinct stores, then the fixed order kg, L, pieza. (Also the final tie-break of the cheapest store: Spanish alphabetical by store name.)
6. **Q6. Which ClaveUnidad count as «pieza».** D-09 names H87, XUN, XPK, E48. Recommended extras: `EA, ACT, XBX, X4G, XBJ, XBO, XBG, XCT, XCS, XPA, SET, KT, XKI`. Everything else (e.g. `MTR, HUR, DAY, MON, KWH`) is «La unidad «{clave}» no tiene equivalencia». `ACT` and `E48` only appear on service keys in the sample, so they matter only if the user flips such a product with «Volver a comparar».
7. **Q7. Where the D-17 default is evaluated.** Recommended: over all counted Ingreso purchases of the product, ignoring the active filters, so a product does not appear and disappear while filtering. Alternative: only the purchases inside the active filters.
8. **Q8. Missing UI copy** (UI-SPEC reasons table has no row for an unusable concept amount or a zero amount). Suggested: «El monto de la línea no es válido.» and the Q2 sentence. Also confirm the caps for the new persisted lists (suggested 2,000 corrections and 2,000 overrides; the planner sizes the 4 MB test).

Resolved by evidence and therefore not asked: the sample shows KGM text sizes must be ignored (D-09 already locks it); the thousands-dot rule for gram units (Pitfall 2, documented with its reading); pack words make a single size ambiguous (Pitfall 4).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Tests, tsc, scratch scripts | ✓ (via nvm; not on the default agent PATH) | v24.14.0 | `export PATH=$HOME/.nvm/versions/node/v24.14.0/bin:$PATH` |
| pnpm | Project scripts | ✓ (binary directory `~/Library/pnpm` exists; not on the agent shell PATH) | not probed | Add `~/Library/pnpm` to PATH |
| Sample XML (`Facturas/2025`) | `*.realdata.test.ts`, measurements | ✓ locally (gitignored) | 143 CFDI 4.0 (+ PDFs) | Tests skip when absent (`describe.skipIf`) |
| Network | Only during this research (SAT catalog mirror) | ✓ | — | Not needed at runtime or in CI |
| New packages / services / env vars | — | none required | — | — |

**Missing dependencies with no fallback:** none.

## Security Domain

`security_enforcement` is enabled (absent = enabled, ASVS level 1 in `.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing shared-password session |
| V3 Session Management | no (unchanged) | Existing signed cookie |
| V4 Access Control | no (no new route) | Existing proxy; this phase adds no API route |
| V5 Input Validation | yes | zod for the stored v4 settings and backup v3 (caps, bounded decimals as strings, integrity rules); the size reader treats descriptions as untrusted text (length cap, linear regexes); `parseDecimal` for XML amounts |
| V6 Cryptography | no | None added |
| V12 File handling | yes (existing backup upload) | `checkBackupSize` before reading; whole-file refusal on any schema failure (existing pattern) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution through RFC/description text (`__proto__`) | Tampering | `Map`/`Set` and `ruleMapKey`; lists of entries in settings (never records keyed by text) |
| Hostile or oversized settings file (huge arrays, huge numbers) | Denial of service / Tampering | `LIMITS` caps for the new lists, `max()` on arrays, bounded decimal strings (e.g. `amount` at most 1,000,000 with at most 6 decimals, `packs` 1..999), 4 MB gate, refuse whole file |
| ReDoS / slow regex on untrusted descriptions | Denial of service | Bounded quantifiers, no nested repetition, length cap before matching |
| Chart config injection from vendor text | Tampering | Static `ChartConfig` keys (`tienda1..6`, `otras`); names only as React text (T-02-19 precedent) |
| Vendor text rendered as HTML | Tampering / XSS | React text only; no `dangerouslySetInnerHTML` |
| Data leaving the browser | Information disclosure | No network call or LLM call in this phase; the backup file stores only descriptions, keys, supplier names and the user's corrections (no amounts, UUIDs, folios or dates) |

## Sources

### Primary (HIGH confidence)
- In-repo files read this session: `05-CONTEXT.md`, `05-UI-SPEC.md`, `REQUIREMENTS.md`, `STATE.md`, `src/domain/cfdi/types.ts`, `accounting/{amounts,breakdown,ledger,categories,view,filters,decimal}.ts`, `settings/{types,schema,migrate,backup,normalize,resolver,products(part)}.ts`, `stores/settingsStore.ts`, `features/dashboard/{TrendChart,useDashboardView,useLedger}.tsx`, `features/shell/AppShell.tsx`, `domain/settings/backup.test.ts` (sizing test), `node_modules/*/package.json` for versions, `node_modules/recharts/types/**` for marker and `data` props.
- Real sample `Facturas/2025/*.xml`: measured locally (counts and description strings only).

### Secondary (MEDIUM confidence)
- SAT `c_ClaveUnidad` (2,418 rows) and `c_ClaveProdServ` (52,513 rows) as published by the phpcfdi project: https://github.com/phpcfdi/resources-sat-catalogs (files `database/data/cfdi_40_claves_unidades.sql`, `database/data/cfdi_40_productos_servicios.sql`, fetched 2026-10-25). A third-party mirror of the official SAT catalogs, used for names and segment membership, not for legal interpretation.

### Tertiary (LOW confidence)
- Web search for the SAT unit catalog returned only general explanations (no source for GRM, MLT, E48, ACT, XUN, XPK, X4G); the catalog data above replaced it. Physical constants for LBR/ONZ/GLL are training knowledge (A1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new; versions read from `node_modules`.
- Architecture: HIGH for integration points (read the code), MEDIUM for Recharts multi-series wiring (types only).
- Unit and key tables: HIGH for names and membership (catalog data), MEDIUM for the packaging-extras judgment (Q6).
- Size reader: HIGH for the sample (executed), MEDIUM for coverage on future suppliers (Walmart-heavy abbreviations dominate).
- Pitfalls: HIGH where measured on the sample; Pitfall 5 is inferred from price plausibility.

**Research date:** 2026-10-25
**Valid until:** 2026-11-24 (stable domain; revisit only if the sample grows with new suppliers or the user answers change the lists)
