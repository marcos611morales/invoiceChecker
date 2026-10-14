---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 10
subsystem: lib/client + lib/copy + upload
tags: [ingest, chunking, progress, messages, es-MX, tdd]
requires:
  - phase: 01-08
    provides: "classifyFile, applyBatch, reportCounts, receptorDistinto, sessionStore con generation/progress/lastSummary"
provides:
  - "src/lib/client/ingest.ts: ingest(), toFileRef(), CHUNK_SIZE (parseo en el navegador por lotes de 25, progreso con throttle, cancelacion)"
  - "src/lib/copy/messages.ts: batchToastText, ignoredReasonText, duplicateRowText, receptorDistintoText, processingText, groupTriggerText, trasladoNominaSubLabel, ignoradosSubLabel"
  - "ImportCountsPanel con 'Procesando N de M', resumen del lote y listas Rechazados / Receptor distinto / Duplicados / Ignorados"
affects: [01-11, 01-12, 01-13]
tech-stack:
  added: []
  patterns:
    - "Adaptador de navegador unico (ingest) que clasifica primero, parsea por lotes con cesion de macrotarea y devuelve las entradas en el orden original"
    - "Generacion capturada antes del primer await; isCancelled compara la generacion y applyBatch descarta lotes obsoletos (Pitfall 12)"
key-files:
  created:
    - src/lib/client/ingest.ts
    - src/lib/client/ingest.test.ts
  modified:
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - src/features/upload/ImportCountsPanel.tsx
decisions:
  - "El progreso se reporta como maximo cada 100 ms mas la llamada final; el temporizador arranca al iniciar el ingest, de modo que una carga rapida solo emite (M, M)"
  - "ingest resuelve null tanto si se cancela entre lotes como si la cancelacion se detecta al terminar (applyBatch ademas descarta por generacion)"
  - "toFileRef comprueba typeof webkitRelativePath === 'string' porque objetos File fuera de un navegador real (jsdom) pueden omitirlo"
  - "Los nombres de archivo se muestran como texto y la ruta completa va en el atributo title (Q11)"
metrics:
  tasks: 2
  commits: 4
status: complete
commits: 4
plan_head_before: 21a9d0307206c6dcdd40f3bf14f9d1dd1b6aac22
plan_head_after: 3a5c245eef00188efdc21880a00054d6eb2c704f
---

# Phase 1 Plan 10: Ingesta por lotes y reporte de importacion Summary

Ingesta en el navegador por lotes de 25 con cesion al event loop, progreso "Procesando N de M" y resumen por lote en espanol, con las listas de rechazados, receptor distinto, duplicados e ignorados visibles en el panel.

## Que se hizo

- **Tarea 1 (TDD):** ocho funciones de texto en `src/lib/copy/messages.ts` con reglas de singular/plural (D-20): se omiten partes en cero, "Se agrego 1" / "Se agregaron n" / "No se agrego ninguna factura nueva". RED `83599de`, GREEN `850f501`.
- **Tarea 2 (TDD):** `src/lib/client/ingest.ts` clasifica todos los archivos primero (ocultos descartados, PDF/ZIP/otros como ignorados sin leerse), parsea los XML en lotes de `CHUNK_SIZE = 25` con `Promise.all` y `setTimeout(0)` entre lotes, respeta `isCancelled` y reporta progreso con throttle. `ImportCountsPanel` usa `ingest`, deshabilita los dos inputs mientras trabaja, muestra `processingText` y `batchToastText` en regiones `aria-live="polite"` y lista los cuatro grupos solo cuando no estan vacios. RED `899e665`, GREEN `3a5c245`.

## Verificacion

- `pnpm exec vitest run src/lib/copy` : 15 pruebas OK.
- `pnpm exec vitest run src/lib/client/ingest.test.ts` : 11 pruebas OK (30 XML + PDF/ZIP/TXT/.DS_Store/._x.xml, orden, progreso con throttle, cancelacion, text() rechazado, toFileRef).
- `pnpm verify` (lint, typecheck, test, build): OK (144 pruebas pasadas, 3 omitidas preexistentes).
- Greps de aceptacion: sin `fetch(`/XMLHttpRequest/sendBeacon en ingest, domain, stores y upload; sin localStorage/sessionStorage/indexedDB en ingest; `CHUNK_SIZE = 25` presente.
- T-01-SC: ningun commit `(01-10)` toca `package.json` ni `pnpm-lock.yaml`.

## Deviations from Plan

None - plan executed exactly as written. (Ajuste menor dentro del alcance: `toFileRef` valida `typeof webkitRelativePath === "string"` porque jsdom no define esa propiedad; fue descubierto por la prueba RED y no cambia el comportamiento en navegadores.)

## Known Stubs

None. Los textos "Leyendo archivos..." para `phase: "listing"` estan cableados al store, pero nadie emite esa fase todavia; la usaran los Planes 01-11 a 01-13 (dropzone con lectura de carpetas).

## Threat Flags

None. Sin superficie nueva: la ruta de ingesta no usa APIs de red ni almacenamiento del navegador (T-01-16 mitigado por greps de aceptacion).

## Self-Check: PASSED

- src/lib/client/ingest.ts, src/lib/client/ingest.test.ts, src/lib/copy/messages.ts, src/lib/copy/messages.test.ts, src/features/upload/ImportCountsPanel.tsx existen.
- Commits 83599de, 850f501, 899e665, 3a5c245 presentes en la rama.
