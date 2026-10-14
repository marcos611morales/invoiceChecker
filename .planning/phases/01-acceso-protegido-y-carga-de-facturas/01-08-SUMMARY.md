---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 08
subsystem: domain/import + stores + upload
tags: [import, dedupe, zustand, in-memory, tdd]
requires:
  - phase: 01-04
    provides: "parseCfdi, ParseResult, rejectReasonText y el panel con la lista de Rechazados"
provides:
  - "src/domain/import: tipos, classifyFile, applyBatch (dedupe primero-gana por UUID) y selectores de reporte"
  - "sessionStore en memoria con generation, progress y lastSummary (reemplaza la forma del Plan 01-01)"
  - "ImportCountsPanel con conteos acumulados (Ingreso/Egreso/Pago/Traslado/Nomina, Duplicados, Rechazados, Ignorados PDF/otros)"
affects: [01-10, 01-11, 01-14, 01-15]
tech-stack:
  added: []
  patterns:
    - "Reglas de importacion puras en src/domain (sin react/next/zustand), la store solo delega"
    - "Contador de generacion capturado antes del primer await y comparado en applyBatch (Pitfall 12)"
key-files:
  created:
    - src/domain/import/types.ts
    - src/domain/import/classifyFile.ts
    - src/domain/import/applyBatch.ts
    - src/domain/import/report.ts
    - src/domain/import/import.test.ts
    - src/stores/sessionStore.test.ts
  modified:
    - src/stores/sessionStore.ts
    - src/features/upload/ImportCountsPanel.tsx
decisions:
  - "Los UUID se buscan en firstFileByUuid con Object.hasOwn para que un UUID como 'constructor' no coincida con Object.prototype"
  - "El prefijo '{n} XML' del resumen muestra las facturas cargadas (invoices.length), de modo que Ingreso+Egreso+Pago+Traslado+Nomina = n"
  - "El panel marca como 'unreadable' tambien el caso en que parseCfdi lance una excepcion, para no perder el lote entero"
metrics:
  tasks: 2
  commits: 4
status: complete
commits: 4
plan_head_before: 2846a177522b5522d492a5c29eea01cbb6647403
plan_head_after: 25f31f4fe7d27648bbf218b941767b8d1ba88a47
---

# Phase 1 Plan 08: Reglas de importacion y store en memoria Summary

Importacion acumulativa con dedupe primero-gana por UUID, clasificacion de archivos y store zustand sin middleware (solo memoria, con contador de generacion), mostrada en el panel con conteos por grupo.

## Que se construyo

- **Task 1 (TDD, RED ab29f32 / GREEN 9072734):** `classifyFile` (hidden/xml/pdf/zip/other por nombre, incluye `._` y Thumbs.db), `applyBatch` no mutante con la invariante "cada archivo en exactamente un grupo", `reportCounts`, `receptorMasFrecuente` (empates al primero visto), `receptorDistinto`, `hasReport`. 24 pruebas.
- **Task 2 (TDD, RED 805834d / GREEN 25f31f4):** `sessionStore` reescrito con `ImportState` + `generation`, `progress`, `lastSummary`, `applyBatch(batch, generation)` (null si la generacion es obsoleta), `setProgress`, `clearAll` (vacia, progreso idle, generation + 1). El panel arma un `BatchEntry` por archivo (ocultos omitidos, XML parseados, PDF/ZIP/otros ignorados sin leer) y llama `applyBatch` una vez; muestra "{n} XML: Ingreso ... · Duplicados ... · Rechazados ... · Ignorados ... (PDF ..., otros ...)" y la lista de Rechazados leyendo `state.rejected` ("unreadable" tiene su texto).

## Verificacion

- `pnpm exec vitest run src/stores src/domain/import`: 29 pruebas pasan.
- `FACTURAS_DIR=... pnpm verify` (lint, typecheck, 89 pruebas, build): exit 0.
- Greps de aceptacion: sin `zustand/middleware`, sin `localStorage|sessionStorage|indexedDB` en stores/domain/upload, sin `addBatch` en `src`, sin imports de react/next/zustand en `src/domain/import`.
- T-01-SC: ningun commit `(01-08)` toca `package.json` ni `pnpm-lock.yaml`.
- Pendiente (humano): la comprobacion manual en navegador (`pnpm build && pnpm start`, elegir Facturas/2025 dos veces y recargar; esperado: Ingreso 133, Egreso 3, Pago 7, Ignorados 143 (PDF 143), segunda vez Duplicados 143, tras recargar en cero). No se pudo ejecutar aqui: requiere un selector de carpetas real.

## Deviations from Plan

None - plan executed exactly as written (los tres ajustes menores de la seccion de decisiones son detalles de implementacion dentro del alcance del plan).

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- Archivos creados y modificados existen (verificados con `git status`/commits).
- Commits ab29f32, 9072734, 805834d, 25f31f4 presentes en la rama.
