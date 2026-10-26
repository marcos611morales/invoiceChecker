---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 10
subsystem: domain
tags: [content-correction, precedence, settings, undo, zustand, big.js, members]
status: complete

requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: "ContentCorrection, LIMITS and contentAmountIssue (05-02), resolveContent / readSize (05-01, 05-03, 05-05), setPriceOverride and withProductRemoved (05-08), usePricesView with allPurchases (05-07, 05-08)"
provides:
  - "settings/prices.ts setContentCorrection / removeContentCorrection / restoreContentCorrection with SetCorrectionResult (invalid, limit, previous entry for Deshacer)"
  - "Store actions setContentCorrection / removeContentCorrection / restoreContentCorrection writing contentCorrections once"
  - "content.ts resolveContent(line, correction?) with the user's correction first on piece units (source user, sized)"
  - "compare.ts compareProduct / comparePrices optional corrections map keyed by ruleMapKey(rfc, key)"
  - "members.ts MemberContent and memberContents(row, corrections): per-member content rows for the content table"
  - "usePricesView feeds the stored corrections to the filtered and the unfiltered comparisons"
affects: [05-11 (content section and editor), 05-12]

actuals:
  tokens: 68000
  tasks: 2
  commits: 5
plan_head_before: f9c93ca26deac048c387266159f639114f607ae1
plan_head_after: 279288cb61aaea309136df055afcc4e5fe869393

tech-stack:
  added: []
  patterns:
    - "Correction reducers return the very same settings object on no-op or refusal; entries identified by RFC plus key through findIndex, never an object keyed by text"
    - "A stored entry is rebuilt field by field (seven contract keys), so extra properties of the input never reach storage"
    - "Corrections travel as a Map keyed by ruleMapKey, the same identity as Purchase.memberKey; omitting it reproduces the Plan 05-08 results"

key-files:
  created:
    - src/domain/prices/members.ts
    - src/domain/prices/members.test.ts
  modified:
    - src/domain/settings/prices.ts
    - src/domain/settings/prices.test.ts
    - src/stores/settingsStore.ts
    - src/stores/settingsStore.test.ts
    - src/domain/prices/content.ts
    - src/domain/prices/content.test.ts
    - src/domain/prices/compare.ts
    - src/domain/prices/compare.test.ts
    - src/features/prices/usePricesView.ts
    - src/features/prices/usePricesView.test.tsx

key-decisions:
  - "A correction applies to piece-unit purchases only: content = XML quantity x pieces per pack x typed amount x unit factor; KGM/LTR-style lines keep the XML quantity"
  - "A stored correction that cannot be read as exact numbers (non-integer packs, bad amount) is ignored by resolveContent and falls back to detection, never throws"
  - "Status of a member: not-normalized (a content reason), else corrected (a correction exists and the member is editable), else detected/unsized for editable members, else xml"
  - "Content reasons for a member are unit-unknown, bad-quantity, unsized-with-sized-siblings and other-family; bad-amount and zero-amount are amount problems and do not make a member not-normalized"
  - "Product actions never touch contentCorrections: a correction follows its member through removal, deletion, restore and regrouping"

patterns-established:
  - "memberContents derives the member key from Purchase.memberKey (prefix strip), the single source of identity"

requirements-completed: [PREC-02, PREC-05]

coverage:
  - id: D1
    description: "Corrections are saved, replaced, removed and restored per member within the 2,000 cap, refused when invalid, and store only the seven contract fields"
    requirement: PREC-02
    verification:
      - kind: unit
        ref: "src/domain/settings/prices.test.ts#setContentCorrection (D-13, D-14, D-15)"
        status: pass
      - kind: unit
        ref: "src/stores/settingsStore.test.ts#settingsStore content corrections (D-13, D-14, D-15)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A correction takes precedence for piece units, makes unsized siblings not-normalized (D-28) and does not cross RFCs or weight lines"
    requirement: PREC-02
    verification:
      - kind: unit
        ref: "src/domain/prices/content.test.ts#resolveContent with a user correction (D-09 step 1, D-13, D-14)"
        status: pass
      - kind: unit
        ref: "src/domain/prices/compare.test.ts#compareProduct and comparePrices with content corrections (D-09 step 1, D-13, D-28)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The prices view recomputes rows, cheapest store, saving and store slots with the saved corrections"
    requirement: PREC-05
    verification:
      - kind: unit
        ref: "src/features/prices/usePricesView.test.tsx#usePricesView content corrections (D-13, D-15, D-28)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each product exposes its members with how their content was obtained, editability, purchase count and latest quantity, in the agreed order"
    requirement: PREC-02
    verification:
      - kind: unit
        ref: "src/domain/prices/members.test.ts#memberContents (D-13, D-14, D-28)"
        status: pass
    human_judgment: false
---

# Phase 5 Plan 10: Content corrections in the price domain Summary

**A stored content correction (pieces per pack x amount x unit) now changes the content, the D-10/D-28 decision and every derived price of its member's piece-unit purchases; reducers, store actions, per-member rows and the view wiring are in place for the editor of Plan 05-11.**

## Performance

- **Duration:** about 9 min
- **Tasks:** 2 (both TDD: tests committed first, then the implementation)
- **Files:** 12 (2 created, 10 modified)

## Accomplishments

- `setContentCorrection`, `removeContentCorrection` and `restoreContentCorrection` in `src/domain/settings/prices.ts`: invalid packs (0, 1.5, 1000), amounts (`0`, `1e3`, 7 decimals, above 1,000,000) and units are refused as `invalid` with the stored rules (`contentAmountIssue`); the 2,001st member is refused as `limit` while replacing an existing member always works; the stored entry is rebuilt from exactly the seven contract fields.
- Store actions write `contentCorrections` in one `set`, nothing on a refusal or a no-op, and leave product state alone; a test deletes and restores the member's product and takes the member out of it, and the correction stays.
- `resolveContent(line, correction?)`: correction first, piece units only (`H87` x 2 with 12 x 1 L gives 24 L, source `user`; 6 `piezas` gives a sized piece count); `KGM`/`LTR` lines ignore it; an unusable stored value falls back to detection.
- `compareProduct` / `comparePrices` take the optional corrections map keyed by `ruleMapKey(rfc, key)`; a `piezas` correction on one member turns the other member's unsized purchases into `unsized-with-sized-siblings` and ends the `perPiece` state (D-28); a correction of one RFC never applies to another.
- `memberContents` gives one row per member with `status`, `editable`, `xmlFamily`, `detected`, `correction`, `reason`, `purchases` and `latestCantidad`, ordered not-normalized, corrected, then the rest by description with the es collator.
- `usePricesView` builds the corrections Map from the settings and passes it to both `comparePrices` calls, so rows, cheapest store, saving, summary and the unfiltered store slots all follow a saved correction.

## Task Commits

1. **Task 1 RED:** `5e0a08b` test(05-10): failing tests for content correction reducers
2. **Task 1 GREEN:** `209d4dc` feat(05-10): content correction reducers and store actions
3. **Task 2 RED:** `ad94f2f` test(05-10): failing tests for content precedence with corrections
4. **Task 2 GREEN (precedence):** `23b21ca` feat(05-10): corrections take precedence in content resolution and comparison
5. **Task 2 GREEN (rows and view):** `279288c` feat(05-10): per-member content rows and corrections wired into the prices view

## Deviations from Plan

### Auto-fixed Issues

None needed for correctness.

### Additions beyond the file list

**1. [Rule 2 - Missing verification] `usePricesView.test.tsx` extended**
- **Found during:** Task 2
- **Issue:** the plan lists `usePricesView.ts` only, but its behavior line "usePricesView passes the settings corrections to both comparisons" has no test home otherwise.
- **Fix:** added a `usePricesView content corrections` describe (4 tests, including the unfiltered store slots) to the existing test file written by Plan 05-08. Plan 05-09 does not touch this file.
- **Commit:** 279288c

### Interpretation choices (not asked of the user, flagged for review)

- `status: "corrected"` requires the member to be editable. A leftover correction on a member bought only by weight or volume stays visible in `correction` but the member is `xml`, because its content truly comes from the XML.
- "Content reason" for `not-normalized` excludes `bad-amount` and `zero-amount` (an amount problem a typed content cannot fix). This is the plan's flagged assumption A-5 neighborhood; Plan 05-11 can widen it in one set.
- `description` and `storeName` of a member row come from its latest purchase (the row has no access to the product's stored members).

**Total deviations:** 1 added test file extension. **Impact:** none on behavior or on parallel Plan 05-09.

## Issues Encountered

- A pre-existing ESLint warning in `src/lib/client/navigation.ts` (unused disable directive) is not from this plan and was left alone.

## Known Stubs

None.

## Threat Flags

None. The correction store path writes only the seven non-invoice fields (T-05-24) and every new numeric path builds `Big` from validated strings (T-05-29); the cap (T-05-23) is tested.

## Verification

- `pnpm exec vitest run src/domain/prices src/domain/settings src/stores src/features/prices`: 31 files, 1046 tests passed (with `FACTURAS_DIR` set).
- `pnpm verify` (lint, typecheck, test, build): exit 0; 118 test files passed, 1 skipped, 3472 tests passed, 10 skipped. Lint shows only the pre-existing warning above.
- Acceptance greps: `"user"` in content.ts (3), `contentCorrections` in usePricesView.ts (3), `memberContents` in members.ts (1), `setContentCorrection` / `restoreContentCorrection` in settingsStore.ts (4 each), `contentAmountIssue` and `LIMITS.contentCorrections` in settings/prices.ts (2, 1), no `@/lib|stores|features|components` import under `src/domain/prices`.

## Self-Check: PASSED

- Files exist: `src/domain/prices/members.ts`, `src/domain/prices/members.test.ts`, this SUMMARY.
- Commits `5e0a08b`, `209d4dc`, `ad94f2f`, `23b21ca`, `279288c` are ancestors of HEAD (5 commits measured from `plan_head_before`).
