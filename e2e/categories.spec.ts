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

/** Horizontal measures of the shell, read in the page at the current viewport. */
interface ShellMeasures {
  listScrollWidth: number;
  listClientWidth: number;
  pageScrollWidth: number;
  innerWidth: number;
  headerScrollWidth: number;
  headerClientWidth: number;
  ivaCentre: number;
  headerCentre: number;
}

async function measureShell(page: Page): Promise<ShellMeasures> {
  return page.evaluate(() => {
    const list = document.querySelector('[role="tablist"]');
    const header = document.querySelector("header");
    const iva = document.querySelector('[data-testid="iva-toggle-bar"]');
    if (list === null || header === null || iva === null) {
      throw new Error("e2e: tab list, header or IVA control not found");
    }
    const ivaBox = iva.getBoundingClientRect();
    const headerBox = header.getBoundingClientRect();
    return {
      listScrollWidth: list.scrollWidth,
      listClientWidth: list.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      headerScrollWidth: header.scrollWidth,
      headerClientWidth: header.clientWidth,
      ivaCentre: ivaBox.left + ivaBox.width / 2,
      headerCentre: headerBox.left + headerBox.width / 2,
    };
  });
}

test("diseño adaptable: a 360 px las pestañas se desplazan dentro de su lista y entre 768 y 1023 px la barra superior no desborda", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await logIn(page);
  await pickFolder(page, syntheticFolder);
  await page.getByRole("tab", { name: "Dashboard" }).click();
  await expect(page.getByTestId("kpi-gasto")).toBeVisible();

  // Phones: the four tabs scroll inside their list.
  await page.setViewportSize({ width: 360, height: 800 });
  const phone = await measureShell(page);
  expect(phone.listScrollWidth).toBeGreaterThan(phone.listClientWidth);

  // The last tab is brought into view when it is selected.
  const importTab = page.getByRole("tab", { name: "Importación" });
  await importTab.click();
  await expect(importTab).toHaveAttribute("aria-selected", "true");
  const list = page.getByRole("tablist", { name: "Secciones" });
  await expect
    .poll(async () => {
      const listBox = await list.boundingBox();
      const tabBox = await importTab.boundingBox();
      if (listBox === null || tabBox === null) return false;
      return tabBox.x >= listBox.x - 1 && tabBox.x + tabBox.width <= listBox.x + listBox.width + 1;
    })
    .toBe(true);

  // Tablets: the top bar does not overflow and the IVA control stays centred.
  for (const width of [768, 900, 1023]) {
    await page.setViewportSize({ width, height: 900 });
    // Polled: the measure is read once the layout of the new width has settled.
    await expect
      .poll(
        async () => {
          const bar = await measureShell(page);
          return {
            overflow: bar.headerScrollWidth - bar.headerClientWidth,
            centred: Math.abs(bar.ivaCentre - bar.headerCentre) <= 24,
          };
        },
        { message: `top bar at ${String(width)} px` },
      )
      .toEqual({ overflow: 0, centred: true });
  }
});

// At 360 px the name «InvoiceChecker» plus four 44 px buttons did not fit the top bar. User
// decision 2026-10-18: below 400 px the name is visually hidden (still read by screen readers)
// and the buttons keep their 44 px targets.
test("a 360 px la página no se desplaza de lado", async ({ page }) => {
  await logIn(page);
  await pickFolder(page, syntheticFolder);
  for (const tab of ["Dashboard", "Categorías", "Calidad de datos", "Importación"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    await page.setViewportSize({ width: 360, height: 800 });
    const shell = await measureShell(page);
    expect(shell.pageScrollWidth, `page width on ${tab}`).toBeLessThanOrEqual(shell.innerWidth);
  }
});
