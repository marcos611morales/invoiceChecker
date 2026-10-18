import Big from "big.js";
import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { defaultSettings } from "@/domain/settings/types";
import { contextFor, viewFor } from "../../../../tests/support/exportFactory";
import { makeEntry, makeInvoice } from "../../../../tests/support/ledgerFactory";
import type { SheetModel, XCell } from "../cellModel";
import { buildResumenProveedor } from "./resumenProveedor";

const RANGE = { from: "2025-01", to: "2025-02" };

function money(value: string): XCell {
  return { kind: "number", value, format: "$#,##0.00" };
}

function percent(value: string): XCell {
  return { kind: "number", value, format: "0.0%" };
}

function count(value: string): XCell {
  return { kind: "number", value, format: "#,##0" };
}

function text(value: string): XCell {
  return { kind: "text", value };
}

const EMPTY: XCell = { kind: "empty" };

function entryOf(
  rfc: string,
  name: string,
  month: string,
  con: string,
  kind: LedgerEntry["kind"] = "ingreso",
): LedgerEntry {
  const invoice = makeInvoice({ emisor: { rfc, nombre: name } });
  return makeEntry({
    invoice,
    kind,
    conIva: new Big(con),
    sinIva: new Big(con),
    supplierRfc: rfc,
    supplierName: name,
    month,
    ownMonth: month,
  });
}

function sheetFor(ledger: readonly LedgerEntry[], mode: "con" | "sin" = "con"): SheetModel {
  const settings = defaultSettings();
  return buildResumenProveedor(viewFor(ledger, RANGE, mode, settings), contextFor(settings, mode));
}

describe("buildResumenProveedor (D-23, A-1)", () => {
  it("lists RFC and name as text with amount, share, invoices and ticket", () => {
    const ledger = [
      entryOf("AAA010101AAA", "Alfa", "2025-01", "300.00"),
      entryOf("AAA010101AAA", "Alfa", "2025-02", "100.00"),
      entryOf("BBB010101BBB", "Beta", "2025-02", "100.00"),
    ];
    const sheet = sheetFor(ledger);
    expect(sheet.name).toBe("Resumen por proveedor");
    expect(sheet.rows).toEqual([
      [
        text("AAA010101AAA"),
        text("Alfa"),
        money("400.00"),
        percent("0.8"),
        count("2"),
        money("200.00"),
      ],
      [
        text("BBB010101BBB"),
        text("Beta"),
        money("100.00"),
        percent("0.2"),
        count("1"),
        money("100.00"),
      ],
    ]);
  });

  it("lists every supplier, not only the top 10", () => {
    const ledger = Array.from({ length: 12 }, (_, index) =>
      entryOf(
        `SUP${String(index).padStart(9, "0")}`,
        `Proveedor ${String(index)}`,
        "2025-01",
        "100.00",
      ),
    );
    expect(sheetFor(ledger).rows).toHaveLength(12);
  });

  it("titles the columns with the mode and sets the UI-SPEC widths", () => {
    const sheet = sheetFor([entryOf("AAA010101AAA", "Alfa", "2025-01", "100.00")]);
    expect(sheet.columns.map((c) => c.header)).toEqual([
      "RFC",
      "Proveedor",
      "Monto (con IVA)",
      "% del total",
      "Facturas",
      "Ticket promedio",
    ]);
    expect(sheet.columns.map((c) => c.width)).toEqual([16, 36, 16, 12, 12, 16]);
    expect(sheetFor([], "sin").columns[2]?.header).toBe("Monto (sin IVA)");
  });

  it("ends with a Total row read from the Dashboard KPIs (A-1)", () => {
    const ledger = [
      entryOf("AAA010101AAA", "Alfa", "2025-01", "300.00"),
      entryOf("BBB010101BBB", "Beta", "2025-02", "100.00"),
    ];
    const settings = defaultSettings();
    const view = viewFor(ledger, RANGE, "con", settings);
    const sheet = buildResumenProveedor(view, contextFor(settings, "con"));
    expect(sheet.totalRow).toEqual([
      text("Total"),
      EMPTY,
      money("400.00"),
      percent("1"),
      count("2"),
      money("200.00"),
    ]);
    expect(view.current.facturas).toBe(2);
  });

  it("leaves share and ticket empty when the total is not above zero", () => {
    const ledger = [entryOf("BBB010101BBB", "Beta", "2025-02", "-58.00", "nota-credito")];
    const sheet = sheetFor(ledger);
    expect(sheet.totalRow?.[2]).toEqual(money("-58.00"));
    expect(sheet.totalRow?.[3]).toEqual(EMPTY);
    expect(sheet.rows[0]?.[3]).toEqual(EMPTY);
  });

  it("writes only the header and the Total row when there are no suppliers", () => {
    const sheet = sheetFor([]);
    expect(sheet.rows).toEqual([]);
    expect(sheet.totalRow).toEqual([text("Total"), EMPTY, money("0.00"), EMPTY, count("0"), EMPTY]);
  });

  it("writes a supplier name that starts with = as a text cell (T-03-41)", () => {
    const sheet = sheetFor([entryOf("AAA010101AAA", "=HYPERLINK(1)", "2025-01", "100.00")]);
    expect(sheet.rows[0]?.[1]).toEqual(text("=HYPERLINK(1)"));
  });
});
