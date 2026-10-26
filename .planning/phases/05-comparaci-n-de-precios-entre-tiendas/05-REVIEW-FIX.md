---
phase: 05-comparaci-n-de-precios-entre-tiendas
fixed_at: 2026-10-26T00:00:00Z
review_path: .planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Source review:** `.planning/phases/05-comparaci-n-de-precios-entre-tiendas/05-REVIEW.md`
**Iteration:** 1
**Scope:** CR-01, CR-02, WR-01 only (IN-01..IN-05 left open by request).
**Verification ran in:** the main checkout (no worktree), `pnpm tsc --noEmit`, `pnpm eslint .`, `pnpm vitest run` with `FACTURAS_DIR` set.

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: A thousands comma is read as a decimal point

**Files modified:** `src/domain/prices/sizeReader.ts`, `src/domain/prices/sizeReader.test.ts`
**Commit:** ba299b9
**Applied fix:** `numberText` now strips the comma when it is followed by exactly three digits (`\d{1,3},\d{3}`) for every unit. One or two digits after the comma stay a decimal. Bounds apply after reading. Status: fixed, requires human verification (logic change).

### CR-02: A fraction like 1/2 KG is read as a pack

**Files modified:** `src/domain/prices/sizeReader.ts`, `src/domain/prices/sizeReader.test.ts`
**Commit:** 5a80da7
**Applied fix:** the pack separator is captured; with `/`, a < b and a KG or L unit the prefix is read as the fraction a/b (Big division from strings), not a pack. Status: fixed, requires human verification (logic change). See the note on `12/500ML` below.

### WR-01: Common pack wordings are not recognised

**Files modified:** `src/domain/prices/sizeReader.ts`, `src/domain/prices/sizeReader.test.ts`
**Commit:** cee331d
**Applied fix:** `PACK_TOKEN` and `PIECE_PACK_WORD` now share `PACK_COUNT`: PAQUETE, PQTE, UDS, `\dPACK`, `C/n` and a trailing `X n` (not followed by a unit). Status: fixed, requires human verification (logic change).

---

_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
