import Big from "big.js";
import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import type { Concepto, Impuesto, ParsedInvoice } from "@/domain/cfdi/types";
import { SIN_CATEGORIA, defaultSettings, type SettingsData } from "@/domain/settings/types";
import { contextFor, viewFor } from "../../../../tests/support/exportFactory";
import { makeEntry, makeInvoice } from "../../../../tests/support/ledgerFactory";
import type { SheetModel, XCell } from "../cellModel";
import { buildConceptos } from "./conceptos";
import { buildFacturas } from "./facturas";

const RANGE = { from: "2025-01", to: "2025-01" };
const LIMPIEZA = "seed:limpieza-higiene";
const LIMPIEZA_NAME = "Limpieza e higiene";
const RFC = "EMI010101AAA";

// Column positions of the sheet.
const COL = {
  uuid: 4,
  estado: 5,
  descripcion: 6,
  cantidad: 7,
  unidad: 8,
  clave: 9,
  precio: 10,
  monto: 11,
  importe: 12,
  descuento: 13,
  iva: 14,
  ieps: 15,
  categoria: 16,
  origen: 17,
} as const;

function tax(impuesto: string, importe: string): Impuesto {
  return { base: null, impuesto, tipoFactor: "Tasa", tasaOCuota: null, importe };
}

function money(value: string): XCell {
  return { kind: "number", value, format: "$#,##0.00" };
}

function text(value: string): XCell {
  return { kind: "text", value };
}

const EMPTY: XCell = { kind: "empty" };

function line(descripcion: string, importe: string, overrides: Partial<Concepto> = {}): Concepto {
  return {
    claveProdServ: "47121701",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: "Pieza",
    descripcion,
    valorUnitario: importe,
    importe,
    descuento: null,
    objetoImp: null,
    traslados: [],
    retenciones: [],
    ...overrides,
  };
}

function invoiceOf(overrides: Partial<ParsedInvoice>): ParsedInvoice {
  return makeInvoice({ emisor: { rfc: RFC, nombre: "Papelería Uno" }, ...overrides });
}

function entryOf(invoice: ParsedInvoice, overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return makeEntry({ invoice, ...overrides });
}

function settingsWith(overrides: Partial<SettingsData>): SettingsData {
  return { ...defaultSettings(), ...overrides };
}

const SUPPLIER_IN_LIMPIEZA = [{ rfc: RFC, name: "Papelería Uno", categoryId: LIMPIEZA }];

function sheetFor(
  ledger: readonly LedgerEntry[],
  settings: SettingsData,
  mode: "con" | "sin" = "con",
  selected: readonly string[] = [],
): SheetModel {
  return buildConceptos(
    viewFor(ledger, RANGE, mode, settings, selected),
    contextFor(settings, mode),
  );
}

function cell(sheet: SheetModel, row: number, col: number): XCell | undefined {
  return sheet.rows[row]?.[col];
}

describe("buildConceptos (D-20 to D-22, Q6)", () => {
  const roundingInvoice = entryOf(
    invoiceOf({
      uuid: "BBBBBBBB-0000-4000-8000-000000000001",
      fecha: "2025-01-15T00:00:00",
      folio: "A1",
      conceptos: [line("Uno", "10.004"), line("Dos", "20.004"), line("Tres", "30.004")],
    }),
    { conIva: new Big("60.01"), sinIva: new Big("60.01") },
  );

  it("adds a «Diferencia de redondeo» line so the Monto cells add up to the invoice", () => {
    const settings = settingsWith({ supplierCategories: SUPPLIER_IN_LIMPIEZA });
    const sheet = sheetFor([roundingInvoice], settings);
    expect(sheet.rows).toHaveLength(4);
    expect(sheet.rows.map((row) => row[COL.monto])).toEqual([
      money("10.00"),
      money("20.00"),
      money("30.00"),
      money("0.01"),
    ]);
    const rounding = sheet.rows[3];
    expect(rounding?.[COL.descripcion]).toEqual(text("Diferencia de redondeo"));
    expect(rounding?.[COL.categoria]).toEqual(text(LIMPIEZA_NAME));
    expect(rounding?.[COL.origen]).toEqual(text("Del proveedor"));
    expect(rounding?.slice(COL.cantidad, COL.monto)).toEqual([EMPTY, EMPTY, EMPTY, EMPTY]);
    expect(rounding?.slice(COL.importe, COL.ieps + 1)).toEqual([EMPTY, EMPTY, EMPTY, EMPTY]);
    expect(rounding?.[COL.uuid]).toEqual(text(roundingInvoice.uuid));
  });

  it("files the rounding line under «Sin categoría» when the supplier has no category", () => {
    const sheet = sheetFor([roundingInvoice], defaultSettings());
    expect(sheet.rows[3]?.[COL.categoria]).toEqual(text("Sin categoría"));
    expect(sheet.rows[3]?.[COL.origen]).toEqual(text("Sin categoría"));
  });

  it("adds no rounding line when the lines add up exactly", () => {
    const exact = entryOf(
      invoiceOf({ conceptos: [line("Uno", "10.00"), line("Dos", "20.00")] }),
      { conIva: new Big("30.00"), sinIva: new Big("30.00") },
    );
    const sheet = sheetFor([exact], defaultSettings());
    expect(sheet.rows).toHaveLength(2);
  });

  it("shows the category and where it came from on every line", () => {
    const settings = settingsWith({
      supplierCategories: SUPPLIER_IN_LIMPIEZA,
      conceptRules: [
        { rfc: RFC, key: "papel", description: "Papel", categoryId: null },
        { rfc: RFC, key: "jabon", description: "Jabon", categoryId: "seed:otros" },
      ],
    });
    const entry = entryOf(
      invoiceOf({
        conceptos: [line("Cloro", "10.00"), line("Papel", "20.00"), line("Jabon", "30.00")],
      }),
      { conIva: new Big("60.00"), sinIva: new Big("60.00") },
    );
    const sheet = sheetFor([entry], settings);
    expect(sheet.rows.map((row) => [row[COL.categoria], row[COL.origen]])).toEqual([
      [text(LIMPIEZA_NAME), text("Del proveedor")],
      [text("Sin categoría"), text("Ajuste del concepto")],
      [text("Otros"), text("Ajuste del concepto")],
    ]);
    const none = sheetFor([entry], defaultSettings());
    expect(none.rows.map((row) => [row[COL.categoria], row[COL.origen]])).toEqual([
      [text("Sin categoría"), text("Sin categoría")],
      [text("Sin categoría"), text("Sin categoría")],
      [text("Sin categoría"), text("Sin categoría")],
    ]);
  });

  it("writes lines of a Pago and of an excluded invoice with Monto 0.00, their category and no rounding line", () => {
    const settings = settingsWith({ supplierCategories: SUPPLIER_IN_LIMPIEZA });
    const pago = entryOf(
      invoiceOf({
        uuid: "BBBBBBBB-0000-4000-8000-000000000002",
        tipo: "P",
        moneda: "XXX",
        fecha: "2025-01-02T00:00:00",
        conceptos: [line("Pago", "0")],
      }),
      { kind: "pago", noSuma: "tipo", counted: false, conIva: null, sinIva: null },
    );
    const excluded = entryOf(
      invoiceOf({
        uuid: "BBBBBBBB-0000-4000-8000-000000000003",
        fecha: "2025-01-03T00:00:00",
        conceptos: [line("Cloro", "10.004")],
      }),
      { exclusion: "manual", counted: false, conIva: new Big("10.01"), sinIva: new Big("10.01") },
    );
    const sheet = sheetFor([excluded, pago], settings);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows.map((row) => row[COL.estado])).toEqual([
      text("No suma: Pago"),
      text("Excluida"),
    ]);
    expect(sheet.rows.map((row) => row[COL.monto])).toEqual([money("0.00"), money("0.00")]);
    expect(sheet.rows.map((row) => row[COL.categoria])).toEqual([
      text(LIMPIEZA_NAME),
      text(LIMPIEZA_NAME),
    ]);
    expect(sheet.rows.map((row) => row[COL.origen])).toEqual([
      text("Del proveedor"),
      text("Del proveedor"),
    ]);
  });

  it("keeps only the lines of the chosen categories and the rounding line only for the supplier's category", () => {
    const settings = settingsWith({
      supplierCategories: SUPPLIER_IN_LIMPIEZA,
      conceptRules: [{ rfc: RFC, key: "papel", description: "Papel", categoryId: null }],
    });
    const entry = entryOf(
      invoiceOf({ conceptos: [line("Cloro", "60.00"), line("Papel", "40.00")] }),
      { conIva: new Big("100.01"), sinIva: new Big("100.01") },
    );
    const limpieza = sheetFor([entry], settings, "con", [LIMPIEZA]);
    expect(limpieza.rows.map((row) => row[COL.descripcion])).toEqual([
      text("Cloro"),
      text("Diferencia de redondeo"),
    ]);
    expect(limpieza.rows.map((row) => row[COL.monto])).toEqual([money("60.00"), money("0.01")]);

    const sinCategoria = sheetFor([entry], settings, "con", [SIN_CATEGORIA]);
    expect(sinCategoria.rows.map((row) => row[COL.descripcion])).toEqual([text("Papel")]);
  });

  it("writes quantity, unit price, unit and clave with the cell types of the contract", () => {
    const entry = entryOf(
      invoiceOf({
        conceptos: [
          line("Cafe", "25.00", { cantidad: "2.5", valorUnitario: "10.000000", unidad: "Kilo" }),
          line("Servicio", "5.00", { unidad: null, claveUnidad: "E48", claveProdServ: "00123" }),
        ],
      }),
      { conIva: new Big("30.00"), sinIva: new Big("30.00") },
    );
    const sheet = sheetFor([entry], defaultSettings());
    expect(cell(sheet, 0, COL.cantidad)).toEqual({
      kind: "number",
      value: "2.5",
      format: "#,##0.######",
    });
    expect(cell(sheet, 0, COL.precio)).toEqual({
      kind: "number",
      value: "10",
      format: "$#,##0.00####",
    });
    expect(cell(sheet, 0, COL.unidad)).toEqual(text("Kilo"));
    expect(cell(sheet, 1, COL.unidad)).toEqual(text("E48"));
    expect(cell(sheet, 1, COL.clave)).toEqual(text("00123"));
  });

  it("writes a description beginning with = as a text cell", () => {
    const entry = entryOf(invoiceOf({ conceptos: [line("=SUMA(A1)", "10.00")] }), {
      conIva: new Big("10.00"),
      sinIva: new Big("10.00"),
    });
    const sheet = sheetFor([entry], defaultSettings());
    expect(cell(sheet, 0, COL.descripcion)).toEqual({ kind: "text", value: "=SUMA(A1)" });
  });

  it("gives a credit note line a negative Monto and positive breakdown figures", () => {
    const entry = entryOf(
      invoiceOf({
        tipo: "E",
        conceptos: [
          line("Devolucion", "50.00", {
            descuento: "5.00",
            traslados: [tax("002", "7.20"), tax("003", "1.00")],
          }),
        ],
      }),
      { kind: "nota-credito", conIva: new Big("-53.20"), sinIva: new Big("-46.00") },
    );
    const sheet = sheetFor([entry], defaultSettings());
    expect(cell(sheet, 0, COL.monto)).toEqual(money("-53.20"));
    expect(cell(sheet, 0, COL.importe)).toEqual(money("50.00"));
    expect(cell(sheet, 0, COL.descuento)).toEqual(money("5.00"));
    expect(cell(sheet, 0, COL.iva)).toEqual(money("7.20"));
    expect(cell(sheet, 0, COL.ieps)).toEqual(money("1.00"));
  });

  it("titles the columns in the UI-SPEC order with the contract widths", () => {
    const sheet = sheetFor([roundingInvoice], defaultSettings());
    expect(sheet.name).toBe("Conceptos");
    expect(sheet.columns.map((c) => c.header)).toEqual([
      "Fecha",
      "Proveedor",
      "RFC emisor",
      "Folio",
      "UUID",
      "Estado",
      "Descripción",
      "Cantidad",
      "Unidad",
      "ClaveProdServ",
      "Precio unitario",
      "Monto (con IVA)",
      "Importe",
      "Descuento",
      "IVA",
      "IEPS",
      "Categoría",
      "Origen de la categoría",
    ]);
    expect(sheet.columns[COL.descripcion]).toMatchObject({ width: 50, wrap: true });
    expect(sheet.columns[COL.categoria]?.width).toBe(32);
    expect(sheetFor([roundingInvoice], defaultSettings(), "sin").columns[COL.monto]?.header).toBe(
      "Monto (sin IVA)",
    );
    expect(sheet.totalRow).toBeNull();
  });

  it("follows the order of Facturas: Fecha, then folio, lines in XML order", () => {
    const later = entryOf(
      invoiceOf({
        fecha: "2025-01-20T00:00:00",
        conceptos: [line("Z", "1.00"), line("A", "2.00")],
      }),
      { conIva: new Big("3.00"), sinIva: new Big("3.00") },
    );
    const earlier = entryOf(
      invoiceOf({ fecha: "2025-01-05T00:00:00", conceptos: [line("M", "1.00")] }),
      { conIva: new Big("1.00"), sinIva: new Big("1.00") },
    );
    const sheet = sheetFor([later, earlier], defaultSettings());
    expect(sheet.rows.map((row) => row[COL.descripcion])).toEqual([text("M"), text("Z"), text("A")]);
  });
});

describe("Conceptos reconciles with Facturas (D-13, research Pitfall 10, T-03-29)", () => {
  function sumOf(cells: readonly (XCell | undefined)[]): Big {
    let total = new Big("0");
    for (const c of cells) {
      if (c !== undefined && c.kind === "number") total = total.plus(c.value);
    }
    return total;
  }

  function mixedLedger(): LedgerEntry[] {
    const mix: LedgerEntry[] = [];
    for (let i = 0; i < 24; i += 1) {
      const a = `${10 + i}.${String((i * 7) % 10)}${String((i * 3) % 10)}${String(i % 10)}`;
      const b = `${5 + i}.${String((i * 5) % 10)}${String((i * 9) % 10)}${String((i + 4) % 10)}`;
      const c = `${1 + i}.${String((i * 11) % 10)}${String((i * 2) % 10)}${String((i + 7) % 10)}`;
      // The invoice total is the rounded sum of the lines, off by -0.01, 0 or +0.01.
      const total = new Big(a)
        .plus(b)
        .plus(c)
        .round(2, Big.roundHalfUp)
        .plus(String(((i % 3) - 1) / 100));
      mix.push(
        entryOf(
          invoiceOf({
            uuid: `CCCCCCCC-0000-4000-8000-${String(i).padStart(12, "0")}`,
            fecha: `2025-01-${String(1 + (i % 28)).padStart(2, "0")}T00:00:00`,
            folio: String(i),
            conceptos: [line("Uno", a), line("Dos", b), line("Tres", c)],
          }),
          { conIva: total, sinIva: total },
        ),
      );
    }
    mix.push(
      entryOf(
        invoiceOf({
          uuid: "CCCCCCCC-0000-4000-8000-999999999999",
          conceptos: [line("Excluida", "10.00")],
        }),
        { exclusion: "manual", counted: false },
      ),
    );
    return mix;
  }

  /** Checks every Facturas row against the sum of its Conceptos rows; returns the rows checked. */
  function expectReconciled(
    ledger: readonly LedgerEntry[],
    settings: SettingsData,
    selected: readonly string[] = [],
  ): number {
    const view = viewFor(ledger, RANGE, "con", settings, selected);
    const ctx = contextFor(settings, "con");
    const conceptos = buildConceptos(view, ctx);
    const facturas = buildFacturas(view, ctx);
    let checked = 0;
    for (const row of facturas.rows) {
      const uuid = row[COL.uuid];
      const monto = row[8];
      if (uuid === undefined || uuid.kind !== "text" || monto === undefined) continue;
      const lines = conceptos.rows.filter((r) => {
        const c = r[COL.uuid];
        return c !== undefined && c.kind === "text" && c.value === uuid.value;
      });
      expect(lines.length).toBeGreaterThan(0);
      const total = sumOf(lines.map((r) => r[COL.monto]));
      expect(total.toFixed(2)).toBe(sumOf([monto]).toFixed(2));
      checked += 1;
    }
    return checked;
  }

  it("adds up, for every summing invoice of a mix, to its Monto in Facturas", () => {
    const mix = mixedLedger();
    const settings = settingsWith({ supplierCategories: SUPPLIER_IN_LIMPIEZA });
    expect(expectReconciled(mix, settings)).toBe(mix.length);
  });

  it("still adds up to the partial Monto of each invoice under a category filter (user decision 2026-10-18)", () => {
    const mix = mixedLedger();
    const settings = settingsWith({
      supplierCategories: SUPPLIER_IN_LIMPIEZA,
      conceptRules: [{ rfc: RFC, key: "dos", description: "Dos", categoryId: null }],
    });
    // Limpieza keeps «Uno» and «Tres» plus the invoice remainder; «Sin categoría» keeps «Dos».
    expect(expectReconciled(mix, settings, [LIMPIEZA])).toBeGreaterThan(0);
    expect(expectReconciled(mix, settings, [SIN_CATEGORIA])).toBeGreaterThan(0);
  });
});
