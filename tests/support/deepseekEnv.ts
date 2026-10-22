import { vi } from "vitest";

/**
 * Stubs the server environment the LLM routes read, for tests that drive a real route handler from
 * a component. Kept outside `src/` so the source guard of ACC-04 (tests/llmSecrets.guard.test.ts),
 * which scans `src/`, keeps its rule that only the server module and the tests of the routes
 * mention the key variable. Undo with `vi.unstubAllEnvs()`.
 */
export function stubDeepseekEnv(key: string): void {
  vi.stubEnv("DEEPSEEK_API_KEY", key);
  vi.stubEnv("DEEPSEEK_MODEL", undefined);
}
