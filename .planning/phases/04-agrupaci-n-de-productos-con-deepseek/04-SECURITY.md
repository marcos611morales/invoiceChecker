---
phase: "04"
slug: "agrupaci-n-de-productos-con-deepseek"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-25"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser to /api/llm/group | Untrusted request body and cookie cross here | — |
| route to api.deepseek.com | The key leaves the server only in the Authorization header; the answer is untrusted | — |
| invoice XML text to the prompt and the UI | Descriptions and supplier names are vendor-controlled text | — |
| npm registry to the project | No package is installed in this phase (D-29) | — |
| docs to the people who deploy and use the app | The README must not promise more privacy than the app gives | — |
| localStorage to the settings store | Stored products and marks are untrusted on every load | — |
| server logs | Vercel logs are readable by whoever administers the project | — |
| build output to browsers | .next/static and prerendered pages are public | — |
| pending queue to the settings | A card's members (from the model plus the browser id map) become stored data only on accept | — |
| .env.local to the test process | The real key is read only on the user's machine for an opt-in run | — |
| test process to api.deepseek.com | Golden descriptions and synthetic labels leave the machine | — |
| user edits to the stored settings | Names typed by the user and member moves become persisted data | — |
| stored products to every amount view | A wrong resolver order would misreport spend in the Dashboard and the Excel | — |
| stored product names to the Facturas table and Categorías tab | Names typed by the user or proposed by the model are shown in triggers, tooltips and accessible names | — |
| uploaded settings file to the store | Any JSON file from disk is untrusted | — |
| localStorage to the queue store | The stored queue is untrusted on every load | — |
| late network responses to the stores | A response can arrive after cancel, after «Quitar todas» or after a reload | — |
| user-typed names to the stored queue and settings | Free text becomes persisted data | — |
| user product names to DeepSeek | Names the user accepted or typed now leave the browser as context | — |
| model output of one batch to the request of the next | DeepSeek's own names travel back to DeepSeek inside the same run | — |
| user actions to the stored queue | Merges and splits rewrite persisted cards | — |
| bulk user actions to the stored settings | Many products can be created in one action | — |
| browser to /api/llm/categorize | Untrusted body and cookie | — |
| model-proposed category names to the settings | A new category is created only on the user's accept | — |
| vendor text to the request bodies | Descriptions and names may carry identifiers typed by the issuer | — |
| e2e browser to the local production server | Mocked LLM routes must stand in for every real call | — |

---

## Threat Register

Built from the `<threat_model>` blocks of 04-01 to 04-21 (52 unique threats; T-04-SC is declared in every plan). Verified against HEAD by gsd-security-auditor on 2026-10-25, ASVS L1, block_on high.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Elevation of privilege | POST /api/llm/group without a session | high | mitigate | the unchanged fail-closed proxy (src/proxy.ts) answers 401 to every /api/* request without a valid session before routing; Plan 04-02, the next wave, adds `requireSession(request)` as the first statement of POST with …. Evidence: src/proxy.ts:7-17 (matcher :28); scripts/smoke-auth.mjs:111-125 | closed |
| T-04-02 | Information disclosure | DEEPSEEK_API_KEY reaching the browser | high | mitigate | read only in server code (the route module here, the server-only module from Plan 04-02); no public-prefixed variable; responses carry our codes only, never upstream text; the slice test asserts the stubbed key is abs…. Evidence: deepseek.ts:92 behind import "server-only"; tests/llmSecrets.guard.test.ts:45-62 | closed |
| T-04-03 | Information disclosure | RFC, UUID, amounts, dates or folios in the payload | high | mitigate | z.strictObject request schema at every level; builder emits only id, description, supplier; the slice test serializes the body and asserts none of the invoice identifiers or amounts appear. Evidence: contract.ts:96-115 strictObject; candidates.ts:200-215; candidates.test.ts:224 | closed |
| T-04-04 | Tampering | Prompt injection through descriptions | medium | mitigate | instructions only in the system message, vendor text as JSON data in the user message, 200-character cut, output limited to ids and names validated by zod, unknown ids dropped through the browser id map, human review …. Evidence: deepseek.ts:123-151; contract.ts:101,125; reconcile.ts:85-90; group/route.test.ts:294 | closed |
| T-04-05 | Denial of service | Oversized or repeated requests draining the balance | medium | mitigate | 262144-byte cap before parsing, 250 items per body, max_tokens 8192, 80 s attempt timeout, one run slot in the UI. Evidence: llmRoute.ts:59-74; contract.ts:14,22; deepseek.ts:34,41-43; llmRunStore.ts:328 | closed |
| T-04-06 | Tampering | Stored XSS through model names or descriptions | high | mitigate | React text only; acceptance grep forbids raw-HTML injection in src/features/products. Evidence: no raw-HTML sink in src/features/products; ProductList.test.tsx:281 | closed |
| T-04-07 | Information disclosure | Upstream status or body forwarded (a DeepSeek 401 looking like a lost session) | medium | mitigate | fixed mapping to our codes with 502/503/504; upstream 401 becomes 502 upstream_auth, shown as the key message in the slice test. Evidence: deepseek.ts:279; llmRoute.ts:7-29; group/route.test.ts:401-424 | closed |
| T-04-08 | Information disclosure | Key or upstream body echoed in a response, header or log | high | mitigate | taxonomy-only responses, one content-free console.info line, sentinel route tests over every upstream branch. Evidence: llmRoute.ts:32-37; deepseek.ts:264-268,474-485; route sentinel tests | closed |
| T-04-09 | Information disclosure | Key or variable name inlined in the client bundle or prerendered HTML | high | mitigate | server-only modules, ESLint boundary, check-bundle-secrets with a DeepSeek sentinel over .next/static plus .html and .rsc. Evidence: llmSecrets.guard.test.ts:64-74; eslint.config.mjs:34-51; scripts/check-bundle-secrets.mjs | closed |
| T-04-10 | Denial of service | Retry storms or a function killed by the platform before answering | medium | mitigate | at most 2 attempts, 170 s deadline, 20 s minimum budget, attempt timeout capped by the remaining time. Evidence: deepseek.ts:32-40,447-463; group/route.test.ts:575 | closed |
| T-04-11 | Elevation of privilege | Real DeepSeek calls from automated tests or smoke runs | medium | mitigate | smoke starts the server with an empty key; vitest stubs fetch; no test reads .env.local. Evidence: smoke-auth.mjs:89; playwright.config.ts:34; fetch stubs in tests | closed |
| T-04-12 | Information disclosure | Descriptions or supplier names in server logs | medium | mitigate | the log line carries counts and codes only; route test spies on console. Evidence: deepseek.ts:474-485; console spies in both route tests | closed |
| T-04-13 | Tampering | Stored version-3 products (duplicates, dangling categories, one member in two products) | high | mitigate | settingsDataSchema with LIMITS caps and productIntegrityIssues; total resolvePersisted falls back to defaults; tests for every breach. Evidence: schema.ts:114-161,186-199; migrate.ts:35-37; settings.test.ts:428-490 | closed |
| T-04-14 | Denial of service | A throwing migration silently resetting all settings (Pitfall 5) | medium | mitigate | safeParse only in the version-2 branch; tests for malformed version-2 values. Evidence: migrate.ts:28-34; settings.test.ts:330 | closed |
| T-04-15 | Tampering | RFC or description text such as "__proto__" used as a key | medium | mitigate | lists of entries and Map/Set lookups only; round-trip test. Evidence: Map/Set lookups only; settingsStore.test.ts:183,277 | closed |
| T-04-16 | Information disclosure | Key printed by the live test or committed in a file | high | mitigate | the test prints meta only; .env* stays git-ignored; the key is never written to a tracked file. Evidence: tests/llm.live.test.ts:86-134; .gitignore:2; no sk- key in history | closed |
| T-04-17 | Information disclosure | Real supplier names or RFCs in the golden fixture | medium | mitigate | synthetic supplier labels; tests/fixtures.guard.test.ts and the RFC-shape grep in the acceptance criteria. Evidence: synthetic golden suppliers; tests/fixtures.guard.test.ts | closed |
| T-04-18 | Tampering | A rename, move or undo producing a settings value the schema rejects on the next load (silent loss) | high | mitigate | reducers refuse anything that breaks productIntegrityIssues or LIMITS and return the same object; domain tests per reducer. Evidence: products.ts:167-186,221-244,349-416; products.test.ts | closed |
| T-04-19 | Tampering | Stored XSS through product names or descriptions in the table, tooltips or toasts | high | mitigate | React text only; acceptance grep forbids raw-HTML injection. Evidence: React text only; ProductList.test.tsx:281 | closed |
| T-04-20 | Tampering | A product pointing at a deleted category making the stored settings unreadable (silent reset) | high | mitigate | deleteCategory moves products to the target or to null in the same set; restore puts them back; domain tests. Evidence: categories.ts:186-226; settingsStore.ts:265-275 | closed |
| T-04-21 | Tampering | Formula-looking product names reaching the Excel | medium | mitigate | the origin column holds fixed copy; product names are not new cells; existing typed text cells stay. Evidence: export/sheets/conceptos.ts:51-62,128 | closed |
| T-04-22 | Tampering | Hostile version-2 file (broken integrity, huge arrays) | high | mitigate | size gate before reading, backupFile2Schema with LIMITS caps and both integrity rule sets, nothing applied before confirmation. Evidence: BackupControls.tsx:97,104,172-176; backup.ts:178-223 | closed |
| T-04-23 | Denial of service | Larger files now accepted (4 MB) | low | accept | the file is parsed once in the browser of the user who chose it; caps bound the arrays; no server involved. Evidence: backup.ts:46-48; types.ts:113; no network in backup path | closed |
| T-04-24 | Information disclosure | Pending suggestions or invoice data in the file | medium | mitigate | explicit field picks; round-trip test asserts only the six fields; the queue lives under its own key (Plan 04-11). Evidence: backup.ts:55-90; backup.test.ts:126 | closed |
| T-04-25 | Tampering | Hostile or corrupt stored queue | medium | mitigate | envelope-only getItem, pendingQueueSchema with caps and integrity, total resolvePendingQueue, empty queue plus a notice. Evidence: safeStorage.ts:9-53; suggestionsStore.ts:128-131,282-287; suggestionsStore.test.ts:336 | closed |
| T-04-26 | Information disclosure | Invoice data or RFCs leaving through the queue | high | mitigate | the schema has no amount, UUID, folio or date field; RFC stays local (D-30); the queue is not in the backup and never sent; storage test checks the stored JSON. Evidence: strict member schema; suggestionsStore.test.ts:448 | closed |
| T-04-27 | Denial of service | A throwing migrate silently clearing the queue | low | mitigate | safeParse only; tests feed broken values. Evidence: safeParse only; suggestionsStore.test.ts:336 | closed |
| T-04-28 | Tampering | Late write after cancel or clear (Pitfall 6) | medium | mitigate | abort plus generation check before apply; idempotent enqueue per member; tests for both paths. Evidence: llmRunStore.ts:331-349,373; llmRunStore.test.ts:220,265 | closed |
| T-04-29 | Denial of service | A broken key or empty balance burning through every batch | medium | mitigate | non-retryable codes stop the run after one batch; the browser never retries on its own. Evidence: llmRunStore.ts:111-114,374-388 | closed |
| T-04-30 | Tampering | A mark or restore that breaks the stored schemas (silent reset on reload) | medium | mitigate | reducers keep both schemas valid; limit refusal; tests. Evidence: products.ts:434-451; ReviewQueue.test.tsx:800 | closed |
| T-04-31 | Tampering | Stored XSS through edited names or descriptions | high | mitigate | React text only; no raw-HTML injection (acceptance grep of Plan 04-01 keeps applying to src/features/products). Evidence: no raw-HTML sink in src/features/products | closed |
| T-04-32 | Information disclosure | Product names sent without being listed | medium | mitigate | names come from the body the dialog renders; the context line and group show them; only accepted names are sent (D-33). Evidence: ProductsTab.tsx:140-147,306-313; SendDialog.tsx:43-50 | closed |
| T-04-33 | Tampering | A model reference to an unknown or stale product applying members silently | medium | mitigate | unknown e is dropped on the server; «Agregar a» still needs «Aceptar»; addMembersToProduct refuses gone and taken. Evidence: deepseek.ts:334-338; ReviewQueue.tsx:338-341; products.ts:526-540 | closed |
| T-04-34 | Tampering | A merge or split producing a queue the schema rejects on reload (silent loss of pending work) | medium | mitigate | reducers keep pendingQueueSchema valid; tests assert every result parses. Evidence: suggestions.test.ts:1311 | closed |
| T-04-35 | Tampering | A bulk accept that breaks a limit or a uniqueness rule and makes the stored settings unreadable | medium | mitigate | acceptMany runs each card through the single-card reducers against the running result; refusals stay in the queue. Evidence: queueView.ts:174-205; queueView.test.ts:221-352 | closed |
| T-04-36 | Elevation of privilege | Unauthenticated POST /api/llm/categorize | high | mitigate | requireSession first in the handler plus the proxy; route test (smoke probe in Plan 04-20). Evidence: llmRoute.ts:50 (requireSession first); categorize/route.test.ts:122-143 | closed |
| T-04-37 | Information disclosure | RFC or invoice data in the categorize body | high | mitigate | z.strictObject schemas; builder sends names, member descriptions and category names only; candidates test serializes the body. Evidence: contract.ts:154-186; candidates.ts:378-405 | closed |
| T-04-38 | Tampering | Model-invented category codes or names applied without review | medium | mitigate | codes validated against the sent list (Plan 04-18), new names normalized and capped at 60, creation only on accept through addCategory rules and the 200 limit; rows whose target got a category are pruned, never applied. Evidence: deepseek.ts:388-403; CategorySuggestionsTable.tsx:108-143,250-254 | closed |
| T-04-39 | Information disclosure | Key or upstream text through the second route | high | mitigate | same shared call with our codes only and the content-free log line; route test asserts the key is absent; the bundle scan already covers the module. Evidence: shared failure/readJsonBody; categorize/route.test.ts:505-577 | closed |
| T-04-40 | Information disclosure | RFC, UUID, e-mail or long numbers embedded in descriptions or names | medium | mitigate | isSensitive guard on every outgoing text in both builders, withheld list in the dialog, anonymized payload test. Evidence: sensitive.ts:12-33; contract.ts:86-93 safeText; candidates.anon.test.ts; route sensitive-text tests | closed |
| T-04-41 | Repudiation | The dialog showing something different from what is sent | medium | mitigate | the dialog renders the bodies; the equality test serializes and compares both flows. Evidence: SendDialog.tsx renders batch.body; SendDialog.test.tsx:83,103,170 | closed |
| T-04-42 | Information disclosure | A missed mock sending real descriptions to DeepSeek from an automated test | medium | mitigate | the web server runs with an empty key (500 server_not_configured before any upstream call) and the routes are mocked at the network layer. Evidence: playwright.config.ts:28-35; e2e/helpers.ts:190-197; products.spec.ts:563-571 | closed |
| T-04-43 | Information disclosure | Screenshots with real invoice data committed | low | mitigate | the e2e uses the synthetic folder and seeded synthetic settings; test-results/ is not committed. Evidence: synthetic temp folders; test-results/ git-ignored | closed |
| T-04-44 | Elevation of privilege | /api/llm/group reachable without a session if the proxy matcher drifts or is bypassed | high | mitigate | `await requireSession(request)` is the first statement of POST; route.test.ts covers no cookie and a tampered cookie with no upstream call. Evidence: llmRoute.ts:50; group/route.test.ts:97-124; llmRoute.test.ts:70 | closed |
| T-04-45 | Information disclosure | Key read or echoed outside the server-only module | high | mitigate | the key is read only in src/lib/server/deepseek.ts behind `import "server-only"`; the route has no environment access (acceptance grep); route.test.ts asserts no response body contains the stubbed key. Evidence: deepseek.ts:90-101 only reader; llmSecrets.guard.test.ts:52-62 | closed |
| T-04-46 | Tampering | An answer with omitted, repeated or invented ids filling the queue with partial or foreign members | medium | mitigate | coverageOf on the server (incomplete_response) and again in the browser before enqueue; tests on both sides. Evidence: deepseek.ts:343-349; llmRunStore.ts:198-202,276-280 | closed |
| T-04-47 | Repudiation | README or footer promising that nothing leaves the browser | low | mitigate | README rewritten to the UI-SPEC OQ1 sentence, no country or retention claim (judgment prohibition). Evidence: README.md:3; es.ts:23-24 | closed |
| T-04-48 | Tampering | A model-proposed card applied to the settings without review, or with members already in another product | high | mitigate | settings change only from the «Aceptar» handler; acceptProduct refuses taken, marked or repeated members, duplicate and reserved names and the limits, and returns no change on refusal; ReviewQueue tests. Evidence: ReviewQueue.tsx:341,374,574; llmRunStore.ts:226-227,310 | closed |
| T-04-49 | Tampering | Stored XSS through product names in the concept Select, its Tooltip or its accessible name | medium | mitigate | React text and attribute values only, no raw HTML; names already capped at 60 characters by the version-3 schema. Evidence: React text only; InvoiceTable.test.tsx:1820; schema.ts:43 | closed |
| T-04-50 | Information disclosure | Names added to later batches without being disclosed | low | mitigate | the dialog sentence of D-33 for every multi-batch run; the names are DeepSeek's own output, never user data; capped at 400 per request. Evidence: SendDialog.tsx:200-205; llmRunStore.ts:167 | closed |
| T-04-51 | Tampering | A late batch writing into cards of an earlier run or into a card the user already handled | medium | mitigate | pending targets point only at cards of the same run; resolution at apply time against the current queue and settings; idempotent appendMembers; tests for pending, accepted and rejected. Evidence: llmRunStore.ts:192; llmRunStore.test.ts:720-781 | closed |
| T-04-SC | Tampering | npm installs | high | mitigate | nothing is installed: plain fetch + zod (D-29); acceptance checks package.json has no SDK entry. Evidence: no SDK in package.json/pnpm-lock.yaml; only dep change: next/eslint-config-next 16.4.0→16.4.2 (c5324b3) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-23 | Settings files up to 4 MB are accepted: the file is parsed once in the browser of the user who chose it, LIMITS caps bound every array, and no server or network call is involved (re-confirmed by the audit: backup.ts:46-48, types.ts:113). | User (plan-time disposition, re-confirmed in /gsd-secure-phase) | 2026-10-25 |

*Accepted risks do not resurface in future audit runs.*

---

## Audit Notes

- **T-04-09:** the bundle scan was not re-run on HEAD (it runs `next build`). The existing `.next` output (built 2026-10-22) holds no secret variable names but predates the 2026-10-25 source changes. Run `node scripts/check-bundle-secrets.mjs` before shipping.
- **T-04-11:** only `tests/llm.live.test.ts` reads `.env.local`, in `beforeAll`, and only when `LLM_LIVE=1`.
- **Post-review code:** WR-03 (exact content type), WR-04 (server-side sensitive-text check in both request schemas) and IN-01 (shared `src/lib/server/llmRoute.ts`) keep the session-first order on both routes; `llmRoute.test.ts` covers it.
- **Outside the register (informational):** IN-06 added a development-only browser `console.error` (`llmRunStore.ts:402`), not a server log. The two raw-HTML sinks in the app (`layout.tsx:33`, `components/ui/chart.tsx:94`) render constants only.
- **Unregistered flags:** none; every SUMMARY's Threat Flags section maps only to registered IDs.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-25 | 52 | 52 | 0 | gsd-security-auditor (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-25
