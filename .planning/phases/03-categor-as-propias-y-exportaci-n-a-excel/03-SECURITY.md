---
phase: "03"
slug: "categor-as-propias-y-exportaci-n-a-excel"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-19"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| localStorage → settings store | Stored settings are untrusted on every load (tampering, corruption, other versions) | Categories, supplier assignments, concept rules, IVA mode |
| XML text → settings model and UI | RFCs, supplier names and descriptions from dropped files become Map keys, stored text, labels and aria-labels | Untrusted text from third parties |
| User-typed category names → storage and UI | Free text persisted and rendered in lists, dialogs, toasts | User text |
| User-chosen settings file → settings store | Any uploaded file: size, encoding, JSON shape, references | Settings (no invoice data) |
| Settings → file on disk | The downloaded settings file may be shared between browsers/people | Settings only |
| Session filter → accounting layer and workbook | A selection may hold ids of categories deleted or replaced | In-memory UI state |
| Ledger amounts, dates and XML text → spreadsheet cells | Values leave big.js/string world for a file Excel interprets | RFC, UUID, amounts, descriptions (by design) |
| Browser page → blob: Worker | CSP lets same-origin blob: URLs start workers (fflate compression) | Workbook bytes |
| npm registry → project | write-excel-file 4.1.1 and transitive fflate | Third-party code |
| Real sample → test output / repository | Local real-data tests and e2e folders | Personal invoice data |
| Browser → network | The finished phase must send no invoice or settings data | None allowed |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | Stored settings (getItem/migrate/merge) | high | mitigate | `resolvePersisted` (src/domain/settings/migrate) with `settingsDataSchema` + LIMITS (src/domain/settings/schema.ts:95-97); defaults on failure | closed |
| T-03-02 | Denial of service | Throwing migrate/merge (Pitfall 5) | medium | mitigate | migrate and merge delegate to total `resolveAndReport` (src/stores/settingsStore.ts) | closed |
| T-03-03 | Tampering | "__proto__" as object key | medium | mitigate | lists of entries + Map lookups (resolver.ts:36,44); `__proto__` round-trip tests | closed |
| T-03-04 | Information disclosure | Invoice data in browser storage | high | mitigate | `partialize` returns exactly the four SettingsData fields (settingsStore.ts); key-set test settingsStore.test.ts:356; only settingsStore uses zustand persist | closed |
| T-03-05 | Tampering | Stored XSS via category names | high | mitigate | React text only; no `dangerouslySetInnerHTML`/`innerHTML` in src/features or src/domain (grep clean) | closed |
| T-03-06 | Tampering | Stored XSS via category name in list/dialog/toast | high | mitigate | React text only; `categoryName` max via LIMITS (schema.ts:17); raw-HTML grep clean | closed |
| T-03-07 | Tampering | Accidental assignment loss on delete | medium | mitigate | confirmation dialog, explicit target, undo from DeleteSnapshot (UAT test 2 passed) | closed |
| T-03-08 | Denial of service | 201st category / duplicate name | medium | mitigate | add/rename refuse at limit, duplicates and reserved name (src/domain/settings/categories.ts) | closed |
| T-03-09 | Tampering | Stored XSS via concept description | high | mitigate | React text and attribute values only; raw-HTML grep clean | closed |
| T-03-10 | Tampering | "__proto__" as rule lookup key | medium | mitigate | `ruleMapKey` composite key in a Map (resolver.ts:36,44); stored rules are a list | closed |
| T-03-11 | Denial of service | 20,001st concept rule | medium | mitigate | `setConceptRule` refuses at `LIMITS.conceptRules`; schema cap schema.ts:97 | closed |
| T-03-12 | Repudiation | Silent loss when storage fails | medium | mitigate | storageStatusStore flags, read-failure toast, write-failure Alert | closed |
| T-03-13 | Denial of service | Persist adapter re-entry loop (Pitfall 6) | medium | mitigate | adapter/migrate/merge touch only the non-persisted status store; setItem-count test | closed |
| T-03-14 | Tampering | Stored XSS via saved supplier name | high | mitigate | React text only (TruncatedText); raw-HTML grep clean | closed |
| T-03-15 | Tampering | Malicious/corrupted settings file | high | mitigate | header + newer-version check, frozen v1 schema with limits and integrity, explicit confirm (src/domain/settings/backup.ts) | closed |
| T-03-16 | Denial of service | Oversized settings file | medium | mitigate | `checkBackupSize(file.size)` before `file.text()` (BackupControls.tsx:88; backup.ts:37); 1 MB limit | closed |
| T-03-17 | Tampering | Accidental replacement of settings | medium | mitigate | AlertDialog with file summary, default focus on «Conservar los míos» | closed |
| T-03-18 | Information disclosure | Invoice data in settings file / network | high | mitigate | `buildBackupText` writes only the four settings fields; no fetch/XHR/sendBeacon in src/features/categories or src/features/export (grep clean) | closed |
| T-03-19 | Denial of service | Division by zero in KPIs / pct | medium | mitigate | `kpis`/`categoryBreakdown` guard every division; tests | closed |
| T-03-20 | Tampering | Stale category id hiding every invoice | low | mitigate | `selectView` restricts selection to known ids + SIN_CATEGORIA | closed |
| T-03-21 | Denial of service | Variation over zero/negative previous month | medium | mitigate | `deltaFraction` returns null when previous ≤ 0 (src/domain/accounting/aggregate.ts:98-101) | closed |
| T-03-22 | Tampering | Stored XSS in dashboard row buttons/aria-labels | high | mitigate | React text/attributes only; raw-HTML grep clean | closed |
| T-03-23 | Elevation of privilege | CSP loosening | medium | mitigate | only `worker-src 'self' blob:` added; `connect-src 'self'` and `script-src` unchanged (next.config.ts:14-19); tests/nextConfig.test.ts | closed |
| T-03-24 | Denial of service | `toBlob()` never settling | medium | mitigate | 30 s race `EXPORT_TIMEOUT_MS` (src/features/export/writeWorkbook.ts:16,34), cleared in finally | closed |
| T-03-25 | Tampering | NaN/Infinity/invalid Date in the XML | medium | mitigate | `Number.isFinite` guard → null cell (src/features/export/toLibrarySheet.ts:29) | closed |
| T-03-26 | Information disclosure | Workbook contents (RFC, UUID, amounts) | low | accept | see Accepted Risks AR-03-01 | closed |
| T-03-27 | Tampering | Formula injection via description/name | high | mitigate | every string is `textCell` → String cell, format @ (cellModel.ts:45); tests with "=SUMA(A1)" / "=1+1" | closed |
| T-03-28 | Tampering | Dates shifted / identifiers mangled | medium | mitigate | `Date.UTC` only (cellModel.ts:116); RFC/UUID/Folio/ClaveProdServ as text cells | closed |
| T-03-29 | Repudiation | Excel totals disagree with Dashboard | medium | mitigate | Monto from the same `selectView` entries, rounding lines; reconciliation test; UAT test 5 passed | closed |
| T-03-30 | Information disclosure | Real-data tests printing personal data | medium | mitigate | assertions print only booleans; `skipIf` without sample; `Facturas/` gitignored | closed |
| T-03-31 | Information disclosure | Parámetros records selected suppliers/categories | low | accept | see Accepted Risks AR-03-02 | closed |
| T-03-32 | Information disclosure | Late-phase regression writing to storage/network | high | mitigate | closing greps clean; e2e asserts storage keys and request bodies (03-17) | closed |
| T-03-33 | Tampering | Stored XSS via supplier/category name in Select | high | mitigate | React text/attributes only; raw-HTML grep clean | closed |
| T-03-34 | Denial of service | 5,001st assignment / dangling category id | medium | mitigate | `setSupplierCategory` returns "limit"/"unknown-category" (src/domain/settings/assignments.ts:41,45) | closed |
| T-03-35 | Tampering | Stored XSS via toast/caption | high | mitigate | sonner string + TruncatedText render text; raw-HTML grep clean | closed |
| T-03-36 | Repudiation | Undo not restoring exact rule | medium | mitigate | `restoreConceptRule` puts back exact `previous` (settingsStore.ts restoreConceptRule); round-trip tests | closed |
| T-03-37 | Repudiation | Partial amounts read as invoice totals | medium | mitigate | «de {total} total» lines and note while filter active; UAT test 4 passed | closed |
| T-03-38 | Tampering | Deleted category id left in session filter | low | mitigate | `dropCategoryFromFilter` on confirm (DeleteCategoryDialog.tsx:155) | closed |
| T-03-39 | Tampering | Dates shifted / float drift in workbook model | medium | mitigate | `Date.UTC` only; money as big.js strings; three-time-zone tests | closed |
| T-03-40 | Information disclosure | Real invoices copied into e2e folder | medium | mitigate | folder generated at runtime from anonymized fixture, removed in afterAll | closed |
| T-03-41 | Tampering | Formula injection in summary sheets / Parámetros | high | mitigate | names as `textCell`; "=HYPERLINK(1)" tests (resumenCategoria/resumenProveedor/parametros tests) | closed |
| T-03-42 | Repudiation | Parámetros lists a raw category id not applied | medium | mitigate | ExportButton reads `view.selected` (ExportButton.tsx:54); FilterBar uses effective `selectedCategories`; UAT test 8 passed | closed |
| T-03-43 | Tampering | Stale ids after settings restore | low | mitigate | `pruneCategoryFilter` right after replaceAll (BackupControls.tsx:171; sessionStore.ts:175) | closed |
| T-03-44 | Information disclosure | Category selection written to storage | low | mitigate | sessionStore has no persist middleware (only settingsStore imports zustand/middleware) | closed |
| T-03-45 | Repudiation | Unexplained cent differences in workbook | low | mitigate | rounding note row in Parámetros (sheets/parametros.ts:54; es.ts:417); D-20 amended | closed |
| T-03-46 | Tampering | Note cell evaluated as formula | low | mitigate | constant from es.ts written with `textCell` | closed |
| T-03-47 | Tampering | writeWorkbook tests not asserting formula/NaN guard | low | mitigate | capturing-loader assertions in writeWorkbook.test.ts ("=1+1" String + @, NaN → null) | closed |
| T-03-48 | Tampering | Test-only zip tooling in dependencies | low | mitigate | no zip library in package.json; fflate transitive only | closed |
| T-03-SC | Tampering | npm installs (write-excel-file 4.1.1) | high | mitigate | human-approved, exact pin `"write-excel-file": "4.1.1"` (package.json:38), lockfile committed, fflate transitive only; plans 03-17..03-20 install nothing | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-26 | The workbook carries RFC, UUID and amounts by design; it is generated and saved locally at the user's request and nothing is sent (no request/storage APIs in src/features/export) | Plan 03-13 threat model (planning-time disposition) | 2026-10-19 |
| AR-03-02 | T-03-31 | Recording the selected suppliers and categories is the documented purpose of the Parámetros sheet (XLS-01); the file stays on the user's machine | Plan 03-15 threat model (planning-time disposition) | 2026-10-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-19 | 49 | 49 | 0 | /gsd-secure-phase (orchestrator, ASVS L1 grep-depth; auditor skipped per short-circuit rule) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-19
