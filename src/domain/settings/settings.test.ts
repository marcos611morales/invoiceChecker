import { describe, expect, it } from "vitest";
import { setSupplierCategory } from "./assignments";
import { orderedCategories } from "./categories";
import { resolvePersisted } from "./migrate";
import { makeResolver } from "./resolver";
import {
  comparableName,
  contentAmountIssue,
  priceIntegrityIssues,
  productIntegrityIssues,
  pruneDanglingOverrides,
  settingsDataSchema,
  settingsDataSchemaV2,
  settingsDataSchemaV3,
} from "./schema";
import {
  LIMITS,
  OTROS_ID,
  SETTINGS_VERSION,
  SIN_CATEGORIA,
  defaultSettings,
  type ContentCorrection,
  type PriceOverride,
  type Product,
  type ProductMember,
  type SettingsData,
  type SettingsDataV2,
  type SettingsDataV3,
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

const LECHE_A: ProductMember = {
  rfc: "AAA010101AAA",
  key: "mm leche ent",
  description: "MM LECHE ENT",
  supplierName: "Proveedor A",
};
const LECHE_B: ProductMember = {
  rfc: "BBB010101BBB",
  key: "leche entera 1l",
  description: "LECHE ENTERA 1L",
  supplierName: "Proveedor B",
};

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod_1",
    name: "Leche entera",
    categoryId: LIMPIEZA,
    members: [LECHE_A, LECHE_B],
    ...overrides,
  };
}

function withProducts(products: Product[], extra: Partial<SettingsData> = {}): SettingsData {
  return { ...defaultSettings(), products, ...extra };
}

function mark(index: number): ProductMember {
  return {
    rfc: "AAA010101AAA",
    key: `u${String(index)}`,
    description: "x",
    supplierName: "A",
  };
}

function singleMemberProducts(count: number): Product[] {
  return Array.from({ length: count }, (_, index) =>
    product({
      id: `prod_${String(index)}`,
      name: `Producto ${String(index)}`,
      members: [mark(index)],
    }),
  );
}

/** `count` products with five members each, except an optional last one with a single member. */
function wideProducts(count: number, lastHasOne: boolean): Product[] {
  return Array.from({ length: count }, (_, index) =>
    product({
      id: `prod_${String(index)}`,
      name: `Producto ${String(index)}`,
      members: Array.from({ length: lastHasOne && index === count - 1 ? 1 : 5 }, (_unused, slot) => ({
        ...mark(index),
        key: `m${String(index)}-${String(slot)}`,
      })),
    }),
  );
}

/** The frozen Phase 3 shape: what a browser that used version 2 holds. */
function v2Value(): SettingsDataV2 {
  return {
    ivaMode: "sin",
    categories: [
      { id: "seed:servicios", name: "Servicios" },
      { id: "cat_1", name: "Café" },
      { id: "cat_2", name: "Eventos" },
    ],
    supplierCategories: [
      { rfc: "AAA010101AAA", name: "Proveedor A", categoryId: "cat_1" },
      { rfc: "BBB010101BBB", name: "Proveedor B", categoryId: "cat_2" },
    ],
    conceptRules: [
      { rfc: "AAA010101AAA", key: "leche", description: "Leche", categoryId: "seed:servicios" },
    ],
  };
}

describe("settings version 4 defaults and constants", () => {
  it("is version 4 and starts with no products, no marks, no corrections and no overrides", () => {
    expect(SETTINGS_VERSION).toBe(4);
    expect(defaultSettings().products).toEqual([]);
    expect(defaultSettings().ungroupedConcepts).toEqual([]);
    expect(defaultSettings().contentCorrections).toEqual([]);
    expect(defaultSettings().priceOverrides).toEqual([]);
    expect(defaultSettings().products).not.toBe(defaultSettings().products);
    expect(defaultSettings().contentCorrections).not.toBe(defaultSettings().contentCorrections);
    expect(defaultSettings().priceOverrides).not.toBe(defaultSettings().priceOverrides);
  });

  it("sets the planner limits for corrections, overrides and pieces per pack (D-15, D-19)", () => {
    expect(LIMITS.contentCorrections).toBe(2000);
    expect(LIMITS.priceOverrides).toBe(2000);
    expect(LIMITS.contentPacks).toBe(999);
  });

  it("sets the planner limits for products, members, marks and product names", () => {
    expect(LIMITS.products).toBe(2000);
    expect(LIMITS.productMembers).toBe(5000);
    expect(LIMITS.ungroupedConcepts).toBe(5000);
    expect(LIMITS.productName).toBe(60);
    expect(LIMITS.backupBytes).toBe(4194304);
  });

  it("exports the name comparison of D-04", () => {
    expect(comparableName("  LECHE Entera ")).toBe("leche entera");
  });
});

describe("resolvePersisted from version 2 (D-13)", () => {
  it("keeps every category, assignment, rule and the IVA mode, adds empty lists and reports migrated", () => {
    const stored = v2Value();
    expect(resolvePersisted(stored, 2)).toEqual({
      data: {
        ...stored,
        products: [],
        ungroupedConcepts: [],
        contentCorrections: [],
        priceOverrides: [],
      },
      status: "migrated",
    });
  });

  it("keeps zero categories of a valid version-2 value", () => {
    const stored: SettingsDataV2 = {
      ivaMode: "con",
      categories: [],
      supplierCategories: [],
      conceptRules: [],
    };
    expect(resolvePersisted(stored, 2)).toEqual({
      data: {
        ...stored,
        products: [],
        ungroupedConcepts: [],
        contentCorrections: [],
        priceOverrides: [],
      },
      status: "migrated",
    });
  });

  it("gives the defaults and unreadable for a malformed version-2 value, without throwing", () => {
    const malformed: unknown[] = [
      null,
      "sin",
      42,
      [],
      { ivaMode: "con", categories: [] },
      { ...v2Value(), ivaMode: "x" },
      { ...v2Value(), supplierCategories: [{ rfc: "AAA010101AAA", name: "A", categoryId: "missing" }] },
      {
        ...v2Value(),
        categories: [
          { id: "c1", name: "Café" },
          { id: "c2", name: " café" },
        ],
      },
    ];
    for (const raw of malformed) {
      expect(resolvePersisted(raw, 2)).toEqual({ data: defaultSettings(), status: "unreadable" });
    }
  });

  it("still migrates a version-1 value as in Phase 3", () => {
    expect(resolvePersisted({ ivaMode: "sin" }, 1)).toEqual({
      data: { ...defaultSettings(), ivaMode: "sin" },
      status: "migrated",
    });
    expect(resolvePersisted({ ivaMode: "x" }, 1)).toEqual({
      data: defaultSettings(),
      status: "unreadable",
    });
  });

  it("reports absent when nothing is stored", () => {
    expect(resolvePersisted(undefined, undefined)).toEqual({
      data: defaultSettings(),
      status: "absent",
    });
  });

  it("freezes the version-2 schema: it reads the four fields and strips anything else", () => {
    expect(settingsDataSchemaV2.safeParse(v2Value()).success).toBe(true);
    const parsed = settingsDataSchemaV2.safeParse({ ...v2Value(), products: [product()] });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Object.keys(parsed.data).sort()).toEqual([
        "categories",
        "conceptRules",
        "ivaMode",
        "supplierCategories",
      ]);
    }
  });
});

/** The frozen Phase 4 shape: what a browser that used version 3 holds. */
function v3Value(): SettingsDataV3 {
  return {
    ...v2Value(),
    products: [
      product({
        id: "prod_1",
        name: "Leche entera",
        categoryId: "cat_1",
        members: [LECHE_A, LECHE_B],
      }),
      product({
        id: "prod_2",
        name: "Cloro",
        categoryId: null,
        members: [{ ...LECHE_A, key: "cloro", description: "CLORO" }],
      }),
    ],
    ungroupedConcepts: [
      { rfc: "AAA010101AAA", key: "flete", description: "FLETE", supplierName: "Proveedor A" },
    ],
  };
}

function correction(overrides: Partial<ContentCorrection> = {}): ContentCorrection {
  return {
    rfc: "AAA010101AAA",
    key: "mm leche ent",
    description: "MM LECHE ENT",
    supplierName: "Proveedor A",
    packs: 12,
    amount: "1",
    unit: "l",
    ...overrides,
  };
}

function priceOverride(overrides: Partial<PriceOverride> = {}): PriceOverride {
  return { productId: "prod_1", comparable: false, ...overrides };
}

/** A valid version-4 value: one product, one correction and one override. */
function v4Value(extra: Partial<SettingsData> = {}): SettingsData {
  return withProducts([product()], {
    contentCorrections: [correction()],
    priceOverrides: [priceOverride()],
    ...extra,
  });
}

describe("resolvePersisted from version 3 (D-15, D-19)", () => {
  it("keeps every category, assignment, rule, product, member and mark, adds the two empty lists and reports migrated", () => {
    const stored = v3Value();
    expect(resolvePersisted(stored, 3)).toEqual({
      data: { ...stored, contentCorrections: [], priceOverrides: [] },
      status: "migrated",
    });
  });

  it("keeps a valid version-3 value with no products and no marks", () => {
    const stored: SettingsDataV3 = { ...v2Value(), products: [], ungroupedConcepts: [] };
    expect(resolvePersisted(stored, 3)).toEqual({
      data: { ...stored, contentCorrections: [], priceOverrides: [] },
      status: "migrated",
    });
  });

  it("gives the defaults and unreadable for a malformed version-3 value, without throwing", () => {
    const malformed: unknown[] = [
      null,
      "sin",
      42,
      [],
      { ...v2Value() },
      { ...v3Value(), ivaMode: "x" },
      { ...v3Value(), products: [product({ categoryId: "missing" })] },
      { ...v3Value(), products: [product({ members: [] })] },
      { ...v3Value(), ungroupedConcepts: [{ ...LECHE_A }] },
    ];
    for (const raw of malformed) {
      expect(resolvePersisted(raw, 3)).toEqual({ data: defaultSettings(), status: "unreadable" });
    }
  });

  it("freezes the version-3 schema: it reads the six fields and strips the corrections and overrides", () => {
    expect(settingsDataSchemaV3.safeParse(v3Value()).success).toBe(true);
    const parsed = settingsDataSchemaV3.safeParse({
      ...v3Value(),
      contentCorrections: [correction()],
      priceOverrides: [priceOverride()],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Object.keys(parsed.data).sort()).toEqual([
        "categories",
        "conceptRules",
        "ivaMode",
        "products",
        "supplierCategories",
        "ungroupedConcepts",
      ]);
    }
  });
});

describe("resolvePersisted version 4 corrections and overrides (D-15, D-19)", () => {
  it("round-trips one correction and one override unchanged and reports ok", () => {
    const stored = v4Value();
    expect(resolvePersisted(stored, 4)).toEqual({ data: stored, status: "ok" });
  });

  it('round-trips an rfc and a product id "__proto__" as plain data', () => {
    const odd = correction({ rfc: "__proto__", key: "__proto__", description: "constructor" });
    const stored = v4Value({
      products: [product({ id: "__proto__" })],
      contentCorrections: [odd],
      priceOverrides: [priceOverride({ productId: "__proto__", comparable: true })],
    });
    const result = resolvePersisted(stored, 4);
    expect(result.status).toBe("ok");
    expect(result.data.contentCorrections[0]?.rfc).toBe("__proto__");
    expect(result.data.priceOverrides[0]?.productId).toBe("__proto__");
    expect(result.data.priceOverrides[0]?.comparable).toBe(true);
    expect(Reflect.get(Object.prototype, "polluted")).toBeUndefined();
  });

  it("accepts the five units and the edges of the packs and the amount", () => {
    const units: ContentCorrection["unit"][] = ["g", "kg", "ml", "l", "piezas"];
    const stored = v4Value({
      priceOverrides: [],
      contentCorrections: units.map((unit, index) =>
        correction({ key: `k${String(index)}`, unit, packs: index === 0 ? 1 : 999, amount: "999999.999999" }),
      ),
    });
    expect(resolvePersisted(stored, 4).status).toBe("ok");
    expect(
      resolvePersisted(v4Value({ contentCorrections: [correction({ amount: "1000000" })] }), 4).status,
    ).toBe("ok");
  });

  const breaches: ReadonlyArray<[string, () => unknown]> = [
    [
      "a correction repeated by rfc plus key",
      () => v4Value({ contentCorrections: [correction(), correction({ packs: 6 })] }),
    ],
    ["packs 0", () => v4Value({ contentCorrections: [correction({ packs: 0 })] })],
    ["packs 1000", () => v4Value({ contentCorrections: [correction({ packs: 1000 })] })],
    ["fractional packs", () => v4Value({ contentCorrections: [correction({ packs: 1.5 })] })],
    ["negative packs", () => v4Value({ contentCorrections: [correction({ packs: -2 })] })],
    ["an amount of zero", () => v4Value({ contentCorrections: [correction({ amount: "0" })] })],
    ["a negative amount", () => v4Value({ contentCorrections: [correction({ amount: "-1" })] })],
    ["an exponent amount", () => v4Value({ contentCorrections: [correction({ amount: "1e3" })] })],
    ["a comma amount", () => v4Value({ contentCorrections: [correction({ amount: "1,5" })] })],
    [
      "an amount over 1,000,000",
      () => v4Value({ contentCorrections: [correction({ amount: "1000000.000001" })] }),
    ],
    [
      "an amount with seven decimals",
      () => v4Value({ contentCorrections: [correction({ amount: "0.0000001" })] }),
    ],
    ["an empty amount", () => v4Value({ contentCorrections: [correction({ amount: "" })] })],
    [
      "an amount stored as a number",
      () => ({ ...v4Value(), contentCorrections: [{ ...correction(), amount: 1 }] }),
    ],
    [
      "a unit outside the five",
      () => ({ ...v4Value(), contentCorrections: [{ ...correction(), unit: "oz" }] }),
    ],
    [
      "an override product id repeated",
      () =>
        v4Value({
          priceOverrides: [priceOverride(), priceOverride({ comparable: true })],
        }),
    ],
    [
      "an empty override product id",
      () => v4Value({ priceOverrides: [priceOverride({ productId: "" })] }),
    ],
    [
      "an override comparable that is not a boolean",
      () => ({ ...v4Value(), priceOverrides: [{ productId: "prod_1", comparable: "no" }] }),
    ],
    ["a missing corrections list", () => ({ ...v4Value(), contentCorrections: undefined })],
    ["a missing overrides list", () => ({ ...v4Value(), priceOverrides: undefined })],
  ];

  it.each(breaches)("falls back to the defaults, without throwing, for %s", (_label, build) => {
    expect(resolvePersisted(build(), 4)).toEqual({ data: defaultSettings(), status: "unreadable" });
  });

  it("accepts exactly 2,000 corrections and 2,000 overrides and refuses 2,001 of each", () => {
    const products = singleMemberProducts(LIMITS.priceOverrides);
    const corrections = (count: number) =>
      Array.from({ length: count }, (_, index) => correction({ key: `k${String(index)}` }));
    const overrides = (count: number) =>
      Array.from({ length: count }, (_, index) => priceOverride({ productId: `prod_${String(index)}` }));
    const build = (corrections_: number, overrides_: number) =>
      withProducts(products, {
        contentCorrections: corrections(corrections_),
        priceOverrides: overrides(overrides_),
      });
    expect(resolvePersisted(build(LIMITS.contentCorrections, LIMITS.priceOverrides), 4).status).toBe(
      "ok",
    );
    expect(resolvePersisted(build(LIMITS.contentCorrections + 1, 0), 4).status).toBe("unreadable");
    expect(resolvePersisted(build(0, LIMITS.priceOverrides + 1), 4).status).toBe("unreadable");
  });

  it("drops an override of a product that is not stored and keeps the rest, without making the value unreadable", () => {
    const stored = v4Value({
      priceOverrides: [
        priceOverride({ productId: "prod_1" }),
        priceOverride({ productId: "prod_gone", comparable: true }),
      ],
    });
    const result = resolvePersisted(stored, 4);
    expect(result.status).toBe("ok");
    expect(result.data).toEqual(v4Value({ priceOverrides: [priceOverride({ productId: "prod_1" })] }));
  });

  it("keeps a correction of a member that is in no product (it follows the member)", () => {
    const stored = v4Value({ products: [], priceOverrides: [] });
    expect(resolvePersisted(stored, 4)).toEqual({ data: stored, status: "ok" });
  });
});

describe("contentAmountIssue (D-15)", () => {
  it.each(["1", "0.375", "1000000", "999999.999999", "0.000001", "007"])(
    "accepts %s",
    (amount) => {
      expect(contentAmountIssue(amount)).toBeNull();
    },
  );

  it.each([
    "0",
    "0.0",
    "-1",
    "1e3",
    "1,5",
    "1000000.000001",
    "0.0000001",
    "",
    " 1",
    "1 ",
    ".5",
    "1.",
    "12345678",
    "abc",
  ])("refuses %j", (amount) => {
    expect(contentAmountIssue(amount)).not.toBeNull();
  });
});

describe("priceIntegrityIssues and pruneDanglingOverrides", () => {
  it("returns no issue for a valid value and for empty lists", () => {
    expect(priceIntegrityIssues(v4Value())).toEqual([]);
    expect(priceIntegrityIssues(defaultSettings())).toEqual([]);
  });

  it("reports a repeated correction and a repeated override with their paths", () => {
    const issues = priceIntegrityIssues(
      v4Value({
        contentCorrections: [correction(), correction()],
        priceOverrides: [priceOverride(), priceOverride()],
      }),
    );
    expect(issues.map((issue) => issue.path)).toEqual([
      ["contentCorrections", 1],
      ["priceOverrides", 1],
    ]);
  });

  it("returns the same object when no override is dangling and a new one otherwise, never mutating", () => {
    const clean = v4Value();
    expect(pruneDanglingOverrides(clean)).toBe(clean);
    const dirty = v4Value({ priceOverrides: [priceOverride({ productId: "gone" })] });
    const before = JSON.stringify(dirty);
    const pruned = pruneDanglingOverrides(dirty);
    expect(pruned.priceOverrides).toEqual([]);
    expect(pruned).not.toBe(dirty);
    expect(JSON.stringify(dirty)).toBe(before);
  });
});

describe("resolvePersisted version 4 products and marks", () => {
  it("round-trips products and marks unchanged and reports ok", () => {
    const stored = withProducts(
      [
        product(),
        product({
          id: "prod_2",
          name: "Cloro",
          categoryId: null,
          members: [{ ...LECHE_A, key: "cloro", description: "CLORO" }],
        }),
      ],
      {
        ungroupedConcepts: [
          { rfc: "AAA010101AAA", key: "flete", description: "FLETE", supplierName: "Proveedor A" },
        ],
      },
    );
    expect(resolvePersisted(stored, 4)).toEqual({ data: stored, status: "ok" });
  });

  it('round-trips an rfc, key and description "__proto__" as plain data', () => {
    const odd: ProductMember = {
      rfc: "__proto__",
      key: "__proto__",
      description: "constructor",
      supplierName: "toString",
    };
    const stored = withProducts([product({ members: [odd] })], {
      ungroupedConcepts: [{ rfc: "__proto__", key: "otra", description: "otra", supplierName: "x" }],
    });
    const result = resolvePersisted(stored, 4);
    expect(result.status).toBe("ok");
    expect(result.data.products[0]?.members[0]?.rfc).toBe("__proto__");
    expect(result.data.ungroupedConcepts[0]?.rfc).toBe("__proto__");
    expect(Reflect.get(Object.prototype, "polluted")).toBeUndefined();
  });

  it("accepts a product with no category and an empty product list", () => {
    expect(resolvePersisted(withProducts([product({ categoryId: null })]), 4).status).toBe("ok");
    expect(resolvePersisted(defaultSettings(), 4).status).toBe("ok");
  });

  const breaches: ReadonlyArray<[string, () => unknown]> = [
    [
      "a repeated product id",
      () => withProducts([product(), product({ name: "Otro", members: [{ ...LECHE_A, key: "x" }] })]),
    ],
    [
      "a product name repeated ignoring case and edge spaces",
      () =>
        withProducts([
          product(),
          product({ id: "prod_2", name: "  LECHE ENTERA ", members: [{ ...LECHE_A, key: "x" }] }),
        ]),
    ],
    ["a product named «Sin categoría»", () => withProducts([product({ name: "sin CATEGORÍA " })])],
    ["a product id equal to the reserved key", () => withProducts([product({ id: SIN_CATEGORIA })])],
    [
      "a product pointing at a missing category",
      () => withProducts([product({ categoryId: "missing" })]),
    ],
    [
      "a member in two products",
      () => withProducts([product(), product({ id: "prod_2", name: "Otro", members: [LECHE_A] })]),
    ],
    [
      "a member repeated inside one product",
      () => withProducts([product({ members: [LECHE_A, LECHE_A] })]),
    ],
    ["a product with no member", () => withProducts([product({ members: [] })])],
    ["an empty product name", () => withProducts([product({ name: "   " })])],
    ["a 61-character product name", () => withProducts([product({ name: "a".repeat(61) })])],
    [
      "a mark on a description that is a member",
      () => withProducts([product()], { ungroupedConcepts: [{ ...LECHE_A }] }),
    ],
    [
      "a repeated mark",
      () => withProducts([], { ungroupedConcepts: [{ ...LECHE_A }, { ...LECHE_A }] }),
    ],
    ["a missing products list", () => ({ ...defaultSettings(), products: undefined })],
    ["a missing marks list", () => ({ ...defaultSettings(), ungroupedConcepts: undefined })],
  ];

  it.each(breaches)("falls back to the defaults, without throwing, for %s", (_label, build) => {
    expect(resolvePersisted(build(), 4)).toEqual({ data: defaultSettings(), status: "unreadable" });
  });

  it("accepts the limits themselves: 2,000 products, 5,000 members in total and 5,000 marks", () => {
    expect(resolvePersisted(withProducts(singleMemberProducts(LIMITS.products)), 4).status).toBe("ok");
    expect(resolvePersisted(withProducts(wideProducts(1000, false)), 4).status).toBe("ok");
    const marks = Array.from({ length: LIMITS.ungroupedConcepts }, (_, index) => mark(index));
    expect(resolvePersisted(withProducts([], { ungroupedConcepts: marks }), 4).status).toBe("ok");
  });

  it("refuses 2,001 products, 5,001 members in total and 5,001 marks", () => {
    expect(
      resolvePersisted(withProducts(singleMemberProducts(LIMITS.products + 1)), 4).status,
    ).toBe("unreadable");
    expect(resolvePersisted(withProducts(wideProducts(1001, true)), 4).status).toBe("unreadable");
    const marks = Array.from({ length: LIMITS.ungroupedConcepts + 1 }, (_, index) => mark(index));
    expect(resolvePersisted(withProducts([], { ungroupedConcepts: marks }), 4).status).toBe(
      "unreadable",
    );
  });

  it("accepts a mark on the same description of another supplier", () => {
    const stored = withProducts([product()], {
      ungroupedConcepts: [{ ...LECHE_A, rfc: "CCC010101CCC" }],
    });
    expect(settingsDataSchema.safeParse(stored).success).toBe(true);
  });
});

describe("productIntegrityIssues", () => {
  it("returns no issue for a valid value and an issue with a products path for a breach", () => {
    expect(productIntegrityIssues(withProducts([product()]))).toEqual([]);
    const issues = productIntegrityIssues(withProducts([product({ categoryId: "missing" })]));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.path[0]).toBe("products");
  });

  it("never throws on empty lists", () => {
    expect(productIntegrityIssues(defaultSettings())).toEqual([]);
  });
});
