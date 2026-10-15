// @vitest-environment jsdom
import Big from "big.js";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { MonthPoint } from "@/domain/accounting/aggregate";
import { monthsInRange } from "@/domain/accounting/months";
import "../../../tests/support/domPolyfills";
import { TrendChart } from "./TrendChart";

function series(from: string, to: string, amount = "100.00"): MonthPoint[] {
  return monthsInRange(from, to).map((month) => ({ month, amount: new Big(amount) }));
}

afterEach(() => {
  cleanup();
});

describe("TrendChart: copy and accessible name (D-21, E5)", () => {
  it("shows the heading, the range caption and an image named by the range", () => {
    render(
      <TrendChart
        series={series("2025-01", "2025-12")}
        promedio={new Big("100.00")}
        range={{ from: "2025-01", to: "2025-12" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Gasto por mes" })).toBeInTheDocument();
    expect(screen.getByText("ene 2025 – dic 2025")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Gasto por mes de ene 2025 a dic 2025" }),
    ).toBeInTheDocument();
  });

  it("shows the HTML legend with the bars and the average amount", () => {
    render(
      <TrendChart
        series={series("2025-01", "2025-03", "1500.00")}
        promedio={new Big("1500")}
        range={{ from: "2025-01", to: "2025-03" }}
      />,
    );
    expect(screen.getByText("Gasto mensual")).toBeInTheDocument();
    expect(screen.getByText("Promedio mensual: $1,500.00")).toBeInTheDocument();
  });
});

describe("TrendChart: accessible data table", () => {
  it("has one row per month with the long month and the exact amount", () => {
    const points: MonthPoint[] = [
      { month: "2025-04", amount: new Big("2500.5") },
      { month: "2025-05", amount: new Big("0") },
      { month: "2025-06", amount: new Big("-300") },
    ];
    render(
      <TrendChart
        series={points}
        promedio={new Big("733.5")}
        range={{ from: "2025-04", to: "2025-06" }}
      />,
    );
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    // header row plus three months
    expect(rows).toHaveLength(4);
    expect(within(table).getByText("abril 2025")).toBeInTheDocument();
    expect(within(table).getByText("$2,500.50")).toBeInTheDocument();
    expect(within(table).getByText("mayo 2025")).toBeInTheDocument();
    expect(within(table).getByText("$0.00")).toBeInTheDocument();
    expect(within(table).getByText("−$300.00")).toBeInTheDocument();
  });

  it("keeps the table outside the role=img node so it stays reachable", () => {
    render(
      <TrendChart
        series={series("2025-01", "2025-02")}
        promedio={new Big("100")}
        range={{ from: "2025-01", to: "2025-02" }}
      />,
    );
    const image = screen.getByRole("img", { name: /Gasto por mes de/ });
    expect(image).not.toContainElement(screen.getByRole("table"));
  });

  it("renders one month as one row, one legend and a caption with the long month", () => {
    render(
      <TrendChart
        series={series("2025-06", "2025-06", "42.00")}
        promedio={new Big("42")}
        range={{ from: "2025-06", to: "2025-06" }}
      />,
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Promedio mensual: $42.00")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Gasto por mes de jun 2025 a jun 2025" }),
    ).toBeInTheDocument();
  });

  it("renders a 36-month range with one table row per month", () => {
    render(
      <TrendChart
        series={series("2023-01", "2025-12")}
        promedio={new Big("100")}
        range={{ from: "2023-01", to: "2025-12" }}
      />,
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(37);
  });
});

describe("TrendChart: static chart config (T-02-19)", () => {
  it("injects only the static gasto color into the chart style block", () => {
    const { container } = render(
      <TrendChart
        series={[{ month: "2025-01", amount: new Big("10") }]}
        promedio={new Big("10")}
        range={{ from: "2025-01", to: "2025-01" }}
      />,
    );
    const style = container.querySelector("style");
    expect(style).not.toBeNull();
    const css = style?.textContent ?? "";
    expect(css).toContain("--color-gasto: var(--chart-1);");
    expect(css).not.toContain("2025");
    expect(css).not.toContain("<");
    expect(container.querySelectorAll("style")).toHaveLength(1);
  });
});
