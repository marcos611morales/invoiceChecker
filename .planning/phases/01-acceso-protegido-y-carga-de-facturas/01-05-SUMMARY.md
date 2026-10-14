---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 05
subsystem: testing/fixtures
tags: [cfdi, anonymization, fixtures, privacy, regression]
requires:
  - phase: 01-02
    provides: "parseCfdi completo (conceptos, relacionados, pagos) y readFixture"
provides:
  - "scripts/anonymize-fixture.mjs: anonimizador por lista blanca de CFDI reales"
  - "Tres fixtures anonimizados realistas (I con Descuento y 6 conceptos, E, P)"
  - "Regresion local sobre la muestra real 2025 (conteos exactos)"
  - "Guard test: ningun identificador real en tests/ ni e2e/"
affects: [01-16, phase-02]
tech-stack:
  added: []
  patterns:
    - "Anonimizacion por lista blanca: todo atributo no listado se reescribe por defecto"
    - "Suites que dependen de Facturas/ usan describe.skipIf y FACTURAS_DIR opcional"
key-files:
  created:
    - scripts/anonymize-fixture.mjs
    - tests/fixtures/cfdi/anon/anon-ingreso-descuento.xml
    - tests/fixtures/cfdi/anon/anon-egreso.xml
    - tests/fixtures/cfdi/anon/anon-pago.xml
    - src/domain/cfdi/parseCfdi.anon.test.ts
    - src/domain/cfdi/parseCfdi.realdata.test.ts
    - tests/fixtures.guard.test.ts
  modified: []
decisions:
  - "La lista blanca del anonimizador se amplia con desgloses de impuestos pago20 (BaseDR, ImporteDR, ImpuestoP, etc.), totales pago20 y FechaTimbrado: solo montos, tasas y fechas"
  - "Las suites realdata y guard leen Facturas/ de <cwd>/Facturas o de la variable FACTURAS_DIR"
requirements-completed: [CARGA-02, CARGA-03]
duration: ~15 min
completed: 2026-10-14
status: complete
actuals:
  tokens: 16000
  tasks: 2
  commits: 3
commits: 3
plan_head_before: 15250c5e458ddddd40ad8b5c691ae71fbb064491
plan_head_after: 1de88f0d2c5950196c2fc7491eddcad0a3ef9093
---

# Phase 1 Plan 05: Fixtures anonimizados, regresion real y guard de fugas Summary

Anonimizador por lista blanca que genera fixtures CFDI realistas sin ningun identificador real, regresion local que fija el parser a la estructura exacta de los 143 XML reales 2025, y un guard que falla si un valor real llega a tests/ o e2e/.

## Que se construyo

- **scripts/anonymize-fixture.mjs** (Node ESM, sin dependencias): reescribe todo atributo que no este en la lista blanca estructural. Rfc de Emisor a EKU9003173C9, de Receptor a XAXX010101000, Nombre a "PROVEEDOR ANONIMO N" / "RECEPTOR ANONIMO", Descripcion a "CONCEPTO N", NoIdentificacion a "SKU N", sellos/certificados/lugar de expedicion/serie/folio a tokens neutros y cualquier atributo desconocido a un token de su tipo. Los UUID (timbre, relacionado, IdDocumento, en cualquier mayuscula/minuscula) se mapean a un UUID v4 sintetico deterministico, asi las referencias cruzadas entre archivos sobreviven. Elimina comentarios, CDATA y texto de elementos. Nunca imprime valores de entrada.
- **Fixtures**: elegidos por estructura (grep de TipoDeComprobante, Descuento y numero de conceptos): una I con Descuento raiz y 6 conceptos, una E con CfdiRelacionados y una P con pago20 y DoctoRelacionado. Solo contienen los RFC publicos EKU9003173C9 y XAXX010101000.
- **parseCfdi.anon.test.ts**: parseo ok con tipo esperado, forma sintetica de todos los UUID, solo RFC publicos, y pruebas del script (mapeo UUID determinista entre archivos y sin importar mayusculas, anonimizacion por defecto, sin valores en stdout).
- **parseCfdi.realdata.test.ts**: sobre `Facturas/2025`, 143 ok, 133 I / 3 E / 7 P, 143 UUID unicos, 362 conceptos, 7 Pago y 7 DoctoRelacionado, 6 facturas con relacionados y 7 UUID relacionados, 10 sin Folio, 68 con Descuento, 65 con TipoCambio. Solo conteos.
- **tests/fixtures.guard.test.ts**: recorre tests/ y e2e/ (este ultimo solo si existe) y compara con todo Rfc, Nombre, UUID, IdDocumento, NoCertificado, NoCertificadoSAT y RfcProvCertif de Facturas/ (minimo 4 caracteres, UUID sin distinguir mayusculas, excepto RFC genericos publicos). Reporta archivo y atributo, nunca el valor. Verificado con una sonda temporal (UUID real en minusculas dentro de tests/) que el guard falla; la sonda se elimino.

## Tareas y commits

| Tarea | Commit | Descripcion |
| ----- | ------ | ----------- |
| 1 RED | 117e267 | test del contrato de fixtures y anonimizador (5 fallos verificados) |
| 1 GREEN | b50aaa5 | anonimizador y tres fixtures anonimizados |
| 2 | 1de88f0 | regresion real 2025 y guard de fugas |

## TDD Gate Compliance

Tarea 1: commit `test(...)` en rojo (5 pruebas fallando por fixtures ausentes) seguido de `feat(...)` en verde. Tarea 2: son pruebas de caracterizacion sobre un parser ya existente (01-02), por lo que pasan desde el primer momento; no hay implementacion que escribir. Para el guard se comprobo manualmente que falla ante una fuga plantada.

## Verificacion

Con `FACTURAS_DIR` apuntando a la muestra real: `pnpm verify` (lint, typecheck, vitest 44/44, build) pasa; las suites realdata y guard se ejecutan y pasan (no se omiten). Sin muestra (`FACTURAS_DIR=/nonexistent`) ambas se omiten limpiamente. `package.json` y `pnpm-lock.yaml` no cambian (T-01-SC).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Lista blanca ampliada con campos estructurales de pago20**
- **Found during:** Tarea 1 (inspeccion del fixture P)
- **Issue:** Con la lista blanca literal del plan, `BaseDR`, `ImporteDR`, `ImpuestoDR`, `TasaOCuotaDR`, `TipoFactorDR`, sus equivalentes `...P`, los `TotalTraslados*`/`TotalRetenciones*` de pago20:Totales y `FechaTimbrado` se convertian en "X"/"000", dejando un fixture P irreal.
- **Fix:** Se anadieron esos nombres (solo montos, tasas y fechas, sin identidad) a la lista blanca.
- **Files modified:** scripts/anonymize-fixture.mjs
- **Commit:** b50aaa5

**2. [Rule 3 - Blocking] Ruta de la muestra real configurable**
- **Found during:** Tarea 2
- **Issue:** `Facturas/` esta en .gitignore y no existe en el worktree; con la ruta fija `<cwd>/Facturas` las suites se omitirian y no se podria verificar.
- **Fix:** Ambas suites usan `process.env.FACTURAS_DIR ?? <cwd>/Facturas`. Comportamiento por defecto identico al del plan.
- **Files modified:** src/domain/cfdi/parseCfdi.realdata.test.ts, tests/fixtures.guard.test.ts
- **Commit:** 1de88f0

## Auth gates

Ninguno.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno.

## Self-Check: PASSED

- Archivos creados presentes (script, 3 fixtures, 3 tests).
- Commits 117e267, b50aaa5, 1de88f0 presentes en la rama.
