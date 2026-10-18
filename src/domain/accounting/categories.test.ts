import Big from "big.js";
import { describe, expect, it } from "vitest";
import type { Concepto, ParsedInvoice } from "../cfdi/types";
import { normalizeDescription, ruleMapKey } from "../settings/normalize";
import { makeResolver } from "../settings/resolver";
import { SIN_CATEGORIA, defaultSettings } from "../settings/types";
import { kpis, monthlySeries, supplierRanking, totalSpend } from "./aggregate";
import {
  categoryBreakdown,
  categoryOptions,
  ruleLineCounts,
  scopeToCategories,
  splitEntry,
} from "./categories";
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
  const noSelection = new Set<string>();
  const scope = (entries: readonly LedgerEntry[]) => scopeToCategories(entries, noSelection, resolver);

  it("adds up to Gasto total exactly in both modes (independent cents computation)", () => {
    for (const mode of ["con", "sin"] as const) {
      const rows = categoryBreakdown(scope(ledger), mode, 2, nameOf);
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
    const rows = categoryBreakdown(scope(ledger), "con", 2, nameOf);
    expect(rows.map((row) => row.category)).toEqual([SIN_CATEGORIA, LIMPIEZA]);
    // B: 232.00. A: 116.01 + 58.00 - 11.60 (the credit note) = 162.41.
    expect(eq(rows[0]?.net ?? ZERO, "232")).toBe(true);
    expect(eq(rows[1]?.net ?? ZERO, "162.41")).toBe(true);
  });

  it("computes pct over the total and promedio over the months", () => {
    const rows = categoryBreakdown(scope(ledger), "con", 2, nameOf);
    const total = totalSpend(ledger, "con");
    const first = rows[0];
    expect(first?.pct !== null && first?.pct !== undefined && first.pct.eq(first.net.div(total))).toBe(true);
    expect(first !== undefined && eq(first.promedio, "116")).toBe(true);
  });

  it("gives a zero promedio when there are no months and a null pct when the total is not above zero", () => {
    const rows = categoryBreakdown(scope(ledger), "con", 0, nameOf);
    expect(rows.every((row) => row.promedio.eq(ZERO))).toBe(true);
    const onlyCredit = ledgerOf([gappedInvoice({ emisor: A, tipo: "E" })]);
    const negative = categoryBreakdown(scope(onlyCredit), "con", 1, nameOf);
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
    const rows = categoryBreakdown(scope(withUncounted), "con", 2, nameOf);
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
    const sortResolver = resolverFor([
      [A.rfc, LIMPIEZA],
      ["CCC010101CCC", SERVICIOS],
    ]);
    const rows = categoryBreakdown(
      scopeToCategories(ledgerOf(purchases), noSelection, sortResolver),
      "con",
      1,
      nameOf,
    );
    // Equal nets (116) sort by Spanish-collated name: Limpieza e higiene before Servicios.
    expect(rows.map((row) => row.category)).toEqual([LIMPIEZA, SERVICIOS, SIN_CATEGORIA]);
    expect(rows[2]?.net.lt(ZERO)).toBe(true);
  });

  it("returns no rows for an empty visible set", () => {
    expect(categoryBreakdown([], "con", 1, nameOf)).toEqual([]);
  });
});

/** Integer cents to the exact XML decimal text. */
function centsText(cents: bigint): string {
  const negative = cents < BigInt(0);
  const absolute = negative ? -cents : cents;
  const whole = absolute / BigInt(100);
  const fraction = (absolute % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

/** Small deterministic generator so the property test is reproducible. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) % 4294967296;
    return Math.abs(state) / 4294967296;
  };
}

const scopeSettings = {
  ...defaultSettings(),
  supplierCategories: [
    { rfc: A.rfc, name: A.nombre, categoryId: LIMPIEZA },
    { rfc: B.rfc, name: B.nombre, categoryId: SERVICIOS },
  ],
  conceptRules: [
    { rfc: A.rfc, key: normalizeDescription("Café"), description: "Café", categoryId: SERVICIOS },
  ],
};
const scopeResolver = makeResolver(scopeSettings);
const scopeNameOf = (key: string): string =>
  key === SIN_CATEGORIA ? "Sin categoría" : (scopeSettings.categories.find((c) => c.id === key)?.name ?? key);

/** Lines in LIMPIEZA (supplier) and SERVICIOS (rule), plus a one-cent rounding gap in LIMPIEZA. */
function mixedInvoice(overrides: Partial<ParsedInvoice> = {}): ParsedInvoice {
  return makeInvoice({
    emisor: A,
    subTotal: "100.01",
    total: "116.01",
    conceptos: [
      concepto("Cloro", "33.33", "5.33"),
      concepto("Café", "33.33", "5.33"),
      concepto("Trapeador", "33.34", "5.34"),
    ],
    ...overrides,
  });
}

/** Its only line is in SERVICIOS; its only LIMPIEZA part is the rounding gap. */
function gapOnlyInvoice(overrides: Partial<ParsedInvoice> = {}): ParsedInvoice {
  return makeInvoice({
    emisor: A,
    subTotal: "100.01",
    total: "116.01",
    conceptos: [concepto("Café", "100.00", "16.00")],
    ...overrides,
  });
}

function pagoEntry(): LedgerEntry {
  return makeEntry({
    invoice: gappedInvoice({ emisor: A, tipo: "P" }),
    kind: "pago",
    noSuma: "tipo",
    counted: false,
    conIva: null,
    sinIva: null,
  });
}

describe("scopeToCategories (D-14, D-27)", () => {
  it("returns every entry with the full amounts and all parts for an empty selection", () => {
    const entries = ledgerOf([mixedInvoice(), gapOnlyInvoice()]);
    const scoped = scopeToCategories(entries, new Set<string>(), scopeResolver);
    expect(scoped).toHaveLength(2);
    scoped.forEach((entry, index) => {
      const source = entries[index];
      if (source === undefined) throw new Error("no source");
      expect(entry.uuid).toBe(source.uuid);
      expect(entry.conIva).toBe(source.conIva);
      expect(entry.sinIva).toBe(source.sinIva);
      expect(entry.fullConIva).toBe(source.conIva);
      expect(entry.fullSinIva).toBe(source.sinIva);
      expect(entry.parts).toEqual(splitEntry(source, scopeResolver));
    });
  });

  it("keeps only the selected parts and sums them exactly, keeping the full amount apart", () => {
    const [entry] = scopeToCategories(ledgerOf([mixedInvoice()]), new Set([LIMPIEZA]), scopeResolver);
    if (entry === undefined) throw new Error("dropped");
    // Cloro 38.66 + Trapeador 38.68 + the 0.01 gap; Sin IVA 33.33 + 33.34 + 0.01.
    expect(entry.conIva !== null && eq(entry.conIva, "77.35")).toBe(true);
    expect(entry.sinIva !== null && eq(entry.sinIva, "66.68")).toBe(true);
    expect(entry.fullConIva !== null && eq(entry.fullConIva, "116.01")).toBe(true);
    expect(entry.fullSinIva !== null && eq(entry.fullSinIva, "100.01")).toBe(true);
    expect(entry.parts.every((part) => part.category === LIMPIEZA)).toBe(true);
    expect(entry.parts.map((part) => part.concept)).toEqual([0, 2, null]);
  });

  it("drops an invoice with no part in the selection", () => {
    const onlyB = makeInvoice({
      emisor: B,
      subTotal: "50.00",
      total: "58.00",
      conceptos: [concepto("Servicio", "50.00", "8.00")],
    });
    const scoped = scopeToCategories(ledgerOf([mixedInvoice(), onlyB]), new Set([LIMPIEZA]), scopeResolver);
    expect(scoped).toHaveLength(1);
  });

  it("keeps an invoice whose only part in the selection is the one-cent rounding difference (D-27)", () => {
    const [entry] = scopeToCategories(ledgerOf([gapOnlyInvoice()]), new Set([LIMPIEZA]), scopeResolver);
    if (entry === undefined) throw new Error("dropped");
    expect(entry.conIva !== null && eq(entry.conIva, "0.01")).toBe(true);
    expect(entry.sinIva !== null && eq(entry.sinIva, "0.01")).toBe(true);
    expect(entry.parts.map((part) => part.concept)).toEqual([null]);
  });

  it("keeps a Pago entry (no amounts) under the category of its line and drops it under another", () => {
    const resolver = resolverFor([[A.rfc, SERVICIOS]]);
    const kept = scopeToCategories([pagoEntry()], new Set([SERVICIOS]), resolver);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.conIva).toBeNull();
    expect(kept[0]?.sinIva).toBeNull();
    expect(scopeToCategories([pagoEntry()], new Set([LIMPIEZA]), resolver)).toHaveLength(0);
  });

  it("keeps the input order and never mutates the input", () => {
    const entries = ledgerOf([mixedInvoice(), gapOnlyInvoice(), mixedInvoice()]);
    const snapshot = entries.map((entry) => ({ ...entry }));
    const scoped = scopeToCategories(entries, new Set([LIMPIEZA]), scopeResolver);
    expect(scoped.map((entry) => entry.uuid)).toEqual(entries.map((entry) => entry.uuid));
    expect(entries).toEqual(snapshot);
    expect(scoped[0]).not.toBe(entries[0]);
  });

  it("counts as Facturas the kept counted Ingreso entries, and Ticket is the partial spend over them", () => {
    const onlyB = makeInvoice({
      emisor: B,
      subTotal: "50.00",
      total: "58.00",
      conceptos: [concepto("Servicio", "50.00", "8.00")],
    });
    const scoped = scopeToCategories(
      ledgerOf([mixedInvoice(), gapOnlyInvoice(), onlyB]),
      new Set([LIMPIEZA]),
      scopeResolver,
    );
    const result = kpis(scoped, { from: "2025-01", to: "2025-01" }, "con");
    expect(result.facturas).toBe(2);
    // 77.35 (mixed) + 0.01 (gap only).
    expect(eq(result.gasto, "77.36")).toBe(true);
    expect(result.ticket !== null && eq(result.ticket, "38.68")).toBe(true);
  });

  it("makes categoryBreakdown list only the selected category, with pct over the filtered total", () => {
    const scoped = scopeToCategories(ledgerOf([mixedInvoice()]), new Set([SERVICIOS]), scopeResolver);
    const rows = categoryBreakdown(scoped, "con", 1, scopeNameOf);
    expect(rows.map((row) => row.category)).toEqual([SERVICIOS]);
    expect(eq(rows[0]?.net ?? ZERO, "38.66")).toBe(true);
    expect(rows[0]?.pct !== null && rows[0]?.pct !== undefined && rows[0].pct.eq(new Big("1"))).toBe(true);
  });

  it("guards the divisions when the selection keeps only non-summing rows (T-03-19)", () => {
    const resolver = resolverFor([[A.rfc, LIMPIEZA]]);
    const scoped = scopeToCategories([pagoEntry()], new Set([LIMPIEZA]), resolver);
    expect(scoped).toHaveLength(1);
    const result = kpis(scoped, { from: "2025-01", to: "2025-01" }, "con");
    expect(result.facturas).toBe(0);
    expect(result.ticket).toBeNull();
    expect(categoryBreakdown(scoped, "con", 1, scopeNameOf)).toEqual([]);
  });

  it("reproduces the unfiltered KPIs, trend and ranking when every category is selected (every category identity)", () => {
    const categoryIds = scopeSettings.categories.map((category) => category.id);
    const everything = new Set<string>([...categoryIds, SIN_CATEGORIA]);
    const random = seeded(20251017);
    const pick = <T,>(values: readonly T[]): T => {
      const value = values[Math.floor(random() * values.length)];
      if (value === undefined) throw new Error("empty pick");
      return value;
    };
    const suppliers = [A, B, { rfc: "CCC010101CCC", nombre: "Proveedor C" }];
    const descriptions = ["Cloro", "Café", "Servicio", "Papel", "Azúcar"];
    const tipos = ["I", "I", "I", "E", "P"] as const;
    const invoices: ParsedInvoice[] = [];
    for (let index = 0; index < 60; index += 1) {
      const lines = 1 + Math.floor(random() * 4);
      let subTotal = BigInt(0);
      let total = BigInt(0);
      const conceptos: Concepto[] = [];
      for (let line = 0; line < lines; line += 1) {
        const importe = BigInt(100 + Math.floor(random() * 90000));
        const iva = (importe * BigInt(16)) / BigInt(100);
        subTotal += importe;
        total += importe + iva;
        conceptos.push(concepto(pick(descriptions), centsText(importe), centsText(iva)));
      }
      const gap = BigInt(pick([0, 0, 1, -1]));
      invoices.push(
        makeInvoice({
          emisor: pick(suppliers),
          tipo: pick(tipos),
          fecha: `2025-${String(1 + Math.floor(random() * 6)).padStart(2, "0")}-10T10:00:00`,
          subTotal: centsText(subTotal + gap),
          total: centsText(total + gap),
          conceptos,
        }),
      );
    }
    const excluded = new Set<string>(invoices.filter((_, index) => index % 11 === 0).map((invoice) => invoice.uuid));
    const entries = buildLedger(
      invoices.map(loaded),
      { excluded, restored: new Set<string>() },
      TEST_FECHA_CONTEXT,
    );
    const scoped = scopeToCategories(entries, everything, scopeResolver);
    expect(scoped).toHaveLength(entries.length);
    const range = { from: "2025-01", to: "2025-06" };
    for (const mode of ["con", "sin"] as const) {
      expect(totalSpend(scoped, mode).eq(totalSpend(entries, mode))).toBe(true);
      const before = kpis(entries, range, mode);
      const after = kpis(scoped, range, mode);
      expect(after.gasto.eq(before.gasto)).toBe(true);
      expect(after.facturas).toBe(before.facturas);
      expect(after.notas).toBe(before.notas);
      expect(after.promedio.eq(before.promedio)).toBe(true);
      expect(after.ticket === null ? null : after.ticket.toString()).toBe(
        before.ticket === null ? null : before.ticket.toString(),
      );
      expect(monthlySeries(scoped, range, mode).map((point) => [point.month, point.amount.toString()])).toEqual(
        monthlySeries(entries, range, mode).map((point) => [point.month, point.amount.toString()]),
      );
      expect(supplierRanking(scoped, mode).map((row) => [row.rfc, row.net.toString(), row.facturas])).toEqual(
        supplierRanking(entries, mode).map((row) => [row.rfc, row.net.toString(), row.facturas]),
      );
      const rows = categoryBreakdown(scoped, mode, 6, scopeNameOf);
      expect(sum(rows.map((row) => row.net)).eq(totalSpend(entries, mode))).toBe(true);
    }
  });
});

describe("categoryOptions (D-15, D-28)", () => {
  const sinCategoryInvoice = makeInvoice({
    emisor: { rfc: "CCC010101CCC", nombre: "Proveedor C" },
    subTotal: "10.00",
    total: "11.60",
    conceptos: [concepto("Papel", "10.00", "1.60")],
  });
  const entries = ledgerOf([mixedInvoice(), gapOnlyInvoice(), sinCategoryInvoice]);
  const options = categoryOptions(entries, scopeResolver, scopeSettings.categories, scopeNameOf);

  it("lists every category of the settings plus Sin categoría, with zero counts allowed", () => {
    expect(options).toHaveLength(scopeSettings.categories.length + 1);
    expect(options.map((option) => option.key)).toContain(SIN_CATEGORIA);
    expect(options.filter((option) => option.count === 0).length).toBe(scopeSettings.categories.length - 2);
  });

  it("counts each invoice once per category it has any part in, lines or rounding difference", () => {
    const countOf = (key: string) => options.find((option) => option.key === key)?.count;
    expect(countOf(LIMPIEZA)).toBe(2);
    expect(countOf(SERVICIOS)).toBe(2);
    expect(countOf(SIN_CATEGORIA)).toBe(1);
  });

  it("sorts by count descending, then name, with labels from nameOf", () => {
    expect(options.slice(0, 3).map((option) => option.label)).toEqual([
      "Limpieza e higiene",
      "Servicios",
      "Sin categoría",
    ]);
    const names = options.slice(3).map((option) => option.label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })));
  });

  it("ignores whether an entry is counted or excluded", () => {
    const excluded = makeEntry({
      invoice: mixedInvoice(),
      counted: false,
      exclusion: "manual",
    });
    const result = categoryOptions([excluded], scopeResolver, scopeSettings.categories, scopeNameOf);
    expect(result.find((option) => option.key === SERVICIOS)?.count).toBe(1);
  });
});

describe("ruleLineCounts (D-09)", () => {
  const withLines = (
    emisor: { rfc: string; nombre: string },
    descripciones: string[],
    extra: Partial<ParsedInvoice> = {},
  ) =>
    makeInvoice({
      emisor,
      conceptos: descripciones.map((descripcion) => concepto(descripcion, "100.00", "16.00")),
      ...extra,
    });

  it("counts the equal lines of one supplier across invoices under its rule key", () => {
    const ledger = ledgerOf([withLines(A, ["CLORO 1L", "Jabón"]), withLines(A, ["cloro  1l"])]);
    const counts = ruleLineCounts(ledger);
    expect(counts.get(ruleMapKey(A.rfc, "cloro 1l"))).toBe(2);
    expect(counts.get(ruleMapKey(A.rfc, "jabon"))).toBe(1);
  });

  it("keeps the same text of another supplier under that supplier's own key", () => {
    const ledger = ledgerOf([withLines(A, ["CLORO 1L"]), withLines(B, ["Cloro 1L"])]);
    const counts = ruleLineCounts(ledger);
    expect(counts.get(ruleMapKey(A.rfc, "cloro 1l"))).toBe(1);
    expect(counts.get(ruleMapKey(B.rfc, "cloro 1l"))).toBe(1);
  });

  it("counts two equal lines of the same invoice, and ñ stays apart from n", () => {
    const ledger = ledgerOf([withLines(A, ["Peña", "PEÑA", "Pena"])]);
    const counts = ruleLineCounts(ledger);
    expect(counts.get(ruleMapKey(A.rfc, "peña"))).toBe(2);
    expect(counts.get(ruleMapKey(A.rfc, "pena"))).toBe(1);
  });

  it("counts the lines of Pago and excluded entries, which do not add to the spend", () => {
    const pago = withLines(A, ["CLORO 1L"], { tipo: "P" });
    const excluded = withLines(A, ["CLORO 1L"]);
    const ledger = buildLedger(
      [loaded(pago), loaded(excluded), loaded(withLines(A, ["CLORO 1L"]))],
      { excluded: new Set([excluded.uuid]), restored: new Set<string>() },
      TEST_FECHA_CONTEXT,
    );
    expect(ledger.some((entry) => !entry.counted)).toBe(true);
    expect(ruleLineCounts(ledger).get(ruleMapKey(A.rfc, "cloro 1l"))).toBe(3);
  });

  it("returns an empty map for an empty ledger and treats __proto__ as plain data", () => {
    expect(ruleLineCounts([]).size).toBe(0);
    const ledger = ledgerOf([withLines({ rfc: "__proto__", nombre: "Raro" }, ["__proto__"])]);
    expect(ruleLineCounts(ledger).get(ruleMapKey("__proto__", "__proto__"))).toBe(1);
  });
});
