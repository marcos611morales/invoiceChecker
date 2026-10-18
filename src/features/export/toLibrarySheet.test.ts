import { describe, expect, it } from "vitest";
import type { SheetModel } from "./cellModel";
import { toCell, toLibrarySheet } from "./toLibrarySheet";

describe("toCell (XLS-03)", () => {
  it("maps text to a String cell with the text format", () => {
    expect(toCell({ kind: "text", value: "AAA010101AAA" })).toEqual({
      value: "AAA010101AAA",
      type: String,
      format: "@",
    });
  });

  it("maps an empty string to an empty cell", () => {
    expect(toCell({ kind: "text", value: "" })).toBeNull();
  });

  it("keeps a formula-looking text as a String cell, never a formula", () => {
    expect(toCell({ kind: "text", value: "=1+1" })).toEqual({
      value: "=1+1",
      type: String,
      format: "@",
    });
  });

  it("maps a number to a Number cell with its format", () => {
    expect(toCell({ kind: "number", value: "1234.50", format: "$#,##0.00" })).toEqual({
      value: 1234.5,
      type: Number,
      format: "$#,##0.00",
    });
  });

  it("maps a negative amount", () => {
    expect(toCell({ kind: "number", value: "-10.25", format: "$#,##0.00" })).toEqual({
      value: -10.25,
      type: Number,
      format: "$#,##0.00",
    });
  });

  it.each(["NaN", "Infinity", "-Infinity", "abc"])(
    "writes an empty cell instead of the non-finite number %s",
    (value) => {
      expect(toCell({ kind: "number", value, format: "$#,##0.00" })).toBeNull();
    },
  );

  it("maps a date to a Date cell formatted dd/mm/yyyy", () => {
    const date = new Date(Date.UTC(2025, 4, 28));
    expect(toCell({ kind: "date", value: date })).toEqual({
      value: date,
      type: Date,
      format: "dd/mm/yyyy",
    });
  });

  it("writes an empty cell for a null or invalid date", () => {
    expect(toCell({ kind: "date", value: null })).toBeNull();
    expect(toCell({ kind: "date", value: new Date(Number.NaN) })).toBeNull();
  });

  it("maps an empty cell to null", () => {
    expect(toCell({ kind: "empty" })).toBeNull();
  });
});

const MODEL: SheetModel = {
  name: "Prueba",
  columns: [
    { header: "Nombre", width: 30, wrap: true },
    { header: "Monto (con IVA)", width: 16 },
  ],
  rows: [
    [
      { kind: "text", value: "Café" },
      { kind: "number", value: "10.00", format: "$#,##0.00" },
    ],
    [{ kind: "text", value: "Té" }, { kind: "empty" }],
  ],
  totalRow: [
    { kind: "text", value: "Total" },
    { kind: "number", value: "10.00", format: "$#,##0.00" },
  ],
};

/** The cell at (row, col) when it is a styled cell object; fails the test otherwise. */
function objectCell(
  rows: readonly (readonly unknown[])[],
  row: number,
  col: number,
): Record<string, unknown> {
  const cell = rows[row]?.[col];
  if (typeof cell !== "object" || cell === null) {
    throw new Error(`cell ${row},${col} is not a styled cell object`);
  }
  return { ...cell };
}

describe("toLibrarySheet (XLS-03)", () => {
  const sheet = toLibrarySheet(MODEL);

  it("names the sheet and freezes the header row", () => {
    expect(sheet.sheet).toBe("Prueba");
    expect(sheet.stickyRowsCount).toBe(1);
  });

  it("takes the column widths from the model", () => {
    expect(sheet.columns).toEqual([{ width: 30 }, { width: 16 }]);
  });

  it("writes a bold header on #E5E5E5 that wraps", () => {
    for (const col of [0, 1]) {
      expect(objectCell(sheet.data, 0, col)).toMatchObject({
        type: String,
        fontWeight: "bold",
        backgroundColor: "#E5E5E5",
        wrap: true,
      });
    }
    expect(objectCell(sheet.data, 0, 0)["value"]).toBe("Nombre");
    expect(objectCell(sheet.data, 0, 1)["value"]).toBe("Monto (con IVA)");
  });

  it("wraps the body cells of wrapping columns only", () => {
    expect(objectCell(sheet.data, 1, 0)).toMatchObject({ value: "Café", wrap: true });
    expect(objectCell(sheet.data, 1, 1)["wrap"]).toBeUndefined();
  });

  it("writes an empty body cell as null", () => {
    expect(sheet.data[2]?.[1]).toBeNull();
  });

  it("writes the Total row bold and filled, as the last row", () => {
    expect(sheet.data).toHaveLength(4);
    expect(objectCell(sheet.data, 3, 0)).toMatchObject({
      value: "Total",
      fontWeight: "bold",
      backgroundColor: "#E5E5E5",
    });
    expect(objectCell(sheet.data, 3, 1)).toMatchObject({
      value: 10,
      type: Number,
      format: "$#,##0.00",
      fontWeight: "bold",
      backgroundColor: "#E5E5E5",
    });
  });

  it("has no Total row when the model has none", () => {
    const without = toLibrarySheet({ ...MODEL, totalRow: null });
    expect(without.data).toHaveLength(3);
  });

  it("never lets a non-finite number reach the writer", () => {
    const bad = toLibrarySheet({
      ...MODEL,
      rows: [[{ kind: "number", value: "NaN", format: "#,##0" }, { kind: "empty" }]],
      totalRow: null,
    });
    expect(bad.data[1]?.[0]).toBeNull();
  });
});
