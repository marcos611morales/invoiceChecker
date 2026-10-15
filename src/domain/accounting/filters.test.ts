import { describe, expect, it } from "vitest";
import { makeEntry, makeInvoice } from "../../../tests/support/ledgerFactory";
import { PPD_SIN_COMPLEMENTO, type LedgerEntry } from "./ledger";
import {
  EMPTY_FILTERS,
  applyFilters,
  formaOptions,
  isDefaultFilters,
  loadedSpan,
  normalizeRange,
  previousFilters,
  resolveRange,
  supplierOptions,
  type Filters,
} from "./filters";

function entryIn(month: string | null, overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return makeEntry({ month, ownMonth: month, ...overrides });
}

function withSuppliers(suppliers: string[]): Filters {
  return { ...EMPTY_FILTERS, suppliers: new Set(suppliers) };
}

function withFormas(formas: string[]): Filters {
  return { ...EMPTY_FILTERS, formas: new Set(formas) };
}

function supplierEntry(rfc: string, name: string, overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return makeEntry({
    invoice: makeInvoice({ emisor: { rfc, nombre: name } }),
    supplierRfc: rfc,
    supplierName: name,
    ...overrides,
  });
}

describe("loadedSpan (D-12, D-41)", () => {
  it("covers every loaded entry, including Pago, $0 and excluded ones", () => {
    const entries = [
      entryIn("2025-03"),
      entryIn("2025-07", { counted: false, noSuma: "cero" }),
      entryIn("2025-12", { counted: false, exclusion: "manual" }),
      entryIn("2025-01", { kind: "pago", counted: false, noSuma: "tipo" }),
    ];
    expect(loadedSpan(entries)).toEqual({ from: "2025-01", to: "2025-12" });
  });

  it("ignores entries with no month", () => {
    expect(loadedSpan([entryIn(null), entryIn("2025-05")])).toEqual({
      from: "2025-05",
      to: "2025-05",
    });
  });

  it("is null with no entries or only entries without a month", () => {
    expect(loadedSpan([])).toBeNull();
    expect(loadedSpan([entryIn(null)])).toBeNull();
  });
});

describe("resolveRange and normalizeRange", () => {
  const span = { from: "2025-01", to: "2025-12" };

  it("uses the span when no explicit range is set and the explicit range otherwise", () => {
    expect(resolveRange(EMPTY_FILTERS, span)).toEqual(span);
    expect(resolveRange(EMPTY_FILTERS, null)).toBeNull();
    const explicit = { from: "2025-03", to: "2025-05" };
    expect(resolveRange({ ...EMPTY_FILTERS, range: explicit }, span)).toEqual(explicit);
  });

  it("stores a range equal to the span as null and keeps any other range", () => {
    expect(normalizeRange({ from: "2025-01", to: "2025-12" }, span)).toBeNull();
    const other = { from: "2025-02", to: "2025-12" };
    expect(normalizeRange(other, span)).toEqual(other);
    expect(normalizeRange(other, null)).toEqual(other);
  });
});

describe("applyFilters date filter (FILT-01, D-15)", () => {
  it("keeps months inside the range with both ends inclusive", () => {
    const entries = [
      entryIn("2025-02"),
      entryIn("2025-03"),
      entryIn("2025-04"),
      entryIn("2025-05"),
      entryIn("2025-06"),
    ];
    const filters: Filters = { ...EMPTY_FILTERS, range: { from: "2025-03", to: "2025-05" } };
    const result = applyFilters(entries, filters, { from: "2025-01", to: "2025-12" });
    expect(result.map((e) => e.month)).toEqual(["2025-03", "2025-04", "2025-05"]);
  });

  it("filters a credit note by its imputation month, not its own month", () => {
    const note = entryIn("2025-06", { kind: "nota-credito", ownMonth: "2025-09" });
    const span = { from: "2025-01", to: "2025-12" };
    const june: Filters = { ...EMPTY_FILTERS, range: { from: "2025-06", to: "2025-06" } };
    const september: Filters = { ...EMPTY_FILTERS, range: { from: "2025-09", to: "2025-09" } };
    expect(applyFilters([note], june, span)).toHaveLength(1);
    expect(applyFilters([note], september, span)).toHaveLength(0);
  });

  it("never hides an entry without a month behind the date filter", () => {
    const damaged = entryIn(null, { counted: false, noSuma: "invalido" });
    const filters: Filters = { ...EMPTY_FILTERS, range: { from: "2025-03", to: "2025-03" } };
    expect(applyFilters([damaged], filters, { from: "2025-01", to: "2025-12" })).toHaveLength(1);
  });

  it("does not date-filter anything when there is no range at all", () => {
    const entries = [entryIn("2024-01"), entryIn("2030-01")];
    expect(applyFilters(entries, EMPTY_FILTERS, null)).toHaveLength(2);
  });

  it("uses the span as the range when the filter has none", () => {
    const entries = [entryIn("2024-12"), entryIn("2025-06"), entryIn("2026-01")];
    const result = applyFilters(entries, EMPTY_FILTERS, { from: "2025-01", to: "2025-12" });
    expect(result.map((e) => e.month)).toEqual(["2025-06"]);
  });
});

describe("applyFilters supplier filter (FILT-02, D-43)", () => {
  const a = supplierEntry("AAA010101AAA", "Misma Razon");
  const b = supplierEntry("BBB010101BBB", "Misma Razon");
  const c = supplierEntry("CCC010101CCC", "Otra");

  it("keeps everything with an empty selection", () => {
    expect(applyFilters([a, b, c], EMPTY_FILTERS, null)).toHaveLength(3);
  });

  it("keeps only the selected RFCs", () => {
    const result = applyFilters([a, b, c], withSuppliers(["AAA010101AAA", "CCC010101CCC"]), null);
    expect(result).toEqual([a, c]);
  });

  it("keeps two RFCs with the same display name distinct", () => {
    expect(applyFilters([a, b], withSuppliers(["BBB010101BBB"]), null)).toEqual([b]);
  });

  it("handles an RFC called __proto__", () => {
    const odd = supplierEntry("__proto__", "Raro");
    expect(applyFilters([a, odd], withSuppliers(["__proto__"]), null)).toEqual([odd]);
  });
});

describe("applyFilters forma de pago filter (FILT-04, D-16, D-17)", () => {
  const both = makeEntry({ formas: ["03", "28"] });
  const only28 = makeEntry({ formas: ["28"] });
  const none = makeEntry({ formas: [] });
  const ppd = makeEntry({ formas: [PPD_SIN_COMPLEMENTO] });

  it("matches an entry with several forms under each of them", () => {
    expect(applyFilters([both, only28, none], withFormas(["28"]), null)).toEqual([both, only28]);
    expect(applyFilters([both, only28, none], withFormas(["03"]), null)).toEqual([both]);
  });

  it("never matches an entry with no forms against a non-empty selection", () => {
    expect(applyFilters([none], withFormas(["03", "28"]), null)).toEqual([]);
  });

  it("keeps entries with no forms when nothing is selected", () => {
    expect(applyFilters([none], EMPTY_FILTERS, null)).toEqual([none]);
  });

  it("selects the PPD sentinel and only entries that carry it", () => {
    expect(applyFilters([both, ppd], withFormas([PPD_SIN_COMPLEMENTO]), null)).toEqual([ppd]);
  });
});

describe("applyFilters composition (FILT-05)", () => {
  it("combines the three filters with AND, keeps order and does not mutate the input", () => {
    const keep1 = supplierEntry("AAA010101AAA", "A", { month: "2025-04", formas: ["03"] });
    const wrongMonth = supplierEntry("AAA010101AAA", "A", { month: "2025-09", formas: ["03"] });
    const wrongSupplier = supplierEntry("BBB010101BBB", "B", { month: "2025-04", formas: ["03"] });
    const wrongForma = supplierEntry("AAA010101AAA", "A", { month: "2025-05", formas: ["28"] });
    const keep2 = supplierEntry("AAA010101AAA", "A", { month: "2025-06", formas: ["03", "28"] });
    const input = [keep1, wrongMonth, wrongSupplier, wrongForma, keep2];
    const snapshot = [...input];
    const filters: Filters = {
      range: { from: "2025-04", to: "2025-06" },
      suppliers: new Set(["AAA010101AAA"]),
      formas: new Set(["03"]),
    };
    const result = applyFilters(input, filters, { from: "2025-01", to: "2025-12" });
    expect(result).toEqual([keep1, keep2]);
    expect(input).toEqual(snapshot);
    expect(result).not.toBe(input);
  });
});

describe("supplierOptions (D-14)", () => {
  it("counts every entry per RFC, including Pago, $0 and excluded ones", () => {
    const entries = [
      supplierEntry("AAA010101AAA", "Alfa"),
      supplierEntry("AAA010101AAA", "Alfa", { kind: "pago", counted: false, noSuma: "tipo" }),
      supplierEntry("AAA010101AAA", "Alfa", { counted: false, exclusion: "manual" }),
      supplierEntry("BBB010101BBB", "Beta", { counted: false, noSuma: "cero" }),
    ];
    expect(supplierOptions(entries)).toEqual([
      { key: "AAA010101AAA", label: "Alfa", count: 3 },
      { key: "BBB010101BBB", label: "Beta", count: 1 },
    ]);
  });

  it("sorts by count then by Spanish-collated label, case-insensitive", () => {
    const entries = [
      supplierEntry("CCC010101CCC", "banco"),
      supplierEntry("AAA010101AAA", "Ábaco"),
      supplierEntry("DDD010101DDD", "Zeta"),
      supplierEntry("DDD010101DDD", "Zeta"),
    ];
    expect(supplierOptions(entries).map((o) => o.label)).toEqual(["Zeta", "Ábaco", "banco"]);
  });

  it("keeps two RFCs with the same name as two options", () => {
    const entries = [
      supplierEntry("AAA010101AAA", "Igual"),
      supplierEntry("BBB010101BBB", "Igual"),
    ];
    expect(supplierOptions(entries).map((o) => o.key)).toEqual(["AAA010101AAA", "BBB010101BBB"]);
  });

  it("is empty for no entries", () => {
    expect(supplierOptions([])).toEqual([]);
  });
});

describe("formaOptions (D-14)", () => {
  const labelOf = (code: string): string => (code === "03" ? "Transferencia" : code === "28" ? "Tarjeta de débito" : code);

  it("counts an entry once per form it carries", () => {
    const entries = [
      makeEntry({ formas: ["03", "28"] }),
      makeEntry({ formas: ["28"] }),
      makeEntry({ formas: [] }),
    ];
    expect(formaOptions(entries, labelOf)).toEqual([
      { key: "28", label: "Tarjeta de débito", count: 2 },
      { key: "03", label: "Transferencia", count: 1 },
    ]);
  });

  it("includes the PPD sentinel as an option and sorts ties by the label", () => {
    const entries = [
      makeEntry({ formas: [PPD_SIN_COMPLEMENTO] }),
      makeEntry({ formas: ["28"] }),
      makeEntry({ formas: ["03"] }),
    ];
    const options = formaOptions(entries, (code) => (code === PPD_SIN_COMPLEMENTO ? "PPD sin complemento" : labelOf(code)));
    expect(options.map((o) => o.key)).toEqual([PPD_SIN_COMPLEMENTO, "28", "03"]);
  });

  it("is independent of exclusions", () => {
    const excluded = makeEntry({ formas: ["03"], counted: false, exclusion: "manual" });
    expect(formaOptions([excluded], labelOf)).toEqual([{ key: "03", label: "Transferencia", count: 1 }]);
  });
});

describe("previousFilters (D-20)", () => {
  it("moves the range to the preceding period of equal length and keeps the two sets", () => {
    const filters: Filters = {
      range: null,
      suppliers: new Set(["AAA010101AAA"]),
      formas: new Set(["03"]),
    };
    const half = previousFilters(filters, { from: "2025-07", to: "2025-12" });
    expect(half.range).toEqual({ from: "2025-01", to: "2025-06" });
    expect(half.suppliers).toEqual(new Set(["AAA010101AAA"]));
    expect(half.formas).toEqual(new Set(["03"]));
    const quarter = previousFilters(filters, { from: "2025-01", to: "2025-03" });
    expect(quarter.range).toEqual({ from: "2024-10", to: "2024-12" });
  });
});

describe("isDefaultFilters", () => {
  it("is true only for a null range with two empty sets", () => {
    expect(isDefaultFilters(EMPTY_FILTERS)).toBe(true);
    expect(isDefaultFilters({ ...EMPTY_FILTERS, range: { from: "2025-01", to: "2025-02" } })).toBe(false);
    expect(isDefaultFilters(withSuppliers(["X"]))).toBe(false);
    expect(isDefaultFilters(withFormas(["03"]))).toBe(false);
  });
});
