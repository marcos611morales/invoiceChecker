---
status: diagnosed
trigger: "UAT gap G-02-10 / WR-01: Undo exclusion ('Deshacer exclusion') and 'Volver a incluir' write to `restored` for a normal exclusion, so a later TipoRelacion-04 substitute double-counts the original."
created: 2026-10-16T19:20:00Z
updated: 2026-10-16T19:32:00Z
goal: find_root_cause_only
symptoms_prefilled: true
---

## Current Focus

bug_class: Bohrbug (deterministic state transition; no timing or concurrency involved)
known_pattern_candidate: none (no knowledge-base.md and no MemPalace in this worktree)
hypothesis: CONFIRMED. `reincludeInvoice` (sessionStore.ts:122-126) does not know about the ledger and always adds the uuid to `restored`. All three UI callers go through it, so an invoice that was never substituted ends up in `restored`. When a later batch loads a TipoRelacion-04 invoice that names it, ledger.ts:305 skips the 'sustituida' exclusion and both invoices are counted.
test: done. Temporary vitest repro (deleted afterwards): exclude, then undo, then a later batch loads the substitute.
expecting: met. See the Evidence entry at 19:29.
next_action: return ROOT CAUSE FOUND to the orchestrator (find_root_cause_only). plan-phase --gaps owns the fix.

reasoning_checkpoint:
  hypothesis: "An invoice X that was never substituted is double-counted with its later TipoRelacion-04 substitute Y because reincludeInvoice adds X to `restored` on every call, including the undo of a plain manual exclusion. ledger.ts:305 then treats X as a substituted original the user chose to bring back."
  confirming_evidence:
    - "Repro: with no exclusion history, X is 'sustituida' and Gasto is 116.00. After excludeInvoice(X) and reincludeInvoice(X), restored.has(X) is true. After Y loads, X has exclusion null, counted true and substitutedBy Y, and Gasto is 232.00."
    - "qualitySummary of that ledger: the substitution state is 'reincluida', amountChanging is false, and there are 0 'sustituidas' rows and 0 'excluidas' rows. The double count is invisible."
    - "Three existing tests assert this exact pollution on invoices that were never substituted: InvoiceTable.test.tsx:560, QualityTab.test.tsx:509 and sessionStore.test.ts:160."
  falsification_test: "If ledger.ts:305 consulted something other than `restored`, or if reincludeInvoice skipped `restored` for plain uuids, X would read 'sustituida' and Gasto would be 116.00 after Y loads. The repro showed 232.00, so the hypothesis stands."
  fix_rationale: "The fix belongs at the write site: `restored` must only be written by an action that means 'override the substitution'. Fixing the ledger instead cannot work, because the ledger cannot tell whether the uuid entered `restored` through an undo or through a deliberate override."
  blind_spots: "The UI was not exercised in a real browser (the repro drives the store and the ledger directly, which is the same code the UI calls). Only one ordering of the toast window was tested (Y loaded after the undo). The case 'Y arrives while the 6 s undo toast is open' gives the same result in the current code, but it matters for the fix (see Resolution)."
  candidate_causes:
    - "code: sessionStore.reincludeInvoice adds to `restored` unconditionally (CONFIRMED root cause)"
    - "code: ledger.ts:305 trusts `restored` without scoping it (contributing, by design: it cannot tell intent apart)"
    - "spec: 02-06-PLAN.md truth (lines 25 and 103) says Volver a incluir 'adds it to restored'. One store action merges two meanings, undoing a manual exclusion and overriding a substitution (upstream contributing cause, implemented literally)"
    - "data: a TipoRelacion-04 invoice for X arrives in a later batch (trigger, not a defect)"
    - "environment: none. The state is in memory only and the result is the same on every run (eliminated)"
  and_gate: "yes. Two conditions must hold at once: (1) `restored` holds X because of a re-include that did not override a substitution, and (2) a TipoRelacion-04 invoice naming X is loaded in the same session (applyBatch only appends, so a later batch is the usual path). Condition 1 is the defect and condition 2 is a normal data trigger. The detection gap in quality.ts (changesAmounts false for 'reincluida') is why nothing alerts; it is not a cause."

## Symptoms

expected: Undo exclusion ('Deshacer exclusion') and 'Volver a incluir' only touch `restored` for entries actually substituted by a TipoRelacion-04 invoice. A normal exclusion that is undone never makes a later substitute double-count the original.
actual: Per 02-REVIEW.md WR-01, undoing or re-including a normal exclusion writes to `restored`, so a later substitute double-counts the original.
errors: None reported
reproduction: UAT Test 10 (.planning/phases/02-dashboard-de-gasto-confiable/02-UAT.md); trace in 02-REVIEW.md WR-01.
started: Discovered during code review, confirmed as fix-now during UAT.

## Eliminated

- hypothesis: "The ledger substitution logic (ledger.ts:301-308) is wrong."
  evidence: "With empty overrides, X is correctly 'sustituida' and counted once (repro CONTROL: 116.00). With `restored`, ledger.ts behaves as specified by D-28/D-42 (ledger.test.ts:312, ledger.anon.test.ts:131). The ledger only fails when its input `restored` is polluted."
  timestamp: 2026-10-16T19:29:00Z

- hypothesis: "Environment or timing dependent (toast timing, React render order)."
  evidence: "The repro is pure store plus pure buildLedger in the node environment, with no React and no timers, and it reproduces every run. The toast only captures the uuid and calls the same store action."
  timestamp: 2026-10-16T19:29:00Z

## Evidence

- timestamp: 2026-10-16T19:22:00Z
  checked: src/stores/sessionStore.ts:117-126
  found: "excludeInvoice adds the uuid to excluded and REMOVES it from restored. reincludeInvoice removes it from excluded and ALWAYS adds it to restored (withUuid). The store holds no ledger and cannot know substitutedBy. The action signature is (uuid: string) => void."
  implication: "A caller that only means 'undo a manual exclusion' still writes the D-28 substitution override."

- timestamp: 2026-10-16T19:23:00Z
  checked: grep of every writer of restored and every caller of reincludeInvoice in src/
  found: "The only writers of `restored` are sessionStore.excludeInvoice (delete), reincludeInvoice (add) and clearAll (reset). reincludeInvoice has three callers: (1) InvoiceTable.tsx:329-331, the toast undo action of exclude(); (2) InvoiceTable.tsx:336-339, reinclude(), wired to RowMenu (lines 127 and 140), where reinclude = entry.exclusion !== null, so both 'manual' and 'sustituida' rows reach it; (3) QualityAccordions.tsx:175-177, the IncidentRow button, shown when type === 'excluidas' || type === 'sustituidas' (line 292)."
  implication: "Legitimate writers: RowMenu on rows with exclusion === 'sustituida', and Calidad 'sustituidas' rows (substitutedBy !== null by construction, ledger.ts:305). Illegitimate writers: the toast undo, RowMenu on rows with exclusion === 'manual', and Calidad 'excluidas' rows, whenever substitutedBy === null at that moment."

- timestamp: 2026-10-16T19:24:00Z
  checked: src/domain/accounting/ledger.ts:301-308
  found: "A manual exclusion in `excluded` wins first ('manual'). Otherwise exclusion is 'sustituida' only when substitutedBy !== null AND !overrides.restored.has(uuid). Nothing checks `restored` against substitutedBy when it is written, and every rebuild reads it."
  implication: "A stale or polluted `restored` entry does nothing while substitutedBy is null, and silently takes effect the moment a substitute is loaded."

- timestamp: 2026-10-16T19:24:30Z
  checked: src/domain/import/applyBatch.ts:27-80; sessionStore.clearAll
  found: "Each batch only appends invoices. Nothing removes a single invoice. clearAll resets excluded and restored together. Within a session, substitutedBy for a uuid can only go from null to non-null."
  implication: "The pollution lasts for the whole session, until a later batch brings the substitute."

- timestamp: 2026-10-16T19:25:00Z
  checked: src/domain/accounting/quality.ts:177-180, 239-244
  found: "substitutionState returns 'reincluida' when original.exclusion === null. changesAmounts for 'sustituciones' is true only when state === 'excluida'. The original X is in neither the 'excluidas' nor the 'sustituidas' list."
  implication: "The double count raises no amount-changing alert (D-04), and X does not appear in either exclusion list. The substitution row reads 'La original se volvió a incluir', although the user never re-included a substituted invoice."

- timestamp: 2026-10-16T19:26:00Z
  checked: existing tests touching restored
  found: "These tests assert the pollution. sessionStore.test.ts:153-165 asserts reincludeInvoice('A') adds A to restored, with no substitution context (it follows the 02-06-PLAN truth). InvoiceTable.test.tsx:548-563 'undoes the exclusion from the toast action' asserts restored.has('U1') === true for a U1 that was never substituted. QualityTab.test.tsx:503-512 asserts restored.has('EXC-1') === true after Volver a incluir on an EXC-1 that was never substituted. sessionStore.test.ts:167-174 and :300-313 chain exclude and reinclude on plain uuids; the clearAll test uses reincludeInvoice('B') to fill restored, and that setup becomes meaningless once a plain uuid no longer writes restored. These tests cover the legitimate cases: InvoiceTable.test.tsx:579-591 (OR substituted, then restored), QualityTab.test.tsx:514-525 (ORIG-1 in sustituidas), QualityTab.test.tsx:383-395 and DashboardTab.test.tsx:940-951 (direct reincludeInvoice('ORIG-1') on a substituted original), ledger.test.ts:312, ledger.anon.test.ts:131. DashboardTab.test.tsx:237-251 calls reincludeInvoice on a plain invoice and asserts only Gasto (it stays valid). No test loads a substitute AFTER an exclude-then-undo or exclude-then-reinclude of a normal invoice, and no e2e test covers exclusion."
  implication: "The fix must invert or update three assertions and adjust the setup of two more tests. It needs new regression tests that run exclude, then undo or reinclude, then a later batch with a TipoRelacion-04 substitute, and check that the original is 'sustituida' and Gasto counts it once."

- timestamp: 2026-10-16T19:26:30Z
  checked: .planning/phases/02-dashboard-de-gasto-confiable/02-06-PLAN.md:25,103 and 02-CONTEXT.md D-28
  found: "The plan truth reads \"'Volver a incluir' removes it from excluded and adds it to restored\", and the code implements it literally. D-28 itself only describes the UI (the menu, the 'Excluida' label, Volver a incluir, the Calidad list). It does not require `restored` for manual exclusions."
  implication: "The root cause starts in the spec: one store action merges two meanings (undo a manual exclusion, override a substitution), and the code implemented it faithfully."

- timestamp: 2026-10-16T19:29:00Z
  checked: Temporary vitest repro tests/__wr01_repro.test.ts (real useSessionStore + buildLedger + qualitySummary, makeInvoice; X = Ingreso 116.00, Y = Ingreso 116.00 with relacionados [{tipoRelacion 04, uuids [X]}]); the file was deleted after the run and git status shows only .planning/debug/
  found: "CONTROL [X,Y] with no history: X exclusion 'sustituida', counted false, Gasto 116.00. BUG path 1: load [X]; excludeInvoice(X); reincludeInvoice(X) (the toast undo). Then restored has X, excluded is empty and Gasto is 116.00. Load [X,Y]: X exclusion null, counted true, substitutedBy Y, Gasto 232.00, substitution state ['reincluida'], amountChanging false, 0 sustituidas rows, 0 excluidas rows. BUG path 2 (Volver a incluir, same action): Gasto 232.00. LEGIT path: load [X,Y]; reincludeInvoice(X) (override), Gasto 232.00; excludeInvoice(X), Gasto 116.00 and restored no longer has X; reincludeInvoice(X) (the undo), Gasto 232.00."
  implication: "Root cause confirmed, and the bug reproduces deterministically. The LEGIT path adds a constraint on the fix: undoing an exclusion of a substituted original that the user had re-included MUST put X back in `restored`. Otherwise the undo does not return to the state before the exclusion, because excludeInvoice already removed X from `restored`. A plain 'undo always passes false' (the first suggestion in 02-REVIEW.md) would break this case."

## Resolution

root_cause: "sessionStore.reincludeInvoice (src/stores/sessionStore.ts:122-126) always adds the uuid to `restored`, the D-28 'user overrode a TipoRelacion-04 substitution' set, even when the call only undoes a plain manual exclusion. The store does not know the ledger, and all three UI callers pass only the uuid: the 'Deshacer exclusión' toast (InvoiceTable.tsx:329-331), the RowMenu 'Volver a incluir' on 'manual' rows (InvoiceTable.tsx:127,140,336-339) and the Calidad 'excluidas' row button (QualityAccordions.tsx:175-177,292). An invoice that was never substituted therefore stays in `restored` for the rest of the session (applyBatch only appends). When a later batch brings a TipoRelacion-04 invoice that names it, ledger.ts:305 (`substitutedBy !== null && !overrides.restored.has(uuid)`) skips the 'sustituida' exclusion and counts both invoices. quality.ts:179/242 labels that 'reincluida' with amountChanging false, so nothing alerts. The cause starts in the spec (02-06-PLAN.md:25,103 merges the two meanings into one action), and three tests lock the behavior in."
fix: (not applied; find_root_cause_only)
verification: "Root cause verified by a deterministic repro: Gasto 116.00 in the control, 232.00 after exclude, undo and a later substitute."
files_changed: []
open_question_for_planner: "Volver a incluir on a row that is BOTH manually excluded and has substitutedBy !== null. How it happens: X is normal, the user excludes it, then Y with TipoRelacion-04 loads. Should it (a) override the substitution too, so it writes `restored` and counts X and Y (the literal reading of the UAT truth, 'actually substituted'), or (b) only remove the manual exclusion, so X becomes 'sustituida' and moves from Excluidas to Sustituidas? CLAUDE.md rule 1 says to ask the user. Recommendation: (a), because the click is an explicit 'count this one' and it matches the UAT truth wording."
