// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { defaultSettings, type SettingsData } from "@/domain/settings/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { SupplierCategoryTable } from "./SupplierCategoryTable";

interface ToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
}
const toastMock = vi.hoisted(() => vi.fn<(message: string, options?: ToastOptions) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const LIMPIEZA = "seed:limpieza-higiene";
const SERVICIOS = "seed:servicios";

/** A supplier with `count` invoices; the RFC is unique per `id`. */
function supplier(id: string, nombre: string, count: number): ParsedInvoice[] {
  return Array.from({ length: count }, () =>
    makeInvoice({ emisor: { rfc: `${id}010101AAA`, nombre } }),
  );
}

function load(invoices: readonly ParsedInvoice[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      invoices.map((invoice, index) => ({
        kind: "parsed" as const,
        file: { name: `f${String(index)}.xml`, path: `f${String(index)}.xml` },
        result: { ok: true as const, invoice },
      })),
      store.generation,
    );
  });
}

function seedSettings(patch: Partial<SettingsData>): void {
  act(() => {
    useSettingsStore.setState({ ...defaultSettings(), ...patch });
  });
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${String(index)}`);
  return item;
}

/** Body rows (the header row is dropped). */
function bodyRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1);
}

/** RFC of each body row, in order. */
function rfcs(): (string | null)[] {
  return bodyRows().map((row) => row.querySelectorAll("td")[1]?.textContent ?? null);
}

function header(name: string): HTMLElement {
  return screen.getByRole("columnheader", { name });
}

function sortBy(name: string): void {
  fireEvent.click(within(header(name)).getByRole("button"));
}

function supplierSelect(name: string): HTMLElement {
  return screen.getByRole("combobox", { name: `Categoría por defecto de ${name}` });
}

function choose(name: string, optionText: string): void {
  fireEvent.click(supplierSelect(name));
  const option = screen.getByRole("option", { name: optionText });
  // Base UI commits a mouse selection only when the pointer went down on the item.
  fireEvent.pointerDown(option);
  fireEvent.click(option);
}

/** onClick of the action of the most recent toast with this message. */
function toastAction(message: string): () => void {
  for (let index = toastMock.mock.calls.length - 1; index >= 0; index -= 1) {
    const [text, options] = toastMock.mock.calls[index] ?? [];
    if (text === message && options?.action !== undefined) return options.action.onClick;
  }
  throw new Error(`no toast "${message}" with an action`);
}

function renderTable(): void {
  render(<SupplierCategoryTable />);
}

beforeEach(() => {
  resetSettingsStore();
  toastMock.mockReset();
});

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
  });
  resetSettingsStore();
});

describe("SupplierCategoryTable order and sorting (E2 populated)", () => {
  it("orders by Facturas descending, then name, with saved-only rows last", () => {
    load([
      ...supplier("ZZZ", "Zeta", 1),
      ...supplier("AAA", "Alfa", 1),
      ...supplier("MMM", "Medio", 3),
    ]);
    seedSettings({
      supplierCategories: [{ rfc: "GGG010101AAA", name: "Guardado", categoryId: SERVICIOS }],
    });
    renderTable();
    expect(rfcs()).toEqual(["MMM010101AAA", "AAA010101AAA", "ZZZ010101AAA", "GGG010101AAA"]);
  });

  it("sorts by Proveedor ascending, descending and back to unsorted, with aria-sort following", () => {
    load([...supplier("ZZZ", "Zeta", 1), ...supplier("AAA", "Alfa", 1), ...supplier("MMM", "Medio", 3)]);
    renderTable();
    expect(header("Proveedor")).toHaveAttribute("aria-sort", "none");
    sortBy("Proveedor");
    expect(header("Proveedor")).toHaveAttribute("aria-sort", "ascending");
    expect(rfcs()).toEqual(["AAA010101AAA", "MMM010101AAA", "ZZZ010101AAA"]);
    sortBy("Proveedor");
    expect(header("Proveedor")).toHaveAttribute("aria-sort", "descending");
    expect(rfcs()).toEqual(["ZZZ010101AAA", "MMM010101AAA", "AAA010101AAA"]);
    sortBy("Proveedor");
    expect(header("Proveedor")).toHaveAttribute("aria-sort", "none");
    // Unsorted is the data order, which is by name.
    expect(rfcs()).toEqual(["AAA010101AAA", "MMM010101AAA", "ZZZ010101AAA"]);
  });

  it("cycles Facturas from its default descending order to unsorted and then ascending", () => {
    load([...supplier("ZZZ", "Zeta", 2), ...supplier("AAA", "Alfa", 1), ...supplier("MMM", "Medio", 3)]);
    renderTable();
    expect(header("Facturas")).toHaveAttribute("aria-sort", "descending");
    // Descending is already the default, so the cycle goes on to unsorted, then ascending.
    sortBy("Facturas");
    expect(header("Facturas")).toHaveAttribute("aria-sort", "none");
    sortBy("Facturas");
    expect(header("Facturas")).toHaveAttribute("aria-sort", "ascending");
    expect(rfcs()).toEqual(["AAA010101AAA", "ZZZ010101AAA", "MMM010101AAA"]);
  });

  it("sorts Categoría por defecto by category name with unassigned rows last in both directions", () => {
    load([...supplier("AAA", "Alfa", 1), ...supplier("BBB", "Beta", 1), ...supplier("CCC", "Gama", 1)]);
    seedSettings({
      supplierCategories: [
        { rfc: "AAA010101AAA", name: "Alfa", categoryId: SERVICIOS },
        { rfc: "CCC010101AAA", name: "Gama", categoryId: LIMPIEZA },
      ],
    });
    renderTable();
    sortBy("Categoría por defecto");
    // Limpieza e higiene < Servicios; Beta has no category.
    expect(rfcs()).toEqual(["CCC010101AAA", "AAA010101AAA", "BBB010101AAA"]);
    sortBy("Categoría por defecto");
    expect(header("Categoría por defecto")).toHaveAttribute("aria-sort", "descending");
    expect(rfcs()).toEqual(["AAA010101AAA", "CCC010101AAA", "BBB010101AAA"]);
  });

  it("keeps the RFC column unsortable and the table at least 900 px wide in a scrolling container", () => {
    load(supplier("AAA", "Alfa", 1));
    renderTable();
    expect(within(header("RFC")).queryByRole("button")).toBeNull();
    const table = screen.getByRole("table");
    expect(table.className).toContain("min-w-[900px]");
    expect(table.closest("[data-slot='table-container']")?.className).toContain("overflow-x-auto");
  });
});

describe("SupplierCategoryTable pagination (E2 overflow, zero-one-many)", () => {
  it("shows 50 of 51 rows with the footer and moves between pages", () => {
    load(
      Array.from({ length: 51 }, (_, index) =>
        supplier(`S${String(index).padStart(2, "0")}`, `Proveedor ${String(index).padStart(2, "0")}`, 1),
      ).flat(),
    );
    renderTable();
    expect(bodyRows()).toHaveLength(50);
    expect(screen.getByText("Mostrando 1–50 de 51")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Mostrando 51 de 51")).toBeInTheDocument();
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
  });

  it("shows no footer with 50 suppliers", () => {
    load(
      Array.from({ length: 50 }, (_, index) =>
        supplier(`S${String(index).padStart(2, "0")}`, `Proveedor ${String(index).padStart(2, "0")}`, 1),
      ).flat(),
    );
    renderTable();
    expect(bodyRows()).toHaveLength(50);
    expect(screen.queryByText(/^Mostrando/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
  });
});

describe("SupplierCategoryTable saved-only suppliers (D-03, E2 partial)", () => {
  function seedSavedOnly(): void {
    load(supplier("AAA", "Alfa", 2));
    seedSettings({
      supplierCategories: [{ rfc: "GGG010101AAA", name: "Guardado S.A.", categoryId: SERVICIOS }],
    });
  }

  it("shows the badge and the Quitar asignación button on a supplier with no loaded invoice", () => {
    seedSavedOnly();
    renderTable();
    const row = at(bodyRows(), 1);
    expect(within(row).getByText("Guardado S.A.")).toBeInTheDocument();
    expect(within(row).getByText("Sin facturas cargadas")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Quitar asignación" })).toBeInTheDocument();
    expect(within(row).getByRole("combobox")).toHaveTextContent(
      "Servicios (luz, agua, internet, teléfono)",
    );
    // A loaded row has neither.
    const loadedRow = at(bodyRows(), 0);
    expect(within(loadedRow).queryByText("Sin facturas cargadas")).toBeNull();
    expect(within(loadedRow).queryByRole("button", { name: "Quitar asignación" })).toBeNull();
  });

  it("removes the assignment at once and the toast Deshacer puts it back", () => {
    seedSavedOnly();
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Quitar asignación" }));
    expect(rfcs()).toEqual(["AAA010101AAA"]);
    expect(useSettingsStore.getState().supplierCategories).toEqual([]);
    expect(toastMock).toHaveBeenCalledTimes(1);
    const [message, options] = toastMock.mock.calls[0] ?? [];
    expect(message).toBe("Asignación quitada");
    expect(options?.duration).toBe(6000);
    expect(options?.action?.label).toBe("Deshacer");
    act(() => {
      toastAction("Asignación quitada")();
    });
    expect(rfcs()).toEqual(["AAA010101AAA", "GGG010101AAA"]);
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: "GGG010101AAA", name: "Guardado S.A.", categoryId: SERVICIOS },
    ]);
  });

  it("shows the name the supplier had when it was last assigned once its invoices are gone", () => {
    load(supplier("AAA", "Nombre viejo", 1));
    renderTable();
    choose("Nombre viejo", "Limpieza e higiene");
    act(() => {
      useSessionStore.getState().clearAll();
    });
    load(supplier("AAA", "Nombre nuevo", 1));
    choose("Nombre nuevo", "Servicios (luz, agua, internet, teléfono)");
    act(() => {
      useSessionStore.getState().clearAll();
    });
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: "AAA010101AAA", name: "Nombre nuevo", categoryId: SERVICIOS },
    ]);
    expect(screen.getByText("Nombre nuevo")).toBeInTheDocument();
    expect(screen.getByText("Sin facturas cargadas")).toBeInTheDocument();
  });
});

describe("SupplierCategoryTable Select (E2 empty, long-text)", () => {
  it("reads Sin categoría for an unassigned supplier", () => {
    load(supplier("AAA", "Alfa", 1));
    renderTable();
    expect(supplierSelect("Alfa")).toHaveTextContent("Sin categoría");
  });

  it("applies a chosen category at once with no toast", () => {
    load(supplier("AAA", "Alfa", 1));
    renderTable();
    choose("Alfa", "Limpieza e higiene");
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: "AAA010101AAA", name: "Alfa", categoryId: LIMPIEZA },
    ]);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("removes the assignment of a loaded supplier with Sin categoría and no toast", () => {
    load(supplier("AAA", "Alfa", 1));
    seedSettings({
      supplierCategories: [{ rfc: "AAA010101AAA", name: "Alfa", categoryId: LIMPIEZA }],
    });
    renderTable();
    choose("Alfa", "Sin categoría");
    expect(useSettingsStore.getState().supplierCategories).toEqual([]);
    expect(rfcs()).toEqual(["AAA010101AAA"]);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("refuses the 5,001st supplier with a toast and stores nothing", () => {
    load(supplier("AAA", "Alfa", 1));
    seedSettings({
      supplierCategories: Array.from({ length: 5000 }, (_, index) => ({
        rfc: `RFC${String(index)}`,
        name: `Proveedor ${String(index)}`,
        categoryId: LIMPIEZA,
      })),
    });
    renderTable();
    choose("Alfa", "Servicios (luz, agua, internet, teléfono)");
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0]?.[0]).toBe("Llegaste al máximo de 5,000 proveedores con categoría.");
    expect(useSettingsStore.getState().supplierCategories).toHaveLength(5000);
    expect(supplierSelect("Alfa")).toHaveTextContent("Sin categoría");
  });

  it("renders a hostile supplier name as text, never as markup", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    load(supplier("HOS", hostile, 1));
    renderTable();
    expect(screen.getAllByText(hostile).length).toBeGreaterThan(0);
    expect(document.querySelector("img")).toBeNull();
  });
});
