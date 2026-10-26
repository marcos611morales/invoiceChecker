import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Big from "big.js";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { defaultSettings, type SettingsData } from "../src/domain/settings/types";
import { makeProduct } from "../tests/support/pricesFactory";
import { buildPriceXml, type PriceInvoiceSpec } from "../tests/support/pricesXml";
import {
  expectNoXmlLeavesTheBrowser,
  logIn,
  pickFolder,
  recordRequests,
  seedStorage,
} from "./helpers";

// Production-build checks of Phase 5 (the Precios tab). The folder of invoices is generated at
// runtime in the OS temp dir from fake suppliers and removed afterwards; nothing comes from
// Facturas/. The seeded products are synthetic too. The Precios flow never calls an LLM route, so
// no mock is installed: any request to /api/llm fails the spec.

const SETTINGS_KEY = "invoicechecker:settings";

const STORE_A = { rfc: "AAA010101AAA", nombre: "ABARROTES PRUEBA SA DE CV" } as const;
const STORE_B = { rfc: "BBB010101BBB", nombre: "BODEGA PRUEBA SA DE CV" } as const;

const MILK_KEY = "50131700";
const EGG_KEY = "50131600";
const FUEL_KEY = "15101514";

/**
 * Four invoices, two per store. Per liter of «LECHE ENTERA 1L»: store A 25.00 and 28.00, store B
 * 21.00 and 22.00. Per piece of «HUEVO BLANCO»: store A 5.50 and 6.00, store B 4.50 and 5.00.
 * «LECHE DESLACTOSADA» (store B) has no size in its description, so it starts out as «No
 * normalizado» next to the sized milk.
 */
const INVOICES: PriceInvoiceSpec[] = [
  {
    ...STORE_A,
    folio: "PRC-FOLIO-1",
    fecha: "2025-03-05T10:15:00",
    uuid: "aaaaaaaa-0000-4000-8000-00000000c001",
    lines: [
      { descripcion: "LECHE ENTERA 1L", claveProdServ: MILK_KEY, claveUnidad: "H87", cantidad: "12", importe: "300.00" },
      { descripcion: "MAGNA", claveProdServ: FUEL_KEY, claveUnidad: "LTR", cantidad: "40", importe: "912.40" },
      { descripcion: "HUEVO BLANCO", claveProdServ: EGG_KEY, claveUnidad: "H87", cantidad: "30", importe: "165.00" },
    ],
  },
  {
    ...STORE_A,
    folio: "PRC-FOLIO-2",
    fecha: "2025-04-12T09:40:00",
    uuid: "aaaaaaaa-0000-4000-8000-00000000c002",
    lines: [
      { descripcion: "LECHE ENTERA 1L", claveProdServ: MILK_KEY, claveUnidad: "H87", cantidad: "10", importe: "280.00" },
      { descripcion: "HUEVO BLANCO", claveProdServ: EGG_KEY, claveUnidad: "H87", cantidad: "60", importe: "360.00" },
    ],
  },
  {
    ...STORE_B,
    folio: "PRC-FOLIO-3",
    fecha: "2025-03-20T16:05:00",
    uuid: "bbbbbbbb-0000-4000-8000-00000000c003",
    lines: [
      { descripcion: "LECHE ENTERA 1L", claveProdServ: MILK_KEY, claveUnidad: "H87", cantidad: "12", importe: "252.00" },
      { descripcion: "LECHE DESLACTOSADA", claveProdServ: MILK_KEY, claveUnidad: "H87", cantidad: "6", importe: "174.00" },
      { descripcion: "HUEVO BLANCO", claveProdServ: EGG_KEY, claveUnidad: "H87", cantidad: "30", importe: "135.00" },
    ],
  },
  {
    ...STORE_B,
    folio: "PRC-FOLIO-4",
    fecha: "2025-05-08T11:30:00",
    uuid: "bbbbbbbb-0000-4000-8000-00000000c004",
    lines: [
      { descripcion: "LECHE ENTERA 1L", claveProdServ: MILK_KEY, claveUnidad: "H87", cantidad: "12", importe: "264.00" },
      { descripcion: "HUEVO BLANCO", claveProdServ: EGG_KEY, claveUnidad: "H87", cantidad: "30", importe: "150.00" },
    ],
  },
];

/** Writes one XML file per invoice into a new folder under `root` and returns its path. */
function writeFolder(root: string, name: string, invoices: readonly PriceInvoiceSpec[]): string {
  const folder = join(root, name);
  mkdirSync(folder);
  invoices.forEach((invoice, index) => {
    writeFileSync(join(folder, `factura-${String(index + 1)}.xml`), buildPriceXml(invoice));
  });
  return folder;
}

/** Total of an invoice as the builder writes it: the sum of its importes, two decimals. */
function totalOf(invoice: PriceInvoiceSpec): string {
  return invoice.lines.reduce((sum, line) => sum.plus(new Big(line.importe)), new Big("0")).toFixed(2);
}

let syntheticRoot = "";
let mainFolder = "";

test.beforeAll(() => {
  syntheticRoot = mkdtempSync(join(tmpdir(), "invoicechecker-e2e-prices-"));
  mainFolder = writeFolder(syntheticRoot, "2025", INVOICES);
});

test.afterAll(() => {
  if (syntheticRoot !== "") rmSync(syntheticRoot, { recursive: true, force: true });
});

/** Three accepted products over the synthetic descriptions. */
function pricesSettings(): SettingsData {
  return {
    ...defaultSettings(),
    products: [
      makeProduct("Leche entera", [
        { rfc: STORE_A.rfc, descripcion: "LECHE ENTERA 1L", supplierName: STORE_A.nombre },
        { rfc: STORE_B.rfc, descripcion: "LECHE ENTERA 1L", supplierName: STORE_B.nombre },
        { rfc: STORE_B.rfc, descripcion: "LECHE DESLACTOSADA", supplierName: STORE_B.nombre },
      ]),
      makeProduct("Gasolina", [{ rfc: STORE_A.rfc, descripcion: "MAGNA", supplierName: STORE_A.nombre }]),
      makeProduct("Huevo", [
        { rfc: STORE_A.rfc, descripcion: "HUEVO BLANCO", supplierName: STORE_A.nombre },
        { rfc: STORE_B.rfc, descripcion: "HUEVO BLANCO", supplierName: STORE_B.nombre },
      ]),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Small page helpers.

async function openPrices(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Precios", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Precios", level: 2, exact: true })).toBeVisible();
}

/** The table row of a product: it holds the button that carries the product name. */
function productRow(page: Page, name: string): Locator {
  return page.getByRole("row").filter({ has: page.getByRole("button", { name, exact: true }) });
}

/** Everything the page keeps in the browser storage, as one text to scan. */
async function storedText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [];
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null) parts.push(key, storage.getItem(key) ?? "");
      }
    }
    return parts.join("\n");
  });
}

// ---------------------------------------------------------------------------------------------
// (1) The whole flow of the phase in the production build, with the privacy and persistence checks.

test("Precios: ahorro estimado, leche agrupada y huevo por pieza; el combustible se oculta y se recupera; el detalle muestra tiendas, historial, contenido y compras; una corrección de contenido sobrevive a recargar; nada sale del navegador", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const requests = recordRequests(page);
  await seedStorage(page, { settings: pricesSettings() });
  await logIn(page);
  await pickFolder(page, mainFolder);
  await openPrices(page);

  // The savings card, always called «estimado», and the two compared products.
  const card = page.getByTestId("prices-savings");
  await expect(card).toBeVisible();
  await expect(card).toContainText("estimado");
  await expect(card).toContainText("2 productos con 2 o más tiendas");

  const milk = productRow(page, "Leche entera");
  await expect(milk).toContainText(STORE_B.nombre);
  await expect(milk).toContainText("$21.50 / L");
  await expect(milk).toContainText("$107.00");
  await expect(milk).toContainText("1 compra no normalizada");

  const eggs = productRow(page, "Huevo");
  await expect(eggs).toContainText("por pieza, sin tamaño verificado");
  await expect(eggs).toContainText(STORE_B.nombre);
  await expect(eggs).toContainText("$4.75 / pieza");
  await expect(eggs).toContainText("$97.50");

  // The fuel product is hidden by default; the checkbox lists it with its reason.
  await expect(productRow(page, "Gasolina")).toHaveCount(0);
  const showHidden = page.getByRole("checkbox", { name: "Mostrar los no comparables (1)" });
  await showHidden.click();
  const fuel = productRow(page, "Gasolina");
  await expect(fuel).toBeVisible();
  await expect(fuel).toContainText("No comparable");
  await expect(fuel).toContainText(
    "Se excluye por defecto: sus compras son de servicios o combustible.",
  );

  // «Volver a comparar» compares it at once (the row stays listed); «Deshacer» hides it again.
  await page.getByRole("button", { name: "Más acciones de «Gasolina»" }).click();
  await page.getByRole("menuitem", { name: "Volver a comparar" }).click();
  await expect(page.getByText("«Gasolina» vuelve a compararse", { exact: true })).toBeVisible();
  await expect(fuel).not.toContainText("No comparable");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(fuel).toContainText("No comparable");
  await expect(fuel).toContainText(
    "Se excluye por defecto: sus compras son de servicios o combustible.",
  );

  // The milk detail: stores, history chart, content of each description and purchases.
  await page.getByRole("button", { name: "Ver precios de Leche entera" }).click();
  const stores = page.getByRole("region", { name: "Precios por tienda" });
  await expect(stores).toBeVisible();
  await expect(stores.getByText("Más barata")).toBeVisible();

  const history = page.getByRole("region", { name: "Historial de precios" });
  await expect(history).toBeVisible();
  const chart = history.getByRole("img", { name: /^Historial de precios de Leche entera/ });
  await expect(chart).toBeVisible();
  // One marker per normalized purchase: each marker has one 24 px hit circle (radius 12).
  const NORMALIZED_PURCHASES = 4;
  await expect
    .poll(() => chart.locator('circle[r="12"]').count())
    .toBeGreaterThanOrEqual(NORMALIZED_PURCHASES);
  await expect(history.getByRole("listitem").filter({ hasText: STORE_A.nombre })).toHaveCount(1);
  await expect(history.getByRole("listitem").filter({ hasText: STORE_B.nombre })).toHaveCount(1);

  const content = page.getByRole("region", { name: "Contenido de cada descripción" });
  await expect(content).toBeVisible();
  const purchases = page.getByRole("region", { name: "Compras", exact: true });
  for (const invoice of INVOICES.filter((candidate) => candidate.lines.some((l) => l.claveProdServ === MILK_KEY))) {
    await expect(purchases).toContainText(invoice.folio);
  }

  // Capturing the content of the unsized description (1 L each) changes the comparison at once.
  await content
    .getByRole("button", { name: "Capturar contenido de «LECHE DESLACTOSADA» (BODEGA PRUEBA SA DE CV)" })
    .click();
  await page.getByRole("textbox", { name: "Contenido de cada pieza" }).fill("1");
  await page.getByRole("combobox", { name: "Unidad" }).click();
  await page.getByRole("option", { name: "L", exact: true }).click();
  await page.getByRole("button", { name: "Guardar contenido" }).click();
  await expect(milk).toContainText("$22.00 / L");
  await expect(milk).toContainText("$96.00");
  await expect(milk).not.toContainText("no normalizada");

  // The correction is a setting: it survives a reload, once the folder is loaded again.
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  const reloaded = page.waitForEvent("load");
  await page.evaluate(() => {
    location.reload();
  });
  await reloaded;
  await expect(
    page.getByText("Por privacidad, las facturas no se guardan; vuelve a soltarlas para analizarlas"),
  ).toBeVisible();
  await pickFolder(page, mainFolder);
  await openPrices(page);
  await expect(productRow(page, "Leche entera")).toContainText("$22.00 / L");
  await expect(productRow(page, "Leche entera")).toContainText("$96.00");
  await expect(productRow(page, "Leche entera")).not.toContainText("no normalizada");

  // Privacy: nothing left the origin, no body carried XML, no LLM route was called.
  expect(requests.filter((request) => request.url.includes("/api/llm"))).toHaveLength(0);
  expectNoXmlLeavesTheBrowser(requests);

  // Privacy: the browser storage holds the settings and no invoice data.
  const stored = await storedText(page);
  expect(stored).toContain(SETTINGS_KEY);
  expect(stored).toContain("LECHE DESLACTOSADA");
  const lowered = stored.toLowerCase();
  const forbidden = INVOICES.flatMap((invoice) => [
    invoice.folio,
    invoice.uuid,
    invoice.fecha.slice(0, 10),
    totalOf(invoice),
  ]);
  for (const value of forbidden) {
    expect(lowered.includes(value.toLowerCase()), `storage must not hold ${value}`).toBe(false);
  }
});
