# Phase 3: Categorías propias y exportación a Excel - Context

**Gathered:** 2026-10-16
**Status:** Ready for planning

<domain>
## Phase Boundary

El usuario organiza el gasto en sus propias categorías: las crea, renombra y borra, asigna una categoría por defecto a cada proveedor y ajusta la de conceptos concretos. Esos ajustes persisten en localStorage y se pueden respaldar y restaurar con un archivo. En el Dashboard ve el ranking, el promedio mensual y la variación % mes contra mes por categoría, filtra por categoría y, con un clic en una categoría o un proveedor, ve sus facturas y conceptos. Además descarga un Excel de 6 hojas que respeta los filtros y el modo IVA. Requisitos: CAT-01, CAT-02, CAT-03, CAT-05, AJUS-01, AJUS-02, DASH-03, DASH-05, DASH-07, DASH-08, FILT-03, XLS-01, XLS-02, XLS-03.

Precedencia de categoría en esta fase: **ajuste del concepto > categoría del proveedor > "Sin categoría"**. El nivel "producto agrupado" (CAT-04) llega en la Fase 4.

Fuera de esta fase: el LLM y los productos agrupados (Fase 4), la comparación de precios (Fase 5), persistir facturas o exclusiones (D-30 de la Fase 2 sigue vigente).

</domain>

<decisions>
## Implementation Decisions

Las decisiones de la Fase 2 (02-CONTEXT.md D-01..D-48) siguen vigentes y no se repiten aquí. Las más relevantes: pestañas (D-01), barra de filtros (D-11, D-14), variación con colores y "Sin datos" (D-20), tabla de facturas con fila desplegable (D-24), monto por concepto según el modo IVA (D-25/D-38), filas "No suma" (D-27), proveedor por RFC (D-43) y store de ajustes `invoicechecker:settings` v1 (D-06).

### Gestión de categorías
- **D-01:** Una pestaña nueva **"Categorías"** se suma a Dashboard / Calidad de datos / Importación. Tiene dos secciones: la lista de categorías (crear, renombrar, borrar) y una tabla de proveedores con un selector de categoría por defecto en cada fila.
- **D-02:** La primera vez existen **9 categorías sugeridas, editables y borrables**: Insumos de cafetería · Abarrotes y despensa · Limpieza e higiene · Servicios (luz, agua, internet, teléfono) · Software y suscripciones · Comisiones bancarias · Mantenimiento y reparaciones · Papelería y oficina · Otros. "Sin categoría" no es una categoría del usuario: es el valor implícito y no se puede borrar ni renombrar.
- **D-03:** La tabla de proveedores muestra los proveedores de las **facturas cargadas y también los que tienen una categoría guardada** aunque hoy no estén cargados. Estos últimos se marcan "sin facturas cargadas" y se les puede quitar la asignación. Por eso el ajuste guarda el **nombre del proveedor junto al RFC**. — **Reversibility:** costly — forma parte del esquema persistido y del archivo de respaldo.
- **D-04:** Los nombres de categoría **no se repiten**: la comparación ignora mayúsculas y recorta espacios en los extremos. Hay un error en línea al crear o renombrar, y "Sin categoría" es un nombre reservado. Cada categoría tiene un id interno estable; las asignaciones apuntan al id, no al nombre, así que renombrar no rompe nada.
- **D-05:** Borrar una categoría **con asignaciones** abre un diálogo: "Borrar '{nombre}': la usan N proveedores y M conceptos. Pasarlos a: [Sin categoría ▾]" con el botón Borrar. Sin asignaciones, solo se pide confirmar. Después aparece el aviso "Categoría borrada · Deshacer", como D-29 de la Fase 2.

### Persistencia y respaldo (AJUS-01/02)
- **D-06:** Categorías, asignaciones de proveedor, ajustes de concepto y modo IVA viven en el store de ajustes persistido. El contrato `invoicechecker:settings` v1 (`{ ivaMode }`) **se migra** a una versión nueva con `migrate` y conserva el modo IVA. La lectura se valida con zod; si falla, se usan los valores por defecto. — **Reversibility:** one-way — es el esquema de localStorage de los usuarios y la base del archivo de respaldo; un cambio posterior exige otra migración.
- **D-07:** Los botones **"Descargar ajustes"** y **"Subir ajustes"** están en la pestaña Categorías. El archivo es JSON, se llama `invoicechecker-ajustes-AAAA-MM-DD.json` y contiene **todo**: categorías, asignaciones de proveedor (con nombre), ajustes de concepto y modo IVA, con un campo de versión. En la Fase 4 se le agregan los productos agrupados. — **Reversibility:** one-way — un archivo descargado es un contrato publicado: las versiones futuras deben poder leer los archivos v1 que el usuario ya guardó.
- **D-08:** Subir un archivo válido **reemplaza** los ajustes actuales tras confirmar. El diálogo resume el contenido ("9 categorías, 24 proveedores, 7 conceptos ajustados") y el botón dice "Reemplazar mis ajustes". Un archivo inválido se rechaza con un mensaje y **no toca** los ajustes actuales (criterio 2).

### Asignación por concepto
- **D-09:** Ajustar la categoría de un concepto guarda una **regla por RFC del proveedor + descripción normalizada**. Aplica a esa línea y a todas las líneas iguales de ese proveedor, en las facturas cargadas hoy y en cargas futuras. Las otras líneas de la misma factura no se tocan si su descripción es distinta (criterio 1). Al aplicar, el control dice cuántas líneas abarca ("Aplica a 12 líneas de Nueva Wal-Mart de México"). — **Reversibility:** costly — la clave de la regla forma parte del esquema persistido y del respaldo.
- **D-10:** Normalización de la descripción: se ignoran mayúsculas, espacios repetidos o en los extremos y **acentos**. Números y palabras sí cuentan: "Café  Molido 1kg" = "CAFE MOLIDO 1KG", pero "CAFE 1KG" ≠ "CAFE 500G".
- **D-11:** La categoría de un concepto se cambia **en la fila desplegable de la tabla de facturas del Dashboard** (D-24 de la Fase 2). Cada concepto muestra un selector pequeño. Si la categoría viene del proveedor, se ve en gris ("Limpieza e higiene · del proveedor"); si fue ajustada, se ve normal y con la opción "Quitar ajuste". No hay lista masiva de conceptos en la pestaña Categorías (eso es para la Fase 4).
- **D-12:** Una **nota de crédito** se clasifica con la misma regla que cualquier factura (ajuste del concepto > proveedor) y **resta de esa categoría**. No se hereda la categoría de la factura relacionada.

### Montos por categoría y filtro
- **D-13:** El monto de una factura **se reparte por concepto**: cada concepto suma a su categoría con su monto según el modo IVA (D-25/D-38 de la Fase 2). Si la suma de conceptos no da el monto de la factura (diferencia de redondeo, D-09 de la Fase 2), **la diferencia va a la categoría del proveedor**. Así la suma de todas las categorías siempre cuadra con el gasto total del Dashboard y del Excel.
- **D-14:** Con el filtro de categoría activo, **KPIs, tendencia y ranking de proveedores suman solo la parte de esas categorías**. La tabla muestra las facturas con al menos un concepto de esas categorías, con el monto de esa parte y debajo "de {total} total". Al abrir la fila, los conceptos de otras categorías se ven atenuados. El número de facturas cuenta las que tienen alguna línea de las categorías elegidas, y el ticket promedio = gasto parcial ÷ ese número.
- **D-15:** El filtro de categoría sigue el patrón de D-14 de la Fase 2: multiselección con casillas y buscador. Cada opción muestra el **número de facturas** con al menos una línea de esa categoría ("Limpieza e higiene (14)"), y **"Sin categoría" es una opción más**. Vive en el store de sesión y no se persiste.

### Vistas en el Dashboard (DASH-03/05/07/08)
- **D-16:** Un bloque **"Gasto por categoría"** se agrega **junto al ranking de proveedores**. Tiene barras horizontales de **todas** las categorías con gasto (monto y %) y, por categoría, el **promedio mensual** (mismo divisor que D-06/D-12 de la Fase 2) y la **variación % mes contra mes**. "Sin categoría" aparece siempre que tenga gasto.
- **D-17:** La variación % mes contra mes compara el **último mes del rango con el mes calendario anterior, aunque quede fuera del rango**, con los mismos filtros salvo la fecha (como D-20 de la Fase 2). Si ese mes no tiene gasto en la categoría o no hay facturas cargadas de ese mes, se muestra en gris "Sin dato del mes anterior"; nunca se calcula un % contra $0. Los colores siguen D-20.
- **D-18:** Hacer clic en una categoría (bloque D-16) o en un proveedor (ranking) **agrega ese valor como filtro** (etiqueta que se puede quitar) y lleva la vista a la tabla. No hay diálogo ni pantalla de detalle aparte (DASH-08).

### Excel (XLS-01/02/03)
- **D-19:** El botón **"Exportar a Excel"** está en la **barra superior**, junto a "Agregar facturas" (el lugar reservado en D-06 de la Fase 1), y solo aparece con facturas cargadas. El archivo se llama `gastos-AAAA-MM_AAAA-MM-{con|sin}-iva.xlsx`, con el rango y el modo (p. ej. `gastos-2025-01_2025-12-con-iva.xlsx`).
- **D-20:** Las hojas Facturas y Conceptos incluyen **todas las facturas del filtro, también las que no suman** (igual que la tabla, D-27/D-28 de la Fase 2). Una columna "Estado" dice "Suma" o el motivo por el que no suma (Pago, $0, Excluida, Sustituida, Datos inválidos, etc.), y en esas filas el monto que cuenta queda en 0 o vacío. La suma de la columna de monto cuadra con el Dashboard.
- **D-21:** Con el filtro de categoría activo, la hoja Conceptos lleva **solo las líneas de esas categorías**. La hoja Facturas lleva el monto de esa parte más una columna con el total de la factura (coherente con D-14).
- **D-22:** Columnas de monto: una columna **"Monto (con IVA)" o "Monto (sin IVA)" según el modo**, que es la que cuadra con el Dashboard, más el **desglose del XML** como referencia (Subtotal, Descuento, IVA, IEPS, Total). Conceptos lleva además cantidad, unidad, precio unitario, ClaveProdServ, Categoría y si la categoría viene del proveedor o fue ajustada.
- **D-23:** Las hojas de resumen repiten las cifras del Dashboard, cada una con una fila de total. **Por categoría:** monto, %, promedio mensual y variación % del último mes. **Por proveedor:** RFC, nombre, monto, %, número de facturas y ticket promedio. **Por mes:** una fila por mes del rango (incluidos los de $0) con el monto y el número de facturas. La hoja Parámetros lista los filtros activos y el modo IVA (XLS-01).
- XLS-03 aplica tal cual: montos como números con formato MXN, fechas como fechas y RFC, UUID, folio y ClaveProdServ como texto.

### Decisiones de la planeación (respuestas a 03-RESEARCH.md, 2026-10-16)
- **D-24:** La CSP de `next.config.ts` agrega `"worker-src 'self' blob:"` (Q-A). write-excel-file comprime con fflate y, cuando una parte del archivo pasa de 160,000 bytes sin comprimir, usa un Worker `blob:`; sin esta directiva el navegador cae a `script-src`, lo bloquea y `toBlob()` nunca termina (la hoja Conceptos real pasa ese límite). `script-src` no cambia. Además, la exportación compite `toBlob()` contra un tiempo límite: si vence o falla, el botón sale de «Exportando…» y aparece el aviso de error del UI-SPEC («No se pudo generar el Excel. Inténtalo de nuevo.»).
- **D-25:** Al migrar los ajustes guardados de la v1 (`{ ivaMode }`, Fase 2) a la versión nueva, el usuario **recibe las 9 categorías sugeridas** de D-02 y **conserva su `ivaMode`** (Q-B).
- **D-26:** La normalización de D-10 para la clave de la regla por concepto **quita los acentos (á→a, é→e, í→i, ó→o, ú→u, ü→u) pero conserva la ñ** como letra distinta de la n: «PEÑA» ≠ «PENA», y «Ñ» = «ñ» porque se ignoran mayúsculas (Q-C). Es distinta del buscador actual (`normalizeSearch`, que convierte la ñ en n) y queda fijada con pruebas. — **Reversibility:** costly — la clave forma parte del esquema persistido y del archivo de respaldo.
- **D-27:** Con el filtro de categoría, una factura **pertenece** a las categorías elegidas si **cualquier parte** de su monto cae en ellas: un concepto o la diferencia de redondeo que D-13 manda a la categoría del proveedor (Q-D). Así, elegir todas las categorías reproduce exactamente los totales sin filtro. Esta regla precisa D-14, D-21 y las líneas del UI-SPEC que dicen «al menos una línea» (encabezado «Facturas ({n})» y semántica del filtro): KPIs, tendencia y ranking suman todas las partes elegidas, también la diferencia de redondeo; la tabla, el número de facturas, el ticket promedio y la hoja Facturas del Excel incluyen esas facturas, y la hoja Conceptos lleva su línea «Diferencia de redondeo» (UI-SPEC Q7b). En el caso raro en que solo la diferencia (≤ 1 centavo en la muestra) cae en la selección, la factura aparece con ese monto y «de {total} total».
- **D-28:** El número junto a cada opción del filtro de categoría (D-15) usa **la misma regla de pertenencia que D-27**: cuenta las facturas con cualquier parte (concepto o diferencia de redondeo) en esa categoría, sobre todas las facturas cargadas sin importar los otros filtros (como dice el UI-SPEC). Precisa D-15 y la línea del UI-SPEC que dice «at least one line of that category».
- **D-29:** **No se agrega `fflate`** como dependencia directa (Q-E). Las pruebas del Excel son: pruebas unitarias de los constructores de cada hoja, una prueba de humo de que el archivo se genera (los bytes empiezan con «PK») y la revisión manual en Excel (fechas, texto y montos) que ya pide el UI-SPEC.
- **D-30:** Límites al validar el archivo de respaldo y los ajustes guardados (Q-F): como máximo 200 categorías, 5,000 asignaciones de proveedor, 20,000 reglas de concepto, nombres de categoría de 60 caracteres y un archivo de 1 MB (este último ya estaba en el UI-SPEC). Un archivo que los rebase es inválido (D-08).

### Claude's Discretion
- Textos exactos de diálogos, avisos y etiquetas, más allá de los citados.
- Orden de la lista de categorías y de la tabla de proveedores (sugerido: categorías en orden alfabético con "Otros" al final; proveedores por gasto o por nombre).
- Distribución visual fina del bloque "Gasto por categoría" junto al ranking (D-16) y su comportamiento en móvil; el UI-SPEC de la fase puede afinarla.
- Formato exacto del JSON de respaldo y del esquema persistido, dentro de D-06/D-07 (id estable por categoría, versión explícita, validación zod).
- Orden y nombres exactos de las columnas del Excel, dentro de D-20..D-23.
- **Inferido, confirmar en planeación si hay duda:** la pestaña Categorías se ve solo con facturas cargadas, como las demás pestañas de D-01 (la pantalla vacía no cambia); la posición de la pestaña Categorías (sugerido: después de Dashboard); si las filas "No suma" llevan categoría en la tabla y el Excel (sugerido: sí, como informativa). → **Resuelto en 03-UI-SPEC.md:** Q2 (la pestaña se ve solo con facturas cargadas; orden Dashboard · Categorías · Calidad de datos · Importación) y Q6 (las filas «No suma» y «Excluida» llevan su categoría como informativa y su selector funciona).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Proyecto y alcance
- `.planning/PROJECT.md` — Key Decisions definitivas: precedencia concepto > producto > proveedor, ajustes en localStorage, reglas de montos.
- `.planning/REQUIREMENTS.md` — CAT-01/02/03/05, AJUS-01/02, DASH-03/05/07/08, FILT-03, XLS-01/02/03.
- `.planning/ROADMAP.md` §Phase 3 — Goal, 5 criterios de éxito y research flag (confirmar en ejecución real write-excel-file `/universal`; la API de TanStack v9 ya se usa en las fases 1–2).
- `.planning/phases/02-dashboard-de-gasto-confiable/02-CONTEXT.md` — D-01 (pestañas), D-06 (contrato del store de ajustes), D-11/D-14 (filtros), D-20 (variación), D-24/D-25/D-38 (tabla y monto por concepto), D-27/D-28 (filas No suma/Excluida), D-43 (proveedor por RFC).
- `.planning/phases/02-dashboard-de-gasto-confiable/02-UI-SPEC.md` — Lineamientos visuales vigentes del Dashboard.
- `.planning/phases/01-acceso-protegido-y-carga-de-facturas/01-CONTEXT.md` — D-06 (barra superior: lugar del botón de exportación).

### Stack e investigación
- `.claude/CLAUDE.md` §Excel export — write-excel-file 4.1.1 desde `write-excel-file/universal`, constructores de hoja como funciones puras, celdas `Number` con `"$#,##0.00"`, `Date` con `"dd/mm/yyyy"`, texto con `format: "@"`, descarga con `URL.createObjectURL`.
- `.claude/CLAUDE.md` §State management — zustand `persist` con `version`, `migrate`, `partialize`, `skipHydration` y validación zod.
- `.planning/research/ARCHITECTURE.md` — Capa contable pura y selectores filtrados compartidos (los mismos alimentan gráficas, tablas y Excel).
- `.planning/research/PITFALLS.md` — Migración de localStorage, redondeo y conciliación de totales.
- `.planning/research/FEATURES.md` — Expectativas de categorías y exportación.

### Datos de ejemplo
- `Facturas/2025/*.xml` — 143 CFDI reales (fuera de git; no copiar sin anonimizar). Unos 30 proveedores; Walmart (39 facturas) es el caso típico de factura con conceptos de varias categorías.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/settingsStore.ts`: el único store persistido (`invoicechecker:settings`, v1, `{ ivaMode }`) con `safeStorage` en try/catch, validación zod del sobre y `skipHydration`. Aquí van las categorías y asignaciones, con `migrate` desde v1.
- `src/stores/sessionStore.ts`: filtros (`Filters`), exclusiones y `activeTab` (`AppTab`). Hace falta agregar el filtro de categoría y el valor de pestaña `categorias`.
- `src/domain/accounting/filters.ts` (`applyFilters`, `supplierOptions`, `formaOptions`, `previousFilters`) y `aggregate.ts` (`entryAmount`, `kpis`, `monthlySeries`, `supplierRanking`, `deltaFraction`): base de los selectores filtrados. El reparto por categoría (D-13/D-14) cambia el monto que cuenta cada entrada cuando hay filtro de categoría.
- `src/domain/accounting/ledger.ts` (`LedgerEntry`, `NoSuma`, `Exclusion`): la columna "Estado" del Excel (D-20) sale de aquí.
- `src/features/dashboard/MultiSelectFilter.tsx` y `FilterBar.tsx`: patrón del filtro de categoría (D-15).
- `src/features/dashboard/SupplierRanking.tsx` + `SupplierDialog.tsx`: patrón de barras horizontales para el bloque por categoría (D-16) y punto donde el clic agrega un filtro (D-18).
- `src/features/invoices/InvoiceTable.tsx` + `columns.ts`: tabla con fila desplegable; aquí va el selector de categoría por concepto (D-11).
- `src/features/shell/AppShell.tsx` (`TABS`, `isAppTab`) y `TopBar.tsx`: pestaña nueva (D-01) y botón de exportación (D-19).
- `src/features/report/*`, `src/features/quality/*`: patrón de tarjetas y acordeones, si se necesita.
- `src/lib/format.ts`, `src/lib/copy/es.ts`, `src/lib/copy/messages.ts`: formato es-MX y textos.

### Established Patterns
- Dominio puro en `src/domain/*` con pruebas Vitest al lado; features en `src/features/*`; textos en `src/lib/copy`.
- Pruebas con fixtures anonimizados y con datos reales (`*.anon.test.ts`, `*.realdata.test.ts`). Sirven para probar que el total por categorías y el del Excel cuadran con el Dashboard.
- big.js para toda la aritmética; el redondeo solo al mostrar o escribir la celda.
- TypeScript estricto: sin `any`, sin `!`, sin `as` sin validar (CLAUDE.md raíz). El JSON de respaldo y el localStorage se validan con zod.

### Integration Points
- **Falta instalar `write-excel-file`** (4.1.1, importado desde `/universal`); hay que aprobar el paquete.
- Probablemente faltan componentes shadcn: dialog/alert-dialog (borrar, reemplazar ajustes), select o combobox (selector de categoría), input. Verificar en `src/components/ui/`.
- La migración del store de ajustes v1 → v2 tiene que conservar el `ivaMode` de los usuarios actuales.

</code_context>

<specifics>
## Specific Ideas

- Caso guía del criterio 1: una línea "CLORO 1L" de Walmart pasa a "Limpieza e higiene" y el resto del ticket sigue en la categoría de Walmart.
- Las 3 notas de crédito de la muestra (Google, anticipos) restan de la categoría de Google.
- Ejemplo de nombre de Excel: `gastos-2025-01_2025-12-con-iva.xlsx`; ejemplo de respaldo: `invoicechecker-ajustes-2026-10-16.json`.

</specifics>

<deferred>
## Deferred Ideas

- Lista masiva de descripciones de conceptos por proveedor para clasificar en bloque: se descartó para esta fase; la Fase 4 (productos agrupados por el LLM) cubre esa necesidad.
- Ajuste de una sola línea exacta (por UUID + número de concepto) además de la regla por descripción: se descartó; se usa solo la regla por descripción (D-09).
- Combinar un archivo de ajustes con los actuales (en vez de reemplazar): se descartó; solo se reemplaza (D-08).

</deferred>

---

*Phase: 03-categorias-propias-y-exportacion-a-excel*
*Context gathered: 2026-10-16*
