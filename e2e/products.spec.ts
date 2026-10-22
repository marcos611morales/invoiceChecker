import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  categorizeRequestSchema,
  groupRequestSchema,
  type CategorizeRequest,
  type CategorizeResponse,
  type GroupRequest,
  type GroupResponse,
} from "../src/domain/llm/contract";
import type { PendingQueue } from "../src/domain/llm/suggestions";
import {
  OTROS_ID,
  defaultSettings,
  type SettingsData,
} from "../src/domain/settings/types";
import { readFixture } from "../tests/support/cfdiVariants";
import {
  expectNoXmlLeavesTheBrowser,
  logIn,
  mockLlm,
  pickFolder,
  recordRequests,
  seedStorage,
  type LlmMock,
} from "./helpers";

// Production-build checks of Phase 4 with the LLM routes mocked at the network layer (no real
// DeepSeek call is possible: the web server runs with an empty key, see playwright.config.ts).
// The folder is generated at runtime in the OS temp dir from the anonymized fixtures and removed
// afterwards; the seeded settings are synthetic. Screenshots go to test-results/phase4-ui-states/,
// which is not committed.

const CATEGORY = "Limpieza e higiene";
const SUPPLIER_NAME = "PROVEEDOR DE PRUEBA SA DE CV";
/** The public SAT test RFC of the fixtures' issuer: it must never appear in an LLM request. */
const SUPPLIER_RFC = "EKU9003173C9";
const SHOTS_DIR = join(process.cwd(), "test-results", "phase4-ui-states");

let syntheticRoot = "";
let syntheticFolder = "";

test.beforeAll(() => {
  syntheticRoot = mkdtempSync(join(tmpdir(), "invoicechecker-e2e-products-"));
  syntheticFolder = join(syntheticRoot, "2025");
  mkdirSync(syntheticFolder);
  mkdirSync(SHOTS_DIR, { recursive: true });
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

// ---------------------------------------------------------------------------------------------
// Mocked answers, built from the ids of the request so the coverage re-check of the browser holds.

/** Two groups: the first half of the sent ids and the rest. */
function twoGroups(request: GroupRequest): GroupResponse["groups"] {
  const ids = request.items.map((item) => item.id);
  const half = Math.max(1, Math.ceil(ids.length / 2));
  const second = ids.slice(half);
  return [
    { name: "Producto de prueba A", ids: ids.slice(0, half), existing: null },
    ...(second.length > 0
      ? [{ name: "Producto de prueba B", ids: second, existing: null }]
      : []),
  ];
}

/** Every supplier and product of the request goes to the «Limpieza e higiene» category. */
function allToCleaning(request: CategorizeRequest): CategorizeResponse["answers"] {
  const category = request.categories.find((candidate) => candidate.name === CATEGORY);
  if (category === undefined) throw new Error(`e2e: category ${CATEGORY} not in the request`);
  const ids = [...request.suppliers.map((s) => s.id), ...request.products.map((p) => p.id)];
  return ids.map((id) => ({ id, choice: { kind: "code" as const, code: category.id } }));
}

// ---------------------------------------------------------------------------------------------
// Small page helpers.

async function openProducts(page: Page): Promise<void> {
  await page.getByRole("tab", { name: /^Productos/ }).click();
  await expect(page.getByRole("heading", { name: "Productos", level: 2, exact: true })).toBeVisible();
}

function sendDialog(page: Page): Locator {
  return page.getByRole("alertdialog", { name: "¿Enviar estos datos a DeepSeek?" });
}

async function storageKeys(page: Page): Promise<string[]> {
  const keys = await page.evaluate(() => Object.keys(window.localStorage));
  return keys.sort();
}

/** Lets two animation frames pass, so a render that a late answer would cause has happened. */
async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

/** The sorted top-level keys of a recorded request body. */
function topLevelKeys(body: string): string[] {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null) throw new Error("e2e: body is not an object");
  return Object.keys(parsed).sort();
}

/** Every recorded body satisfies the strict contract and carries no RFC, UUID or amount-like field. */
function expectOnlyContractBodies(mock: LlmMock): void {
  for (const body of mock.groupCalls) {
    expect(groupRequestSchema.safeParse(JSON.parse(body)).success).toBe(true);
    expect(topLevelKeys(body)).toEqual(["existing", "items"]);
    expectNoIdentifiers(body);
  }
  for (const body of mock.categorizeCalls) {
    expect(categorizeRequestSchema.safeParse(JSON.parse(body)).success).toBe(true);
    expect(topLevelKeys(body)).toEqual(["categories", "products", "suppliers"]);
    expectNoIdentifiers(body);
  }
}

function expectNoIdentifiers(body: string): void {
  expect(body).not.toContain(SUPPLIER_RFC);
  expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(body).not.toContain("<?xml");
  expect(body).not.toContain("Comprobante");
}

// ---------------------------------------------------------------------------------------------
// (1) The main flow of the phase.

test("agrupar: «No enviar» no manda nada; enviar, cambiar de pestaña, volver, aceptar una sugerencia y recargar conserva el producto y las tarjetas", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const requests = recordRequests(page);
  const mock = await mockLlm(page, { group: twoGroups });
  await logIn(page);
  await pickFolder(page, syntheticFolder);
  await openProducts(page);

  // «No enviar» closes the dialog and nothing reaches the LLM route.
  await page.getByRole("button", { name: "Agrupar productos" }).click();
  await expect(sendDialog(page)).toBeVisible();
  await sendDialog(page).getByRole("button", { name: "No enviar" }).click();
  await expect(sendDialog(page)).toHaveCount(0);
  await settleFrames(page);
  expect(mock.groupCalls).toHaveLength(0);
  expect(requests.filter((r) => r.url.includes("/api/llm/"))).toHaveLength(0);

  // Sending starts the run; the answer waits (held) while the user looks at another tab.
  mock.hold();
  await page.getByRole("button", { name: "Agrupar productos" }).click();
  await sendDialog(page).getByRole("button", { name: "Enviar a DeepSeek" }).click();
  await expect.poll(() => mock.groupCalls.length).toBe(1);
  await expect(page.getByText(/^Agrupando productos · Lote 1 de 1$/)).toBeVisible();

  await page.getByRole("tab", { name: "Dashboard" }).click();
  await expect(page.getByTestId("kpi-gasto")).toBeVisible();
  mock.release();

  // From the Dashboard the end of the run offers «Revisar», which goes back to Productos.
  await page.getByRole("button", { name: "Revisar" }).click();
  const queueHeading = page.getByRole("heading", { name: /^Sugerencias de productos · \d+$/ });
  await expect(queueHeading).toBeVisible();
  await expect(queueHeading).toHaveText("Sugerencias de productos · 2");

  // Accept one card: it lands in «Mis productos»; the other stays in the queue.
  await page.getByRole("button", { name: "Aceptar la sugerencia «Producto de prueba A»" }).click();
  await expect(page.getByRole("heading", { name: "Mis productos · 1 producto" })).toBeVisible();
  await expect(page.getByText("Producto de prueba A", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sugerencias de productos · 1" })).toBeVisible();

  // Only the two keys of the phase exist in the browser storage.
  expect(await storageKeys(page)).toEqual([
    "invoicechecker:settings",
    "invoicechecker:suggestions",
  ]);

  // Reload (accepting the beforeunload prompt) and drop the folder again: the accepted product and
  // the remaining card are still there, and every description is taken, so nothing is free.
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  // The next step waits for the new document: a folder set while the old one unloads is lost.
  const reloaded = page.waitForEvent("load");
  await page.evaluate(() => {
    location.reload();
  });
  await reloaded;
  await expect(
    page.getByText(
      "Por privacidad, las facturas no se guardan; vuelve a soltarlas para analizarlas",
    ),
  ).toBeVisible();
  await pickFolder(page, syntheticFolder);
  await openProducts(page);
  await expect(page.getByRole("heading", { name: "Mis productos · 1 producto" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sugerencias de productos · 1" })).toBeVisible();
  await expect(page.getByText("No hay descripciones nuevas para agrupar")).toBeVisible();
  expect(await storageKeys(page)).toEqual([
    "invoicechecker:settings",
    "invoicechecker:suggestions",
  ]);

  // Exactly one request left the browser for the LLM, and it carried only the strict contract.
  expect(mock.groupCalls).toHaveLength(1);
  expect(mock.categorizeCalls).toHaveLength(0);
  expectOnlyContractBodies(mock);
  expectNoXmlLeavesTheBrowser(requests, { allowLlmBodies: true });
});

// ---------------------------------------------------------------------------------------------
// (2) Cancel.

test("«Detener lotes» durante un lote lento termina en el aviso de cancelado y ninguna tarjeta de ese lote aparece después", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const requests = recordRequests(page);
  const mock = await mockLlm(page, { group: twoGroups });
  await logIn(page);
  await pickFolder(page, syntheticFolder);
  await openProducts(page);

  mock.hold();
  await page.getByRole("button", { name: "Agrupar productos" }).click();
  await sendDialog(page).getByRole("button", { name: "Enviar a DeepSeek" }).click();
  await expect.poll(() => mock.groupCalls.length).toBe(1);
  await expect(page.getByText(/^Agrupando productos · Lote 1 de 1$/)).toBeVisible();

  await page.getByRole("button", { name: "Detener lotes" }).click();
  const canceled = page.getByText(/^Proceso cancelado\. No llegó ninguna sugerencia nueva;/);
  await expect(canceled).toBeVisible();

  // The slow answer is let go after the cancel: the browser must ignore it.
  mock.release();
  await expect.poll(() => mock.settled()).toBe(1);
  await settleFrames(page);
  await expect(page.getByRole("heading", { name: /^Sugerencias de productos/ })).toHaveCount(0);
  await expect(canceled).toBeVisible();
  expect(await storageKeys(page)).not.toContain("invoicechecker:suggestions");

  expectOnlyContractBodies(mock);
  expectNoXmlLeavesTheBrowser(requests, { allowLlmBodies: true });
});

// ---------------------------------------------------------------------------------------------
// (3) «Sugerir categorías».

test("«Sugerir categorías» con una respuesta simulada trae una fila de proveedor; aceptarla cambia «Gasto por categoría»", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const requests = recordRequests(page);
  const mock = await mockLlm(page, { categorize: allToCleaning });
  await logIn(page);
  await pickFolder(page, syntheticFolder);

  // Before: the supplier has no category, so the Dashboard block does not list it.
  await page.getByRole("tab", { name: "Dashboard" }).click();
  const categoryBlock = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Gasto por categoría" }),
  });
  await expect(categoryBlock).toBeVisible();
  await expect(categoryBlock.getByText(CATEGORY, { exact: true })).toHaveCount(0);

  await openProducts(page);
  await page.getByRole("button", { name: "Sugerir categorías" }).click();
  await expect(sendDialog(page)).toBeVisible();
  await sendDialog(page).getByRole("button", { name: "Enviar a DeepSeek" }).click();
  await expect.poll(() => mock.categorizeCalls.length).toBe(1);

  const rowsHeading = page.getByRole("heading", { name: /^Sugerencias de categoría/ });
  await expect(rowsHeading).toBeVisible();
  const select = page.getByRole("combobox", { name: new RegExp(`${SUPPLIER_NAME}$`) });
  await expect(select).toContainText(CATEGORY);

  await page.getByRole("button", { name: `Aceptar la sugerencia «${SUPPLIER_NAME}»` }).click();
  await expect(rowsHeading).toHaveCount(0);

  // After: the supplier's line of «Gasto por categoría» moved to the accepted category.
  await page.getByRole("tab", { name: "Dashboard" }).click();
  await expect(categoryBlock.getByText(CATEGORY, { exact: true })).toBeVisible();

  expect(mock.groupCalls).toHaveLength(0);
  expect(mock.categorizeCalls).toHaveLength(1);
  expectOnlyContractBodies(mock);
  expectNoXmlLeavesTheBrowser(requests, { allowLlmBodies: true });
});

// ---------------------------------------------------------------------------------------------
// (4) and (5) Held-out UI states, seeded with synthetic data.

const LONG_CATEGORY_ID = "e2e:categoria-larga";
const LONG_CATEGORY_NAME = "Categoría sintética de nombre largo para revisar el corte";
const LONG_PRODUCT_NAME =
  "Producto sintético con un nombre de sesenta caracteres exactos para revisar el corte".slice(0, 60);
const LONG_SUPPLIER_NAMES = [1, 2, 3, 4, 5].map((n) =>
  `Proveedor sintético ${String(n)} con razón social muy larga SA DE CV`.slice(0, 45),
);
const LONG_ROW_SUPPLIER = "Distribuidora sintética de nombre muy largo SA".slice(0, 45);

function padded(n: number): string {
  return String(n).padStart(3, "0");
}

/** Synthetic settings: 120 «No agrupar» marks, a product with a 60-character name and a long category. */
function uiStateSettings(): SettingsData {
  const base = defaultSettings();
  return {
    ...base,
    categories: [...base.categories, { id: LONG_CATEGORY_ID, name: LONG_CATEGORY_NAME }],
    products: [
      {
        id: "prod_e2e_largo",
        name: LONG_PRODUCT_NAME,
        categoryId: LONG_CATEGORY_ID,
        members: LONG_SUPPLIER_NAMES.map((supplierName, index) => ({
          rfc: `AAA01010${String(index + 1)}AA1`,
          key: `descripcion sintetica ${String(index + 1)}`,
          description: `Descripción sintética ${String(index + 1)} del producto de prueba`,
          supplierName,
        })),
      },
    ],
    ungroupedConcepts: Array.from({ length: 120 }, (_, index) => ({
      rfc: `BBB01010${String((index % 5) + 1)}BB1`,
      key: `marca sintetica ${padded(index + 1)}`,
      description: `Descripción marcada de prueba número ${padded(index + 1)}`,
      supplierName: LONG_SUPPLIER_NAMES[index % 5] ?? "Proveedor sintético",
    })),
  };
}

/** A pending queue with one category row of a 45-character supplier name and a card or two. */
function uiStateQueue(): PendingQueue {
  return {
    products: [
      {
        id: "sug_e2e_1",
        name: "Producto pendiente 1",
        target: null,
        members: [
          {
            rfc: "CCC010101CC1",
            key: "pendiente sintetico uno",
            description: "Pendiente sintético uno",
            supplierName: "Proveedor pendiente 1",
          },
          {
            rfc: "CCC010101CC2",
            key: "pendiente sintetico dos",
            description: "Pendiente sintético dos",
            supplierName: "Proveedor pendiente 2",
          },
        ],
      },
    ],
    categories: [
      {
        id: "cat_e2e_1",
        kind: "supplier",
        rfc: "DDD010101DD1",
        name: LONG_ROW_SUPPLIER,
        choice: { kind: "existing", categoryId: LONG_CATEGORY_ID },
      },
      {
        id: "cat_e2e_2",
        kind: "supplier",
        rfc: "DDD010101DD2",
        name: "Proveedor corto",
        choice: { kind: "existing", categoryId: OTROS_ID },
      },
    ],
  };
}

interface PageMeasures {
  pageScrollWidth: number;
  innerWidth: number;
}

async function measurePage(page: Page): Promise<PageMeasures> {
  return page.evaluate(() => ({
    pageScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

/** Opens a Collapsible-style trigger only when it is closed. */
async function ensureExpanded(trigger: Locator): Promise<void> {
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

test("estados de interfaz: 120 marcas «No agrupar», un producto de 60 caracteres con cinco proveedores largos y una fila de categoría con nombre largo, a 360 y 1280 px", async ({
  page,
}) => {
  test.setTimeout(180_000);
  expect(LONG_PRODUCT_NAME).toHaveLength(60);
  expect(LONG_CATEGORY_NAME.length).toBeLessThanOrEqual(60);
  const requests = recordRequests(page);
  await seedStorage(page, { settings: uiStateSettings(), queue: uiStateQueue() });
  await logIn(page);
  await pickFolder(page, syntheticFolder);
  await openProducts(page);

  for (const size of [
    { width: 360, height: 800 },
    { width: 1280, height: 900 },
  ]) {
    const tag = String(size.width);
    await page.setViewportSize(size);

    // The «No agrupar» list: open, with the 120 rows inside a box of at most 288 px.
    const marksTrigger = page.getByRole("button", {
      name: /^Descripciones marcadas «No agrupar» \(120\)/,
    });
    await marksTrigger.scrollIntoViewIfNeeded();
    await ensureExpanded(marksTrigger);
    const viewport = page
      .locator('[data-slot="collapsible-content"] [data-slot="scroll-area-viewport"]')
      .first();
    await expect(viewport).toBeVisible();
    const box = await viewport.boundingBox();
    expect(box, `«No agrupar» viewport at ${tag} px`).not.toBeNull();
    expect(box?.height ?? Infinity).toBeLessThanOrEqual(288);
    const scrolls = await viewport.evaluate((element) => element.scrollHeight > element.clientHeight);
    expect(scrolls, `«No agrupar» list scrolls inside its box at ${tag} px`).toBe(true);

    // One product row open: its five members come from five long supplier names.
    const expander = page.getByRole("button", {
      name: new RegExp(`^(Ver|Ocultar) miembros de ${LONG_PRODUCT_NAME}$`),
    });
    if ((await expander.getAttribute("aria-expanded")) !== "true") await expander.click();
    await expect(expander).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Descripción sintética 5 del producto de prueba")).toBeVisible();

    // The page never scrolls sideways; tables scroll inside their own container.
    const measures = await measurePage(page);
    expect(measures.pageScrollWidth, `page width at ${tag} px`).toBeLessThanOrEqual(
      measures.innerWidth,
    );

    await page.screenshot({
      path: join(SHOTS_DIR, `${tag}-productos.png`),
      fullPage: true,
    });

    // The category row with the long name: the open Select shows the long category in full.
    const rowSelect = page.getByRole("combobox", {
      name: new RegExp(`${LONG_ROW_SUPPLIER.slice(0, 20)}`),
    });
    await rowSelect.scrollIntoViewIfNeeded();
    await expect(rowSelect).toContainText(LONG_CATEGORY_NAME.slice(0, 10));
    await rowSelect.click();
    await expect(page.getByRole("option", { name: LONG_CATEGORY_NAME })).toBeVisible();
    await page.screenshot({
      path: join(SHOTS_DIR, `${tag}-select-abierto.png`),
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("option", { name: LONG_CATEGORY_NAME })).toHaveCount(0);
    const after = await measurePage(page);
    expect(after.pageScrollWidth, `page width after the Select at ${tag} px`).toBeLessThanOrEqual(
      after.innerWidth,
    );
  }

  expectNoXmlLeavesTheBrowser(requests, { allowLlmBodies: true });
});

/** What the five tabs do at one width: do they wrap, does the list scroll or fit, does the page scroll sideways. */
async function measureTabs(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  const list = page.getByRole("tablist", { name: "Secciones" });
  await expect(list.getByRole("tab")).toHaveCount(5);
  const own = await list.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  // No tab wraps onto a second row: they all share the same top.
  const tops = await list
    .getByRole("tab")
    .evaluateAll((tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
  return { ...own, rows: new Set(tops).size, ...(await measurePage(page)) };
}

test("a 700 y 767 px las cinco pestañas con contadores no se parten en filas, caben o se desplazan dentro de su lista y la página no se desplaza de lado", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const requests = recordRequests(page);
  await seedStorage(page, { settings: uiStateSettings(), queue: uiStateQueue() });
  await logIn(page);
  await pickFolder(page, syntheticFolder);

  for (const width of [700, 767]) {
    const measures = await measureTabs(page, width);
    const label = `${String(width)} px`;
    expect(measures.rows, `tab rows at ${label}`).toBe(1);
    // Either everything fits, or the list scrolls inside itself (overflow-x auto).
    if (measures.scrollWidth > measures.clientWidth) {
      expect(["auto", "scroll"], `list overflow-x at ${label}`).toContain(measures.overflowX);
    }
    expect(measures.pageScrollWidth, `page width at ${label}`).toBeLessThanOrEqual(
      measures.innerWidth,
    );
  }

  await page.setViewportSize({ width: 700, height: 900 });
  await page.screenshot({ path: join(SHOTS_DIR, "700-pestanas.png") });
  expectNoXmlLeavesTheBrowser(requests, { allowLlmBodies: true });
});

// Known gap, logged in .planning/phases/04-agrupaci-n-de-productos-con-deepseek/deferred-items.md:
// the tab list scrolls only below 640 px (`max-sm:overflow-x-auto` in AppShell.tsx), so at exactly
// 640 px the five tabs with a counter are 17 px wider than the list and overflow it visibly. The
// page itself does not scroll sideways. `test.fail` keeps the check alive: when the shell is fixed
// this test starts passing, Playwright reports it, and the marker is removed.
test("a 640 px la lista de pestañas con contadores se desplaza dentro de sí misma", async ({
  page,
}) => {
  test.fail(true, "Known gap: the tab list only scrolls below 640 px (deferred-items.md)");
  test.setTimeout(180_000);
  await seedStorage(page, { settings: uiStateSettings(), queue: uiStateQueue() });
  await logIn(page);
  await pickFolder(page, syntheticFolder);

  const measures = await measureTabs(page, 640);
  expect(measures.rows, "tab rows at 640 px").toBe(1);
  expect(measures.pageScrollWidth, "page width at 640 px").toBeLessThanOrEqual(measures.innerWidth);
  if (measures.scrollWidth > measures.clientWidth) {
    expect(["auto", "scroll"], "list overflow-x at 640 px").toContain(measures.overflowX);
  }
});

// ---------------------------------------------------------------------------------------------
// (6) The safety net behind the mocks.

test("sin la clave de DeepSeek en el servidor, una llamada sin simular termina en server_not_configured", async ({
  page,
}) => {
  await logIn(page);
  const response = await page.request.post("/api/llm/group", {
    data: { items: [{ id: "i1", description: "Descripción sintética", supplier: "Proveedor" }], existing: [] },
  });
  expect(response.status()).toBe(500);
  expect(await response.json()).toEqual({ error: "server_not_configured", retryable: false });
});
