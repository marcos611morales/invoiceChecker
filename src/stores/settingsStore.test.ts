// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ruleMapKey } from "@/domain/settings/normalize";
import {
  SEED_CATEGORIES,
  SIN_CATEGORIA,
  defaultSettings,
  type ProductMember,
  type SettingsData,
  type SettingsDataV2,
} from "@/domain/settings/types";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";
import { useStorageStatusStore } from "./storageStatusStore";
import { resetSettingsStore, storeSettingsV2 } from "../../tests/support/settingsStorage";

const KEY = "invoicechecker:settings";

async function rehydrate(): Promise<void> {
  await useSettingsStore.persist.rehydrate();
}

function snapshot(): SettingsData {
  const { ivaMode, categories, supplierCategories, conceptRules, products, ungroupedConcepts } =
    useSettingsStore.getState();
  return { ivaMode, categories, supplierCategories, conceptRules, products, ungroupedConcepts };
}

function storeRaw(state: unknown, version: number | undefined = 3): void {
  window.localStorage.setItem(KEY, JSON.stringify({ state, version }));
}

function storedEnvelope(): unknown {
  return JSON.parse(window.localStorage.getItem(KEY) ?? "null");
}

/** The store holds Sin IVA, so a fallback to the defaults is visible as Con IVA. */
function primeWithSin(): void {
  useSettingsStore.setState({ ivaMode: "sin" });
}

beforeEach(() => {
  window.localStorage.clear();
  resetSettingsStore();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetSettingsStore();
  useSessionStore.getState().clearAll();
});

describe("settingsStore defaults", () => {
  it("starts in Con IVA with the nine suggestions in D-02 order and empty lists", () => {
    const state = snapshot();
    expect(state.ivaMode).toBe("con");
    expect(state.categories.map((category) => category.name)).toEqual([
      "Insumos de cafetería",
      "Abarrotes y despensa",
      "Limpieza e higiene",
      "Servicios (luz, agua, internet, teléfono)",
      "Software y suscripciones",
      "Comisiones bancarias",
      "Mantenimiento y reparaciones",
      "Papelería y oficina",
      "Otros",
    ]);
    expect(state.categories.map((category) => category.id)).toEqual(SEED_CATEGORIES.map((c) => c.id));
    expect(state.supplierCategories).toEqual([]);
    expect(state.conceptRules).toEqual([]);
  });

  it("returns distinct arrays on every defaultSettings() call", () => {
    const a = defaultSettings();
    const b = defaultSettings();
    expect(a.categories).not.toBe(b.categories);
    expect(a.supplierCategories).not.toBe(b.supplierCategories);
    expect(a.conceptRules).not.toBe(b.conceptRules);
    a.categories.push({ id: "x", name: "X" });
    expect(b.categories).toHaveLength(9);
  });

  it("keeps the nine seed ids stable and never equal to the reserved key", () => {
    const ids = defaultSettings().categories.map((category) => category.id);
    expect(new Set(ids).size).toBe(9);
    expect(ids).not.toContain(SIN_CATEGORIA);
  });
});

describe("settingsStore migration from the Phase 2 contract (D-06, D-25)", () => {
  it("rehydrates a stored version 1 Sin IVA with the nine suggestions and rewrites storage as version 3", async () => {
    storeRaw({ ivaMode: "sin" }, 1);
    await rehydrate();
    expect(snapshot()).toEqual({ ...defaultSettings(), ivaMode: "sin" });
    expect(storedEnvelope()).toEqual({
      state: { ...defaultSettings(), ivaMode: "sin" },
      version: 3,
    });
  });

  it("gives the defaults for a stored version 1 with a tampered mode", async () => {
    primeWithSin();
    storeRaw({ ivaMode: "x" }, 1);
    await rehydrate();
    expect(snapshot()).toEqual(defaultSettings());
  });

  it("gives the defaults for a stored version 1 whose state is null", async () => {
    primeWithSin();
    storeRaw(null, 1);
    await rehydrate();
    expect(snapshot()).toEqual(defaultSettings());
  });
});

/** A Phase 3 value (four fields), as a browser that only used version 2 stored it. */
function phase3Value(): SettingsDataV2 {
  return {
    ivaMode: "sin",
    categories: [
      { id: "seed:servicios", name: "Servicios" },
      { id: "cat_1", name: "Café" },
    ],
    supplierCategories: [{ rfc: "AAA010101AAA", name: "Proveedor A", categoryId: "cat_1" }],
    conceptRules: [
      { rfc: "AAA010101AAA", key: "leche entera", description: "Leche entera", categoryId: "seed:servicios" },
      { rfc: "AAA010101AAA", key: "bolsa", description: "Bolsa", categoryId: null },
    ],
  };
}

describe("settingsStore stored version 2 (the Phase 3 value, D-13)", () => {
  it("rehydrates with every field kept, no products and no marks, and rewrites storage as version 3", async () => {
    const stored = phase3Value();
    storeRaw(stored, 2);
    await rehydrate();
    expect(snapshot()).toEqual({ ...stored, products: [], ungroupedConcepts: [] });
    expect(storedEnvelope()).toEqual({
      state: { ...stored, products: [], ungroupedConcepts: [] },
      version: 3,
    });
  });

  it("is what storeSettingsV2 writes, and does not mark a read failure", async () => {
    const stored = phase3Value();
    storeSettingsV2(stored);
    await rehydrate();
    expect(snapshot()).toEqual({ ...stored, products: [], ungroupedConcepts: [] });
    expect(useStorageStatusStore.getState().readFailed).toBe(false);
  });

  it("keeps zero categories of a stored version 2", async () => {
    storeRaw({ ivaMode: "sin", categories: [], supplierCategories: [], conceptRules: [] }, 2);
    await rehydrate();
    expect(snapshot()).toEqual({
      ivaMode: "sin",
      categories: [],
      supplierCategories: [],
      conceptRules: [],
      products: [],
      ungroupedConcepts: [],
    });
  });

  it("gives the defaults for a malformed stored version 2, without throwing", async () => {
    primeWithSin();
    storeRaw({ ...phase3Value(), supplierCategories: [{ rfc: "A", name: "A", categoryId: "missing" }] }, 2);
    await expect(rehydrate()).resolves.toBeUndefined();
    expect(snapshot()).toEqual(defaultSettings());
    expect(useStorageStatusStore.getState().readFailed).toBe(true);
  });
});

describe("settingsStore stored version 3", () => {
  it("rehydrates a valid value unchanged", async () => {
    const stored: SettingsData = { ...phase3Value(), products: [], ungroupedConcepts: [] };
    storeRaw(stored);
    await rehydrate();
    expect(snapshot()).toEqual(stored);
  });

  it("rehydrates one product and one «No agrupar» mark unchanged, including an rfc __proto__", async () => {
    const stored: SettingsData = {
      ...phase3Value(),
      products: [
        {
          id: "prod_1",
          name: "Leche entera",
          categoryId: "cat_1",
          members: [
            { rfc: "AAA010101AAA", key: "mm leche ent", description: "MM LECHE ENT", supplierName: "Proveedor A" },
            { rfc: "__proto__", key: "__proto__", description: "constructor", supplierName: "toString" },
          ],
        },
      ],
      ungroupedConcepts: [
        { rfc: "AAA010101AAA", key: "flete", description: "FLETE", supplierName: "Proveedor A" },
      ],
    };
    storeRaw(stored);
    await rehydrate();
    expect(snapshot()).toEqual(stored);
    expect(storedEnvelope()).toEqual({ state: stored, version: 3 });
    expect(Reflect.get(Object.prototype, "polluted")).toBeUndefined();
  });

  it("falls back to the defaults for a stored version 3 whose product breaks an integrity rule", async () => {
    primeWithSin();
    storeRaw({
      ...defaultSettings(),
      products: [{ id: "prod_1", name: "Leche", categoryId: "missing", members: [] }],
    });
    await expect(rehydrate()).resolves.toBeUndefined();
    expect(snapshot()).toEqual(defaultSettings());
    expect(useStorageStatusStore.getState().readFailed).toBe(true);
  });

  it("keeps products and marks written by the store itself after a reload", async () => {
    const next: SettingsData = {
      ...defaultSettings(),
      products: [
        {
          id: "prod_1",
          name: "Leche entera",
          categoryId: null,
          members: [{ rfc: "AAA010101AAA", key: "leche", description: "Leche", supplierName: "A" }],
        },
      ],
      ungroupedConcepts: [{ rfc: "AAA010101AAA", key: "flete", description: "Flete", supplierName: "A" }],
    };
    useSettingsStore.getState().replaceAll(next);
    const stored = storedEnvelope();
    // Forget the in-memory values without touching the stored ones, as a reload does.
    useSettingsStore.setState(defaultSettings());
    window.localStorage.setItem(KEY, JSON.stringify(stored));
    await rehydrate();
    expect(snapshot()).toEqual(next);
  });

  it("keeps zero categories after reload: the suggestions are never re-seeded", async () => {
    storeRaw({
      ivaMode: "sin",
      categories: [],
      supplierCategories: [],
      conceptRules: [],
      products: [],
      ungroupedConcepts: [],
    });
    await rehydrate();
    expect(snapshot()).toEqual({
      ivaMode: "sin",
      categories: [],
      supplierCategories: [],
      conceptRules: [],
      products: [],
      ungroupedConcepts: [],
    });
  });

  it("keeps the categories and assignments written by the store itself after a reload", async () => {
    useSettingsStore.setState({
      categories: [{ id: "cat_1", name: "Café" }],
      supplierCategories: [{ rfc: "AAA010101AAA", name: "Proveedor A", categoryId: "cat_1" }],
    });
    // Forget the in-memory values without touching the stored ones, as a reload does.
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
    useSettingsStore.setState(defaultSettings());
    blocked.mockRestore();
    await rehydrate();
    expect(snapshot().categories).toEqual([{ id: "cat_1", name: "Café" }]);
    expect(snapshot().supplierCategories).toEqual([
      { rfc: "AAA010101AAA", name: "Proveedor A", categoryId: "cat_1" },
    ]);
  });

  it("round-trips an assignment with rfc __proto__ as plain data", async () => {
    const stored: SettingsData = {
      ...defaultSettings(),
      supplierCategories: [{ rfc: "__proto__", name: "Raro", categoryId: "seed:otros" }],
      conceptRules: [{ rfc: "__proto__", key: "constructor", description: "constructor", categoryId: null }],
    };
    storeRaw(stored);
    await rehydrate();
    expect(snapshot()).toEqual(stored);
  });

  const breaches: ReadonlyArray<[string, () => unknown]> = [
    [
      "201 categories",
      () => ({
        ...defaultSettings(),
        categories: Array.from({ length: 201 }, (_, i) => ({ id: `c${i}`, name: `Categoría ${i}` })),
      }),
    ],
    [
      "a 61-character name",
      () => ({ ...defaultSettings(), categories: [{ id: "c1", name: "a".repeat(61) }] }),
    ],
    [
      "«sin categoría » as a name",
      () => ({ ...defaultSettings(), categories: [{ id: "c1", name: "sin categoría " }] }),
    ],
    [
      "two names Café and ' café'",
      () => ({
        ...defaultSettings(),
        categories: [
          { id: "c1", name: "Café" },
          { id: "c2", name: " café" },
        ],
      }),
    ],
    [
      "an assignment to a missing id",
      () => ({
        ...defaultSettings(),
        supplierCategories: [{ rfc: "AAA010101AAA", name: "A", categoryId: "missing" }],
      }),
    ],
    [
      "a repeated rfc",
      () => ({
        ...defaultSettings(),
        supplierCategories: [
          { rfc: "AAA010101AAA", name: "A", categoryId: "seed:otros" },
          { rfc: "AAA010101AAA", name: "A", categoryId: "seed:servicios" },
        ],
      }),
    ],
    [
      "a repeated rfc plus key",
      () => ({
        ...defaultSettings(),
        conceptRules: [
          { rfc: "AAA010101AAA", key: "leche", description: "Leche", categoryId: null },
          { rfc: "AAA010101AAA", key: "leche", description: "LECHE", categoryId: "seed:otros" },
        ],
      }),
    ],
    [
      "a rule pointing at a missing id",
      () => ({
        ...defaultSettings(),
        conceptRules: [{ rfc: "AAA010101AAA", key: "leche", description: "Leche", categoryId: "missing" }],
      }),
    ],
    [
      "an id equal to the reserved key",
      () => ({ ...defaultSettings(), categories: [{ id: SIN_CATEGORIA, name: "Otra" }] }),
    ],
    [
      "a repeated category id",
      () => ({
        ...defaultSettings(),
        categories: [
          { id: "dup", name: "Una" },
          { id: "dup", name: "Otra" },
        ],
      }),
    ],
    ["an unknown IVA mode", () => ({ ...defaultSettings(), ivaMode: "x" })],
    ["a missing list", () => ({ ivaMode: "con", categories: [] })],
  ];

  it.each(breaches)("falls back to the defaults, without throwing, for %s", async (_label, build) => {
    primeWithSin();
    storeRaw(build());
    await expect(rehydrate()).resolves.toBeUndefined();
    expect(snapshot()).toEqual(defaultSettings());
  });

  it("falls back to the defaults for a stored state that is null, a string or a number", async () => {
    for (const state of [null, "sin", 42, [], true]) {
      primeWithSin();
      storeRaw(state);
      await rehydrate();
      expect(snapshot()).toEqual(defaultSettings());
    }
  });

  it("accepts the limits themselves: 200 categories and a 60-character name", async () => {
    const stored: SettingsData = {
      ...defaultSettings(),
      categories: Array.from({ length: 200 }, (_, i) => ({
        id: `c${i}`,
        name: i === 0 ? "a".repeat(60) : `Categoría ${i}`,
      })),
    };
    storeRaw(stored);
    await rehydrate();
    expect(snapshot().categories).toHaveLength(200);
  });
});

describe("settingsStore storage failures", () => {
  it("falls back to the defaults for stored invalid JSON", async () => {
    primeWithSin();
    window.localStorage.setItem(KEY, "{not json");
    await rehydrate();
    expect(snapshot()).toEqual(defaultSettings());
  });

  it("falls back to the defaults for a wrongly shaped envelope", async () => {
    for (const value of [
      "null",
      "42",
      JSON.stringify("sin"),
      JSON.stringify([]),
      JSON.stringify({ ivaMode: "sin" }),
      JSON.stringify({ state: { ivaMode: "x" } }),
      JSON.stringify({ state: { ivaMode: 1 }, version: 1 }),
      JSON.stringify({ state: { ivaMode: "sin" }, version: "1" }),
    ]) {
      primeWithSin();
      window.localStorage.setItem(KEY, value);
      await rehydrate();
      expect(snapshot()).toEqual(defaultSettings());
    }
  });

  it("keeps the defaults when the key is missing", async () => {
    await rehydrate();
    expect(snapshot()).toEqual(defaultSettings());
  });

  it("keeps the defaults when getItem throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await rehydrate();
    expect(snapshot()).toEqual(defaultSettings());
  });

  it("setIvaMode does not throw when setItem throws (quota or blocked) and still updates memory", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => useSettingsStore.getState().setIvaMode("sin")).not.toThrow();
    expect(useSettingsStore.getState().ivaMode).toBe("sin");
  });
});

describe("settingsStore writes", () => {
  it("writes { state: { ivaMode, categories, supplierCategories, conceptRules, products, ungroupedConcepts }, version: 3 } under the contract key", () => {
    useSettingsStore.getState().setIvaMode("sin");
    expect(storedEnvelope()).toEqual({
      state: {
        ivaMode: "sin",
        categories: defaultSettings().categories,
        supplierCategories: [],
        conceptRules: [],
        products: [],
        ungroupedConcepts: [],
      },
      version: 3,
    });
  });

  it("writes nothing but the settings key, holding only the six settings fields (D-30, CARGA-06)", () => {
    const session = useSessionStore.getState();
    session.excludeInvoice("A");
    session.setRange({ from: "2025-01", to: "2025-03" });
    session.setSuppliers(new Set(["RFC1"]));
    session.requestFocus("A");
    session.setActiveTab("calidad");
    useSettingsStore.getState().setIvaMode("sin");
    useSettingsStore.getState().setIvaMode("con");
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.key(0)).toBe(KEY);
    expect(window.sessionStorage.length).toBe(0);
    const stored = storedEnvelope();
    expect(stored).toEqual({ state: defaultSettings(), version: 3 });
    const state: unknown =
      typeof stored === "object" && stored !== null && "state" in stored ? stored.state : null;
    expect(Object.keys(typeof state === "object" && state !== null ? state : {}).sort()).toEqual([
      "categories",
      "conceptRules",
      "ivaMode",
      "products",
      "supplierCategories",
      "ungroupedConcepts",
    ]);
  });

  it("can be imported on the server with no window object", async () => {
    vi.resetModules();
    vi.stubGlobal("window", undefined);
    try {
      const fresh = await import("./settingsStore");
      expect(fresh.useSettingsStore.getState().ivaMode).toBe("con");
      expect(fresh.useSettingsStore.getState().categories).toHaveLength(9);
      expect(() => fresh.useSettingsStore.getState().setIvaMode("sin")).not.toThrow();
      expect(fresh.useSettingsStore.getState().ivaMode).toBe("sin");
      // Nothing can be read without a window, so rehydrating falls back to the defaults.
      await fresh.useSettingsStore.persist.rehydrate();
      expect(fresh.useSettingsStore.getState().ivaMode).toBe("con");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("settingsStore setSupplierCategory (CAT-02)", () => {
  it("applies an ok result, refreshes the name and persists", () => {
    const first = useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "Viejo", "seed:servicios");
    expect(first.ok).toBe(true);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "Nuevo", "seed:otros");
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot().supplierCategories).toEqual([
      { rfc: "AAA010101AAA", name: "Nuevo", categoryId: "seed:otros" },
    ]);
    expect(storedEnvelope()).toEqual({ state: snapshot(), version: 3 });
  });

  it("removes the assignment with null", () => {
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "A", "seed:servicios");
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "A", null);
    expect(snapshot().supplierCategories).toEqual([]);
  });

  it("changes and writes nothing when the reducer refuses", () => {
    const before = snapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const result = useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "A", "missing");
    expect(result).toEqual({ ok: false, reason: "unknown-category" });
    expect(snapshot()).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("refuses the 5,001st assignment and keeps the stored list at the limit", () => {
    const full: SettingsData = {
      ...defaultSettings(),
      supplierCategories: Array.from({ length: 5000 }, (_, index) => ({
        rfc: `RFC${String(index)}`,
        name: `Proveedor ${String(index)}`,
        categoryId: "seed:servicios",
      })),
    };
    useSettingsStore.setState(full);
    const result = useSettingsStore.getState().setSupplierCategory("NEW", "Nuevo", "seed:servicios");
    expect(result).toEqual({ ok: false, reason: "limit" });
    expect(snapshot().supplierCategories).toHaveLength(5000);
  });
});

describe("settingsStore category actions (CAT-01, CAT-05)", () => {
  it("adds a category with a generated cat_ id and writes it in the stored envelope", () => {
    const result = useSettingsStore.getState().addCategory("  Café  ");
    if (!result.ok) throw new Error("the add must be accepted");
    expect(result.category.name).toBe("Café");
    expect(result.category.id).toMatch(/^cat_.+/);
    expect(snapshot().categories.at(-1)).toEqual(result.category);
    expect(storedEnvelope()).toEqual({ state: snapshot(), version: 3 });
  });

  it("generates a different id on every add", () => {
    const first = useSettingsStore.getState().addCategory("Uno");
    const second = useSettingsStore.getState().addCategory("Dos");
    if (!first.ok || !second.ok) throw new Error("both adds must be accepted");
    expect(first.category.id).not.toBe(second.category.id);
  });

  it("writes once per successful action", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSettingsStore.getState().addCategory("Café");
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("returns the reason and writes nothing when an add is refused", () => {
    const before = snapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(useSettingsStore.getState().addCategory("otros")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(useSettingsStore.getState().addCategory("Sin categoría")).toEqual({
      ok: false,
      reason: "reserved",
    });
    expect(useSettingsStore.getState().addCategory("   ")).toEqual({ ok: false, reason: "empty" });
    expect(snapshot()).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("refuses the 201st category and keeps the stored list at the limit", () => {
    useSettingsStore.setState({
      categories: Array.from({ length: 200 }, (_, index) => ({
        id: `cat_${String(index)}`,
        name: `Categoría ${String(index)}`,
      })),
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(useSettingsStore.getState().addCategory("Una más")).toEqual({
      ok: false,
      reason: "limit",
    });
    expect(snapshot().categories).toHaveLength(200);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("renames keeping the id, and reports a duplicate without writing", () => {
    const result = useSettingsStore.getState().renameCategory("seed:servicios", "Luz y agua");
    expect(result).toEqual({ ok: true });
    expect(snapshot().categories[3]).toEqual({ id: "seed:servicios", name: "Luz y agua" });
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(useSettingsStore.getState().renameCategory("seed:servicios", "OTROS")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("deletes, moving assignments and rules, and returns the snapshot", () => {
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "A", "seed:servicios");
    useSettingsStore.setState({
      conceptRules: [
        { rfc: "AAA010101AAA", key: "luz", description: "Luz", categoryId: "seed:servicios" },
      ],
    });
    const snapshotOfDelete = useSettingsStore.getState().deleteCategory("seed:servicios", "seed:otros");
    if (snapshotOfDelete === null) throw new Error("the delete must be accepted");
    expect(snapshotOfDelete.category.id).toBe("seed:servicios");
    expect(snapshot().categories.some((category) => category.id === "seed:servicios")).toBe(false);
    expect(snapshot().supplierCategories).toEqual([
      { rfc: "AAA010101AAA", name: "A", categoryId: "seed:otros" },
    ]);
    expect(snapshot().conceptRules[0]?.categoryId).toBe("seed:otros");
  });

  it("returns null and writes nothing when a delete is refused", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(useSettingsStore.getState().deleteCategory("seed:servicios", "seed:servicios")).toBeNull();
    expect(useSettingsStore.getState().deleteCategory("cat_missing", null)).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("leaves the stored data deep-equal to the data before the delete after a restore", () => {
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "A", "seed:servicios");
    useSettingsStore.getState().setSupplierCategory("BBB010101BBB", "B", "seed:limpieza-higiene");
    useSettingsStore.setState({
      conceptRules: [
        { rfc: "AAA010101AAA", key: "luz", description: "Luz", categoryId: "seed:servicios" },
        { rfc: "BBB010101BBB", key: "otro", description: "Otro", categoryId: null },
      ],
    });
    const before = storedEnvelope();
    const deleted = useSettingsStore.getState().deleteCategory("seed:servicios", "seed:otros");
    if (deleted === null) throw new Error("the delete must be accepted");
    expect(storedEnvelope()).not.toEqual(before);
    useSettingsStore.getState().restoreCategory(deleted);
    expect(storedEnvelope()).toEqual(before);
  });

  it("restores the assignments removed by a delete to Sin categoría", () => {
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "A", "seed:servicios");
    const before = snapshot();
    const deleted = useSettingsStore.getState().deleteCategory("seed:servicios", null);
    if (deleted === null) throw new Error("the delete must be accepted");
    expect(snapshot().supplierCategories).toEqual([]);
    useSettingsStore.getState().restoreCategory(deleted);
    expect(snapshot()).toEqual(before);
  });

  it("survives a reload: the added category is back after rehydrating", async () => {
    const added = useSettingsStore.getState().addCategory("Café");
    if (!added.ok) throw new Error("the add must be accepted");
    const stored = storedEnvelope();
    // Resetting the memory also writes the defaults, so the stored value is put back after it.
    useSettingsStore.setState(defaultSettings());
    window.localStorage.setItem(KEY, JSON.stringify(stored));
    await rehydrate();
    expect(snapshot().categories.at(-1)).toEqual(added.category);
  });
});

describe("settingsStore setConceptRule (CAT-03)", () => {
  it("stores the rule once, keeps the readable description and persists the envelope", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const result = useSettingsStore
      .getState()
      .setConceptRule("AAA010101AAA", "Café  Molido", "seed:servicios");
    expect(result.ok).toBe(true);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot().conceptRules).toEqual([
      {
        rfc: "AAA010101AAA",
        key: "cafe molido",
        description: "Café  Molido",
        categoryId: "seed:servicios",
      },
    ]);
    expect(storedEnvelope()).toEqual({ state: snapshot(), version: 3 });
  });

  it("replaces the rule of the same rfc and description and stores null as an explicit adjustment", () => {
    useSettingsStore.getState().setConceptRule("AAA010101AAA", "Cloro", "seed:servicios");
    useSettingsStore.getState().setConceptRule("AAA010101AAA", "CLORO", null);
    expect(snapshot().conceptRules).toEqual([
      { rfc: "AAA010101AAA", key: "cloro", description: "CLORO", categoryId: null },
    ]);
  });

  it("changes and writes nothing when the reducer refuses", () => {
    const before = snapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(useSettingsStore.getState().setConceptRule("AAA010101AAA", "Cloro", "missing")).toEqual({
      ok: false,
      reason: "unknown-category",
    });
    expect(snapshot()).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("refuses the 20,001st rule and keeps the stored list at the limit", () => {
    useSettingsStore.setState({
      conceptRules: Array.from({ length: 20000 }, (_, index) => ({
        rfc: "AAA010101AAA",
        key: `linea ${String(index)}`,
        description: `Línea ${String(index)}`,
        categoryId: "seed:servicios",
      })),
    });
    const result = useSettingsStore
      .getState()
      .setConceptRule("AAA010101AAA", "Nueva", "seed:servicios");
    expect(result).toEqual({ ok: false, reason: "limit" });
    expect(snapshot().conceptRules).toHaveLength(20000);
  });
});

describe("settingsStore removeConceptRule and restoreConceptRule (CAT-03, Q5)", () => {
  const RFC = "AAA010101AAA";

  it("removes the rule in one write and returns it for the undo", () => {
    useSettingsStore.getState().setConceptRule(RFC, "Cloro", "seed:servicios");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const previous = useSettingsStore.getState().removeConceptRule(RFC, "cloro");
    expect(previous).toEqual({
      rfc: RFC,
      key: "cloro",
      description: "Cloro",
      categoryId: "seed:servicios",
    });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot().conceptRules).toEqual([]);
  });

  it("returns null and writes nothing when there is no such rule", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(useSettingsStore.getState().removeConceptRule(RFC, "cloro")).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("restores exactly the rule from before a change, in one write", () => {
    useSettingsStore.getState().setConceptRule(RFC, "Cloro", "seed:servicios");
    const before = snapshot();
    const changed = useSettingsStore.getState().setConceptRule(RFC, "CLORO", "seed:otros");
    if (!changed.ok) throw new Error("the change must be accepted");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSettingsStore.getState().restoreConceptRule(RFC, "cloro", changed.previous);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot()).toEqual(before);
    expect(storedEnvelope()).toEqual({ state: before, version: 3 });
  });

  it("removes the rule when the change had no previous one", () => {
    const before = snapshot();
    const changed = useSettingsStore.getState().setConceptRule(RFC, "Cloro", "seed:servicios");
    if (!changed.ok) throw new Error("the change must be accepted");
    useSettingsStore.getState().restoreConceptRule(RFC, "cloro", changed.previous);
    expect(snapshot()).toEqual(before);
  });

  it("writes nothing when the restore is refused", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSettingsStore.getState().restoreConceptRule(RFC, "cloro", {
      rfc: RFC,
      key: "cloro",
      description: "Cloro",
      categoryId: "cat_borrada",
    });
    expect(setItem).not.toHaveBeenCalled();
    expect(snapshot().conceptRules).toEqual([]);
  });
});

describe("settingsStore storage status flags (Q8, AJUS-01)", () => {
  function status() {
    const { readFailed, writeFailed } = useStorageStatusStore.getState();
    return { readFailed, writeFailed };
  }

  it("marks a read failure for stored invalid JSON", async () => {
    window.localStorage.setItem(KEY, "{not json");
    await rehydrate();
    expect(status().readFailed).toBe(true);
  });

  it("marks a read failure for a wrongly shaped envelope", async () => {
    window.localStorage.setItem(KEY, JSON.stringify([]));
    await rehydrate();
    expect(status().readFailed).toBe(true);
  });

  it("marks a read failure for a version-3 value that breaks a limit", async () => {
    storeRaw({
      ...defaultSettings(),
      categories: Array.from({ length: 201 }, (_, i) => ({ id: `c${i}`, name: `Categoría ${i}` })),
    });
    await rehydrate();
    expect(status().readFailed).toBe(true);
    expect(snapshot()).toEqual(defaultSettings());
  });

  it("marks a read failure for a version-1 value with a tampered mode", async () => {
    storeRaw({ ivaMode: "x" }, 1);
    await rehydrate();
    expect(status().readFailed).toBe(true);
    expect(snapshot()).toEqual(defaultSettings());
  });

  it("does not mark a read failure with nothing stored, a valid version 3, a valid version 2 or a valid version 1", async () => {
    await rehydrate();
    expect(status().readFailed).toBe(false);
    storeRaw({ ...defaultSettings(), ivaMode: "sin" });
    await rehydrate();
    expect(status().readFailed).toBe(false);
    storeSettingsV2({ ...phase3Value(), ivaMode: "con" });
    await rehydrate();
    expect(status().readFailed).toBe(false);
    storeRaw({ ivaMode: "sin" }, 1);
    await rehydrate();
    expect(status().readFailed).toBe(false);
  });

  it("does not mark a read failure when getItem itself throws: nothing is known to be stored", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await rehydrate();
    expect(status().readFailed).toBe(false);
  });

  it("marks a write failure when setItem throws, keeps the change in memory, and clears it after a later write", () => {
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const added = useSettingsStore.getState().addCategory("Café");
    expect(added.ok).toBe(true);
    expect(status().writeFailed).toBe(true);
    expect(snapshot().categories.some((category) => category.name === "Café")).toBe(true);
    blocked.mockRestore();
    useSettingsStore.getState().setIvaMode("sin");
    expect(status().writeFailed).toBe(false);
  });

  it("never sets the settings store from the adapter: one change writes once", () => {
    const writes = vi.spyOn(Storage.prototype, "setItem");
    useSettingsStore.getState().setIvaMode("sin");
    expect(writes).toHaveBeenCalledTimes(1);
    writes.mockClear();
    writes.mockImplementation(() => {
      throw new Error("quota");
    });
    useSettingsStore.getState().setIvaMode("con");
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it("does not persist the status flags", () => {
    useStorageStatusStore.getState().markReadFailed();
    useStorageStatusStore.getState().setWriteFailed(true);
    expect(window.localStorage.getItem("invoicechecker:storage-status")).toBeNull();
    expect(storedEnvelope()).toBeNull();
  });
});

describe("settingsStore replaceAll (AJUS-02, D-08)", () => {
  function incoming(): SettingsData {
    return {
      ivaMode: "sin",
      categories: [
        { id: "seed:otros", name: "Otros" },
        { id: "cat_nueva", name: "Eventos" },
      ],
      supplierCategories: [{ rfc: "EKU9003173C9", name: "Proveedor uno", categoryId: "cat_nueva" }],
      conceptRules: [{ rfc: "EKU9003173C9", key: "renta", description: "Renta", categoryId: null }],
      products: [
        {
          id: "prod_1",
          name: "Renta mensual",
          categoryId: "cat_nueva",
          members: [{ rfc: "EKU9003173C9", key: "renta mes", description: "Renta mes", supplierName: "Proveedor uno" }],
        },
      ],
      ungroupedConcepts: [
        { rfc: "EKU9003173C9", key: "flete", description: "Flete", supplierName: "Proveedor uno" },
      ],
    };
  }

  it("sets all six fields in one write and stores exactly the envelope of version 3", () => {
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "Proveedor A", "seed:servicios");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const data = incoming();
    useSettingsStore.getState().replaceAll(data);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot()).toEqual(data);
    expect(storedEnvelope()).toEqual({ state: data, version: 3 });
  });

  it("keeps the actions of the store usable after a replace", () => {
    useSettingsStore.getState().replaceAll(incoming());
    const added = useSettingsStore.getState().addCategory("Otra más");
    expect(added.ok).toBe(true);
    expect(snapshot().categories.map((category) => category.name)).toEqual([
      "Otros",
      "Eventos",
      "Otra más",
    ]);
  });

  it("can replace with empty lists without re-seeding the suggestions", () => {
    useSettingsStore.getState().replaceAll({
      ivaMode: "con",
      categories: [],
      supplierCategories: [],
      conceptRules: [],
      products: [],
      ungroupedConcepts: [],
    });
    expect(snapshot().categories).toEqual([]);
  });
});

describe("settingsStore product actions (D-14, D-15)", () => {
  const uno = (key: string): ProductMember => ({
    rfc: "AAA010101AAA",
    key,
    description: key.toUpperCase(),
    supplierName: "Tienda Uno",
  });
  const keyOf = (member: ProductMember): string => ruleMapKey(member.rfc, member.key);

  function seed(): void {
    useSettingsStore.setState({
      products: [
        { id: "prod_a", name: "Leche", categoryId: null, members: [uno("a1"), uno("a2")] },
        { id: "prod_b", name: "Café", categoryId: null, members: [uno("b1")] },
      ],
    });
  }

  it("renames in one write that touches only the products, and refuses a bad name without writing", () => {
    seed();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const before = snapshot();
    expect(useSettingsStore.getState().renameProduct("prod_a", "  Leche entera ")).toEqual({ ok: true });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot().products.map((product) => product.name)).toEqual(["Leche entera", "Café"]);
    expect(snapshot().categories).toBe(before.categories);

    setItem.mockClear();
    expect(useSettingsStore.getState().renameProduct("prod_a", " café ")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(useSettingsStore.getState().renameProduct("prod_a", "   ")).toEqual({
      ok: false,
      reason: "empty",
    });
    // An unchanged name and an unknown id are no change either.
    expect(useSettingsStore.getState().renameProduct("prod_a", "Leche entera")).toEqual({ ok: true });
    expect(useSettingsStore.getState().renameProduct("prod_x", "Lo que sea")).toEqual({ ok: true });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("deletes and restores a product, each in one write, and a refused restore writes nothing", () => {
    seed();
    const original = snapshot().products;
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const snap = useSettingsStore.getState().deleteProduct("prod_a");
    expect(snap).not.toBeNull();
    if (snap === null) return;
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot().products.map((product) => product.id)).toEqual(["prod_b"]);

    setItem.mockClear();
    useSettingsStore.getState().restoreProduct(snap);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot().products).toEqual(original);

    setItem.mockClear();
    // The id is taken again: the restore is refused and nothing is written.
    useSettingsStore.getState().restoreProduct(snap);
    expect(setItem).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().deleteProduct("prod_x")).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("takes a member out and undoes it; the only member deletes the product and undo brings it back", () => {
    seed();
    const original = snapshot().products;
    const out = useSettingsStore.getState().removeProductMember("prod_a", keyOf(uno("a1")));
    expect(out?.kind).toBe("member");
    if (out === null) return;
    expect(snapshot().products[0]?.members.map((member) => member.key)).toEqual(["a2"]);
    useSettingsStore.getState().undoMemberChange(out);
    expect(snapshot().products).toEqual(original);

    const last = useSettingsStore.getState().removeProductMember("prod_b", keyOf(uno("b1")));
    expect(last?.kind).toBe("product");
    if (last === null) return;
    expect(snapshot().products.map((product) => product.id)).toEqual(["prod_a"]);
    useSettingsStore.getState().undoMemberChange(last);
    expect(snapshot().products).toEqual(original);
    expect(useSettingsStore.getState().removeProductMember("prod_a", keyOf(uno("zz")))).toBeNull();
  });

  it("moves a member to another product and undoes it", () => {
    seed();
    const original = snapshot().products;
    const moved = useSettingsStore.getState().moveProductMember("prod_a", keyOf(uno("a1")), "prod_b");
    expect(moved?.kind).toBe("moved");
    if (moved === null) return;
    expect(snapshot().products.map((product) => product.members.map((member) => member.key))).toEqual([
      ["a2"],
      ["b1", "a1"],
    ]);
    useSettingsStore.getState().undoMemberChange(moved);
    expect(snapshot().products).toEqual(original);
    expect(useSettingsStore.getState().moveProductMember("prod_a", keyOf(uno("a1")), "prod_a")).toBeNull();
  });

  it("writes only values that load back unchanged", async () => {
    seed();
    useSettingsStore.getState().renameProduct("prod_b", "Café molido");
    const moved = useSettingsStore.getState().moveProductMember("prod_b", keyOf(uno("b1")), "prod_a");
    expect(moved?.kind).toBe("product");
    const expected = snapshot();
    const written = window.localStorage.getItem(KEY);
    expect(written).not.toBeNull();
    // Resetting the store rewrites the storage, so put the written value back before loading it.
    useSettingsStore.setState(defaultSettings());
    window.localStorage.setItem(KEY, written ?? "");
    await rehydrate();
    expect(snapshot()).toEqual(expected);
    expect(useStorageStatusStore.getState().readFailed).toBe(false);
  });
});
