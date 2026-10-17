import { describe, expect, it } from "vitest";
import { splitEntry } from "../accounting/categories";
import { buildLedger, EMPTY_OVERRIDES } from "../accounting/ledger";
import type { LedgerEntry } from "../accounting/ledger";
import type { Concepto, ParsedInvoice } from "../cfdi/types";
import { loaded, makeInvoice, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";
import { setConceptRule } from "./assignments";
import { ruleMapKey } from "./normalize";
import { makeResolver } from "./resolver";
import { settingsDataSchema } from "./schema";
import {
  LIMITS,
  SIN_CATEGORIA,
  defaultSettings,
  type ConceptRule,
  type SettingsData,
} from "./types";

const ABARROTES = "seed:abarrotes-despensa";
const LIMPIEZA = "seed:limpieza-higiene";
const SERVICIOS = "seed:servicios";
const RFC = "AAA010101AAA";
const OTHER_RFC = "BBB010101BBB";

function deepFreeze(settings: SettingsData): SettingsData {
  for (const category of settings.categories) Object.freeze(category);
  for (const assignment of settings.supplierCategories) Object.freeze(assignment);
  for (const rule of settings.conceptRules) Object.freeze(rule);
  Object.freeze(settings.categories);
  Object.freeze(settings.supplierCategories);
  Object.freeze(settings.conceptRules);
  return Object.freeze(settings);
}

function withSupplier(rfc: string, categoryId: string): SettingsData {
  return {
    ...defaultSettings(),
    supplierCategories: [{ rfc, name: "Proveedor", categoryId }],
  };
}

function withRules(count: number): SettingsData {
  return {
    ...defaultSettings(),
    conceptRules: Array.from({ length: count }, (_, index) => ({
      rfc: RFC,
      key: `linea ${String(index)}`,
      description: `Línea ${String(index)}`,
      categoryId: LIMPIEZA,
    })),
  };
}

function mustApply(result: ReturnType<typeof setConceptRule>): {
  next: SettingsData;
  previous: ConceptRule | null;
} {
  if (!result.ok) throw new Error(`the rule must be accepted, got ${result.reason}`);
  return result;
}

describe("setConceptRule", () => {
  it("stores the rfc, the normalized key, the readable description and the category", () => {
    const { next, previous } = mustApply(
      setConceptRule(defaultSettings(), RFC, "Café  Molido 1kg", LIMPIEZA),
    );
    expect(previous).toBeNull();
    expect(next.conceptRules).toEqual([
      { rfc: RFC, key: "cafe molido 1kg", description: "Café  Molido 1kg", categoryId: LIMPIEZA },
    ]);
  });

  it("replaces the rule of the same rfc and key and returns the previous one", () => {
    const first = mustApply(setConceptRule(defaultSettings(), RFC, "CLORO 1L", LIMPIEZA));
    const second = mustApply(setConceptRule(first.next, RFC, "cloro  1l", SERVICIOS));
    expect(second.previous).toEqual({
      rfc: RFC,
      key: "cloro 1l",
      description: "CLORO 1L",
      categoryId: LIMPIEZA,
    });
    expect(second.next.conceptRules).toEqual([
      { rfc: RFC, key: "cloro 1l", description: "cloro  1l", categoryId: SERVICIOS },
    ]);
  });

  it("keeps a rule of another rfc with the same description", () => {
    const first = mustApply(setConceptRule(defaultSettings(), RFC, "Cloro", LIMPIEZA));
    const second = mustApply(setConceptRule(first.next, OTHER_RFC, "Cloro", SERVICIOS));
    expect(second.previous).toBeNull();
    expect(second.next.conceptRules).toHaveLength(2);
  });

  it("stores an explicit «Sin categoría» when the category is null", () => {
    const { next } = mustApply(setConceptRule(defaultSettings(), RFC, "Cloro", null));
    expect(next.conceptRules).toEqual([
      { rfc: RFC, key: "cloro", description: "Cloro", categoryId: null },
    ]);
  });

  it("refuses an id that is not a category with unknown-category", () => {
    expect(setConceptRule(defaultSettings(), RFC, "Cloro", "missing")).toEqual({
      ok: false,
      reason: "unknown-category",
    });
    expect(setConceptRule(defaultSettings(), RFC, "Cloro", SIN_CATEGORIA)).toEqual({
      ok: false,
      reason: "unknown-category",
    });
  });

  it("refuses with limit when appending the 20,001st rule", () => {
    const full = withRules(LIMITS.conceptRules);
    expect(setConceptRule(full, RFC, "Una línea nueva", LIMPIEZA)).toEqual({
      ok: false,
      reason: "limit",
    });
  });

  it("still lets an existing rule change in a full list", () => {
    const full = withRules(LIMITS.conceptRules);
    const changed = setConceptRule(full, RFC, "línea 7", SERVICIOS);
    expect(changed.ok).toBe(true);
    if (changed.ok) expect(changed.next.conceptRules).toHaveLength(LIMITS.conceptRules);
  });

  it("never mutates its input", () => {
    const frozen = deepFreeze({
      ...defaultSettings(),
      conceptRules: [{ rfc: RFC, key: "cloro", description: "Cloro", categoryId: LIMPIEZA }],
    });
    expect(() => setConceptRule(frozen, RFC, "Jabón", SERVICIOS)).not.toThrow();
    expect(() => setConceptRule(frozen, RFC, "CLORO", SERVICIOS)).not.toThrow();
    expect(() => setConceptRule(frozen, RFC, "Cloro", null)).not.toThrow();
    expect(frozen.conceptRules).toEqual([
      { rfc: RFC, key: "cloro", description: "Cloro", categoryId: LIMPIEZA },
    ]);
  });

  it("returns settings that pass the stored-settings schema, also for an rfc such as __proto__", () => {
    const { next } = mustApply(setConceptRule(defaultSettings(), "__proto__", "__proto__", LIMPIEZA));
    expect(settingsDataSchema.safeParse(next).success).toBe(true);
  });
});

describe("Resolver.explain (D-09, UI-SPEC Q4)", () => {
  it("lets a concept rule win over the supplier category, with source «regla»", () => {
    const settings = mustApply(
      setConceptRule(withSupplier(RFC, ABARROTES), RFC, "CLORO 1L", LIMPIEZA),
    ).next;
    const resolver = makeResolver(settings);
    expect(resolver.explain(RFC, "cloro  1l")).toEqual({ category: LIMPIEZA, source: "regla" });
    expect(resolver.resolve(RFC, "CLORO 1L")).toBe(LIMPIEZA);
  });

  it("gives «Sin categoría» with source «regla» for an explicit null rule", () => {
    const settings = mustApply(
      setConceptRule(withSupplier(RFC, ABARROTES), RFC, "CLORO 1L", null),
    ).next;
    expect(makeResolver(settings).explain(RFC, "CLORO 1L")).toEqual({
      category: SIN_CATEGORIA,
      source: "regla",
    });
  });

  it("falls back to the supplier category with source «proveedor»", () => {
    const resolver = makeResolver(withSupplier(RFC, ABARROTES));
    expect(resolver.explain(RFC, "Jabón")).toEqual({ category: ABARROTES, source: "proveedor" });
    expect(resolver.resolve(RFC, "Jabón")).toBe(ABARROTES);
  });

  it("gives «Sin categoría» with source «ninguna» when nothing applies", () => {
    expect(makeResolver(defaultSettings()).explain(RFC, "Jabón")).toEqual({
      category: SIN_CATEGORIA,
      source: "ninguna",
    });
  });

  it("does not match the same description from another rfc", () => {
    const settings = mustApply(
      setConceptRule(withSupplier(OTHER_RFC, ABARROTES), RFC, "CLORO 1L", LIMPIEZA),
    ).next;
    expect(makeResolver(settings).explain(OTHER_RFC, "CLORO 1L")).toEqual({
      category: ABARROTES,
      source: "proveedor",
    });
  });

  it("keeps ñ apart from n when it looks a rule up", () => {
    const settings = mustApply(setConceptRule(defaultSettings(), RFC, "PEÑA", LIMPIEZA)).next;
    const resolver = makeResolver(settings);
    expect(resolver.explain(RFC, "peña").source).toBe("regla");
    expect(resolver.explain(RFC, "PENA").source).toBe("ninguna");
  });

  it("works for an rfc such as __proto__", () => {
    const settings = mustApply(setConceptRule(defaultSettings(), "__proto__", "x", LIMPIEZA)).next;
    const resolver = makeResolver(settings);
    expect(resolver.explain("__proto__", "X")).toEqual({ category: LIMPIEZA, source: "regla" });
    expect(resolver.explain("constructor", "X").source).toBe("ninguna");
  });

  it("skips a stored rule whose category no longer exists", () => {
    const settings: SettingsData = {
      ...withSupplier(RFC, ABARROTES),
      conceptRules: [{ rfc: RFC, key: "cloro", description: "Cloro", categoryId: "cat_gone" }],
    };
    expect(makeResolver(settings).explain(RFC, "Cloro")).toEqual({
      category: ABARROTES,
      source: "proveedor",
    });
  });

  it("builds the rule key from the rfc and the normalized description", () => {
    expect(ruleMapKey(RFC, "cloro")).toBe(`${RFC}\u0000cloro`);
  });
});

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

function entryOf(invoice: ParsedInvoice): LedgerEntry {
  const entry = buildLedger([loaded(invoice)], EMPTY_OVERRIDES, TEST_FECHA_CONTEXT)[0];
  if (entry === undefined) throw new Error("no entry");
  return entry;
}

describe("splitEntry with concept rules (D-12)", () => {
  const conceptos = [
    concepto("CLORO 1L", "100.00", "16.00"),
    concepto("Jabón", "100.00", "16.00"),
    concepto("Trapeador", "100.00", "16.00"),
  ];

  it("puts the adjusted line in the rule's category and the rest, plus the difference, in the supplier's", () => {
    // Concepts add 348.00; the invoice says 348.01, so one cent goes to the supplier category.
    const entry = entryOf(
      makeInvoice({ emisor: { rfc: RFC, nombre: "A" }, subTotal: "300.00", total: "348.01", conceptos }),
    );
    const settings = mustApply(
      setConceptRule(withSupplier(RFC, ABARROTES), RFC, "cloro 1l", LIMPIEZA),
    ).next;
    const parts = splitEntry(entry, makeResolver(settings));
    expect(parts.map((p) => [p.concept, p.category, p.con.toString()])).toEqual([
      [0, LIMPIEZA, "116"],
      [1, ABARROTES, "116"],
      [2, ABARROTES, "116"],
      [null, ABARROTES, "0.01"],
    ]);
  });

  it("makes an adjusted credit-note line negative in the rule's category, nothing inherited from the invoice", () => {
    const nota = entryOf(
      makeInvoice({
        tipo: "E",
        emisor: { rfc: RFC, nombre: "A" },
        subTotal: "300.00",
        total: "348.00",
        conceptos,
        relacionados: [{ tipoRelacion: "01", uuids: ["SOME-OTHER-UUID"] }],
      }),
    );
    const settings = mustApply(
      setConceptRule(withSupplier(RFC, ABARROTES), RFC, "CLORO 1L", LIMPIEZA),
    ).next;
    const parts = splitEntry(nota, makeResolver(settings));
    expect(parts.map((p) => [p.category, p.con.toString()])).toEqual([
      [LIMPIEZA, "-116"],
      [ABARROTES, "-116"],
      [ABARROTES, "-116"],
    ]);
  });
});
