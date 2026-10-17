import { describe, expect, it } from "vitest";
import {
  addCategory,
  categoryUsage,
  deleteCategory,
  renameCategory,
  restoreCategory,
  validateCategoryName,
} from "./categories";
import { settingsDataSchema } from "./schema";
import { LIMITS, SIN_CATEGORIA, defaultSettings, type SettingsData } from "./types";

const LIMPIEZA = "seed:limpieza-higiene";
const SERVICIOS = "seed:servicios";
const OTROS = "seed:otros";

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

/** Two suppliers and two concept rules on LIMPIEZA, one supplier and one rule on SERVICIOS. */
function used(): SettingsData {
  return {
    ...defaultSettings(),
    supplierCategories: [
      { rfc: "AAA010101AAA", name: "A", categoryId: LIMPIEZA },
      { rfc: "BBB010101BBB", name: "B", categoryId: SERVICIOS },
      { rfc: "CCC010101CCC", name: "C", categoryId: LIMPIEZA },
    ],
    conceptRules: [
      { rfc: "BBB010101BBB", key: "luz", description: "Luz", categoryId: LIMPIEZA },
      { rfc: "AAA010101AAA", key: "cloro", description: "Cloro", categoryId: SERVICIOS },
      { rfc: "CCC010101CCC", key: "jabon", description: "Jabón", categoryId: LIMPIEZA },
      { rfc: "CCC010101CCC", key: "otro", description: "Otro", categoryId: null },
    ],
  };
}

function withCategories(count: number): SettingsData {
  return {
    ...defaultSettings(),
    categories: Array.from({ length: count }, (_, index) => ({
      id: `cat_${String(index)}`,
      name: `Categoría ${String(index)}`,
    })),
  };
}

describe("validateCategoryName", () => {
  it("trims the name", () => {
    expect(validateCategoryName(defaultSettings(), "  Café  ", null)).toEqual({
      ok: true,
      name: "Café",
    });
  });

  it("gives empty for an empty name and for only spaces", () => {
    expect(validateCategoryName(defaultSettings(), "", null)).toEqual({ ok: false, reason: "empty" });
    expect(validateCategoryName(defaultSettings(), "   ", null)).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("gives too-long over 60 characters and accepts exactly 60", () => {
    expect(validateCategoryName(defaultSettings(), "a".repeat(61), null)).toEqual({
      ok: false,
      reason: "too-long",
    });
    expect(validateCategoryName(defaultSettings(), "a".repeat(60), null)).toEqual({
      ok: true,
      name: "a".repeat(60),
    });
  });

  it("gives reserved for «Sin categoría» in any case and with edge spaces", () => {
    for (const raw of ["Sin categoría", "sin categoría", " SIN CATEGORÍA "]) {
      expect(validateCategoryName(defaultSettings(), raw, null)).toEqual({
        ok: false,
        reason: "reserved",
      });
    }
  });

  it("gives duplicate for a name equal to another one ignoring case and edge spaces", () => {
    expect(validateCategoryName(defaultSettings(), "  limpieza E HIGIENE ", null)).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("does not ignore accents: Cafe and Café are distinct names", () => {
    const settings: SettingsData = {
      ...defaultSettings(),
      categories: [{ id: "cat_1", name: "Café" }],
    };
    expect(validateCategoryName(settings, "Cafe", null)).toEqual({ ok: true, name: "Cafe" });
    expect(validateCategoryName(settings, "café", null)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("excludes exceptId from the duplicate check", () => {
    expect(validateCategoryName(defaultSettings(), "LIMPIEZA E HIGIENE", LIMPIEZA)).toEqual({
      ok: true,
      name: "LIMPIEZA E HIGIENE",
    });
    expect(validateCategoryName(defaultSettings(), "Otros", LIMPIEZA)).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });
});

describe("addCategory", () => {
  it("appends the trimmed name with the given id and returns the category", () => {
    const result = addCategory(defaultSettings(), "  Café  ", "cat_new");
    expect(result).toEqual({
      ok: true,
      category: { id: "cat_new", name: "Café" },
      next: {
        ...defaultSettings(),
        categories: [...defaultSettings().categories, { id: "cat_new", name: "Café" }],
      },
    });
  });

  it("refuses the reserved name, a duplicate and an empty name without writing", () => {
    expect(addCategory(defaultSettings(), "sin categoría", "cat_new")).toEqual({
      ok: false,
      reason: "reserved",
    });
    expect(addCategory(defaultSettings(), "OTROS", "cat_new")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(addCategory(defaultSettings(), " ", "cat_new")).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses the 201st category with limit and accepts the 200th", () => {
    expect(addCategory(withCategories(LIMITS.categories - 1), "Nueva", "cat_new").ok).toBe(true);
    expect(addCategory(withCategories(LIMITS.categories), "Nueva", "cat_new")).toEqual({
      ok: false,
      reason: "limit",
    });
  });

  it("refuses an id equal to the reserved key or to an existing id with duplicate", () => {
    expect(addCategory(defaultSettings(), "Nueva", SIN_CATEGORIA)).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(addCategory(defaultSettings(), "Nueva", LIMPIEZA)).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("returns settings that the stored schema accepts", () => {
    const result = addCategory(defaultSettings(), "Café", "cat_new");
    if (!result.ok) throw new Error("the add must be accepted");
    expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
  });
});

describe("renameCategory", () => {
  it("keeps the id and the position", () => {
    const result = renameCategory(defaultSettings(), SERVICIOS, "Luz y agua");
    if (!result.ok) throw new Error("the rename must be accepted");
    expect(result.next.categories.map((category) => category.id)).toEqual(
      defaultSettings().categories.map((category) => category.id),
    );
    expect(result.next.categories[3]).toEqual({ id: SERVICIOS, name: "Luz y agua" });
  });

  it("allows the same name in another case", () => {
    const result = renameCategory(defaultSettings(), LIMPIEZA, "LIMPIEZA E HIGIENE");
    if (!result.ok) throw new Error("the rename must be accepted");
    expect(result.next.categories[2]).toEqual({ id: LIMPIEZA, name: "LIMPIEZA E HIGIENE" });
  });

  it("refuses another category's name with duplicate", () => {
    expect(renameCategory(defaultSettings(), LIMPIEZA, "otros")).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("refuses the reserved name, an empty name and a too long name", () => {
    expect(renameCategory(defaultSettings(), LIMPIEZA, "Sin categoría")).toEqual({
      ok: false,
      reason: "reserved",
    });
    expect(renameCategory(defaultSettings(), LIMPIEZA, "  ")).toEqual({ ok: false, reason: "empty" });
    expect(renameCategory(defaultSettings(), LIMPIEZA, "x".repeat(61))).toEqual({
      ok: false,
      reason: "too-long",
    });
  });

  it("keeps the assignments and rules of the renamed category (they point at the id)", () => {
    const result = renameCategory(used(), LIMPIEZA, "Aseo");
    if (!result.ok) throw new Error("the rename must be accepted");
    expect(result.next.supplierCategories).toEqual(used().supplierCategories);
    expect(result.next.conceptRules).toEqual(used().conceptRules);
  });

  it("returns the very same settings object for an unknown id", () => {
    const settings = defaultSettings();
    const result = renameCategory(settings, "cat_missing", "Algo");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next).toBe(settings);
  });
});

describe("categoryUsage", () => {
  it("counts supplier assignments and concept rules that point at the id", () => {
    expect(categoryUsage(used(), LIMPIEZA)).toEqual({ suppliers: 2, concepts: 2 });
    expect(categoryUsage(used(), SERVICIOS)).toEqual({ suppliers: 1, concepts: 1 });
  });

  it("is zero for an unused category and for an unknown id", () => {
    expect(categoryUsage(used(), OTROS)).toEqual({ suppliers: 0, concepts: 0 });
    expect(categoryUsage(used(), "cat_missing")).toEqual({ suppliers: 0, concepts: 0 });
  });

  it("does not count explicit Sin categoría rules", () => {
    expect(categoryUsage(used(), SIN_CATEGORIA)).toEqual({ suppliers: 0, concepts: 0 });
  });
});

describe("deleteCategory", () => {
  it("with a null target removes the category and its supplier assignments and nulls its rules", () => {
    const result = deleteCategory(used(), LIMPIEZA, null);
    if (result === null) throw new Error("the delete must be accepted");
    expect(result.next.categories.some((category) => category.id === LIMPIEZA)).toBe(false);
    expect(result.next.supplierCategories).toEqual([
      { rfc: "BBB010101BBB", name: "B", categoryId: SERVICIOS },
    ]);
    expect(result.next.conceptRules).toEqual([
      { rfc: "BBB010101BBB", key: "luz", description: "Luz", categoryId: null },
      { rfc: "AAA010101AAA", key: "cloro", description: "Cloro", categoryId: SERVICIOS },
      { rfc: "CCC010101CCC", key: "jabon", description: "Jabón", categoryId: null },
      { rfc: "CCC010101CCC", key: "otro", description: "Otro", categoryId: null },
    ]);
  });

  it("with a target moves the supplier assignments and the rules to it", () => {
    const result = deleteCategory(used(), LIMPIEZA, OTROS);
    if (result === null) throw new Error("the delete must be accepted");
    expect(result.next.supplierCategories).toEqual([
      { rfc: "AAA010101AAA", name: "A", categoryId: OTROS },
      { rfc: "BBB010101BBB", name: "B", categoryId: SERVICIOS },
      { rfc: "CCC010101CCC", name: "C", categoryId: OTROS },
    ]);
    expect(result.next.conceptRules.map((rule) => rule.categoryId)).toEqual([
      OTROS,
      SERVICIOS,
      OTROS,
      null,
    ]);
  });

  it("returns settings that the stored schema accepts for both kinds of target", () => {
    for (const target of [null, OTROS]) {
      const result = deleteCategory(used(), LIMPIEZA, target);
      if (result === null) throw new Error("the delete must be accepted");
      expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
    }
  });

  it("returns null when the target is the deleted category or does not exist", () => {
    expect(deleteCategory(used(), LIMPIEZA, LIMPIEZA)).toBeNull();
    expect(deleteCategory(used(), LIMPIEZA, "cat_missing")).toBeNull();
    expect(deleteCategory(used(), LIMPIEZA, SIN_CATEGORIA)).toBeNull();
  });

  it("returns null for an unknown category", () => {
    expect(deleteCategory(used(), "cat_missing", null)).toBeNull();
  });

  it("keeps in the snapshot the category, its index and copies of what it had", () => {
    const result = deleteCategory(used(), LIMPIEZA, OTROS);
    if (result === null) throw new Error("the delete must be accepted");
    expect(result.snapshot).toEqual({
      category: { id: LIMPIEZA, name: "Limpieza e higiene" },
      index: 2,
      suppliers: [
        { rfc: "AAA010101AAA", name: "A", categoryId: LIMPIEZA },
        { rfc: "CCC010101CCC", name: "C", categoryId: LIMPIEZA },
      ],
      rules: [
        { rfc: "BBB010101BBB", key: "luz", description: "Luz", categoryId: LIMPIEZA },
        { rfc: "CCC010101CCC", key: "jabon", description: "Jabón", categoryId: LIMPIEZA },
      ],
    });
  });

  it("leaves a snapshot that later changes of the next settings cannot alter", () => {
    const result = deleteCategory(used(), LIMPIEZA, OTROS);
    if (result === null) throw new Error("the delete must be accepted");
    const first = result.next.supplierCategories[0];
    if (first === undefined) throw new Error("expected an assignment");
    first.categoryId = SERVICIOS;
    expect(result.snapshot.suppliers[0]?.categoryId).toBe(LIMPIEZA);
  });

  it("does not mutate its input", () => {
    const frozen = deepFreeze(used());
    expect(() => deleteCategory(frozen, LIMPIEZA, null)).not.toThrow();
    expect(() => deleteCategory(frozen, LIMPIEZA, OTROS)).not.toThrow();
  });
});

describe("restoreCategory", () => {
  it("puts the category back at its index with the same id and the same assignments (move target)", () => {
    const before = used();
    const deleted = deleteCategory(before, LIMPIEZA, OTROS);
    if (deleted === null) throw new Error("the delete must be accepted");
    expect(restoreCategory(deleted.next, deleted.snapshot)).toEqual(before);
  });

  it("re-adds the removed assignments and puts the rules back (Sin categoría target)", () => {
    const before = used();
    const deleted = deleteCategory(before, LIMPIEZA, null);
    if (deleted === null) throw new Error("the delete must be accepted");
    const restored = restoreCategory(deleted.next, deleted.snapshot);
    expect(restored.categories).toEqual(before.categories);
    expect(restored.conceptRules).toEqual(before.conceptRules);
    expect(restored.supplierCategories).toHaveLength(before.supplierCategories.length);
    for (const assignment of before.supplierCategories) {
      expect(restored.supplierCategories).toContainEqual(assignment);
    }
  });

  it("keeps assignments and rules that the delete did not touch", () => {
    const deleted = deleteCategory(used(), LIMPIEZA, OTROS);
    if (deleted === null) throw new Error("the delete must be accepted");
    const changed: SettingsData = {
      ...deleted.next,
      supplierCategories: [
        ...deleted.next.supplierCategories,
        { rfc: "DDD010101DDD", name: "D", categoryId: SERVICIOS },
      ],
    };
    const restored = restoreCategory(changed, deleted.snapshot);
    expect(restored.supplierCategories).toContainEqual({
      rfc: "DDD010101DDD",
      name: "D",
      categoryId: SERVICIOS,
    });
    expect(restored.supplierCategories).toContainEqual({
      rfc: "AAA010101AAA",
      name: "A",
      categoryId: LIMPIEZA,
    });
  });

  it("clamps the index to the length when categories were removed in the meantime", () => {
    const base = withCategories(3);
    const snapshot = {
      category: { id: "cat_back", name: "Vuelve" },
      index: 10,
      suppliers: [],
      rules: [],
    };
    const restored = restoreCategory(base, snapshot);
    expect(restored.categories.at(-1)).toEqual({ id: "cat_back", name: "Vuelve" });
    expect(restored.categories).toHaveLength(4);
  });

  it("returns the settings unchanged when the id already exists", () => {
    const settings = defaultSettings();
    const snapshot = { category: { id: LIMPIEZA, name: "Otra" }, index: 0, suppliers: [], rules: [] };
    expect(restoreCategory(settings, snapshot)).toBe(settings);
  });

  it("returns the settings unchanged when the name now belongs to another category", () => {
    const settings = defaultSettings();
    const snapshot = { category: { id: "cat_back", name: "otros" }, index: 0, suppliers: [], rules: [] };
    expect(restoreCategory(settings, snapshot)).toBe(settings);
  });

  it("returns the settings unchanged when the category limit would be exceeded", () => {
    const settings = withCategories(LIMITS.categories);
    const snapshot = { category: { id: "cat_back", name: "Vuelve" }, index: 0, suppliers: [], rules: [] };
    expect(restoreCategory(settings, snapshot)).toBe(settings);
  });

  it("returns the settings unchanged when the supplier assignment limit would be exceeded", () => {
    const settings: SettingsData = {
      ...defaultSettings(),
      supplierCategories: Array.from({ length: LIMITS.supplierCategories }, (_, index) => ({
        rfc: `R${String(index)}`,
        name: "N",
        categoryId: LIMPIEZA,
      })),
    };
    const snapshot = {
      category: { id: "cat_back", name: "Vuelve" },
      index: 0,
      suppliers: [{ rfc: "NUEVO", name: "N", categoryId: "cat_back" }],
      rules: [],
    };
    expect(restoreCategory(settings, snapshot)).toBe(settings);
  });

  it("returns settings that the stored schema accepts", () => {
    const deleted = deleteCategory(used(), LIMPIEZA, null);
    if (deleted === null) throw new Error("the delete must be accepted");
    expect(settingsDataSchema.safeParse(restoreCategory(deleted.next, deleted.snapshot)).success).toBe(
      true,
    );
  });
});

describe("purity", () => {
  it("never mutates its input and returns new objects", () => {
    const frozen = deepFreeze(used());
    expect(() => addCategory(frozen, "Café", "cat_new")).not.toThrow();
    expect(() => renameCategory(frozen, LIMPIEZA, "Aseo")).not.toThrow();
    const deleted = deleteCategory(frozen, LIMPIEZA, null);
    if (deleted === null) throw new Error("the delete must be accepted");
    expect(() => restoreCategory(deepFreeze(deleted.next), deleted.snapshot)).not.toThrow();
    const added = addCategory(frozen, "Café", "cat_new");
    if (!added.ok) throw new Error("the add must be accepted");
    expect(added.next).not.toBe(frozen);
    expect(added.next.categories).not.toBe(frozen.categories);
  });
});
