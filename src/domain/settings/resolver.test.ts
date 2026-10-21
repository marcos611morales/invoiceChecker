import { describe, expect, it } from "vitest";
import { normalizeDescription } from "./normalize";
import { makeResolver } from "./resolver";
import {
  SIN_CATEGORIA,
  defaultSettings,
  type ConceptRule,
  type Product,
  type SettingsData,
} from "./types";

const UNO = "AAA010101AAA";
const DOS = "BBB020202BBB";
const LIMPIEZA = "seed:limpieza-higiene";
const INSUMOS = "seed:insumos-cafeteria";
const OTROS = "seed:otros";
const LECHE = "Leche entera 1L";

function leche(rfc: string, categoryId: string | null): Product {
  return {
    id: "prod_leche",
    name: "Leche",
    categoryId,
    members: [
      { rfc, key: normalizeDescription(LECHE), description: LECHE, supplierName: "Tienda" },
    ],
  };
}

function rule(rfc: string, description: string, categoryId: string | null): ConceptRule {
  return { rfc, key: normalizeDescription(description), description, categoryId };
}

function settingsWith(overrides: Partial<SettingsData>): SettingsData {
  return { ...defaultSettings(), ...overrides };
}

describe("makeResolver precedence (CAT-04, D-16)", () => {
  it("gives a concept without rule, product or supplier «Sin categoría» with source ninguna", () => {
    const resolver = makeResolver(defaultSettings());
    expect(resolver.explain(UNO, LECHE)).toEqual({
      category: SIN_CATEGORIA,
      source: "ninguna",
      product: null,
    });
    expect(resolver.resolve(UNO, LECHE)).toBe(SIN_CATEGORIA);
  });

  it("gives a member of a product with a category that category, with source producto and the product", () => {
    const resolver = makeResolver(settingsWith({ products: [leche(UNO, INSUMOS)] }));
    expect(resolver.explain(UNO, LECHE)).toEqual({
      category: INSUMOS,
      source: "producto",
      product: { id: "prod_leche", name: "Leche" },
    });
    expect(resolver.resolve(UNO, LECHE)).toBe(INSUMOS);
  });

  it("matches a member through the normalized description, so a different spelling of the same text is a member", () => {
    const resolver = makeResolver(settingsWith({ products: [leche(UNO, INSUMOS)] }));
    expect(resolver.explain(UNO, "  LECHE   entera 1l ").source).toBe("producto");
  });

  it("puts the product above the supplier's category", () => {
    const resolver = makeResolver(
      settingsWith({
        supplierCategories: [{ rfc: UNO, name: "Tienda", categoryId: LIMPIEZA }],
        products: [leche(UNO, INSUMOS)],
      }),
    );
    expect(resolver.explain(UNO, LECHE).category).toBe(INSUMOS);
    // Another description of the same supplier still takes the supplier's category.
    expect(resolver.explain(UNO, "Cloro")).toEqual({
      category: LIMPIEZA,
      source: "proveedor",
      product: null,
    });
    expect(resolver.supplierCategory(UNO)).toBe(LIMPIEZA);
  });

  it("puts a concept rule above the product", () => {
    const resolver = makeResolver(
      settingsWith({
        conceptRules: [rule(UNO, LECHE, OTROS)],
        products: [leche(UNO, INSUMOS)],
      }),
    );
    expect(resolver.explain(UNO, LECHE)).toEqual({
      category: OTROS,
      source: "regla",
      product: null,
    });
  });

  it("puts an explicit «Sin categoría» rule above the product", () => {
    const resolver = makeResolver(
      settingsWith({
        conceptRules: [rule(UNO, LECHE, null)],
        supplierCategories: [{ rfc: UNO, name: "Tienda", categoryId: LIMPIEZA }],
        products: [leche(UNO, INSUMOS)],
      }),
    );
    expect(resolver.explain(UNO, LECHE)).toEqual({
      category: SIN_CATEGORIA,
      source: "regla",
      product: null,
    });
  });

  it("lets a product without category add no level: its lines fall to the supplier's category", () => {
    const resolver = makeResolver(
      settingsWith({
        supplierCategories: [{ rfc: UNO, name: "Tienda", categoryId: LIMPIEZA }],
        products: [leche(UNO, null)],
      }),
    );
    expect(resolver.explain(UNO, LECHE)).toEqual({
      category: LIMPIEZA,
      source: "proveedor",
      product: null,
    });
  });

  it("lets a product without category and a supplier without category fall to «Sin categoría»", () => {
    const resolver = makeResolver(settingsWith({ products: [leche(UNO, null)] }));
    expect(resolver.explain(UNO, LECHE).source).toBe("ninguna");
  });

  it("lets a product whose category no longer exists add no level", () => {
    const resolver = makeResolver(
      settingsWith({
        supplierCategories: [{ rfc: UNO, name: "Tienda", categoryId: LIMPIEZA }],
        products: [leche(UNO, "cat_deleted")],
      }),
    );
    expect(resolver.explain(UNO, LECHE)).toEqual({
      category: LIMPIEZA,
      source: "proveedor",
      product: null,
    });
    expect(makeResolver(settingsWith({ products: [leche(UNO, "cat_deleted")] })).resolve(UNO, LECHE)).toBe(
      SIN_CATEGORIA,
    );
  });

  it("does not hand the product to a member of another supplier with the same description (the RFC is part of the key, D-09)", () => {
    const resolver = makeResolver(
      settingsWith({
        supplierCategories: [{ rfc: DOS, name: "Otra tienda", categoryId: LIMPIEZA }],
        products: [leche(UNO, INSUMOS)],
      }),
    );
    expect(resolver.explain(DOS, LECHE)).toEqual({
      category: LIMPIEZA,
      source: "proveedor",
      product: null,
    });
    expect(resolver.explain(UNO, LECHE).source).toBe("producto");
  });

  it("reads members of several suppliers of one product from the same category", () => {
    const product: Product = {
      id: "prod_leche",
      name: "Leche",
      categoryId: INSUMOS,
      members: [
        { rfc: UNO, key: normalizeDescription(LECHE), description: LECHE, supplierName: "Uno" },
        { rfc: DOS, key: normalizeDescription("LECHE ENT"), description: "LECHE ENT", supplierName: "Dos" },
      ],
    };
    const resolver = makeResolver(settingsWith({ products: [product] }));
    expect(resolver.resolve(UNO, LECHE)).toBe(INSUMOS);
    expect(resolver.resolve(DOS, "leche ent")).toBe(INSUMOS);
  });

  it("treats an RFC such as __proto__ as plain data", () => {
    const resolver = makeResolver(settingsWith({ products: [leche("__proto__", INSUMOS)] }));
    expect(resolver.explain("__proto__", LECHE).source).toBe("producto");
    expect(resolver.explain("constructor", LECHE).source).toBe("ninguna");
  });
});
