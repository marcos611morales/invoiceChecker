// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "invoicechecker:theme";

type MediaListener = (event: { matches: boolean }) => void;

/** Installs a controllable window.matchMedia (jsdom does not implement it). */
function stubMatchMedia(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<MediaListener>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return dark && query.includes("dark");
    },
    media: query,
    addEventListener: (_type: string, listener: MediaListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: MediaListener) => {
      listeners.delete(listener);
    },
  })) as unknown as typeof window.matchMedia;
  return {
    setDark(next: boolean) {
      dark = next;
      for (const listener of listeners) listener({ matches: next });
    },
  };
}

/** Executes the pre-hydration script the way the browser would. */
function runInitScript(script: string) {
  new Function(script)();
}

describe("theme engine", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("toggleTheme", () => {
    it("with no stored value and a light page adds the dark class and stores dark", async () => {
      stubMatchMedia(false);
      const { toggleTheme } = await import("./theme");
      toggleTheme();
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(localStorage.getItem(KEY)).toBe("dark");
    });

    it("flips back to light and stores light on a second call", async () => {
      stubMatchMedia(false);
      const { toggleTheme } = await import("./theme");
      toggleTheme();
      toggleTheme();
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(localStorage.getItem(KEY)).toBe("light");
    });

    it("still flips the class when localStorage.setItem throws", async () => {
      stubMatchMedia(false);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage blocked");
      });
      const { toggleTheme } = await import("./theme");
      expect(() => toggleTheme()).not.toThrow();
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(() => toggleTheme()).not.toThrow();
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("themeInitScript", () => {
    it("stored light wins over an OS in dark mode", async () => {
      stubMatchMedia(true);
      localStorage.setItem(KEY, "light");
      const { themeInitScript } = await import("./theme");
      runInitScript(themeInitScript);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("stored dark adds the dark class even if the OS is light", async () => {
      stubMatchMedia(false);
      localStorage.setItem(KEY, "dark");
      const { themeInitScript } = await import("./theme");
      runInitScript(themeInitScript);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("follows the OS when nothing is stored", async () => {
      stubMatchMedia(true);
      const { themeInitScript } = await import("./theme");
      runInitScript(themeInitScript);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("follows the OS when the stored value is invalid", async () => {
      stubMatchMedia(true);
      localStorage.setItem(KEY, "blue");
      const { themeInitScript } = await import("./theme");
      runInitScript(themeInitScript);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("follows the OS when localStorage.getItem throws", async () => {
      stubMatchMedia(true);
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage blocked");
      });
      const { themeInitScript } = await import("./theme");
      expect(() => runInitScript(themeInitScript)).not.toThrow();
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes a stale dark class when the stored choice is light", async () => {
      stubMatchMedia(true);
      localStorage.setItem(KEY, "light");
      document.documentElement.classList.add("dark");
      const { themeInitScript } = await import("./theme");
      runInitScript(themeInitScript);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("useActiveTheme", () => {
    it("reports the class on the html element and follows toggles", async () => {
      stubMatchMedia(false);
      const { useActiveTheme, toggleTheme } = await import("./theme");
      const { result } = renderHook(() => useActiveTheme());
      expect(result.current).toBe("light");
      await act(async () => {
        toggleTheme();
        await Promise.resolve();
      });
      expect(result.current).toBe("dark");
    });

    it("follows a live OS change while no choice is stored", async () => {
      const media = stubMatchMedia(false);
      const { useActiveTheme } = await import("./theme");
      const { result } = renderHook(() => useActiveTheme());
      expect(result.current).toBe("light");
      await act(async () => {
        media.setDark(true);
        await Promise.resolve();
      });
      expect(result.current).toBe("dark");
      await act(async () => {
        media.setDark(false);
        await Promise.resolve();
      });
      expect(result.current).toBe("light");
    });

    it("ignores OS changes once the user has chosen a theme", async () => {
      const media = stubMatchMedia(false);
      const { useActiveTheme, toggleTheme } = await import("./theme");
      const { result } = renderHook(() => useActiveTheme());
      await act(async () => {
        toggleTheme(); // user picks dark
        await Promise.resolve();
      });
      await act(async () => {
        media.setDark(true);
        media.setDark(false); // OS flips back to light
        await Promise.resolve();
      });
      expect(result.current).toBe("dark");
    });

    it("keeps the session choice when storage is blocked", async () => {
      const media = stubMatchMedia(false);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage blocked");
      });
      const { useActiveTheme, toggleTheme } = await import("./theme");
      const { result } = renderHook(() => useActiveTheme());
      await act(async () => {
        toggleTheme();
        await Promise.resolve();
      });
      await act(async () => {
        media.setDark(true);
        media.setDark(false);
        await Promise.resolve();
      });
      expect(result.current).toBe("dark");
    });

    it("renders light in the server snapshot", async () => {
      stubMatchMedia(true);
      document.documentElement.classList.add("dark");
      const { useActiveTheme } = await import("./theme");
      function Probe() {
        return createElement("span", null, useActiveTheme());
      }
      expect(renderToString(createElement(Probe))).toContain("light");
    });
  });

  describe("useMounted", () => {
    it("returns false in the server snapshot", async () => {
      const { useMounted } = await import("./theme");
      function Probe() {
        return createElement("span", null, String(useMounted()));
      }
      expect(renderToString(createElement(Probe))).toContain("false");
    });

    it("returns true on the client", async () => {
      const { useMounted } = await import("./theme");
      const { result } = renderHook(() => useMounted());
      expect(result.current).toBe(true);
    });
  });
});
