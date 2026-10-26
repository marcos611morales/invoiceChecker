// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import Big from "big.js";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ProductComparison, StoreStats } from "@/domain/prices/compare";
import type { UnitFamily } from "@/domain/prices/units";
import { PricesTable } from "./PricesTable";

const RFC_A = "AAA010101AAA";
const RFC_B = "BBB010101BBB";

function store(rfc: string, name: string, median: string, count = 1): StoreStats {
  return {
    rfc,
    name,
    count,
    min: new Big(median),
    median: new Big(median),
    last: new Big(median),
    lastFecha: "2025-01-15T10:00:00",
  };
}

interface ComparisonInput {
  id: string;
  name: string;
  family?: UnitFamily | null;
  stores?: StoreStats[];
  saving?: string | null;
  perPiece?: boolean;
  notNormalizedCount?: number;
}

/** A comparison as the domain leaves it: the cheapest store is the first of 2 or more. */
function comparison(input: ComparisonInput): ProductComparison {
  const stores = input.stores ?? [];
  const [top, second] = stores;
  return {
    productId: input.id,
    name: input.name,
    family: input.family === undefined ? "mass" : input.family,
    perPiece: input.perPiece ?? false,
    stores,
    cheapest: top !== undefined && second !== undefined ? top : null,
    decidedByCount: false,
    saving: input.saving === undefined || input.saving === null ? null : new Big(input.saving),
    purchases: [],
    notNormalizedCount: input.notNormalizedCount ?? 0,
    otherFamilies: [],
  };
}

/** Two compared stores with the given saving. */
function twoStores(id: string, name: string, saving: string): ProductComparison {
  return comparison({
    id,
    name,
    stores: [store(RFC_A, "Tienda Alfa", "12.5"), store(RFC_B, "Tienda Beta", "20")],
    saving,
  });
}

/** One compared store: no cheapest, no saving. */
function oneStore(id: string, name: string): ProductComparison {
  return comparison({ id, name, stores: [store(RFC_A, "Tienda Alfa", "12.5", 3)] });
}

/** Names of the body rows, in the order shown. */
function names(): string[] {
  const body = screen.getAllByRole("rowgroup")[1];
  if (body === undefined) throw new Error("no table body");
  return within(body)
    .getAllByRole("row")
    .map((row) => within(row).getAllByRole("cell")[1]?.querySelector("button")?.textContent ?? "");
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole("button", { name }).closest("tr");
  if (row === null) throw new Error(`no row for ${name}`);
  return row;
}

afterEach(() => {
  cleanup();
});

describe("PricesTable ordering (D-07)", () => {
  it("lists the largest saving first and the row without saving last", () => {
    render(
      <PricesTable
        rows={[twoStores("p1", "Aceite", "10"), oneStore("p2", "Sal"), twoStores("p3", "Harina", "30")]}
      />,
    );
    expect(names()).toEqual(["Harina", "Aceite", "Sal"]);
    expect(screen.getByRole("columnheader", { name: "Ahorro estimado" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("flips the saving to ascending and keeps the row without saving last", () => {
    render(
      <PricesTable
        rows={[twoStores("p1", "Aceite", "10"), oneStore("p2", "Sal"), twoStores("p3", "Harina", "30")]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ahorro estimado" }));
    expect(names()).toEqual(["Aceite", "Harina", "Sal"]);
    expect(screen.getByRole("columnheader", { name: "Ahorro estimado" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    fireEvent.click(screen.getByRole("button", { name: "Ahorro estimado" }));
    expect(names()).toEqual(["Harina", "Aceite", "Sal"]);
  });

  it("breaks ties on the saving by product name", () => {
    render(
      <PricesTable
        rows={[twoStores("p1", "Zanahoria", "10"), twoStores("p2", "Arroz", "10"), twoStores("p3", "Maíz", "10")]}
      />,
    );
    expect(names()).toEqual(["Arroz", "Maíz", "Zanahoria"]);
  });

  it("sorts by name with the Spanish collator", () => {
    render(
      <PricesTable
        rows={[twoStores("p1", "Ñame", "30"), twoStores("p2", "Nuez", "20"), twoStores("p3", "Arroz", "10")]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Producto" }));
    expect(names()).toEqual(["Arroz", "Nuez", "Ñame"]);
    expect(screen.getByRole("columnheader", { name: "Producto" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("sorts by the number of stores and by cheapest store, rows without value last", () => {
    const three = comparison({
      id: "p1",
      name: "Aceite",
      stores: [store(RFC_A, "Tienda Alfa", "10"), store(RFC_B, "Tienda Beta", "11"), store("CCC010101CCC", "Tienda Cero", "12")],
      saving: "5",
    });
    render(<PricesTable rows={[three, oneStore("p2", "Sal"), twoStores("p3", "Harina", "30")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Tiendas" }));
    expect(names()).toEqual(["Sal", "Harina", "Aceite"]);
    fireEvent.click(screen.getByRole("button", { name: "Tienda más barata" }));
    expect(names()).toEqual(["Aceite", "Harina", "Sal"]);
    fireEvent.click(screen.getByRole("button", { name: "Tienda más barata" }));
    expect(names()).toEqual(["Aceite", "Harina", "Sal"]);
  });

  it("leaves Precio without a sort button because its units are mixed", () => {
    render(<PricesTable rows={[twoStores("p1", "Aceite", "10")]} />);
    expect(screen.getByRole("columnheader", { name: "Precio" })).not.toHaveAttribute("aria-sort");
    expect(screen.queryByRole("button", { name: "Precio" })).toBeNull();
  });
});

describe("PricesTable pagination (E4 overflow)", () => {
  const many = Array.from({ length: 51 }, (_, index) =>
    twoStores(`p${String(index)}`, `Producto ${String(index).padStart(2, "0")}`, String(100 - index)),
  );

  it("shows 50 rows and the pagination footer above 50 rows", () => {
    render(<PricesTable rows={many} />);
    expect(names()).toHaveLength(50);
    expect(screen.getByText("Mostrando 1–50 de 51")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(names()).toHaveLength(1);
    expect(screen.getByText("Mostrando 51 de 51")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  it("shows no pagination with 50 rows", () => {
    render(<PricesTable rows={many.slice(0, 50)} />);
    expect(names()).toHaveLength(50);
    expect(screen.queryByText(/Mostrando/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
  });

  it("keeps a minimum width of 880 px inside a scroll container", () => {
    render(<PricesTable rows={many.slice(0, 2)} />);
    const table = screen.getByRole("table");
    expect(table.className).toContain("min-w-[880px]");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
  });
});

describe("PricesTable cells (D-02, D-10, PREC-02)", () => {
  it("shows the cheapest store, the unit price with its caption, the store count and the saving", () => {
    render(
      <PricesTable
        rows={[
          comparison({
            id: "p1",
            name: "Leche",
            family: "volume",
            stores: [store(RFC_A, "Tienda Alfa", "12.5"), store(RFC_B, "Tienda Beta", "20")],
            saving: "45",
          }),
        ]}
      />,
    );
    const row = within(rowOf("Leche"));
    expect(row.getByRole("button", { name: "Tienda Alfa" })).toBeInTheDocument();
    expect(row.getByText("$12.50 / L")).toBeInTheDocument();
    expect(row.getByText("mediana · 1 compra")).toBeInTheDocument();
    const cells = row.getAllByRole("cell");
    expect(cells[4]).toHaveTextContent("2");
    expect(cells[4]?.className).toContain("text-right");
    expect(cells[5]).toHaveTextContent("$45.00");
    expect(cells[5]?.className).toContain("text-right");
    expect(cells[5]?.className).not.toContain("positive");
  });

  it("pluralizes the purchases behind the median", () => {
    render(
      <PricesTable
        rows={[
          comparison({
            id: "p1",
            name: "Leche",
            stores: [store(RFC_A, "Tienda Alfa", "35.2047", 4), store(RFC_B, "Tienda Beta", "40")],
            saving: "12",
          }),
        ]}
      />,
    );
    const row = within(rowOf("Leche"));
    expect(row.getByText("$35.20 / kg")).toBeInTheDocument();
    expect(row.getByText("mediana · 4 compras")).toBeInTheDocument();
  });

  it("reads «Solo en {tienda}» and a dash for the saving when only one store was compared", () => {
    render(<PricesTable rows={[oneStore("p1", "Sal")]} />);
    const cells = within(rowOf("Sal")).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("Solo en Tienda Alfa");
    expect(cells[3]).toHaveTextContent("$12.50 / kg");
    expect(cells[3]).toHaveTextContent("mediana · 3 compras");
    expect(cells[4]).toHaveTextContent("1");
    expect(cells[5]).toHaveTextContent("—");
  });

  it("marks a product compared per piece with an outline badge under its name", () => {
    render(
      <PricesTable
        rows={[
          comparison({
            id: "p1",
            name: "Escoba",
            family: "piece",
            perPiece: true,
            stores: [store(RFC_A, "Tienda Alfa", "60"), store(RFC_B, "Tienda Beta", "80")],
            saving: "20",
          }),
        ]}
      />,
    );
    const row = within(rowOf("Escoba"));
    expect(row.getByText("por pieza, sin tamaño verificado")).toBeInTheDocument();
    expect(row.getByText("$60.00 / pieza")).toBeInTheDocument();
  });

  it("counts the purchases that were not normalized", () => {
    render(
      <PricesTable
        rows={[
          comparison({ id: "p1", name: "Aceite", stores: [store(RFC_A, "Tienda Alfa", "10")], notNormalizedCount: 1 }),
          comparison({ id: "p2", name: "Harina", stores: [store(RFC_A, "Tienda Alfa", "10")], notNormalizedCount: 3 }),
        ]}
      />,
    );
    expect(within(rowOf("Aceite")).getByText("1 compra no normalizada")).toBeInTheDocument();
    expect(within(rowOf("Harina")).getByText("3 compras no normalizadas")).toBeInTheDocument();
  });

  it("reads «No normalizado» and dashes when no purchase could be normalized", () => {
    render(
      <PricesTable rows={[comparison({ id: "p1", name: "Servicio", family: null, notNormalizedCount: 2 })]} />,
    );
    const cells = within(rowOf("Servicio")).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("—");
    expect(cells[3]).toHaveTextContent("No normalizado");
    expect(cells[4]).toHaveTextContent("—");
    expect(cells[5]).toHaveTextContent("—");
  });

  it("gives a long product name its full text as accessible name and renders it as text", () => {
    const long = `${"Producto con un nombre larguísimo ".repeat(6)}<b>fin</b>`;
    render(<PricesTable rows={[twoStores("p1", long, "10")]} />);
    const button = screen.getByRole("button", { name: long });
    expect(button).toHaveTextContent("<b>fin</b>");
    expect(button.querySelector("b")).toBeNull();
    expect(button.className).toContain("line-clamp-2");
  });

  it("never shows the RFC of a store (T-05-11)", () => {
    render(<PricesTable rows={[twoStores("p1", "Aceite", "10"), oneStore("p2", "Sal")]} />);
    const table = screen.getByRole("table");
    expect(table.textContent).not.toContain(RFC_A);
    expect(table.textContent).not.toContain(RFC_B);
  });
});
