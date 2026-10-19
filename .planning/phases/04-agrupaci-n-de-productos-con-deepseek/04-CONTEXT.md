# Phase 4: Agrupación de productos con DeepSeek - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

El usuario pide a DeepSeek, desde una pestaña nueva "Productos", que **agrupe como "mismo producto"** las descripciones de conceptos que difieren entre tiendas y, con otro botón, que **sugiera categorías** para los proveedores y los productos que aún no tienen. Antes de cada envío ve exactamente qué datos salen (descripciones y nombres de proveedor; nunca RFC, UUID, montos, fechas ni folios). Las sugerencias llegan a una cola de revisión; nada cambia en el Dashboard hasta que el usuario acepta. Lo aceptado se persiste en los ajustes (localStorage + respaldo) y entra en la precedencia de categoría **concepto > producto > proveedor > "Sin categoría"** (CAT-04). La llamada a DeepSeek ocurre solo en una ruta de servidor protegida por la sesión (401 sin sesión) y la API key nunca llega al navegador.

Requisitos: ACC-03, ACC-04, LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, CAT-04.

Fuera de esta fase: comparación de precios, normalización de unidades y marca "no comparable" (Fase 5); persistir facturas (sigue vigente D-30 de la Fase 2 / CARGA-06).

</domain>

<decisions>
## Implementation Decisions

Siguen vigentes las decisiones de las Fases 1–3 (01/02/03-CONTEXT.md). Las más relevantes aquí: sesión jose con claim HMAC de la contraseña y proxy con 401 en `/api/*` (Fase 1 D-01/D-02), progreso "Procesando N de M" (Fase 1 D-11), pestañas visibles solo con facturas cargadas (Fase 3 D-01), nombres únicos sin distinguir mayúsculas (Fase 3 D-04), contrato `invoicechecker:settings` con `migrate` y zod (Fase 3 D-06), archivo de respaldo como contrato publicado (Fase 3 D-07/D-08/D-30), clave de regla RFC + descripción normalizada (Fase 3 D-09/D-10/D-26), selector por concepto con origen en gris (Fase 3 D-11), deshacer tras borrar (Fase 3 D-05).

### Entrada y envío
- **D-01:** Una pestaña nueva **"Productos"** se suma a Dashboard · Categorías · Calidad de datos · Importación. Contiene los botones, la cola de revisión y la lista de productos aceptados. Como las demás pestañas, **solo se ve con facturas cargadas**; los productos aceptados siguen guardados aunque no se vean. La Fase 5 (precios) podrá crecer en esta misma pestaña.
- **D-02:** Hay **dos botones separados**: **"Agrupar productos"** (LLM-01) y **"Sugerir categorías"** (LLM-02). Cada uno es un flujo propio con su propio aviso de privacidad y alimenta su propia sección de la cola.
- **D-03:** Las descripciones salen de **todas las facturas cargadas**, sin importar los filtros, las exclusiones ni si la factura suma. La agrupación es un ajuste permanente, no una vista.
- **D-04:** "Agrupar productos" envía **solo las descripciones libres**: las que no son miembro de un producto aceptado, no están en una sugerencia pendiente (D-24/D-25) y no están marcadas "No agrupar" (D-22). La primera vez son todas (unas 227 en la muestra); después, solo las nuevas. Si no hay ninguna, el botón informa "No hay descripciones nuevas para agrupar". Como **contexto** se envían los **nombres** de los productos aceptados (y de los sugeridos en lotes previos, D-25) para que DeepSeek pueda proponer sumar descripciones a un producto existente (D-21).
- **D-05:** Cada descripción viaja **en par con el nombre de su proveedor** (`{ descripción, proveedor }`), nunca con el RFC. El servidor valida con un esquema zod `.strict()` que el cuerpo solo trae esos campos (LLM-03); cualquier otro campo se rechaza. Las descripciones repetidas (misma clave normalizada y mismo proveedor) se envían una sola vez.
- **D-06:** "Agrupar productos" **solo agrupa y nombra**; no sugiere categoría. Un producto aceptado queda sin categoría hasta que el usuario se la asigne a mano o con "Sugerir categorías".
- **D-07:** "Sugerir categorías" envía **los proveedores sin categoría por defecto y los productos aceptados sin categoría** (nombre de proveedor y nombre de producto, y para el producto también las descripciones de sus miembros), junto con los **nombres** de las categorías del usuario. Lo que ya tiene categoría no se envía ni se toca.
- **D-08:** **Aviso de privacidad (LLM-06):** antes de **cada** envío se abre un diálogo con un resumen ("Se enviarán a DeepSeek N descripciones de conceptos y M nombres de proveedor. No se envían RFC, UUID, montos, fechas ni folios."), un desplegable **"Ver exactamente qué se envía"** con la lista literal y los botones Cancelar / "Enviar a DeepSeek". No existe la opción "No volver a mostrar".

### Qué es un producto
- **D-09:** Un **miembro** de producto es **RFC del proveedor + descripción normalizada** (la misma clave y normalización que las reglas de concepto: D-09/D-10/D-26 de la Fase 3), y se guarda también la descripción legible y el nombre del proveedor. La misma descripción en dos tiendas son dos miembros distintos, así la Fase 5 sabe de qué tienda viene cada precio. — **Reversibility:** one-way — forma parte del esquema persistido y del archivo de respaldo.
- **D-10:** Un miembro pertenece **como máximo a un producto**. Para cambiarlo de producto se mueve o se separa y se une.
- **D-11:** Una descripción sin pareja se sugiere igualmente como **producto de un solo miembro** (por ejemplo "JAMON ZWAN"): todo lo que se envía vuelve como algún producto sugerido.
- **D-12:** DeepSeek **propone un nombre legible** para cada producto (por ejemplo "Leche entera" para "MM LECHE ENT" y "LECHE ENTERA 1L"). El nombre se puede editar en la cola y después. **No se repite**, con la misma regla que las categorías (D-04 de la Fase 3: sin distinguir mayúsculas y sin espacios en los extremos). Cada producto tiene un id interno estable.
- **D-13:** **Persistencia:** los productos aceptados (id, nombre, categoría o ninguna, miembros) y las descripciones marcadas "No agrupar" van en el store de ajustes con una **versión nueva** (v2 → v3 con `migrate`, que conserva todo lo de la v2) y en el **archivo de respaldo** (como anunció D-07 de la Fase 3). Un archivo de respaldo v2 debe seguir siendo válido al subirlo. Se extienden los límites de D-30 de la Fase 3 para productos y miembros (los números los fija el planner). — **Reversibility:** one-way — esquema de localStorage de los usuarios y contrato del archivo de respaldo.
- **D-14:** La pestaña Productos tiene una **lista completa editable** de productos aceptados: nombre, categoría (selector), número de miembros y proveedores. Al abrir una fila se ven sus miembros (descripción · proveedor). Se puede renombrar, cambiar la categoría, quitar un miembro, mover un miembro a otro producto y borrar el producto, con el aviso **"Deshacer"** como en la Fase 3.
- **D-15:** Quitar un miembro o borrar un producto **deja libres** esas descripciones: vuelven a enviarse en el siguiente "Agrupar productos". Quitar no es rechazar.
- **D-16:** **Precedencia (CAT-04):** regla del concepto > categoría del producto > categoría del proveedor > "Sin categoría". En la fila desplegable de la tabla de facturas (D-11 de la Fase 3), un concepto cuya categoría viene del producto se ve **en gris con el origen**: "Insumos de cafetería · del producto Leche entera". Cambiar el selector sigue creando una regla de concepto, que le gana al producto. La columna de origen del Excel (D-22 de la Fase 3) agrega el valor "producto". Un producto sin categoría no aporta nivel: el concepto pasa a la categoría del proveedor.

### Categorías sugeridas
- **D-17:** DeepSeek **prefiere las categorías existentes** del usuario y **puede proponer una nueva** solo si ninguna encaja. En la cola se ve como "Nueva: Bebidas". La categoría nueva **se crea al aceptar** la primera sugerencia que la usa, y las demás sugerencias con ese nombre la reutilizan. Si el nombre propuesto coincide con una categoría existente (sin distinguir mayúsculas, D-04 de la Fase 3), se usa la existente. Se respeta el límite de 200 categorías (D-30 de la Fase 3).
- **D-18:** Aceptar la sugerencia de un **proveedor** fija su **categoría por defecto** (la misma asignación RFC + nombre de D-03 de la Fase 3). Como solo se piden sugerencias para proveedores sin categoría (D-07), nunca se sobrescribe una elección del usuario.

### Cola de revisión (LLM-04)
- **D-19:** La cola de productos es una **lista de tarjetas**, una por producto sugerido. Cada tarjeta muestra el nombre propuesto (editable) y sus miembros (descripción · proveedor · número de líneas), cada uno con una casilla. Acciones: **Aceptar**, **Rechazar**, **"Unir con…"** (otra sugerencia o un producto aceptado) y **separar** (desmarcar miembros → "Separar en producto nuevo"). Por miembro también existe **"No agrupar esta descripción"**.
- **D-20:** **Aceptar en bloque:** hay casillas para elegir varias tarjetas y aceptarlas o rechazarlas juntas, y un botón **"Aceptar todas las visibles"** con confirmación. Nada se aplica sin una acción del usuario.
- **D-21:** Cuando DeepSeek propone sumar descripciones a un **producto ya aceptado**, aparece una tarjeta **"Agregar a 'Leche entera'"** que muestra solo los miembros nuevos con casillas. Aceptar los suma al producto sin tocar sus miembros actuales ni su categoría.
- **D-22:** **Rechazar** una tarjeta descarta el grupo y **deja libres** sus descripciones, que se reenvían en el siguiente "Agrupar productos". Para que una descripción no se vuelva a enviar nunca se usa "No agrupar esta descripción" (se guarda en ajustes, D-13). Esa marca se puede quitar desde la pestaña Productos.
- **D-23:** Las **sugerencias de categoría** se muestran en una sección aparte, como **tabla**: una fila por proveedor o producto con el **selector ya puesto en la categoría sugerida** (se puede cambiar; las nuevas se marcan "Nueva: …"), con Aceptar y Rechazar por fila y "Aceptar todas".
- **D-24:** Las **sugerencias pendientes se guardan en localStorage con una clave propia**, separada de `invoicechecker:settings`, versionada y validada con zod. Solo contienen descripciones, nombres de proveedor, nombres de producto y categorías sugeridas; nunca montos, RFC ni UUID. Sobreviven a una recarga y una sugerencia sale de ahí cuando se acepta o se rechaza. **No van en el archivo de respaldo.** — **Reversibility:** costly — es un esquema persistido nuevo y necesitaría migración si cambia.
- **D-25:** Si hay sugerencias pendientes y el usuario vuelve a pulsar "Agrupar productos", se envían **solo las descripciones que no están en ninguna sugerencia pendiente** (ni aceptadas ni marcadas "No agrupar"). Las nuevas se agregan a la cola y las pendientes no se tocan.

### Progreso, cancelación y fallos (LLM-05)
- **D-26:** Se muestra una **barra "Lote N de M"** con **Cancelar** (patrón de D-11 de la Fase 1). Las sugerencias de cada lote **entran a la cola al terminar ese lote**, así que se puede empezar a revisar mientras siguen los demás. Cancelar detiene los lotes que faltan y conserva los que ya llegaron.
- **D-27:** Si un lote falla (error de DeepSeek, JSON vacío o inválido, tiempo agotado), el **servidor lo reintenta automáticamente** una o dos veces. Si sigue fallando, ese lote se marca como fallido, los demás continúan y al final aparece "N lotes fallaron · Reintentar". Las descripciones de un lote fallido siguen libres, así que el siguiente "Agrupar productos" también las retoma.
- **D-28:** **Un solo lote mientras quepa.** Se parte en varios solo si se pasa de un límite, que **fija el research o spike** con las descripciones reales (calidad, tokens y `maxDuration` en Vercel Hobby). Si se parte, cada lote siguiente recibe como contexto los nombres de los productos sugeridos en los anteriores (D-04), para que descripciones parecidas en lotes distintos se puedan unir.

### Seguridad de la ruta (ACC-03/ACC-04)
- ACC-03 y ACC-04 aplican tal cual. La ruta (o rutas) del LLM llama a `requireSession()` dentro del handler, además del proxy, y devuelve 401 sin sesión válida. `DEEPSEEK_API_KEY` se lee solo en el servidor (sin `NEXT_PUBLIC_`). Una prueba verifica que la key no aparece en el bundle del cliente ni en las respuestas. La CSP `connect-src 'self'` no cambia: el navegador solo llama a la ruta propia.

### Claude's Discretion
- Textos exactos de botones, diálogos, avisos y estados vacíos, más allá de los citados.
- Diseño visual de las tarjetas, la tabla de sugerencias y la lista de productos; el UI-SPEC de la fase puede afinarlo.
- Una ruta o dos (`/api/llm/group`, `/api/llm/categorize`), el formato exacto del prompt y del JSON de respuesta, los esquemas zod y el número de reintentos (1–2).
- Límites concretos de productos y miembros en el esquema persistido (extensión de D-30 de la Fase 3).
- Orden de la cola y de la lista de productos (sugerido: por número de líneas o alfabético).
- Modelo: `DEEPSEEK_MODEL` con el valor por defecto de `.claude/CLAUDE.md` (thinking deshabilitado, modo JSON, `temperature: 0`), salvo que el spike indique otra cosa.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Proyecto y alcance
- `.planning/PROJECT.md` — Key Decisions: precedencia concepto > producto > proveedor, se envía nombre de proveedor (no RFC), privacidad del LLM.
- `.planning/REQUIREMENTS.md` — ACC-03, ACC-04, LLM-01..06, CAT-04.
- `.planning/ROADMAP.md` §Phase 4 — Goal, 5 criterios de éxito y research flag (spike de DeepSeek: calidad en español, JSON vacío, thinking deshabilitado + JSON, latencia, tamaño de lote, `maxDuration`).
- `.planning/STATE.md` §Blockers/Concerns — Spike de DeepSeek pendiente antes de planear.

### Decisiones previas
- `.planning/phases/03-categor-as-propias-y-exportaci-n-a-excel/03-CONTEXT.md` — D-01 (pestañas), D-03 (asignación por proveedor con nombre), D-04 (nombres únicos), D-05 (deshacer), D-06/D-07/D-08 (store persistido y respaldo), D-09/D-10/D-26 (clave de regla y normalización), D-11 (selector por concepto con origen), D-22 (columna de origen en el Excel), D-30 (límites).
- `.planning/phases/02-dashboard-de-gasto-confiable/02-CONTEXT.md` — Patrones de filtros, tabla y store de sesión.
- `.planning/phases/01-acceso-protegido-y-carga-de-facturas/01-CONTEXT.md` — D-01/D-02 (sesión), D-11 (barra de progreso).

### Stack e investigación
- `.claude/CLAUDE.md` §DeepSeek client — `openai` SDK con `baseURL` de DeepSeek, `response_format: json_object`, `thinking: { type: "disabled" }` con `@ts-expect-error`, reintento ante contenido vacío, zod siempre, `maxDuration = 60`, solo `{ id, description }` con `.strict()`.
- `.claude/CLAUDE.md` §Password gate — `requireSession()` dentro de cada handler `/api/llm/*` (defensa en profundidad).
- `.claude/CLAUDE.md` §State management — zustand `persist` con `version`, `migrate`, `partialize`, `skipHydration` y validación zod.
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md` — Capa de dominio pura, riesgos del LLM, expectativas de agrupación.

### Datos de ejemplo
- `Facturas/2025/*.xml` — 143 CFDI reales (fuera de git; no copiar sin anonimizar). Unas 227 descripciones distintas (por ejemplo "MM LECHE ENT", "1K MANCHEGO" / "QSO MANCHEGO", "JAMON ZWAN"); sirven para el spike de calidad de agrupación.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/server/session.ts` (`verifySessionToken`, `SESSION_COOKIE`): base de `requireSession()` para los handlers del LLM.
- `src/proxy.ts`: ya devuelve 401 JSON en `/api/*` sin sesión (fail-closed); las rutas del LLM quedan cubiertas sin cambiar el matcher.
- `src/stores/settingsStore.ts` + `src/domain/settings/{types,schema,migrate,backup,assignments,categories,normalize,resolver}.ts`: el store persistido v2, la migración, el respaldo, los reducers puros con resultado ok/limit y la normalización de clave. Aquí se agregan productos y "No agrupar" (v3).
- `src/domain/settings/resolver.ts` (`explain` → `{ category, source: "regla" | "proveedor" | "ninguna" }`): punto donde entra el nivel "producto" (CAT-04, D-16).
- `src/features/categories/*` (`CategoryList`, `SupplierCategoryTable`, `DeleteCategoryDialog`, `BackupControls`): patrones de lista editable, tabla con selector, diálogos y deshacer.
- `src/features/invoices/ConceptCategorySelect.tsx`: selector por concepto que debe mostrar "· del producto X".
- `src/features/export/*` (`cellModel`, sheets): columna de origen de categoría en Conceptos.
- `src/features/upload/ProcessingIndicator.tsx`: patrón de progreso "N de M".
- `src/features/shell/AppShell.tsx` (`TABS`, `isAppTab`) y `src/stores/sessionStore.ts` (`AppTab`): pestaña nueva "Productos".
- `src/lib/copy/es.ts`: textos.

### Established Patterns
- Dominio puro en `src/domain/*` con pruebas Vitest al lado; features en `src/features/*`.
- Persistido = listas de entradas (nunca records con clave de RFC o descripción, Pitfall 8), validado con zod, con límites.
- TypeScript estricto: sin `any`, sin `!`, sin `as` sin validar. La respuesta del LLM y los cuerpos de petición se validan con zod.
- Pruebas `*.anon.test.ts` y `*.realdata.test.ts`.

### Integration Points
- **Faltan dependencias:** el paquete `openai` (7.32.0) para el cliente de DeepSeek; hay que aprobarlo antes de instalarlo.
- Variables de entorno nuevas: `DEEPSEEK_API_KEY` y `DEEPSEEK_MODEL` (opcional) en `.env.example` y en Vercel.
- `src/app/api/` hoy solo tiene `auth/`; se agrega `llm/`.

</code_context>

<specifics>
## Specific Ideas

- Casos guía: "MM LECHE ENT" (Walmart) + "LECHE ENTERA 1L" (otra tienda) → producto "Leche entera"; "1K MANCHEGO" y "QSO MANCHEGO" son candidatos al mismo producto; "JAMON ZWAN" queda como producto de un solo miembro.
- El texto del aviso incluye la lista literal de lo que se envía, no solo los conteos.
- Un concepto con categoría por producto se ve como "Insumos de cafetería · del producto Leche entera".

</specifics>

<deferred>
## Deferred Ideas

None — la discusión se mantuvo dentro del alcance de la fase.

</deferred>

---

*Phase: 04-agrupacion-de-productos-con-deepseek*
*Context gathered: 2026-10-19*
