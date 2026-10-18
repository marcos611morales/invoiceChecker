import Big from "big.js";
import { describe, expect, it } from "vitest";
import { PPD_SIN_COMPLEMENTO, type LedgerEntry } from "@/domain/accounting/ledger";
import type { Impuesto, ParsedInvoice } from "@/domain/cfdi/types";
import { defaultSettings, type SettingsData } from "@/domain/settings/types";
import { formaPagoLabel } from "@/lib/format";
import { contextFor, viewFor } from "../../../../tests/support/exportFactory";
import { makeEntry, makeInvoice } from "../../../../tests/support/ledgerFactory";
import type { XCell } from "../cellModel";
import { buildFacturas, sortEntriesForExport } from "./facturas";

const RANGE = { from: "2025-01", to: "2025-01" };
const LIMPIEZA = "seed:limpieza-higiene";

function tax(impuesto: string, importe: string): Impuesto {
  return { base: null, impuesto, tipoFactor: "Tasa", tasaOCuota: null, importe };
}

function money(value: string): XCell {
  return { kind: "number", value, format: "$#,##0.00" };
}

function text(value: string): XCell {
  return { kind: "text", value };
}

function invoiceOf(overrides: Partial<ParsedInvoice>): ParsedInvoice {
  return makeInvoice({
    emisor: { rfc: "EMI010101AAA", nombre: "Papelería Uno" },
    ...overrides,
  });
}

function entryOf(invoice: ParsedInvoice, overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return makeEntry({ invoice, ...overrides });
}

const ingreso = entryOf(
  invoiceOf({
    uuid: "AAAAAAAA-0000-4000-8000-000000000001",
    fecha: "2025-01-20T10:00:00",
    folio: "00123",
    subTotal: "100.00",
    total: "116.00",
    impuestos: { traslados: [tax("002", "16.00")], retenciones: [] },
  }),
  { conIva: new Big("116.00"), sinIva: new Big("100.00") },
);

const notaCredito = entryOf(
  invoiceOf({
    uuid: "AAAAAAAA-0000-4000-8000-000000000002",
    tipo: "E",
    fecha: "2025-01-10T09:00:00",
    folio: "7",
    subTotal: "50.00",
    total: "58.00",
    impuestos: { traslados: [tax("002", "8.00")], retenciones: [] },
  }),
  { kind: "nota-credito", conIva: new Big("-58.00"), sinIva: new Big("-50.00") },
);

const pago = entryOf(
  invoiceOf({
    uuid: "AAAAAAAA-0000-4000-8000-000000000003",
    tipo: "P",
    fecha: "2025-01-05T08:00:00",
    folio: null,
    moneda: "XXX",
    subTotal: "0",
    total: "0",
  }),
  { kind: "pago", noSuma: "tipo", counted: false, conIva: null, sinIva: null, formas: ["99"] },
);

const excluida = entryOf(
  invoiceOf({
    uuid: "AAAAAAAA-0000-4000-8000-000000000004",
    fecha: "2025-01-20T10:00:00",
    folio: "100",
    subTotal: "200.00",
    total: "232.00",
  }),
  { exclusion: "manual", counted: false, conIva: new Big("232.00"), sinIva: new Big("200.00") },
);

const LEDGER = [ingreso, excluida, pago, notaCredito];

function sheetOf(mode: "con" | "sin" = "con", settings: SettingsData = defaultSettings()) {
  const view = viewFor(LEDGER, RANGE, mode, settings);
  return buildFacturas(view, contextFor(settings, mode));
}

describe("buildFacturas (D-20, D-22)", () => {
  it("lists every invoice of the filters ordered by Fecha then folio", () => {
    const sheet = sheetOf();
    expect(sheet.name).toBe("Facturas");
    expect(sheet.rows.map((row) => row[4])).toEqual([
      text(pago.uuid),
      text(notaCredito.uuid),
      text(ingreso.uuid),
      text(excluida.uuid),
    ]);
  });

  it("titles the columns in the UI-SPEC order with the widths of the contract", () => {
    const sheet = sheetOf();
    expect(sheet.columns.map((c) => c.header)).toEqual([
      "Fecha",
      "Proveedor",
      "RFC emisor",
      "Folio",
      "UUID",
      "Tipo",
      "Estado",
      "Forma de pago",
      "Monto (con IVA)",
      "Subtotal",
      "Descuento",
      "IVA",
      "IEPS",
      "Total",
      "Moneda",
      "Tipo de cambio",
    ]);
    expect(sheet.columns.map((c) => c.width)).toEqual([
      12, 36, 16, 14, 38, 16, 34, 32, 16, 16, 16, 16, 16, 16, 12, 12,
    ]);
    expect(sheet.totalRow).toBeNull();
  });

  it("writes Monto as the amount of the rows that sum and 0.00 for the rest", () => {
    const sheet = sheetOf();
    expect(sheet.rows.map((row) => row[8])).toEqual([
      money("0.00"),
      money("-58.00"),
      money("116.00"),
      money("0.00"),
    ]);
  });

  it("reads Estado with the shared texts", () => {
    const sheet = sheetOf();
    expect(sheet.rows.map((row) => row[6])).toEqual([
      text("No suma: Pago"),
      text("Suma"),
      text("Suma"),
      text("Excluida"),
    ]);
  });

  it("writes Fecha as a date and RFC, UUID and Folio as text, keeping a folio such as 00123", () => {
    const row = sheetOf().rows[2];
    expect(row?.[0]).toEqual({ kind: "date", value: new Date(Date.UTC(2025, 0, 20)) });
    expect(row?.[1]).toEqual(text("Papelería Uno"));
    expect(row?.[2]).toEqual(text("EMI010101AAA"));
    expect(row?.[3]).toEqual(text("00123"));
    expect(row?.[4]).toEqual(text(ingreso.uuid));
    expect(row?.[5]).toEqual(text("Ingreso"));
    expect(sheetOf().rows[0]?.[3]).toEqual({ kind: "empty" });
  });

  it("joins the formas de pago with their SAT names", () => {
    expect(sheetOf().rows[0]?.[7]).toEqual(text(formaPagoLabel("99")));
    const two = entryOf(invoiceOf({ fecha: "2025-01-02T00:00:00" }), {
      formas: ["01", PPD_SIN_COMPLEMENTO],
    });
    const settings = defaultSettings();
    const sheet = buildFacturas(viewFor([two], RANGE, "con", settings), contextFor(settings, "con"));
    expect(sheet.rows[0]?.[7]).toEqual(
      text(`${formaPagoLabel("01")}, Por definir (sin complemento de pago)`),
    );
  });

  it("writes the XML breakdown of an MXN invoice with empty Tipo de cambio", () => {
    const row = sheetOf().rows[2];
    expect(row?.slice(9)).toEqual([
      money("100.00"),
      { kind: "empty" },
      money("16.00"),
      money("0.00"),
      money("116.00"),
      text("MXN"),
      { kind: "empty" },
    ]);
  });

  it("keeps the breakdown of a credit note positive while Monto is negative", () => {
    const row = sheetOf().rows[1];
    expect(row?.[8]).toEqual(money("-58.00"));
    expect(row?.[9]).toEqual(money("50.00"));
    expect(row?.[13]).toEqual(money("58.00"));
  });

  it("converts a foreign currency invoice and shows its Moneda and Tipo de cambio", () => {
    const usd = entryOf(
      invoiceOf({
        uuid: "AAAAAAAA-0000-4000-8000-000000000005",
        moneda: "USD",
        tipoCambio: "18.5",
        subTotal: "10.00",
        total: "11.60",
        impuestos: { traslados: [tax("002", "1.60")], retenciones: [] },
      }),
      { conIva: new Big("214.60"), sinIva: new Big("185.00") },
    );
    const settings = defaultSettings();
    const sheet = buildFacturas(viewFor([usd], RANGE, "con", settings), contextFor(settings, "con"));
    expect(sheet.rows[0]?.slice(8)).toEqual([
      money("214.60"),
      money("185.00"),
      { kind: "empty" },
      money("29.60"),
      money("0.00"),
      money("214.60"),
      text("USD"),
      { kind: "number", value: "18.5000", format: "0.0000" },
    ]);
  });

  it("leaves the breakdown empty when the foreign rate is unusable", () => {
    const broken = entryOf(
      invoiceOf({ uuid: "AAAAAAAA-0000-4000-8000-000000000006", moneda: "USD", tipoCambio: null }),
      { noSuma: "moneda-sin-tc", counted: false, conIva: null, sinIva: null },
    );
    const settings = defaultSettings();
    const sheet = buildFacturas(
      viewFor([broken], RANGE, "con", settings),
      contextFor(settings, "con"),
    );
    expect(sheet.rows[0]?.[6]).toEqual(text("No suma: moneda sin tipo de cambio"));
    expect(sheet.rows[0]?.[8]).toEqual(money("0.00"));
    expect(sheet.rows[0]?.slice(9, 14)).toEqual(Array.from({ length: 5 }, () => ({ kind: "empty" })));
    expect(sheet.rows[0]?.[14]).toEqual(text("USD"));
    expect(sheet.rows[0]?.[15]).toEqual({ kind: "empty" });
  });

  it("follows the Sin IVA values with the Sin IVA header", () => {
    const sheet = sheetOf("sin");
    expect(sheet.columns[8]?.header).toBe("Monto (sin IVA)");
    expect(sheet.rows.map((row) => row[8])).toEqual([
      money("0.00"),
      money("-50.00"),
      money("100.00"),
      money("0.00"),
    ]);
  });

  it("puts an invoice without folio after those with one on the same Fecha", () => {
    const withFolio = entryOf(invoiceOf({ fecha: "2025-01-02T00:00:00", folio: "9" }));
    const noFolio = entryOf(invoiceOf({ fecha: "2025-01-02T00:00:00", folio: null }));
    const emptyFolio = entryOf(invoiceOf({ fecha: "2025-01-02T00:00:00", folio: "" }));
    const sorted = sortEntriesForExport(
      [noFolio, emptyFolio, withFolio].map((entry) => ({
        ...entry,
        fullConIva: entry.conIva,
        fullSinIva: entry.sinIva,
        parts: [],
      })),
    );
    expect(sorted[0]?.uuid).toBe(withFolio.uuid);
  });
});

describe("buildFacturas under a category filter (D-21, D-27)", () => {
  const settings: SettingsData = {
    ...defaultSettings(),
    conceptRules: [],
    supplierCategories: [{ rfc: "EMI010101AAA", name: "Papelería Uno", categoryId: LIMPIEZA }],
  };
  const lineA = {
    claveProdServ: "01010101",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion: "Cloro",
    valorUnitario: "60.00",
    importe: "60.00",
    descuento: null,
    objetoImp: null,
    traslados: [],
    retenciones: [],
  };
  const withRule: SettingsData = {
    ...settings,
    conceptRules: [{ rfc: "EMI010101AAA", key: "papel", description: "Papel", categoryId: null }],
  };
  const lineB = { ...lineA, descripcion: "Papel", valorUnitario: "40.00", importe: "40.00" };
  const mixed = entryOf(
    invoiceOf({
      uuid: "AAAAAAAA-0000-4000-8000-000000000007",
      fecha: "2025-01-15T00:00:00",
      subTotal: "100.00",
      total: "100.00",
      conceptos: [lineA, lineB],
    }),
    { conIva: new Big("100.00"), sinIva: new Big("100.00") },
  );

  it("adds the full amount column after Monto and fills the part of the chosen categories", () => {
    const view = viewFor([mixed], RANGE, "con", withRule, [LIMPIEZA]);
    const sheet = buildFacturas(view, contextFor(withRule, "con"));
    expect(sheet.columns.map((c) => c.header).slice(8, 11)).toEqual([
      "Monto (con IVA)",
      "Monto de la factura completa (con IVA)",
      "Subtotal",
    ]);
    expect(sheet.rows).toHaveLength(1);
    expect(sheet.rows[0]?.[8]).toEqual(money("60.00"));
    expect(sheet.rows[0]?.[9]).toEqual(money("100.00"));
    expect(sheet.rows[0]?.[10]).toEqual(money("100.00"));
  });

  it("names the Sin IVA full amount column with the Sin IVA wording", () => {
    const view = viewFor([mixed], RANGE, "sin", withRule, [LIMPIEZA]);
    const sheet = buildFacturas(view, contextFor(withRule, "sin"));
    expect(sheet.columns[9]?.header).toBe("Monto de la factura completa (sin IVA)");
  });

  it("keeps the invoices with any part in the selection and writes 0.00 in the full amount of rows that do not sum", () => {
    const noSumaWithLine = entryOf(
      invoiceOf({
        uuid: "AAAAAAAA-0000-4000-8000-000000000008",
        fecha: "2025-01-16T00:00:00",
        conceptos: [lineA],
      }),
      { exclusion: "manual", counted: false },
    );
    const view = viewFor([mixed, noSumaWithLine], RANGE, "con", withRule, [LIMPIEZA]);
    const sheet = buildFacturas(view, contextFor(withRule, "con"));
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[1]?.[8]).toEqual(money("0.00"));
    expect(sheet.rows[1]?.[9]).toEqual(money("0.00"));
  });

  it("has no full amount column without a selection", () => {
    const view = viewFor([mixed], RANGE, "con", withRule);
    const sheet = buildFacturas(view, contextFor(withRule, "con"));
    expect(sheet.columns.map((c) => c.header)).not.toContain(
      "Monto de la factura completa (con IVA)",
    );
    expect(sheet.columns).toHaveLength(16);
  });
});
