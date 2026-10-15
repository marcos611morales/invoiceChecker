import Big from "big.js";
import { describe, expect, it } from "vitest";
import { makeEntry, makeInvoice } from "../../../tests/support/ledgerFactory";
import {
  deltaFraction,
  kpiDeltas,
  kpis,
  monthlySeries,
  supplierRanking,
  totalSpend,
  type KpiResult,
} from "./aggregate";
import { ZERO } from "./decimal";
import { applyFilters, EMPTY_FILTERS, loadedSpan } from "./filters";
import type { LedgerEntry } from "./ledger";

function big(value: string): Big {
  return new Big(value);
}

interface Spec {
  con: string;
  sin: string;
  month?: string;
  rfc?: string;
  name?: string;
  overrides?: Partial<LedgerEntry>;
}

function ingreso(spec: Spec): LedgerEntry {
  const rfc = spec.rfc ?? "EMI010101AAA";
  const name = spec.name ?? "Proveedor";
  const month = spec.month ?? "2025-01";
  return makeEntry({
    invoice: makeInvoice({ emisor: { rfc, nombre: name } }),
    supplierRfc: rfc,
    supplierName: name,
    conIva: big(spec.con),
    sinIva: big(spec.sin),
    month,
    ownMonth: month,
    ...spec.overrides,
  });
}

function nota(spec: Spec): LedgerEntry {
  // Credit notes are stored already negative (REGLA-01).
  return ingreso({ ...spec, overrides: { kind: "nota-credito", ...spec.overrides } });
}

function notCounted(spec: Spec, overrides: Partial<LedgerEntry>): LedgerEntry {
  return ingreso({ ...spec, overrides: { counted: false, ...overrides } });
}

const RANGE_2025 = { from: "2025-01", to: "2025-12" };

describe("kpis (DASH-01, DASH-06, D-18, D-19, D-39)", () => {
  const visible = [
    ingreso({ con: "116", sin: "100", month: "2025-01" }),
    ingreso({ con: "232", sin: "200", month: "2025-02" }),
    nota({ con: "-58", sin: "-50", month: "2025-02" }),
  ];

  it("sums counted amounts in the chosen mode", () => {
    expect(kpis(visible, RANGE_2025, "con").gasto.eq(big("290"))).toBe(true);
    expect(kpis(visible, RANGE_2025, "sin").gasto.eq(big("250"))).toBe(true);
  });

  it("counts Ingreso invoices and credit notes separately", () => {
    const result = kpis(visible, RANGE_2025, "sin");
    expect(result.facturas).toBe(2);
    expect(result.notas).toBe(1);
    expect(result.hasData).toBe(true);
  });

  it("keeps the counts identical in both modes (D-37)", () => {
    const con = kpis(visible, RANGE_2025, "con");
    const sin = kpis(visible, RANGE_2025, "sin");
    expect(con.facturas).toBe(sin.facturas);
    expect(con.notas).toBe(sin.notas);
    expect(con.gasto.eq(sin.gasto)).toBe(false);
  });

  it("never counts $0, excluded, substituted, invalid or Pago entries", () => {
    const noisy = [
      ...visible,
      notCounted({ con: "0", sin: "0" }, { noSuma: "cero" }),
      notCounted({ con: "500", sin: "431" }, { exclusion: "manual" }),
      notCounted({ con: "500", sin: "431" }, { exclusion: "sustituida" }),
      notCounted({ con: "500", sin: "431" }, { noSuma: "invalido" }),
      notCounted({ con: "500", sin: "431" }, { kind: "pago", noSuma: "tipo" }),
    ];
    const result = kpis(noisy, RANGE_2025, "con");
    expect(result.gasto.eq(big("290"))).toBe(true);
    expect(result.facturas).toBe(2);
    expect(result.notas).toBe(1);
  });

  it("divides gasto by the number of invoices for the ticket", () => {
    expect(kpis(visible, RANGE_2025, "sin").ticket?.eq(big("125"))).toBe(true);
  });

  it("has no ticket when there are no invoices, even with credit notes", () => {
    const onlyNotes = [nota({ con: "-58", sin: "-50" })];
    const result = kpis(onlyNotes, RANGE_2025, "sin");
    expect(result.facturas).toBe(0);
    expect(result.ticket).toBeNull();
    expect(result.hasData).toBe(true);
  });

  it("divides the monthly average by the calendar months of the range", () => {
    const twelve = kpis([ingreso({ con: "1200", sin: "1200" })], RANGE_2025, "sin");
    expect(twelve.months).toBe(12);
    expect(twelve.promedio.eq(big("100"))).toBe(true);
    const one = kpis(
      [ingreso({ con: "1200", sin: "1200" })],
      { from: "2025-03", to: "2025-03" },
      "sin",
    );
    expect(one.months).toBe(1);
    expect(one.promedio.eq(big("1200"))).toBe(true);
  });

  it("does not divide when there is no range", () => {
    const result = kpis([ingreso({ con: "10", sin: "10" })], null, "sin");
    expect(result.months).toBe(0);
    expect(result.promedio.eq(ZERO)).toBe(true);
  });

  it("is empty and finite with nothing visible", () => {
    const result = kpis([], RANGE_2025, "con");
    expect(result.gasto.eq(ZERO)).toBe(true);
    expect(result.facturas).toBe(0);
    expect(result.notas).toBe(0);
    expect(result.ticket).toBeNull();
    expect(result.promedio.eq(ZERO)).toBe(true);
    expect(result.hasData).toBe(false);
  });
});

describe("deltaFraction (D-20)", () => {
  it("returns exact fractions", () => {
    expect(deltaFraction(big("112.4"), big("100"))?.eq(big("0.124"))).toBe(true);
    expect(deltaFraction(big("100"), big("100"))?.eq(ZERO)).toBe(true);
    expect(deltaFraction(big("50"), big("100"))?.eq(big("-0.5"))).toBe(true);
  });

  it("is null against zero, a negative base or a missing previous value", () => {
    expect(deltaFraction(big("10"), ZERO)).toBeNull();
    expect(deltaFraction(big("10"), big("-5"))).toBeNull();
    expect(deltaFraction(big("10"), null)).toBeNull();
  });
});

describe("kpiDeltas (D-20)", () => {
  function result(overrides: Partial<KpiResult>): KpiResult {
    return {
      gasto: ZERO,
      facturas: 0,
      notas: 0,
      ticket: null,
      promedio: ZERO,
      months: 6,
      hasData: false,
      ...overrides,
    };
  }

  it("gives all four null when the previous period has no counted entry", () => {
    const current = result({ gasto: big("100"), facturas: 2, ticket: big("50"), promedio: big("10"), hasData: true });
    const previous = result({ gasto: big("100"), facturas: 2, ticket: big("50"), promedio: big("10"), hasData: false });
    expect(kpiDeltas(current, previous)).toEqual({ gasto: null, facturas: null, ticket: null, promedio: null });
  });

  it("computes each delta independently", () => {
    const current = result({ gasto: big("150"), facturas: 3, ticket: big("50"), promedio: big("25"), hasData: true });
    const previous = result({ gasto: big("100"), facturas: 2, ticket: big("50"), promedio: big("20"), hasData: true });
    const deltas = kpiDeltas(current, previous);
    expect(deltas.gasto?.eq(big("0.5"))).toBe(true);
    expect(deltas.facturas?.eq(big("0.5"))).toBe(true);
    expect(deltas.ticket?.eq(ZERO)).toBe(true);
    expect(deltas.promedio?.eq(big("0.25"))).toBe(true);
  });

  it("leaves the ticket delta null when either ticket is null", () => {
    const current = result({ gasto: big("-10"), facturas: 0, ticket: null, promedio: big("-1"), hasData: true });
    const previous = result({ gasto: big("100"), facturas: 2, ticket: big("50"), promedio: big("20"), hasData: true });
    expect(kpiDeltas(current, previous).ticket).toBeNull();
    expect(kpiDeltas(previous, current).ticket).toBeNull();
  });

  it("leaves a delta null when its previous value is not above zero", () => {
    const current = result({ gasto: big("100"), facturas: 2, ticket: big("50"), promedio: big("10"), hasData: true });
    const previous = result({ gasto: big("-20"), facturas: 0, ticket: null, promedio: big("-3"), hasData: true });
    const deltas = kpiDeltas(current, previous);
    expect(deltas.gasto).toBeNull();
    expect(deltas.facturas).toBeNull();
    expect(deltas.promedio).toBeNull();
  });
});

describe("monthlySeries (DASH-02, D-21)", () => {
  const range = { from: "2025-05", to: "2025-08" };

  it("has one zero-filled point per month of the range", () => {
    const series = monthlySeries(
      [ingreso({ con: "116", sin: "100", month: "2025-05" }), ingreso({ con: "232", sin: "200", month: "2025-07" })],
      range,
      "sin",
    );
    expect(series.map((p) => p.month)).toEqual(["2025-05", "2025-06", "2025-07", "2025-08"]);
    expect(series.map((p) => p.amount.toString())).toEqual(["100", "0", "200", "0"]);
  });

  it("subtracts a credit note in its imputation month", () => {
    const series = monthlySeries(
      [
        ingreso({ con: "116", sin: "100", month: "2025-06" }),
        nota({ con: "-29", sin: "-25", month: "2025-06" }),
      ],
      range,
      "sin",
    );
    expect(series[1]?.amount.toString()).toBe("75");
  });

  it("is negative in a month with only credit notes", () => {
    const series = monthlySeries([nota({ con: "-29", sin: "-25", month: "2025-08" })], range, "sin");
    expect(series[3]?.amount.toString()).toBe("-25");
  });

  it("follows the IVA mode", () => {
    const series = monthlySeries([ingreso({ con: "116", sin: "100", month: "2025-05" })], range, "con");
    expect(series[0]?.amount.toString()).toBe("116");
  });

  it("ignores entries that do not count and entries outside the range", () => {
    const series = monthlySeries(
      [
        notCounted({ con: "999", sin: "999", month: "2025-05" }, { exclusion: "manual" }),
        ingreso({ con: "50", sin: "50", month: "2024-12" }),
      ],
      range,
      "sin",
    );
    expect(series.every((p) => p.amount.eq(ZERO))).toBe(true);
  });

  it("is empty for a null range", () => {
    expect(monthlySeries([ingreso({ con: "1", sin: "1" })], null, "sin")).toEqual([]);
  });
});

describe("supplierRanking (DASH-04, D-23)", () => {
  it("groups per RFC and reports net, invoices, ticket and share of the total", () => {
    const rows = supplierRanking(
      [
        ingreso({ con: "300", sin: "300", rfc: "AAA010101AAA", name: "Alfa" }),
        ingreso({ con: "100", sin: "100", rfc: "AAA010101AAA", name: "Alfa" }),
        nota({ con: "-100", sin: "-100", rfc: "AAA010101AAA", name: "Alfa" }),
        ingreso({ con: "100", sin: "100", rfc: "BBB010101BBB", name: "Beta" }),
      ],
      "sin",
    );
    expect(rows.map((r) => r.rfc)).toEqual(["AAA010101AAA", "BBB010101BBB"]);
    const [alfa, beta] = rows;
    expect(alfa?.name).toBe("Alfa");
    expect(alfa?.net.toString()).toBe("300");
    expect(alfa?.facturas).toBe(2);
    expect(alfa?.ticket?.toString()).toBe("150");
    expect(alfa?.pct?.toString()).toBe("0.75");
    expect(beta?.net.toString()).toBe("100");
    expect(beta?.pct?.toString()).toBe("0.25");
  });

  it("sorts by net descending and ties by Spanish-collated name", () => {
    const rows = supplierRanking(
      [
        ingreso({ con: "100", sin: "100", rfc: "CCC010101CCC", name: "banco" }),
        ingreso({ con: "100", sin: "100", rfc: "DDD010101DDD", name: "Ábaco" }),
        ingreso({ con: "500", sin: "500", rfc: "EEE010101EEE", name: "Zeta" }),
      ],
      "sin",
    );
    expect(rows.map((r) => r.name)).toEqual(["Zeta", "Ábaco", "banco"]);
  });

  it("puts a supplier whose credit notes exceed its purchases last, with a negative net", () => {
    const rows = supplierRanking(
      [
        ingreso({ con: "100", sin: "100", rfc: "AAA010101AAA", name: "Alfa" }),
        ingreso({ con: "10", sin: "10", rfc: "BBB010101BBB", name: "Beta" }),
        nota({ con: "-70", sin: "-70", rfc: "BBB010101BBB", name: "Beta" }),
        ingreso({ con: "50", sin: "50", rfc: "CCC010101CCC", name: "Gama" }),
      ],
      "sin",
    );
    expect(rows.map((r) => r.name)).toEqual(["Alfa", "Gama", "Beta"]);
    expect(rows[2]?.net.toString()).toBe("-60");
  });

  it("has no ticket for a supplier with only credit notes", () => {
    const rows = supplierRanking(
      [ingreso({ con: "100", sin: "100" }), nota({ con: "-20", sin: "-20", rfc: "NNN010101NNN", name: "Notas" })],
      "sin",
    );
    const notas = rows.find((r) => r.rfc === "NNN010101NNN");
    expect(notas?.facturas).toBe(0);
    expect(notas?.ticket).toBeNull();
  });

  it("has no share when the overall total is not above zero, and never throws", () => {
    const rows = supplierRanking([nota({ con: "-20", sin: "-20" })], "sin");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.pct).toBeNull();
  });

  it("creates no row for entries that do not count", () => {
    const rows = supplierRanking(
      [
        ingreso({ con: "100", sin: "100", rfc: "AAA010101AAA" }),
        notCounted({ con: "100", sin: "100", rfc: "ZZZ010101ZZZ" }, { exclusion: "manual" }),
        notCounted({ con: "0", sin: "0", rfc: "YYY010101YYY" }, { noSuma: "cero" }),
      ],
      "sin",
    );
    expect(rows.map((r) => r.rfc)).toEqual(["AAA010101AAA"]);
  });

  it("merges the same RFC under different names into one row", () => {
    const rows = supplierRanking(
      [
        ingreso({ con: "10", sin: "10", rfc: "AAA010101AAA", name: "Alfa" }),
        ingreso({ con: "10", sin: "10", rfc: "AAA010101AAA", name: "Alfa SA" }),
      ],
      "sin",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.net.toString()).toBe("20");
  });

  it("handles an RFC called __proto__", () => {
    const rows = supplierRanking([ingreso({ con: "10", sin: "10", rfc: "__proto__", name: "Raro" })], "sin");
    expect(rows.map((r) => r.rfc)).toEqual(["__proto__"]);
  });

  it("is empty with nothing to rank", () => {
    expect(supplierRanking([], "con")).toEqual([]);
  });
});

describe("one visible set feeds every aggregate (FILT-05, T-02-11)", () => {
  it("gives the same total in the KPI, the monthly series and the ranking", () => {
    const entries = [
      ingreso({ con: "116", sin: "100", month: "2025-01", rfc: "AAA010101AAA", name: "Alfa" }),
      ingreso({ con: "232", sin: "200", month: "2025-03", rfc: "BBB010101BBB", name: "Beta" }),
      nota({ con: "-58", sin: "-50", month: "2025-03", rfc: "BBB010101BBB", name: "Beta" }),
      ingreso({ con: "580", sin: "500", month: "2025-09", rfc: "AAA010101AAA", name: "Alfa" }),
    ];
    const span = loadedSpan(entries);
    const filters = { ...EMPTY_FILTERS, range: { from: "2025-01", to: "2025-06" } };
    const visible = applyFilters(entries, filters, span);
    const range = filters.range;

    for (const mode of ["con", "sin"] as const) {
      const total = totalSpend(visible, mode);
      expect(kpis(visible, range, mode).gasto.eq(total)).toBe(true);
      const seriesTotal = monthlySeries(visible, range, mode).reduce((acc, p) => acc.plus(p.amount), ZERO);
      expect(seriesTotal.eq(total)).toBe(true);
      const rankingTotal = supplierRanking(visible, mode).reduce((acc, r) => acc.plus(r.net), ZERO);
      expect(rankingTotal.eq(total)).toBe(true);
    }
  });
});
