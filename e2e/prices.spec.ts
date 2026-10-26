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

// ---------------------------------------------------------------------------------------------
// Synthetic data of the held-out UI states (UI-SPEC E4 long-text, E7 populated, E8 long-text).

const SHOTS_DIR = join(process.cwd(), "test-results", "phase5-ui-states");

/** A UUID-shaped identifier that is unique per (prefix, n) and obviously synthetic. */
function uuidOf(prefix: string, n: number): string {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/** An invoice with a single concept line. */
function singleLine(
  store: { rfc: string; nombre: string },
  folio: string,
  uuid: string,
  fecha: string,
  line: PriceInvoiceSpec["lines"][number],
): PriceInvoiceSpec {
  return { ...store, folio, uuid, fecha, lines: [line] };
}

// E4: a product named with 60 characters, bought at two suppliers with very long names.
const E4_PRODUCT = "Producto sintético de nombre muy largo con sesenta caracteres".slice(0, 60);
const E4_DESCRIPTION = "PRODUCTO LARGO SINTETICO 1KG";
const E4_SUPPLIERS = [
  {
    rfc: "CCC010101CCC",
    nombre: "DISTRIBUIDORA SINTETICA DE ABARROTES Y PRODUCTOS DE LIMPIEZA Y OFICINA PRUEBA SA DE CV",
  },
  {
    rfc: "DDD010101DDD",
    nombre: "COMERCIALIZADORA SINTETICA DE INSUMOS PARA CAFETERIAS Y RESTAURANTES PRUEBA SA DE CV",
  },
] as const;

function e4Invoices(): PriceInvoiceSpec[] {
  const lineAt = (importe: string) => ({
    descripcion: E4_DESCRIPTION,
    claveProdServ: MILK_KEY,
    claveUnidad: "H87",
    cantidad: "2",
    importe,
  });
  const [first, second] = E4_SUPPLIERS;
  return [
    singleLine(first, "E4-FOLIO-1", uuidOf("cccccccc", 1), "2025-03-03T10:00:00", lineAt("120.00")),
    singleLine(first, "E4-FOLIO-2", uuidOf("cccccccc", 2), "2025-04-07T10:00:00", lineAt("130.00")),
    singleLine(second, "E4-FOLIO-3", uuidOf("dddddddd", 3), "2025-03-17T10:00:00", lineAt("100.00")),
    singleLine(second, "E4-FOLIO-4", uuidOf("dddddddd", 4), "2025-05-12T10:00:00", lineAt("110.00")),
  ];
}

function e4Settings(): SettingsData {
  return {
    ...defaultSettings(),
    products: [
      makeProduct(E4_PRODUCT, E4_SUPPLIERS.map((supplier) => ({
        rfc: supplier.rfc,
        descripcion: E4_DESCRIPTION,
        supplierName: supplier.nombre,
      }))),
    ],
  };
}

// E7: one product at five stores; stores 1 and 2 bought on the same date at the same price, so
// their markers overlap. Store names sort in the order of their series slots (tienda1..tienda5).
const E7_PRODUCT = "Artículo de cinco tiendas";
const E7_DESCRIPTION = "ARTICULO E7 1KG";
const E7_STORES = [1, 2, 3, 4, 5].map((n) => ({
  rfc: `EEE01010${String(n)}EE1`,
  nombre: `E7 TIENDA ${String(n)} PRUEBA SA DE CV`,
}));

/** [store index, date, importe for 2 kg]: per kg 50, 55 / 50, 48 / 44, 47 / 55, 52 / 60, 58. */
const E7_PURCHASES: readonly (readonly [number, string, string])[] = [
  [0, "2025-04-10", "100.00"],
  [0, "2025-06-05", "110.00"],
  [1, "2025-04-10", "100.00"],
  [1, "2025-05-15", "96.00"],
  [2, "2025-03-12", "88.00"],
  [2, "2025-05-02", "94.00"],
  [3, "2025-03-25", "110.00"],
  [3, "2025-06-20", "104.00"],
  [4, "2025-02-18", "120.00"],
  [4, "2025-05-28", "116.00"],
];

function e7Invoices(): PriceInvoiceSpec[] {
  return E7_PURCHASES.map(([storeIndex, day, importe], index) => {
    const store = E7_STORES[storeIndex];
    if (store === undefined) throw new Error("e2e: unknown E7 store");
    return singleLine(
      store,
      `E7-FOLIO-${String(index + 1)}`,
      uuidOf("eeeeeeee", index + 1),
      `${day}T12:00:00`,
      { descripcion: E7_DESCRIPTION, claveProdServ: MILK_KEY, claveUnidad: "H87", cantidad: "2", importe },
    );
  });
}

function e7Settings(): SettingsData {
  return {
    ...defaultSettings(),
    products: [
      makeProduct(
        E7_PRODUCT,
        E7_STORES.map((store) => ({
          rfc: store.rfc,
          descripcion: E7_DESCRIPTION,
          supplierName: store.nombre,
        })),
      ),
    ],
  };
}

// E8: a description of exactly 120 characters (with a readable size at the end).
const E8_PRODUCT = "Producto de descripción larga";
const E8_SHORT = "POTE CORTO 500G";
const E8_STORES = [
  { rfc: "FFF010101FFF", nombre: "TIENDA E8 UNO PRUEBA SA DE CV" },
  { rfc: "GGG010101GGG", nombre: "TIENDA E8 DOS PRUEBA SA DE CV" },
] as const;

function longDescription(): string {
  const filler =
    "DESCRIPCION SINTETICA MUY LARGA PARA REVISAR EL AJUSTE DE LINEAS EN LA TABLA DE CONTENIDO DE CADA DESCRIPCION DEL PRODUCTO DE PRUEBA";
  const prefix = filler.slice(0, 115);
  return `${prefix.endsWith(" ") ? `${prefix.slice(0, 114)}A` : prefix} 500G`;
}

const E8_LONG = longDescription();

function e8Invoices(): PriceInvoiceSpec[] {
  const [first, second] = E8_STORES;
  const lineOf = (descripcion: string, importe: string) => ({
    descripcion,
    claveProdServ: MILK_KEY,
    claveUnidad: "H87",
    cantidad: "2",
    importe,
  });
  return [
    singleLine(first, "E8-FOLIO-1", uuidOf("ffffffff", 1), "2025-03-04T10:00:00", lineOf(E8_LONG, "90.00")),
    singleLine(first, "E8-FOLIO-2", uuidOf("ffffffff", 2), "2025-04-09T10:00:00", lineOf(E8_LONG, "94.00")),
    singleLine(second, "E8-FOLIO-3", uuidOf("aaaaaaab", 3), "2025-03-18T10:00:00", lineOf(E8_SHORT, "80.00")),
    singleLine(second, "E8-FOLIO-4", uuidOf("aaaaaaab", 4), "2025-05-14T10:00:00", lineOf(E8_SHORT, "84.00")),
  ];
}

function e8Settings(): SettingsData {
  return {
    ...defaultSettings(),
    products: [
      makeProduct(E8_PRODUCT, [
        { rfc: E8_STORES[0].rfc, descripcion: E8_LONG, supplierName: E8_STORES[0].nombre },
        { rfc: E8_STORES[1].rfc, descripcion: E8_SHORT, supplierName: E8_STORES[1].nombre },
      ]),
    ],
  };
}

let syntheticRoot = "";
let mainFolder = "";
let e4Folder = "";
let e7Folder = "";
let e8Folder = "";

test.beforeAll(() => {
  syntheticRoot = mkdtempSync(join(tmpdir(), "invoicechecker-e2e-prices-"));
  mainFolder = writeFolder(syntheticRoot, "2025", INVOICES);
  e4Folder = writeFolder(syntheticRoot, "e4", e4Invoices());
  e7Folder = writeFolder(syntheticRoot, "e7", e7Invoices());
  e8Folder = writeFolder(syntheticRoot, "e8", e8Invoices());
  mkdirSync(SHOTS_DIR, { recursive: true });
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

// ---------------------------------------------------------------------------------------------
// (2) Responsive widths: the page never scrolls sideways; the tab list scrolls inside itself below
// 768 px and keeps the active «Precios» trigger in view.

const WIDTHS = [360, 640, 767, 768, 1024] as const;
/** Below this width the tab list is its own scroll container (UI-SPEC Shell and tabs). */
const LIST_SCROLLS_BELOW = 768;
/** Widths up to this one are narrower than the six tabs together, so the list must overflow. */
const MUST_OVERFLOW_UP_TO = 640;

interface WidthMeasures {
  pageScrollWidth: number;
  innerWidth: number;
  listScrollWidth: number;
  listClientWidth: number;
  overflowX: string;
  /** True when both edges of the active trigger lie inside the tab list box. */
  triggerInside: boolean;
}

async function measureWidth(page: Page): Promise<WidthMeasures> {
  const list = page.getByRole("tablist", { name: "Secciones" });
  return list.evaluate((element) => {
    const trigger = element.querySelector('[role="tab"][aria-selected="true"]');
    const listBox = element.getBoundingClientRect();
    const box = trigger?.getBoundingClientRect();
    return {
      pageScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      listScrollWidth: element.scrollWidth,
      listClientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
      triggerInside:
        box !== undefined && box.left >= listBox.left - 1 && box.right <= listBox.right + 1,
    };
  });
}

test("a 360, 640, 767, 768 y 1024 px la página de Precios no se desplaza de lado; bajo 768 px la lista de pestañas se desplaza dentro de sí misma con «Precios» a la vista", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const requests = recordRequests(page);
  await seedStorage(page, { settings: pricesSettings() });
  await logIn(page);
  await pickFolder(page, mainFolder);
  await page.setViewportSize({ width: 1024, height: 900 });
  await openPrices(page);
  // The heaviest layout: a product open, with its store table, chart, content and purchases.
  await page.getByRole("button", { name: "Ver precios de Leche entera" }).click();
  await expect(page.getByRole("region", { name: "Historial de precios" })).toBeVisible();

  for (const width of WIDTHS) {
    const label = `${String(width)} px`;
    await page.setViewportSize({ width, height: 900 });
    // Leave the tab and come back with a script click, which does not scroll anything by itself:
    // the shell must bring the active trigger into view on its own.
    const dashboard = page.getByRole("tab", { name: "Dashboard", exact: true });
    await dashboard.evaluate((element) => {
      if (element instanceof HTMLElement) element.click();
    });
    await expect(dashboard).toHaveAttribute("aria-selected", "true");
    const prices = page.getByRole("tab", { name: "Precios", exact: true });
    await prices.evaluate((element) => {
      if (element instanceof HTMLElement) element.click();
    });
    await expect(prices).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Precios", level: 2, exact: true })).toBeVisible();

    const measures = await measureWidth(page);
    expect(measures.pageScrollWidth, `page width at ${label}`).toBeLessThanOrEqual(
      measures.innerWidth,
    );
    if (width < LIST_SCROLLS_BELOW) {
      // Below 768 px the list is a scroll container whether or not its tabs happen to fit: the six
      // tabs overflow at 360 and 640 px and still fit at 767 px, where there is nothing to scroll.
      expect(["auto", "scroll"], `tab list overflow-x at ${label}`).toContain(measures.overflowX);
      if (width <= MUST_OVERFLOW_UP_TO) {
        expect(measures.listScrollWidth, `tab list overflows its box at ${label}`).toBeGreaterThan(
          measures.listClientWidth,
        );
      }
      expect(measures.triggerInside, `«Precios» trigger inside the tab list at ${label}`).toBe(true);
    } else {
      expect(measures.listScrollWidth, `tab list fits at ${label}`).toBeLessThanOrEqual(
        measures.listClientWidth,
      );
    }
  }

  expectNoXmlLeavesTheBrowser(requests);
});

// ---------------------------------------------------------------------------------------------
// (3) Held-out UI states for the end-of-phase human review. Screenshots go to
// test-results/phase5-ui-states/, which is not committed.

/** Line height in px of an element, its rendered box height and whether its content is cut. */
async function lineMetrics(
  locator: Locator,
): Promise<{ lineHeight: number; height: number; clamped: boolean }> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const parsed = parseFloat(style.lineHeight);
    const lineHeight = Number.isNaN(parsed) ? parseFloat(style.fontSize) * 1.2 : parsed;
    return {
      lineHeight,
      height: element.getBoundingClientRect().height,
      clamped: element.scrollHeight > element.clientHeight + 1,
    };
  });
}

async function expectNoSideScroll(page: Page, label: string): Promise<void> {
  const measures = await page.evaluate(() => ({
    pageScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(measures.pageScrollWidth, `page width ${label}`).toBeLessThanOrEqual(measures.innerWidth);
}

test("E4 texto largo: un producto de 60 caracteres y tiendas de nombre largo se parten en dos líneas y luego se truncan, con el texto completo al pasar el cursor, a 1024 y 360 px", async ({
  page,
}) => {
  test.setTimeout(240_000);
  expect(E4_PRODUCT).toHaveLength(60);
  const requests = recordRequests(page);
  await seedStorage(page, { settings: e4Settings() });
  await logIn(page);
  await pickFolder(page, e4Folder);

  for (const width of [1024, 360]) {
    const tag = String(width);
    await page.setViewportSize({ width, height: 900 });
    await openPrices(page);
    const row = productRow(page, E4_PRODUCT);
    await expect(row).toBeVisible();

    // Product name: wraps to two lines, never a third.
    const name = row.getByRole("button", { name: E4_PRODUCT, exact: true });
    const nameMetrics = await lineMetrics(name);
    expect(nameMetrics.height, `product name height at ${tag} px`).toBeGreaterThan(
      nameMetrics.lineHeight * 1.5,
    );
    expect(nameMetrics.height, `product name height at ${tag} px`).toBeLessThanOrEqual(
      nameMetrics.lineHeight * 2 + 2,
    );

    // The cheapest store (the second supplier, 100.00 against 120.00): one line, cut, full text on hover.
    const [, cheaper] = E4_SUPPLIERS;
    const store = row.getByRole("button", { name: cheaper.nombre, exact: true });
    await expect(store).toBeVisible();
    const cut = await store.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(cut, `supplier name is cut at ${tag} px`).toBe(true);
    await store.hover();
    await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText(cheaper.nombre);
    await page.screenshot({ path: join(SHOTS_DIR, `e4-${tag}-hover.png`), fullPage: true });

    // The same full text is also reachable with the keyboard: Tab from the expander of the row
    // passes the product name and lands on the store name.
    await page.mouse.move(0, 0);
    await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toHaveCount(0);
    await row.getByRole("button", { name: `Ver precios de ${E4_PRODUCT}` }).focus();
    await page.keyboard.press("Tab");
    await expect(name).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(store).toBeFocused();
    await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText(cheaper.nombre);

    await expectNoSideScroll(page, `E4 at ${tag} px`);
    await page.screenshot({ path: join(SHOTS_DIR, `e4-${tag}-productos.png`), fullPage: true });
  }

  expectNoXmlLeavesTheBrowser(requests);
});

/** The shape of each legend glyph: its path, or «circle» for the first series. */
async function legendShapes(legend: Locator): Promise<string[]> {
  return legend.evaluate((element) =>
    Array.from(element.querySelectorAll("li svg")).map((svg) => {
      const path = svg.querySelector("path");
      if (path !== null) return `path:${path.getAttribute("d") ?? ""}`;
      return svg.querySelector("circle") !== null ? "circle" : "none";
    }),
  );
}

test("E7 poblado: dos marcadores que coinciden en fecha y precio se distinguen por forma y leyenda, y las series 3 a 5 se identifican en claro por forma, leyenda y tooltip", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const requests = recordRequests(page);
  await seedStorage(page, { settings: e7Settings() });
  await logIn(page);
  await pickFolder(page, e7Folder);
  await page.setViewportSize({ width: 1024, height: 900 });
  await openPrices(page);
  await page.getByRole("button", { name: `Ver precios de ${E7_PRODUCT}` }).click();

  const history = page.getByRole("region", { name: "Historial de precios" });
  await expect(history).toBeVisible();
  const chart = history.getByRole("img", { name: new RegExp(`^Historial de precios de ${E7_PRODUCT}`) });
  await expect(chart).toBeVisible();
  const markers = chart.locator('circle[r="12"]');
  await expect.poll(() => markers.count()).toBe(E7_PURCHASES.length);

  // The legend names the five stores and gives each its own shape.
  const legend = history.locator("ul");
  for (const store of E7_STORES) {
    await expect(legend.getByRole("listitem").filter({ hasText: store.nombre })).toHaveCount(1);
  }
  const shapes = await legendShapes(legend);
  expect(shapes).toHaveLength(E7_STORES.length);
  expect(new Set(shapes).size, "one distinct shape per series").toBe(E7_STORES.length);

  // Every store is identifiable through the tooltip of its markers, the overlapped ones included.
  const tooltip = page.locator(".recharts-tooltip-wrapper");
  const seen = new Set<string>();
  for (let index = 0; index < E7_PURCHASES.length; index += 1) {
    await markers.nth(index).hover({ force: true });
    await expect
      .poll(async () => {
        const text = await tooltip.innerText();
        return E7_STORES.find((store) => text.includes(store.nombre))?.nombre ?? "";
      })
      .not.toBe("");
    const text = await tooltip.innerText();
    for (const store of E7_STORES) {
      if (text.includes(store.nombre)) seen.add(store.nombre);
    }
  }
  expect([...seen].sort()).toEqual(E7_STORES.map((store) => store.nombre).sort());

  // Light, then dark, through the theme toggle of the app.
  await page.mouse.move(0, 0);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await history.scrollIntoViewIfNeeded();
  await history.screenshot({ path: join(SHOTS_DIR, "e7-light-chart.png") });
  await page.screenshot({ path: join(SHOTS_DIR, "e7-light-page.png"), fullPage: true });
  await markers.nth(4).hover({ force: true });
  await expect(tooltip).toContainText(E7_STORES[2]?.nombre ?? "");
  await history.screenshot({ path: join(SHOTS_DIR, "e7-light-tooltip-series3.png") });

  await page.getByRole("button", { name: "Cambiar a tema oscuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.mouse.move(0, 0);
  await history.scrollIntoViewIfNeeded();
  await history.screenshot({ path: join(SHOTS_DIR, "e7-dark-chart.png") });
  await page.screenshot({ path: join(SHOTS_DIR, "e7-dark-page.png"), fullPage: true });

  expectNoXmlLeavesTheBrowser(requests);
});

test("E8 texto largo: una descripción de 120 caracteres se parte en la tabla de contenido y el nombre accesible del lápiz se corta a 60 caracteres", async ({
  page,
}) => {
  test.setTimeout(240_000);
  expect(Array.from(E8_LONG)).toHaveLength(120);
  const requests = recordRequests(page);
  await seedStorage(page, { settings: e8Settings() });
  await logIn(page);
  await pickFolder(page, e8Folder);
  await page.setViewportSize({ width: 1024, height: 900 });
  await openPrices(page);
  await page.getByRole("button", { name: `Ver precios de ${E8_PRODUCT}` }).click();

  const content = page.getByRole("region", { name: "Contenido de cada descripción" });
  await expect(content).toBeVisible();

  // The description wraps and is cut at two lines; its full text is the button's name.
  const description = content.getByRole("button", { name: E8_LONG, exact: true });
  await expect(description).toBeVisible();
  const metrics = await lineMetrics(description);
  expect(metrics.height).toBeGreaterThan(metrics.lineHeight * 1.5);
  expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight * 2 + 2);
  expect(metrics.clamped, "the 120 characters do not fit in two lines").toBe(true);

  // The pencil names the description cut at 60 characters, the ellipsis included.
  const pencil = content.getByRole("button", {
    name: new RegExp(`^Corregir el contenido de «${E8_LONG.slice(0, 20)}`),
  });
  await expect(pencil).toHaveCount(1);
  const label = await pencil.getAttribute("aria-label");
  const quoted = /^Corregir el contenido de «(.+)» \(.+\)$/u.exec(label ?? "");
  expect(quoted, `pencil accessible name: ${label ?? "(none)"}`).not.toBeNull();
  const cutText = quoted?.[1] ?? "";
  expect(Array.from(cutText)).toHaveLength(60);
  expect(cutText.endsWith("…")).toBe(true);
  expect(cutText.slice(0, -1)).toBe(E8_LONG.slice(0, 59));

  await expectNoSideScroll(page, "E8 at 1024 px");
  await content.scrollIntoViewIfNeeded();
  await content.screenshot({ path: join(SHOTS_DIR, "e8-1024-contenido.png") });
  await page.screenshot({ path: join(SHOTS_DIR, "e8-1024-page.png"), fullPage: true });

  expectNoXmlLeavesTheBrowser(requests);
});
