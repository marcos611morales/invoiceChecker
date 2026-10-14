# InvoiceChecker — Análisis de gastos del Coworking Café

## What This Is

Una página web (Next.js, desplegada en Vercel) para analizar las facturas de gastos (CFDI 4.0 XML) que los proveedores le emiten al coworking café. El usuario arrastra los archivos al navegador, los datos se procesan en el navegador y nunca se guardan en una base de datos. El dashboard muestra en qué se gasta más, los promedios de gasto y qué tienda sale más barata para el mismo producto. Los datos se pueden filtrar y exportar a Excel. La usan el dueño, sus socios y su contador, con una contraseña compartida.

## Core Value

Ver con claridad, a partir de las facturas XML, **en qué gastamos más y dónde nos sale más barato cada producto**, sin subir los datos a una base de datos.

## Requirements

### Validated

- ✓ Cargar varios archivos CFDI XML en el navegador (arrastrar/soltar) y parsearlos del lado del cliente — Phase 1
- ✓ Acceso protegido con una contraseña simple compartida que protege la página — Phase 1 (la protección de la ruta del LLM sigue activa para la Fase 4)

### Active

- [ ] Extraer de cada factura: fecha, emisor (RFC/nombre), tipo de comprobante, forma y método de pago, moneda, subtotal, impuestos, total y conceptos (descripción, cantidad, unidad, valor unitario, importe, ClaveProdServ)
- [ ] Tratamiento por tipo: Ingreso (I) cuenta como gasto, Egreso (E, notas de crédito) resta, Pago (P, complementos) se excluye para no duplicar
- [ ] Selector global para ver los montos con IVA (total) o sin IVA (subtotal)
- [ ] Categorías propias, editables en la página (crear/renombrar/borrar)
- [ ] Categoría asignada por proveedor por defecto, con opción de cambiarla en conceptos individuales
- [ ] LLM (DeepSeek) que agrupa como "mismo producto" conceptos con descripciones distintas entre tiendas y sugiere categorías; el usuario revisa y ajusta
- [ ] Comparación de precio unitario del mismo producto entre tiendas/proveedores ("dónde sale más económico")
- [ ] Promedios: mensual, por factura, por categoría (mensual) y por proveedor (ticket promedio)
- [ ] Ranking de gasto por categoría y por proveedor ("en qué gastamos más")
- [ ] Filtros: rango de fechas/mes, proveedor, categoría y forma de pago
- [ ] Exportar a Excel con varias hojas (facturas, conceptos/productos, resúmenes por categoría, proveedor y mes) respetando los filtros activos
- [ ] Los ajustes de categorías y las agrupaciones del LLM se guardan en el navegador (localStorage)
- [ ] La contraseña compartida también protege el uso del LLM (401 en la ruta sin sesión; key fuera del bundle)

### Out of Scope

- Base de datos o almacenamiento en servidor de facturas o resultados — el usuario lo pidió explícitamente; todo vive en el navegador
- Extraer datos de los PDF — los XML tienen toda la información y cada PDF tiene su XML equivalente
- Cuentas de usuario individuales o roles — basta con una contraseña compartida
- Sincronizar los ajustes entre dispositivos — se eligió localStorage, que es por navegador
- Analizar facturas emitidas por el negocio (ventas) — las facturas disponibles son de gastos recibidos

## Context

- Carpeta de ejemplo: `Facturas/2025/` con 143 XML + 143 PDF (mismo nombre: `YYYY-MM-DD_RFCEMISOR_UUID`), de enero a diciembre de 2025, concentradas de mayo a diciembre.
- Todos los CFDI son versión 4.0 y tienen el mismo receptor (RFC IALL9610022Z6). Tipos: 133 Ingreso, 3 Egreso, 7 Pago.
- Monedas: MXN; los complementos de Pago usan `XXX`.
- Unos 30 proveedores distintos. Los más frecuentes: Nueva Wal-Mart de México (39), Valsa Producción (15), Telmex (14), BanCoppel (12), Google (11), Soriana (5), Chedraui (3).
- Las descripciones de los conceptos varían entre tiendas para el mismo producto, por eso se agrupan con un LLM.
- Interfaz en español (es-MX), con moneda en pesos mexicanos.

## Constraints

- **Tech stack**: Next.js + TypeScript en modo estricto (`strict: true`) — lo decidió el usuario.
- **Package manager**: pnpm — lo pidió el usuario.
- **Calidad**: ESLint obligatorio para verificar el código — lo pidió el usuario.
- **Deploy**: Vercel.
- **Datos**: el parseo y el análisis corren en el navegador; sin base de datos.
- **Privacidad**: al LLM solo se mandan las descripciones de los conceptos (no RFC ni montos, salvo que el usuario diga otra cosa). La API key de DeepSeek vive solo en el servidor (variable de entorno de Vercel) y se usa a través de una ruta de servidor protegida por la contraseña.
- **Proceso**: preguntar siempre al usuario antes de inferir cualquier decisión ambigua.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Solo XML como fuente de datos | Los XML son estructurados y completos; los PDF son duplicados | — Pending |
| Carga en el navegador, sin DB | Requisito del usuario: procesamiento local y sin persistencia en servidor | ✓ Good (Phase 1) |
| DeepSeek para agrupar productos y sugerir categorías | Elección del usuario; las descripciones varían entre tiendas | — Pending |
| API key en variable de Vercel + contraseña simple | Evita exponer la key y que terceros gasten el saldo | ✓ Good (Phase 1) |
| Ajustes en localStorage | Persistencia sin DB; el usuario aceptó que es por navegador | — Pending |
| Categoría por proveedor, ajustable por concepto | Equilibrio entre esfuerzo y precisión (en Walmart se compran cosas de varias categorías) | — Pending |
| Notas de crédito restan, complementos de Pago se excluyen | Evita duplicar el gasto y refleja las devoluciones | — Pending |
| Next.js + TS strict + pnpm + ESLint | Elección del usuario; Next.js es nativo de Vercel | ✓ Good (Phase 1) |
| "Sin IVA" = Subtotal − Descuento + IEPS (solo se quita IVA) | 68/143 facturas con descuento; IEPS es costo real | — Pending |
| Notas de crédito restan en el mes de la factura relacionada | Son aplicaciones de anticipo (TipoRelación 07) | — Pending |
| Facturas $0 fuera de conteos/promedios | 12 facturas bancarias en $0 distorsionan el ticket promedio | — Pending |
| Promedio mensual sobre meses del calendario del rango | Elección del usuario | — Pending |
| Facturas solo en memoria (recargar = volver a cargar) | Elección del usuario; ajustes sí persisten | ✓ Good (Phase 1) |
| Canceladas: botón manual "Excluir", sin consulta al SAT | Mantiene procesamiento local | — Pending |
| Precedencia categoría: concepto > producto > proveedor | Elección del usuario | — Pending |
| Se envía nombre de proveedor (no RFC) a DeepSeek | Mejora sugerencias de categoría | — Pending |
| Servicios/combustible excluidos de comparación de precios | No son productos comparables | — Pending |
| Solo CFDI 4.0; otras monedas se convierten con TipoCambio | Elección del usuario | ✓ 4.0-only rejection shipped (Phase 1); TipoCambio pending |
| write-excel-file, DOMParser nativo, big.js | Elegidos tras research (estilos, robustez de namespaces, exactitud decimal) | — Pending |
| Facturas/ fuera de git; pruebas con XML anonimizados | Contienen RFCs y datos personales | ✓ Good (Phase 1) |
| Sesión JWT HS256 (jose) con claim HMAC de la contraseña | Cambiar APP_PASSWORD invalida sesiones sin DB (D-02) | ✓ Good (Phase 1) |
| CSP `connect-src 'self'` + E2E que prueba cero XML en la red | Garantiza que las facturas no salen del navegador | ✓ Good (Phase 1) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-14 after Phase 1*
