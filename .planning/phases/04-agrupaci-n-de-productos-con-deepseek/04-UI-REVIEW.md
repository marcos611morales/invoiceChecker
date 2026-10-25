# Phase 4 — UI Review

**Audited:** 2026-10-25
**Baseline:** 04-UI-SPEC.md (approved 2026-10-19), with 01/02/03-UI-SPEC inherited rules
**Screenshots:** captured (3/3) to `.planning/ui-reviews/04-20261025-124828/` (desktop 1440x900, mobile 375x812, tablet 768x1024). **Caveat:** every capture shows only the login gate (`/`, password form). The Productos tab sits behind the session and the loaded-invoices check, so no screenshot shows it. The visual findings below are code-derived (Tailwind classes, copy module, component structure), not rendered.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Copy is centralized and matches the contract on every string checked; rendered pluralization and interpolation were not seen |
| 2. Visuals | 3/4 | Structure matches the contract (focal point, icon buttons with Tooltip + aria-label); not visually verified because the tab was never rendered |
| 3. Color | 3/4 | No hardcoded hex or `bg-white` in the feature; tokens only; `text-destructive!` forces a color with `!` |
| 4. Typography | 3/4 | Weights limited to 600 as specified, but `text-base` (16px) is a fifth size at `ProductsTab.tsx:249` |
| 5. Spacing | 3/4 | Off-grid values present: `gap-0.5` (2px, x7) and `mt-2.5` (10px) break the multiples-of-4 rule |
| 6. Experience Design | 3/4 | Good state coverage (run states, undo, aria-disabled, live regions); the tab list overflows by about 17 px at 640 px, as the contract said it must scroll |

**Overall: 18/24**

No pillar scored 1, so there are no BLOCKERs. Every pillar scored 2-3 at most, so every pillar has WARNING-level findings listed below.

---

## Top 3 Priority Fixes

1. **Tab list does not scroll between 640 and 767 px** — the contract requires `overflow-x-auto` there (UI-SPEC "Shell and tabs"), but `AppShell.tsx` (TabsList className) applies `max-sm:overflow-x-auto` only, so below 640 it scrolls and at 640 it does not. UAT recorded the about-17 px overflow at exactly 640 px as a known issue and passed the check anyway. **Impact:** the Productos tab (or its counter) can be clipped at the container edge on a 640 px-wide window. **Fix:** drop the `max-sm:` prefix on `overflow-x-auto` and `[scrollbar-width:none]` in the `TabsList` className (or shrink the trigger padding/gap at `sm` to fit 5 triggers at 640 px), then re-verify at 640, 700 and 767 px.

2. **Off-contract type size and spacing values** — `src/features/products/ProductsTab.tsx:249` sets the empty-state title to `text-base` (16px); the contract has four sizes (12/14/20/28), and this title should be 14/600 body or 20/600 heading. `gap-0.5` (7 occurrences in `features/products`) and `mt-2.5` (1) produce 2px and 10px, which break the "multiples of 4" rule. **Impact:** small visual inconsistency in the empty state and tight/irregular rhythm in the composition. **Fix:** change `text-base` to `text-sm font-semibold` (or the `Heading` role), replace `gap-0.5` with `gap-1` and `mt-2.5` with `mt-2`, and add a lint or grep check for `text-base|gap-0\.5|mt-2\.5` in `src/features/products`.

3. **The Productos tab has never been rendered in the audit** — the three captures show the login page only, so the focal point, density, the 640 to 767 px tab check and the card layout (IN-02, IN-03 changes from 04-REVIEW-FIX) are unverified by pixels. The REVIEW-FIX report itself asks for a visual check of the select list and the run-result line. **Impact:** visual regressions on the main screen of this phase would not be caught by this audit. **Fix:** capture the Productos tab with a seeded session (invoices loaded, one pending card, one category row, one accepted product) at 1440, 768 and 375 px, in light and dark, and attach the captures to this review.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Verified present in `src/lib/copy/es.ts` and `src/lib/copy/messages.ts` (no hardcoded JSX text found in `src/features/products`):

- Entry buttons and captions: "Agrupar productos", "Sugerir categorías", "Hay un proceso en curso", "No hay descripciones nuevas para agrupar".
- Send dialog: "¿Enviar estos datos a DeepSeek?", "Ver exactamente qué se envía", "No enviar", "Enviar a DeepSeek".
- Run states: "Esperando la respuesta de DeepSeek. Puede tardar hasta un minuto.", "Detener lotes", "Deteniendo…", "Reintentar".
- Empty state: "Todavía no hay productos agrupados" with the contracted body.
- Accessible names: "Aceptar la sugerencia «{nombre}»", "Rechazar la sugerencia «{nombre}»", "Quitar la marca «No agrupar» de «…»", "Nuevo nombre del producto {nombre}".
- Category select item: `newCategoryLabel` returns "Nueva: {nombre}" (`messages.ts:781`).
- Privacy footer (`es.ts`, `privacyLine`): matches the contract text, which names no country or retention.
- Failure messages: all ten rows of the RESEARCH error table are present in `es.ts` (lines 592-611 region).

Findings:
- **WARNING:** Pluralization and interpolation (for example "1 sugerencia" vs "{n} sugerencias", "Lote {k} de {M}") are generated in `messages.ts` and cannot be confirmed without a rendered run. Verify the singular forms in a unit or visual pass.
- **WARNING:** The contract's `Lote {k} de {M}` run line and "N lotes fallaron · Reintentar" are built by helpers; confirm the "Reintentar" button sits inside the Alert (contract says Button `outline` inside the Alert) because the grep only found the string, not its placement.

### Pillar 2: Visuals (3/4)

Positive (code-derived):
- `IconAction` (`features/products/IconAction.tsx`) pairs every icon-only button with a Tooltip and an `aria-label` carrying the same text, at 36px and 44px under 640 px, as the contract requires.
- The entry buttons use `aria-disabled` rather than `disabled`, so the caption stays readable and the button stays focusable (`ProductsTab.tsx:188-207`).
- The send dialog uses `max-h-[calc(100vh-2rem)]` and `sm:max-w-[560px]`, matching the spec's widened dialog.

Findings:
- **WARNING:** The empty-state title (`ProductsTab.tsx:249`) is `text-base` (16px), larger than the 14px body used for the other card and table titles and not the 20px heading. This blurs the title/body hierarchy inside the tab.
- **WARNING:** The "Mis productos" table, the members sub-table (`ProductMembers.tsx:122`, `min-w-[640px]`) and the suggestion table (`min-w-[760px]`) use fixed minimum widths; the contract only sets 880px for "Mis productos" and 760px for suggestions. The members table width is not in the contract (a default taken by the executor).

### Pillar 3: Color (3/4)

Positive:
- Grep of `src/features/products` for `#hex`, `rgb(`, `bg-white`, `text-black` returned nothing. Semantic tokens only.
- Reject and "No agrupar" use neutral `ghost`/`outline`; no destructive color on them (`CategorySuggestionsTable.tsx` and `ReviewQueue.tsx`).
- The confirm buttons of `SendDialog` and `BulkAcceptDialog` are the only `AlertDialogAction` buttons, matching the "accent only on confirm" rule.

Findings:
- **WARNING:** `RunResult.tsx:84` and `:111` force the icon color with `text-destructive!` (important modifier). It works, but it overrides the variant rather than fixing it at source. Prefer a non-important override or a variant.
- **WARNING:** The 60/30/10 split (secondary use on bulk bar, hover, expanded members panel, badges) cannot be measured without rendering. Not verified.

### Pillar 4: Typography (3/4)

Measured in `src/features/products` (grep):
- Sizes: `text-xs` (27), `text-sm` (30), `text-xl` (7), `text-base` (1). Contract allows 12, 14, 20, 28 only.
- Weights: `font-semibold` (27) only. No `font-medium`, no `font-bold`. Compliant.

Findings:
- **WARNING:** `text-base` at `ProductsTab.tsx:249` is a fifth size (16px). See Top fix 2.
- **WARNING:** `text-xl leading-[1.2]` is used for every dialog and section heading (7 places). This matches the contract's 20/600 with 1.2 line height, but the arbitrary leading value should be a token or the default `leading-tight` if that equals 1.2. Cosmetic.

### Pillar 5: Spacing (3/4)

Measured in `src/features/products` (grep):
- Gap classes: `gap-0.5` x7 (2px), `gap-1` x10, `gap-2` x12, `gap-3` x4, `gap-4` x9, `gap-8` x1.
- Margin/padding: `mt-2.5` x1 (10px), `px-3` x15 and `py-2` x8 (12px and 8px), `pt-2` x10, `p-6` x2, `px-4` x1.
- Arbitrary widths (allowed exceptions): `min-w-[260px]`, `min-w-[880px]`, `min-w-[760px]`, `min-w-[640px]`, `max-w-[880px]`, `max-w-[320px]`, `max-w-[280px]`, `w-[240px]`, `w-[220px]`.

Findings:
- **WARNING:** `gap-0.5` (2px) and `mt-2.5` (10px) are not multiples of 4 and are not in the declared scale. Contract: "multiples of 4". See Top fix 2.
- **WARNING:** `px-3`/`gap-3` (12px) appears about 19 times. It is a multiple of 4 but not one of the seven declared steps (xs 4, sm 8, md 16, ...). Either add 12px to the contract's usage notes or switch to `gap-2` (8px) / `gap-4` (16px) where the contract listed sm or md. Not verified whether Phases 1-3 use the same 12px; if they do, record it as an inherited pattern.
- Arbitrary widths are all named in the contract exceptions, except `min-w-[640px]` on the members table (not in the contract).

### Pillar 6: Experience Design (3/4)

Positive (code-derived):
- State coverage: run states (running, cancelling, finished, partial failure, stopped, canceled), empty state (`Empty`), filtered no-match text, storage-failure Alerts, failure reasons per condition.
- Send gate: `SendDialog` opens before every send; default focus on "No enviar" (`dismissRef`). Destructive confirmations are absent by design; undo toasts used instead.
- Live regions: five `aria-live` usages in the feature.
- Focus management helper `focusTargets.ts` exists for accept, reject, rename, delete and run start.
- REVIEW-FIX changes (IN-02, IN-03, IN-06) add test coverage for the run and category selection paths.

Findings:
- **WARNING:** Tab overflow at 640 to 767 px. The contract said the list must scroll (`overflow-x-auto`) in that range and that the verification must check it. Code scrolls only below 640 px (`max-sm:overflow-x-auto`). UAT item 4 recorded "pass" with the known about-17 px overflow at exactly 640 px. Treat as an unresolved contract gap. See Top fix 1.
- **WARNING:** Interaction behavior (hover, focus ring order, Esc on AlertDialog, roving arrows on tabs, sort on "Mis productos") is code-derived only. The interaction capture was off, so no pressed-state or post-click screenshot exists.
- **Registry:** `components.json` is present, and the UI-SPEC Registry Safety table declares only the shadcn official registry, with no third-party blocks. Registry audit: 0 third-party blocks to check, no flags. No `npx shadcn view` run was needed.

---

## Files Audited

- `.planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-UI-SPEC.md`
- `.planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW-FIX.md`
- `.planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-UAT.md`
- `src/app/login/LoginForm.tsx`, `src/app/login/page.tsx` (captured via screenshot, login gate only)
- `src/features/shell/AppShell.tsx` (tab list classes and tab order)
- `src/features/products/ProductsTab.tsx`, `ReviewQueue.tsx`, `ProductList.tsx`, `ProductMembers.tsx`, `CategorySuggestionsTable.tsx`, `SendDialog.tsx`, `BulkAcceptDialog.tsx`, `CategoryBulkDialog.tsx`, `RunResult.tsx`, `RunProgress.tsx`, `IconAction.tsx`, `QueueToolbar.tsx`, `UngroupedList.tsx`, `ProductPicker.tsx`, `focusTargets.ts`
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts`
- `src/components/ui/tabs.tsx`, `src/components/ui/empty.tsx`
- `components.json`
- Screenshots: `.planning/ui-reviews/04-20261025-124828/{desktop,mobile,tablet}.png`
- Screenshot gate: `.planning/ui-reviews/.gitignore` (created; excludes `*.png` and `interaction/`)
