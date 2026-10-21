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
import { scopeToCategories } from "@/domain/accounting/categories";
import { buildLedger } from "@/domain/accounting/ledger";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { qualitySummary } from "@/domain/accounting/quality";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { makeResolver } from "@/domain/settings/resolver";
import { SIN_CATEGORIA, defaultSettings } from "@/domain/settings/types";
import { useCategorySettings } from "@/features/categories/useCategorySettings";
import { DashboardTab } from "@/features/dashboard/DashboardTab";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { readStoredSettings, resetSettingsStore } from "../../../tests/support/settingsStorage";
import { makeEntry, makeInvoice, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";
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

const NO_CATEGORIES: ReadonlySet<string> = new Set<string>();

/** Scopes prebuilt entries to a category selection with the default settings (no selection keeps them whole). */
function scoped(entries: readonly LedgerEntry[]) {
  return scopeToCategories(entries, NO_CATEGORIES, makeResolver(defaultSettings()));
}

/** Builds the ledger from the session store like the Dashboard does. */
function Harness({
  mode = "con",
  only,
  categories = NO_CATEGORIES,
}: {
  mode?: IvaMode;
  only?: ReadonlySet<string>;
  /** The category selection, applied like the Dashboard's selectView does. */
  categories?: ReadonlySet<string>;
}) {
  const { resolver } = useCategorySettings();
  const invoices = useSessionStore((s) => s.invoices);
  const excluded = useSessionStore((s) => s.excluded);
  const restored = useSessionStore((s) => s.restored);
  const ledger = useMemo(
    () => buildLedger(invoices, { excluded, restored }, TEST_FECHA_CONTEXT),
    [invoices, excluded, restored],
  );
  const rows = useMemo(
    () =>
      scopeToCategories(
        only === undefined ? ledger : ledger.filter((e) => only.has(e.uuid)),
        categories,
        resolver,
      ),
    [ledger, only, categories, resolver],
  );
  return (
    <>
      <p data-testid="gasto">{formatMoney(totalSpend(ledger, mode))}</p>
      <p data-testid="amount-changing">{String(qualitySummary(ledger).amountChanging)}</p>
      <InvoiceTable rows={rows} ledger={ledger} mode={mode} categoryFilter={categories} />
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
    resetSettingsStore();
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
    render(<InvoiceTable rows={scoped([entry])} ledger={[entry]} mode="con" categoryFilter={NO_CATEGORIES} />);
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
    render(<InvoiceTable rows={scoped([a, b])} ledger={[a, b]} mode="con" categoryFilter={NO_CATEGORIES} />);
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

describe("InvoiceTable reveal request (D-18, DASH-08)", () => {
  function reveal(): void {
    act(() => {
      useSessionStore.getState().revealCategory("seed:limpieza-higiene");
    });
  }

  function stubMatchMedia(reduce: boolean): void {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps room for the sticky header above the section: 72 px, 124 px below 640 px", () => {
    seed([inv("A"), inv("B")]);
    render(<Harness />);
    const section = screen.getByRole("region", { name: "Facturas (2)" });
    expect(section.className).toContain("scroll-mt-[72px]");
    expect(section.className).toContain("max-sm:scroll-mt-[124px]");
  });

  it("makes the heading programmatically focusable and out of the tab order", () => {
    seed([inv("A")]);
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Facturas (1)" })).toHaveAttribute("tabindex", "-1");
  });

  it("scrolls the section to the top of the screen, smoothly, and focuses the heading without scrolling", () => {
    seed([inv("A"), inv("B")]);
    stubMatchMedia(false);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<Harness />);
    reveal();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(screen.getByRole("region", { name: "Facturas (2)" }));
    expect(scroll.mock.calls[0]?.[0]).toMatchObject({ block: "start", behavior: "smooth" });
    const heading = screen.getByRole("heading", { name: "Facturas (2)" });
    expect(heading).toHaveFocus();
    const call = focus.mock.calls.findIndex((_args, index) => focus.mock.contexts[index] === heading);
    expect(focus.mock.calls[call]?.[0]).toMatchObject({ preventScroll: true });
  });

  it("jumps instead of gliding when prefers-reduced-motion matches", () => {
    seed([inv("A")]);
    stubMatchMedia(true);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    reveal();
    expect(scroll.mock.calls[0]?.[0]).toMatchObject({ block: "start", behavior: "auto" });
  });

  it("jumps instead of gliding when matchMedia is unavailable", () => {
    seed([inv("A")]);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    reveal();
    expect(scroll.mock.calls[0]?.[0]).toMatchObject({ block: "start", behavior: "auto" });
  });

  it("scrolls again for a repeated reveal of a value that is already in the filter", () => {
    seed([inv("A")]);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    reveal();
    reveal();
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it("does nothing for the request value present when the table mounts, nor for 0", () => {
    seed([inv("A")]);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    act(() => {
      useSessionStore.setState({ revealRequest: 5 });
    });
    render(<Harness />);
    expect(scroll).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Facturas (1)" })).not.toHaveFocus();
  });

  it("does not repeat the scroll when the table re-renders without a new request", () => {
    seed([inv("A"), inv("B")]);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Harness />);
    reveal();
    clickHeader("Folio");
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("expands no row", () => {
    seed([inv("A"), inv("B")]);
    render(<Harness />);
    reveal();
    expect(document.querySelector('[aria-expanded="true"]')).toBeNull();
  });
});

describe("InvoiceTable concept category selector (CAT-03, D-09 to D-12, E7)", () => {
  const A = { rfc: "AAA010101AAA", nombre: "Proveedor A" };
  const B = { rfc: "BBB010101BBB", nombre: "Proveedor B" };
  const ABARROTES = "seed:abarrotes-despensa";
  const LIMPIEZA = "seed:limpieza-higiene";

  /** A taxed line: importe plus 16% IVA, so Con IVA is importe + iva. */
  function line(descripcion: string, importe: string, ivaImporte: string): Concepto {
    return concepto({
      descripcion,
      valorUnitario: importe,
      importe,
      objetoImp: "02",
      traslados: [iva(ivaImporte)],
    });
  }

  /** CLORO 1L ($116.00) and Jabón ($232.00): subtotal 300.00, total 348.00. */
  function cloroYJabon(
    uuid: string,
    emisor = A,
    overrides: Partial<ParsedInvoice> = {},
  ): ParsedInvoice {
    return inv(uuid, {
      emisor,
      subTotal: "300.00",
      total: "348.00",
      conceptos: [line("CLORO 1L", "100.00", "16.00"), line("Jabón", "200.00", "32.00")],
      ...overrides,
    });
  }

  function assignSupplier(rfc: string, name: string, categoryId: string): void {
    act(() => {
      useSettingsStore.getState().setSupplierCategory(rfc, name, categoryId);
    });
  }

  function conceptSelect(descripcion: string, index = 0): HTMLElement {
    const all = screen.getAllByRole("combobox", {
      name: `Categoría del concepto «${descripcion}»`,
    });
    const found = all[index];
    if (found === undefined) throw new Error(`no selector ${descripcion} at ${String(index)}`);
    return found;
  }

  /** Picks an item and waits for the popup to unmount, so the next pick sees only its own popup. */
  async function choose(trigger: HTMLElement, optionName: string): Promise<void> {
    fireEvent.click(trigger);
    const option = screen.getByRole("option", { name: optionName });
    // Base UI commits a mouse selection only when the pointer went down on the item.
    fireEvent.pointerDown(option);
    fireEvent.click(option);
    await waitFor(() => {
      expect(screen.queryByRole("option")).toBeNull();
    });
  }

  /** Visible text of the trigger without the chevron glyph jsdom renders as text. */
  function valueText(trigger: HTMLElement): string {
    return trigger.querySelector('[data-slot="select-value"]')?.textContent ?? "";
  }

  function storedRules() {
    return useSettingsStore.getState().conceptRules;
  }

  function blockAmount(name: string): string {
    const list = screen.getByRole("list", { name: "Gasto por categoría" });
    const row = within(list)
      .getAllByRole("listitem")
      .find((item) => item.textContent.startsWith(name));
    if (row === undefined) throw new Error(`no category row ${name}`);
    return within(row).getByText(/^−?\$[\d,]+\.\d{2}$/).textContent;
  }

  it("adds the column Categoría after Monto and one selector per line, named after the line", () => {
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    const panel = screen.getByRole("region", { name: "Conceptos de la factura F1" });
    const headers = within(panel)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "Descripción",
      "Cantidad",
      "Unidad",
      "Precio unitario",
      "Monto",
      "Categoría",
    ]);
    expect(within(panel).getAllByRole("combobox")).toHaveLength(2);
    expect(conceptSelect("CLORO 1L")).toBeInTheDocument();
    expect(conceptSelect("Jabón")).toBeInTheDocument();
  });

  it("E7 empty: a line with no rule and no supplier category reads «Sin categoría» muted, with no suffix", () => {
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    const trigger = conceptSelect("CLORO 1L");
    expect(valueText(trigger)).toBe("Sin categoría");
    expect(within(trigger).getByText("Sin categoría").className).toContain("text-muted-foreground");
    expect(within(trigger).queryByText("· del proveedor")).toBeNull();
  });

  it("reads «{nombre} · del proveedor» for a supplier-derived value: name muted, suffix 12px muted and not shrinking", () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    const trigger = conceptSelect("CLORO 1L");
    expect(trigger).toHaveTextContent("Abarrotes y despensa · del proveedor");
    const name = within(trigger).getByText("Abarrotes y despensa");
    expect(name.className).toContain("text-muted-foreground");
    expect(name.className).toContain("truncate");
    const suffix = within(trigger).getByText("· del proveedor");
    expect(suffix.className).toContain("text-xs");
    expect(suffix.className).toContain("text-muted-foreground");
    expect(suffix.className).toContain("shrink-0");
  });

  it("lists «Sin categoría» first, then the categories in list order with «Otros» last", () => {
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    fireEvent.click(conceptSelect("CLORO 1L"));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names).toEqual([
      "Sin categoría",
      "Abarrotes y despensa",
      "Comisiones bancarias",
      "Insumos de cafetería",
      "Limpieza e higiene",
      "Mantenimiento y reparaciones",
      "Papelería y oficina",
      "Servicios (luz, agua, internet, teléfono)",
      "Software y suscripciones",
      "Otros",
    ]);
  });

  it("E7 overflow: the popup is at most 288 px tall, its items wrap and the touch target grows under 640 px", () => {
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    const trigger = conceptSelect("CLORO 1L");
    expect(trigger.className).toContain("min-w-[240px]");
    expect(trigger.className).toContain("max-sm:h-11");
    fireEvent.click(trigger);
    const popup = document.querySelector('[data-slot="select-content"]');
    expect(popup?.className).toContain("max-h-[min(18rem,var(--available-height))]");
    const item = screen.getByRole("option", { name: "Servicios (luz, agua, internet, teléfono)" });
    expect(within(item).getByText("Servicios (luz, agua, internet, teléfono)").className).toContain(
      "whitespace-normal",
    );
    expect(item.className).toContain("max-sm:min-h-11");
  });

  it("CAT-03 criterion 1: changing CLORO 1L moves only that line in «Gasto por categoría»", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed([cloroYJabon("F1")]);
    render(<DashboardTab />);
    expect(blockAmount("Abarrotes y despensa")).toBe("$348.00");
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    expect(blockAmount("Limpieza e higiene")).toBe("$116.00");
    expect(blockAmount("Abarrotes y despensa")).toBe("$232.00");
    // The adjusted line is in the foreground color with no suffix; the other keeps the supplier's.
    const adjusted = conceptSelect("CLORO 1L");
    expect(valueText(adjusted)).toBe("Limpieza e higiene");
    expect(within(adjusted).getByText("Limpieza e higiene").className).toContain("text-foreground");
    expect(conceptSelect("Jabón")).toHaveTextContent("Abarrotes y despensa · del proveedor");
    expect(storedRules()).toEqual([
      { rfc: A.rfc, key: "cloro 1l", description: "CLORO 1L", categoryId: LIMPIEZA },
    ]);
  });

  it("applies the rule to an equal line of the same supplier in another invoice, also when loaded later, and not to another supplier", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    assignSupplier(B.rfc, B.nombre, ABARROTES);
    seed([
      cloroYJabon("F1", A, { fecha: "2025-01-10T10:00:00" }),
      inv("F2", {
        emisor: A,
        fecha: "2025-01-20T10:00:00",
        subTotal: "100.00",
        total: "116.00",
        conceptos: [line("cloro  1l", "100.00", "16.00")],
      }),
      inv("F3", {
        emisor: B,
        fecha: "2025-01-30T10:00:00",
        subTotal: "100.00",
        total: "116.00",
        conceptos: [line("CLORO 1L", "100.00", "16.00")],
      }),
    ]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    fireEvent.click(chevron("F2"));
    fireEvent.click(chevron("F3"));
    // Fecha descending lists F3 (supplier B) before F1 (supplier A): pick the line of F1.
    const f1Line = within(
      screen.getByRole("region", { name: "Conceptos de la factura F1" }),
    ).getByRole("combobox", { name: "Categoría del concepto «CLORO 1L»" });
    await choose(f1Line, "Limpieza e higiene");
    // The equal line of supplier A (different case and spacing) follows the rule.
    // The accessible name collapses the double space of the description.
    expect(valueText(conceptSelect("cloro 1l"))).toBe("Limpieza e higiene");
    // The same text from supplier B keeps B's supplier category.
    const f3Line = within(
      screen.getByRole("region", { name: "Conceptos de la factura F3" }),
    ).getByRole("combobox", { name: "Categoría del concepto «CLORO 1L»" });
    expect(f3Line).toHaveTextContent("Abarrotes y despensa · del proveedor");
    // A later load of the same supplier follows the stored rule at once.
    seed([
      inv("F4", {
        emisor: A,
        fecha: "2025-02-01T10:00:00",
        subTotal: "100.00",
        total: "116.00",
        conceptos: [line("Cloro 1L", "100.00", "16.00")],
      }),
    ]);
    fireEvent.click(chevron("F4"));
    expect(valueText(conceptSelect("Cloro 1L"))).toBe("Limpieza e higiene");
  });

  it("choosing «Sin categoría» on a supplier line stores an explicit adjustment shown in the foreground color", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Sin categoría");
    expect(storedRules()).toEqual([
      { rfc: A.rfc, key: "cloro 1l", description: "CLORO 1L", categoryId: null },
    ]);
    const trigger = conceptSelect("CLORO 1L");
    expect(valueText(trigger)).toBe("Sin categoría");
    expect(within(trigger).getByText("Sin categoría").className).toContain("text-foreground");
  });

  it("choosing the supplier's own category on an unadjusted line still stores a rule, shown as adjusted", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Abarrotes y despensa");
    expect(storedRules()).toEqual([
      { rfc: A.rfc, key: "cloro 1l", description: "CLORO 1L", categoryId: ABARROTES },
    ]);
    const trigger = conceptSelect("CLORO 1L");
    expect(valueText(trigger)).toBe("Abarrotes y despensa");
    expect(within(trigger).getByText("Abarrotes y despensa").className).toContain("text-foreground");
  });

  it("encodes the values so a category whose id is «none» cannot be confused with «Sin categoría»", async () => {
    act(() => {
      useSettingsStore.setState({
        categories: [...defaultSettings().categories, { id: "none", name: "Ninguna" }],
      });
    });
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Ninguna");
    expect(storedRules()[0]?.categoryId).toBe("none");
    await choose(conceptSelect("CLORO 1L"), "Sin categoría");
    expect(storedRules()[0]?.categoryId).toBeNull();
  });

  it("works on a «No suma» Pago row and on an «Excluida» row (UI-SPEC Q6)", async () => {
    seed([
      inv("PG", {
        tipo: "P",
        moneda: "XXX",
        total: "0",
        subTotal: "0",
        conceptos: [concepto({ descripcion: "Pago" })],
      }),
      inv("EX", { emisor: B, conceptos: [concepto({ descripcion: "Renta" })] }),
    ]);
    render(<Harness />);
    act(() => {
      useSessionStore.getState().excludeInvoice("EX");
    });
    expect(within(dataRow("PG")).getByText("No suma")).toBeInTheDocument();
    expect(within(dataRow("EX")).getByText("Excluida")).toBeInTheDocument();
    fireEvent.click(chevron("PG"));
    fireEvent.click(chevron("EX"));
    await choose(conceptSelect("Pago"), "Servicios (luz, agua, internet, teléfono)");
    await choose(conceptSelect("Renta"), "Limpieza e higiene");
    expect(storedRules().map((rule) => [rule.rfc, rule.key, rule.categoryId])).toEqual([
      ["EMI010101AAA", "pago", "seed:servicios"],
      [B.rfc, "renta", LIMPIEZA],
    ]);
  });

  it("classifies a credit-note line by the same rule and it subtracts from that category (D-12)", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed([
      cloroYJabon("O1", A, { fecha: "2025-01-10T10:00:00" }),
      inv("E1", {
        emisor: A,
        tipo: "E",
        fecha: "2025-01-20T10:00:00",
        subTotal: "100.00",
        total: "116.00",
        conceptos: [line("CLORO 1L", "100.00", "16.00")],
        relacionados: [{ tipoRelacion: "01", uuids: ["O1"] }],
      }),
    ]);
    render(<DashboardTab />);
    fireEvent.click(chevron("O1"));
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    // The CLORO line of the invoice (+116.00) and of the credit note (-116.00) net to zero in
    // Limpieza e higiene; nothing is inherited from the related invoice.
    expect(blockAmount("Limpieza e higiene")).toBe("$0.00");
    expect(blockAmount("Abarrotes y despensa")).toBe("$232.00");
  });

  it("refuses the 20,001st adjusted line with a toast and stores nothing", async () => {
    act(() => {
      useSettingsStore.setState({
        conceptRules: Array.from({ length: 20000 }, (_, index) => ({
          rfc: "ZZZ010101ZZZ",
          key: `linea ${String(index)}`,
          description: `Línea ${String(index)}`,
          categoryId: LIMPIEZA,
        })),
      });
    });
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    expect(toastMock).toHaveBeenCalledWith("Llegaste al máximo de 20,000 conceptos ajustados.");
    expect(storedRules()).toHaveLength(20000);
    expect(valueText(conceptSelect("CLORO 1L"))).toBe("Sin categoría");
  });

  it("caps the description in the aria-label at 60 characters", () => {
    const long = "L".repeat(80);
    seed([inv("F1", { conceptos: [concepto({ descripcion: long })] })]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    expect(
      screen.getByRole("combobox", { name: `Categoría del concepto «${"L".repeat(59)}…»` }),
    ).toBeInTheDocument();
  });

  it("E7 long-text: the trigger truncates a long category name and keeps the suffix visible", () => {
    const longName = "Servicios de mantenimiento preventivo y correctivo de equipo".padEnd(60, "x");
    act(() => {
      const added = useSettingsStore.getState().addCategory(longName);
      if (!added.ok) throw new Error("the add must be accepted");
      useSettingsStore.getState().setSupplierCategory(A.rfc, A.nombre, added.category.id);
    });
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    const trigger = conceptSelect("CLORO 1L");
    expect(within(trigger).getByText(longName).className).toContain("truncate");
    expect(within(trigger).getByText("· del proveedor").className).toContain("shrink-0");
  });

  it("renders a markup-like description and category name as text only", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    act(() => {
      const added = useSettingsStore.getState().addCategory(hostile);
      if (!added.ok) throw new Error("the add must be accepted");
      useSettingsStore.getState().setSupplierCategory(A.rfc, A.nombre, added.category.id);
    });
    seed([inv("F1", { emisor: A, conceptos: [concepto({ descripcion: hostile })] })]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    expect(document.querySelector("img")).toBeNull();
    const trigger = screen.getByRole("combobox", {
      name: `Categoría del concepto «${hostile}»`,
    });
    expect(trigger).toHaveTextContent(`${hostile} · del proveedor`);
  });

  /** The most recent toast whose message is `message`, with its options. */
  function lastToast(message: string): ToastOptions {
    for (let index = toastMock.mock.calls.length - 1; index >= 0; index -= 1) {
      const [text, options] = toastMock.mock.calls[index] ?? [];
      if (text === message) return options ?? {};
    }
    throw new Error(`no toast ${message}`);
  }

  function toastMessages(): string[] {
    return toastMock.mock.calls.map(([text]) => text);
  }

  /** Opens the popup without choosing anything, reads its option names and closes it. */
  async function optionNames(trigger: HTMLElement): Promise<string[]> {
    fireEvent.click(trigger);
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("option")).toBeNull();
    });
    return names;
  }

  /** The «Aplica a {n} líneas de {proveedor}» caption under a selector, or null. */
  function reachCaption(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-slot="concept-reach"]');
  }

  /** Two loaded lines of supplier A that share the rule key «cloro 1l», plus an unrelated one. */
  function twoCloroLines(): ParsedInvoice[] {
    return [
      cloroYJabon("F1", A, { fecha: "2025-01-10T10:00:00" }),
      inv("F2", {
        emisor: A,
        fecha: "2025-01-20T10:00:00",
        subTotal: "100.00",
        total: "116.00",
        conceptos: [line("cloro  1l", "100.00", "16.00")],
      }),
    ];
  }

  it("Q5: a change shows the toast with Deshacer for 6 s, and the caption counts the lines the rule reaches", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed(twoCloroLines());
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    expect(reachCaption()).toBeNull();
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    const caption = reachCaption();
    expect(caption).not.toBeNull();
    expect(caption).toHaveTextContent("Aplica a 2 líneas de Proveedor A");
    expect(caption?.className).toContain("text-xs");
    expect(caption?.className).toContain("text-muted-foreground");
    const message = "Categoría de «CLORO 1L» cambiada a Limpieza e higiene";
    expect(toastMock).toHaveBeenCalledWith(message, expect.objectContaining({ duration: 6000 }));
    expect(lastToast(message).action?.label).toBe("Deshacer");
  });

  it("Q5: Deshacer removes the rule it created and the caption disappears", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed(twoCloroLines());
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    expect(storedRules()).toHaveLength(1);
    const undo = lastToast("Categoría de «CLORO 1L» cambiada a Limpieza e higiene").action?.onClick;
    if (undo === undefined) throw new Error("no undo action");
    act(() => {
      undo();
    });
    expect(storedRules()).toEqual([]);
    expect(reachCaption()).toBeNull();
    expect(conceptSelect("CLORO 1L")).toHaveTextContent("Abarrotes y despensa · del proveedor");
  });

  it("T-03-36: Deshacer on an already adjusted line puts back exactly the previous rule", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed(twoCloroLines());
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    const before = storedRules();
    await choose(conceptSelect("CLORO 1L"), "Servicios (luz, agua, internet, teléfono)");
    expect(storedRules()[0]?.categoryId).toBe("seed:servicios");
    const undo = lastToast(
      "Categoría de «CLORO 1L» cambiada a Servicios (luz, agua, internet, teléfono)",
    ).action?.onClick;
    if (undo === undefined) throw new Error("no undo action");
    act(() => {
      undo();
    });
    expect(storedRules()).toEqual(before);
    expect(valueText(conceptSelect("CLORO 1L"))).toBe("Limpieza e higiene");
    expect(reachCaption()).toHaveTextContent("Aplica a 2 líneas de Proveedor A");
  });

  it("Q5: Deshacer after an explicit «Sin categoría» restores the supplier's category", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed(twoCloroLines());
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Sin categoría");
    expect(storedRules()[0]?.categoryId).toBeNull();
    const undo = lastToast("Categoría de «CLORO 1L» cambiada a Sin categoría").action?.onClick;
    if (undo === undefined) throw new Error("no undo action");
    act(() => {
      undo();
    });
    expect(storedRules()).toEqual([]);
    expect(conceptSelect("CLORO 1L")).toHaveTextContent("Abarrotes y despensa · del proveedor");
  });

  it("E7 zero-one-many: the caption reads «1 línea» with one matching line and counts loaded lines of later loads", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    expect(reachCaption()).toHaveTextContent("Aplica a 1 línea de Proveedor A");
    seed([
      inv("F2", {
        emisor: A,
        subTotal: "100.00",
        total: "116.00",
        conceptos: [line("Cloro 1L", "100.00", "16.00")],
      }),
      inv("F3", {
        emisor: B,
        subTotal: "100.00",
        total: "116.00",
        conceptos: [line("Cloro 1L", "100.00", "16.00")],
      }),
    ]);
    // Supplier B's equal text does not count; supplier A's later line does.
    expect(reachCaption()).toHaveTextContent("Aplica a 2 líneas de Proveedor A");
  });

  it("D-09: the count includes the lines of a Pago and of an excluded invoice", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed([
      cloroYJabon("F1", A, { fecha: "2025-01-10T10:00:00" }),
      cloroYJabon("F2", A, { fecha: "2025-01-11T10:00:00", tipo: "P" }),
      cloroYJabon("F3", A, { fecha: "2025-01-12T10:00:00" }),
    ]);
    act(() => {
      useSessionStore.getState().excludeInvoice("F3");
    });
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    expect(reachCaption()).toHaveTextContent("Aplica a 3 líneas de Proveedor A");
  });

  it("E7 populated: a supplier-derived or implicit line has no caption and no «Quitar ajuste» item", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed([cloroYJabon("F1")]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    expect(reachCaption()).toBeNull();
    const names = await optionNames(conceptSelect("CLORO 1L"));
    expect(names).not.toContain("Quitar ajuste");
    expect(names[0]).toBe("Sin categoría");
  });

  it("Q5: «Quitar ajuste» comes last after a separator on an adjusted line and removes the rule", async () => {
    assignSupplier(A.rfc, A.nombre, ABARROTES);
    seed(twoCloroLines());
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    fireEvent.click(conceptSelect("CLORO 1L"));
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveTextContent("Quitar ajuste");
    expect(document.querySelector('[data-slot="select-separator"]')).not.toBeNull();
    toastMock.mockClear();
    const remove = screen.getByRole("option", { name: "Quitar ajuste" });
    fireEvent.pointerDown(remove);
    fireEvent.click(remove);
    await waitFor(() => {
      expect(screen.queryByRole("option")).toBeNull();
    });
    expect(storedRules()).toEqual([]);
    expect(reachCaption()).toBeNull();
    expect(toastMessages()).toEqual(["Ajuste quitado"]);
    expect(conceptSelect("CLORO 1L")).toHaveTextContent("Abarrotes y despensa · del proveedor");
  });

  it("E7 long-text: the toast cuts the description to 40 characters including «…»", async () => {
    const long = "D".repeat(80);
    seed([inv("F1", { conceptos: [line(long, "100.00", "16.00")] })]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(
      screen.getByRole("combobox", { name: `Categoría del concepto «${"D".repeat(59)}…»` }),
      "Limpieza e higiene",
    );
    expect(toastMessages()).toEqual([
      `Categoría de «${"D".repeat(39)}…» cambiada a Limpieza e higiene`,
    ]);
  });

  it("E7 long-text: the caption cuts a long supplier name with TruncatedText and keeps the full name accessible", async () => {
    const longName = "Comercializadora de abarrotes y productos de limpieza del bajío ".repeat(2).trim();
    seed([cloroYJabon("F1", { rfc: A.rfc, nombre: longName })]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(conceptSelect("CLORO 1L"), "Limpieza e higiene");
    const caption = reachCaption();
    if (caption === null) throw new Error("no caption");
    const name = within(caption).getByRole("button", { name: longName });
    expect(name.className).toContain("truncate");
  });

  it("T-03-35: markup-like supplier and description text stays text in the caption and the toast", async () => {
    const hostile = "<img src=x onerror=alert(1)>";
    seed([
      inv("F1", {
        emisor: { rfc: A.rfc, nombre: hostile },
        conceptos: [line(hostile, "100.00", "16.00")],
      }),
    ]);
    render(<Harness />);
    fireEvent.click(chevron("F1"));
    await choose(
      screen.getByRole("combobox", { name: `Categoría del concepto «${hostile}»` }),
      "Limpieza e higiene",
    );
    expect(document.querySelector("img")).toBeNull();
    expect(reachCaption()).toHaveTextContent(`Aplica a 1 línea de ${hostile}`);
    expect(toastMessages()).toContain(`Categoría de «${hostile}» cambiada a Limpieza e higiene`);
  });

  describe("category from the product (CAT-04, D-16, E8)", () => {
    const OTROS = "seed:otros";
    const FROM_PRODUCT = "· del producto";

    /** Stores a product whose only member is CLORO 1L of supplier A (rfc, normalized key, readable text). */
    function storeProduct(name: string, categoryId: string | null): void {
      act(() => {
        useSettingsStore.setState({
          products: [
            {
              id: "prod_cloro",
              name,
              categoryId,
              members: [
                { rfc: A.rfc, key: "cloro 1l", description: "CLORO 1L", supplierName: A.nombre },
              ],
            },
          ],
        });
      });
    }

    /** The selector of CLORO 1L whose accessible name carries the product suffix. */
    function productSelect(categoria: string, producto: string): HTMLElement {
      return screen.getByRole("combobox", {
        name: `Categoría del concepto «CLORO 1L», ${categoria} del producto ${producto}`,
      });
    }

    function openPanel(): void {
      seed([cloroYJabon("F1")]);
      render(<Harness />);
      fireEvent.click(chevron("F1"));
    }

    it("E8 populated: reads «{categoría} · del producto {nombre}» with the name muted and the suffix 12px muted", () => {
      storeProduct("Cloro", LIMPIEZA);
      openPanel();
      const trigger = productSelect("Limpieza e higiene", "Cloro");
      expect(trigger).toHaveTextContent(`Limpieza e higiene ${FROM_PRODUCT} Cloro`);
      const name = within(trigger).getByText("Limpieza e higiene");
      expect(name.className).toContain("text-muted-foreground");
      expect(name.className).toContain("truncate");
      const suffix = within(trigger).getByText(FROM_PRODUCT);
      expect(suffix.className).toContain("text-xs");
      expect(suffix.className).toContain("text-muted-foreground");
      expect(suffix.className).toContain("shrink-0");
      expect(within(trigger).queryByText("· del proveedor")).toBeNull();
      // The other line of the invoice is not in the product.
      expect(valueText(conceptSelect("Jabón"))).toBe("Sin categoría");
    });

    it("E8 populated: takes the category from the product even when the supplier has another", () => {
      assignSupplier(A.rfc, A.nombre, ABARROTES);
      storeProduct("Cloro", LIMPIEZA);
      openPanel();
      expect(productSelect("Limpieza e higiene", "Cloro")).toBeInTheDocument();
      expect(valueText(conceptSelect("Jabón"))).toBe("Abarrotes y despensa · del proveedor");
    });

    it("E8 long-text: caps the product name at 120px and keeps it whole in the accessible name", () => {
      const long = "Producto con un nombre larguísimo ".repeat(2).trim().slice(0, 60);
      storeProduct(long, LIMPIEZA);
      openPanel();
      const trigger = productSelect("Limpieza e higiene", long);
      const productText = within(trigger).getByText(long);
      expect(productText.className).toContain("max-w-[120px]");
      expect(productText.className).toContain("truncate");
      expect(productText.className).toContain("text-xs");
      expect(productText.className).toContain("text-muted-foreground");
      // The cell does not grow with the name: the trigger keeps its width classes.
      expect(trigger.className).toContain("min-w-[240px]");
      expect(trigger.className).toContain("max-w-full");
    });

    it("E8 long-text: shows the full product name in a Tooltip on focus, with no button inside the trigger", async () => {
      const long = "Producto con un nombre larguísimo ".repeat(2).trim().slice(0, 60);
      storeProduct(long, LIMPIEZA);
      openPanel();
      const trigger = productSelect("Limpieza e higiene", long);
      expect(trigger.querySelector("button")).toBeNull();
      fireEvent.focus(trigger);
      const tip = await screen.findByText(long, { selector: "[data-slot='tooltip-content']" });
      expect(tip).toBeInTheDocument();
    });

    it("E8 touch form: the open popup starts with «del producto {nombre}», which is not an option", async () => {
      storeProduct("Cloro", LIMPIEZA);
      openPanel();
      const trigger = productSelect("Limpieza e higiene", "Cloro");
      const withoutLine = (await optionNames(conceptSelect("Jabón"))).length;
      fireEvent.click(trigger);
      const line = document.querySelector<HTMLElement>('[data-slot="concept-product-origin"]');
      expect(line).toHaveTextContent("del producto Cloro");
      expect(line?.className).toContain("text-xs");
      expect(line?.className).toContain("text-muted-foreground");
      expect(line?.className).toContain("select-none");
      expect(screen.getAllByRole("option")).toHaveLength(withoutLine);
      expect(screen.queryByRole("option", { name: /del producto/ })).toBeNull();
      fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("option")).toBeNull();
      });
    });

    it("shows no popup line, no suffix and the Phase 3 name on lines that do not come from a product", () => {
      storeProduct("Cloro", LIMPIEZA);
      openPanel();
      fireEvent.click(conceptSelect("Jabón"));
      expect(document.querySelector('[data-slot="concept-product-origin"]')).toBeNull();
    });

    it("picking a category creates a concept rule that beats the product, and «Quitar ajuste» returns the line to it", async () => {
      storeProduct("Cloro", LIMPIEZA);
      openPanel();
      await choose(productSelect("Limpieza e higiene", "Cloro"), "Otros");
      expect(storedRules()).toEqual([
        { rfc: A.rfc, key: "cloro 1l", description: "CLORO 1L", categoryId: OTROS },
      ]);
      const adjusted = conceptSelect("CLORO 1L");
      expect(valueText(adjusted)).toBe("Otros");
      expect(within(adjusted).getByText("Otros").className).toContain("text-foreground");
      expect(within(adjusted).queryByText(FROM_PRODUCT)).toBeNull();
      expect(reachCaption()).toHaveTextContent("Aplica a 1 línea de Proveedor A");
      // The product itself is untouched.
      expect(useSettingsStore.getState().products[0]?.categoryId).toBe(LIMPIEZA);

      await choose(adjusted, "Quitar ajuste");
      expect(storedRules()).toEqual([]);
      const back = productSelect("Limpieza e higiene", "Cloro");
      expect(back).toHaveTextContent(`Limpieza e higiene ${FROM_PRODUCT} Cloro`);
      expect(reachCaption()).toBeNull();
    });

    it("an explicit «Sin categoría» rule still beats the product", async () => {
      storeProduct("Cloro", LIMPIEZA);
      openPanel();
      await choose(productSelect("Limpieza e higiene", "Cloro"), "Sin categoría");
      const trigger = conceptSelect("CLORO 1L");
      expect(valueText(trigger)).toBe("Sin categoría");
      expect(within(trigger).queryByText(FROM_PRODUCT)).toBeNull();
    });

    it("E8 partial: a product without category falls to «· del proveedor»", () => {
      assignSupplier(A.rfc, A.nombre, ABARROTES);
      storeProduct("Cloro", null);
      openPanel();
      const trigger = conceptSelect("CLORO 1L");
      expect(trigger).toHaveTextContent("Abarrotes y despensa · del proveedor");
      expect(within(trigger).queryByText(FROM_PRODUCT)).toBeNull();
    });

    it("E8 partial: a product without category and a supplier without category reads «Sin categoría»", () => {
      storeProduct("Cloro", null);
      openPanel();
      const trigger = conceptSelect("CLORO 1L");
      expect(valueText(trigger)).toBe("Sin categoría");
    });

    it("E8 partial: a product whose category was deleted adds no level", () => {
      assignSupplier(A.rfc, A.nombre, ABARROTES);
      storeProduct("Cloro", "custom:gone");
      openPanel();
      expect(conceptSelect("CLORO 1L")).toHaveTextContent("Abarrotes y despensa · del proveedor");
    });

    it("does not give the product to the same description of another supplier", () => {
      storeProduct("Cloro", LIMPIEZA);
      seed([cloroYJabon("F1"), cloroYJabon("F2", B)]);
      render(<Harness />);
      fireEvent.click(chevron("F2"));
      expect(valueText(conceptSelect("CLORO 1L"))).toBe("Sin categoría");
    });

    it("T-04-49: renders a markup-like product name as text only, in the trigger, the tooltip and the name", async () => {
      const hostile = "<img src=x onerror=alert(1)>";
      storeProduct(hostile, LIMPIEZA);
      openPanel();
      const trigger = productSelect("Limpieza e higiene", hostile);
      expect(trigger).toHaveTextContent(`Limpieza e higiene ${FROM_PRODUCT} ${hostile}`);
      fireEvent.focus(trigger);
      await screen.findByText(hostile, { selector: "[data-slot='tooltip-content']" });
      expect(document.querySelector("img")).toBeNull();
    });
  });
});

describe("InvoiceTable under the category filter (FILT-03, D-14, D-27, E7 partial)", () => {
  const A = { rfc: "AAA010101AAA", nombre: "Proveedor A" };
  const ABARROTES = "seed:abarrotes-despensa";
  const LIMPIEZA = "seed:limpieza-higiene";
  const PARTIAL_NOTE =
    "Con filtro de categoría, el monto es la parte de esas categorías y debajo se muestra el total de la factura.";
  const DIMMED_TEXT = "No cuenta en el filtro de categoría";

  /** A line with no tax: its Con IVA and Sin IVA amounts are the importe. */
  function plain(descripcion: string, importe: string): Concepto {
    return concepto({ descripcion, valorUnitario: importe, importe });
  }

  /** Cloro (100.00, rule: Limpieza) and Jabón (50.00, supplier: Abarrotes); total 150.00 unless overridden. */
  function mixed(uuid: string, overrides: Partial<ParsedInvoice> = {}): ParsedInvoice {
    return inv(uuid, {
      emisor: A,
      subTotal: "150.00",
      total: "150.00",
      conceptos: [plain("Cloro", "100.00"), plain("Jabón", "50.00")],
      ...overrides,
    });
  }

  beforeEach(() => {
    act(() => {
      useSettingsStore.getState().setSupplierCategory(A.rfc, A.nombre, ABARROTES);
      useSettingsStore.getState().setConceptRule(A.rfc, "Cloro", LIMPIEZA);
    });
  });

  const ONLY_LIMPIEZA: ReadonlySet<string> = new Set([LIMPIEZA]);

  /** The text lines of the Monto cell of one row, in order. */
  function amountLines(uuid: string): string[] {
    return Array.from(cellOf(dataRow(uuid), 6).querySelectorAll("span")).map(
      (span) => span.textContent,
    );
  }

  function conceptRowOf(description: string): HTMLElement {
    const row = screen.getByText(description).closest("tr");
    if (row === null) throw new Error(`no concept row ${description}`);
    return row;
  }

  async function pick(trigger: HTMLElement, optionName: string): Promise<void> {
    fireEvent.click(trigger);
    const option = screen.getByRole("option", { name: optionName });
    // Base UI commits a mouse selection only when the pointer went down on the item.
    fireEvent.pointerDown(option);
    fireEvent.click(option);
    await waitFor(() => {
      expect(screen.queryByRole("option")).toBeNull();
    });
  }

  function rowIds(): (string | null)[] {
    return dataRows().map((row) => row.getAttribute("data-row-id"));
  }

  it("shows the part of the chosen categories and below it «de {total} total» in 12px muted text", () => {
    seed([mixed("F1")]);
    render(<Harness categories={ONLY_LIMPIEZA} />);
    expect(amountLines("F1")).toEqual(["$100.00", "de $150.00 total"]);
    const second = cellOf(dataRow("F1"), 6).querySelectorAll("span")[1];
    expect(second?.className).toContain("text-xs");
    expect(second?.className).toContain("text-muted-foreground");
  });

  it("shows no second line, no extra note sentence and no dimming without the filter", () => {
    seed([mixed("F1")]);
    render(<Harness />);
    expect(amountLines("F1")).toEqual(["$150.00"]);
    expect(screen.queryByText(PARTIAL_NOTE)).toBeNull();
    fireEvent.click(chevron("F1"));
    expect(screen.queryByText(DIMMED_TEXT)).toBeNull();
    expect(conceptRowOf("Jabón").className).not.toContain("text-muted-foreground");
  });

  it("adds the extra sentence to the table note only while the filter is active (T-03-37)", () => {
    seed([mixed("F1")]);
    const { rerender } = render(<Harness />);
    expect(screen.queryByText(PARTIAL_NOTE)).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Incluye notas de crédito y facturas que no suman (atenuadas). El monto sigue el modo Con IVA / Sin IVA.",
    );
    rerender(<Harness categories={ONLY_LIMPIEZA} />);
    expect(screen.getByText(PARTIAL_NOTE)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("El monto sigue el modo Con IVA / Sin IVA.");
    rerender(<Harness />);
    expect(screen.queryByText(PARTIAL_NOTE)).toBeNull();
  });

  it("counts in the heading the invoices that have a line of the chosen categories", () => {
    seed([
      mixed("F1"),
      inv("F2", { emisor: A, conceptos: [plain("Jabón", "50.00")], subTotal: "50.00", total: "50.00" }),
    ]);
    render(<Harness categories={ONLY_LIMPIEZA} />);
    expect(screen.getByRole("heading", { name: "Facturas (1)" })).toBeInTheDocument();
    expect(rowIds()).toEqual(["F1"]);
  });

  it("sorts Monto by the partial amount, not by the invoice total", () => {
    seed([
      mixed("F1"),
      inv("F3", { emisor: A, conceptos: [plain("Cloro", "120.00")], subTotal: "120.00", total: "120.00" }),
    ]);
    render(<Harness categories={ONLY_LIMPIEZA} />);
    clickHeader("Monto");
    // 100.00 (of 150.00) before 120.00 (of 120.00); by the totals the order would be the opposite.
    expect(rowIds()).toEqual(["F1", "F3"]);
  });

  it("keeps a Pago row visible when its line is in the selection, without an amount or a total line", () => {
    act(() => {
      useSettingsStore.getState().setConceptRule(A.rfc, "Pago", LIMPIEZA);
    });
    seed([
      inv("PG", {
        emisor: A,
        tipo: "P",
        moneda: "XXX",
        total: "0",
        subTotal: "0",
        conceptos: [concepto({ descripcion: "Pago", valorUnitario: "0", importe: "0" })],
      }),
      mixed("F1"),
    ]);
    render(<Harness categories={ONLY_LIMPIEZA} />);
    expect(rowIds().sort()).toEqual(["F1", "PG"]);
    expect(within(dataRow("PG")).getByText("No suma")).toBeInTheDocument();
    expect(amountLines("PG")).toEqual(["—"]);
  });

  it("dims the lines of other categories with the muted token and a screen-reader label, not opacity", () => {
    seed([mixed("F1")]);
    render(<Harness categories={ONLY_LIMPIEZA} />);
    fireEvent.click(chevron("F1"));
    const dimmed = conceptRowOf("Jabón");
    expect(dimmed.className).toContain("text-muted-foreground");
    expect(dimmed.className).not.toMatch(/opacity/);
    const label = within(dimmed).getByText(DIMMED_TEXT);
    expect(label.className).toContain("sr-only");
    // The line inside the selection is neither dimmed nor labelled.
    const counted = conceptRowOf("Cloro");
    expect(counted.className).not.toContain("text-muted-foreground");
    expect(screen.getAllByText(DIMMED_TEXT)).toHaveLength(1);
  });

  it("keeps the category Select of a dimmed line operable (UI-SPEC Q6)", async () => {
    seed([mixed("F1")]);
    render(<Harness categories={ONLY_LIMPIEZA} />);
    fireEvent.click(chevron("F1"));
    const select = within(conceptRowOf("Jabón")).getByRole("combobox", {
      name: "Categoría del concepto «Jabón»",
    });
    expect(select).toBeEnabled();
    await pick(select, "Limpieza e higiene");
    expect(
      useSettingsStore.getState().conceptRules.find((rule) => rule.key === "jabon")?.categoryId,
    ).toBe(LIMPIEZA);
  });

  it("computes «Diferencia de redondeo» from the full invoice amount, with or without the filter", () => {
    seed([mixed("F1", { subTotal: "150.01", total: "150.01" })]);
    const { rerender } = render(<Harness />);
    fireEvent.click(chevron("F1"));
    expect(screen.getByText("Diferencia de redondeo: $0.01")).toBeInTheDocument();
    rerender(<Harness categories={ONLY_LIMPIEZA} />);
    expect(amountLines("F1")).toEqual(["$100.00", "de $150.01 total"]);
    expect(screen.getByText("Diferencia de redondeo: $0.01")).toBeInTheDocument();
    rerender(<Harness categories={new Set([ABARROTES])} />);
    expect(screen.getByText("Diferencia de redondeo: $0.01")).toBeInTheDocument();
  });

  it("selecting every category plus «Sin categoría» gives the amounts of no filter (D-27)", () => {
    seed([
      mixed("F1"),
      inv("F2", { emisor: { rfc: "ZZZ010101ZZZ", nombre: "Otro" }, fecha: "2025-02-01T10:00:00" }),
    ]);
    const { rerender } = render(<Harness />);
    const unfiltered = [amountLines("F1")[0], amountLines("F2")[0]];
    const every = new Set([
      ...defaultSettings().categories.map((category) => category.id),
      SIN_CATEGORIA,
    ]);
    rerender(<Harness categories={every} />);
    expect(dataRows()).toHaveLength(2);
    expect([amountLines("F1")[0], amountLines("F2")[0]]).toEqual(unfiltered);
  });

  it("follows the Dashboard category filter and is gone after «Quitar filtros»", () => {
    seed([mixed("F1")]);
    act(() => {
      useSessionStore.getState().setCategories(new Set([LIMPIEZA]));
    });
    render(<DashboardTab />);
    expect(amountLines("F1")).toEqual(["$100.00", "de $150.00 total"]);
    expect(screen.getByText(PARTIAL_NOTE)).toBeInTheDocument();
    act(() => {
      useSessionStore.getState().clearFilters();
    });
    expect(amountLines("F1")).toEqual(["$150.00"]);
    expect(screen.queryByText(PARTIAL_NOTE)).toBeNull();
  });
});
