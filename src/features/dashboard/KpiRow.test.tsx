// @vitest-environment jsdom
import Big from "big.js";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { KpiDeltas, KpiResult } from "@/domain/accounting/aggregate";
import { KpiRow } from "./KpiRow";

function result(overrides: Partial<KpiResult> = {}): KpiResult {
  return {
    gasto: new Big("1200.00"),
    facturas: 4,
    notas: 0,
    ticket: new Big("300.00"),
    promedio: new Big("100.00"),
    months: 12,
    hasData: true,
    ...overrides,
  };
}

const NO_DELTAS: KpiDeltas = { gasto: null, facturas: null, ticket: null, promedio: null };

function renderRow(
  current: KpiResult,
  deltas: KpiDeltas = NO_DELTAS,
  previousLabel = "ene–jun 2025",
) {
  return render(
    <KpiRow current={current} deltas={deltas} previousLabel={previousLabel} mode="con" />,
  );
}

afterEach(() => {
  cleanup();
});

describe("KpiRow: cards (DASH-01, D-03)", () => {
  it("shows the four cards in order with their labels", () => {
    renderRow(result());
    const labels = ["Gasto total", "Facturas", "Ticket promedio", "Promedio mensual"];
    const positions = labels.map((label) => screen.getByText(label));
    for (let index = 1; index < positions.length; index += 1) {
      const before = positions[index - 1];
      const after = positions[index];
      if (before === undefined || after === undefined) throw new Error("missing card label");
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("formats the values: money, grouped count and money", () => {
    renderRow(result({ facturas: 1234, gasto: new Big("1234.5") }));
    expect(screen.getByTestId("kpi-gasto")).toHaveTextContent("$1,234.50");
    expect(screen.getByTestId("kpi-facturas")).toHaveTextContent("1,234");
    expect(screen.getByTestId("kpi-ticket")).toHaveTextContent("$300.00");
    expect(screen.getByTestId("kpi-promedio")).toHaveTextContent("$100.00");
  });

  it("shows a dash for the ticket when no invoice counts and mutes it", () => {
    renderRow(result({ facturas: 0, ticket: null }));
    const ticket = screen.getByTestId("kpi-ticket");
    expect(ticket).toHaveTextContent("—");
    expect(ticket.className).toContain("text-muted-foreground");
  });

  it("mutes zero values and writes a negative Gasto total with the true minus", () => {
    renderRow(result({ facturas: 0, promedio: new Big("0") }));
    expect(screen.getByTestId("kpi-facturas").className).toContain("text-muted-foreground");
    expect(screen.getByTestId("kpi-promedio").className).toContain("text-muted-foreground");
    expect(screen.getByTestId("kpi-gasto").className).not.toContain("text-muted-foreground");
    cleanup();
    renderRow(result({ gasto: new Big("-50") }));
    const text = screen.getByTestId("kpi-gasto").textContent;
    expect(text).toBe("−$50.00");
  });

  it("is informational: no buttons, links or tab stops", () => {
    renderRow(result({ notas: 2 }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("KpiRow: sub-labels (D-18, DASH-06)", () => {
  it("shows no credit-note sub-label when there are none", () => {
    renderRow(result({ notas: 0 }));
    expect(screen.queryByText(/nota/)).toBeNull();
  });

  it("shows '+1 nota de crédito' for one and '+N notas de crédito' for several", () => {
    renderRow(result({ notas: 1 }));
    expect(screen.getByText("+1 nota de crédito")).toBeInTheDocument();
    cleanup();
    renderRow(result({ notas: 3 }));
    expect(screen.getByText("+3 notas de crédito")).toBeInTheDocument();
  });

  it("states the calendar months used as the divisor", () => {
    renderRow(result({ months: 12 }));
    expect(screen.getByText("Entre 12 meses del calendario")).toBeInTheDocument();
    cleanup();
    renderRow(result({ months: 1 }));
    expect(screen.getByText("Entre 1 mes del calendario")).toBeInTheDocument();
  });
});

describe("KpiRow: previous-period deltas (D-20, UI-SPEC decision 2)", () => {
  it("renders an increase in neutral foreground with an up arrow, a plus sign and 'subió'", () => {
    renderRow(result(), { ...NO_DELTAS, gasto: new Big("0.124") });
    const delta = screen.getByTestId("kpi-gasto-delta");
    expect(delta).toHaveTextContent("+12.4 % vs. ene–jun 2025");
    expect(within(delta).getByText("subió", { exact: false }).className).toContain("sr-only");
    expect(delta.querySelector("svg")).not.toBeNull();
    expect(delta.className).not.toContain("text-positive");
    expect(delta.className).not.toContain("text-muted-foreground");
    expect(delta.querySelector("svg")?.getAttribute("class") ?? "").toContain("lucide-arrow-up");
  });

  it("renders a decrease in the positive color with a down arrow, a true minus and 'bajó'", () => {
    renderRow(result(), { ...NO_DELTAS, ticket: new Big("-0.08") });
    const delta = screen.getByTestId("kpi-ticket-delta");
    expect(delta).toHaveTextContent("−8.0 % vs. ene–jun 2025");
    expect(within(delta).getByText("bajó", { exact: false }).className).toContain("sr-only");
    expect(delta.className).toContain("text-positive");
    expect(delta.querySelector("svg")?.getAttribute("class") ?? "").toContain("lucide-arrow-down");
  });

  it("renders an equal value as '0.0 %' in neutral without a stated direction", () => {
    renderRow(result(), { ...NO_DELTAS, facturas: new Big("0") });
    const delta = screen.getByTestId("kpi-facturas-delta");
    expect(delta).toHaveTextContent("0.0 % vs. ene–jun 2025");
    expect(delta).not.toHaveTextContent("subió");
    expect(delta).not.toHaveTextContent("bajó");
    expect(delta.className).not.toContain("text-positive");
  });

  it("renders 'Sin datos del periodo anterior' in muted text with no arrow and no percent for a null delta", () => {
    renderRow(result());
    for (const id of ["kpi-gasto-delta", "kpi-facturas-delta", "kpi-ticket-delta", "kpi-promedio-delta"]) {
      const delta = screen.getByTestId(id);
      expect(delta).toHaveTextContent("Sin datos del periodo anterior");
      expect(delta.className).toContain("text-muted-foreground");
      expect(delta.querySelector("svg")).toBeNull();
      expect(delta.textContent).not.toMatch(/%/);
    }
  });
});

describe("KpiRow: layout and prohibitions (T-02-17, T-02-18)", () => {
  it("lays the cards out in 1, 2 and 4 columns at 640 and 1200 px", () => {
    renderRow(result());
    const grid = screen.getByTestId("kpi-gasto").closest("[data-testid='kpi-row']");
    expect(grid).not.toBeNull();
    const className = grid?.className ?? "";
    expect(className).toContain("grid-cols-1");
    expect(className).toContain("sm:grid-cols-2");
    expect(className).toContain("min-[1200px]:grid-cols-4");
    expect(className).toContain("gap-4");
  });

  it("renders a 13-character amount in full with no-wrap tabular figures and no truncation", () => {
    renderRow(result({ gasto: new Big("12345678.90") }));
    const value = screen.getByTestId("kpi-gasto");
    expect(value).toHaveTextContent("$12,345,678.90");
    expect(value.className).toContain("whitespace-nowrap");
    expect(value.className).toContain("tabular-nums");
    expect(value.className).toContain("text-[28px]");
    for (const forbidden of ["truncate", "text-ellipsis", "overflow-hidden"]) {
      expect(value.className).not.toContain(forbidden);
      expect(value.parentElement?.className ?? "").not.toContain(forbidden);
    }
  });

  it("never uses the destructive color, even for an increase", () => {
    const { container } = renderRow(result({ notas: 2 }), {
      gasto: new Big("0.5"),
      facturas: new Big("0.5"),
      ticket: new Big("-0.5"),
      promedio: null,
    });
    expect(container.innerHTML).not.toContain("destructive");
  });
});
