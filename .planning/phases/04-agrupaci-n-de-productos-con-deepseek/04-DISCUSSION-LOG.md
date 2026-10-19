# Phase 4: Agrupación de productos con DeepSeek - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-19
**Phase:** 04-Agrupación de productos con DeepSeek
**Areas discussed:** Entrada y envío, Qué es un producto, Cola de revisión, Progreso y lotes (añadida al final)

---

## Entrada y envío

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Dónde vive | Pestaña nueva "Productos" / Sección dentro de Categorías | Pestaña "Productos" |
| Qué se manda | Solo sin producto / Siempre todas / El usuario elige | Solo sin producto |
| Aviso de privacidad | Diálogo con resumen + vista previa / Diálogo con "no volver a mostrar" / Texto fijo | Diálogo con resumen + vista previa |
| Alcance de facturas | Todas las cargadas / Solo filtro activo / Todas excepto no-suma | Todas las cargadas |
| Botones | Uno que hace ambas / Dos separados | **Dos separados** (distinto a la recomendación) |
| Proveedor con descripción | Pares descripción + proveedor / Listas separadas | Pares |
| Qué recibe "Sugerir categorías" | Sin categoría / Todos / El usuario elige | Proveedores y productos sin categoría |
| "Agrupar" sugiere categoría | Solo agrupa / Agrupa y sugiere | Solo agrupa |

## Qué es un producto

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Clave del miembro | RFC + descripción normalizada / Solo descripción | RFC + descripción normalizada |
| Exclusividad | Un solo producto / Varios | Un solo producto |
| Categorías nuevas | Solo las del usuario / Puede proponer nuevas | **Puede proponer nuevas** (distinto a la recomendación) |
| Manejo de categoría nueva | Prefiere existentes, se crea al aceptar / Aprobar categorías nuevas primero | Prefiere existentes, se crea al aceptar |
| Solitarios | Producto de 1 / Solo grupos de 2+ / Solo si se repite | Producto de 1 |
| Aceptar categoría de proveedor | Cambia su categoría por defecto / Capa aparte | Categoría por defecto |
| Nombre del producto | DeepSeek propone, editable / Descripción más frecuente | DeepSeek propone |
| Gestión de aceptados | Lista completa editable / Solo renombrar, categoría, borrar | Lista completa editable |
| Origen en la tabla | Gris "· del producto X" / Sin origen | Gris con origen |
| Quitar o borrar | Vuelven a quedar libres / Quedan "no agrupar" | Vuelven a quedar libres |

## Cola de revisión

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Forma | Tarjetas por producto / Tabla plana | Tarjetas |
| En bloque | "Aceptar todas las visibles" con confirmación / Una por una | En bloque |
| Rechazar | Descarta el grupo, descripciones libres (+ "No agrupar" por miembro) / Marca todas "no agrupar" | Descarta el grupo |
| Sugerencias de categoría | Tabla con selector prellenado / Tarjetas | Tabla |
| Sumar a producto existente | Tarjeta "Agregar a 'X'" / Como producto nuevo | Tarjeta "Agregar a" |
| Pendientes tras recarga | localStorage aparte / Solo memoria | localStorage aparte |
| Re-ejecutar con pendientes | Solo lo no pendiente / Bloquear / Reemplazar cola | Solo lo no pendiente |
| Respaldo incluye pendientes | No / Sí | No |

## Progreso y lotes

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Progreso | Barra "Lote N de M" + Cancelar, cola incremental / Spinner | Barra + cola incremental |
| Fallos | Reintento automático + "Reintentar lotes fallidos" / Detener todo | Reintento automático |
| Tamaño de lote | Research fija con regla / Un solo lote si cabe | **Un solo lote si cabe** (distinto a la recomendación) |
| Límite para partir | Lo fija el research/spike / Número fijo ahora | Lo fija el research/spike |
| Visibilidad de la pestaña | Solo con facturas / Siempre | Solo con facturas |

## Claude's Discretion

- Textos, diseño visual fino, número de rutas, formato de prompt/JSON, número de reintentos (1–2), límites de productos/miembros, orden de listas, modelo por defecto.

## Deferred Ideas

Ninguna.
