// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { normalizeDescription } from "@/domain/settings/normalize";
import { defaultSettings, type Product } from "@/domain/settings/types";
import { AppShell } from "@/features/shell/AppShell";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useStorageStatusStore } from "@/stores/storageStatusStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import { makeConcepto, makeProduct, purchaseInvoice } from "../../../tests/support/pricesFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { resetSuggestionsStore } from "../../../tests/support/suggestionsStorage";

interface ToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
}

const toastMock = vi.hoisted(() => vi.fn<(message: string, options?: ToastOptions) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const RFC_A = "AAA010101AAA";
const RFC_B = "BBB010101BBB";
const NAME_A = "Tienda Alfa";
const NAME_B = "Tienda Beta";
const DESCRIPTION = "AZUCAR ESTANDAR";

/** A full KGM concept without taxes or discount. */
function kgConcept(cantidad: string, importe: string): Concepto {
  return {
    claveProdServ: "50161800",
    noIdentificacion: null,
    cantidad,
    claveUnidad: "KGM",
    unidad: "Kilogramo",
    descripcion: DESCRIPTION,
    valorUnitario: importe,
    importe,
    descuento: null,
    objetoImp: "01",
    traslados: [],
    retenciones: [],
  };
}

/** A one-concept invoice of a synthetic store. */
function purchase(
  rfc: string,
  nombre: string,
  cantidad: string,
  importe: string,
  overrides: Partial<ParsedInvoice> = {},
): ParsedInvoice {
  return makeInvoice({
    emisor: { rfc, nombre },
    conceptos: [kgConcept(cantidad, importe)],
    subTotal: importe,
    total: importe,
    totalImpuestosTrasladados: null,
    ...overrides,
  });
}

const PRODUCT: Product = {
  id: "prod-azucar",
  name: "Azúcar estándar",
  categoryId: null,
  members: [
    { rfc: RFC_A, key: normalizeDescription(DESCRIPTION), description: DESCRIPTION, supplierName: NAME_A },
    { rfc: RFC_B, key: normalizeDescription(DESCRIPTION), description: DESCRIPTION, supplierName: NAME_B },
  ],
};

function load(invoices: readonly ParsedInvoice[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      invoices.map((invoice) => ({
        kind: "parsed" as const,
        file: { name: `${invoice.uuid}.xml`, path: `${invoice.uuid}.xml` },
        result: { ok: true as const, invoice },
      })),
      store.generation,
    );
  });
}

function openPrecios(): void {
  fireEvent.click(screen.getByRole("tab", { name: "Precios" }));
}

/** The Precios tab panel: the other tabs stay mounted, so queries are scoped to it. */
function panel(): ReturnType<typeof within> {
  return within(screen.getByRole("tabpanel", { name: "Precios" }));
}

/** The body row of the products table that holds the product name. */
function productRow(name: string): HTMLElement {
  const cell = screen.getByRole("cell", { name });
  const row = cell.closest("tr");
  if (row === null) throw new Error(`no row for ${name}`);
  return row;
}

beforeEach(() => {
  toastMock.mockClear();
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
  act(() => {
    useSettingsStore.setState({ ...defaultSettings(), products: [PRODUCT] });
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  act(() => {
    useSessionStore.getState().clearAll();
  });
  resetSettingsStore();
  resetSuggestionsStore();
});

describe("Precios tab (D-01, D-02, D-05, D-07, D-11, D-20, D-21, D-22)", () => {
  it("shows the cheapest store, the price per kg, the store count and the estimated saving of a grouped product", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();

    expect(screen.getByRole("heading", { name: "Precios" })).toBeInTheDocument();
    const row = within(productRow("Azúcar estándar"));
    expect(row.getByText(NAME_A)).toBeInTheDocument();
    expect(row.getByText("$50.00 / kg")).toBeInTheDocument();
    expect(row.getByText("2")).toBeInTheDocument();
    expect(row.getByText("$10.00")).toBeInTheDocument();

    const table = productRow("Azúcar estándar").closest("table");
    if (table === null) throw new Error("no products table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Detalle",
      "Producto",
      "Tienda más barata",
      "Precio",
      "Tiendas",
      "Ahorro estimado",
      "Acciones",
    ]);
  });

  it("labels the card total as estimated and explains how it is computed (D-22)", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();

    const card = within(screen.getByTestId("prices-savings"));
    expect(card.getByText("Ahorro estimado")).toBeInTheDocument();
    expect(card.getByText("estimado")).toBeInTheDocument();
    expect(card.getByText("$10.00")).toBeInTheDocument();
    expect(
      card.getByText(
        "Es lo que se habría ahorrado si cada compra se hubiera hecho al precio mediano de la tienda más barata de ese producto. Solo cuenta productos comparables con 2 o más tiendas, dentro de los filtros.",
      ),
    ).toBeInTheDocument();
  });

  it("does not let a credit note of the same supplier and concept move the price or the saving (D-06)", () => {
    const credit = purchase(RFC_B, NAME_B, "1", "60.00", { tipo: "E" });
    load([
      purchase(RFC_A, NAME_A, "2", "100.00"),
      purchase(RFC_B, NAME_B, "1", "60.00"),
      credit,
    ]);
    render(<AppShell />);
    openPrecios();

    const row = within(productRow("Azúcar estándar"));
    expect(row.getByText("$50.00 / kg")).toBeInTheDocument();
    expect(row.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByTestId("prices-savings-total")).toHaveTextContent("$10.00");
  });

  it("follows the supplier filter like the Dashboard: one store left means no saving and a $0.00 total (D-02, D-03)", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();
    act(() => {
      useSessionStore.getState().setSuppliers(new Set([RFC_A]));
    });

    const row = within(productRow("Azúcar estándar"));
    expect(row.getByText("1")).toBeInTheDocument();
    expect(row.queryByText("$10.00")).toBeNull();
    expect(screen.queryByText("$10.00")).toBeNull();
    expect(screen.getByTestId("prices-savings-total")).toHaveTextContent("$0.00");
  });
});

/** A product bought in the same two stores with two purchases each, for the list-level tests. */
const LECHE = makeProduct("Leche entera", [
  { rfc: RFC_A, descripcion: "LECHE ENTERA", supplierName: NAME_A },
  { rfc: RFC_B, descripcion: "LECHE ENTERA", supplierName: NAME_B },
]);

/** A litre purchase of LECHE ENTERA. */
function litres(rfc: string, nombre: string, cantidad: string, importe: string): ParsedInvoice {
  return purchaseInvoice({
    rfc,
    nombre,
    conceptos: [
      makeConcepto({
        descripcion: "LECHE ENTERA",
        claveUnidad: "LTR",
        unidad: "Litro",
        cantidad,
        valorUnitario: importe,
        importe,
      }),
    ],
  });
}

function setProducts(products: Product[]): void {
  act(() => {
    useSettingsStore.setState({ ...defaultSettings(), products });
  });
}

describe("Precios tab composition (D-02, D-03, D-04, D-07, D-22, D-23)", () => {
  it("shows only the heading and the first empty state when no product was accepted, and goes to Productos", async () => {
    setProducts([]);
    load([purchase(RFC_A, NAME_A, "2", "100.00")]);
    render(<AppShell />);
    openPrecios();

    expect(screen.getByRole("heading", { name: "Precios" })).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay productos para comparar")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Primero agrupa en la pestaña Productos las descripciones que son el mismo producto en distintas tiendas. Después aquí verás en qué tienda sale más barato cada uno.",
      ),
    ).toBeInTheDocument();
    expect(panel().queryByTestId("mode-caption")).toBeNull();
    expect(screen.queryByTestId("prices-savings")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ir a Productos" }));
    expect(useSessionStore.getState().activeTab).toBe("productos");
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("products-title");
    });
  });

  it("keeps the filter bar and offers «Quitar filtros» when the filters leave no purchase", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();
    act(() => {
      useSessionStore.getState().setSuppliers(new Set(["ZZZ010101ZZZ"]));
    });

    const empty = within(screen.getByTestId("prices-empty-filtered"));
    expect(empty.getByText("Ningún producto tiene compras con estos filtros")).toBeInTheDocument();
    expect(empty.getByText("Cambia o quita los filtros para ver los precios.")).toBeInTheDocument();
    expect(panel().getByTestId("mode-caption")).toBeInTheDocument();
    expect(screen.queryByTestId("prices-savings")).toBeNull();

    fireEvent.click(empty.getByRole("button", { name: "Quitar filtros" }));
    expect(screen.queryByTestId("prices-empty-filtered")).toBeNull();
    expect(screen.getByRole("cell", { name: "Azúcar estándar" })).toBeInTheDocument();
  });

  it("captions the IVA mode and the unit price rule under the filter bar", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();

    expect(panel().getByTestId("mode-caption")).toHaveTextContent("Montos con IVA (Total de cada factura)");
    expect(
      screen.getByText(
        "El precio unitario es el monto de la línea (con descuento) entre el contenido comprado.",
      ),
    ).toBeInTheDocument();

    act(() => {
      useSettingsStore.getState().setIvaMode("sin");
    });
    expect(panel().getByTestId("mode-caption")).toHaveTextContent(
      "Montos sin IVA (Subtotal − Descuento + IEPS)",
    );
  });

  it("reads zero in muted color with the zero-state sentence when no product has 2 stores", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00")]);
    render(<AppShell />);
    openPrecios();

    const total = screen.getByTestId("prices-savings-total");
    expect(total).toHaveTextContent("$0.00");
    expect(total.className).toContain("text-muted-foreground");
    expect(total.className).toContain("whitespace-nowrap");
    expect(screen.getByTestId("prices-savings-sub")).toHaveTextContent(
      "Ningún producto comparable se compró en 2 o más tiendas con estos filtros.",
    );
  });

  it("counts the compared products in singular and plural", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();
    expect(screen.getByTestId("prices-savings-sub")).toHaveTextContent("1 producto con 2 o más tiendas");
    expect(screen.queryByText(/comparado por pieza/)).toBeNull();

    setProducts([PRODUCT, LECHE]);
    load([litres(RFC_A, NAME_A, "1", "30.00"), litres(RFC_B, NAME_B, "1", "20.00")]);
    expect(screen.getByTestId("prices-savings-sub")).toHaveTextContent("2 productos con 2 o más tiendas");
  });

  it("adds the per-piece sentence only when a counted product is compared per piece (D-23)", () => {
    const escoba = makeProduct("Escoba", [
      { rfc: RFC_A, descripcion: "ESCOBA", supplierName: NAME_A },
      { rfc: RFC_B, descripcion: "ESCOBA", supplierName: NAME_B },
    ]);
    const piece = (rfc: string, nombre: string, importe: string) =>
      purchaseInvoice({
        rfc,
        nombre,
        conceptos: [makeConcepto({ descripcion: "ESCOBA", cantidad: "1", valorUnitario: importe, importe })],
      });
    setProducts([escoba]);
    load([piece(RFC_A, NAME_A, "80.00"), piece(RFC_B, NAME_B, "60.00")]);
    render(<AppShell />);
    openPrecios();

    expect(
      screen.getByText("Incluye 1 producto comparado por pieza, sin tamaño verificado."),
    ).toBeInTheDocument();
  });

  it("narrows the rows by name ignoring case and accents, and leaves the card unchanged (D-07)", () => {
    setProducts([PRODUCT, LECHE]);
    load([
      purchase(RFC_A, NAME_A, "2", "100.00"),
      purchase(RFC_B, NAME_B, "1", "60.00"),
      litres(RFC_A, NAME_A, "1", "30.00"),
      litres(RFC_B, NAME_B, "1", "20.00"),
    ]);
    render(<AppShell />);
    openPrecios();

    const field = screen.getByLabelText("Buscar producto");
    expect(field).toHaveAttribute("placeholder", "Nombre del producto");
    expect(screen.getByText("2 productos")).toBeInTheDocument();
    const before = screen.getByTestId("prices-savings-total").textContent;

    fireEvent.change(field, { target: { value: "LÉCHE" } });
    expect(screen.getByText("1 producto")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Leche entera" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Azúcar estándar" })).toBeNull();
    expect(screen.getByTestId("prices-savings-total").textContent).toBe(before);
  });

  it("says nothing matches the search and echoes the typed text (D-07)", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();

    fireEvent.change(screen.getByLabelText("Buscar producto"), { target: { value: "xyz" } });
    expect(screen.getByTestId("prices-no-match")).toHaveTextContent(
      "Ningún producto coincide con «xyz». Revisa la búsqueda.",
    );
    expect(panel().queryByRole("table")).toBeNull();
    expect(screen.getByText("0 productos")).toBeInTheDocument();
  });

  it("announces the count line politely", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();
    expect(screen.getByText("1 producto")).toHaveAttribute("aria-live", "polite");
  });
});

/** A product whose only purchases are a service (ClaveProdServ 84111506): hidden by default (D-16, D-17). */
const SERVICE_DESCRIPTION = "ASESORIA CONTABLE";
const SERVICE = makeProduct("Asesoría contable", [
  { rfc: RFC_A, descripcion: SERVICE_DESCRIPTION, supplierName: NAME_A },
]);

function servicePurchase(rfc: string, nombre: string, importe: string): ParsedInvoice {
  return purchaseInvoice({
    rfc,
    nombre,
    conceptos: [
      makeConcepto({
        claveProdServ: "84111506",
        descripcion: SERVICE_DESCRIPTION,
        claveUnidad: "E48",
        unidad: "Servicio",
        cantidad: "1",
        valorUnitario: importe,
        importe,
      }),
    ],
  });
}

/** The body row that holds a text, found by text because a hidden row's cell has badges in it. */
function rowWithText(text: string): HTMLElement {
  const row = panel().getByText(text).closest("tr");
  if (row === null) throw new Error(`no row for ${text}`);
  return row;
}

describe("Mostrar los no comparables (PREC-03, D-07, D-18, D-22)", () => {
  it("hides a service product by default, counts it in the checkbox and keeps it out of the card", () => {
    setProducts([PRODUCT, SERVICE]);
    load([
      purchase(RFC_A, NAME_A, "2", "100.00"),
      purchase(RFC_B, NAME_B, "1", "60.00"),
      servicePurchase(RFC_A, NAME_A, "500.00"),
    ]);
    render(<AppShell />);
    openPrecios();

    expect(panel().getByRole("checkbox", { name: "Mostrar los no comparables (1)" })).not.toBeChecked();
    expect(panel().queryByText("Asesoría contable")).toBeNull();
    expect(panel().getByText("1 producto")).toBeInTheDocument();
    expect(screen.getByTestId("prices-savings-sub")).toHaveTextContent("1 producto con 2 o más tiendas");
  });

  it("reads «(0)» when nothing is hidden", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();
    expect(panel().getByRole("checkbox", { name: "Mostrar los no comparables (0)" })).toBeInTheDocument();
  });

  it("shows the hidden row muted with its badge, the default reason, dashes and no expander", () => {
    setProducts([PRODUCT, SERVICE]);
    load([
      purchase(RFC_A, NAME_A, "2", "100.00"),
      purchase(RFC_B, NAME_B, "1", "60.00"),
      servicePurchase(RFC_A, NAME_A, "500.00"),
    ]);
    render(<AppShell />);
    openPrecios();
    fireEvent.click(panel().getByRole("checkbox", { name: "Mostrar los no comparables (1)" }));

    const row = rowWithText("Asesoría contable");
    const view = within(row);
    expect(view.getByText("No comparable")).toBeInTheDocument();
    expect(
      view.getByText("Se excluye por defecto: sus compras son de servicios o combustible."),
    ).toBeInTheDocument();
    const cells = view.getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("—");
    expect(cells[3]).toHaveTextContent("—");
    expect(cells[5]).toHaveTextContent("—");
    expect(view.queryByRole("button", { name: /^(Ver|Ocultar) precios de/ })).toBeNull();
    expect(view.getByText("Asesoría contable").className).toContain("text-muted-foreground");
    // The card still counts the comparable product only, with the checkbox on.
    expect(screen.getByTestId("prices-savings-sub")).toHaveTextContent("1 producto con 2 o más tiendas");
    expect(panel().getByText("2 productos")).toBeInTheDocument();
  });

  it("says «Lo marcaste tú» for a product the user marked, and hides it", () => {
    setProducts([PRODUCT]);
    act(() => {
      useSettingsStore.setState({ priceOverrides: [{ productId: PRODUCT.id, comparable: false }] });
    });
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();

    expect(panel().queryByText("Azúcar estándar")).toBeNull();
    fireEvent.click(panel().getByRole("checkbox", { name: "Mostrar los no comparables (1)" }));
    const view = within(rowWithText("Azúcar estándar"));
    expect(view.getByText("Lo marcaste tú como no comparable.")).toBeInTheDocument();
    expect(view.queryByText(/Se excluye por defecto/)).toBeNull();
  });

  it("explains the case where every product with purchases is hidden, keeping the filter bar and tools row", () => {
    setProducts([SERVICE]);
    load([servicePurchase(RFC_A, NAME_A, "500.00")]);
    render(<AppShell />);
    openPrecios();

    expect(
      panel().getByText("Todos los productos con compras están marcados como no comparables"),
    ).toBeInTheDocument();
    expect(
      panel().getByText("Activa «Mostrar los no comparables» para verlos y volver a compararlos."),
    ).toBeInTheDocument();
    expect(panel().getByTestId("mode-caption")).toBeInTheDocument();
    expect(panel().getByLabelText("Buscar producto")).toBeInTheDocument();
    expect(panel().getByRole("checkbox", { name: "Mostrar los no comparables (1)" })).toBeInTheDocument();
    expect(panel().queryByRole("table")).toBeNull();
    const empty = screen.getByTestId("prices-empty-hidden");
    expect(within(empty).queryByRole("button")).toBeNull();

    fireEvent.click(panel().getByRole("checkbox", { name: "Mostrar los no comparables (1)" }));
    expect(screen.queryByTestId("prices-empty-hidden")).toBeNull();
    expect(panel().getByText("Asesoría contable")).toBeInTheDocument();
  });

  it("shows the storage Alert while the browser refuses to store the settings (E4 error)", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();
    const message =
      "Este navegador no permite guardar tus ajustes. Los cambios se perderán al cerrar la página; descarga tus ajustes para no perderlos.";
    expect(panel().queryByText(message)).toBeNull();

    act(() => {
      useStorageStatusStore.setState({ writeFailed: true });
    });
    expect(panel().getByText(message)).toBeInTheDocument();

    act(() => {
      useStorageStatusStore.setState({ writeFailed: false });
    });
    expect(panel().queryByText(message)).toBeNull();
  });
});

/** The «Deshacer» action of the most recent toast. */
function lastUndo(): () => void {
  const undo = toastMock.mock.calls.at(-1)?.[1]?.action?.onClick;
  if (undo === undefined) throw new Error("no toast with an undo action");
  return undo;
}

function menuButton(name: string): HTMLElement {
  return panel().getByRole("button", { name: `Más acciones de «${name}»` });
}

async function choose(name: string, item: string): Promise<void> {
  fireEvent.click(menuButton(name));
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("Row menu: marking a product as no comparable (PREC-03, D-18, D-19, E5)", () => {
  const LECHE_PURCHASES = [litres(RFC_A, NAME_A, "1", "30.00"), litres(RFC_B, NAME_B, "1", "20.00")];

  function seedTwoProducts(): void {
    setProducts([PRODUCT, LECHE]);
    load([
      purchase(RFC_A, NAME_A, "2", "100.00"),
      purchase(RFC_B, NAME_B, "1", "60.00"),
      ...LECHE_PURCHASES,
    ]);
  }

  it("removes the row at once, lowers the card, toasts, announces politely and moves focus to the heading; «Deshacer» brings it back", async () => {
    seedTwoProducts();
    render(<AppShell />);
    openPrecios();
    expect(screen.getByTestId("prices-savings-sub")).toHaveTextContent("2 productos con 2 o más tiendas");
    const totalBefore = screen.getByTestId("prices-savings-total").textContent;

    await choose("Azúcar estándar", "Marcar como no comparable");

    await waitFor(() => {
      expect(panel().queryByRole("cell", { name: "Azúcar estándar" })).toBeNull();
    });
    expect(useSettingsStore.getState().priceOverrides).toEqual([
      { productId: PRODUCT.id, comparable: false },
    ]);
    expect(screen.getByTestId("prices-savings-sub")).toHaveTextContent("1 producto con 2 o más tiendas");
    expect(screen.getByTestId("prices-savings-total").textContent).not.toBe(totalBefore);
    expect(panel().getByRole("checkbox", { name: "Mostrar los no comparables (1)" })).toBeInTheDocument();
    expect(toastMock.mock.calls.at(-1)?.[0]).toBe("«Azúcar estándar» marcado como no comparable");
    expect(toastMock.mock.calls.at(-1)?.[1]?.duration).toBe(6000);
    const region = screen.getByTestId("prices-announcement");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region.className).toContain("sr-only");
    expect(region).toHaveTextContent(
      "Producto «Azúcar estándar» marcado como no comparable. Queda 1 producto.",
    );
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("prices-title");
    });

    act(() => {
      lastUndo()();
    });
    expect(panel().getByRole("cell", { name: "Azúcar estándar" })).toBeInTheDocument();
    expect(useSettingsStore.getState().priceOverrides).toEqual([]);
    expect(screen.getByTestId("prices-savings-sub")).toHaveTextContent("2 productos con 2 o más tiendas");
    expect(screen.getByTestId("prices-savings-total").textContent).toBe(totalBefore);
  });

  it("keeps the row muted with its reason and focus on its «⋯» button when the checkbox is on", async () => {
    seedTwoProducts();
    render(<AppShell />);
    openPrecios();
    fireEvent.click(panel().getByRole("checkbox", { name: "Mostrar los no comparables (0)" }));

    await choose("Azúcar estándar", "Marcar como no comparable");

    const view = within(rowWithText("Azúcar estándar"));
    expect(view.getByText("Lo marcaste tú como no comparable.")).toBeInTheDocument();
    expect(view.getByText("No comparable")).toBeInTheDocument();
    expect(panel().getByRole("checkbox", { name: "Mostrar los no comparables (1)" })).toBeChecked();
    await waitFor(() => {
      expect(menuButton("Azúcar estándar")).toHaveFocus();
    });

    // The same row now offers the way back, which returns to the default and stores nothing.
    await choose("Azúcar estándar", "Volver a comparar");
    expect(useSettingsStore.getState().priceOverrides).toEqual([]);
    expect(within(rowWithText("Azúcar estándar")).queryByText("No comparable")).toBeNull();
    expect(toastMock.mock.calls.at(-1)?.[0]).toBe("«Azúcar estándar» vuelve a compararse");
    expect(screen.getByTestId("prices-announcement")).toHaveTextContent(
      "Producto «Azúcar estándar» vuelve a compararse.",
    );
  });

  it("brings a product hidden by default back to the comparison and stores that choice", async () => {
    setProducts([PRODUCT, SERVICE]);
    load([
      purchase(RFC_A, NAME_A, "2", "100.00"),
      purchase(RFC_B, NAME_B, "1", "60.00"),
      servicePurchase(RFC_A, NAME_A, "500.00"),
    ]);
    render(<AppShell />);
    openPrecios();
    fireEvent.click(panel().getByRole("checkbox", { name: "Mostrar los no comparables (1)" }));

    await choose("Asesoría contable", "Volver a comparar");

    expect(useSettingsStore.getState().priceOverrides).toEqual([
      { productId: SERVICE.id, comparable: true },
    ]);
    expect(panel().getByRole("checkbox", { name: "Mostrar los no comparables (0)" })).toBeInTheDocument();
    expect(within(rowWithText("Asesoría contable")).queryByText("No comparable")).toBeNull();
    act(() => {
      lastUndo()();
    });
    expect(useSettingsStore.getState().priceOverrides).toEqual([]);
    expect(panel().getByRole("checkbox", { name: "Mostrar los no comparables (1)" })).toBeInTheDocument();
  });

  it("keeps the mark in memory and shows the storage Alert when the browser refuses to store it (E5 error)", async () => {
    seedTwoProducts();
    render(<AppShell />);
    openPrecios();
    act(() => {
      useStorageStatusStore.setState({ writeFailed: true });
    });

    await choose("Azúcar estándar", "Marcar como no comparable");

    expect(useSettingsStore.getState().priceOverrides).toHaveLength(1);
    expect(panel().queryByRole("cell", { name: "Azúcar estándar" })).toBeNull();
    expect(
      panel().getByText(
        "Este navegador no permite guardar tus ajustes. Los cambios se perderán al cerrar la página; descarga tus ajustes para no perderlos.",
      ),
    ).toBeInTheDocument();
  });

  it("explains the empty state after the last compared product is marked", async () => {
    setProducts([PRODUCT]);
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();

    await choose("Azúcar estándar", "Marcar como no comparable");

    expect(await screen.findByTestId("prices-empty-hidden")).toBeInTheDocument();
    expect(screen.getByTestId("prices-announcement")).toHaveTextContent(
      "Producto «Azúcar estándar» marcado como no comparable. Quedan 0 productos.",
    );
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("prices-title");
    });
  });
});

describe("price history inside an opened product (PREC-06, D-24)", () => {
  function legendItem(name: string): HTMLElement {
    const item = panel()
      .getAllByRole("listitem")
      .find((li: HTMLElement) => li.textContent === name);
    if (item === undefined) throw new Error(`no legend item for ${name}`);
    return item;
  }

  it("keeps the color slot of a store when the supplier filter hides the other store", () => {
    load([purchase(RFC_A, NAME_A, "2", "100.00"), purchase(RFC_B, NAME_B, "1", "60.00")]);
    render(<AppShell />);
    openPrecios();
    fireEvent.click(screen.getByRole("button", { name: "Ver precios de Azúcar estándar" }));

    expect(panel().getByRole("heading", { name: "Historial de precios" })).toBeInTheDocument();
    expect(legendItem(NAME_B).querySelector("svg")?.getAttribute("class")).toContain("text-series-2");

    // Only Beta is left: with the slots taken from the filtered stores it would become slot 1.
    act(() => {
      useSessionStore.getState().setSuppliers(new Set([RFC_B]));
    });
    expect(legendItem(NAME_B).querySelector("svg")?.getAttribute("class")).toContain("text-series-2");
  });
});
