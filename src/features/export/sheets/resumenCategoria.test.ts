import Big from "big.js";
import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { defaultSettings, type SettingsData } from "@/domain/settings/types";
import { contextFor, viewFor } from "../../../../tests/support/exportFactory";
import { makeEntry, makeInvoice } from "../../../../tests/support/ledgerFactory";
import type { SheetModel, XCell } from "../cellModel";
import { buildResumenCategoria } from "./resumenCategoria";

const RANGE = { from: "2025-01", to: "2025-02" };
const LIMPIEZA = "seed:limpieza-higiene";
const RFC_A = "AAA010101AAA";
const RFC_B = "BBB010101BBB";

function money(value: string): XCell {
  return { kind: "number", value, format: "$#,##0.00" };
}

function percent(value: string): XCell {
  return { kind: "number", value, format: "0.0%" };
}

function text(value: string): XCell {
  return { kind: "text", value };
}

const EMPTY: XCell = { kind: "empty" };

function entryOf(
  rfc: string,
  month: string,
  con: string,
  sin: string,
  kind: LedgerEntry["kind"] = "ingreso",
): LedgerEntry {
  const invoice = makeInvoice({ emisor: { rfc, nombre: `Proveedor ${rfc}` } });
  return makeEntry({
    invoice,
    kind,
    conIva: new Big(con),
    sinIva: new Big(sin),
    month,
    ownMonth: month,
  });
}

function settingsWithSupplierA(): SettingsData {
  return {
    ...defaultSettings(),
    supplierCategories: [{ rfc: RFC_A, name: `Proveedor ${RFC_A}`, categoryId: LIMPIEZA }],
  };
}

const LEDGER = [
  entryOf(RFC_A, "2025-01", "116.00", "100.00"),
  entryOf(RFC_A, "2025-02", "232.00", "200.00"),
  entryOf(RFC_B, "2025-02", "58.00", "50.00"),
];

function sheetFor(
  ledger: readonly LedgerEntry[],
  settings: SettingsData,
  mode: "con" | "sin" = "con",
): SheetModel {
  const view = viewFor(ledger, RANGE, mode, settings);
  return buildResumenCategoria(view, contextFor(settings, mode));
}

describe("buildResumenCategoria (D-23, XLS-01)", () => {
  it("repeats the Dashboard rows in the same order, Sin categoría included", () => {
    const settings = settingsWithSupplierA();
    const sheet = sheetFor(LEDGER, settings);
    expect(sheet.name).toBe("Resumen por categoría");
    expect(sheet.rows).toEqual([
      [
        text("Limpieza e higiene"),
        money("348.00"),
        percent("0.857143"),
        money("174.00"),
        percent("1"),
      ],
      [
        text("Sin categoría"),
        money("58.00"),
        percent("0.142857"),
        money("29.00"),
        text("Sin dato del mes anterior"),
      ],
    ]);
    const view = viewFor(LEDGER, RANGE, "con", settings);
    expect(sheet.rows.map((row) => row[0])).toEqual(
      view.categories.map((row) => text(contextFor(settings, "con").nameOf(row.category))),
    );
  });

  it("titles the columns with the mode and sets the UI-SPEC widths", () => {
    const settings = settingsWithSupplierA();
    const con = sheetFor(LEDGER, settings, "con");
    expect(con.columns.map((c) => c.header)).toEqual([
      "Categoría",
      "Monto (con IVA)",
      "% del total",
      "Promedio mensual",
      "Variación % (último mes vs. mes anterior)",
    ]);
    expect(con.columns.map((c) => c.width)).toEqual([32, 16, 12, 16, 16]);
    expect(sheetFor(LEDGER, settings, "sin").columns[1]?.header).toBe("Monto (sin IVA)");
  });

  it("ends with a Total row read from the Dashboard KPIs and an empty variation", () => {
    const settings = settingsWithSupplierA();
    const view = viewFor(LEDGER, RANGE, "con", settings);
    const sheet = buildResumenCategoria(view, contextFor(settings, "con"));
    expect(sheet.totalRow).toEqual([
      text("Total"),
      money("406.00"),
      percent("1"),
      money("203.00"),
      EMPTY,
    ]);
    expect(view.current.gasto.toFixed(2)).toBe("406.00");
    expect(view.current.promedio.toFixed(2)).toBe("203.00");
  });

  it("leaves the 100 % of the Total row empty when the total is not above zero", () => {
    const credit = [entryOf(RFC_B, "2025-02", "-58.00", "-50.00", "nota-credito")];
    const sheet = sheetFor(credit, settingsWithSupplierA());
    expect(sheet.totalRow?.[0]).toEqual(text("Total"));
    expect(sheet.totalRow?.[1]).toEqual(money("-58.00"));
    expect(sheet.totalRow?.[2]).toEqual(EMPTY);
    expect(sheet.totalRow?.[4]).toEqual(EMPTY);
  });

  it("writes only the header and the Total row when there is nothing to show", () => {
    const view = viewFor([], null, "con", defaultSettings());
    const sheet = buildResumenCategoria(view, contextFor(defaultSettings(), "con"));
    expect(sheet.rows).toEqual([]);
    expect(sheet.columns).toHaveLength(5);
    expect(sheet.totalRow).toEqual([text("Total"), money("0.00"), EMPTY, money("0.00"), EMPTY]);
  });

  it("writes a category name that starts with = as a text cell (T-03-41)", () => {
    const settings: SettingsData = {
      ...defaultSettings(),
      categories: [{ id: "user:evil", name: "=HYPERLINK(1)" }],
      supplierCategories: [{ rfc: RFC_A, name: `Proveedor ${RFC_A}`, categoryId: "user:evil" }],
    };
    const sheet = sheetFor(LEDGER, settings);
    expect(sheet.rows[0]?.[0]).toEqual(text("=HYPERLINK(1)"));
  });
});
