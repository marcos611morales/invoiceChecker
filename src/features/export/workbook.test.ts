import { describe, expect, it } from "vitest";
import { entriesOf, testContext, viewOf } from "../../../tests/support/exportFactory";
import { exportFileName } from "./fileName";
import { amountHeader, buildWorkbook } from "./workbook";

describe("exportFileName (D-19, A-3)", () => {
  it("names the file after the range and the IVA mode", () => {
    expect(exportFileName({ from: "2025-01", to: "2025-12" }, "con")).toBe(
      "gastos-2025-01_2025-12-con-iva.xlsx",
    );
    expect(exportFileName({ from: "2025-01", to: "2025-12" }, "sin")).toBe(
      "gastos-2025-01_2025-12-sin-iva.xlsx",
    );
  });

  it("drops the range when there is none", () => {
    expect(exportFileName(null, "con")).toBe("gastos-con-iva.xlsx");
    expect(exportFileName(null, "sin")).toBe("gastos-sin-iva.xlsx");
  });
});

describe("amountHeader", () => {
  it("says which amount the column holds", () => {
    expect(amountHeader("con")).toBe("Monto (con IVA)");
    expect(amountHeader("sin")).toBe("Monto (sin IVA)");
  });
});

describe("buildWorkbook (XLS-01)", () => {
  it("returns exactly the six sheets of XLS-01 in the UI-SPEC order", () => {
    const entries = entriesOf([{ month: "2025-01", con: "116.00", sin: "100.00" }]);
    const view = viewOf(entries, { from: "2025-01", to: "2025-01" }, "con");
    const sheets = buildWorkbook(view, testContext("con"));
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "Facturas",
      "Conceptos",
      "Resumen por categoría",
      "Resumen por proveedor",
      "Resumen por mes",
      "Parámetros",
    ]);
  });
});
