# Phase 2: Dashboard de gasto confiable - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-14
**Phase:** 02-dashboard-de-gasto-confiable
**Areas discussed:** Organización de la pantalla, Filtros y rango por defecto, KPIs/tendencia/ranking, Tabla y Excluir, Calidad de datos, Montos por concepto, Moneda extranjera

---

## Organización de la pantalla

| Pregunta | Opciones | Elegida |
|---|---|---|
| Organización con facturas | Pestañas / Una página con scroll / Barra lateral | Pestañas ✓ |
| Tabla de Fase 1 | La reemplaza la nueva / Se queda en Importación | La reemplaza ✓ |
| Distribución del Dashboard | KPIs→tendencia+ranking→tabla / Todo apilado / Tú decides | KPIs→tendencia+ranking→tabla ✓ |
| Aviso de calidad | Contador + aviso si afecta montos / Solo contador / Avisos en cada elemento | Contador + aviso ✓ |
| Sustitución 04 con original cargada | Excluir sola y avisar / Solo avisar | Excluir sola y avisar ✓ |
| Diferencia de redondeo | Total ≠ recalculado (> $0.01) / Tú decides | Total ≠ recalculado ✓ |
| Selector IVA | Interruptor de dos botones / Menú desplegable | Interruptor ✓ |
| Modo IVA inicial | Con IVA + recordar / Sin IVA + recordar / Con IVA sin recordar | Con IVA + recordar ✓ |
| Filtros sin resultados | Mensaje + "Quitar filtros" / KPIs en $0 | Mensaje + botón ✓ |

---

## Filtros y rango por defecto

| Pregunta | Opciones | Elegida |
|---|---|---|
| Ubicación | Barra arriba / Panel lateral fijo / Botón que abre panel | Barra arriba ✓ |
| Rango por defecto | Primer–último mes cargado / Últimos 12 meses / Año más reciente | Primer–último mes ✓ |
| Selector de fechas | Por meses + atajos / Calendario por días | Por meses + atajos ✓ |
| Proveedor / Forma de pago | Casillas con buscador / Sin buscador | Con buscador ✓ |
| Mes de la nota de crédito | Mes de imputación / Fecha propia | Mes de imputación ✓ |
| PPD sin complemento | "Por definir (sin complemento de pago)" / Tal cual | Etiqueta especial ✓ |
| PPD con varias formas | Todas / Pago más reciente / Pago de mayor monto | Todas ✓ |

---

## KPIs, tendencia y ranking

| Pregunta | Opciones | Elegida |
|---|---|---|
| Número de facturas | Solo I > $0 / I + notas de crédito | Solo I > $0 ✓ |
| Ticket promedio | Gasto neto ÷ facturas / Promedio solo de I | Gasto neto ÷ facturas ✓ |
| Tendencia | Barras / Línea-área | Barras ✓ |
| Ranking | Top 10 + "Ver todos" / Top 10 + "Otros" / Tabla completa | Top 10 + Ver todos ✓ |
| Notas en ranking | Gasto neto / Solo I | Gasto neto ✓ |
| Comparación vs periodo anterior | No en esta fase (recomendada) / Sí, igual duración | **Sí, igual duración ✓** (el usuario se apartó de la recomendación) |
| Sin datos previos | "Sin datos del periodo anterior" / Ocultar | Texto gris ✓ |
| KPIs con comparación | Los 4 / Solo gasto y promedio | Los 4 ✓ |

---

## Tabla y Excluir

| Pregunta | Opciones | Elegida |
|---|---|---|
| Forma de la tabla | Facturas desplegables / Dos vistas / Ambas | Facturas desplegables ✓ |
| Nota de crédito | Negativo + insignia / Paréntesis contable | Negativo + insignia ✓ |
| P, T/N y $0 en la tabla | No, solo en Importación/Calidad (recomendada) / Sí, atenuadas con "No suma" | **Sí, atenuadas ✓** |
| Dónde se excluye | Menú "⋯" + atenuada / Casilla "Contar" | Menú "⋯" ✓ |
| Recordar exclusión | Sí, UUID en localStorage (recomendada) / No, solo la sesión | **Solo la sesión ✓** |
| Confirmación | Sin diálogo + Deshacer / Diálogo con motivo | Sin diálogo + Deshacer ✓ |

---

## Calidad de datos

| Pregunta | Opciones | Elegida |
|---|---|---|
| Organización | Tarjetas + secciones plegables / Una sola lista | Tarjetas + plegables ✓ |
| Duplicados y errores | Conteo + enlace a Importación / Repetir las listas | Conteo + enlace ✓ |
| Acciones | "Ver factura" + acciones propias / Solo informativo | Ver factura + acciones ✓ |

---

## Montos por concepto

| Pregunta | Opciones | Elegida |
|---|---|---|
| Monto del concepto | Según el modo IVA / Tal cual del XML | Según el modo IVA ✓ |
| Diferencia contra la factura | Manda la factura + se muestra en la fila / Solo en Calidad | Manda la factura + se muestra ✓ |

---

## Moneda extranjera

| Pregunta | Opciones | Elegida |
|---|---|---|
| Sin TipoCambio | Fuera del gasto + aviso / Pedir tipo de cambio | Fuera + aviso ✓ |
| Cómo se ve | MXN + línea con el original / Solo MXN | MXN + original ✓ |

---

## Claude's Discretion

- Columnas exactas y orden por defecto de la tabla.
- "Ver factura" cuando los filtros ocultan la fila.
- Colores de la variación y distribución visual fina.
- Detalles inferidos que se listan en CONTEXT.md (recálculo del rango por defecto, filtros del periodo anterior, filas "No suma" filtradas, detalle "pagada el…").

## Deferred Ideas

- Recordar exclusiones entre sesiones (localStorage).
- Captura manual de tipo de cambio.
