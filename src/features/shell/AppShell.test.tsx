// @vitest-environment jsdom
import { StrictMode } from "react";
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
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { defaultSettings } from "@/domain/settings/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { AppShell } from "./AppShell";

const toastMock = vi.hoisted(() => vi.fn<(message: string) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const READ_FAILED_TOAST =
  "No se pudieron leer tus ajustes guardados y se usaron los valores iniciales. Si tienes un archivo de respaldo, súbelo.";

/** An Ingreso whose folio is its uuid, so every reference in the UI is easy to find. */
function inv(uuid: string, overrides: Partial<ParsedInvoice> = {}): ParsedInvoice {
  return makeInvoice({ uuid, folio: uuid, ...overrides });
}

function seed(invoices: readonly ParsedInvoice[]): void {
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

/** A $0 invoice: one incident row of the type "Facturas en $0". */
function zero(uuid: string): ParsedInvoice {
  return inv(uuid, { total: "0.00", subTotal: "0.00", totalImpuestosTrasladados: null });
}

function qualityTab(): HTMLElement {
  return screen.getByRole("tab", { name: /^Calidad de datos/ });
}

beforeEach(() => {
  toastMock.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  act(() => {
    useSessionStore.getState().clearAll();
  });
  resetSettingsStore();
});

describe("AppShell tabs (D-01, D-04)", () => {
  it("lists Dashboard, Categorías, Productos, Calidad de datos and Importación in that order", () => {
    seed([inv("OK-1")]);
    render(<AppShell />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Dashboard",
      "Categorías",
      "Productos",
      "Calidad de datos",
      "Importación",
    ]);
  });

  it("opens the Productos panel when its tab is clicked", () => {
    seed([inv("OK-1")]);
    render(<AppShell />);
    expect(screen.queryByRole("heading", { name: "Productos" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Productos" }));
    expect(useSessionStore.getState().activeTab).toBe("productos");
    expect(screen.getByRole("heading", { name: "Productos" })).toBeInTheDocument();
  });

  it("states in the footer that descriptions and supplier names go to DeepSeek only on request (OQ1)", () => {
    seed([inv("OK-1")]);
    render(<AppShell />);
    expect(
      screen.getByText(
        "Tus facturas se procesan en este navegador. Solo si lo pides, se envían a DeepSeek descripciones de conceptos y nombres de proveedor (nunca RFC, UUID ni montos).",
      ),
    ).toBeInTheDocument();
  });

  it("shows no tabs on the empty screen", () => {
    render(<AppShell />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("opens the Categorías panel when its tab is clicked", () => {
    seed([inv("OK-1")]);
    render(<AppShell />);
    expect(screen.queryByRole("heading", { name: "Categoría por proveedor" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Categorías" }));
    expect(useSessionStore.getState().activeTab).toBe("categorias");
    expect(screen.getByRole("heading", { name: "Categoría por proveedor" })).toBeInTheDocument();
  });

  it("shows no counter and the plain name when there is no incident", () => {
    seed([inv("OK-1"), inv("OK-2")]);
    render(<AppShell />);
    const tab = qualityTab();
    expect(tab.textContent).toBe("Calidad de datos");
    expect(tab).toHaveAccessibleName("Calidad de datos");
  });

  it("shows ' · 5' and 'Calidad de datos, 5 incidencias' with five incident rows", () => {
    seed([zero("Z-1"), zero("Z-2"), zero("Z-3"), zero("Z-4"), zero("Z-5")]);
    render(<AppShell />);
    const tab = qualityTab();
    expect(tab.textContent).toBe("Calidad de datos · 5");
    expect(tab).toHaveAccessibleName("Calidad de datos, 5 incidencias");
  });

  it("uses the singular for one incident row", () => {
    seed([inv("OK-1"), zero("Z-1")]);
    render(<AppShell />);
    const tab = qualityTab();
    expect(tab.textContent).toBe("Calidad de datos · 1");
    expect(tab).toHaveAccessibleName("Calidad de datos, 1 incidencia");
  });

  it("counts the informational several-related credit note (D-46)", () => {
    seed([
      inv("REL-MAY", { fecha: "2025-05-20T10:00:00" }),
      inv("REL-JUL", { fecha: "2025-07-10T10:00:00" }),
      inv("NC-2", {
        tipo: "E",
        fecha: "2025-08-02T10:00:00",
        relacionados: [{ tipoRelacion: "01", uuids: ["REL-MAY", "REL-JUL"] }],
      }),
    ]);
    render(<AppShell />);
    const tab = qualityTab();
    expect(tab.textContent).toBe("Calidad de datos · 1");
    expect(tab).toHaveAccessibleName("Calidad de datos, 1 incidencia");
  });

  it("updates the counter when an exclusion adds an incident row", () => {
    seed([inv("OK-1"), inv("OK-2")]);
    render(<AppShell />);
    expect(qualityTab().textContent).toBe("Calidad de datos");
    act(() => {
      useSessionStore.getState().excludeInvoice("OK-2");
    });
    expect(qualityTab().textContent).toBe("Calidad de datos · 1");
  });

  it("opens the Calidad de datos panel when its tab is clicked", () => {
    seed([inv("OK-1")]);
    render(<AppShell />);
    expect(screen.queryByRole("heading", { name: "Calidad de datos" })).toBeNull();
    fireEvent.click(qualityTab());
    expect(useSessionStore.getState().activeTab).toBe("calidad");
    expect(screen.getByRole("heading", { name: "Calidad de datos" })).toBeInTheDocument();
    expect(qualityTab()).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the list on one line, scrolling horizontally below 640 px (UI-SPEC Q2)", () => {
    seed([zero("Z-1")]);
    render(<AppShell />);
    const list = screen.getByRole("tablist", { name: "Secciones" });
    expect(list.className).toContain("gap-2");
    expect(list.className).toContain("max-sm:overflow-x-auto");
    expect(list.className).not.toMatch(/flex-wrap/);
    for (const tab of within(list).getAllByRole("tab")) {
      expect(tab.className).toContain("flex-none");
      expect(tab.className).toContain("px-4");
      expect(tab.className).toContain("whitespace-nowrap");
      expect(tab.className).not.toMatch(/flex-wrap|overflow-x|overflow-auto|overflow-scroll/);
    }
  });

  it("scrolls the newly active trigger into view when the tab changes", () => {
    seed([inv("OK-1")]);
    const scrollIntoView = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>();
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(scrollIntoView);
    render(<AppShell />);
    scrollIntoView.mockClear();
    const importacion = screen.getByRole("tab", { name: "Importación" });
    fireEvent.click(importacion);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ inline: "nearest", block: "nearest" });
    expect(scrollIntoView.mock.contexts).toEqual([importacion]);
    const categorias = screen.getByRole("tab", { name: "Categorías" });
    fireEvent.click(categorias);
    expect(scrollIntoView.mock.contexts).toEqual([importacion, categorias]);
  });

  it("collapses «Agregar facturas» and «Cerrar sesión» to icon-only below 1024 px (UI-SPEC Q9)", () => {
    seed([inv("OK-1")]);
    render(<AppShell />);
    for (const name of ["Agregar facturas", "Cerrar sesión"]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("max-lg:size-9");
      expect(button.className).toContain("max-lg:px-0");
      expect(button.className).toContain("max-sm:size-11");
      expect(button.className).not.toContain("max-md:");
      const label = within(button).getByText(name);
      expect(label.className).toContain("max-lg:sr-only");
    }
  });
});

describe("AppShell read-failure toast (Q8, AJUS-01)", () => {
  const KEY = "invoicechecker:settings";

  async function mountAndSettle(strict = false): Promise<void> {
    await act(async () => {
      render(strict ? <StrictMode><AppShell /></StrictMode> : <AppShell />);
      await useSettingsStore.persist.rehydrate();
    });
  }

  it("shows the toast exactly once for unreadable stored settings, even in StrictMode and after another rehydrate", async () => {
    window.localStorage.setItem(KEY, "{not json");
    await mountAndSettle(true);
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(READ_FAILED_TOAST);
    });
    await act(async () => {
      await useSettingsStore.persist.rehydrate();
    });
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("shows the toast for a stored version 2 that breaks a limit and uses the defaults", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        state: {
          ...defaultSettings(),
          categories: Array.from({ length: 201 }, (_, i) => ({ id: `c${i}`, name: `Categoría ${i}` })),
        },
      }),
    );
    await mountAndSettle();
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(READ_FAILED_TOAST);
    });
    expect(useSettingsStore.getState().categories).toEqual(defaultSettings().categories);
  });

  it("shows the toast for a stored version 1 with a tampered mode", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, state: { ivaMode: "x" } }));
    await mountAndSettle();
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(READ_FAILED_TOAST);
    });
  });

  it("shows no toast with nothing stored, a valid version 2 or a valid version 1", async () => {
    await mountAndSettle();
    cleanup();
    window.localStorage.setItem(KEY, JSON.stringify({ version: 2, state: defaultSettings() }));
    await mountAndSettle();
    cleanup();
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, state: { ivaMode: "sin" } }));
    await mountAndSettle();
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe("AppShell export button (D-19, UI-SPEC Shell and top bar)", () => {
  it("is not on the empty screen", () => {
    render(<AppShell />);
    expect(screen.queryByRole("button", { name: "Exportar a Excel" })).toBeNull();
  });

  it("is on the loaded screen on every tab", () => {
    seed([inv("OK-1")]);
    render(<AppShell />);
    for (const name of ["Dashboard", "Categorías", /^Calidad de datos/, "Importación"]) {
      fireEvent.click(screen.getByRole("tab", { name }));
      expect(screen.getByRole("button", { name: "Exportar a Excel" })).toBeInTheDocument();
    }
  });

  it("comes before «Agregar facturas» in the top bar", () => {
    seed([inv("OK-1")]);
    render(<AppShell />);
    const exportButton = screen.getByRole("button", { name: "Exportar a Excel" });
    const addButton = screen.getByRole("button", { name: "Agregar facturas" });
    expect(
      exportButton.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(exportButton.closest("header")).not.toBeNull();
  });
});
