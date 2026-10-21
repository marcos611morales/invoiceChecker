// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSafeStorage, type StorageReporter } from "./safeStorage";

const KEY = "invoicechecker:test";

function reporter() {
  const markReadFailed = vi.fn<StorageReporter["markReadFailed"]>();
  const setWriteFailed = vi.fn<StorageReporter["setWriteFailed"]>();
  return { markReadFailed, setWriteFailed, reporter: { markReadFailed, setWriteFailed } };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("createSafeStorage", () => {
  it("returns the envelope that was stored, with the state left as unknown", async () => {
    const spy = reporter();
    const storage = createSafeStorage(() => spy.reporter);
    await storage.setItem(KEY, { state: { anything: [1, 2] }, version: 4 });
    expect(await storage.getItem(KEY)).toEqual({ state: { anything: [1, 2] }, version: 4 });
    expect(spy.markReadFailed).not.toHaveBeenCalled();
  });

  it("returns null and reports nothing when the key is missing", async () => {
    const spy = reporter();
    const storage = createSafeStorage(() => spy.reporter);
    expect(await storage.getItem(KEY)).toBeNull();
    expect(spy.markReadFailed).not.toHaveBeenCalled();
  });

  it("returns null and reports a read failure for invalid JSON or a wrong envelope", async () => {
    for (const raw of ["{not json", "42", JSON.stringify([]), JSON.stringify({ state: 1, version: "1" })]) {
      const spy = reporter();
      const storage = createSafeStorage(() => spy.reporter);
      window.localStorage.setItem(KEY, raw);
      expect(await storage.getItem(KEY)).toBeNull();
      expect(spy.markReadFailed).toHaveBeenCalledTimes(1);
    }
  });

  it("returns null without a read failure when getItem itself throws", async () => {
    const spy = reporter();
    const storage = createSafeStorage(() => spy.reporter);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(await storage.getItem(KEY)).toBeNull();
    expect(spy.markReadFailed).not.toHaveBeenCalled();
  });

  it("reports a write failure when setItem throws and clears it after a good write", async () => {
    const spy = reporter();
    const storage = createSafeStorage(() => spy.reporter);
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    await expect(storage.setItem(KEY, { state: {}, version: 1 })).resolves.toBeUndefined();
    expect(spy.setWriteFailed).toHaveBeenLastCalledWith(true);
    blocked.mockRestore();
    await storage.setItem(KEY, { state: {}, version: 1 });
    expect(spy.setWriteFailed).toHaveBeenLastCalledWith(false);
  });

  it("reports a write failure for a value that cannot be serialized", async () => {
    const spy = reporter();
    const storage = createSafeStorage(() => spy.reporter);
    const circular: { self?: unknown } = {};
    circular.self = circular;
    await expect(storage.setItem(KEY, { state: circular, version: 1 })).resolves.toBeUndefined();
    expect(spy.setWriteFailed).toHaveBeenLastCalledWith(true);
  });

  it("does not throw when removeItem throws", async () => {
    const storage = createSafeStorage(() => reporter().reporter);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await expect(storage.removeItem(KEY)).resolves.toBeUndefined();
  });

  it("asks for the reporter at the moment of each call, not when the adapter is created", async () => {
    const first = reporter();
    const second = reporter();
    let current = first.reporter;
    const storage = createSafeStorage(() => current);
    window.localStorage.setItem(KEY, "{not json");
    await storage.getItem(KEY);
    current = second.reporter;
    await storage.getItem(KEY);
    expect(first.markReadFailed).toHaveBeenCalledTimes(1);
    expect(second.markReadFailed).toHaveBeenCalledTimes(1);
  });
});

describe("createSafeStorage on the server", () => {
  it("does not throw with no window object", async () => {
    const spy = reporter();
    const storage = createSafeStorage(() => spy.reporter);
    vi.stubGlobal("window", undefined);
    try {
      expect(await storage.getItem(KEY)).toBeNull();
      await storage.setItem(KEY, { state: {}, version: 1 });
      await storage.removeItem(KEY);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
