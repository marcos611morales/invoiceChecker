---
status: complete
phase: 01-acceso-protegido-y-carga-de-facturas
source: [01-VERIFICATION.md]
started: 2026-10-14T10:45:00Z
updated: 2026-10-14T16:43:00.590Z
---

## Current Test

[testing complete]

## Tests

### 1. Arrastrar la carpeta Facturas/2025 desde el Finder (no el selector de carpetas) a la ventana, tanto en la pantalla vacía como con facturas ya cargadas y la página con scroll
expected: Se importa igual que con el selector (133 Ingreso, 3 Egreso, 7 Pago, 143 ignorados); la capa de arrastre cubre todo el viewport aunque la página tenga scroll
result: pass

### 2. Con el SO en modo oscuro y datos del sitio borrados, recargar /login varias veces con build de producción; luego cambiar el SO a claro con la página abierta
expected: Primer pintado ya oscuro, sin destello blanco ni advertencias de hidratación en consola; al volver el SO a claro la página se aclara
result: pass

### 3. Cargar archivos con nombres de 90 a 120 caracteres y estrechar la ventana a 360 px; pasar el cursor por una fila rechazada para ver el tooltip con la ruta; abrir y cerrar los diálogos "Quitar todas" y "Cerrar sesión" con teclado
expected: Los nombres se truncan o parten sin romper el layout, la tabla tiene scroll horizontal, el tooltip muestra la ruta y el foco inicial del diálogo cae en el botón de descartar
result: pass

### 4. Paginar las 143 facturas cargadas (páginas 1 a 3), ordenar en la página 3 y cargar tests/fixtures/cfdi/rechazos con "Seleccionar carpeta"
expected: La paginación conserva la página al ordenar, el reporte muestra "Es CFDI 3.3; solo se acepta 4.0" y "No es un CFDI" por archivo, y los toasts se ven bien en claro y oscuro
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
