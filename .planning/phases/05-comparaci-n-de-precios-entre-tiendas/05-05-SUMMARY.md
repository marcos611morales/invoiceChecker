---
phase: 05-comparaci-n-de-precios-entre-tiendas
plan: 05
subsystem: prices
tags: [prices, size-reader, regex, big.js, vitest, cfdi]
status: complete
requires:
  - phase: 05-comparaci-n-de-precios-entre-tiendas
    provides: Plans 05-01 and 05-03 (resolveContent, units, pricesFactory, comparison tests)
provides:
  - src/domain/prices/sizeReader.ts (readSize, SizeReading, MAX_DESCRIPTION_LENGTH)
  - resolveContent piece branch reads kg, L or counted pieces from the description (source "description", sized true)
  - tests/fixtures/cfdi/anon/anon-precios.xml (synthetic CFDI with the guide concept lines)
affects: [05-04, 05-10, 05-11, 05-12]
tech-stack:
  added: []
  patterns:
    - "Untrusted vendor text is cut to 300 characters after accent and case normalization before any pattern runs; all quantifiers bounded"
    - "Real-sample coverage tests assert counts and booleans only"
key-files:
  created:
    - src/domain/prices/sizeReader.ts
    - src/domain/prices/sizeReader.test.ts
    - src/domain/prices/prices.anon.test.ts
    - src/domain/prices/prices.realdata.test.ts
    - tests/fixtures/cfdi/anon/anon-precios.xml
  modified:
    - src/domain/prices/content.ts
    - src/domain/prices/content.test.ts
key-decisions:
  - "A piece count preceded by a pack multiplier («12/50PZ», «2X50PZ») gives no size (ambiguous pack-token) instead of multiplying: the plan does not define it, and a guessed presentation must not reach a compared price"
  - "Piece counts are read with 1 to 4 digits as D-35 specifies, so the effective upper bound is 9999; the 10,000 bound of the plan can never be reached by the pattern (five-digit counts are not read)"
requirements-completed: [PREC-02]
duration: 25 min
completed: 2026-10-26
commits: 2
plan_head_before: 9e411fdf6391817d6aa6ed86e23f33ce15b65c4c
plan_head_after: 45842e57281512c6ea3e2872682c27ba8a50199e
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
---

# Phase 5 Plan 05: Size reader for piece-unit purchases Summary

Conservative description reader (weight, volume and D-25 piece counts) plugged into the piece branch of `resolveContent`, so «12/1L ALPURA» compares per litre and «2KG MANGO MM» per kg instead of per piece, and ambiguous descriptions (two readings, size next to a count or a pack word) stay unsized for manual capture.

## What was done

**Task 1 (commit 10e9690): `sizeReader.ts` and its contract table.** Ported the RESEARCH Pattern 3 reader (PLAIN and GLUED patterns, thousands-dot rule for g and mL, 1,000 kg/L bound, pack-token rule) and extended it with D-25 piece counts per D-34 and D-35: tokens PZAS, PZA, PZS, PZ, PIEZAS, PIEZA, PKS, PK, 1 to 4 digits, not continuing a longer number, not followed by a letter or digit. Resolution order: a weight or volume next to a count, or two distinct values of one kind, is `conflict`; a single weight or volume keeps the RESEARCH pack-token rule; a single count next to PACK, PAQ, PQ, CJ, CAJA, FAJILLA(S), DOCENA or a bare «N P» is `pack-token` (a separate regex, because the RESEARCH one also matches PZ and PK). `sizeReader.test.ts` has 62 table-driven cases: the whole RESEARCH contract table, the D-25 counts, the ambiguous cases, the false-positive list, the bounds, the 300-character cut and a 5,000-character hostile-input timing test (under 50 ms).

**Task 2 (commit 45842e5): plug-in, fixture and coverage.** `resolveContent` calls `readSize` only for piece units; a `size` reading gives `amount = cantidad × total`, `sized: true`, `source: "description"`; `ambiguous` and `none` keep the unsized piece result. Weight and volume units never call the reader. `anon-precios.xml` (public test RFC EKU9003173C9, synthetic UUID absent from Facturas/, totals reconcile) feeds `prices.anon.test.ts`, which runs parseCfdi, buildLedger, scopeToCategories, extractPurchases and comparePrices in both IVA modes: «12/1L ALPURA» is 12 L at 15 per litre, «Leche LacDel Desla» is not-normalized with `unsized-with-sized-siblings`, the KGM ham line is 0.27 kg from the XML, and the line whose Descuento equals its Importe is `zero-amount`. `prices.realdata.test.ts` (skipIf no sample) asserts at least 30 weight or volume members, at least 5 piece-count members, no reading above 1,000 and no KGM or LTR line with content from the description; counts only.

## Verification

- `pnpm exec vitest run` (full suite, FACTURAS_DIR set): 108 files passed, 1 skipped; 3207 tests passed, 10 skipped.
- `pnpm typecheck`: passes. `pnpm lint`: 0 errors, 1 pre-existing warning in `src/lib/client/navigation.ts` (unused eslint-disable directive; out of scope).
- Real sample thresholds (30 weight or volume members, 5 piece-count members, 1,000 bound) hold.

## Deviations from Plan

**1. [Rule 2 - Missing safety] Pack multiplier before a piece count gives no size.** The plan defines no behavior for «12/50PZ»; reading 50 would be a wrong magnitude and multiplying would be a guess. The piece pattern accepts an optional `N/` or `NX` prefix only to detect it and returns ambiguous `pack-token`. Covered by a test case. Files: `sizeReader.ts`, `sizeReader.test.ts`. Commit 10e9690.

**2. [Plan inconsistency] Piece count upper bound.** The plan says counts of 1 to 4 digits and that counts above 10,000 are discarded. With 4 digits the maximum is 9999, so the 10,000 bound never triggers; the test pins 9999 as the largest read count and 10000 as not read. No behavior beyond the plan.

Otherwise the plan was executed as written.

## Known Stubs

None.

## Threat Flags

None. The only new surface is regex evaluation over vendor text, covered by T-05-12 (300-character cut, bounded linear patterns, timing test).

## Self-Check: PASSED

- sizeReader.ts, sizeReader.test.ts, prices.anon.test.ts, prices.realdata.test.ts, anon-precios.xml: FOUND
- Commits 10e9690 and 45842e5: FOUND in history
