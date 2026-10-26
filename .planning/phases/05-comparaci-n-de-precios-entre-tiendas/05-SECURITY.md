---
phase: "05"
slug: "comparaci-n-de-precios-entre-tiendas"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-26"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| CFDI XML text to the price domain | Descriptions, ClaveUnidad, ClaveProdServ, Cantidad and amounts are untrusted vendor text | — |
| Domain results to the DOM | Product, store and description text is rendered in the tab | — |
| localStorage to the settings store | Stored corrections and overrides are untrusted on every load | — |
| Uploaded settings file to the app | A file version 3 is untrusted input from disk | — |
| CFDI XML text to the price domain | ClaveUnidad, Cantidad, descriptions and amounts are untrusted vendor text | — |
| Vendor and user text to the DOM | Product names (user/LLM-given), store names and the search text are rendered | — |
| CFDI description text to the size reader | Descriptions are untrusted vendor text of any length | — |
| Vendor text to the DOM | Descriptions, store names and folios from the XML are rendered in the panel | — |
| Vendor text to the chart | Store names, folios and descriptions reach the legend and tooltips | — |
| Chart config to inline CSS | The shadcn chart writes its config into a style block | — |
| Store actions to persisted settings | Override changes are written into localStorage | — |
| CFDI ClaveProdServ text to the classifier | Keys are untrusted XML strings | — |
| User action to persisted settings | Menu choices write overrides into localStorage through the Plan 05-08 actions | — |
| Product and supplier text to the DOM | Names appear in rows, menu labels, toasts and live announcements | — |
| Store actions to persisted settings | Corrections are written to localStorage | — |
| Persisted corrections to the price domain | Corrections are read back on every load and applied to purchases | — |
| User input in the editor to persisted settings | Typed pieces, content and unit are written to localStorage | — |
| Vendor text to the DOM | Descriptions and supplier names appear in the content table, aria-labels, toasts and announcements | — |
| Browser to network | The check that nothing leaves the origin during the Precios flow | — |
| Test data to the repository | Synthetic invoices and screenshots must not carry real data | — |

---

## Threat Register

Built from the `<threat_model>` blocks of 05-01 to 05-12 (T-05-SC appears in every plan and is listed once). Severity from the plan registers; all are `mitigate`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-02 | Information disclosure | Precios tab sending invoice data off the browser | high | mitigate | No network call in src/domain/prices or src/features/prices (negative grep in acceptance); everything is computed from the in-memory session | closed |
| T-05-03 | Tampering | Vendor text rendered as HTML in the table | low | mitigate | React text only; no raw HTML injection (negative grep added in Plan 05-04) | closed |
| T-05-04 | Tampering | Float rounding or credit notes skewing prices and savings (integrity of figures) | medium | mitigate | big.js built from strings with strict mode, rounding only at display; kind ingreso filter proven by the credit-note case of PreciosTab.test.tsx (Plan 05-03 adds the unit-level purchase tests) | closed |
| T-05-SC | Tampering | npm installs | high | mitigate | Nothing is installed: RESEARCH Package Legitimacy Audit lists no new package | closed |
| T-05-05 | Tampering | Stored version-4 corrections and overrides (duplicates, huge numbers, wrong units, oversized lists) | high | mitigate | settingsDataSchema with LIMITS caps, bounded decimal text checked by contentAmountIssue, integer packs 1..999, unit enum and priceIntegrityIssues; total resolvePersisted falls back to defaults; a test per breach | closed |
| T-05-06 | Denial of service | A throwing migration silently resetting all settings (Pitfall 5) | medium | mitigate | safeParse only in the version-3 branch; tests with malformed version-3 values | closed |
| T-05-07 | Tampering | Hostile settings file version 3 (huge arrays, exponent numbers, dangling references) | high | mitigate | Existing checkBackupSize before reading, backupFile3Schema with the same caps and rules, whole-file refusal on any failure; frozen version-1 and version-2 schemas untouched | closed |
| T-05-08 | Information disclosure | Settings file or storage carrying invoice data | medium | mitigate | buildBackupText picks fields one by one; the new lists hold no amount, price, date, folio or UUID (prohibition test asserts the serialized text of a value built from invoices contains none of them) | closed |
| T-05-09 | Tampering | RFC or product id text such as "__proto__" used as a key | medium | mitigate | Lists of entries and Set lookups only; round-trip test | closed |
| T-05-01 | Tampering | units.ts lookup and the per-store and per-member groupings keyed by XML text ("__proto__") | medium | mitigate | Module-scope Map for the unit table (built in Plan 05-01) and Map/Set keyed by RFC or ruleMapKey for groupings; units.test.ts proves "__proto__" is unknown and leaves Object.prototype untouched | closed |
| T-05-27 | Tampering | A not-normalized or other-family purchase reaching a compared price, a cheapest store or a saving (integrity of figures) | medium | mitigate | compareProduct leaves every not-normalized purchase out of min, median, last, count and saving; compare.test.ts pins each reason code and the exclusion | closed |
| T-05-10 | Tampering | Product and store names and the echoed search text in the table and no-match sentence | low | mitigate | React text only; negative grep for raw HTML injection in src/features/prices | closed |
| T-05-11 | Information disclosure | RFC shown in the Precios table | low | mitigate | Cells show supplier names only (UI-SPEC: RFC never appears in the Precios tab); tests assert the synthetic RFC is absent from the rendered table | closed |
| T-05-12 | Denial of service | Regex evaluation on a hostile or very long description (ReDoS) | medium | mitigate | 300-character cut before matching, bounded quantifiers and no nested repetition; a 5,000-character input test with a time bound | closed |
| T-05-13 | Tampering | Wrong-magnitude readings skewing prices (thousands dot, pack text, size next to a count) | medium | mitigate | Thousands-dot rule for g/mL, ambiguity rules that fall back to «sin tamaño», 1,000 and 10,000 bounds; contract table and real-sample bound test | closed |
| T-05-14 | Information disclosure | Real sample data leaking into the repository through fixtures or assertions | medium | mitigate | Synthetic fixture with public test RFCs checked by tests/fixtures.guard.test.ts; the real-data test asserts counts only | closed |
| T-05-15 | Tampering | Descriptions, folios and store names in the panel and purchases list | low | mitigate | React text only (the Plan 05-04 negative grep covers src/features/prices); TruncatedText renders the full text as text in its tooltip | closed |
| T-05-16 | Information disclosure | RFC or UUID shown in the purchases list | low | mitigate | The list shows supplier name and folio only, never RFC or UUID; a test asserts the synthetic RFC and UUID are absent | closed |
| T-05-17 | Tampering | Chart config built from store names (CSS injection into the style block) | medium | mitigate | Static ChartConfig keys tienda1..tienda6 and otras with fixed colors; a test asserts the keys and that no store name appears in the config | closed |
| T-05-18 | Tampering | Store names and folios in the legend and tooltip | low | mitigate | React text only; the tooltip type guard drops unexpected payloads instead of casting | closed |
| T-05-19 | Tampering | Dangling override after a product deletion making the stored value unreadable or misapplied | high | mitigate | deleteProduct drops the override in the same write and every product-removing store action sets products and priceOverrides together; the read-time rule chosen in Plan 05-02 is the second layer; tests prove the stored value still validates after each action | closed |
| T-05-20 | Tampering | Override and default maps keyed by product id or ClaveProdServ text ("__proto__") | medium | mitigate | Map lookups and lists of entries only; classifyClave reads string prefixes, never a dynamic property | closed |
| T-05-21 | Denial of service | Browser refusing storage writes | low | mitigate | Existing never-throwing safeStorage adapter; the mark applies in memory and the write-failure Alert is shown while writeFailed holds | closed |
| T-05-28 | Tampering | Product names in menu aria-labels, toasts and live announcements | low | mitigate | React text only (the Plan 05-04 negative grep for raw HTML injection covers src/features/prices); names are cut to 60 or 40 characters as plain text | closed |
| T-05-23 | Denial of service | Unbounded growth of the correction list | low | mitigate | Cap 2,000 with a "limit" refusal; replacing an existing member always works | closed |
| T-05-24 | Information disclosure | Invoice data saved with a correction | medium | mitigate | The reducer writes exactly seven fields picked one by one (no amount, price, date, folio or UUID); a test checks the stored entry's keys | closed |
| T-05-29 | Tampering | Invalid correction values (fractional or huge packs, exponent amounts, unknown units) reaching storage, or a correction applied to KGM/LTR lines or to another RFC's member | medium | mitigate | setContentCorrection validates with the stored rules (integer packs 1..999, contentAmountIssue, unit enum) and returns "invalid"; resolveContent applies a correction only to piece units, keyed by ruleMapKey(rfc, key); Big built from validated strings only; tests for each case | closed |
| T-05-22 | Tampering | Editor input (huge numbers, exponents, negative or fractional pieces, unknown units) reaching storage | medium | mitigate | The editor validates with contentAmountIssue, integer pieces 1..999 and the unit enum before calling the store, and setContentCorrection (Plan 05-10) refuses the same input again; Big built from validated strings only | closed |
| T-05-30 | Tampering | Descriptions and supplier names in the content table, the pencil aria-label, the toast and the announcement | low | mitigate | React text only (the Plan 05-04 negative grep for raw HTML injection covers src/features/prices); names cut to 60 or 40 characters as plain text | closed |
| T-05-25 | Information disclosure | Invoice data leaving the browser or landing in storage during the Precios flow | high | mitigate | Request recording with expectNoXmlLeavesTheBrowser, an explicit no-/api/llm assertion, and a scan of the stored settings value for the synthetic folios, UUIDs, dates and totals | closed |
| T-05-26 | Information disclosure | Real data entering the repository through e2e fixtures or screenshots | low | mitigate | Synthetic builder with fake RFCs and names, generated in the OS temp dir at runtime; screenshots under test-results/ (not committed); tests/fixtures.guard.test.ts runs in the verify command | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**L1 evidence (2026-10-26, on main after the 05-12 merge):** no change to package.json or pnpm-lock.yaml since the phase base f11249f (T-05-SC); no fetch, XMLHttpRequest, sendBeacon or /api/ use in src/domain/prices or src/features/prices, and no dangerouslySetInnerHTML (T-05-02, -03, -10, -15, -18, -28, -30); settings v4 read through safeParse, priceIntegrityIssues and pruneDanglingOverrides in schema.ts, migrate.ts and backup.ts (T-05-05, -06, -07, -08, -09, -19); contentCorrections and priceOverrides capped at 2,000 and corrections rebuilt from the seven contract fields (T-05-22, -23, -24); sizeReader cuts descriptions at 300 characters with linear patterns (T-05-12); e2e/prices.spec.ts asserts no off-origin request, no /api/llm call and no invoice data in localStorage or sessionStorage (T-05-25, -26). Every plan SUMMARY reports Threat Flags: None, and the post-merge gate passed (lint, typecheck, 3,579 tests, next build).

---

## Accepted Risks Log

No accepted risks.

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-26 | 31 | 31 | 0 | /gsd-secure-phase (orchestrator, L1 grep depth; auditor skipped: register authored at plan time, ASVS 1, threats_open 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-26
