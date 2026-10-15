// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DateRange } from "@/domain/accounting/filters";
import {
  DateRangeFilter,
  lastMonthsRange,
  thisYearRange,
} from "./DateRangeFilter";

afterEach(cleanup);

const SPAN_2025: DateRange = { from: "2025-01", to: "2025-12" };
const SPAN_ACROSS: DateRange = { from: "2024-11", to: "2025-05" };

describe("thisYearRange", () => {
  it("runs from January of the last loaded year to the last loaded month", () => {
    expect(thisYearRange(SPAN_ACROSS)).toEqual({ from: "2025-01", to: "2025-05" });
  });

  it("is clipped to the loaded span", () => {
    expect(thisYearRange({ from: "2025-03", to: "2025-05" })).toEqual({
      from: "2025-03",
      to: "2025-05",
    });
  });

  it("anchors on the last loaded month, not on today", () => {
    expect(thisYearRange({ from: "2019-02", to: "2020-07" })).toEqual({
      from: "2020-01",
      to: "2020-07",
    });
  });
});

describe("lastMonthsRange", () => {
  it("is the last month and the ones before it", () => {
    expect(lastMonthsRange(SPAN_ACROSS, 3)).toEqual({ from: "2025-03", to: "2025-05" });
  });

  it("crosses a year boundary", () => {
    expect(lastMonthsRange({ from: "2024-01", to: "2025-01" }, 3)).toEqual({
      from: "2024-11",
      to: "2025-01",
    });
  });

  it("is the whole span when the span is shorter than n", () => {
    expect(lastMonthsRange({ from: "2025-04", to: "2025-05" }, 3)).toEqual({
      from: "2025-04",
      to: "2025-05",
    });
  });
});

function renderFilter(value: DateRange | null, span: DateRange = SPAN_2025) {
  const onChange = vi.fn<(range: DateRange | null) => void>();
  render(<DateRangeFilter span={span} value={value} onChange={onChange} />);
  return onChange;
}

function openPopover(): void {
  fireEvent.click(screen.getByRole("button", { name: /^Fechas:/ }));
}

/** Opens a Select by its label and returns the visible option texts in order. */
function openSelect(label: string): string[] {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  return screen.getAllByRole("option").map((option) => option.textContent ?? "");
}

function chooseOption(label: string, optionText: string): void {
  openSelect(label);
  fireEvent.click(screen.getByRole("option", { name: optionText }));
}

describe("DateRangeFilter trigger", () => {
  it("reads the loaded span as a range when there is no explicit range", () => {
    renderFilter(null);
    expect(screen.getByRole("button", { name: /^Fechas:/ }).textContent).toBe(
      "Fechas: ene 2025 – dic 2025",
    );
  });

  it("reads one month with its long name", () => {
    renderFilter({ from: "2025-05", to: "2025-05" });
    expect(screen.getByRole("button", { name: /^Fechas:/ }).textContent).toBe(
      "Fechas: mayo 2025",
    );
  });
});

describe("DateRangeFilter popover", () => {
  it("shows the Desde and Hasta values before any list opens", () => {
    renderFilter({ from: "2025-03", to: "2025-05" });
    openPopover();
    expect(screen.getByRole("combobox", { name: "Desde" }).textContent).toBe("mar 2025");
    expect(screen.getByRole("combobox", { name: "Hasta" }).textContent).toBe("may 2025");
  });

  it("shows the helper line and the three shortcuts", () => {
    renderFilter(null);
    openPopover();
    expect(
      screen.getByText("Para ver un solo mes, elige el mismo mes en Desde y Hasta."),
    ).toBeTruthy();
    for (const name of ["Todo", "Este año", "Últimos 3 meses"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("lists only the months of the span, oldest first", () => {
    renderFilter(null, { from: "2024-11", to: "2025-02" });
    openPopover();
    expect(openSelect("Desde")).toEqual(["nov 2024", "dic 2024", "ene 2025", "feb 2025"]);
  });

  it("moves Hasta to equal Desde when Desde is chosen after Hasta", () => {
    const onChange = renderFilter({ from: "2025-03", to: "2025-05" });
    openPopover();
    chooseOption("Desde", "ago 2025");
    expect(onChange).toHaveBeenCalledWith({ from: "2025-08", to: "2025-08" });
  });

  it("moves Desde to equal Hasta when Hasta is chosen before Desde", () => {
    const onChange = renderFilter({ from: "2025-03", to: "2025-05" });
    openPopover();
    chooseOption("Hasta", "ene 2025");
    expect(onChange).toHaveBeenCalledWith({ from: "2025-01", to: "2025-01" });
  });

  it("keeps the other end when the new Desde is still before Hasta", () => {
    const onChange = renderFilter({ from: "2025-03", to: "2025-05" });
    openPopover();
    chooseOption("Desde", "feb 2025");
    expect(onChange).toHaveBeenCalledWith({ from: "2025-02", to: "2025-05" });
  });

  it("stores a range equal to the span as null", () => {
    const onChange = renderFilter({ from: "2025-03", to: "2025-12" });
    openPopover();
    chooseOption("Desde", "ene 2025");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("Todo clears the range", () => {
    const onChange = renderFilter({ from: "2025-03", to: "2025-05" });
    openPopover();
    fireEvent.click(screen.getByRole("button", { name: "Todo" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("Este año anchors on the last loaded month", () => {
    const onChange = renderFilter(null, SPAN_ACROSS);
    openPopover();
    fireEvent.click(screen.getByRole("button", { name: "Este año" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2025-01", to: "2025-05" });
  });

  it("Últimos 3 meses anchors on the last loaded month", () => {
    const onChange = renderFilter(null, SPAN_ACROSS);
    openPopover();
    fireEvent.click(screen.getByRole("button", { name: "Últimos 3 meses" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2025-03", to: "2025-05" });
  });

  it("stores a shortcut that equals the span as null", () => {
    const onChange = renderFilter(
      { from: "2025-04", to: "2025-05" },
      { from: "2025-03", to: "2025-05" },
    );
    openPopover();
    fireEvent.click(screen.getByRole("button", { name: "Este año" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
