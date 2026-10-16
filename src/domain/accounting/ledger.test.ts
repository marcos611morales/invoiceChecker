import { describe, expect, it } from "vitest";
import { loaded, makeEntry, makeInvoice, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";
import type { ParsedInvoice } from "../cfdi/types";
import {
  EMPTY_OVERRIDES,
  PPD_SIN_COMPLEMENTO,
  buildLedger,
  type LedgerEntry,
  type LedgerOverrides,
} from "./ledger";
import type { FechaContext } from "./months";

function ledgerOf(
  invoices: readonly ParsedInvoice[],
  overrides: LedgerOverrides = EMPTY_OVERRIDES,
  context: FechaContext = TEST_FECHA_CONTEXT,
): LedgerEntry[] {
  return buildLedger(invoices.map(loaded), overrides, context);
}

function entryFor(entries: readonly LedgerEntry[], invoice: ParsedInvoice): LedgerEntry {
  const found = entries.find((entry) => entry.uuid === invoice.uuid);
  if (found === undefined) throw new Error("entry not found for the given invoice");
  return found;
}

function overridesOf(parts: { excluded?: string[]; restored?: string[] }): LedgerOverrides {
  return {
    excluded: new Set(parts.excluded ?? []),
    restored: new Set(parts.restored ?? []),
  };
}

describe("buildLedger: kinds and signs (REGLA-01)", () => {
  it("yields exactly one entry per loaded invoice, in input order", () => {
    const invoices = [
      makeInvoice(),
      makeInvoice({ tipo: "E" }),
      makeInvoice({ tipo: "P" }),
      makeInvoice({ tipo: "T" }),
      makeInvoice({ tipo: "N" }),
    ];
    const entries = ledgerOf(invoices);
    expect(entries.map((e) => e.uuid)).toEqual(invoices.map((i) => i.uuid));
    expect(entries.map((e) => e.kind)).toEqual([
      "ingreso",
      "nota-credito",
      "pago",
      "traslado",
      "nomina",
    ]);
  });

  it("counts an Ingreso positive and an Egreso negative", () => {
    const ingreso = makeInvoice({ total: "116.00", subTotal: "100.00" });
    const egreso = makeInvoice({ tipo: "E", total: "58.00", subTotal: "50.00" });
    const entries = ledgerOf([ingreso, egreso]);
    const i = entryFor(entries, ingreso);
    const e = entryFor(entries, egreso);
    expect(i.counted).toBe(true);
    expect(i.conIva?.toString()).toBe("116");
    expect(i.sinIva?.toString()).toBe("100");
    expect(e.counted).toBe(true);
    expect(e.conIva?.toString()).toBe("-58");
    expect(e.sinIva?.toString()).toBe("-50");
  });

  it("never sums Pago, Traslado or Nomina and gives them no amount", () => {
    for (const tipo of ["P", "T", "N"] as const) {
      const invoice = makeInvoice({ tipo, total: "500.00", subTotal: "500.00" });
      const entry = entryFor(ledgerOf([invoice]), invoice);
      expect(entry.noSuma).toBe("tipo");
      expect(entry.counted).toBe(false);
      expect(entry.conIva).toBeNull();
      expect(entry.sinIva).toBeNull();
    }
  });
});

describe("buildLedger: $0 and invalid data (REGLA-06, D-35, D-37)", () => {
  it("flags Total 0.00 as cero, still computes the amounts and does not count it", () => {
    const invoice = makeInvoice({ total: "0.00", subTotal: "0.00" });
    const entry = entryFor(ledgerOf([invoice]), invoice);
    expect(entry.noSuma).toBe("cero");
    expect(entry.counted).toBe(false);
    expect(entry.conIva?.toString()).toBe("0");
    expect(entry.sinIva?.toString()).toBe("0");
  });

  it("counts an invoice whose Sin IVA amount is zero when its Total is not (D-37)", () => {
    const invoice = makeInvoice({ total: "10.00", subTotal: "10.00", descuento: "10.00" });
    const entry = entryFor(ledgerOf([invoice]), invoice);
    expect(entry.noSuma).toBeNull();
    expect(entry.counted).toBe(true);
    expect(entry.sinIva?.toString()).toBe("0");
    expect(entry.conIva?.toString()).toBe("10");
  });

  it("flags a USD invoice with TipoCambio and Total 0 as cero", () => {
    const invoice = makeInvoice({
      moneda: "USD",
      tipoCambio: "18.2",
      total: "0",
      subTotal: "0",
    });
    const entry = entryFor(ledgerOf([invoice]), invoice);
    expect(entry.noSuma).toBe("cero");
    expect(entry.counted).toBe(false);
  });

  it("flags a non-numeric Total as invalido and names the field", () => {
    const invoice = makeInvoice({ total: "abc" });
    const entry = entryFor(ledgerOf([invoice]), invoice);
    expect(entry.noSuma).toBe("invalido");
    expect(entry.invalidField).toBe("Total");
    expect(entry.counted).toBe(false);
    expect(entry.conIva).toBeNull();
  });

  it("flags a malformed Fecha as invalido/Fecha with no month and without throwing", () => {
    const invoice = makeInvoice({ fecha: "2025-13-40T00:00:00" });
    const entry = entryFor(ledgerOf([invoice]), invoice);
    expect(entry.noSuma).toBe("invalido");
    expect(entry.invalidField).toBe("Fecha");
    expect(entry.ownMonth).toBeNull();
    expect(entry.month).toBeNull();
    expect(entry.counted).toBe(false);
    expect(entry.conIva?.toString()).toBe("116");
  });

  it("flags USD without TipoCambio as moneda-sin-tc", () => {
    const invoice = makeInvoice({ moneda: "USD", tipoCambio: null });
    const entry = entryFor(ledgerOf([invoice]), invoice);
    expect(entry.noSuma).toBe("moneda-sin-tc");
    expect(entry.counted).toBe(false);
    expect(entry.conIva).toBeNull();
  });

  it("applies the precedence invalid amount, invalid Fecha, moneda-sin-tc, cero", () => {
    const invalidAmount = makeInvoice({
      total: "abc",
      fecha: "2025-13-40T00:00:00",
      moneda: "USD",
    });
    const invalidFecha = makeInvoice({
      fecha: "2025-13-40T00:00:00",
      moneda: "USD",
      tipoCambio: null,
    });
    const sinTc = makeInvoice({ moneda: "USD", tipoCambio: null, total: "0", subTotal: "0" });
    const entries = ledgerOf([invalidAmount, invalidFecha, sinTc]);
    expect(entryFor(entries, invalidAmount).invalidField).toBe("Total");
    expect(entryFor(entries, invalidFecha).invalidField).toBe("Fecha");
    expect(entryFor(entries, sinTc).noSuma).toBe("moneda-sin-tc");
  });

  it("keeps a Pago with a malformed Fecha as tipo", () => {
    const invoice = makeInvoice({ tipo: "P", fecha: "garbage" });
    const entry = entryFor(ledgerOf([invoice]), invoice);
    expect(entry.noSuma).toBe("tipo");
    expect(entry.invalidField).toBeNull();
  });
});

describe("buildLedger: imputation month of credit notes (REGLA-02, D-34)", () => {
  it("imputes a credit note to the month of its loaded related invoice", () => {
    const original = makeInvoice({ fecha: "2025-06-21T21:30:18" });
    const note = makeInvoice({
      tipo: "E",
      fecha: "2025-09-01T13:53:13",
      relacionados: [{ tipoRelacion: "07", uuids: [original.uuid] }],
    });
    const entries = ledgerOf([original, note]);
    const entry = entryFor(entries, note);
    expect(entry.ownMonth).toBe("2025-09");
    expect(entry.month).toBe("2025-06");
    expect(entry.relatedLoaded).toEqual([original.uuid]);
    expect(entry.relatedCount).toBe(1);
    expect(entryFor(entries, original).month).toBe("2025-06");
  });

  it("keeps its own month when the related invoice is not loaded", () => {
    const note = makeInvoice({
      tipo: "E",
      fecha: "2025-09-01T13:53:13",
      relacionados: [{ tipoRelacion: "01", uuids: ["NOT-LOADED-UUID"] }],
    });
    const entry = entryFor(ledgerOf([note]), note);
    expect(entry.month).toBe("2025-09");
    expect(entry.relatedLoaded).toEqual([]);
    expect(entry.relatedCount).toBe(1);
  });

  it("picks the related invoice with the oldest Fecha and lists them oldest first", () => {
    const july = makeInvoice({ fecha: "2025-07-10T10:00:00" });
    const may = makeInvoice({ fecha: "2025-05-03T10:00:00" });
    const note = makeInvoice({
      tipo: "E",
      fecha: "2025-09-01T00:00:00",
      relacionados: [{ tipoRelacion: "07", uuids: [july.uuid, may.uuid] }],
    });
    const entry = entryFor(ledgerOf([july, may, note]), note);
    expect(entry.month).toBe("2025-05");
    expect(entry.relatedLoaded).toEqual([may.uuid, july.uuid]);
    expect(entry.relatedCount).toBe(2);
  });

  it("reads related invoices from every relacionados group and any TipoRelacion", () => {
    const first = makeInvoice({ fecha: "2025-04-02T10:00:00" });
    const second = makeInvoice({ fecha: "2025-03-02T10:00:00" });
    const note = makeInvoice({
      tipo: "E",
      fecha: "2025-09-01T00:00:00",
      relacionados: [
        { tipoRelacion: "01", uuids: [first.uuid] },
        { tipoRelacion: "03", uuids: [second.uuid] },
      ],
    });
    expect(entryFor(ledgerOf([first, second, note]), note).month).toBe("2025-03");
  });

  it("ignores a UUID that lists itself", () => {
    const note = makeInvoice({ tipo: "E", fecha: "2025-09-01T00:00:00" });
    const selfRelated: ParsedInvoice = {
      ...note,
      relacionados: [{ tipoRelacion: "01", uuids: [note.uuid] }],
    };
    const entry = entryFor(ledgerOf([selfRelated]), selfRelated);
    expect(entry.relatedLoaded).toEqual([]);
    expect(entry.relatedCount).toBe(0);
    expect(entry.month).toBe("2025-09");
  });

  it("does not move invoices of other kinds, even with related invoices", () => {
    const original = makeInvoice({ fecha: "2025-06-21T10:00:00" });
    const later = makeInvoice({
      fecha: "2025-09-01T10:00:00",
      relacionados: [{ tipoRelacion: "07", uuids: [original.uuid] }],
    });
    const entry = entryFor(ledgerOf([original, later]), later);
    expect(entry.month).toBe("2025-09");
    expect(entry.relatedLoaded).toEqual([]);
    expect(entry.relatedCount).toBe(1);
  });

  it("falls back to its own month when the only related invoice has a malformed Fecha", () => {
    const broken = makeInvoice({ fecha: "bad" });
    const note = makeInvoice({
      tipo: "E",
      fecha: "2025-09-01T00:00:00",
      relacionados: [{ tipoRelacion: "01", uuids: [broken.uuid] }],
    });
    const entry = entryFor(ledgerOf([broken, note]), note);
    expect(entry.month).toBe("2025-09");
    expect(entry.relatedLoaded).toEqual([broken.uuid]);
  });
});

describe("buildLedger: manual exclusion (REGLA-08)", () => {
  it("excludes by uuid, keeps the amounts and does not count it", () => {
    const invoice = makeInvoice();
    const entry = entryFor(
      ledgerOf([invoice], overridesOf({ excluded: [invoice.uuid] })),
      invoice,
    );
    expect(entry.exclusion).toBe("manual");
    expect(entry.counted).toBe(false);
    expect(entry.conIva?.toString()).toBe("116");
    expect(entry.sinIva?.toString()).toBe("100");
  });
});

describe("buildLedger: TipoRelacion 04 substitution (D-08, D-42)", () => {
  function pair(tipoRelacion = "04") {
    const original = makeInvoice();
    const substitute = makeInvoice({
      relacionados: [{ tipoRelacion, uuids: [original.uuid] }],
    });
    return { original, substitute };
  }

  it("marks the loaded original as sustituida and links both sides", () => {
    const { original, substitute } = pair();
    const entries = ledgerOf([original, substitute]);
    const o = entryFor(entries, original);
    const s = entryFor(entries, substitute);
    expect(o.exclusion).toBe("sustituida");
    expect(o.counted).toBe(false);
    expect(o.substitutedBy).toBe(substitute.uuid);
    expect(o.conIva?.toString()).toBe("116");
    expect(s.substitutes).toEqual([original.uuid]);
    expect(s.exclusion).toBeNull();
    expect(s.counted).toBe(true);
  });

  it("changes nothing for an original that is not loaded except substitutes", () => {
    const { original, substitute } = pair();
    const other = makeInvoice();
    const entries = ledgerOf([substitute, other]);
    expect(entryFor(entries, substitute).substitutes).toEqual([original.uuid]);
    expect(entryFor(entries, substitute).counted).toBe(true);
    expect(entryFor(entries, other).exclusion).toBeNull();
    expect(entryFor(entries, other).substitutedBy).toBeNull();
  });

  it("never excludes through another TipoRelacion", () => {
    const { original, substitute } = pair("07");
    const entries = ledgerOf([original, substitute]);
    expect(entryFor(entries, original).exclusion).toBeNull();
    expect(entryFor(entries, original).substitutedBy).toBeNull();
    expect(entryFor(entries, substitute).substitutes).toEqual([]);
  });

  it("releases the original when it is in restored, keeping substitutedBy", () => {
    const { original, substitute } = pair();
    const entries = ledgerOf(
      [original, substitute],
      overridesOf({ restored: [original.uuid] }),
    );
    const o = entryFor(entries, original);
    expect(o.exclusion).toBeNull();
    expect(o.counted).toBe(true);
    expect(o.substitutedBy).toBe(substitute.uuid);
  });

  it("keeps the original sustituida when the substituting invoice is excluded manually", () => {
    const { original, substitute } = pair();
    const entries = ledgerOf(
      [original, substitute],
      overridesOf({ excluded: [substitute.uuid] }),
    );
    expect(entryFor(entries, original).exclusion).toBe("sustituida");
    expect(entryFor(entries, substitute).exclusion).toBe("manual");
  });

  it("keeps the original sustituida when the substituting invoice is $0", () => {
    const original = makeInvoice();
    const substitute = makeInvoice({
      total: "0.00",
      subTotal: "0.00",
      relacionados: [{ tipoRelacion: "04", uuids: [original.uuid] }],
    });
    const entries = ledgerOf([original, substitute]);
    expect(entryFor(entries, substitute).noSuma).toBe("cero");
    expect(entryFor(entries, original).exclusion).toBe("sustituida");
  });

  it("shows manual when the original is both excluded and substituted", () => {
    const { original, substitute } = pair();
    const entries = ledgerOf(
      [original, substitute],
      overridesOf({ excluded: [original.uuid] }),
    );
    expect(entryFor(entries, original).exclusion).toBe("manual");
  });

  it("ignores a 04 relation to itself", () => {
    const base = makeInvoice();
    const selfRelated: ParsedInvoice = {
      ...base,
      relacionados: [{ tipoRelacion: "04", uuids: [base.uuid] }],
    };
    const entry = entryFor(ledgerOf([selfRelated]), selfRelated);
    expect(entry.exclusion).toBeNull();
    expect(entry.substitutedBy).toBeNull();
    expect(entry.substitutes).toEqual([]);
    expect(entry.counted).toBe(true);
  });

  it("attributes the substitution to the first loaded invoice in load order", () => {
    const original = makeInvoice();
    const first = makeInvoice({ relacionados: [{ tipoRelacion: "04", uuids: [original.uuid] }] });
    const second = makeInvoice({ relacionados: [{ tipoRelacion: "04", uuids: [original.uuid] }] });
    const entries = ledgerOf([original, first, second]);
    expect(entryFor(entries, original).substitutedBy).toBe(first.uuid);
    expect(entryFor(entries, second).substitutes).toEqual([original.uuid]);
  });
});

describe("buildLedger: forms of payment (REGLA-09, D-16, D-17)", () => {
  function pagoFor(
    documentUuids: string[],
    formaDePagoP: string,
  ): ParsedInvoice {
    return makeInvoice({
      tipo: "P",
      moneda: "XXX",
      total: "0",
      subTotal: "0",
      formaPago: null,
      metodoPago: null,
      pagos: [
        {
          fechaPago: "2025-07-01T12:00:00",
          formaDePagoP,
          monedaP: "MXN",
          monto: "100.00",
          doctos: documentUuids.map((idDocumento) => ({
            idDocumento,
            monedaDR: "MXN",
            impPagado: "100.00",
          })),
        },
      ],
    });
  }

  it("takes the form of the Pago that references a PPD invoice", () => {
    const ppd = makeInvoice({ metodoPago: "PPD", formaPago: "99" });
    const pago = pagoFor([ppd.uuid], "04");
    expect(entryFor(ledgerOf([ppd, pago]), ppd).formas).toEqual(["04"]);
  });

  it("takes every form, sorted, when several Pagos reference it", () => {
    const ppd = makeInvoice({ metodoPago: "PPD", formaPago: "99" });
    const first = pagoFor([ppd.uuid], "28");
    const second = pagoFor([ppd.uuid], "03");
    expect(entryFor(ledgerOf([ppd, first, second]), ppd).formas).toEqual(["03", "28"]);
  });

  it("de-duplicates equal forms", () => {
    const ppd = makeInvoice({ metodoPago: "PPD", formaPago: "99" });
    const first = pagoFor([ppd.uuid], "04");
    const second = pagoFor([ppd.uuid], "04");
    expect(entryFor(ledgerOf([ppd, first, second]), ppd).formas).toEqual(["04"]);
  });

  it("uses the sentinel for a PPD invoice with no complemento", () => {
    const ppd = makeInvoice({ metodoPago: "PPD", formaPago: "99" });
    expect(entryFor(ledgerOf([ppd]), ppd).formas).toEqual([PPD_SIN_COMPLEMENTO]);
  });

  it("treats FormaPago 99 with MetodoPago PUE as PPD", () => {
    const invoice = makeInvoice({ metodoPago: "PUE", formaPago: "99" });
    const pago = pagoFor([invoice.uuid], "03");
    const entries = ledgerOf([invoice, pago]);
    expect(entryFor(entries, invoice).formas).toEqual(["03"]);
    expect(entryFor(ledgerOf([invoice]), invoice).formas).toEqual([PPD_SIN_COMPLEMENTO]);
  });

  it("gives a non-PPD invoice its own FormaPago, ignoring any Pago", () => {
    const invoice = makeInvoice({ metodoPago: "PUE", formaPago: "28" });
    const pago = pagoFor([invoice.uuid], "04");
    expect(entryFor(ledgerOf([invoice, pago]), invoice).formas).toEqual(["28"]);
  });

  it("gives [] when the invoice has no FormaPago", () => {
    const invoice = makeInvoice({ metodoPago: "PUE", formaPago: null });
    expect(entryFor(ledgerOf([invoice]), invoice).formas).toEqual([]);
  });

  it("reads documents of one Pago spread over several doctos", () => {
    const a = makeInvoice({ metodoPago: "PPD", formaPago: "99" });
    const b = makeInvoice({ metodoPago: "PPD", formaPago: "99" });
    const pago = pagoFor([a.uuid, b.uuid], "04");
    const entries = ledgerOf([a, b, pago]);
    expect(entryFor(entries, a).formas).toEqual(["04"]);
    expect(entryFor(entries, b).formas).toEqual(["04"]);
  });
});

describe("buildLedger: supplier identity (D-43, T-02-06)", () => {
  it("uses the most frequent Nombre of an RFC", () => {
    const a = makeInvoice({ emisor: { rfc: "AAA010101AAA", nombre: "Nombre A" } });
    const b = makeInvoice({ emisor: { rfc: "AAA010101AAA", nombre: "Nombre B" } });
    const c = makeInvoice({ emisor: { rfc: "AAA010101AAA", nombre: "Nombre B" } });
    const entries = ledgerOf([a, b, c]);
    for (const invoice of [a, b, c]) {
      const entry = entryFor(entries, invoice);
      expect(entry.supplierRfc).toBe("AAA010101AAA");
      expect(entry.supplierName).toBe("Nombre B");
    }
  });

  it("breaks a tie with the first name seen", () => {
    const a = makeInvoice({ emisor: { rfc: "AAA010101AAA", nombre: "Primero" } });
    const b = makeInvoice({ emisor: { rfc: "AAA010101AAA", nombre: "Segundo" } });
    expect(entryFor(ledgerOf([a, b]), a).supplierName).toBe("Primero");
    expect(entryFor(ledgerOf([b, a]), a).supplierName).toBe("Segundo");
  });

  it("falls back to the RFC when no invoice has a Nombre", () => {
    const a = makeInvoice({ emisor: { rfc: "AAA010101AAA", nombre: null } });
    expect(entryFor(ledgerOf([a]), a).supplierName).toBe("AAA010101AAA");
  });

  it("ignores missing names when another invoice of the RFC has one", () => {
    const a = makeInvoice({ emisor: { rfc: "AAA010101AAA", nombre: null } });
    const b = makeInvoice({ emisor: { rfc: "AAA010101AAA", nombre: "Con nombre" } });
    expect(entryFor(ledgerOf([a, b]), a).supplierName).toBe("Con nombre");
  });

  it("keeps two RFCs that share a name as separate suppliers", () => {
    const a = makeInvoice({ emisor: { rfc: "AAA010101AAA", nombre: "Mismo" } });
    const b = makeInvoice({ emisor: { rfc: "BBB010101BBB", nombre: "Mismo" } });
    const entries = ledgerOf([a, b]);
    expect(entryFor(entries, a).supplierRfc).toBe("AAA010101AAA");
    expect(entryFor(entries, b).supplierRfc).toBe("BBB010101BBB");
  });

  it("is harmless with prototype-like RFCs and UUIDs", () => {
    const proto = makeInvoice({ emisor: { rfc: "__proto__", nombre: "Proto" } });
    const ctor = makeInvoice({
      uuid: "constructor",
      emisor: { rfc: "constructor", nombre: null },
      tipo: "E",
      relacionados: [{ tipoRelacion: "04", uuids: [proto.uuid, "__proto__", "toString"] }],
    });
    const named = makeInvoice({
      uuid: "__proto__",
      relacionados: [{ tipoRelacion: "04", uuids: ["constructor"] }],
    });
    const entries = ledgerOf([proto, ctor, named]);
    expect(entryFor(entries, proto).supplierName).toBe("Proto");
    expect(entryFor(entries, ctor).supplierName).toBe("constructor");
    expect(entryFor(entries, named).substitutedBy).toBe("constructor");
    expect(entryFor(entries, ctor).substitutedBy).toBe("__proto__");
    expect(entryFor(entries, ctor).exclusion).toBe("sustituida");
  });
});

describe("buildLedger: purity", () => {
  it("does not mutate the input and is deterministic", () => {
    const original = makeInvoice({ fecha: "2025-06-21T10:00:00" });
    const note = makeInvoice({
      tipo: "E",
      relacionados: [{ tipoRelacion: "04", uuids: [original.uuid] }],
    });
    const input = [loaded(original), loaded(note)];
    const snapshot = JSON.stringify(input);
    const first = buildLedger(input, EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
    const second = buildLedger(input, EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(second.map((e) => [e.uuid, e.exclusion, e.month])).toEqual(
      first.map((e) => [e.uuid, e.exclusion, e.month]),
    );
  });

  it("does not depend on the IVA mode: both amounts are held", () => {
    const invoice = makeInvoice({ total: "10.00", subTotal: "10.00", descuento: "10.00" });
    const entry = entryFor(ledgerOf([invoice]), invoice);
    expect(entry.conIva).not.toBeNull();
    expect(entry.sinIva).not.toBeNull();
    expect(entry.counted).toBe(true);
  });
});

describe("makeEntry factory", () => {
  it("builds a counted Ingreso entry with Big amounts from strings", () => {
    const entry = makeEntry();
    expect(entry.kind).toBe("ingreso");
    expect(entry.counted).toBe(true);
    expect(entry.conIva?.toString()).toBe("116");
    expect(makeEntry({ uuid: "X" }).uuid).toBe("X");
  });
});
