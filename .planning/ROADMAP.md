# Roadmap: InvoiceChecker

## Overview

InvoiceChecker se construye en cinco rebanadas verticales, cada una utilizable de punta a punta en Vercel. Primero se protege el acceso y se cargan los XML en el navegador con un reporte de importación confiable; después se calcula el gasto con las reglas fiscales correctas y se muestra en un dashboard filtrable ("en qué gastamos más" por proveedor y por mes); luego el usuario organiza el gasto en sus propias categorías, que persisten y se respaldan, y se lleva el análisis a Excel; con esa base, DeepSeek agrupa los conceptos equivalentes entre tiendas y sugiere categorías, siempre bajo revisión del usuario; y por último se compara el precio unitario de cada producto entre tiendas ("dónde nos sale más barato"). El dashboard determinista va antes del LLM para tener una línea base contra la cual juzgar sus sugerencias, y la agrupación va antes de la comparación de precios porque sin productos agrupados no hay nada comparable entre tiendas. Las decisiones registradas en PROJECT.md (Key Decisions) son definitivas.

## Phases

**Numeración de fases:**
- Fases enteras (1, 2, 3): trabajo planeado del milestone
- Fases decimales (2.1, 2.2): inserciones urgentes (marcadas con INSERTED)

Las fases decimales aparecen entre sus enteros vecinos en orden numérico.

- [x] **Phase 1: Acceso protegido y carga de facturas** - Contraseña compartida, app desplegada en Vercel y carga de XML en el navegador con reporte de importación (completed 2026-10-14)
- [ ] **Phase 2: Dashboard de gasto confiable** - Reglas de montos (I/E/P, con/sin IVA, $0, excluidas), KPIs, tendencia mensual, ranking por proveedor, filtros y calidad de datos
- [ ] **Phase 3: Categorías propias y exportación a Excel** - Categorías editables por proveedor y por concepto, persistidas y respaldables, vistas por categoría y Excel de varias hojas
- [ ] **Phase 4: Agrupación de productos con DeepSeek** - Agrupación de "mismo producto" y sugerencias de categoría por una ruta protegida, con cola de revisión
- [ ] **Phase 5: Comparación de precios entre tiendas** - Precio unitario neto por producto y tienda, tienda más barata, ahorro estimado e historial de precio

## Phase Details

### Phase 1: Acceso protegido y carga de facturas

**Goal:** El dueño, sus socios y su contador entran con la contraseña compartida a la app desplegada en Vercel, sueltan sus XML y obtienen un reporte de importación confiable, sin que las facturas salgan del navegador.
**Mode:** mvp
**Depends on**: Ninguna (primera fase)
**Requirements**: DEV-01, DEV-02, DEV-04, ACC-01, ACC-02, CARGA-01, CARGA-02, CARGA-03, CARGA-04, CARGA-05, CARGA-06
**Success Criteria** (what must be TRUE):
  1. Al abrir la URL de Vercel sin sesión, cualquier página lleva al login; con la contraseña correcta el usuario entra y sigue dentro al recargar o volver después; con "Cerrar sesión" regresa al login.
  2. El usuario arrastra la carpeta `Facturas/2025/` (o selecciona varios archivos) y ve el reporte de importación con 143 XML cargados (133 Ingreso, 3 Egreso, 7 Pago) y los 143 PDF listados como ignorados, sin que ninguna petición de red lleve el contenido de los XML.
  3. Un CFDI 3.3 o un XML que no es CFDI aparece rechazado con un mensaje claro por archivo, y volver a soltar una factura ya cargada (mismo UUID) la reporta como duplicada sin contarla dos veces.
  4. Al recargar la página las facturas ya no están y la app pide volver a cargarlas.
  5. `pnpm lint` y `pnpm typecheck` pasan sin errores en el proyecto Next.js + TypeScript strict administrado con pnpm, y `.env.example` documenta las variables necesarias para desplegar en Vercel.

**Plans:** 16/16 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Walking skeleton: aprobación de paquetes, scaffold, candado con contraseña (proxy + jose), elegir carpeta → parseo en el navegador → conteos, cerrar sesión

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Parser completo: conceptos con sus impuestos, CfdiRelacionados y Pagos; variantes de BOM y prefijos
- [x] 01-03-PLAN.md — Kit shadcn base-nova, tokens del UI-SPEC, tema que sigue al sistema y textos es-MX

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-04-PLAN.md — Cada motivo de rechazo probado y mostrado en español por archivo
- [x] 01-05-PLAN.md — Regresión con la muestra real, fixtures anonimizados y guardia contra fugas
- [x] 01-06-PLAN.md — Tarjeta de login del UI-SPEC con mostrar/ocultar contraseña
- [x] 01-07-PLAN.md — Botón de tema y barra superior fija con "Cerrar sesión"

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-08-PLAN.md — Duplicados por UUID, archivos ignorados y store en memoria con generación
- [x] 01-09-PLAN.md — Pruebas unitarias del candado y estados del login (pendiente, errores, regreso seguro)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-10-PLAN.md — Parseo por lotes con progreso, resumen por lote y listas del reporte

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 01-11-PLAN.md — Tarjetas y acordeones del reporte, y "Quitar todas"

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 01-12-PLAN.md — Barra de progreso y avisos (toasts) por lote

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 01-13-PLAN.md — Soltar en cualquier parte, zona vacía, confirmación al cerrar sesión y aviso al recargar

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 01-14-PLAN.md — Tabla "Facturas cargadas" con formato y orden

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 01-15-PLAN.md — Paginación, insignia de tipo, nota y estado vacío de la tabla

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 01-16-PLAN.md — Cabeceras de seguridad, docs de despliegue, smoke de Playwright y despliegue confirmado en Vercel (D-28)

**UI hint**: yes

### Phase 2: Dashboard de gasto confiable

**Goal:** El usuario ve en qué se gasta y cuánto en promedio (KPIs, tendencia mensual, ranking de proveedores y tabla de facturas) con montos que respetan las reglas acordadas (I/E/P, con/sin IVA, facturas en $0 y excluidas), filtros consistentes y un panel de calidad de datos.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: REGLA-01, REGLA-02, REGLA-03, REGLA-04, REGLA-05, REGLA-06, REGLA-07, REGLA-08, REGLA-09, DASH-01, DASH-02, DASH-04, DASH-06, DASH-09, DASH-10, FILT-01, FILT-02, FILT-04, FILT-05, CAL-01, DEV-03
**Success Criteria** (what must be TRUE):
  1. Con las facturas de 2025 cargadas, el usuario ve en formato es-MX el gasto total, el número de facturas, el ticket promedio y el promedio mensual; las notas de crédito restan en el mes de su factura relacionada (o en su propia fecha, con aviso, si esa factura no está cargada) y los complementos de Pago y las facturas en $0 no suman ni cuentan en los promedios.
  2. El usuario alterna entre "con IVA" (Total) y "sin IVA" (Subtotal − Descuento + IEPS) y cambian a la vez los KPIs, la tendencia mensual (con los meses sin gasto en $0), el ranking de proveedores con su ticket promedio y la tabla ordenable de facturas y conceptos; el modo activo siempre se ve en pantalla.
  3. El usuario filtra por rango de fechas o mes, por uno o varios proveedores y por forma de pago con nombres del catálogo SAT (las facturas PPD "99 Por definir" muestran la forma de pago real de su complemento), y KPIs, gráficas y tablas reflejan siempre el mismo filtro; el promedio mensual indica en pantalla que divide entre los meses del calendario del rango.
  4. El usuario marca una factura como "Excluida" y esta deja de contar en todo el análisis; en el panel de calidad de datos ve duplicados, archivos con error, facturas en $0, diferencias de redondeo, sustituciones (TipoRelación 04) y notas de crédito sin factura relacionada.
  5. `pnpm test` pasa las pruebas Vitest del parser y de las reglas de montos sobre XML anonimizados (descuentos, IEPS, facturas a pocas horas de un cambio de mes asignadas al mes de su fecha literal, conversión con TipoCambio y aritmética exacta con big.js), y `Facturas/` está fuera de git.

**Plans:** 2/15 plans executed

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Tracer: aprobación de paquetes, aritmética exacta con big.js, libro contable y "Gasto total" en la pestaña Dashboard

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Impuestos de la factura en el parser (D-36): traslados y retenciones del Comprobante sin cambiar el comportamiento de la Fase 1

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 02-03-PLAN.md — Reglas de monto: catálogos SAT, meses por fecha literal, Con/Sin IVA, IEPS y TipoCambio sobre XML anonimizados

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 02-04-PLAN.md — Libro contable completo: notas de crédito, $0, exclusión, sustitución 04, forma de pago de PPD y proveedor por RFC

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 02-05-PLAN.md — Selectores compartidos: filtros, KPIs, variación contra el periodo anterior, serie mensual y ranking de proveedores

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 02-06-PLAN.md — Estado de sesión y ajustes persistidos: filtros, exclusiones, pestañas y modo IVA (única clave guardada)

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 02-07-PLAN.md — Interruptor Con/Sin IVA, barra superior responsiva, pestañas controladas y regla de fin de carga

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 02-08-PLAN.md — Ayudantes de meses y formas de pago, textos de filtros y filtro de fechas por mes

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 02-09-PLAN.md — Barra de filtros: proveedor y forma de pago con buscador, chips, pliegue móvil y estado sin coincidencias

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 02-10-PLAN.md — Fila de 4 KPIs con promedio mensual explicado y variación contra el periodo anterior

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 02-11-PLAN.md — Tendencia mensual con Recharts: paquetes con versión fija y gráfica de barras con línea de promedio

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 02-12-PLAN.md — Ranking top 10 de proveedores con lista completa, componentes compartidos y fila compuesta con la tendencia

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 02-13-PLAN.md — Tabla de facturas con conceptos desplegables, Excluir/Volver a incluir y deshacer

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 02-14-PLAN.md — Panel de Calidad de datos: decisión D-34, incidencias puras y pestaña con tarjetas y acordeones

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 02-15-PLAN.md — Pestaña Calidad con contador, aviso en el Dashboard, "Ver factura", cierre DEV-03 y revisión humana

**UI hint**: yes
**Research flag**: ligero — verificar las etiquetas de c_FormaPago contra el catCFDI oficial y la semántica de TipoRelación 04/07 en la guía de llenado del Anexo 20.

### Phase 3: Categorías propias y exportación a Excel

**Goal:** El usuario organiza el gasto en sus propias categorías (por proveedor y por concepto), que persisten en el navegador y se pueden respaldar, ve "en qué gastamos más" por categoría y se lleva el análisis filtrado a un Excel de varias hojas.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-05, AJUS-01, AJUS-02, DASH-03, DASH-05, DASH-07, DASH-08, FILT-03, XLS-01, XLS-02, XLS-03
**Success Criteria** (what must be TRUE):
  1. El usuario crea, renombra y borra categorías desde la página, asigna una categoría por defecto a cada proveedor y cambia la de un concepto individual (p. ej. una línea de Walmart) sin afectar al resto de esa factura; al borrar una categoría elige a cuál pasan sus asignaciones o quedan en "Sin categoría".
  2. Tras recargar la página y volver a soltar los XML, las categorías y asignaciones siguen ahí; el usuario descarga su archivo de ajustes, lo sube en otro navegador y obtiene la misma clasificación, y un archivo de ajustes inválido se rechaza sin borrar los ajustes actuales.
  3. El usuario ve el ranking de gasto por categoría, el promedio mensual por categoría y la variación % mes contra mes por categoría, filtra por una o varias categorías, y al hacer clic en una categoría o un proveedor ve sus facturas y conceptos.
  4. El usuario descarga un Excel con las hojas Facturas, Conceptos, Resumen por categoría, Resumen por proveedor, Resumen por mes y Parámetros (filtros y modo IVA usados), que respeta los filtros activos y el modo con/sin IVA.
  5. En el Excel los montos son números con formato MXN, las fechas son fechas y RFC, UUID y folio son texto, y los totales coinciden con los del dashboard para el mismo filtro y modo.

**Plans**: TBD
**UI hint**: yes
**Research flag**: ligero — confirmar en ejecución real write-excel-file (`/universal`) y la API de la versión elegida de TanStack Table (solo se verificaron en compilación).

### Phase 4: Agrupación de productos con DeepSeek

**Goal:** El usuario pide a DeepSeek que agrupe como "mismo producto" los conceptos con descripciones distintas entre tiendas y que sugiera categorías, revisa cada sugerencia antes de aplicarla, y al LLM solo llegan descripciones y nombres de proveedor por una ruta protegida.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ACC-03, ACC-04, LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, CAT-04
**Success Criteria** (what must be TRUE):
  1. Antes de enviar, el usuario ve exactamente qué datos se mandarán a DeepSeek (descripciones de conceptos y nombres de proveedor, nunca RFC, UUID ni montos); al confirmar, recibe grupos de "mismo producto" y sugerencias de categoría por proveedor y por producto.
  2. Las sugerencias llegan a una cola de revisión donde el usuario acepta, renombra, separa, une o rechaza; nada cambia en el dashboard hasta que acepta, y lo aceptado sigue ahí al recargar.
  3. El usuario ve el progreso por lotes y puede cancelar; si un lote falla, lo ya procesado se conserva y el proceso se puede reanudar.
  4. Al aceptar un producto agrupado con categoría, sus conceptos toman esa categoría salvo los que el usuario ajustó a mano; los conceptos sin grupo usan la categoría de su proveedor o quedan en "Sin categoría".
  5. Una llamada a las rutas del LLM sin sesión válida recibe 401, y la API key de DeepSeek no aparece en ningún archivo del bundle del cliente ni en ninguna respuesta al navegador.

**Plans**: TBD
**UI hint**: yes
**Research flag**: sí — spike de DeepSeek antes de planear (calidad de agrupación en español, tasa de JSON vacío, modo JSON con thinking deshabilitado, latencia, tamaño de lote y `maxDuration` en Vercel Hobby). Candidata a `/gsd-ai-integration-phase`.

### Phase 5: Comparación de precios entre tiendas

**Goal:** El usuario ve, para cada producto agrupado, en qué tienda le sale más barato, cuánto podría ahorrar y cómo ha cambiado su precio en el tiempo, comparando solo cantidades comparables.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: PREC-01, PREC-02, PREC-03, PREC-04, PREC-05, PREC-06
**Success Criteria** (what must be TRUE):
  1. Para cada producto agrupado, el usuario ve por tienda el precio unitario neto (con descuento): mínimo, mediana, último y número de compras, con la tienda más barata resaltada.
  2. Solo se comparan precios dentro de la misma familia de unidad (kg, litro, pieza); los productos cuya unidad no se puede normalizar aparecen marcados como "no normalizado" en lugar de compararse mal.
  3. Servicios, gasolina, comisiones y similares no aparecen por defecto en la comparación, y el usuario puede cambiar la marca "no comparable" de un producto.
  4. El usuario ve un ahorro estimado, etiquetado como estimado, de haber comprado en la tienda más barata, y el historial del precio de un producto en el tiempo.

**Plans**: TBD
**UI hint**: yes
**Research flag**: sí — normalización de unidades (ClaveUnidad SAT, presentaciones dentro de la descripción como "1 kg" o "pza") y qué familias de ClaveProdServ son "no comparables" por defecto.

## Progress

**Orden de ejecución:**
Las fases se ejecutan en orden numérico: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Acceso protegido y carga de facturas | 16/16 | Complete    | 2026-10-14 |
| 2. Dashboard de gasto confiable | 2/15 | In Progress | - |
| 3. Categorías propias y exportación a Excel | 0/TBD | Not started | - |
| 4. Agrupación de productos con DeepSeek | 0/TBD | Not started | - |
| 5. Comparación de precios entre tiendas | 0/TBD | Not started | - |
