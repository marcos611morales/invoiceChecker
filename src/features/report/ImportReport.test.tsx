// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ParsedInvoice, TipoComprobante } from "@/domain/cfdi/types";
import { hasReport } from "@/domain/import/report";
import type { BatchEntry, IgnoredKind } from "@/domain/import/types";
import { useSessionStore } from "@/stores/sessionStore";
import { ImportReport } from "./ImportReport";

function makeInvoice(
  uuid: string,
  tipo: TipoComprobante = "I",
  emisorNombre: string | null = null,
  receptorRfc = "CAF010101AAA",
): ParsedInvoice {
  return {
    uuid,
    version: "4.0",
    fecha: "2025-01-15T10:00:00",
    tipo,
    serie: null,
    folio: null,
    moneda: "MXN",
    tipoCambio: null,
    formaPago: null,
    metodoPago: null,
    subTotal: "100.00",
    descuento: null,
    total: "116.00",
    totalImpuestosTrasladados: null,
    totalImpuestosRetenidos: null,
    impuestos: { traslados: [], retenciones: [] },
    emisor: { rfc: "EMI010101AAA", nombre: emisorNombre },
    receptor: { rfc: receptorRfc, nombre: null },
    conceptos: [],
    relacionados: [],
    pagos: [],
  };
}

function parsed(
  name: string,
  uuid: string,
  tipo: TipoComprobante = "I",
  emisorNombre: string | null = null,
  receptorRfc = "CAF010101AAA",
): BatchEntry {
  return {
    kind: "parsed",
    file: { name, path: `carpeta/${name}` },
    result: {
      ok: true,
      invoice: makeInvoice(uuid, tipo, emisorNombre, receptorRfc),
    },
  };
}

function rejectedEntry(name: string): BatchEntry {
  return {
    kind: "parsed",
    file: { name, path: `carpeta/${name}` },
    result: { ok: false, reason: "not-cfdi" },
  };
}

function ignoredEntry(name: string, ignoredKind: IgnoredKind): BatchEntry {
  return {
    kind: "ignored",
    file: { name, path: `carpeta/${name}` },
    ignoredKind,
  };
}

function seed(batch: readonly BatchEntry[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(batch, store.generation);
  });
}

function seedMixed(): void {
  seed([
    parsed("i1.xml", "U1", "I", "Proveedor Uno"),
    parsed("i2.xml", "U2", "I"),
    parsed("e1.xml", "U3", "E"),
    parsed("p1.xml", "U4", "P"),
    parsed("i1-copia.xml", "U1", "I"),
    rejectedEntry("malo-1.xml"),
    rejectedEntry("malo-2.xml"),
    ignoredEntry("a.pdf", "pdf"),
    ignoredEntry("b.txt", "other"),
    ignoredEntry("c.zip", "zip"),
  ]);
}

function trigger(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
  });
});

describe("ImportReport summary cards", () => {
  it("shows the counts, the Ignorados sub-label and no Traslado y nómina card", () => {
    seedMixed();
    render(<ImportReport />);
    expect(
      screen.getByRole("heading", { name: "Reporte de importación" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("summary-ingreso")).toHaveTextContent("2");
    expect(screen.getByTestId("summary-egreso")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-pago")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-duplicados")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-rechazados")).toHaveTextContent("2");
    expect(screen.getByTestId("summary-ignorados")).toHaveTextContent("3");
    expect(screen.getByText("PDF: 1, otros: 2")).toBeInTheDocument();
    expect(screen.queryByTestId("summary-traslado-nomina")).toBeNull();
    expect(screen.queryByText("Traslado y nómina")).toBeNull();
  });

  it("shows the Traslado y nómina card once there is a T invoice", () => {
    seedMixed();
    render(<ImportReport />);
    seed([parsed("t1.xml", "U5", "T")]);
    expect(screen.getByTestId("summary-traslado-nomina")).toHaveTextContent(
      "1",
    );
    expect(screen.getByText("Traslado: 1, Nómina: 0")).toBeInTheDocument();
    expect(screen.getByText("Traslado y nómina")).toBeInTheDocument();
  });

  it("keeps a card with value 0 and no accordion section for an empty group", () => {
    seed([ignoredEntry("a.pdf", "pdf")]);
    render(<ImportReport />);
    expect(screen.getByTestId("summary-ingreso")).toHaveTextContent("0");
    expect(screen.getByTestId("summary-rechazados")).toHaveTextContent("0");
    expect(screen.queryByRole("button", { name: /^Ingreso \(/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Rechazados \(/ })).toBeNull();
    expect(trigger("Ignorados (1)")).toBeInTheDocument();
  });

  it("uses the destructive color on Rechazados only above 0", () => {
    seed([ignoredEntry("a.pdf", "pdf")]);
    render(<ImportReport />);
    expect(screen.getByTestId("summary-rechazados")).not.toHaveClass(
      "text-destructive",
    );
    seed([rejectedEntry("malo.xml")]);
    expect(screen.getByTestId("summary-rechazados")).toHaveClass(
      "text-destructive",
    );
  });
});

describe("ImportReport accordions", () => {
  it("lists the sections in the UI-SPEC order, only when non-empty", () => {
    seed([
      parsed("i1.xml", "U1", "I", "Proveedor Uno"),
      parsed("i2.xml", "U2", "I", null, "OTR010101AAA"),
      parsed("i3.xml", "U3", "I"),
      parsed("e1.xml", "U4", "E"),
      parsed("p1.xml", "U5", "P"),
      parsed("t1.xml", "U6", "T"),
      parsed("i1-copia.xml", "U1", "I"),
      rejectedEntry("malo.xml"),
      ignoredEntry("a.pdf", "pdf"),
    ]);
    render(<ImportReport />);
    const ordered = [
      "Rechazados (1)",
      "Receptor distinto (1)",
      "Duplicados (1)",
      "Ignorados (1)",
      "Ingreso (3)",
      "Egreso (1)",
      "Pago (1)",
      "Traslado y nómina (1)",
    ];
    const triggers = ordered.map((label) => trigger(label));
    for (let i = 1; i < triggers.length; i += 1) {
      const previous = triggers[i - 1];
      const current = triggers[i];
      if (previous === undefined || current === undefined) {
        throw new Error("missing trigger");
      }
      expect(
        previous.compareDocumentPosition(current) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("opens Rechazados by default with the Spanish reason and keeps the others collapsed", () => {
    seedMixed();
    render(<ImportReport />);
    expect(trigger("Rechazados (2)")).toHaveAttribute("aria-expanded", "true");
    expect(trigger("Duplicados (1)")).toHaveAttribute("aria-expanded", "false");
    expect(trigger("Ignorados (3)")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("malo-1.xml")).toBeInTheDocument();
    expect(screen.getByText("malo-2.xml")).toBeInTheDocument();
    expect(screen.getAllByText("No es un CFDI")).toHaveLength(2);
    expect(screen.queryByText("i1-copia.xml")).toBeNull();
  });

  it("shows the duplicate row text and the ignored reasons once opened", () => {
    seedMixed();
    render(<ImportReport />);
    fireEvent.click(trigger("Duplicados (1)"));
    expect(
      screen.getByText(
        "i1-copia.xml es la misma factura que i1.xml (UUID U1…)",
      ),
    ).toBeInTheDocument();
    fireEvent.click(trigger("Ignorados (3)"));
    expect(
      screen.getByText("PDF (solo se leen los XML)"),
    ).toBeInTheDocument();
    expect(screen.getByText("No es un archivo XML")).toBeInTheDocument();
    expect(
      screen.getByText("Descomprime el ZIP y suelta la carpeta"),
    ).toBeInTheDocument();
  });

  it("lists the issuer name, or the RFC when the name is absent, for invoice groups", () => {
    seedMixed();
    render(<ImportReport />);
    fireEvent.click(trigger("Ingreso (2)"));
    expect(screen.getByText("Proveedor Uno")).toBeInTheDocument();
    expect(screen.getByText("EMI010101AAA")).toBeInTheDocument();
  });

  it("shows the receptor distinto row text", () => {
    seed([
      parsed("a.xml", "U1"),
      parsed("b.xml", "U2"),
      parsed("raro.xml", "U3", "I", null, "OTR010101AAA"),
    ]);
    render(<ImportReport />);
    fireEvent.click(trigger("Receptor distinto (1)"));
    expect(
      screen.getByText("raro.xml: Receptor distinto: OTR010101AAA"),
    ).toBeInTheDocument();
  });

  it("re-opens Rechazados when a later batch adds a rejection after the user closed it", () => {
    seedMixed();
    render(<ImportReport />);
    fireEvent.click(trigger("Rechazados (2)"));
    expect(trigger("Rechazados (2)")).toHaveAttribute("aria-expanded", "false");
    seed([ignoredEntry("otro.pdf", "pdf")]);
    expect(trigger("Rechazados (2)")).toHaveAttribute("aria-expanded", "false");
    seed([rejectedEntry("malo-3.xml")]);
    expect(trigger("Rechazados (3)")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("malo-3.xml")).toBeInTheDocument();
  });

  it("keeps rows in arrival order", () => {
    seed([
      rejectedEntry("z.xml"),
      rejectedEntry("a.xml"),
      rejectedEntry("m.xml"),
    ]);
    render(<ImportReport />);
    const region = screen.getByRole("region", { name: /Rechazados/ });
    const text = within(region).getAllByText(/\.xml$/).map((el) => el.textContent);
    expect(text).toEqual(["z.xml", "a.xml", "m.xml"]);
  });

  it("renders XML-derived strings as text, never as markup", () => {
    seed([parsed("x.xml", "U1", "I", "<img src=x onerror=alert(1)>")]);
    render(<ImportReport />);
    fireEvent.click(trigger("Ingreso (1)"));
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("ImportReport Quitar todas", () => {
  function openDialog(): void {
    fireEvent.click(screen.getByRole("button", { name: "Quitar todas" }));
  }

  it("opens a confirmation dialog with focus on Conservar facturas", async () => {
    seedMixed();
    render(<ImportReport />);
    openDialog();
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("¿Quitar todas las facturas?"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Se borrarán las facturas cargadas y el reporte de esta sesión.",
      ),
    ).toBeInTheDocument();
    const dismiss = within(dialog).getByRole("button", {
      name: "Conservar facturas",
    });
    await waitFor(() => expect(dismiss).toHaveFocus());
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Conservar facturas",
      "Quitar todas",
    ]);
  });

  it("confirming empties the session and stays on the page", async () => {
    seedMixed();
    render(<ImportReport />);
    openDialog();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Quitar todas" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    const state = useSessionStore.getState();
    expect(hasReport(state)).toBe(false);
    expect(state.invoices).toEqual([]);
  });

  it("dismissing keeps everything", async () => {
    seedMixed();
    render(<ImportReport />);
    openDialog();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Conservar facturas" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(useSessionStore.getState().invoices).toHaveLength(4);
    expect(screen.getByTestId("summary-ingreso")).toHaveTextContent("2");
  });

  it("is disabled while a batch is processing", () => {
    seedMixed();
    act(() => {
      useSessionStore.getState().setProgress({ phase: "parsing", done: 1, total: 5 });
    });
    render(<ImportReport />);
    expect(screen.getByRole("button", { name: "Quitar todas" })).toBeDisabled();
  });
});
