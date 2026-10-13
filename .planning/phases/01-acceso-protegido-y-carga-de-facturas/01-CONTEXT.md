# Phase 1: Acceso protegido y carga de facturas - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

El dueño, sus socios y su contador entran con una contraseña compartida (cookie de sesión firmada) a una app Next.js, sueltan sus CFDI XML y obtienen un reporte de importación confiable más una tabla simple de las facturas cargadas, sin que el contenido de los XML salga del navegador. Requisitos: DEV-01, DEV-02, DEV-04, ACC-01, ACC-02, CARGA-01..06.

Fuera de esta fase: reglas de montos (I/E/P, con/sin IVA, $0, TipoCambio), KPIs, filtros, categorías, Excel, LLM. La tabla de esta fase NO calcula gasto.

</domain>

<decisions>
## Implementation Decisions

### Login y sesión
- **D-01:** La sesión dura 30 días (JWT HS256 con `jose`, cookie `session` HttpOnly; Secure; SameSite=Lax; Path=/).
- **D-02:** Cambiar `APP_PASSWORD` invalida automáticamente todas las sesiones: el JWT incluye un hash derivado de la contraseña actual y el proxy lo compara en cada verificación.
- **D-03:** Con contraseña incorrecta se muestra "Contraseña incorrecta" tras una espera artificial de ~1 s. No hay bloqueo por intentos (no hay DB).
- **D-04:** La pantalla de login es una tarjeta centrada simple: nombre de la app, un campo de contraseña con botón para mostrarla/ocultarla y el botón "Entrar". Sin logo.
- **D-05:** Después del login, el usuario vuelve a la ruta que intentaba abrir mediante `?next=`. Solo se aceptan rutas internas (deben empezar con `/` y no con `//`), para evitar un open redirect. Si no hay ruta o no es válida, va a `/`.
- **D-06:** Una barra superior fija muestra el nombre de la app a la izquierda y "Cerrar sesión" a la derecha. Es el lugar donde después irán el selector de IVA y la exportación.
- **D-07:** Se avisa de la pérdida de facturas en dos casos: (a) un diálogo propio de la app al pulsar "Cerrar sesión" si hay facturas cargadas ("Se borrarán las facturas cargadas"), y (b) el aviso nativo `beforeunload` al recargar o cerrar la pestaña mientras haya facturas cargadas. Sin facturas cargadas, no se avisa.

### Zona de carga
- **D-08:** Los lotes se suman: soltar más archivos agrega a lo ya cargado y los UUID repetidos se reportan como duplicados. Hay un botón "Quitar todas" para empezar de cero.
- **D-09:** Estado vacío: una tarjeta grande centrada, con borde punteado, el texto "Arrastra tus XML o la carpeta aquí" y los botones "Seleccionar archivos" y "Seleccionar carpeta".
- **D-10:** Con facturas cargadas, la tarjeta grande desaparece. Un botón "Agregar facturas" en la barra abre el selector y se pueden soltar archivos en cualquier parte de la ventana (un recuadro aparece al arrastrar).
- **D-11:** Una barra de progreso muestra "Procesando N de M" mientras se parsea (en lotes, cediendo el hilo entre lotes).
- **D-12:** Los archivos que no son XML ni PDF se ignoran y se listan en "Ignorados" junto con los PDF. Los archivos ocultos del sistema (`.DS_Store`, `Thumbs.db`, los que empiezan con `.`) se descartan sin listarse.
- **D-13:** Los `.zip` no se abren en esta fase. Se listan como ignorados con el aviso "Descomprime el ZIP y suelta la carpeta".

### Reglas del parser (aceptación/rechazo)
- **D-14:** Un CFDI 3.3, un XML que no es CFDI o un XML dañado se rechaza, y se muestra el nombre del archivo con el motivo en español (p. ej. "Es CFDI 3.3; solo se acepta 4.0", "No es un CFDI", "XML dañado").
- **D-15:** Un CFDI 4.0 sin `TimbreFiscalDigital`/UUID se rechaza con el aviso "Sin timbre fiscal (no es válido ante el SAT)".
- **D-16:** Si el receptor es distinto, la factura se acepta con aviso. El RFC del café no se fija en el código: se toma el receptor más frecuente entre lo cargado. Las facturas con otro RFC receptor se marcan en el reporte con "Receptor distinto: <RFC>".
- **D-17:** Los tipos Traslado (T) y Nómina (N) se cargan y se reportan aparte ("Traslado: n, Nómina: n"). No cuentan como gasto (la Fase 2 los excluye, igual que los Pagos).
- **D-18:** Si hay duplicados, se conserva la primera factura cargada. El reporte dice con qué archivo choca cada duplicado ("copia.xml es la misma factura que <original> (UUID abreviado)").

### Reporte de importación
- **D-19:** Arriba hay tarjetas de resumen con Ingreso, Egreso, Pago, Traslado/Nómina (solo si hay), Duplicados, Rechazados e Ignorados. Debajo, cada grupo tiene una sección desplegable con su lista de archivos. La sección de rechazados se abre sola si hay alguno.
- **D-20:** El reporte acumula todos los lotes de la sesión. Al terminar cada lote, un aviso breve resume ese lote ("Se agregaron 20, 3 duplicadas").

### Pantalla después de cargar
- **D-21:** Debajo del reporte hay una tabla "Facturas cargadas" con las columnas Fecha, Proveedor (nombre del emisor), Tipo, Folio, Total (tal como viene en el XML, formato es-MX con la moneda del XML) y n.º de conceptos.
- **D-22:** La tabla lleva la nota "Montos tal como vienen en cada XML; el cálculo de gasto llega después" y no tiene fila de total ni ninguna suma.
- **D-23:** La tabla se puede ordenar por columna y se pagina de 50 en 50, con TanStack Table (la misma base que la tabla de la Fase 2; así la API v9 se prueba temprano). Para ordenar fechas se usa la cadena ISO literal.
- **D-24:** Al recargar se muestra la zona de carga vacía con la nota "Por privacidad, las facturas no se guardan; vuelve a soltarlas para analizarlas".
- **D-25:** Una línea fija de privacidad en la zona de carga dice: "Tus facturas se procesan en este navegador y no se suben a ningún servidor".

### Despliegue y verificación
- **D-26:** El proyecto de Vercel lo crea el usuario después. La fase entrega el código listo para desplegar, `.env.example` (`APP_PASSWORD`, `SESSION_SECRET`) e instrucciones de despliegue (Node 24.x y variables de entorno).
- **D-27:** Se usa el dominio por defecto `*.vercel.app`.
- **D-28:** **La fase no se cierra hasta que el usuario despliegue en Vercel y confirme** el criterio de éxito 1 en la URL real. La verificación incluye un checkpoint humano bloqueante para eso.

### Claude's Discretion
- Textos exactos de los mensajes de error y del reporte, más allá de los ejemplos citados.
- Cómo mostrar en la tabla el Total de los complementos de Pago (moneda `XXX`, total 0), por ejemplo "—".
- Componentes shadcn concretos (Card, Dialog, Progress, Sonner/toast, Table) y la distribución visual dentro de los lineamientos anteriores.
- Implementación de la carga de carpetas (react-dropzone o `<input webkitdirectory>`), siempre que funcionen tanto soltar carpetas como los botones "Seleccionar archivos/carpeta".

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Proyecto y alcance
- `.planning/PROJECT.md` — Restricciones, Key Decisions definitivas (solo CFDI 4.0, facturas solo en memoria, DOMParser, Facturas/ fuera de git).
- `.planning/REQUIREMENTS.md` — DEV-01, DEV-02, DEV-04, ACC-01, ACC-02, CARGA-01..06.
- `.planning/ROADMAP.md` §Phase 1 — Goal y criterios de éxito (143 XML: 133 I, 3 E, 7 P; 143 PDF ignorados).

### Stack e investigación
- `.claude/CLAUDE.md` — Stack fijado y guías por área: Proxy + jose, DOMParser con namespace URI y BOM, versiones, ESLint flat config, pnpm 11 `allowBuilds`.
- `.planning/research/STACK.md` — Versiones y compatibilidad verificadas.
- `.planning/research/ARCHITECTURE.md` — Estructura propuesta (parser puro, stores zustand, proxy).
- `.planning/research/PITFALLS.md` — Trampas conocidas (BOM, prefijos, hidratación, etc.).
- `.planning/research/FEATURES.md` — Expectativas de la carga y del reporte de importación.

### Datos de ejemplo
- `Facturas/2025/*.xml` — 143 CFDI 4.0 reales (fuera de git; no copiar sin anonimizar).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Ninguno: el repositorio solo tiene documentos de planeación. Esta fase hace el scaffold (create-next-app 16.4 + shadcn base-nova).

### Established Patterns
- Ninguno todavía. Esta fase los establece: parser puro `parseCfdi(xmlText)`, store zustand de sesión (sin persistir) para las facturas y `proxy.ts` para el gate.

### Integration Points
- La forma de los datos parseados (`ParsedInvoice`) y el store de sesión son la base de la Fase 2. El parser debe extraer ya todos los campos de PROJECT.md (conceptos, impuestos, Descuento, TipoCambio, CfdiRelacionados, forma y método de pago), aunque la Fase 1 solo muestre algunos.

</code_context>

<specifics>
## Specific Ideas

- Criterio de aceptación con los datos reales: 143 XML cargados (133 I, 3 E, 7 P), 143 PDF ignorados y ninguna petición de red con contenido de los XML.
- La barra superior debe dejar espacio para controles futuros (selector de IVA, exportar).

</specifics>

<deferred>
## Deferred Ideas

- Abrir archivos `.zip` en el navegador (p. ej. la descarga masiva del SAT) — posible mejora futura; en esta fase se ignoran con un aviso.
- Dominio propio — se puede agregar después en Vercel.

</deferred>

---

*Phase: 01-acceso-protegido-y-carga-de-facturas*
*Context gathered: 2026-10-13*
