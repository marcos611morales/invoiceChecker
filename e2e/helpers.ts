import { expect, type Page, type Route } from "@playwright/test";
import {
  categorizeRequestSchema,
  groupRequestSchema,
  type CategorizeRequest,
  type CategorizeResponse,
  type GroupRequest,
  type GroupResponse,
} from "../src/domain/llm/contract";
import type { PendingQueue } from "../src/domain/llm/suggestions";
import { SETTINGS_VERSION, type SettingsData } from "../src/domain/settings/types";

// Helpers shared by the Playwright specs (see playwright.config.ts): the login, the folder pick,
// the recording of every request the page makes, the mocks of the LLM routes and the seeding of
// the browser storage.

export const ORIGIN = "http://localhost:3210";
export const ORIGIN_PREFIX = `${ORIGIN}/`;

export function requirePassword(): string {
  const password = process.env.E2E_APP_PASSWORD;
  if (password === undefined || password === "") {
    throw new Error("E2E_APP_PASSWORD is not set; run through playwright.config.ts");
  }
  return password;
}

export interface RecordedRequest {
  method: string;
  url: string;
  body: string | null;
}

/** Records every request (method, URL, body) the page makes from now on. */
export function recordRequests(page: Page): RecordedRequest[] {
  const recorded: RecordedRequest[] = [];
  page.on("request", (request) => {
    recorded.push({
      method: request.method(),
      url: request.url(),
      body: request.postData(),
    });
  });
  return recorded;
}

export async function logIn(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  // The field has a "Mostrar contraseña" toggle, so getByLabel would match two elements.
  await page.getByRole("textbox", { name: "Contraseña" }).fill(requirePassword());
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Seleccionar carpeta" })).toBeVisible();
}

export async function pickFolder(page: Page, folder: string): Promise<void> {
  // The drop screen is server-rendered: a folder set before React hydrates the input is lost.
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"][webkitdirectory]').setInputFiles(folder);
  // The loaded screen opens on Dashboard; the import report lives in its own tab.
  const importTab = page.getByRole("tab", { name: "Importación" });
  await expect(importTab).toBeVisible({ timeout: 60_000 });
  await importTab.click();
  await expect(page.getByText("Reporte de importación")).toBeVisible();
}

/** The two LLM routes: the only same-origin URLs other than the login that may carry a body. */
const LLM_URLS = [`${ORIGIN}/api/llm/group`, `${ORIGIN}/api/llm/categorize`];

export interface NoLeakOptions {
  /**
   * The spec mocks the LLM routes and sends through them on purpose: their POST bodies are allowed
   * (still without XML and still same-origin). The default allows none, as in the earlier specs.
   */
  allowLlmBodies?: boolean;
}

/** No request carries XML, bodies exist only for the login POST, and every URL is same-origin. */
export function expectNoXmlLeavesTheBrowser(
  requests: RecordedRequest[],
  options: NoLeakOptions = {},
): void {
  const withXml = requests.filter(
    (r) => r.body !== null && (r.body.includes("<?xml") || r.body.includes("Comprobante")),
  );
  expect(withXml).toHaveLength(0);

  const allowed = (r: RecordedRequest): boolean =>
    r.method === "POST" &&
    (r.url === `${ORIGIN}/api/auth/login` ||
      (options.allowLlmBodies === true && LLM_URLS.includes(r.url)));
  const withBody = requests.filter((r) => r.body !== null && r.body !== "");
  expect(withBody.every(allowed)).toBe(true);

  const foreign = requests.filter((r) => !r.url.startsWith(ORIGIN_PREFIX));
  expect(foreign.map((r) => r.url)).toEqual([]);
}

// ---------------------------------------------------------------------------------------------
// Mocks of the LLM routes. The web server runs with an empty DEEPSEEK_API_KEY (playwright.config.ts),
// so even a request that slips past these mocks ends in `server_not_configured`, never at DeepSeek.

/** The `meta` every mocked answer carries (the same shape the real routes return). */
const MOCK_META: GroupResponse["meta"] = {
  attempts: 1,
  durationMs: 5,
  finishReason: "stop",
  promptTokens: null,
  completionTokens: null,
  reasoningTokens: null,
};

export interface LlmMockOptions {
  /** Builds the groups of one grouping answer from the request the browser sent. */
  group?: (request: GroupRequest) => GroupResponse["groups"];
  /** Builds the answers of one «Sugerir categorías» answer from the request the browser sent. */
  categorize?: (request: CategorizeRequest) => CategorizeResponse["answers"];
  /** Extra wait before each answer, after the hold (if any) is released. */
  delayMs?: number;
}

export interface LlmMock {
  /** Raw request bodies of the calls to /api/llm/group, in arrival order. */
  groupCalls: string[];
  /** Raw request bodies of the calls to /api/llm/categorize, in arrival order. */
  categorizeCalls: string[];
  /** From now on every answer waits until `release()`; the requests still arrive and are recorded. */
  hold: () => void;
  /** Lets the held answers go (an answer for a request the page already aborted is dropped). */
  release: () => void;
  /** How many requests the mock has finished handling (answered or dropped). */
  settled: () => number;
}

function parseJson(text: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Installs the network-layer mocks of both LLM routes. Each recorded body is checked against the
 * strict request contract before the answer is built; a body that breaks it gets a 400, so the
 * spec fails on the missing card instead of on a mock detail.
 */
export async function mockLlm(page: Page, options: LlmMockOptions = {}): Promise<LlmMock> {
  const groupCalls: string[] = [];
  const categorizeCalls: string[] = [];
  let gate: Promise<void> | null = null;
  let open: (() => void) | null = null;
  let settled = 0;

  const handle = async (
    route: Route,
    calls: string[],
    answer: (body: unknown) => unknown,
  ): Promise<void> => {
    const text = route.request().postData() ?? "";
    calls.push(text);
    const waiting = gate;
    if (waiting !== null) await waiting;
    if (options.delayMs !== undefined && options.delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, options.delayMs));
    }
    try {
      const data = answer(parseJson(text));
      if (data === null) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "bad_request", retryable: false }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      }
    } catch {
      // The page aborted the request (cancel, reload) before the answer went out: nothing to send.
    } finally {
      settled += 1;
    }
  };

  await page.route("**/api/llm/group", async (route) => {
    await handle(route, groupCalls, (json) => {
      const parsed = groupRequestSchema.safeParse(json);
      if (!parsed.success || options.group === undefined) return null;
      return { groups: options.group(parsed.data), meta: MOCK_META };
    });
  });
  await page.route("**/api/llm/categorize", async (route) => {
    await handle(route, categorizeCalls, (json) => {
      const parsed = categorizeRequestSchema.safeParse(json);
      if (!parsed.success || options.categorize === undefined) return null;
      return { answers: options.categorize(parsed.data), meta: MOCK_META };
    });
  });

  return {
    groupCalls,
    categorizeCalls,
    hold: () => {
      if (gate !== null) return;
      gate = new Promise<void>((resolve) => {
        open = resolve;
      });
    },
    release: () => {
      open?.();
      gate = null;
      open = null;
    },
    settled: () => settled,
  };
}

// ---------------------------------------------------------------------------------------------
// Browser storage seeding.

const SETTINGS_KEY = "invoicechecker:settings";
const SUGGESTIONS_KEY = "invoicechecker:suggestions";
/** Stored version of the pending queue (SUGGESTIONS_VERSION in src/domain/llm/suggestions.ts). */
const SUGGESTIONS_STORED_VERSION = 1;

export interface StorageSeed {
  settings?: SettingsData;
  queue?: PendingQueue;
}

/**
 * Writes the stored settings (version 3) and the stored pending queue (version 1) before the page
 * loads, as a browser that already used Phase 4 holds them. A key that is already there is left
 * alone, so a reload inside the same test keeps what the app has written since.
 */
export async function seedStorage(page: Page, seed: StorageSeed): Promise<void> {
  const entries: [string, string][] = [];
  if (seed.settings !== undefined) {
    entries.push([SETTINGS_KEY, JSON.stringify({ state: seed.settings, version: SETTINGS_VERSION })]);
  }
  if (seed.queue !== undefined) {
    entries.push([
      SUGGESTIONS_KEY,
      JSON.stringify({ state: seed.queue, version: SUGGESTIONS_STORED_VERSION }),
    ]);
  }
  await page.addInitScript((pairs: [string, string][]) => {
    for (const [key, value] of pairs) {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
    }
  }, entries);
}
