import { describe, expect, it } from "vitest";
import {
  MIN_FECHA_YEAR,
  compareMonths,
  monthOfFecha,
  type FechaContext,
  monthsInRange,
  previousPeriod,
} from "./months";
import { TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";

describe("monthOfFecha", () => {
  it("slices the literal Fecha as YYYY-MM, whatever the time zone", () => {
    // 21:20 on the last day of the month: a Date round trip would move it in Tokyo.
    expect(monthOfFecha("2025-08-31T21:20:35", TEST_FECHA_CONTEXT)).toBe("2025-08");
    expect(monthOfFecha("2025-01-01T00:00:00", TEST_FECHA_CONTEXT)).toBe("2025-01");
    expect(monthOfFecha("2025-12-31T23:59:59", TEST_FECHA_CONTEXT)).toBe("2025-12");
  });

  it("gives no month for a Fecha that does not match the CFDI format", () => {
    expect(monthOfFecha("2025-13-01T00:00:00", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("2025-00-10T00:00:00", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("2025-08-31", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("hola", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("2025-08-31T25:00:00", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("2025-08-31T21:60:00", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("2025-08-32T10:00:00", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("2025-02-30T10:00:00", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("2025-08-31T21:20:35Z", TEST_FECHA_CONTEXT)).toBeNull();
  });

  it("accepts the leap day only in a leap year", () => {
    expect(monthOfFecha("2024-02-29T10:00:00", TEST_FECHA_CONTEXT)).toBe("2024-02");
    expect(monthOfFecha("2025-02-29T10:00:00", TEST_FECHA_CONTEXT)).toBeNull();
  });
});

describe("monthOfFecha: plausible year window (WR-03, D-48)", () => {
  it("fixes the lower end of the window at 2000", () => {
    expect(MIN_FECHA_YEAR).toBe(2000);
  });

  it("rejects the year before the lower end and accepts the lower end itself", () => {
    expect(monthOfFecha("1999-12-31T23:59:59", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("2000-01-01T00:00:00", TEST_FECHA_CONTEXT)).toBe("2000-01");
    // 2000 is a leap year (divisible by 400): the leap day is still valid at the lower end.
    expect(monthOfFecha("2000-02-29T10:00:00", TEST_FECHA_CONTEXT)).toBe("2000-02");
  });

  it("accepts the whole year after the injected one and rejects the one after that", () => {
    expect(monthOfFecha("2027-12-31T23:59:59", TEST_FECHA_CONTEXT)).toBe("2027-12");
    expect(monthOfFecha("2028-01-01T00:00:00", TEST_FECHA_CONTEXT)).toBeNull();
  });

  it("rejects damaged years far from the window", () => {
    expect(monthOfFecha("0000-01-01T00:00:00", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("0001-03-01T10:00:00", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("2205-01-01T10:00:00", TEST_FECHA_CONTEXT)).toBeNull();
    expect(monthOfFecha("9999-12-31T23:59:59", TEST_FECHA_CONTEXT)).toBeNull();
  });

  it("moves the upper end with the injected year and keeps the lower end fixed", () => {
    const later: FechaContext = { currentYear: 2030 };
    expect(monthOfFecha("2031-12-31T23:59:59", later)).toBe("2031-12");
    expect(monthOfFecha("2032-01-01T00:00:00", later)).toBeNull();
    expect(monthOfFecha("1999-12-31T23:59:59", later)).toBeNull();
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
