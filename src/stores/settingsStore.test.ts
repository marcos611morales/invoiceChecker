// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";

const KEY = "invoicechecker:settings";

async function rehydrate(): Promise<void> {
  await useSettingsStore.persist.rehydrate();
}

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState({ ivaMode: "con" });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  useSettingsStore.setState({ ivaMode: "con" });
  useSessionStore.getState().clearAll();
});

describe("settingsStore", () => {
  it("starts in Con IVA on the first load", () => {
    expect(useSettingsStore.getState().ivaMode).toBe("con");
  });

  it("restores Sin IVA from a valid stored envelope after rehydrate", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ state: { ivaMode: "sin" }, version: 1 }),
    );
    await rehydrate();
    expect(useSettingsStore.getState().ivaMode).toBe("sin");
  });

  it("writes { state: { ivaMode }, version: 1 } under the contract key", () => {
    useSettingsStore.getState().setIvaMode("sin");
    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "null")).toEqual({
      state: { ivaMode: "sin" },
      version: 1,
    });
  });

  it("falls back to Con IVA for stored invalid JSON", async () => {
    window.localStorage.setItem(KEY, "{not json");
    await rehydrate();
    expect(useSettingsStore.getState().ivaMode).toBe("con");
  });

  it("falls back to Con IVA for a tampered mode value", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ state: { ivaMode: "x" } }));
    await rehydrate();
    expect(useSettingsStore.getState().ivaMode).toBe("con");
  });

  it("falls back to Con IVA for a wrongly shaped envelope", async () => {
    for (const value of [
      "null",
      "42",
      JSON.stringify("sin"),
      JSON.stringify({ ivaMode: "sin" }),
      JSON.stringify({ state: null, version: 1 }),
      JSON.stringify({ state: { ivaMode: 1 }, version: 1 }),
    ]) {
      window.localStorage.setItem(KEY, value);
      await rehydrate();
      expect(useSettingsStore.getState().ivaMode).toBe("con");
    }
  });

  it("keeps Con IVA when the key is missing", async () => {
    await rehydrate();
    expect(useSettingsStore.getState().ivaMode).toBe("con");
  });

  it("keeps Con IVA when getItem throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await rehydrate();
    expect(useSettingsStore.getState().ivaMode).toBe("con");
  });

  it("keeps Con IVA on a version mismatch", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ state: { ivaMode: "sin" }, version: 2 }),
    );
    await rehydrate();
    expect(useSettingsStore.getState().ivaMode).toBe("con");
  });

  it("setIvaMode does not throw when setItem throws (quota or blocked) and still updates memory", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => useSettingsStore.getState().setIvaMode("sin")).not.toThrow();
    expect(useSettingsStore.getState().ivaMode).toBe("sin");
  });

  it("writes nothing but the settings key, holding only ivaMode (D-30, CARGA-06)", () => {
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
    const stored: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    expect(stored).toEqual({ state: { ivaMode: "con" }, version: 1 });
  });

  it("can be imported on the server with no window object", async () => {
    vi.resetModules();
    vi.stubGlobal("window", undefined);
    try {
      const fresh = await import("./settingsStore");
      expect(fresh.useSettingsStore.getState().ivaMode).toBe("con");
      expect(() => fresh.useSettingsStore.getState().setIvaMode("sin")).not.toThrow();
      await fresh.useSettingsStore.persist.rehydrate();
      expect(fresh.useSettingsStore.getState().ivaMode).toBe("sin");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
