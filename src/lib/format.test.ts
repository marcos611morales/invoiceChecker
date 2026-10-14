import { describe, expect, it } from "vitest";
import { formatFechaIso, formatFolio, formatTotal } from "./format";

describe("formatFechaIso", () => {
  it("slices the literal ISO string into dd/mm/yyyy", () => {
    expect(formatFechaIso("2025-05-28T17:38:18")).toBe("28/05/2025");
  });

  it("does not shift the day for midnight timestamps", () => {
    expect(formatFechaIso("2025-01-01T00:00:00")).toBe("01/01/2025");
  });

  it("returns a malformed value unchanged", () => {
    expect(formatFechaIso("not a date")).toBe("not a date");
    expect(formatFechaIso("")).toBe("");
    expect(formatFechaIso("2025-5-28")).toBe("2025-5-28");
  });
});

describe("formatTotal", () => {
  it("formats MXN amounts in es-MX", () => {
    expect(formatTotal("1234.5", "MXN")).toBe("$1,234.50");
  });

  it("shows a dash for the XXX currency", () => {
    expect(formatTotal("0", "XXX")).toBe("—");
    expect(formatTotal("0.00", "XXX")).toBe("—");
  });

  it("never throws on an unknown currency code and keeps the raw amount", () => {
    const text = formatTotal("10.5", "ZZ");
    expect(text).toContain("10.5");
    expect(text).toContain("ZZ");
  });

  it("returns the raw amount with the code when the amount is not numeric", () => {
    const text = formatTotal("abc", "MXN");
    expect(text).toContain("abc");
  });
});

describe("formatFolio", () => {
  it("shows a dash for a missing folio", () => {
    expect(formatFolio(null)).toBe("—");
  });

  it("returns the folio as is", () => {
    expect(formatFolio("A-12")).toBe("A-12");
  });
});
