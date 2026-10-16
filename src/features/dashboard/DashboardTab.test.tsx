// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { AppShell } from "@/features/shell/AppShell";
import { shortUuid } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { DashboardTab } from "./DashboardTab";
import { useLedger } from "./useLedger";
import { readFixture } from "../../../tests/support/cfdiVariants";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import {
  clearStoredSettings,
  readStoredSettings,
  storeIvaMode,
} from "../../../tests/support/settingsStorage";

function parseFixture(relPath: string): ParsedInvoice {
  const result = parseCfdi(readFixture(relPath));
  if (!result.ok) {
    throw new Error(`fixture ${relPath} did not parse: ${result.reason}`);
  }
  return result.invoice;
}

const ingreso = parseFixture("anon/anon-ingreso-descuento.xml");
const egreso = parseFixture("anon/anon-egreso.xml");
const pago = parseFixture("anon/anon-pago.xml");

function load(invoices: readonly ParsedInvoice[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      invoices.map((invoice, index) => ({
        kind: "parsed" as const,
        file: { name: `f${index}.xml`, path: `f${index}.xml` },
        result: { ok: true as const, invoice },
      })),
      store.generation,
    );
  });
}

/** Exact XML decimal to integer cents, with no float and no big.js involved. */
function toCents(text: string): bigint {
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  return negative ? -cents : cents;
}

/** "34598" cents to "345.98" (no thousands separators needed below 1,000). */
function centsToPlain(cents: bigint): string {
  const digits = cents.toString().padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function gastoText(): string {
  return screen.getByTestId("kpi-gasto").textContent;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    useSessionStore.getState().clearAll();
    useSettingsStore.setState({ ivaMode: "con" });
  });
  clearStoredSettings();
});

/** Sin IVA of the anonymized Ingreso: Subtotal minus Descuento, no IEPS in the fixture. */
const ingresoSinCents = toCents(ingreso.subTotal) - toCents(ingreso.descuento ?? "0");
/** Sin IVA of the anonymized Egreso: its Subtotal (no Descuento, no IEPS). */
const egresoSinCents = toCents(egreso.subTotal) - toCents(egreso.descuento ?? "0");

function ivaButton(name: "Con IVA" | "Sin IVA"): HTMLElement {
  return within(screen.getByTestId("iva-toggle-bar")).getByRole("button", { name });
}

describe("Dashboard tab: Gasto total (REGLA-01, REGLA-04, DASH-10)", () => {
  it("fixtures carry the expected types and totals", () => {
    expect(ingreso.tipo).toBe("I");
    expect(ingreso.total).toBe("1345.98");
    expect(egreso.tipo).toBe("E");
    expect(egreso.total).toBe("1000");
    expect(pago.tipo).toBe("P");
    expect(pago.total).toBe("0");
  });

  it("selects the Dashboard tab and sums Ingreso minus Egreso, ignoring the Pago", () => {
    load([ingreso, egreso, pago]);
    render(<AppShell />);
    expect(screen.getByRole("tab", { name: "Dashboard" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Gasto total")).toBeInTheDocument();
    // Independent of big.js: integer cents read straight from the XML strings.
    const expectedCents = toCents(ingreso.total) - toCents(egreso.total);
    expect(expectedCents).toBe(BigInt(34598));
    expect(gastoText()).toBe(`$${centsToPlain(expectedCents)}`);
    expect(gastoText()).toBe("$345.98");
  });

  it("gives the same figure without the Pago, and a Pago never changes it", () => {
    load([ingreso, egreso]);
    render(<AppShell />);
    expect(gastoText()).toBe("$345.98");
    load([pago]);
    expect(gastoText()).toBe("$345.98");
  });

  it("does not throw and does not sum an invoice whose Total is not a decimal (D-35)", () => {
    const damaged: ParsedInvoice = {
      ...ingreso,
      uuid: "00000000-0000-4000-8000-00000000DEAD",
      total: "abc",
    };
    load([ingreso, egreso, damaged]);
    expect(() => render(<AppShell />)).not.toThrow();
    expect(gastoText()).toBe("$345.98");
    // The damaged invoice stays loaded.
    expect(useSessionStore.getState().invoices).toHaveLength(3);
  });

  it("does not throw on hostile numeric attributes (exponent, overlong digits)", () => {
    const exponent: ParsedInvoice = {
      ...ingreso,
      uuid: "00000000-0000-4000-8000-0000000E1999",
      total: "1e999999",
    };
    const overlong: ParsedInvoice = {
      ...ingreso,
      uuid: "00000000-0000-4000-8000-00000000FULL",
      total: "1".repeat(40),
    };
    load([ingreso, exponent, overlong]);
    expect(() => render(<AppShell />)).not.toThrow();
    expect(gastoText()).toBe("$1,345.98");
  });

  it("shows the Egreso alone as a negative amount with the true minus sign U+2212", () => {
    load([egreso]);
    render(<AppShell />);
    const text = gastoText();
    expect(text).toBe("−$1,000.00");
    expect(text.charCodeAt(0)).toBe(0x2212);
    expect(-toCents(egreso.total)).toBe(BigInt(-100000));
  });

  it("shows $0.00 (never -$0.00) when the Egreso cancels the Ingreso", () => {
    const equalEgreso: ParsedInvoice = {
      ...egreso,
      uuid: "00000000-0000-4000-8000-00000000E0E0",
      total: ingreso.total,
    };
    load([ingreso, equalEgreso]);
    render(<AppShell />);
    expect(gastoText()).toBe("$0.00");
  });

  it("keeps the Phase 1 import report in the Importación tab", () => {
    load([ingreso, egreso, pago]);
    render(<AppShell />);
    expect(screen.queryByText("Reporte de importación")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Importación" }));
    expect(screen.getByText("Reporte de importación")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Importación" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("does not render the Phase 1 invoices table in the shell (D-02)", () => {
    load([ingreso, egreso, pago]);
    render(<AppShell />);
    expect(screen.queryByText("Facturas cargadas")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Importación" }));
    expect(screen.queryByText("Facturas cargadas")).toBeNull();
  });
});

describe("Dashboard tab: Gasto total follows the IVA mode (REGLA-03, DASH-10)", () => {
  it("reads Sin IVA as Ingreso minus Egreso from Subtotal minus Descuento", () => {
    expect(ingresoSinCents).toBe(BigInt(129081));
    expect(egresoSinCents).toBe(BigInt(86207));
    expect(ingresoSinCents - egresoSinCents).toBe(BigInt(42874));
  });

  it("starts in Con IVA and switching the control changes the card at once", () => {
    load([ingreso, egreso, pago]);
    render(<AppShell />);
    expect(gastoText()).toBe("$345.98");
    expect(ivaButton("Con IVA")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(ivaButton("Sin IVA"));
    expect(gastoText()).toBe(`$${centsToPlain(ingresoSinCents - egresoSinCents)}`);
    expect(gastoText()).toBe("$428.74");
    expect(ivaButton("Sin IVA")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(ivaButton("Con IVA"));
    expect(gastoText()).toBe("$345.98");
  });

  it("shows the stored Sin IVA figure after a reload", () => {
    storeIvaMode("sin");
    load([ingreso, egreso]);
    render(<AppShell />);
    expect(gastoText()).toBe("$428.74");
    expect(ivaButton("Sin IVA")).toHaveAttribute("aria-pressed", "true");
  });

  it("persists the chosen mode through the settings store", async () => {
    load([ingreso, egreso]);
    render(<AppShell />);
    fireEvent.click(ivaButton("Sin IVA"));
    expect(await readStoredSettings()).toEqual({
      state: { ivaMode: "sin" },
      version: 1,
    });
  });
});

describe("Dashboard tab: Gasto total follows the exclusions (REGLA-08)", () => {
  it("removes an excluded Ingreso from the total and brings it back when reincluded", () => {
    load([ingreso, egreso]);
    render(<AppShell />);
    expect(gastoText()).toBe("$345.98");

    act(() => {
      useSessionStore.getState().excludeInvoice(ingreso.uuid);
    });
    expect(gastoText()).toBe("−$1,000.00");

    act(() => {
      useSessionStore.getState().reincludeInvoice(ingreso.uuid, { overrideSubstitution: false });
    });
    expect(gastoText()).toBe("$345.98");
  });

  it("applies the exclusion in Sin IVA as well", () => {
    load([ingreso, egreso]);
    render(<AppShell />);
    fireEvent.click(ivaButton("Sin IVA"));
    act(() => {
      useSessionStore.getState().excludeInvoice(ingreso.uuid);
    });
    expect(gastoText()).toBe("−$862.07");
  });
});

describe("AppShell: shell wiring (D-01, D-05, UI Considerations E1 and E2)", () => {
  it("rehydrates the settings store once on mount and not on re-render", () => {
    const rehydrate = vi.spyOn(useSettingsStore.persist, "rehydrate");
    load([ingreso, egreso]);
    const view = render(<AppShell />);
    expect(rehydrate).toHaveBeenCalledTimes(1);
    view.rerender(<AppShell />);
    fireEvent.click(ivaButton("Sin IVA"));
    expect(rehydrate).toHaveBeenCalledTimes(1);
  });

  it("shows the IVA control (both variants) only on the loaded screen", () => {
    render(<AppShell />);
    expect(screen.queryByTestId("iva-toggle-bar")).toBeNull();
    expect(screen.queryByTestId("iva-toggle-subbar")).toBeNull();
    cleanup();

    load([ingreso, egreso]);
    render(<AppShell />);
    expect(screen.getByTestId("iva-toggle-bar")).toBeInTheDocument();
    expect(screen.getByTestId("iva-toggle-subbar")).toBeInTheDocument();
  });

  it("renders the tabs controlled by the store's activeTab", () => {
    load([ingreso, egreso]);
    act(() => {
      useSessionStore.getState().setActiveTab("importacion");
    });
    render(<AppShell />);
    expect(screen.getByRole("tab", { name: "Importación" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Reporte de importación")).toBeInTheDocument();

    act(() => {
      useSessionStore.getState().setActiveTab("dashboard");
    });
    expect(screen.getByRole("tab", { name: "Dashboard" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("writes a clicked tab to the store", () => {
    load([ingreso, egreso]);
    render(<AppShell />);
    fireEvent.click(screen.getByRole("tab", { name: "Importación" }));
    expect(useSessionStore.getState().activeTab).toBe("importacion");
    fireEvent.click(screen.getByRole("tab", { name: "Dashboard" }));
    expect(useSessionStore.getState().activeTab).toBe("dashboard");
  });

  it("lists Dashboard, Calidad de datos (with the credit note without related as 1 incident) and Importación", () => {
    load([ingreso, egreso]);
    render(<AppShell />);
    const names = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(names).toEqual(["Dashboard", "Calidad de datos · 1", "Importación"]);
  });

  it("styles the tab list per UI-SPEC: 40 px list, 44 px touch height, 16 px padding, primary underline", () => {
    load([ingreso, egreso]);
    render(<AppShell />);
    const list = screen.getByRole("tablist");
    expect(list.className).toContain("h-10");
    expect(list.className).toContain("max-sm:group-data-horizontal/tabs:h-11");
    const trigger = screen.getByRole("tab", { name: "Dashboard" });
    expect(trigger.className).toContain("px-4");
    expect(trigger.className).toContain("font-semibold");
    expect(trigger.className).toContain("after:bg-primary");
    expect(trigger.className).toContain("max-sm:group-data-horizontal/tabs:h-11");
  });

  it("collapses 'Agregar facturas' to icon-only below 768 px and keeps its aria-label", () => {
    load([ingreso, egreso]);
    render(<AppShell />);
    const button = screen.getByRole("button", { name: "Agregar facturas" });
    expect(button.className).toContain("max-md:size-9");
    expect(button.className).toContain("max-sm:size-11");
    const label = within(button).getByText("Agregar facturas");
    expect(label.className).toContain("max-md:sr-only");
    expect(label.className).not.toContain("max-sm:sr-only");
  });
});

describe("Dashboard tab: filters (FILT-02, FILT-04, FILT-05, D-03, D-07)", () => {
  const ABARROTES = { rfc: "AAA010101AAA", nombre: "Abarrotes del Sur" };
  const CAFE = { rfc: "BBB010101BBB", nombre: "Café Árbol" };
  const ZETA = { rfc: "CCC010101CCC", nombre: "Zeta Comercial" };

  function filterable(): ParsedInvoice[] {
    return [
      makeInvoice({
        emisor: ABARROTES,
        fecha: "2025-01-15T10:00:00",
        formaPago: "03",
        subTotal: "100.00",
        total: "116.00",
      }),
      makeInvoice({
        emisor: ABARROTES,
        fecha: "2025-03-02T10:00:00",
        formaPago: "03",
        subTotal: "200.00",
        total: "232.00",
      }),
      makeInvoice({
        emisor: CAFE,
        fecha: "2025-02-10T10:00:00",
        formaPago: "28",
        subTotal: "50.00",
        total: "58.00",
      }),
      makeInvoice({
        emisor: ZETA,
        fecha: "2025-04-20T10:00:00",
        formaPago: "99",
        metodoPago: "PPD",
        subTotal: "400.00",
        total: "464.00",
      }),
    ];
  }

  const bar = () => within(screen.getByTestId("filter-triggers-desktop"));

  function pickSupplier(name: string): void {
    fireEvent.click(bar().getByRole("button", { name: "Proveedor" }));
    act(() => {
      // Scoped to the open list: the ranking card also prints the supplier name.
      fireEvent.click(within(screen.getByRole("listbox")).getByText(name));
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Buscar proveedor"), { key: "Escape" });
  }

  it("shows 'Ninguna factura válida' and no filter bar when nothing is loaded", () => {
    render(<DashboardTab />);
    expect(screen.getByText("Ninguna factura válida")).toBeInTheDocument();
    expect(
      screen.getByText("Revisa los archivos rechazados en Importación y vuelve a soltarlos."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("filter-bar")).toBeNull();
    expect(screen.queryByTestId("kpi-gasto")).toBeNull();
  });

  it("orders the filter bar, the mode caption and the KPIs as in D-03", () => {
    load(filterable());
    render(<DashboardTab />);
    const filterBar = screen.getByTestId("filter-bar");
    const caption = screen.getByTestId("mode-caption");
    const kpi = screen.getByTestId("kpi-gasto");
    expect(filterBar.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(caption.compareDocumentPosition(kpi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(gastoText()).toBe("$870.00");
  });

  it("shows the Con IVA caption and the Sin IVA caption when the mode changes", () => {
    load(filterable());
    render(<DashboardTab />);
    expect(screen.getByTestId("mode-caption")).toHaveTextContent(
      "Montos con IVA (Total de cada factura)",
    );
    act(() => {
      useSettingsStore.setState({ ivaMode: "sin" });
    });
    expect(screen.getByTestId("mode-caption")).toHaveTextContent(
      "Montos sin IVA (Subtotal − Descuento + IEPS)",
    );
    expect(gastoText()).toBe("$750.00");
  });

  it("narrows the Gasto total to one supplier and brings it back with the chip's X", () => {
    load(filterable());
    render(<DashboardTab />);
    pickSupplier("Café Árbol");
    expect(gastoText()).toBe("$58.00");
    const chips = within(screen.getByTestId("filter-chips"));
    expect(chips.getByText("Proveedor: Café Árbol")).toBeInTheDocument();
    act(() => {
      fireEvent.click(chips.getByRole("button", { name: "Quitar filtro Proveedor" }));
    });
    expect(gastoText()).toBe("$870.00");
  });

  it("combines supplier and dates with AND", () => {
    load(filterable());
    render(<DashboardTab />);
    act(() => {
      const store = useSessionStore.getState();
      store.setSuppliers(new Set([ABARROTES.rfc]));
      store.setRange({ from: "2025-03", to: "2025-04" });
    });
    expect(gastoText()).toBe("$232.00");
  });

  it("applies the supplier filter in Sin IVA as well", () => {
    load(filterable());
    render(<DashboardTab />);
    act(() => {
      useSettingsStore.setState({ ivaMode: "sin" });
      useSessionStore.getState().setSuppliers(new Set([ABARROTES.rfc]));
    });
    expect(gastoText()).toBe("$300.00");
  });

  it("keeps exactly the PPD invoice without complemento when its forma is selected", () => {
    load(filterable());
    render(<DashboardTab />);
    fireEvent.click(bar().getByRole("button", { name: "Forma de pago" }));
    act(() => {
      // The Facturas table shows the same name, so pick the filter option.
      fireEvent.click(screen.getByRole("option", { name: /^Por definir \(sin complemento de pago\)/ }));
    });
    expect(gastoText()).toBe("$464.00");
    expect(
      within(screen.getByTestId("filter-chips")).getByText(
        "Forma de pago: Por definir (sin complemento de pago)",
      ),
    ).toBeInTheDocument();
  });

  it("replaces everything below the bar by the empty state when no invoice matches", () => {
    load(filterable());
    render(<DashboardTab />);
    act(() => {
      const store = useSessionStore.getState();
      store.setSuppliers(new Set([CAFE.rfc]));
      store.setRange({ from: "2025-03", to: "2025-04" });
    });
    const empty = within(screen.getByTestId("dashboard-empty-filtered"));
    expect(empty.getByText("Ninguna factura coincide con los filtros")).toBeInTheDocument();
    expect(empty.getByText("Cambia o quita los filtros para ver el gasto.")).toBeInTheDocument();
    expect(screen.queryByTestId("kpi-gasto")).toBeNull();
    // The bar and the caption stay so the filters can be changed.
    expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
    expect(screen.getByTestId("mode-caption")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-empty-filtered").className).toContain("text-center");

    act(() => {
      fireEvent.click(empty.getByRole("button", { name: "Quitar filtros" }));
    });
    expect(screen.queryByTestId("dashboard-empty-filtered")).toBeNull();
    expect(gastoText()).toBe("$870.00");
  });

  it("keeps the filters out of the persisted settings (memory only)", async () => {
    load(filterable());
    render(<DashboardTab />);
    act(() => {
      useSettingsStore.setState({ ivaMode: "sin" });
      useSessionStore.getState().setSuppliers(new Set([ABARROTES.rfc]));
    });
    const stored = await readStoredSettings();
    expect(stored).toEqual({ state: { ivaMode: "sin" }, version: 1 });
    expect(JSON.stringify(stored)).not.toContain(ABARROTES.rfc);
  });
});

describe("Dashboard tab: KPI row (DASH-01, DASH-06, D-18, D-19, D-20, D-39)", () => {
  const PROVEEDOR_A = { rfc: "AAA010101AAA", nombre: "Abarrotes del Sur" };
  const PROVEEDOR_B = { rfc: "BBB010101BBB", nombre: "Café Árbol" };

  /** One Ingreso per listed month of 2025 (1-based month numbers). */
  function monthly(
    months: readonly number[],
    total: string,
    emisor = PROVEEDOR_A,
    overrides: Partial<ParsedInvoice> = {},
  ): ParsedInvoice[] {
    return months.map((month) =>
      makeInvoice({
        emisor,
        fecha: `2025-${String(month).padStart(2, "0")}-15T10:00:00`,
        subTotal: total,
        total,
        ...overrides,
      }),
    );
  }

  function notaCredito(amount: string, month: string): ParsedInvoice {
    return makeInvoice({
      tipo: "E",
      emisor: PROVEEDOR_A,
      fecha: `2025-${month}-20T10:00:00`,
      subTotal: amount,
      total: amount,
    });
  }

  /** Percent of two integer-cent amounts as "+12.4 %": tenths of a percent, half-up, in BigInt. */
  function expectedDelta(currentCents: bigint, previousCents: bigint): string {
    const diff = currentCents - previousCents;
    const tenths = (diff * BigInt(2000) + previousCents) / (previousCents * BigInt(2));
    const digits = tenths.toString().padStart(2, "0");
    return `+${digits.slice(0, -1)}.${digits.slice(-1)} %`;
  }

  const FIRST_HALF = [1, 2, 3, 4, 5, 6];
  const SECOND_HALF = [7, 8, 9, 10, 11, 12];
  const deltaText = (id: string) => screen.getByTestId(id).textContent;

  it("shows 'Sin datos del periodo anterior' on all four cards for the 2025 sample case", () => {
    load(monthly(FIRST_HALF, "100.00"));
    render(<DashboardTab />);
    for (const id of ["kpi-gasto-delta", "kpi-facturas-delta", "kpi-ticket-delta", "kpi-promedio-delta"]) {
      expect(screen.getByTestId(id)).toHaveTextContent("Sin datos del periodo anterior");
    }
    expect(screen.getByTestId("kpi-promedio-delta").textContent).not.toMatch(/%/);
  });

  it("shows the four cards with counts, ticket and the stated divisor of the default range", () => {
    load(monthly(FIRST_HALF, "100.00"));
    render(<DashboardTab />);
    expect(screen.getByTestId("kpi-gasto")).toHaveTextContent("$600.00");
    expect(screen.getByTestId("kpi-facturas")).toHaveTextContent("6");
    expect(screen.getByTestId("kpi-ticket")).toHaveTextContent("$100.00");
    expect(screen.getByTestId("kpi-promedio")).toHaveTextContent("$100.00");
    expect(screen.getByText("Entre 6 meses del calendario")).toBeInTheDocument();
  });

  it("divides by the calendar months of the range even when some have no invoices (DASH-06)", () => {
    load([...monthly([1], "100.00"), ...monthly([12], "100.00")]);
    render(<DashboardTab />);
    expect(screen.getByText("Entre 12 meses del calendario")).toBeInTheDocument();
    // 200.00 over 12 months = 16.666... shown as $16.67.
    expect(screen.getByTestId("kpi-promedio")).toHaveTextContent("$16.67");
  });

  it("compares against the previous period of equal length: +12.4 % vs. ene–jun 2025", () => {
    load([...monthly(FIRST_HALF, "100.00"), ...monthly(SECOND_HALF, "112.40")]);
    render(<DashboardTab />);
    act(() => {
      useSessionStore.getState().setRange({ from: "2025-07", to: "2025-12" });
    });
    const current = BigInt(6) * toCents("112.40");
    const previous = BigInt(6) * toCents("100.00");
    expect(current).toBe(BigInt(67440));
    expect(screen.getByTestId("kpi-gasto")).toHaveTextContent("$674.40");
    const expected = expectedDelta(current, previous);
    expect(expected).toBe("+12.4 %");
    expect(deltaText("kpi-gasto-delta")).toContain(`${expected} vs. ene–jun 2025`);
    expect(deltaText("kpi-gasto-delta")).toContain("subió");
    expect(deltaText("kpi-ticket-delta")).toContain("+12.4 % vs. ene–jun 2025");
    expect(deltaText("kpi-promedio-delta")).toContain("+12.4 % vs. ene–jun 2025");
    // Same number of invoices in both periods.
    expect(deltaText("kpi-facturas-delta")).toContain("0.0 % vs. ene–jun 2025");
  });

  it("applies the supplier filter to the current and the previous period alike (D-20)", () => {
    load([
      ...monthly(FIRST_HALF, "100.00", PROVEEDOR_A),
      ...monthly(SECOND_HALF, "112.40", PROVEEDOR_A),
      ...monthly(FIRST_HALF, "50.00", PROVEEDOR_B),
      ...monthly(SECOND_HALF, "50.00", PROVEEDOR_B),
    ]);
    render(<DashboardTab />);
    act(() => {
      useSessionStore.getState().setRange({ from: "2025-07", to: "2025-12" });
    });
    const allCurrent = BigInt(6) * (toCents("112.40") + toCents("50.00"));
    const allPrevious = BigInt(6) * (toCents("100.00") + toCents("50.00"));
    expect(expectedDelta(allCurrent, allPrevious)).toBe("+8.3 %");
    expect(deltaText("kpi-gasto-delta")).toContain("+8.3 % vs. ene–jun 2025");

    act(() => {
      useSessionStore.getState().setSuppliers(new Set([PROVEEDOR_A.rfc]));
    });
    expect(screen.getByTestId("kpi-gasto")).toHaveTextContent("$674.40");
    expect(deltaText("kpi-gasto-delta")).toContain("+12.4 % vs. ene–jun 2025");
  });

  it("counts only Ingreso invoices and reports credit notes apart (D-18)", () => {
    load([...monthly(FIRST_HALF, "100.00"), notaCredito("40.00", "03")]);
    render(<DashboardTab />);
    expect(screen.getByTestId("kpi-facturas")).toHaveTextContent("6");
    expect(screen.getByText("+1 nota de crédito")).toBeInTheDocument();
    // Net spend 600 - 40 = 560 over 6 invoices.
    expect(screen.getByTestId("kpi-gasto")).toHaveTextContent("$560.00");
    expect(screen.getByTestId("kpi-ticket")).toHaveTextContent("$93.33");
  });

  it("shows no credit-note sub-label when the range has none", () => {
    load(monthly(FIRST_HALF, "100.00"));
    render(<DashboardTab />);
    // The Facturas table note also names credit notes, so look inside the card.
    expect(
      within(screen.getByTestId("kpi-facturas")).queryByText(/nota de crédito|notas de crédito/),
    ).toBeNull();
  });

  it("shows a dash for the ticket when only credit notes count (D-39)", () => {
    load([notaCredito("40.00", "03")]);
    render(<DashboardTab />);
    expect(screen.getByTestId("kpi-ticket")).toHaveTextContent("—");
    expect(screen.getByTestId("kpi-facturas")).toHaveTextContent("0");
    expect(screen.getByTestId("kpi-gasto")).toHaveTextContent("−$40.00");
  });

  it("changes the money figures but not the Facturas count in Sin IVA", () => {
    load(monthly(FIRST_HALF, "116.00", PROVEEDOR_A, { subTotal: "100.00" }));
    render(<DashboardTab />);
    expect(screen.getByTestId("kpi-gasto")).toHaveTextContent("$696.00");
    expect(screen.getByTestId("kpi-facturas")).toHaveTextContent("6");
    act(() => {
      useSettingsStore.setState({ ivaMode: "sin" });
    });
    expect(screen.getByTestId("kpi-gasto")).toHaveTextContent("$600.00");
    expect(screen.getByTestId("kpi-ticket")).toHaveTextContent("$100.00");
    expect(screen.getByTestId("kpi-promedio")).toHaveTextContent("$100.00");
    expect(screen.getByTestId("kpi-facturas")).toHaveTextContent("6");
  });

  it("never renders a percentage when the previous period net spend is not positive", () => {
    // The previous period holds only a credit note: net spend is negative, so no change is computed.
    load([...monthly(SECOND_HALF, "100.00"), notaCredito("30.00", "02")]);
    render(<DashboardTab />);
    act(() => {
      useSessionStore.getState().setRange({ from: "2025-07", to: "2025-12" });
    });
    expect(deltaText("kpi-gasto-delta")).toBe("Sin datos del periodo anterior");
  });
});

describe("Dashboard tab: trend and ranking row (DASH-02, DASH-04, DASH-10, D-22, D-23)", () => {
  const ABARROTES = { rfc: "AAA010101AAA", nombre: "Abarrotes del Sur" };
  const CAFE = { rfc: "BBB010101BBB", nombre: "Café Árbol" };

  function sample(): ParsedInvoice[] {
    return [
      makeInvoice({
        emisor: ABARROTES,
        fecha: "2025-01-15T10:00:00",
        subTotal: "100.00",
        total: "116.00",
      }),
      makeInvoice({
        emisor: ABARROTES,
        fecha: "2025-02-10T10:00:00",
        subTotal: "300.00",
        total: "348.00",
      }),
      makeInvoice({
        emisor: CAFE,
        fecha: "2025-01-20T10:00:00",
        subTotal: "50.00",
        total: "58.00",
      }),
    ];
  }

  function rankingRows(): HTMLElement[] {
    const list = screen.getByRole("list", { name: "Top 10 de proveedores por gasto neto" });
    return within(list).getAllByRole("listitem");
  }

  function rankingRow(index: number): HTMLElement {
    const row = rankingRows()[index];
    if (row === undefined) throw new Error(`no ranking row at ${index}`);
    return row;
  }

  it("renders the trend card and the ranking card side by side from 1024 px, stacked below", () => {
    load(sample());
    render(<DashboardTab />);
    const row = screen.getByTestId("trend-ranking-row");
    expect(row.className).toContain("grid-cols-1");
    expect(row.className).toContain("lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]");
    expect(row.className).toContain("gap-6");
    expect(row.className).toContain("items-start");
    const trend = within(row).getByRole("heading", { name: "Gasto por mes" });
    const ranking = within(row).getByRole("heading", { name: "Gasto por proveedor" });
    expect(trend.compareDocumentPosition(ranking) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The row sits under the KPI cards.
    const kpi = screen.getByTestId("kpi-gasto");
    expect(kpi.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("ranks the suppliers by net spend of the visible set", () => {
    load(sample());
    render(<DashboardTab />);
    expect(rankingRows()).toHaveLength(2);
    expect(within(rankingRow(0)).getByRole("button", { name: "Abarrotes del Sur" })).toBeInTheDocument();
    expect(within(rankingRow(0)).getByText("$464.00")).toBeInTheDocument();
    expect(within(rankingRow(1)).getByRole("button", { name: "Café Árbol" })).toBeInTheDocument();
    expect(within(rankingRow(1)).getByText("$58.00")).toBeInTheDocument();
  });

  it("shows neither card when the filters leave no invoice", () => {
    load(sample());
    render(<DashboardTab />);
    act(() => {
      const store = useSessionStore.getState();
      store.setSuppliers(new Set([CAFE.rfc]));
      store.setRange({ from: "2025-02", to: "2025-02" });
    });
    expect(screen.getByTestId("dashboard-empty-filtered")).toBeInTheDocument();
    expect(screen.queryByTestId("trend-ranking-row")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Gasto por mes" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Gasto por proveedor" })).toBeNull();
  });

  it("updates both cards when the supplier filter changes", () => {
    load(sample());
    render(<DashboardTab />);
    // Two calendar months, 464 + 58 = 522 spent: average 261.
    expect(screen.getByText("Promedio mensual: $261.00")).toBeInTheDocument();
    act(() => {
      useSessionStore.getState().setSuppliers(new Set([CAFE.rfc]));
    });
    expect(rankingRows()).toHaveLength(1);
    expect(screen.getByText("Promedio mensual: $29.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abarrotes del Sur" })).toBeNull();
  });

  it("follows the IVA mode in both cards", () => {
    load(sample());
    render(<DashboardTab />);
    expect(within(rankingRow(0)).getByText("$464.00")).toBeInTheDocument();
    act(() => {
      useSettingsStore.setState({ ivaMode: "sin" });
    });
    expect(within(rankingRow(0)).getByText("$400.00")).toBeInTheDocument();
    expect(screen.getByText("Promedio mensual: $225.00")).toBeInTheDocument();
  });

  it("lowers a supplier's row by its credit note and keeps the ranking in sync", () => {
    load([
      ...sample(),
      makeInvoice({
        tipo: "E",
        emisor: ABARROTES,
        fecha: "2025-02-20T10:00:00",
        subTotal: "400.00",
        total: "400.00",
      }),
    ]);
    render(<DashboardTab />);
    // Abarrotes nets 464 - 400 = 64, still above Café Árbol (58).
    expect(within(rankingRow(0)).getByRole("button", { name: "Abarrotes del Sur" })).toBeInTheDocument();
    expect(within(rankingRow(0)).getByText("$64.00")).toBeInTheDocument();
    expect(within(rankingRow(1)).getByText("$58.00")).toBeInTheDocument();
  });

  it("does not group suppliers into an 'Otros' bucket", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      makeInvoice({
        emisor: { rfc: `ZZ${String(index).padStart(2, "0")}010101AAA`, nombre: `Proveedor ${index}` },
        fecha: "2025-01-15T10:00:00",
        subTotal: `${100 + index}.00`,
        total: `${100 + index}.00`,
      }),
    );
    load(many);
    render(<DashboardTab />);
    expect(rankingRows()).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Ver todos" })).toBeInTheDocument();
    expect(screen.queryByText(/otros/i)).toBeNull();
  });
});

describe("Dashboard tab: Facturas table (DASH-09, REGLA-08, D-24, D-27, D-28)", () => {
  function tableRow(label: string): HTMLElement {
    const row = Array.from(document.querySelectorAll<HTMLElement>("tr[data-row-id]")).find(
      (candidate) => within(candidate).queryByText(label) !== null,
    );
    if (row === undefined) throw new Error(`no table row with ${label}`);
    return row;
  }

  it("ends the Dashboard with every row, summing or not, after the trend and ranking row", () => {
    load([ingreso, egreso, pago]);
    render(<DashboardTab />);
    expect(screen.getByRole("heading", { name: "Facturas (3)" })).toBeInTheDocument();
    const trend = screen.getByTestId("trend-ranking-row");
    const heading = screen.getByRole("heading", { name: "Facturas (3)" });
    expect(trend.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(tableRow("Pago")).getByText("No suma")).toBeInTheDocument();
    expect(within(tableRow("Nota de crédito")).getByText(/^−\$1,000\.00$/)).toBeInTheDocument();
  });

  it("counts the rows left by the filters and shows the filtered empty state instead of the table", () => {
    load([ingreso, egreso, pago]);
    render(<DashboardTab />);
    act(() => {
      useSessionStore.getState().setRange({ from: "1999-01", to: "1999-01" });
    });
    expect(screen.getByTestId("dashboard-empty-filtered")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Facturas \(/ })).toBeNull();
  });

  it("recomputes the Gasto total when an invoice is excluded from its row menu", async () => {
    load([ingreso, egreso, pago]);
    render(<DashboardTab />);
    expect(gastoText()).toBe("$345.98");
    const row = tableRow("Ingreso");
    fireEvent.click(within(row).getByRole("button", { name: /^Acciones de la factura/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Excluir factura" }));
    expect(gastoText()).toBe("−$1,000.00");
    expect(within(tableRow("Ingreso")).getByText("Excluida")).toBeInTheDocument();
  });

  it("shows the table amounts in the active IVA mode", () => {
    load([ingreso, egreso, pago]);
    render(<DashboardTab />);
    expect(within(tableRow("Ingreso")).getByText("$1,345.98")).toBeInTheDocument();
    act(() => {
      useSettingsStore.setState({ ivaMode: "sin" });
    });
    expect(within(tableRow("Ingreso")).getByText("$1,290.81")).toBeInTheDocument();
  });
});

describe("useLedger (shared ledger hook)", () => {
  it("returns the same array while invoices, excluded and restored are unchanged", () => {
    load([inv("L-1"), inv("L-2")]);
    const { result, rerender } = renderHook(() => useLedger());
    const first = result.current;
    expect(first).toHaveLength(2);
    rerender();
    expect(result.current).toBe(first);
    act(() => {
      useSettingsStore.setState({ ivaMode: "sin" });
    });
    expect(result.current).toBe(first);
  });

  it("returns a new array when invoices, excluded or restored change", () => {
    load([inv("L-1"), inv("L-2")]);
    const { result } = renderHook(() => useLedger());
    const first = result.current;
    act(() => {
      useSessionStore.getState().excludeInvoice("L-1");
    });
    const afterExclude = result.current;
    expect(afterExclude).not.toBe(first);
    expect(afterExclude.find((entry) => entry.uuid === "L-1")?.exclusion).toBe("manual");
    act(() => {
      useSessionStore.getState().reincludeInvoice("L-1", { overrideSubstitution: false });
    });
    const afterRestore = result.current;
    expect(afterRestore).not.toBe(afterExclude);
    expect(afterRestore.find((entry) => entry.uuid === "L-1")?.exclusion).toBeNull();
    load([inv("L-3")]);
    expect(result.current).not.toBe(afterRestore);
    expect(result.current).toHaveLength(3);
  });
});

/** An Ingreso whose folio is its uuid, so every reference in the UI is easy to find. */
function inv(uuid: string, overrides: Partial<ParsedInvoice> = {}): ParsedInvoice {
  return makeInvoice({ uuid, folio: uuid, ...overrides });
}

const NOTICE = "Hay incidencias que cambian los montos.";

function notice(): HTMLElement | null {
  return screen.queryByText(NOTICE);
}

describe("Dashboard tab: amount-changing incidents notice (D-04, D-35, D-46)", () => {
  it("is absent when there is no incident", () => {
    load([inv("OK-1"), inv("OK-2")]);
    render(<DashboardTab />);
    expect(notice()).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver Calidad de datos" })).toBeNull();
  });

  it("shows for a credit note without a related invoice, with the Ver Calidad de datos button", () => {
    load([inv("OK-1"), inv("NC-1", { tipo: "E" })]);
    render(<DashboardTab />);
    expect(notice()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver Calidad de datos" })).toBeInTheDocument();
  });

  it("shows for an applied substitution and goes away when the original is re-included", () => {
    load([
      inv("ORIG-1"),
      inv("NEW-1", { relacionados: [{ tipoRelacion: "04", uuids: ["ORIG-1"] }] }),
    ]);
    render(<DashboardTab />);
    expect(notice()).toBeInTheDocument();
    act(() => {
      useSessionStore.getState().reincludeInvoice("ORIG-1", { overrideSubstitution: true });
    });
    expect(notice()).toBeNull();
  });

  it("shows for a foreign currency invoice without exchange rate", () => {
    load([inv("OK-1"), inv("USD-1", { moneda: "USD", tipoCambio: null })]);
    render(<DashboardTab />);
    expect(notice()).toBeInTheDocument();
  });

  it("shows for an invoice with damaged data", () => {
    load([inv("OK-1"), inv("BAD-T", { total: "abc" })]);
    render(<DashboardTab />);
    expect(notice()).toBeInTheDocument();
  });

  it("stays hidden for $0, rounding, PPD, exclusion and several-related credit note incidents", () => {
    load([
      inv("OK-1"),
      inv("CERO-1", { total: "0.00", subTotal: "0.00", totalImpuestosTrasladados: null }),
      inv("RED-1", { total: "116.50" }),
      inv("PPD-1", { metodoPago: "PPD", formaPago: "99" }),
      inv("EXC-1"),
      inv("REL-MAY", { fecha: "2025-05-20T10:00:00" }),
      inv("REL-JUL", { fecha: "2025-07-10T10:00:00" }),
      inv("NC-2", {
        tipo: "E",
        fecha: "2025-08-02T10:00:00",
        relacionados: [{ tipoRelacion: "01", uuids: ["REL-MAY", "REL-JUL"] }],
      }),
    ]);
    act(() => {
      useSessionStore.getState().excludeInvoice("EXC-1");
    });
    render(<DashboardTab />);
    expect(notice()).toBeNull();
  });

  it("makes Calidad de datos the active tab when the button is pressed", () => {
    load([inv("OK-1"), inv("NC-1", { tipo: "E" })]);
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Ver Calidad de datos" }));
    expect(useSessionStore.getState().activeTab).toBe("calidad");
    expect(screen.getByRole("heading", { name: "Calidad de datos" })).toBeInTheDocument();
  });

  it("disappears when the condition clears, without a close control", () => {
    load([inv("OK-1"), inv("NC-1", { tipo: "E" })]);
    render(<DashboardTab />);
    const alert = notice()?.closest('[data-slot="alert"]');
    expect(alert).toBeInstanceOf(HTMLElement);
    if (!(alert instanceof HTMLElement)) return;
    // The only control inside is the link-style button; nothing closes or dismisses it.
    const buttons = within(alert).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Ver Calidad de datos"]);
    act(() => {
      useSessionStore.getState().excludeInvoice("NC-1");
    });
    // An excluded credit note is a "Excluidas" incident, which never changes amounts.
    expect(notice()).toBeNull();
  });

  it("uses the default Alert variant with a muted icon and no destructive color", () => {
    load([inv("OK-1"), inv("NC-1", { tipo: "E" })]);
    render(<DashboardTab />);
    const alert = notice()?.closest('[data-slot="alert"]');
    expect(alert).toBeInstanceOf(HTMLElement);
    if (!(alert instanceof HTMLElement)) return;
    expect(alert.className).toContain("bg-card");
    expect(alert.className).not.toMatch(/(^|\s)(text|bg|border)-destructive/);
    const icon = alert.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.getAttribute("class") ?? "").toContain("text-muted-foreground");
  });

  it("is the first block above the filter bar", () => {
    load([inv("OK-1"), inv("NC-1", { tipo: "E" })]);
    render(<DashboardTab />);
    const alert = notice()?.closest('[data-slot="alert"]');
    const caption = screen.getByTestId("mode-caption");
    expect(alert).toBeInstanceOf(HTMLElement);
    if (!(alert instanceof HTMLElement)) return;
    // Node.DOCUMENT_POSITION_FOLLOWING (4): the caption follows the alert in document order.
    expect(alert.compareDocumentPosition(caption) & 4).toBe(4);
  });
});

describe("Dashboard tab: Ver factura flow and the hidden-by-filters Alert (FILT-05, D-33)", () => {
  const JAN = inv("HID-JAN", { fecha: "2025-01-10T10:00:00" });
  const MAR = inv("SHOWN-MAR", { fecha: "2025-03-10T10:00:00" });

  function hideJan(): void {
    act(() => {
      useSessionStore.getState().setRange({ from: "2025-03", to: "2025-03" });
    });
  }

  function request(uuid: string): void {
    act(() => {
      useSessionStore.getState().requestFocus(uuid);
    });
  }

  function hiddenAlert(folio: string): HTMLElement | null {
    const text = screen.queryByText(`La factura ${folio} no se ve porque los filtros la ocultan.`);
    const alert = text?.closest('[data-slot="alert"]');
    return alert instanceof HTMLElement ? alert : null;
  }

  it("shows the Alert, leaves the filters untouched and moves nothing when the filters hide the invoice", () => {
    load([JAN, MAR]);
    render(<DashboardTab />);
    hideJan();
    const before = useSessionStore.getState().filters;
    request("HID-JAN");
    const alert = hiddenAlert("HID-JAN");
    expect(alert).not.toBeNull();
    expect(useSessionStore.getState().filters).toBe(before);
    expect(document.querySelector('tr[data-row-id="HID-JAN"]')).toBeNull();
    expect(useSessionStore.getState().focusRequest?.uuid).toBe("HID-JAN");
  });

  it("reveals the row, expanded and focused, after Quitar filtros and then clears the request and the Alert", () => {
    load([JAN, MAR]);
    render(<DashboardTab />);
    hideJan();
    request("HID-JAN");
    const alert = hiddenAlert("HID-JAN");
    expect(alert).not.toBeNull();
    if (alert === null) return;
    fireEvent.click(within(alert).getByRole("button", { name: "Quitar filtros" }));
    expect(useSessionStore.getState().filters.range).toBeNull();
    expect(screen.getByTestId("expand-HID-JAN")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("expand-HID-JAN")).toHaveFocus();
    expect(useSessionStore.getState().focusRequest).toBeNull();
    expect(hiddenAlert("HID-JAN")).toBeNull();
  });

  it("shows the Alert as well when the filters leave no row at all, and reveals the row afterwards", () => {
    load([JAN]);
    render(<DashboardTab />);
    act(() => {
      useSessionStore.getState().setRange({ from: "2025-03", to: "2025-03" });
    });
    expect(screen.getByTestId("dashboard-empty-filtered")).toBeInTheDocument();
    request("HID-JAN");
    const alert = hiddenAlert("HID-JAN");
    expect(alert).not.toBeNull();
    if (alert === null) return;
    fireEvent.click(within(alert).getByRole("button", { name: "Quitar filtros" }));
    expect(screen.getByTestId("expand-HID-JAN")).toHaveAttribute("aria-expanded", "true");
    expect(useSessionStore.getState().focusRequest).toBeNull();
  });

  it("clears the request and the Alert when the user edits a filter instead", () => {
    load([JAN, MAR]);
    render(<DashboardTab />);
    hideJan();
    request("HID-JAN");
    expect(hiddenAlert("HID-JAN")).not.toBeNull();
    act(() => {
      useSessionStore.getState().setRange({ from: "2025-02", to: "2025-03" });
    });
    expect(useSessionStore.getState().focusRequest).toBeNull();
    expect(hiddenAlert("HID-JAN")).toBeNull();
    expect(useSessionStore.getState().filters.range).toEqual({ from: "2025-02", to: "2025-03" });
  });

  it("names an invoice without folio by its short uuid", () => {
    const noFolio = makeInvoice({
      uuid: "abcdef12-0000-4000-8000-000000000001",
      folio: null,
      fecha: "2025-01-10T10:00:00",
    });
    load([noFolio, MAR]);
    render(<DashboardTab />);
    hideJan();
    request(noFolio.uuid);
    expect(hiddenAlert(shortUuid(noFolio.uuid))).not.toBeNull();
  });

  it("renders a hostile folio as plain text in the Alert", () => {
    const hostile = inv("<img src=x onerror=alert(1)>", { fecha: "2025-01-10T10:00:00" });
    load([hostile, MAR]);
    render(<DashboardTab />);
    hideJan();
    request(hostile.uuid);
    expect(hiddenAlert("<img src=x onerror=alert(1)>")).not.toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("clears a request for a uuid that is not loaded without showing any Alert", () => {
    load([JAN, MAR]);
    render(<DashboardTab />);
    hideJan();
    const before = useSessionStore.getState().filters;
    request("NOT-LOADED");
    expect(useSessionStore.getState().focusRequest).toBeNull();
    expect(screen.queryByText(/no se ve porque los filtros la ocultan/)).toBeNull();
    expect(useSessionStore.getState().filters).toBe(before);
  });

  it("switches from Calidad de datos to the Dashboard and the table, mounting afterwards, consumes the request", () => {
    load([JAN, MAR]);
    render(<AppShell />);
    fireEvent.click(screen.getByRole("tab", { name: /^Calidad de datos/ }));
    expect(useSessionStore.getState().activeTab).toBe("calidad");
    request("HID-JAN");
    expect(useSessionStore.getState().activeTab).toBe("dashboard");
    expect(screen.getByTestId("expand-HID-JAN")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("expand-HID-JAN")).toHaveFocus();
    expect(useSessionStore.getState().focusRequest).toBeNull();
  });

  it("never edits a filter by itself: only Quitar filtros changes them", () => {
    load([JAN, MAR]);
    render(<DashboardTab />);
    hideJan();
    const before = useSessionStore.getState().filters;
    request("HID-JAN");
    expect(useSessionStore.getState().filters).toBe(before);
  });
});

describe("Dashboard tab: Fecha year window (WR-03, D-48)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("WR-03: an Ingreso dated 2205 is reported, does not sum and does not stretch the month span", () => {
    // Mid-June 2026 local time: the window is 2000..2027 and the year is read at mount.
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    load([
      inv("OK-ENE", { fecha: "2025-01-15T10:00:00" }),
      inv("OK-JUN", { fecha: "2025-06-15T10:00:00" }),
      inv("FAR-1", { fecha: "2205-01-01T10:00:00" }),
    ]);
    render(<DashboardTab />);
    expect(gastoText()).toContain("$232.00");
    expect(screen.getByText("Entre 6 meses del calendario")).toBeInTheDocument();
    expect(notice()).toBeInTheDocument();
  });

  it("WR-03: with the browser in June 2027 an Ingreso dated January 2028 is inside the window", () => {
    vi.setSystemTime(new Date(2027, 5, 15, 12, 0, 0));
    load([
      inv("OK-2025", { fecha: "2025-01-15T10:00:00" }),
      inv("NEXT-1", { fecha: "2028-01-15T10:00:00" }),
    ]);
    render(<DashboardTab />);
    expect(gastoText()).toContain("$232.00");
    expect(screen.getByText("Entre 37 meses del calendario")).toBeInTheDocument();
  });

  it("WR-03: with the browser in June 2026 the same January 2028 Ingreso is reported and does not sum", () => {
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    load([
      inv("OK-2025", { fecha: "2025-01-15T10:00:00" }),
      inv("NEXT-1", { fecha: "2028-01-15T10:00:00" }),
    ]);
    render(<DashboardTab />);
    expect(gastoText()).toContain("$116.00");
    expect(screen.getByText("Entre 1 mes del calendario")).toBeInTheDocument();
    expect(notice()).toBeInTheDocument();
  });

  it("WR-03: both ends are inclusive: 2027-12-31 counts, 2028-01-01 and 1999-12-31 do not (June 2026)", () => {
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    load([
      inv("OK-2025", { fecha: "2025-01-15T10:00:00" }),
      inv("UPPER-1", { fecha: "2027-12-31T23:59:59" }),
      inv("ABOVE-1", { fecha: "2028-01-01T00:00:00" }),
      inv("BELOW-1", { fecha: "1999-12-31T23:59:59" }),
    ]);
    render(<DashboardTab />);
    expect(gastoText()).toContain("$232.00");
    expect(screen.getByText("Entre 36 meses del calendario")).toBeInTheDocument();
  });

  it("WR-03: a Pago dated 2205 stays out of the span and raises no amount-change notice", () => {
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    load([
      inv("OK-2025", { fecha: "2025-01-15T10:00:00" }),
      inv("PAGO-FAR", { tipo: "P", fecha: "2205-01-01T10:00:00" }),
    ]);
    render(<DashboardTab />);
    expect(gastoText()).toContain("$116.00");
    expect(screen.getByText("Entre 1 mes del calendario")).toBeInTheDocument();
    expect(notice()).toBeNull();
  });
});
