import { describe, expect, it } from "vitest";
import { ruleMapKey } from "./normalize";
import { acceptProduct, productMemberKeys, validateProductName } from "./products";
import { settingsDataSchema } from "./schema";
import {
  LIMITS,
  SIN_CATEGORIA,
  defaultSettings,
  type Product,
  type ProductMember,
  type SettingsData,
} from "./types";

const UNO = "AAA010101AAA";
const DOS = "BBB020202BBB";

function member(rfc: string, key: string, description = key, supplierName = "Tienda"): ProductMember {
  return { rfc, key, description, supplierName };
}

function product(id: string, name: string, members: ProductMember[]): Product {
  return { id, name, categoryId: null, members };
}

/** Freezes the settings deeply so any mutation by the code under test throws. */
function deepFreeze(settings: SettingsData): SettingsData {
  for (const entry of settings.products) {
    for (const item of entry.members) Object.freeze(item);
    Object.freeze(entry.members);
    Object.freeze(entry);
  }
  for (const mark of settings.ungroupedConcepts) Object.freeze(mark);
  Object.freeze(settings.products);
  Object.freeze(settings.ungroupedConcepts);
  Object.freeze(settings.categories);
  return Object.freeze(settings);
}

function withProducts(products: Product[], marks: ProductMember[] = []): SettingsData {
  return { ...defaultSettings(), products, ungroupedConcepts: marks };
}

const LECHE = [member(UNO, "mm leche ent", "MM LECHE ENT", "Tienda Uno")];

describe("validateProductName (D-12)", () => {
  it("trims the name and accepts 1 to 60 characters", () => {
    expect(validateProductName(defaultSettings(), "  Leche entera  ", null)).toEqual({
      ok: true,
      name: "Leche entera",
    });
    expect(validateProductName(defaultSettings(), "a".repeat(60), null).ok).toBe(true);
  });

  it("refuses empty, edge-space-only, too long, reserved and repeated names", () => {
    const settings = withProducts([product("prod_1", "Leche entera", LECHE)]);
    expect(validateProductName(settings, "", null)).toEqual({ ok: false, reason: "empty" });
    expect(validateProductName(settings, "   ", null)).toEqual({ ok: false, reason: "empty" });
    expect(validateProductName(settings, "a".repeat(61), null)).toEqual({
      ok: false,
      reason: "too-long",
    });
    expect(validateProductName(settings, " SIN categoría ", null)).toEqual({
      ok: false,
      reason: "reserved",
    });
    expect(validateProductName(settings, " leche ENTERA ", null)).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("leaves the product being renamed out of the duplicate check", () => {
    const settings = withProducts([product("prod_1", "Leche entera", LECHE)]);
    expect(validateProductName(settings, "LECHE ENTERA", "prod_1")).toEqual({
      ok: true,
      name: "LECHE ENTERA",
    });
    expect(validateProductName(settings, "LECHE ENTERA", "prod_2").ok).toBe(false);
  });
});

describe("acceptProduct (D-06, D-09, D-10, D-12)", () => {
  it("creates a product with the given id, the trimmed name, no category and copies of the members", () => {
    const input = [member(UNO, "mm leche ent", "MM LECHE ENT", "Tienda Uno"), member(DOS, "leche entera 1l")];
    const result = acceptProduct(deepFreeze(defaultSettings()), { name: " Leche entera ", members: input }, "prod_a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product).toEqual({
      id: "prod_a",
      name: "Leche entera",
      categoryId: null,
      members: [
        { rfc: UNO, key: "mm leche ent", description: "MM LECHE ENT", supplierName: "Tienda Uno" },
        { rfc: DOS, key: "leche entera 1l", description: "leche entera 1l", supplierName: "Tienda" },
      ],
    });
    expect(result.next.products).toEqual([result.product]);
    expect(result.product.members[0]).not.toBe(input[0]);
    expect(result.next.categories).toEqual(defaultSettings().categories);
  });

  it("copies only the four member fields", () => {
    const wide = { ...member(UNO, "azucar"), extra: "x" };
    const result = acceptProduct(defaultSettings(), { name: "Azúcar", members: [wide] }, "prod_a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.product.members[0] ?? {}).sort()).toEqual([
      "description",
      "key",
      "rfc",
      "supplierName",
    ]);
  });

  it("appends after the existing products and never mutates its input", () => {
    const settings = deepFreeze(withProducts([product("prod_1", "Azúcar", [member(UNO, "azucar")])]));
    const input = { name: "Leche", members: Object.freeze([...LECHE]) };
    const result = acceptProduct(settings, input, "prod_2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.products.map((entry) => entry.id)).toEqual(["prod_1", "prod_2"]);
    expect(result.next.products[0]).toBe(settings.products[0]);
    expect(settings.products).toHaveLength(1);
    expect(input.members).toHaveLength(1);
  });

  it("refuses a name that repeats an existing product ignoring case and edge spaces", () => {
    const settings = withProducts([product("prod_1", "Leche entera", [member(DOS, "x")])]);
    expect(acceptProduct(settings, { name: " leche ENTERA ", members: LECHE }, "prod_2")).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("refuses the reserved name, an empty name and a name over 60 characters", () => {
    const settings = defaultSettings();
    expect(acceptProduct(settings, { name: "sin categoría", members: LECHE }, "p")).toEqual({
      ok: false,
      reason: "reserved",
    });
    expect(acceptProduct(settings, { name: "", members: LECHE }, "p")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(acceptProduct(settings, { name: "a".repeat(61), members: LECHE }, "p")).toEqual({
      ok: false,
      reason: "too-long",
    });
  });

  it("refuses a member that already belongs to a product", () => {
    const settings = withProducts([product("prod_1", "Leche", [member(UNO, "mm leche ent")])]);
    expect(
      acceptProduct(settings, { name: "Otra", members: [member(DOS, "z"), ...LECHE] }, "prod_2"),
    ).toEqual({ ok: false, reason: "members-taken" });
  });

  it("treats the same key of another supplier as a different member", () => {
    const settings = withProducts([product("prod_1", "Leche", [member(DOS, "mm leche ent")])]);
    expect(acceptProduct(settings, { name: "Otra", members: LECHE }, "prod_2").ok).toBe(true);
  });

  it("refuses a member marked «No agrupar»", () => {
    const settings = withProducts([], [member(UNO, "mm leche ent")]);
    expect(acceptProduct(settings, { name: "Leche", members: LECHE }, "prod_2")).toEqual({
      ok: false,
      reason: "members-taken",
    });
  });

  it("keeps a repeated member once", () => {
    const result = acceptProduct(
      defaultSettings(),
      { name: "Leche", members: [...LECHE, ...LECHE, member(DOS, "otra")] },
      "prod_a",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.members.map((entry) => entry.key)).toEqual(["mm leche ent", "otra"]);
  });

  it("refuses an empty member list", () => {
    expect(acceptProduct(defaultSettings(), { name: "Leche", members: [] }, "prod_a")).toEqual({
      ok: false,
      reason: "no-members",
    });
  });

  it("refuses the 2,001st product", () => {
    const products = Array.from({ length: LIMITS.products }, (_, index) =>
      product(`prod_${String(index)}`, `Producto ${String(index)}`, [member(UNO, `k${String(index)}`)]),
    );
    const settings = withProducts(products);
    expect(acceptProduct(settings, { name: "Uno más", members: [member(DOS, "nuevo")] }, "prod_x")).toEqual({
      ok: false,
      reason: "limit",
    });
  });

  it("refuses members that would pass 5,000 in total and accepts up to exactly 5,000", () => {
    const filler = Array.from({ length: LIMITS.productMembers - 1 }, (_, index) =>
      member(UNO, `m${String(index)}`),
    );
    const settings = withProducts([product("prod_1", "Grande", filler)]);
    const two = acceptProduct(settings, { name: "Dos", members: [member(DOS, "a"), member(DOS, "b")] }, "p2");
    expect(two).toEqual({ ok: false, reason: "limit" });
    const one = acceptProduct(settings, { name: "Uno", members: [member(DOS, "a")] }, "p2");
    expect(one.ok).toBe(true);
  });

  it("refuses an id that is the reserved key or already a product id", () => {
    const settings = withProducts([product("prod_1", "Azúcar", [member(UNO, "azucar")])]);
    expect(acceptProduct(settings, { name: "Leche", members: LECHE }, SIN_CATEGORIA).ok).toBe(false);
    expect(acceptProduct(settings, { name: "Leche", members: LECHE }, "prod_1").ok).toBe(false);
  });

  it("returns a result that passes the version-3 schema, with existing products and an RFC of __proto__", () => {
    const settings = withProducts([product("prod_1", "Azúcar", [member(UNO, "azucar")])], [member(DOS, "pago")]);
    const result = acceptProduct(
      settings,
      { name: "Leche", members: [member("__proto__", "constructor"), ...LECHE] },
      "prod_2",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
    expect(result.next.products).toHaveLength(2);
    expect(result.next.ungroupedConcepts).toEqual(settings.ungroupedConcepts);
  });
});

describe("productMemberKeys", () => {
  it("returns ruleMapKey(rfc, key) of every member of every product and nothing else", () => {
    const settings = withProducts(
      [
        product("prod_1", "Leche", [member(UNO, "a"), member(DOS, "a")]),
        product("prod_2", "Azúcar", [member(UNO, "b")]),
      ],
      [member(UNO, "marcada")],
    );
    expect(productMemberKeys(settings)).toEqual(
      new Set([ruleMapKey(UNO, "a"), ruleMapKey(DOS, "a"), ruleMapKey(UNO, "b")]),
    );
  });

  it("is empty when there are no products", () => {
    expect(productMemberKeys(defaultSettings()).size).toBe(0);
  });
});
