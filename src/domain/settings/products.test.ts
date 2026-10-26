import { describe, expect, it } from "vitest";
import { ruleMapKey } from "./normalize";
import {
  acceptProduct,
  addMembersToProduct,
  deleteProduct,
  markUngrouped,
  moveProductMember,
  productMemberKeys,
  removeProductMember,
  renameProduct,
  restoreProduct,
  setProductCategory,
  undoMemberChange,
  ungroupedKeys,
  unmarkUngrouped,
  validateProductName,
} from "./products";
import { settingsDataSchema } from "./schema";
import {
  LIMITS,
  SIN_CATEGORIA,
  defaultSettings,
  type PriceOverride,
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

// --- Plan 04-07: rename, delete, take out and move members, each with an undo (D-14, D-15, OQ5) ---

const KEY_A = ruleMapKey(UNO, "leche uno");
const KEY_B = ruleMapKey(DOS, "leche dos");
const KEY_C = ruleMapKey(UNO, "cafe");

function leche(): Product {
  return product("prod_leche", "Leche entera", [
    member(UNO, "leche uno", "Leche 1L", "Tienda Uno"),
    member(DOS, "leche dos", "LECHE 1 L", "Tienda Dos"),
    member(UNO, "leche tres", "Leche deslactosada", "Tienda Uno"),
  ]);
}

function cafe(): Product {
  return product("prod_cafe", "Café molido", [member(UNO, "cafe", "Café molido 1kg", "Tienda Uno")]);
}

function azucar(): Product {
  return { ...product("prod_azucar", "Azúcar", [member(DOS, "azucar", "Azúcar 2kg", "Tienda Dos")]), categoryId: "seed:otros" };
}

/** Three products in a known order; the settings pass the stored validation. */
function threeProducts(): SettingsData {
  return withProducts([leche(), cafe(), azucar()]);
}

function isValid(settings: SettingsData): boolean {
  return settingsDataSchema.safeParse(settings).success;
}

function productOf(settings: SettingsData, id: string): Product | undefined {
  return settings.products.find((entry) => entry.id === id);
}

describe("renameProduct (D-14)", () => {
  it("keeps id, position, category and members and changes only the trimmed name", () => {
    const before = deepFreeze(threeProducts());
    const result = renameProduct(before, "prod_azucar", "  Azúcar refinada  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.products.map((entry) => entry.id)).toEqual([
      "prod_leche",
      "prod_cafe",
      "prod_azucar",
    ]);
    expect(productOf(result.next, "prod_azucar")).toEqual({
      ...azucar(),
      name: "Azúcar refinada",
    });
    expect(productOf(result.next, "prod_leche")).toEqual(leche());
    expect(isValid(result.next)).toBe(true);
  });

  it("allows the same name in another case for the same product", () => {
    const result = renameProduct(threeProducts(), "prod_leche", "LECHE ENTERA");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(productOf(result.next, "prod_leche")?.name).toBe("LECHE ENTERA");
  });

  it("refuses the name of another product, ignoring case and edge spaces", () => {
    expect(renameProduct(threeProducts(), "prod_leche", " café MOLIDO ")).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("refuses an empty, reserved or too long name", () => {
    const settings = threeProducts();
    expect(renameProduct(settings, "prod_leche", "   ")).toEqual({ ok: false, reason: "empty" });
    expect(renameProduct(settings, "prod_leche", "Sin Categoría")).toEqual({
      ok: false,
      reason: "reserved",
    });
    expect(renameProduct(settings, "prod_leche", "x".repeat(61))).toEqual({
      ok: false,
      reason: "too-long",
    });
  });

  it("returns the very same settings for an unknown id and for an unchanged name", () => {
    const settings = threeProducts();
    const unknown = renameProduct(settings, "prod_nope", "Lo que sea");
    expect(unknown.ok && unknown.next === settings).toBe(true);
    const same = renameProduct(settings, "prod_leche", "Leche entera");
    expect(same.ok && same.next === settings).toBe(true);
  });
});

describe("deleteProduct and restoreProduct (D-14)", () => {
  it("removes the product, leaves the others untouched and returns a snapshot with its position", () => {
    const before = deepFreeze(threeProducts());
    const result = deleteProduct(before, "prod_cafe");
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.next.products.map((entry) => entry.id)).toEqual(["prod_leche", "prod_azucar"]);
    expect(result.snapshot).toEqual({ product: cafe(), index: 1, override: null });
    expect(isValid(result.next)).toBe(true);
    // The freed member is no longer taken.
    expect(productMemberKeys(result.next).has(KEY_C)).toBe(false);
  });

  it("returns null for an unknown id", () => {
    expect(deleteProduct(threeProducts(), "prod_nope")).toBeNull();
  });

  it("restore after delete gives back an equal settings value: same id, position, name, category and members", () => {
    const before = threeProducts();
    for (const id of ["prod_leche", "prod_cafe", "prod_azucar"]) {
      const deleted = deleteProduct(before, id);
      if (deleted === null) throw new Error("expected a deletion");
      const restored = restoreProduct(deepFreeze(deleted.next), deleted.snapshot);
      expect(restored).toEqual(before);
      expect(isValid(restored)).toBe(true);
    }
  });

  it("restores at the end when the position no longer exists", () => {
    const deleted = deleteProduct(threeProducts(), "prod_azucar");
    if (deleted === null) throw new Error("expected a deletion");
    const shorter = deleteProduct(deleted.next, "prod_cafe");
    if (shorter === null) throw new Error("expected a deletion");
    const restored = restoreProduct(shorter.next, { ...deleted.snapshot, index: 99 });
    expect(restored.products.map((entry) => entry.id)).toEqual(["prod_leche", "prod_azucar"]);
  });

  it("brings the category back as null when the category was deleted meanwhile", () => {
    const deleted = deleteProduct(threeProducts(), "prod_azucar");
    if (deleted === null) throw new Error("expected a deletion");
    const withoutCategory: SettingsData = {
      ...deleted.next,
      categories: deleted.next.categories.filter((entry) => entry.id !== "seed:otros"),
    };
    const restored = restoreProduct(withoutCategory, deleted.snapshot);
    expect(productOf(restored, "prod_azucar")?.categoryId).toBeNull();
    expect(isValid(restored)).toBe(true);
  });

  it("returns the same object when one of its members was accepted elsewhere meanwhile", () => {
    const deleted = deleteProduct(threeProducts(), "prod_cafe");
    if (deleted === null) throw new Error("expected a deletion");
    const taken = acceptProduct(
      deleted.next,
      { name: "Otro", members: [member(UNO, "cafe", "Café molido 1kg", "Tienda Uno")] },
      "prod_otro",
    );
    if (!taken.ok) throw new Error("expected an accept");
    expect(restoreProduct(taken.next, deleted.snapshot)).toBe(taken.next);
  });

  it("returns the same object when one of its members was marked «No agrupar» meanwhile", () => {
    const deleted = deleteProduct(threeProducts(), "prod_cafe");
    if (deleted === null) throw new Error("expected a deletion");
    const marked: SettingsData = {
      ...deleted.next,
      ungroupedConcepts: [member(UNO, "cafe", "Café molido 1kg", "Tienda Uno")],
    };
    expect(restoreProduct(marked, deleted.snapshot)).toBe(marked);
  });

  it("returns the same object when the id or the name is taken again", () => {
    const deleted = deleteProduct(threeProducts(), "prod_cafe");
    if (deleted === null) throw new Error("expected a deletion");
    const sameId = withProducts([...deleted.next.products, product("prod_cafe", "Otro", [member(DOS, "x")])]);
    expect(restoreProduct(sameId, deleted.snapshot)).toBe(sameId);
    const sameName = withProducts([...deleted.next.products, product("prod_x", " CAFÉ molido", [member(DOS, "y")])]);
    expect(restoreProduct(sameName, deleted.snapshot)).toBe(sameName);
  });

  it("returns the same object when a limit would break", () => {
    const deleted = deleteProduct(threeProducts(), "prod_leche");
    if (deleted === null) throw new Error("expected a deletion");
    const full = withProducts(
      Array.from({ length: LIMITS.products }, (_, index) =>
        product(`prod_f${String(index)}`, `F${String(index)}`, [member(DOS, `f${String(index)}`)]),
      ),
    );
    expect(restoreProduct(full, deleted.snapshot)).toBe(full);
    const manyMembers = withProducts([
      product(
        "prod_big",
        "Grande",
        Array.from({ length: LIMITS.productMembers - 2 }, (_, index) => member(DOS, `m${String(index)}`)),
      ),
    ]);
    // The snapshot has 3 members: 4,998 + 3 is over the 5,000 cap.
    expect(restoreProduct(manyMembers, deleted.snapshot)).toBe(manyMembers);
  });

  it("does not share objects with the snapshot or the input", () => {
    const deleted = deleteProduct(threeProducts(), "prod_leche");
    if (deleted === null) throw new Error("expected a deletion");
    const restored = restoreProduct(deleted.next, deleted.snapshot);
    const back = productOf(restored, "prod_leche");
    expect(back).not.toBe(deleted.snapshot.product);
    expect(back?.members).not.toBe(deleted.snapshot.product.members);
  });
});

describe("removeProductMember and undoMemberChange (D-15)", () => {
  it("takes a middle member out and undo puts it back at its index", () => {
    const before = deepFreeze(threeProducts());
    const result = removeProductMember(before, "prod_leche", KEY_B);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(productOf(result.next, "prod_leche")?.members.map((entry) => entry.key)).toEqual([
      "leche uno",
      "leche tres",
    ]);
    expect(result.undo).toEqual({
      kind: "member",
      productId: "prod_leche",
      member: member(DOS, "leche dos", "LECHE 1 L", "Tienda Dos"),
      index: 1,
    });
    expect(isValid(result.next)).toBe(true);
    // The freed description is no longer taken (D-15).
    expect(productMemberKeys(result.next).has(KEY_B)).toBe(false);
    const back = undoMemberChange(deepFreeze(result.next), result.undo);
    expect(back).toEqual(before);
  });

  it("deletes the product when its only member is taken out, and undo restores the product", () => {
    const before = deepFreeze(threeProducts());
    const result = removeProductMember(before, "prod_cafe", KEY_C);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.next.products.map((entry) => entry.id)).toEqual(["prod_leche", "prod_azucar"]);
    expect(result.undo.kind).toBe("product");
    if (result.undo.kind !== "product") return;
    expect(result.undo.movedTo).toBeNull();
    expect(result.undo.snapshot).toEqual({ product: cafe(), index: 1, override: null });
    expect(undoMemberChange(result.next, result.undo)).toEqual(before);
  });

  it("returns null for an unknown product or an unknown member", () => {
    const settings = threeProducts();
    expect(removeProductMember(settings, "prod_nope", KEY_A)).toBeNull();
    expect(removeProductMember(settings, "prod_leche", KEY_C)).toBeNull();
  });

  it("undo returns the same object when the member was taken again or the product is gone", () => {
    const removed = removeProductMember(threeProducts(), "prod_leche", KEY_B);
    if (removed === null) throw new Error("expected a removal");
    const taken = acceptProduct(
      removed.next,
      { name: "Otro", members: [member(DOS, "leche dos", "LECHE 1 L", "Tienda Dos")] },
      "prod_otro",
    );
    if (!taken.ok) throw new Error("expected an accept");
    expect(undoMemberChange(taken.next, removed.undo)).toBe(taken.next);
    const gone = deleteProduct(removed.next, "prod_leche");
    if (gone === null) throw new Error("expected a deletion");
    expect(undoMemberChange(gone.next, removed.undo)).toBe(gone.next);
  });

  it("undo returns the same object when the member count would pass the limit", () => {
    const removed = removeProductMember(threeProducts(), "prod_leche", KEY_B);
    if (removed === null) throw new Error("expected a removal");
    const full: SettingsData = {
      ...removed.next,
      products: [
        ...removed.next.products,
        product(
          "prod_big",
          "Grande",
          Array.from({ length: LIMITS.productMembers - 4 }, (_, index) => member(DOS, `m${String(index)}`)),
        ),
      ],
    };
    // 4 stored + 4,996 = 5,000: one more would pass the cap.
    expect(undoMemberChange(full, removed.undo)).toBe(full);
  });
});

describe("moveProductMember and undoMemberChange (D-15)", () => {
  it("appends the member to the target and undo puts everything back", () => {
    const before = deepFreeze(threeProducts());
    const result = moveProductMember(before, "prod_leche", KEY_A, "prod_cafe");
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(productOf(result.next, "prod_leche")?.members.map((entry) => entry.key)).toEqual([
      "leche dos",
      "leche tres",
    ]);
    expect(productOf(result.next, "prod_cafe")?.members.map((entry) => entry.key)).toEqual([
      "cafe",
      "leche uno",
    ]);
    expect(result.undo).toEqual({
      kind: "moved",
      fromId: "prod_leche",
      toId: "prod_cafe",
      member: member(UNO, "leche uno", "Leche 1L", "Tienda Uno"),
      index: 0,
    });
    expect(isValid(result.next)).toBe(true);
    expect(undoMemberChange(deepFreeze(result.next), result.undo)).toEqual(before);
  });

  it("deletes the source when its only member moves, and undo puts everything back", () => {
    const before = deepFreeze(threeProducts());
    const result = moveProductMember(before, "prod_cafe", KEY_C, "prod_leche");
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.next.products.map((entry) => entry.id)).toEqual(["prod_leche", "prod_azucar"]);
    expect(productOf(result.next, "prod_leche")?.members.map((entry) => entry.key)).toEqual([
      "leche uno",
      "leche dos",
      "leche tres",
      "cafe",
    ]);
    expect(result.undo.kind).toBe("product");
    if (result.undo.kind !== "product") return;
    expect(result.undo.movedTo).toBe("prod_leche");
    expect(isValid(result.next)).toBe(true);
    expect(undoMemberChange(result.next, result.undo)).toEqual(before);
  });

  it("returns null when moving into the same product, an unknown product or an unknown member", () => {
    const settings = threeProducts();
    expect(moveProductMember(settings, "prod_leche", KEY_A, "prod_leche")).toBeNull();
    expect(moveProductMember(settings, "prod_leche", KEY_A, "prod_nope")).toBeNull();
    expect(moveProductMember(settings, "prod_nope", KEY_A, "prod_cafe")).toBeNull();
    expect(moveProductMember(settings, "prod_leche", KEY_C, "prod_cafe")).toBeNull();
  });

  it("undo returns the same object when the member is no longer in the target", () => {
    const moved = moveProductMember(threeProducts(), "prod_leche", KEY_A, "prod_cafe");
    if (moved === null) throw new Error("expected a move");
    const trimmed = removeProductMember(moved.next, "prod_cafe", KEY_A);
    if (trimmed === null) throw new Error("expected a removal");
    expect(undoMemberChange(trimmed.next, moved.undo)).toBe(trimmed.next);
  });

  it("undo of a moved-away last member returns the same object when the target is gone", () => {
    const moved = moveProductMember(threeProducts(), "prod_cafe", KEY_C, "prod_azucar");
    if (moved === null) throw new Error("expected a move");
    const gone = deleteProduct(moved.next, "prod_azucar");
    if (gone === null) throw new Error("expected a deletion");
    expect(undoMemberChange(gone.next, moved.undo)).toBe(gone.next);
  });
});

describe("the «no comparable» mark follows its product (Phase 5, D-19)", () => {
  const MARK_CAFE: PriceOverride = { productId: "prod_cafe", comparable: false };
  const MARK_LECHE: PriceOverride = { productId: "prod_leche", comparable: true };

  function marked(): SettingsData {
    return { ...threeProducts(), priceOverrides: [MARK_LECHE, MARK_CAFE] };
  }

  it("deleteProduct drops the mark in the same value and the snapshot holds it", () => {
    const before = deepFreeze(marked());
    const deleted = deleteProduct(before, "prod_cafe");
    if (deleted === null) throw new Error("expected a deletion");
    expect(deleted.next.priceOverrides).toEqual([MARK_LECHE]);
    expect(deleted.snapshot.override).toEqual(MARK_CAFE);
    expect(isValid(deleted.next)).toBe(true);
    // Everything else is untouched.
    expect(deleted.next.ungroupedConcepts).toBe(before.ungroupedConcepts);
  });

  it("a product without a mark keeps the very same mark list", () => {
    const before = marked();
    const deleted = deleteProduct(before, "prod_azucar");
    if (deleted === null) throw new Error("expected a deletion");
    expect(deleted.next.priceOverrides).toBe(before.priceOverrides);
    expect(deleted.snapshot.override).toBeNull();
  });

  it("restoreProduct puts the product and its mark back, equal to the original", () => {
    const before = marked();
    const deleted = deleteProduct(before, "prod_cafe");
    if (deleted === null) throw new Error("expected a deletion");
    const restored = restoreProduct(deepFreeze(deleted.next), deleted.snapshot);
    expect(restored.products).toEqual(before.products);
    expect([...restored.priceOverrides].sort((a, b) => a.productId.localeCompare(b.productId))).toEqual(
      [...before.priceOverrides].sort((a, b) => a.productId.localeCompare(b.productId)),
    );
    expect(isValid(restored)).toBe(true);
  });

  it("a refused restore restores neither the product nor the mark", () => {
    const deleted = deleteProduct(marked(), "prod_cafe");
    if (deleted === null) throw new Error("expected a deletion");
    const taken = acceptProduct(
      deleted.next,
      { name: "Otro", members: [member(UNO, "cafe", "Café molido 1kg", "Tienda Uno")] },
      "prod_otro",
    );
    if (!taken.ok) throw new Error("expected an accept");
    const restored = restoreProduct(taken.next, deleted.snapshot);
    expect(restored).toBe(taken.next);
    expect(restored.priceOverrides.some((entry) => entry.productId === "prod_cafe")).toBe(false);
  });

  it("restores the product without the mark when the mark list is full", () => {
    const deleted = deleteProduct(marked(), "prod_cafe");
    if (deleted === null) throw new Error("expected a deletion");
    const full: SettingsData = {
      ...deleted.next,
      priceOverrides: Array.from({ length: LIMITS.priceOverrides }, (_, index) => ({
        productId: `x${String(index)}`,
        comparable: false,
      })),
    };
    const restored = restoreProduct(full, deleted.snapshot);
    expect(restored.products.some((entry) => entry.id === "prod_cafe")).toBe(true);
    expect(restored.priceOverrides).toBe(full.priceOverrides);
  });

  it("taking out the last member drops the mark and undo brings it back", () => {
    const before = marked();
    const removed = removeProductMember(before, "prod_cafe", KEY_C);
    if (removed === null) throw new Error("expected a removal");
    expect(removed.next.priceOverrides).toEqual([MARK_LECHE]);
    expect(isValid(removed.next)).toBe(true);
    const back = undoMemberChange(removed.next, removed.undo);
    expect(back.products).toEqual(before.products);
    expect(back.priceOverrides).toEqual(expect.arrayContaining([MARK_LECHE, MARK_CAFE]));
    expect(back.priceOverrides).toHaveLength(2);
  });

  it("moving the last member away drops the mark of the source and undo brings it back", () => {
    const before = marked();
    const moved = moveProductMember(before, "prod_cafe", KEY_C, "prod_leche");
    if (moved === null) throw new Error("expected a move");
    expect(moved.next.priceOverrides).toEqual([MARK_LECHE]);
    expect(isValid(moved.next)).toBe(true);
    const back = undoMemberChange(moved.next, moved.undo);
    expect(back.products).toEqual(before.products);
    expect(back.priceOverrides).toEqual(expect.arrayContaining([MARK_LECHE, MARK_CAFE]));
    expect(back.priceOverrides).toHaveLength(2);
  });

  it("taking out or moving a member that is not the last keeps the mark", () => {
    const before = marked();
    const removed = removeProductMember(before, "prod_leche", KEY_B);
    if (removed === null) throw new Error("expected a removal");
    expect(removed.next.priceOverrides).toBe(before.priceOverrides);
    const moved = moveProductMember(before, "prod_leche", KEY_A, "prod_cafe");
    if (moved === null) throw new Error("expected a move");
    expect(moved.next.priceOverrides).toBe(before.priceOverrides);
  });
});

describe("no reducer mutates its input", () => {
  it("accepts frozen settings for every operation", () => {
    const frozen = deepFreeze(threeProducts());
    expect(() => {
      renameProduct(frozen, "prod_leche", "Otra");
      const deleted = deleteProduct(frozen, "prod_leche");
      if (deleted !== null) restoreProduct(frozen, deleted.snapshot);
      const removed = removeProductMember(frozen, "prod_leche", KEY_A);
      if (removed !== null) undoMemberChange(frozen, removed.undo);
      const moved = moveProductMember(frozen, "prod_leche", KEY_A, "prod_cafe");
      if (moved !== null) undoMemberChange(frozen, moved.undo);
    }).not.toThrow();
  });
});

describe("setProductCategory (CAT-04, D-16)", () => {
  const INSUMOS = "seed:insumos-cafeteria";
  const OTROS = "seed:otros";

  function settings(): SettingsData {
    return withProducts([
      product("prod_leche", "Leche", LECHE),
      { ...product("prod_cafe", "Café", [member(UNO, "cafe molido", "Café molido", "Tienda Uno")]), categoryId: OTROS },
    ]);
  }

  it("gives the product the category and leaves the rest as it was", () => {
    const before = settings();
    const result = setProductCategory(before, "prod_leche", INSUMOS);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.next.products.map((entry) => [entry.id, entry.categoryId])).toEqual([
      ["prod_leche", INSUMOS],
      ["prod_cafe", OTROS],
    ]);
    expect(result.next.products[0]?.members).toEqual(LECHE);
    expect(result.next.products[0]?.name).toBe("Leche");
    expect(result.next.categories).toBe(before.categories);
    expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
  });

  it("changes the category of a product that already had one", () => {
    const result = setProductCategory(settings(), "prod_cafe", INSUMOS);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.next.products[1]?.categoryId).toBe(INSUMOS);
  });

  it("clears the category with null", () => {
    const result = setProductCategory(settings(), "prod_cafe", null);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    expect(result.next.products[1]?.categoryId).toBeNull();
    expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
  });

  it("refuses a category id that is not a category as unknown-category", () => {
    expect(setProductCategory(settings(), "prod_leche", "cat_missing")).toEqual({
      ok: false,
      reason: "unknown-category",
    });
    expect(setProductCategory(settings(), "prod_leche", SIN_CATEGORIA)).toEqual({
      ok: false,
      reason: "unknown-category",
    });
  });

  it("returns the very same settings object for an unknown product or an unchanged category", () => {
    const before = settings();
    const unknown = setProductCategory(before, "prod_nope", INSUMOS);
    expect(unknown.ok && unknown.next === before).toBe(true);
    const unchanged = setProductCategory(before, "prod_cafe", OTROS);
    expect(unchanged.ok && unchanged.next === before).toBe(true);
    const alreadyNone = setProductCategory(before, "prod_leche", null);
    expect(alreadyNone.ok && alreadyNone.next === before).toBe(true);
  });

  it("does not mutate frozen settings", () => {
    const frozen = deepFreeze(settings());
    expect(() => {
      setProductCategory(frozen, "prod_leche", INSUMOS);
      setProductCategory(frozen, "prod_cafe", null);
    }).not.toThrow();
  });
});

describe("«No agrupar» marks (D-13, D-22)", () => {
  const FLETE = member(UNO, "flete", "Flete", "Tienda Uno");
  const SAL = member(DOS, "sal", "Sal", "Tienda Dos");

  it("adds the mark at the end with its four fields, without touching anything else", () => {
    const base = withProducts([product("prod_leche", "Leche", LECHE)], [SAL]);
    const result = markUngrouped(base, FLETE);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.next.ungroupedConcepts).toEqual([SAL, FLETE]);
    expect(result.next.products).toBe(base.products);
    expect(result.next.categories).toBe(base.categories);
    expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
  });

  it("stores a copy, so the mark never aliases the member that was passed", () => {
    const result = markUngrouped(defaultSettings(), FLETE);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.next.ungroupedConcepts[0]).toEqual(FLETE);
    expect(result.next.ungroupedConcepts[0]).not.toBe(FLETE);
  });

  it("marking twice is a no-op that returns the same settings object", () => {
    const base = withProducts([], [FLETE]);
    const again = markUngrouped(base, { ...FLETE, description: "FLETE" });
    if (!again.ok) throw new Error("expected an ok result");
    expect(again.next).toBe(base);
  });

  it("refuses a member that already belongs to a product", () => {
    const base = withProducts([product("prod_leche", "Leche", LECHE)]);
    const [inProduct] = LECHE;
    if (inProduct === undefined) throw new Error("fixture");
    expect(markUngrouped(base, inProduct)).toEqual({ ok: false, reason: "taken" });
  });

  it("accepts the 5,000th mark and refuses the 5,001st", () => {
    const marks = Array.from({ length: LIMITS.ungroupedConcepts - 1 }, (_unused, index) =>
      member(UNO, `k${String(index)}`),
    );
    const almost = withProducts([], marks);
    const last = markUngrouped(almost, FLETE);
    if (!last.ok) throw new Error("expected an ok result");
    expect(last.next.ungroupedConcepts).toHaveLength(LIMITS.ungroupedConcepts);
    expect(markUngrouped(last.next, SAL)).toEqual({ ok: false, reason: "limit" });
  });

  it("unmarkUngrouped returns the removed mark and the settings without it", () => {
    const base = withProducts([], [SAL, FLETE]);
    const result = unmarkUngrouped(base, ruleMapKey(UNO, "flete"));
    if (result === null) throw new Error("expected a removal");
    expect(result.removed).toEqual(FLETE);
    expect(result.next.ungroupedConcepts).toEqual([SAL]);
    expect(base.ungroupedConcepts).toEqual([SAL, FLETE]);
  });

  it("unmarkUngrouped returns null for a key that is not marked", () => {
    expect(unmarkUngrouped(withProducts([], [SAL]), ruleMapKey(UNO, "flete"))).toBeNull();
    // The same key under another supplier is another description.
    expect(unmarkUngrouped(withProducts([], [SAL]), ruleMapKey(UNO, "sal"))).toBeNull();
  });

  it("ungroupedKeys lists the ruleMapKey of every mark", () => {
    expect(ungroupedKeys(withProducts([], [SAL, FLETE]))).toEqual(
      new Set([ruleMapKey(DOS, "sal"), ruleMapKey(UNO, "flete")]),
    );
    expect(ungroupedKeys(defaultSettings())).toEqual(new Set());
  });

  it("does not mutate frozen settings", () => {
    const frozen = deepFreeze(withProducts([product("prod_leche", "Leche", LECHE)], [SAL]));
    expect(() => {
      markUngrouped(frozen, FLETE);
      markUngrouped(frozen, SAL);
      unmarkUngrouped(frozen, ruleMapKey(DOS, "sal"));
      ungroupedKeys(frozen);
    }).not.toThrow();
  });
});

describe("addMembersToProduct (D-21)", () => {
  const SAL_FINA = member(UNO, "sal fina", "Sal fina", "Tienda Uno");
  const LECHE_2 = member(DOS, "leche entera 1l", "LECHE ENTERA 1L", "Tienda Dos");
  const LECHE_3 = member("CCC030303CCC", "leche ent", "LECHE ENT", "Tienda Tres");
  const base = (): SettingsData =>
    withProducts([product("prod_leche", "Leche", LECHE), product("prod_sal", "Sal", [SAL_FINA])]);

  it("adds the new members at the end and keeps the category and the other members", () => {
    const seeded = defaultSettings();
    const category = seeded.categories[0];
    if (category === undefined) throw new Error("fixture: the defaults have categories");
    const settings: SettingsData = {
      ...base(),
      categories: seeded.categories,
      products: base().products.map((entry) =>
        entry.id === "prod_leche" ? { ...entry, categoryId: category.id } : entry,
      ),
    };
    const result = addMembersToProduct(settings, "prod_leche", [LECHE_2, LECHE_3]);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.added).toBe(2);
    const updated = result.next.products.find((entry) => entry.id === "prod_leche");
    expect(updated?.categoryId).toBe(category.id);
    expect(updated?.members).toEqual([...LECHE, LECHE_2, LECHE_3]);
    expect(result.next.products.find((entry) => entry.id === "prod_sal")).toEqual(
      settings.products.find((entry) => entry.id === "prod_sal"),
    );
    expect(result.next.products.map((entry) => entry.id)).toEqual(["prod_leche", "prod_sal"]);
    expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
  });

  it("keeps a member repeated in the input once", () => {
    const result = addMembersToProduct(base(), "prod_leche", [LECHE_2, LECHE_2]);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.added).toBe(1);
    expect(result.next.products[0]?.members).toHaveLength(LECHE.length + 1);
  });

  it("is «gone» for a product that does not exist", () => {
    expect(addMembersToProduct(base(), "prod_nada", [LECHE_2])).toEqual({
      ok: false,
      reason: "gone",
    });
  });

  it("is «no-members» for an empty list", () => {
    expect(addMembersToProduct(base(), "prod_leche", [])).toEqual({
      ok: false,
      reason: "no-members",
    });
  });

  it("is «members-taken» when a member already belongs to another product, or to this one", () => {
    expect(addMembersToProduct(base(), "prod_leche", [LECHE_2, SAL_FINA])).toEqual({
      ok: false,
      reason: "members-taken",
    });
    expect(addMembersToProduct(base(), "prod_leche", [...LECHE])).toEqual({
      ok: false,
      reason: "members-taken",
    });
  });

  it("is «members-taken» for a description marked «No agrupar»", () => {
    const marked = withProducts([product("prod_leche", "Leche", LECHE)], [LECHE_2]);
    expect(addMembersToProduct(marked, "prod_leche", [LECHE_2])).toEqual({
      ok: false,
      reason: "members-taken",
    });
  });

  it("is «limit» past 5,000 members in all and accepts the 5,000th", () => {
    const filler = Array.from({ length: LIMITS.productMembers - 2 }, (_unused, index) =>
      member(DOS, `m${String(index)}`),
    );
    const settings = withProducts([
      product("prod_leche", "Leche", LECHE),
      product("prod_otro", "Otro", filler),
    ]);
    expect(addMembersToProduct(settings, "prod_leche", [LECHE_2, LECHE_3])).toEqual({
      ok: false,
      reason: "limit",
    });
    const last = addMembersToProduct(settings, "prod_leche", [LECHE_2]);
    if (!last.ok) throw new Error("expected an ok result");
    expect(last.next.products.reduce((sum, entry) => sum + entry.members.length, 0)).toBe(
      LIMITS.productMembers,
    );
    expect(settingsDataSchema.safeParse(last.next).success).toBe(true);
  });

  it("does not mutate frozen settings", () => {
    const frozen = deepFreeze(base());
    expect(() => addMembersToProduct(frozen, "prod_leche", [LECHE_2])).not.toThrow();
    expect(frozen.products[0]?.members).toEqual(LECHE);
  });
});
