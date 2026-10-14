---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 11
subsystem: features/report + shell
tags: [report, accordion, summary-cards, alert-dialog, base-ui, es-MX, tdd]
requires:
  - phase: 01-07
    provides: "AppShell, TopBar, Button, Card, Tooltip, es.ts (copy estatico)"
  - phase: 01-10
    provides: "ingest por lotes, messages.ts, sessionStore con progress/clearAll, ImportCountsPanel interino"
provides:
  - "src/features/report/ImportReport.tsx: encabezado, boton Quitar todas con AlertDialog, tarjetas y acordeones"
  - "src/features/report/SummaryCards.tsx: tarjetas con data-testid summary-*"
  - "src/features/report/ReportAccordions.tsx: acordeones ordenados con razon por archivo"
  - "src/components/ui/accordion.tsx, scroll-area.tsx, alert-dialog.tsx (shadcn, Base UI)"
affects: [01-12, 01-13, 01-16]
tech-stack:
  added: []
  patterns:
    - "Estado derivado durante el render (sin setState en effect): Rechazados abierto mientras rejected.length supere el conteo en que el usuario lo cerro"
    - "Acordeon Base UI controlado con multiple + value; onValueChange recibe unknown[] y se filtra a string"
    - "Nombre de archivo en TooltipTrigger truncado y razon en linea aparte con overflow-wrap:anywhere"
key-files:
  created:
    - src/features/report/ImportReport.tsx
    - src/features/report/SummaryCards.tsx
    - src/features/report/ReportAccordions.tsx
    - src/features/report/ImportReport.test.tsx
    - src/components/ui/accordion.tsx
    - src/components/ui/scroll-area.tsx
    - src/components/ui/alert-dialog.tsx
  modified:
    - src/features/shell/AppShell.tsx
    - src/features/upload/ImportCountsPanel.tsx
decisions:
  - "Rechazados se reabre cuando el conteo supera el conteo en que el usuario lo cerro; si el usuario lo abre a mano el conteo recordado vuelve a 0"
  - "El tope de 320 px se aplica al viewport del ScrollArea con la variante [&_[data-slot=scroll-area-viewport]]:max-h-80 porque el wrapper de shadcn no expone className del viewport"
  - "AlertDialog controlado (open/onOpenChange) para cerrar tras confirmar; AlertDialogAction es un Button simple en esta version de shadcn"
metrics:
  tasks: 2
  commits: 4
status: complete
commits: 4
plan_head_before: 054bedf6b401dccab6fbd0d3aa2cc7d91d3422c9
plan_head_after: 7d78dd0
actuals:
  tasks: 2
  commits: 4
---

# Phase 1 Plan 11: Reporte de importacion con tarjetas, acordeones y "Quitar todas" Summary

Reporte de importacion segun UI-SPEC (tarjetas resumen con data-testid estables y acordeones Base UI ordenados con razon por archivo, Rechazados abierto y reabierto por derivacion en el render) mas "Quitar todas" con AlertDialog que enfoca "Conservar facturas".

## Que se hizo

- **Tarea 1 (TDD):** `SummaryCards` (grilla 2/3/4 columnas, valor 28/600 con `tabular-nums`, gris cuando es 0, rojo destructivo con CircleAlert solo en Rechazados > 0, tarjeta "Traslado y nomina" solo si hay al menos uno, sub-etiquetas "Traslado: n, Nomina: n" y "PDF: n, otros: n"). `ReportAccordions` con las ocho secciones en el orden de la UI-SPEC, solo las no vacias, triggers de 40 px con `groupTriggerText`, filas con nombre en mono truncado + Tooltip con la ruta completa y razon que envuelve (`overflow-wrap:anywhere`). `ImportReport` con encabezado. `AppShell` renderiza `ImportReport` cuando `hasReport` es true; `ImportCountsPanel` conserva solo los dos inputs, la linea de progreso y la de resumen del lote. RED `9f5c9c7`, GREEN `7840a0f`.
- **Tarea 2 (TDD):** boton outline "Quitar todas" (deshabilitado mientras `progress.phase !== "idle"`) que abre `AlertDialog` con titulo, cuerpo, "Conservar facturas" con `initialFocus` y "Quitar todas" destructivo al final; confirmar llama `clearAll()` sin navegar. RED `36db452` (4 pruebas fallando verificadas), GREEN `7d78dd0`.

## Verificacion

- `pnpm exec vitest run src/features/report`: 16 pruebas OK.
- `pnpm verify` (lint, typecheck, test, build): OK, 160 pruebas pasadas, 3 omitidas preexistentes. ESLint reporta 1 warning preexistente en `src/lib/client/navigation.ts` (directiva eslint-disable sin uso), fuera del alcance de este plan.
- `pnpm smoke:auth`: "smoke-auth: OK (14 checks)".
- Greps de aceptacion: `multiple` y `ScrollArea` en ReportAccordions; `summary-traslado-nomina` en SummaryCards; sin `asChild` ni `dangerouslySetInnerHTML` en `src/features`; `ImportCountsPanel` ya no usa `reportCounts`.
- T-01-SC: ningun commit `(01-11)` toca `package.json`, `pnpm-lock.yaml` ni `button.tsx` (el CLI de shadcn omitio button.tsx al responder "n").

## Pendiente de verificacion humana

El backstop de la UI-SPEC (razones que envuelven y nombres de 120 caracteres que rompen en cualquier caracter, tooltip con la ruta, foco real del dialogo y el max-h de 320 px dentro del ScrollArea) requiere navegador real: `pnpm build && pnpm start`, iniciar sesion, elegir `Facturas/2025` y `tests/fixtures/cfdi`, renombrar dos copias a 120 caracteres, y probar "Quitar todas". No se ejecuto en este worktree (sin navegador); jsdom confirma estructura, orden, foco inicial y estado, no el layout visual.

## Deviations from Plan

None - plan executed exactly as written.

Notas de criterio dentro del plan (sin cambio de alcance):
- En Receptor distinto y Duplicados el texto de la razon (`receptorDistintoText`, `duplicateRowText`) ya contiene el nombre del archivo, de modo que el nombre aparece en la linea mono y de nuevo en la razon. Se siguio el plan y la UI-SPEC al pie de la letra; si se quiere evitar la repeticion habria que cambiar esos mensajes (decision del usuario).
- `shadcn add` reescribio nada en `package.json` ni `pnpm-lock.yaml`; no hubo nada que restaurar.

## Known Stubs

None.

## Threat Flags

None. Sin superficie nueva: los nombres, emisores y RFC se renderizan solo como nodos de texto de React (T-01-26, probado con una cadena `<img onerror>`), y "Quitar todas" exige confirmacion con el boton de descarte enfocado y deshabilitado durante un lote (T-01-42).

## Self-Check: PASSED

- Existen: src/features/report/ImportReport.tsx, SummaryCards.tsx, ReportAccordions.tsx, ImportReport.test.tsx, src/components/ui/accordion.tsx, scroll-area.tsx, alert-dialog.tsx.
- Commits 9f5c9c7, 7840a0f, 36db452, 7d78dd0 presentes en la rama.
