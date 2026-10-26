---
phase: "05"
audited: "2026-10-26"
baseline: 05-UI-SPEC.md
overall: 19/24
scores:
  copywriting: 3
  visuals: 3
  color: 4
  typography: 3
  spacing: 3
  experience_design: 3
---

# Phase 5 — UI Review (Comparación de precios entre tiendas)

**Audited:** 2026-10-26 (gsd-ui-auditor; report persisted by the orchestrator)
**Baseline:** 05-UI-SPEC.md (approved 2026-10-25), plus 05-CONTEXT.md and the user decisions taken during execution
**Screenshots:** reused the production-build captures in `test-results/phase5-ui-states/` (synthetic data): e4 products table at 360 and 1024 px, e7 history chart light, e8 content editor at 1024 px. No server was started. Viewports 640, 767 and 768 px have no visual evidence.
**Interaction captures:** off (`interaction_capture: false`); interaction findings are code-derived.

## Pillar Scores

| Pillar | Score | Key Finding |
|---|---|---|
| 1. Copywriting | 3/4 | Contract strings present in `es.ts` / `messages.ts`, no generic labels; verified by string presence, not by rendered state. |
| 2. Visuals | 3/4 | At 360 px the products table scrolls horizontally with no cue, so Precio, Tiendas, Ahorro and «⋯» are off-screen. |
| 3. Color | 4/4 | Six series tokens in `globals.css` (light and dark) with the contract values; no hardcoded colors. Series 3–5 light contrast is an accepted UI-SPEC deviation. |
| 4. Typography | 3/4 | `text-base` (16 px, a fifth size) on three empty-state titles; `font-medium` (500, a third weight) in the chart tooltip. |
| 5. Spacing | 3/4 | Half-step classes (`gap-0.5`, `gap-1.5`, `py-1.5`, `px-2.5`) outside the 4-multiple scale. |
| 6. Experience Design | 3/4 | Live regions, `aria-sort`, `aria-invalid` + `aria-describedby`, reduced motion, undo toasts, storage Alert, focus rules; mobile column access is the weak point. |

**Overall: 19/24**

## Top 3 Priority Fixes

1. **Products table on narrow screens hides its price columns with no cue.** At 360 px the 880 px `min-w` table sits in `overflow-x-auto` with no edge fade and no focusable scroll region (e4-360-productos.png). Fix in `src/features/prices/PricesTable.tsx` (table wrapper): right-edge gradient or shadow on overflow, and make the scroll container `tabIndex={0}` with `role="region"` and an `aria-label` such as «Tabla de productos»; keep the min width.
2. **Off-contract type sizes and weights.** Contract: sizes 12, 14, 20, 28; weights 400, 600. `text-base` on `EmptyTitle` at `PreciosTab.tsx:99`, `:145`, `:222`; `font-medium` at `HistoryChart.tsx:233`, `:238`. Fix: titles to `text-xl font-semibold` or `text-sm font-semibold`; `font-medium` to `font-semibold`.
3. **Half-step spacing.** `gap-0.5` at `PricesTable.tsx:275`, `StoreTable.tsx:57`, `PurchasesList.tsx:37`; `gap-1.5` at `ContentEditor.tsx:218`, `:242`, `:266` and `HistoryChart.tsx:232`; `py-1.5` / `px-2.5` on the tooltip container (`HistoryChart.tsx:232`). Fix: `gap-0.5` → `gap-1`, `gap-1.5` → `gap-2`, tooltip padding → `p-2` or `px-2 py-1`.

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Present: «Ninguna compra de este producto tiene un contenido que se pueda comparar…», «Todavía no hay productos para comparar», «Ir a Productos», «Quitar filtros», «Mostrar los no comparables», «Se excluye por defecto: sus compras son de servicios o combustible.», «Lo marcaste tú como no comparable.», «Empate en la mediana: gana la tienda con más compras.», «Este navegador no permite guardar tus ajustes…», «Comparado por pieza, sin tamaño verificado», «Usa la cantidad del XML», «Alcanzaste el límite…».
- User-approved wording during execution (singular «Queda 1 producto.», the two-unit «no normalizadas» note, «No se pudo cambiar la marca: …», «No se pudo guardar el contenido: el valor no es válido.») not flagged.
- No generic labels in `src/features/prices`.
- Limit: string presence only, not rendered per state.

### Pillar 2: Visuals (3/4)
- Focal point matches the contract: the 28/600 «Ahorro estimado» value is the only large numeral, on `secondary`; table on `background`; no accent-filled button.
- 1024 px products view is clean: savings card capped at 480 px, search and checkbox row wraps, sort icons visible.
- Finding: 360 px products table (fix 1). In that capture a truncated store name also shows a focus ring and its tooltip overlapping the header row.

### Pillar 3: Color (4/4)
- `--series-1` to `--series-6` in `:root` and `.dark` with the contract values, mapped in `@theme inline`.
- No hex/`rgb(` literals, no `bg-white`/`text-black` in `src/features/prices`; semantic tokens throughout.
- Accent only on outline/ghost/link buttons. Static chart config (`tienda1`…`tienda6`, `otras`).
- Accepted, not new: light-mode series 3–5 contrast (2.82, 2.17, 2.69:1), documented in UI-SPEC and mitigated by shape, legend and tooltip text.
- Accepted, not new: overlapping markers at a shared point (`deferred-items.md` item 1, user decision 2026-10-26).

### Pillar 4: Typography (3/4)
- Heading `PreciosTab.tsx:86` 20/600 and savings value `PreciosTab.tsx:168` 28/600 are correct.
- Off-contract: `text-base` at `PreciosTab.tsx:99`, `:145`, `:222`; `font-medium` at `HistoryChart.tsx:233`, `:238`.

### Pillar 5: Spacing (3/4)
- Compliant: `gap-1`, `gap-2`, `gap-4`, `gap-8` between sections, `p-4` card, `p-6` block, `max-w-[480px]`, `min-w-[880px]`, `min-w-[640px]`, editor field widths.
- Non-compliant: see fix 3.
- Tab list scroll switches at `max-md:` (`AppShell.tsx:120`); 44 px touch height stays on `max-sm:`.

### Pillar 6: Experience Design (3/4)
- Strengths: live regions, `aria-sort` (6 places), `aria-invalid` + `aria-describedby` (4 editor fields), reduced motion (`globals.css:134`), three empty states with spec copy, storage Alert, undo toasts, `TruncatedText` (9 places).
- Finding: horizontal-scroll discoverability on narrow screens (fix 1).
- Not verified: focus return after «Marcar como no comparable» and «Guardar contenido» (code paths exist; jsdom-tested by the executors, not exercised here).

## Gaps and Verification Limits
- No visual evidence at 640, 767 and 768 px (05-12's Playwright spec asserts no page-level horizontal scroll at all five widths).
- The 360 px capture shows a blank band above the tabs and the sticky top bar over «Filtros»; possibly capture scroll position; not reproduced, not scored.
- Dark-mode screenshots not inspected.

## Registry Safety
`components.json` present; UI-SPEC registry lists only official shadcn blocks. No third-party block, no flags.

## Files Audited
`src/features/prices/{PreciosTab,PricesTable,StoreTable,PurchasesList,ContentEditor,ContentTable,HistoryChart,ProductDetail}.tsx`, `focusTargets.ts`, `usePricesView.ts`; `src/features/shell/AppShell.tsx`; `src/app/globals.css`; `src/lib/copy/es.ts`, `messages.ts`; screenshots e4-360-productos, e4-1024-productos, e7-light-chart, e8-1024-contenido; 05-01..05-12 SUMMARY, 05-UI-SPEC.md, 05-CONTEXT.md, deferred-items.md.
