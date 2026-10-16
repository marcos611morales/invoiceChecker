// @vitest-environment jsdom
import Big from "big.js";
import { renderHook } from "@testing-library/react";
import { useTable } from "@tanstack/react-table";
import type { SortingState } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { buildLedger, EMPTY_OVERRIDES, PPD_SIN_COMPLEMENTO } from "@/domain/accounting/ledger";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { loaded, makeEntry, makeInvoice, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";
import {
  buildPaymentIndex,
  columns,
  conceptRows,
  features,
  foreignInfo,
  roundingDifference,
  toInvoiceRows,
} from "./columns";
import type { InvoiceRow } from "./columns";

function concepto(overrides: Partial<Concepto> = {}): Concepto {
  return {
    claveProdServ: "01010101",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion: "Concepto",
    valorUnitario: "100.00",
    importe: "100.00",
    descuento: null,
    objetoImp: null,
    traslados: [],
    retenciones: [],
    ...overrides,
  };
}

function iva(importe: string) {
  return {
    base: null,
    impuesto: "002",
    tipoFactor: "Tasa",
    tasaOCuota: "0.160000",
    importe,
  };
}

function ledgerOf(...invoices: ParsedInvoice[]): LedgerEntry[] {
  return buildLedger(invoices.map(loaded), EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
}

function firstRow(entry: LedgerEntry, mode: "con" | "sin" = "con"): InvoiceRow {
  const row = toInvoiceRows([entry], mode)[0];
  if (row === undefined) throw new Error("no row");
  return row;
}

describe("toInvoiceRows", () => {
  it("keeps every entry, counted or not, with the kind label", () => {
    const entries = ledgerOf(
      makeInvoice({ folio: "A-1" }),
      makeInvoice({ tipo: "E", folio: "E-1" }),
      makeInvoice({ tipo: "P", moneda: "XXX", total: "0", subTotal: "0" }),
    );
    const rows = toInvoiceRows(entries, "con");
    expect(rows.map((r) => r.tipoLabel)).toEqual(["Ingreso", "Nota de crédito", "Pago"]);
    expect(rows.map((r) => r.id)).toEqual(entries.map((e) => e.uuid));
  });

  it("reads the supplier name, the literal Fecha and a missing folio as undefined", () => {
    const row = firstRow(
      makeEntry({
        invoice: makeInvoice({ folio: "", fecha: "2025-03-02T08:00:00" }),
        supplierName: "Proveedor Largo",
      }),
    );
    expect(row.proveedor).toBe("Proveedor Largo");
    expect(row.fecha).toBe("2025-03-02T08:00:00");
    expect(row.folio).toBeUndefined();
    expect(firstRow(makeEntry({ invoice: makeInvoice({ folio: null }) })).folio).toBeUndefined();
    expect(firstRow(makeEntry({ invoice: makeInvoice({ folio: "A-9" }) })).folio).toBe("A-9");
  });

  it("joins the forma de pago names with a comma and labels the PPD sentinel", () => {
    const two = firstRow(makeEntry({ formas: ["03", "04"] }));
    expect(two.formasText).toBe("Transferencia electrónica de fondos, Tarjeta de crédito");
    const ppd = firstRow(makeEntry({ formas: [PPD_SIN_COMPLEMENTO] }));
    expect(ppd.formasText).toBe("Por definir (sin complemento de pago)");
    expect(firstRow(makeEntry({ formas: [] })).formasText).toBe("");
  });

  it("picks the amount of the IVA mode, signed, or undefined without one", () => {
    const entry = makeEntry({ conIva: new Big("116.00"), sinIva: new Big("100.00") });
    expect(firstRow(entry, "con").amount?.toString()).toBe("116");
    expect(firstRow(entry, "sin").amount?.toString()).toBe("100");
    const pago = makeEntry({ kind: "pago", noSuma: "tipo", counted: false, conIva: null, sinIva: null });
    expect(firstRow(pago).amount).toBeUndefined();
  });

  it("derives the row state: no-suma, then excluida, then sustituida, else normal", () => {
    expect(firstRow(makeEntry()).state).toBe("normal");
    expect(firstRow(makeEntry({ noSuma: "cero", counted: false })).state).toBe("no-suma");
    expect(firstRow(makeEntry({ exclusion: "manual", counted: false })).state).toBe("excluida");
    expect(
      firstRow(makeEntry({ exclusion: "sustituida", counted: false, substitutedBy: "X" })).state,
    ).toBe("sustituida");
    expect(
      firstRow(makeEntry({ noSuma: "tipo", exclusion: "manual", counted: false })).state,
    ).toBe("no-suma");
  });

  it("gives a $0 Ingreso an amount of 0 and the state no-suma, and a Pago no amount", () => {
    const [cero, pago] = toInvoiceRows(
      ledgerOf(
        makeInvoice({ total: "0.00", subTotal: "0.00" }),
        makeInvoice({ tipo: "P", moneda: "XXX", total: "0", subTotal: "0" }),
      ),
      "con",
    );
    expect(cero?.state).toBe("no-suma");
    expect(cero?.amount?.toString()).toBe("0");
    expect(pago?.state).toBe("no-suma");
    expect(pago?.amount).toBeUndefined();
  });

  it("marks a substituted original and a manual exclusion from the real ledger", () => {
    const original = makeInvoice({ folio: "O-1" });
    const replacement = makeInvoice({
      folio: "R-1",
      relacionados: [{ tipoRelacion: "04", uuids: [original.uuid] }],
    });
    const entries = buildLedger([loaded(original), loaded(replacement)], EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
    const states = toInvoiceRows(entries, "con").map((r) => r.state);
    expect(states).toEqual(["sustituida", "normal"]);
    const excluded = buildLedger(
      [loaded(original), loaded(replacement)],
      {
        excluded: new Set([replacement.uuid]),
        restored: new Set([original.uuid]),
      },
      TEST_FECHA_CONTEXT,
    );
    expect(toInvoiceRows(excluded, "con").map((r) => r.state)).toEqual(["normal", "excluida"]);
  });
});

describe("conceptRows", () => {
  const invoice = makeInvoice({
    subTotal: "300.00",
    total: "348.00",
    conceptos: [
      concepto({
        descripcion: "Café",
        cantidad: "2.000000",
        valorUnitario: "100.000000",
        importe: "200.00",
        unidad: "Pieza",
        traslados: [iva("32.00")],
      }),
      concepto({
        descripcion: "Leche",
        cantidad: "1.500000",
        claveUnidad: "LTR",
        valorUnitario: "66.666667",
        importe: "100.00",
        traslados: [iva("16.00")],
      }),
    ],
  });

  it("converts each concept by mode with stable index based keys", () => {
    const entry = ledgerOf(invoice)[0];
    if (entry === undefined) throw new Error("no entry");
    const con = conceptRows(entry, "con");
    expect(con.map((c) => c.descripcion)).toEqual(["Café", "Leche"]);
    expect(con.map((c) => c.monto?.toString())).toEqual(["232", "116"]);
    expect(con.map((c) => c.cantidad)).toEqual(["2", "1.5"]);
    const sin = conceptRows(entry, "sin");
    expect(sin.map((c) => c.monto?.toString())).toEqual(["200", "100"]);
    expect(con.map((c) => c.key)).toEqual(["0", "1"]);
    expect(conceptRows(entry, "con").map((c) => c.key)).toEqual(["0", "1"]);
  });

  it("shows the Unidad text, else the ClaveUnidad flagged as a key", () => {
    const entry = ledgerOf(invoice)[0];
    if (entry === undefined) throw new Error("no entry");
    const rows = conceptRows(entry, "con");
    expect(rows[0]).toMatchObject({ unidad: "Pieza", unidadIsClave: false });
    expect(rows[1]).toMatchObject({ unidad: "LTR", unidadIsClave: true });
  });

  it("keeps the unit price in MXN and positive, and the amount negative for a credit note", () => {
    const nota = makeInvoice({
      tipo: "E",
      subTotal: "100.00",
      total: "116.00",
      conceptos: [
        concepto({ valorUnitario: "100.00", importe: "100.00", traslados: [iva("16.00")] }),
      ],
    });
    const entry = ledgerOf(nota)[0];
    if (entry === undefined) throw new Error("no entry");
    const [row] = conceptRows(entry, "con");
    expect(row?.precioUnitario?.toString()).toBe("100");
    expect(row?.monto?.toString()).toBe("-116");
  });

  it("converts a foreign currency concept with the invoice rate", () => {
    const usd = makeInvoice({
      moneda: "USD",
      tipoCambio: "18.20",
      subTotal: "10.00",
      total: "10.00",
      conceptos: [concepto({ valorUnitario: "10.00", importe: "10.00" })],
    });
    const entry = ledgerOf(usd)[0];
    if (entry === undefined) throw new Error("no entry");
    const [row] = conceptRows(entry, "con");
    expect(row?.precioUnitario?.toString()).toBe("182");
    expect(row?.monto?.toString()).toBe("182");
  });

  it("gives a null amount to a concept with an invalid importe", () => {
    const broken = makeInvoice({ conceptos: [concepto({ importe: "abc" })] });
    const entry = makeEntry({ invoice: broken });
    const [row] = conceptRows(entry, "con");
    expect(row?.monto).toBeNull();
  });
});

describe("roundingDifference", () => {
  it("is null when the rounded concept sum equals the rounded invoice amount", () => {
    const invoice = makeInvoice({
      conceptos: [concepto({ importe: "100.00", traslados: [iva("16.00")] })],
    });
    const entry = makeEntry({ invoice, conIva: new Big("116.00"), sinIva: new Big("100.00") });
    expect(roundingDifference(entry, "con")).toBeNull();
    expect(roundingDifference(entry, "sin")).toBeNull();
  });

  it("is the rounded invoice amount minus the rounded concept sum when they differ", () => {
    const invoice = makeInvoice({
      conceptos: [concepto({ importe: "100.00", traslados: [iva("16.00")] })],
    });
    const entry = makeEntry({ invoice, conIva: new Big("116.01"), sinIva: new Big("100.00") });
    expect(roundingDifference(entry, "con")?.toString()).toBe("0.01");
  });

  it("is null when a concept amount or the invoice amount is unusable", () => {
    const broken = makeInvoice({ conceptos: [concepto({ importe: "abc" })] });
    expect(roundingDifference(makeEntry({ invoice: broken }), "con")).toBeNull();
    const pago = makeEntry({ conIva: null, sinIva: null });
    expect(roundingDifference(pago, "con")).toBeNull();
  });
});

describe("foreignInfo", () => {
  it("is null for MXN and for the Pago currency XXX", () => {
    expect(foreignInfo(makeEntry(), "con")).toBeNull();
    expect(foreignInfo(makeEntry({ invoice: makeInvoice({ moneda: "XXX" }) }), "con")).toBeNull();
  });

  it("gives the original amount of the mode and the rate for a converted invoice", () => {
    const usd = makeInvoice({
      moneda: "USD",
      tipoCambio: "18.2",
      subTotal: "86.20",
      total: "100.00",
    });
    const [entry] = ledgerOf(usd);
    if (entry === undefined) throw new Error("no entry");
    expect(foreignInfo(entry, "con")).toEqual({
      moneda: "USD",
      amountText: "100.00",
      tc: "18.20",
    });
    expect(foreignInfo(entry, "sin")?.amountText).toBe("86.20");
  });

  it("has no rate when the TipoCambio is missing", () => {
    const usd = makeInvoice({ moneda: "USD", tipoCambio: null, total: "100.00" });
    const [entry] = ledgerOf(usd);
    if (entry === undefined) throw new Error("no entry");
    expect(foreignInfo(entry, "con")).toEqual({ moneda: "USD", amountText: "100.00", tc: null });
  });

  it("keeps a credit note original amount unsigned", () => {
    const usd = makeInvoice({
      tipo: "E",
      moneda: "USD",
      tipoCambio: "18.20",
      subTotal: "100.00",
      total: "100.00",
    });
    const [entry] = ledgerOf(usd);
    if (entry === undefined) throw new Error("no entry");
    expect(foreignInfo(entry, "con")?.amountText).toBe("100.00");
  });
});

describe("buildPaymentIndex", () => {
  it("maps a paid invoice uuid to every Pago docto that references it", () => {
    const ppd = makeInvoice({ metodoPago: "PPD", formaPago: "99" });
    const other = makeInvoice();
    const pagoA = makeInvoice({
      tipo: "P",
      moneda: "XXX",
      pagos: [
        {
          fechaPago: "2025-03-15T12:00:00",
          formaDePagoP: "04",
          monedaP: "MXN",
          monto: "50.00",
          doctos: [
            { idDocumento: ppd.uuid, monedaDR: "MXN", impPagado: "50.00" },
            { idDocumento: other.uuid, monedaDR: "MXN", impPagado: "1.00" },
          ],
        },
      ],
    });
    const pagoB = makeInvoice({
      tipo: "P",
      moneda: "XXX",
      pagos: [
        {
          fechaPago: "2025-04-01T09:00:00",
          formaDePagoP: "03",
          monedaP: "MXN",
          monto: "66.00",
          doctos: [{ idDocumento: ppd.uuid, monedaDR: "MXN", impPagado: "66.00" }],
        },
      ],
    });
    const index = buildPaymentIndex(ledgerOf(ppd, other, pagoA, pagoB));
    expect(index.get(ppd.uuid)).toEqual([
      { fechaPago: "2025-03-15T12:00:00", formaDePagoP: "04" },
      { fechaPago: "2025-04-01T09:00:00", formaDePagoP: "03" },
    ]);
    expect(index.get(other.uuid)).toEqual([{ fechaPago: "2025-03-15T12:00:00", formaDePagoP: "04" }]);
    expect(index.get(pagoA.uuid)).toBeUndefined();
  });
});

describe("module-scope features and columns", () => {
  /** The displayed rows of a real useTable instance sorted as asked. */
  function sortedRows(data: InvoiceRow[], sorting: SortingState): InvoiceRow[] {
    const { result } = renderHook(() =>
      useTable({
        features,
        columns,
        data,
        getRowId: (row) => row.id,
        state: { sorting },
      }),
    );
    return result.current.getSortedRowModel().rows.map((r) => r.original);
  }

  const entries = [
    makeEntry({ conIva: new Big("345.98"), invoice: makeInvoice({ fecha: "2025-02-01T10:00:00" }) }),
    makeEntry({ conIva: new Big("-1000"), invoice: makeInvoice({ fecha: "2025-03-01T10:00:00" }) }),
    makeEntry({
      kind: "pago",
      noSuma: "tipo",
      counted: false,
      conIva: null,
      sinIva: null,
      invoice: makeInvoice({ fecha: "2025-01-01T10:00:00" }),
    }),
    makeEntry({ conIva: new Big("0"), invoice: makeInvoice({ fecha: "2025-04-01T10:00:00" }) }),
  ];
  const rows = toInvoiceRows(entries, "con");

  it("sorts Monto numerically on the signed value with undefined last in both directions", () => {
    const amounts = (desc: boolean) =>
      sortedRows(rows, [{ id: "amount", desc }]).map((r) => r.amount?.toString());
    expect(amounts(false)).toEqual(["-1000", "0", "345.98", undefined]);
    expect(amounts(true)).toEqual(["345.98", "0", "-1000", undefined]);
  });

  it("sorts Fecha by the literal ISO string", () => {
    expect(sortedRows(rows, [{ id: "fecha", desc: true }]).map((r) => r.fecha)).toEqual([
      "2025-04-01T10:00:00",
      "2025-03-01T10:00:00",
      "2025-02-01T10:00:00",
      "2025-01-01T10:00:00",
    ]);
  });

  it("sorts text columns with the Spanish collation and Folio as text, missing folio last", () => {
    const named = ["Árbol", "zeta", "Abeja", "Zona"].map((name, i) =>
      firstRow(
        makeEntry({
          supplierName: name,
          invoice: makeInvoice({ folio: i === 3 ? null : ["10", "9", "2"][i] ?? "x" }),
        }),
      ),
    );
    const names = sortedRows(named, [{ id: "proveedor", desc: false }]).map((r) => r.proveedor);
    expect(names).toEqual(["Abeja", "Árbol", "zeta", "Zona"]);
    const folios = (desc: boolean) =>
      sortedRows(named, [{ id: "folio", desc }]).map((r) => r.folio ?? "—");
    expect(folios(false)).toEqual(["10", "2", "9", "—"]);
    expect(folios(true)).toEqual(["9", "2", "10", "—"]);
  });
});
