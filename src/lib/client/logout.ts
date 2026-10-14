/** POST /api/auth/logout, ignore failures, then hard-navigate to /login (never client-router navigation). */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Network failure: still leave the app; the proxy gates whatever is next.
  }
  // Hard navigation on purpose: resets module memory and the router cache.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}
