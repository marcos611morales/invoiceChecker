---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 02
subsystem: domain/cfdi
tags: [cfdi, parser, domparser, fixtures, tdd]
requires:
  - phase: 01-01
    provides: "parseCfdi con cadena de validacion y campos de encabezado"
provides:
  - "ParsedInvoice completo: conceptos con impuestos propios, relacionados y pagos"
  - "tests/support/cfdiVariants.ts: readFixture y transformaciones puras de variantes"
  - "Cinco fixtures sinteticos escritos a mano"
affects: [01-04, 01-05, 01-10, 01-16, phase-02]
tech-stack:
  added: []
  patterns:
    - "Busqueda de hijos directos por namespace URI + localName (nunca por prefijo)"
    - "Dinero y tasas como strings exactos del XML; obligatorios ausentes = \"\", opcionales = null"
    - "Variantes derivadas por transformacion de string desde un solo fixture"
key-files:
  created:
    - tests/support/cfdiVariants.ts
    - tests/fixtures/cfdi/ingreso-multiconcepto-descuento.xml
    - tests/fixtures/cfdi/ingreso-sin-impuestos.xml
    - tests/fixtures/cfdi/egreso-relacionado.xml
    - tests/fixtures/cfdi/pago-pago20.xml
  modified:
    - src/domain/cfdi/types.ts
    - src/domain/cfdi/parseCfdi.ts
    - src/domain/cfdi/parseCfdi.test.ts
decisions:
  - "Los UUID de relacionados y de DoctoRelacionado se normalizan con trim + mayusculas, igual que el UUID del timbre"
  - "pago20:Totales se ignora (Q6)"
requirements-completed: [CARGA-02]
duration: ~10 min
completed: 2026-10-14
status: complete
actuals:
  tokens: 14000
  tasks: 2
  commits: 4
commits: 4
plan_head_before: a7ebde21d6fc67aa4d488d1bc317a313c89d7bc1
plan_head_after: c865a9e209b135bb359c78e5e60260071185133d
---

# Phase 1 Plan 02: Extraccion completa de campos CFDI Summary

`parseCfdi` ahora extrae conceptos con sus traslados/retenciones propios, CfdiRelacionados y complementos pago20, con dinero como strings exactos y comportamiento identico con/sin BOM, con/sin declaracion XML y con cualquier prefijo de namespace.

## Que se construyo

- **types.ts**: `Impuesto`, `Concepto`, `CfdiRelacionados`, `DoctoRelacionado`, `Pago`; `ParsedInvoice` gana `conceptos`, `relacionados`, `pagos`.
- **parseCfdi.ts**: extraccion por hijos directos (namespace URI + localName). Los `Impuestos` de la raiz nunca se copian a un concepto. `ValorUnitario="12.345678"` se conserva literal.
- **tests/support/cfdiVariants.ts**: `readFixture`, `withoutBomAndDeclaration`, `withPrefixes`, `withTipo`, `withReceptorRfc`, `withUuid`; las tres ultimas lanzan error si el atributo no existe.
- **Fixtures**: multiconcepto con descuento (6 conceptos, doble traslado IVA+IEPS, retencion, Exento), sin impuestos, egreso relacionado, pago pago20. Solo RFC EKU9003173C9 / XAXX010101000 y UUID AAAAAAAA-0000-4000-8000-0000000000NN.

## Tareas y commits

| Tarea | Commit | Descripcion |
| ----- | ------ | ----------- |
| 1 RED | 96f0b39 | tests de conceptos y variantes + helper + fixtures |
| 1 GREEN | 886a699 | extraccion de conceptos con impuestos propios |
| 2 RED | 150c39c | tests de relacionados y pagos + fixtures egreso/pago |
| 2 GREEN | c865a9e | extraccion de CfdiRelacionados y pago20 |

## TDD Gate Compliance

Ambas tareas: commit `test(...)` en rojo (4 tests fallando cada vez, verificado) seguido de commit `feat(...)` en verde.

## Verificacion

`pnpm verify` (lint, typecheck, vitest 17/17, build) pasa. `ls tests/fixtures/cfdi/*.xml | wc -l` = 5; solo dos RFC en fixtures y helpers; el BOM de `ingreso-bom-decl.xml` sigue siendo `efbbbf`. Ningun cambio en `package.json`/`pnpm-lock.yaml` (T-01-SC).

## Deviations from Plan

None - plan executed exactly as written. Nota menor: el fixture `ingreso-bom-decl.xml` de 01-01 ya traia el traslado IVA a nivel de concepto, por lo que no requirio edicion.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

Archivos creados presentes y commits 96f0b39, 886a699, 150c39c, c865a9e en el historial.
