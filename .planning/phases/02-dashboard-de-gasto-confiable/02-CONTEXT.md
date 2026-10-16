# Phase 2: Dashboard de gasto confiable - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Con las facturas ya cargadas (Fase 1), el usuario ve en qué gasta y cuánto en promedio: KPIs (gasto total, número de facturas, ticket promedio, promedio mensual), tendencia mensual, ranking de proveedores y una tabla ordenable de facturas con sus conceptos. Los montos siguen las reglas acordadas (I suma, E resta en el mes de su factura relacionada, P/T/N no suman, con/sin IVA, $0 fuera de conteos, excluidas, TipoCambio, big.js, mes por fecha literal). Hay filtros consistentes por fecha/mes, proveedor y forma de pago (con la forma real de las PPD) y un panel de calidad de datos. Requisitos: REGLA-01..09, DASH-01, DASH-02, DASH-04, DASH-06, DASH-09, DASH-10, FILT-01, FILT-02, FILT-04, FILT-05, CAL-01, DEV-03.

Fuera de esta fase: categorías y todo lo que depende de ellas (DASH-03, DASH-05, DASH-07, DASH-08, FILT-03, CAT-*), persistencia de ajustes y respaldo (AJUS-*), Excel (XLS-*), LLM, comparación de precios.

</domain>

<decisions>
## Implementation Decisions

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

### Decisiones de planeación (respuestas a las Open Questions de 02-RESEARCH.md, 2026-10-14)
- **D-34:** Nota de crédito con varias facturas relacionadas cargadas en meses distintos: se imputa al mes de la relacionada con la **fecha más antigua**. El texto de la fila en Calidad lo explica.
- **D-35:** Factura con montos no numéricos o `Fecha` mal formada: **se carga pero no suma** (no se rechaza en el parser). Es un tipo de incidencia nuevo, adicional a D-32: título **"Datos inválidos"** (tarjeta y acordeón), texto de fila **"{Campo} inválido: no se suma"**. **Cambia montos**: su acordeón se abre por defecto, activa el aviso de D-04 y va justo después de "Moneda sin tipo de cambio". El motor de reglas nunca debe lanzar error en el render por estos valores.
- **D-36:** `ParsedInvoice` gana un campo **adicional** con los Traslados y Retenciones a nivel factura (`Comprobante/Impuestos`); el IEPS se toma de ahí. Nada del comportamiento de la Fase 1 cambia.
- **D-37:** "Factura en $0" se decide **solo por el Total convertido**, sin importar el modo IVA; el conteo de facturas nunca cambia con el selector.
- **D-38:** Monto "con IVA" de un concepto = importe − descuento + Σ traslados − Σ retenciones (cuadra con el Total), en lugar del literal de D-25.
- **D-39:** Ticket promedio sin facturas que cuenten: se muestra **"—"**.
- **D-40:** Porcentajes con espacio: **"12.4 %"**, como en el UI-SPEC (no el `12.4%` de `Intl`).
- **D-41:** El rango por defecto (D-12) se calcula con **todas las facturas cargadas** (incluye P, $0 y excluidas). Excepción: D-48 (año de la Fecha fuera de la ventana).
- **D-42:** Si la factura que sustituye (04) está excluida o vale $0, la original **sigue "Sustituida"** (D-08 literal); el usuario puede "Volver a incluir".
- **D-43:** El proveedor se identifica **por RFC** en filtros y ranking.
- **D-44:** Toda carga terminada abre Dashboard, aunque no agregue facturas nuevas, salvo que la sesión no tenga ninguna factura (entonces abre Importación).
- **D-46:** (Afina D-34) Tipo de incidencia nuevo **"Notas de crédito con varias relacionadas"**, para notas de crédito cuyas relacionadas cargadas caen en meses distintos. Es **informativa** (la nota sí resta): su acordeón va cerrado y no activa el aviso de D-04. Texto de fila: **"Aplica a {mes}: la relacionada más antigua de {n}"**.
- **D-47:** (Afina D-35) El texto de fila de "Datos inválidos" concuerda en género con el campo: "Fecha inválida: no se suma", "Total inválido: no se suma".
- **D-45:** Se aceptan para v1 las etiquetas de c_FormaPago y la semántica de TipoRelación 04/07 de 02-RESEARCH.md (espejo phpcfdi y fuentes secundarias); se pueden confirmar después contra el catCFDI y el Anexo 20 oficiales.
- **D-48:** (Excepción a D-41, decidida en la UAT del 2026-10-16, WR-03) Una `Fecha` cuyo año queda fuera de la ventana **2000 a (año actual + 1)**, con ambos extremos incluidos, se trata como una `Fecha` inválida: si la factura es Ingreso o Egreso va a "Datos inválidos" (campo Fecha) con el texto que ya existe, "Fecha inválida: no se suma", y no suma; si es Pago, Traslado o Nómina sigue como "No suma" por su tipo, sin incidencia nueva. Ninguna de esas facturas cuenta para el rango por defecto (D-12/D-41), así que no estira la lista de meses, la gráfica ni el divisor del promedio mensual. Una nota de crédito cuya factura relacionada tiene la fecha fuera de la ventana se resta en el mes de otra relacionada válida o en su propia fecha. El año actual es el año local del navegador, que `useLedger` lee una vez al montar y pasa al dominio como parámetro; la `Fecha` nunca se convierte en un objeto `Date`.

### Claude's Discretion
- Columnas exactas de la tabla y orden por defecto (sugerido: fecha, de la más reciente a la más antigua).
- Qué hacer en "Ver factura" si los filtros activos ocultan esa fila (p. ej. quitar filtros o avisar).
- Colores exactos de la variación (neutro o rojo al subir) y la distribución visual fina; el UI-SPEC de la fase puede afinarlas.
- Textos exactos de avisos y etiquetas, más allá de los citados.
- **Inferido, confirmar en planeación si hay duda:** al agregar facturas, el rango por defecto (D-12) se recalcula si el usuario no tocó el filtro de fechas; el periodo anterior (D-20) aplica los mismos filtros de proveedor y forma de pago; las filas "No suma" (D-27) respetan los filtros; el detalle de una PPD puede mostrar "pagada el <fecha> con <forma>" a partir de su complemento.
- Estructura del motor de reglas (capa contable pura separada del parser) y de los selectores filtrados compartidos.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Proyecto y alcance
- `.planning/PROJECT.md` — Key Decisions definitivas de montos (sin IVA, notas de crédito, $0, promedio mensual, Excluir, TipoCambio, big.js).
- `.planning/REQUIREMENTS.md` — REGLA-01..09, DASH-01/02/04/06/09/10, FILT-01/02/04/05, CAL-01, DEV-03.
- `.planning/ROADMAP.md` §Phase 2 — Goal, criterios de éxito y research flag (c_FormaPago en catCFDI y semántica de TipoRelación 04/07 en el Anexo 20).
- `.planning/phases/01-acceso-protegido-y-carga-de-facturas/01-CONTEXT.md` — D-06 (barra superior), D-19 (patrón de tarjetas + acordeones), D-23 (TanStack v9, orden por fecha ISO literal).
- `.planning/phases/01-acceso-protegido-y-carga-de-facturas/01-UI-SPEC.md` — Tokens y lineamientos visuales vigentes.

### Stack e investigación
- `.claude/CLAUDE.md` — Stack fijado: Recharts 3 vía shadcn chart, zustand `persist` con `skipHydration` + zod, date-fns `es`, `Intl.NumberFormat es-MX`, TanStack Table v9. Nota: su recomendación de centavos enteros queda **reemplazada** por big.js (PROJECT.md / REGLA-04).
- `.planning/research/PITFALLS.md` — Pitfall 3 (notas de crédito 07 / sustitución 04), Pitfall 4 (PPD vs PUE y complementos de Pago), redondeo, zona horaria.
- `.planning/research/ARCHITECTURE.md` — Capa contable pura separada del parser; selectores filtrados compartidos.
- `.planning/research/FEATURES.md` — Expectativas de dashboard y calidad de datos.

### Datos de ejemplo
- `Facturas/2025/*.xml` — 143 CFDI reales (fuera de git; no copiar sin anonimizar). Perfil: 0 con retenciones, 10 con IEPS, FormaPago {01:1, 03:41, 04:16, 28:62, 30:3, 31:5, 99:8}, 8 PPD, TipoRelación {04:1, 07:6}, ene–abr con 1 factura por mes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/cfdi/types.ts` (`ParsedInvoice`, `Concepto`, `Impuesto`, `CfdiRelacionados`, `Pago`): ya trae todo lo que necesitan las reglas (descuento, traslados/retenciones por concepto, tipoCambio, relacionados, pagos con `formaDePagoP` y `doctos`). Los montos son cadenas exactas del XML, listas para big.js.
- `src/stores/sessionStore.ts`: store zustand en memoria con `generation`; aquí van los filtros y las exclusiones de la sesión.
- `src/features/shell/TopBar.tsx`: hueco `data-slot="topbar-center"` reservado para el selector de IVA.
- `src/features/shell/AppShell.tsx`: hoy muestra reporte + `InvoiceTable`; pasa a pestañas (D-01).
- `src/features/invoices/InvoiceTable.tsx` + `columns.ts`: base TanStack v9 (orden y paginación de 50); se reemplaza por la tabla con filas desplegables (D-02, D-24).
- `src/features/report/*` (`SummaryCards`, `ReportAccordions`): patrón de tarjetas + acordeones para Calidad de datos (D-31).
- `src/lib/format.ts`, `src/lib/copy/es.ts`: formato es-MX y textos en español.
- `src/components/ui/*`: hay accordion, alert, badge, button, card, table, tooltip, etc. Faltan tabs, chart, popover/command (multiselección con buscador), dropdown-menu (menú "⋯") y toggle-group.

### Established Patterns
- Dominio puro en `src/domain/*` con pruebas Vitest al lado; features en `src/features/*`; textos en `src/lib/copy`.
- Fixtures anonimizados y prueba con datos reales (`parseCfdi.anon.test.ts`, `parseCfdi.realdata.test.ts`) → modelo para DEV-03 (reglas de montos).
- TypeScript estricto: sin `any`, sin `!`, sin `as` sin validar (CLAUDE.md raíz).

### Integration Points
- **Aún no instalados:** `big.js` (+ tipos) y `recharts` (vía `shadcn add chart`). Se necesita aprobar los paquetes, como en la Fase 1.
- El store de ajustes persistido (modo IVA, D-06) es el primero en localStorage; la Fase 3 lo extiende con categorías.
- Los selectores filtrados de esta fase deben alimentar después las vistas por categoría y el Excel (Fase 3), así que tienen que ser funciones puras compartidas.

</code_context>

<specifics>
## Specific Ideas

- Con la muestra de 2025: el rango por defecto es ene–dic, el promedio mensual divide entre 12, y la comparación con el periodo anterior muestra "Sin datos del periodo anterior".
- Las 3 notas de crédito de la muestra son aplicaciones de anticipo de Google (TipoRelación 07, FormaPago 30); en el ranking, Google debe aparecer con su gasto neto.
- La forma de pago se muestra siempre con nombre ("Tarjeta de débito", "Transferencia electrónica de fondos"), nunca con el código.

</specifics>

<deferred>
## Deferred Ideas

- Recordar exclusiones entre sesiones (por UUID en localStorage) — el usuario lo descartó por ahora; se podría reconsiderar junto con el respaldo de ajustes (Fase 3, AJUS-02).
- Capturar a mano un tipo de cambio para facturas en moneda extranjera sin TipoCambio — descartado; por ahora no suman y se avisa.

</deferred>

---

*Phase: 02-dashboard-de-gasto-confiable*
*Context gathered: 2026-10-14*
