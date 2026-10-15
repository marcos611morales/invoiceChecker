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
import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { AppShell } from "@/features/shell/AppShell";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { readFixture } from "../../../tests/support/cfdiVariants";
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
      useSessionStore.getState().reincludeInvoice(ingreso.uuid);
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

  it("lists Dashboard and Importación for now (Calidad arrives in Plan 02-15)", () => {
    load([ingreso, egreso]);
    render(<AppShell />);
    const names = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(names).toEqual(["Dashboard", "Importación"]);
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
