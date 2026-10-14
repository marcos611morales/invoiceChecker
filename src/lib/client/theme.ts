// RED skeleton: exports the planned API with inert bodies so the tests load and fail on assertions.
export const THEME_STORAGE_KEY = "invoicechecker:theme";

export const themeInitScript = "";

export function useActiveTheme(): "light" | "dark" {
  return "light";
}

export function useMounted(): boolean {
  return false;
}

export function toggleTheme(): void {
  // intentionally empty until GREEN
}
