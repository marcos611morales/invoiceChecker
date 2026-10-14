import { describe, expect, it } from "vitest";
import {
  compareMonths,
  monthOfFecha,
  monthsInRange,
  previousPeriod,
} from "./months";

describe("monthOfFecha", () => {
  it("slices the literal Fecha as YYYY-MM, whatever the time zone", () => {
    // 21:20 on the last day of the month: a Date round trip would move it in Tokyo.
    expect(monthOfFecha("2025-08-31T21:20:35")).toBe("2025-08");
    expect(monthOfFecha("2025-01-01T00:00:00")).toBe("2025-01");
    expect(monthOfFecha("2025-12-31T23:59:59")).toBe("2025-12");
  });

  it("gives no month for a Fecha that does not match the CFDI format", () => {
    expect(monthOfFecha("2025-13-01T00:00:00")).toBeNull();
    expect(monthOfFecha("2025-00-10T00:00:00")).toBeNull();
    expect(monthOfFecha("2025-08-31")).toBeNull();
    expect(monthOfFecha("")).toBeNull();
    expect(monthOfFecha("hola")).toBeNull();
    expect(monthOfFecha("2025-08-31T25:00:00")).toBeNull();
    expect(monthOfFecha("2025-08-31T21:60:00")).toBeNull();
    expect(monthOfFecha("2025-08-32T10:00:00")).toBeNull();
    expect(monthOfFecha("2025-02-30T10:00:00")).toBeNull();
    expect(monthOfFecha("2025-08-31T21:20:35Z")).toBeNull();
  });

  it("accepts the leap day only in a leap year", () => {
    expect(monthOfFecha("2024-02-29T10:00:00")).toBe("2024-02");
    expect(monthOfFecha("2025-02-29T10:00:00")).toBeNull();
  });
});

describe("monthsInRange", () => {
  it("lists every month across a year boundary", () => {
    expect(monthsInRange("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("has one element for a one-month range", () => {
    expect(monthsInRange("2025-06", "2025-06")).toEqual(["2025-06"]);
  });

  it("is empty when the range is reversed", () => {
    expect(monthsInRange("2025-06", "2025-05")).toEqual([]);
  });
});

describe("previousPeriod", () => {
  it("returns the same number of months immediately before", () => {
    expect(previousPeriod("2025-07", "2025-12")).toEqual({
      from: "2025-01",
      to: "2025-06",
    });
  });

  it("crosses the year boundary", () => {
    expect(previousPeriod("2025-01", "2025-03")).toEqual({
      from: "2024-10",
      to: "2024-12",
    });
  });

  it("handles a single month", () => {
    expect(previousPeriod("2025-03", "2025-03")).toEqual({
      from: "2025-02",
      to: "2025-02",
    });
  });
});

describe("compareMonths", () => {
  it("orders chronologically", () => {
    expect(compareMonths("2025-02", "2025-11")).toBeLessThan(0);
    expect(compareMonths("2026-01", "2025-12")).toBeGreaterThan(0);
    expect(compareMonths("2025-05", "2025-05")).toBe(0);
    expect(["2026-01", "2025-12", "2025-03"].sort(compareMonths)).toEqual([
      "2025-03",
      "2025-12",
      "2026-01",
    ]);
  });
});
