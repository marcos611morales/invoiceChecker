import { describe, expect, it } from "vitest";
import type { PriceOverride } from "../settings/types";
import {
  classifyClave,
  comparabilityOf,
  defaultComparable,
  defaultsByProduct,
  type KeyClass,
} from "./comparable";
import type { Purchase } from "./purchases";

function purchase(productId: string, claveProdServ: string): Purchase {
  return {
    productId,
    productName: productId,
    storeRfc: "AAA010101AAA",
    storeName: "Tienda",
    memberKey: "k",
    descripcion: "D",
    claveProdServ,
    claveUnidad: "H87",
    cantidad: "1",
    fecha: "2025-01-15T10:00:00",
    folio: null,
    uuid: "u",
    conceptIndex: 0,
    amount: null,
  };
}

describe("classifyClave (D-16, D-27)", () => {
  const cases: readonly (readonly [string, KeyClass])[] = [
    ["15101514", "fuel"],
    ["15111510", "fuel"],
    ["15101600", "fuel"],
    ["84111506", "service"],
    ["70101500", "service"],
    ["94101500", "service"],
    ["95101500", "product"],
    ["69999999", "product"],
    ["64000000", "product"],
    ["50302700", "product"],
    ["", "product"],
    ["AB123456", "product"],
  ];
  for (const [clave, expected] of cases) {
    it(`"${clave}" is ${expected}`, () => {
      expect(classifyClave(clave)).toBe(expected);
    });
  }

  it("works on the text, tolerating edge spaces and short keys", () => {
    expect(classifyClave(" 84111506 ")).toBe("service");
    expect(classifyClave("7")).toBe("product");
    expect(classifyClave("15")).toBe("product");
    expect(classifyClave("1510")).toBe("fuel");
    expect(classifyClave("__proto__")).toBe("product");
  });

  it("other 1511 keys are not fuel, only 151115 is (gas LP)", () => {
    expect(classifyClave("15111600")).toBe("product");
    expect(classifyClave("15111500")).toBe("fuel");
  });
});

describe("defaultComparable (D-17)", () => {
  it("is true for no keys", () => {
    expect(defaultComparable([])).toBe(true);
  });
  it("is false when every key is a service", () => {
    expect(defaultComparable(["84111506"])).toBe(false);
  });
  it("is true when one key is a product", () => {
    expect(defaultComparable(["84111506", "50302700"])).toBe(true);
  });
  it("is false when every key is a service or fuel", () => {
    expect(defaultComparable(["15101514", "84121500"])).toBe(false);
  });
});

describe("defaultsByProduct (D-31)", () => {
  it("gives one boolean per product over all its purchases", () => {
    const defaults = defaultsByProduct([
      purchase("gasolina", "15101514"),
      purchase("gasolina", "15101514"),
      purchase("ads", "84111506"),
      purchase("blueberries", "84111506"),
      purchase("blueberries", "50302700"),
      purchase("azucar", "50161800"),
    ]);
    expect(defaults.size).toBe(4);
    expect(defaults.get("gasolina")).toBe(false);
    expect(defaults.get("ads")).toBe(false);
    expect(defaults.get("blueberries")).toBe(true);
    expect(defaults.get("azucar")).toBe(true);
  });

  it("keeps a product id such as __proto__ as plain data", () => {
    const defaults = defaultsByProduct([purchase("__proto__", "84111506")]);
    expect(defaults.get("__proto__")).toBe(false);
  });
});

describe("comparabilityOf (D-18)", () => {
  const defaults = new Map<string, boolean>([
    ["a", true],
    ["b", false],
  ]);
  const overrides: PriceOverride[] = [
    { productId: "a", comparable: false },
    { productId: "b", comparable: true },
  ];

  it("follows the default without an override", () => {
    expect(comparabilityOf("a", defaults, [])).toEqual({
      comparable: true,
      byUser: false,
      defaultComparable: true,
    });
    expect(comparabilityOf("b", defaults, new Map())).toEqual({
      comparable: false,
      byUser: false,
      defaultComparable: false,
    });
  });

  it("applies the override from a list or from a map", () => {
    expect(comparabilityOf("a", defaults, overrides)).toEqual({
      comparable: false,
      byUser: true,
      defaultComparable: true,
    });
    expect(comparabilityOf("b", defaults, new Map([["b", true]]))).toEqual({
      comparable: true,
      byUser: true,
      defaultComparable: false,
    });
  });

  it("treats a product absent from the defaults as comparable", () => {
    expect(comparabilityOf("zzz", defaults, [])).toEqual({
      comparable: true,
      byUser: false,
      defaultComparable: true,
    });
  });
});
