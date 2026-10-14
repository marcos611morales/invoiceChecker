---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 03
subsystem: ui
tags: [shadcn, base-ui, tailwind, theme, dark-mode, geist, copy, vitest, tdd]

requires:
  - phase: 01-acceso-protegido-y-carga-de-facturas
    provides: "Scaffold Next.js 16.4 + Tailwind 4, layout y globals.css del plan 01-01, lista de paquetes aprobada"
provides:
  - "Kit shadcn base-nova (Base UI) con components.json y Button con relleno destructivo del UI-SPEC"
  - "Tokens UI-SPEC claro/oscuro en globals.css, variante dark con :where(.dark, .dark *), Geist Sans/Mono"
  - "Motor de tema: THEME_STORAGE_KEY, themeInitScript, useActiveTheme, useMounted, toggleTheme (con pruebas)"
  - "Módulo es con todas las cadenas estáticas del Copywriting Contract"
affects: [01-04, 01-06, 01-07, 01-09, 01-11, 01-12, 01-14, 01-15, 01-16]

tech-stack:
  added:
    - "shadcn 4.21.4 (devDependency exacta)"
    - "@base-ui/react ^1.9.0 (lock 1.9.0), class-variance-authority ^0.7.1, cn ^0.4.0, lucide-react ^1.56.0, tw-animate-css ^1.4.0"
  patterns:
    - "Tema por clase .dark en <html>, script previo a la hidratación y suppressHydrationWarning"
    - "Estado externo con useSyncExternalStore (MutationObserver + matchMedia); sin setState en efectos"
    - "Módulos con constantes seguras para servidor (themeScript.ts) separados de los hooks de React (theme.ts)"
    - "Componentes solo con tokens semánticos; relleno destructivo mediante el token destructive-fill"

key-files:
  created:
    - components.json
    - src/components/ui/button.tsx
    - src/lib/utils.ts
    - src/lib/copy/es.ts
    - src/lib/client/theme.ts
    - src/lib/client/themeScript.ts
    - src/lib/client/theme.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - src/app/globals.css
    - src/app/layout.tsx
    - scripts/smoke-auth.mjs

key-decisions:
  - "Mapear --font-sans a la variable --font-geist-sans del scaffold (alternativa permitida por RESEARCH Pitfall 5) en lugar de renombrar la variable de next/font a --font-sans: evita la autorreferencia var(--font-sans) que emite shadcn init"
  - "Las variables de fuente se quedan en <html> (no en <body>) porque html { font-family: var(--font-sans) } las necesita en ese nivel"
  - "Las constantes del script de tema viven en themeScript.ts; theme.ts las reexporta, así la interfaz del plan se mantiene"

patterns-established:
  - "Un layout de servidor no puede importar un módulo que importe hooks de React: separar constantes puras en su propio archivo"
  - "Una elección de tema hecha con el botón se guarda en memoria de módulo (sessionChoice) para que el cambio en vivo del SO no la pise cuando localStorage está bloqueado"

requirements-completed: [ACC-01, DEV-02]

coverage:
  - id: D1
    description: "Todas las páginas usan Geist Sans/Mono y la paleta UI-SPEC (claro y oscuro) sobre shadcn base-nova"
    requirement: ACC-01
    verification:
      - kind: other
        ref: "pnpm verify (CSS compilado contiene --destructive #FF6467 y --destructive-fill #DC2626 en .dark)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sin elección guardada la app sigue el tema del SO, incluido el cambio en vivo; toggleTheme guarda invoicechecker:theme y sobrevive a almacenamiento bloqueado o valor inválido"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "src/lib/client/theme.test.ts (16 pruebas)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Con el SO oscuro y almacenamiento vacío el primer pintado ya es oscuro, sin advertencia de hidratación"
    requirement: ACC-01
    verification:
      - kind: other
        ref: "Comprobación humana de fin de fase (build de producción en navegador)"
        status: not-run
    human_judgment: true
  - id: D4
    description: "Cada cadena estática del Copywriting Contract vive en un módulo es"
    requirement: ACC-01
    verification:
      - kind: other
        ref: "bucle de grep del criterio de aceptación sobre src/lib/copy/es.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "shadcn 4.21.4 es devDependency exacta y pnpm audit --prod no reporta avisos altos ni críticos; el smoke de autenticación sigue en verde"
    requirement: DEV-02
    verification:
      - kind: integration
        ref: "pnpm audit --prod --audit-level high; pnpm smoke:auth (14 comprobaciones)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-14
status: complete
plan_head_before: a7ebde21d6fc67aa4d488d1bc317a313c89d7bc1
plan_head_after: 40db1b7d042a05db1fdcf6e42d842929be90691a
commits: 4
actuals:
  tokens: 6000
  tasks: 2
  commits: 4
---

# Phase 1 Plan 03: Kit de diseño y motor de tema Summary

**Kit shadcn base-nova (Base UI) con los tokens claro/oscuro del UI-SPEC y Geist, motor de tema sin parpadeo (script previo a la hidratación + useSyncExternalStore) con elección persistida que resiste el almacenamiento bloqueado, y un único módulo `es` con todas las cadenas estáticas en español.**

## Performance

- **Duration:** aprox. 25 min
- **Completed:** 2026-10-14
- **Tasks:** 2 (Task 2 con TDD: commit RED y commit GREEN)
- **Files modified:** 12

## Accomplishments

- `shadcn@4.21.4 init -d -y` y `add button -y` ejecutados; shadcn quedó como devDependency exacta y `pnpm audit --prod --audit-level high` no reporta avisos.
- `globals.css` con los tokens del UI-SPEC en `:root` y `.dark`, `color-scheme`, `@custom-variant dark (&:where(.dark, .dark *));`, transiciones de 150 ms desactivadas con `prefers-reduced-motion`, y un token `destructive-fill` (con `destructive-fill-foreground` blanco) que usa la variante destructiva del Button.
- Motor de tema: `themeInitScript` (IIFE constante con try/catch que solo acepta "light" o "dark"), `useActiveTheme` (MutationObserver + matchMedia en vivo mientras no hay elección), `useMounted` (sin setState en efectos) y `toggleTheme` (guarda con try/catch; la elección de sesión se respeta aunque el almacenamiento esté bloqueado).
- `src/lib/copy/es.ts` agrupa por pantalla (global, login, empty, report, table, errors, dialogs) todas las cadenas estáticas del Copywriting Contract, incluidos los tres nombres del botón de tema. Las cadenas interpoladas quedan para `messages.ts` (plan 01-04 en adelante).

## Task Commits

1. **Task 1: Kit shadcn base-nova, tokens UI-SPEC, fuentes Geist y módulo es** - `f5b9711` (feat)
2. **Task 2 RED: pruebas del motor de tema** - `930c223` (test)
3. **Task 2 (arreglo colateral): smoke de cookie manipulada determinista** - `bc6c0bd` (fix)
4. **Task 2 GREEN: motor de tema y layout** - `40db1b7` (feat)

**Plan metadata:** commit docs de este SUMMARY (siguiente commit en la rama del worktree).

### Evidencia RED (TDD)

- Comando: `pnpm exec vitest run src/lib/client/theme.test.ts --reporter=tap`, exit 1, 16 pruebas, 13 fallan por aserciones (por ejemplo "expected false to be true" en la clase `dark`), 3 pasan por coincidencia con el esqueleto inerte.
- Clasificador `gsd-tools check tdd-red-evidence`: `RED_EVIDENCE_OK` (`target_test_failed`).
- `semanticAssessment`: la primera ejecución falló por import no resuelto (`./theme` no existía), lo cual es INVALID_RED; por eso el commit RED incluye un esqueleto inerte de `theme.ts` (mismas exportaciones, cuerpos vacíos) para que las pruebas carguen y fallen por la conducta planeada.
- GREEN: 16 de 16 pruebas pasan; `pnpm verify` con 19 pruebas en total.

## Files Created/Modified

- `components.json`, `src/components/ui/button.tsx`, `src/lib/utils.ts` - Salida de shadcn init/add. `src/lib/utils.ts` es el helper que crea init (reexporta `cn` del paquete `cn`).
- `src/app/globals.css` - Tokens UI-SPEC, variante dark, mapeo de fuentes, transiciones.
- `src/app/layout.tsx` - `suppressHydrationWarning` y el script de tema en `<head>` (único uso de HTML crudo en la app).
- `src/lib/client/theme.ts`, `themeScript.ts`, `theme.test.ts` - Motor de tema y sus 16 pruebas.
- `src/lib/copy/es.ts` - Cadenas estáticas.
- `scripts/smoke-auth.mjs` - Corrección de una comprobación inestable (ver desviaciones).
- `package.json`, `pnpm-lock.yaml` - Dependencias aprobadas del kit.

## Decisions Made

- Se mapeó `--font-sans` a `var(--font-geist-sans)` y la variable de next/font se quedó como `--font-geist-sans` (RESEARCH Pitfall 5 permite esta alternativa). Así no queda la autorreferencia que genera `shadcn init`.
- Las clases de variables de fuente se aplican en `<html>` y no en `<body>`, porque `html { font-family: var(--font-sans) }` las lee a ese nivel.
- Se retiraron los tokens `sidebar-*` y `chart-*` de shadcn: el UI-SPEC no los usa y no introduce un tercer color semántico.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] El layout (Server Component) no puede importar `theme.ts`**
- **Found during:** Task 2 (`pnpm verify`, build)
- **Issue:** Turbopack rechaza importar en un Server Component un módulo que importa `useSyncExternalStore`.
- **Fix:** se creó `src/lib/client/themeScript.ts` con `THEME_STORAGE_KEY`, `DARK_QUERY` y `themeInitScript`; `theme.ts` los reexporta (la interfaz del plan se conserva) y el layout importa desde `themeScript`.
- **Files modified:** `src/lib/client/themeScript.ts` (nuevo), `src/lib/client/theme.ts`, `src/app/layout.tsx`
- **Commit:** `40db1b7`

**2. [Rule 1 - Bug] `smoke-auth` fallaba de forma intermitente en "tampered cookie is redirected"**
- **Found during:** Task 2 (`pnpm smoke:auth`, 1 de 8 ejecuciones)
- **Issue:** la comprobación cambiaba solo el último carácter del token; el último carácter base64url de una firma HS256 tiene 2 bits sin uso, así que a veces la firma seguía siendo válida (200 en lugar de 307). Error preexistente del plan 01-01, no causado por este plan.
- **Fix:** se cambia el primer carácter de la firma. Verificado con 3 ejecuciones consecutivas en verde (más la de `pnpm verify`).
- **Files modified:** `scripts/smoke-auth.mjs` (fuera de `files_modified` del plan; necesario porque el `verify` del Task 2 incluye `pnpm smoke:auth`)
- **Commit:** `bc6c0bd`

### Diferencias menores

- Se añadió el esqueleto inerte de `theme.ts` al commit RED (ver evidencia RED) para obtener una prueba RED válida.
- `lucide-react` quedó en `^1.56.0` y `@base-ui/react` en `^1.9.0` (el lock fija 1.9.0): rangos con caret dentro de lo aprobado (`^1.55.0` / 1.9.0).
- El script de tema no es literalmente el primer hijo de `<head>` en el HTML emitido: Next coloca `meta charSet`, `viewport` y las hojas de estilo antes. Sigue ejecutándose de forma síncrona en `<head>`, antes de `<body>` y del primer pintado.
- El ledger `gsd-plan-head-before` no se escribió en el git-dir (la herramienta bloquea escribir fuera del worktree); `commits` se midió con `git rev-list --count a7ebde2..HEAD`, antes del commit de este SUMMARY.

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3), 4 diferencias menores.
**Impact on plan:** ninguna cambia el alcance ni las interfaces vinculantes.

## Issues Encountered

- `shadcn init` emite `--font-sans: var(--font-sans)` en `@theme inline`; el CSS compilado muestra `:root{--font-sans:var(--font-sans)}`, una autorreferencia que solo no rompe por precedencia de capas. Se resolvió con el mapeo descrito arriba.

## User Setup Required

Ninguno.

## Pendiente de verificación humana

La comprobación humana del plan (fin de fase) no se ejecutó aquí: `pnpm build && pnpm start`, SO en oscuro, datos del sitio borrados, recargar `/login` varias veces; esperado: primer pintado ya oscuro sin destello blanco, sin advertencias de hidratación en consola, y que al volver el SO a claro con la página abierta esta se ponga clara. La parte de lógica (script, hooks, almacenamiento bloqueado) está cubierta por las 16 pruebas unitarias.

## Known Stubs

Ninguno. (`es.ts` contiene copy real, aún sin consumidores; los planes 01-06 en adelante lo leen.)

## Threat Flags

Ninguno. T-01-21 mitigado: `themeInitScript` es una constante sin datos de usuario, solo acepta "light"/"dark", y el único `dangerouslySetInnerHTML` de `src` está en `src/app/layout.tsx`. T-01-SC mitigado: shadcn exacto en devDependencies, `pnpm audit --prod --audit-level high` sin avisos.

## Next Phase Readiness

- Listo para los planes que añaden componentes (01-06, 01-07, 01-09, 01-11, 01-12, 01-14, 01-15) con `pnpm dlx shadcn@4.21.4 add <componente> -y`; el plan 01-07 añade el botón de tema visible sobre `toggleTheme`/`useActiveTheme`/`useMounted`.
- Al añadir `sonner`: quitar la importación de `next-themes` y pasar `theme` desde `useActiveTheme()` (Pitfall 5).

## Self-Check: PASSED

---
*Phase: 01-acceso-protegido-y-carga-de-facturas*
*Completed: 2026-10-14*
