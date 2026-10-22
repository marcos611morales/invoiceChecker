// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextRequest } from "next/server";
import { z } from "zod";
import { POST } from "@/app/api/llm/categorize/route";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { categorizeRequestSchema, type CategorizeRequest } from "@/domain/llm/contract";
import { pendingQueueSchema } from "@/domain/llm/suggestions";
import { useLlmRunStore } from "@/stores/llmRunStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { stubDeepseekEnv } from "../../../tests/support/deepseekEnv";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import {
  readStoredQueue,
  resetSuggestionsStore,
} from "../../../tests/support/suggestionsStorage";
import { ProductsTab } from "./ProductsTab";

const { TEST_SESSION } = vi.hoisted(() => ({ TEST_SESSION: "test-session-token" }));

// Same replacement as ProductsTab.test.tsx: a request is signed in exactly when it carries the
// cookie below; route.test.ts proves the real session check.
vi.mock("@/lib/server/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/session")>();
  return {
    ...actual,
    verifySessionToken: (token: string | undefined) => Promise.resolve(token === TEST_SESSION),
  };
});

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const KEY = `sk-test-${crypto.randomUUID()}`;

const UNO = { rfc: "AAA010101AAA", nombre: "Tienda Uno" };
const DOS = { rfc: "BBB020202BBB", nombre: "Tienda Dos" };
const RECEPTOR = { rfc: "CAF030303CCC", nombre: "Coworking de prueba" };
const INVOICE_UUID = "11111111-2222-4333-8444-555555555501";
const FOLIO = "F-90210";
const TOTAL = "2468.13";

function concepto(descripcion: string): Concepto {
  return {
    claveProdServ: "50202306",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion,
    valorUnitario: "100.00",
    importe: "100.00",
    descuento: null,
    objetoImp: "01",
    traslados: [],
    retenciones: [],
  };
}

function invoice(index: number, emisor: { rfc: string; nombre: string }): ParsedInvoice {
  return makeInvoice({
    uuid: index === 0 ? INVOICE_UUID : `22222222-3333-4444-8555-66666666660${String(index)}`,
    serie: "ZZ",
    folio: FOLIO,
    fecha: "2025-03-03T09:00:00",
    subTotal: "2123.00",
    total: TOTAL,
    emisor,
    receptor: RECEPTOR,
    conceptos: [concepto("MM LECHE ENT")],
  });
}

function seed(invoices: readonly ParsedInvoice[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      invoices.map((entry) => ({
        kind: "parsed" as const,
        file: { name: `${entry.uuid}.xml`, path: `${entry.uuid}.xml` },
        result: { ok: true as const, invoice: entry },
      })),
      store.generation,
    );
  });
}

const MM_LECHE = {
  rfc: UNO.rfc,
  key: "mm leche ent",
  description: "MM LECHE ENT",
  supplierName: UNO.nombre,
};
const LECHE_1L = {
  rfc: DOS.rfc,
  key: "leche entera 1l",
  description: "LECHE ENTERA 1L",
  supplierName: DOS.nombre,
};

/** An accepted product with no category and two members from two suppliers. */
function acceptLeche(categoryId: string | null = null): void {
  act(() => {
    useSettingsStore.setState({
      products: [
        { id: "prod_leche", name: "Leche entera", categoryId, members: [MM_LECHE, LECHE_1L] },
      ],
    });
  });
}

const routeBodies: CategorizeRequest[] = [];
let upstreamStatus = 200;
let upstreamRequests = 0;

function bodyText(init: RequestInit | undefined): string {
  if (typeof init?.body !== "string") throw new Error("expected a string request body");
  return init.body;
}

function completion(content: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }],
      usage: { prompt_tokens: 50, completion_tokens: 20, completion_tokens_details: { reasoning_tokens: 0 } },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** The stubbed DeepSeek: the first supplier goes to c1, any other supplier to a new «Servicios», each product to a new «Bebidas». */
function upstreamAnswer(init: RequestInit): Response {
  upstreamRequests += 1;
  if (upstreamStatus !== 200) return new Response("{}", { status: upstreamStatus });
  const messages = z
    .array(z.object({ role: z.string(), content: z.string() }))
    .parse(z.object({ messages: z.unknown() }).parse(JSON.parse(bodyText(init))).messages);
  const request = categorizeRequestSchema.parse(JSON.parse(messages[1]?.content ?? "null"));
  return completion({
    a: [
      ...request.suppliers.map((supplier, index) =>
        index === 0
          ? { i: supplier.id, c: "c1", n: null }
          : { i: supplier.id, c: null, n: "Servicios" },
      ),
      ...request.products.map((product) => ({ i: product.id, c: null, n: "Bebidas" })),
    ],
  });
}

const fetchMock = vi.fn(
  async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "/api/llm/categorize") {
      routeBodies.push(categorizeRequestSchema.parse(JSON.parse(bodyText(init))));
      const headers = new Headers(init?.headers);
      headers.set("cookie", `session=${TEST_SESSION}`);
      return POST(
        new NextRequest("http://localhost/api/llm/categorize", {
          method: init?.method,
          headers,
          body: init?.body,
          signal: init?.signal ?? undefined,
        }),
      );
    }
    if (url === DEEPSEEK_URL && init !== undefined) return upstreamAnswer(init);
    throw new Error(`unexpected fetch to ${url}`);
  },
);

function categorizeButton(): HTMLElement {
  return screen.getByRole("button", { name: "Sugerir categorías" });
}

function dialog(): HTMLElement {
  return screen.getByRole("alertdialog");
}

async function openDialog(): Promise<HTMLElement> {
  fireEvent.click(categorizeButton());
  return screen.findByRole("alertdialog");
}

/** The row of the «Sugerencias de categoría» section that holds this name. */
function categoryRow(name: string): HTMLElement {
  const section = screen.getByRole("heading", { name: /^Sugerencias de categoría · / }).closest("section");
  if (section === null) throw new Error("the category section is not rendered");
  const row = within(section).getByText(name).closest("tr");
  if (row === null) throw new Error(`no row for ${name}`);
  return row;
}

async function confirm(): Promise<void> {
  fireEvent.click(within(dialog()).getByRole("button", { name: "Enviar a DeepSeek" }));
  await waitFor(() => {
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
}

beforeEach(() => {
  stubDeepseekEnv(KEY);
  routeBodies.length = 0;
  upstreamStatus = 200;
  upstreamRequests = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
  seed([invoice(0, UNO), invoice(1, DOS)]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  act(() => {
    useSessionStore.getState().clearAll();
    useLlmRunStore.setState({ status: { phase: "idle" }, controller: null });
  });
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
});

describe("Sugerir categorías: the entry button and its caption (D-02, D-07, A-2)", () => {
  it("counts the loaded suppliers without a default category", () => {
    render(<ProductsTab />);
    expect(screen.getByText("2 proveedores sin categoría")).toBeInTheDocument();
    expect(categorizeButton()).toHaveAccessibleDescription("2 proveedores sin categoría");
    expect(categorizeButton()).not.toHaveAttribute("aria-disabled", "true");
  });

  it("counts the accepted products without a category too, and omits a zero part", () => {
    acceptLeche();
    render(<ProductsTab />);
    expect(screen.getByText("2 proveedores y 1 producto sin categoría")).toBeInTheDocument();
  });

  it("does not count a supplier with a default category nor a product with a category", () => {
    act(() => {
      useSettingsStore.setState({
        supplierCategories: [{ rfc: UNO.rfc, name: UNO.nombre, categoryId: "seed:otros" }],
      });
    });
    acceptLeche("seed:otros");
    render(<ProductsTab />);
    expect(screen.getByText("1 proveedor sin categoría")).toBeInTheDocument();
  });

  it("reads «No hay proveedores ni productos sin categoría», is aria-disabled and opens nothing when nothing qualifies", () => {
    act(() => {
      useSettingsStore.setState({
        supplierCategories: [
          { rfc: UNO.rfc, name: UNO.nombre, categoryId: "seed:otros" },
          { rfc: DOS.rfc, name: DOS.nombre, categoryId: "seed:otros" },
        ],
      });
    });
    render(<ProductsTab />);
    expect(screen.getByText("No hay proveedores ni productos sin categoría")).toBeInTheDocument();
    expect(categorizeButton()).toHaveAttribute("aria-disabled", "true");
    expect(categorizeButton()).not.toBeDisabled();
    fireEvent.click(categorizeButton());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Sugerir categorías: the send dialog (D-07, D-08, LLM-06)", () => {
  it("states the counts, the people line and lists exactly what is sent, with the members under their product", async () => {
    acceptLeche();
    render(<ProductsTab />);
    await openDialog();
    expect(
      within(dialog()).getByText(
        "Se enviarán a DeepSeek 2 nombres de proveedor, 1 nombre de producto con las descripciones de sus 2 miembros y los nombres de tus 9 categorías. No se envían RFC, UUID, montos, fechas ni folios.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog()).getByText(
        "Algunos nombres de proveedor pueden ser nombres de personas. DeepSeek es un servicio externo a esta aplicación.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog()).getByRole("button", { name: /Ver exactamente qué se envía/ }),
    );
    for (const heading of [
      "Proveedores sin categoría (2)",
      "Productos sin categoría (1)",
      "Tus categorías (9)",
    ]) {
      expect(within(dialog()).getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    const productItem = within(dialog()).getByText("Leche entera").closest("li");
    if (productItem === null) throw new Error("the product is not listed");
    expect(within(productItem).getByText("MM LECHE ENT")).toBeInTheDocument();
    expect(within(productItem).getByText("LECHE ENTERA 1L")).toBeInTheDocument();
    expect(within(dialog()).getByText("Tienda Uno")).toBeInTheDocument();
    expect(within(dialog()).getByText("Tienda Dos")).toBeInTheDocument();
    expect(within(dialog()).getByText("Abarrotes y despensa")).toBeInTheDocument();
    // No RFC, UUID, folio or amount is on the screen of the dialog.
    for (const hidden of [UNO.rfc, DOS.rfc, INVOICE_UUID, FOLIO, TOTAL, "prod_leche"]) {
      expect(dialog().textContent).not.toContain(hidden);
    }
  });

  it("«No enviar» closes the dialog and sends nothing", async () => {
    render(<ProductsTab />);
    await openDialog();
    fireEvent.click(within(dialog()).getByRole("button", { name: "No enviar" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives «No enviar» the initial focus", async () => {
    render(<ProductsTab />);
    await openDialog();
    await waitFor(() => {
      expect(within(dialog()).getByRole("button", { name: "No enviar" })).toHaveFocus();
    });
  });
});

describe("Sugerir categorías: the run through the real route (LLM-02, D-23, LLM-06)", () => {
  async function sendAndLand(): Promise<void> {
    await openDialog();
    await confirm();
    await screen.findByRole("heading", { name: /Sugerencias de categoría · / });
  }

  it("sends only names, lands one row per supplier or product and applies nothing until «Aceptar»", async () => {
    acceptLeche();
    render(<ProductsTab />);
    const before = {
      categories: useSettingsStore.getState().categories,
      supplierCategories: useSettingsStore.getState().supplierCategories,
      products: useSettingsStore.getState().products,
    };
    await sendAndLand();

    // What travelled: the strict body, no RFC and no invoice data, and the key only in the header.
    expect(routeBodies).toHaveLength(1);
    const sent = JSON.stringify(routeBodies[0]);
    for (const forbidden of [UNO.rfc, DOS.rfc, INVOICE_UUID, FOLIO, TOTAL, "prod_leche", KEY]) {
      expect(sent).not.toContain(forbidden);
    }
    expect(routeBodies[0]?.suppliers.map((supplier) => supplier.name)).toEqual([
      "Tienda Dos",
      "Tienda Uno",
    ]);
    expect(routeBodies[0]?.products).toEqual([
      { id: "q1", name: "Leche entera", members: ["MM LECHE ENT", "LECHE ENTERA 1L"] },
    ]);

    // The rows: type, name and the Select already set on the suggested category.
    expect(screen.getByRole("heading", { name: "Sugerencias de categoría · 3" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "DeepSeek propone una categoría para cada proveedor y producto que aún no tiene. Puedes cambiarla antes de aceptar.",
      ),
    ).toBeInTheDocument();
    const rows = useSuggestionsStore.getState().categories;
    expect(rows.map((row) => row.name)).toEqual(["Tienda Dos", "Tienda Uno", "Leche entera"]);
    expect(rows[0]?.choice).toEqual({ kind: "existing", categoryId: "seed:abarrotes-despensa" });
    expect(rows[1]?.choice).toEqual({ kind: "new", name: "Servicios" });
    expect(rows[2]?.choice).toEqual({ kind: "new", name: "Bebidas" });
    const selectOf = (name: string): HTMLElement =>
      within(categoryRow(name)).getByRole("combobox", { name: `Categoría sugerida para ${name}` });
    expect(within(categoryRow("Tienda Dos")).getByText("Proveedor")).toBeInTheDocument();
    expect(selectOf("Tienda Dos")).toHaveTextContent("Abarrotes y despensa");
    expect(within(categoryRow("Tienda Uno")).getByText("Proveedor")).toBeInTheDocument();
    expect(selectOf("Tienda Uno")).toHaveTextContent("Nueva: Servicios");
    expect(within(categoryRow("Leche entera")).getByText("Producto")).toBeInTheDocument();
    expect(selectOf("Leche entera")).toHaveTextContent("Nueva: Bebidas");

    // Nothing was applied (LLM-04).
    expect(useSettingsStore.getState().categories).toEqual(before.categories);
    expect(useSettingsStore.getState().supplierCategories).toEqual(before.supplierCategories);
    expect(useSettingsStore.getState().products).toEqual(before.products);

    // The rows survive a reload: they are in the stored queue, which the stored schema accepts.
    const stored = z.object({ state: z.unknown() }).parse(await readStoredQueue());
    const parsed = pendingQueueSchema.safeParse(stored.state);
    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.categories : []).toHaveLength(3);
    expect(JSON.stringify(stored.state)).not.toContain(KEY);
  });

  it("shows «Sugiriendo categorías · Lote 1 de 1» while the batch is in flight", async () => {
    let release: () => void = () => undefined;
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((resolve) => {
          release = () => {
            const headers = new Headers(init?.headers);
            headers.set("cookie", `session=${TEST_SESSION}`);
            resolve(
              POST(
                new NextRequest("http://localhost/api/llm/categorize", {
                  method: init?.method,
                  headers,
                  body: init?.body,
                  signal: init?.signal ?? undefined,
                }),
              ),
            );
          };
        }),
    );
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await waitFor(() => {
      expect(screen.getByText("Sugiriendo categorías · Lote 1 de 1")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Detener lotes" })).toBeInTheDocument();
    expect(screen.getAllByText("Hay un proceso en curso")).toHaveLength(2);
    expect(categorizeButton()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(categorizeButton());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    release();
    await screen.findByRole("heading", { name: "Sugerencias de categoría · 2" });
    expect(useLlmRunStore.getState().status).toMatchObject({
      phase: "finished",
      kind: "categorize",
      received: 2,
    });
  });

  it("asks again for nothing already pending: the caption turns to «No hay proveedores ni productos sin categoría»", async () => {
    render(<ProductsTab />);
    await sendAndLand();
    expect(screen.getByText("No hay proveedores ni productos sin categoría")).toBeInTheDocument();
    expect(categorizeButton()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(categorizeButton());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("«Reintentar» after a failed batch opens the categorize dialog again, with the targets still free", async () => {
    upstreamStatus = 500;
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    expect(screen.getByText("1 lote falló")).toBeInTheDocument();
    expect(upstreamRequests).toBe(2);
    expect(useSuggestionsStore.getState().categories).toEqual([]);
    fireEvent.click(retry);
    const again = await screen.findByRole("alertdialog");
    expect(
      within(again).getByText(/^Se enviarán a DeepSeek 2 nombres de proveedor y los nombres de tus 9 categorías\./),
    ).toBeInTheDocument();
  });
});
