// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { defaultSettings } from "@/domain/settings/types";
import { AppShell } from "@/features/shell/AppShell";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import {
  readStoredSettings,
  resetSettingsStore,
  storeIvaMode,
  storeSettings,
} from "../../../tests/support/settingsStorage";

const A = { rfc: "AAA010101AAA", nombre: "Proveedor A" };
const B = { rfc: "BBB010101BBB", nombre: "Proveedor B" };
const LIMPIEZA = "seed:limpieza-higiene";

function concepto(descripcion: string, importe: string, iva: string): Concepto {
  return {
    claveProdServ: "01010101",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion,
    valorUnitario: importe,
    importe,
    descuento: null,
    objetoImp: "02",
    traslados: [{ base: importe, impuesto: "002", tipoFactor: "Tasa", tasaOCuota: "0.160000", importe: iva }],
    retenciones: [],
  };
}

/**
 * Supplier A has two invoices, the first with three concepts and a one-cent gap
 * (subtotal 100.01 against 100.00 of concepts). Supplier B has one invoice.
 * Con IVA: A = 116.01 + 58.00 = 174.01, B = 116.00, total 290.01.
 * Sin IVA: A = 100.01 + 50.00 = 150.01, B = 100.00, total 250.01.
 */
function sample(): ParsedInvoice[] {
  return [
    makeInvoice({
      emisor: A,
      fecha: "2025-01-15T10:00:00",
      subTotal: "100.01",
      total: "116.01",
      conceptos: [
        concepto("Cloro", "33.33", "5.33"),
        concepto("Jabón", "33.33", "5.33"),
        concepto("Trapeador", "33.34", "5.34"),
      ],
    }),
    makeInvoice({
      emisor: A,
      fecha: "2025-02-10T10:00:00",
      subTotal: "50.00",
      total: "58.00",
      conceptos: [concepto("Cloro", "50.00", "8.00")],
    }),
    makeInvoice({ emisor: B, fecha: "2025-02-11T10:00:00" }),
  ];
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

/** Exact decimal text to integer cents without floats. */
function toCents(text: string): bigint {
  const [whole = "0", fraction = ""] = text.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

function centsToMoney(cents: bigint): string {
  const digits = cents.toString().padStart(3, "0");
  return `$${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/** Waits for the AppShell rehydrate effect to settle. */
async function renderShell(): Promise<void> {
  await act(async () => {
    render(<AppShell />);
    await useSettingsStore.persist.rehydrate();
  });
}

function openTab(name: string): void {
  fireEvent.click(screen.getByRole("tab", { name }));
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${String(index)}`);
  return item;
}

function supplierSelect(name: string): HTMLElement {
  return screen.getByRole("combobox", { name: `Categoría por defecto de ${name}` });
}

function optionTexts(): string[] {
  return screen.getAllByRole("option").map((option) => option.textContent);
}

/** Opens the Select of a supplier and returns the option texts in order. */
function openSelect(supplier: string): string[] {
  fireEvent.click(supplierSelect(supplier));
  return optionTexts();
}

function choose(supplier: string, optionText: string): void {
  openSelect(supplier);
  const option = screen.getByRole("option", { name: optionText });
  // Base UI commits a mouse selection only when the pointer went down on the item.
  fireEvent.pointerDown(option);
  fireEvent.click(option);
}

function categoryRows(): HTMLElement[] {
  const list = screen.getByRole("list", { name: "Gasto por categoría" });
  return within(list).getAllByRole("listitem");
}

function rowCents(): bigint {
  let total = BigInt(0);
  for (const row of categoryRows()) {
    const amount = within(row).getByText(/^−?\$[\d,]+\.\d{2}$/).textContent;
    const negative = amount.startsWith("−");
    const cents = toCents(amount.replace(/[−$,]/g, ""));
    total += negative ? -cents : cents;
  }
  return total;
}

function gasto(): string {
  return screen.getByTestId("kpi-gasto").textContent;
}

beforeEach(() => {
  resetSettingsStore();
});

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
  });
  resetSettingsStore();
});

describe("Categorías tab: Categoría por proveedor (CAT-02, D-01, D-03, D-04)", () => {
  it("shows the heading, the intros and one row per loaded supplier ordered by Facturas then name", async () => {
    load(sample());
    await renderShell();
    openTab("Categorías");
    expect(screen.getByRole("heading", { name: "Categorías" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Organiza tu gasto en categorías. Se guardan en este navegador; descarga tus ajustes para respaldarlos o usarlos en otro.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Categoría por proveedor" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "La categoría por defecto de cada proveedor. Para cambiar un concepto, ábrelo en la tabla de facturas del Dashboard.",
      ),
    ).toBeInTheDocument();
    const section = within(screen.getByRole("region", { name: "Categoría por proveedor" }));
    for (const header of ["Proveedor", "RFC", "Facturas", "Categoría por defecto"]) {
      expect(section.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const rows = section.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(at(rows, 0)).getByText(A.rfc)).toBeInTheDocument();
    expect(within(at(rows, 0)).getByText("2")).toBeInTheDocument();
    expect(within(at(rows, 1)).getByText(B.rfc)).toBeInTheDocument();
    expect(within(at(rows, 1)).getByText("1")).toBeInTheDocument();
    expect(supplierSelect(A.nombre)).toHaveTextContent("Sin categoría");
  });

  it("lists Sin categoría first and then the categories in Spanish order with Otros last", async () => {
    load(sample());
    await renderShell();
    openTab("Categorías");
    expect(openSelect(A.nombre)).toEqual([
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

  it("keeps the renamed Otros last in the Select", async () => {
    storeSettings({
      ...defaultSettings(),
      categories: defaultSettings().categories.map((category) =>
        category.id === "seed:otros" ? { ...category, name: "Aaa" } : category,
      ),
    });
    load(sample());
    await renderShell();
    openTab("Categorías");
    const texts = openSelect(A.nombre);
    expect(texts[0]).toBe("Sin categoría");
    expect(texts[texts.length - 1]).toBe("Aaa");
  });

  it("shows the chosen category in the Dashboard block, adding up to Gasto total", async () => {
    load(sample());
    await renderShell();
    openTab("Categorías");
    choose(A.nombre, "Limpieza e higiene");
    expect(supplierSelect(A.nombre)).toHaveTextContent("Limpieza e higiene");
    openTab("Dashboard");
    const rows = categoryRows();
    expect(rows).toHaveLength(2);
    const first = at(rows, 0);
    const second = at(rows, 1);
    expect(within(first).getByText("Limpieza e higiene")).toBeInTheDocument();
    expect(within(first).getByText("$174.01")).toBeInTheDocument();
    expect(within(second).getByText("Sin categoría")).toBeInTheDocument();
    expect(within(second).getByText("$116.00")).toBeInTheDocument();
    const expected = toCents("116.01") + toCents("58.00") + toCents("116.00");
    expect(rowCents()).toBe(expected);
    expect(gasto()).toBe(centsToMoney(expected));
  });

  it("stores version 2 with the defaults plus that one assignment and restores it after a reload", async () => {
    load(sample());
    await renderShell();
    openTab("Categorías");
    choose(A.nombre, "Limpieza e higiene");
    const expected = {
      ...defaultSettings(),
      supplierCategories: [{ rfc: A.rfc, name: A.nombre, categoryId: LIMPIEZA }],
    };
    expect(await readStoredSettings()).toEqual({ state: expected, version: 2 });

    // Reload: memory back to the defaults, the stored value written again, then rehydrated.
    act(() => {
      resetSettingsStore();
    });
    expect(supplierSelect(A.nombre)).toHaveTextContent("Sin categoría");
    storeSettings(expected);
    await act(async () => {
      await useSettingsStore.persist.rehydrate();
    });
    expect(supplierSelect(A.nombre)).toHaveTextContent("Limpieza e higiene");
  });

  it("removes the assignment when Sin categoría is chosen", async () => {
    storeSettings({
      ...defaultSettings(),
      supplierCategories: [{ rfc: A.rfc, name: A.nombre, categoryId: LIMPIEZA }],
    });
    load(sample());
    await renderShell();
    openTab("Categorías");
    expect(supplierSelect(A.nombre)).toHaveTextContent("Limpieza e higiene");
    choose(A.nombre, "Sin categoría");
    expect(supplierSelect(A.nombre)).toHaveTextContent("Sin categoría");
    expect(useSettingsStore.getState().supplierCategories).toEqual([]);
    expect(await readStoredSettings()).toEqual({ state: defaultSettings(), version: 2 });
    openTab("Dashboard");
    expect(categoryRows()).toHaveLength(1);
    expect(within(at(categoryRows(), 0)).getByText("$290.01")).toBeInTheDocument();
  });

  it("keeps a supplier's category after the category is renamed (stable ids, D-04)", async () => {
    storeSettings({
      ...defaultSettings(),
      categories: defaultSettings().categories.map((category) =>
        category.id === LIMPIEZA ? { ...category, name: "Aseo" } : category,
      ),
      supplierCategories: [{ rfc: A.rfc, name: A.nombre, categoryId: LIMPIEZA }],
    });
    load(sample());
    await renderShell();
    openTab("Categorías");
    expect(supplierSelect(A.nombre)).toHaveTextContent("Aseo");
    openTab("Dashboard");
    expect(within(at(categoryRows(), 0)).getByText("Aseo")).toBeInTheDocument();
  });

  it("opens a Phase 2 browser with Sin IVA and offers the nine categories", async () => {
    storeIvaMode("sin");
    load(sample());
    await renderShell();
    expect(gasto()).toBe(centsToMoney(toCents("100.01") + toCents("50.00") + toCents("100.00")));
    openTab("Categorías");
    const texts = openSelect(B.nombre);
    // Sin categoría plus the nine suggestions.
    expect(texts).toHaveLength(10);
    expect(useSettingsStore.getState().ivaMode).toBe("sin");
  });

  it("renders a hostile supplier name as text, never as markup", async () => {
    const hostile = "<img src=x onerror=alert(1)>";
    load([makeInvoice({ emisor: { rfc: "HOS010101HOS", nombre: hostile } })]);
    await renderShell();
    openTab("Categorías");
    expect(screen.getAllByText(hostile).length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: `Categoría por defecto de ${hostile}` })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("Categorías tab: write-failure Alert (Q8, AJUS-01)", () => {
  const WRITE_FAILED =
    "Este navegador no permite guardar tus ajustes. Los cambios se perderán al cerrar la página; descarga tus ajustes para no perderlos.";

  function writeAlert(): HTMLElement | null {
    return screen.queryByText(WRITE_FAILED)?.closest<HTMLElement>("[data-slot='alert']") ?? null;
  }

  it("shows no Alert while writes work", async () => {
    load(sample());
    await renderShell();
    openTab("Categorías");
    choose(A.nombre, "Limpieza e higiene");
    expect(screen.queryByText(WRITE_FAILED)).toBeNull();
  });

  it("shows a non-dismissible Alert when the write fails, keeps the change in memory and removes it after a later write", async () => {
    load(sample());
    await renderShell();
    openTab("Categorías");
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    choose(A.nombre, "Limpieza e higiene");
    const alert = writeAlert();
    expect(alert).not.toBeNull();
    expect(alert?.querySelector("svg")).not.toBeNull();
    expect(alert ? within(alert).queryByRole("button") : null).toBeNull();
    // The change keeps working for the session.
    expect(supplierSelect(A.nombre)).toHaveTextContent("Limpieza e higiene");
    blocked.mockRestore();
    choose(A.nombre, "Servicios (luz, agua, internet, teléfono)");
    expect(writeAlert()).toBeNull();
  });
});
