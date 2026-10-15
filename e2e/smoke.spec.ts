import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { readFixture, withUuid } from "../tests/support/cfdiVariants";

// Local Chrome smoke against a production build (see playwright.config.ts).
// The synthetic folder is generated at runtime in the OS temp dir from the
// fixtures; nothing real is committed. E2E_FACTURAS_DIR points at a real sample
// and is only used on the machine that owns it.

const ORIGIN = "http://localhost:3210";
const ORIGIN_PREFIX = `${ORIGIN}/`;

let syntheticRoot = "";
let syntheticFolder = "";

function requirePassword(): string {
  const password = process.env.E2E_APP_PASSWORD;
  if (password === undefined || password === "") {
    throw new Error("E2E_APP_PASSWORD is not set; run through playwright.config.ts");
  }
  return password;
}

interface RecordedRequest {
  method: string;
  url: string;
  body: string | null;
}

/** Records every request (method, URL, body) the page makes from now on. */
function recordRequests(page: Page): RecordedRequest[] {
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

/** Accepts every dialog (used where the beforeunload prompt is not under test). */
function acceptDialogs(page: Page): void {
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
}

async function logIn(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  // The field has a "Mostrar contraseña" toggle, so getByLabel would match two elements.
  await page.getByRole("textbox", { name: "Contraseña" }).fill(requirePassword());
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Seleccionar carpeta" })).toBeVisible();
}

async function pickFolder(page: Page, folder: string): Promise<void> {
  await page.locator('input[type="file"][webkitdirectory]').setInputFiles(folder);
  // The loaded screen opens on Dashboard; the import report lives in its own tab.
  const importTab = page.getByRole("tab", { name: "Importación" });
  await expect(importTab).toBeVisible({ timeout: 60_000 });
  await importTab.click();
  await expect(page.getByText("Reporte de importación")).toBeVisible();
}

/** No request carries XML, bodies exist only for the login POST, and every URL is same-origin. */
function expectNoXmlLeavesTheBrowser(requests: RecordedRequest[]): void {
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

test.beforeAll(() => {
  syntheticRoot = mkdtempSync(join(tmpdir(), "invoicechecker-e2e-"));
  syntheticFolder = join(syntheticRoot, "2025");
  mkdirSync(syntheticFolder);

  const ingreso = readFixture("ingreso-bom-decl.xml");
  const uuidMatch = /\sUUID="([^"]+)"/.exec(ingreso);
  const uuid = uuidMatch?.[1];
  if (uuid === undefined) {
    throw new Error("e2e: UUID not found in the ingreso fixture");
  }

  const xmlFiles: Record<string, string> = {
    "ingreso-bom-decl.xml": ingreso,
    "ingreso-multiconcepto-descuento.xml": readFixture("ingreso-multiconcepto-descuento.xml"),
    "egreso-relacionado.xml": readFixture("egreso-relacionado.xml"),
    "pago-pago20.xml": readFixture("pago-pago20.xml"),
    "cfdi33.xml": readFixture("rechazos/cfdi33.xml"),
    "no-es-cfdi.xml": readFixture("rechazos/no-es-cfdi.xml"),
    // Same invoice as ingreso-bom-decl.xml with the UUID in uppercase.
    "duplicado-de-ingreso.xml": withUuid(ingreso, uuid.toUpperCase()),
    // AppleDouble-style hidden file: must be dropped silently.
    "._ingreso-bom-decl.xml": ingreso,
  };
  for (const [name, content] of Object.entries(xmlFiles)) {
    writeFileSync(join(syntheticFolder, name), content);
  }
  writeFileSync(join(syntheticFolder, "factura.pdf"), "%PDF-1.4\n%synthetic\n");
  writeFileSync(join(syntheticFolder, "facturas.zip"), "PK\u0003\u0004synthetic");
  writeFileSync(join(syntheticFolder, "notas.txt"), "notas sintéticas\n");
});

test.afterAll(() => {
  if (syntheticRoot !== "") {
    rmSync(syntheticRoot, { recursive: true, force: true });
  }
});

test("la puerta de acceso redirige a /login, protege la API y envía las cabeceras de seguridad", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  const api = await request.post("/api/llm/group", { data: {} });
  expect(api.status()).toBe(401);

  const login = await request.get("/login");
  const headers = login.headers();
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("same-origin");
  expect(headers["x-robots-tag"] ?? "").toContain("noindex");
});

test("carpeta sintética: reporte correcto, ningún XML sale del navegador, recargar avisa y vacía", async ({
  page,
}) => {
  const requests = recordRequests(page);
  await logIn(page);
  await pickFolder(page, syntheticFolder);

  await expect(page.getByTestId("summary-ingreso")).toHaveText("2");
  await expect(page.getByTestId("summary-egreso")).toHaveText("1");
  await expect(page.getByTestId("summary-pago")).toHaveText("1");
  await expect(page.getByTestId("summary-duplicados")).toHaveText("1");
  await expect(page.getByTestId("summary-rechazados")).toHaveText("2");
  await expect(page.getByTestId("summary-ignorados")).toHaveText("3");

  // The Dashboard tab shows the Gasto total KPI; back to Importación so the
  // report assertions after the reload steps still hold.
  await page.getByRole("tab", { name: "Dashboard" }).click();
  await expect(page.getByTestId("kpi-gasto")).toBeVisible();
  // The Facturas table lists every row of the synthetic folder (2 Ingreso, 1 Egreso, 1 Pago).
  await expect(page.getByText("Facturas (4)")).toBeVisible();
  await page.getByRole("tab", { name: "Importación" }).click();
  await expect(page.getByText("Reporte de importación")).toBeVisible();

  expectNoXmlLeavesTheBrowser(requests);

  // Reload: the browser must ask first (beforeunload); dismissing keeps the data.
  const seen: string[] = [];
  let answer: "dismiss" | "accept" = "dismiss";
  page.on("dialog", (dialog) => {
    seen.push(dialog.type());
    if (answer === "accept") {
      void dialog.accept();
    } else {
      void dialog.dismiss();
    }
  });
  await page.evaluate(() => {
    location.reload();
  });
  await expect.poll(() => seen).toContain("beforeunload");
  await expect(page.getByText("Reporte de importación")).toBeVisible();

  // Accepting the second prompt reloads the page and clears everything.
  answer = "accept";
  await page.evaluate(() => {
    location.reload();
  });
  await expect(
    page.getByText(
      "Por privacidad, las facturas no se guardan; vuelve a soltarlas para analizarlas",
    ),
  ).toBeVisible();
  await expect(page.getByText("Reporte de importación")).toHaveCount(0);
});

test("cerrar sesión con confirmación vuelve a /login y la puerta sigue cerrada", async ({
  page,
}) => {
  acceptDialogs(page);
  await logIn(page);
  await pickFolder(page, syntheticFolder);

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  const dialog = page.getByRole("alertdialog", { name: "¿Cerrar sesión?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("muestra real (local)", async ({ page }) => {
  const sample = process.env.E2E_FACTURAS_DIR;
  test.skip(sample === undefined || sample === "", "E2E_FACTURAS_DIR no está definida");
  if (sample === undefined || sample === "") return;

  test.setTimeout(120_000);
  const requests = recordRequests(page);
  await logIn(page);
  await pickFolder(page, resolve(process.cwd(), sample));

  await expect(page.getByTestId("summary-ingreso")).toHaveText("133");
  await expect(page.getByTestId("summary-egreso")).toHaveText("3");
  await expect(page.getByTestId("summary-pago")).toHaveText("7");
  await expect(page.getByTestId("summary-ignorados")).toHaveText("143");

  expectNoXmlLeavesTheBrowser(requests);
});
