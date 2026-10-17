import Big from "big.js";
import { describe, expect, it } from "vitest";
import type { Concepto, ParsedInvoice } from "../cfdi/types";
import { makeResolver } from "../settings/resolver";
import { SIN_CATEGORIA, defaultSettings } from "../settings/types";
import { totalSpend } from "./aggregate";
import { categoryBreakdown, splitEntry } from "./categories";
import { ZERO, sum } from "./decimal";
import { EMPTY_OVERRIDES, buildLedger, type LedgerEntry } from "./ledger";
import {
  TEST_FECHA_CONTEXT,
  loaded,
  makeEntry,
  makeInvoice,
} from "../../../tests/support/ledgerFactory";

const LIMPIEZA = "seed:limpieza-higiene";
const SERVICIOS = "seed:servicios";

function concepto(descripcion: string, importe: string, iva: string, extra: Partial<Concepto> = {}): Concepto {
  return {
    claveProdServ: "01010101",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion,
    valorUnitario: importe,
    importe,
    descuento: null,
    objetoImp: "02",
    traslados: [{ base: importe, impuesto: "002", tipoFactor: "Tasa", tasaOCuota: "0.160000", importe: iva }],
    retenciones: [],
    ...extra,
  };
}

/** Three concepts that add to 100.00 / 116.00, in an invoice that states a one-cent gap in both modes. */
function gappedInvoice(overrides: Partial<ParsedInvoice> = {}): ParsedInvoice {
  return makeInvoice({
    subTotal: "100.01",
    total: "116.01",
    conceptos: [
      concepto("Cloro", "33.33", "5.33"),
      concepto("Jabón", "33.33", "5.33"),
      concepto("Trapeador", "33.34", "5.34"),
    ],
    ...overrides,
  });
}

function ledgerOf(invoices: readonly ParsedInvoice[]): LedgerEntry[] {
  return buildLedger(invoices.map(loaded), EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
}

function resolverFor(assignments: ReadonlyArray<[string, string]>) {
  return makeResolver({
    ...defaultSettings(),
    supplierCategories: assignments.map(([rfc, categoryId]) => ({ rfc, name: rfc, categoryId })),
  });
}

function eq(value: Big, expected: string): boolean {
  return value.eq(new Big(expected));
}

/** Exact XML decimal to integer cents, with no float and no big.js involved. */
function toCents(text: string): bigint {
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  return negative ? -cents : cents;
}

const A = { rfc: "AAA010101AAA", nombre: "Proveedor A" };
const B = { rfc: "BBB010101BBB", nombre: "Proveedor B" };

describe("splitEntry (D-12, D-13)", () => {
  it("emits one part per concept plus the rounding difference, and the parts add up exactly", () => {
    const [entry] = ledgerOf([gappedInvoice({ emisor: A })]);
    if (entry === undefined) throw new Error("no entry");
    const parts = splitEntry(entry, resolverFor([[A.rfc, LIMPIEZA]]));
    expect(parts).toHaveLength(4);
    expect(parts.map((part) => part.concept)).toEqual([0, 1, 2, null]);
    expect(parts.every((part) => part.category === LIMPIEZA)).toBe(true);
    const difference = parts[3];
    expect(difference !== undefined && eq(difference.con, "0.01")).toBe(true);
    expect(difference !== undefined && eq(difference.sin, "0.01")).toBe(true);
    expect(entry.conIva !== null && sum(parts.map((p) => p.con)).eq(entry.conIva)).toBe(true);
    expect(entry.sinIva !== null && sum(parts.map((p) => p.sin)).eq(entry.sinIva)).toBe(true);
  });

  it("emits no difference part when the concepts add up exactly", () => {
    const [entry] = ledgerOf([
      makeInvoice({
        emisor: A,
        subTotal: "100.00",
        total: "116.00",
        conceptos: [concepto("Cloro", "60.00", "9.60"), concepto("Jabón", "40.00", "6.40")],
      }),
    ]);
    if (entry === undefined) throw new Error("no entry");
    const parts = splitEntry(entry, resolverFor([]));
    expect(parts.map((part) => part.concept)).toEqual([0, 1]);
  });

  it("gives a credit note negative parts that subtract from their category (D-12)", () => {
    const [entry] = ledgerOf([gappedInvoice({ emisor: A, tipo: "E" })]);
    if (entry === undefined) throw new Error("no entry");
    expect(entry.kind).toBe("nota-credito");
    const parts = splitEntry(entry, resolverFor([[A.rfc, LIMPIEZA]]));
    expect(parts).toHaveLength(4);
    expect(parts.every((part) => part.con.lt(ZERO) && part.sin.lt(ZERO))).toBe(true);
    expect(entry.conIva !== null && sum(parts.map((p) => p.con)).eq(entry.conIva)).toBe(true);
    expect(eq(sum(parts.map((p) => p.con)), "-116.01")).toBe(true);
  });

  it("yields the concept parts and no difference part for an entry with null amounts", () => {
    const invoice = gappedInvoice({ emisor: A, tipo: "P" });
    const entry = makeEntry({
      invoice,
      kind: "pago",
      noSuma: "tipo",
      counted: false,
      conIva: null,
      sinIva: null,
    });
    const parts = splitEntry(entry, resolverFor([[A.rfc, SERVICIOS]]));
    expect(parts.map((part) => part.concept)).toEqual([0, 1, 2]);
    expect(parts.every((part) => part.category === SERVICIOS)).toBe(true);
  });

  it("counts an unusable concept amount as zero and sends the whole amount to the difference part", () => {
    const [entry] = ledgerOf([
      makeInvoice({
        emisor: A,
        subTotal: "100.00",
        total: "116.00",
        conceptos: [concepto("Dañado", "abc", "16.00")],
      }),
    ]);
    if (entry === undefined) throw new Error("no entry");
    const parts = splitEntry(entry, resolverFor([[A.rfc, LIMPIEZA]]));
    expect(parts).toHaveLength(2);
    expect(parts[0] !== undefined && parts[0].con.eq(ZERO)).toBe(true);
    expect(parts[1] !== undefined && eq(parts[1].con, "116.00")).toBe(true);
    expect(parts[1]?.concept).toBeNull();
  });

  it("splits into SIN_CATEGORIA a supplier assigned to an id that is not a category", () => {
    const [entry] = ledgerOf([gappedInvoice({ emisor: A })]);
    if (entry === undefined) throw new Error("no entry");
    const parts = splitEntry(entry, resolverFor([[A.rfc, "missing-id"]]));
    expect(parts.every((part) => part.category === SIN_CATEGORIA)).toBe(true);
  });

  it("treats an RFC such as __proto__ as plain data", () => {
    const [entry] = ledgerOf([gappedInvoice({ emisor: { rfc: "__proto__", nombre: "Raro" } })]);
    if (entry === undefined) throw new Error("no entry");
    const parts = splitEntry(entry, resolverFor([["__proto__", LIMPIEZA]]));
    expect(parts.every((part) => part.category === LIMPIEZA)).toBe(true);
    const unassigned = splitEntry(entry, resolverFor([]));
    expect(unassigned.every((part) => part.category === SIN_CATEGORIA)).toBe(true);
  });
});

describe("categoryBreakdown (D-13, D-16)", () => {
  const nameOf = (key: string): string =>
    key === SIN_CATEGORIA ? "Sin categoría" : (defaultSettings().categories.find((c) => c.id === key)?.name ?? key);

  const invoices = [
    gappedInvoice({ emisor: A, fecha: "2025-01-15T10:00:00" }),
    makeInvoice({ emisor: A, fecha: "2025-02-10T10:00:00", subTotal: "50.00", total: "58.00" }),
    makeInvoice({
      emisor: B,
      fecha: "2025-02-11T10:00:00",
      subTotal: "200.00",
      total: "232.00",
      conceptos: [concepto("Café", "200.00", "32.00")],
    }),
    makeInvoice({
      emisor: A,
      tipo: "E",
      fecha: "2025-02-20T10:00:00",
      subTotal: "10.00",
      total: "11.60",
      conceptos: [concepto("Cloro", "10.00", "1.60")],
    }),
  ];
  const ledger = ledgerOf(invoices);
  const resolver = resolverFor([[A.rfc, LIMPIEZA]]);

  it("adds up to Gasto total exactly in both modes (independent cents computation)", () => {
    for (const mode of ["con", "sin"] as const) {
      const rows = categoryBreakdown(ledger, resolver, mode, 2, nameOf);
      const netSum = sum(rows.map((row) => row.net));
      expect(netSum.eq(totalSpend(ledger, mode))).toBe(true);
      let expected = BigInt(0);
      for (const invoice of invoices) {
        const sign = invoice.tipo === "E" ? BigInt(-1) : BigInt(1);
        expected += sign * toCents(mode === "con" ? invoice.total : invoice.subTotal);
      }
      expect(netSum.times(new Big("100")).eq(new Big(expected.toString()))).toBe(true);
    }
  });

  it("lists the assigned category and Sin categoría with their own nets", () => {
    const rows = categoryBreakdown(ledger, resolver, "con", 2, nameOf);
    expect(rows.map((row) => row.category)).toEqual([SIN_CATEGORIA, LIMPIEZA]);
    // B: 232.00. A: 116.01 + 58.00 - 11.60 (the credit note) = 162.41.
    expect(eq(rows[0]?.net ?? ZERO, "232")).toBe(true);
    expect(eq(rows[1]?.net ?? ZERO, "162.41")).toBe(true);
  });

  it("computes pct over the total and promedio over the months", () => {
    const rows = categoryBreakdown(ledger, resolver, "con", 2, nameOf);
    const total = totalSpend(ledger, "con");
    const first = rows[0];
    expect(first?.pct !== null && first?.pct !== undefined && first.pct.eq(first.net.div(total))).toBe(true);
    expect(first !== undefined && eq(first.promedio, "116")).toBe(true);
  });

  it("gives a zero promedio when there are no months and a null pct when the total is not above zero", () => {
    const rows = categoryBreakdown(ledger, resolver, "con", 0, nameOf);
    expect(rows.every((row) => row.promedio.eq(ZERO))).toBe(true);
    const onlyCredit = ledgerOf([gappedInvoice({ emisor: A, tipo: "E" })]);
    const negative = categoryBreakdown(onlyCredit, resolver, "con", 1, nameOf);
    expect(negative).toHaveLength(1);
    expect(negative[0]?.pct).toBeNull();
    expect(negative[0]?.net.lt(ZERO)).toBe(true);
  });

  it("reads counted entries only", () => {
    const withUncounted: LedgerEntry[] = [
      ...ledger,
      makeEntry({
        invoice: gappedInvoice({ emisor: B }),
        counted: false,
        exclusion: "manual",
        conIva: new Big("116.01"),
        sinIva: new Big("100.01"),
      }),
    ];
    const rows = categoryBreakdown(withUncounted, resolver, "con", 2, nameOf);
    const netSum = sum(rows.map((row) => row.net));
    expect(netSum.eq(totalSpend(ledger, "con"))).toBe(true);
  });

  it("sorts a negative net after every non-negative row, then by name", () => {
    const credit = gappedInvoice({ emisor: B, tipo: "E", fecha: "2025-01-20T10:00:00" });
    const purchases = [
      makeInvoice({ emisor: A, subTotal: "100.00", total: "116.00" }),
      makeInvoice({ emisor: { rfc: "CCC010101CCC", nombre: "C" }, subTotal: "100.00", total: "116.00" }),
      credit,
    ];
    const rows = categoryBreakdown(
      ledgerOf(purchases),
      resolverFor([
        [A.rfc, LIMPIEZA],
        ["CCC010101CCC", SERVICIOS],
      ]),
      "con",
      1,
      nameOf,
    );
    // Equal nets (116) sort by Spanish-collated name: Limpieza e higiene before Servicios.
    expect(rows.map((row) => row.category)).toEqual([LIMPIEZA, SERVICIOS, SIN_CATEGORIA]);
    expect(rows[2]?.net.lt(ZERO)).toBe(true);
  });

  it("returns no rows for an empty visible set", () => {
    expect(categoryBreakdown([], resolver, "con", 1, nameOf)).toEqual([]);
  });
});
