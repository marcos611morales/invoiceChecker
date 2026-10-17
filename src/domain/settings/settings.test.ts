import { describe, expect, it } from "vitest";
import { setSupplierCategory } from "./assignments";
import { orderedCategories } from "./categories";
import { makeResolver } from "./resolver";
import { settingsDataSchema } from "./schema";
import {
  LIMITS,
  OTROS_ID,
  SIN_CATEGORIA,
  defaultSettings,
  type SettingsData,
} from "./types";

const LIMPIEZA = "seed:limpieza-higiene";
const SERVICIOS = "seed:servicios";

/** Freezes the settings deeply so any mutation by the code under test throws. */
function deepFreeze(settings: SettingsData): SettingsData {
  for (const category of settings.categories) Object.freeze(category);
  for (const assignment of settings.supplierCategories) Object.freeze(assignment);
  for (const rule of settings.conceptRules) Object.freeze(rule);
  Object.freeze(settings.categories);
  Object.freeze(settings.supplierCategories);
  Object.freeze(settings.conceptRules);
  return Object.freeze(settings);
}

function withAssignments(count: number): SettingsData {
  return {
    ...defaultSettings(),
    supplierCategories: Array.from({ length: count }, (_, index) => ({
      rfc: `RFC${String(index)}`,
      name: `Proveedor ${String(index)}`,
      categoryId: LIMPIEZA,
    })),
  };
}

describe("setSupplierCategory", () => {
  it("appends an assignment for a new rfc", () => {
    const result = setSupplierCategory(defaultSettings(), "AAA010101AAA", "Proveedor A", LIMPIEZA);
    expect(result).toEqual({
      ok: true,
      next: {
        ...defaultSettings(),
        supplierCategories: [{ rfc: "AAA010101AAA", name: "Proveedor A", categoryId: LIMPIEZA }],
      },
    });
  });

  it("refreshes the name and the category of an existing rfc without adding a row", () => {
    const first = setSupplierCategory(defaultSettings(), "AAA010101AAA", "Nombre viejo", LIMPIEZA);
    if (!first.ok) throw new Error("the first assignment must be accepted");
    const second = setSupplierCategory(first.next, "AAA010101AAA", "Nombre nuevo", SERVICIOS);
    expect(second).toEqual({
      ok: true,
      next: {
        ...defaultSettings(),
        supplierCategories: [{ rfc: "AAA010101AAA", name: "Nombre nuevo", categoryId: SERVICIOS }],
      },
    });
  });

  it("removes the assignment of that rfc when the category is null and keeps the others", () => {
    const base: SettingsData = {
      ...defaultSettings(),
      supplierCategories: [
        { rfc: "AAA010101AAA", name: "A", categoryId: LIMPIEZA },
        { rfc: "BBB010101BBB", name: "B", categoryId: SERVICIOS },
      ],
    };
    const result = setSupplierCategory(base, "AAA010101AAA", "A", null);
    expect(result).toEqual({
      ok: true,
      next: {
        ...defaultSettings(),
        supplierCategories: [{ rfc: "BBB010101BBB", name: "B", categoryId: SERVICIOS }],
      },
    });
  });

  it("accepts removing an rfc that has no assignment and changes nothing", () => {
    const result = setSupplierCategory(defaultSettings(), "AAA010101AAA", "A", null);
    expect(result).toEqual({ ok: true, next: defaultSettings() });
  });

  it("refuses an id that is not a category with unknown-category", () => {
    expect(setSupplierCategory(defaultSettings(), "AAA010101AAA", "A", "missing")).toEqual({
      ok: false,
      reason: "unknown-category",
    });
  });

  it("refuses the reserved Sin categoría key as an id", () => {
    expect(setSupplierCategory(defaultSettings(), "AAA010101AAA", "A", SIN_CATEGORIA)).toEqual({
      ok: false,
      reason: "unknown-category",
    });
  });

  it("refuses with limit when appending a 5,001st assignment", () => {
    const full = withAssignments(LIMITS.supplierCategories);
    expect(setSupplierCategory(full, "NEW010101NEW", "Nuevo", LIMPIEZA)).toEqual({
      ok: false,
      reason: "limit",
    });
  });

  it("still lets an existing rfc change or leave a full list", () => {
    const full = withAssignments(LIMITS.supplierCategories);
    const changed = setSupplierCategory(full, "RFC0", "Proveedor 0", SERVICIOS);
    expect(changed.ok).toBe(true);
    const removed = setSupplierCategory(full, "RFC0", "Proveedor 0", null);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.next.supplierCategories).toHaveLength(LIMITS.supplierCategories - 1);
  });

  it("never mutates its input", () => {
    const frozen = deepFreeze({
      ...defaultSettings(),
      supplierCategories: [{ rfc: "AAA010101AAA", name: "A", categoryId: LIMPIEZA }],
    });
    expect(() => setSupplierCategory(frozen, "BBB010101BBB", "B", SERVICIOS)).not.toThrow();
    expect(() => setSupplierCategory(frozen, "AAA010101AAA", "A2", SERVICIOS)).not.toThrow();
    expect(() => setSupplierCategory(frozen, "AAA010101AAA", "A", null)).not.toThrow();
    expect(frozen.supplierCategories).toEqual([{ rfc: "AAA010101AAA", name: "A", categoryId: LIMPIEZA }]);
  });

  it("returns settings that pass the stored-settings schema", () => {
    const result = setSupplierCategory(defaultSettings(), "__proto__", "Proto", LIMPIEZA);
    if (!result.ok) throw new Error("the assignment must be accepted");
    expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
  });
});

describe("orderedCategories", () => {
  it("returns a new array in Spanish order with Otros last", () => {
    const settings = defaultSettings();
    const ordered = orderedCategories(settings.categories);
    expect(ordered).not.toBe(settings.categories);
    expect(ordered.map((category) => category.name)).toEqual([
      "Abarrotes y despensa",
      "Comisiones bancarias",
      "Insumos de cafetería",
      "Limpieza e higiene",
      "Mantenimiento y reparaciones",
      "Papelería y oficina",
      "Servicios (luz, agua, internet, teléfono)",
      "Software y suscripciones",
      "Otros",
    ]);
  });

  it("keeps the category with the Otros id last after it is renamed to Aaa", () => {
    const settings = defaultSettings();
    const renamed = settings.categories.map((category) =>
      category.id === OTROS_ID ? { ...category, name: "Aaa" } : category,
    );
    const ordered = orderedCategories(renamed);
    expect(ordered[ordered.length - 1]).toEqual({ id: OTROS_ID, name: "Aaa" });
    expect(ordered[0]?.name).toBe("Abarrotes y despensa");
  });

  it("ignores accents and case when ordering", () => {
    const ordered = orderedCategories([
      { id: "cat_1", name: "zeta" },
      { id: "cat_2", name: "Árbol" },
      { id: "cat_3", name: "arroz" },
    ]);
    expect(ordered.map((category) => category.name)).toEqual(["Árbol", "arroz", "zeta"]);
  });

  it("does not mutate its input", () => {
    const input = Object.freeze([...defaultSettings().categories]);
    expect(() => orderedCategories(input)).not.toThrow();
  });

  it("returns an empty array for no categories", () => {
    expect(orderedCategories([])).toEqual([]);
  });
});

describe("stable category ids (D-04)", () => {
  it("keeps resolving the supplier to the seed id after the category is renamed", () => {
    const assigned = setSupplierCategory(defaultSettings(), "AAA010101AAA", "A", LIMPIEZA);
    if (!assigned.ok) throw new Error("the assignment must be accepted");
    const renamed: SettingsData = {
      ...assigned.next,
      categories: assigned.next.categories.map((category) =>
        category.id === LIMPIEZA ? { ...category, name: "Aseo" } : category,
      ),
    };
    expect(makeResolver(renamed).supplierCategory("AAA010101AAA")).toBe(LIMPIEZA);
    expect(makeResolver(renamed).resolve("AAA010101AAA", "Cloro")).toBe(LIMPIEZA);
  });
});
