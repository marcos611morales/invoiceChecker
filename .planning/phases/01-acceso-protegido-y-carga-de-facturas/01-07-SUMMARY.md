---
phase: 01-acceso-protegido-y-carga-de-facturas
plan: 07
subsystem: ui
tags: [theme-toggle, tooltip, base-ui, shadcn, app-shell, topbar, next-metadata]
status: complete

requires:
  - phase: 01-03
    provides: theme engine (toggleTheme, useActiveTheme, useMounted), es copy module
  - phase: 01-01
    provides: logout() client helper, LogoutButton, ImportCountsPanel
provides:
  - ThemeToggle (Moon/Sun ghost icon button with Tooltip and accessible names)
  - shadcn tooltip + TooltipProvider mounted once in the root layout
  - Root metadata (title template, description, robots noindex/nofollow)
  - /login full-height secondary backdrop with fixed top-right toggle
  - TopBar (sticky 56 px, reserved center slot, actions prop) and AppShell
  - LogoutButton restyled as ghost icon button, icon-only under 640 px
affects: [01-11, 01-12, 01-13, 01-14, phase-02, phase-03]

actuals:
  tokens: 3500
  tasks: 2
  commits: 2

plan_head_before: 15250c5e458ddddd40ad8b5c691ae71fbb064491
plan_head_after: 21fb31e8f12fec84018aadba217ad1f33807f7c4

tech-stack:
  added: []
  patterns:
    - "Base UI trigger composition via render prop: <TooltipTrigger render={<Button />}>"
    - "Reserved empty slot (data-slot=topbar-center) so later phases add controls without reflowing the bar"

key-files:
  created:
    - src/components/ThemeToggle.tsx
    - src/components/ui/tooltip.tsx
    - src/features/shell/TopBar.tsx
    - src/features/shell/AppShell.tsx
  modified:
    - src/app/layout.tsx
    - src/app/login/page.tsx
    - src/features/shell/LogoutButton.tsx
    - src/app/page.tsx

key-decisions:
  - "Login metadata title is now 'Entrar' because the root template appends ' · InvoiceChecker' (avoids a doubled suffix)"
  - "Theme toggle and logout use the es copy module (es.global.themeToggle / es.global.logout) instead of inline strings"

patterns-established:
  - "Mobile touch targets: max-sm:size-11 (44 px) on icon buttons, 36 px (size-9) from sm up"
  - "Visually hidden label on small screens: max-sm:sr-only plus aria-label on the button"

requirements-completed: [ACC-01, ACC-02]

duration: 12min
completed: 2026-10-14
---

# Phase 01 Plan 07: Theme toggle and app shell Summary

Theme toggle (Moon/Sun with Tooltip) on /login and in a new sticky 56 px top bar with a reserved center slot and a "Cerrar sesión" ghost button, plus root metadata with noindex.

## Accomplishments

- shadcn tooltip added with the CLI (`shadcn@4.21.4 add tooltip -y`); `TooltipProvider` wraps the body once in the root layout.
- `ThemeToggle`: ghost icon button, 36 px (44 px under 640 px), both icons rendered and swapped with `dark:` classes, aria-label and Tooltip text "Cambiar tema" until mounted, then "Cambiar a tema oscuro" / "Cambiar a tema claro"; always enabled.
- Root metadata: title `{ default: "InvoiceChecker", template: "%s · InvoiceChecker" }`, description "Análisis de gastos del Coworking Café", robots `index: false, follow: false`. Plan 01-03 theme script, `suppressHydrationWarning` and fonts untouched.
- `/login`: `min-h-dvh` page on `bg-secondary` centering `LoginForm`; `ThemeToggle` fixed 16 px from top/right outside the card. No redirect for signed-in visitors (Q2). `LoginForm.tsx` not touched (owned by 01-06).
- `TopBar`: sticky `top-0`, `z-40`, `h-14`, `bg-secondary`, bottom border; app name 20 px / 600 `whitespace-nowrap`; empty `flex-1` `data-slot="topbar-center"`; right cluster `actions`, `ThemeToggle`, `LogoutButton` with 8 px gaps.
- `AppShell`: TopBar plus `main` (max-w-6xl, px-6, pt-8, pb-16, gap-8). `/` now renders `AppShell` around `ImportCountsPanel`.
- `LogoutButton`: shadcn ghost Button with `LogOut` icon (aria-hidden), text hidden under 640 px (`sr-only`), `aria-label`, 44 px target on small screens, `await logout()` path unchanged (navigates to /login even if the request fails).

## Task Commits

1. Task 1: Theme toggle on /login, Tooltip provider and metadata - `66bbfe5`
2. Task 2: App shell with sticky top bar - `21fb31e`

## Verification

- `pnpm verify` (eslint, typecheck, vitest 33 tests, next build): passed after each task.
- `pnpm smoke:auth`: "smoke-auth: OK (14 checks)" after each task.
- package.json and pnpm-lock.yaml unchanged by this plan (T-01-SC mitigation holds: no new dependency; the shadcn CLI did not rewrite them).
- Human check (visual: backdrop, toggle, top bar at 360 px, theme persistence, blocked storage) not run in this worktree; deferred to the end-of-phase human verification.

## Deviations from Plan

None - plan executed exactly as written. Minor note: the toggle and logout labels come from `es.global` rather than literals, which is the same text the plan specifies.

## Known Stubs

None. The `topbar-center` slot is intentionally empty (reserved for Phase 2 IVA selector and Phase 3 export button, per D-06).

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: src/components/ThemeToggle.tsx, src/components/ui/tooltip.tsx, src/features/shell/TopBar.tsx, src/features/shell/AppShell.tsx
- FOUND commits: 66bbfe5, 21fb31e
