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

// --- Plan 04-07 Task 2: rename, delete, take out and move members, each with «Deshacer» ---

/** What a toast call carried: its text, its description line, how long it stays and its action. */
interface ToastCall {
  message: string;
  description: string | undefined;
  duration: number | undefined;
  actionLabel: string | undefined;
  /** Presses the toast's action button. */
  press: () => void;
}

function toastCall(index: number): ToastCall {
  const call = toastMock.mock.calls[index];
  if (call === undefined) throw new Error(`no toast call at ${String(index)}`);
  const [message, options] = call;
  let description: string | undefined;
  let duration: number | undefined;
  let actionLabel: string | undefined;
  let press: () => void = () => {
    throw new Error("the toast has no action");
  };
  if (typeof options === "object" && options !== null) {
    if ("description" in options && typeof options.description === "string") {
      description = options.description;
    }
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
  return { message, description, duration, actionLabel, press };
}

function lastToast(): ToastCall {
  return toastCall(toastMock.mock.calls.length - 1);
}

function storedProducts(): Product[] {
  return useSettingsStore.getState().products;
}

/** «Leche entera» (two members), «Café molido» and «Azúcar», shown in that alphabetical order reversed: Azúcar, Café, Leche. */
function threeProducts(): Product[] {
  return [
    productWith("prod_leche", "Leche entera", [LECHE_UNO, LECHE_DOS]),
    productWith("prod_cafe", "Café molido", [CAFE]),
    productWith("prod_azucar", "Azúcar", [AZUCAR]),
  ];
}

function pencil(name: string): HTMLElement {
  return screen.getByRole("button", { name: `Renombrar producto ${name}` });
}

function nameInput(name: string): HTMLInputElement {
  const input = screen.getByRole("textbox", { name: `Nuevo nombre del producto ${name}` });
  if (!(input instanceof HTMLInputElement)) throw new Error("not an input");
  return input;
}

function typeName(name: string, value: string): void {
  fireEvent.change(nameInput(name), { target: { value } });
}

describe("inline rename (E6 error, D-14)", () => {
  it("opens an input with the current name selected and focused", () => {
    setProducts(threeProducts());
    render(<ProductList />);
    fireEvent.click(pencil("Leche entera"));
    const input = nameInput("Leche entera");
    expect(input).toHaveValue("Leche entera");
    expect(input).toHaveFocus();
    expect(input.maxLength).toBe(60);
    expect(screen.getByRole("button", { name: "Guardar nombre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar cambio de nombre" })).toBeInTheDocument();
  });

  it("saves with Enter keeping id, category and members, and returns focus to that row's pencil", () => {
    setProducts([{ ...productWith("prod_leche", "Leche entera", [LECHE_UNO]), categoryId: "seed:otros" }]);
    render(<ProductList />);
    fireEvent.click(pencil("Leche entera"));
    typeName("Leche entera", "  Leche de vaca ");
    fireEvent.keyDown(nameInput("Leche entera"), { key: "Enter" });
    expect(storedProducts()).toEqual([
      { id: "prod_leche", name: "Leche de vaca", categoryId: "seed:otros", members: [LECHE_UNO] },
    ]);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(pencil("Leche de vaca")).toHaveFocus();
  });

  it("cancels with Esc, changes nothing and returns focus to the pencil", () => {
    setProducts(threeProducts());
    render(<ProductList />);
    fireEvent.click(pencil("Café molido"));
    typeName("Café molido", "Otro nombre");
    fireEvent.keyDown(nameInput("Café molido"), { key: "Escape" });
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche entera", "Café molido", "Azúcar"]);
    expect(pencil("Café molido")).toHaveFocus();
  });

  it("saves and cancels with the two icon buttons", () => {
    setProducts(threeProducts());
    render(<ProductList />);
    fireEvent.click(pencil("Azúcar"));
    typeName("Azúcar", "Azúcar morena");
    fireEvent.click(screen.getByRole("button", { name: "Guardar nombre" }));
    expect(storedProducts().map((entry) => entry.name)).toContain("Azúcar morena");
    fireEvent.click(pencil("Azúcar morena"));
    typeName("Azúcar morena", "No se guarda");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar cambio de nombre" }));
    expect(storedProducts().map((entry) => entry.name)).toContain("Azúcar morena");
  });

  it.each([
    ["", "Escribe un nombre para el producto."],
    ["   ", "Escribe un nombre para el producto."],
    [" CAFÉ molido ", "Ya existe un producto con ese nombre. Cambia el nombre o usa «Unir con…»."],
    ["Sin categoría", "«Sin categoría» es un nombre reservado."],
    ["x".repeat(61), "El nombre puede tener hasta 60 caracteres."],
  ])("refuses %j under the input, keeps it open and changes nothing", (value, message) => {
    setProducts(threeProducts());
    render(<ProductList />);
    fireEvent.click(pencil("Leche entera"));
    typeName("Leche entera", value);
    fireEvent.keyDown(nameInput("Leche entera"), { key: "Enter" });
    const input = nameInput("Leche entera");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(message);
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche entera", "Café molido", "Azúcar"]);
    // Typing again clears the error.
    typeName("Leche entera", "Leche");
    expect(nameInput("Leche entera")).not.toHaveAttribute("aria-invalid");
  });

  it("allows the same name in another case", () => {
    setProducts(threeProducts());
    render(<ProductList />);
    fireEvent.click(pencil("Leche entera"));
    typeName("Leche entera", "LECHE ENTERA");
    fireEvent.keyDown(nameInput("Leche entera"), { key: "Enter" });
    expect(storedProducts()[0]?.name).toBe("LECHE ENTERA");
  });
});

describe("Borrar producto (D-14, D-15)", () => {
  it("deletes at once with the toast, its description line and «Deshacer» for 6 s", () => {
    setProducts(threeProducts());
    render(<ProductList />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar producto Leche entera" }));
    expect(storedProducts().map((entry) => entry.id)).toEqual(["prod_cafe", "prod_azucar"]);
    const toast = lastToast();
    expect(toast.message).toBe("Producto «Leche entera» borrado");
    expect(toast.description).toBe("Sus 2 descripciones vuelven a quedar libres.");
    expect(toast.duration).toBe(6000);
    expect(toast.actionLabel).toBe("Deshacer");
  });

  it("says the singular for a product with one member and cuts a long name at 40", () => {
    const long = "y".repeat(50);
    setProducts([productWith("prod_cafe", long, [CAFE])]);
    render(<ProductsTab />);
    fireEvent.click(screen.getByRole("button", { name: `Borrar producto ${long}` }));
    expect(lastToast().message).toBe(`Producto «${"y".repeat(39)}…» borrado`);
    expect(lastToast().description).toBe("Su descripción vuelve a quedar libre.");
  });

  it("«Deshacer» restores the same id, position, name, category and members", () => {
    const original: Product[] = [
      productWith("prod_leche", "Leche entera", [LECHE_UNO, LECHE_DOS]),
      { ...productWith("prod_cafe", "Café molido", [CAFE]), categoryId: "seed:otros" },
      productWith("prod_azucar", "Azúcar", [AZUCAR]),
    ];
    setProducts(original);
    render(<ProductList />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar producto Café molido" }));
    expect(storedProducts()).toHaveLength(2);
    lastToast().press();
    expect(storedProducts()).toEqual(original);
    expect(screen.getByRole("button", { name: "Borrar producto Café molido" })).toBeInTheDocument();
  });

  it("moves focus to the section heading", () => {
    setProducts(threeProducts());
    render(<ProductList />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar producto Azúcar" }));
    expect(screen.getByRole("heading", { name: "Mis productos · 2 productos" })).toHaveFocus();
  });

  it("moves focus to the tab heading when the last product is deleted and shows the empty state; undo brings the list back", () => {
    setProducts([productWith("prod_cafe", "Café molido", [CAFE])]);
    render(<ProductsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar producto Café molido" }));
    expect(screen.getByRole("heading", { name: "Productos", level: 2 })).toHaveFocus();
    expect(screen.getByText("Todavía no hay productos agrupados")).toBeInTheDocument();
    lastToast().press();
    expect(screen.queryByText("Todavía no hay productos agrupados")).toBeNull();
    expect(screen.getByRole("heading", { name: "Mis productos · 1 producto" })).toBeInTheDocument();
  });

  it("does not undo when one of its descriptions was accepted elsewhere meanwhile", () => {
    setProducts(threeProducts());
    render(<ProductList />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar producto Café molido" }));
    act(() => {
      useSettingsStore.getState().acceptProduct({ name: "Otro", members: [CAFE] });
    });
    lastToast().press();
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche entera", "Azúcar", "Otro"]);
  });
});

function expand(name: string): void {
  fireEvent.click(screen.getByRole("button", { name: `Ver miembros de ${name}` }));
}

describe("Quitar a member (D-15, OQ5)", () => {
  it("names the description it acts on, cut at 60 characters, and has a Tooltip-backed label", () => {
    const longDescription = "d".repeat(70);
    setProducts([productWith("prod_a", "Mezcla", [member(UNO, longDescription), CAFE])]);
    render(<ProductList />);
    expand("Mezcla");
    expect(
      screen.getByRole("button", { name: `Quitar «${"d".repeat(59)}…» del producto` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Mover «${"d".repeat(59)}…» a otro producto` }),
    ).toBeInTheDocument();
  });

  it("applies at once with the toast and «Deshacer», which puts the member back at its place", () => {
    const original = threeProducts();
    setProducts(original);
    render(<ProductList />);
    expand("Leche entera");
    fireEvent.click(screen.getByRole("button", { name: "Quitar «Leche entera 1L» del producto" }));
    expect(storedProducts()[0]?.members).toEqual([LECHE_DOS]);
    const toast = lastToast();
    expect(toast.message).toBe("«Leche entera 1L» quitada de «Leche entera»");
    expect(toast.duration).toBe(6000);
    expect(toast.actionLabel).toBe("Deshacer");
    toast.press();
    expect(storedProducts()).toEqual(original);
  });

  it("cuts the description in the toast at 40 characters", () => {
    const longDescription = "z".repeat(50);
    setProducts([productWith("prod_a", "Mezcla", [member(UNO, longDescription), CAFE])]);
    render(<ProductList />);
    expand("Mezcla");
    fireEvent.click(screen.getByRole("button", { name: `Quitar «${"z".repeat(50)}» del producto` }));
    expect(lastToast().message).toBe(`«${"z".repeat(39)}…» quitada de «Mezcla»`);
  });

  it("returns focus to the product's expander", () => {
    setProducts(threeProducts());
    render(<ProductList />);
    expand("Leche entera");
    fireEvent.click(screen.getByRole("button", { name: "Quitar «Leche entera 1L» del producto" }));
    expect(screen.getByRole("button", { name: "Ocultar miembros de Leche entera" })).toHaveFocus();
  });

  it("deletes the product with its last member, says so, and «Deshacer» restores the product", () => {
    const original = threeProducts();
    setProducts(original);
    render(<ProductList />);
    expand("Café molido");
    fireEvent.click(screen.getByRole("button", { name: "Quitar «Café Molido 1kg» del producto" }));
    expect(storedProducts().map((entry) => entry.id)).toEqual(["prod_leche", "prod_azucar"]);
    expect(lastToast().message).toBe("Producto «Café molido» borrado porque se quedó sin descripciones");
    expect(lastToast().actionLabel).toBe("Deshacer");
    expect(screen.getByRole("heading", { name: "Mis productos · 2 productos" })).toHaveFocus();
    lastToast().press();
    expect(storedProducts()).toEqual(original);
  });

  it("counts the freed description as free again in «Agrupar productos» (D-15), and as taken again after «Deshacer»", () => {
    setProducts([
      productWith("prod_leche", "Leche entera", [LECHE_UNO, LECHE_DOS]),
      productWith("prod_cafe", "Café molido", [CAFE]),
      productWith("prod_azucar", "Azúcar", [AZUCAR]),
    ]);
    render(<ProductsTab />);
    // Five loaded descriptions, four taken: only «Sal» is free.
    expect(screen.getByText("1 descripción sin agrupar")).toBeInTheDocument();
    expand("Leche entera");
    fireEvent.click(screen.getByRole("button", { name: "Quitar «Leche entera 1L» del producto" }));
    expect(screen.getByText("2 descripciones sin agrupar")).toBeInTheDocument();
    lastToast().press();
    expect(screen.getByText("1 descripción sin agrupar")).toBeInTheDocument();
  });

  it("is not a rejection: nothing is marked «No agrupar»", () => {
    setProducts(threeProducts());
    render(<ProductList />);
    expand("Leche entera");
    fireEvent.click(screen.getByRole("button", { name: "Quitar «Leche entera 1L» del producto" }));
    expect(useSettingsStore.getState().ungroupedConcepts).toEqual([]);
  });
});

async function openMove(description: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: `Mover «${description}» a otro producto` }));
  await screen.findByRole("combobox");
}

describe("Mover a otro producto (D-15, OQ5)", () => {
  it("lists the other products, searchable, and moves the member to the end of the chosen one", async () => {
    const original = threeProducts();
    setProducts(original);
    render(<ProductList />);
    expand("Leche entera");
    await openMove("Leche entera 1L");
    expect(screen.getByRole("combobox", { name: "Buscar producto" })).toBeInTheDocument();
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    // Alphabetical (es), without the product itself, each with its member count.
    expect(options).toEqual(["Azúcar1 miembro", "Café molido1 miembro"]);
    fireEvent.click(screen.getByRole("option", { name: /^Café molido/ }));
    expect(storedProducts()[1]?.members).toEqual([CAFE, LECHE_UNO]);
    expect(storedProducts()[0]?.members).toEqual([LECHE_DOS]);
    const toast = lastToast();
    expect(toast.message).toBe("«Leche entera 1L» movida a «Café molido»");
    expect(toast.duration).toBe(6000);
    expect(toast.actionLabel).toBe("Deshacer");
    toast.press();
    expect(storedProducts()).toEqual(original);
  });

  it("filters while typing ignoring case and accents, and says when nothing matches", async () => {
    setProducts(threeProducts());
    render(<ProductList />);
    expand("Leche entera");
    await openMove("Leche entera 1L");
    const search = screen.getByRole("combobox", { name: "Buscar producto" });
    fireEvent.change(search, { target: { value: "AZUCAR" } });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Azúcar1 miembro"]);
    fireEvent.change(search, { target: { value: "queso" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Ningún producto coincide con «queso».")).toBeInTheDocument();
  });

  it("deletes the source when its only member moves, says so, and «Deshacer» puts everything back", async () => {
    const original = threeProducts();
    setProducts(original);
    render(<ProductList />);
    expand("Café molido");
    await openMove("Café Molido 1kg");
    fireEvent.click(screen.getByRole("option", { name: /^Leche entera/ }));
    expect(storedProducts().map((entry) => entry.id)).toEqual(["prod_leche", "prod_azucar"]);
    expect(storedProducts()[0]?.members).toEqual([LECHE_UNO, LECHE_DOS, CAFE]);
    expect(lastToast().message).toBe("Producto «Café molido» borrado porque se quedó sin descripciones");
    lastToast().press();
    expect(storedProducts()).toEqual(original);
  });

  it("offers no destination when there is a single product", async () => {
    setProducts([productWith("prod_leche", "Leche entera", [LECHE_UNO, LECHE_DOS])]);
    render(<ProductList />);
    expand("Leche entera");
    await openMove("Leche entera 1L");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
