import { describe, expect, it } from "vitest";
import { entriesOf, testContext, viewOf } from "../../../../tests/support/exportFactory";
import { buildResumenMes } from "./resumenMes";

const RANGE = { from: "2025-01", to: "2025-03" };

const ENTRIES = entriesOf([
  { month: "2025-01", con: "116.00", sin: "100.00" },
  { month: "2025-01", con: "232.00", sin: "200.00" },
  { month: "2025-02", con: "-58.00", sin: "-50.00", kind: "nota-credito" },
  { month: "2025-03", con: "58.005", sin: "50.00" },
]);

describe("buildResumenMes (XLS-02, D-23, A-1)", () => {
  it("has one row per calendar month, Mes as text, with months at $0 or negative", () => {
    const view = viewOf(ENTRIES, RANGE, "con");
    const sheet = buildResumenMes(view, testContext("con"));
    expect(sheet.name).toBe("Resumen por mes");
    expect(sheet.rows).toEqual([
      [
        { kind: "text", value: "ene 2025" },
        { kind: "number", value: "348.00", format: "$#,##0.00" },
        { kind: "number", value: "2", format: "#,##0" },
      ],
      [
        { kind: "text", value: "feb 2025" },
        { kind: "number", value: "-58.00", format: "$#,##0.00" },
        { kind: "number", value: "0", format: "#,##0" },
      ],
      [
        { kind: "text", value: "mar 2025" },
        { kind: "number", value: "58.01", format: "$#,##0.00" },
        { kind: "number", value: "1", format: "#,##0" },
      ],
    ]);
  });

  it("titles the columns with the mode and sets widths", () => {
    const con = buildResumenMes(viewOf(ENTRIES, RANGE, "con"), testContext("con"));
    expect(con.columns.map((c) => c.header)).toEqual(["Mes", "Monto (con IVA)", "Facturas"]);
    expect(con.columns.map((c) => c.width)).toEqual([12, 16, 12]);
    const sin = buildResumenMes(viewOf(ENTRIES, RANGE, "sin"), testContext("sin"));
    expect(sin.columns[1]?.header).toBe("Monto (sin IVA)");
  });

  it("ends with a Total row equal to the Dashboard Gasto total and Facturas KPI", () => {
    const view = viewOf(ENTRIES, RANGE, "con");
    const sheet = buildResumenMes(view, testContext("con"));
    expect(sheet.totalRow).toEqual([
      { kind: "text", value: "Total" },
      { kind: "number", value: "348.01", format: "$#,##0.00" },
      { kind: "number", value: "3", format: "#,##0" },
    ]);
    expect(view.current.facturas).toBe(3);
  });

  it("reads the amount of the chosen mode", () => {
    const view = viewOf(ENTRIES, RANGE, "sin");
    const sheet = buildResumenMes(view, testContext("sin"));
    expect(sheet.rows[0]?.[1]).toEqual({ kind: "number", value: "300.00", format: "$#,##0.00" });
    expect(sheet.totalRow?.[1]).toEqual({ kind: "number", value: "300.00", format: "$#,##0.00" });
  });

  it("writes the header and the Total row only when there is no range", () => {
    const view = viewOf([], null, "con");
    const sheet = buildResumenMes(view, testContext("con"));
    expect(sheet.rows).toEqual([]);
    expect(sheet.columns).toHaveLength(3);
    expect(sheet.totalRow).toEqual([
      { kind: "text", value: "Total" },
      { kind: "number", value: "0.00", format: "$#,##0.00" },
      { kind: "number", value: "0", format: "#,##0" },
    ]);
  });
});
