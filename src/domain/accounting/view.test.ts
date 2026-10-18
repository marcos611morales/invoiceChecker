import Big from "big.js";
import { describe, expect, it } from "vitest";
import type { Concepto, ParsedInvoice } from "../cfdi/types";
import { normalizeDescription } from "../settings/normalize";
import { makeResolver } from "../settings/resolver";
import { SIN_CATEGORIA, defaultSettings } from "../settings/types";
import { kpiDeltas, kpis, monthlySeries, supplierRanking } from "./aggregate";
import { categoryBreakdown, scopeToCategories } from "./categories";
import { EMPTY_FILTERS, applyFilters, loadedSpan, previousFilters, resolveRange, type Filters } from "./filters";
import { EMPTY_OVERRIDES, buildLedger, type LedgerEntry } from "./ledger";
import { previousPeriod } from "./months";
import { selectView, type ViewInput } from "./view";
import { TEST_FECHA_CONTEXT, loaded, makeInvoice } from "../../../tests/support/ledgerFactory";

const LIMPIEZA = "seed:limpieza-higiene";
const SERVICIOS = "seed:servicios";
const A = { rfc: "AAA010101AAA", nombre: "Proveedor A" };
const B = { rfc: "BBB010101BBB", nombre: "Proveedor B" };

function concepto(descripcion: string, importe: string, iva: string): Concepto {
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
  };
}

const settings = {
  ...defaultSettings(),
  supplierCategories: [
    { rfc: A.rfc, name: A.nombre, categoryId: LIMPIEZA },
    { rfc: B.rfc, name: B.nombre, categoryId: SERVICIOS },
  ],
  conceptRules: [
    { rfc: A.rfc, key: normalizeDescription("Café"), description: "Café", categoryId: SERVICIOS },
  ],
};
const resolver = makeResolver(settings);
const knownCategories: ReadonlySet<string> = new Set(settings.categories.map((category) => category.id));
const nameOf = (key: string): string =>
  key === SIN_CATEGORIA ? "Sin categoría" : (settings.categories.find((c) => c.id === key)?.name ?? key);

function sampleInvoices(): ParsedInvoice[] {
  return [
    // March: the previous period of April-June.
    makeInvoice({
      emisor: A,
      fecha: "2025-03-10T10:00:00",
      subTotal: "100.00",
      total: "116.00",
      conceptos: [concepto("Cloro", "100.00", "16.00")],
    }),
    // April: lines in two categories plus a one-cent gap in LIMPIEZA.
    makeInvoice({
      emisor: A,
      fecha: "2025-04-10T10:00:00",
      subTotal: "100.01",
      total: "116.01",
      conceptos: [
        concepto("Cloro", "33.33", "5.33"),
        concepto("Café", "33.33", "5.33"),
        concepto("Trapeador", "33.34", "5.34"),
      ],
    }),
    makeInvoice({
      emisor: B,
      fecha: "2025-05-10T10:00:00",
      subTotal: "200.00",
      total: "232.00",
      conceptos: [concepto("Servicio", "200.00", "32.00")],
    }),
    makeInvoice({
      emisor: A,
      tipo: "E",
      fecha: "2025-06-10T10:00:00",
      subTotal: "10.00",
      total: "11.60",
      conceptos: [concepto("Cloro", "10.00", "1.60")],
    }),
    makeInvoice({
      emisor: { rfc: "CCC010101CCC", nombre: "Proveedor C" },
      fecha: "2025-06-12T10:00:00",
      subTotal: "30.00",
      total: "34.80",
      conceptos: [concepto("Papel", "30.00", "4.80")],
    }),
  ];
}

function ledger(): LedgerEntry[] {
  return buildLedger(sampleInvoices().map(loaded), EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
}

function input(filters: Filters, overrides: Partial<ViewInput> = {}): ViewInput {
  return { ledger: ledger(), filters, resolver, mode: "con", nameOf, knownCategories, ...overrides };
}

describe("selectView without a category filter", () => {
  const inFilters: Filters = { ...EMPTY_FILTERS, range: { from: "2025-04", to: "2025-06" } };

  it("reproduces the figures the Dashboard computed before, in both modes", () => {
    for (const mode of ["con", "sin"] as const) {
      const entries = ledger();
      const view = selectView({ ...input(inFilters), ledger: entries, mode });
      const span = loadedSpan(entries);
      const range = resolveRange(inFilters, span);
      if (range === null) throw new Error("no range");
      const visible = applyFilters(entries, inFilters, span);
      const current = kpis(visible, range, mode);
      const prevRange = previousPeriod(range.from, range.to);
      const previous = kpis(applyFilters(entries, previousFilters(inFilters, range), span), prevRange, mode);
      const deltas = kpiDeltas(current, previous);

      expect(view.span).toEqual(span);
      expect(view.range).toEqual(range);
      expect(view.previousRange).toEqual(prevRange);
      expect(view.selected.size).toBe(0);
      expect(view.visible).toHaveLength(visible.length);
      expect(view.current.gasto.eq(current.gasto)).toBe(true);
      expect(view.current.facturas).toBe(current.facturas);
      expect(view.current.notas).toBe(current.notas);
      expect(view.current.ticket?.toString()).toBe(current.ticket?.toString());
      expect(view.current.promedio.eq(current.promedio)).toBe(true);
      expect(view.deltas.gasto?.toString()).toBe(deltas.gasto?.toString());
      expect(view.deltas.facturas?.toString()).toBe(deltas.facturas?.toString());
      expect(view.deltas.ticket?.toString()).toBe(deltas.ticket?.toString());
      expect(view.deltas.promedio?.toString()).toBe(deltas.promedio?.toString());
      expect(view.series.map((p) => [p.month, p.amount.toString()])).toEqual(
        monthlySeries(visible, range, mode).map((p) => [p.month, p.amount.toString()]),
      );
      expect(view.ranking.map((r) => [r.rfc, r.net.toString(), r.facturas])).toEqual(
        supplierRanking(visible, mode).map((r) => [r.rfc, r.net.toString(), r.facturas]),
      );
      const expectedCategories = categoryBreakdown(
        scopeToCategories(visible, new Set<string>(), resolver),
        mode,
        current.months,
        nameOf,
      );
      expect(view.categories.map((r) => [r.category, r.net.toString()])).toEqual(
        expectedCategories.map((r) => [r.category, r.net.toString()]),
      );
    }
  });

  it("uses the loaded span when the range is null and has no previous period without one", () => {
    const view = selectView(input(EMPTY_FILTERS));
    expect(view.range).toEqual({ from: "2025-03", to: "2025-06" });
    const empty = selectView(input(EMPTY_FILTERS, { ledger: [] }));
    expect(empty.range).toBeNull();
    expect(empty.previousRange).toBeNull();
    expect(empty.visible).toEqual([]);
    expect(empty.series).toEqual([]);
  });
});

describe("selectView with a category filter (D-14, D-27)", () => {
  const range = { from: "2025-04", to: "2025-06" };

  it("adds only the parts of the chosen category to the KPIs, the trend and the ranking", () => {
    const view = selectView(input({ ...EMPTY_FILTERS, range, categories: new Set([LIMPIEZA]) }));
    expect([...view.selected]).toEqual([LIMPIEZA]);
    // April: Cloro 38.66 + Trapeador 38.68 + gap 0.01 = 77.35; June credit note -11.60.
    expect(view.current.gasto.eq(new Big("65.75"))).toBe(true);
    expect(view.current.facturas).toBe(1);
    expect(view.current.notas).toBe(1);
    expect(view.current.ticket?.eq(new Big("65.75"))).toBe(true);
    expect(view.series.map((p) => p.amount.toString())).toEqual(["77.35", "0", "-11.6"]);
    expect(view.ranking.map((r) => [r.rfc, r.net.toString()])).toEqual([[A.rfc, "65.75"]]);
    expect(view.visible.map((entry) => entry.supplierRfc)).toEqual([A.rfc, A.rfc]);
  });

  it("lists only the chosen categories in the breakdown, with their share of the filtered total", () => {
    const view = selectView(input({ ...EMPTY_FILTERS, range, categories: new Set([SERVICIOS]) }));
    expect(view.categories.map((row) => row.category)).toEqual([SERVICIOS]);
    // April Café 38.66 + May supplier B 232.00.
    expect(view.categories[0]?.net.eq(new Big("270.66"))).toBe(true);
    expect(view.categories[0]?.pct?.eq(new Big("1"))).toBe(true);
  });

  it("keeps the category filter in the previous period of the KPI deltas", () => {
    const view = selectView(input({ ...EMPTY_FILTERS, range, categories: new Set([LIMPIEZA]) }));
    expect(view.previousRange).toEqual({ from: "2025-01", to: "2025-03" });
    // March: the whole 116.00 invoice is LIMPIEZA, so the partial previous spend is 116.00.
    const expected = new Big("65.75").minus(new Big("116")).div(new Big("116"));
    expect(view.deltas.gasto?.toString()).toBe(expected.toString());
    const sinCategory = selectView(
      input({ ...EMPTY_FILTERS, range, categories: new Set([SIN_CATEGORIA]) }),
    );
    // Nothing in March falls in Sin categoría, so there is no previous data to compare with.
    expect(sinCategory.deltas.gasto).toBeNull();
  });

  it("reproduces the unfiltered figures when every category and Sin categoría are selected (every category)", () => {
    const everything = new Set<string>([...knownCategories, SIN_CATEGORIA]);
    for (const mode of ["con", "sin"] as const) {
      const all = selectView(input({ ...EMPTY_FILTERS, categories: everything }, { mode }));
      const none = selectView(input(EMPTY_FILTERS, { mode }));
      expect(all.current.gasto.eq(none.current.gasto)).toBe(true);
      expect(all.current.facturas).toBe(none.current.facturas);
      expect(all.current.ticket?.toString()).toBe(none.current.ticket?.toString());
      expect(all.series.map((p) => p.amount.toString())).toEqual(none.series.map((p) => p.amount.toString()));
      expect(all.ranking.map((r) => [r.rfc, r.net.toString()])).toEqual(
        none.ranking.map((r) => [r.rfc, r.net.toString()]),
      );
      expect(all.categories.map((r) => [r.category, r.net.toString()])).toEqual(
        none.categories.map((r) => [r.category, r.net.toString()]),
      );
    }
  });

  it("ignores a stale id that is not a known category (T-03-20)", () => {
    const view = selectView(input({ ...EMPTY_FILTERS, categories: new Set([LIMPIEZA, "borrada"]) }));
    expect([...view.selected]).toEqual([LIMPIEZA]);
  });

  it("behaves as no category filter when only stale ids are selected (T-03-20)", () => {
    const stale = selectView(input({ ...EMPTY_FILTERS, categories: new Set(["borrada"]) }));
    const none = selectView(input(EMPTY_FILTERS));
    expect(stale.selected.size).toBe(0);
    expect(stale.visible).toHaveLength(none.visible.length);
    expect(stale.current.gasto.eq(none.current.gasto)).toBe(true);
  });

  it("keeps rows that do not sum under the categories of their lines", () => {
    const pago = makeInvoice({
      emisor: A,
      tipo: "P",
      fecha: "2025-05-20T10:00:00",
      conceptos: [concepto("Cloro", "0.00", "0.00")],
    });
    const entries = buildLedger([...sampleInvoices(), pago].map(loaded), EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
    const limpieza = selectView({ ...input({ ...EMPTY_FILTERS, categories: new Set([LIMPIEZA]) }), ledger: entries });
    const servicios = selectView({ ...input({ ...EMPTY_FILTERS, categories: new Set([SERVICIOS]) }), ledger: entries });
    expect(limpieza.visible.some((entry) => entry.kind === "pago")).toBe(true);
    // The Pago line "Cloro" of supplier A resolves to LIMPIEZA, so it is dropped under SERVICIOS.
    expect(servicios.visible.some((entry) => entry.kind === "pago")).toBe(false);
  });
});
