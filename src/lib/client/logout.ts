import { hardNavigate } from "@/lib/client/navigation";

/** POST /api/auth/logout, ignore failures, then hard-navigate to /login (never client-router navigation). */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Network failure: still leave the app; the proxy gates whatever is next.
  }
  hardNavigate("/login");
}
