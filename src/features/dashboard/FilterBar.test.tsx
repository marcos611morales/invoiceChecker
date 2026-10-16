// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { isDefaultFilters, loadedSpan } from "@/domain/accounting/filters";
import { EMPTY_OVERRIDES, PPD_SIN_COMPLEMENTO, buildLedger } from "@/domain/accounting/ledger";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { useSessionStore } from "@/stores/sessionStore";
import { loaded, makeInvoice, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { FilterBar } from "./FilterBar";

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
  });
});

const ABARROTES = { rfc: "AAA010101AAA", nombre: "Abarrotes del Sur" };
const CAFE = { rfc: "BBB010101BBB", nombre: "Café Árbol" };
const ZETA = { rfc: "CCC010101CCC", nombre: "Zeta Comercial" };

function sample(): ParsedInvoice[] {
  return [
    makeInvoice({ emisor: ABARROTES, fecha: "2025-01-15T10:00:00", formaPago: "03" }),
    makeInvoice({ emisor: ABARROTES, fecha: "2025-03-02T10:00:00", formaPago: "03" }),
    makeInvoice({ emisor: CAFE, fecha: "2025-02-10T10:00:00", formaPago: "28" }),
    makeInvoice({
      emisor: ZETA,
      fecha: "2025-04-20T10:00:00",
      formaPago: "99",
      metodoPago: "PPD",
    }),
  ];
}

function renderBar(invoices: readonly ParsedInvoice[] = sample()) {
  const ledger = buildLedger(invoices.map(loaded), EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
  return render(<FilterBar ledger={ledger} span={loadedSpan(ledger)} />);
}

const desktop = () => within(screen.getByTestId("filter-triggers-desktop"));
const fold = () => within(screen.getByTestId("filter-fold"));
const chips = () => within(screen.getByTestId("filter-chips"));

function filters() {
  return useSessionStore.getState().filters;
}

function set(update: () => void): void {
  act(update);
}

function rowTexts(): string[] {
  return screen.getAllByRole("option").map((row) => row.textContent ?? "");
}

describe("FilterBar triggers", () => {
  it("shows Fechas, Proveedor and Forma de pago in the desktop row", () => {
    renderBar();
    expect(desktop().getByRole("button", { name: /^Fechas:/ })).toBeInTheDocument();
    expect(desktop().getByRole("button", { name: "Proveedor" })).toBeInTheDocument();
    expect(desktop().getByRole("button", { name: "Forma de pago" })).toBeInTheDocument();
  });

  it("omits Fechas when no invoice has a month", () => {
    render(<FilterBar ledger={[]} span={null} />);
    expect(desktop().queryByRole("button", { name: /^Fechas/ })).toBeNull();
    expect(desktop().getByRole("button", { name: "Proveedor" })).toBeInTheDocument();
  });

  it("shows no chip and no reset button while the filters are the default", () => {
    renderBar();
    expect(chips().queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
  });

  it("announces its chips politely", () => {
    renderBar();
    expect(screen.getByTestId("filter-chips")).toHaveAttribute("aria-live", "polite");
  });
});

describe("FilterBar option lists", () => {
  it("lists suppliers as '{nombre} ({n})' by count then Spanish name", () => {
    renderBar();
    fireEvent.click(desktop().getByRole("button", { name: "Proveedor" }));
    expect(rowTexts()).toEqual([
      "Abarrotes del Sur (2)",
      "Café Árbol (1)",
      "Zeta Comercial (1)",
    ]);
  });

  it("identifies suppliers by RFC, so two suppliers with one name stay apart", () => {
    const twin = { rfc: "DDD010101DDD", nombre: "Café Árbol" };
    renderBar([...sample(), makeInvoice({ emisor: twin, fecha: "2025-05-01T10:00:00" })]);
    fireEvent.click(desktop().getByRole("button", { name: "Proveedor" }));
    const rows = screen.getAllByRole("option");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Abarrotes del Sur (2)",
      "Café Árbol (1)",
      "Café Árbol (1)",
      "Zeta Comercial (1)",
    ]);
    const second = rows[2];
    expect(second).toBeDefined();
    if (second === undefined) return;
    set(() => fireEvent.click(second));
    // Same label, same count: the tie breaks on the RFC, so the second row is DDD.
    expect([...filters().suppliers]).toEqual(["DDD010101DDD"]);
  });

  it("shows SAT catalog names for formas, never a bare code", () => {
    renderBar();
    fireEvent.click(desktop().getByRole("button", { name: "Forma de pago" }));
    const texts = rowTexts();
    expect(texts).toContain("Transferencia electrónica de fondos (2)");
    expect(texts).toContain("Tarjeta de débito (1)");
    for (const text of texts) {
      expect(text).not.toMatch(/^\d{2}\b/);
    }
  });

  it("lists a PPD invoice without complemento as 'Por definir (sin complemento de pago)'", () => {
    renderBar();
    fireEvent.click(desktop().getByRole("button", { name: "Forma de pago" }));
    expect(rowTexts()).toContain("Por definir (sin complemento de pago) (1)");
    set(() => fireEvent.click(screen.getByText("Por definir (sin complemento de pago)")));
    expect([...filters().formas]).toEqual([PPD_SIN_COMPLEMENTO]);
  });

  it("shows an unknown code as 'Forma de pago {código}'", () => {
    renderBar([makeInvoice({ formaPago: "77", fecha: "2025-01-15T10:00:00" })]);
    fireEvent.click(desktop().getByRole("button", { name: "Forma de pago" }));
    expect(rowTexts()).toEqual(["Forma de pago 77 (1)"]);
  });

  it("renders a hostile supplier name as text in options and chips", () => {
    const hostile = { rfc: "EVIL010101AAA", nombre: '<img src=x onerror="alert(1)">' };
    renderBar([makeInvoice({ emisor: hostile, fecha: "2025-01-15T10:00:00" })]);
    fireEvent.click(desktop().getByRole("button", { name: "Proveedor" }));
    set(() => fireEvent.click(screen.getByRole("option")));
    expect(document.querySelector("img")).toBeNull();
    expect(chips().getByText(`Proveedor: ${hostile.nombre}`)).toBeInTheDocument();
  });
});

describe("FilterBar chips", () => {
  it("adds the chip 'Proveedor: {nombre}' when one supplier is chosen", () => {
    renderBar();
    fireEvent.click(desktop().getByRole("button", { name: "Proveedor" }));
    set(() => fireEvent.click(screen.getByText("Abarrotes del Sur")));
    expect([...filters().suppliers]).toEqual([ABARROTES.rfc]);
    expect(chips().getByText("Proveedor: Abarrotes del Sur")).toBeInTheDocument();
  });

  it("summarizes several suppliers as 'Proveedor: {n1}, {n2} +{k}'", () => {
    renderBar();
    set(() =>
      useSessionStore.getState().setSuppliers(new Set([ABARROTES.rfc, CAFE.rfc, ZETA.rfc])),
    );
    expect(chips().getByText("Proveedor: Abarrotes del Sur, Café Árbol +1")).toBeInTheDocument();
  });

  it("summarizes formas as 'Forma de pago: {n1} +{k}'", () => {
    renderBar();
    set(() => useSessionStore.getState().setFormas(new Set(["03", "28"])));
    expect(
      chips().getByText("Forma de pago: Transferencia electrónica de fondos +1"),
    ).toBeInTheDocument();
  });

  it("shows the Fechas chip only when the stored range is not null", () => {
    renderBar();
    expect(chips().queryByText(/^Fechas:/)).toBeNull();
    set(() => useSessionStore.getState().setRange({ from: "2025-02", to: "2025-03" }));
    expect(chips().getByText("Fechas: feb 2025 – mar 2025")).toBeInTheDocument();
  });

  it("removes only its own dimension with the 'Quitar filtro {dimensión}' button", () => {
    renderBar();
    set(() => {
      const store = useSessionStore.getState();
      store.setRange({ from: "2025-02", to: "2025-03" });
      store.setSuppliers(new Set([ABARROTES.rfc]));
      store.setFormas(new Set(["03"]));
    });
    set(() => fireEvent.click(chips().getByRole("button", { name: "Quitar filtro Proveedor" })));
    expect(filters().suppliers.size).toBe(0);
    expect(filters().range).toEqual({ from: "2025-02", to: "2025-03" });
    expect([...filters().formas]).toEqual(["03"]);

    set(() => fireEvent.click(chips().getByRole("button", { name: "Quitar filtro Fechas" })));
    expect(filters().range).toBeNull();
    expect([...filters().formas]).toEqual(["03"]);

    set(() =>
      fireEvent.click(chips().getByRole("button", { name: "Quitar filtro Forma de pago" })),
    );
    expect(isDefaultFilters(filters())).toBe(true);
  });
});

describe("FilterBar reset", () => {
  it("appears when some filter differs from the default and restores them all", () => {
    renderBar();
    set(() => useSessionStore.getState().setSuppliers(new Set([CAFE.rfc])));
    const reset = screen.getByRole("button", { name: "Quitar filtros" });
    set(() => fireEvent.click(reset));
    expect(isDefaultFilters(filters())).toBe(true);
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
  });
});

describe("FilterBar mobile fold", () => {
  it("shows one 'Filtros' button with no triggers until it is opened", () => {
    renderBar();
    const button = fold().getByRole("button", { name: "Filtros" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(fold().queryByRole("button", { name: "Proveedor" })).toBeNull();
    fireEvent.click(button);
    expect(fold().getByRole("button", { name: "Proveedor" })).toBeInTheDocument();
    expect(fold().getByRole("button", { name: "Forma de pago" })).toBeInTheDocument();
    expect(fold().getByRole("button", { name: /^Fechas:/ })).toBeInTheDocument();
  });

  it("counts the active dimensions: 'Filtros · n'", () => {
    renderBar();
    set(() => useSessionStore.getState().setSuppliers(new Set([CAFE.rfc, ZETA.rfc])));
    expect(fold().getByRole("button", { name: "Filtros · 1" })).toBeInTheDocument();
    set(() => {
      const store = useSessionStore.getState();
      store.setRange({ from: "2025-02", to: "2025-03" });
      store.setFormas(new Set(["03"]));
    });
    expect(fold().getByRole("button", { name: "Filtros · 3" })).toBeInTheDocument();
  });

  it("keeps the chips visible while the fold is closed", () => {
    renderBar();
    set(() => useSessionStore.getState().setSuppliers(new Set([CAFE.rfc])));
    expect(fold().queryByRole("button", { name: "Proveedor" })).toBeNull();
    expect(chips().getByText("Proveedor: Café Árbol")).toBeInTheDocument();
  });

  it("hides the desktop row and the fold with classes, never both at one width", () => {
    renderBar();
    expect(screen.getByTestId("filter-triggers-desktop").className).toContain("max-sm:hidden");
    expect(screen.getByTestId("filter-fold").className).toContain("sm:hidden");
  });

  it("gives the fold button a 44 px height", () => {
    renderBar();
    const button = fold().getByRole("button", { name: "Filtros" });
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("w-full");
  });
});
