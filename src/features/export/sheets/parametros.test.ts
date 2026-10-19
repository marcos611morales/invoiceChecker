import { describe, expect, it } from "vitest";
import { entriesOf, testContext, viewOf } from "../../../../tests/support/exportFactory";
import type { SheetModel, XCell } from "../cellModel";
import { buildParametros } from "./parametros";

const RANGE = { from: "2025-01", to: "2025-12" };

const ENTRIES = entriesOf([
  { month: "2025-11", con: "116.00", sin: "100.00" },
  { month: "2025-12", con: "232.00", sin: "200.00" },
]);

function text(value: string): XCell {
  return { kind: "text", value };
}

/** The Valor cell of the row whose Parámetro is `label`. */
function valueOf(sheet: SheetModel, label: string): XCell | undefined {
  return sheet.rows.find((row) => {
    const first = row[0];
    return first !== undefined && first.kind === "text" && first.value === label;
  })?.[1];
}

describe("buildParametros (XLS-01)", () => {
  it("lists the parameters in the UI-SPEC order, all as two-column rows", () => {
    const view = viewOf(ENTRIES, RANGE, "con");
    const sheet = buildParametros(view, testContext("con"));
    expect(sheet.name).toBe("Parámetros");
    expect(sheet.columns.map((c) => c.header)).toEqual(["Parámetro", "Valor"]);
    expect(sheet.columns.map((c) => c.width)).toEqual([32, 60]);
    expect(sheet.columns[1]?.wrap).toBe(true);
    expect(sheet.totalRow).toBeNull();
    expect(sheet.rows.map((row) => row[0])).toEqual([
      text("Exportado el"),
      text("Modo de montos"),
      text("Rango de fechas"),
      text("Proveedores"),
      text("Categorías"),
      text("Formas de pago"),
      text("Facturas incluidas en el gasto"),
      text("Gasto total"),
      text("Mes de la variación"),
      text("Nota"),
    ]);
    expect(sheet.rows.every((row) => row.length === 2)).toBe(true);
  });

  it("says Todos, Todas, Todas with no filter and copies the export time unchanged", () => {
    const sheet = buildParametros(viewOf(ENTRIES, RANGE, "con"), testContext("con"));
    expect(valueOf(sheet, "Proveedores")).toEqual(text("Todos"));
    expect(valueOf(sheet, "Categorías")).toEqual(text("Todas"));
    expect(valueOf(sheet, "Formas de pago")).toEqual(text("Todas"));
    expect(valueOf(sheet, "Exportado el")).toEqual(text("17/10/2026 12:00"));
  });

  it("joins the selected names with a comma and a space", () => {
    const ctx = {
      ...testContext("con"),
      supplierLabels: ["Papelería Uno", "Café Dos"],
      categoryLabels: ["Insumos de cafetería"],
      formaLabels: ["Transferencia electrónica de fondos", "Efectivo"],
    };
    const sheet = buildParametros(viewOf(ENTRIES, RANGE, "con"), ctx);
    expect(valueOf(sheet, "Proveedores")).toEqual(text("Papelería Uno, Café Dos"));
    expect(valueOf(sheet, "Categorías")).toEqual(text("Insumos de cafetería"));
    expect(valueOf(sheet, "Formas de pago")).toEqual(
      text("Transferencia electrónica de fondos, Efectivo"),
    );
  });

  it("writes the mode with the wording of the IVA captions", () => {
    const con = buildParametros(viewOf(ENTRIES, RANGE, "con"), testContext("con"));
    expect(valueOf(con, "Modo de montos")).toEqual(text("Con IVA (Total de cada factura)"));
    const sin = buildParametros(viewOf(ENTRIES, RANGE, "sin"), testContext("sin"));
    expect(valueOf(sin, "Modo de montos")).toEqual(
      text("Sin IVA (Subtotal − Descuento + IEPS)"),
    );
  });

  it("states the range, the variation months, the invoice count and the Gasto total", () => {
    const view = viewOf(ENTRIES, RANGE, "con");
    const sheet = buildParametros(view, testContext("con"));
    expect(valueOf(sheet, "Rango de fechas")).toEqual(text("ene 2025 – dic 2025"));
    expect(valueOf(sheet, "Mes de la variación")).toEqual(text("dic 2025 vs. nov 2025"));
    expect(valueOf(sheet, "Facturas incluidas en el gasto")).toEqual({
      kind: "number",
      value: String(view.current.facturas),
      format: "#,##0",
    });
    expect(valueOf(sheet, "Facturas incluidas en el gasto")).toEqual({
      kind: "number",
      value: "2",
      format: "#,##0",
    });
    expect(valueOf(sheet, "Gasto total")).toEqual({
      kind: "number",
      value: "348.00",
      format: "$#,##0.00",
    });
  });

  it("explains excluded invoices and the rounding to cents (D-20, WR-02)", () => {
    // The confirmed copy (user, option-a, 2026-10-18), written out here so the test pins it.
    const note =
      "Las facturas excluidas a mano se listan con Estado «Excluida» y no suman. Cada monto está redondeado a centavos, por lo que la suma de una columna de montos puede diferir en unos centavos del Gasto total y de la fila Total de los resúmenes, que redondean la suma exacta.";
    const con = buildParametros(viewOf(ENTRIES, RANGE, "con"), testContext("con"));
    expect(valueOf(con, "Nota")).toEqual(text(note));
    const sin = buildParametros(viewOf(ENTRIES, RANGE, "sin"), testContext("sin"));
    expect(valueOf(sin, "Nota")).toEqual(text(note));
  });

  it("writes a dash for the range and the variation months when there is no range", () => {
    const sheet = buildParametros(viewOf([], null, "con"), testContext("con"));
    expect(valueOf(sheet, "Rango de fechas")).toEqual(text("—"));
    expect(valueOf(sheet, "Mes de la variación")).toEqual(text("—"));
    expect(valueOf(sheet, "Gasto total")).toEqual({
      kind: "number",
      value: "0.00",
      format: "$#,##0.00",
    });
  });

  it("writes a selected name that starts with = as a text cell (T-03-41)", () => {
    const ctx = { ...testContext("con"), categoryLabels: ["=HYPERLINK(1)"] };
    const sheet = buildParametros(viewOf(ENTRIES, RANGE, "con"), ctx);
    expect(valueOf(sheet, "Categorías")).toEqual(text("=HYPERLINK(1)"));
  });
});
