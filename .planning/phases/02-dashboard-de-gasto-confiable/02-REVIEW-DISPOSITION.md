---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Undo or re-include of a normal exclusion writes to `restored`, so a later substitute double-counts the original"
  - id: WR-02
    severity: warning
    disposition: open
    title: "`formatTotal` converts an XML amount with `Number()` (project rule: money via big.js only)"
  - id: WR-03
    severity: warning
    disposition: open
    title: "One damaged or typo'd `Fecha` can blow up the month span (unbounded month list and chart)"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Duplicate React keys in the payments list of the concepts panel"
  - id: IN-01
    severity: info
    disposition: open
    title: "Substitution cycles remove both invoices from the totals"
  - id: IN-02
    severity: info
    disposition: open
    title: "Vendored `chart.tsx` has unjustified `as` assertions (CLAUDE.md section 2)"
  - id: IN-03
    severity: info
    disposition: open
    title: "`aria-controls` points at a panel that is not in the DOM when the row is collapsed"
  - id: IN-04
    severity: info
    disposition: open
    title: "`settingsStore.merge` overwrites the current `ivaMode` when nothing is stored"
  - id: IN-05
    severity: info
    disposition: open
    title: "Ranking bar scale includes negative suppliers"
  - id: IN-06
    severity: info
    disposition: open
    title: "Negative Total, SubTotal or Importe are accepted without any incident"
open: 10
total: 10
recorded: 2026-10-16T01:17:12.128Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
