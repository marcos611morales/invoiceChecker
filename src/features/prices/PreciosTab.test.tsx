// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { normalizeDescription } from "@/domain/settings/normalize";
import { defaultSettings, type Product } from "@/domain/settings/types";
import { AppShell } from "@/features/shell/AppShell";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { resetSuggestionsStore } from "../../../tests/support/suggestionsStorage";

vi.mock("sonner", () => ({ toast: vi.fn() }));

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

/** The body row of the products table that holds the product name. */
function productRow(name: string): HTMLElement {
  const cell = screen.getByRole("cell", { name });
  const row = cell.closest("tr");
  if (row === null) throw new Error(`no row for ${name}`);
  return row;
}

beforeEach(() => {
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
      "Producto",
      "Tienda más barata",
      "Precio",
      "Tiendas",
      "Ahorro estimado",
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
