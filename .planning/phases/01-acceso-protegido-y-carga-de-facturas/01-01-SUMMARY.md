---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 01
subsystem: auth
tags: [nextjs, typescript, pnpm, jose, jwt, proxy, zustand, domparser, vitest, walking-skeleton]

requires: []
provides:
  - "Proyecto Next.js 16.4.0 + TypeScript 6.0.3 strict + pnpm 11.5.2 (Node 24.x) con lint, typecheck, tests y build en verde"
  - "Puerta de contraseña compartida: src/proxy.ts (fail closed) + sesión HS256 con jose y claim pwd con clave"
  - "Rutas POST /api/auth/login y /api/auth/logout, /login funcional, safeNextPath"
  - "parseCfdi (DOMParser) con cadena de validación CFDI 4.0 y cabecera de ParsedInvoice"
  - "Store zustand en memoria (sin persistencia) y panel de conteos I/E/P en el navegador"
  - "scripts/smoke-auth.mjs (14 comprobaciones contra next start)"
affects: [01-02, 01-03, 01-06, 01-07, 01-08, 01-09, 01-10, 01-13, 01-16]

actuals:
  tokens: 9500
  tasks: 2
  commits: 1

tech-stack:
  added:
    - "next 16.4.0, react/react-dom 19.3.0, typescript 6.0.3 (exacto)"
    - "jose 6.2.12, zod 4.6.7, zustand 5.0.15, react-dropzone 20.1.3, @tanstack/react-table 9.3.1, server-only 0.0.1"
    - "vitest 5.0.4, jsdom 30.1.2, @vitejs/plugin-react 6.1.2, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1, @playwright/test 1.64.0, @types/node ^24"
  patterns:
    - "Proxy con matcher de lista de exclusión y allowlist pública dentro de la función (fail closed)"
    - "Token de sesión con claim pwd = HMAC(SESSION_SECRET, 'pwd-v1:' + APP_PASSWORD) para invalidar sesiones al rotar la contraseña"
    - "Navegación dura (window.location.assign) tras login y logout; ?next= leído al enviar el formulario"
    - "src/domain puro, con regla ESLint no-restricted-imports"

key-files:
  created:
    - src/proxy.ts
    - src/lib/server/session.ts
    - src/lib/safeNext.ts
    - src/lib/client/logout.ts
    - src/app/api/auth/login/route.ts
    - src/app/api/auth/logout/route.ts
    - src/app/login/page.tsx
    - src/app/login/LoginForm.tsx
    - src/features/shell/LogoutButton.tsx
    - src/features/upload/ImportCountsPanel.tsx
    - src/stores/sessionStore.ts
    - src/domain/cfdi/types.ts
    - src/domain/cfdi/parseCfdi.ts
    - src/domain/cfdi/parseCfdi.test.ts
    - tests/fixtures/cfdi/ingreso-bom-decl.xml
    - scripts/smoke-auth.mjs
    - vitest.config.mts
    - vitest.setup.ts
  modified:
    - .gitignore
    - eslint.config.mjs
    - tsconfig.json
    - package.json
    - src/app/layout.tsx
    - src/app/page.tsx

key-decisions:
  - "Un CFDI 4.0 al que le falta un atributo obligatorio (Fecha, Moneda, SubTotal, Total, Emisor.Rfc, Receptor.Rfc) se rechaza como malformed con detail missing:<Atributo>"
  - "La comprobación 14 del smoke es 'un /login con sesión válida sigue respondiendo 200' (Open Question 2: no redirigir lejos de /login)"
  - "eslint ignora .claude/**, .planning/** y node_modules/** (no son código de la aplicación)"

patterns-established:
  - "Secretos solo en src/lib/server/session.ts tras import 'server-only'"
  - "Ingesta sin red: ningún fetch en src/domain, src/stores ni src/features/upload"

requirements-completed: [DEV-01, DEV-02, DEV-04, ACC-01, ACC-02]

coverage:
  - id: D1
    description: "Sin cookie de sesión, las páginas redirigen (307) a /login con next, y /api/* distinto de /api/auth/* responde 401 JSON"
    requirement: ACC-01
    verification:
      - kind: integration
        ref: "pnpm smoke:auth (comprobaciones 1, 2, 4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Login con la contraseña correcta emite la cookie session (HttpOnly, SameSite=lax, Path=/, Max-Age=2592000, Secure en producción); contraseña incorrecta da 401 tras al menos 900 ms; logout limpia la cookie"
    requirement: ACC-02
    verification:
      - kind: integration
        ref: "pnpm smoke:auth (comprobaciones 5, 6, 7, 10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cambiar APP_PASSWORD invalida las cookies anteriores y la falta de variables de entorno falla cerrado"
    requirement: ACC-01
    verification:
      - kind: integration
        ref: "pnpm smoke:auth (comprobaciones 11, 12, 13)"
        status: pass
    human_judgment: false
  - id: D4
    description: "parseCfdi valida CFDI 4.0 (BOM, declaración XML), rechaza cfd/3 y no-CFDI; el panel muestra conteos por tipo, rechazados e ignorados calculados en el navegador"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "src/domain/cfdi/parseCfdi.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Scaffold Next.js 16.4 + TS strict con pnpm 11.5.2 y engines.node 24.x; pnpm verify en verde"
    requirement: DEV-01
    verification:
      - kind: other
        ref: "pnpm verify"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-10-14
status: complete
plan_head_before: abb97f08cc2b1dafef9db0fb13c218a3bf0b1cf7
plan_head_after: b0d871f38541d086f8f7bdb1c23bf95aff60603b
commits: 1
---

# Phase 1 Plan 01: Walking Skeleton Summary

**Proyecto Next.js 16.4 + TypeScript 6 strict con puerta de contraseña (Proxy + sesión HS256 con jose y claim pwd con clave), parseo CFDI 4.0 con DOMParser en el navegador y conteos I/E/P desde un store zustand en memoria, verificado con `pnpm verify` y un smoke de 14 comprobaciones sobre una build de producción.**

## Performance

- **Duration:** aprox. 20 min (continuación tras la aprobación del Task 1)
- **Started:** 2026-10-14T06:30:00Z
- **Completed:** 2026-10-14T06:40:00Z
- **Tasks:** 2 (Task 1 checkpoint aprobado por el usuario; Task 2 tracer ejecutado)
- **Files modified:** 31 en el commit del tracer

## Aprobación del checkpoint de paquetes (Task 1)

El usuario respondió "approved" a la lista completa de paquetes fijados para toda la fase: runtime (next 16.4.0, react/react-dom 19.3.0, jose 6.2.12, zod 4.6.7, zustand 5.0.15, react-dropzone 20.1.3, @tanstack/react-table 9.3.1, server-only 0.0.1); dev (typescript 6.0.3, eslint 9.39.5, eslint-config-next 16.4.0, tailwindcss 4.3.3 con @tailwindcss/turbopack, vitest 5.0.4, jsdom 30.1.2, @vitejs/plugin-react 6.1.2, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1, @playwright/test 1.64.0, @types/node ^24, @types/react, @types/react-dom); y, para planes posteriores, shadcn 4.21.4, @base-ui/react 1.9.0, class-variance-authority ^0.7.1, cn ^0.4.0, lucide-react ^1.55.0, tw-animate-css ^1.4.0 y sonner ^2.0.8. Ninguna instalación se ejecutó antes de esa respuesta. No hubo commit para el Task 1 (solo checkpoint).

## Accomplishments

- Puerta de contraseña completa y verificada de punta a punta sobre `next start`: redirección con `next`, 401 JSON en `/api/*`, cookie endurecida, retraso de 1 s en fallos, rotación de contraseña y fail closed sin variables de entorno.
- Ingesta real en el navegador: selector de archivos y de carpeta, descarte de ocultos (D-12), `parseCfdi(await file.text())` y escritura al store en memoria; el panel muestra "N XML: Ingreso, Egreso, Pago · Rechazados · Ignorados" y la línea de privacidad (D-25). No hay llamadas de red en la ruta de ingesta.
- Toolchain: `pnpm lint`, `typecheck` (con `next typegen`), `test` y `build` en verde; regla ESLint que mantiene `src/domain` puro.

## Task Commits

1. **Task 1: Aprobar la lista de paquetes fijados** - sin commit (checkpoint:human-verify, aprobado por el usuario)
2. **Task 2: Slice de punta a punta (contraseña, página protegida, parseo, conteos, logout)** - `b0d871f` (feat)

**Plan metadata:** commit docs de este SUMMARY (siguiente commit en la rama del worktree)

## Files Created/Modified

- `src/proxy.ts` - Puerta fail closed: allowlist `/login` y `/api/auth/*`, 401 JSON en API, redirección con `next` (sin `_rsc`).
- `src/lib/server/session.ts` - Lectura de entorno con zod, `timingSafeEqual` sobre digests SHA-256, token HS256 con claim `pwd` con clave, verificación con `algorithms: ["HS256"]`.
- `src/lib/safeNext.ts` - Guardia de open redirect (re-chequeo tras normalizar la URL).
- `src/app/api/auth/login/route.ts`, `logout/route.ts` - Login (zod `.strict()`, 1 s de retraso en fallo, cookie) y logout (204, `Max-Age=0`).
- `src/app/login/LoginForm.tsx`, `page.tsx` - Formulario funcional con los textos de UI-SPEC; navega solo con `safeNextPath`.
- `src/domain/cfdi/parseCfdi.ts`, `types.ts`, `parseCfdi.test.ts` - Cadena de validación Pattern 4 y cabecera de `ParsedInvoice` como cadenas exactas del XML.
- `src/stores/sessionStore.ts` - zustand sin middleware; `parsed`, `ignored`, `addBatch`.
- `src/features/upload/ImportCountsPanel.tsx`, `src/features/shell/LogoutButton.tsx`, `src/lib/client/logout.ts`, `src/app/page.tsx`, `src/app/layout.tsx` - UI del esqueleto (`lang="es-MX"`).
- `scripts/smoke-auth.mjs` - Smoke de 14 comprobaciones contra `next start -p 3123`.
- `vitest.config.mts`, `vitest.setup.ts`, `eslint.config.mjs`, `tsconfig.json`, `package.json`, `.gitignore`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `next.config.ts`, `AGENTS.md`, `README.md` - Scaffold y toolchain.
- `tests/fixtures/cfdi/ingreso-bom-decl.xml` - CFDI 4.0 sintético (BOM, declaración, RFC de prueba del SAT).

## Decisions Made

- Atributos obligatorios ausentes en un CFDI 4.0 se rechazan como `malformed` con `detail: "missing:<Atributo>"` (el plan no lo especificaba; evita inventar valores y no amplía la lista cerrada de motivos).
- La comprobación 14 del smoke verifica que `/login` con sesión válida sigue siendo 200 (Open Question 2 resuelta como "no redirigir").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint analizaba `.claude/` y `.planning/`**
- **Found during:** Task 2 (primer `pnpm lint`)
- **Issue:** 1244 errores en scripts `.cjs` del runtime GSD versionados bajo `.claude/`, ajenos a la aplicación.
- **Fix:** se añadieron `.claude/**`, `.planning/**` y `node_modules/**` a `globalIgnores` en `eslint.config.mjs`.
- **Files modified:** `eslint.config.mjs`
- **Verification:** `pnpm lint` y `pnpm eslint .` sin errores ni avisos.
- **Committed in:** `b0d871f`

**2. [Rule 1 - Bug] pnpm reescribió `typescript` a `^6.0.3`**
- **Found during:** Task 2 (instalación)
- **Issue:** el último `pnpm add -D @types/node@^24` dejó `"typescript": "^6.0.3"`, contra el pin exacto exigido (Pitfall 3).
- **Fix:** se restauró `"typescript": "6.0.3"` y se reejecutó `pnpm install` (el lockfile conserva `specifier: 6.0.3`).
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Committed in:** `b0d871f`

**3. [Rule 2 - Missing critical] Justificaciones de excepciones de lint**
- **Issue:** `@next/next/no-location-assign-relative-destination` avisa sobre `window.location.assign("/login")`, pero la navegación dura es obligatoria (reinicia memoria y caché del router). Se dejó `eslint-disable-next-line` con comentario que lo justifica, conforme a CLAUDE.md. Se quitó una directiva `no-control-regex` innecesaria en `safeNext.ts`.
- **Files modified:** `src/lib/client/logout.ts`, `src/lib/safeNext.ts`

### Diferencias menores respecto a la lista de archivos del plan

- `postcss.config.mjs` no existe: `create-next-app@16.4.0` configura Tailwind con `@tailwindcss/turbopack` en `next.config.ts` y no emite ese archivo; no se creó uno innecesario.
- El ledger `gsd-plan-head-before-01-01` en el git-dir del worktree no pudo escribirse (la herramienta bloquea escribir fuera del worktree); `commits` se midió con `git rev-list --count abb97f08..HEAD`.
- pnpm local es 12.10.1, pero el `packageManager` fijado hizo que se ejecutara pnpm v11.5.2 automáticamente.

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3) más 3 diferencias menores.
**Impact on plan:** ninguna afecta el alcance ni el comportamiento especificado.

## Issues Encountered

- Prueba adicional temporal: se verificó el panel con Testing Library/jsdom (dos XML, uno rechazado, un PDF ignorado y un archivo oculto descartado: conteos correctos y el input con `webkitdirectory`). Esa prueba se eliminó porque no está en el plan; los tests del panel llegan en planes posteriores (01-10) y la verificación en navegador real en el smoke Playwright del Plan 01-16.
- La salida de `pnpm audit` no se ejecutó en este plan (no estaba en las acciones del Task 2).

## User Setup Required

`.env.local` se creó con `APP_PASSWORD` y `SESSION_SECRET` aleatorios, está ignorado por git y **no se commitea**. Como el worktree se elimina al terminar, el archivo no llega a la copia principal: en el repositorio principal hay que crear uno con `openssl rand -base64 18` para `APP_PASSWORD` y `openssl rand -base64 48` para `SESSION_SECRET`. La contraseña no se imprime aquí porque este SUMMARY se versiona (un hook también impide leer `.env.local`).

## Known Stubs

Ninguno. (El panel es un esqueleto intencional: Plans 01-08 a 01-15 lo reemplazan con los componentes de UI-SPEC, sin datos de relleno.)

## Threat Flags

Ninguno: no se añadió superficie fuera del threat_model del plan.

## Next Phase Readiness

- Listo para 01-02 (extracción completa de campos), 01-03 (shadcn y tokens) y 01-09 (tests unitarios de la puerta); las interfaces del plan están implementadas tal como se declararon.
- Pendiente de fases posteriores: cabeceras de seguridad, `.env.example`, `.vercelignore`, README de despliegue y la confirmación en Vercel (Plan 01-16, D-28); supuesto A2 (pnpm 11 en Vercel) sigue sin probar.

## Self-Check: PASSED

---
*Phase: 01-acceso-protegido-y-carga-de-facturas*
*Completed: 2026-10-14*
