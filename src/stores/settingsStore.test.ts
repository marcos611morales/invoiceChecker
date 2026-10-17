// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SEED_CATEGORIES,
  SIN_CATEGORIA,
  defaultSettings,
  type SettingsData,
} from "@/domain/settings/types";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";
import { resetSettingsStore } from "../../tests/support/settingsStorage";

const KEY = "invoicechecker:settings";

async function rehydrate(): Promise<void> {
  await useSettingsStore.persist.rehydrate();
}

function snapshot(): SettingsData {
  const { ivaMode, categories, supplierCategories, conceptRules } = useSettingsStore.getState();
  return { ivaMode, categories, supplierCategories, conceptRules };
}

function storeRaw(state: unknown, version: number | undefined = 2): void {
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
  it("rehydrates a stored version 1 Sin IVA with the nine suggestions and rewrites storage as version 2", async () => {
    storeRaw({ ivaMode: "sin" }, 1);
    await rehydrate();
    expect(snapshot()).toEqual({ ...defaultSettings(), ivaMode: "sin" });
    expect(storedEnvelope()).toEqual({
      state: { ...defaultSettings(), ivaMode: "sin" },
      version: 2,
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

describe("settingsStore stored version 2", () => {
  it("rehydrates a valid value unchanged", async () => {
    const stored: SettingsData = {
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
    storeRaw(stored);
    await rehydrate();
    expect(snapshot()).toEqual(stored);
  });

  it("keeps zero categories after reload: the suggestions are never re-seeded", async () => {
    storeRaw({ ivaMode: "sin", categories: [], supplierCategories: [], conceptRules: [] });
    await rehydrate();
    expect(snapshot()).toEqual({
      ivaMode: "sin",
      categories: [],
      supplierCategories: [],
      conceptRules: [],
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
  it("writes { state: { ivaMode, categories, supplierCategories, conceptRules }, version: 2 } under the contract key", () => {
    useSettingsStore.getState().setIvaMode("sin");
    expect(storedEnvelope()).toEqual({
      state: {
        ivaMode: "sin",
        categories: defaultSettings().categories,
        supplierCategories: [],
        conceptRules: [],
      },
      version: 2,
    });
  });

  it("writes nothing but the settings key, holding only the four settings fields (D-30, CARGA-06)", () => {
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
    expect(stored).toEqual({ state: defaultSettings(), version: 2 });
    const state: unknown =
      typeof stored === "object" && stored !== null && "state" in stored ? stored.state : null;
    expect(Object.keys(typeof state === "object" && state !== null ? state : {}).sort()).toEqual([
      "categories",
      "conceptRules",
      "ivaMode",
      "supplierCategories",
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
