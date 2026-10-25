---
phase: quick-261025-cgg
plan: 01
subsystem: llm
tags: [privacy, deepseek, zod, zustand, review-fix]
status: complete
requires:
  - phase: 04-agrupaci-n-de-productos-con-deepseek
    provides: LLM routes, run store, suggestions queue, send dialogs
provides:
  - fullName on supplier category rows (full supplier name written to settings on accept)
  - import-free isSensitive module shared by browser builders and request schemas
  - server 400 bad_request for sensitive free text on both LLM routes
  - blocked «Sugerir categorías» send when a user category name looks sensitive
key-files:
  created:
    - src/domain/llm/sensitive.ts
  modified:
    - src/domain/llm/suggestions.ts
    - src/domain/llm/candidates.ts
    - src/domain/llm/contract.ts
    - src/stores/llmRunStore.ts
    - src/lib/copy/messages.ts
    - src/features/products/CategorySuggestionsTable.tsx
    - src/features/products/SendDialog.tsx
    - .planning/phases/04-agrupaci-n-de-productos-con-deepseek/04-REVIEW-FIX.md
decisions:
  - "WR-01 option 1: optional fullName, SUGGESTIONS_VERSION unchanged"
  - "WR-04 client (a) for earlier-card names, (c) for user category names; server (a) via shared request schemas"
  - "Blocking sentence: red role=alert paragraph under the summary, confirm button disabled; startCategorizeRun refuses silently"
commits: 4
plan_head_before: cb722717e0d437b340c5ff48ee18ce05cbcaee37
plan_head_after: 2d30ca23c16024b3683b4917db2f60d8ddcd372f
actuals:
  tasks: 3
  commits: 4
---

# Quick 261025-cgg: Fix phase 04 review findings WR-01 and WR-04 Summary

Supplier suggestions now store the uncut supplier name in the settings (display keeps the cut name), and no RFC, UUID, e-mail or long number can reach DeepSeek through earlier-card names, user category names or a tampered request body.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | 4f4c025 | fix(04): WR-01 keep the full supplier name when a category suggestion is accepted |
| 2 | e0b9995 | fix(04): WR-04 reject sensitive text on the LLM routes and drop sensitive context names |
| 3 | 2069467 | fix(04): WR-04 block «Sugerir categorías» when a category name looks sensitive |
| 3 (report) | 2d30ca2 | docs(04): record WR-01 and WR-04 fixes |

## What changed

- WR-01: `fullName?: string` on the supplier variant of `CategorySuggestion` and `categoryRowSchema`; `categorizeBatches` sets it; `planAccept` and `applyRow` write `row.fullName ?? row.name`; `copyCategoryRow` carries it. Old queues (no `fullName`) still load as `ok`.
- WR-04.3: `isSensitive` and its patterns moved to `src/domain/llm/sensitive.ts` (no imports), re-exported from `candidates.ts`. `safeText(max)` in `contract.ts` guards the seven free-text fields; the unchanged route handlers answer 400 `{error: "bad_request", retryable: false}` before DeepSeek is called.
- WR-04.1: `composeRequest` skips earlier-card names for which `looksSensitive` is true (silent, ids stay consecutive).
- WR-04.2: `CategorizeRun.sensitiveCategories`; `startCategorizeRun` refuses such runs (and runs whose body carries a sensitive category name); `CategorizeSendDialog` shows `sensitiveCategoriesText(...)` and disables «Enviar a DeepSeek».
- 04-REVIEW-FIX.md: 5 fixed, 0 skipped, `all_fixed`, real verification results.

## Gates (run in the worktree, via the main checkout's binaries)

- `tsc --noEmit`: only the expected `src/app/layout.tsx(24,50) TS2304 Cannot find name 'LayoutProps'` (no generated `.next/types` in a worktree).
- `eslint .`: 0 errors, 1 pre-existing warning (unused eslint-disable in `src/lib/client/navigation.ts`).
- `vitest run`: 93 files passed, 6 skipped; 2846 tests passed, 75 skipped (the `*.realdata.test.ts` suites skip because the untracked `Facturas/` data is not in the worktree, plus the 10 live-LLM tests).
- The gates must be re-run in the main checkout after the merge.

## Deviations from Plan

None - plan executed as written. One environment note: the per-plan HEAD ledger file (protocol 0c) could not be written because the sandbox refuses compound `git rev-parse --git-dir` commands, so `plan_head_before` is the known base commit `cb72271` given in the task and `commits` was counted from it (4).

## Known Stubs

None.

## Threat Flags

None. The new surface (request-schema refinement, blocked dialog) only tightens the plan's threat register (T-cgg-01 to T-cgg-04).

## Self-Check: PASSED

- sensitive.ts exists; commits 4f4c025, e0b9995, 2069467, 2d30ca2 are on the branch.
- Acceptance greps: `row.fullName ?? row.name` x2, `SUGGESTIONS_VERSION = 1` unchanged, `safeText(` x8, no `const RFC_PATTERN` left in candidates.ts, route handlers untouched, 04-REVIEW-FIX.md has `all_fixed`, `fixed: 5`, `skipped: 0`, five `### WR-0N` headings and no Skipped section.
