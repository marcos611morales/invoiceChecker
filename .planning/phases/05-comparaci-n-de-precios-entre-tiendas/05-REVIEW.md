---
phase: 05-comparaci-n-de-precios-entre-tiendas
reviewed: 2026-10-26T00:00:00Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - src/domain/prices/comparable.ts
  - src/domain/prices/compare.ts
  - src/domain/prices/content.ts
  - src/domain/prices/history.ts
  - src/domain/prices/members.ts
  - src/domain/prices/purchases.ts
  - src/domain/prices/sizeReader.ts
  - src/domain/prices/units.ts
  - src/domain/settings/backup.ts
  - src/domain/settings/migrate.ts
  - src/domain/settings/prices.ts
  - src/domain/settings/products.ts
  - src/domain/settings/schema.ts
  - src/domain/settings/types.ts
  - src/features/categories/BackupControls.tsx
  - src/features/categories/useCategorySettings.ts
  - src/features/prices/ContentEditor.tsx
  - src/features/prices/ContentTable.tsx
  - src/features/prices/HistoryChart.tsx
  - src/features/prices/PreciosTab.tsx
  - src/features/prices/PricesTable.tsx
  - src/features/prices/ProductDetail.tsx
  - src/features/prices/PurchasesList.tsx
  - src/features/prices/StoreTable.tsx
  - src/features/prices/focusTargets.ts
  - src/features/prices/usePricesView.ts
  - src/features/shell/AppShell.tsx
  - src/lib/copy/es.ts
  - src/lib/copy/messages.ts
  - src/lib/format.ts
  - src/stores/sessionStore.ts
  - src/stores/settingsStore.ts
  - src/app/globals.css
  - tests/support/pricesFactory.ts
  - tests/support/pricesXml.ts
  - tests/support/settingsStorage.ts
findings:
  critical: 2
  warning: 1
  info: 5
  total: 8
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-26
**Depth:** standard
**Files Reviewed:** 36 (source, copy, styles and test-support files; `e2e/prices.spec.ts`, the fixtures and the `*.test.*` files were read only to judge coverage)

## Summary

The settings layer (v4 store, file v3, migration chain, option-a pruning of dangling overrides, product/override/correction reducers) is sound. I traced the integrity rules, the frozen v1-v3 schemas, the undo paths and the "same object means no write" convention in `settingsStore`, and found no defect. No `any`, no `!`, no unverified `as`, no `@ts-*` in the reviewed source. Vendor text is rendered as React text everywhere, the chart config is static, and the regexes in the size reader are linear. The intentional user decisions listed in the task were not treated as findings.

The defects are concentrated in `src/domain/prices/sizeReader.ts`. The reader's stated contract is "a guessed presentation must never reach a compared price", but three common Mexican description formats are read confidently and wrongly. The result is `sized: true, source: "description"`, so the reading is treated as verified. It also makes `compareProduct` drop the unsized siblings (D-10), so the bad number replaces good data rather than sitting beside it. I confirmed each case by executing `readSize` (a scratch vitest outside the repo, nothing in the repo was changed). No existing test in `sizeReader.test.ts` covers these inputs.

## Critical Issues

### CR-01: A thousands comma is read as a decimal point, so the content is wrong by 1000x

**File:** `src/domain/prices/sizeReader.ts:107-110` (`numberText`), used at line 120
**Issue:** The "thousands separator" rule only handles a dot (`/^\d{1,3}\.\d{3}$/`) and only for g and mL. Any other comma is turned into a decimal point (`raw.replace(",", ".")`). A comma followed by exactly three digits is a thousands separator in es-MX writing, so these descriptions are misread. Executed results:

- `JUGO 1,500 ML` gives volume 0.0015 L (should be 1.5 L)
- `HARINA 1,000 G` gives mass 0.001 kg (should be 1 kg)
- `AGUA 1,000 L` gives 1 L (it could be 1,000 L, and the reader guesses)

The unit price per kg or L is then inflated 1000x. Because the line is marked `sized: true` from the description, it also removes the unsized purchases of the same product from the comparison (D-10). The editor already refuses the same ambiguity («1,000» is refused by user decision), so the reader contradicts the project's own policy.

**Fix:** Treat a number of the form `\d{1,3},\d{3}` as ambiguous and give no reading, for every unit. For example, in `readWeightVolume`:
```ts
// «1,500 ML» / «1,000 G»: a comma with exactly three digits is a thousands separator or a decimal;
// guessing either way is wrong by 1000x, so it gives no size.
if (/^\d{1,3},\d{3}$/.test(numText)) continue;
```
`continue` drops the reading, so the line becomes an unsized piece. Add `1,500 ML`, `1,000 G` and `1,000 L` to `sizeReader.test.ts`.

### CR-02: A fraction like «1/2 KG» or «1/4 KG» is read as a pack, so 0.5 kg becomes 2 kg and 0.25 kg becomes 4 kg

**File:** `src/domain/prices/sizeReader.ts:76-81` (`PLAIN` / `GLUED`) and 121-122 (pack multiplication)
**Issue:** The optional prefix `(\d{1,2})\s*[/X]\s*` is always interpreted as a pack count. A fraction of a kilo or litre («1/2 KG», «1/4 KG», «3/4 KG», «1/2 LT»), which is ordinary retail wording for cheese, butter, ham and oil, is therefore multiplied instead of divided. Executed results:

- `QUESO PANELA 1/2 KG` gives mass 2 kg (it is 0.5 kg)
- `MANTEQUILLA 1/4 KG` gives 4 kg (it is 0.25 kg)
- `JAMON 3/4 KG` gives 12 kg (it is 0.75 kg)
- `ACEITE 1/4 L` gives 4 L

The unit price is understated 4x to 16x, so these products look far cheaper than they are. That distorts "tienda más barata" and the estimated saving, and the badge reads «detectado», so the user has no reason to doubt it.

**Fix:** A `/` prefix whose pack count is smaller than the number is a fraction, not a pack («12/1L» and «6/2L» have pack >= number). Refuse it (or compute `pack / number`). Minimal change in `readWeightVolume`:
```ts
const pack = packText === undefined ? null : new Big(packText);
// «1/2 KG», «1/4 L», «3/4 KG»: numerator below denominator is a fraction of a unit, not a pack.
if (pack !== null && whole.includes("/") && pack.lt(numText.replace(",", "."))) continue;
```
Add «1/2 KG», «1/4 L» and «3/4 KG» to the tests. The existing fixture «1/1 KG» (pack = number) stays a pack of one.

## Warnings

### WR-01: Common pack wordings are not recognised, so a pack of N is priced as one unit

**File:** `src/domain/prices/sizeReader.ts:86-89` (`PACK_TOKEN`, `PIECE_PACK_WORD`) and 173-176
**Issue:** The module header promises that "a single reading next to a pack word … gives no size", but the list of pack words is incomplete and anchored with `\b`. Executed results, all returning `kind: "size"` for a single unit:

- `CREMA 450 ML C/6` gives 0.45 L (a 6-pack, `C/6` is "caja con 6")
- `BOTELLA 1.5 L X 12` gives 1.5 L (the trailing `X 12` is not read; only a leading `12X` is)
- `SOBRE 5 G x 100` gives 0.005 kg
- `REFRESCO 600ML 12PACK` gives 0.6 L (`\bPACK\b` does not match inside `12PACK`, there is no word boundary between `2` and `P`)
- `AGUA 500ML PAQUETE`, `AGUA 500 ML PQTE` and `LECHE 1 L 12 UDS` give a single unit

If the invoice quantity is the number of packs, the content is understated by the pack size and the unit price is inflated by the same factor, which can flip the cheapest store.

**Fix:** Extend the guard patterns so these cases return `ambiguous` / `pack-token`, for example:
```ts
const PACK_TOKEN =
  /\b(PACK|PAQ|PAQUETE|PQTE?|CJ|CAJA|FAJILLAS?|DOCENA)\b|\d(PACK|PAQ)\b|\bC\/\s?\d+|\bX\s?\d{1,3}\b|\b\d+\s*(PZ|PZA|PZAS|PIEZAS|PK|P|UDS?|UNIDADES)\b|\dPK\b/;
```
Apply the same trailing `X n` / `C/n` guard to `PIECE_PACK_WORD`, and cover each wording with a `sizeReader.test.ts` case.

## Info

### IN-01: Unused production code

**File:** `src/lib/copy/messages.ts` (`cheapestSummary`) and `src/features/prices/usePricesView.ts:45,121` (`allPurchases`)
**Issue:** `cheapestSummary` is only defined, never imported by production code (`ProductDetail` uses `cheapestSummaryParts`). `allPurchases` is part of `PricesViewState` and is returned, but no component reads it.
**Fix:** Remove `cheapestSummary` and the `allPurchases` field from the returned state (keep it as a local `useMemo`).

### IN-02: Duplicated constants and derived maps

**File:** `src/domain/prices/history.ts:23`, `src/features/prices/HistoryChart.tsx:61`, `src/lib/format.ts:300` (`MS_PER_DAY` / `86_400_000`); `Intl.Collator("es", …)` in `compare.ts`, `history.ts`, `members.ts`, `PricesTable.tsx`; `TOAST_DURATION_MS` in `PricesTable.tsx` and `ContentEditor.tsx`; the `ruleMapKey(rfc, key)` corrections map built in both `usePricesView.ts:68-74` and `ContentTable.tsx:128-134`.
**Issue:** If one copy changes (a different collation rule, a different correction key) the tab and the content table can disagree. The corrections map is the riskiest: the comparison uses one and the content table uses the other.
**Fix:** Export one `ES_COLLATOR`, one `MS_PER_DAY` and one `correctionsByMember(contentCorrections)` helper from the domain layer and import them.

### IN-03: The chart's Y value is rounded to cents

**File:** `src/features/prices/HistoryChart.tsx:88`
**Issue:** `y: Number(toMoneyString(point.price))` rounds to 2 decimals for geometry. Prices below a cent collapse to 0, and if every price rounds to the same value the Y domain falls back to `[0, 1]`. This is only visible for very cheap per-piece items, and the tooltip and tables round the same way (REGLA-04), so it is cosmetic.
**Fix:** If sub-cent items are expected, feed the exact value to the chart: `y: Number(point.price.toFixed(6))`.

### IN-04: The editor stores the amount text as typed

**File:** `src/features/prices/ContentEditor.tsx:80-84`
**Issue:** `amountOf` validates the text but returns it unchanged apart from the comma. `"007"` and `"00,5"` (which becomes `"00.5"`) pass `contentAmountIssue` and are stored with the leading zeros. Display normalizes them (`formatCorrection`), but `sameCorrection` compares text, so saving `7` over `007` counts as a change, and the settings file carries the raw text.
**Fix:** Return `parseDecimal(decimal)?.toFixed() ?? null` after the validation, so `007` is stored as `7` and `1.50` as `1.5`.

### IN-05: Date labels accept impossible days that the history rejects

**File:** `src/lib/format.ts:139-147` (`shortDateLabel`) and `:284-293` (`longDateLabel`) versus `src/domain/prices/history.ts:52-68` (`dayNumber`)
**Issue:** The labels only check `day <= 31`, so `2025-02-30` is shown as «2 mar 2025» in tables, while `dayNumber` rejects it and `historySeries` drops the purchase from the chart. The chart note then says the purchase is excluded "porque no está normalizada", which is not the real reason. The ledger's `monthOfFecha` does not validate the day, so such a Fecha can reach this code. It is unlikely with SAT-stamped invoices.
**Fix:** Reuse `dayNumber` validation in the label helpers, and give the excluded count a separate "sin fecha válida" reason, or accept the rare mismatch.

---

_Reviewed: 2026-10-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
