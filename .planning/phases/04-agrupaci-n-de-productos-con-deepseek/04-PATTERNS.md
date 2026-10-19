# Phase 4: Agrupación de productos con DeepSeek - Pattern Map

**Mapped:** 2026-10-19
**Files analyzed:** 27 new/modified
**Analogs found:** 25 / 27 (all analog paths verified git-tracked via `git ls-files`)

Locked: D-29 (plain `fetch` + zod, no `openai`), D-30 (pending store keeps supplier RFC locally), D-31 (`LIMITS.backupBytes` = 4194304). Project rules: strict TS, no `any`, no `!`, no unchecked `as`, validate external data with zod. ESLint boundary: `src/domain/**` cannot import react/next/zustand/`@/lib`/`@/stores`/`@/features`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/lib/server/requireSession.ts` (new) | middleware/guard | request-response | `src/proxy.ts` + `src/lib/server/session.ts` | exact |
| `src/lib/server/deepseek.ts` (new, `server-only`) | service | request-response | `src/lib/server/session.ts` (server-only + zod env) | role-match |
| `src/app/api/llm/group/route.ts` (new) | route | request-response | `src/app/api/auth/login/route.ts` | exact |
| `src/app/api/llm/categorize/route.ts` (new) | route | request-response | same | exact |
| `src/domain/llm/contract.ts` (new) | model/schema | transform | `src/domain/settings/schema.ts` | role-match |
| `src/domain/llm/candidates.ts` (new) | utility | transform | `src/domain/settings/assignments.ts` + `normalize.ts` | role-match |
| `src/domain/llm/reconcile.ts` (new) | utility | transform | `src/domain/settings/categories.ts` (name rules) | role-match |
| `src/domain/llm/suggestions.ts` (new) | reducers | CRUD | `src/domain/settings/assignments.ts` | exact |
| `src/domain/settings/products.ts` (new) | reducers | CRUD | `src/domain/settings/assignments.ts` | exact |
| `src/domain/settings/types.ts` (mod) | model | - | itself | exact |
| `src/domain/settings/schema.ts` (mod) | model | - | itself | exact |
| `src/domain/settings/migrate.ts` (mod) | utility | transform | itself (v1 branch) | exact |
| `src/domain/settings/backup.ts` (mod) | utility | file-I/O | itself (v1 pieces) | exact |
| `src/domain/settings/resolver.ts` (mod) | utility | transform | itself | exact |
| `src/domain/settings/categories.ts` (mod: delete/restore/usage) | utility | CRUD | itself | exact |
| `src/stores/settingsStore.ts` (mod) | store | CRUD | itself | exact |
| `src/stores/safeStorage.ts` (new, extracted) | utility | file-I/O | `settingsStore.ts` lines 128-162 | exact |
| `src/stores/suggestionsStore.ts` (new) | store | CRUD persisted | `src/stores/settingsStore.ts` | exact |
| `src/stores/llmRunStore.ts` (new) | store | event-driven | `src/stores/sessionStore.ts` | role-match |
| `src/lib/client/llmClient.ts` (new) | service | request-response | `src/lib/client/logout.ts`, `src/features/upload/useImport.ts` | role-match |
| `src/stores/sessionStore.ts` + `src/features/shell/AppShell.tsx` (mod: `productos` tab) | store/component | - | themselves | exact |
| `src/features/products/ProductsTab.tsx` (new) | component | request-response | `src/features/categories/CategoriesTab.tsx` | exact |
| `src/features/products/RunProgress.tsx` (new) | component | event-driven | `src/features/upload/ProcessingIndicator.tsx` | exact |
| `src/features/products/ReviewQueue.tsx`, `ProductList.tsx`, `CategorySuggestionsTable.tsx` (new) | component | CRUD | `CategoryList.tsx`, `SupplierCategoryTable.tsx` | role-match |
| `src/features/products/PrivacyDialog.tsx` (new) | component | request-response | `src/features/categories/DeleteCategoryDialog.tsx` | role-match |
| `src/features/export/sheets/conceptos.ts`, `src/features/invoices/{columns.ts,ConceptCategorySelect.tsx}`, `src/lib/copy/es.ts` (mod: "producto" origin) | mixed | - | themselves | exact |
| `scripts/check-bundle-secrets.mjs`, `scripts/smoke-auth.mjs` (mod) | config/script | batch | themselves | exact |
| Tests: `route.test.ts`, `requireSession.test.ts`, domain tests | test | - | `src/lib/server/session.test.ts` | role-match |

## Pattern Assignments

### `src/lib/server/requireSession.ts` (guard, request-response)
**Analog:** `src/proxy.ts` lines 12-17 and `src/lib/server/session.ts` lines 1-6, 49-67. Must return the identical 401 body.
```typescript
// proxy.ts:12-16
if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) { return NextResponse.next(); }
if (pathname.startsWith("/api/")) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```
Shape: `import "server-only"`; `export async function requireSession(request: NextRequest): Promise<NextResponse | null>` returning the 401 response or `null`. Use `request.cookies` (not `cookies()`), per RESEARCH. `verifySessionToken` already fails closed on missing env.

### `src/app/api/llm/{group,categorize}/route.ts` (route, request-response)
**Analog:** `src/app/api/auth/login/route.ts` (full file, 38 lines).
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
const Body = z.object({ password: z.string().min(1).max(512) }).strict();   // use z.strictObject for LLM-03
export async function POST(request: Request) {
  const env = readAuthEnv();
  if (!env) return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
```
Handler order (RESEARCH "Route handler order"): `requireSession` first, content-type, size cap, strict parse, env check (DeepSeek key via zod `safeParse` of `process.env`, like `readAuthEnv` in session.ts:9-22), call deepseek module, generic error codes only (never upstream body/status). Add `export const maxDuration = 180;` (RESEARCH "Recommendations for D-28 and timeouts"; D-28 delegates this to the research, superseding CLAUDE.md's 60) and POST only. Use `NextRequest` so `request.cookies` is available.

### `src/lib/server/deepseek.ts` (service, request-response)
**Analog:** `src/lib/server/session.ts` (server-only + zod-validated env returning `null` = not configured, fail closed).
```typescript
import "server-only";
const EnvSchema = z.object({ APP_PASSWORD: z.string().min(1), SESSION_SECRET: z.string().min(32) });
export function readAuthEnv(): AuthEnv | null { const parsed = EnvSchema.safeParse({...}); return parsed.success ? parsed.data : null; }
```
Mirror as `readDeepseekEnv()` (`DEEPSEEK_API_KEY`, optional `DEEPSEEK_MODEL` default `deepseek-flash`). Body is a plain object literal with `thinking: { type: "disabled" }` (no `@ts-expect-error` needed with fetch), `response_format: { type: "json_object" }`, `temperature: 0`. Parse the completion with a zod schema. For the HTTP call itself there is no analog (see No Analog).

### `src/domain/llm/contract.ts` (schemas)
**Analog:** `src/domain/settings/schema.ts` lines 10-31 (zod object schemas, `LIMITS` caps, `z.ZodType<T>` annotation, `superRefine` + `IntegrityIssue`).
```typescript
export const settingsDataSchema: z.ZodType<SettingsData> = z.object({...}).superRefine((data, ctx) => {
  for (const issue of settingsIntegrityIssues(data)) ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
});
```
Use `z.strictObject` for request schemas (D-05, LLM-03); export `LLM_LIMITS`. Must live in domain, so it cannot import `@/lib`.

### `src/domain/settings/products.ts` and `src/domain/llm/suggestions.ts` (pure reducers)
**Analog:** `src/domain/settings/assignments.ts`. Pattern: result unions, never mutate, refuse changes that would fail the schema on next load, return same object on no-op.
```typescript
export type SupplierResult = | { ok: true; next: SettingsData } | { ok: false; reason: "limit" | "unknown-category" };
export function setSupplierCategory(settings: SettingsData, rfc: string, name: string, categoryId: string | null): SupplierResult {
  ...
  if (!exists && settings.supplierCategories.length >= LIMITS.supplierCategories) return { ok: false, reason: "limit" };
```
Keys: `import { normalizeDescription, ruleMapKey } from "./normalize"` (normalize.ts:24-40; member key = rfc + `normalizeDescription`). Name uniqueness: reuse `comparableName` (schema.ts:34, currently private; export it). Undo support: removal returns the removed entry (`removeConceptRule` -> `previous`), restore returns same object when refused.

### `src/domain/settings/types.ts` / `schema.ts` / `migrate.ts` / `backup.ts` (v2 -> v3 contract)
**types.ts:** add `Product`, `ProductMember`, `UngroupedConcept`; bump `SETTINGS_VERSION = 3` (line 49); extend `SettingsData` (41-46) and `defaultSettings()` (77-84) with `products: []`, `ungroupedConcepts: []`; `LIMITS.backupBytes: 4194304` (line 57, D-31) plus new product/member caps. Keep "lists of entries, never records keyed by RFC" (header comment).
**schema.ts:** add `productSchema`; extend integrity (55-86) with unique ids, `comparableName` uniqueness, reserved name, `categoryId` null or existing, a `(rfc,key)` in at most one product (use `${rfc}${KEY_SEPARATOR}${key}` like line 79), ungrouped disjoint from members. Signature ripple: `settingsIntegrityIssues` is called by frozen `backupFile1Schema.superRefine` (backup.ts:108) with no new fields, so split into base + product checks or make new fields optional. Freeze a copy of the current four-field schema as `settingsDataSchemaV2`.
**migrate.ts** (full pattern, lines 17-31): add a `version === 2` branch before the final parse, total with `safeParse`:
```typescript
if (version === 1) {
  const legacy = legacySettingsSchema.safeParse(raw);
  if (!legacy.success) return { data: defaultSettings(), status: "unreadable" };
  return { data: {...}, status: "migrated" };
}
```
-> v2: parse frozen v2 schema, return `{ ...v2, products: [], ungroupedConcepts: [] }`, `"migrated"`.
**backup.ts:** header (lines 1-18) states the rule: add `backupFile2Schema` + `fromBackupFile2` next to v1, never edit `backupFile1Schema`/`fromBackupFile1`; `BACKUP_FILE_VERSION = 2` (line 25); branch in `parseBackupText` after the `newer` check (154) on `header.data.version`; extend `buildBackupText` (42-63) with products/ungroupedConcepts (explicit field picks, no spread); extend `BackupSummary` (30-34) with products/members. Add golden `tests/fixtures/settings/ajustes-archivo-2.json`; v1 golden must keep loading.

### `src/domain/settings/resolver.ts` ("producto" level, CAT-04)
Current code lines 15, 26-57. Add `"producto"` to `CategorySource` between regla and proveedor; build once `byMember: Map<ruleMapKey(rfc,key), {id,name,categoryId}>`; insert after the `byRule.has` check:
```typescript
const ruleKey = ruleMapKey(rfc, normalizeDescription(descripcion));
if (byRule.has(ruleKey)) return { category: byRule.get(ruleKey) ?? SIN_CATEGORIA, source: "regla" };
// NEW: member = byMember.get(ruleKey); if (member && member.categoryId !== null && existing.has(member.categoryId)) return {category, source:"producto", product:{id,name}}
const supplier = bySupplier.get(rfc);
```
Return type gains `product: { id; name } | null`. Exhaustive-switch ripple: `originText` in `src/features/export/sheets/conceptos.ts:51-60` (add `producto`; copy at `es.export.origin`), `ConceptCategorySelect.tsx:139-146` (copy the `source === "proveedor"` branch with product name, truncated), `columns.ts` `ConceptRow.source` + product name (lines ~131/146).

### `src/stores/settingsStore.ts` (mod)
Every place copying the four fields grows two: `dataOf` (114-117), `partialize` (269-274), `replaceAll` (254-261), `deleteCategory`/`restoreCategory` sets (219-236), `setSupplierCategory` inline destructure (180). New actions follow the established shape: call the pure reducer on `dataOf(get())`, `set` only the touched fields on ok, return removed entry for Deshacer.
```typescript
setConceptRule: (rfc, description, categoryId) => {
  const result = setConceptRule(dataOf(get()), rfc, description, categoryId);
  if (result.ok) set({ conceptRules: result.next.conceptRules });
  return result;
},
```
Persist options (263-283) unchanged except version; `migrate`/`merge` delegate to total `resolvePersisted`. Update header comment contract (version 3).

### `src/stores/safeStorage.ts` (extracted) and `src/stores/suggestionsStore.ts`
**Analog:** `settingsStore.ts` lines 51-54 (`envelopeSchema`), 128-162 (`safeStorage`), 263-283 (persist options). Extract adapter as-is (it reports through `useStorageStatusStore`; never calls `set` on its own store - Pitfall 6).
```typescript
persist<SettingsState, [], [], unknown>(creator, {
  name: STORAGE_KEY, version, skipHydration: true, storage: safeStorage, partialize, migrate, merge });
```
New store: own key `invoicechecker:suggestions`, own version, state validated with a zod schema; migrate/merge total (`safeParse`, fall back to empty queue). Per D-30 the entries keep supplier RFC locally (never montos/UUID). Not part of the backup. Rehydrate from an effect in the app shell (look at where `useSettingsStore.persist.rehydrate()` is called in `AppShell.tsx`). Idempotent enqueue per `(rfc,key)`.

### `src/stores/llmRunStore.ts` (memory-only run state)
**Analog:** `src/stores/sessionStore.ts` (non-persisted; `ImportProgress` union at lines 15-18, `AppTab` at 20). Separate union e.g. `{phase:"idle"} | {phase:"running"; batch; total; failed} ...`, AbortController held in store, generation guard so late responses after cancel/clear are dropped (Pitfall 6). Do not reuse `sessionStore.progress`.

### `src/lib/client/llmClient.ts`
**Analog:** `src/lib/client/logout.ts` / `src/features/upload/useImport.ts` (plain `fetch`, no zustand import). Map 401 to the same shape used for `/login` redirect; use `AbortSignal.any([cancel, AbortSignal.timeout(ms)])`; validate the response with the shared zod schema from `domain/llm/contract.ts` before typing.

### `src/features/products/ProductsTab.tsx` (+ AppShell `productos` tab)
**Analog:** `src/features/categories/CategoriesTab.tsx` (full file): `"use client"`, `useId` for `aria-labelledby`, `flex flex-col gap-8`, title row `text-xl leading-[1.2] font-semibold`, `text-xs text-muted-foreground` intro, non-dismissible `Alert` on `writeFailed`.
```tsx
<h2 className="text-xl leading-[1.2] font-semibold">{es.categories.heading}</h2>
{writeFailed ? (<Alert><Info aria-hidden="true" .../><AlertDescription className="text-foreground">{es.categories.writeFailedAlert}</AlertDescription></Alert>) : null}
```
Tab wiring (three places + copy): `AppTab` union (`sessionStore.ts:20`), `isAppTab` (`AppShell.tsx:48-55`), `TABS` (`AppShell.tsx:64-69`), `es.tabs` (`es.ts:146-152`, add `productos`). Items source for D-03: `useLedger()` (`src/features/dashboard/useLedger.ts`), unfiltered. Update `AppShell.test.tsx`.

### `src/features/products/RunProgress.tsx`
**Analog:** `src/features/upload/ProcessingIndicator.tsx` lines 27-38 (Card + `aria-live` text + `Progress`), reading `llmRunStore` instead of the session store; add Cancelar button.
```tsx
<Card className="gap-3 px-4">
  <p aria-live="polite" aria-atomic="true" className="text-sm tabular-nums">{processingText(done, total)}</p>
  <Progress aria-label={es.empty.progressLabel} value={done} min={0} max={total} />
</Card>
```

### `PrivacyDialog.tsx`, `ReviewQueue.tsx`, `ProductList.tsx`, `CategorySuggestionsTable.tsx`
Analogs: `DeleteCategoryDialog.tsx` (dialog + Deshacer toast flow), `CategoryList.tsx`, `SupplierCategoryTable.tsx` and `useCategorySettings.ts` (hook that wraps settings store actions with memo deps; its deps must grow with the new fields). Dialog must render from the same payload object that is sent (Pattern 4). Not read in detail; the planner should open them before writing tasks.

### Tests
**Analog:** `src/lib/server/session.test.ts` (`vi.stubEnv`, `afterEach(vi.unstubAllEnvs)`, no route-handler test exists yet so the first sets the pattern; `server-only` is mocked in `vitest.setup.ts`; stub upstream with `vi.stubGlobal("fetch", ...)`).
```typescript
function stubAuthEnv(password = PASSWORD, secret = SECRET) { vi.stubEnv("APP_PASSWORD", password); vi.stubEnv("SESSION_SECRET", secret); }
```
Naming: `*.test.ts` colocated; `*.anon.test.ts` / `*.realdata.test.ts` convention.

### `scripts/check-bundle-secrets.mjs` / `scripts/smoke-auth.mjs`
Extend `needles` (line 11) with a `DEEPSEEK_API_KEY` sentinel set in the build `env` (line 20-26), same fail pattern. `smoke-auth.mjs:93` already probes `/api/llm/group`; add `/api/llm/categorize`.

## Shared Patterns

### Fail-closed server env
**Source:** `src/lib/server/session.ts:9-22`. Apply to deepseek env and route handlers: `null` env -> 500 `server_not_configured`.

### Error body shape
**Source:** `login/route.ts`, `proxy.ts:16`: `NextResponse.json({ error: "<code>" }, { status })`. Codes are ours, never upstream's.

### Total migrate/merge (never throw)
**Source:** `migrate.ts` header + `settingsStore.ts:168-172, 275-282`. Apply to both persisted stores.

### Pure reducer result unions + Deshacer
**Source:** `assignments.ts`. Apply to products, suggestions, delete-category ripple (`categories.ts` `deleteCategory`/`DeleteSnapshot`/`restoreCategory`/`categoryUsage` must also move/count products and the snapshot must carry them; `DeleteCategoryDialog` copy gains product count).

### Copy
All UI strings in `src/lib/copy/es.ts` (`es.*`) and helpers in `messages.ts`. The footer `es.global.privacyLine` (es.ts:23) becomes false and must change (RESEARCH Pitfall 9).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| fetch call with retry/deadline inside `deepseek.ts` | service | request-response (external API) | No outbound HTTP exists server-side; use RESEARCH "DeepSeek call: shape of the server module" (lines ~523-563) |
| `src/domain/llm/candidates.ts` batching/coverage invariant | utility | batch | Domain logic is new; use RESEARCH "Coverage invariant" example (~500-523); style from `assignments.ts` |

## Metadata

**Analog search scope:** `src/lib/server`, `src/app/api`, `src/domain/settings`, `src/stores`, `src/features/{categories,upload,shell,invoices,export,dashboard}`, `scripts`, `src/proxy.ts`
**Files read:** 14; tracked-source gate: all paths come from `git ls-files` output
**Pattern extraction date:** 2026-10-19
