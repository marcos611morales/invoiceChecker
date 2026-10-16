# Phase 3: Categorías propias y exportación a Excel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-16
**Phase:** 03-categorías-propias-y-exportación-a-excel
**Areas discussed:** Gestión de categorías, Asignación por concepto, Vistas por categoría, Excel

---

## Gestión de categorías

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Dónde se administran | Pestaña "Categorías" · Diálogo desde la barra · Dentro del Dashboard | Pestaña "Categorías" ✓ |
| Categorías iniciales | Lista sugerida editable · Vacío | Lista sugerida ✓ |
| Lista inicial | Lista de 9 · Lista corta de 6 | Lista de 9 ✓ |
| Proveedores en la tabla | Cargados + guardados · Solo los cargados | Cargados + guardados ✓ |
| Borrar con asignaciones | Diálogo con selector · Siempre a Sin categoría + Deshacer | Diálogo con selector ✓ |
| Restaurar archivo | Reemplazar con confirmación · Combinar · Preguntar cada vez | Reemplazar con confirmación ✓ |
| Contenido y ubicación del respaldo | Todo, en la pestaña Categorías · Sin el modo IVA | Todo, en la pestaña Categorías ✓ |
| Nombres repetidos | No, sin distinguir mayúsculas · Sí se permiten | No ✓ |

**Notes:** Lista de 9: Insumos de cafetería, Abarrotes y despensa, Limpieza e higiene, Servicios (luz, agua, internet, teléfono), Software y suscripciones, Comisiones bancarias, Mantenimiento y reparaciones, Papelería y oficina, Otros.

---

## Asignación por concepto

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Alcance del ajuste | Misma descripción del proveedor · Solo esa línea exacta · El usuario elige cada vez | Misma descripción del proveedor ✓ |
| Dónde se cambia | En la fila desplegable de la tabla · También en la pestaña Categorías | Fila desplegable ✓ |
| Categoría de notas de crédito | Igual que cualquier factura · La de la factura relacionada | Igual que cualquier factura ✓ |
| Normalización | Mayúsculas + espacios + acentos · Solo mayúsculas y espacios | Mayúsculas + espacios + acentos ✓ |

---

## Vistas por categoría

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Reparto de una factura mixta | Por concepto, diferencia a la del proveedor · Por concepto, diferencia al concepto más grande · Toda la factura a una categoría | Por concepto, diferencia a la del proveedor ✓ |
| Qué muestra el filtro de categoría | Solo la parte de esa categoría · Facturas completas que la tengan | Solo la parte ✓ |
| Presentación | Barras + tabla junto al ranking · Pestaña aparte · Tabla categoría × mes | Barras + tabla ✓ |
| Clic en categoría/proveedor | Aplica el filtro · Abre un diálogo | Aplica el filtro ✓ |
| Variación MoM en bordes | Mes anterior aunque esté fuera del rango · Solo dentro del rango | Mes anterior fuera del rango ✓ |
| Filtro UI | Igual que D-14 + "Sin categoría" · Igual sin "Sin categoría" | Con "Sin categoría" ✓ |
| Conteo en el filtro | Número de facturas · Número de líneas | Número de facturas ✓ |

---

## Excel

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Botón y archivo | Barra superior · Barra de filtros | Barra superior, `gastos-AAAA-MM_AAAA-MM-{con|sin}-iva.xlsx` ✓ |
| Filas | Las del filtro incluidas las que no suman · Solo las que suman | Incluidas las que no suman ✓ |
| Conceptos con filtro de categoría | Solo las líneas de esas categorías · Todas las líneas | Solo esas líneas ✓ |
| Columnas de monto | Monto del modo + desglose · Solo el monto del modo | Monto del modo + desglose ✓ |
| Hojas de resumen | Mismas cifras del Dashboard · Por mes × categoría | Mismas cifras ✓ |

**Notes:** El área Excel no se eligió al principio; el usuario pidió discutirla al final.

---

## Claude's Discretion

- Textos exactos, orden de listas, distribución visual fina, formato exacto del JSON y de las columnas del Excel.
- Inferido, confirmar en planeación: pestaña Categorías visible solo con facturas cargadas y su posición; categoría informativa en filas "No suma".

## Deferred Ideas

- Lista masiva de descripciones por proveedor (cubierta por la Fase 4).
- Ajuste de una línea exacta además de la regla por descripción.
- Combinar el archivo de ajustes con los actuales.
