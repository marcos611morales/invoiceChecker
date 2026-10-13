# Phase 1: Acceso protegido y carga de facturas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-13
**Phase:** 01-acceso-protegido-y-carga-de-facturas
**Areas discussed:** Pantalla de login y sesión, Zona de carga de archivos, Reporte de importación, Pantalla después de cargar, Otros tipos de archivo, Facturas especiales en el parser, Tipos T y N, Despliegue y entorno

---

## Pantalla de login y sesión

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Duración de la sesión | 30 días / 7 días / Hasta cerrar el navegador | 30 días |
| Invalidar sesiones al cambiar APP_PASSWORD | Sí, automáticamente / No, solo al rotar SESSION_SECRET | Sí, automáticamente |
| Contraseña incorrecta | Mensaje + espera ~1 s / Solo el mensaje | Mensaje + espera ~1 s |
| Diseño del login | Tarjeta centrada simple / Con logo del café | Tarjeta centrada simple |
| Ubicación de "Cerrar sesión" | Barra superior derecha / Menú de usuario | Barra superior derecha |
| Aviso de pérdida de facturas | Solo al cerrar sesión / En ambos casos / No avisar | En ambos casos |
| Redirección después del login | Página original (?next=) / Siempre al inicio | Página original |

## Zona de carga de archivos

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Soltar más con facturas ya cargadas | Se suman / Reemplazan todo / Preguntar cada vez | Se suman |
| Estado vacío | Tarjeta grande centrada / Toda la ventana | Tarjeta grande centrada |
| Agregar más | Botón + soltar en toda la ventana / Franja compacta fija | Botón + toda la ventana |
| Progreso | Barra "Procesando N de M" / Solo spinner | Barra con contador |

## Reporte de importación

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Organización | Resumen + detalle desplegable / Solo totales / Tabla de todos los archivos | Resumen + desplegable |
| Rechazados | Nombre + motivo / Con detalle técnico | Nombre + motivo en español |
| Duplicados | Duplicado + original / Solo conteo | Duplicado + original |
| Lotes | Acumulado + aviso del último lote / Solo el último lote | Acumulado + aviso |

## Pantalla después de cargar

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Qué ve además del reporte | Solo el reporte / Reporte + tabla simple | Reporte + tabla simple |
| Al recargar | Zona vacía + nota / Solo la zona | Zona vacía + nota |
| Aviso de privacidad | Sí, una línea fija / No | Sí |
| Columnas | Mínimas / + RFC, UUID y pago / Con conceptos desplegables | Mínimas (fecha, proveedor, tipo, folio, Total, n.º de conceptos) |
| Evitar confusión con el gasto | Sin total + nota / Total simple con advertencia | Sin total + nota |
| Orden y paginación | Ordenar + paginar de 50 / Lista fija | Ordenar + paginar de 50 |

## Otros tipos de archivo / Facturas especiales / Tipos T y N

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Archivos que no son XML ni PDF | Ignorados y listados, ocultos descartados / Listar todos | Ignorados y listados, ocultos descartados |
| ZIP | No en esta fase / Abrir en el navegador | No en esta fase |
| Receptor distinto | Aceptar con aviso / Rechazar / Aceptar sin aviso | Aceptar con aviso |
| Sin timbre | Rechazar / Aceptar con aviso | Rechazar con aviso |
| Tipos T/N | Cargar y reportar aparte / Rechazar | Cargar y reportar aparte |

## Despliegue y entorno

| Pregunta | Opciones | Elegida |
|----------|----------|---------|
| Proyecto Vercel | El plan incluye los pasos / Ya existe / Lo hago yo después | Lo hago yo después |
| Dominio | *.vercel.app / Dominio propio | *.vercel.app |
| Verificación del criterio 1 | Local con build + start / La fase no cierra hasta que se despliegue | No cierra hasta el deploy |

**Notas:** Lo de otras monedas no se preguntó porque ya estaba decidido en PROJECT.md (conversión con TipoCambio en la Fase 2).

## Claude's Discretion

- Textos exactos de los mensajes, cómo se muestran los totales de Pago (`XXX`/0) en la tabla, componentes shadcn concretos y la implementación de la carga de carpetas.

## Deferred Ideas

- Abrir archivos ZIP en el navegador.
- Dominio propio.
