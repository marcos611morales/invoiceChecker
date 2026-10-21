// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import type { ProductSuggestion } from "@/domain/llm/suggestions";
import { normalizeDescription } from "@/domain/settings/normalize";
import { type Product, type ProductMember } from "@/domain/settings/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { ProductList } from "./ProductList";
import { ProductsTab } from "./ProductsTab";

const toastMock = vi.hoisted(() => vi.fn<(message: string, options?: unknown) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const UNO = { rfc: "AAA010101AAA", nombre: "Tienda Uno" };
const DOS = { rfc: "BBB020202BBB", nombre: "Tienda Dos" };
const TRES = { rfc: "CCC030303CCC", nombre: "Tienda Tres" };

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

function invoice(emisor: { rfc: string; nombre: string }, descriptions: readonly string[]): ParsedInvoice {
  return makeInvoice({ emisor, conceptos: descriptions.map(concepto) });
}

function loadInvoices(invoices: readonly ParsedInvoice[]): void {
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

/**
 * Tienda Uno has «Leche entera 1L» twice and «Café Molido 1kg» once, Tienda Dos has
 * «LECHE ENTERA 1L» once; Tienda Tres has no loaded invoice at all.
 */
function seedInvoices(): void {
  loadInvoices([
    invoice(UNO, ["Leche entera 1L", "Café Molido 1kg", "Azúcar"]),
    invoice(UNO, ["Leche entera 1L"]),
    invoice(DOS, ["LECHE ENTERA 1L", "Sal"]),
  ]);
}

function member(supplier: { rfc: string; nombre: string }, description: string): ProductMember {
  return {
    rfc: supplier.rfc,
    key: normalizeDescription(description),
    description,
    supplierName: supplier.nombre,
  };
}

const LECHE_UNO = member(UNO, "Leche entera 1L");
const LECHE_DOS = member(DOS, "LECHE ENTERA 1L");
const CAFE = member(UNO, "Café Molido 1kg");
const AZUCAR = member(UNO, "Azúcar");
const SAL = member(DOS, "Sal");
const HARINA_TRES = member(TRES, "Harina 1kg");

function productWith(id: string, name: string, members: ProductMember[]): Product {
  return { id, name, categoryId: null, members };
}

function setProducts(products: Product[]): void {
  act(() => {
    useSettingsStore.setState({ products });
  });
}

/** Names of the product rows, in the order they are shown (the name buttons of the table body). */
function shownNames(): string[] {
  const [, ...rows] = screen.getAllByRole("row");
  return rows.flatMap((row) => {
    const cells = within(row).queryAllByRole("cell");
    const nameCell = cells[1];
    return nameCell === undefined ? [] : [nameCell.textContent];
  });
}

beforeEach(() => {
  toastMock.mockReset();
  window.localStorage.clear();
  resetSettingsStore();
  seedInvoices();
});

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
    useSuggestionsStore.setState({ products: [] });
  });
  window.localStorage.clear();
  resetSettingsStore();
});

describe("«Mis productos» heading and counts (E6 zero-one-many)", () => {
  it("says «1 producto» and «1 miembro» for a single product with a single member", () => {
    setProducts([productWith("prod_a", "Café molido", [CAFE])]);
    render(<ProductList />);
    expect(screen.getByRole("heading", { name: "Mis productos · 1 producto" })).toBeInTheDocument();
    expect(screen.getByText("1 miembro")).toBeInTheDocument();
  });

  it("says «{n} productos» and «{n} miembros» for several", () => {
    setProducts([
      productWith("prod_a", "Leche entera", [LECHE_UNO, LECHE_DOS]),
      productWith("prod_b", "Café molido", [CAFE]),
      productWith("prod_c", "Azúcar", [AZUCAR]),
    ]);
    render(<ProductList />);
    expect(screen.getByRole("heading", { name: "Mis productos · 3 productos" })).toBeInTheDocument();
    expect(screen.getByText("2 miembros")).toBeInTheDocument();
    expect(screen.getAllByText("1 miembro")).toHaveLength(2);
  });

  it("shows the intro, the column headers and the first two suppliers then «+{k}»", () => {
    setProducts([productWith("prod_a", "Mezcla", [LECHE_UNO, LECHE_DOS, HARINA_TRES])]);
    render(<ProductList />);
    expect(
      screen.getByText(
        "Cada producto junta descripciones de distintas tiendas. Su categoría gana a la del proveedor, pero no a la que ajustes en un concepto.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Producto" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Proveedores" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeInTheDocument();
    expect(screen.getByText("Tienda Uno, Tienda Dos +1")).toBeInTheDocument();
  });

  it("keeps the table at least 880px wide inside a scrolling container", () => {
    setProducts([productWith("prod_a", "Café molido", [CAFE])]);
    render(<ProductList />);
    const table = screen.getByRole("table");
    expect(table.className).toContain("min-w-[880px]");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
  });
});

describe("order and sorting", () => {
  const unsorted = (): Product[] => [
    productWith("prod_z", "Zanahoria", [HARINA_TRES]),
    productWith("prod_a", "azúcar", [AZUCAR, SAL, CAFE]),
    productWith("prod_c", "Café", [LECHE_UNO, LECHE_DOS]),
  ];

  it("orders by name with the Spanish collator, ignoring case and accents", () => {
    setProducts(unsorted());
    render(<ProductList />);
    expect(shownNames()).toEqual(["azúcar", "Café", "Zanahoria"]);
  });

  it("reverses the name order on the second click and sorts by members", () => {
    setProducts(unsorted());
    render(<ProductList />);
    const byName = screen.getByRole("button", { name: "Producto" });
    fireEvent.click(byName);
    // The default is already ascending by name, so the first click goes descending.
    expect(shownNames()).toEqual(["Zanahoria", "Café", "azúcar"]);
    fireEvent.click(screen.getByRole("button", { name: "Miembros" }));
    expect(shownNames()).toEqual(["Zanahoria", "Café", "azúcar"]);
    // The first «Miembros» header is the expander's sr-only one; the sortable one carries aria-sort.
    const sortable = screen
      .getAllByRole("columnheader", { name: "Miembros" })
      .find((header) => header.hasAttribute("aria-sort"));
    expect(sortable).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: "Miembros" }));
    expect(shownNames()).toEqual(["azúcar", "Café", "Zanahoria"]);
  });
});

describe("pagination (E6 overflow)", () => {
  const many = (n: number): Product[] =>
    Array.from({ length: n }, (_, index) =>
      productWith(`prod_${String(index)}`, `Producto ${String(index + 1).padStart(3, "0")}`, [
        member(UNO, `Descripción ${String(index)}`),
      ]),
    );

  it("shows no footer up to 50 products", () => {
    setProducts(many(50));
    render(<ProductList />);
    expect(screen.queryByText(/^Página /)).toBeNull();
    expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
  });

  it("pages 51 products by 50 with the footer texts", () => {
    setProducts(many(51));
    render(<ProductList />);
    expect(shownNames()).toHaveLength(50);
    expect(screen.getByText("Mostrando 1–50 de 51")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(shownNames()).toEqual(["Producto 051"]);
    expect(screen.getByText("Mostrando 51 de 51")).toBeInTheDocument();
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
  });
});

describe("members sub-table (D-14)", () => {
  it("opens and closes with an expander that names the product and reports aria-expanded", () => {
    setProducts([productWith("prod_a", "Leche entera", [LECHE_UNO, LECHE_DOS])]);
    render(<ProductList />);
    const open = screen.getByRole("button", { name: "Ver miembros de Leche entera" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("table")).toHaveLength(1);
    fireEvent.click(open);
    const close = screen.getByRole("button", { name: "Ocultar miembros de Leche entera" });
    expect(close).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("table")).toHaveLength(2);
    fireEvent.click(close);
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("keeps several rows open at once, each with its own sub-table", () => {
    setProducts([
      productWith("prod_a", "Leche entera", [LECHE_UNO, LECHE_DOS]),
      productWith("prod_b", "Café molido", [CAFE]),
    ]);
    render(<ProductList />);
    fireEvent.click(screen.getByRole("button", { name: "Ver miembros de Leche entera" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver miembros de Café molido" }));
    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(3);
    // Rows are in name order: «Café molido» first, then «Leche entera».
    const [, second, first] = tables;
    if (first === undefined || second === undefined) throw new Error("missing sub-tables");
    expect(within(first).getByText("Descripción")).toBeInTheDocument();
    expect(within(first).getByText("Proveedor")).toBeInTheDocument();
    expect(within(first).getByText("Líneas")).toBeInTheDocument();
    expect(within(first).getByText("Leche entera 1L")).toBeInTheDocument();
    expect(within(first).getByText("LECHE ENTERA 1L")).toBeInTheDocument();
    expect(within(second).getByText("Café Molido 1kg")).toBeInTheDocument();
  });

  it("counts the loaded lines of each member and flags a member with none", () => {
    setProducts([productWith("prod_a", "Mezcla", [LECHE_UNO, LECHE_DOS, HARINA_TRES])]);
    render(<ProductList />);
    fireEvent.click(screen.getByRole("button", { name: "Ver miembros de Mezcla" }));
    const sub = screen.getAllByRole("table")[1];
    if (sub === undefined) throw new Error("missing sub-table");
    const rowOf = (text: string): HTMLElement => {
      const row = within(sub).getByText(text).closest("tr");
      if (row === null) throw new Error(`no row for ${text}`);
      return row;
    };
    // Leche entera 1L is on two Tienda Uno invoices, LECHE ENTERA 1L on one Tienda Dos invoice.
    expect(within(rowOf("Leche entera 1L")).getByText("2")).toBeInTheDocument();
    expect(within(rowOf("LECHE ENTERA 1L")).getByText("1")).toBeInTheDocument();
    expect(within(rowOf("Harina 1kg")).getByText("Sin líneas cargadas")).toBeInTheDocument();
    expect(within(rowOf("Leche entera 1L")).queryByText("Sin líneas cargadas")).toBeNull();
  });

  it("renders vendor text as plain text, never as markup (T-04-19)", () => {
    const hostile = member(UNO, "<img src=x onerror=alert(1)> Leche");
    setProducts([productWith("prod_a", "<b>Negrita</b>", [hostile])]);
    const { container } = render(<ProductList />);
    fireEvent.click(screen.getByRole("button", { name: /^Ver miembros de/ }));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)> Leche")).toBeInTheDocument();
  });
});

describe("the tab's empty state (E6 empty)", () => {
  function card(id: string, name: string, members: ProductMember[]): ProductSuggestion {
    return { id, name, target: null, members };
  }

  it("replaces the sections with the empty state while nothing is accepted, pending or marked, and keeps the entry button", () => {
    render(<ProductsTab />);
    expect(screen.getByText("Todavía no hay productos agrupados")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pulsa «Agrupar productos» para que DeepSeek junte las descripciones que son el mismo producto en distintas tiendas. Antes de enviar verás exactamente qué datos salen.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agrupar productos" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Mis productos/ })).toBeNull();
  });

  it("disappears with the first accepted product and the list takes its place", () => {
    render(<ProductsTab />);
    expect(screen.getByText("Todavía no hay productos agrupados")).toBeInTheDocument();
    act(() => {
      useSettingsStore.getState().acceptProduct({ name: "Café molido", members: [CAFE] });
    });
    expect(screen.queryByText("Todavía no hay productos agrupados")).toBeNull();
    expect(screen.getByRole("heading", { name: "Mis productos · 1 producto" })).toBeInTheDocument();
  });

  it("does not show up while a suggestion is pending, and shows the list below the queue once there is a product", () => {
    act(() => {
      useSuggestionsStore.setState({ products: [card("sug_a", "Leche entera", [LECHE_UNO])] });
    });
    render(<ProductsTab />);
    expect(screen.queryByText("Todavía no hay productos agrupados")).toBeNull();
    expect(screen.queryByRole("heading", { name: /^Mis productos/ })).toBeNull();
    act(() => {
      useSettingsStore.getState().acceptProduct({ name: "Café molido", members: [CAFE] });
    });
    const queue = screen.getByRole("heading", { name: "Sugerencias de productos · 1" });
    const list = screen.getByRole("heading", { name: "Mis productos · 1 producto" });
    expect(queue.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not show up when only a «No agrupar» mark exists", () => {
    act(() => {
      useSettingsStore.setState({ ungroupedConcepts: [{ ...SAL }] });
    });
    render(<ProductsTab />);
    expect(screen.queryByText("Todavía no hay productos agrupados")).toBeNull();
  });
});
