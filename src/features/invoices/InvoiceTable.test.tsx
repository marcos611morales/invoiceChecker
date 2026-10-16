// @vitest-environment jsdom
import { useMemo } from "react";
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
import { totalSpend } from "@/domain/accounting/aggregate";
import type { IvaMode } from "@/domain/accounting/aggregate";
import { buildLedger } from "@/domain/accounting/ledger";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { qualitySummary } from "@/domain/accounting/quality";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { readStoredSettings } from "../../../tests/support/settingsStorage";
import { makeEntry, makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { InvoiceTable } from "./InvoiceTable";

interface ToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
}

const toastMock = vi.hoisted(() => vi.fn<(message: string, options?: ToastOptions) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

function concepto(overrides: Partial<Concepto> = {}): Concepto {
  return {
    claveProdServ: "01010101",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion: "Concepto",
    valorUnitario: "100.00",
    importe: "100.00",
    descuento: null,
    objetoImp: null,
    traslados: [],
    retenciones: [],
    ...overrides,
  };
}

function iva(importe: string) {
  return {
    base: null,
    impuesto: "002",
    tipoFactor: "Tasa",
    tasaOCuota: "0.160000",
    importe,
  };
}

/** An Ingreso whose folio is its uuid, so every reference in the UI is easy to find. */
function inv(uuid: string, overrides: Partial<ParsedInvoice> = {}): ParsedInvoice {
  return makeInvoice({ uuid, folio: uuid, ...overrides });
}

function seed(invoices: readonly ParsedInvoice[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      invoices.map((invoice, index) => ({
        kind: "parsed" as const,
        file: { name: `f${index}-${invoice.uuid}.xml`, path: `f${index}-${invoice.uuid}.xml` },
        result: { ok: true as const, invoice },
      })),
      store.generation,
    );
  });
}

/** Builds the ledger from the session store like the Dashboard does. */
function Harness({
  mode = "con",
  only,
}: {
  mode?: IvaMode;
  only?: ReadonlySet<string>;
}) {
  const invoices = useSessionStore((s) => s.invoices);
  const excluded = useSessionStore((s) => s.excluded);
  const restored = useSessionStore((s) => s.restored);
  const ledger = useMemo(
    () => buildLedger(invoices, { excluded, restored }),
    [invoices, excluded, restored],
  );
  const rows = useMemo(
    () => (only === undefined ? ledger : ledger.filter((e) => only.has(e.uuid))),
    [ledger, only],
  );
  return (
    <>
      <p data-testid="gasto">{formatMoney(totalSpend(ledger, mode))}</p>
      <p data-testid="amount-changing">{String(qualitySummary(ledger).amountChanging)}</p>
      <InvoiceTable rows={rows} ledger={ledger} mode={mode} />
    </>
  );
}

function dataRow(uuid: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`tr[data-row-id="${uuid}"]`);
  if (row === null) throw new Error(`no row ${uuid}`);
  return row;
}

function dataRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("tr[data-row-id]"));
}

function cells(row: HTMLElement): HTMLElement[] {
  return Array.from(row.querySelectorAll<HTMLElement>("td"));
}

function cellOf(row: HTMLElement, index: number): HTMLElement {
  const cell = cells(row)[index];
  if (cell === undefined) throw new Error(`no cell ${index}`);
  return cell;
}

/** Text of one column (0-based, 0 is the chevron) across the data rows in display order. */
function column(index: number): string[] {
  return dataRows().map((row) => cells(row)[index]?.textContent ?? "");
}

function header(name: string): HTMLElement {
  return screen.getByRole("columnheader", { name: new RegExp(`^${name}`) });
}

function clickHeader(name: string): void {
  fireEvent.click(within(header(name)).getByRole("button"));
}

function chevron(uuid: string): HTMLElement {
  return screen.getByTestId(`expand-${uuid}`);
}

async function openMenu(ref: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: `Acciones de la factura ${ref}` }));
  await screen.findByRole("menu");
}

/** onClick of the most recent "Factura excluida" toast action (the "Deshacer exclusión" button). */
function lastExclusionUndo(): () => void {
  for (let index = toastMock.mock.calls.length - 1; index >= 0; index -= 1) {
    const [message, options] = toastMock.mock.calls[index] ?? [];
    if (message === "Factura excluida") {
      const undo = options?.action?.onClick;
      if (undo !== undefined) return undo;
    }
  }
  throw new Error("no exclusion toast with an undo action");
}

beforeEach(() => {
  toastMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    useSessionStore.getState().clearAll();
  });
});

describe("InvoiceTable heading, note and default order", () => {
  it("counts every row in the heading and shows the always-visible note", () => {
    seed([
      inv("U1"),
      inv("U2", { tipo: "E" }),
      inv("U3", { tipo: "P", moneda: "XXX", total: "0", subTotal: "0" }),
      inv("U4", { total: "0.00", subTotal: "0.00" }),
    ]);
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Facturas (4)" })).toBeInTheDocument();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(
      "Incluye notas de crédito y facturas que no suman (atenuadas). El monto sigue el modo Con IVA / Sin IVA.",
    );
    expect(dataRows()).toHaveLength(4);
  });

  it("shows the headers of the spec and sorts newest Fecha first by default", () => {
    seed([
      inv("U1", { fecha: "2025-01-10T10:00:00" }),
      inv("U2", { fecha: "2025-03-10T10:00:00" }),
      inv("U3", { fecha: "2025-02-10T10:00:00" }),
    ]);
    render(<Harness />);
    for (const name of ["Fecha", "Proveedor", "Folio", "Forma de pago", "Tipo", "Monto"]) {
      expect(header(name)).toBeInTheDocument();
    }
    expect(screen.getByRole("columnheader", { name: "Conceptos" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeInTheDocument();
    expect(column(1)).toEqual(["10/03/2025", "10/02/2025", "10/01/2025"]);
    expect(header("Fecha")).toHaveAttribute("aria-sort", "descending");
  });

  it("cycles aria-sort ascending, descending, none on a header", () => {
    seed([inv("U1"), inv("U2")]);
    render(<Harness />);
    clickHeader("Proveedor");
    expect(header("Proveedor")).toHaveAttribute("aria-sort", "ascending");
    clickHeader("Proveedor");
    expect(header("Proveedor")).toHaveAttribute("aria-sort", "descending");
    clickHeader("Proveedor");
    expect(header("Proveedor")).toHaveAttribute("aria-sort", "none");
  });
});

describe("InvoiceTable sorting", () => {
  it("sorts Monto on the signed displayed value with the dash last in both directions", () => {
    seed([
      inv("U1", { total: "345.98", subTotal: "345.98" }),
      inv("U2", { tipo: "E", total: "1000.00", subTotal: "1000.00" }),
      inv("U3", { tipo: "P", moneda: "XXX", total: "0", subTotal: "0" }),
      inv("U4", { total: "0.00", subTotal: "0.00" }),
    ]);
    render(<Harness />);
    clickHeader("Monto");
    expect(column(6)).toEqual(["−$1,000.00", "$0.00", "$345.98", "—"]);
    clickHeader("Monto");
    expect(column(6)).toEqual(["$345.98", "$0.00", "−$1,000.00", "—"]);
  });

  it("sorts Fecha by the literal ISO string, Folio as text and Proveedor in Spanish order", () => {
    seed([
      inv("U1", { folio: "10", fecha: "2025-01-01T10:00:00", emisor: { rfc: "AAA010101AAA", nombre: "Árbol" } }),
      inv("U2", { folio: "9", fecha: "2025-02-01T10:00:00", emisor: { rfc: "BBB010101BBB", nombre: "Abeja" } }),
      inv("U3", { folio: null, fecha: "2025-03-01T10:00:00", emisor: { rfc: "CCC010101CCC", nombre: "zeta" } }),
    ]);
    render(<Harness />);
    // Starts descending: the first click removes the sort, the second sorts ascending.
    clickHeader("Fecha");
    clickHeader("Fecha");
    expect(header("Fecha")).toHaveAttribute("aria-sort", "ascending");
    expect(column(1)).toEqual(["01/01/2025", "01/02/2025", "01/03/2025"]);
    clickHeader("Folio");
    expect(column(3)).toEqual(["10", "9", "—"]);
    clickHeader("Folio");
    expect(column(3)).toEqual(["9", "10", "—"]);
    clickHeader("Proveedor");
    expect(column(2)).toEqual(["Abeja", "Árbol", "zeta"]);
  });
});

describe("InvoiceTable pagination", () => {
  function many(count: number): ParsedInvoice[] {
    return Array.from({ length: count }, (_, i) =>
      inv(`P${String(i).padStart(3, "0")}`, {
        fecha: `2025-01-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`,
      }),
    );
  }

  it("shows 50 rows per page with the range and page footer", () => {
    seed(many(120));
    render(<Harness />);
    expect(dataRows()).toHaveLength(50);
    expect(screen.getByText("Mostrando 1–50 de 120")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Mostrando 51–100 de 120")).toBeInTheDocument();
  });

  it("keeps a page that still exists after sorting and falls back when it vanishes", () => {
    seed(many(120));
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    clickHeader("Folio");
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();

    const sixty = new Set(many(60).map((i) => i.uuid));
    rerender(<Harness only={sixty} />);
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();

    const forty = new Set(many(40).map((i) => i.uuid));
    rerender(<Harness only={forty} />);
    expect(screen.queryByText(/^Página/)).toBeNull();
    expect(dataRows()).toHaveLength(40);
  });

  it("shows no footer for a single page", () => {
    seed([inv("U1")]);
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Facturas (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
    expect(screen.queryByText(/^Mostrando/)).toBeNull();
  });
});

describe("InvoiceTable rows that do not sum or are special", () => {
  it("shows a credit note negative with its badge and the month it applies to", () => {
    seed([
      inv("O1", { fecha: "2025-06-10T10:00:00" }),
      inv("E1", {
        tipo: "E",
        fecha: "2025-08-01T10:00:00",
        total: "1000.00",
        subTotal: "1000.00",
        relacionados: [{ tipoRelacion: "01", uuids: ["O1"] }],
      }),
      inv("E2", { tipo: "E", fecha: "2025-09-01T10:00:00", total: "50.00", subTotal: "50.00" }),
    ]);
    render(<Harness />);
    const credit = dataRow("E1");
    expect(within(credit).getByText("Nota de crédito")).toBeInTheDocument();
    expect(within(credit).getByText("aplica a jun 2025")).toBeInTheDocument();
    expect(cellOf(credit, 6).textContent).toBe("−$1,000.00");
    expect(within(dataRow("E2")).getByText("sin factura relacionada")).toBeInTheDocument();
  });

  it("keeps a Pago in muted text with No suma, a dash amount and no menu but a cell", () => {
    seed([inv("U1"), inv("PG", { tipo: "P", moneda: "XXX", total: "0", subTotal: "0", folio: null })]);
    render(<Harness />);
    const pago = dataRow("PG");
    expect(within(pago).getByText("Pago")).toBeInTheDocument();
    expect(within(pago).getByText("No suma")).toBeInTheDocument();
    expect(cellOf(pago, 3).textContent).toBe("—");
    expect(cellOf(pago, 6).textContent).toBe("—");
    expect(pago.className).toContain("text-muted-foreground");
    expect(within(pago).queryByRole("button", { name: /^Acciones de la factura/ })).toBeNull();
    expect(cells(pago)).toHaveLength(8);
    expect(cellOf(pago, 7)).toBeInTheDocument();
  });

  it("shows a $0 Ingreso as $0.00 with No suma", () => {
    seed([inv("Z0", { total: "0.00", subTotal: "0.00" })]);
    render(<Harness />);
    const zero = dataRow("Z0");
    expect(cellOf(zero, 6).textContent).toBe("$0.00");
    expect(within(zero).getByText("No suma")).toBeInTheDocument();
    expect(within(zero).queryByRole("button", { name: /^Acciones de la factura/ })).toBeNull();
  });

  it("never reduces opacity of a row", () => {
    seed([
      inv("U1"),
      inv("PG", { tipo: "P", moneda: "XXX", total: "0", subTotal: "0" }),
      inv("Z0", { total: "0.00", subTotal: "0.00" }),
    ]);
    render(<Harness />);
    act(() => {
      useSessionStore.getState().excludeInvoice("U1");
    });
    // The shared Button carries a disabled-only opacity; rows and cells must carry none.
    const surfaces = document.querySelectorAll("tbody tr, tbody td, tbody td span, tbody td div");
    expect(surfaces.length).toBeGreaterThan(0);
    for (const element of surfaces) {
      expect(element.className).not.toMatch(/opacity-/);
    }
  });

  it("shows a converted foreign invoice with the MXN amount and the original line", () => {
    seed([inv("US", { moneda: "USD", tipoCambio: "18.20", total: "100.00", subTotal: "100.00" })]);
    render(<Harness />);
    const row = dataRow("US");
    expect(cellOf(row, 6).textContent).toContain("$1,820.00");
    expect(within(row).getByText("USD 100.00 · TC 18.20")).toBeInTheDocument();
    expect(within(row).queryByText("No suma")).toBeNull();
  });

  it("shows a foreign invoice without rate with a dash, the original and No suma", () => {
    seed([inv("US", { moneda: "USD", tipoCambio: null, total: "100.00", subTotal: "100.00" })]);
    render(<Harness />);
    const row = dataRow("US");
    expect(cellOf(row, 6).textContent).toContain("—");
    expect(within(row).getByText("USD 100.00")).toBeInTheDocument();
    expect(within(row).getByText("No suma")).toBeInTheDocument();
  });

  it("makes the original amount follow the IVA mode", () => {
    seed([inv("US", { moneda: "USD", tipoCambio: "18.20", total: "116.00", subTotal: "100.00" })]);
    const { rerender } = render(<Harness mode="con" />);
    expect(within(dataRow("US")).getByText("USD 116.00 · TC 18.20")).toBeInTheDocument();
    rerender(<Harness mode="sin" />);
    expect(within(dataRow("US")).getByText("USD 100.00 · TC 18.20")).toBeInTheDocument();
    expect(cellOf(dataRow("US"), 6).textContent).toContain("$1,820.00");
  });

  it("shows the SAT names of the formas de pago and the PPD sentinel", () => {
    const ppd = inv("PP", { metodoPago: "PPD", formaPago: "99" });
    seed([ppd]);
    render(<Harness />);
    expect(within(dataRow("PP")).getByText("Por definir (sin complemento de pago)")).toBeInTheDocument();
  });
});

describe("InvoiceTable concept panels", () => {
  const rich = (): ParsedInvoice =>
    inv("F1", {
      subTotal: "300.00",
      total: "348.00",
      conceptos: [
        concepto({
          descripcion: "Café molido",
          cantidad: "2.000000",
          unidad: "Pieza",
          valorUnitario: "100.000000",
          importe: "200.00",
          traslados: [iva("32.00")],
        }),
        concepto({
          descripcion: "Leche",
          cantidad: "1.500000",
          claveUnidad: "LTR",
          valorUnitario: "66.666667",
          importe: "100.00",
          traslados: [iva("16.00")],
        }),
      ],
    });

  it("opens only from the chevron with aria-expanded and aria-controls and lists the concepts", () => {
    seed([rich()]);
    render(<Harness />);
    const button = chevron("F1");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAccessibleName("Ver conceptos");
    fireEvent.click(cellOf(dataRow("F1"), 1));
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAccessibleName("Ocultar conceptos");
    const panelId = button.getAttribute("aria-controls");
    if (panelId === null) throw new Error("no aria-controls");
    const panel = document.getElementById(panelId);
    if (panel === null) throw new Error("no panel");
    const view = within(panel);
    expect(view.getByText("Conceptos de la factura F1")).toBeInTheDocument();
    for (const name of ["Descripción", "Cantidad", "Unidad", "Precio unitario", "Monto"]) {
      expect(view.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(view.getByText("Café molido")).toBeInTheDocument();
    expect(view.getByText("2")).toBeInTheDocument();
    expect(view.getByText("1.5")).toBeInTheDocument();
    expect(view.getByText("Pieza")).toBeInTheDocument();
    expect(view.getByText("LTR").className).toContain("font-mono");
    expect(view.getByText("$100.00")).toBeInTheDocument();
    expect(view.getByText("$66.666667")).toBeInTheDocument();
    expect(view.getByText("$232.00")).toBeInTheDocument();
    expect(view.getByText("$116.00")).toBeInTheDocument();
    expect(view.queryByText(/Diferencia de redondeo/)).toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(panelId)).toBeNull();
  });

  it("titles the panel with the short uuid when there is no folio", () => {
    seed([inv("ABCDEF12-0000", { folio: null })]);
    render(<Harness />);
    fireEvent.click(chevron("ABCDEF12-0000"));
    expect(screen.getByText("Conceptos de la factura ABCDEF12")).toBeInTheDocument();
  });

  it("shows the rounding line only when the rounded sums differ and follows the mode", () => {
    seed([{ ...rich(), total: "348.01" }]);
    const { rerender } = render(<Harness mode="con" />);
    fireEvent.click(chevron("F1"));
    expect(screen.getByText("Diferencia de redondeo: $0.01")).toBeInTheDocument();
    rerender(<Harness mode="sin" />);
    expect(screen.queryByText(/Diferencia de redondeo/)).toBeNull();
  });

  it("lets several panels be open and keeps them open across sorting, paging and filtering", () => {
    seed([
      { ...rich(), fecha: "2025-01-01T10:00:00" },
      inv("F2", { fecha: "2025-02-01T10:00:00", conceptos: [concepto({ descripcion: "Otro" })] }),
      inv("F3", { fecha: "2025-03-01T10:00:00" }),
    ]);
    const { rerender } = render(<Harness />);
    fireEvent.click(chevron("F1"));
    fireEvent.click(chevron("F2"));
    expect(chevron("F1")).toHaveAttribute("aria-expanded", "true");
    expect(chevron("F2")).toHaveAttribute("aria-expanded", "true");
    clickHeader("Fecha");
    clickHeader("Proveedor");
    expect(chevron("F1")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Café molido")).toBeInTheDocument();
    rerender(<Harness only={new Set(["F1", "F3"])} />);
    expect(screen.queryByText("Conceptos de la factura F2")).toBeNull();
    expect(chevron("F1")).toHaveAttribute("aria-expanded", "true");
    rerender(<Harness />);
    expect(chevron("F2")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Conceptos de la factura F2")).toBeInTheDocument();
  });

  it("shows the original currency line for a converted invoice", () => {
    seed([inv("US", { moneda: "USD", tipoCambio: "18.20", total: "100.00", subTotal: "100.00" })]);
    render(<Harness />);
    fireEvent.click(chevron("US"));
    expect(screen.getByText("Moneda original: USD · TC 18.20")).toBeInTheDocument();
  });

  it("shows when a PPD invoice was paid, once per loaded payment", () => {
    const ppd = inv("PP", { metodoPago: "PPD", formaPago: "99" });
    const pago = inv("PG", {
      tipo: "P",
      moneda: "XXX",
      total: "0",
      subTotal: "0",
      pagos: [
        {
          fechaPago: "2025-03-15T12:00:00",
          formaDePagoP: "04",
          monedaP: "MXN",
          monto: "116.00",
          doctos: [{ idDocumento: "PP", monedaDR: "MXN", impPagado: "116.00" }],
        },
      ],
    });
    seed([ppd, pago]);
    render(<Harness />);
    expect(within(dataRow("PP")).getByText("Tarjeta de crédito")).toBeInTheDocument();
    fireEvent.click(chevron("PP"));
    expect(screen.getByText("Pagada el 15/03/2025 con Tarjeta de crédito")).toBeInTheDocument();
  });

  it("explains a substituted original", () => {
    seed([
      inv("OR", { folio: "O-1" }),
      inv("RE", { folio: "R-1", relacionados: [{ tipoRelacion: "04", uuids: ["OR"] }] }),
    ]);
    render(<Harness />);
    const original = dataRow("OR");
    expect(within(original).getByText("Sustituida")).toBeInTheDocument();
    fireEvent.click(chevron("OR"));
    expect(screen.getByText("Sustituida por la factura R-1. No se suma.")).toBeInTheDocument();
  });
});

describe("InvoiceTable exclusion", () => {
  it("excludes at once with no dialog, marks the row, recomputes and toasts with undo", async () => {
    seed([inv("U1", { total: "100.00", subTotal: "100.00" }), inv("U2", { total: "50.00", subTotal: "50.00" })]);
    render(<Harness />);
    expect(screen.getByTestId("gasto")).toHaveTextContent("$150.00");
    await openMenu("U1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir factura" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useSessionStore.getState().excluded.has("U1")).toBe(true);
    const row = dataRow("U1");
    expect(within(row).getByText("Excluida")).toBeInTheDocument();
    expect(within(row).getByText("$100.00").className).toContain("line-through");
    expect(screen.getByTestId("gasto")).toHaveTextContent("$50.00");
    expect(toastMock).toHaveBeenCalledTimes(1);
    const [message, options] = toastMock.mock.calls[0] ?? [];
    expect(message).toBe("Factura excluida");
    expect(options?.duration).toBe(6000);
    expect(options?.action?.label).toBe("Deshacer exclusión");
  });

  it("undoes the exclusion from the toast action", async () => {
    seed([inv("U1", { total: "100.00", subTotal: "100.00" })]);
    render(<Harness />);
    await openMenu("U1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir factura" }));
    const [, options] = toastMock.mock.calls[0] ?? [];
    const undo = options?.action?.onClick;
    if (undo === undefined) throw new Error("no undo action");
    act(() => {
      undo();
    });
    expect(useSessionStore.getState().excluded.has("U1")).toBe(false);
    expect(useSessionStore.getState().restored.has("U1")).toBe(false);
    expect(screen.getByTestId("gasto")).toHaveTextContent("$100.00");
    expect(within(dataRow("U1")).queryByText("Excluida")).toBeNull();
  });

  it("WR-01: undoing a plain exclusion from the toast does not shield a substitute loaded later", async () => {
    seed([inv("X")]);
    render(<Harness />);
    await openMenu("X");
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir factura" }));
    const undo = lastExclusionUndo();
    act(() => {
      undo();
    });
    expect(screen.getByTestId("gasto")).toHaveTextContent("$116.00");
    seed([inv("Y", { relacionados: [{ tipoRelacion: "04", uuids: ["X"] }] })]);
    expect(within(dataRow("X")).getByText("Sustituida")).toBeInTheDocument();
    expect(screen.getByTestId("gasto")).toHaveTextContent("$116.00");
    expect(useSessionStore.getState().restored.has("X")).toBe(false);
    expect(screen.getByTestId("amount-changing")).toHaveTextContent("true");
  });

  it("WR-01: undoing the exclusion of a re-included substituted original brings the override back", async () => {
    seed([inv("X"), inv("Y", { relacionados: [{ tipoRelacion: "04", uuids: ["X"] }] })]);
    act(() => {
      useSessionStore.setState({ restored: new Set(["X"]) });
    });
    render(<Harness />);
    expect(screen.getByTestId("gasto")).toHaveTextContent("$232.00");
    await openMenu("X");
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir factura" }));
    expect(screen.getByTestId("gasto")).toHaveTextContent("$116.00");
    expect(useSessionStore.getState().restored.has("X")).toBe(false);
    const undo = lastExclusionUndo();
    act(() => {
      undo();
    });
    expect(screen.getByTestId("gasto")).toHaveTextContent("$232.00");
    expect(useSessionStore.getState().restored.has("X")).toBe(true);
    expect(within(dataRow("X")).queryByText("Sustituida")).toBeNull();
  });

  it("WR-01: a substitute that arrives while the undo toast is open still leaves the original substituted after the undo", async () => {
    seed([inv("X")]);
    render(<Harness />);
    await openMenu("X");
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir factura" }));
    seed([inv("Y", { relacionados: [{ tipoRelacion: "04", uuids: ["X"] }] })]);
    expect(within(dataRow("X")).getByText("Excluida")).toBeInTheDocument();
    expect(screen.getByTestId("gasto")).toHaveTextContent("$116.00");
    const undo = lastExclusionUndo();
    act(() => {
      undo();
    });
    expect(within(dataRow("X")).getByText("Sustituida")).toBeInTheDocument();
    expect(screen.getByTestId("gasto")).toHaveTextContent("$116.00");
    expect(useSessionStore.getState().restored.has("X")).toBe(false);
  });

  it("offers Volver a incluir on an excluded row and toasts the reinclusion", async () => {
    seed([inv("U1", { total: "100.00", subTotal: "100.00" })]);
    render(<Harness />);
    act(() => {
      useSessionStore.getState().excludeInvoice("U1");
    });
    await openMenu("U1");
    expect(screen.queryByRole("menuitem", { name: "Excluir factura" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Volver a incluir" }));
    expect(useSessionStore.getState().excluded.has("U1")).toBe(false);
    expect(screen.getByTestId("gasto")).toHaveTextContent("$100.00");
    expect(toastMock).toHaveBeenCalledWith("Factura incluida de nuevo", expect.objectContaining({ duration: 6000 }));
  });

  it("brings a substituted original back with Volver a incluir", async () => {
    seed([
      inv("OR", { folio: "O-1", total: "100.00", subTotal: "100.00" }),
      inv("RE", { folio: "R-1", total: "100.00", subTotal: "100.00", relacionados: [{ tipoRelacion: "04", uuids: ["OR"] }] }),
    ]);
    render(<Harness />);
    expect(screen.getByTestId("gasto")).toHaveTextContent("$100.00");
    await openMenu("O-1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Volver a incluir" }));
    expect(useSessionStore.getState().restored.has("OR")).toBe(true);
    expect(screen.getByTestId("gasto")).toHaveTextContent("$200.00");
    expect(within(dataRow("OR")).queryByText("Sustituida")).toBeNull();
  });

  it("WR-01: a plain Volver a incluir from the row menu does not shield a substitute loaded later", async () => {
    seed([inv("X")]);
    render(<Harness />);
    act(() => {
      useSessionStore.getState().excludeInvoice("X");
    });
    await openMenu("X");
    fireEvent.click(screen.getByRole("menuitem", { name: "Volver a incluir" }));
    expect(useSessionStore.getState().restored.has("X")).toBe(false);
    seed([inv("Y", { relacionados: [{ tipoRelacion: "04", uuids: ["X"] }] })]);
    expect(within(dataRow("X")).getByText("Sustituida")).toBeInTheDocument();
    expect(screen.getByTestId("gasto")).toHaveTextContent("$116.00");
    expect(screen.getByTestId("amount-changing")).toHaveTextContent("true");
  });

  it("WR-01: Volver a incluir on a row both excluded by hand and substituted overrides the substitution too (user decision)", async () => {
    seed([inv("X")]);
    render(<Harness />);
    act(() => {
      useSessionStore.getState().excludeInvoice("X");
    });
    seed([inv("Y", { relacionados: [{ tipoRelacion: "04", uuids: ["X"] }] })]);
    expect(within(dataRow("X")).getByText("Excluida")).toBeInTheDocument();
    expect(screen.getByTestId("gasto")).toHaveTextContent("$116.00");
    await openMenu("X");
    fireEvent.click(screen.getByRole("menuitem", { name: "Volver a incluir" }));
    expect(useSessionStore.getState().restored.has("X")).toBe(true);
    expect(useSessionStore.getState().excluded.has("X")).toBe(false);
    expect(screen.getByTestId("gasto")).toHaveTextContent("$232.00");
    expect(within(dataRow("X")).queryByText("Excluida")).toBeNull();
    expect(within(dataRow("X")).queryByText("Sustituida")).toBeNull();
    expect(screen.getByTestId("amount-changing")).toHaveTextContent("false");
  });

  it("lasts only the session and writes nothing to the browser storage", async () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    seed([inv("U1")]);
    render(<Harness />);
    await openMenu("U1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir factura" }));
    expect(write).not.toHaveBeenCalled();
    expect(await readStoredSettings()).toBeNull();
    cleanup();
    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed([inv("U1")]);
    render(<Harness />);
    expect(within(dataRow("U1")).queryByText("Excluida")).toBeNull();
    expect(useSessionStore.getState().excluded.size).toBe(0);
  });

  it("returns focus to the menu trigger after choosing an item", async () => {
    seed([inv("U1")]);
    render(<Harness />);
    await openMenu("U1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir factura" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Acciones de la factura U1" })).toHaveFocus();
    });
  });
});

describe("InvoiceTable layout, long text and untrusted text", () => {
  it("scrolls horizontally inside its container with a 960 px minimum width", () => {
    seed([inv("U1")]);
    render(<Harness />);
    const table = screen.getByRole("table");
    expect(table.className).toContain("min-w-[960px]");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
  });

  it("truncates long supplier and forma de pago text but wraps concept descriptions", () => {
    const longName = "Comercializadora-Integral-de-Servicios-Especializados-".repeat(2).slice(0, 90);
    const longDescription = "x".repeat(200);
    const entry = makeEntry({
      formas: ["01", "03", "04"],
      supplierName: longName,
      invoice: makeInvoice({
        uuid: "LT",
        folio: "LT",
        conceptos: [concepto({ descripcion: longDescription })],
      }),
    });
    render(<InvoiceTable rows={[entry]} ledger={[entry]} mode="con" />);
    const supplier = screen.getByRole("button", { name: longName });
    expect(supplier.className).toContain("truncate");
    const formas = screen.getByRole("button", {
      name: "Efectivo, Transferencia electrónica de fondos, Tarjeta de crédito",
    });
    expect(formas.className).toContain("truncate");
    fireEvent.click(chevron("LT"));
    const description = screen.getByText(longDescription);
    expect(description.className).toContain("wrap-anywhere");
    expect(description.className).not.toContain("truncate");
  });

  it("renders markup-like text as text and never injects elements", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    seed([
      inv("XS", {
        emisor: { rfc: "AAA010101AAA", nombre: hostile },
        folio: hostile,
        conceptos: [concepto({ descripcion: hostile })],
      }),
    ]);
    render(<Harness />);
    fireEvent.click(chevron("XS"));
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getAllByText(hostile).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: `Acciones de la factura ${hostile}` })).toBeInTheDocument();
  });
});

describe("InvoiceTable with prebuilt entries", () => {
  it("renders a row per entry it receives", () => {
    const a: LedgerEntry = makeEntry({ invoice: makeInvoice({ uuid: "A", folio: "A" }) });
    const b: LedgerEntry = makeEntry({ invoice: makeInvoice({ uuid: "B", folio: "B" }) });
    render(<InvoiceTable rows={[a, b]} ledger={[a, b]} mode="con" />);
    expect(dataRows()).toHaveLength(2);
  });
});

describe("InvoiceTable focus request (D-33, Pitfall 17)", () => {
  function many(count: number): ParsedInvoice[] {
    return Array.from({ length: count }, (_, i) =>
      inv(`P${String(i).padStart(3, "0")}`, {
        fecha: `2025-01-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`,
      }),
    );
  }

  function request(uuid: string): void {
    act(() => {
      useSessionStore.getState().requestFocus(uuid);
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("jumps to the page of a row at sorted position 105, opens it, centres it, focuses its chevron and clears the request", () => {
    seed(many(120));
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    // Fecha descending: position 105 (0-based) is the invoice P014.
    request("P014");
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();
    expect(chevron("P014")).toHaveAttribute("aria-expanded", "true");
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(dataRow("P014"));
    expect(scroll.mock.calls[0]?.[0]).toMatchObject({ block: "center" });
    expect(chevron("P014")).toHaveFocus();
    expect(useSessionStore.getState().focusRequest).toBeNull();
  });

  it("does not repeat the jump when the table is sorted again afterwards", () => {
    seed(many(120));
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    request("P014");
    expect(scroll).toHaveBeenCalledTimes(1);
    clickHeader("Folio");
    clickHeader("Folio");
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();
    expect(chevron("P014")).toHaveAttribute("aria-expanded", "true");
  });

  it("scrolls smoothly unless the user prefers reduced motion", () => {
    seed(many(60));
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    request("P030");
    expect(scroll.mock.calls[0]?.[0]).toMatchObject({ block: "center", behavior: "smooth" });
  });

  it("uses auto behavior when prefers-reduced-motion matches", () => {
    seed(many(60));
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    request("P030");
    expect(scroll.mock.calls[0]?.[0]).toMatchObject({ block: "center", behavior: "auto" });
  });

  it("uses auto behavior when matchMedia is unavailable", () => {
    seed(many(60));
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    request("P030");
    expect(scroll.mock.calls[0]?.[0]).toMatchObject({ block: "center", behavior: "auto" });
  });

  it("keeps the other open panels when it opens the requested one", () => {
    seed(many(60));
    render(<Harness />);
    fireEvent.click(chevron("P059"));
    request("P010");
    expect(chevron("P059")).toHaveAttribute("aria-expanded", "true");
    expect(chevron("P010")).toHaveAttribute("aria-expanded", "true");
  });

  it("clears at once a request for a uuid that is not in the ledger, without any visible effect", () => {
    seed(many(60));
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    request("NO-SUCH-UUID");
    expect(useSessionStore.getState().focusRequest).toBeNull();
    expect(scroll).not.toHaveBeenCalled();
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(document.querySelector('[aria-expanded="true"]')).toBeNull();
  });

  it("does not move the table nor clear the request when the row is in the ledger but filtered out", () => {
    seed(many(60));
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness only={new Set(["P000", "P001"])} />);
    request("P030");
    expect(scroll).not.toHaveBeenCalled();
    expect(useSessionStore.getState().focusRequest?.uuid).toBe("P030");
    expect(dataRows()).toHaveLength(2);
  });
});
