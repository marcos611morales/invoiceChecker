// @vitest-environment jsdom
import Big from "big.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SupplierRow } from "@/domain/accounting/aggregate";
import { useSessionStore } from "@/stores/sessionStore";
import "../../../tests/support/domPolyfills";
import { SupplierDialog } from "./SupplierDialog";
import { SupplierRanking } from "./SupplierRanking";

interface SupplierOptions {
  name?: string;
  facturas?: number;
  /** Fraction as a decimal string, or null for "no share". */
  pct?: string | null;
  /** Decimal string, or null for "no ticket". Defaults to the net amount. */
  ticket?: string | null;
}

function supplier(n: number, net: string, options: SupplierOptions = {}): SupplierRow {
  const { name = `Proveedor ${n}`, facturas = 1, pct = "0.1", ticket } = options;
  const ticketValue = ticket === undefined ? net : ticket;
  return {
    rfc: `RFC${String(n).padStart(3, "0")}`,
    name,
    net: new Big(net),
    facturas,
    ticket: ticketValue === null ? null : new Big(ticketValue),
    pct: pct === null ? null : new Big(pct),
  };
}

/** `count` suppliers whose nets go 1000, 900, 800, ... (all positive, in order). */
function descending(count: number): SupplierRow[] {
  return Array.from({ length: count }, (_, index) =>
    supplier(index + 1, `${(count - index) * 100}.00`),
  );
}

const LONG_NAME = "Comercializadora-Integral-de-Servicios-".repeat(3).slice(0, 90);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useSessionStore.getState().clearAll();
});

function listItems(): HTMLElement[] {
  const list = screen.getByRole("list", { name: "Top 10 de proveedores por gasto neto" });
  return within(list).getAllByRole("listitem");
}

describe("SupplierRanking: the top list (DASH-04, D-22, D-23)", () => {
  it("is an ordered list labelled by its copy, with the heading and the Top 10 sub-heading", () => {
    render(<SupplierRanking rows={descending(3)} />);
    const list = screen.getByRole("list", { name: "Top 10 de proveedores por gasto neto" });
    expect(list.tagName).toBe("OL");
    expect(screen.getByRole("heading", { name: "Gasto por proveedor" })).toBeInTheDocument();
    expect(screen.getByText("Top 10")).toBeInTheDocument();
  });

  it("shows at most 10 rows, in the order given, and no 'Otros' group", () => {
    render(<SupplierRanking rows={descending(12)} />);
    const items = listItems();
    expect(items).toHaveLength(10);
    expect(items.map((item) => within(item).getAllByRole("button")[0]?.getAttribute("aria-label"))).toEqual(
      Array.from({ length: 10 }, (_, index) => `Ver facturas de Proveedor ${index + 1}`),
    );
    expect(document.body.textContent).not.toMatch(/otros/i);
  });

  it("shows the name, the net amount, a 4 px track and the caption of each row", () => {
    render(
      <SupplierRanking
        rows={[supplier(1, "1500.00", { pct: "0.25", ticket: "500.00", facturas: 3 })]}
      />,
    );
    const [item] = listItems();
    if (item === undefined) throw new Error("expected one row");
    expect(within(item).getByRole("button", { name: "Ver facturas de Proveedor 1" })).toBeInTheDocument();
    expect(within(item).getByText("$1,500.00")).toBeInTheDocument();
    expect(within(item).getByText("25.0 % del total · Ticket promedio $500.00")).toBeInTheDocument();
    expect(item.className).toContain("min-h-[68px]");
    expect(within(item).getByTestId("ranking-track").className).toContain("h-1");
  });

  it("sizes each bar as abs(net) over the largest abs(net) of the list", () => {
    render(
      <SupplierRanking
        rows={[supplier(1, "1000.00"), supplier(2, "500.00"), supplier(3, "250.00")]}
      />,
    );
    const widths = screen.getAllByTestId("ranking-fill").map((fill) => fill.style.width);
    expect(widths).toEqual(["100%", "50%", "25%"]);
  });

  it("fills a lone supplier to 100 percent (zero-one-many)", () => {
    render(<SupplierRanking rows={[supplier(1, "42.00")]} />);
    expect(screen.getByTestId("ranking-fill").style.width).toBe("100%");
  });

  it("renders an empty bar and does not throw when the largest net is zero (T-02-21)", () => {
    expect(() =>
      render(
        <SupplierRanking rows={[supplier(1, "0.00", { pct: null }), supplier(2, "0.00", { pct: null })]} />,
      ),
    ).not.toThrow();
    expect(screen.queryAllByTestId("ranking-fill")).toHaveLength(0);
    expect(screen.queryAllByTestId("ranking-tick")).toHaveLength(0);
    expect(listItems()).toHaveLength(2);
  });

  it("prints a dash for a missing share and a missing ticket", () => {
    render(<SupplierRanking rows={[supplier(1, "100.00", { pct: null, ticket: null, facturas: 0 })]} />);
    expect(screen.getByText("— del total · Ticket promedio —")).toBeInTheDocument();
  });

  it("puts a negative net where it was given, with no fill, a 2 px tick, a true minus and its caption", () => {
    render(
      <SupplierRanking
        rows={[supplier(1, "1000.00"), supplier(2, "500.00"), supplier(3, "-50.00", { facturas: 0, ticket: null })]}
      />,
    );
    const items = listItems();
    expect(items).toHaveLength(3);
    const last = items[2];
    if (last === undefined) throw new Error("expected three rows");
    expect(within(last).getByRole("button", { name: "Ver facturas de Proveedor 3" })).toBeInTheDocument();
    expect(within(last).queryByTestId("ranking-fill")).toBeNull();
    expect(within(last).getByTestId("ranking-tick").style.width).toBe("2px");
    const amount = within(last).getByText("−$50.00");
    expect(amount.textContent?.charCodeAt(0)).toBe(0x2212);
    expect(
      within(last).getByText("Neto negativo: las notas de crédito superan las compras"),
    ).toBeInTheDocument();
    expect(within(last).queryByText(/del total/)).toBeNull();
    // The positive rows keep their fill relative to the largest absolute net.
    expect(screen.getAllByTestId("ranking-fill").map((fill) => fill.style.width)).toEqual(["100%", "50%"]);
  });

  it("handles a list where every supplier is negative", () => {
    expect(() =>
      render(<SupplierRanking rows={[supplier(1, "-10.00", { pct: null }), supplier(2, "-30.00", { pct: null })]} />),
    ).not.toThrow();
    expect(screen.queryAllByTestId("ranking-fill")).toHaveLength(0);
    expect(screen.getAllByTestId("ranking-tick")).toHaveLength(2);
    expect(screen.getByText("−$30.00")).toBeInTheDocument();
  });

  it("wraps a 90-character name inside the row button, whose accessible name is the full text (A-5)", () => {
    render(<SupplierRanking rows={[supplier(1, "100.00", { name: LONG_NAME })]} />);
    expect(LONG_NAME).toHaveLength(90);
    const button = screen.getByRole("button", { name: `Ver facturas de ${LONG_NAME}` });
    const name = within(button).getByText(LONG_NAME);
    expect(name.className).toContain("break-words");
    expect(name.className).not.toContain("truncate");
    expect(button.className).not.toContain("truncate");
  });

  it("renders names as text, never as markup (T-02-20)", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const { container } = render(<SupplierRanking rows={[supplier(1, "100.00", { name: hostile })]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: `Ver facturas de ${hostile}` })).toBeInTheDocument();
  });

  it("makes each row exactly one native button and no link", () => {
    render(<SupplierRanking rows={descending(3)} />);
    for (const item of listItems()) {
      const buttons = within(item).getAllByRole("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0]?.tagName).toBe("BUTTON");
      expect(buttons[0]).toHaveAttribute("type", "button");
      expect(within(item).queryByRole("link")).toBeNull();
    }
  });

  it("keeps the amount, the track and the caption inside the button", () => {
    render(<SupplierRanking rows={[supplier(1, "1500.00", { pct: "0.25", ticket: "500.00" })]} />);
    const button = screen.getByRole("button", { name: "Ver facturas de Proveedor 1" });
    expect(within(button).getByText("$1,500.00")).toBeInTheDocument();
    expect(within(button).getByTestId("ranking-track")).toBeInTheDocument();
    expect(within(button).getByText("25.0 % del total · Ticket promedio $500.00")).toBeInTheDocument();
  });

  it("sizes the row for touch, with a secondary hover and a 2 px focus ring", () => {
    render(<SupplierRanking rows={descending(1)} />);
    const button = screen.getByRole("button", { name: "Ver facturas de Proveedor 1" });
    expect(button.className).toContain("w-full");
    expect(button.className).toContain("min-h-[68px]");
    expect(button.className).toContain("hover:bg-secondary");
    expect(button.className).toContain("focus-visible:ring-2");
    expect(button.className).toContain("text-left");
  });

  it("adds the supplier RFC to the supplier filter and asks for the table when clicked (D-18)", () => {
    render(<SupplierRanking rows={descending(3)} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver facturas de Proveedor 2" }));
    const state = useSessionStore.getState();
    expect([...state.filters.suppliers]).toEqual(["RFC002"]);
    expect(state.revealRequest).toBe(1);
  });

  it("leaves the filter as it was and asks for the table again for a supplier already selected", () => {
    render(<SupplierRanking rows={descending(3)} />);
    const button = screen.getByRole("button", { name: "Ver facturas de Proveedor 2" });
    fireEvent.click(button);
    fireEvent.click(button);
    const state = useSessionStore.getState();
    expect([...state.filters.suppliers]).toEqual(["RFC002"]);
    expect(state.revealRequest).toBe(2);
  });
});

describe("SupplierRanking: 'Ver todos' (D-22)", () => {
  it("is absent with fewer than 10 and with exactly 10 suppliers", () => {
    render(<SupplierRanking rows={descending(3)} />);
    expect(screen.queryByRole("button", { name: "Ver todos" })).toBeNull();
    cleanup();
    render(<SupplierRanking rows={descending(10)} />);
    expect(screen.queryByRole("button", { name: "Ver todos" })).toBeNull();
  });

  it("is present with 11 suppliers and opens the dialog with its copy and a Cerrar button", async () => {
    render(<SupplierRanking rows={descending(11)} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver todos" }));
    const dialog = await screen.findByRole("dialog", { name: "Gasto por proveedor" });
    expect(
      within(dialog).getByText("Todos los proveedores del filtro actual, ordenados por gasto neto."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    // Nobody is hidden: all 11 suppliers are listed, none grouped.
    const table = within(dialog).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(12);
    expect(dialog.textContent).not.toMatch(/otros/i);
  });

  it("keeps the dialog rows non-interactive: no row reveals invoices there (D-18)", async () => {
    render(<SupplierRanking rows={descending(11)} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver todos" }));
    const dialog = await screen.findByRole("dialog", { name: "Gasto por proveedor" });
    const bodyRows = within(within(dialog).getByRole("table")).getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(11);
    // The name cell keeps the truncation helper trigger; no row gets a reveal button.
    for (const bodyRow of bodyRows) {
      expect(within(bodyRow).queryByRole("button", { name: /^Ver facturas de/ })).toBeNull();
    }
    fireEvent.click(bodyRows[0] ?? dialog);
    expect(useSessionStore.getState().revealRequest).toBe(0);
    expect(useSessionStore.getState().filters.suppliers.size).toBe(0);
  });

  it("moves focus to the dialog title and returns it to 'Ver todos' on close", async () => {
    render(<SupplierRanking rows={descending(11)} />);
    const trigger = screen.getByRole("button", { name: "Ver todos" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Gasto por proveedor" });
    await waitFor(() => {
      expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: "Gasto por proveedor" }));
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ver todos" }));
  });

  it("closes on Escape", async () => {
    render(<SupplierRanking rows={descending(11)} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver todos" }));
    const dialog = await screen.findByRole("dialog", { name: "Gasto por proveedor" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});

function renderDialog(rows: readonly SupplierRow[]): HTMLElement {
  render(<SupplierDialog rows={rows} open onOpenChange={() => {}} />);
  return screen.getByRole("dialog", { name: "Gasto por proveedor" });
}

/** First-column text of every body row, in display order. */
function bodyNames(dialog: HTMLElement): string[] {
  const rows = within(within(dialog).getByRole("table")).getAllByRole("row").slice(1);
  return rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent ?? "");
}

function header(dialog: HTMLElement, name: string): HTMLElement {
  return within(dialog).getByRole("columnheader", { name });
}

describe("SupplierDialog: the sortable table (DASH-04, D-22, E6)", () => {
  const mixed = (): SupplierRow[] => [
    supplier(1, "900.00", { name: "Árbol", facturas: 1, ticket: "900.00", pct: "0.4" }),
    supplier(2, "1000.00", { name: "Zeta", facturas: 4, ticket: "250.00", pct: "0.5" }),
    supplier(3, "-50.00", { name: "Abarrotes", facturas: 0, ticket: null, pct: "-0.1" }),
    supplier(4, "10.00", { name: "Mercado", facturas: 2, ticket: "5.00", pct: null }),
  ];

  it("shows the five columns", () => {
    const dialog = renderDialog(mixed());
    const names = within(dialog)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(names).toEqual(["Proveedor", "Gasto neto", "% del total", "Facturas", "Ticket promedio"]);
  });

  it("sorts by Gasto neto descending by default, with the negative net last", () => {
    const dialog = renderDialog(mixed());
    expect(header(dialog, "Gasto neto")).toHaveAttribute("aria-sort", "descending");
    expect(header(dialog, "Proveedor")).toHaveAttribute("aria-sort", "none");
    expect(bodyNames(dialog)).toEqual(["Zeta", "Árbol", "Mercado", "Abarrotes"]);
  });

  it("compares money as decimals, not as text: 900 sorts before 1,000 ascending", () => {
    const dialog = renderDialog(mixed());
    const click = () => fireEvent.click(within(header(dialog, "Gasto neto")).getByRole("button"));
    // The default order is already descending: the next click removes it, the one after sorts ascending.
    click();
    expect(header(dialog, "Gasto neto")).toHaveAttribute("aria-sort", "none");
    click();
    expect(header(dialog, "Gasto neto")).toHaveAttribute("aria-sort", "ascending");
    expect(bodyNames(dialog)).toEqual(["Abarrotes", "Mercado", "Árbol", "Zeta"]);
  });

  it("cycles a header ascending, descending, none", () => {
    const dialog = renderDialog(mixed());
    const click = () => fireEvent.click(within(header(dialog, "Facturas")).getByRole("button"));
    click();
    expect(header(dialog, "Facturas")).toHaveAttribute("aria-sort", "ascending");
    expect(bodyNames(dialog)).toEqual(["Abarrotes", "Árbol", "Mercado", "Zeta"]);
    click();
    expect(header(dialog, "Facturas")).toHaveAttribute("aria-sort", "descending");
    expect(bodyNames(dialog)).toEqual(["Zeta", "Mercado", "Árbol", "Abarrotes"]);
    click();
    expect(header(dialog, "Facturas")).toHaveAttribute("aria-sort", "none");
    expect(bodyNames(dialog)).toEqual(["Árbol", "Zeta", "Abarrotes", "Mercado"]);
  });

  it("sorts the name with Spanish collation (Abarrotes, Árbol, Mercado, Zeta)", () => {
    const dialog = renderDialog(mixed());
    fireEvent.click(within(header(dialog, "Proveedor")).getByRole("button"));
    expect(bodyNames(dialog)).toEqual(["Abarrotes", "Árbol", "Mercado", "Zeta"]);
  });

  it("sends a missing ticket and a missing share to the end in both directions", () => {
    const dialog = renderDialog(mixed());
    const ticket = () => fireEvent.click(within(header(dialog, "Ticket promedio")).getByRole("button"));
    ticket();
    expect(bodyNames(dialog)).toEqual(["Mercado", "Zeta", "Árbol", "Abarrotes"]);
    ticket();
    expect(bodyNames(dialog)).toEqual(["Árbol", "Zeta", "Mercado", "Abarrotes"]);

    const share = () => fireEvent.click(within(header(dialog, "% del total")).getByRole("button"));
    share();
    expect(bodyNames(dialog)).toEqual(["Abarrotes", "Árbol", "Zeta", "Mercado"]);
    share();
    expect(bodyNames(dialog)).toEqual(["Zeta", "Árbol", "Abarrotes", "Mercado"]);
  });

  it("right-aligns the numeric columns with tabular numbers and prints the formatted values", () => {
    const dialog = renderDialog(mixed());
    const row = within(within(dialog).getByRole("table")).getAllByRole("row")[1];
    if (row === undefined) throw new Error("expected a body row");
    const cells = within(row).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["Zeta", "$1,000.00", "50.0 %", "4", "$250.00"]);
    for (const cell of cells.slice(1)) {
      expect(cell.className).toContain("text-right");
      expect(cell.className).toContain("tabular-nums");
    }
    expect(header(dialog, "Gasto neto").className).toContain("text-right");
    expect(header(dialog, "Proveedor").className).not.toContain("text-right");
  });

  it("shows dashes for a missing share or ticket and a true minus for a negative net", () => {
    const dialog = renderDialog(mixed());
    const rows = within(within(dialog).getByRole("table")).getAllByRole("row").slice(1);
    const mercado = rows[2];
    const abarrotes = rows[3];
    if (mercado === undefined || abarrotes === undefined) throw new Error("expected four body rows");
    expect(within(mercado).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Mercado",
      "$10.00",
      "—",
      "2",
      "$5.00",
    ]);
    expect(within(abarrotes).getAllByRole("cell")[1]?.textContent).toBe("−$50.00");
  });

  it("keeps the scroll area at 480 px and the dialog at 720 px", () => {
    const dialog = renderDialog(mixed());
    expect(dialog.className).toContain("sm:max-w-[720px]");
    const area = dialog.querySelector("[data-slot='scroll-area']");
    expect(area?.className).toContain("max-h-[480px]");
  });
});
