---
phase: 01-acceso-protegido-y-carga-de-facturas
verified: 2026-10-14T10:40:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .env.example
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-01-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-01-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-02-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-02-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-03-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-03-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-04-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-04-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-05-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-05-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-06-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-06-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-07-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-07-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-08-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-08-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-09-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-09-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-10-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-10-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-11-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-11-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-12-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-12-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-13-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-13-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-14-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-14-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-15-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-15-SUMMARY.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-16-PLAN.md
  - .planning/phases/01-acceso-protegido-y-carga-de-facturas/01-16-SUMMARY.md
  - next.config.ts
  - package.json
  - src/app/api/auth/login/route.ts
  - src/app/api/auth/logout/route.ts
  - src/domain/cfdi/parseCfdi.ts
  - src/domain/import/applyBatch.ts
  - src/domain/import/report.ts
  - src/features/report/ImportReport.tsx
  - src/features/shell/AppShell.tsx
  - src/features/shell/LogoutButton.tsx
  - src/features/upload/UploadRoot.tsx
  - src/features/upload/useImport.ts
  - src/lib/client/ingest.ts
  - src/lib/safeNext.ts
  - src/lib/server/session.ts
  - src/proxy.ts
  - src/stores/sessionStore.ts
covered_digest: "v3:sha256:f1be9fac4c0175f7062eeb990438dd8fe0cfece49f52bc3eb804b815b8be5be6"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Arrastrar la carpeta Facturas/2025 desde el Finder (no el selector de carpetas) a la ventana, tanto en la pantalla vacía como con facturas ya cargadas y la página con scroll"
    expected: "Se importa igual que con el selector (133 Ingreso, 3 Egreso, 7 Pago, 143 ignorados); la capa de arrastre cubre todo el viewport aunque la página tenga scroll"
    why_human: "El arrastre real de carpetas depende de webkitGetAsEntry y del Finder; jsdom y Playwright solo ejercitan el input webkitdirectory (supuestos A1/A6 del plan 01-13)"
  - test: "Con el SO en modo oscuro y datos del sitio borrados, recargar /login varias veces con build de producción; luego cambiar el SO a claro con la página abierta"
    expected: "Primer pintado ya oscuro, sin destello blanco ni advertencias de hidratación en consola; al volver el SO a claro la página se aclara"
    why_human: "El destello de tema es temporización de pintado en navegador real (plan 01-03); solo la lógica del script está cubierta por pruebas unitarias"
  - test: "En la tabla y en el reporte, cargar archivos con nombres de 90 a 120 caracteres y estrechar la ventana a 360 px; pasar el cursor por una fila rechazada para ver el tooltip con la ruta; abrir y cerrar los diálogos Quitar todas y Cerrar sesión con teclado"
    expected: "Los nombres se truncan o parten sin romper el layout, la tabla tiene scroll horizontal, el tooltip muestra la ruta y el foco inicial del diálogo cae en el botón de descartar"
    why_human: "Es layout visual y foco real (backstops de los planes 01-11, 01-14 y 01-15); jsdom solo confirma la estructura"
  - test: "Paginar las 143 facturas cargadas (páginas 1 a 3), ordenar en la página 3 y cargar tests/fixtures/cfdi/rechazos con Seleccionar carpeta"
    expected: "La paginación conserva la página al ordenar, el reporte muestra 'Es CFDI 3.3; solo se acepta 4.0' y 'No es un CFDI' por archivo, y los toasts se ven bien en claro y oscuro"
    why_human: "Sensación de paginación y apariencia de toasts (planes 01-04, 01-12, 01-15); las pruebas automatizadas cubren la lógica pero no el aspecto"
---

# Phase 1: Acceso protegido y carga de facturas — Informe de verificación

**Objetivo de la fase:** El dueño, sus socios y su contador entran con la contraseña compartida a la app desplegada en Vercel, sueltan sus XML y obtienen un reporte de importación confiable, sin que las facturas salgan del navegador.
**Verificado:** 2026-10-14T10:40:00Z
**Estado:** human_needed
**Re-verificación:** No, verificación inicial

## Resultado

El objetivo se cumple en el código y en el despliegue vivo. Los cinco criterios de éxito del ROADMAP están verificados con evidencia propia (no con lo que dicen los SUMMARY). No hay bloqueadores. El estado es `human_needed` solo porque varios planes dejaron comprobaciones visuales de navegador sin ejecutar (tema, arrastre desde Finder, layout a 360 px, foco de diálogos), y la regla de decisión del verificador manda a `human_needed` cuando existe cualquier elemento humano pendiente. Ninguno de esos elementos contradice un criterio del ROADMAP.

Nota sobre el modo MVP: el ROADMAP marca la fase como `Mode: mvp`, pero su meta está escrita como narrativa en español y no con el formato "As a ..., I want to ..., so that ...". Aun así se verificó contra la meta tal como está escrita (tabla de cobertura de flujo más abajo). Conviene reformatear la meta con `/gsd-mvp-phase 1` si se quiere que el modo MVP sea estricto.

## Cobertura del flujo de usuario (modo MVP)

| Paso | Esperado | Evidencia | Estado |
|------|----------|-----------|--------|
| Abrir la URL sin sesión | Cualquier página lleva a /login | `curl` en vivo: `GET /` 307 a `/login`; `GET /cualquier-cosa` 307 a `/login?next=%2Fcualquier-cosa`; `GET /api/foo` 401 | VERIFICADO |
| Escribir la contraseña compartida | Contraseña mala da error; la buena entra y deja cookie firmada | `login/route.ts` compara con `timingSafeEqual`, 401 tras 1 s; `curl` con clave mala devuelve `401 invalid_password`; cookie HttpOnly, SameSite=Lax, Secure en producción, 30 días; el usuario confirmó el ingreso real | VERIFICADO |
| Soltar la carpeta o elegir archivos | Reporte con 143 XML (133 I, 3 E, 7 P) y 143 PDF ignorados | Prueba propia del pipeline `ingest` + `applyBatch` + `reportCounts` sobre `Facturas/2025`: ingreso 133, egreso 3, pago 7, ignorados 143 (143 PDF) | VERIFICADO |
| Ver rechazos y duplicados | CFDI 3.3 y no-CFDI rechazados con mensaje; reimportar no duplica | La misma prueba: `cfdi-3x` y `not-cfdi` rechazados; reimportar 5 XML da `added 0, duplicates 5`, total sigue en 143 | VERIFICADO |
| Recargar | Las facturas desaparecen | Store de zustand sin middleware ni storage; prueba "starts empty on a fresh module load"; e2e de recarga | VERIFICADO |
| Cerrar sesión | Vuelve a /login | `LogoutButton` limpia el store, POST a logout (cookie `maxAge: 0`) y navega a /login; e2e y confirmación del usuario | VERIFICADO (ver WR-02) |

## Cumplimiento de la meta

### Verdades observables (criterios de éxito del ROADMAP)

| # | Verdad | Estado | Evidencia |
|---|--------|--------|-----------|
| 1 | Sin sesión cualquier página lleva al login; con la clave correcta entra y sigue dentro al recargar o volver; "Cerrar sesión" regresa al login | ✓ VERIFICADO | `src/proxy.ts`: matcher falla cerrado (solo excluye estáticos de Next), lista pública `/login` y `/api/auth/*`, `/api/*` responde 401 JSON, páginas redirigen con `?next=`. `session.ts`: JWT HS256 fijado, claim HMAC de la contraseña, falla cerrada sin variables de entorno. `curl` en vivo confirma 307/307/401 y las cabeceras. Pruebas `session.test.ts`, `LoginForm.test.tsx`, `guards.test.tsx`, e2e de puerta y de logout. El usuario confirmó persistencia tras recargar y tras reiniciar el navegador, y el logout, en la URL real |
| 2 | Arrastrar `Facturas/2025/` o elegir varios archivos da el reporte con 143 XML (133 I, 3 E, 7 P) y 143 PDF ignorados, sin que ninguna petición de red lleve el contenido de los XML | ✓ VERIFICADO | Prueba propia (temporal, ya eliminada) sobre los 286 archivos reales más un 3.3, un no-CFDI y `.DS_Store`: `{ingreso:133, egreso:3, pago:7, rechazados:2, ignorados:143, ignoradosPdf:143}`; el `.DS_Store` no se lista. Red: el único `fetch` del código fuente son `/api/auth/login` y `/api/auth/logout` (grep sobre `src/`); sin XHR, `sendBeacon`, WebSocket ni almacenamiento (solo `localStorage` del tema). CSP en vivo con `connect-src 'self'`. E2E `expectNoXmlLeavesTheBrowser` revisa cuerpos y orígenes. `parseCfdi.realdata.test.ts` corrió (no se saltó): 143 XML, 0 rechazados, 133/3/7. El usuario confirmó el conteo en Vercel sin peticiones con XML |
| 3 | CFDI 3.3 o XML que no es CFDI aparece rechazado con mensaje claro por archivo; volver a soltar una factura (mismo UUID) la reporta como duplicada sin contarla dos veces | ✓ VERIFICADO | `parseCfdi.ts` valida DTD, parsererror, raíz, namespace, versión, tipo y timbre con UUID; `rejectReasonText` da el texto en español por motivo; `applyBatch` hace primer-gana por UUID (con `Object.hasOwn`) dentro del lote y contra lo cargado. Prueba propia: reimportar 5 XML da 5 duplicados, 0 agregados, total 143. Pruebas `parseCfdi.rechazos.test.ts`, `import.test.ts` |
| 4 | Al recargar la página las facturas ya no están y la app pide volver a cargarlas | ✓ VERIFICADO | `sessionStore.ts` es memoria pura (sin `persist`, sin storage); `useBeforeUnload` avisa al recargar con facturas cargadas; recargar vuelve a `EmptyDropzone`. Prueba de módulo nuevo vacío y e2e "recargar avisa y vacía" (3 pasaron, 1 omitido por diseño) |
| 5 | `pnpm lint` y `pnpm typecheck` pasan en Next.js + TypeScript strict con pnpm, y `.env.example` documenta las variables para Vercel | ✓ VERIFICADO | Ejecutados aquí: `pnpm lint` salida 0 (0 errores, 1 warning), `pnpm typecheck` salida 0, `pnpm tsc --noEmit` 0, `pnpm vitest run` 19 archivos y 219 pruebas. `tsconfig.json` con `strict` y `noUncheckedIndexedAccess`; `packageManager: pnpm@11.5.2`. `.env.example` documenta `APP_PASSWORD`, `SESSION_SECRET` y `ENABLE_EXPERIMENTAL_COREPACK`. Sin `any`, `@ts-ignore` ni `@ts-nocheck` en `src/`, `e2e/`, `scripts/`, `tests/` |

**Puntaje:** 5/5 verdades verificadas (0 presentes con comportamiento sin verificar)

Las verdades con invariantes de estado (generación del store que descarta un lote tras `clearAll`, ignorar una segunda selección durante el proceso) tienen prueba conductual que pasa: `sessionStore.test.ts` ("returns null and changes nothing for a stale generation") y `useImport.test.tsx` ("writes nothing when the session was cleared while the batch ran", "ignores a second selection while a batch is processing").

### Artefactos requeridos

`verify.artifacts` sobre los 16 planes: todos pasan salvo un falso negativo.

| Artefacto | Esperado | Estado | Detalle |
|-----------|----------|--------|---------|
| `src/proxy.ts`, `src/lib/server/session.ts`, rutas `/api/auth/{login,logout}` | Candado con cookie firmada | ✓ VERIFICADO | Sustanciales, conectados (el proxy importa `verifySessionToken`; la ruta de login emite el token) |
| `src/domain/cfdi/parseCfdi.ts` | Parser puro CFDI 4.0 | ✓ VERIFICADO | 187 líneas, extrae conceptos, impuestos, relacionados y pagos |
| `src/domain/import/{applyBatch,classifyFile,report}.ts`, `src/stores/sessionStore.ts` | Dominio y store en memoria | ✓ VERIFICADO | Conectados desde `useImport` y los componentes del reporte |
| `src/lib/client/ingest.ts`, `src/features/upload/*` | Lectura por lotes con progreso | ✓ VERIFICADO | `ingest` en bloques de 25 con cesión al event loop; `UploadRoot` conecta dropzone y selector de carpeta |
| `src/features/report/*`, `src/features/invoices/*`, `src/features/shell/*` | Reporte, tabla, barra superior | ✓ VERIFICADO | Montados desde `AppShell`, que renderiza `app/page.tsx` |
| `next.config.ts`, `.env.example`, `README.md`, `.vercelignore`, `scripts/check-bundle-secrets.mjs`, `e2e/smoke.spec.ts` | Endurecimiento y despliegue | ✓ VERIFICADO | CSP y cabeceras presentes en vivo |
| `src/app/login/LoginForm.tsx` | Estado pendiente "Entrando…" | ✓ VERIFICADO | La herramienta reportó "Missing pattern: Entrando…" porque el texto vive en `es.login.submitPending` (`src/lib/copy/es.ts:33`) y la prueba `LoginForm.test.tsx:122` lo comprueba. Falso negativo del patrón |

### Verificación de enlaces clave

`verify.key-links`: 14 planes limpios. Los 4 enlaces "no verificados" apuntan a `src/features/upload/ImportCountsPanel.tsx`, un archivo del esqueleto del plan 01-01 que los planes posteriores reemplazaron (`grep ImportCountsPanel src/` no devuelve nada; el flujo vigente es `useImport` → `ingest` → `sessionStore.applyBatch` → `ImportReport`). No es una falla.

| De | A | Vía | Estado |
|----|---|-----|--------|
| `UploadRoot` (dropzone / input webkitdirectory) | `useImport.run` | `onDrop` y `onFolderPicked` | CONECTADO |
| `useImport` | `ingest` y `sessionStore.applyBatch` | captura de `generation` antes del `await` | CONECTADO |
| `sessionStore` | `applyBatch` (dominio) | `applyBatch(current, batch)` | CONECTADO |
| `AppShell` | `ImportReport`, `InvoiceTable`, `EmptyDropzone`, `ProcessingIndicator` | `hasReport(s)` | CONECTADO |
| `LogoutButton` | `clearAll` + `logout()` + `/api/auth/logout` | `leave()` | CONECTADO |
| `LoginForm` | `/api/auth/login` y `safeNextPath` | `fetch` + `hardNavigate` | CONECTADO |
| `proxy.ts` | `verifySessionToken` | cookie `session` | CONECTADO |

### Trazado de flujo de datos (nivel 4)

| Artefacto | Variable | Fuente | Datos reales | Estado |
|-----------|----------|--------|--------------|--------|
| `ImportReport` / `SummaryCards` | `counts` | `reportCounts(sessionStore)` ← `applyBatch` ← `ingest` ← `File.text()` + `DOMParser` | Sí (prueba sobre muestra real da 133/3/7/143) | ✓ FLUYE |
| `ReportAccordions` | `rejected`, `duplicates`, `ignored` | `sessionStore` | Sí | ✓ FLUYE |
| `InvoiceTable` | `invoices` | `sessionStore.invoices` | Sí | ✓ FLUYE |

### Verificaciones conductuales

| Comportamiento | Comando | Resultado | Estado |
|----------------|---------|-----------|--------|
| Gate en vivo | `curl` a `/`, `/cualquier-cosa`, `/login`, `/api/foo`, `POST /api/llm/group` | 307, 307, 200, 401, 401; CSP, HSTS, nosniff, noindex presentes | ✓ PASA |
| Login con clave mala | `curl -X POST /api/auth/login` | `401 {"error":"invalid_password"}` | ✓ PASA |
| Muestra real en el parser | `pnpm vitest run src/domain/cfdi/parseCfdi.realdata.test.ts` | 2 pruebas pasan (no omitidas) | ✓ PASA |
| Pipeline completo sobre `Facturas/2025` | prueba temporal con `ingest` + `applyBatch` + `reportCounts` (eliminada tras correr) | 133/3/7, 143 PDF ignorados, 2 rechazos correctos, 5 duplicados al reimportar | ✓ PASA |
| Suite completa | `pnpm tsc --noEmit`, `pnpm eslint .`, `pnpm vitest run`, `pnpm lint`, `pnpm typecheck` | 0 errores de tipos; eslint 0 errores y 1 warning; 219 pruebas pasan | ✓ PASA |

### Ejecución de sondas

No hay sondas `probe-*.sh` declaradas. Omitido.

### Cobertura de requisitos

Los 11 IDs del ROADMAP aparecen en el frontmatter de los planes y en la traza de REQUIREMENTS.md (todos "Phase 1"). Ningún requisito de la Fase 1 quedó huérfano.

| Requisito | Plan fuente | Descripción | Estado | Evidencia |
|-----------|-------------|-------------|--------|-----------|
| DEV-01 | 01-01 | Next.js + TS strict con pnpm | ✓ SATISFECHO | `strict` + `noUncheckedIndexedAccess`; `pnpm@11.5.2` |
| DEV-02 | 01-01, 01-03 | lint y typecheck sin errores | ✓ SATISFECHO | Ejecutados aquí, salida 0 |
| DEV-04 | 01-01, 01-16 | Desplegable en Vercel con `.env.example` | ✓ SATISFECHO | App viva en `invoice-checker-ysob.vercel.app`; `.env.example` con las tres variables |
| ACC-01 | 01-01, 01-03, 01-06, 01-07, 01-09, 01-16 | Contraseña compartida antes de ver cualquier página | ✓ SATISFECHO | Proxy + `curl` en vivo |
| ACC-02 | 01-01, 01-07, 01-09, 01-13, 01-16 | Cookie firmada HttpOnly; cerrar sesión | ✓ SATISFECHO | Cookie HttpOnly/SameSite/Secure, JWT HS256, logout borra cookie (ver WR-02) |
| CARGA-01 | 01-08, 01-10, 01-13 | Arrastrar o seleccionar XML y carpetas; PDF ignorados | ✓ SATISFECHO | Dropzone + input `webkitdirectory`; 143 PDF ignorados en prueba propia. El arrastre real desde Finder queda como elemento humano |
| CARGA-02 | 01-02, 01-05, 01-10, 01-16 | Parseo en el navegador con DOMParser, sin servidor | ✓ SATISFECHO | Sin llamadas de red con XML; CSP `connect-src 'self'`; e2e |
| CARGA-03 | 01-04, 01-05 | Solo CFDI 4.0, rechazo claro por archivo | ✓ SATISFECHO | `rejectReasonText`, pruebas de rechazos y prueba propia |
| CARGA-04 | 01-08 | Duplicados por UUID | ✓ SATISFECHO | Prueba propia: 5 duplicados al reimportar |
| CARGA-05 | 01-08, 01-10, 01-11, 01-12, 01-14, 01-15 | Reporte de importación (I/E/P, duplicados, errores, ignorados) | ✓ SATISFECHO | `SummaryCards`, `ReportAccordions`, tabla |
| CARGA-06 | 01-08, 01-10, 01-13, 01-16 | Facturas solo en memoria | ✓ SATISFECHO | Store sin persistencia; e2e de recarga |

REQUIREMENTS.md sigue con las casillas `[ ]` y estado "Pending" para estos 11 IDs: es contabilidad de documentos pendiente de actualizar por el orquestador, no una falla de código.

### Anti-patrones encontrados

| Archivo | Línea | Patrón | Severidad | Impacto |
|---------|-------|--------|-----------|---------|
| (ninguno) | - | Sin `TBD`/`FIXME`/`XXX` de deuda en código de la fase (las únicas coincidencias son la moneda `XXX` de los Pagos) | - | - |
| `src/lib/client/navigation.ts` | 6 | Directiva `eslint-disable` sin efecto (el único warning de eslint) | ℹ️ Info | IN-08 de la revisión |
| `src/lib/client/ingest.ts` | 31-37 | Lee el archivo completo antes de aplicar el límite de 2 MB | ⚠️ Warning | WR-01: robustez ante un `.xml` enorme; no afecta el flujo con facturas reales |
| `src/lib/client/logout.ts` | 4-11 | Ignora `res.ok` y navega a /login aunque el servidor falle | ⚠️ Warning | WR-02: en un fallo 5xx la cookie sigue viva 30 días y el usuario cree haber salido. El camino normal funciona y está confirmado |
| `src/app/api/auth/login/route.ts` | 25-28 | El retraso de 1 s no limita intentos en paralelo; README no documenta la regla del WAF de Vercel | ⚠️ Warning | WR-03: endurecimiento de fuerza bruta pendiente |
| `scripts/check-bundle-secrets.mjs` | 10, 46-65 | Solo escanea `.next/static`, no `.next/server/app` | ⚠️ Warning | WR-04: la prueba de "secretos fuera del cliente" cubre menos de lo que promete |

Las 12 observaciones de `01-REVIEW.md` (0 críticas, 4 warnings, 8 info) siguen con disposición `open`. Ninguna impide un criterio del ROADMAP. Recomiendo decidir WR-02 y WR-03 antes de dar la fase por cerrada, porque tocan el acceso protegido que es el centro de la meta.

### Verificación humana requerida

Cuatro grupos de comprobaciones de navegador real que los planes dejaron sin ejecutar (detalle en el frontmatter `human_verification`):

1. **Arrastre de carpeta desde el Finder** y capa de arrastre cubriendo el viewport con scroll (planes 01-13, supuestos A1/A6).
2. **Tema sin destello** con SO oscuro y datos del sitio borrados (plan 01-03).
3. **Layout y foco**: nombres largos a 360 px, tooltip con la ruta, foco inicial de los diálogos (planes 01-11, 01-14, 01-15).
4. **Sensación de paginación y toasts** con las 143 facturas y la carpeta de rechazos (planes 01-04, 01-12, 01-15).

Estos elementos son de apariencia y de entrada nativa del navegador. La lógica detrás de cada uno tiene pruebas automatizadas que pasan, y el usuario ya confirmó en vivo el flujo completo de los cinco criterios del ROADMAP.

### Resumen de brechas

No hay brechas ni verdades fallidas. No hay elementos diferidos a fases posteriores. Lo pendiente es (a) la verificación humana visual listada arriba, (b) la decisión del usuario sobre los 12 hallazgos abiertos de la revisión de código (en especial WR-02 y WR-03), (c) actualizar las casillas y el estado de la Fase 1 en REQUIREMENTS.md y ROADMAP.md, y (d) opcionalmente reformatear la meta de la fase como historia de usuario para el modo MVP.

---

_Verificado: 2026-10-14T10:40:00Z_
_Verificador: Claude (gsd-verifier)_
