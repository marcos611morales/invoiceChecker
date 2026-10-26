// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import Big from "big.js";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ProductComparison, StoreStats } from "@/domain/prices/compare";
import type { UnitFamily } from "@/domain/prices/units";
import { ProductDetail } from "./ProductDetail";
import { PricesTable } from "./PricesTable";

const RFC_A = "AAA010101AAA";
const RFC_B = "BBB010101BBB";

interface StoreInput {
  rfc: string;
  name: string;
  median: string;
  min?: string;
  last?: string;
  lastFecha?: string;
  count?: number;
}

function store(input: StoreInput): StoreStats {
  return {
    rfc: input.rfc,
    name: input.name,
    count: input.count ?? 1,
    min: new Big(input.min ?? input.median),
    median: new Big(input.median),
    last: new Big(input.last ?? input.median),
    lastFecha: input.lastFecha ?? "2025-05-28T17:38:18",
  };
}

interface ComparisonInput {
  id?: string;
  name?: string;
  family?: UnitFamily | null;
  stores?: StoreStats[];
  saving?: string | null;
  perPiece?: boolean;
  decidedByCount?: boolean;
  otherFamilies?: { family: UnitFamily; count: number }[];
}

/** A comparison as the domain leaves it: the cheapest store is the first of 2 or more. */
function comparison(input: ComparisonInput = {}): ProductComparison {
  const stores = input.stores ?? [];
  const [top, second] = stores;
  return {
    productId: input.id ?? "p1",
    name: input.name ?? "Leche entera",
    family: input.family === undefined ? "mass" : input.family,
    perPiece: input.perPiece ?? false,
    stores,
    cheapest: top !== undefined && second !== undefined ? top : null,
    decidedByCount: input.decidedByCount ?? false,
    saving: input.saving === undefined || input.saving === null ? null : new Big(input.saving),
    purchases: [],
    notNormalizedCount: 0,
    otherFamilies: input.otherFamilies ?? [],
  };
}

const tiendaA = (extra: Partial<StoreInput> = {}) =>
  store({ rfc: RFC_A, name: "Tienda A", median: "50", ...extra });
const tiendaB = (extra: Partial<StoreInput> = {}) =>
  store({ rfc: RFC_B, name: "Tienda B", median: "60", ...extra });

function twoStores(extra: ComparisonInput = {}): ProductComparison {
  return comparison({ stores: [tiendaA(), tiendaB()], saving: "10", ...extra });
}

/** The per-store table: the purchases list below it is also a table. */
function storeTable(): HTMLElement {
  return within(screen.getByRole("region", { name: "Precios por tienda" })).getByRole("table");
}

/** A row of a table by position (0 is the header row); fails loudly when it does not exist. */
function rowAt(table: HTMLElement, index: number): HTMLElement {
  const found = within(table).getAllByRole("row")[index];
  if (found === undefined) throw new Error(`no row ${String(index)}`);
  return found;
}

afterEach(() => {
  cleanup();
});

describe("expander (D-07)", () => {
  function rows(): ProductComparison[] {
    return [
      twoStores({ id: "p1", name: "Leche entera" }),
      twoStores({ id: "p2", name: "Aceite" }),
    ];
  }

  it("opens and closes the panel of a row and keeps the label in sync", () => {
    render(<PricesTable rows={rows()} />);
    const open = screen.getByRole("button", { name: "Ver precios de Leche entera" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Precios por tienda")).toBeNull();

    fireEvent.click(open);
    const close = screen.getByRole("button", { name: "Ocultar precios de Leche entera" });
    expect(close).toHaveAttribute("aria-expanded", "true");
    const panelId = close.getAttribute("aria-controls");
    expect(panelId).not.toBeNull();
    expect(document.getElementById(panelId ?? "")).toContainElement(
      screen.getByRole("heading", { name: "Precios por tienda" }),
    );

    fireEvent.click(close);
    expect(screen.getByRole("button", { name: "Ver precios de Leche entera" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Precios por tienda")).toBeNull();
  });

  it("lets several rows stay open at once", () => {
    render(<PricesTable rows={rows()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver precios de Leche entera" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver precios de Aceite" }));
    expect(screen.getAllByRole("heading", { name: "Precios por tienda" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Ocultar precios de Leche entera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar precios de Aceite" })).toBeInTheDocument();
  });

  it("has a first 48 px column with a screen-reader header", () => {
    render(<PricesTable rows={rows()} />);
    const header = screen.getByRole("columnheader", { name: "Detalle" });
    expect(header.className).toContain("w-12");
    expect(header.parentElement?.firstElementChild).toBe(header);
  });

  it("gives the opened panel the secondary background and padding from 640 px", () => {
    render(<PricesTable rows={rows()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver precios de Leche entera" }));
    const panel = screen.getByRole("heading", { name: "Precios por tienda" }).closest("td");
    expect(panel?.className).toContain("bg-secondary");
    expect(panel?.className).toContain("p-4");
    expect(panel?.className).toContain("sm:p-6");
    expect(panel?.getAttribute("colspan")).toBe("6");
  });
});

describe("summary (D-02, D-11, D-21)", () => {
  it("names the cheapest store, its median price and the estimated saving", () => {
    render(<ProductDetail row={twoStores()} />);
    const summary = screen.getByText("$50.00 / kg").closest("p");
    if (summary === null) throw new Error("no summary paragraph");
    expect(summary).toHaveTextContent(
      "Más barata: Tienda A a $50.00 / kg (mediana). Ahorro estimado: $10.00.",
    );
    expect(within(summary).getByText("Tienda A", { selector: "span" }).className).toContain("font-semibold");
    expect(within(summary).getByText("$50.00 / kg").className).toContain("font-semibold");
    const note = screen.getByText(/^Se calcula con las compras en otras tiendas/);
    expect(note).toHaveTextContent(
      "Se calcula con las compras en otras tiendas: (precio pagado − precio mediano de Tienda A) × contenido comprado, sumando solo las diferencias positivas.",
    );
    expect(note.className).toContain("text-xs");
    expect(note.className).toContain("text-muted-foreground");
  });

  it("always calls the saving estimated", () => {
    render(<ProductDetail row={twoStores({ saving: "0" })} />);
    expect(screen.getByText(/Ahorro estimado: \$0\.00\./)).toBeInTheDocument();
  });

  it("says the product was bought in one store only and shows no badge", () => {
    render(<ProductDetail row={comparison({ stores: [tiendaA()] })} />);
    expect(
      screen.getByText("Solo se compró en Tienda A. Para comparar hace falta que otra tienda lo venda."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Más barata:/)).toBeNull();
    expect(screen.queryByText("Se calcula", { exact: false })).toBeNull();
    // The badge text is the only «Más barata» left, and there is no badge for one store.
    expect(screen.queryByText("Más barata")).toBeNull();
  });

  it.each([
    ["mass", "Comparado por kilogramo ($/kg)"],
    ["volume", "Comparado por litro ($/L)"],
    ["piece", "Comparado por pieza ($/pieza)"],
  ] as const)("names the %s family under the summary", (family, text) => {
    render(<ProductDetail row={twoStores({ family })} />);
    expect(screen.getByText(text).className).toContain("text-muted-foreground");
  });
});

describe("alerts (D-12)", () => {
  it("explains the compared unit and the left-out purchases of another family", () => {
    render(
      <ProductDetail row={twoStores({ otherFamilies: [{ family: "volume", count: 2 }] })} />,
    );
    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent(
      "Este producto se compró en kilogramos y en litros. Se compara la unidad con más compras (kilogramos); las 2 compras en litros quedan como no normalizadas.",
    );
    expect(alert.querySelector("svg")).not.toBeNull();
  });

  it("lists both left-out families when there are two", () => {
    render(
      <ProductDetail
        row={twoStores({
          otherFamilies: [
            { family: "volume", count: 1 },
            { family: "piece", count: 3 },
          ],
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Este producto se compró en kilogramos, en litros y en piezas. Se compara la unidad con más compras (kilogramos); 1 compra en litros y 3 compras en piezas quedan como no normalizadas.",
    );
  });

  it("shows no alert when only one family was bought", () => {
    render(<ProductDetail row={twoStores()} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("replaces the per-store table with an alert when nothing could be compared", () => {
    render(<ProductDetail row={comparison({ family: null })} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ninguna compra de este producto tiene un contenido que se pueda comparar. Captura el contenido abajo para compararlo.",
    );
    expect(screen.queryByRole("region", { name: "Precios por tienda" })).toBeNull();
    expect(screen.queryByText("Precios por tienda")).toBeNull();
    // The purchases list stays visible (E6 + E7).
    expect(screen.getByRole("region", { name: "Compras" })).toBeInTheDocument();
    expect(screen.queryByText(/Comparado por/)).toBeNull();
  });
});

describe("per-store table (PREC-01, PREC-04)", () => {
  function twoStoresWithHistory(): ProductComparison {
    return comparison({
      stores: [
        tiendaA({ min: "48", median: "50", last: "52", lastFecha: "2025-05-28T17:38:18", count: 3 }),
        tiendaB({ min: "58", median: "60", last: "61", lastFecha: "2025-01-05T09:00:00", count: 1 }),
      ],
      saving: "10",
    });
  }

  it("lists minimum, median, last price with its date and purchases, cheapest first", () => {
    render(<ProductDetail row={twoStoresWithHistory()} />);
    const table = storeTable();
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Tienda", "Mínimo", "Mediana", "Último", "Compras"]);
    const a = within(rowAt(table, 1)).getAllByRole("cell");
    expect(a.map((cell) => cell.textContent)).toEqual([
      "Tienda AMás barata",
      "$48.00",
      "$50.00",
      "$52.0028 may 2025",
      "3 compras",
    ]);
    const b = within(rowAt(table, 2)).getAllByRole("cell");
    expect(b.map((cell) => cell.textContent)).toEqual([
      "Tienda B",
      "$58.00",
      "$60.00",
      "$61.005 ene 2025",
      "1 compra",
    ]);
  });

  it("marks the cheapest row with a badge and check, a lifted row and a 600 median", () => {
    render(<ProductDetail row={twoStoresWithHistory()} />);
    const table = storeTable();
    const first = rowAt(table, 1);
    const second = rowAt(table, 2);
    expect(first.className).toContain("bg-background");
    expect(second.className.split(" ")).not.toContain("bg-background");
    const badge = within(first).getByText("Más barata");
    const icon = badge.querySelector("svg");
    expect(icon?.getAttribute("class")).toContain("text-positive");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(within(first).getAllByRole("cell")[2]?.className).toContain("font-semibold");
    expect(within(second).queryByText("Más barata")).toBeNull();
    expect(within(second).getAllByRole("cell")[2]?.className).not.toContain("font-semibold");
  });

  it("shows equal minimum, median and last for a store with one purchase", () => {
    render(<ProductDetail row={comparison({ stores: [tiendaA({ median: "35.5" })] })} />);
    const cells = within(rowAt(storeTable(), 1)).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("$35.50");
    expect(cells[2]).toHaveTextContent("$35.50");
    expect(cells[3]).toHaveTextContent("$35.50");
    expect(cells[4]).toHaveTextContent("1 compra");
  });

  it("keeps a 640 px minimum width inside a scroll container and wraps store names", () => {
    const longName = "Distribuidora de abarrotes y productos de limpieza del bajío ".repeat(3).trim();
    render(
      <ProductDetail
        row={comparison({
          stores: [store({ rfc: RFC_A, name: longName, median: "10" }), tiendaB()],
          saving: "1",
        })}
      />,
    );
    const table = storeTable();
    expect(table.className).toContain("min-w-[640px]");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
    const cell = within(rowAt(table, 1)).getAllByRole("cell")[0];
    expect(cell).toHaveTextContent(longName);
    expect(cell?.className).toContain("whitespace-normal");
    expect(cell?.querySelector(".truncate")).toBeNull();
  });

  it("never shows the RFC of a store (T-05-11)", () => {
    render(<ProductDetail row={twoStores()} />);
    expect(document.body.textContent).not.toContain(RFC_A);
    expect(document.body.textContent).not.toContain(RFC_B);
  });

  it("renders store names as text and never as markup (T-05-15)", () => {
    render(
      <ProductDetail
        row={comparison({
          stores: [store({ rfc: RFC_A, name: "<b>Tienda</b>", median: "10" }), tiendaB()],
          saving: "1",
        })}
      />,
    );
    expect(document.body.querySelector("b")).toBeNull();
    expect(screen.getAllByText("<b>Tienda</b>", { exact: false }).length).toBeGreaterThan(0);
  });
});

describe("notes under the table (D-10, D-20)", () => {
  it("shows the tie note only when the purchase count decided", () => {
    const { unmount } = render(<ProductDetail row={twoStores({ decidedByCount: true })} />);
    expect(
      screen.getByText("Empate en la mediana: gana la tienda con más compras."),
    ).toBeInTheDocument();
    unmount();
    render(<ProductDetail row={twoStores()} />);
    expect(screen.queryByText(/Empate en la mediana/)).toBeNull();
  });

  it("warns when the cheapest store has a single purchase", () => {
    const { unmount } = render(<ProductDetail row={twoStores()} />);
    expect(
      screen.getByText("La tienda más barata tiene una sola compra; el precio puede cambiar."),
    ).toBeInTheDocument();
    unmount();
    render(
      <ProductDetail row={comparison({ stores: [tiendaA({ count: 4 }), tiendaB()], saving: "10" })} />,
    );
    expect(screen.queryByText(/una sola compra/)).toBeNull();
  });

  it("does not warn about a single purchase when there is no cheapest store", () => {
    render(<ProductDetail row={comparison({ stores: [tiendaA()] })} />);
    expect(screen.queryByText(/una sola compra/)).toBeNull();
  });

  it("states that a per-piece comparison may mix presentations", () => {
    render(<ProductDetail row={twoStores({ family: "piece", perPiece: true })} />);
    expect(
      screen.getByText(
        "Comparado por pieza, sin tamaño verificado: las presentaciones pueden ser distintas.",
      ),
    ).toBeInTheDocument();
  });
});
