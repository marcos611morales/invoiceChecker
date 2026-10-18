import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { readFixture, withUuid } from "../tests/support/cfdiVariants";
import { ORIGIN, expectNoXmlLeavesTheBrowser, logIn, pickFolder, recordRequests } from "./helpers";

// Production-build check of the Excel export under the real CSP (D-24, D-29, ROADMAP research flag).
// The folder is generated at runtime in the OS temp dir from an anonymized fixture, each copy with a
// distinct synthetic UUID; nothing real is committed or read. 80 invoices of 6 concepts give a
// Conceptos sheet of 480 lines, whose uncompressed part is far above the 160,000 bytes at which
// fflate compresses in a Worker created from a blob: URL (research Pitfall 1). Without
// `worker-src 'self' blob:` the export would hang on exactly this file.

const COPIES = 80;
const LINES_PER_COPY = 6;

let syntheticRoot = "";
let syntheticFolder = "";

/** A UUID shape that is never a real identifier, distinct per copy. */
function syntheticUuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

test.beforeAll(() => {
  syntheticRoot = mkdtempSync(join(tmpdir(), "invoicechecker-e2e-export-"));
  syntheticFolder = join(syntheticRoot, "2025");
  mkdirSync(syntheticFolder);

  const base = readFixture("ingreso-multiconcepto-descuento.xml");
  expect((base.match(/<cfdi:Concepto\s/g) ?? []).length).toBe(LINES_PER_COPY);
  for (let n = 1; n <= COPIES; n += 1) {
    writeFileSync(join(syntheticFolder, `factura-${n}.xml`), withUuid(base, syntheticUuid(n)));
  }
});

test.afterAll(() => {
  if (syntheticRoot !== "") {
    rmSync(syntheticRoot, { recursive: true, force: true });
  }
});

test("exportar un libro grande en la build de producción: descarga un xlsx, sin violar la CSP y sin enviar facturas", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    consoleMessages.push(message.text());
  });
  page.on("pageerror", (error) => {
    consoleMessages.push(error.message);
  });
  const requests = recordRequests(page);

  await logIn(page);
  await pickFolder(page, syntheticFolder);
  await page.getByRole("tab", { name: "Dashboard" }).click();
  await expect(page.getByTestId("kpi-gasto")).toBeVisible();

  const button = page.getByRole("button", { name: "Exportar a Excel" });
  await expect(button).toBeVisible();
  // The default timeout of the page is 60 s here, so a hung export fails the wait instead of the run.
  page.setDefaultTimeout(60_000);
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);

  // D-19: gastos-<range>-<mode>.xlsx, here one month with the default Con IVA mode.
  expect(download.suggestedFilename()).toMatch(
    /^gastos-\d{4}-\d{2}_\d{4}-\d{2}-con-iva\.xlsx$/,
  );
  const path = await download.path();
  expect(statSync(path).size).toBeGreaterThan(20_000);
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");

  await expect(page.getByText(/^Excel descargado: gastos-/)).toBeVisible();
  await expect(button).not.toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Exportando…")).toBeHidden();

  // D-24: the worker was allowed to start, so the console holds no CSP violation.
  expect(consoleMessages.filter((text) => text.includes("Content Security Policy"))).toEqual([]);

  // The CSP of the page itself allows the blob: worker and nothing wider for scripts or requests.
  const home = await page.request.get("/");
  const csp = home.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("worker-src 'self' blob:");
  expect(csp).toContain("connect-src 'self'");

  // The export is local: no invoice data left the browser, and no request went anywhere else.
  // A blob: URL of this origin (the compression Worker's script, the download link) is a read from
  // the page's own memory, not a network request, so it is set aside before the same-origin check.
  const ownBlobPrefix = `blob:${ORIGIN}/`;
  expectNoXmlLeavesTheBrowser(requests.filter((request) => !request.url.startsWith(ownBlobPrefix)));
});
