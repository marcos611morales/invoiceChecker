---
phase: 01-acceso-protegido-y-carga-de-facturas
source: 01-REVIEW.md
updated: 2026-10-14
findings: 12
open: 12
---

# Disposición de hallazgos de la revisión de código (fase 01)

| ID | Severidad | Hallazgo | Disposición | Nota |
|----|-----------|----------|-------------|------|
| WR-01 | warning | `ingest` lee el archivo completo antes de comprobar su tamaño | open | pendiente de decisión del usuario |
| WR-02 | warning | El cierre de sesión ignora la respuesta del servidor y deja la cookie viva | open | pendiente de decisión del usuario |
| WR-03 | warning | La limitación de fuerza bruta del login no limita nada en la práctica | open | pendiente de decisión del usuario |
| WR-04 | warning | `check-bundle-secrets` sólo escanea `.next/static` y se salta la salida prerenderizada | open | pendiente de decisión del usuario |
| IN-01 | info | `parseCfdi.ts` lleva un carácter U+FEFF literal e invisible en la regex del BOM | open | pendiente de decisión del usuario |
| IN-02 | info | `EmptyDropzone` importa `cn` del paquete `cn` y no de `@/lib/utils` | open | pendiente de decisión del usuario |
| IN-03 | info | `SubTotal`, `Total` y `Fecha` se aceptan sin validar su formato | open | pendiente de decisión del usuario |
| IN-04 | info | `safeNextPath` admite `/login/` y `/login#...`, que dejan al usuario en la pantalla de login | open | pendiente de decisión del usuario |
| IN-05 | info | Cabeceras de seguridad ausentes o mejorables en `next.config.ts` | open | pendiente de decisión del usuario |
| IN-06 | info | Cookie de sesión sin prefijo `__Host-` | open | pendiente de decisión del usuario |
| IN-07 | info | `anonymize-fixture.mjs` no verifica que el resultado esté libre de datos reales | open | pendiente de decisión del usuario |
| IN-08 | info | Directiva `eslint-disable` sin efecto en `navigation.ts` | open | pendiente de decisión del usuario |
