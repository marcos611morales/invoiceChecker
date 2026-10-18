import { expect, type Page } from "@playwright/test";

// Helpers shared by the Playwright specs (see playwright.config.ts): the login, the folder pick and
// the recording of every request the page makes.

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
  await page.locator('input[type="file"][webkitdirectory]').setInputFiles(folder);
  // The loaded screen opens on Dashboard; the import report lives in its own tab.
  const importTab = page.getByRole("tab", { name: "Importación" });
  await expect(importTab).toBeVisible({ timeout: 60_000 });
  await importTab.click();
  await expect(page.getByText("Reporte de importación")).toBeVisible();
}

/** No request carries XML, bodies exist only for the login POST, and every URL is same-origin. */
export function expectNoXmlLeavesTheBrowser(requests: RecordedRequest[]): void {
  const withXml = requests.filter(
    (r) => r.body !== null && (r.body.includes("<?xml") || r.body.includes("Comprobante")),
  );
  expect(withXml).toHaveLength(0);

  const withBody = requests.filter((r) => r.body !== null && r.body !== "");
  expect(withBody.every((r) => r.method === "POST" && r.url === `${ORIGIN}/api/auth/login`)).toBe(
    true,
  );

  const foreign = requests.filter((r) => !r.url.startsWith(ORIGIN_PREFIX));
  expect(foreign.map((r) => r.url)).toEqual([]);
}
