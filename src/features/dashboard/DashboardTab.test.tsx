// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { AppShell } from "@/features/shell/AppShell";
import { useSessionStore } from "@/stores/sessionStore";
import { readFixture } from "../../../tests/support/cfdiVariants";

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
  act(() => {
    useSessionStore.getState().clearAll();
  });
});

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
