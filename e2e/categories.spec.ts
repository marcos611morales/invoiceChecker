import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFixture } from "../tests/support/cfdiVariants";
import {
  ORIGIN,
  expectNoXmlLeavesTheBrowser,
  logIn,
  pickFolder,
  recordRequests,
  type RecordedRequest,
} from "./helpers";

// Production-build checks of Phase 3: classification, persistence across a reload, the settings
// file round trip between two browser profiles (separate contexts) and the responsive shell. The
// folder is generated at runtime in the OS temp dir from anonymized fixtures and removed afterwards;
// nothing real is committed or read.

const CATEGORY = "Limpieza e higiene";

let syntheticRoot = "";
let syntheticFolder = "";

test.beforeAll(() => {
  syntheticRoot = mkdtempSync(join(tmpdir(), "invoicechecker-e2e-categories-"));
  syntheticFolder = join(syntheticRoot, "2025");
  mkdirSync(syntheticFolder);
  const files = [
    "ingreso-bom-decl.xml",
    "ingreso-multiconcepto-descuento.xml",
    "egreso-relacionado.xml",
    "pago-pago20.xml",
  ];
  for (const name of files) {
    writeFileSync(join(syntheticFolder, name), readFixture(name));
  }
});

test.afterAll(() => {
  if (syntheticRoot !== "") {
    rmSync(syntheticRoot, { recursive: true, force: true });
  }
});

/** Opens the Categorías tab (the page is already logged in with a folder picked). */
async function openCategories(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Categorías" }).click();
  await expect(page.getByRole("heading", { name: "Categorías", level: 2, exact: true })).toBeVisible();
}

/** The Select of the first supplier row: «Categoría por defecto de {proveedor}». */
function firstSupplierSelect(page: Page): Locator {
  return page.getByRole("combobox", { name: /^Categoría por defecto de / }).first();
}

/** Opens a Select and picks one of its options by name. */
async function choose(page: Page, select: Locator, option: string): Promise<void> {
  await select.click();
  await page.getByRole("option", { name: option }).click();
}

/** The hidden file input behind «Subir ajustes» (the folder input has webkitdirectory). */
function settingsFileInput(page: Page): Locator {
  return page.locator('input[type="file"][accept=".json,application/json"]');
}

/** No request body of the context carries the settings file marker. */
function expectNoSettingsLeave(requests: RecordedRequest[]): void {
  const withSettings = requests.filter(
    (r) => r.body !== null && r.body.includes("invoicechecker-settings"),
  );
  expect(withSettings).toHaveLength(0);
}

async function storageKeys(page: Page): Promise<{ local: string[]; session: string[] }> {
  return page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
  }));
}

test("clasificar un proveedor, verlo en «Gasto por categoría», recargar, volver a soltar y conservar la asignación; copia de ajustes a otro perfil", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const requests = recordRequests(page);

  // (1) Classify the first supplier and see it in the Dashboard block.
  await logIn(page);
  await pickFolder(page, syntheticFolder);
  await openCategories(page);
  const select = firstSupplierSelect(page);
  await choose(page, select, CATEGORY);
  await expect(select).toContainText(CATEGORY);

  await page.getByRole("tab", { name: "Dashboard" }).click();
  const categoryBlock = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Gasto por categoría" }),
  });
  await expect(categoryBlock.getByText(CATEGORY, { exact: true })).toBeVisible();

  // Reload (accepting the beforeunload prompt), drop the same folder again: the assignment stays.
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.evaluate(() => {
    location.reload();
  });
  await expect(
    page.getByText(
      "Por privacidad, las facturas no se guardan; vuelve a soltarlas para analizarlas",
    ),
  ).toBeVisible();
  await pickFolder(page, syntheticFolder);
  await openCategories(page);
  await expect(firstSupplierSelect(page)).toContainText(CATEGORY);

  const keys = await storageKeys(page);
  expect(keys.local).toEqual(["invoicechecker:settings"]);
  expect(keys.session).toEqual([]);

  // (2) Download the settings file and carry it to a second, fresh browser context.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar ajustes" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^invoicechecker-ajustes-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = join(syntheticRoot, "ajustes.json");
  await download.saveAs(backupPath);
  expect(readFileSync(backupPath, "utf8")).toContain("invoicechecker-settings");

  const otherContext = await browser.newContext({ baseURL: ORIGIN });
  try {
    const other = await otherContext.newPage();
    const otherRequests = recordRequests(other);
    await logIn(other);
    await pickFolder(other, syntheticFolder);
    await openCategories(other);
    // A fresh profile starts without the assignment.
    await expect(firstSupplierSelect(other)).not.toContainText(CATEGORY);

    await settingsFileInput(other).setInputFiles(backupPath);
    const dialog = other.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Reemplazar mis ajustes" }).click();
    await expect(other.getByText("Ajustes reemplazados")).toBeVisible();
    await expect(firstSupplierSelect(other)).toContainText(CATEGORY);

    // An invalid file is refused and changes nothing.
    await settingsFileInput(other).setInputFiles({
      name: "no-es-json.json",
      mimeType: "application/json",
      buffer: Buffer.from("no es json"),
    });
    await expect(
      other.getByText(/no es un archivo de ajustes de InvoiceChecker/),
    ).toBeVisible();
    await expect(other.getByRole("alertdialog")).toHaveCount(0);
    await expect(firstSupplierSelect(other)).toContainText(CATEGORY);

    const otherKeys = await storageKeys(other);
    expect(otherKeys.local).toEqual(["invoicechecker:settings"]);

    // (3) Neither profile sent invoice or settings data anywhere.
    expectNoXmlLeavesTheBrowser(otherRequests);
    expectNoSettingsLeave(otherRequests);
  } finally {
    await otherContext.close();
  }

  expectNoXmlLeavesTheBrowser(requests);
  expectNoSettingsLeave(requests);
});
