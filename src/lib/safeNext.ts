/**
 * D-05: open-redirect guard for the post-login `?next=` target.
 * Pure and client-importable (no server-only imports).
 * Re-checks AFTER URL normalization: "/.//evil.com" normalizes to "//evil.com".
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  // Reject control characters and backslashes.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return "/";
  try {
    const base = "http://internal.invalid";
    const u = new URL(raw, base);
    if (u.origin !== base) return "/";
    const path = u.pathname + u.search + u.hash;
    if (!path.startsWith("/") || path.startsWith("//")) return "/";
    if (path === "/login" || path.startsWith("/login?") || path.startsWith("/api/"))
      return "/";
    return path;
  } catch {
    return "/";
  }
}
