import Big from "big.js";
import { describe, expect, it } from "vitest";
import {
  countCell,
  dateCell,
  emptyCell,
  excelDateOfFecha,
  moneyCell,
  percentCell,
  quantityCell,
  rateCell,
  textCell,
  unitPriceCell,
} from "./cellModel";

describe("excelDateOfFecha (XLS-03, REGLA-05)", () => {
  it("builds the same calendar day at UTC midnight in every time zone", () => {
    const date = excelDateOfFecha("2025-05-28T17:38:18");
    expect(date).not.toBeNull();
    expect(date?.getTime()).toBe(Date.UTC(2025, 4, 28));
  });

  it("keeps a late-evening Fecha on its own day", () => {
    expect(excelDateOfFecha("2025-08-31T23:59:59")?.getTime()).toBe(Date.UTC(2025, 7, 31));
  });

  it("accepts a leap day and rejects a day that does not exist", () => {
    expect(excelDateOfFecha("2024-02-29T00:00:00")?.getTime()).toBe(Date.UTC(2024, 1, 29));
    expect(excelDateOfFecha("2025-02-29T00:00:00")).toBeNull();
  });

  it("gives null for text, an impossible month or a year before 1900", () => {
    expect(excelDateOfFecha("basura")).toBeNull();
    expect(excelDateOfFecha("")).toBeNull();
    expect(excelDateOfFecha("1899-12-31T00:00:00")).toBeNull();
    expect(excelDateOfFecha("2025-13-01T00:00:00")).toBeNull();
  });

  it("dateCell wraps the date, or an empty date for an unusable Fecha", () => {
    const good = dateCell("2025-05-28T17:38:18");
    expect(good).toEqual({ kind: "date", value: new Date(Date.UTC(2025, 4, 28)) });
    expect(dateCell("basura")).toEqual({ kind: "date", value: null });
  });
});

describe("cell constructors (XLS-03)", () => {
  it("moneyCell holds the exact 2-decimal string, never a float", () => {
    expect(moneyCell(new Big("-1000"))).toEqual({
      kind: "number",
      value: "-1000.00",
      format: "$#,##0.00",
    });
    expect(moneyCell(new Big("0.005"))).toEqual({
      kind: "number",
      value: "0.01",
      format: "$#,##0.00",
    });
    expect(moneyCell(new Big("1234567890123.455"))).toMatchObject({ value: "1234567890123.46" });
  });

  it("moneyCell never prints a negative zero", () => {
    expect(moneyCell(new Big("-0.001"))).toMatchObject({ value: "0.00" });
  });

  it("unitPriceCell keeps up to 6 decimals", () => {
    expect(unitPriceCell(new Big("12.3456789"))).toEqual({
      kind: "number",
      value: "12.345679",
      format: "$#,##0.00####",
    });
    expect(unitPriceCell(new Big("12.5"))).toMatchObject({ value: "12.5" });
  });

  it("percentCell holds the fraction rounded to 6 decimals", () => {
    expect(percentCell(new Big("0.124"))).toEqual({
      kind: "number",
      value: "0.124",
      format: "0.0%",
    });
    expect(percentCell(new Big("0.12345678"))).toMatchObject({ value: "0.123457" });
  });

  it("countCell holds an integer string", () => {
    expect(countCell(3)).toEqual({ kind: "number", value: "3", format: "#,##0" });
  });

  it("quantityCell trims trailing zeros and keeps up to 6 decimals", () => {
    expect(quantityCell("1.500000")).toEqual({
      kind: "number",
      value: "1.5",
      format: "#,##0.######",
    });
    expect(quantityCell(" 2.000000 ")).toMatchObject({ value: "2" });
  });

  it("quantityCell never throws on junk", () => {
    expect(() => quantityCell("abc")).not.toThrow();
    expect(quantityCell("abc")).toEqual({ kind: "text", value: "abc" });
    expect(quantityCell("  ")).toEqual({ kind: "empty" });
  });

  it("rateCell holds 4 decimals", () => {
    expect(rateCell(new Big("18.2"))).toEqual({
      kind: "number",
      value: "18.2000",
      format: "0.0000",
    });
  });

  it("textCell and emptyCell", () => {
    expect(textCell("ene 2025")).toEqual({ kind: "text", value: "ene 2025" });
    expect(emptyCell()).toEqual({ kind: "empty" });
  });
});
