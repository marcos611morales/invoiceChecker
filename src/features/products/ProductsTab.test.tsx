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
import { POST } from "@/app/api/llm/group/route";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { groupRequestSchema, type GroupRequest } from "@/domain/llm/contract";
import { useLlmRunStore } from "@/stores/llmRunStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { ProductsTab } from "./ProductsTab";

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
      const request = new NextRequest("http://localhost/api/llm/group", {
        method: init?.method,
        headers: init?.headers,
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

/** Groups two descriptions of different suppliers into «Leche entera»; the rest is omitted. */
function milkAnswer(body: GroupRequest): Response {
  return completion({
    g: [
      {
        n: "Leche entera",
        i: [idOf(body, "MM LECHE ENT"), idOf(body, "LECHE ENTERA 1L")],
        e: null,
      },
    ],
  });
}

beforeEach(() => {
  vi.stubEnv("DEEPSEEK_API_KEY", KEY);
  vi.stubEnv("DEEPSEEK_MODEL", undefined);
  upstreamCalls.length = 0;
  routeBodies.length = 0;
  routeResponseTexts.length = 0;
  upstream = milkAnswer;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  seed(sample());
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  act(() => {
    useSessionStore.getState().clearAll();
    useSuggestionsStore.setState({ products: [] });
    useLlmRunStore.setState({ status: { phase: "idle" }, controller: null });
  });
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
    const heading = await screen.findByRole("heading", { name: "Leche entera", level: 3 });
    const card = heading.closest("li");
    expect(card).not.toBeNull();
    if (card === null) return;
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    expect(within(card).getByText("MM LECHE ENT")).toBeInTheDocument();
    expect(within(card).getByText("Tienda Uno")).toBeInTheDocument();
    expect(within(card).getByText("LECHE ENTERA 1L")).toBeInTheDocument();
    expect(within(card).getByText("Tienda Dos")).toBeInTheDocument();
  });

  it("calls DeepSeek with the documented request and the server-side key", async () => {
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await screen.findByRole("heading", { name: "Leche entera" });
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
      max_tokens: 8192,
      stream: false,
    });
  });

  it("sends a body with only items and existing, and none of the identifiers of the invoices", async () => {
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await screen.findByRole("heading", { name: "Leche entera" });
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

  it("sends only the still-free items on a second press, and leaves the pending cards as they were", async () => {
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await screen.findByRole("heading", { name: "Leche entera" });
    const first = useSuggestionsStore.getState().products;

    upstream = (body) =>
      completion({ g: [{ n: "Azúcar blanca", i: [idOf(body, "Azúcar")], e: null }] });
    await waitFor(() => {
      expect(useLlmRunStore.getState().status.phase).toBe("idle");
    });
    await openDialog();
    expect(dialogRows().map((row) => row.description).sort()).toEqual(
      ["Azúcar", "Café Molido 1kg", "Pago"].sort(),
    );
    await confirm();
    await screen.findByRole("heading", { name: "Azúcar blanca" });
    expect(lastBody().items).toHaveLength(3);
    const all = useSuggestionsStore.getState().products;
    expect(all).toHaveLength(2);
    expect(all[0]).toBe(first[0]);
  });

  it("enqueues only the known first-seen members when the answer invents an id or repeats one, and the omitted description is listed again", async () => {
    upstream = (body) =>
      completion({
        g: [
          { n: "Leche", i: [idOf(body, "MM LECHE ENT"), "i99"], e: null },
          { n: "Otra", i: [idOf(body, "MM LECHE ENT"), idOf(body, "Café Molido 1kg")], e: null },
        ],
      });
    render(<ProductsTab />);
    await openDialog();
    await confirm();
    await screen.findByRole("heading", { name: "Leche" });
    const cards = useSuggestionsStore.getState().products;
    expect(cards.map((card) => card.members.map((member) => member.description))).toEqual([
      ["MM LECHE ENT"],
      ["Café Molido 1kg"],
    ]);
    await waitFor(() => {
      expect(useLlmRunStore.getState().status.phase).toBe("idle");
    });
    await openDialog();
    expect(dialogRows().map((row) => row.description).sort()).toEqual(
      ["Azúcar", "LECHE ENTERA 1L", "Pago"].sort(),
    );
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
      expect(useSuggestionsStore.getState().products).toHaveLength(1);
    });
    render(<ProductsTab />);
    expect(screen.getByRole("heading", { name: "Leche entera", level: 3 })).toBeInTheDocument();
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
    await screen.findByRole("heading", { name: "Leche entera" });
    expect(routeResponseTexts.join("\n")).not.toContain(KEY);
    const parsed = z
      .object({ groups: z.array(z.unknown()), meta: z.object({ attempts: z.literal(1) }) })
      .safeParse(JSON.parse(routeResponseTexts[0] ?? "null"));
    expect(parsed.success).toBe(true);
  });
});
