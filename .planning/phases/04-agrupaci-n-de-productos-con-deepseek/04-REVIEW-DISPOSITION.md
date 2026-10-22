---
phase: 04-agrupaci-n-de-productos-con-deepseek
review: 04-REVIEW.md
created: 2026-10-22
counts: { critical: 0, warning: 5, info: 4 }
---

# 04 — Code review disposition

| Finding | Severity | Disposition | Note |
|---------|----------|-------------|------|
| WR-01 | warning | open | Supplier names cut to 60 chars with «…» are stored as the supplier name on category accept |
| WR-02 | warning | open | `startRun` calls `outcome.apply()` unguarded; a throw abandons remaining batches |
| WR-03 | warning | open | Content-type check uses `.includes("application/json")` on both LLM routes |
| WR-04 | warning | open | Sensitive-pattern guard does not cover category names or earlier-card context names |
| WR-05 | warning | open | Late batch answers are not re-checked against live products / «No agrupar» marks |
| IN-01 | info | open | ~70 duplicated lines between the two routes |
| IN-02 | info | open | «Nueva: X» cannot be re-selected after switching a row to an existing category |
| IN-03 | info | open | `enqueueProductSuggestions` `break` at member cap drops later cards silently |
| IN-04 | info | open | One empty `i` array in the model output fails the whole batch |

Disposition pending the user's decision at phase close (fix via `/gsd-code-review 04 --fix`, or accept).
