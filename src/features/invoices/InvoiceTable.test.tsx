// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ParsedInvoice, TipoComprobante } from "@/domain/cfdi/types";
import type { BatchEntry } from "@/domain/import/types";
import { useSessionStore } from "@/stores/sessionStore";
import { InvoiceTable } from "./InvoiceTable";

interface InvoiceOverrides {
  fecha?: string;
  tipo?: TipoComprobante;
  emisorNombre?: string | null;
  emisorRfc?: string;
  folio?: string | null;
  total?: string;
  moneda?: string;
  conceptos?: number;
}

function makeInvoice(uuid: string, o: InvoiceOverrides = {}): ParsedInvoice {
  const conceptoCount = o.conceptos ?? 1;
  return {
    uuid,
    version: "4.0",
    fecha: o.fecha ?? "2025-01-15T10:00:00",
    tipo: o.tipo ?? "I",
    serie: null,
    folio: o.folio === undefined ? "F-1" : o.folio,
    moneda: o.moneda ?? "MXN",
    tipoCambio: null,
    formaPago: null,
    metodoPago: null,
    subTotal: "100.00",
    descuento: null,
    total: o.total ?? "116.00",
    totalImpuestosTrasladados: null,
    totalImpuestosRetenidos: null,
    emisor: {
      rfc: o.emisorRfc ?? "EMI010101AAA",
      nombre: o.emisorNombre === undefined ? "Proveedor" : o.emisorNombre,
    },
    receptor: { rfc: "CAF010101AAA", nombre: null },
    conceptos: Array.from({ length: conceptoCount }, (_, i) => ({
      claveProdServ: "01010101",
      noIdentificacion: null,
      cantidad: "1",
      claveUnidad: "H87",
      unidad: null,
      descripcion: `Concepto ${i + 1}`,
      valorUnitario: "1",
      importe: "1",
      descuento: null,
      objetoImp: null,
      traslados: [],
      retenciones: [],
    })),
    relacionados: [],
    pagos: [],
  };
}

function parsed(uuid: string, o: InvoiceOverrides = {}): BatchEntry {
  const name = `${uuid}.xml`;
  return {
    kind: "parsed",
    file: { name, path: `carpeta/${name}` },
    result: { ok: true, invoice: makeInvoice(uuid, o) },
  };
}

function seed(batch: readonly BatchEntry[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(batch, store.generation);
  });
}

function header(name: string): HTMLElement {
  return screen.getByRole("columnheader", { name: new RegExp(`^${name}`) });
}

function click(name: string): void {
  fireEvent.click(within(header(name)).getByRole("button"));
}

/** Text of one column (0-based) across the body rows, in display order. */
function column(index: number): string[] {
  const rows = document.querySelectorAll("tbody tr");
  return Array.from(rows).map(
    (row) => row.querySelectorAll("td")[index]?.textContent ?? "",
  );
}

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
  });
});

describe("InvoiceTable content", () => {
  it("renders nothing while there is no report", () => {
    const { container } = render(<InvoiceTable />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the heading with the count and the always-visible D-22 note", () => {
    seed([parsed("U1"), parsed("U2")]);
    render(<InvoiceTable />);
    expect(
      screen.getByRole("heading", { name: "Facturas cargadas (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Montos tal como vienen en cada XML; el cálculo de gasto llega después",
      ),
    ).toBeInTheDocument();
  });

  it("lists the six columns with the formats of D-21", () => {
    seed([
      parsed("U1", {
        fecha: "2025-05-28T17:38:18",
        emisorNombre: "Papelería Uno",
        tipo: "E",
        folio: "A-12",
        total: "1234.5",
        conceptos: 3,
      }),
    ]);
    render(<InvoiceTable />);
    for (const name of [
      "Fecha",
      "Proveedor",
      "Tipo",
      "Folio",
      "Total",
      "Conceptos",
    ]) {
      expect(header(name)).toBeInTheDocument();
    }
    expect(column(0)).toEqual(["28/05/2025"]);
    expect(column(1)).toEqual(["Papelería Uno"]);
    expect(column(2)).toEqual(["Egreso"]);
    expect(column(3)).toEqual(["A-12"]);
    expect(column(4)).toEqual(["$1,234.50"]);
    expect(column(5)).toEqual(["3"]);
  });

  it("falls back to the issuer RFC when the name is absent", () => {
    seed([parsed("U1", { emisorNombre: null, emisorRfc: "XAXX010101000" })]);
    render(<InvoiceTable />);
    expect(column(1)).toEqual(["XAXX010101000"]);
  });

  it("shows a dash for a missing folio and for a Pago in XXX, never dropping the row", () => {
    seed([
      parsed("U1", { folio: null, total: "100.00" }),
      parsed("U2", { tipo: "P", moneda: "XXX", total: "0", folio: "P-1" }),
    ]);
    render(<InvoiceTable />);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(column(3).sort()).toEqual(["P-1", "—"].sort());
    expect(column(4)).toContain("—");
  });

  it("has no footer row and no sum of amounts", () => {
    seed([
      parsed("U1", { total: "100.00" }),
      parsed("U2", { total: "200.00" }),
    ]);
    const { container } = render(<InvoiceTable />);
    expect(container.querySelector("tfoot")).toBeNull();
    expect(container.textContent).not.toContain("300");
    expect(screen.queryByText(/total general|suma|promedio/i)).toBeNull();
  });

  it("truncates a 90-character provider name inside a 280 px cell", () => {
    const longName = "P".repeat(90);
    seed([parsed("U1", { emisorNombre: longName })]);
    render(<InvoiceTable />);
    const trigger = screen.getByText(longName);
    expect(trigger.className).toContain("truncate");
    expect(trigger.closest("td")?.className).toContain("max-w-[280px]");
  });

  it("keeps the scrolling inside the table container", () => {
    seed([parsed("U1")]);
    const { container } = render(<InvoiceTable />);
    const wrapper = container.querySelector('[data-slot="table-container"]');
    expect(wrapper?.className).toContain("overflow-x-auto");
  });
});

describe("InvoiceTable sorting", () => {
  it("sorts Fecha descending by default using the literal ISO string", () => {
    seed([
      parsed("U1", { fecha: "2025-01-10T09:00:00" }),
      parsed("U2", { fecha: "2025-03-05T08:00:00" }),
      parsed("U3", { fecha: "2025-02-20T23:59:59" }),
    ]);
    render(<InvoiceTable />);
    expect(header("Fecha")).toHaveAttribute("aria-sort", "descending");
    expect(column(0)).toEqual(["05/03/2025", "20/02/2025", "10/01/2025"]);
    expect(header("Total")).toHaveAttribute("aria-sort", "none");
  });

  it("cycles Total ascending, descending, none, ordered numerically", () => {
    seed([
      parsed("U1", { total: "9.00", fecha: "2025-01-01T00:00:00" }),
      parsed("U2", { total: "100.00", fecha: "2025-01-02T00:00:00" }),
      parsed("U3", { total: "20.00", fecha: "2025-01-03T00:00:00" }),
    ]);
    render(<InvoiceTable />);
    click("Total");
    expect(header("Total")).toHaveAttribute("aria-sort", "ascending");
    expect(column(4)).toEqual(["$9.00", "$20.00", "$100.00"]);
    expect(header("Fecha")).toHaveAttribute("aria-sort", "none");
    click("Total");
    expect(header("Total")).toHaveAttribute("aria-sort", "descending");
    expect(column(4)).toEqual(["$100.00", "$20.00", "$9.00"]);
    click("Total");
    expect(header("Total")).toHaveAttribute("aria-sort", "none");
  });

  it("sorts Proveedor with es collation", () => {
    seed([
      parsed("U1", { emisorNombre: "Ñandú" }),
      parsed("U2", { emisorNombre: "Nube" }),
      parsed("U3", { emisorNombre: "Ábaco" }),
      parsed("U4", { emisorNombre: "Banco" }),
    ]);
    render(<InvoiceTable />);
    click("Proveedor");
    expect(column(1)).toEqual(["Ábaco", "Banco", "Nube", "Ñandú"]);
    click("Proveedor");
    expect(column(1)).toEqual(["Ñandú", "Nube", "Banco", "Ábaco"]);
  });

  it("sorts a missing Folio last in both directions", () => {
    seed([
      parsed("U1", { folio: null }),
      parsed("U2", { folio: "B-2" }),
      parsed("U3", { folio: "A-1" }),
    ]);
    render(<InvoiceTable />);
    click("Folio");
    expect(column(3)).toEqual(["A-1", "B-2", "—"]);
    click("Folio");
    expect(column(3)).toEqual(["B-2", "A-1", "—"]);
  });

  it("sorts Conceptos numerically and Tipo with es collation", () => {
    seed([
      parsed("U1", { conceptos: 10, tipo: "P" }),
      parsed("U2", { conceptos: 2, tipo: "E" }),
      parsed("U3", { conceptos: 5, tipo: "I" }),
    ]);
    render(<InvoiceTable />);
    click("Conceptos");
    expect(column(5)).toEqual(["2", "5", "10"]);
    click("Tipo");
    expect(column(2)).toEqual(["Egreso", "Ingreso", "Pago"]);
  });
});

/** `count` valid invoices with distinct, ordered dates (U001 is the oldest). */
function many(count: number): BatchEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(3, "0");
    const day = String((i % 28) + 1).padStart(2, "0");
    const month = String(Math.floor(i / 28) + 1).padStart(2, "0");
    return parsed(`U${n}`, {
      fecha: `2025-${month}-${day}T10:00:00`,
      total: String(i + 1),
    });
  });
}

describe("InvoiceTable pagination", () => {
  it("shows no footer with a single page", () => {
    seed(many(10));
    render(<InvoiceTable />);
    expect(screen.queryByText(/^Mostrando/)).toBeNull();
    expect(screen.queryByText(/^Página/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
    expect(document.querySelectorAll("tbody tr")).toHaveLength(10);
  });

  it("pages 120 rows in three pages of at most 50", () => {
    seed(many(120));
    render(<InvoiceTable />);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(50);
    expect(screen.getByText("Mostrando 1–50 de 120")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    const previous = screen.getByRole("button", { name: "Anterior" });
    const next = screen.getByRole("button", { name: "Siguiente" });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();

    fireEvent.click(next);
    expect(screen.getByText("Mostrando 51–100 de 120")).toBeInTheDocument();
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    expect(previous).toBeEnabled();

    fireEvent.click(next);
    expect(screen.getByText("Mostrando 101–120 de 120")).toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr")).toHaveLength(20);
    expect(next).toBeDisabled();

    fireEvent.click(previous);
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("uses the singular range when the last page holds one row", () => {
    seed(many(51));
    render(<InvoiceTable />);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Mostrando 51 de 51")).toBeInTheDocument();
  });

  it("keeps the page when sorting", () => {
    seed(many(120));
    render(<InvoiceTable />);
    const next = screen.getByRole("button", { name: "Siguiente" });
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();
    click("Total");
    expect(header("Total")).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 101–120 de 120")).toBeInTheDocument();
  });

  it("goes back to page 1 when a new, smaller batch leaves the old page without rows", () => {
    seed(many(120));
    render(<InvoiceTable />);
    const next = screen.getByRole("button", { name: "Siguiente" });
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();

    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed(many(10));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(10);
    expect(screen.queryByText(/^Página/)).toBeNull();

    // Growing again must start from page 1, not from the forgotten page 3.
    seed(
      Array.from({ length: 110 }, (_, i) =>
        parsed(`V${String(i + 1).padStart(3, "0")}`),
      ),
    );
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 1–50 de 120")).toBeInTheDocument();
  });

  it("keeps the current page when it still exists after a new batch", () => {
    seed(many(120));
    render(<InvoiceTable />);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    seed(
      Array.from({ length: 5 }, (_, i) =>
        parsed(`W${String(i + 1).padStart(3, "0")}`),
      ),
    );
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 51–100 de 125")).toBeInTheDocument();
  });
});
