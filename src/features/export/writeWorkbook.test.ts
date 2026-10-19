import { describe, expect, it } from "vitest";
import type { Sheet } from "write-excel-file/universal";
import type { SheetModel } from "./cellModel";
import { EXPORT_TIMEOUT_MS, writeWorkbook, type WriterModule } from "./writeWorkbook";

/**
 * A loader that records the sheets the writer library receives (WR-03) and still hands them
 * to the real library, so the file is really written. This lets the tests check what reaches
 * the library without unzipping the result (D-29).
 */
function capturingLoader(): {
  loader: () => Promise<WriterModule>;
  calls: Sheet<Blob>[][];
} {
  const calls: Sheet<Blob>[][] = [];
  const loader = async (): Promise<WriterModule> => {
    const real: WriterModule = await import("write-excel-file/universal");
    return {
      default: (sheets) => {
        calls.push(sheets);
        return real.default(sheets);
      },
    };
  };
  return { loader, calls };
}

async function startsWithPk(blob: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0) === "PK";
}

const MODEL: SheetModel = {
  name: "Resumen por mes",
  columns: [
    { header: "Mes", width: 12 },
    { header: "Monto (con IVA)", width: 16 },
    { header: "Facturas", width: 12 },
  ],
  rows: [
    [
      { kind: "text", value: "ene 2025" },
      { kind: "number", value: "1234.50", format: "$#,##0.00" },
      { kind: "number", value: "3", format: "#,##0" },
    ],
  ],
  totalRow: [
    { kind: "text", value: "Total" },
    { kind: "number", value: "1234.50", format: "$#,##0.00" },
    { kind: "number", value: "3", format: "#,##0" },
  ],
};

describe("writeWorkbook (D-24)", () => {
  it("waits at most 30 seconds", () => {
    expect(EXPORT_TIMEOUT_MS).toBe(30000);
  });

  it("resolves to a Blob that is a zip package (xlsx)", async () => {
    const blob = await writeWorkbook([MODEL]);
    expect(blob).toBeInstanceOf(Blob);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0)).toBe("PK");
  });

  it("writes several sheets, in order (WR-03)", async () => {
    const second: SheetModel = { ...MODEL, name: "Otra" };
    const { loader, calls } = capturingLoader();
    const blob = await writeWorkbook([MODEL, second], EXPORT_TIMEOUT_MS, loader);
    expect(calls).toHaveLength(1);
    const received = calls[0] ?? [];
    expect(received).toHaveLength(2);
    expect(received.map((sheet) => sheet.sheet)).toEqual(["Resumen por mes", "Otra"]);
    expect(received.map((sheet) => sheet.stickyRowsCount)).toEqual([1, 1]);
    expect(await startsWithPk(blob)).toBe(true);
  });

  it("writes every kind of cell, including an empty Total cell and a date (WR-03)", async () => {
    const mixed: SheetModel = {
      name: "Mixta",
      columns: [
        { header: "Fecha", width: 12 },
        { header: "Texto", width: 20, wrap: true },
        { header: "Monto (con IVA)", width: 16 },
      ],
      rows: [
        [
          { kind: "date", value: new Date(Date.UTC(2025, 4, 28)) },
          { kind: "text", value: "=1+1" },
          { kind: "number", value: "NaN", format: "$#,##0.00" },
        ],
        [{ kind: "date", value: null }, { kind: "empty" }, { kind: "empty" }],
      ],
      totalRow: [
        { kind: "text", value: "Total" },
        { kind: "empty" },
        { kind: "number", value: "0.00", format: "$#,##0.00" },
      ],
    };
    const { loader, calls } = capturingLoader();
    const blob = await writeWorkbook([mixed], EXPORT_TIMEOUT_MS, loader);
    expect(calls).toHaveLength(1);
    const received = calls[0] ?? [];
    expect(received).toHaveLength(1);
    const data = received[0]?.data ?? [];
    expect(data).toHaveLength(4);
    const style = { fontWeight: "bold", backgroundColor: "#E5E5E5" };

    // Row 1: a date is a Date cell, formula-looking text stays text, NaN is an empty cell.
    expect(data[1]?.[0]).toEqual({
      value: new Date(Date.UTC(2025, 4, 28)),
      type: Date,
      format: "dd/mm/yyyy",
    });
    expect(data[1]?.[1]).toEqual({ value: "=1+1", type: String, format: "@", wrap: true });
    expect(data[1]?.[2]).toBeNull();

    // Row 2: a null date and the empty cells are empty cells.
    expect(data[2]).toEqual([null, null, null]);

    // Total row: styled text, an empty cell that keeps only the style, a styled number.
    expect(data[3]?.[0]).toEqual({ value: "Total", type: String, format: "@", ...style });
    expect(data[3]?.[1]).toStrictEqual(style);
    expect(data[3]?.[2]).toEqual({ value: 0, type: Number, format: "$#,##0.00", ...style });

    expect(await startsWithPk(blob)).toBe(true);
  });

  it("rejects instead of hanging when the library never settles", async () => {
    const never: WriterModule = {
      default: () => ({ toBlob: () => new Promise<Blob>(() => undefined) }),
    };
    await expect(writeWorkbook([MODEL], 50, () => Promise.resolve(never))).rejects.toThrow(
      "export timeout",
    );
  });

  it("rejects when the library cannot be loaded", async () => {
    await expect(
      writeWorkbook([MODEL], 50, () => Promise.reject(new Error("chunk failed"))),
    ).rejects.toThrow("chunk failed");
  });

  it("rejects when the library throws while writing", async () => {
    const broken: WriterModule = {
      default: () => {
        throw new Error("bad sheet");
      },
    };
    await expect(writeWorkbook([MODEL], 50, () => Promise.resolve(broken))).rejects.toThrow(
      "bad sheet",
    );
  });
});
