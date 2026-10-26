---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "A thousands comma is read as a decimal point, so the content is wrong by 1000x"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "A fraction like «1/2 KG» or «1/4 KG» is read as a pack, so 0.5 kg becomes 2 kg and 0.25 kg becomes 4 kg"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Common pack wordings are not recognised, so a pack of N is priced as one unit"
  - id: IN-01
    severity: info
    disposition: open
    title: "Unused production code"
  - id: IN-02
    severity: info
    disposition: open
    title: "Duplicated constants and derived maps"
  - id: IN-03
    severity: info
    disposition: open
    title: "The chart's Y value is rounded to cents"
  - id: IN-04
    severity: info
    disposition: open
    title: "The editor stores the amount text as typed"
  - id: IN-05
    severity: info
    disposition: open
    title: "Date labels accept impossible days that the history rejects"
open: 5
total: 8
recorded: 2026-10-26T23:09:36.364Z
---

# Phase 05: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | ba299b9 |
| CR-02 | critical | fixed | 5a80da7, c9fd293 |
| WR-01 | warning | fixed | cee331d |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
