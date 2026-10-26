import { describe, expect, it } from "vitest";
import { restorePriceOverride, setPriceOverride } from "./prices";
import { settingsDataSchema } from "./schema";
import { LIMITS, defaultSettings, type PriceOverride, type Product, type SettingsData } from "./types";

const UNO = "AAA010101AAA";

function product(id: string, name: string): Product {
  return {
    id,
    name,
    categoryId: null,
    members: [{ rfc: UNO, key: `${id} key`, description: id, supplierName: "Tienda" }],
  };
}

function settingsWith(
  priceOverrides: PriceOverride[] = [],
  ids: readonly string[] = ["p1", "p2"],
): SettingsData {
  return {
    ...defaultSettings(),
    products: ids.map((id) => product(id, `Producto ${id}`)),
    priceOverrides,
  };
}

/** Freezes the settings deeply so any mutation by the code under test throws. */
function deepFreeze(settings: SettingsData): SettingsData {
  for (const entry of settings.products) {
    for (const item of entry.members) Object.freeze(item);
    Object.freeze(entry.members);
    Object.freeze(entry);
  }
  for (const override of settings.priceOverrides) Object.freeze(override);
  Object.freeze(settings.products);
  Object.freeze(settings.priceOverrides);
  return Object.freeze(settings);
}

describe("setPriceOverride (D-18, D-19)", () => {
  it("marking a default-comparable product stores { productId, comparable: false }", () => {
    const settings = deepFreeze(settingsWith());
    const result = setPriceOverride(settings, "p1", false, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previous).toBeNull();
    expect(result.next.priceOverrides).toEqual([{ productId: "p1", comparable: false }]);
    expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
    // Everything else is shared with the input.
    expect(result.next.products).toBe(settings.products);
  });

  it("returning to the default removes the entry and reports the previous one", () => {
    const first = setPriceOverride(settingsWith(), "p1", false, true);
    if (!first.ok) throw new Error("expected ok");
    const second = setPriceOverride(deepFreeze(first.next), "p1", true, true);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.previous).toEqual({ productId: "p1", comparable: false });
    expect(second.next.priceOverrides).toEqual([]);
  });

  it("«Volver a comparar» on a default-hidden product stores comparable: true", () => {
    const result = setPriceOverride(settingsWith(), "p2", true, false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.priceOverrides).toEqual([{ productId: "p2", comparable: true }]);
    expect(result.previous).toBeNull();
  });

  it("replaces an existing entry in place and reports the previous one", () => {
    const settings = deepFreeze(
      settingsWith([
        { productId: "p1", comparable: false },
        { productId: "p2", comparable: true },
      ]),
    );
    // p1 default is false, so comparable: true is the difference now.
    const result = setPriceOverride(settings, "p1", true, false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previous).toEqual({ productId: "p1", comparable: false });
    expect(result.next.priceOverrides).toEqual([
      { productId: "p1", comparable: true },
      { productId: "p2", comparable: true },
    ]);
  });

  it("setting what is already stored, or the default with no entry, is no change", () => {
    const settings = deepFreeze(settingsWith([{ productId: "p1", comparable: false }]));
    const same = setPriceOverride(settings, "p1", false, true);
    expect(same.ok && same.next).toBe(settings);
    const noEntry = setPriceOverride(settings, "p2", true, true);
    expect(noEntry.ok && noEntry.next).toBe(settings);
    expect(noEntry.ok && noEntry.previous).toBeNull();
  });

  it("refuses an unknown product id", () => {
    const settings = deepFreeze(settingsWith());
    expect(setPriceOverride(settings, "nope", false, true)).toEqual({
      ok: false,
      reason: "unknown-product",
    });
  });

  it("refuses the 2,001st entry as a limit and still accepts a change to an existing one", () => {
    const ids = Array.from({ length: LIMITS.priceOverrides + 1 }, (_, index) => `p${index}`);
    const overrides = ids
      .slice(0, LIMITS.priceOverrides)
      .map((productId) => ({ productId, comparable: false }));
    const settings = deepFreeze(settingsWith(overrides, ids));
    expect(setPriceOverride(settings, `p${LIMITS.priceOverrides}`, false, true)).toEqual({
      ok: false,
      reason: "limit",
    });
    const flip = setPriceOverride(settings, "p0", true, false);
    expect(flip.ok).toBe(true);
    // Removing at the limit is fine too.
    const removal = setPriceOverride(settings, "p1", true, true);
    expect(removal.ok).toBe(true);
  });

  it("keeps a product id such as __proto__ as plain data", () => {
    const settings = settingsWith([], ["__proto__"]);
    const result = setPriceOverride(settings, "__proto__", false, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.priceOverrides).toEqual([{ productId: "__proto__", comparable: false }]);
  });
});

describe("restorePriceOverride (D-19)", () => {
  it("with null removes the entry", () => {
    const settings = deepFreeze(settingsWith([{ productId: "p1", comparable: false }]));
    expect(restorePriceOverride(settings, "p1", null).priceOverrides).toEqual([]);
  });

  it("puts the previous entry back", () => {
    const settings = deepFreeze(settingsWith());
    const next = restorePriceOverride(settings, "p1", { productId: "p1", comparable: false });
    expect(next.priceOverrides).toEqual([{ productId: "p1", comparable: false }]);
  });

  it("replaces a different entry with the previous one", () => {
    const settings = deepFreeze(settingsWith([{ productId: "p1", comparable: true }]));
    const next = restorePriceOverride(settings, "p1", { productId: "p1", comparable: false });
    expect(next.priceOverrides).toEqual([{ productId: "p1", comparable: false }]);
  });

  it("is the same object when nothing changes", () => {
    const withEntry = deepFreeze(settingsWith([{ productId: "p1", comparable: false }]));
    expect(restorePriceOverride(withEntry, "p1", { productId: "p1", comparable: false })).toBe(
      withEntry,
    );
    const empty = deepFreeze(settingsWith());
    expect(restorePriceOverride(empty, "p1", null)).toBe(empty);
  });

  it("is the same object for a product that no longer exists", () => {
    const settings = deepFreeze(settingsWith());
    expect(restorePriceOverride(settings, "gone", { productId: "gone", comparable: false })).toBe(
      settings,
    );
  });

  it("is the same object when it would pass the limit", () => {
    const ids = Array.from({ length: LIMITS.priceOverrides + 1 }, (_, index) => `p${index}`);
    const overrides = ids
      .slice(0, LIMITS.priceOverrides)
      .map((productId) => ({ productId, comparable: false }));
    const settings = deepFreeze(settingsWith(overrides, ids));
    const id = `p${LIMITS.priceOverrides}`;
    expect(restorePriceOverride(settings, id, { productId: id, comparable: false })).toBe(settings);
  });
});
