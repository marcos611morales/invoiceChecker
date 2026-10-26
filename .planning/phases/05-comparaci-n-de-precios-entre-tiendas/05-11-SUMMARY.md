---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 11
subsystem: ui
tags: [content-correction, inline-editor, a11y, live-region, sonner-undo, zustand, base-ui-select]
status: complete

requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: "memberContents, setContentCorrection / removeContentCorrection / restoreContentCorrection and corrections wired into usePricesView (05-10); contentAmountIssue and LIMITS (05-02); ProductDetail sections, notNormalizedReasonText, formatContent (05-06, 05-07); onAnnounce live region and refusal-toast pattern (05-09)"
provides:
  - "ContentTable: the «Contenido de cada descripción» section of the product panel with every member state (detected, corrected, not normalized, unsized, XML unit), 10-row overflow and the missing-content notice target"
  - "ContentEditor: inline validated editor (pieces per pack, content, unit) with live preview, Enter/Esc, focus return, cap message and «Volver a lo detectado» with «Deshacer»"
  - "Missing-content Info Alert in ProductDetail with a link that focuses the section"
  - "format.ts formatCorrection («12 × 1 L», «375 g», «6 piezas») and the copy/messages for the section, editor, validation, limit, toast and announcement"
affects: [05-12]

actuals:
  tokens: 17000
  tasks: 2
  commits: 4
plan_head_before: ed4db4d514d6df7684a82fc8e025e323cc0c9d11
plan_head_after: 382a90a37043b5deacc6acc1fc064c3493168f10

tech-stack:
  added: []
  patterns:
    - "The content section reads corrections from the settings store and calls memberContents itself; the panel only passes the already compared row"
    - "Editor validates with contentAmountIssue plus an integer 1..999 check before the store is called; the store refuses the same input again"
    - "Announcement of a save is armed by the editor (onSaved) and made in an effect after the recalculated row renders, so it reads the new saving"
    - "Focus returns to a per-member action button kept in a ref map, restored after the editor closes"
    - "Escape discards only when the event target is inside the editor, so the portal-rendered unit list closes alone"

key-files:
  created:
    - src/features/prices/ContentTable.tsx
    - src/features/prices/ContentEditor.tsx
    - src/features/prices/ContentTable.test.tsx
  modified:
    - src/features/prices/ProductDetail.tsx
    - src/features/prices/PricesTable.tsx
    - src/features/prices/HistoryChart.test.tsx
    - src/features/prices/PurchasesList.test.tsx
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts
    - src/lib/format.ts
    - src/lib/format.test.ts

key-decisions:
  - "The section heading id is built from CONTENT_SECTION_ID plus the product id (contentSectionId), because several products can be open at once and a single fixed id would repeat"
  - "The missing-content notice counts descriptions with purchases left out as «unsized with sized siblings» (what a typed content can supply), not every not-normalized member"
  - "A refused save (limit or invalid) shows the sentence in the editor, an error toast and a polite announcement, the same way 05-09 treats a refused «no comparable» change"

patterns-established:
  - "Editor opens as a spanning row under its member; one editor at a time; mounted only while open so each opening starts from stored or detected values"

requirements-completed: [PREC-02, PREC-05]

coverage:
  - id: D1
    description: "Each member of an opened product shows how its content was read (detected, corrected, not normalized with reason, without size, or from the XML unit), ordered not normalized, corrected, detected, with edit buttons only where a typed content can apply and 10 members before «Mostrar n más»"
    requirement: PREC-02
    verification:
      - kind: unit
        ref: "src/features/prices/ContentTable.test.tsx#Contenido de cada descripción: member states (D-13, D-14, E8)"
        status: pass
      - kind: unit
        ref: "src/features/prices/ContentTable.test.tsx#Contenido de cada descripción: overflow (E8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The missing-content notice states how many descriptions and purchases are left out (singular and plural) and its link moves focus to the content section"
    requirement: PREC-02
    verification:
      - kind: unit
        ref: "src/features/prices/ContentTable.test.tsx#Missing-content notice in the product panel (D-13)"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#content of each description copy (D-13, D-14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The inline editor validates pieces, content and unit before writing, previews the content per purchase and the total, saves with Enter, discards with Escape, returns focus to the row's pencil, and shows the cap sentence without saving"
    requirement: PREC-05
    verification:
      - kind: unit
        ref: "src/features/prices/ContentTable.test.tsx#Content editor: opening, fields and live preview (D-13, D-14)"
        status: pass
      - kind: unit
        ref: "src/features/prices/ContentTable.test.tsx#Content editor: saving, discarding and focus (D-13, D-14, D-15, D-28)"
        status: pass
      - kind: unit
        ref: "src/features/prices/ContentTable.test.tsx#Content editor: validation and the cap (D-15, T-05-22)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Saving recomputes the comparison, the card total and the cheapest store at once and announces the new saving; «Volver a lo detectado» removes the correction with a 6 s «Deshacer» toast"
    requirement: PREC-05
    verification:
      - kind: unit
        ref: "src/features/prices/ContentTable.test.tsx#Content editor in the Precios tab (D-13, D-15, D-28)"
        status: pass
      - kind: unit
        ref: "src/features/prices/ContentTable.test.tsx#Content editor: «Volver a lo detectado» (D-13, D-15)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Layout of the content table (760 px minimum, 56 px rows) and of the editor fields (96/120/120 px, 36 px tall in one row from 640 px; stacked at 44 px under it) looks right at both widths, including 120-character descriptions"
    requirement: PREC-05
    verification: []
    human_judgment: true
    rationale: "Class names are asserted (min-w-[760px], h-14) but rendered widths and wrapping need a visual check; the plan assigns the long-text check to Plan 05-12"

duration: about 40 min
completed: 2026-10-26
---

# Phase 5 Plan 11: Content of each description and its editor Summary

**The opened product now shows how each description's content was read and lets the user capture or correct it with a validated inline editor; saving recalculates prices, cheapest store, saving, chart and card at once and announces the new saving, and removing a correction can be undone for 6 seconds.**

## Performance

- **Duration:** about 40 min
- **Tasks:** 2 (both TDD: failing tests committed first, then the implementation)
- **Files:** 12 (3 created, 9 modified)

## Accomplishments

- `ContentTable` (section 5 of the panel, between the chart and the purchases list): columns Descripción · Tienda · Contenido por compra · Compras · Acciones (sr-only), `min-w-[760px]` in `overflow-x-auto`, 56 px rows, 10 members then «Mostrar {n} más». Detected content is muted with an outline «detectado» badge, corrected content is foreground with «Corregido» («12 × 1 L»), a piece without size reads «Sin tamaño», a not-normalized member shows «No normalizado» with its reason, and a weight or volume member reads «Usa la cantidad del XML (kilogramos|litros)» with no button.
- The pencil (Tooltip + `aria-label` «Corregir el contenido de «{descripción, 60}» ({tienda})») or the outline «Capturar contenido» (named after the description) opens the editor under the member; a member with an unrecognized unit shows only its reason.
- Missing-content Info Alert at the top of the panel («Falta el contenido de {n} descripciones, por eso {m} compras no entran en la comparación.», singular forms handled) with a link-style «Capturar contenido» that focuses the section heading.
- `ContentEditor`: three labelled fields (Piezas por paquete, Contenido de cada pieza, Unidad with g · kg · mL · L · piezas), helper line, polite live preview («Contenido por compra: 12 × 1 L. Con la cantidad de la factura (6), cada compra equivale a 72 L.»), `aria-invalid` + `aria-describedby` errors that clear on typing, Enter saves, Escape discards (ignored when it comes from the open unit list), focus on the first field on open, on the first invalid field after a refused save, and back on the row's pencil after saving or discarding.
- Save calls `setContentCorrection` with the seven contract fields only after the same checks as the stored schema (`contentAmountIssue`, integer pieces 1..999, unit enum); at the 2,000 cap it shows «Alcanzaste el límite de 2,000 correcciones de contenido. Quita alguna para guardar más.», an error toast and an announcement, and writes nothing. Replacing an existing member's correction still works at the cap.
- Announcement «Contenido guardado. El ahorro estimado de «{producto}» es {monto}.» (just «Contenido guardado.» with no saving), made after the recalculated row renders. «Volver a lo detectado» removes the correction with the toast «Se quitó la corrección de «{descripción, 40}»» and «Deshacer» (6 s) calling `restoreContentCorrection`.
- `formatCorrection` in `format.ts`; copy in `es.prices.detail.content` and `messages.ts`.

## Task Commits

1. **Task 1 RED:** `0e12f4d` test(05-11): failing tests for the content section, its states and the missing-content notice
2. **Task 1 GREEN:** `2d0ea18` feat(05-11): content of each description section and the missing-content notice
3. **Task 2 RED:** `121d916` test(05-11): failing tests for the content editor, its validation, the cap and the undo
4. **Task 2 GREEN:** `382a90a` feat(05-11): inline content editor with validation, live preview, save and undo

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `PricesTable.tsx` forwards `onAnnounce` to `ProductDetail`**
- **Found during:** Task 2
- **Issue:** the announcement of a save needs the Precios tab live region (`onAnnounce`, from 05-09), which only reaches `PricesTable`; the file is not in the plan's list.
- **Fix:** `ProductDetail` takes an optional `onAnnounce` and passes it to `ContentTable`; `PricesTable` passes its own `onAnnounce` to `ProductDetail` (one prop).
- **Files modified:** src/features/prices/PricesTable.tsx, src/features/prices/ProductDetail.tsx
- **Commit:** 382a90a

**2. [Rule 1 - Existing tests] Heading order tests updated**
- **Found during:** Task 1
- **Issue:** `HistoryChart.test.tsx` and `PurchasesList.test.tsx` pinned the headings of a panel with purchases as «Precios por tienda · Historial de precios · Compras»; the new section legitimately sits before «Compras».
- **Fix:** expectations now include «Contenido de cada descripción».
- **Files modified:** src/features/prices/HistoryChart.test.tsx, src/features/prices/PurchasesList.test.tsx
- **Commit:** 2d0ea18

### Interpretation choices (not asked of the user, flagged for review)

- **Section id:** `CONTENT_SECTION_ID` is the prefix and `contentSectionId(productId)` the real id, since several products can be expanded at once.
- **Notice counts:** n and m count descriptions and purchases whose reason is «unsized with sized siblings» (what a typed content can supply). Members not normalized for another reason (other unit family, unknown unit) are listed in the table but are not counted in the notice.

**Total deviations:** 2 auto-fixed (1 blocking, 1 existing-test update). **Impact:** none on the plan's behavior.

## Needs a human look

- **Refusal wording not in the UI-SPEC:** when the store refuses a save as «invalid» (not reachable after the editor's own checks) the text is «No se pudo guardar el contenido: el valor no es válido.» (`es.prices.detail.content.editor.refused`). The limit refusal uses the UI-SPEC sentence and is shown inline, as an error toast and as a polite announcement, like 05-09's refused mark.
- **Default unit «piezas»:** with no stored correction and no size read from the description, the unit starts at «piezas» (and pieces at 1, content empty). The plan does not say what the Select starts with.
- **«Capturar contenido» for a piece member whose reason is an invalid quantity** (`bad-quantity`) is still shown, as the plan says for any piece unit, although a typed content cannot fix a bad XML quantity.
- **Decimal comma:** «0,5» is refused (the stored rule accepts only a decimal point); the field message is shown.
- **Live preview quantity:** uses the cantidad of the member's most recent purchase (planner choice A-5), with a piece unit assumed.
- **Not checked in a browser:** widths (760 px table, 96/120/120 px fields, 36/44 px heights, stacking under 640 px) are set by classes and asserted in tests only by class name for the table; rendered layout and 120-character descriptions are for Plan 05-12's visual check.

## Issues Encountered

- A pre-existing ESLint warning in `src/lib/client/navigation.ts` (unused disable directive) is not from this plan and was left alone.
- jsdom renders the `TruncatedText` of a description as a button, so tests assert the absence of edit buttons by name (`Corregir|Capturar`) rather than any button.

## Known Stubs

None.

## Threat Flags

None. T-05-22 (editor input to storage) is mitigated by `contentAmountIssue`, the integer 1..999 check and the unit enum before the store, tested with exponents, negatives, fractions, commas, 7 decimals and out-of-range values; T-05-30 (vendor text) by React text only, with a hostile-description test and no raw HTML injection in `src/features/prices`.

## Verification

- `pnpm exec vitest run src/features/prices src/lib` passed during Task 1; `src/features/prices/ContentTable.test.tsx` has 57 tests (all passing) and `messages.test.ts` / `format.test.ts` pin the new copy.
- `pnpm verify` (lint, typecheck, test, build): exit 0 with `FACTURAS_DIR` set; 3571 tests passed, 10 skipped. Lint shows only the pre-existing warning above.
- Acceptance greps: `ContentTable` in ProductDetail.tsx (2), `CONTENT_SECTION_ID` in ProductDetail.tsx (1), `min-w-[760px]` in ContentTable.tsx (1), `formatCorrection` in format.ts (1), `aria-invalid` in ContentEditor.tsx (2), `aria-live` (1), `contentAmountIssue` (2), `restoreContentCorrection` (1), «Alcanzaste el límite de» across es.ts and messages.ts (4).

## Self-Check: PASSED

- Files exist: `src/features/prices/ContentTable.tsx`, `src/features/prices/ContentEditor.tsx`, `src/features/prices/ContentTable.test.tsx`, this SUMMARY.
- Commits `0e12f4d`, `2d0ea18`, `121d916`, `382a90a` are ancestors of HEAD (4 commits measured from `plan_head_before`).

Ready for Plan 05-12.
