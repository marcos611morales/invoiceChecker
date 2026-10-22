---
phase: 04-agrupaci-n-de-productos-con-deepseek
plan: 20
subsystem: llm
tags: [deepseek, privacy, sensitive-pattern-guard, bulk-accept, send-dialog, smoke-test, a11y]

requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: "Group and categorize runs, SendDialog shell, CategorySuggestionsTable with per-row accept, BulkAcceptDialog pattern, anonymized fixtures, smoke-auth script (plans 04-04, 04-17, 04-18, 04-19)"
provides:
  - "CategorySuggestionsTable: rows ordered suppliers first then products (es collator), 50 shown with «Mostrar {n} más», «Aceptar todas» with CategoryBulkDialog"
  - "CategoryBulkDialog: «¿Aceptar {n} sugerencias de categoría?», skipped rows counted, «Volver a revisar» focused, accent «Aceptar {n} sugerencias»"
  - "isSensitive, withheldItems, withheldTargets and GroupRun.withheld / CategorizeRun.withheld: nothing shaped like an RFC, UUID, e-mail or 8+ digit run is in any request body"
  - "«No se enviarán ({n}): …» group in both send dialogs, rendered from run.withheld"
  - "SendDialog.test.tsx (rows equal serialized body items, both flows) and candidates.anon.test.ts (bodies from anonymized fixtures carry no invoice identifier)"
  - "pnpm smoke:auth also probes /api/llm/categorize (401, 400, 500 server_not_configured)"
affects: [04-21 live check]

plan_head_before: aead196d5f5bacd9dc326fe302338542148f506f
plan_head_after: 32683784e561601bcc1748016acf387640daf19f
commits: 4

actuals:
  tokens: 20900
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "applyRow(id) returns a typed outcome (applied, stale, refused, ignored) and does not touch the queue: the single-row Aceptar and the bulk apply share it, so one set of rules serves both"
    - "Guard at the builders, not at the schema: the run builders partition their input into sendable and withheld before batching, so batch sizes, counts and id maps never include a withheld text"
    - "Dialog equality test: serialize each body with JSON, parse it with the route's own schema, compare with the rows read from the DOM"

key-files:
  created:
    - src/features/products/CategoryBulkDialog.tsx
    - src/features/products/SendDialog.test.tsx
    - src/domain/llm/candidates.anon.test.ts
  modified:
    - src/features/products/CategorySuggestionsTable.tsx
    - src/features/products/CategorySuggestionsTable.test.tsx
    - src/domain/llm/candidates.ts
    - src/domain/llm/candidates.test.ts
    - src/features/products/SendDialog.tsx
    - src/features/products/ProductsTab.tsx
    - src/features/products/ProductsTab.test.tsx
    - scripts/smoke-auth.mjs
    - src/lib/copy/es.ts
    - src/lib/copy/messages.ts
    - src/lib/copy/messages.test.ts

key-decisions:
  - "The guard checks both the whole text and its 200/120/60-character cut: a cut can leave an RFC followed by «…» in the body even when the whole text is not RFC-shaped, and a pattern beyond the cut is still withheld (conservative)"
  - "Sensitive names of accepted products are dropped from the grouping context silently (they are in no body and not listed in «No se enviarán»); the user's own category names are not guarded (see Items that need a decision)"
  - "A product with some sensitive member descriptions still goes with the clean ones; it is withheld only when its name is sensitive or no member is left"
  - "«Aceptar todas» counts every row, shown or not (UI-SPEC OQ6); rows whose target got a category by other means are dropped without being applied and not counted as «quedaron en la tabla»"
  - "Focus: after «Mostrar más» it goes to the first new row; after «Aceptar todas» it returns to the button (dialog default), or to the tab heading when no row remains"

patterns-established:
  - "Withheld texts are shown in the dialog from run.withheld and never serialized; the caption and the entry buttons count only what would be sent"

requirements-completed: [LLM-02, LLM-03, LLM-06]

coverage:
  - id: D1
    description: "Category rows are ordered suppliers first then products, each by name with the es collator; 50 show at first and «Mostrar {n} más» adds up to 50 (focus goes to the first new row); the 760px table sits inside an overflow-x-auto container"
    requirement: "LLM-02"
    verification:
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#order, «Mostrar más» and overflow (D-23, E5)"
        status: pass
    human_judgment: false
  - id: D2
    description: "«Aceptar todas» opens «¿Aceptar {n} sugerencias de categoría?» with «Volver a revisar» focused, counts skipped rows (empty Select) and applies every row with the single-row rules: one creation per new name, shown or not, refused rows stay with their error, stale rows are dropped unapplied"
    requirement: "LLM-02"
    verification:
      - kind: automated_ui
        ref: "src/features/products/CategorySuggestionsTable.test.tsx#«Aceptar todas» (D-23, UI-SPEC OQ6)"
        status: pass
      - kind: unit
        ref: "src/lib/copy/messages.test.ts#«Aceptar todas» of the category table (D-23, UI-SPEC OQ6)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Descriptions, supplier names, product names and member descriptions with an RFC, UUID, e-mail or 8+ digit run are in no request body; they are listed in run.withheld"
    requirement: "LLM-03"
    verification:
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#isSensitive (LLM-03, UI-SPEC OQ7)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#withheldItems and buildGroupRun with the guard (LLM-03, T-04-40)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/candidates.test.ts#withheldTargets and buildCategorizeRun with the guard (LLM-03, T-04-40)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both send dialogs list the withheld texts under «No se enviarán ({n}): …»; the captions and entry buttons count only what would be sent, and with only withheld items free the button reads «No hay descripciones nuevas para agrupar»"
    requirement: "LLM-03"
    verification:
      - kind: automated_ui
        ref: "src/features/products/SendDialog.test.tsx#lists the withheld item under «No se enviarán» and keeps it out of every body"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/ProductsTab.test.tsx#Agrupar productos: the free count (D-03, D-04, D-05, OQ2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "For both buttons the rows of the dialog's literal list equal the items of the serialized request bodies, item for item, including the 200-character cut"
    requirement: "LLM-06"
    verification:
      - kind: automated_ui
        ref: "src/features/products/SendDialog.test.tsx#the grouping dialog lists what is sent (LLM-06)"
        status: pass
      - kind: automated_ui
        ref: "src/features/products/SendDialog.test.tsx#the categorize dialog lists what is sent (LLM-06)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Built from the anonymized CFDI fixtures, the serialized group and categorize bodies contain no emisor or receptor RFC, UUID, folio, fecha or amount string of those invoices"
    requirement: "LLM-03"
    verification:
      - kind: unit
        ref: "src/domain/llm/candidates.anon.test.ts#the grouping bodies built from the anonymized invoices (LLM-03, D-05)"
        status: pass
      - kind: unit
        ref: "src/domain/llm/candidates.anon.test.ts#the categorize bodies built from the anonymized invoices (LLM-03, D-05)"
        status: pass
    human_judgment: false
  - id: D7
    description: "pnpm smoke:auth checks that /api/llm/categorize answers 401 without a session, 400 for text/plain and 500 server_not_configured with an empty key"
    requirement: "LLM-02"
    verification:
      - kind: integration
        ref: "pnpm smoke:auth (smoke-auth: OK (20 checks))"
        status: pass
    human_judgment: false
  - id: D8
    description: "Long supplier or product names truncate in the Nombre cell and in the Select trigger, with the full name in the open popup; layout of the header button and «Mostrar más»"
    verification: []
    human_judgment: true
    rationale: "Pixel layout and truncation are not asserted by jsdom; the UI-SPEC marks long-text of E5 as a held-out visual check (Plan 04-21)"

duration: 15min
completed: 2026-10-22
status: complete
---

# Phase 4 Plan 20: Category queue finish and the sensitive-pattern guard Summary

**Ordered category rows with «Mostrar más» and a counted «Aceptar todas» confirmation, plus a sensitive-pattern guard (RFC, UUID, e-mail, 8+ digits) at both run builders with a «No se enviarán» group, the dialog-equals-body proof for both flows, an anonymized-fixture payload test and the categorize smoke probes.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-22T18:27:37Z
- **Completed:** 2026-10-22T18:42:00Z
- **Tasks:** 2 (Task 2 as RED, GREEN and the dialog/test/smoke commit)
- **Files modified:** 14 (3 created, 11 modified)

## Accomplishments

- Category table: `orderRows` (suppliers first, then products, each by name with the es collator, id as last tie-breaker), 50 rows then «Mostrar {n} más» (focus to the first new row), and the 760px table stays inside the shared `overflow-x-auto` container.
- «Aceptar todas» at the section header (aria-disabled when no row has a chosen category) opens `CategoryBulkDialog`. The single-row accept was split into `applyRow` (writes the settings, returns `applied | stale | refused | ignored`) and the row bookkeeping; the bulk apply loops over all rows in table order with the same `applyRow`, so a new name is created once and reused, a limit refusal stays under its row, and a stale row is dropped without being applied. Toast: «{n} sugerencias aplicadas[; {k} quedaron en la tabla]».
- `isSensitive` (RFC of 3 or 4 letters with Ñ and &, 6 digits, 3 alphanumerics, bounded by non-letters; UUID; e-mail; 8+ digits), `withheldItems`, `withheldTargets`. `buildGroupRun` and `buildCategorizeRun` partition into sendable and withheld before batching (batch sizes, id maps and counts only see sendable), drop sensitive context names, and drop sensitive member descriptions (a product with none left is withheld).
- Both send dialogs end with «No se enviarán ({n}): contienen algo que parece un RFC, un UUID, un correo o un número largo.» listing the texts that stay in the browser; `ProductsTab` counts and blocks by what would be sent.
- `SendDialog.test.tsx` (11 tests) compares the dialog rows with each body after JSON and the route's schema, for several batches of both flows with the cut and one withheld item. `candidates.anon.test.ts` (9 tests) builds ledgers from every `tests/fixtures/cfdi/anon/*.xml` (plus two synthetic supplier copies) and asserts no identifier of those invoices is in any body string. The test of the check itself proves it fails when an identifier is present.
- `pnpm smoke:auth` now runs 20 checks, three of them on `/api/llm/categorize`.

## Task Commits

1. **Task 1: Category rows in order with «Mostrar más» and «Aceptar todas» with its confirmation** - `917aace` (feat)
2. **Task 2 RED: failing tests for the sensitive-pattern guard** - `27637b8` (test)
3. **Task 2 GREEN: sensitive-pattern guard** - `be5edd7` (feat)
4. **Task 2: withheld group in the dialogs, payload tests, smoke probes** - `3268378` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Gate Compliance

Task 2 carries `tdd="true"`. Order in the log: `test(04-20)` `27637b8` then `feat(04-20)` `be5edd7`. RED evidence: `pnpm exec vitest run src/domain/llm/candidates.test.ts` failed 27 tests on their planned assertions (`expected false to be true` for `isSensitive`, `expected [] to deeply equal [...]` for `withheldItems`, bodies still carrying the sensitive items), with the inert stub exports in the same RED commit so the failures are assertions, not missing imports; the clean-text cases (false) passed against the stub, as expected. GREEN: all 261 tests of `src/domain/llm` pass. The `gsd check tdd-red-evidence` classifier was not run (no `gsd_run` binary in this worktree); the semantic assessment above is by inspection of the vitest output.

## Files Created/Modified

- `src/features/products/CategoryBulkDialog.tsx` - confirmation dialog of «Aceptar todas» (same pattern as `BulkAcceptDialog`)
- `src/features/products/CategorySuggestionsTable.tsx` - ordering, paging, `applyRow`, bulk apply, header button
- `src/domain/llm/candidates.ts` - guard, `withheld` on both runs
- `src/features/products/SendDialog.tsx` - withheld sections in both dialogs
- `src/features/products/ProductsTab.tsx` - captions and blocking by sendable counts
- `scripts/smoke-auth.mjs` - categorize probes
- `src/lib/copy/es.ts`, `src/lib/copy/messages.ts` - `categoryAcceptAll`, `categoryBulkTitle`, `categoryBulkBody`, `categoryBulkToast`, `withheldHeading`
- Tests: `CategorySuggestionsTable.test.tsx`, `candidates.test.ts`, `candidates.anon.test.ts` (new), `SendDialog.test.tsx` (new), `ProductsTab.test.tsx`, `messages.test.ts`

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing focus tests assumed queue order**
- **Found during:** Task 1
- **Issue:** Four tests in `CategorySuggestionsTable.test.tsx` (focus after Aceptar and Rechazar, the last-of-several case, the stale-row case) assumed the rows appear in queue order; the required ordering lists «Tienda Dos» before «Tienda Uno».
- **Fix:** Their expectations follow the new order (the pressed row and the expected next row swapped). No production behavior changed.
- **Files modified:** src/features/products/CategorySuggestionsTable.test.tsx
- **Verification:** `pnpm verify`
- **Committed in:** 917aace

**2. [Rule 2 - Missing critical functionality] The guard also checks the whole text, not only the cut**
- **Found during:** Task 2
- **Issue:** The plan says the guard runs on texts "after the cut". A cut can leave the start of a pattern in the body (an RFC followed by «…» reads as a whole one), and a pattern beyond the cut would be silently dropped from the check.
- **Fix:** `looksSensitive` is true when the whole text or its cut is sensitive. A description with an e-mail after character 200 is therefore withheld although the cut text would not show it.
- **Files modified:** src/domain/llm/candidates.ts
- **Verification:** `candidates.test.ts` "also withholds a description whose sensitive part lies beyond the 200-character cut"
- **Committed in:** be5edd7

**3. [Scope] Extra files and RED stubs**
- `src/lib/copy/messages.test.ts`, `src/features/products/ProductsTab.test.tsx` and `src/features/products/SendDialog.test.tsx` are not in the plan's file list; they hold the tests of the copy, of the captions with withheld items and of the dialog equality. `withheldTargets` is an exported helper beyond the plan's interface block (needed by `ProductsTab` to count sendable targets). The RED commit (`27637b8`) carries inert stubs of the new exports and `withheld: []`, replaced in `be5edd7`.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical), 1 scope note
**Impact on plan:** No scope creep; the second fix makes the guard stricter in the direction LLM-03 asks for.

## Issues Encountered

None. The only lint output is the pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive), out of scope. The IDE reports Tailwind canonical-class suggestions (`min-w-190` for `min-w-[760px]`, `break-words`) on existing lines; they were left because the plan's acceptance criteria and earlier plans use the arbitrary-value classes.

## Items that need a decision

Per CLAUDE.md §1, these are choices the plan or UI-SPEC leaves open. Each is easy to change.

1. **Suppliers with no `Nombre` (open item from Plan 04-01).** `collectItems` and `collectCategorizeTargets` still skip silently the concepts and the supplier of an invoice whose Emisor has no name (the ledger falls back to the RFC). This plan's guard and «No se enviarán» group do not cover it (the group's wording is about RFC-like, UUID, e-mail or number-like text, and the skipped ones never reach the builders). Options: (a) leave it silent (current); (b) list them under «No se enviarán» with an extra reason line (needs new copy, and the group heading says «contienen algo que parece un RFC…», which would be wrong for them); (c) show a separate caption such as «{n} proveedores sin nombre no se envían». Recommendation: (c), in a later plan, since it needs its own wording.
2. **The user's category names are not guarded.** The plan lists descriptions, supplier names, product names and member descriptions. Category names (`body.categories`) are typed by the user and travel on every categorize batch unchecked. A category named with an e-mail or a long number would be sent. Recommendation: guard them too and drop the category from the list (it then cannot be proposed); it would need a line in the dialog. Say if you want it.
3. **Sensitive accepted-product names in the grouping context are dropped silently.** They are in no body and not listed under «No se enviarán» (that group is for items). Alternative: list them there too.
4. **Wording of «Aceptar todas» texts.** The title and buttons are the UI-SPEC's; the body («Cada una de las {n} filas recibirá la categoría que muestra su selector. Una categoría nueva se crea una sola vez. Se omitirán {k} filas sin categoría elegida.»), the singular forms and the toast («{n} sugerencias aplicadas; {k} quedaron en la tabla») are mine.
5. **«No se enviarán» heading in the singular.** The UI-SPEC text is used for any count (including «No se enviarán (1): contienen …»).
6. **From 04-19:** «Mostrar {n} más» for category rows is covered here (50 at a time). The section heading wording («Sugerencias de categoría · {n}» vs «· 1 sugerencia») from 04-19 item 1 is unchanged and still open.
7. **False positives of the guard.** A product code shaped like an RFC (for example «ABC123456XYZ») or any 8-digit run (a barcode fragment) is withheld, and so is its description in the grouping. The user sees it listed in the dialog but cannot send it. Say if a manual «enviar de todos modos» is wanted.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or trust boundary beyond the plan's threat model: T-04-40 is mitigated (guard in both builders, withheld list in the dialog, anonymized payload test) and T-04-41 is mitigated (the dialog renders the bodies; `SendDialog.test.tsx` serializes and compares both flows).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-21 (live check) can exercise the real model; visual items for it: long names in the Nombre cell and Select trigger, the header «Aceptar todas» button and «Mostrar más» layout, and how the «No se enviarán» group reads with real data.
- `tests/fixtures.guard.test.ts` is skipped in worktrees (no `Facturas/`); the orchestrator should run it on main after merge. `candidates.anon.test.ts` reads only `tests/fixtures/cfdi/anon/`.

## Self-Check: PASSED

- Created files exist: `src/features/products/CategoryBulkDialog.tsx`, `src/features/products/SendDialog.test.tsx`, `src/domain/llm/candidates.anon.test.ts`.
- Commits `917aace`, `27637b8`, `be5edd7` and `3268378` are ancestors of HEAD; `git rev-list --count` from the plan base gives 4.
- `pnpm verify` (lint, typecheck, test, build) passes: 2815 tests passed, 75 skipped (live tests); lint shows only the pre-existing warning. `pnpm smoke:auth`: `smoke-auth: OK (20 checks)`.
- Acceptance greps: `sugerencias de categoría?` in messages.ts 2 (es.ts 0, the criterion needs one of the files), `CategoryBulkDialog` in the table 2, `export function isSensitive` 1, `/api/llm/categorize` in smoke-auth 3, `vitest-environment jsdom` in the anon test 1.

---
*Phase: 04-agrupaci-n-de-productos-con-deepseek*
*Completed: 2026-10-22*
