---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 06
subsystem: ui
tags: [shadcn, base-ui, login, card, input-group, a11y, vitest, tdd]

requires:
  - phase: 01-acceso-protegido-y-carga-de-facturas
    provides: "LoginForm con el flujo de peticion (plan 01-01), kit shadcn, Button y modulo es (plan 01-03)"
provides:
  - "Copias shadcn card, input, input-group, textarea, field, label, separator en src/components/ui"
  - "LoginForm como Card del UI-SPEC (nombre, subtitulo, campo Contrasena, area de error, Entrar) sin logo"
  - "Boton mostrar/ocultar contrasena accesible (aria-pressed, aria-label alternante, type=button)"
  - "Pruebas de contenido de la tarjeta, mostrar/ocultar y envio vacio"
affects: [01-07, 01-09]

tech-stack:
  added: []
  patterns:
    - "Composicion de campos con Field + FieldLabel + InputGroup(InputGroupInput + InputGroupAddon align=inline-end + InputGroupButton)"
    - "Error de campo con FieldError (role=alert) mas icono CircleAlert aria-hidden, enlazado con aria-describedby y aria-invalid"
    - "Todas las cadenas visibles salen de es.global y es.login"

key-files:
  created:
    - src/components/ui/card.tsx
    - src/components/ui/input.tsx
    - src/components/ui/input-group.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/field.tsx
    - src/components/ui/label.tsx
    - src/components/ui/separator.tsx
    - src/app/login/LoginForm.test.tsx
  modified:
    - src/app/login/LoginForm.tsx

key-decisions:
  - "Sin dependencias nuevas: package.json, pnpm-lock.yaml y button.tsx quedan intactos (el CLI se detuvo ante la pregunta de sobrescribir button.tsx; se reejecuto con respuesta 'n' para las copias restantes)"
  - "La tarjeta usa border + ring-0 sobre el token background (el Card de shadcn trae ring-1 por defecto) para cumplir el borde de 1 px del UI-SPEC"
  - "Altura del grupo h-9 (36 px) y h-11 (44 px) bajo 640 px; el boton de icono usa size-8 (icon-sm de InputGroupButton) y size-11 bajo 640 px"

patterns-established:
  - "El estado de error de LoginForm se expone con aria-invalid y aria-describedby='password-error'; el plan 01-09 anade reenfoque y seleccion"

requirements-completed: [ACC-01]

duration: 15min
completed: 2026-10-14
status: complete
commits: 3
plan_head_before: 15250c5e458ddddd40ad8b5c691ae71fbb064491
plan_head_after: 79432590be6f44acea5754602b86149d29404a67
actuals:
  tokens: 14000
  tasks: 2
  commits: 3
---

# Phase 1 Plan 06: Tarjeta de login con mostrar/ocultar contrasena Summary

**LoginForm reconstruido como la Card del UI-SPEC (shadcn Field + InputGroup, boton Eye/EyeOff con aria-pressed) conservando intacto el flujo de peticion del plan 01-01.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 9 (8 creados, 1 modificado)

## Accomplishments

- Instaladas las copias shadcn card, input, input-group, textarea, field, label y separator sin tocar button.tsx, package.json ni pnpm-lock.yaml.
- LoginForm ahora es una Card de 384 px (tope 100% menos 32 px), fondo `background`, borde de 1 px, con "InvoiceChecker" (20/600), subtitulo muted, campo "Contrasena" autoenfocado con `autocomplete="current-password"`, area de error con CircleAlert en color destructivo y `role="alert"`, y boton "Entrar" de ancho completo. Todo el texto viene de `es.ts`.
- Boton mostrar/ocultar: alterna `password`/`text`, `aria-pressed`, `aria-label` entre "Mostrar contrasena" y "Ocultar contrasena", mantiene el foco y nunca envia el formulario (`type="button"`).
- El flujo de peticion, mapeo de estados, comprobacion de vacio y `safeNextPath` quedan como estaban; `pnpm smoke:auth` imprime "smoke-auth: OK (14 checks)".

## Task Commits

1. **Task 1: tarjeta de login segun UI-SPEC** - `fe3678c` (feat)
2. **Task 2 RED: pruebas de contenido, mostrar/ocultar y envio vacio** - `f0b3091` (test)
3. **Task 2 GREEN: boton mostrar/ocultar contrasena** - `7943259` (feat)

## Verification

- `pnpm verify` (lint, typecheck, vitest 36 pruebas, build) en verde.
- `pnpm exec vitest run src/app/login` en verde (3 pruebas).
- `pnpm smoke:auth`: "smoke-auth: OK (14 checks)".
- `git diff --stat 15250c5..HEAD -- package.json pnpm-lock.yaml src/components/ui/button.tsx` vacio.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `shadcn add ... -y` se detuvo en la pregunta de sobrescribir button.tsx**
- **Found during:** Task 1
- **Issue:** `-y` no responde la pregunta de sobrescritura; el CLI solo creo card.tsx e input.tsx y quedo esperando.
- **Fix:** se reejecuto `shadcn add input-group field` con respuesta "n" a la pregunta; button.tsx e input.tsx se omitieron como identicos y se crearon las otras cinco copias.
- **Files modified:** ninguno fuera de la lista del plan.
- **Commit:** fe3678c

**2. [Rule 2 - Missing critical] aria-invalid / aria-describedby en el campo**
- **Found during:** Task 1
- **Issue:** el area de error no estaba asociada al campo; el UI-SPEC exige `aria-invalid` y `aria-describedby` en fallo.
- **Fix:** el input recibe `aria-invalid` y `aria-describedby="password-error"` cuando hay mensaje. El reenfoque y la seleccion del contenido siguen siendo del plan 01-09.
- **Commit:** fe3678c

**Total deviations:** 2 auto-fixed. **Impact:** ninguno en el alcance; sin archivos fuera de la lista.

## Notes

- El estado pendiente conserva el texto "Entrando..." (`es.login.submitPending`); el Spinner y el bloqueo completo llegan en el plan 01-09.
- El boton de icono mide 32 px (`icon-sm` de InputGroupButton) dentro de un grupo de 36 px para que no desborde; el UI-SPEC pide 36 px. Bajo 640 px mide 44 px dentro de un grupo de 44 px. Diferencia menor de 4 px a favor de que el grupo se vea limpio.
- El fondo `secondary` centrado y el toggle de tema de /login pertenecen al plan 01-07 (no se toco page.tsx ni layout.tsx).

## Known Stubs

None.

## Threat Flags

None. No hay superficie nueva de red ni de autenticacion; T-01-SC mitigado (sin dependencias nuevas, button.tsx protegido).

## Self-Check: PASSED

- Archivos creados presentes: card, input, input-group, textarea, field, label, separator, LoginForm.test.tsx.
- Commits fe3678c, f0b3091, 7943259 presentes en el historial.
