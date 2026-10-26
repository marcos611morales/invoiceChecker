import { describe, expect, it } from "vitest";
import {
  removeContentCorrection,
  restorePriceOverride,
  restoreContentCorrection,
  setContentCorrection,
  setPriceOverride,
} from "./prices";
import { settingsDataSchema } from "./schema";
import {
  LIMITS,
  defaultSettings,
  type ContentCorrection,
  type PriceOverride,
  type Product,
  type SettingsData,
} from "./types";

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

// --- Content corrections (Plan 05-10, D-13, D-14, D-15) ---

function correction(overrides: Partial<ContentCorrection> = {}): ContentCorrection {
  return {
    rfc: UNO,
    key: "coca cola",
    description: "COCA COLA",
    supplierName: "Tienda",
    packs: 12,
    amount: "1",
    unit: "l",
    ...overrides,
  };
}

function withCorrections(contentCorrections: ContentCorrection[]): SettingsData {
  return { ...defaultSettings(), contentCorrections };
}

function deepFreezeCorrections(settings: SettingsData): SettingsData {
  for (const entry of settings.contentCorrections) Object.freeze(entry);
  Object.freeze(settings.contentCorrections);
  return Object.freeze(settings);
}

describe("setContentCorrection (D-13, D-14, D-15)", () => {
  it("adds a correction with previous null and the result passes the stored schema", () => {
    const settings = deepFreezeCorrections(withCorrections([]));
    const result = setContentCorrection(settings, correction());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previous).toBeNull();
    expect(result.next.contentCorrections).toEqual([correction()]);
    expect(settingsDataSchema.safeParse(result.next).success).toBe(true);
    // Everything else is shared with the input.
    expect(result.next.products).toBe(settings.products);
    expect(result.next.priceOverrides).toBe(settings.priceOverrides);
  });

  it("replaces the same member and returns the previous entry", () => {
    const first = setContentCorrection(withCorrections([]), correction());
    if (!first.ok) throw new Error("expected ok");
    const second = setContentCorrection(
      deepFreezeCorrections(first.next),
      correction({ packs: 6, amount: "355", unit: "ml" }),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.previous).toEqual(correction());
    expect(second.next.contentCorrections).toEqual([correction({ packs: 6, amount: "355", unit: "ml" })]);
  });

  it("keeps the other members and tells two suppliers with the same key apart", () => {
    const other = correction({ rfc: "BBB010101BBB", description: "COCA COLA B" });
    const result = setContentCorrection(withCorrections([other]), correction());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previous).toBeNull();
    expect(result.next.contentCorrections).toEqual([other, correction()]);
  });

  it.each([
    ["0 packs", { packs: 0 }],
    ["1.5 packs", { packs: 1.5 }],
    ["1000 packs", { packs: 1000 }],
    ["negative packs", { packs: -2 }],
    ["NaN packs", { packs: Number.NaN }],
    ["amount 0", { amount: "0" }],
    ["amount 1e3", { amount: "1e3" }],
    ["empty amount", { amount: "" }],
    ["7 decimals", { amount: "0.0000001" }],
    ["amount above 1,000,000", { amount: "1000001" }],
  ] as const)("refuses %s as invalid and returns the same object", (_label, patch) => {
    const settings = withCorrections([]);
    const result = setContentCorrection(settings, correction(patch));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an unknown unit as invalid", () => {
    // The unit arrives from the editor, so a hostile value is typed away on purpose.
    const bad: unknown = { ...correction(), unit: "lb" };
    const result = setContentCorrection(withCorrections([]), bad as ContentCorrection);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a new member at the cap but still replaces an existing one", () => {
    const full: ContentCorrection[] = [];
    for (let index = 0; index < LIMITS.contentCorrections; index += 1) {
      full.push(correction({ key: `k${index}`, description: `D${index}` }));
    }
    const settings = deepFreezeCorrections(withCorrections(full));
    expect(setContentCorrection(settings, correction({ key: "nuevo" }))).toEqual({
      ok: false,
      reason: "limit",
    });
    const replaced = setContentCorrection(settings, correction({ key: "k5", description: "D5", packs: 2 }));
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.next.contentCorrections).toHaveLength(LIMITS.contentCorrections);
    expect(replaced.next.contentCorrections[5]?.packs).toBe(2);
    expect(settingsDataSchema.safeParse(replaced.next).success).toBe(true);
  });

  it("stores exactly the seven contract keys even if the object carries invoice data (T-05-24)", () => {
    const noisy = {
      ...correction(),
      folio: "A-123",
      fecha: "2025-01-01T10:00:00",
      total: "999.00",
      uuid: "00000000-0000-4000-8000-000000000001",
    };
    const result = setContentCorrection(withCorrections([]), noisy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.next.contentCorrections[0];
    expect(Object.keys(stored ?? {}).sort()).toEqual(
      ["amount", "description", "key", "packs", "rfc", "supplierName", "unit"].sort(),
    );
    expect(JSON.stringify(result.next)).not.toContain("999.00");
  });

  it("does not store the caller's object itself", () => {
    const given = correction();
    const result = setContentCorrection(withCorrections([]), given);
    if (!result.ok) throw new Error("expected ok");
    expect(result.next.contentCorrections[0]).not.toBe(given);
  });
});

describe("removeContentCorrection and restoreContentCorrection (D-13)", () => {
  it("removes a member and returns the removed entry; restore puts it back at the end", () => {
    const a = correction();
    const b = correction({ key: "otro", description: "OTRO" });
    const settings = deepFreezeCorrections(withCorrections([a, b]));
    const removed = removeContentCorrection(settings, a.rfc, a.key);
    expect(removed).not.toBeNull();
    if (removed === null) return;
    expect(removed.removed).toEqual(a);
    expect(removed.next.contentCorrections).toEqual([b]);
    const back = restoreContentCorrection(deepFreezeCorrections(removed.next), removed.removed);
    expect(back.contentCorrections).toEqual([b, a]);
    expect(settingsDataSchema.safeParse(back).success).toBe(true);
  });

  it("returns null for an unknown member", () => {
    const settings = withCorrections([correction()]);
    expect(removeContentCorrection(settings, UNO, "nope")).toBeNull();
    expect(removeContentCorrection(settings, "ZZZ010101ZZZ", "coca cola")).toBeNull();
  });

  it("restore replaces a correction saved meanwhile for the same member", () => {
    const old = correction();
    const settings = withCorrections([correction({ packs: 3 })]);
    const back = restoreContentCorrection(settings, old);
    expect(back.contentCorrections).toEqual([old]);
  });

  it("a refused restore (invalid value or full list) returns the same object", () => {
    const settings = withCorrections([]);
    expect(restoreContentCorrection(settings, correction({ packs: 0 }))).toBe(settings);
    const full: ContentCorrection[] = [];
    for (let index = 0; index < LIMITS.contentCorrections; index += 1) {
      full.push(correction({ key: `k${index}`, description: `D${index}` }));
    }
    const filled = withCorrections(full);
    expect(restoreContentCorrection(filled, correction({ key: "nuevo" }))).toBe(filled);
  });
});
