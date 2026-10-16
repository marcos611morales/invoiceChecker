# Requirements: InvoiceChecker — Análisis de gastos del Coworking Café

**Defined:** 2026-10-13
**Core Value:** Ver con claridad, a partir de las facturas XML, en qué gastamos más y dónde nos sale más barato cada producto, sin subir los datos a una base de datos.

## v1 Requirements

### Acceso (ACC)

- [x] **ACC-01**: Usuario debe ingresar una contraseña compartida (variable de entorno en Vercel) antes de ver cualquier página
- [x] **ACC-02**: La sesión persiste vía cookie firmada HttpOnly; el usuario puede cerrar sesión
- [ ] **ACC-03**: Las rutas del LLM rechazan (401) cualquier llamada sin sesión válida, verificado dentro de cada handler
- [ ] **ACC-04**: La API key de DeepSeek nunca llega al navegador ni al bundle del cliente

### Carga de facturas (CARGA)

- [x] **CARGA-01**: Usuario puede arrastrar/soltar o seleccionar varios archivos XML (y carpetas) a la vez; los PDF se ignoran y se reportan como ignorados
- [x] **CARGA-02**: Los XML se parsean en el navegador (DOMParser nativo, tolerante a BOM y a cualquier prefijo de namespace) sin enviarse a ningún servidor
- [x] **CARGA-03**: Solo se acepta CFDI 4.0; archivos 3.3 u otros XML se rechazan con mensaje claro por archivo
- [x] **CARGA-04**: Facturas duplicadas (mismo UUID del timbre) se cargan una sola vez y se reportan
- [x] **CARGA-05**: Usuario ve un reporte de importación: totales por tipo (I/E/P), duplicados, errores e ignorados
- [x] **CARGA-06**: Las facturas viven solo en memoria; al recargar hay que volver a cargarlas (los ajustes sí persisten)

### Reglas de montos (REGLA)

- [ ] **REGLA-01**: Facturas tipo Ingreso suman al gasto; Egreso (notas de crédito) restan; complementos de Pago no suman dinero
- [ ] **REGLA-02**: Las notas de crédito se restan en el mes de la factura relacionada si está cargada; si no, en su propia fecha con aviso
- [ ] **REGLA-03**: Usuario puede alternar globalmente "con IVA" (Total) y "sin IVA" (Subtotal − Descuento + IEPS, es decir, quitando solo el IVA); el modo activo se indica siempre en pantalla y aplica a gráficas, tablas, promedios y Excel
- [ ] **REGLA-04**: Los cálculos usan aritmética decimal exacta (big.js); el redondeo solo ocurre al mostrar
- [ ] **REGLA-05**: Los meses se asignan por la fecha literal del CFDI (sin conversión de zona horaria)
- [ ] **REGLA-06**: Facturas con total $0 se excluyen de conteos y promedios, y se listan en calidad de datos
- [ ] **REGLA-07**: Facturas en moneda distinta a MXN se convierten con el TipoCambio de la propia factura
- [x] **REGLA-08**: Usuario puede marcar manualmente una factura como "Excluida" (p. ej. cancelada) y deja de contar en todo el análisis
- [ ] **REGLA-09**: La forma de pago real de facturas PPD ("99 Por definir") se toma de su complemento de Pago cargado, para filtros y reportes

### Dashboard (DASH)

- [ ] **DASH-01**: Usuario ve KPIs: gasto total, número de facturas, ticket promedio y promedio mensual del rango filtrado
- [ ] **DASH-02**: Usuario ve la tendencia de gasto por mes (incluyendo meses sin gasto en $0)
- [ ] **DASH-03**: Usuario ve ranking de gasto por categoría ("en qué gastamos más")
- [ ] **DASH-04**: Usuario ve ranking de gasto por proveedor con ticket promedio por proveedor
- [ ] **DASH-05**: Usuario ve promedio mensual por categoría
- [ ] **DASH-06**: El promedio mensual divide entre los meses del calendario del rango filtrado (aunque no tengan facturas), indicado en pantalla
- [ ] **DASH-07**: Usuario ve la variación % mes contra mes por categoría
- [ ] **DASH-08**: Usuario puede hacer clic en una categoría o proveedor y ver sus facturas y conceptos
- [ ] **DASH-09**: Usuario ve una tabla de facturas/conceptos ordenable
- [ ] **DASH-10**: Interfaz en español con formato es-MX (moneda MXN, fechas)

### Filtros (FILT)

- [ ] **FILT-01**: Usuario puede filtrar por rango de fechas o mes
- [ ] **FILT-02**: Usuario puede filtrar por uno o varios proveedores
- [ ] **FILT-03**: Usuario puede filtrar por una o varias categorías
- [ ] **FILT-04**: Usuario puede filtrar por forma de pago (con nombres del catálogo SAT, no códigos)
- [ ] **FILT-05**: Los filtros aplican de forma consistente a KPIs, gráficas, tablas y export

### Categorías (CAT)

- [ ] **CAT-01**: Usuario puede crear, renombrar y borrar categorías propias desde la página
- [ ] **CAT-02**: Usuario puede asignar una categoría por defecto a cada proveedor
- [ ] **CAT-03**: Usuario puede cambiar la categoría de un concepto individual
- [ ] **CAT-04**: Precedencia: ajuste del concepto > categoría del producto agrupado > categoría del proveedor > "Sin categoría"
- [ ] **CAT-05**: Al borrar una categoría, sus asignaciones pasan a "Sin categoría" (o a otra que el usuario elija)

### Ajustes y respaldo (AJUS)

- [ ] **AJUS-01**: Categorías, asignaciones y agrupaciones aceptadas se guardan en localStorage, con versión y validación
- [ ] **AJUS-02**: Usuario puede descargar sus ajustes en un archivo y subirlos en otro navegador/computadora

### LLM DeepSeek (LLM)

- [ ] **LLM-01**: Usuario puede pedir que DeepSeek agrupe como "mismo producto" conceptos con descripciones distintas entre tiendas
- [ ] **LLM-02**: Usuario puede pedir que DeepSeek sugiera categoría por proveedor y por producto
- [ ] **LLM-03**: Al LLM solo se envían descripciones de conceptos y nombres de proveedor; nunca RFC, UUID ni montos (validado por esquema)
- [ ] **LLM-04**: Usuario revisa las sugerencias en una cola: aceptar, renombrar, separar, unir o rechazar; nada se aplica sin revisión
- [ ] **LLM-05**: Usuario ve el progreso, puede cancelar, y un fallo parcial no pierde lo ya procesado
- [ ] **LLM-06**: Antes de enviar, se informa al usuario qué datos se mandarán a DeepSeek

### Comparación de precios (PREC)

- [ ] **PREC-01**: Usuario ve, por producto agrupado, el precio unitario neto (con descuento) en cada tienda: mínimo, mediana, último y número de compras
- [ ] **PREC-02**: Solo se comparan cantidades en la misma familia de unidad (kg, litro, pieza); cuando no se puede normalizar se marca "no normalizado"
- [ ] **PREC-03**: Servicios, gasolina, comisiones y similares se excluyen por defecto de la comparación; usuario puede cambiar la marca "no comparable"
- [ ] **PREC-04**: Usuario ve la tienda más barata por producto
- [ ] **PREC-05**: Usuario ve un ahorro estimado si hubiera comprado en la tienda más barata (etiquetado como estimado)
- [ ] **PREC-06**: Usuario ve el historial de precio de un producto en el tiempo

### Calidad de datos (CAL)

- [ ] **CAL-01**: Usuario ve un panel con duplicados, archivos con error, facturas en $0, diferencias de redondeo, sustituciones (TipoRelación 04) y notas sin factura relacionada

### Exportar a Excel (XLS)

- [ ] **XLS-01**: Usuario puede descargar un Excel (write-excel-file) con hojas: Facturas, Conceptos, Resumen por categoría, por proveedor, por mes y Parámetros (filtros y modo IVA usados)
- [ ] **XLS-02**: El Excel respeta los filtros activos y el modo con/sin IVA
- [ ] **XLS-03**: Montos como números con formato MXN, fechas como fechas y RFC/UUID/folio como texto; totales del Excel coinciden con el dashboard

### Calidad de código (DEV)

- [x] **DEV-01**: Proyecto Next.js + TypeScript en modo strict, administrado con pnpm
- [x] **DEV-02**: `pnpm lint` (ESLint) y `pnpm typecheck` pasan sin errores
- [ ] **DEV-03**: Pruebas unitarias (Vitest) del parser y reglas de montos usando XML anonimizados; `Facturas/` fuera de git
- [x] **DEV-04**: Desplegable en Vercel con variables de entorno documentadas (`.env.example`)

## v2 Requirements

### Análisis

- **V2-01**: Consulta opcional del estatus de cancelación ante el SAT
- **V2-02**: Persistir facturas en el navegador (IndexedDB) para no recargarlas
- **V2-03**: Presupuestos por categoría y alertas
- **V2-04**: Soporte de CFDI 3.3

## Out of Scope

| Feature | Reason |
|---------|--------|
| Base de datos / almacenamiento en servidor | Requisito explícito del usuario |
| Lectura de PDF / OCR | Los XML contienen toda la información |
| Cuentas individuales y roles | Basta con contraseña compartida |
| Facturas emitidas (ventas) | Solo se analizan gastos recibidos |
| Reportes contables (IVA acreditable, DIOT) | Es análisis de gasto, no contabilidad |
| Descarga masiva del SAT | Las facturas se cargan manualmente |
| Catálogo completo ClaveProdServ (~52k) | Innecesario; se usan etiquetas de lo visto |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACC-01 | Phase 1 | Complete |
| ACC-02 | Phase 1 | Complete |
| ACC-03 | Phase 4 | Pending |
| ACC-04 | Phase 4 | Pending |
| CARGA-01 | Phase 1 | Complete |
| CARGA-02 | Phase 1 | Complete |
| CARGA-03 | Phase 1 | Complete |
| CARGA-04 | Phase 1 | Complete |
| CARGA-05 | Phase 1 | Complete |
| CARGA-06 | Phase 1 | Complete |
| REGLA-01 | Phase 2 | Pending |
| REGLA-02 | Phase 2 | Pending |
| REGLA-03 | Phase 2 | Pending |
| REGLA-04 | Phase 2 | Pending |
| REGLA-05 | Phase 2 | Pending |
| REGLA-06 | Phase 2 | Pending |
| REGLA-07 | Phase 2 | Pending |
| REGLA-08 | Phase 2 | Complete |
| REGLA-09 | Phase 2 | Pending |
| DASH-01 | Phase 2 | Pending |
| DASH-02 | Phase 2 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 2 | Pending |
| DASH-05 | Phase 3 | Pending |
| DASH-06 | Phase 2 | Pending |
| DASH-07 | Phase 3 | Pending |
| DASH-08 | Phase 3 | Pending |
| DASH-09 | Phase 2 | Pending |
| DASH-10 | Phase 2 | Pending |
| FILT-01 | Phase 2 | Pending |
| FILT-02 | Phase 2 | Pending |
| FILT-03 | Phase 3 | Pending |
| FILT-04 | Phase 2 | Pending |
| FILT-05 | Phase 2 | Pending |
| CAT-01 | Phase 3 | Pending |
| CAT-02 | Phase 3 | Pending |
| CAT-03 | Phase 3 | Pending |
| CAT-04 | Phase 4 | Pending |
| CAT-05 | Phase 3 | Pending |
| AJUS-01 | Phase 3 | Pending |
| AJUS-02 | Phase 3 | Pending |
| LLM-01 | Phase 4 | Pending |
| LLM-02 | Phase 4 | Pending |
| LLM-03 | Phase 4 | Pending |
| LLM-04 | Phase 4 | Pending |
| LLM-05 | Phase 4 | Pending |
| LLM-06 | Phase 4 | Pending |
| PREC-01 | Phase 5 | Pending |
| PREC-02 | Phase 5 | Pending |
| PREC-03 | Phase 5 | Pending |
| PREC-04 | Phase 5 | Pending |
| PREC-05 | Phase 5 | Pending |
| PREC-06 | Phase 5 | Pending |
| CAL-01 | Phase 2 | Pending |
| XLS-01 | Phase 3 | Pending |
| XLS-02 | Phase 3 | Pending |
| XLS-03 | Phase 3 | Pending |
| DEV-01 | Phase 1 | Complete |
| DEV-02 | Phase 1 | Complete |
| DEV-03 | Phase 2 | Pending |
| DEV-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 61 total
- Mapped to phases: 61
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-13*
*Last updated: 2026-10-13 after roadmap creation (traceability mapped to 5 phases)*
