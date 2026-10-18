import { describe, expect, it } from "vitest";
import type { SheetModel } from "./cellModel";
import { EXPORT_TIMEOUT_MS, writeWorkbook, type WriterModule } from "./writeWorkbook";

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

  it("writes several sheets", async () => {
    const second: SheetModel = { ...MODEL, name: "Otra" };
    const blob = await writeWorkbook([MODEL, second]);
    expect(blob.size).toBeGreaterThan(0);
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
