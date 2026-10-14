import { useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_STORAGE_KEY } from "./themeScript";

export { THEME_STORAGE_KEY, themeInitScript } from "./themeScript";

type Theme = "light" | "dark";

/** Choice made with the toggle in this page session; survives blocked storage. */
let sessionChoice: Theme | null = null;

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function osPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  let media: MediaQueryList | null = null;
  const onOsChange = (): void => {
    // A stored or session choice always wins over the OS.
    if (sessionChoice !== null || readStoredTheme() !== null) return;
    applyTheme(osPrefersDark() ? "dark" : "light");
  };
  try {
    media = window.matchMedia(DARK_QUERY);
    media.addEventListener("change", onOsChange);
  } catch {
    media = null;
  }

  return () => {
    observer.disconnect();
    media?.removeEventListener("change", onOsChange);
  };
}

/** The theme currently shown (class "dark" on <html>); "light" on the server. */
export function useActiveTheme(): Theme {
  return useSyncExternalStore(subscribeToTheme, currentTheme, () => "light");
}

function noopSubscribe(): () => void {
  return () => {};
}

/** false in the server snapshot (and during hydration), true afterwards on the client. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Flips to the opposite of the displayed theme and stores it under invoicechecker:theme (best effort). */
export function toggleTheme(): void {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  sessionChoice = next;
  applyTheme(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage blocked: the choice only lasts for this session.
  }
}
