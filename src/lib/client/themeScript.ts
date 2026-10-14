/**
 * Server-safe theme constants. The root layout (a Server Component) imports the
 * pre-hydration script from here because theme.ts imports React hooks, which a
 * Server Component module may not import. theme.ts re-exports everything.
 */

/** localStorage key of the persisted theme choice ("light" or "dark"). */
export const THEME_STORAGE_KEY = "invoicechecker:theme";

/** Media query that reports an OS in dark mode. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Pre-hydration script, injected as the first child of <head> (layout.tsx).
 * Constant string: it embeds no user or XML data. It only accepts the literal
 * values "light" or "dark" from storage; anything else (missing, invalid, storage
 * blocked) falls back to the OS preference.
 */
export const themeInitScript = `(function(){try{var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches?"dark":"light"}document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})();`;
