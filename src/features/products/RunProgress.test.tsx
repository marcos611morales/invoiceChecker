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
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { groupRequestSchema, type GroupRequest } from "@/domain/llm/contract";
import { useLlmRunStore } from "@/stores/llmRunStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { resetSuggestionsStore } from "../../../tests/support/suggestionsStorage";
import { ProductsTab } from "./ProductsTab";
import { RunWatcher } from "./RunWatcher";

const toastMock = vi.hoisted(() => vi.fn<(message: string, options?: unknown) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const UNO = { rfc: "AAA010101AAA", nombre: "Tienda Uno" };

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

/** One invoice of one supplier with `count` distinct descriptions: 121 of them need two batches (61 and 60). */
function invoiceWith(count: number): ParsedInvoice {
  return makeInvoice({
    emisor: UNO,
    conceptos: Array.from({ length: count }, (_unused, index) =>
      concepto(`Producto ${String(index + 1).padStart(3, "0")}`),
    ),
  });
}

function seed(invoice: ParsedInvoice): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      [
        {
          kind: "parsed" as const,
          file: { name: "a.xml", path: "a.xml" },
          result: { ok: true as const, invoice },
        },
      ],
      store.generation,
    );
  });
}

interface Pending {
  body: GroupRequest;
  signal: AbortSignal | null;
  respond: (response: Response) => void;
}

const pending: Pending[] = [];
/** When false the stub ignores the abort signal, like a server answer that arrives late. */
let honorAbort = true;

function bodyText(init: RequestInit | undefined): string {
  if (typeof init?.body !== "string") throw new Error("expected a string request body");
  return init.body;
}

const fetchMock = vi.fn(
  (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
    new Promise<Response>((resolve, reject) => {
      const signal = init?.signal ?? null;
      if (honorAbort) {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }
      pending.push({
        body: groupRequestSchema.parse(JSON.parse(bodyText(init))),
        signal,
        respond: resolve,
      });
    }),
);

const META = {
  attempts: 1,
  durationMs: 1,
  finishReason: "stop",
  promptTokens: null,
  completionTokens: null,
  reasoningTokens: null,
};

/** A complete answer: every sent item becomes a card of its own, named like its description. */
function completeAnswer(request: Pending): Response {
  return Response.json({
    groups: request.body.items.map((item) => ({
      name: item.description,
      ids: [item.id],
      existing: null,
    })),
    meta: META,
  });
}

function request(index: number): Pending {
  const found = pending[index];
  if (found === undefined) throw new Error(`no request ${String(index)}`);
  return found;
}

async function requests(count: number): Promise<void> {
  await waitFor(() => {
    expect(pending).toHaveLength(count);
  });
}

function dialog(): HTMLElement {
  return screen.getByRole("alertdialog");
}

async function openDialog(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole("button", { name: "Agrupar productos" }));
  return screen.findByRole("alertdialog");
}

async function confirm(): Promise<void> {
  fireEvent.click(within(dialog()).getByRole("button", { name: "Enviar a DeepSeek" }));
  await waitFor(() => {
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
}

async function startRun(): Promise<void> {
  await openDialog();
  await confirm();
}

function stopButton(): HTMLElement {
  return screen.getByRole("button", { name: /^(Detener lotes|Deteniendo…)$/ });
}

function bar(): HTMLElement {
  return screen.getByRole("progressbar", { name: "Progreso de los lotes" });
}

function view() {
  return render(
    <>
      <RunWatcher />
      <ProductsTab />
    </>,
  );
}

/** What a toast call carried: its text, how long it stays and its action. */
function toastCall(index: number): {
  message: string;
  duration: number | undefined;
  actionLabel: string | undefined;
  press: () => void;
} {
  const call = toastMock.mock.calls[index];
  if (call === undefined) throw new Error(`no toast call at ${String(index)}`);
  const [message, options] = call;
  let duration: number | undefined;
  let actionLabel: string | undefined;
  let press: () => void = () => {
    throw new Error("the toast has no action");
  };
  if (typeof options === "object" && options !== null) {
    if ("duration" in options && typeof options.duration === "number") duration = options.duration;
    if ("action" in options && typeof options.action === "object" && options.action !== null) {
      const action = options.action;
      if ("label" in action && typeof action.label === "string") actionLabel = action.label;
      if ("onClick" in action && typeof action.onClick === "function") {
        const onClick: unknown = action.onClick;
        press = () => {
          act(() => {
            if (typeof onClick === "function") onClick();
          });
        };
      }
    }
  }
  return { message, duration, actionLabel, press };
}

beforeEach(() => {
  pending.length = 0;
  honorAbort = true;
  toastMock.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
  useLlmRunStore.setState({ status: { phase: "idle" }, controller: null });
  seed(invoiceWith(121));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    useLlmRunStore.getState().cancel();
    useSessionStore.getState().clearAll();
    useLlmRunStore.setState({ status: { phase: "idle" }, controller: null });
  });
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
});

describe("Run card across two batches (E3 loading, E4 loading, D-26)", () => {
  it("says in the dialog that the run goes out in 2 batches and still lists every item of both", async () => {
    view();
    await openDialog();
    expect(within(dialog()).getByText("Se enviarán en 2 lotes.")).toBeInTheDocument();
    fireEvent.click(
      within(dialog()).getByRole("button", { name: /Ver exactamente qué se envía/ }),
    );
    expect(within(dialog()).getAllByRole("listitem")).toHaveLength(121);
    expect(within(dialog()).getByText("Descripciones y proveedores (121)")).toBeInTheDocument();
  });

  it("does not mention batches when the run is a single request", async () => {
    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed(invoiceWith(5));
    view();
    await openDialog();
    expect(within(dialog()).queryByText(/Se enviarán en/)).toBeNull();
  });

  it("shows Lote 1 de 2 with the bar at 0, the waiting caption and focus on «Detener lotes»", async () => {
    view();
    await startRun();
    await requests(1);
    const line = screen.getByText("Agrupando productos · Lote 1 de 2");
    expect(line.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(line.closest("[aria-live]")).toHaveAttribute("aria-atomic", "true");
    expect(line.querySelector('[data-slot="spinner"]')).not.toBeNull();
    expect(bar()).toHaveAttribute("aria-valuenow", "0");
    expect(bar()).toHaveAttribute("aria-valuemin", "0");
    expect(bar()).toHaveAttribute("aria-valuemax", "2");
    expect(
      screen.getByText("Esperando la respuesta de DeepSeek. Puede tardar hasta un minuto."),
    ).toBeInTheDocument();
    expect(stopButton()).toHaveAccessibleName("Detener lotes");
    expect(stopButton()).not.toHaveAttribute("aria-busy", "true");
    await waitFor(() => {
      expect(stopButton()).toHaveFocus();
    });
  });

  it("moves to Lote 2 de 2 with the bar at 1 and the cards of batch 1 in the queue while batch 2 runs", async () => {
    view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(completeAnswer(request(0)));
    });
    await requests(2);
    expect(await screen.findByText("Agrupando productos · Lote 2 de 2")).toBeInTheDocument();
    expect(bar()).toHaveAttribute("aria-valuenow", "1");
    expect(
      screen.getByText("61 sugerencias nuevas en la cola. Ya puedes empezar a revisarlas."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sugerencias de productos · 61", level: 2 }),
    ).toBeInTheDocument();
    expect(useSuggestionsStore.getState().products).toHaveLength(61);
  });

  it("removes the card and toasts how many suggestions wait when the last batch lands", async () => {
    act(() => {
      useSessionStore.getState().setActiveTab("productos");
    });
    view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(completeAnswer(request(0)));
    });
    await requests(2);
    act(() => {
      request(1).respond(completeAnswer(request(1)));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Agrupando productos/)).toBeNull();
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(toastMock).toHaveBeenCalledTimes(1);
    // The Productos tab is the active one: no «Revisar» action.
    expect(toastCall(0).message).toBe("DeepSeek terminó: 121 sugerencias de productos por revisar");
    expect(toastCall(0).actionLabel).toBeUndefined();
    expect(screen.getByRole("button", { name: "Agrupar productos" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keeps the bar at 0 for a run of one batch until its answer lands", async () => {
    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed(invoiceWith(5));
    view();
    await startRun();
    await requests(1);
    expect(screen.getByText("Agrupando productos · Lote 1 de 1")).toBeInTheDocument();
    expect(bar()).toHaveAttribute("aria-valuenow", "0");
    expect(bar()).toHaveAttribute("aria-valuemax", "1");
  });
});

describe("«Detener lotes» (LLM-05, D-26)", () => {
  it("switches to «Deteniendo…» (inert, aria-busy), aborts the request, sends no further batch, keeps batch 1 and ends in the canceled Alert", async () => {
    view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(completeAnswer(request(0)));
    });
    await requests(2);
    await screen.findByText("Agrupando productos · Lote 2 de 2");
    fireEvent.click(stopButton());
    expect(stopButton()).toHaveTextContent("Deteniendo…");
    expect(stopButton()).toHaveAttribute("aria-busy", "true");
    expect(stopButton()).toHaveAttribute("aria-disabled", "true");
    expect(request(1).signal?.aborted).toBe(true);
    // A second press changes nothing.
    fireEvent.click(stopButton());
    expect(useLlmRunStore.getState().status.phase).toBe("cancelling");
    const alert = await screen.findByRole("status");
    expect(alert).toHaveTextContent(
      "Proceso cancelado. Llegaron 61 sugerencias nuevas y están en la cola; las descripciones de los lotes que faltaron siguen libres.",
    );
    expect(pending).toHaveLength(2);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(useSuggestionsStore.getState().products).toHaveLength(61);
    // The 60 descriptions of the canceled batch are free again, and no toast announces an ending.
    expect(screen.getByText("60 descripciones sin agrupar")).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText(/Proceso cancelado/)).toBeNull();
  });

  it("says no suggestion arrived when it is stopped during batch 1", async () => {
    view();
    await startRun();
    await requests(1);
    fireEvent.click(stopButton());
    const alert = await screen.findByRole("status");
    expect(alert).toHaveTextContent(
      "Proceso cancelado. No llegó ninguna sugerencia nueva; las descripciones de los lotes que faltaron siguen libres.",
    );
    expect(useSuggestionsStore.getState().products).toEqual([]);
  });
});

describe("Failures that do not stop the run (D-27)", () => {
  it("lets batch 2 run after batch 1 fails, then shows «1 lote falló · Reintentar» with the reason, and the toast", async () => {
    view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(
        Response.json({ error: "upstream_unavailable", retryable: true }, { status: 503 }),
      );
    });
    await requests(2);
    act(() => {
      request(1).respond(completeAnswer(request(1)));
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("1 lote falló");
    expect(
      within(alert).getByText(
        "DeepSeek está saturado o no responde. Espera un momento y pulsa «Reintentar».",
      ),
    ).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(within(alert).queryByRole("link", { name: "Iniciar sesión" })).toBeNull();
    expect(useSuggestionsStore.getState().products).toHaveLength(60);
    expect(toastCall(0).message).toBe("DeepSeek terminó: 60 sugerencias de productos por revisar");
    // The browser never retried on its own.
    expect(pending).toHaveLength(2);
  });

  it("pluralizes: «2 lotes fallaron» and shows the reason of the last failure", async () => {
    view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(
        Response.json({ error: "upstream_unavailable", retryable: true }, { status: 503 }),
      );
    });
    await requests(2);
    act(() => {
      request(1).respond(
        Response.json({ error: "upstream_timeout", retryable: true }, { status: 504 }),
      );
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("2 lotes fallaron");
    expect(
      within(alert).getByText("DeepSeek tardó demasiado en responder. Pulsa «Reintentar»."),
    ).toBeInTheDocument();
  });

  it("«Reintentar» opens the send dialog for the descriptions that are still free, and sends nothing before it is confirmed", async () => {
    view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(
        Response.json({ error: "upstream_unavailable", retryable: true }, { status: 503 }),
      );
    });
    await requests(2);
    act(() => {
      request(1).respond(completeAnswer(request(1)));
    });
    const alert = await screen.findByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    const opened = await screen.findByRole("alertdialog");
    expect(
      within(opened).getByText(
        "Se enviarán a DeepSeek 61 descripciones de conceptos y 1 nombre de proveedor. No se envían RFC, UUID, montos, fechas ni folios.",
      ),
    ).toBeInTheDocument();
    expect(within(opened).queryByText(/Se enviarán en/)).toBeNull();
    expect(pending).toHaveLength(2);
    fireEvent.click(within(opened).getByRole("button", { name: "Enviar a DeepSeek" }));
    await requests(3);
    expect(request(2).body.items).toHaveLength(61);
  });

  it("is inert while a run is active: «Reintentar» is not offered then", async () => {
    view();
    await startRun();
    await requests(1);
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });
});

describe("A refusal that a retry cannot fix (E3 error, E1 error)", () => {
  it("stops the run after batch 1 with the stopped Alert, the «Iniciar sesión» link and no «Reintentar»", async () => {
    view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(Response.json({ error: "unauthorized" }, { status: 401 }));
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Se detuvo el proceso en el lote 1 de 2. Tu sesión terminó. Vuelve a iniciar sesión para continuar. Las sugerencias que ya llegaron se conservaron.",
    );
    expect(within(alert).getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(within(alert).queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(pending).toHaveLength(1);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("names the batch that stopped it and keeps the cards that had arrived", async () => {
    view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(completeAnswer(request(0)));
    });
    await requests(2);
    act(() => {
      request(1).respond(Response.json({ error: "upstream_balance", retryable: false }, { status: 502 }));
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Se detuvo el proceso en el lote 2 de 2. La cuenta de DeepSeek no tiene saldo. Recárgala y vuelve a intentarlo. Las sugerencias que ya llegaron se conservaron.",
    );
    expect(within(alert).queryByRole("link", { name: "Iniciar sesión" })).toBeNull();
    expect(useSuggestionsStore.getState().products).toHaveLength(61);
  });
});

describe("The end-of-run toast from any tab (UI-SPEC finished toast)", () => {
  function reseedSmall(count: number): void {
    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed(invoiceWith(count));
  }

  it("carries «Revisar» when the Dashboard is active; pressing it switches to Productos and focuses the queue heading", async () => {
    reseedSmall(3);
    view();
    await startRun();
    await requests(1);
    expect(useSessionStore.getState().activeTab).toBe("dashboard");
    act(() => {
      request(0).respond(completeAnswer(request(0)));
    });
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1);
    });
    const toast = toastCall(0);
    expect(toast.message).toBe("DeepSeek terminó: 3 sugerencias de productos por revisar");
    expect(toast.actionLabel).toBe("Revisar");
    expect(toast.duration).toBe(6000);
    toast.press();
    expect(useSessionStore.getState().activeTab).toBe("productos");
    const heading = screen.getByRole("heading", { name: "Sugerencias de productos · 3", level: 2 });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it("uses the singular for one suggestion", async () => {
    reseedSmall(1);
    view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(completeAnswer(request(0)));
    });
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1);
    });
    expect(toastCall(0).message).toBe("DeepSeek terminó: 1 sugerencia de productos por revisar");
  });

  it("does not announce the same ended run again when the watcher mounts again", async () => {
    reseedSmall(2);
    const first = view();
    await startRun();
    await requests(1);
    act(() => {
      request(0).respond(completeAnswer(request(0)));
    });
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1);
    });
    first.unmount();
    view();
    expect(toastMock).toHaveBeenCalledTimes(1);
  });
});

describe("«Quitar todas» during a run (UI-SPEC default, OQ13, T-04-28)", () => {
  it("aborts the run, adds no late card and keeps the pending cards that had already arrived", async () => {
    honorAbort = false;
    act(() => {
      useSuggestionsStore.getState().enqueueProducts([
        {
          id: "sug_before",
          name: "Ya estaba",
          target: null,
          members: [
            {
              rfc: UNO.rfc,
              key: "otra cosa",
              description: "Otra cosa",
              supplierName: UNO.nombre,
            },
          ],
        },
      ]);
    });
    view();
    await startRun();
    await requests(1);
    act(() => {
      useSessionStore.getState().clearAll();
    });
    expect(request(0).signal?.aborted).toBe(true);
    // The answer arrives after the invoices were cleared.
    await act(async () => {
      request(0).respond(completeAnswer(request(0)));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(useLlmRunStore.getState().status).toEqual({ phase: "idle" });
    });
    expect(useSuggestionsStore.getState().products.map((card) => card.id)).toEqual(["sug_before"]);
    expect(pending).toHaveLength(1);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe("Earlier-batch names (D-28, D-33, LLM-06)", () => {
  const SENTENCE = "Cada lote lleva también los nombres que DeepSeek propuso en los anteriores.";

  function acceptLeche(): void {
    act(() => {
      useSettingsStore.setState({
        products: [
          {
            id: "prod_leche",
            name: "Leche entera",
            categoryId: null,
            members: [
              {
                rfc: "ZZZ990909ZZZ",
                key: "leche",
                description: "Leche",
                supplierName: "Otra tienda",
              },
            ],
          },
        ],
      });
    });
  }

  it("discloses in the dialog that later batches carry the names DeepSeek proposed earlier", async () => {
    view();
    await openDialog();
    expect(within(dialog()).getByText("Se enviarán en 2 lotes.")).toBeInTheDocument();
    expect(within(dialog()).getByText(SENTENCE)).toBeInTheDocument();
  });

  it("does not say it with a single batch", async () => {
    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed(invoiceWith(5));
    view();
    await openDialog();
    expect(within(dialog()).queryByText(SENTENCE)).toBeNull();
  });

  it("sends only the accepted names in a run of one batch", async () => {
    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed(invoiceWith(5));
    acceptLeche();
    view();
    await startRun();
    await requests(1);
    expect(request(0).body.existing).toEqual([{ id: "p1", name: "Leche entera" }]);
  });

  it("sends the second batch the names of the first batch's cards, after the accepted names", async () => {
    acceptLeche();
    view();
    await startRun();
    await requests(1);
    const first = request(0);
    expect(first.body.existing).toEqual([{ id: "p1", name: "Leche entera" }]);
    await act(async () => {
      first.respond(completeAnswer(first));
      await Promise.resolve();
    });
    await requests(2);
    const second = request(1).body.existing;
    expect(second.slice(0, 1)).toEqual([{ id: "p1", name: "Leche entera" }]);
    expect(second.slice(1).map((entry) => entry.name)).toEqual(
      first.body.items.map((item) => item.description),
    );
    expect(second[1]?.id).toBe("p2");
    expect(second).toHaveLength(1 + first.body.items.length);
    // Let the run finish so nothing stays in flight.
    await act(async () => {
      request(1).respond(completeAnswer(request(1)));
      await Promise.resolve();
    });
  });
});
