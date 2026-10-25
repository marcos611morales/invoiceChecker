---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: fixed
    title: "The two LLM routes duplicate about 70 lines"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Once the user picks an existing category on a row, the model's proposed «Nueva: X» choice cannot be selected again"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "`enqueueProductSuggestions` stops at the first card that does not fit, and nothing tells the user"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "One empty group makes the whole grouping batch fail"
  - id: IN-05
    severity: info
    disposition: skipped
    title: "A supplier row saved before WR-01 still writes the cut name, ending in «…», to the settings"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "A throwing `apply` is swallowed with no trace, and a half-done apply leaves run state behind"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Supplier names are truncated to 60 characters and then persisted into the settings"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "`startRun` does not guard `outcome.apply()`, so a throwing apply rejects the run promise and loses the run state"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Weak content-type check on both LLM routes"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Sensitive-pattern guard does not cover every text that reaches DeepSeek, and the server enforces no content rule"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "A late batch answer is enqueued without re-checking the accepted products and «No agrupar» marks"
open: 0
total: 11
recorded: 2026-10-25T16:16:55.184Z
---

# Phase 04: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | fixed | 04-REVIEW-FIX.md |
| IN-02 | info | fixed | 04-REVIEW-FIX.md |
| IN-03 | info | fixed | 04-REVIEW-FIX.md |
| IN-04 | info | fixed | 04-REVIEW-FIX.md |
| IN-05 | info | skipped | 04-REVIEW-FIX.md |
| IN-06 | info | fixed | 04-REVIEW-FIX.md |
| WR-01 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-05 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
