// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { useSessionStore } from "@/stores/sessionStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { AppShell } from "./AppShell";

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    useSessionStore.getState().clearAll();
  });
  resetSettingsStore();
});

describe("AppShell tabs (D-01, D-04)", () => {
  it("lists Dashboard, Categorías, Calidad de datos and Importación in that order", () => {
    seed([inv("OK-1")]);
    render(<AppShell />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Dashboard",
      "Categorías",
      "Calidad de datos",
      "Importación",
    ]);
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
});
