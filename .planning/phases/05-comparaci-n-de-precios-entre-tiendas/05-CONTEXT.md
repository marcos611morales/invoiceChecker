# Phase 5: Comparación de precios entre tiendas - Context

**Gathered:** 2026-10-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Una pestaña nueva **«Precios»** muestra, por cada producto agrupado (Fase 4), el precio unitario neto normalizado ($/kg, $/L o $/pieza) en cada tienda: mínimo, mediana, último y número de compras. También muestra la tienda más barata, un ahorro estimado (por producto y en total) y el historial de precio en el tiempo. Solo compara cantidades de la misma familia de unidad. Lo que no se puede normalizar se marca «no normalizado». Servicios, combustible y comisiones quedan fuera por defecto con una marca «no comparable» que el usuario puede cambiar. Requisitos: PREC-01..PREC-06.

Fuera de la fase: cambiar cómo se agrupan los productos (la cola de revisión de la Fase 4) y agregar la comparación al Excel.

</domain>

<decisions>
## Implementation Decisions

Siguen vigentes las decisiones de las Fases 1–4 (01..04-CONTEXT.md). Las más relevantes aquí:
- Pestañas visibles solo con facturas cargadas (Fase 3 D-01, Fase 4 D-01).
- Monto por concepto según el modo IVA (Fase 2 D-25/D-38).
- Filas que «no suman» (Fase 2 D-27) y proveedor identificado por RFC (Fase 2 D-43).
- Tabla con fila desplegable, TanStack v9 (Fase 2 D-24).
- Aviso «Deshacer» (Fase 2 D-29, Fase 3 D-05).
- Store persistido versionado con `migrate` y zod, y archivo de respaldo como contrato publicado (Fase 3 D-06/D-07/D-30, Fase 4 D-13/D-31).
- Miembro de producto = RFC + descripción normalizada (Fase 4 D-09); un miembro pertenece a un solo producto (Fase 4 D-10).

### Dónde y qué se compara
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

### Unidades y presentaciones (PREC-02)
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

### Marca «no comparable» (PREC-03)
- **D-16:** El valor **por defecto** sale de la **clave SAT (`ClaveProdServ`)**. Se marcan no comparables los **combustibles (1510xxxx)** y los **segmentos de servicios del catálogo (70–94)**: telecomunicaciones, servicios financieros y comisiones, publicidad, mantenimiento, transporte, etc. El research afina la lista exacta con las claves reales (p. ej. 84111506 = comisiones/anuncios, 15101514 = gasolina). No depende de las categorías del usuario.
- **D-17:** Si los miembros de un producto tienen claves mixtas, por defecto el producto es **comparable si alguna de sus compras tiene clave de producto**. Solo es no comparable por defecto si **todas** sus compras tienen clave de servicio o combustible.
- **D-18:** El usuario cambia la marca **en Precios, por producto**, con un menú «⋯» en la fila: **«Marcar como no comparable»** y **«Volver a comparar»**, con aviso «Deshacer». Los no comparables están ocultos por defecto. Con la casilla «Mostrar los no comparables» aparecen atenuados y se les puede quitar la marca.
- **D-19:** Solo se guarda **lo que el usuario cambió respecto al valor por defecto**, por **id de producto**, en los ajustes v4 y en el archivo de respaldo (mismo cambio de versión que D-15). — **Reversibility:** one-way — forma parte del mismo esquema persistido y contrato de respaldo que D-15.

### Ahorro estimado e historial (PREC-04, PREC-05, PREC-06)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Proyecto y alcance
- `.planning/ROADMAP.md` §Phase 5: meta, 4 criterios de éxito y research flag (normalización de unidades con ClaveUnidad SAT y presentaciones en la descripción; familias de ClaveProdServ «no comparables»).
- `.planning/REQUIREMENTS.md`: PREC-01..PREC-06; FILT-05 (los filtros aplican a todo); REGLA-01/03/04 (qué suma, modo IVA, big.js).
- `.planning/PROJECT.md`, Key Decisions: «Servicios/combustible excluidos de comparación de precios»; «Ajustes en localStorage»; privacidad.
- `.planning/STATE.md` §Blockers/Concerns: «[Phase 5]: Investigar normalización de unidades y familias ClaveProdServ "no comparables" por defecto».

### Decisiones previas
- `.planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-CONTEXT.md`: D-01 (pestaña Productos), D-09/D-10 (miembro = RFC + clave, un producto por miembro), D-13/D-31 (ajustes v3 y respaldo de 4 MB), D-14 (lista de productos), D-15 (quitar miembro lo deja libre).
- `.planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-CONTEXT.md`:
  - D-01: pestañas.
  - D-05: deshacer.
  - D-06/D-07/D-08: store persistido y respaldo.
  - D-09/D-10/D-26: clave normalizada.
  - D-14/D-27: filtro de categoría por parte del monto.
  - D-30: límites.
- `.planning/phases/02-dashboard-de-gasto-confiable/02-CONTEXT.md`:
  - D-24: tabla con fila desplegable.
  - D-25/D-38: monto por concepto según IVA.
  - D-27: «No suma».
  - D-43: proveedor por RFC.

### Stack e investigación
- `.claude/CLAUDE.md` §Charting (Recharts 3 vía shadcn chart), §Table/filter (TanStack Table v9 con filtros globales en zustand) y §State management (persist con `version`/`migrate`/zod).
- `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md` y `.planning/research/ARCHITECTURE.md`: expectativas de comparación de precios y capa de dominio pura.

### Datos de ejemplo
- `Facturas/2025/*.xml`: 143 CFDI reales, fuera de git; no copiar sin anonimizar.
  - ClaveUnidad vistas: H87 (253), E48 (50), KGM (18), ACT (16), XUN (15), XPK (6), LTR (3), X4G (1).
  - En Walmart casi todo es H87 × 1 con la presentación dentro de la descripción («12/1L ALPURA», «2KG MANGO MM», «LECHERA 375G», «1.730K MAYON»).
  - KGM con cantidades fraccionarias («MAN GALA» 4.605, «JAMON ZWAN VIRGINIA1X1KG» 0.27).
  - LTR solo para gasolina («MAGNA», 15101514).
  - XUN con cantidades de varias piezas sin tamaño («Leche LacDel Desla» × 6).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/cfdi/types.ts` (`Concepto`): ya trae `claveProdServ`, `cantidad`, `claveUnidad`, `unidad`, `valorUnitario` y `descuento` como texto.
- `src/domain/accounting/breakdown.ts` (`conceptBreakdown`): da el monto por concepto según el modo IVA, la base del precio unitario (D-04).
- `src/domain/accounting/ledger.ts` (`buildLedger`, `LedgerEntry`, `NoSuma`, `Exclusion`): sirve para saber qué facturas suman (D-06).
- `src/domain/accounting/filters.ts` (`applyFilters`) y `view.ts` (`selectView`, `effectiveSelection`): filtros globales (D-03).
- `src/domain/accounting/decimal.ts`: aritmética big.js (REGLA-04).
- `src/domain/settings/{types,schema,migrate,backup,products,normalize}.ts`: `Product`/`ProductMember`, ajustes v3, migración, respaldo y normalización de la clave. Aquí se agregan las correcciones de contenido y la marca «no comparable» (v4).
- `src/domain/settings/resolver.ts` (`makeResolver`): categoría de cada concepto, para el filtro de categoría.
- `src/features/dashboard/TrendChart.tsx` + `src/components/ui/chart.tsx`: patrón de gráfica Recharts/shadcn para el historial (D-24).
- `src/features/dashboard/useDashboardView.ts`, `useLedger.ts` y `FilterBar.tsx`: hooks del ledger y de la vista filtrada.
- La tabla de facturas con fila desplegable (`src/features/invoices/*`) y `src/components/SortHeaderButton.tsx`: patrón de D-07.
- `src/features/products/ProductList.tsx`: lista de productos aceptados.
- `src/features/categories/*`: patrones de deshacer.
- `src/features/shell/AppShell.tsx` (`TABS`) y `src/stores/sessionStore.ts` (`AppTab`): pestaña nueva.
- `src/lib/copy/es.ts`: textos.
- `src/lib/format.ts`: formato MXN.

### Established Patterns
- El dominio es puro en `src/domain/*` con pruebas Vitest al lado; las features van en `src/features/*`. Hay pruebas `*.anon.test.ts` y `*.realdata.test.ts`.
- Lo persistido son listas de entradas (no records con clave de RFC o descripción), validadas con zod y con límites. Cada cambio de versión lleva `migrate` y conserva lo anterior.
- TypeScript estricto: sin `any`, sin `!` y sin `as` sin validar.
- Los montos se calculan con big.js y se redondean solo al mostrar.

### Integration Points
- Pestaña nueva en `TABS`, junto a Productos.
- Ajustes v3 → v4 (correcciones de contenido + overrides «no comparable») y el archivo de respaldo.
- Sin dependencias nuevas previstas: Recharts, TanStack Table, zod y big.js ya están instalados.

</code_context>

<specifics>
## Specific Ideas

- Casos guía de normalización (de los datos reales):
  - «12/1L ALPURA» = 12 L.
  - «2KG MANGO MM» = 2 kg.
  - «LECHERA 375G» = 0.375 kg.
  - «1.730K MAYON» = 1.73 kg.
  - «12/355CCSAB» = 12 × 355 mL.
  - «JAMON ZWAN VIRGINIA1X1KG» en KGM × 0.27 = 0.27 kg (manda la cantidad del XML, no el «1KG» del texto).
  - «Leche LacDel Desla» XUN × 6 sin tamaño = 6 piezas sin tamaño.
- Gasolina («MAGNA», 15101514, LTR) y Google Ads/comisiones (84111506, ACT) son el ejemplo de lo que queda «no comparable» por defecto.

</specifics>

<deferred>
## Deferred Ideas

- Agregar la comparación de precios al Excel. La anotó Claude y no se discutió con el usuario: XLS-01 no la incluye, así que sería una hoja nueva en otra fase si el usuario la pide.

### Reviewed Todos (not folded)
- `.planning/todos/pending/auto-accept-product-suggestions.md`: «Auto-aceptar las sugerencias de producto de DeepSeek, que se puedan editar». Cambia la cola de revisión de la Fase 4, no la comparación de precios. El usuario decidió dejarla fuera de la Fase 5; queda pendiente para una tarea rápida aparte (`/gsd-quick`).

</deferred>

---

*Phase: 05-comparaci-n-de-precios-entre-tiendas*
*Context gathered: 2026-10-25*
