# Phase 5: Comparación de precios entre tiendas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-25
**Phase:** 05-comparaci-n-de-precios-entre-tiendas
**Areas discussed:** Dónde y qué se compara, Unidades y presentaciones, Marca «no comparable», Ahorro estimado e historial

---

## Todo pendiente

| Option | Description | Selected |
|--------|-------------|----------|
| Dejarla fuera | Queda en pendientes para un /gsd-quick aparte | ✓ |
| Incluirla en la Fase 5 | Se planea junto con la comparación | |

**User's choice:** Dejar fuera «auto-aceptar sugerencias de producto».

---

## Dónde y qué se compara

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Ubicación | Pestaña nueva «Precios» / Dentro de Productos | Pestaña nueva «Precios» |
| Productos incluidos | Todos los agrupados / Solo 2+ tiendas | Todos los agrupados |
| Filtros globales | Sí, todos / Solo fechas / Ninguno | Sí, todos |
| IVA | Sigue el selector / Siempre sin IVA / Siempre con IVA | Sigue el selector |
| Tienda | Proveedor (RFC) / Proveedor + lugar de expedición | Proveedor (RFC) |
| Compras que cuentan | Solo facturas que suman / También restar notas de crédito | Solo facturas que suman |
| Vista | Tabla con fila desplegable / Tarjetas / Lista + panel | Tabla con fila desplegable |
| Orden | Ahorro desc / Gasto total / Alfabético | Ahorro desc |
| Herramientas (multi) | Buscador / Solo 2+ tiendas / Mostrar no comparables | Buscador + Mostrar no comparables |
| Lista de compras en el detalle | Sí / No | Sí |

---

## Unidades y presentaciones

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Fuente del contenido | Automático + corrección / Solo automático / Solo usuario / DeepSeek | Automático + corrección |
| Piezas sin tamaño | Por pieza con aviso / Siempre no normalizado | Por pieza con aviso |
| Precio mostrado | $/kg, $/L, $/pieza / Presentación más común | $/kg, $/L, $/pieza |
| Familias mezcladas | Familia mayoritaria / Todo no normalizado | Familia mayoritaria |
| Dónde se corrige | Precios / Productos / Ambos | Detalle en Precios |
| Formato | Por pieza con paquetes («12 × 1 L») / Sin paquetes | Por pieza con paquetes |
| Persistencia | Ajustes v4 + respaldo / Solo localStorage | Ajustes v4 + respaldo |

---

## Marca «no comparable»

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Regla por defecto | ClaveProdServ / Categoría del usuario / Ambas | ClaveProdServ |
| Claves mixtas | Comparable si alguna es de producto / Mayoritaria | Comparable si alguna es de producto |
| Dónde se cambia | En Precios por producto (ajustes + respaldo) / Precios y Productos | En Precios por producto |

---

## Ahorro estimado e historial

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Fórmula | Vs mediana de la más barata / Vs mínimo / Vs último | Vs mediana |
| Tienda más barata | Menor mediana / Menor mínimo / Menor último | Menor mediana |
| Total | Tarjeta arriba de la tabla / Solo por producto | Tarjeta arriba |
| Historial | Puntos y líneas por tienda / Solo lista / Gráfica por mes | Puntos y líneas por tienda |
| Por pieza sin tamaño en el ahorro | Sí con aviso / Solo por producto / No | Sí con aviso |
| Tienda con 1 compra | Sí, con número de compras / Sí con aviso / Mínimo 2 | Sí, con número de compras |

---

## Claude's Discretion

- Textos, estado vacío, posición de la pestaña, mediana con número par, esquema exacto v4, patrones de lectura de tamaño y ClaveUnidad por familia, qué pasa con correcciones de miembros quitados.

## Deferred Ideas

- Auto-aceptar sugerencias de producto de DeepSeek (todo pendiente, fuera de Fase 5).
- Comparación de precios en el Excel (anotada por Claude, no discutida).
