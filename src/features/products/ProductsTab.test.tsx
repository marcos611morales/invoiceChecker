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
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { POST } from "@/app/api/llm/group/route";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { groupRequestSchema, type GroupRequest } from "@/domain/llm/contract";
import type { SuggestionMember } from "@/domain/llm/suggestions";
import { normalizeDescription } from "@/domain/settings/normalize";
import { useLlmRunStore } from "@/stores/llmRunStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import {
  cardOf,
  findNameInput,
  memberCheckboxes,
  nameInput,
  nameInputs,
} from "../../../tests/support/reviewQueue";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import {
  readStoredQueue,
  resetSuggestionsStore,
  storeQueue,
} from "../../../tests/support/suggestionsStorage";
import { ProductsTab } from "./ProductsTab";

const { TEST_SESSION } = vi.hoisted(() => ({ TEST_SESSION: "test-session-token" }));

// jose rejects the keys it builds under jsdom (a Uint8Array from another realm), so only the
// token check is replaced: a request is signed in exactly when it carries the cookie below.
// route.test.ts proves the real session check; here the handler's decision on the cookie is
// what matters, so a request without the cookie still gets the proxy's 401 from requireSession.
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

/** Values that identify an invoice; none of them may ever be in a request body. */
const INVOICE_UUIDS = [
  "11111111-2222-4333-8444-555555555501",
  "11111111-2222-4333-8444-555555555502",
  "11111111-2222-4333-8444-555555555503",
  "11111111-2222-4333-8444-555555555504",
];
const FOLIO = "F-90210";
const FECHA = "2025-03-03T09:00:00";
const TOTAL = "2468.13";
const SUBTOTAL = "2123.00";

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

function invoice(
  index: number,
  emisor: { rfc: string; nombre: string | null },
  descriptions: readonly string[],
  tipo: ParsedInvoice["tipo"] = "I",
): ParsedInvoice {
  return makeInvoice({
    uuid: INVOICE_UUIDS[index] ?? `00000000-0000-4000-8000-0000000009${String(index)}`,
    serie: "ZZ",
    folio: FOLIO,
    fecha: FECHA,
    subTotal: SUBTOTAL,
    total: TOTAL,
    tipo,
    emisor,
    receptor: RECEPTOR,
    conceptos: descriptions.map(concepto),
  });
}

/**
 * Two suppliers, four invoices. Distinct pairs of supplier and normalized description:
 * Tienda Uno has «MM LECHE ENT» (twice, the second one spelled with two spaces),
 * «Café Molido 1kg» and «Azúcar»; Tienda Dos has «LECHE ENTERA 1L» and, on a tipo P
 * invoice, «Pago». That is five rows.
 */
function sample(): ParsedInvoice[] {
  return [
    invoice(0, UNO, ["MM LECHE ENT", "Café Molido 1kg"]),
    invoice(1, UNO, ["mm  leche ent", "Azúcar"]),
    invoice(2, DOS, ["LECHE ENTERA 1L"]),
    invoice(3, DOS, ["Pago"], "P"),
  ];
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

interface UpstreamCall {
  url: string;
  init: RequestInit;
}

const upstreamCalls: UpstreamCall[] = [];
/** The session cookie the browser sends; null simulates a browser that lost its session. */
let sessionToken: string | null = null;
const routeBodies: GroupRequest[] = [];
const routeResponseTexts: string[] = [];
let upstream: (body: GroupRequest) => Response | Promise<Response>;

function bodyText(init: RequestInit | undefined): string {
  if (typeof init?.body !== "string") throw new Error("expected a string request body");
  return init.body;
}

function completion(content: unknown, finishReason = "stop"): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finishReason,
          message: {
            content: typeof content === "string" ? content : JSON.stringify(content),
          },
        },
      ],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 40,
        completion_tokens_details: { reasoning_tokens: 0 },
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function lastBody(): GroupRequest {
  const body = routeBodies[routeBodies.length - 1];
  if (body === undefined) throw new Error("no request was sent");
  return body;
}

/** The id the builder gave to a description in a request body. */
function idOf(body: GroupRequest, description: string): string {
  const found = body.items.find((item) => item.description === description);
  if (found === undefined) throw new Error(`no item for ${description}`);
  return found.id;
}

/** Answers the browser's call by running the real route handler; DeepSeek is the only stub. */
const fetchMock = vi.fn(
  async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "/api/llm/group") {
      routeBodies.push(groupRequestSchema.parse(JSON.parse(bodyText(init))));
      const headers = new Headers(init?.headers);
      if (sessionToken !== null) headers.set("cookie", `session=${sessionToken}`);
      const request = new NextRequest("http://localhost/api/llm/group", {
        method: init?.method,
        headers,
        body: init?.body,
        signal: init?.signal ?? undefined,
      });
      const response = await POST(request);
      routeResponseTexts.push(await response.clone().text());
      return response;
    }
    if (url === DEEPSEEK_URL && init !== undefined) {
      upstreamCalls.push({ url, init });
      return upstream(lastBody());
    }
    throw new Error(`unexpected fetch to ${url}`);
  },
);

function dialog(): HTMLElement {
  return screen.getByRole("alertdialog");
}

async function openDialog(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole("button", { name: "Agrupar productos" }));
  return screen.findByRole("alertdialog");
}

function dialogRows(): { description: string; supplier: string }[] {
  fireEvent.click(
    within(dialog()).getByRole("button", { name: /Ver exactamente qué se envía/ }),
  );
  return within(dialog())
    .getAllByRole("listitem")
    .map((row) => {
      const [description, supplier] = Array.from(row.querySelectorAll("span")).map(
        (span) => span.textContent,
      );
      return { description: description ?? "", supplier: supplier ?? "" };
    });
}

async function confirm(): Promise<void> {
  fireEvent.click(within(dialog()).getByRole("button", { name: "Enviar a DeepSeek" }));
  await waitFor(() => {
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
}

/**
 * Groups two descriptions of different suppliers into «Leche entera» and leaves every other
 * description in a group of its own, named like it: the route refuses an answer that does not
 * cover each sent id exactly once (D-11).
 */
function milkAnswer(body: GroupRequest): Response {
  const milk = body.items
    .filter((item) => item.description === "MM LECHE ENT" || item.description === "LECHE ENTERA 1L")
    .map((item) => item.id);
  const rest = body.items
    .filter((item) => !milk.includes(item.id))
    .map((item) => ({ n: item.description, i: [item.id], e: null }));
  return completion({ g: [{ n: "Leche entera", i: milk, e: null }, ...rest] });
}

beforeEach(() => {
  vi.stubEnv("DEEPSEEK_API_KEY", KEY);
  vi.stubEnv("DEEPSEEK_MODEL", undefined);
  upstreamCalls.length = 0;
  routeBodies.length = 0;
  routeResponseTexts.length = 0;
  upstream = milkAnswer;
  sessionToken = TEST_SESSION;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
  seed(sample());
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

describe("Agrupar productos: the send dialog (D-03, D-08, LLM-06)", () => {
  it("lists one row per distinct pair of supplier and description, tipo P included and a repeated line once, and those rows are the serialized body", async () => {
    render(<ProductsTab />);
    await openDialog();
    const rows = dialogRows();
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.description).sort()).toEqual(
      ["Azúcar", "Café Molido 1kg", "LECHE ENTERA 1L", "MM LECHE ENT", "Pago"].sort(),
    );
    expect(
      rows.find((row) => row.description === "Pago")?.supplier,
    ).toBe("Tienda Dos");
    await confirm();
    await waitFor(() => {
      expect(routeBodies).toHaveLength(1);
    });
    expect(lastBody().items.map(({ description, supplier }) => ({ description, supplier }))).toEqual(
      rows,
    );
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

  it("never sends the RFC of a supplier that has no name other than its RFC", async () => {
    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed([invoice(0, UNO, ["Azúcar"]), invoice(1, { rfc: "XXX040404XXX", nombre: null }, ["Sal"])]);
    render(<ProductsTab />);
    await openDialog();
    expect(dialogRows()).toEqual([{ description: "Azúcar", supplier: "Tienda Uno" }]);
  });
});

describe("Agrupar productos: the round trip through the real route (LLM-01, LLM-03, ACC-04, D-29)", () => {
  it("brings suggestion cards with their name and one row per member", async () => {
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    const card = cardOf(await findNameInput("Leche entera"));
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    expect(within(card).getByText("MM LECHE ENT")).toBeInTheDocument();
    // The supplier name opens the line caption («Tienda Uno · 2 líneas»).
    expect(within(card).getByText(/^Tienda Uno/)).toBeInTheDocument();
    expect(within(card).getByText("LECHE ENTERA 1L")).toBeInTheDocument();
    expect(within(card).getByText(/^Tienda Dos/)).toBeInTheDocument();
  });

  it("calls DeepSeek with the documented request and the server-side key", async () => {
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await findNameInput("Leche entera");
    expect(upstreamCalls).toHaveLength(1);
    const call = upstreamCalls[0];
    if (call === undefined) return;
    expect(call.url).toBe(DEEPSEEK_URL);
    expect(call.init.method).toBe("POST");
    expect(new Headers(call.init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    const body = z.record(z.string(), z.unknown()).parse(JSON.parse(bodyText(call.init)));
    expect(body).toMatchObject({
      model: "deepseek-flash",
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 6144,
      stream: false,
    });
  });

  it("sends a body with only items and existing, and none of the identifiers of the invoices", async () => {
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await findNameInput("Leche entera");
    const body = lastBody();
    expect(Object.keys(body).sort()).toEqual(["existing", "items"]);
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(["description", "id", "supplier"]);
    }
    const serialized = JSON.stringify(body);
    for (const secret of [
      UNO.rfc,
      DOS.rfc,
      RECEPTOR.rfc,
      ...INVOICE_UUIDS,
      FOLIO,
      FECHA,
      "2025-03-03",
      TOTAL,
      SUBTOTAL,
    ]) {
      expect(serialized).not.toContain(secret);
    }
    // The user message that reaches DeepSeek carries the same data and nothing more.
    const call = upstreamCalls[0];
    if (call === undefined) return;
    const text = bodyText(call.init);
    for (const secret of [UNO.rfc, DOS.rfc, RECEPTOR.rfc, ...INVOICE_UUIDS, FOLIO, TOTAL, KEY]) {
      expect(text).not.toContain(secret);
    }
  });

  it("leaves nothing free after a complete answer", async () => {
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await findNameInput("Leche entera");
    await waitFor(() => {
      expect(useLlmRunStore.getState().status.phase).toBe("finished");
    });
    expect(useSuggestionsStore.getState().products).toHaveLength(4);
    expect(screen.getByText("No hay descripciones nuevas para agrupar")).toBeInTheDocument();
  });

  it("sends only the still-free items on a second press, and leaves the pending cards as they were", async () => {
    act(() => {
      useSuggestionsStore.getState().enqueueProducts([
        {
          id: "sug_pending",
          name: "Leche entera",
          target: null,
          members: [
            {
              rfc: UNO.rfc,
              key: "mm leche ent",
              description: "MM LECHE ENT",
              supplierName: UNO.nombre,
            },
            {
              rfc: DOS.rfc,
              key: "leche entera 1l",
              description: "LECHE ENTERA 1L",
              supplierName: DOS.nombre,
            },
          ],
        },
      ]);
    });
    const first = useSuggestionsStore.getState().products;
    upstream = (body) =>
      completion({
        g: [
          { n: "Azúcar blanca", i: [idOf(body, "Azúcar")], e: null },
          { n: "Café", i: [idOf(body, "Café Molido 1kg")], e: null },
          { n: "Pago", i: [idOf(body, "Pago")], e: null },
        ],
      });
    render(<ProductsTab />);
    await openDialog();
    expect(dialogRows().map((row) => row.description).sort()).toEqual(
      ["Azúcar", "Café Molido 1kg", "Pago"].sort(),
    );
    await confirm();
    await findNameInput("Azúcar blanca");
    expect(lastBody().items).toHaveLength(3);
    const all = useSuggestionsStore.getState().products;
    expect(all).toHaveLength(4);
    expect(all[0]).toBe(first[0]);
  });

  it("keeps the run when the tab is unmounted while the batch is in flight", async () => {
    let release: () => void = () => undefined;
    upstream = (body) =>
      new Promise<Response>((resolve) => {
        release = () => {
          resolve(milkAnswer(body));
        };
      });
    const view = render(<ProductsTab />);
    await openDialog();
    await confirm();
    await waitFor(() => {
      expect(useLlmRunStore.getState().status.phase).toBe("running");
    });
    view.unmount();
    release();
    await waitFor(() => {
      expect(useSuggestionsStore.getState().products).toHaveLength(4);
    });
    render(<ProductsTab />);
    expect(nameInput("Leche entera")).toBeInTheDocument();
  });

  it("stops the run with upstream_auth on a DeepSeek 401, adds no card and never shows the key", async () => {
    upstream = () => new Response(JSON.stringify({ error: { message: KEY } }), { status: 401 });
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await waitFor(() => {
      expect(useLlmRunStore.getState().status).toEqual({
        phase: "stopped",
        kind: "group",
        batch: 1,
        total: 1,
        received: 0,
        error: "upstream_auth",
      });
    });
    expect(useSuggestionsStore.getState().products).toEqual([]);
    expect(routeResponseTexts).toHaveLength(1);
    expect(routeResponseTexts.join("\n")).not.toContain(KEY);
  });

  it("returns only our own JSON, never the key, on success", async () => {
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await findNameInput("Leche entera");
    expect(routeResponseTexts.join("\n")).not.toContain(KEY);
    const parsed = z
      .object({ groups: z.array(z.unknown()), meta: z.object({ attempts: z.literal(1) }) })
      .safeParse(JSON.parse(routeResponseTexts[0] ?? "null"));
    expect(parsed.success).toBe(true);
  });
});

const SUMMARY_PLURAL =
  "Se enviarán a DeepSeek 5 descripciones de conceptos y 2 nombres de proveedor. No se envían RFC, UUID, montos, fechas ni folios.";
const PEOPLE_LINE =
  "Algunos nombres de proveedor pueden ser nombres de personas. DeepSeek es un servicio externo a esta aplicación.";

function groupButton(): HTMLElement {
  return screen.getByRole("button", { name: "Agrupar productos" });
}

/** Replaces the loaded invoices (a clear bumps the generation, so nothing stale writes). */
function reseed(invoices: readonly ParsedInvoice[]): void {
  act(() => {
    useSessionStore.getState().clearAll();
  });
  seed(invoices);
}

describe("Agrupar productos: the free count (D-03, D-04, D-05, OQ2)", () => {
  it("reads «5 descripciones sin agrupar» under the button, counting the tipo P concept and the repeated line once", () => {
    render(<ProductsTab />);
    expect(screen.getByText("5 descripciones sin agrupar")).toBeInTheDocument();
    expect(groupButton()).toHaveAccessibleDescription("5 descripciones sin agrupar");
  });

  it("uses the singular for one free description", () => {
    reseed([invoice(0, UNO, ["Azúcar"])]);
    render(<ProductsTab />);
    expect(screen.getByText("1 descripción sin agrupar")).toBeInTheDocument();
  });

  it("counts the descriptions regardless of the Dashboard filters and exclusions", () => {
    act(() => {
      useSessionStore.getState().excludeInvoice(INVOICE_UUIDS[2] ?? "");
      useSessionStore.getState().setSuppliers(new Set([UNO.rfc]));
    });
    render(<ProductsTab />);
    expect(screen.getByText("5 descripciones sin agrupar")).toBeInTheDocument();
  });

  it("reads «No hay descripciones nuevas para agrupar», is aria-disabled and opens nothing when nothing is free", () => {
    reseed([]);
    render(<ProductsTab />);
    expect(screen.getByText("No hay descripciones nuevas para agrupar")).toBeInTheDocument();
    expect(groupButton()).toHaveAttribute("aria-disabled", "true");
    expect(groupButton()).not.toBeDisabled();
    fireEvent.click(groupButton());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads «Hay un proceso en curso», announces the batch and starts nothing on a second press while a run is active", async () => {
    let release: () => void = () => undefined;
    upstream = (body) =>
      new Promise<Response>((resolve) => {
        release = () => {
          resolve(milkAnswer(body));
        };
      });
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    // The caption is under both entry buttons while a run is active (one run slot).
    await waitFor(() => {
      expect(screen.getAllByText("Hay un proceso en curso")).toHaveLength(2);
    });
    const line = screen.getByText("Agrupando productos · Lote 1 de 1");
    expect(line.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(groupButton()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Sugerir categorías" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(groupButton());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(routeBodies).toHaveLength(1);
    release();
    await findNameInput("Leche entera");
    await waitFor(() => {
      expect(screen.queryByText("Hay un proceso en curso")).toBeNull();
    });
  });
});

describe("Agrupar productos: the send summary (D-08, OQ1)", () => {
  it("states the counts in plural, the people line and the group heading", async () => {
    render(<ProductsTab />);
    await openDialog();
    expect(within(dialog()).getByText(SUMMARY_PLURAL)).toBeInTheDocument();
    expect(within(dialog()).getByText(PEOPLE_LINE)).toBeInTheDocument();
    dialogRows();
    expect(within(dialog()).getByText("Descripciones y proveedores (5)")).toBeInTheDocument();
  });

  it("uses the singular for one description and one supplier", async () => {
    reseed([invoice(0, UNO, ["Azúcar"])]);
    render(<ProductsTab />);
    await openDialog();
    expect(
      within(dialog()).getByText(
        "Se enviarán a DeepSeek 1 descripción de concepto y 1 nombre de proveedor. No se envían RFC, UUID, montos, fechas ni folios.",
      ),
    ).toBeInTheDocument();
    dialogRows();
    expect(within(dialog()).getByText("Descripciones y proveedores (1)")).toBeInTheDocument();
  });
});

describe("Agrupar productos: the queue (D-19)", () => {
  it("shows the heading, the intro and the line count of every member", async () => {
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await findNameInput("Leche entera");
    expect(
      screen.getByRole("heading", { name: "Sugerencias de productos · 4", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Revisa cada grupo. Puedes cambiar el nombre, separar descripciones o unir grupos antes de aceptar.",
      ),
    ).toBeInTheDocument();
    const card = cardOf(nameInput("Leche entera"));
    expect(within(card).getByText("Tienda Uno · 2 líneas")).toBeInTheDocument();
    expect(within(card).getByText("Tienda Dos · 1 línea")).toBeInTheDocument();
  });

  it("marks a member that has no loaded lines", () => {
    act(() => {
      useSuggestionsStore.getState().enqueueProducts([
        {
          id: "sug_seeded",
          name: "Aceite",
          target: null,
          members: [
            {
              rfc: "ZZZ090909ZZZ",
              key: "aceite 1l",
              description: "ACEITE 1L",
              supplierName: "Tienda Tres",
            },
          ],
        },
      ]);
    });
    render(<ProductsTab />);
    const card = cardOf(nameInput("Aceite"));
    expect(within(card).getByText("Sin líneas cargadas")).toBeInTheDocument();
    expect(within(card).getByText("Tienda Tres")).toBeInTheDocument();
  });
});

describe("Agrupar productos: a stopped run (UI-SPEC run failures)", () => {
  it("shows our own message for a DeepSeek 401 and goes back to the caption when the notice is closed", async () => {
    upstream = () => new Response("{}", { status: 401 });
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "Se detuvo el proceso en el lote 1 de 1. DeepSeek rechazó la clave de acceso del servidor. Avisa a quien administra la aplicación. Las sugerencias que ya llegaron se conservaron.",
      ),
    ).toBeInTheDocument();
    expect(within(alert).queryByRole("link", { name: "Iniciar sesión" })).toBeNull();
    fireEvent.click(within(alert).getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("5 descripciones sin agrupar")).toBeInTheDocument();
  });

  it("adds the «Iniciar sesión» link when the session ended (a 401 shaped like the proxy's)", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(NextResponse.json({ error: "unauthorized" }, { status: 401 })),
    );
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "Se detuvo el proceso en el lote 1 de 1. Tu sesión terminó. Vuelve a iniciar sesión para continuar. Las sugerencias que ya llegaron se conservaron.",
      ),
    ).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});

const INCOMPLETE_REASON = "DeepSeek dejó descripciones sin agrupar. Pulsa «Reintentar».";

describe("Agrupar productos: an answer that does not cover what was sent (D-11, OQ3)", () => {
  it.each([
    [
      "leaves out a description",
      (body: GroupRequest) =>
        completion({
          g: [{ n: "Leche entera", i: [idOf(body, "MM LECHE ENT"), idOf(body, "LECHE ENTERA 1L")], e: null }],
        }),
    ],
    [
      "repeats a description",
      (body: GroupRequest) =>
        completion({
          g: [
            { n: "Leche", i: body.items.map((item) => item.id), e: null },
            { n: "Otra", i: [idOf(body, "MM LECHE ENT")], e: null },
          ],
        }),
    ],
    [
      "invents an id",
      (body: GroupRequest) =>
        completion({ g: [{ n: "Leche", i: [...body.items.map((item) => item.id), "i99"], e: null }] }),
    ],
  ])("fails the batch and adds no card when the answer %s, and the descriptions stay free", async (_label, answer) => {
    upstream = answer;
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await waitFor(() => {
      expect(useLlmRunStore.getState().status).toMatchObject({
        phase: "partial",
        failed: 1,
        lastError: "incomplete_response",
      });
    });
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("1 lote falló")).toBeInTheDocument();
    expect(within(alert).getByText(INCOMPLETE_REASON)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(useSuggestionsStore.getState().products).toEqual([]);
    expect(nameInputs()).toEqual([]);
    expect(routeResponseTexts).toHaveLength(1);
    expect(JSON.parse(routeResponseTexts[0] ?? "null")).toEqual({
      error: "incomplete_response",
      retryable: true,
    });
    expect(screen.getByText("5 descripciones sin agrupar")).toBeInTheDocument();
  });

  it("checks the coverage again in the browser: a 200 that omits an id enqueues nothing", async () => {
    fetchMock.mockImplementationOnce((_input, init) => {
      const sent = groupRequestSchema.parse(JSON.parse(bodyText(init)));
      const first = sent.items[0];
      return Promise.resolve(
        NextResponse.json({
          groups: [{ name: "Leche", ids: first === undefined ? [] : [first.id], existing: null }],
          meta: {
            attempts: 1,
            durationMs: 1,
            finishReason: "stop",
            promptTokens: null,
            completionTokens: null,
            reasoningTokens: null,
          },
        }),
      );
    });
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await waitFor(() => {
      expect(useLlmRunStore.getState().status).toMatchObject({
        phase: "partial",
        lastError: "incomplete_response",
      });
    });
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(INCOMPLETE_REASON)).toBeInTheDocument();
    expect(useSuggestionsStore.getState().products).toEqual([]);
    expect(upstreamCalls).toHaveLength(0);
  });
});

describe("Agrupar productos: the session during a run (ACC-03)", () => {
  it("ends in the stopped Alert with the session message and the «Iniciar sesión» link when the request carries no session, and DeepSeek is never called", async () => {
    sessionToken = null;
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "Se detuvo el proceso en el lote 1 de 1. Tu sesión terminó. Vuelve a iniciar sesión para continuar. Las sugerencias que ya llegaron se conservaron.",
      ),
    ).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(upstreamCalls).toHaveLength(0);
    expect(useSuggestionsStore.getState().products).toEqual([]);
    expect(JSON.parse(routeResponseTexts[0] ?? "null")).toEqual({ error: "unauthorized" });
  });
});

describe("Pending suggestions after a reload (D-24, D-30, E4 partial)", () => {
  function stored(supplier: { rfc: string; nombre: string }, description: string): SuggestionMember {
    return {
      rfc: supplier.rfc,
      key: normalizeDescription(description),
      description,
      supplierName: supplier.nombre,
    };
  }

  const LECHE_UNO = stored(UNO, "MM LECHE ENT");
  const LECHE_DOS = stored(DOS, "LECHE ENTERA 1L");

  async function reloadWithOnlyUnoLoaded(): Promise<HTMLElement> {
    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed([invoice(0, UNO, ["MM LECHE ENT", "Café Molido 1kg"])]);
    storeQueue({
      products: [{ id: "sug_stored", name: "Leche entera", target: null, members: [LECHE_UNO, LECHE_DOS] }],
      categories: [],
    });
    await act(async () => {
      await useSuggestionsStore.persist.rehydrate();
    });
    render(<ProductsTab />);
    return cardOf(nameInput("Leche entera"));
  }

  it("shows the stored card, marks the member of the supplier without loaded lines and counts the free descriptions without it", async () => {
    const card = await reloadWithOnlyUnoLoaded();
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    expect(within(card).getAllByText("Sin líneas cargadas")).toHaveLength(1);
    expect(within(card).getByText("Tienda Uno · 1 línea")).toBeInTheDocument();
    expect(within(card).getByText("Tienda Dos")).toBeInTheDocument();
    // MM LECHE ENT is waiting in the card, so only «Café Molido 1kg» is still free.
    expect(screen.getByText("1 descripción sin agrupar")).toBeInTheDocument();
  });

  it("accepts that card: the product holds both RFC, the card leaves the stored queue", async () => {
    const card = await reloadWithOnlyUnoLoaded();
    fireEvent.click(within(card).getByRole("button", { name: "Aceptar la sugerencia «Leche entera»" }));
    const { products } = useSettingsStore.getState();
    expect(products).toHaveLength(1);
    expect(products[0]?.name).toBe("Leche entera");
    expect(products[0]?.members.map((member) => member.rfc).sort()).toEqual([DOS.rfc, UNO.rfc].sort());
    expect(useSuggestionsStore.getState().products).toEqual([]);
    expect(await readStoredQueue()).toEqual({ state: { products: [], categories: [] }, version: 1 });
  });
});

describe("Storage notices of the Productos tab (Q8 pattern)", () => {
  const QUEUE_ALERT =
    "Este navegador no permite guardar las sugerencias pendientes. Se perderán al recargar la página; revísalas antes.";
  const SETTINGS_ALERT =
    "Este navegador no permite guardar tus ajustes. Los cambios se perderán al cerrar la página; descarga tus ajustes para no perderlos.";

  const PENDING = {
    id: "sug_a",
    name: "Leche entera",
    target: null,
    members: [
      {
        rfc: UNO.rfc,
        key: normalizeDescription("MM LECHE ENT"),
        description: "MM LECHE ENT",
        supplierName: UNO.nombre,
      },
    ],
  };

  it("shows no storage Alert while everything can be written", () => {
    render(<ProductsTab />);
    act(() => {
      useSuggestionsStore.getState().enqueueProducts([PENDING]);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the non-dismissible Alert for the queue, and not the settings one, when only the queue cannot be written", () => {
    render(<ProductsTab />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => {
      useSuggestionsStore.getState().enqueueProducts([PENDING]);
    });
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(QUEUE_ALERT)).toBeInTheDocument();
    expect(within(alert).queryByRole("button")).toBeNull();
    expect(screen.queryByText(SETTINGS_ALERT)).toBeNull();
    // The card is still there for this session.
    expect(nameInput("Leche entera")).toBeInTheDocument();
  });

  it("shows the settings Alert first and the queue Alert second when neither can be written, and each goes after a later write works", () => {
    render(<ProductsTab />);
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => {
      useSettingsStore.getState().setIvaMode("sin");
      useSuggestionsStore.getState().enqueueProducts([PENDING]);
    });
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
      SETTINGS_ALERT,
      QUEUE_ALERT,
    ]);
    blocked.mockRestore();
    act(() => {
      useSettingsStore.getState().setIvaMode("con");
    });
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([QUEUE_ALERT]);
    act(() => {
      useSuggestionsStore.getState().removeProduct("sug_a");
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Accepted products as context and «Agregar a» cards through the real route (D-04, D-21, D-33, LLM-06)", () => {
  const MM_LECHE: SuggestionMember = {
    rfc: UNO.rfc,
    key: normalizeDescription("MM LECHE ENT"),
    description: "MM LECHE ENT",
    supplierName: UNO.nombre,
  };

  /** «Leche entera» already holds «MM LECHE ENT»; the other four descriptions are free. */
  function acceptLeche(): void {
    act(() => {
      useSettingsStore.setState({
        products: [{ id: "prod_leche", name: "Leche entera", categoryId: null, members: [MM_LECHE] }],
      });
    });
  }

  async function sendAndWait(): Promise<void> {
    await openDialog();
    await confirm();
    await waitFor(() => {
      expect(routeBodies).toHaveLength(1);
    });
  }

  /** DeepSeek places «LECHE ENTERA 1L» (and, when asked, «Café Molido 1kg») with product p1. */
  function placeWithP1(...descriptions: string[]): (body: GroupRequest) => Response {
    return (body) => {
      const placed = descriptions.map((description) => idOf(body, description));
      const rest = body.items
        .filter((item) => !placed.includes(item.id))
        .map((item) => ({ n: item.description, i: [item.id], e: null }));
      const groups = descriptions.map((description) => ({
        n: description === "LECHE ENTERA 1L" ? "Leche" : "Leche deslactosada",
        i: [idOf(body, description)],
        e: "p1",
      }));
      return completion({ g: [...groups, ...rest] });
    };
  }

  it("sends the accepted names on the request, the very ones the dialog lists, and never an id", async () => {
    acceptLeche();
    render(<ProductsTab />);
    await openDialog();
    expect(
      within(dialog()).getByText(
        "Como contexto también se enviarán 1 nombre de producto que ya aceptaste.",
      ),
    ).toBeInTheDocument();
    expect(dialogRows().map((row) => row.description)).toContain("Leche entera");
    expect(
      within(dialog()).getByRole("heading", { name: "Productos existentes, solo como contexto (1)" }),
    ).toBeInTheDocument();
    await confirm();
    await waitFor(() => {
      expect(routeBodies).toHaveLength(1);
    });
    expect(lastBody().existing).toEqual([{ id: "p1", name: "Leche entera" }]);
    const sent = upstreamCalls.map((call) => bodyText(call.init)).join("\n");
    expect(sent).toContain("Leche entera");
    expect(sent).not.toContain("prod_leche");
  });

  it("never sends the name of a card that is still pending from an earlier run, and leaves that card as it was", async () => {
    const pending = {
      id: "sug_old",
      name: "Aceite de oliva",
      target: null,
      members: [
        {
          rfc: "ZZZ090909ZZZ",
          key: normalizeDescription("ACEITE 1L"),
          description: "ACEITE 1L",
          supplierName: "Tienda Tres",
        },
      ],
    };
    act(() => {
      useSuggestionsStore.getState().enqueueProducts([pending]);
    });
    render(<ProductsTab />);
    await openDialog();
    expect(within(dialog()).queryByText(/Como contexto también se enviarán/)).toBeNull();
    await confirm();
    await waitFor(() => {
      expect(routeBodies).toHaveLength(1);
    });
    expect(lastBody().existing).toEqual([]);
    expect(upstreamCalls.map((call) => bodyText(call.init)).join("\n")).not.toContain(
      "Aceite de oliva",
    );
    await findNameInput("Leche entera");
    expect(useSuggestionsStore.getState().products.find((card) => card.id === "sug_old")).toEqual(
      pending,
    );
  });

  it("turns a group that DeepSeek places with an accepted product into an «Agregar a» card and adds it on «Aceptar»", async () => {
    acceptLeche();
    upstream = placeWithP1("LECHE ENTERA 1L");
    render(<ProductsTab />);
    await sendAndWait();
    const title = await screen.findByRole("heading", { name: "Agregar a «Leche entera»" });
    const card = title.closest("li");
    if (card === null) throw new Error("the title is not inside a card");
    expect(memberCheckboxes(card)).toHaveLength(1);
    expect(within(card).getByRole("checkbox", { name: "Elegir «LECHE ENTERA 1L»" })).toBeChecked();
    const queued = useSuggestionsStore.getState().products.find((entry) => entry.target !== null);
    expect(queued?.target).toBe("prod_leche");

    fireEvent.click(
      within(card).getByRole("button", { name: "Aceptar la sugerencia «Leche entera»" }),
    );
    const [leche] = useSettingsStore.getState().products;
    expect(leche?.members.map((member) => member.description)).toEqual([
      "MM LECHE ENT",
      "LECHE ENTERA 1L",
    ]);
    expect(screen.queryByRole("heading", { name: "Agregar a «Leche entera»" })).toBeNull();
  });

  it("merges two groups of one answer that point at the same product into one card", async () => {
    acceptLeche();
    upstream = placeWithP1("LECHE ENTERA 1L", "Café Molido 1kg");
    render(<ProductsTab />);
    await sendAndWait();
    const titles = await screen.findAllByRole("heading", { name: "Agregar a «Leche entera»" });
    expect(titles).toHaveLength(1);
    const card = titles[0]?.closest("li");
    if (card === undefined || card === null) throw new Error("the title is not inside a card");
    expect(memberCheckboxes(card)).toHaveLength(2);
  });
});
