import Big from "big.js";
import { describe, expect, it } from "vitest";
import type { MonthPoint } from "@/domain/accounting/aggregate";
import { monthsInRange } from "@/domain/accounting/months";
import { isTrendDatum, tickLabel, toTrendData } from "./trendData";

function point(month: string, amount: string): MonthPoint {
  return { month, amount: new Big(amount) };
}

describe("tickLabel (D-21)", () => {
  it("is the bare month name inside one calendar year", () => {
    expect(tickLabel("2025-01", false)).toBe("ene");
    expect(tickLabel("2025-12", false)).toBe("dic");
  });

  it("adds the two-digit year when the range spans years", () => {
    expect(tickLabel("2025-01", true)).toBe("ene 25");
    expect(tickLabel("2024-12", true)).toBe("dic 24");
  });
});

describe("toTrendData (DASH-02)", () => {
  it("keeps a zero-spend month as a zero bar with its tick and exact text", () => {
    const data = toTrendData([point("2025-01", "100.50"), point("2025-02", "0")]);
    expect(data).toEqual([
      { month: "2025-01", tick: "ene", amount: 100.5, amountText: "$100.50" },
      { month: "2025-02", tick: "feb", amount: 0, amountText: "$0.00" },
    ]);
  });

  it("keeps a credit-note-heavy month negative, with the true minus in the text", () => {
    const [first] = toTrendData([point("2025-03", "-1234.567")]);
    expect(first?.amount).toBe(-1234.57);
    expect(first?.amountText).toBe("−$1,234.57");
  });

  it("derives the plotting number from the 2-dp money string, not the raw decimal", () => {
    const [first] = toTrendData([point("2025-04", "10.005")]);
    expect(first?.amount).toBe(10.01);
    expect(first?.amountText).toBe("$10.01");
  });

  it("never prints a negative zero", () => {
    const [first] = toTrendData([point("2025-05", "-0.001")]);
    expect(first?.amount).toBe(0);
    expect(Object.is(first?.amount, -0)).toBe(false);
    expect(first?.amountText).toBe("$0.00");
  });

  it("uses year-suffixed ticks across years and bare ticks inside one year", () => {
    const across = toTrendData([point("2024-12", "1"), point("2025-01", "2")]);
    expect(across.map((d) => d.tick)).toEqual(["dic 24", "ene 25"]);
    const within = toTrendData([point("2025-01", "1"), point("2025-02", "2")]);
    expect(within.map((d) => d.tick)).toEqual(["ene", "feb"]);
  });

  it("gives one datum for one month and none for an empty series", () => {
    expect(toTrendData([point("2025-06", "5")])).toHaveLength(1);
    expect(toTrendData([])).toEqual([]);
  });

  it("maps a synthetic 36-month range to 36 year-suffixed ticks", () => {
    const months = monthsInRange("2023-01", "2025-12");
    const data = toTrendData(months.map((month) => point(month, "1")));
    expect(data).toHaveLength(36);
    expect(data[0]?.tick).toBe("ene 23");
    expect(data[35]?.tick).toBe("dic 25");
    expect(data.every((d) => /^[a-z]{3} \d{2}$/.test(d.tick))).toBe(true);
  });
});

describe("isTrendDatum", () => {
  it("accepts a datum built by toTrendData", () => {
    const [first] = toTrendData([point("2025-01", "1")]);
    expect(isTrendDatum(first)).toBe(true);
  });

  it("rejects anything that is not a complete datum", () => {
    expect(isTrendDatum(undefined)).toBe(false);
    expect(isTrendDatum(null)).toBe(false);
    expect(isTrendDatum({ month: "2025-01" })).toBe(false);
    expect(isTrendDatum({ month: "2025-01", tick: "ene", amount: "1", amountText: "$1" })).toBe(
      false,
    );
  });
});
