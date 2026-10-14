---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 04
subsystem: domain/cfdi + upload
tags: [cfdi, rejections, parsererror, spanish-copy, tdd]
requires:
  - phase: 01-02
    provides: "parseCfdi con cadena de validacion completa y tests/support/cfdiVariants.ts"
provides:
  - "Una prueba por cada motivo de rechazo de parseCfdi (incluida la ruta parsererror)"
  - "src/lib/copy/messages.ts: rejectReasonText y tipoLabel"
  - "ImportCountsPanel lista cada archivo rechazado con su motivo en espanol y cuenta Traslado y Nomina aparte"
affects: [01-10, 01-14, 01-15]
tech-stack:
  added: []
  patterns:
    - "Rechazos derivados por transformacion de string desde un solo fixture aceptado"
    - "Textos interpolados en messages.ts; textos estaticos en es.ts; formato de valores en format.ts"
key-files:
  created:
    - tests/fixtures/cfdi/rechazos/cfdi33.xml
    - tests/fixtures/cfdi/rechazos/no-es-cfdi.xml
    - src/domain/cfdi/parseCfdi.rechazos.test.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
  modified:
    - tests/support/cfdiVariants.ts
    - src/features/upload/ImportCountsPanel.tsx
decisions:
  - "parseCfdi.ts no cambio: la cadena del Plan 01-01 ya cumplia el orden exigido (BOM, too-large, DTD/ENTITY, parsererror, raiz); las pruebas nuevas la fijan"
requirements-completed: [CARGA-03]
duration: ~8 min
completed: 2026-10-14
status: complete
actuals:
  tokens: 9000
  tasks: 2
  commits: 3
commits: 3
plan_head_before: 15250c5e458ddddd40ad8b5c691ae71fbb064491
plan_head_after: 5441fed5da9e12e2599444cf2bd6ce97c75a82eb
---

# Phase 01 Plan 04: Rechazos por archivo con motivo en espanol Summary

Cada motivo de rechazo de `parseCfdi` (3.3, 4.1, no-CFDI, truncado por `parsererror`, DOCTYPE/ENTITY, sin timbre, UUID invalido, tipo invalido, mas de 2 MB) queda fijado por su propia prueba, y la pagina lista cada archivo rechazado por nombre con su motivo en espanol, contando Traslado y Nomina aparte.

## Tareas

| Tarea | Nombre | Commit |
| ----- | ------ | ------ |
| 1 | Una prueba por motivo de rechazo (caracterizacion; todo paso a la primera) | 1c39b4f |
| 2 RED | Pruebas de rejectReasonText/tipoLabel (fallaban: modulo inexistente) | 469d8cf |
| 2 GREEN | messages.ts + ImportCountsPanel con lista de rechazados y conteos T/N | 5441fed |

## Verificacion

- `pnpm exec vitest run src/domain/cfdi src/lib/copy`: pasa (26 + 4 pruebas en esos grupos).
- `pnpm verify` (lint, typecheck, test, build): exit 0; 46 pruebas en total.
- `grep dangerouslySetInnerHTML src/features`: sin coincidencias; `src/lib/copy/format.ts` no existe.
- `git log --grep="(01-04)" -- package.json pnpm-lock.yaml`: vacio (sin cambios de dependencias).

## Deviations from Plan

None - plan executed exactly as written. En la Tarea 1 no hizo falta tocar `parseCfdi.ts` porque ya cumplia el orden de deteccion; por eso no hay commit RED separado para esa tarea (las pruebas pasaron de inmediato, como el plan anticipaba).

## Pendiente de verificacion humana

La comprobacion `human-check` de la Tarea 2 (elegir `tests/fixtures/cfdi/rechazos` con "Seleccionar carpeta" en `pnpm build && pnpm start` con sesion iniciada) requiere un navegador y el dialogo del SO; no se ejecuto aqui. Resultado esperado: cfdi33.xml con "Es CFDI 3.3; solo se acepta 4.0" y no-es-cfdi.xml con "No es un CFDI".

## Known Stubs

None.

## Threat Flags

None. T-01-12 (DoS en parseCfdi) queda cubierto por las pruebas de DTD y too-large; T-01-14 (inyeccion al DOM) por renderizado solo como texto React.

## Self-Check: PASSED

- Archivos creados verificados en disco; commits 1c39b4f, 469d8cf y 5441fed presentes en la rama.
